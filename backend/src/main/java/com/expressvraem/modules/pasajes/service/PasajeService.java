package com.expressvraem.modules.pasajes.service;

import com.expressvraem.modules.caja.service.CajaService;
import com.expressvraem.modules.clientes.entity.Cliente;
import com.expressvraem.modules.clientes.repository.ClienteRepository;
import com.expressvraem.modules.pasajes.dto.PasajeResponseDTO;
import com.expressvraem.modules.pasajes.dto.VentaPasajeDTO;
import com.expressvraem.modules.pasajes.entity.Pasaje;
import com.expressvraem.modules.pasajes.repository.PasajeRepository;
import com.expressvraem.modules.viajes.entity.Asiento;
import com.expressvraem.modules.viajes.repository.AsientoRepository;
import com.expressvraem.shared.exceptions.BusinessException;
import com.expressvraem.shared.exceptions.ResourceNotFoundException;
import com.expressvraem.shared.middleware.AgenciaContext;
import com.expressvraem.shared.websocket.WebSocketEventPublisher;
import com.expressvraem.shared.websocket.dto.AsientoUpdateDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

@Service
@RequiredArgsConstructor
@Slf4j
public class PasajeService {

    private final PasajeRepository pasajeRepository;
    private final AsientoRepository asientoRepository;
    private final ClienteRepository clienteRepository;
    private final WebSocketEventPublisher wsPublisher;
    private final CajaService cajaService;

    private static final AtomicLong SEQ = new AtomicLong(
            System.currentTimeMillis() % 100000);

    @Transactional
    public PasajeResponseDTO venderPasaje(VentaPasajeDTO dto, Long operadorId) {
        Long agenciaId = AgenciaContext.getAgenciaId();

        // Lock asiento por viaje + numero (SELECT FOR UPDATE via JPQL pessimistic lock)
        Asiento asiento = asientoRepository.findByViajeIdAndNumero(dto.viajeId(), dto.asientoNumero())
                .orElseThrow(() -> new BusinessException(
                        "El asiento N° " + dto.asientoNumero() + " no existe en este viaje",
                        "ASIENTO_NO_ENCONTRADO"));

        if (!"LIBRE".equals(asiento.getEstado())) {
            throw new BusinessException(
                    "El asiento número " + dto.asientoNumero() + " ya fue ocupado. Por favor selecciona otro asiento.",
                    "ASIENTO_NO_DISPONIBLE");
        }

        // Marcar asiento como OCUPADO
        asiento.setEstado("OCUPADO");
        asientoRepository.save(asiento);

        // Buscar o crear cliente
        Cliente cliente = clienteRepository.findByDni(dto.clienteDni())
                .orElseGet(() -> clienteRepository.findByTipoDocAndNumDoc("DNI", dto.clienteDni())
                        .orElseGet(() -> {
                            Cliente c = Cliente.builder()
                                    .agenciaId(agenciaId != null ? agenciaId : 1L)
                                    .tipo("PERSONA")
                                    .nombres(dto.clienteNombres())
                                    .apellidos(dto.clienteApellidos())
                                    .tipoDoc("DNI")
                                    .numDoc(dto.clienteDni())
                                    .dni(dto.clienteDni())
                                    .telefono(dto.clienteTelefono())
                                    .direccion(dto.clienteDireccion())
                                    .build();
                            return clienteRepository.save(c);
                        }));

        BigDecimal descuento   = dto.descuento() != null ? dto.descuento() : BigDecimal.ZERO;
        BigDecimal precioFinal = dto.precioBase().subtract(descuento);
        if (precioFinal.compareTo(BigDecimal.ZERO) < 0) precioFinal = BigDecimal.ZERO;

        long seq = SEQ.incrementAndGet();
        String codigoBoleta = String.format("VTA-%d-%05d", LocalDateTime.now().getYear(), seq);

        Pasaje pasaje = Pasaje.builder()
                .agenciaId(agenciaId != null ? agenciaId : 1L)
                .viajeId(dto.viajeId())
                .asientoId(asiento.getId())
                .asientoNumero(dto.asientoNumero())
                .clienteId(cliente.getId())
                .tarifaId(1L)
                .vendedorId(operadorId)
                .operadorId(operadorId)
                .precioBase(dto.precioBase())
                .montoDescuento(descuento)
                .precioFinal(precioFinal)
                .motivoDescuento(dto.motivoDescuento())
                .formaPago(dto.formaPago())
                .estado("VENDIDO")
                .codigoBoleta(codigoBoleta)
                .serie("VTA")
                .correlativo(String.format("%06d", seq))
                .codigoPasaje(codigoBoleta)
                .build();

        Pasaje saved = pasajeRepository.save(pasaje);

        // Registrar en caja si hay turno activo
        try {
            cajaService.registrarMovimiento(
                    cajaService.getTurnoActual(operadorId).getId(),
                    "INGRESO",
                    "Pasaje " + codigoBoleta + " — asiento " + dto.asientoNumero(),
                    precioFinal, operadorId, "PASAJE", saved.getId());
        } catch (Exception ex) {
            log.warn("Sin turno activo para registrar pasaje {}: {}", codigoBoleta, ex.getMessage());
        }

        // WebSocket
        wsPublisher.publicarActualizacionAsientos(dto.viajeId(),
                new AsientoUpdateDTO(dto.viajeId(), dto.asientoNumero(), "OCUPADO", LocalDateTime.now()));

        log.info("Pasaje vendido: {} asiento={} precio={}", codigoBoleta, dto.asientoNumero(), precioFinal);

        return toDTO(saved, cliente);
    }

