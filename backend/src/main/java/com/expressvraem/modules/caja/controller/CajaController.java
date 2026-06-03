package com.expressvraem.modules.caja.controller;

import com.expressvraem.modules.auth.entity.Usuario;
import com.expressvraem.modules.auth.repository.UsuarioRepository;
import com.expressvraem.modules.caja.entity.Caja;
import com.expressvraem.modules.caja.entity.MovimientoCaja;
import com.expressvraem.modules.caja.service.CajaReportePdfService;
import com.expressvraem.modules.caja.service.CajaService;
import com.expressvraem.shared.exceptions.ApiResponse;
import com.expressvraem.shared.exceptions.BusinessException;
import com.expressvraem.shared.middleware.AgenciaContext;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/caja")
@RequiredArgsConstructor
public class CajaController {

    private final CajaService cajaService;
    private final CajaReportePdfService pdfService;
    private final UsuarioRepository usuarioRepository;

    private Usuario resolveUsuario(Authentication auth) {
        return usuarioRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new BusinessException("Usuario no encontrado", "USER_NOT_FOUND"));
    }

    private Long resolveUserId(Authentication auth) {
        return resolveUsuario(auth).getId();
    }

    private String resolveNombre(Authentication auth) {
        Usuario u = resolveUsuario(auth);
        return u.getNombres() + " " + u.getApellidos();
    }

    private String resolveRol(Authentication auth) {
        return auth.getAuthorities().stream()
                .map(a -> a.getAuthority().replace("ROLE_", ""))
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

    // ── GET /api/caja/turno-actual ────────────────────────────────────────────────

    @GetMapping("/turno-actual")
    public ResponseEntity<ApiResponse<Map<String, Object>>> turnoActual(Authentication auth) {
        try {
            Map<String, Object> data = cajaService.getTurnoActualEnriquecido(resolveUserId(auth));
            return ResponseEntity.ok(ApiResponse.ok(data));
        } catch (BusinessException e) {
            // No open turno — return 200 with null so frontend shows "abrir turno" screen
            return ResponseEntity.ok(ApiResponse.ok(null));
        }
    }

    // ── POST /api/caja/abrir ──────────────────────────────────────────────────────

    @PostMapping("/abrir")
    public ResponseEntity<ApiResponse<Caja>> abrir(
            @RequestBody Map<String, Object> body,
            Authentication auth,
            HttpServletRequest request) {
        Object raw = body.get("montoInicial");
        if (raw == null) throw new BusinessException("montoInicial es obligatorio", "CAMPO_REQUERIDO");
        BigDecimal monto = new BigDecimal(String.valueOf(raw));
        Usuario usr = resolveUsuario(auth);
        Caja caja = cajaService.abrirCaja(
                usr.getId(), monto, resolveAgenciaId(auth),
                getClientIp(request), usr.getNombres() + " " + usr.getApellidos());
        return ResponseEntity.ok(ApiResponse.ok("Turno abierto", caja));
    }

    // ── POST /api/caja/egreso ─────────────────────────────────────────────────────

    @PostMapping("/egreso")
    public ResponseEntity<ApiResponse<MovimientoCaja>> egreso(
            @RequestBody Map<String, Object> body,
            Authentication auth,
            HttpServletRequest request) {
        String concepto = String.valueOf(body.getOrDefault("concepto", "")).trim();
        if (concepto.isEmpty()) throw new BusinessException("El concepto es obligatorio", "CAMPO_REQUERIDO");
        BigDecimal monto = new BigDecimal(String.valueOf(body.get("monto")));
        Usuario usr = resolveUsuario(auth);
        MovimientoCaja mov = cajaService.registrarEgreso(
                usr.getId(), concepto, monto,
                getClientIp(request), usr.getNombres() + " " + usr.getApellidos());
        return ResponseEntity.ok(ApiResponse.ok("Egreso registrado", mov));
    }

    // ── POST /api/caja/ingreso ────────────────────────────────────────────────────

    @PostMapping("/ingreso")
    public ResponseEntity<ApiResponse<MovimientoCaja>> ingreso(
            @RequestBody Map<String, Object> body,
            Authentication auth,
            HttpServletRequest request) {
        String concepto = String.valueOf(body.getOrDefault("concepto", "")).trim();
        if (concepto.isEmpty()) throw new BusinessException("El concepto es obligatorio", "CAMPO_REQUERIDO");
        BigDecimal monto = new BigDecimal(String.valueOf(body.get("monto")));
        Usuario usr = resolveUsuario(auth);
        MovimientoCaja mov = cajaService.registrarIngreso(
                usr.getId(), concepto, monto,
                getClientIp(request), usr.getNombres() + " " + usr.getApellidos());
        return ResponseEntity.ok(ApiResponse.ok("Ingreso registrado", mov));
    }

    // ── POST /api/caja/movimiento (llamado desde frontend al registrar pasajes/encomiendas) ──

    @PostMapping("/movimiento")
    public ResponseEntity<ApiResponse<MovimientoCaja>> movimiento(
            @RequestBody Map<String, Object> body,
            Authentication auth) {
        Long cajaId = Long.valueOf(String.valueOf(body.get("cajaId")));
        Long authUserId = resolveUserId(auth);
        String rol = resolveRol(auth);

        // Verificar ownership: solo admins pueden registrar en caja ajena
        if (!"SUPER_ADMIN".equals(rol) && !"ADMIN_AGENCIA".equals(rol)) {
            cajaService.verificarOwnership(cajaId, authUserId);
        }

        String tipo = String.valueOf(body.get("tipo"));
        String concepto = String.valueOf(body.get("concepto"));
        BigDecimal monto = new BigDecimal(String.valueOf(body.get("monto")));
        String refTipo = body.containsKey("referenciaTipo") ? String.valueOf(body.get("referenciaTipo")) : null;
        Long refId = body.containsKey("referenciaId") && body.get("referenciaId") != null
                ? Long.valueOf(String.valueOf(body.get("referenciaId"))) : null;
        MovimientoCaja mov = cajaService.registrarMovimiento(
                cajaId, tipo, concepto, monto, authUserId, refTipo, refId);
        return ResponseEntity.ok(ApiResponse.ok("Movimiento registrado", mov));
    }

    // ── GET /api/caja/movimientos ────────────────────────────────────────────────

    @GetMapping("/movimientos")
    public ResponseEntity<ApiResponse<List<MovimientoCaja>>> movimientosActual(Authentication auth) {
        try {
            List<MovimientoCaja> movs = cajaService.getMovimientosActual(resolveUserId(auth));
            return ResponseEntity.ok(ApiResponse.ok(movs));
        } catch (BusinessException e) {
            return ResponseEntity.ok(ApiResponse.ok(List.of()));
        }
    }

    // ── GET /api/caja/movimientos/{cajaId} (legacy) ──────────────────────────────

    @GetMapping("/movimientos/{cajaId}")
    public ResponseEntity<ApiResponse<List<MovimientoCaja>>> movimientosByCaja(@PathVariable Long cajaId) {
        return ResponseEntity.ok(ApiResponse.ok(cajaService.getMovimientos(cajaId)));
    }

    // ── POST /api/caja/cerrar ─────────────────────────────────────────────────────

    @PostMapping("/cerrar")
    public ResponseEntity<ApiResponse<Map<String, Object>>> cerrar(
            @RequestBody Map<String, Object> body,
            Authentication auth,
            HttpServletRequest request) {
        Object rawMonto = body.get("montoFisico");
        if (rawMonto == null) throw new BusinessException("montoFisico es obligatorio", "CAMPO_REQUERIDO");
        BigDecimal montoFisico = new BigDecimal(String.valueOf(rawMonto));
        String obs = body.containsKey("observacion") ? String.valueOf(body.get("observacion")) : null;
        Usuario usr = resolveUsuario(auth);
        Caja caja = cajaService.cerrarTurno(
                usr.getId(), montoFisico, obs,
                getClientIp(request), usr.getNombres() + " " + usr.getApellidos());
        Map<String, Object> data = cajaService.getResumenTurno(caja.getId());
        return ResponseEntity.ok(ApiResponse.ok("Turno cerrado", data));
    }

    // ── GET /api/caja/historial ──────────────────────────────────────────────────

    @GetMapping("/historial")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> historial(
            @RequestParam(required = false) Long agencia,
            @RequestParam(required = false) Long usuario,
            @RequestParam(defaultValue = "0") int page,
            Authentication auth) {
        Long userId = resolveUserId(auth);
        String rol = resolveRol(auth);
        // ADMIN_AGENCIA siempre queda restringido a su propia agencia, sin importar el param
        Long agenciaEfectiva = "ADMIN_AGENCIA".equals(rol) ? resolveAgenciaId(auth) : agencia;
        List<Map<String, Object>> data = cajaService.getHistorial(userId, rol, agenciaEfectiva, usuario, page);
        return ResponseEntity.ok(ApiResponse.ok(data));
    }

    // ── GET /api/caja/{id}/reporte (PDF) ─────────────────────────────────────────

    @GetMapping(value = "/{id}/reporte", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> reporte(@PathVariable Long id, Authentication auth) {
        Map<String, Object> datos = cajaService.getResumenTurno(id);
        List<MovimientoCaja> movs = cajaService.getMovimientos(id);
        byte[] pdf = pdfService.generarReporte(datos, movs);
        String filename = "reporte-turno-" + id + ".pdf";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }
}
