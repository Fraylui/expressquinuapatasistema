package com.expressvraem.modules.agencias.controller;

import com.expressvraem.modules.agencias.dto.AgenciaRequestDTO;
import com.expressvraem.modules.agencias.dto.AgenciaResponseDTO;
import com.expressvraem.modules.agencias.service.AgenciaService;
import com.expressvraem.shared.exceptions.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/agencias")
@RequiredArgsConstructor
public class AgenciaController {

    private final AgenciaService agenciaService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<AgenciaResponseDTO>>> listar() {
        return ResponseEntity.ok(ApiResponse.ok(agenciaService.findAll()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<AgenciaResponseDTO>> detalle(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(agenciaService.findById(id)));
    }

    @GetMapping("/{id}/metricas")
    public ResponseEntity<ApiResponse<Map<String, Object>>> metricas(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(agenciaService.getMetricas(id)));
    }

    @PostMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<AgenciaResponseDTO>> crear(@RequestBody AgenciaRequestDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Agencia creada correctamente", agenciaService.crear(dto)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<AgenciaResponseDTO>> actualizar(
            @PathVariable Long id,
            @RequestBody AgenciaRequestDTO dto) {
        return ResponseEntity.ok(ApiResponse.ok("Agencia actualizada", agenciaService.actualizar(id, dto)));
    }

    @PatchMapping("/{id}/estado")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> cambiarEstado(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        agenciaService.cambiarEstado(id, body.get("estado"));
        return ResponseEntity.ok(ApiResponse.ok("Estado actualizado", null));
    }
}
