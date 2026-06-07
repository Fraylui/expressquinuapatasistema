package com.expressvraem.modules.pasajes.service;

import com.expressvraem.modules.auditoria.service.AuditoriaService;
import com.expressvraem.modules.caja.service.CajaService;
import com.expressvraem.modules.clientes.entity.Cliente;
import com.expressvraem.modules.clientes.repository.ClienteRepository;
import com.expressvraem.modules.pasajes.dto.PasajeResponseDTO;
import com.expressvraem.modules.pasajes.dto.VentaPasajeDTO;
import com.expressvraem.modules.pasajes.entity.Pasaje;
import com.expressvraem.modules.pasajes.repository.PasajeRepository;
import com.expressvraem.modules.promociones.service.PromocionService;
import com.expressvraem.modules.tarifas.entity.Tarifa;
import com.expressvraem.modules.tarifas.repository.TarifaRepository;
import com.expressvraem.modules.viajes.entity.Asiento;
import com.expressvraem.modules.viajes.entity.Viaje;
import com.expressvraem.modules.viajes.repository.AsientoRepository;
import com.expressvraem.modules.viajes.repository.ViajeRepository;
import com.expressvraem.shared.exceptions.BusinessException;
import com.expressvraem.shared.exceptions.ResourceNotFoundException;
import com.expressvraem.shared.middleware.AgenciaContext;
import com.expressvraem.shared.websocket.WebSocketEventPublisher;
import com.expressvraem.shared.websocket.dto.AsientoUpdateDTO;
import jakarta.persistence.EntityManager;
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
    private final ViajeRepository viajeRepository;
    private final WebSocketEventPublisher wsPublisher;
    private final CajaService cajaService;
    private final AuditoriaService auditoriaService;
    private final PromocionService promocionService;
    private final TarifaRepository tarifaRepository;
    private final EntityManager entityManager;

    private static final AtomicLong SEQ = new AtomicLong(
            System.currentTimeMillis() % 100000);

    @Transactional
    public PasajeResponseDTO venderPasaje(VentaPasajeDTO dto, Long operadorId,
                                          String ip, String usuarioNombre) {
        Long agenciaId = AgenciaContext.getAgenciaId();

        // Validar que el viaje no haya vencido (más de 30 min desde su hora de salida)
        Viaje viaje = viajeRepository.findById(dto.viajeId())
                .orElseThrow(() -> new ResourceNotFoundException("Viaje", dto.viajeId()));

        if (!"PROGRAMADO".equals(viaje.getEstado()) && !"EN_RUTA".equals(viaje.getEstado())) {
            throw new BusinessException(
                    "No se puede vender pasajes para un viaje en estado: " + viaje.getEstado(),
                    "VIAJE_NO_ACTIVO");
        }
        if (viaje.getFechaHoraSal() != null &&
                viaje.getFechaHoraSal().isBefore(java.time.OffsetDateTime.now().minusMinutes(30))) {
            throw new BusinessException(
                    "Este viaje ya superó su hora de salida. No se pueden registrar más pasajes.",
                    "VIAJE_VENCIDO");
        }

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

        BigDecimal descuento      = dto.descuento() != null ? dto.descuento() : BigDecimal.ZERO;
        String     motivoDescuento = dto.motivoDescuento();

        // Si el cajero seleccionó una promoción, recalcular el descuento desde ella
        if (dto.promocionId() != null) {
            promocionService.findById(dto.promocionId()).ifPresent(promo -> {
                // El descuento calculado queda capturado por la variable efectiva más abajo
            });
            // Usar variable final para lambda-capture
            final BigDecimal[] ref = { descuento };
            final String[] motivoRef = { motivoDescuento };
            promocionService.findById(dto.promocionId()).ifPresent(promo -> {
                ref[0]      = promocionService.calcularDescuento(promo, dto.precioBase());
                motivoRef[0] = promo.getNombre();
                promocionService.incrementarUso(promo.getId());
            });
            descuento      = ref[0];
            motivoDescuento = motivoRef[0];
        }

        BigDecimal precioFinal = dto.precioBase().subtract(descuento);
        if (precioFinal.compareTo(BigDecimal.ZERO) < 0) precioFinal = BigDecimal.ZERO;

        // Resolver tarifaId real (rutaId + tipoVehiculo del viaje)
        long tarifaId = 1L;
        try {
            Object[] vehRow = (Object[]) entityManager
                    .createNativeQuery("SELECT tipo FROM vehiculos WHERE id = :vid")
                    .setParameter("vid", viaje.getVehiculoId())
                    .getSingleResult();
            String tipoVehiculo = String.valueOf(vehRow[0]);
            List<Tarifa> tarifas = tarifaRepository.findVigenteByRutaAndTipo(viaje.getRutaId(), tipoVehiculo);
            if (!tarifas.isEmpty()) tarifaId = tarifas.get(0).getId();
        } catch (Exception ignored) {}

        long seq = SEQ.incrementAndGet();
        String codigoBoleta = String.format("VTA-%d-%05d", LocalDateTime.now().getYear(), seq);

        Pasaje pasaje = Pasaje.builder()
                .agenciaId(agenciaId != null ? agenciaId : 1L)
                .viajeId(dto.viajeId())
                .asientoId(asiento.getId())
                .asientoNumero(dto.asientoNumero())
                .clienteId(cliente.getId())
                .tarifaId(tarifaId)
                .vendedorId(operadorId)
                .operadorId(operadorId)
                .precioBase(dto.precioBase())
                .montoDescuento(descuento)
                .precioFinal(precioFinal)
                .motivoDescuento(motivoDescuento)
                .descuentoId(dto.promocionId())
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

        auditoriaService.registrar(operadorId, usuarioNombre, agenciaId != null ? agenciaId : 1L,
                "INSERT", "PASAJES", "PASAJE", saved.getId(),
                (esReserva ? "RESERVA" : "VENTA") + " boleta=" + codigoBoleta
                        + " asiento=" + dto.asientoNumero() + " precio=" + precioFinal.toPlainString()
                        + " formaPago=" + dto.formaPago(),
                ip);

        log.info("Pasaje {}: {} asiento={} precio={}", esReserva ? "reservado" : "vendido", codigoBoleta, dto.asientoNumero(), precioFinal);

        return toDTO(saved, cliente);
    }

    @Transactional
    public void anularPasaje(Long id, String motivo, Long operadorId,
                             String ip, String usuarioNombre) {
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

        auditoriaService.registrar(operadorId, usuarioNombre, pasaje.getAgenciaId(),
                "DELETE", "PASAJES", "PASAJE", id,
                "ANULACION boleta=" + pasaje.getCodigoBoleta() + " motivo=" + motivo,
                ip);

        wsPublisher.publicarActualizacionAsientos(pasaje.getViajeId(),
                new AsientoUpdateDTO(pasaje.getViajeId(), pasaje.getAsientoNumero(), "LIBRE", LocalDateTime.now()));
    }

    @Transactional
    public PasajeResponseDTO confirmarReserva(Long id, String formaPago, Long operadorId,
                                              String ip, String usuarioNombre) {
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

        auditoriaService.registrar(operadorId, usuarioNombre, pasaje.getAgenciaId(),
                "UPDATE", "PASAJES", "PASAJE", id,
                "CONFIRMACION boleta=" + pasaje.getCodigoBoleta()
                        + " precio=" + pasaje.getPrecioFinal().toPlainString()
                        + " formaPago=" + formaPago,
                ip);

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

    public List<PasajeResponseDTO> getLista(Long agenciaId, String estado, String codigoBoleta, String clienteBusqueda) {
        List<Pasaje> pasajes;

        if (clienteBusqueda != null && !clienteBusqueda.isBlank()) {
            String busq = clienteBusqueda.trim();
            List<Cliente> clienteList;
            if (busq.matches("\\d+")) {
                if (agenciaId != null) {
                    clienteList = clienteRepository.findByAgenciaIdAndNumDocContainingIgnoreCase(agenciaId, busq);
                } else {
                    clienteList = clienteRepository.findAll().stream()
                            .filter(c -> c.getNumDoc() != null && c.getNumDoc().contains(busq)).toList();
                }
            } else {
                if (agenciaId != null) {
                    clienteList = clienteRepository.findByAgenciaIdAndApellidosContainingIgnoreCaseOrAgenciaIdAndNombresContainingIgnoreCase(
                            agenciaId, busq, agenciaId, busq);
                } else {
                    clienteList = clienteRepository.findByApellidosContainingIgnoreCaseOrNombresContainingIgnoreCase(busq, busq);
                }
            }
            List<Long> clienteIds = clienteList.stream().map(Cliente::getId).toList();
            if (clienteIds.isEmpty()) return List.of();
            pasajes = agenciaId != null
                    ? pasajeRepository.findByAgenciaIdAndClienteIdIn(agenciaId, clienteIds)
                    : pasajeRepository.findByClienteIdIn(clienteIds);
        } else if (codigoBoleta != null && !codigoBoleta.isBlank()) {
            pasajes = pasajeRepository.searchByCodigoBoleta(codigoBoleta);
        } else if (agenciaId != null && estado != null) {
            pasajes = pasajeRepository.findByAgenciaIdAndEstado(agenciaId, estado);
        } else if (agenciaId != null) {
            pasajes = pasajeRepository.findByAgenciaIdOrderByFechaVentaDesc(agenciaId);
        } else {
            pasajes = pasajeRepository.findAll();
        }

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
