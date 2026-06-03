package com.expressvraem.modules.encomiendas.service;

import com.expressvraem.modules.auditoria.service.AuditoriaService;
import com.expressvraem.modules.caja.repository.CajaRepository;
import com.expressvraem.modules.caja.service.CajaService;
import com.expressvraem.modules.clientes.entity.Cliente;
import com.expressvraem.modules.clientes.service.ClienteService;
import com.expressvraem.modules.encomiendas.dto.EntregarEncomiendaDTO;
import com.expressvraem.modules.encomiendas.dto.RegistrarEncomiendaDTO;
import com.expressvraem.modules.promociones.service.PromocionService;
import com.expressvraem.modules.encomiendas.entity.Encomienda;
import com.expressvraem.modules.encomiendas.entity.HistorialEncomienda;
import com.expressvraem.modules.encomiendas.repository.EncomiendaRepository;
import com.expressvraem.modules.encomiendas.repository.HistorialEncomiendaRepository;
import com.expressvraem.shared.exceptions.BusinessException;
import com.expressvraem.shared.exceptions.ResourceNotFoundException;
import com.expressvraem.shared.middleware.AgenciaContext;
import com.expressvraem.shared.utils.TrackingCodeGenerator;
import com.expressvraem.shared.websocket.WebSocketEventPublisher;
import com.expressvraem.shared.websocket.dto.EstadoEncomiendaDTO;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class EncomiendaService {

    private final EncomiendaRepository encomiendaRepository;
    private final HistorialEncomiendaRepository historialRepository;
    private final ClienteService clienteService;
    private final TrackingCodeGenerator trackingCodeGenerator;
    private final WebSocketEventPublisher wsPublisher;
    private final CajaRepository cajaRepository;
    private final CajaService cajaService;
    private final AuditoriaService auditoriaService;
    private final PromocionService promocionService;

    private static final Map<String, Set<String>> TRANSICIONES = Map.of(
        "REGISTRADO",      Set.of("RECEPCIONADO", "DEVUELTO"),
        "RECEPCIONADO",    Set.of("ALMACENADO", "OBSERVADO"),
        "ALMACENADO",      Set.of("CARGADO", "DEVUELTO"),
        "CARGADO",         Set.of("EN_TRANSITO", "DEVUELTO"),
        "EN_TRANSITO",     Set.of("LLEGADO_AGENCIA", "OBSERVADO"),
        "LLEGADO_AGENCIA", Set.of("DISPONIBLE"),
        "DISPONIBLE",      Set.of("ENTREGADO"),
        "OBSERVADO",       Set.of("REGISTRADO", "DEVUELTO"),
        "ENTREGADO",       Set.of(),
        "DEVUELTO",        Set.of()
    );

    @Transactional
    public Encomienda registrar(RegistrarEncomiendaDTO dto, Long operadorId, Long agenciaIdOverride,
                                String ip, String usuarioNombre) {
        Long agenciaId = agenciaIdOverride != null ? agenciaIdOverride : AgenciaContext.getAgenciaId();
        if (agenciaId == null) throw new com.expressvraem.shared.exceptions.BusinessException(
                "No se pudo determinar la agencia del operador", "AGENCIA_REQUERIDA");

        Cliente remitente = clienteService.findOrCreate(
                dto.remitenteTipoDoc(), dto.remitenteDoc(),
                dto.remitenteNombres(), dto.remitenteApellidos(),
                dto.remitenteRazonSocial(), dto.remitenteTelefono(), agenciaId);

        Cliente destinatario = clienteService.findOrCreate(
                dto.destinatarioTipoDoc(), dto.destinatarioDoc(),
                dto.destinatarioNombres(), dto.destinatarioApellidos(),
                dto.destinatarioRazonSocial(), dto.destinatarioTelefono(), agenciaId);

        String codigo = trackingCodeGenerator.generateCode();
        BigDecimal precio = dto.monto() != null ? dto.monto() : BigDecimal.ZERO;

        // Aplicar promoción si se proporcionó
        BigDecimal descuento  = BigDecimal.ZERO;
        Long       promoIdRef = null;
        if (dto.promocionId() != null) {
            final BigDecimal[] dRef = { BigDecimal.ZERO };
            final Long[]       idRef = { null };
            promocionService.findById(dto.promocionId()).ifPresent(promo -> {
                dRef[0]  = promocionService.calcularDescuento(promo, precio);
                idRef[0] = promo.getId();
                promocionService.incrementarUso(promo.getId());
            });
            descuento  = dRef[0];
            promoIdRef = idRef[0];
        }
        BigDecimal precioEnvioFinal = precio.subtract(descuento);
        if (precioEnvioFinal.compareTo(BigDecimal.ZERO) < 0) precioEnvioFinal = BigDecimal.ZERO;

        Encomienda enc = Encomienda.builder()
                .agenciaId(agenciaId)
                .agenciaOrigenId(agenciaId)
                .agenciaDestinoId(dto.agenciaDestinoId())
                .codigoTracking(codigo)
                .remitenteId(remitente.getId())
                .destinatarioId(destinatario.getId())
                .viajeId(dto.viajeId())
                .vendedorId(operadorId)
                .descripcion(dto.descripcion())
                .pesoKg(dto.pesoKg())
                .numBultos(dto.numBultos() != null ? dto.numBultos() : 1)
                .monto(precio)
                .precioEnvio(precioEnvioFinal)
                .montoDescuento(descuento)
                .promocionId(promoIdRef)
                .formaCobro(dto.formaCobro())
                .estado("REGISTRADO")
                .serie("E001")
                .observaciones(dto.observaciones())
                .build();

        Encomienda saved = encomiendaRepository.save(enc);
        guardarHistorial(saved.getId(), agenciaId, operadorId, null, "REGISTRADO", "Registro inicial");

        // Pago en destino: registrar S/0.00 en caja origen para trazabilidad del operador
        if ("POR_COBRAR".equals(dto.formaCobro())) {
            cajaRepository.findByUsuarioIdAndEstado(operadorId, "ABIERTA").ifPresent(caja -> {
                try {
                    cajaService.registrarMovimiento(
                            caja.getId(), "INGRESO",
                            "Pago en destino enc. " + saved.getCodigoTracking() + " [cobro en destino]",
                            BigDecimal.ZERO, operadorId, "ENCOMIENDA", saved.getId());
                } catch (Exception e) {
                    log.warn("No se pudo registrar mov. origen para enc. {}: {}", saved.getCodigoTracking(), e.getMessage());
                }
            });
        }

        auditoriaService.registrar(operadorId, usuarioNombre, agenciaId,
                "INSERT", "ENCOMIENDAS", "ENCOMIENDA", saved.getId(),
                "tracking=" + codigo + " destino=" + dto.agenciaDestinoId()
                        + " monto=" + precio.toPlainString() + " cobro=" + dto.formaCobro(),
                ip);

        log.info("Encomienda registrada: {} monto={} cobro={}", codigo, precio, dto.formaCobro());
        return saved;
    }

    @Transactional
    public Encomienda cambiarEstado(Long id, String nuevoEstado, String observacion, Long usuarioId) {
        Encomienda enc = encomiendaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Encomienda", id));

        String estadoActual = enc.getEstado();
        Set<String> validos = TRANSICIONES.getOrDefault(estadoActual, Set.of());

        if (!validos.contains(nuevoEstado)) {
            throw new BusinessException(
                    "Transición inválida: " + estadoActual + " → " + nuevoEstado,
                    "TRANSICION_INVALIDA");
        }

        guardarHistorial(id, enc.getAgenciaId(), usuarioId, estadoActual, nuevoEstado, observacion);
        enc.setEstado(nuevoEstado);
        Encomienda saved = encomiendaRepository.save(enc);

        wsPublisher.publicarCambioEstadoEncomienda(enc.getCodigoTracking(),
                new EstadoEncomiendaDTO(enc.getCodigoTracking(), estadoActual, nuevoEstado,
                        observacion, "sistema", LocalDateTime.now()));
        return saved;
    }

    @Transactional
    public Encomienda marcarLlegada(Long id, String observacion, Long usuarioId, Long agenciaId) {
        Encomienda enc = encomiendaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Encomienda", id));

        if (!"EN_TRANSITO".equals(enc.getEstado())) {
            throw new BusinessException(
                    "Solo se puede marcar llegada si está EN_TRANSITO. Estado actual: " + enc.getEstado(),
                    "ESTADO_INVALIDO");
        }

        if (enc.getAgenciaDestinoId() != null && agenciaId != null && !enc.getAgenciaDestinoId().equals(agenciaId)) {
            throw new BusinessException("Esta encomienda no está destinada a su agencia", "AGENCIA_INVALIDA");
        }

        guardarHistorial(id, enc.getAgenciaId(), usuarioId, "EN_TRANSITO", "LLEGADO_AGENCIA",
                observacion != null ? observacion : "Llegó a agencia destino");
        enc.setEstado("LLEGADO_AGENCIA");
        Encomienda saved = encomiendaRepository.save(enc);

        wsPublisher.publicarCambioEstadoEncomienda(enc.getCodigoTracking(),
                new EstadoEncomiendaDTO(enc.getCodigoTracking(), "EN_TRANSITO", "LLEGADO_AGENCIA",
                        "Llegó a agencia destino", "sistema", LocalDateTime.now()));
        return saved;
    }

    @Transactional
    public Encomienda marcarDisponible(Long id, String observacion, Long usuarioId) {
        Encomienda enc = encomiendaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Encomienda", id));

        if (!"LLEGADO_AGENCIA".equals(enc.getEstado())) {
            throw new BusinessException(
                    "Solo se puede marcar disponible si está LLEGADO_AGENCIA. Estado: " + enc.getEstado(),
                    "ESTADO_INVALIDO");
        }

        guardarHistorial(id, enc.getAgenciaId(), usuarioId, "LLEGADO_AGENCIA", "DISPONIBLE",
                observacion != null ? observacion : "Disponible para retiro");
        enc.setEstado("DISPONIBLE");
        Encomienda saved = encomiendaRepository.save(enc);

        wsPublisher.publicarCambioEstadoEncomienda(enc.getCodigoTracking(),
                new EstadoEncomiendaDTO(enc.getCodigoTracking(), "LLEGADO_AGENCIA", "DISPONIBLE",
                        "Disponible para retiro", "sistema", LocalDateTime.now()));
        return saved;
    }

    @Transactional
    public Map<String, Object> entregar(Long id, EntregarEncomiendaDTO dto, Long usuarioId, Long agenciaId,
                                        String ip, String usuarioNombre) {
        Encomienda enc = encomiendaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Encomienda", id));

        if (!"DISPONIBLE".equals(enc.getEstado())) {
            throw new BusinessException(
                    "Solo se puede entregar si está en estado DISPONIBLE. Estado: " + enc.getEstado(),
                    "ESTADO_INVALIDO");
        }

        if (enc.getAgenciaDestinoId() != null && agenciaId != null && !enc.getAgenciaDestinoId().equals(agenciaId)) {
            throw new BusinessException("Esta encomienda no pertenece a su agencia de entrega", "AGENCIA_INVALIDA");
        }

        enc.setRecibidoPorDni(dto.dniReceptor());
        enc.setRecibidoPorNombre(dto.nombreReceptor());
        enc.setFechaEntregaReal(LocalDateTime.now());

        String obs = "Recibido por: " + dto.nombreReceptor() + " (DNI: " + dto.dniReceptor() + ")"
                + (dto.nota() != null && !dto.nota().isBlank() ? " | Nota: " + dto.nota() : "");

        guardarHistorial(id, enc.getAgenciaId(), usuarioId, "DISPONIBLE", "ENTREGADO", obs);
        enc.setEstado("ENTREGADO");
        Encomienda saved = encomiendaRepository.save(enc);

        // Pago en destino: caja OBLIGATORIA — si no hay turno activo se rechaza la entrega
        boolean cobrado = false;
        BigDecimal montoEnc = enc.getMonto() != null ? enc.getMonto() : enc.getPrecioEnvio();
        if ("POR_COBRAR".equals(enc.getFormaCobro())) {
            if (montoEnc == null || montoEnc.compareTo(BigDecimal.ZERO) <= 0) {
                throw new BusinessException(
                        "La encomienda tiene pago en destino pero el monto registrado es inválido.",
                        "MONTO_INVALIDO");
            }
            if (dto.formaPago() == null || dto.formaPago().isBlank()) {
                throw new BusinessException(
                        "Debe indicar la forma de pago recibida para encomiendas con pago en destino.",
                        "FORMA_PAGO_REQUERIDA");
            }
            var turno = cajaRepository.findByUsuarioIdAndEstado(usuarioId, "ABIERTA");
            if (turno.isEmpty()) {
                throw new BusinessException(
                        "Debe tener un turno de caja abierto para cobrar encomiendas con pago en destino. Abra su caja primero.",
                        "CAJA_REQUERIDA");
            }
            cajaService.registrarMovimiento(
                    turno.get().getId(), "INGRESO",
                    "Pago en destino enc. " + enc.getCodigoTracking() + " — " + dto.formaPago(),
                    montoEnc, usuarioId, "PAGO_DESTINO", id);
            cobrado = true;
        }

        wsPublisher.publicarCambioEstadoEncomienda(enc.getCodigoTracking(),
                new EstadoEncomiendaDTO(enc.getCodigoTracking(), "DISPONIBLE", "ENTREGADO",
                        obs, "sistema", LocalDateTime.now()));

        auditoriaService.registrar(usuarioId, usuarioNombre, enc.getAgenciaId(),
                "UPDATE", "ENCOMIENDAS", "ENCOMIENDA", id,
                "estado=ENTREGADO receptor=" + dto.nombreReceptor()
                        + " dni=" + dto.dniReceptor()
                        + (cobrado ? " cobrado=" + montoEnc.toPlainString() + " via=" + dto.formaPago() : ""),
                ip);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("encomienda", saved);
        result.put("cobrado", cobrado);
        return result;
    }

    public List<Encomienda> paraEntrega(Long agenciaId) {
        List<Encomienda> activas = encomiendaRepository.findParaEntrega(agenciaId,
                List.of("EN_TRANSITO", "LLEGADO_AGENCIA", "DISPONIBLE"));
        List<Encomienda> entregadasHoy = encomiendaRepository.findEntregadasHoy(
                agenciaId, LocalDateTime.now().toLocalDate().atStartOfDay());
        List<Encomienda> todas = new ArrayList<>(activas);
        todas.addAll(entregadasHoy);
        return todas;
    }

    public Encomienda getById(Long id) {
        return encomiendaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Encomienda", id));
    }

    public Encomienda getByTracking(String codigo) {
        return encomiendaRepository.findByCodigoTracking(codigo)
                .orElseThrow(() -> new ResourceNotFoundException("Encomienda", codigo));
    }

    public List<HistorialEncomienda> getHistorial(Long encomiendaId) {
        return historialRepository.findByEncomiendaIdOrderByCreatedAtAsc(encomiendaId);
    }

    public java.util.Optional<LocalDateTime> getFechaLlegada(Long encomiendaId) {
        return historialRepository
                .findFirstByEncomiendaIdAndEstadoNuevoOrderByCreatedAtDesc(encomiendaId, "LLEGADO_AGENCIA")
                .map(HistorialEncomienda::getCreatedAt);
    }

    public List<Encomienda> buscarConFiltros(Long agenciaId, String estado, Long destino,
                                              LocalDateTime desde, LocalDateTime hasta, String q) {
        Specification<Encomienda> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (agenciaId != null) predicates.add(cb.equal(root.get("agenciaId"), agenciaId));
            if (estado != null && !estado.isBlank()) predicates.add(cb.equal(root.get("estado"), estado));
            if (destino != null) predicates.add(cb.equal(root.get("agenciaDestinoId"), destino));
            if (desde != null) predicates.add(cb.greaterThanOrEqualTo(root.get("fechaRegistro"), desde));
            if (hasta != null) predicates.add(cb.lessThanOrEqualTo(root.get("fechaRegistro"), hasta));
            if (q != null && !q.isBlank())
                predicates.add(cb.like(cb.lower(root.get("codigoTracking")), "%" + q.toLowerCase() + "%"));
            query.orderBy(cb.desc(root.get("fechaRegistro")));
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        return encomiendaRepository.findAll(spec);
    }

    private void guardarHistorial(Long encId, Long agenciaId, Long usuarioId,
                                  String anterior, String nuevo, String observacion) {
        historialRepository.save(HistorialEncomienda.builder()
                .encomiendaId(encId)
                .agenciaId(agenciaId)
                .usuarioId(usuarioId)
                .estadoAnterior(anterior)
                .estadoNuevo(nuevo)
                .observacion(observacion)
                .build());
    }
}
