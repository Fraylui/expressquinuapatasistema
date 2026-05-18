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
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

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
                    "El asiento número " + dto.asientoNumero() + " ya fue ocupado o reservado. Por favor selecciona otro asiento.",
                    "ASIENTO_NO_DISPONIBLE");
        }

        boolean esReserva = dto.esReserva();

        // Marcar asiento según tipo de operación
        asiento.setEstado(esReserva ? "RESERVADO" : "OCUPADO");
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
                .estado(esReserva ? "RESERVADO" : "VENDIDO")
                .codigoBoleta(codigoBoleta)
                .serie(esReserva ? "RSV" : "VTA")
                .correlativo(String.format("%06d", seq))
                .codigoPasaje(codigoBoleta)
                .build();

        Pasaje saved = pasajeRepository.save(pasaje);

        // Registrar en caja solo si es venta con pago inmediato (no reserva)
        if (!esReserva) {
            try {
                cajaService.registrarMovimiento(
                        cajaService.getTurnoActual(operadorId).getId(),
                        "INGRESO",
                        "Pasaje " + codigoBoleta + " - asiento " + dto.asientoNumero(),
                        precioFinal, operadorId, "PASAJE", saved.getId());
            } catch (Exception ex) {
                log.warn("Sin turno activo para registrar pasaje {}: {}", codigoBoleta, ex.getMessage());
            }
        }

        // WebSocket
        wsPublisher.publicarActualizacionAsientos(dto.viajeId(),
                new AsientoUpdateDTO(dto.viajeId(), dto.asientoNumero(), esReserva ? "RESERVADO" : "OCUPADO", LocalDateTime.now()));

        log.info("Pasaje {}: {} asiento={} precio={}", esReserva ? "reservado" : "vendido", codigoBoleta, dto.asientoNumero(), precioFinal);

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

    @Transactional
    public PasajeResponseDTO confirmarReserva(Long id, String formaPago, Long operadorId) {
        Pasaje pasaje = pasajeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Pasaje", id));
        if (!"RESERVADO".equals(pasaje.getEstado()))
            throw new BusinessException("Solo se pueden confirmar pasajes en estado RESERVADO", "ESTADO_INVALIDO");
        if (formaPago == null || formaPago.isBlank())
            throw new BusinessException("La forma de pago es obligatoria para confirmar", "FORMA_PAGO_REQUERIDA");

        pasaje.setEstado("VENDIDO");
        pasaje.setFormaPago(formaPago);
        pasaje.setSerie("VTA");
        pasajeRepository.save(pasaje);

        asientoRepository.findByViajeIdAndNumero(pasaje.getViajeId(), pasaje.getAsientoNumero())
                .ifPresent(a -> { a.setEstado("OCUPADO"); asientoRepository.save(a); });

        try {
            cajaService.registrarMovimiento(
                    cajaService.getTurnoActual(operadorId).getId(),
                    "INGRESO",
                    "Confirmacion reserva " + pasaje.getCodigoBoleta() + " - asiento " + pasaje.getAsientoNumero(),
                    pasaje.getPrecioFinal(), operadorId, "PASAJE", pasaje.getId());
        } catch (Exception ex) {
            log.warn("Sin turno activo para confirmar reserva {}: {}", pasaje.getCodigoBoleta(), ex.getMessage());
        }

        wsPublisher.publicarActualizacionAsientos(pasaje.getViajeId(),
                new AsientoUpdateDTO(pasaje.getViajeId(), pasaje.getAsientoNumero(), "OCUPADO", LocalDateTime.now()));

        log.info("Reserva confirmada: {}", pasaje.getCodigoBoleta());

        Cliente cliente = clienteRepository.findById(pasaje.getClienteId()).orElse(null);
        return toDTO(pasaje, cliente);
    }

    public List<Asiento> getAsientosPorViaje(Long viajeId) {
        return asientoRepository.findByViajeIdOrderByNumeroAsc(viajeId);
    }

    public Pasaje findById(Long id) {
        return pasajeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Pasaje", id));
    }

    public List<PasajeResponseDTO> getLista(Long agenciaId, String estado, String codigoBoleta) {
        List<Pasaje> pasajes;
        if (codigoBoleta != null && !codigoBoleta.isBlank())
            pasajes = pasajeRepository.searchByCodigoBoleta(codigoBoleta);
        else if (agenciaId != null && estado != null)
            pasajes = pasajeRepository.findByAgenciaIdAndEstado(agenciaId, estado);
        else if (agenciaId != null)
            pasajes = pasajeRepository.findByAgenciaIdOrderByFechaVentaDesc(agenciaId);
        else
            pasajes = pasajeRepository.findAll();

        Set<Long> clienteIds = pasajes.stream()
                .map(Pasaje::getClienteId).filter(Objects::nonNull).collect(Collectors.toSet());
        Map<Long, Cliente> clienteMap = clienteRepository.findAllById(clienteIds).stream()
                .collect(Collectors.toMap(Cliente::getId, c -> c));

        return pasajes.stream().map(p -> {
            Cliente c = clienteMap.get(p.getClienteId());
            return new PasajeResponseDTO(
                    p.getId(), p.getCodigoBoleta(), p.getViajeId(), p.getAsientoNumero(),
                    p.getClienteId(),
                    c != null ? c.getNombres() : "",
                    c != null ? c.getApellidos() : "",
                    c != null ? c.getNumDoc() : "",
                    p.getPrecioBase(), p.getMontoDescuento(), p.getPrecioFinal(),
                    p.getFormaPago(), p.getEstado(), p.getFechaVenta());
        }).toList();
    }

    private PasajeResponseDTO toDTO(Pasaje p, Cliente c) {
        return new PasajeResponseDTO(
                p.getId(), p.getCodigoBoleta(), p.getViajeId(), p.getAsientoNumero(),
                c != null ? c.getId() : p.getClienteId(),
                c != null ? c.getNombres() : "",
                c != null ? c.getApellidos() : "",
                c != null ? c.getNumDoc() : "",
                p.getPrecioBase(), p.getMontoDescuento(), p.getPrecioFinal(),
                p.getFormaPago(), p.getEstado(), p.getFechaVenta());
    }
}
