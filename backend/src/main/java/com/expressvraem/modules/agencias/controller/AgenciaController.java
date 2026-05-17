package com.expressvraem.modules.agencias.controller;

import com.expressvraem.modules.agencias.entity.Agencia;
import com.expressvraem.modules.agencias.service.AgenciaService;
import com.expressvraem.shared.exceptions.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/agencias")
@RequiredArgsConstructor
public class AgenciaController {

    private final AgenciaService agenciaService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<Agencia>>> listar() {
        return ResponseEntity.ok(ApiResponse.ok(agenciaService.findAll()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<Agencia>> detalle(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(agenciaService.findById(id)));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'GERENTE')")
    public ResponseEntity<ApiResponse<Agencia>> crear(@RequestBody Agencia agencia) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Agencia creada correctamente", agenciaService.crear(agencia)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'GERENTE')")
    public ResponseEntity<ApiResponse<Agencia>> actualizar(@PathVariable Long id, @RequestBody Agencia datos) {
        return ResponseEntity.ok(ApiResponse.ok("Agencia actualizada", agenciaService.actualizar(id, datos)));
    }

    @PatchMapping("/{id}/estado")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'GERENTE')")
    public ResponseEntity<ApiResponse<Void>> cambiarEstado(@PathVariable Long id,
                                                           @RequestBody Map<String, Boolean> body) {
        agenciaService.cambiarEstado(id, body.get("activo"));
        return ResponseEntity.ok(ApiResponse.ok("Estado actualizado", null));
    }
}
