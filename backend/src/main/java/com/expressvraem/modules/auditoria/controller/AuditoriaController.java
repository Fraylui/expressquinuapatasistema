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
import java.time.LocalDateTime;
import java.util.Map;

@RestController
@RequestMapping("/api/auditoria")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('GERENTE','SUPER_ADMIN','ADMIN')")
public class AuditoriaController {

    private final AuditoriaService auditoriaService;

    @GetMapping
    public ResponseEntity<ApiResponse<Page<Auditoria>>> listar(
            @RequestParam(required = false) Long usuarioId,
            @RequestParam(required = false) String modulo,
            @RequestParam(required = false) String accion,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Long agenciaId = AgenciaContext.getAgenciaId();
        Page<Auditoria> result = auditoriaService.buscar(
                usuarioId, modulo, accion, agenciaId, null, null,
                PageRequest.of(page, size, Sort.by("fecha").descending()));
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    @GetMapping("/resumen")
    public ResponseEntity<ApiResponse<Map<String, Object>>> resumen() {
        Long agenciaId = AgenciaContext.getAgenciaId();
        return ResponseEntity.ok(ApiResponse.ok(auditoriaService.getResumenHoy(agenciaId)));
    }

    @GetMapping("/exportar")
    public ResponseEntity<byte[]> exportar(
            @RequestParam(required = false) String desde,
            @RequestParam(required = false) String hasta) throws IOException {
        Long agenciaId = AgenciaContext.getAgenciaId();
        LocalDateTime d = desde != null ? LocalDateTime.parse(desde) : LocalDateTime.now().minusDays(30);
        LocalDateTime h = hasta != null ? LocalDateTime.parse(hasta) : LocalDateTime.now();

        byte[] excel = auditoriaService.exportarLogs(agenciaId, d, h);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=auditoria.xlsx")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(excel);
    }
}
