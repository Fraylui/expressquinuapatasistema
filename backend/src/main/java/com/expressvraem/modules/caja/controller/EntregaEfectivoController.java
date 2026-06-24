package com.expressvraem.modules.caja.controller;

import com.expressvraem.modules.auth.entity.Usuario;
import com.expressvraem.modules.auth.repository.UsuarioRepository;
import com.expressvraem.modules.caja.entity.EntregaEfectivo;
import com.expressvraem.modules.caja.service.EntregaEfectivoPdfService;
import com.expressvraem.modules.caja.service.EntregaEfectivoService;
import com.expressvraem.shared.annotations.RequiereModulo;
import com.expressvraem.shared.exceptions.ApiResponse;
import com.expressvraem.shared.exceptions.BusinessException;
import com.expressvraem.shared.middleware.AgenciaContext;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * Rendiciones de efectivo: la agencia declara la entrega del dinero acumulado
 * y gerencia confirma su recepción.
 */
@RestController
@RequestMapping("/api/caja/entregas")
@RequiredArgsConstructor
public class EntregaEfectivoController {

    private final EntregaEfectivoService entregaService;
    private final EntregaEfectivoPdfService pdfService;
    private final UsuarioRepository usuarioRepository;

    private Usuario resolveUsuario(Authentication auth) {
        return usuarioRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new BusinessException("Usuario no encontrado", "USER_NOT_FOUND"));
    }

    private String resolveRol(Authentication auth) {
        return auth.getAuthorities().stream()
                .map(a -> a.getAuthority().replace("ROLE_", ""))
                .filter(a -> !a.startsWith("MODULO_"))
                .findFirst().orElse("OPERADOR");
    }

    private Long resolveAgenciaId(Authentication auth) {
        Long fromContext = AgenciaContext.getAgenciaId();
        if (fromContext != null) return fromContext;
        return resolveUsuario(auth).getAgenciaId();
    }

    private String getClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        return (xff != null && !xff.isBlank()) ? xff.split(",")[0].trim() : request.getRemoteAddr();
    }

    private BigDecimal parseMonto(Object val, String campo) {
        if (val == null) throw new BusinessException(campo + " es obligatorio", "CAMPO_REQUERIDO");
        try {
            return new BigDecimal(String.valueOf(val));
        } catch (NumberFormatException e) {
            throw new BusinessException(campo + " debe ser un número válido", "CAMPO_INVALIDO");
        }
    }

    /** Declarar una entrega de efectivo (operador o admin de la agencia). */
    @PostMapping
    @RequiereModulo("CAJA")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA','OPERADOR')")
    public ResponseEntity<ApiResponse<EntregaEfectivo>> declarar(
            @RequestBody Map<String, Object> body,
            Authentication auth,
            HttpServletRequest request) {
        Usuario usr = resolveUsuario(auth);
        BigDecimal monto = parseMonto(body.get("monto"), "monto");
        String modalidad = String.valueOf(body.getOrDefault("modalidad", "ENTREGA_DIRECTA"));
        String nroOperacion = body.get("nroOperacion") != null
                ? String.valueOf(body.get("nroOperacion")).trim() : null;
        String observaciones = body.get("observaciones") != null
                ? String.valueOf(body.get("observaciones")).trim() : null;

        EntregaEfectivo entrega = entregaService.declarar(
                resolveAgenciaId(auth), usr.getId(), monto, modalidad, nroOperacion, observaciones,
                getClientIp(request), usr.getNombres() + " " + usr.getApellidos());
        return ResponseEntity.ok(ApiResponse.ok("Entrega declarada", entrega));
    }

    /** Confirmar la recepción del dinero (solo gerencia). */
    @PatchMapping("/{id}/confirmar")
    @RequiereModulo("CAJA")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE')")
    public ResponseEntity<ApiResponse<EntregaEfectivo>> confirmar(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body,
            Authentication auth,
            HttpServletRequest request) {
        Usuario usr = resolveUsuario(auth);
        BigDecimal montoConfirmado = parseMonto(body.get("montoConfirmado"), "montoConfirmado");
        String obs = body.get("observacion") != null
                ? String.valueOf(body.get("observacion")).trim() : null;

        EntregaEfectivo entrega = entregaService.confirmar(
                id, usr.getId(), montoConfirmado, obs,
                getClientIp(request), usr.getNombres() + " " + usr.getApellidos());
        String msg = "CONFIRMADA".equals(entrega.getEstado())
                ? "Recepción confirmada — el monto cuadra"
                : "Recepción registrada con diferencia (OBSERVADA)";
        return ResponseEntity.ok(ApiResponse.ok(msg, entrega));
    }

    /** Anular una entrega pendiente (quien la declaró, o gerencia). */
    @PatchMapping("/{id}/anular")
    @RequiereModulo("CAJA")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA','OPERADOR')")
    public ResponseEntity<ApiResponse<EntregaEfectivo>> anular(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body,
            Authentication auth,
            HttpServletRequest request) {
        Usuario usr = resolveUsuario(auth);
        String motivo = body.get("motivo") != null ? String.valueOf(body.get("motivo")).trim() : null;
        EntregaEfectivo entrega = entregaService.anular(
                id, usr.getId(), resolveRol(auth), motivo,
                getClientIp(request), usr.getNombres() + " " + usr.getApellidos());
        return ResponseEntity.ok(ApiResponse.ok("Entrega anulada", entrega));
    }

    /** Historial de entregas (scope por rol: gerencia ve todo, agencia lo suyo). */
    @GetMapping
    @RequiereModulo("CAJA")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> listar(
            @RequestParam(required = false) Long agencia,
            Authentication auth) {
        String rol = resolveRol(auth);
        Long agenciaUsuario = resolveAgenciaId(auth);
        return ResponseEntity.ok(ApiResponse.ok(entregaService.listar(rol, agenciaUsuario, agencia)));
    }

    /** Efectivo pendiente de rendir de la agencia del usuario (sugerencia para declarar). */
    @GetMapping("/resumen-agencia")
    @RequiereModulo("CAJA")
    public ResponseEntity<ApiResponse<Map<String, Object>>> resumenAgencia(
            @RequestParam(required = false) Long agencia,
            Authentication auth) {
        String rol = resolveRol(auth);
        boolean esGerencia = "SUPER_ADMIN".equals(rol) || "GERENTE".equals(rol);
        Long agenciaId = esGerencia && agencia != null ? agencia : resolveAgenciaId(auth);
        return ResponseEntity.ok(ApiResponse.ok(entregaService.getResumenAgencia(agenciaId)));
    }

    /** Panel gerencial: pendiente de rendir y entregas en tránsito por agencia. */
    @GetMapping("/pendiente-por-agencia")
    @RequiereModulo("CAJA")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> pendientePorAgencia() {
        return ResponseEntity.ok(ApiResponse.ok(entregaService.getPendientePorAgencia()));
    }

    /** Comprobante PDF de la rendición. */
    @GetMapping(value = "/{id}/comprobante", produces = MediaType.APPLICATION_PDF_VALUE)
    @RequiereModulo("CAJA")
    public ResponseEntity<byte[]> comprobante(@PathVariable Long id, Authentication auth) {
        EntregaEfectivo entrega = entregaService.getById(id);
        String rol = resolveRol(auth);
        boolean esGerencia = "SUPER_ADMIN".equals(rol) || "GERENTE".equals(rol);
        if (!esGerencia) {
            Long agenciaUsuario = resolveAgenciaId(auth);
            if (agenciaUsuario == null || !agenciaUsuario.equals(entrega.getAgenciaId())) {
                throw new BusinessException("No tiene acceso a esta entrega", "ACCESO_DENEGADO");
            }
        }
        byte[] pdf = pdfService.generarComprobante(entrega);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=\"rendicion-" + entrega.getNumero() + ".pdf\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }
}
