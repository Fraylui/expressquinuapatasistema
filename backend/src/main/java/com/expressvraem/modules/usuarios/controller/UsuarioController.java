package com.expressvraem.modules.usuarios.controller;

import com.expressvraem.modules.usuarios.dto.ActualizarUsuarioDTO;
import com.expressvraem.modules.usuarios.dto.CrearUsuarioDTO;
import com.expressvraem.modules.usuarios.service.UsuarioService;
import com.expressvraem.shared.exceptions.ApiResponse;
import com.expressvraem.shared.middleware.AgenciaContext;
import jakarta.validation.Valid;
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
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA','OPERADOR')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> listar() {
        Long agenciaId = AgenciaContext.getAgenciaId();
        return ResponseEntity.ok(ApiResponse.ok(usuarioService.listar(agenciaId)));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> obtener(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(usuarioService.obtener(id)));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> crear(
            @Valid @RequestBody CrearUsuarioDTO dto) {
        return ResponseEntity.ok(ApiResponse.ok("Usuario creado correctamente", usuarioService.crear(dto)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> actualizar(
            @PathVariable Long id,
            @Valid @RequestBody ActualizarUsuarioDTO dto) {
        return ResponseEntity.ok(ApiResponse.ok("Usuario actualizado", usuarioService.actualizar(id, dto)));
    }

    @PatchMapping("/{id}/estado")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA')")
    public ResponseEntity<ApiResponse<Void>> cambiarEstado(
            @PathVariable Long id,
            @RequestBody Map<String, Boolean> body) {
        usuarioService.cambiarEstado(id, body.get("activo"));
        return ResponseEntity.ok(ApiResponse.ok("Estado actualizado", null));
    }
}
