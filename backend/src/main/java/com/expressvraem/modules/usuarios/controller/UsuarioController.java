package com.expressvraem.modules.usuarios.controller;

import com.expressvraem.modules.usuarios.service.UsuarioService;
import com.expressvraem.shared.exceptions.ApiResponse;
import com.expressvraem.shared.middleware.AgenciaContext;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/usuarios")
@RequiredArgsConstructor
public class UsuarioController {

    private final UsuarioService usuarioService;

    @GetMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','OPERADOR')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> listar() {
        Long agenciaId = AgenciaContext.getAgenciaId();
        return ResponseEntity.ok(ApiResponse.ok(usuarioService.listar(agenciaId)));
    }

    @PatchMapping("/{id}/estado")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE')")
    public ResponseEntity<ApiResponse<Void>> cambiarEstado(
            @PathVariable Long id,
            @RequestBody Map<String, Boolean> body) {
        usuarioService.cambiarEstado(id, body.get("activo"));
        return ResponseEntity.ok(ApiResponse.ok("Estado actualizado", null));
    }
}
