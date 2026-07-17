package com.expressvraem.modules.encomiendas.service;

import com.expressvraem.modules.auditoria.service.AuditoriaService;
import com.expressvraem.modules.caja.repository.CajaRepository;
import com.expressvraem.modules.caja.service.CajaService;
import com.expressvraem.modules.clientes.entity.Cliente;
import com.expressvraem.modules.clientes.service.ClienteService;
import com.expressvraem.modules.encomiendas.dto.EntregarEncomiendaDTO;
import com.expressvraem.modules.encomiendas.dto.RecepcionItemDTO;
import com.expressvraem.modules.encomiendas.dto.RegistrarEncomiendaDTO;
import com.expressvraem.modules.promociones.entity.Promocion;
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
    private final com.expressvraem.modules.viajes.repository.ViajeRepository viajeRepository;

    private static final Map<String, Set<String>> TRANSICIONES = Map.of(
        "REGISTRADO",      Set.of("RECEPCIONADO", "DEVUELTO"),
        "RECEPCIONADO",    Set.of("ALMACENADO", "OBSERVADO"),
        "ALMACENADO",      Set.of("CARGADO", "DEVUELTO"),
        "CARGADO",         Set.of("EN_TRANSITO", "DEVUELTO"),
        "EN_TRANSITO",     Set.of("LLEGADO_AGENCIA", "OBSERVADO"),
        "LLEGADO_AGENCIA", Set.of("DISPONIBLE"),
        "DISPONIBLE",      Set.of("ENTREGADO"),
        "OBSERVADO",       Set.of("REGISTRADO", "DISPONIBLE", "DEVUELTO"),
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
        // El flete es obligatorio: sin esto un monto olvidado viajaba gratis y sin pasar por caja
        if (dto.monto() == null || dto.monto().compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException(
                    "El monto del envío es obligatorio y debe ser mayor a S/ 0.00",
                    "MONTO_REQUERIDO");
        }
        BigDecimal precio = dto.monto();

        // Aplicar promoción si se proporcionó
        BigDecimal descuento  = BigDecimal.ZERO;
        Long       promoIdRef = null;
        if (dto.promocionId() != null) {
            Promocion promo = promocionService.findVigenteById(dto.promocionId(), "ENCOMIENDAS");
            descuento  = promocionService.calcularDescuento(promo, precio);
            promoIdRef = promo.getId();
            promocionService.incrementarUso(promo.getId());
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
                .esFragil(Boolean.TRUE.equals(dto.esFragil()))
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
        } else if (precioEnvioFinal.compareTo(BigDecimal.ZERO) > 0) {
            // Cobro al contado en origen: caja OBLIGATORIA — el dinero recibido debe entrar al turno
            var turno = cajaRepository.findByUsuarioIdAndEstado(operadorId, "ABIERTA");
            if (turno.isEmpty()) {
                throw new BusinessException(
                        "Debe tener un turno de caja abierto para cobrar encomiendas al contado. Abra su caja primero.",
                        "CAJA_REQUERIDA");
            }
            cajaService.registrarMovimiento(
                    turno.get().getId(), "INGRESO",
                    "Encomienda " + saved.getCodigoTracking() + " — " + dto.formaCobro(),
                    precioEnvioFinal, operadorId, "ENCOMIENDA", saved.getId(),
                    "ENCOMIENDA", saved.getViajeId(), null, null, null);
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

        // El operador solo mueve paquetes de su circuito: agencia de origen o de destino
        // (GERENTE/SUPER_ADMIN no llevan agencia en el contexto y pasan libre)
        Long agenciaCtx = AgenciaContext.getAgenciaId();
        if (agenciaCtx != null
                && !agenciaCtx.equals(enc.getAgenciaOrigenId())
                && !agenciaCtx.equals(enc.getAgenciaId())
                && !agenciaCtx.equals(enc.getAgenciaDestinoId())) {
            throw new BusinessException(
                    "Esta encomienda no pertenece a su agencia (ni como origen ni como destino)",
                    "AGENCIA_INVALIDA");
        }

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

        // LLEGADO_AGENCIA también es entregable: el paquete ya está físicamente en
        // la agencia; no se obliga a marcar "disponible" si el destinatario llegó
        // a recogerlo en ese momento
        if (!"DISPONIBLE".equals(enc.getEstado()) && !"LLEGADO_AGENCIA".equals(enc.getEstado())) {
            throw new BusinessException(
                    "Solo se puede entregar si está DISPONIBLE o LLEGADO_AGENCIA. Estado: " + enc.getEstado(),
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

        // El estado anterior real (puede ser LLEGADO_AGENCIA): el timeline debe reflejarlo
        String estadoAnterior = enc.getEstado();
        guardarHistorial(id, enc.getAgenciaId(), usuarioId, estadoAnterior, "ENTREGADO", obs);
        enc.setEstado("ENTREGADO");
        Encomienda saved = encomiendaRepository.save(enc);

        // Pago en destino: caja OBLIGATORIA — si no hay turno activo se rechaza la entrega.
        // Se cobra el precio de envío (con promoción aplicada), no el monto bruto.
        boolean cobrado = false;
        BigDecimal montoEnc = enc.getPrecioEnvio() != null ? enc.getPrecioEnvio() : enc.getMonto();
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
                    montoEnc, usuarioId, "PAGO_DESTINO", id,
                    "ENC_PAGO_DESTINO", enc.getViajeId(), null, null, null);
            cobrado = true;
        }

        wsPublisher.publicarCambioEstadoEncomienda(enc.getCodigoTracking(),
                new EstadoEncomiendaDTO(enc.getCodigoTracking(), estadoAnterior, "ENTREGADO",
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
            if (q != null && !q.isBlank()) {
                String pat = "%" + q.toLowerCase() + "%";
                predicates.add(cb.or(
                    cb.like(cb.lower(root.get("codigoTracking")), pat),
                    cb.like(cb.lower(root.get("descripcion")),    pat)
                ));
            }
            query.orderBy(cb.desc(root.get("fechaRegistro")));
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        return encomiendaRepository.findAll(spec);
    }

    private static final Set<String> ESTADOS_ASIGNABLES = Set.of(
            "REGISTRADO", "RECEPCIONADO", "ALMACENADO", "CARGADO", "OBSERVADO");

    @Transactional
    public Encomienda asignarViaje(Long id, Long viajeId, Long usuarioId) {
        Encomienda enc = encomiendaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Encomienda", id));

        // Solo se puede (re)asignar carga que aún no viajó: una encomienda entregada,
        // devuelta o en tránsito no debe cambiar de viaje
        if (!ESTADOS_ASIGNABLES.contains(enc.getEstado())) {
            throw new BusinessException(
                    "No se puede asignar viaje a una encomienda en estado " + enc.getEstado(),
                    "ESTADO_INVALIDO");
        }
        if (viajeId != null) {
            var viaje = viajeRepository.findById(viajeId)
                    .orElseThrow(() -> new ResourceNotFoundException("Viaje", viajeId));
            if (!"PROGRAMADO".equals(viaje.getEstado()) && !"ATRASADO".equals(viaje.getEstado())) {
                throw new BusinessException(
                        "Solo se puede asignar carga a un viaje PROGRAMADO o ATRASADO. Estado del viaje: "
                                + viaje.getEstado(),
                        "VIAJE_NO_ASIGNABLE");
            }
        }

        enc.setViajeId(viajeId);
        Encomienda saved = encomiendaRepository.save(enc);
        String obs = viajeId != null ? "Viaje asignado: #" + viajeId : "Viaje desasignado";
        guardarHistorial(id, enc.getAgenciaId(), usuarioId, enc.getEstado(), enc.getEstado(), obs);
        return saved;
    }

    public Map<String, Object> getStats(Long agenciaId) {
        List<Encomienda> todas = agenciaId != null
                ? encomiendaRepository.findByAgenciaIdOrderByFechaRegistroDesc(agenciaId)
                : encomiendaRepository.findAllByOrderByFechaRegistroDesc();

        LocalDateTime inicioDia = LocalDateTime.now().toLocalDate().atStartOfDay();
        long hoy        = todas.stream().filter(e -> e.getFechaRegistro() != null && e.getFechaRegistro().isAfter(inicioDia)).count();
        long pendientes = todas.stream().filter(e -> !Set.of("ENTREGADO","DEVUELTO").contains(e.getEstado())).count();
        long enTransito = todas.stream().filter(e -> "EN_TRANSITO".equals(e.getEstado())).count();
        long disponibles = todas.stream().filter(e -> "DISPONIBLE".equals(e.getEstado())).count();
        long entregadasHoy = todas.stream().filter(e -> "ENTREGADO".equals(e.getEstado())
                && e.getFechaEntregaReal() != null && e.getFechaEntregaReal().isAfter(inicioDia)).count();

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("registradasHoy",  hoy);
        stats.put("pendientes",       pendientes);
        stats.put("enTransito",       enTransito);
        stats.put("disponibles",      disponibles);
        stats.put("entregadasHoy",    entregadasHoy);
        stats.put("total",            todas.size());
        return stats;
    }

    // ─── Recepción masiva por viaje ────────────────────────────────────────────

    public List<Encomienda> getEnTransitoParaAgencia(Long agenciaId) {
        return encomiendaRepository.findEnTransitoParaAgenciaDestino(agenciaId);
    }

    @Transactional
    public Map<String, Object> recepcionar(Long viajeId,
                                           List<RecepcionItemDTO> items,
                                           Long operadorId,
                                           Long agenciaId,
                                           String ip,
                                           String nombreOperador) {
        int recibidas = 0;
        int faltantes = 0;
        List<String> codigosFaltantes = new ArrayList<>();

        int omitidas = 0;
        for (RecepcionItemDTO item : items) {
            Encomienda enc = encomiendaRepository.findById(item.encomiendaId())
                    .orElseThrow(() -> new ResourceNotFoundException("Encomienda", item.encomiendaId()));

            if (!"EN_TRANSITO".equals(enc.getEstado())) continue;

            // Solo se recepcionan paquetes de ESTE viaje destinados a ESTA agencia:
            // sin esto, un id equivocado marcaba "llegado" carga de otra agencia/viaje
            boolean deOtroViaje   = enc.getViajeId() == null || !viajeId.equals(enc.getViajeId());
            boolean deOtraAgencia = agenciaId != null && enc.getAgenciaDestinoId() != null
                    && !agenciaId.equals(enc.getAgenciaDestinoId());
            if (deOtroViaje || deOtraAgencia) {
                log.warn("Recepción masiva viaje={} agencia={}: encomienda {} omitida ({})",
                        viajeId, agenciaId, enc.getCodigoTracking(),
                        deOtroViaje ? "pertenece a otro viaje" : "destinada a otra agencia");
                omitidas++;
                continue;
            }

            if (item.recibido()) {
                enc.setEstado("LLEGADO_AGENCIA");
                encomiendaRepository.save(enc);
                guardarHistorial(enc.getId(), enc.getAgenciaId(), operadorId,
                        "EN_TRANSITO", "LLEGADO_AGENCIA",
                        "Recibido en recepción masiva - viaje #" + viajeId);
                wsPublisher.publicarCambioEstadoEncomienda(enc.getCodigoTracking(),
                        new EstadoEncomiendaDTO(enc.getCodigoTracking(),
                                "EN_TRANSITO", "LLEGADO_AGENCIA",
                                "Llegó a agencia destino", nombreOperador, LocalDateTime.now()));
                recibidas++;
            } else {
                String motivo = item.observacion() != null && !item.observacion().isBlank()
                        ? item.observacion()
                        : "No llegó en viaje #" + viajeId;
                enc.setEstado("OBSERVADO");
                enc.setObservaciones(motivo);
                encomiendaRepository.save(enc);
                guardarHistorial(enc.getId(), enc.getAgenciaId(), operadorId,
                        "EN_TRANSITO", "OBSERVADO", motivo);
                wsPublisher.publicarCambioEstadoEncomienda(enc.getCodigoTracking(),
                        new EstadoEncomiendaDTO(enc.getCodigoTracking(),
                                "EN_TRANSITO", "OBSERVADO",
                                motivo, nombreOperador, LocalDateTime.now()));
                codigosFaltantes.add(enc.getCodigoTracking());
                faltantes++;
            }
        }

        auditoriaService.registrar(operadorId, nombreOperador, agenciaId,
                "UPDATE", "ENCOMIENDAS", "Encomienda", viajeId,
                "recepcion_masiva recibidas=" + recibidas + " faltantes=" + faltantes, ip);

        log.info("Recepción masiva viaje={} agencia={} recibidas={} faltantes={}",
                viajeId, agenciaId, recibidas, faltantes);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("recibidas", recibidas);
        result.put("faltantes", faltantes);
        result.put("omitidas", omitidas);
        result.put("total", recibidas + faltantes);
        result.put("codigosFaltantes", codigosFaltantes);
        return result;
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
