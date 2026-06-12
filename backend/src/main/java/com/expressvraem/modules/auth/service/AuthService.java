package com.expressvraem.modules.auth.service;

import com.expressvraem.modules.auditoria.entity.Auditoria;
import com.expressvraem.modules.auditoria.service.AuditoriaService;
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

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final UserDetailsServiceImpl userDetailsService;
    private final AuditoriaService auditoriaService;
    private final LoginAttemptService loginAttemptService;

    private static final int  MAX_INTENTOS    = LoginAttemptService.MAX_INTENTOS;
    private static final long BLOQUEO_MINUTOS = LoginAttemptService.BLOQUEO_MINUTOS;

    // ── Failed-attempt helpers ────────────────────────────────────
    // El registro del intento vive en LoginAttemptService (REQUIRES_NEW):
    // login() es @Transactional y lanza excepción tras registrar, así que
    // guardarlo aquí se perdería con el rollback.

    void verificarBloqueo(Usuario usuario) {
        LocalDateTime bloqueadoHasta = usuario.getBloqueadoHasta();
        if (bloqueadoHasta == null) return;
        LocalDateTime ahora = LocalDateTime.now();
        if (bloqueadoHasta.isAfter(ahora)) {
            long restantes = Duration.between(ahora, bloqueadoHasta).toMinutes() + 1;
            throw new BusinessException(
                "Cuenta bloqueada temporalmente por " + MAX_INTENTOS + " intentos fallidos. " +
                "Intenta nuevamente en " + restantes + " minuto(s).",
                "CUENTA_BLOQUEADA");
        }
        // Block expired — clear it
        usuario.setIntentosFallidos(0);
        usuario.setBloqueadoHasta(null);
        usuarioRepository.save(usuario);
    }

    @Transactional
    void limpiarIntentos(Usuario usuario) {
        if (usuario.getIntentosFallidos() > 0 || usuario.getBloqueadoHasta() != null) {
            usuario.setIntentosFallidos(0);
            usuario.setBloqueadoHasta(null);
            usuarioRepository.save(usuario);
        }
    }

    /** Solo SUPER_ADMIN puede usar este método para desbloquear manualmente. */
    @Transactional
    public void desbloquearCuenta(String email) {
        usuarioRepository.findByEmail(email).ifPresent(u -> {
            u.setIntentosFallidos(0);
            u.setBloqueadoHasta(null);
            usuarioRepository.save(u);
            log.info("Cuenta {} desbloqueada manualmente por SUPER_ADMIN", email);
        });
    }

    public Map<String, Object> getResumenIntentosFallidos() {
        LocalDateTime ahora = LocalDateTime.now();
        var usuarios = usuarioRepository.findByIntentosFallidosGreaterThan(0);
        var activos = usuarios.stream().map(u -> {
            var m = new LinkedHashMap<String, Object>();
            m.put("email",       u.getEmail());
            m.put("intentos",    u.getIntentosFallidos());
            boolean bloqueado = u.getBloqueadoHasta() != null && u.getBloqueadoHasta().isAfter(ahora);
            m.put("bloqueado",   bloqueado);
            m.put("minutosRest", bloqueado ? Duration.between(ahora, u.getBloqueadoHasta()).toMinutes() + 1 : 0);
            return m;
        }).toList();
        var result = new LinkedHashMap<String, Object>();
        result.put("cuentasConIntentos", activos.size());
        result.put("cuentasBloqueadas",  activos.stream().filter(m -> (Boolean) m.get("bloqueado")).count());
        result.put("detalle", activos);
        return result;
    }

    // ── Login ─────────────────────────────────────────────────────

    @Transactional
    public LoginResponseDTO login(LoginRequestDTO dto, String ip) {
        // Fetch user (active or not) to check block status first
        var usuarioOpt = usuarioRepository.findByEmail(dto.email());

        if (usuarioOpt.isEmpty() || !usuarioOpt.get().isActivo()) {
            // Track attempt on inactive accounts too, but don't reveal whether user exists
            usuarioOpt.ifPresent(u -> loginAttemptService.registrarIntentoFallido(u.getId()));
            auditLoginFallido(dto.email(), null, ip, "USUARIO_NO_ENCONTRADO");
            throw new BusinessException("Credenciales inválidas", "AUTH_INVALID");
        }

        Usuario usuario = usuarioOpt.get();
        verificarBloqueo(usuario);

        if (!passwordEncoder.matches(dto.password(), usuario.getPasswordHash())) {
            int intentos = loginAttemptService.registrarIntentoFallido(usuario.getId());
            log.warn("Login fallido para: {} desde IP: {} (intento {}/{})", dto.email(), ip, intentos, MAX_INTENTOS);
            auditLoginFallido(dto.email(), usuario.getAgenciaId(), ip,
                "PASSWORD_INCORRECTO (intento " + intentos + "/" + MAX_INTENTOS + ")");
            if (intentos >= MAX_INTENTOS) {
                throw new BusinessException(
                    "Cuenta bloqueada por " + MAX_INTENTOS + " intentos fallidos. " +
                    "Intenta nuevamente en " + BLOQUEO_MINUTOS + " minutos.",
                    "CUENTA_BLOQUEADA");
            }
            throw new BusinessException("Credenciales inválidas. Intentos restantes: " +
                (MAX_INTENTOS - intentos), "AUTH_INVALID");
        }

        limpiarIntentos(usuario);

        usuario.setUltimoAcceso(LocalDateTime.now());
        usuario.setIpUltimoAcceso(ip);
        usuarioRepository.save(usuario);

        List<String> modulosActivos = buildModulosActivos(usuario);
        var userDetails = userDetailsService.loadUserByUsername(dto.email());

        Long agenciaIdJwt = switch (usuario.getRol()) {
            case "SUPER_ADMIN", "GERENTE" -> null;
            default -> usuario.getAgenciaId();
        };

        String token        = jwtTokenProvider.generateToken(userDetails, agenciaIdJwt, modulosActivos);
        String refreshToken = jwtTokenProvider.generateRefreshToken(userDetails, agenciaIdJwt);

        log.info("Login exitoso: {} ({}) desde IP: {}", dto.email(), usuario.getRol(), ip);

        auditoriaService.registrar(Auditoria.builder()
                .usuarioId(usuario.getId())
                .usuarioNombre(usuario.getNombres() + " " + usuario.getApellidos())
                .agenciaId(usuario.getAgenciaId())
                .accion("LOGIN").modulo("AUTH").entidad("SESION")
                .datosDespues("rol=" + usuario.getRol())
                .ip(ip).build());

        return buildResponse(token, refreshToken, usuario, modulosActivos);
    }

    private void auditLoginFallido(String email, Long agenciaId, String ip, String motivo) {
        try {
            // REQUIRES_NEW: el rollback del login no debe borrar el rastro de auditoría
            loginAttemptService.auditarLoginFallido(email, agenciaId, ip, motivo);
        } catch (Exception e) {
            log.warn("No se pudo auditar login fallido de {}: {}", email, e.getMessage());
        }
    }

    public void registrarLogout(String email, String ip) {
        usuarioRepository.findByEmail(email).ifPresent(u ->
                auditoriaService.registrar(Auditoria.builder()
                        .usuarioId(u.getId())
                        .usuarioNombre(u.getNombres() + " " + u.getApellidos())
                        .agenciaId(u.getAgenciaId())
                        .accion("LOGOUT").modulo("AUTH").entidad("SESION")
                        .ip(ip).build()));
    }

    // ── Refresh token — Fix 3: verify activo ─────────────────────

    public LoginResponseDTO refreshToken(String token) {
        if (!jwtTokenProvider.validateToken(token)) {
            throw new BusinessException("Token de refresco inválido o expirado", "TOKEN_INVALID");
        }
        if (!"refresh".equals(jwtTokenProvider.getTypeFromToken(token))) {
            throw new BusinessException("El token proporcionado no es un token de refresco", "TOKEN_TYPE_INVALID");
        }
        String email = jwtTokenProvider.getUsernameFromToken(token);
        var usuario = usuarioRepository.findByEmailAndActivo(email, true)
                .orElseThrow(() -> new BusinessException("Usuario no encontrado o inactivo", "USER_NOT_FOUND"));

        List<String> modulosActivos = buildModulosActivos(usuario);
        var userDetails = userDetailsService.loadUserByUsername(email);

        Long agenciaIdJwt = switch (usuario.getRol()) {
            case "SUPER_ADMIN", "GERENTE" -> null;
            default -> usuario.getAgenciaId();
        };

        String newToken        = jwtTokenProvider.generateToken(userDetails, agenciaIdJwt, modulosActivos);
        String newRefreshToken = jwtTokenProvider.generateRefreshToken(userDetails, agenciaIdJwt);
        return buildResponse(newToken, newRefreshToken, usuario, modulosActivos);
    }

    // ── /me — Fix 2: verify activo ───────────────────────────────

    public LoginResponseDTO.UsuarioInfo getMeInfo(String email) {
        Usuario usuario = usuarioRepository.findByEmailAndActivo(email, true)
                .orElseThrow(() -> new BusinessException("Usuario no encontrado o inactivo", "USER_NOT_FOUND"));
        List<String> modulos = buildModulosActivos(usuario);
        return new LoginResponseDTO.UsuarioInfo(
                usuario.getId(),
                usuario.getNombres() + " " + usuario.getApellidos(),
                usuario.getEmail(),
                usuario.getRol(),
                usuario.getAgenciaId(),
                modulos,
                modulos
        );
    }

    // ── Helpers ───────────────────────────────────────────────────

    private List<String> buildModulosActivos(Usuario usuario) {
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
                        modulosActivos,
                        modulosActivos
                )
        );
    }
}
