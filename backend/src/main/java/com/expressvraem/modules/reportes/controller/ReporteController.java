package com.expressvraem.modules.reportes.controller;

import com.expressvraem.modules.caja.service.CajaService;
import com.expressvraem.modules.reportes.service.ReporteService;
import com.expressvraem.shared.annotations.RequiereModulo;
import com.expressvraem.shared.exceptions.ApiResponse;
import com.expressvraem.shared.middleware.AgenciaContext;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;

@RestController
@RequestMapping("/api/reportes")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('GERENTE','SUPER_ADMIN','ADMIN_AGENCIA')")
public class ReporteController {

    private final ReporteService reporteService;
    private final CajaService cajaService;

    /**
     * ADMIN_AGENCIA siempre queda limitado a su agencia (el interceptor pone su
     * agencia del JWT en AgenciaContext); SUPER_ADMIN y GERENTE no tienen filtro
     * de contexto y pueden elegir agencia por parámetro.
     */
    private Long resolveAgencia(Long agenciaIdParam) {
        Long ctx = AgenciaContext.getAgenciaId();
        return ctx != null ? ctx : agenciaIdParam;
    }

    /**
     * COBIT MEA01 + COSO — KPIs en tiempo real para el dashboard del gerente.
     * Incluye: ventas hoy, encomiendas hoy, ingresos hoy, diferencias de caja, auditoría hoy.
     */
    @GetMapping("/kpis")
    @RequiereModulo("REPORTES")
    public ResponseEntity<ApiResponse<Map<String, Object>>> kpis(
            @RequestParam(required = false) Long agenciaId) {
        Long ag = resolveAgencia(agenciaId);
        return ResponseEntity.ok(ApiResponse.ok(reporteService.getKpisGerente(ag)));
    }

    /**
     * Reporte de ingresos filtrable por rango de fechas, agencia, usuario,
     * tipo de vehículo y categoría, con desglose agrupado (groupBy:
     * categoria | dia | agencia | usuario | vehiculo | conductor | viaje).
     */
    @GetMapping("/ingresos")
    @RequiereModulo("REPORTES")
    public ResponseEntity<ApiResponse<Map<String, Object>>> ingresos(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta,
            @RequestParam(required = false) Long agenciaId,
            @RequestParam(required = false) Long usuarioId,
            @RequestParam(required = false) String tipoVehiculo,
            @RequestParam(required = false) String categoria,
            @RequestParam(defaultValue = "categoria") String groupBy) {
        return ResponseEntity.ok(ApiResponse.ok(reporteService.getIngresos(
                desde.atStartOfDay(), hasta.atTime(23, 59, 59),
                resolveAgencia(agenciaId), usuarioId,
                tipoVehiculo != null && !tipoVehiculo.isBlank() ? tipoVehiculo : null,
                categoria != null && !categoria.isBlank() ? categoria : null,
                groupBy)));
    }

    @GetMapping("/ventas/excel")
    @RequiereModulo("REPORTES")
    public ResponseEntity<byte[]> ventasExcel(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime desde,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime hasta,
            @RequestParam(required = false) Long agenciaId) throws IOException {
        byte[] data = reporteService.generarReporteVentas(desde, hasta, resolveAgencia(agenciaId));
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=ventas.xlsx")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(data);
    }

    @GetMapping("/encomiendas/excel")
    @RequiereModulo("REPORTES")
    public ResponseEntity<byte[]> encomiendaExcel(
            @RequestParam(required = false) Long agenciaId,
            @RequestParam(required = false) String estado,
            @RequestParam(required = false) String desde,
            @RequestParam(required = false) String hasta) throws IOException {
        byte[] data = reporteService.generarReporteEncomiendas(resolveAgencia(agenciaId), estado, desde, hasta);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=encomiendas.xlsx")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(data);
    }

    /** Reporte de rendiciones (entregas de efectivo a gerencia). Filtros opcionales. */
    @GetMapping("/rendiciones/excel")
    @RequiereModulo("REPORTES")
    public ResponseEntity<byte[]> rendicionesExcel(
            @RequestParam(required = false) Long agenciaId,
            @RequestParam(required = false) String estado,
            @RequestParam(required = false) String desde,
            @RequestParam(required = false) String hasta) throws IOException {
        byte[] data = reporteService.generarReporteRendiciones(resolveAgencia(agenciaId), estado, desde, hasta);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=rendiciones.xlsx")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(data);
    }

