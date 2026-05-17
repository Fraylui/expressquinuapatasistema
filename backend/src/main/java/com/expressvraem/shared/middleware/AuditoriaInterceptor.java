package com.expressvraem.shared.middleware;

import com.expressvraem.modules.auditoria.entity.Auditoria;
import com.expressvraem.modules.auditoria.repository.AuditoriaRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
@Slf4j
public class AuditoriaInterceptor implements HandlerInterceptor {

    private final AuditoriaRepository auditoriaRepository;

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response,
                                Object handler, Exception ex) {
        registrarAsync(request, response);
    }

    @Async
    public void registrarAsync(HttpServletRequest request, HttpServletResponse response) {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            String username = (auth != null && auth.isAuthenticated()
                    && !"anonymousUser".equals(auth.getName()))
                    ? auth.getName()
                    : "ANONIMO";
            String path = request.getRequestURI();
            String method = request.getMethod();
            String modulo = extraerModulo(path);
            String accion = mapearAccion(method);
            String ip = extraerIp(request);

            Auditoria auditoria = new Auditoria();
            auditoria.setUsuarioNombre(username);
            auditoria.setAccion(accion);
            auditoria.setModulo(modulo);
            auditoria.setEntidad(modulo);
            auditoria.setIp(ip);
            auditoria.setUserAgent(request.getHeader("User-Agent"));
            auditoria.setDatosDespues("HTTP/" + response.getStatus());
            auditoria.setFecha(LocalDateTime.now());
            auditoria.setAgenciaId(AgenciaContext.getAgenciaId());

            auditoriaRepository.save(auditoria);
        } catch (Exception e) {
            log.error("Error al registrar auditoría: {}", e.getMessage());
        }
    }

    private String extraerModulo(String path) {
        String[] parts = path.split("/");
        return parts.length > 2 ? parts[2].toUpperCase() : "SISTEMA";
    }

    private String mapearAccion(String method) {
        return switch (method.toUpperCase()) {
            case "POST" -> "INSERT";
            case "PUT", "PATCH" -> "UPDATE";
            case "DELETE" -> "DELETE";
            default -> "READ";
        };
    }

    private String extraerIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isEmpty()) {
            return xff.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
