package com.expressvraem.shared.middleware;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Component
public class RateLimitInterceptor implements HandlerInterceptor {

    private static final int MAX_REQUESTS_PER_MIN = 100;
    private static final int MAX_LOGIN_PER_MIN = 5;

    private final ConcurrentHashMap<String, RateLimitInfo> rateLimits = new ConcurrentHashMap<>();

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response,
                             Object handler) throws IOException {
        String path = request.getRequestURI();
        boolean isLogin = path.contains("/auth/login");

        String key = isLogin ? extractIp(request) : extractUserKey(request);
        int maxRequests = isLogin ? MAX_LOGIN_PER_MIN : MAX_REQUESTS_PER_MIN;

        RateLimitInfo info = rateLimits.computeIfAbsent(key, k -> new RateLimitInfo());
        long now = System.currentTimeMillis();

        if (now - info.windowStart > 60_000) {
            info.count.set(0);
            info.windowStart = now;
        }

        if (info.count.incrementAndGet() > maxRequests) {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"success\":false,\"message\":\"Demasiadas solicitudes. Intente en un minuto.\"}");
            return false;
        }

        return true;
    }

    @Scheduled(fixedDelay = 300_000)
    public void limpiarEntradas() {
        long now = System.currentTimeMillis();
        rateLimits.entrySet().removeIf(e -> now - e.getValue().windowStart > 120_000);
    }

    private String extractIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        return (xff != null && !xff.isEmpty()) ? xff.split(",")[0].trim() : request.getRemoteAddr();
    }

    private String extractUserKey(HttpServletRequest request) {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !auth.getName().equals("anonymousUser")) {
            return "user:" + auth.getName();
        }
        return "ip:" + extractIp(request);
    }

    private static class RateLimitInfo {
        AtomicInteger count = new AtomicInteger(0);
        volatile long windowStart = System.currentTimeMillis();
    }
}
