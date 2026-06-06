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

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
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

    private static final int  MAX_INTENTOS    = 5;
    private static final long BLOQUEO_MINUTOS = 30;

    // email → [intentos, primerIntento]
    private final Map<String, long[]> intentosFallidos = new ConcurrentHashMap<>();

    private void registrarIntentoFallido(String email) {
        long ahora = System.currentTimeMillis();
        intentosFallidos.compute(email, (k, v) -> {
            if (v == null || ahora - v[1] > BLOQUEO_MINUTOS * 60_000) {
                return new long[]{1, ahora};
            }
            v[0]++;
            return v;
        });
    }

    private void verificarBloqueo(String email) {
        long[] datos = intentosFallidos.get(email);
        if (datos == null) return;
        long ahora   = System.currentTimeMillis();
        long minutos = (ahora - datos[1]) / 60_000;
        if (datos[0] >= MAX_INTENTOS && minutos < BLOQUEO_MINUTOS) {
            long restantes = BLOQUEO_MINUTOS - minutos;
            throw new BusinessException(
                "Cuenta bloqueada temporalmente por " + MAX_INTENTOS + " intentos fallidos. " +
                "Intenta nuevamente en " + restantes + " minuto(s).",
                "CUENTA_BLOQUEADA");
        }
        // Limpiar si ya venció el bloqueo
        if (minutos >= BLOQUEO_MINUTOS) intentosFallidos.remove(email);
    }

    private void limpiarIntentos(String email) {
        intentosFallidos.remove(email);
    }

    /** Solo SUPER_ADMIN puede usar este método para desbloquear manualmente. */
    public void desbloquearCuenta(String email) {
        intentosFallidos.remove(email);
        log.info("Cuenta {} desbloqueada manualmente por SUPER_ADMIN", email);
    }

    public java.util.Map<String, Object> getResumenIntentosFallidos() {
        long ahora = System.currentTimeMillis();
        var activos = intentosFallidos.entrySet().stream()
            .filter(e -> ahora - e.getValue()[1] < BLOQUEO_MINUTOS * 60_000)
            .map(e -> {
                var m = new java.util.LinkedHashMap<String, Object>();
                m.put("email",        e.getKey());
                m.put("intentos",     e.getValue()[0]);
                m.put("bloqueado",    e.getValue()[0] >= MAX_INTENTOS);
                m.put("minutosRest",  BLOQUEO_MINUTOS - (ahora - e.getValue()[1]) / 60_000);
                return m;
            }).toList();
        var result = new java.util.LinkedHashMap<String, Object>();
        result.put("cuentasConIntentos", activos.size());
        result.put("cuentasBloqueadas",  activos.stream().filter(m -> (Boolean) m.get("bloqueado")).count());
        result.put("detalle", activos);
        return result;
    }

    @Transactional
    public LoginResponseDTO login(LoginRequestDTO dto, String ip) {
        // Verificar bloqueo antes de cualquier consulta
        verificarBloqueo(dto.email());

        var userOpt = usuarioRepository.findByEmailAndActivo(dto.email(), true);
        if (userOpt.isEmpty()) {
            registrarIntentoFallido(dto.email());
            auditLoginFallido(dto.email(), null, ip, "USUARIO_NO_ENCONTRADO");
            throw new BusinessException("Credenciales inválidas", "AUTH_INVALID");
        }
        Usuario usuario = userOpt.get();

        if (!passwordEncoder.matches(dto.password(), usuario.getPasswordHash())) {
            registrarIntentoFallido(dto.email());
            long[] datos = intentosFallidos.get(dto.email());
            long intentos = datos != null ? datos[0] : 1;
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

        limpiarIntentos(dto.email());

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
            auditoriaService.registrar(Auditoria.builder()
                    .usuarioNombre(email)
                    .agenciaId(agenciaId)
                    .accion("LOGIN_FALLIDO")
                    .modulo("AUTH").entidad("SESION")
                    .datosDespues("motivo=" + motivo)
                    .ip(ip).build());
        } catch (Exception ignored) {}
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
