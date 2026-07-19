package com.expressvraem.modules.pasajes.service;

import com.expressvraem.modules.auditoria.service.AuditoriaService;
import com.expressvraem.modules.caja.service.CajaService;
import com.expressvraem.modules.clientes.entity.Cliente;
import com.expressvraem.modules.clientes.repository.ClienteRepository;
import com.expressvraem.modules.pasajes.dto.PasajeResponseDTO;
import com.expressvraem.modules.pasajes.dto.VentaPasajeDTO;
import com.expressvraem.modules.pasajes.entity.Pasaje;
import com.expressvraem.modules.pasajes.repository.PasajeRepository;
import com.expressvraem.modules.promociones.entity.Promocion;
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
import com.expressvraem.shared.utils.SecuenciaService;
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
    private final SecuenciaService secuenciaService;

    /**
     * Agencia donde se contabiliza la operación: la del JWT (OPERADOR/ADMIN_AGENCIA),
     * o la del turno de caja abierto (GERENTE/SUPER_ADMIN eligen agencia al abrir
     * turno cuando trabajan viajando), o la agencia de la ficha del usuario.
     * Nunca se asume la agencia 1: sin agencia determinable no se emite boleta.
     */
    private Long resolverAgenciaTrabajo(Long operadorId) {
        Long ag = AgenciaContext.getAgenciaId();
        if (ag == null) ag = cajaService.getAgenciaTurnoAbierto(operadorId);
        if (ag == null) {
            List<?> row = entityManager
                    .createNativeQuery("SELECT agencia_id FROM usuarios WHERE id = :id")
                    .setParameter("id", operadorId).getResultList();
            if (!row.isEmpty() && row.get(0) != null) ag = ((Number) row.get(0)).longValue();
        }
        if (ag == null) {
            throw new BusinessException(
                    "No se pudo determinar en qué agencia está trabajando. Abra su turno de caja indicando la agencia.",
                    "AGENCIA_REQUERIDA");
        }
        return ag;
    }

    @Transactional
    public PasajeResponseDTO venderPasaje(VentaPasajeDTO dto, Long operadorId,
                                          String ip, String usuarioNombre) {
        Long agenciaId = resolverAgenciaTrabajo(operadorId);

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

        // SELECT FOR UPDATE — prevents double-booking under concurrent requests
        Asiento asiento = asientoRepository.findByViajeIdAndNumeroForUpdate(dto.viajeId(), dto.asientoNumero())
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

        // Single lookup by tipoDoc+numDoc, create if not found
        Cliente cliente = clienteRepository.findByTipoDocAndNumDoc("DNI", dto.clienteDni())
                .orElseGet(() -> {
                    Cliente c = Cliente.builder()
                            .agenciaId(agenciaId)
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
                });

        // Destino por pasajero: si escogió un destino intermedio, el precio sale de
        // la TARIFA de esa ruta y la boleta imprime su destino. El asiento se ocupa
        // el viaje completo (al bajar no se revende — decisión del negocio).
        Long rutaPrecioId = viaje.getRutaId();
        String destinoPasajero = null;
        if (dto.rutaDestinoId() != null && !dto.rutaDestinoId().equals(viaje.getRutaId())) {
            Object[] rutaTramo;
            Object[] rutaViaje;
            try {
                rutaTramo = (Object[]) entityManager
                        .createNativeQuery("SELECT origen, destino FROM rutas WHERE id = :id AND activo = true")
                        .setParameter("id", dto.rutaDestinoId()).getSingleResult();
                rutaViaje = (Object[]) entityManager
                        .createNativeQuery("SELECT origen, destino FROM rutas WHERE id = :id")
                        .setParameter("id", viaje.getRutaId()).getSingleResult();
            } catch (Exception e) {
                throw new BusinessException("La ruta del destino elegido no existe o está inactiva", "RUTA_NO_ENCONTRADA");
            }
            // El destino elegido debe salir de la misma ciudad que el viaje
            if (!String.valueOf(rutaTramo[0]).equalsIgnoreCase(String.valueOf(rutaViaje[0]))) {
                throw new BusinessException(
                        "El destino elegido no corresponde a este viaje: esa ruta sale de "
                                + rutaTramo[0] + " y el viaje sale de " + rutaViaje[0],
                        "DESTINO_INVALIDO");
            }
            rutaPrecioId = dto.rutaDestinoId();
            destinoPasajero = String.valueOf(rutaTramo[1]);
        }

        // La tarifa es el precio BASE referencial (regla del negocio): el operador
        // puede cobrar más o menos al momento de registrar. Se resuelve la tarifa
        // vigente del destino como referencia y, si el precio cobrado difiere,
        // queda registrado en el log para control de gerencia.
        // Nota: la query de una sola columna devuelve el escalar directo, no Object[].
        long tarifaId = 1L;
        String tipoVehiculo = null;
        BigDecimal precioBase = dto.precioBase();
        BigDecimal precioTarifa = null;
        try {
            Object vehTipo = entityManager
                    .createNativeQuery("SELECT tipo FROM vehiculos WHERE id = :vid")
                    .setParameter("vid", viaje.getVehiculoId())
                    .getSingleResult();
            tipoVehiculo = vehTipo != null ? String.valueOf(vehTipo) : null;
            List<Tarifa> tarifas = tarifaRepository.findVigenteEnTemporada(rutaPrecioId, tipoVehiculo);
            if (!tarifas.isEmpty()) {
                tarifaId = tarifas.get(0).getId();
                precioTarifa = tarifas.get(0).getPrecio();
            }
        } catch (Exception ignored) {}
        if (precioBase == null || precioBase.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("El precio del pasaje debe ser mayor a S/ 0.00", "PRECIO_INVALIDO");
        }
        if (precioTarifa != null && precioTarifa.compareTo(precioBase) != 0) {
            log.info("Venta con precio distinto a tarifa: viaje={} asiento={} tarifa={} cobrado={} operador={}",
                    dto.viajeId(), dto.asientoNumero(), precioTarifa, precioBase, operadorId);
        }

        BigDecimal descuento      = dto.descuento() != null ? dto.descuento() : BigDecimal.ZERO;
        String     motivoDescuento = dto.motivoDescuento();

        // Si el cajero seleccionó una promoción, recalcular el descuento desde ella validando vigencia
        if (dto.promocionId() != null) {
            Promocion promo = promocionService.findVigenteById(dto.promocionId(), "PASAJES");
            descuento       = promocionService.calcularDescuento(promo, precioBase);
            motivoDescuento = promo.getNombre();
            promocionService.incrementarUso(promo.getId());
        }

        BigDecimal precioFinal = precioBase.subtract(descuento);
        if (precioFinal.compareTo(BigDecimal.ZERO) < 0) precioFinal = BigDecimal.ZERO;

        // Numeración por agencia y año, atómica en BD (tabla secuencias, V13).
        // El código incluye el código de la agencia para que sea único y legible:
        // VTA-SEDE-HMG-2026-00001
        int anioActual = LocalDateTime.now().getYear();
        long seq = secuenciaService.siguiente("VTA", agenciaId, anioActual);
        String agenciaCodigo = String.valueOf(entityManager
                .createNativeQuery("SELECT codigo FROM agencias WHERE id = :id")
                .setParameter("id", agenciaId).getSingleResult());
        String codigoBoleta = String.format("VTA-%s-%d-%05d", agenciaCodigo, anioActual, seq);

        Pasaje pasaje = Pasaje.builder()
                .agenciaId(agenciaId)
                .viajeId(dto.viajeId())
                .asientoId(asiento.getId())
                .asientoNumero(dto.asientoNumero())
                .clienteId(cliente.getId())
                .tarifaId(tarifaId)
                .vendedorId(operadorId)
                .operadorId(operadorId)
                .precioBase(precioBase)
                .montoDescuento(descuento)
                .precioFinal(precioFinal)
                .motivoDescuento(motivoDescuento)
                .descuentoId(dto.promocionId())
                .destino(destinoPasajero)
                .formaPago(dto.formaPago())
                .estado(esReserva ? "RESERVADO" : "VENDIDO")
                .codigoBoleta(codigoBoleta)
                .serie(esReserva ? "RSV" : "VTA")
                .correlativo(String.format("%06d", seq))
                .codigoPasaje(codigoBoleta)
                .build();

        Pasaje saved = pasajeRepository.save(pasaje);

        // Registrar en caja solo si es venta con pago inmediato (no reserva).
        // Sin turno abierto NO se emite boleta: el dinero quedaría fuera de toda
        // caja y el día no cuadraría (mismo criterio que encomiendas al contado).
        if (!esReserva) {
            try {
                cajaService.registrarMovimiento(
                        cajaService.getTurnoActual(operadorId).getId(),
                        "INGRESO",
                        "Pasaje " + codigoBoleta + " - asiento " + dto.asientoNumero(),
                        precioFinal, operadorId, "PASAJE", saved.getId(),
                        tipoVehiculo != null ? "PASAJE_" + tipoVehiculo : "PASAJE",
                        viaje.getId(), viaje.getVehiculoId(), tipoVehiculo, viaje.getConductorId());
            } catch (BusinessException ex) {
                throw new BusinessException(
                        "Debe tener un turno de caja abierto para vender pasajes al contado. Abra su caja primero.",
                        "CAJA_REQUERIDA");
            }
        }

        // WebSocket
        wsPublisher.publicarActualizacionAsientos(dto.viajeId(),
                new AsientoUpdateDTO(dto.viajeId(), dto.asientoNumero(), esReserva ? "RESERVADO" : "OCUPADO", LocalDateTime.now()));

        auditoriaService.registrar(operadorId, usuarioNombre, agenciaId,
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

        // Si el pasaje ya estaba pagado, la anulación implica devolver el dinero:
        // se registra el egreso en la caja del operador (requiere turno abierto)
        boolean eraVendido = "VENDIDO".equals(pasaje.getEstado());
        if (eraVendido && pasaje.getPrecioFinal() != null && pasaje.getPrecioFinal().signum() > 0) {
            try {
                cajaService.registrarEgreso(operadorId,
                        "Devolución por anulación de pasaje " + pasaje.getCodigoBoleta(),
                        pasaje.getPrecioFinal(), ip, usuarioNombre);
            } catch (BusinessException ex) {
                throw new BusinessException(
                        "Para anular un pasaje pagado necesita turno de caja abierto: se registra la devolución del dinero al cliente.",
                        "CAJA_REQUERIDA");
            }
        }

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

        // El cobro de la reserva exige caja abierta y lleva las dimensiones del
        // viaje para que el ingreso caiga en PASAJE_COMBI/PASAJE_CAMIONETA
        try {
            var viajeReserva = viajeRepository.findById(pasaje.getViajeId()).orElse(null);
            String tipoVehReserva = null;
            if (viajeReserva != null && viajeReserva.getVehiculoId() != null) {
                tipoVehReserva = (String) entityManager.createNativeQuery(
                                "SELECT tipo FROM vehiculos WHERE id = :vid")
                        .setParameter("vid", viajeReserva.getVehiculoId())
                        .getSingleResult();
            }
            cajaService.registrarMovimiento(
                    cajaService.getTurnoActual(operadorId).getId(),
                    "INGRESO",
                    "Confirmacion reserva " + pasaje.getCodigoBoleta() + " - asiento " + pasaje.getAsientoNumero(),
                    pasaje.getPrecioFinal(), operadorId, "PASAJE", pasaje.getId(),
                    tipoVehReserva != null ? "PASAJE_" + tipoVehReserva : "PASAJE",
                    pasaje.getViajeId(),
                    viajeReserva != null ? viajeReserva.getVehiculoId() : null,
                    tipoVehReserva,
                    viajeReserva != null ? viajeReserva.getConductorId() : null);
        } catch (BusinessException ex) {
            throw new BusinessException(
                    "Debe tener un turno de caja abierto para confirmar la reserva: el cobro entra a su caja.",
                    "CAJA_REQUERIDA");
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
                    p.getFormaPago(), p.getDestino(), p.getEstado(), p.getFechaVenta());
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
                p.getFormaPago(), p.getDestino(), p.getEstado(), p.getFechaVenta());
    }
}