    @Transactional
    public void anularPasaje(Long id, String motivo, Long operadorId) {
        Pasaje pasaje = pasajeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Pasaje", id));
        if ("ANULADO".equals(pasaje.getEstado()))
            throw new BusinessException("El pasaje ya está anulado", "PASAJE_YA_ANULADO");
        if (motivo == null || motivo.isBlank())
            throw new BusinessException("El motivo de anulación es obligatorio", "MOTIVO_REQUERIDO");

        pasaje.setEstado("ANULADO");
        pasaje.setMotivoAnulacion(motivo);
        pasaje.setAnuladoPor(operadorId);
        pasaje.setFechaAnulacion(LocalDateTime.now());
        pasajeRepository.save(pasaje);

        // Liberar asiento
        asientoRepository.findByViajeIdAndNumero(pasaje.getViajeId(), pasaje.getAsientoNumero())
                .ifPresent(a -> { a.setEstado("LIBRE"); asientoRepository.save(a); });

        wsPublisher.publicarActualizacionAsientos(pasaje.getViajeId(),
                new AsientoUpdateDTO(pasaje.getViajeId(), pasaje.getAsientoNumero(), "LIBRE", LocalDateTime.now()));
    }

    public List<Asiento> getAsientosPorViaje(Long viajeId) {
        return asientoRepository.findByViajeIdOrderByNumeroAsc(viajeId);
    }

    public Pasaje findById(Long id) {
        return pasajeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Pasaje", id));
    }

    public List<Pasaje> getLista(Long agenciaId, String estado, String codigoBoleta) {
        if (codigoBoleta != null && !codigoBoleta.isBlank())
            return pasajeRepository.searchByCodigoBoleta(codigoBoleta);
        if (agenciaId != null && estado != null)
            return pasajeRepository.findByAgenciaIdAndEstado(agenciaId, estado);
        if (agenciaId != null)
            return pasajeRepository.findByAgenciaIdOrderByFechaVentaDesc(agenciaId);
        return pasajeRepository.findAll();
    }

    private PasajeResponseDTO toDTO(Pasaje p, Cliente c) {
        return new PasajeResponseDTO(
                p.getId(), p.getCodigoBoleta(), p.getViajeId(), p.getAsientoNumero(),
                c.getId(), c.getNombres(), c.getApellidos(), c.getNumDoc(),
                p.getPrecioBase(), p.getMontoDescuento(), p.getPrecioFinal(),
                p.getFormaPago(), p.getEstado(), p.getFechaVenta());
    }
}
