package com.expressvraem.shared.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;
import java.util.stream.Collectors;

@Component
@Slf4j
public class JwtTokenProvider {

    private final SecretKey key;
    private final long expiration;

    public JwtTokenProvider(
            @Value("${jwt.secret}") String secret,
            @Value("${jwt.expiration:86400000}") long expiration) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expiration = expiration;
    }

    public String generateToken(UserDetails userDetails, Long agenciaId, List<String> modulosActivos) {
        List<String> roles = userDetails.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.toList());

        return Jwts.builder()
                .setSubject(userDetails.getUsername())
                .claim("roles", roles)
                .claim("agenciaId", agenciaId)
                .claim("modulosActivos", modulosActivos)
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + expiration))
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    public boolean validateToken(String token) {
        try {
            Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token);
            return true;
        } catch (ExpiredJwtException ex) {
            log.warn("Token JWT expirado");
        } catch (UnsupportedJwtException ex) {
            log.warn("Token JWT no soportado");
        } catch (MalformedJwtException ex) {
            log.warn("Token JWT malformado");
        } catch (Exception ex) {
            log.warn("Token JWT inválido: {}", ex.getMessage());
        }
        return false;
    }

    public String getUsernameFromToken(String token) {
        return getClaims(token).getSubject();
    }

    public Long getAgenciaIdFromToken(String token) {
        Object agenciaId = getClaims(token).get("agenciaId");
        if (agenciaId instanceof Integer) return ((Integer) agenciaId).longValue();
        if (agenciaId instanceof Long) return (Long) agenciaId;
        return null;
    }

    @SuppressWarnings("unchecked")
    public List<String> getRolesFromToken(String token) {
        return (List<String>) getClaims(token).get("roles");
    }

    @SuppressWarnings("unchecked")
    public List<String> getModulosActivosFromToken(String token) {
        Object val = getClaims(token).get("modulosActivos");
        if (val instanceof List) return (List<String>) val;
        return List.of();
    }

    private Claims getClaims(String token) {
        return Jwts.parserBuilder().setSigningKey(key).build()
                .parseClaimsJws(token).getBody();
    }
}
