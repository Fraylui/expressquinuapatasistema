package com.expressvraem.modules.encomiendas.controller;

import com.expressvraem.modules.agencias.repository.AgenciaRepository;
import com.expressvraem.modules.auth.entity.Usuario;
import com.expressvraem.modules.auth.repository.UsuarioRepository;
import com.expressvraem.modules.clientes.entity.Cliente;
import com.expressvraem.modules.clientes.repository.ClienteRepository;
import com.expressvraem.modules.encomiendas.dto.EntregarEncomiendaDTO;
import com.expressvraem.modules.encomiendas.dto.RecepcionItemDTO;
import com.expressvraem.modules.encomiendas.dto.RegistrarEncomiendaDTO;
import com.expressvraem.modules.rutas.repository.RutaRepository;
import com.expressvraem.modules.vehiculos.repository.VehiculoRepository;
import com.expressvraem.modules.viajes.repository.ViajeRepository;
import com.expressvraem.modules.encomiendas.entity.Encomienda;
import com.expressvraem.modules.encomiendas.entity.HistorialEncomienda;
import com.expressvraem.modules.encomiendas.service.ComprobantePdfService;
import com.expressvraem.modules.encomiendas.service.ComprobanteEntregaPdfService;
import com.expressvraem.modules.encomiendas.service.EtiquetaPdfService;
import com.expressvraem.modules.encomiendas.service.EncomiendaService;
import com.expressvraem.shared.exceptions.ApiResponse;
import com.expressvraem.shared.exceptions.BusinessException;
import com.expressvraem.shared.middleware.AgenciaContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequiredArgsConstructor
public class EncomiendaController {

    private final EncomiendaService encomiendaService;
    private final ComprobantePdfService pdfService;
    private final ComprobanteEntregaPdfService pdfEntregaService;
    private final EtiquetaPdfService etiquetaService;
    private final UsuarioRepository usuarioRepository;
    private final ClienteRepository clienteRepository;
    private final AgenciaRepository agenciaRepository;
    private final ViajeRepository viajeRepository;
    private final RutaRepository rutaRepository;
    private final VehiculoRepository vehiculoRepository;
    private final com.expressvraem.modules.encomiendas.repository.EncomiendaRepository encomiendaRepository;