    /**
     * Tendencia de ventas (pasajes + encomiendas) de los últimos N días.
     * Devuelve lista de { fecha, pasajes, encomiendas, ingresos }.
     */
    @GetMapping("/tendencia")
    @RequiereModulo("REPORTES")
    public ResponseEntity<ApiResponse<java.util.List<Map<String, Object>>>> tendencia(
            @RequestParam(defaultValue = "7") int dias,
            @RequestParam(required = false) Long agenciaId) {
        int diasSeguro = Math.min(Math.max(dias, 1), 90);
        Long ag = resolveAgencia(agenciaId);
        return ResponseEntity.ok(ApiResponse.ok(reporteService.getTendencia(ag, diasSeguro)));
    }

    @GetMapping("/ventas-hora")
    @RequiereModulo("REPORTES")
    public ResponseEntity<ApiResponse<java.util.List<Map<String, Object>>>> ventasHora(
            @RequestParam(required = false) Long agenciaId) {
        Long ag = resolveAgencia(agenciaId);
        return ResponseEntity.ok(ApiResponse.ok(reporteService.getVentasPorHora(ag)));
    }

    @GetMapping("/viajes-dia")
    @RequiereModulo("REPORTES")
    public ResponseEntity<ApiResponse<java.util.List<Map<String, Object>>>> viajesDia(
            @RequestParam(required = false) Long agenciaId) {
        Long ag = resolveAgencia(agenciaId);
        return ResponseEntity.ok(ApiResponse.ok(reporteService.getViajesDelDia(ag)));
    }

    @GetMapping("/encomiendas-pendientes")
    @RequiereModulo("REPORTES")
    public ResponseEntity<ApiResponse<java.util.List<Map<String, Object>>>> encomiendasPendientes(
            @RequestParam(required = false) Long agenciaId) {
        Long ag = resolveAgencia(agenciaId);
        return ResponseEntity.ok(ApiResponse.ok(reporteService.getEncomiendasPendientes(ag)));
    }

    /** Comparativa hoy vs ayer: pasajes, ingresos y encomiendas con delta %. */
    @GetMapping("/comparativa")
    @RequiereModulo("REPORTES")
    public ResponseEntity<ApiResponse<Map<String, Object>>> comparativa(
            @RequestParam(required = false) Long agenciaId) {
        Long ag = resolveAgencia(agenciaId);
        return ResponseEntity.ok(ApiResponse.ok(reporteService.getComparativa(ag)));
    }

    /** Top 5 rutas por pasajes en los últimos N días. */
    @GetMapping("/top-rutas")
    @RequiereModulo("REPORTES")
    public ResponseEntity<ApiResponse<java.util.List<Map<String, Object>>>> topRutas(
            @RequestParam(defaultValue = "7") int dias,
            @RequestParam(required = false) Long agenciaId) {
        int diasSeguro = Math.min(Math.max(dias, 1), 90);
        Long ag = resolveAgencia(agenciaId);
        return ResponseEntity.ok(ApiResponse.ok(reporteService.getTopRutas(ag, diasSeguro)));
    }

    /** Conductores con viajes activos hoy — para el panel gerencial. */
    @GetMapping("/conductores-activos")
    @RequiereModulo("REPORTES")
    public ResponseEntity<ApiResponse<java.util.List<Map<String, Object>>>> conductoresActivos(
            @RequestParam(required = false) Long agenciaId) {
        Long ag = resolveAgencia(agenciaId);
        return ResponseEntity.ok(ApiResponse.ok(reporteService.getConductoresActivos(ag)));
    }

    @GetMapping("/caja/excel")
    @RequiereModulo("REPORTES")
    public ResponseEntity<byte[]> cajaExcel(
            @RequestParam(required = false) Long cajaId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime desde,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime hasta,
            @RequestParam(required = false) Long agenciaId) throws IOException {
        byte[] data;
        if (cajaId != null) {
            // ADMIN_AGENCIA solo puede exportar cajas de su propia agencia
            Long ctx = AgenciaContext.getAgenciaId();
            if (ctx != null) cajaService.verificarAcceso(cajaId, null, "ADMIN_AGENCIA", ctx);
            data = reporteService.generarReporteCaja(cajaId);
        } else {
            LocalDateTime d = desde != null ? desde : LocalDate.now().atStartOfDay();
            LocalDateTime h = hasta != null ? hasta : LocalDate.now().atTime(23, 59, 59);
            data = reporteService.generarReporteCajaPorFecha(resolveAgencia(agenciaId), d, h);
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=caja.xlsx")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(data);
    }
}
