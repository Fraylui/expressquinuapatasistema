package com.expressvraem.modules.auth.controller;

import com.expressvraem.modules.auth.dto.LoginRequestDTO;
import com.expressvraem.modules.auth.dto.LoginResponseDTO;
import com.expressvraem.modules.auth.repository.UsuarioRepository;
import com.expressvraem.modules.auth.service.AuthService;
import com.expressvraem.shared.exceptions.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final UsuarioRepository usuarioRepository;

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponseDTO>> login(
            @Valid @RequestBody LoginRequestDTO dto,
            HttpServletRequest request) {
        String ip = extraerIp(request);
        LoginResponseDTO response = authService.login(dto, ip);
        return ResponseEntity.ok(ApiResponse.ok("Bienvenido al sistema", response));
    }

    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<LoginResponseDTO>> refresh(@RequestHeader("X-Refresh-Token") String token) {
        return ResponseEntity.ok(ApiResponse.ok(authService.refreshToken(token)));
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout() {
        SecurityContextHolder.clearContext();
        return ResponseEntity.ok(ApiResponse.ok("Sesión cerrada correctamente", null));
    }

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<Object>> me() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String email = auth.getName();
        var usuario = usuarioRepository.findByEmail(email);
        return ResponseEntity.ok(ApiResponse.ok(usuario.orElse(null)));
    }

    private String extraerIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        return (xff != null && !xff.isEmpty()) ? xff.split(",")[0].trim() : request.getRemoteAddr();
    }
}
