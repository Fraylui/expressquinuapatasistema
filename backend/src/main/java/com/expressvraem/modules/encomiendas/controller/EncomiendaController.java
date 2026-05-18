package com.expressvraem.modules.encomiendas.controller;

import com.expressvraem.modules.agencias.repository.AgenciaRepository;
import com.expressvraem.modules.auth.repository.UsuarioRepository;
import com.expressvraem.modules.clientes.entity.Cliente;
import com.expressvraem.modules.clientes.repository.ClienteRepository;
import com.expressvraem.modules.encomiendas.dto.EntregarEncomiendaDTO;
import com.expressvraem.modules.encomiendas.dto.RegistrarEncomiendaDTO;
import com.expressvraem.modules.encomiendas.entity.Encomienda;
import com.expressvraem.modules.encomiendas.entity.HistorialEncomienda;
import com.expressvraem.modules.encomiendas.service.ComprobantePdfService;
import com.expressvraem.modules.encomiendas.service.ComprobanteEntregaPdfService;
import com.expressvraem.modules.encomiendas.service.EncomiendaService;
import com.expressvraem.shared.exceptions.ApiResponse;
import com.expressvraem.shared.exceptions.BusinessException;
import com.expressvraem.shared.middleware.AgenciaContext;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
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
    private final UsuarioRepository usuarioRepository;
    private final ClienteRepository clienteRepository;
    private final AgenciaRepository agenciaRepository;

    private Long resolveUserId(Authentication auth) {
        return usuarioRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new BusinessException("Usuario no encontrado", "USER_NOT_FOUND"))
                .getId();
    }

    private String resolveNombreOperador(Authentication auth) {
        String email = auth != null ? auth.getName() : "—";
        try {
            var u = usuarioRepository.findByEmail(email).orElse(null);
            if (u != null) return u.getNombres() + " " + u.getApellidos();
        } catch (Exception ignored) {}
        return email;
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
            Authentication auth) {
        Encomienda enc = encomiendaService.registrar(dto, resolveUserId(auth));
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
    public ResponseEntity<ApiResponse<Map<String, Object>>> entregar(
            @PathVariable Long id,
            @Valid @RequestBody EntregarEncomiendaDTO dto,
            Authentication auth) {
        Long agenciaId = AgenciaContext.getAgenciaId();
        Map<String, Object> result = encomiendaService.entregar(id, dto, resolveUserId(auth), agenciaId);
        return ResponseEntity.ok(ApiResponse.ok("Entregado", result));
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

    // ─── Tracking público ────────────────────────────────────────────────────────

    @GetMapping("/api/tracking/{codigo}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> tracking(@PathVariable String codigo) {
        Encomienda enc = encomiendaService.getByTracking(codigo);
        List<HistorialEncomienda> historial = encomiendaService.getHistorial(enc.getId());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("codigo",           enc.getCodigoTracking());
        result.put("estado",           enc.getEstado());
        result.put("descripcion",      enc.getDescripcion());
        result.put("fechaRegistro",    enc.getFechaRegistro());
        result.put("fechaEntregaEst",  enc.getFechaEntregaEst() != null ? enc.getFechaEntregaEst() : "");
        result.put("historial", historial.stream().map(h -> {
            Map<String, Object> hm = new LinkedHashMap<>();
            hm.put("estadoAnterior", h.getEstadoAnterior());
            hm.put("estadoNuevo",    h.getEstadoNuevo());
            hm.put("observacion",    h.getObservacion());
            hm.put("fecha",          h.getCreatedAt());
            return hm;
        }).toList());

        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    // ─── Private helpers ────────────────────────────────────────────────────────

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
}
