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
import org.springframework.security.access.prepost.PreAuthorize;

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

    private BigDecimal parseMonto(Object val, String campo) {
        if (val == null) throw new BusinessException(campo + " es obligatorio", "CAMPO_REQUERIDO");
        try {
            BigDecimal bd = new BigDecimal(String.valueOf(val));
            return bd;
        } catch (NumberFormatException e) {
            throw new BusinessException(campo + " debe ser un número válido", "CAMPO_INVALIDO");
        }
    }

    @GetMapping("/consolidado-agencias")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> consolidadoAgencias() {
        return ResponseEntity.ok(ApiResponse.ok(cajaService.getConsolidadoPorAgencia()));
    }

    @GetMapping("/estado-operadores")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> estadoOperadores(Authentication auth) {
        Long agenciaId = resolveAgenciaId(auth);
        return ResponseEntity.ok(ApiResponse.ok(cajaService.getEstadoOperadores(agenciaId)));
    }

    @GetMapping("/turno-actual")
    public ResponseEntity<ApiResponse<Map<String, Object>>> turnoActual(Authentication auth) {
        try {
            Map<String, Object> data = cajaService.getTurnoActualEnriquecido(resolveUserId(auth));
            return ResponseEntity.ok(ApiResponse.ok(data));
        } catch (BusinessException e) {
            return ResponseEntity.ok(ApiResponse.ok(null));
        }
    }

    @PostMapping("/abrir")
    public ResponseEntity<ApiResponse<Caja>> abrir(
            @RequestBody Map<String, Object> body,
            Authentication auth,
            HttpServletRequest request) {
        BigDecimal monto = parseMonto(body.get("montoInicial"), "montoInicial");
        Usuario usr = resolveUsuario(auth);
        // GERENTE/SUPER_ADMIN (sin filtro de agencia) pueden indicar en qué agencia
        // están trabajando; los demás roles quedan atados a su agencia del JWT.
        Long agenciaElegida = null;
        if (AgenciaContext.getAgenciaId() == null && body.get("agenciaId") != null
                && !String.valueOf(body.get("agenciaId")).isBlank()
                && !"null".equals(String.valueOf(body.get("agenciaId")))) {
            agenciaElegida = Long.valueOf(String.valueOf(body.get("agenciaId")));
        }
        Caja caja = cajaService.abrirCaja(
                usr.getId(), monto, agenciaElegida != null ? agenciaElegida : resolveAgenciaId(auth),
                getClientIp(request), usr.getNombres() + " " + usr.getApellidos());
        return ResponseEntity.ok(ApiResponse.ok("Turno abierto", caja));
    }

    @PostMapping("/egreso")
    public ResponseEntity<ApiResponse<MovimientoCaja>> egreso(
            @RequestBody Map<String, Object> body,
            Authentication auth,
            HttpServletRequest request) {
        String concepto = String.valueOf(body.getOrDefault("concepto", "")).trim();
        if (concepto.isEmpty()) throw new BusinessException("El concepto es obligatorio", "CAMPO_REQUERIDO");
        BigDecimal monto = parseMonto(body.get("monto"), "monto");
        Usuario usr = resolveUsuario(auth);
        MovimientoCaja mov = cajaService.registrarEgreso(
                usr.getId(), concepto, monto,
                getClientIp(request), usr.getNombres() + " " + usr.getApellidos());
        return ResponseEntity.ok(ApiResponse.ok("Egreso registrado", mov));
    }

    @PostMapping("/ingreso")
    public ResponseEntity<ApiResponse<MovimientoCaja>> ingreso(
            @RequestBody Map<String, Object> body,
            Authentication auth,
            HttpServletRequest request) {
        String concepto = String.valueOf(body.getOrDefault("concepto", "")).trim();
        if (concepto.isEmpty()) throw new BusinessException("El concepto es obligatorio", "CAMPO_REQUERIDO");
        BigDecimal monto = parseMonto(body.get("monto"), "monto");
        Usuario usr = resolveUsuario(auth);
        MovimientoCaja mov = cajaService.registrarIngreso(
                usr.getId(), concepto, monto,
                getClientIp(request), usr.getNombres() + " " + usr.getApellidos());
        return ResponseEntity.ok(ApiResponse.ok("Ingreso registrado", mov));
    }

    @PostMapping("/movimiento")
    public ResponseEntity<ApiResponse<MovimientoCaja>> movimiento(
            @RequestBody Map<String, Object> body,
            Authentication auth) {
        Long cajaId = Long.valueOf(String.valueOf(body.get("cajaId")));
        Long authUserId = resolveUserId(auth);
        String rol = resolveRol(auth);

        // Scope completo por rol: ADMIN_AGENCIA solo cajas de SU agencia (antes
        // saltaba toda verificación y podía escribir en cajas de cualquier agencia)
        cajaService.verificarAcceso(cajaId, authUserId, rol, resolveAgenciaId(auth));

        String tipo = String.valueOf(body.get("tipo"));
        String concepto = String.valueOf(body.get("concepto"));
        BigDecimal monto = parseMonto(body.get("monto"), "monto");
        String refTipo = body.containsKey("referenciaTipo") ? String.valueOf(body.get("referenciaTipo")) : null;
        Long refId = body.containsKey("referenciaId") && body.get("referenciaId") != null
                ? Long.valueOf(String.valueOf(body.get("referenciaId"))) : null;
        MovimientoCaja mov = cajaService.registrarMovimiento(
                cajaId, tipo, concepto, monto, authUserId, refTipo, refId);
        return ResponseEntity.ok(ApiResponse.ok("Movimiento registrado", mov));
    }

    @GetMapping("/movimientos")
    public ResponseEntity<ApiResponse<List<MovimientoCaja>>> movimientosActual(Authentication auth) {
        try {
            List<MovimientoCaja> movs = cajaService.getMovimientosActual(resolveUserId(auth));
            return ResponseEntity.ok(ApiResponse.ok(movs));
        } catch (BusinessException e) {
            return ResponseEntity.ok(ApiResponse.ok(List.of()));
        }
    }

    @GetMapping("/movimientos/{cajaId}")
    public ResponseEntity<ApiResponse<List<MovimientoCaja>>> movimientosByCaja(
            @PathVariable Long cajaId, Authentication auth) {
        cajaService.verificarAcceso(cajaId, resolveUserId(auth), resolveRol(auth), resolveAgenciaId(auth));
        return ResponseEntity.ok(ApiResponse.ok(cajaService.getMovimientos(cajaId)));
    }

    /** Cuotas de salida pendientes (viajes que salieron sin registrar la cuota en caja). */
    @GetMapping("/cuotas-pendientes")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> cuotasPendientes(Authentication auth) {
        boolean esGerencia = auth.getAuthorities().stream().anyMatch(a ->
                a.getAuthority().equals("ROLE_SUPER_ADMIN") || a.getAuthority().equals("ROLE_GERENTE"));
        Long agencia = esGerencia ? AgenciaContext.getAgenciaId() : resolveAgenciaId(auth);
        return ResponseEntity.ok(ApiResponse.ok(cajaService.getCuotasSalidaPendientes(agencia)));
    }

    /** Registra una cuota de salida pendiente en la caja abierta del usuario actual. */
    @PostMapping("/cuotas-pendientes/{viajeId}/cobrar")
    public ResponseEntity<ApiResponse<MovimientoCaja>> cobrarCuotaPendiente(
            @PathVariable Long viajeId, Authentication auth) {
        MovimientoCaja mov = cajaService.cobrarCuotaSalidaPendiente(viajeId, resolveUserId(auth));
        return ResponseEntity.ok(ApiResponse.ok("Cuota registrada en su caja", mov));
    }

    @PostMapping("/cerrar")
    public ResponseEntity<ApiResponse<Map<String, Object>>> cerrar(
            @RequestBody Map<String, Object> body,
            Authentication auth,
            HttpServletRequest request) {
        BigDecimal montoFisico = parseMonto(body.get("montoFisico"), "montoFisico");
        String obs = body.containsKey("observacion") ? String.valueOf(body.get("observacion")) : null;
        Usuario usr = resolveUsuario(auth);
        Caja caja = cajaService.cerrarTurno(
                usr.getId(), montoFisico, obs,
                getClientIp(request), usr.getNombres() + " " + usr.getApellidos());
        Map<String, Object> data = cajaService.getResumenTurno(caja.getId());
        return ResponseEntity.ok(ApiResponse.ok("Turno cerrado", data));
    }

    @GetMapping("/historial")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> historial(
            @RequestParam(required = false) Long agencia,
            @RequestParam(required = false) Long usuario,
            @RequestParam(defaultValue = "0") int page,
            Authentication auth) {
        Long userId = resolveUserId(auth);
        String rol = resolveRol(auth);
        Long agenciaEfectiva = "ADMIN_AGENCIA".equals(rol) ? resolveAgenciaId(auth) : agencia;
        List<Map<String, Object>> data = cajaService.getHistorial(userId, rol, agenciaEfectiva, usuario, page);
        return ResponseEntity.ok(ApiResponse.ok(data));
    }

    @GetMapping(value = "/{id}/reporte", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> reporte(@PathVariable Long id, Authentication auth) {
        cajaService.verificarAcceso(id, resolveUserId(auth), resolveRol(auth), resolveAgenciaId(auth));
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
