package com.expressvraem.shared.aspects;

import com.expressvraem.modules.auth.repository.UsuarioRepository;
import com.expressvraem.modules.modulos.repository.UsuarioModuloRepository;
import com.expressvraem.shared.annotations.RequiereModulo;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Aspect
@Component
@RequiredArgsConstructor
@Slf4j
public class ModuloPermissionAspect {

    private final UsuarioModuloRepository usuarioModuloRepository;
    private final UsuarioRepository usuarioRepository;

    @Around("@annotation(requiereModulo)")
    public Object verificarModulo(ProceedingJoinPoint pjp, RequiereModulo requiereModulo) throws Throwable {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        if (auth == null || !auth.isAuthenticated()) {
            throw new AccessDeniedException("No autenticado");
        }

        // SUPER_ADMIN bypasea cualquier restricción de módulo
        boolean esSuperAdmin = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_SUPER_ADMIN"));
        if (esSuperAdmin) {
            return pjp.proceed();
        }

        String email = auth.getName();
        String codigoModulo = requiereModulo.value();

        Long usuarioId = usuarioRepository.findByEmail(email)
                .map(u -> u.getId())
                .orElse(null);

        if (usuarioId == null) {
            throw new AccessDeniedException("Usuario no encontrado");
        }

        boolean tieneModulo = usuarioModuloRepository
                .findActivoByUsuarioAndCodigo(usuarioId, codigoModulo)
                .isPresent();

        if (!tieneModulo) {
            log.warn("Acceso denegado al módulo [{}] para usuario: {}", codigoModulo, email);
            throw new AccessDeniedException(
                    "No tienes acceso al módulo " + codigoModulo +
                    ". Contacta al administrador para solicitar acceso.");
        }

        return pjp.proceed();
    }
}
