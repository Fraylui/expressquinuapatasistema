package com.expressvraem.modules.auth.dto;

import java.util.List;

public record LoginResponseDTO(
        String token,
        String refreshToken,
        String tipo,
        long expiresIn,
        UsuarioInfo usuario
) {
    public record UsuarioInfo(
            Long id,
            String nombre,
            String email,
            String rol,
            Long agenciaId,
            List<String> permisos,
            List<String> modulosActivos
    ) {}
}
