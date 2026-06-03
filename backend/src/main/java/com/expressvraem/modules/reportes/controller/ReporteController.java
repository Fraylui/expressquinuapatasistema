package com.expressvraem.modules.reportes.controller;

import com.expressvraem.modules.reportes.service.ReporteService;
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
@PreAuthorize("hasAuthority('VER_REPORTES') or hasAnyRole('GERENTE','SUPER_ADMIN','SUPERVISOR')")
public class ReporteController {

    private final ReporteService reporteService;

    /**
     * COBIT MEA01 + COSO — KPIs en tiempo real para el dashboard del gerente.
     * Incluye: ventas hoy, encomiendas hoy, ingresos hoy, diferencias de caja, auditoría hoy.
     */
    @GetMapping("/kpis")
    public ResponseEntity<ApiResponse<Map<String, Object>>> kpis(
            @RequestParam(required = false) Long agenciaId) {
        Long ag = agenciaId != null ? agenciaId : AgenciaContext.getAgenciaId();
        return ResponseEntity.ok(ApiResponse.ok(reporteService.getKpisGerente(ag)));
    }

    @GetMapping("/ventas/excel")
    public ResponseEntity<byte[]> ventasExcel(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime desde,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime hasta,
            @RequestParam(required = false) Long agenciaId) throws IOException {
        byte[] data = reporteService.generarReporteVentas(desde, hasta, agenciaId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=ventas.xlsx")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(data);
    }

    @GetMapping("/encomiendas/excel")
    public ResponseEntity<byte[]> encomiendaExcel(
            @RequestParam(required = false) Long agenciaId,
            @RequestParam(required = false) String estado,
            @RequestParam(required = false) String desde,
            @RequestParam(required = false) String hasta) throws IOException {
        byte[] data = reporteService.generarReporteEncomiendas(agenciaId, estado, desde, hasta);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=encomiendas.xlsx")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(data);
    }

    /**
     * Tendencia de ventas (pasajes + encomiendas) de los últimos N días.
     * Devuelve lista de { fecha, pasajes, encomiendas, ingresos }.
     */
    @GetMapping("/tendencia")
    public ResponseEntity<ApiResponse<java.util.List<Map<String, Object>>>> tendencia(
            @RequestParam(defaultValue = "7") int dias,
            @RequestParam(required = false) Long agenciaId) {
        Long ag = agenciaId != null ? agenciaId : AgenciaContext.getAgenciaId();
        return ResponseEntity.ok(ApiResponse.ok(reporteService.getTendencia(ag, dias)));
    }

    @GetMapping("/ventas-hora")
    public ResponseEntity<ApiResponse<java.util.List<Map<String, Object>>>> ventasHora(
            @RequestParam(required = false) Long agenciaId) {
        Long ag = agenciaId != null ? agenciaId : AgenciaContext.getAgenciaId();
        return ResponseEntity.ok(ApiResponse.ok(reporteService.getVentasPorHora(ag)));
    }

    @GetMapping("/viajes-dia")
    public ResponseEntity<ApiResponse<java.util.List<Map<String, Object>>>> viajesDia(
            @RequestParam(required = false) Long agenciaId) {
        Long ag = agenciaId != null ? agenciaId : AgenciaContext.getAgenciaId();
        return ResponseEntity.ok(ApiResponse.ok(reporteService.getViajesDelDia(ag)));
    }

    @GetMapping("/encomiendas-pendientes")
    public ResponseEntity<ApiResponse<java.util.List<Map<String, Object>>>> encomiendasPendientes(
            @RequestParam(required = false) Long agenciaId) {
        Long ag = agenciaId != null ? agenciaId : AgenciaContext.getAgenciaId();
        return ResponseEntity.ok(ApiResponse.ok(reporteService.getEncomiendasPendientes(ag)));
    }

    /** Comparativa hoy vs ayer: pasajes, ingresos y encomiendas con delta %. */
    @GetMapping("/comparativa")
    public ResponseEntity<ApiResponse<Map<String, Object>>> comparativa(
            @RequestParam(required = false) Long agenciaId) {
        Long ag = agenciaId != null ? agenciaId : AgenciaContext.getAgenciaId();
        return ResponseEntity.ok(ApiResponse.ok(reporteService.getComparativa(ag)));
    }

    /** Top 5 rutas por pasajes en los últimos N días. */
    @GetMapping("/top-rutas")
    public ResponseEntity<ApiResponse<java.util.List<Map<String, Object>>>> topRutas(
            @RequestParam(defaultValue = "7") int dias,
            @RequestParam(required = false) Long agenciaId) {
        Long ag = agenciaId != null ? agenciaId : AgenciaContext.getAgenciaId();
        return ResponseEntity.ok(ApiResponse.ok(reporteService.getTopRutas(ag, dias)));
    }

    @GetMapping("/caja/excel")
    public ResponseEntity<byte[]> cajaExcel(
            @RequestParam(required = false) Long cajaId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime desde,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime hasta,
            @RequestParam(required = false) Long agenciaId) throws IOException {
        byte[] data;
        if (cajaId != null) {
            data = reporteService.generarReporteCaja(cajaId);
        } else {
            LocalDateTime d = desde != null ? desde : LocalDate.now().atStartOfDay();
            LocalDateTime h = hasta != null ? hasta : LocalDate.now().atTime(23, 59, 59);
            data = reporteService.generarReporteCajaPorFecha(agenciaId, d, h);
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=caja.xlsx")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(data);
    }
}
