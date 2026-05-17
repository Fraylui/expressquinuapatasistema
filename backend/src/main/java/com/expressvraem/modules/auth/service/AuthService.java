package com.expressvraem.modules.auth.service;

import com.expressvraem.modules.auth.dto.LoginRequestDTO;
import com.expressvraem.modules.auth.dto.LoginResponseDTO;
import com.expressvraem.modules.auth.entity.Usuario;
import com.expressvraem.modules.auth.repository.UsuarioRepository;
import com.expressvraem.shared.exceptions.BusinessException;
import com.expressvraem.shared.security.JwtTokenProvider;
import com.expressvraem.shared.security.UserDetailsServiceImpl;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final UserDetailsServiceImpl userDetailsService;

    @Transactional
    public LoginResponseDTO login(LoginRequestDTO dto, String ip) {
        Usuario usuario = usuarioRepository.findByEmailAndActivo(dto.email(), true)
                .orElseThrow(() -> new BusinessException("Credenciales inválidas", "AUTH_INVALID"));

        if (!passwordEncoder.matches(dto.password(), usuario.getPasswordHash())) {
            log.warn("Login fallido para: {} desde IP: {}", dto.email(), ip);
            throw new BusinessException("Credenciales inválidas", "AUTH_INVALID");
        }

        usuario.setUltimoAcceso(LocalDateTime.now());
        usuario.setIpUltimoAcceso(ip);
        usuarioRepository.save(usuario);

        List<String> modulosActivos = buildModulosActivos(usuario);

        var userDetails = userDetailsService.loadUserByUsername(dto.email());

        // SUPER_ADMIN y GERENTE: agenciaId null → ven todas las agencias
        Long agenciaIdJwt = switch (usuario.getRol()) {
            case "SUPER_ADMIN", "GERENTE" -> null;
            default -> usuario.getAgenciaId();
        };

        String token        = jwtTokenProvider.generateToken(userDetails, agenciaIdJwt, modulosActivos);
        String refreshToken = jwtTokenProvider.generateToken(userDetails, agenciaIdJwt, modulosActivos);

        log.info("Login exitoso: {} ({}) desde IP: {}", dto.email(), usuario.getRol(), ip);

        return buildResponse(token, refreshToken, usuario, modulosActivos);
    }

    public LoginResponseDTO refreshToken(String token) {
        if (!jwtTokenProvider.validateToken(token)) {
            throw new BusinessException("Token de refresco inválido o expirado", "TOKEN_INVALID");
        }
        String email = jwtTokenProvider.getUsernameFromToken(token);
        var usuario = usuarioRepository.findByEmail(email)
                .orElseThrow(() -> new BusinessException("Usuario no encontrado", "USER_NOT_FOUND"));

        List<String> modulosActivos = buildModulosActivos(usuario);
        var userDetails = userDetailsService.loadUserByUsername(email);

        Long agenciaIdJwt = switch (usuario.getRol()) {
            case "SUPER_ADMIN", "GERENTE" -> null;
            default -> usuario.getAgenciaId();
        };

        String newToken = jwtTokenProvider.generateToken(userDetails, agenciaIdJwt, modulosActivos);
        return buildResponse(newToken, token, usuario, modulosActivos);
    }

    private List<String> buildModulosActivos(Usuario usuario) {
        // SUPER_ADMIN tiene todos los módulos siempre
        if ("SUPER_ADMIN".equals(usuario.getRol())) {
            return List.of("VENTAS","ENCOMIENDAS","CAJA","MANIFIESTOS",
                           "REPORTES","USUARIOS","AGENCIAS","CONFIGURACION","AUDITORIA");
        }
        return usuario.getModulosHabilitados().stream()
                .filter(um -> Boolean.TRUE.equals(um.getActivo()))
                .map(um -> um.getModulo().getCodigo())
                .collect(Collectors.toList());
    }

    private LoginResponseDTO buildResponse(String token, String refreshToken,
                                           Usuario usuario, List<String> modulosActivos) {
        return new LoginResponseDTO(
                token, refreshToken, "Bearer", 86400000L,
                new LoginResponseDTO.UsuarioInfo(
                        usuario.getId(),
                        usuario.getNombres() + " " + usuario.getApellidos(),
                        usuario.getEmail(),
                        usuario.getRol(),
                        usuario.getAgenciaId(),
                        modulosActivos,    // permisos = modulosActivos para frontend
                        modulosActivos
                )
        );
    }
}
