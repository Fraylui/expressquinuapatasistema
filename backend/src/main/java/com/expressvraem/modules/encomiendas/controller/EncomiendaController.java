package com.expressvraem.modules.encomiendas.controller;

import com.expressvraem.modules.auth.repository.UsuarioRepository;
import com.expressvraem.modules.clientes.entity.Cliente;
import com.expressvraem.modules.clientes.repository.ClienteRepository;
import com.expressvraem.modules.encomiendas.dto.RegistrarEncomiendaDTO;
import com.expressvraem.modules.encomiendas.entity.Encomienda;
import com.expressvraem.modules.encomiendas.entity.HistorialEncomienda;
import com.expressvraem.modules.encomiendas.service.ComprobantePdfService;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class EncomiendaController {

    private final EncomiendaService encomiendaService;
    private final ComprobantePdfService pdfService;
    private final UsuarioRepository usuarioRepository;
    private final ClienteRepository clienteRepository;

    private Long resolveUserId(Authentication auth) {
        return usuarioRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new BusinessException("Usuario no encontrado", "USER_NOT_FOUND"))
                .getId();
    }

    @PostMapping("/api/encomiendas")
    public ResponseEntity<ApiResponse<Encomienda>> registrar(
            @Valid @RequestBody RegistrarEncomiendaDTO dto,
            Authentication auth) {
        Encomienda enc = encomiendaService.registrar(dto, resolveUserId(auth));
        return ResponseEntity.ok(ApiResponse.ok("Encomienda registrada", enc));
    }

    @GetMapping("/api/encomiendas/lista")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> lista(
            @RequestParam(required = false) String estado,
            @RequestParam(required = false) Long destino,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime desde,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime hasta,
            @RequestParam(required = false) String q) {

        Long agenciaId = AgenciaContext.getAgenciaId();
        List<Encomienda> lista = encomiendaService.buscarConFiltros(agenciaId, estado, destino, desde, hasta, q);

        List<Map<String, Object>> resultado = lista.stream()
                .map(this::enrichEncomienda)
                .toList();

        return ResponseEntity.ok(ApiResponse.ok(resultado));
    }

    @GetMapping("/api/encomiendas/{id}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> detalle(@PathVariable Long id) {
        Encomienda enc = encomiendaService.getById(id);
        return ResponseEntity.ok(ApiResponse.ok(enrichEncomienda(enc)));
    }

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

    @PostMapping("/api/encomiendas/{id}/entregar")
    public ResponseEntity<ApiResponse<Encomienda>> entregar(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            Authentication auth) {
        String dni    = body.getOrDefault("recibidoPorDni", "");
        String nombre = body.getOrDefault("recibidoPorNombre", "");
        return ResponseEntity.ok(ApiResponse.ok("Entregado",
                encomiendaService.entregar(id, dni, nombre, resolveUserId(auth))));
    }

    @GetMapping("/api/encomiendas/{id}/historial")
    public ResponseEntity<ApiResponse<List<HistorialEncomienda>>> historial(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(encomiendaService.getHistorial(id)));
    }

    @GetMapping(value = "/api/encomiendas/{id}/comprobante", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> comprobante(@PathVariable Long id) {
        Encomienda enc = encomiendaService.getById(id);
        byte[] pdf = pdfService.generarComprobante(enc);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=\"encomienda-" + enc.getCodigoTracking() + ".pdf\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    // Endpoint público para tracking
    @GetMapping("/api/tracking/{codigo}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> tracking(@PathVariable String codigo) {
        Encomienda enc = encomiendaService.getByTracking(codigo);
        List<HistorialEncomienda> historial = encomiendaService.getHistorial(enc.getId());

        // Ley 29733: censurar datos personales en endpoint público
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("codigo", enc.getCodigoTracking());
        result.put("estado", enc.getEstado());
        result.put("descripcion", enc.getDescripcion());
        result.put("fechaRegistro", enc.getFechaRegistro());
        result.put("fechaEntregaEst", enc.getFechaEntregaEst() != null ? enc.getFechaEntregaEst() : "");
        result.put("historial", historial.stream().map(h -> {
            Map<String, Object> hm = new LinkedHashMap<>();
            hm.put("estadoAnterior", h.getEstadoAnterior());
            hm.put("estadoNuevo", h.getEstadoNuevo());
            hm.put("observacion", h.getObservacion());
            hm.put("fecha", h.getCreatedAt());
            return hm;
        }).toList());

        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    // ── private helper ─────────────────────────────────────────────────────

    private Map<String, Object> enrichEncomienda(Encomienda enc) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", enc.getId());
        m.put("codigoTracking", enc.getCodigoTracking());
        m.put("estado", enc.getEstado());
        m.put("descripcion", enc.getDescripcion());
        m.put("pesoKg", enc.getPesoKg());
        m.put("monto", enc.getMonto());
        m.put("precioEnvio", enc.getPrecioEnvio());
        m.put("formaCobro", enc.getFormaCobro());
        m.put("serie", enc.getSerie());
        m.put("correlativo", enc.getCorrelativo());
        m.put("agenciaId", enc.getAgenciaId());
        m.put("agenciaOrigenId", enc.getAgenciaOrigenId());
        m.put("agenciaDestinoId", enc.getAgenciaDestinoId());
        m.put("viajeId", enc.getViajeId());
        m.put("remitenteId", enc.getRemitenteId());
        m.put("destinatarioId", enc.getDestinatarioId());
        m.put("vendedorId", enc.getVendedorId());
        m.put("fechaRegistro", enc.getFechaRegistro());
        m.put("fechaEntregaEst", enc.getFechaEntregaEst());
        m.put("fechaEntregaReal", enc.getFechaEntregaReal());
        m.put("recibidoPorDni", enc.getRecibidoPorDni());
        m.put("recibidoPorNombre", enc.getRecibidoPorNombre());
        m.put("observaciones", enc.getObservaciones());

        // inline cliente data for frontend
        clienteRepository.findById(enc.getRemitenteId()).ifPresent(c -> {
            m.put("remitenteNombre", nombreDisplay(c));
            m.put("remitenteDoc", c.getTipoDoc() + " " + c.getNumDoc());
            m.put("remitenteTel", c.getTelefono());
        });
        clienteRepository.findById(enc.getDestinatarioId()).ifPresent(c -> {
            m.put("destinatarioNombre", nombreDisplay(c));
            m.put("destinatarioDoc", c.getTipoDoc() + " " + c.getNumDoc());
            m.put("destinatarioTel", c.getTelefono());
        });

        return m;
    }

    private String nombreDisplay(Cliente c) {
        if ("EMPRESA".equals(c.getTipo()) && c.getRazonSocial() != null) return c.getRazonSocial();
        return c.getApellidos() + ", " + c.getNombres();
    }
}
