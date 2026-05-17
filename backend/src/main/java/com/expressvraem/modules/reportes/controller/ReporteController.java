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
    public ResponseEntity<ApiResponse<Map<String, Object>>> kpis() {
        Long agenciaId = AgenciaContext.getAgenciaId();
        return ResponseEntity.ok(ApiResponse.ok(reporteService.getKpisGerente(agenciaId)));
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
            @RequestParam(required = false) String estado) throws IOException {
        byte[] data = reporteService.generarReporteEncomiendas(agenciaId, estado);
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
            @RequestParam(defaultValue = "7") int dias) {
        Long agenciaId = AgenciaContext.getAgenciaId();
        return ResponseEntity.ok(ApiResponse.ok(reporteService.getTendencia(agenciaId, dias)));
    }

    @GetMapping("/caja/excel")
    public ResponseEntity<byte[]> cajaExcel(@RequestParam Long cajaId) throws IOException {
        byte[] data = reporteService.generarReporteCaja(cajaId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=caja.xlsx")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(data);
    }
}