    private Long resolveUserId(Authentication auth) {
        return usuarioRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new BusinessException("Usuario no encontrado", "USER_NOT_FOUND"))
                .getId();
    }

    /** Resolves agenciaId: from context (OPERADOR/CONDUCTOR) or from user record (SUPER_ADMIN/GERENTE). */
    private Long resolveAgenciaId(Authentication auth) {
        Long fromContext = AgenciaContext.getAgenciaId();
        if (fromContext != null) return fromContext;
        return usuarioRepository.findByEmail(auth.getName())
                .map(Usuario::getAgenciaId)
                .orElse(null);
    }

    private String resolveNombreOperador(Authentication auth) {
        String email = auth != null ? auth.getName() : "—";
        try {
            var u = usuarioRepository.findByEmail(email).orElse(null);
            if (u != null) {
                String n = u.getNombres() != null ? u.getNombres() : "";
                String a = u.getApellidos() != null ? u.getApellidos() : "";
                return (n + " " + a).trim();
            }
        } catch (Exception ignored) {}
        return email;
    }

    private String extraerIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        return (xff != null && !xff.isBlank()) ? xff.split(",")[0].trim() : request.getRemoteAddr();
    }

    private Map<Long, String> buildAgenciasMap() {
        Map<Long, String> m = new HashMap<>();
        agenciaRepository.findAll().forEach(a -> m.put(a.getId(), a.getNombre() + " — " + a.getCiudad()));
        return m;
    }

    // ─── Registrar ─────────────────────────────────────────────────────────────

    @PostMapping("/api/encomiendas")
    public ResponseEntity<ApiResponse<Encomienda>> registrar(
            @Valid @RequestBody RegistrarEncomiendaDTO dto,
            Authentication auth,
            HttpServletRequest request) {
        Encomienda enc = encomiendaService.registrar(
                dto, resolveUserId(auth), resolveAgenciaId(auth),
                extraerIp(request), resolveNombreOperador(auth));
        return ResponseEntity.ok(ApiResponse.ok("Encomienda registrada", enc));
    }

    // ─── Lista enviadas (origin agency) ────────────────────────────────────────

    @GetMapping("/api/encomiendas/lista")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> lista(
            @RequestParam(required = false) String estado,
            @RequestParam(required = false) Long destino,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime desde,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime hasta,
            @RequestParam(required = false) String q) {

        Long agenciaId = AgenciaContext.getAgenciaId();
        List<Encomienda> lista = encomiendaService.buscarConFiltros(agenciaId, estado, destino, desde, hasta, q);
        Map<Long, String> agenciasMap = buildAgenciasMap();
        Map<Long, Cliente> clienteMap = buildClienteMap(lista);

        return ResponseEntity.ok(ApiResponse.ok(
                lista.stream().map(e -> enrichEncomienda(e, agenciasMap, clienteMap)).toList()));
    }

    // ─── Para entregar (destination agency) ────────────────────────────────────

    @GetMapping("/api/encomiendas/para-entrega")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> paraEntrega() {
        Long agenciaId = AgenciaContext.getAgenciaId();
        if (agenciaId == null) {
            return ResponseEntity.ok(ApiResponse.ok(List.of()));
        }
        List<Encomienda> lista = encomiendaService.paraEntrega(agenciaId);
        Map<Long, String> agenciasMap = buildAgenciasMap();
        Map<Long, Cliente> clienteMap = buildClienteMap(lista);

        List<Map<String, Object>> result = lista.stream().map(e -> {
            Map<String, Object> m = enrichEncomienda(e, agenciasMap, clienteMap);
            // Add fechaLlegada from historial
            encomiendaService.getFechaLlegada(e.getId())
                    .ifPresent(fl -> m.put("fechaLlegada", fl));
            return m;
        }).toList();

        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    // ─── Detalle ────────────────────────────────────────────────────────────────

    @GetMapping("/api/encomiendas/{id}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> detalle(@PathVariable Long id) {
        Encomienda enc = encomiendaService.getById(id);
        Map<Long, Cliente> clienteMap = buildClienteMap(List.of(enc));
        return ResponseEntity.ok(ApiResponse.ok(enrichEncomienda(enc, buildAgenciasMap(), clienteMap)));
    }

    // ─── Cambiar estado genérico ────────────────────────────────────────────────

    @PatchMapping("/api/encomiendas/{id}/estado")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA','OPERADOR')")
    public ResponseEntity<ApiResponse<Encomienda>> cambiarEstado(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            Authentication auth) {
        String nuevoEstado = body.get("estado");
        String observacion = body.getOrDefault("observacion", "");
        return ResponseEntity.ok(ApiResponse.ok("Estado actualizado",
                encomiendaService.cambiarEstado(id, nuevoEstado, observacion, resolveUserId(auth))));
    }

    // ─── Marcar llegada a agencia destino ──────────────────────────────────────

    @PostMapping("/api/encomiendas/{id}/marcar-llegada")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA','OPERADOR')")
    public ResponseEntity<ApiResponse<Encomienda>> marcarLlegada(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, String> body,
            Authentication auth) {
        String obs = body != null ? body.getOrDefault("observacion", null) : null;
        Long agenciaId = AgenciaContext.getAgenciaId();
        return ResponseEntity.ok(ApiResponse.ok("Llegada registrada",
                encomiendaService.marcarLlegada(id, obs, resolveUserId(auth), agenciaId)));
    }

    // ─── Marcar disponible ──────────────────────────────────────────────────────

    @PostMapping("/api/encomiendas/{id}/disponible")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA','OPERADOR')")
    public ResponseEntity<ApiResponse<Encomienda>> marcarDisponible(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, String> body,
            Authentication auth) {
        String obs = body != null ? body.getOrDefault("observacion", null) : null;
        return ResponseEntity.ok(ApiResponse.ok("Disponible para entrega",
                encomiendaService.marcarDisponible(id, obs, resolveUserId(auth))));
    }

    // ─── Entregar ───────────────────────────────────────────────────────────────

    @PostMapping("/api/encomiendas/{id}/entregar")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA','OPERADOR')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> entregar(
            @PathVariable Long id,
            @Valid @RequestBody EntregarEncomiendaDTO dto,
            Authentication auth,
            HttpServletRequest request) {
        Long agenciaId = AgenciaContext.getAgenciaId();
        Map<String, Object> result = encomiendaService.entregar(
                id, dto, resolveUserId(auth), agenciaId,
                extraerIp(request), resolveNombreOperador(auth));
        return ResponseEntity.ok(ApiResponse.ok("Entregado", result));
    }

    // ─── Asignar / cambiar viaje ────────────────────────────────────────────────

    @PatchMapping("/api/encomiendas/{id}/asignar-viaje")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA','OPERADOR')")
    public ResponseEntity<ApiResponse<Encomienda>> asignarViaje(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body,
            Authentication auth) {
        Long viajeId = body.get("viajeId") != null ? Long.valueOf(body.get("viajeId").toString()) : null;
        return ResponseEntity.ok(ApiResponse.ok("Viaje asignado",
                encomiendaService.asignarViaje(id, viajeId, resolveUserId(auth))));
    }

    // ─── Estadísticas rápidas ───────────────────────────────────────────────────

    @GetMapping("/api/encomiendas/stats")
    public ResponseEntity<ApiResponse<Map<String, Object>>> stats(Authentication auth) {
        Long agenciaId = resolveAgenciaId(auth);
        return ResponseEntity.ok(ApiResponse.ok(encomiendaService.getStats(agenciaId)));
    }

    // ─── Historial ──────────────────────────────────────────────────────────────

    @GetMapping("/api/encomiendas/{id}/historial")
    public ResponseEntity<ApiResponse<List<HistorialEncomienda>>> historial(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(encomiendaService.getHistorial(id)));
    }

    // ─── Comprobante de registro (PDF) ──────────────────────────────────────────

    @GetMapping(value = "/api/encomiendas/{id}/comprobante", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> comprobante(@PathVariable Long id, Authentication auth) {
        Encomienda enc = encomiendaService.getById(id);
        byte[] pdf = pdfService.generarComprobante(enc, resolveNombreOperador(auth));
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=\"encomienda-" + enc.getCodigoTracking() + ".pdf\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    // ─── Comprobante de entrega (PDF) ───────────────────────────────────────────

    @GetMapping(value = "/api/encomiendas/{id}/comprobante-entrega", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> comprobanteEntrega(@PathVariable Long id, Authentication auth) {
        Encomienda enc = encomiendaService.getById(id);
        if (!"ENTREGADO".equals(enc.getEstado())) {
            return ResponseEntity.badRequest().build();
        }
        byte[] pdf = pdfEntregaService.generarComprobanteEntrega(enc, resolveNombreOperador(auth));
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=\"entrega-" + enc.getCodigoTracking() + ".pdf\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    // ─── Etiqueta de envío (PDF) ────────────────────────────────────────────────

    @GetMapping(value = "/api/encomiendas/{id}/etiqueta", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> etiqueta(@PathVariable Long id, Authentication auth) {
        Encomienda enc = encomiendaService.getById(id);
        byte[] pdf = etiquetaService.generarEtiqueta(enc, resolveNombreOperador(auth));
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=\"etiqueta-" + enc.getCodigoTracking() + ".pdf\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    // ─── Tracking público ────────────────────────────────────────────────────────

    @GetMapping("/api/tracking/{codigo}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> tracking(@PathVariable String codigo) {
        Encomienda enc = encomiendaService.getByTracking(codigo);
        List<HistorialEncomienda> historial = encomiendaService.getHistorial(enc.getId());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("codigo",           enc.getCodigoTracking());
        result.put("estado",           enc.getEstado());
        result.put("descripcion",      enc.getDescripcion());
        result.put("agenciaOrigen",    nombreAgencia(enc.getAgenciaOrigenId() != null
                                            ? enc.getAgenciaOrigenId() : enc.getAgenciaId()));
        result.put("agenciaDestino",   nombreAgencia(enc.getAgenciaDestinoId()));
        result.put("fechaRegistro",    enc.getFechaRegistro());
        result.put("fechaEntregaEst",  enc.getFechaEntregaEst() != null ? enc.getFechaEntregaEst() : "");
        result.put("historial", historial.stream().map(h -> {
            Map<String, Object> hm = new LinkedHashMap<>();
            hm.put("estadoAnterior", h.getEstadoAnterior());
            hm.put("estadoNuevo",    h.getEstadoNuevo());
            hm.put("observacion",    h.getObservacion());
            hm.put("createdAt",      h.getCreatedAt());
            return hm;
        }).toList());

        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    // ─── Private helpers ────────────────────────────────────────────────────────

    private String nombreAgencia(Long id) {
        if (id == null) return null;
        return agenciaRepository.findById(id).map(a -> a.getNombre()).orElse(null);
    }

    private Map<Long, Cliente> buildClienteMap(List<Encomienda> lista) {
        Set<Long> ids = lista.stream()
                .flatMap(e -> java.util.stream.Stream.of(e.getRemitenteId(), e.getDestinatarioId()))
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toSet());
        return clienteRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(Cliente::getId, c -> c));
    }

    private Map<String, Object> enrichEncomienda(Encomienda enc, Map<Long, String> agenciasMap,
                                                  Map<Long, Cliente> clienteMap) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id",               enc.getId());
        m.put("codigoTracking",   enc.getCodigoTracking());
        m.put("estado",           enc.getEstado());
        m.put("descripcion",      enc.getDescripcion());
        m.put("pesoKg",           enc.getPesoKg());
        m.put("numBultos",        enc.getNumBultos());
        m.put("monto",            enc.getMonto());
        m.put("precioEnvio",      enc.getPrecioEnvio());
        m.put("formaCobro",       enc.getFormaCobro());
        m.put("serie",            enc.getSerie());
        m.put("correlativo",      enc.getCorrelativo());
        m.put("agenciaId",        enc.getAgenciaId());
        m.put("agenciaOrigenId",  enc.getAgenciaOrigenId());
        m.put("agenciaDestinoId", enc.getAgenciaDestinoId());
        m.put("viajeId",          enc.getViajeId());
        m.put("remitenteId",      enc.getRemitenteId());
        m.put("destinatarioId",   enc.getDestinatarioId());
        m.put("vendedorId",       enc.getVendedorId());
        m.put("fechaRegistro",    enc.getFechaRegistro());
        m.put("fechaEntregaEst",  enc.getFechaEntregaEst());
        m.put("fechaEntregaReal", enc.getFechaEntregaReal());
        m.put("recibidoPorDni",   enc.getRecibidoPorDni());
        m.put("recibidoPorNombre",enc.getRecibidoPorNombre());
        m.put("observaciones",    enc.getObservaciones());
        m.put("montoDescuento",   enc.getMontoDescuento());
        m.put("promocionId",      enc.getPromocionId());
        m.put("esFragil",         enc.isEsFragil());

        // Agencia names
        m.put("agenciaOrigenNombre",  agenciasMap.getOrDefault(enc.getAgenciaOrigenId(),
                enc.getAgenciaOrigenId() != null ? "Agencia #" + enc.getAgenciaOrigenId() : "—"));
        m.put("agenciaDestinoNombre", agenciasMap.getOrDefault(enc.getAgenciaDestinoId(),
                enc.getAgenciaDestinoId() != null ? "Agencia #" + enc.getAgenciaDestinoId() : "—"));

        // Client data (resolved from batch-fetched map — no per-row queries)
        Cliente rem = enc.getRemitenteId() != null ? clienteMap.get(enc.getRemitenteId()) : null;
        if (rem != null) {
            m.put("remitenteNombre", nombreDisplay(rem));
            m.put("remitenteDoc",    rem.getTipoDoc() + " " + rem.getNumDoc());
            m.put("remitenteTel",    rem.getTelefono());
        }
        Cliente des = enc.getDestinatarioId() != null ? clienteMap.get(enc.getDestinatarioId()) : null;
        if (des != null) {
            m.put("destinatarioNombre", nombreDisplay(des));
            m.put("destinatarioDoc",    des.getTipoDoc() + " " + des.getNumDoc());
            m.put("destinatarioTel",    des.getTelefono());
        }

        return m;
    }

    private String nombreDisplay(Cliente c) {
        if ("EMPRESA".equals(c.getTipo()) && c.getRazonSocial() != null) return c.getRazonSocial();
        return c.getApellidos() + ", " + c.getNombres();
    }

    // ─── Viajes en tránsito hacia esta agencia ──────────────────────────────────

    @GetMapping("/api/encomiendas/viajes-en-transito")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> viajesEnTransito(Authentication auth) {
        Long agenciaId = resolveAgenciaId(auth);

        List<Encomienda> encs = encomiendaService.getEnTransitoParaAgencia(agenciaId);
        Map<Long, String> agenciasMap = buildAgenciasMap();
        Map<Long, Cliente> clienteMap = buildClienteMap(encs);

        // Group by viajeId
        Map<Long, List<Encomienda>> porViaje = encs.stream()
                .collect(Collectors.groupingBy(Encomienda::getViajeId));

        // Batch-load viajes, rutas, vehículos — avoids N+1 queries per group
        Set<Long> viajeIds = porViaje.keySet();
        Map<Long, com.expressvraem.modules.viajes.entity.Viaje> viajeMap = viajeRepository.findAllById(viajeIds)
                .stream().collect(Collectors.toMap(com.expressvraem.modules.viajes.entity.Viaje::getId, v -> v));
        Set<Long> rutaIds2 = viajeMap.values().stream()
                .map(com.expressvraem.modules.viajes.entity.Viaje::getRutaId)
                .filter(java.util.Objects::nonNull).collect(Collectors.toSet());
        Set<Long> vehiculoIds = viajeMap.values().stream()
                .map(com.expressvraem.modules.viajes.entity.Viaje::getVehiculoId)
                .filter(java.util.Objects::nonNull).collect(Collectors.toSet());
        Map<Long, com.expressvraem.modules.rutas.entity.Ruta> rutaMapV = rutaIds2.isEmpty()
                ? Map.of()
                : rutaRepository.findAllById(rutaIds2).stream()
                        .collect(Collectors.toMap(com.expressvraem.modules.rutas.entity.Ruta::getId, r -> r));
        Map<Long, com.expressvraem.modules.vehiculos.entity.Vehiculo> vehiculoMap = vehiculoIds.isEmpty()
                ? Map.of()
                : vehiculoRepository.findAllById(vehiculoIds).stream()
                        .collect(Collectors.toMap(com.expressvraem.modules.vehiculos.entity.Vehiculo::getId, vh -> vh));

        List<Map<String, Object>> resultado = new ArrayList<>();
        for (Map.Entry<Long, List<Encomienda>> entry : porViaje.entrySet()) {
            Long viajeId = entry.getKey();
            List<Encomienda> lista = entry.getValue();

            Map<String, Object> grupo = new LinkedHashMap<>();
            grupo.put("viajeId", viajeId);

            var v = viajeMap.get(viajeId);
            if (v != null) {
                grupo.put("fechaHoraSal", v.getFechaHoraSal());
                grupo.put("estadoViaje", v.getEstado());
                var r = rutaMapV.get(v.getRutaId());
                if (r != null) {
                    grupo.put("rutaOrigen", r.getOrigen());
                    grupo.put("rutaDestino", r.getDestino());
                }
                var vh = vehiculoMap.get(v.getVehiculoId());
                if (vh != null) {
                    grupo.put("vehiculoPlaca", vh.getPlaca());
                    grupo.put("vehiculoTipo", vh.getTipo());
                }
            }

            grupo.put("totalEncomiendas", lista.size());
            grupo.put("encomiendas", lista.stream()
                    .map(e -> enrichEncomienda(e, agenciasMap, clienteMap))
                    .collect(Collectors.toList()));

            resultado.add(grupo);
        }

        return ResponseEntity.ok(ApiResponse.ok(resultado));
    }

    // ─── Encomiendas urgentes (de viajes cancelados) ──────────────────────────

    @GetMapping("/api/encomiendas/urgentes")
    public ResponseEntity<ApiResponse<List<Encomienda>>> urgentes(Authentication auth) {
        Long agenciaId = resolveAgenciaId(auth);
        return ResponseEntity.ok(ApiResponse.ok(
                agenciaId != null ? encomiendaRepository.findUrgentesDeViajeCancelado(agenciaId) : List.of()));
    }

    // ─── Encomiendas listas para entregar en mi agencia ───────────────────────

    @GetMapping("/api/encomiendas/para-entregar")
    public ResponseEntity<ApiResponse<List<Encomienda>>> paraEntregar(Authentication auth) {
        Long agenciaId = resolveAgenciaId(auth);
        return ResponseEntity.ok(ApiResponse.ok(
                agenciaId != null ? encomiendaRepository.findDisponiblesParaEntrega(agenciaId) : List.of()));
    }

    // ─── Recepción masiva ───────────────────────────────────────────────────────

    @PostMapping("/api/encomiendas/viaje/{viajeId}/recepcionar")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA','OPERADOR')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> recepcionar(
            @PathVariable Long viajeId,
            @Valid @RequestBody List<RecepcionItemDTO> items,
            Authentication auth,
            HttpServletRequest request) {
        Long agenciaId = resolveAgenciaId(auth);
        Map<String, Object> result = encomiendaService.recepcionar(
                viajeId, items,
                resolveUserId(auth), agenciaId,
                extraerIp(request), resolveNombreOperador(auth));
        return ResponseEntity.ok(ApiResponse.ok("Recepción completada", result));
    }
}
