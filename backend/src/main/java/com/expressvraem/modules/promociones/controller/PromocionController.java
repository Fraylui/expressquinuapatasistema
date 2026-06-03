package com.expressvraem.modules.promociones.controller;

import com.expressvraem.modules.auth.repository.UsuarioRepository;
import com.expressvraem.modules.promociones.dto.PromocionRequestDTO;
import com.expressvraem.modules.promociones.dto.PromocionResponseDTO;
import com.expressvraem.modules.promociones.service.PromocionService;
import com.expressvraem.shared.exceptions.ApiResponse;
import com.expressvraem.shared.exceptions.BusinessException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/promociones")
@RequiredArgsConstructor
public class PromocionController {

    private final PromocionService service;
    private final UsuarioRepository usuarioRepository;

    private String resolveNombre(Authentication auth) {
        return usuarioRepository.findByEmail(auth.getName())
                .map(u -> u.getNombres() + " " + u.getApellidos())
                .orElse(auth.getName());
    }

    /** Lista todas las promociones (admin). */
    @GetMapping
    public ResponseEntity<ApiResponse<List<PromocionResponseDTO>>> lista() {
        return ResponseEntity.ok(ApiResponse.ok(service.getAll()));
    }

    /** Lista solo las vigentes hoy para un módulo (usado por el cajero en la venta). */
    @GetMapping("/vigentes")
    public ResponseEntity<ApiResponse<List<PromocionResponseDTO>>> vigentes(
            @RequestParam(required = false) String aplicaA) {
        return ResponseEntity.ok(ApiResponse.ok(service.getVigentes(aplicaA)));
    }

    /** Valida un código de campaña publicitaria. */
    @PostMapping("/validar-codigo")
    public ResponseEntity<ApiResponse<PromocionResponseDTO>> validarCodigo(
            @RequestBody Map<String, String> body) {
        String codigo  = body.getOrDefault("codigo", "");
        String aplicaA = body.getOrDefault("aplicaA", null);
        if (codigo.isBlank())
            throw new BusinessException("El código es obligatorio", "CODIGO_REQUERIDO");
        return ResponseEntity.ok(ApiResponse.ok("Código válido", service.validarCodigo(codigo, aplicaA)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<PromocionResponseDTO>> crear(
            @Valid @RequestBody PromocionRequestDTO dto,
            Authentication auth) {
        return ResponseEntity.ok(ApiResponse.ok("Promoción creada", service.crear(dto, resolveNombre(auth))));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<PromocionResponseDTO>> actualizar(
            @PathVariable Long id,
            @Valid @RequestBody PromocionRequestDTO dto) {
        return ResponseEntity.ok(ApiResponse.ok("Promoción actualizada", service.actualizar(id, dto)));
    }

    @PatchMapping("/{id}/toggle")
    public ResponseEntity<ApiResponse<Void>> toggle(@PathVariable Long id) {
        service.toggleActiva(id);
        return ResponseEntity.ok(ApiResponse.ok("Estado cambiado", null));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> eliminar(@PathVariable Long id) {
        service.eliminar(id);
        return ResponseEntity.ok(ApiResponse.ok("Promoción eliminada", null));
    }
}
