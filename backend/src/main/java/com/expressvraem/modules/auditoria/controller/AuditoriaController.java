package com.expressvraem.modules.auditoria.controller;

import com.expressvraem.modules.auditoria.entity.Auditoria;
import com.expressvraem.modules.auditoria.service.AuditoriaService;
import com.expressvraem.shared.exceptions.ApiResponse;
import com.expressvraem.shared.middleware.AgenciaContext;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/auditoria")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA')")
public class AuditoriaController {

    private final AuditoriaService auditoriaService;

    @GetMapping
    public ResponseEntity<ApiResponse<Page<Auditoria>>> listar(
            @RequestParam(required = false) Long usuarioId,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String modulo,
            @RequestParam(required = false) String accion,
            @RequestParam(required = false) String desde,
            @RequestParam(required = false) String hasta,
            @RequestParam(required = false) String ip,
            @RequestParam(required = false) Long registroId,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "25") int size) {
        Long agenciaId = AgenciaContext.getAgenciaId();
        LocalDateTime d = desde != null ? LocalDate.parse(desde).atStartOfDay()     : null;
        LocalDateTime h = hasta != null ? LocalDate.parse(hasta).atTime(23, 59, 59) : null;
        Page<Auditoria> result = auditoriaService.buscar(
                usuarioId, q, modulo, accion, agenciaId, d, h, ip, registroId,
                PageRequest.of(page, size, Sort.by("fecha").descending()));
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    @GetMapping("/resumen")
    public ResponseEntity<ApiResponse<Map<String, Object>>> resumen() {
        Long agenciaId = AgenciaContext.getAgenciaId();
        return ResponseEntity.ok(ApiResponse.ok(auditoriaService.getResumenHoy(agenciaId)));
    }

    @GetMapping("/actividad")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> actividad(
            @RequestParam(defaultValue = "hoy") String periodo) {
        Long agenciaId = AgenciaContext.getAgenciaId(); // null = SUPER_ADMIN ve todo
        return ResponseEntity.ok(ApiResponse.ok(auditoriaService.getActividad(agenciaId, periodo)));
    }

    @GetMapping("/exportar")
    public ResponseEntity<byte[]> exportarExcel(
            @RequestParam(required = false) String desde,
            @RequestParam(required = false) String hasta) throws IOException {
        Long agenciaId = AgenciaContext.getAgenciaId();
        LocalDateTime d = desde != null ? LocalDate.parse(desde).atStartOfDay()      : LocalDateTime.now().minusDays(30);
        LocalDateTime h = hasta != null ? LocalDate.parse(hasta).atTime(23, 59, 59) : LocalDateTime.now();
        byte[] excel = auditoriaService.exportarExcel(agenciaId, d, h);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=auditoria.xlsx")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(excel);
    }

    @GetMapping(value = "/exportar-pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> exportarPdf(
            @RequestParam(required = false) String desde,
            @RequestParam(required = false) String hasta) {
        Long agenciaId = AgenciaContext.getAgenciaId();
        LocalDateTime d = desde != null ? LocalDate.parse(desde).atStartOfDay()      : LocalDateTime.now().minusDays(30);
        LocalDateTime h = hasta != null ? LocalDate.parse(hasta).atTime(23, 59, 59) : LocalDateTime.now();
        byte[] pdf = auditoriaService.exportarPdf(agenciaId, d, h);
        String filename = "auditoria-" + LocalDate.now() + ".pdf";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }
}
