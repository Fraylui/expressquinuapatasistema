package com.expressvraem.shared.security;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.http.HttpStatus;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtTokenProvider jwtTokenProvider;
    private final UserDetailsServiceImpl userDetailsService;

    @Value("${ALLOWED_ORIGINS:http://localhost:3000}")
    private String allowedOrigins;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public JwtAuthenticationFilter jwtAuthenticationFilter() {
        return new JwtAuthenticationFilter(jwtTokenProvider);
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public DaoAuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .headers(h -> h
                .frameOptions(f -> f.deny())
                .contentTypeOptions(c -> {})
                .httpStrictTransportSecurity(hsts -> hsts
                    .includeSubDomains(true).maxAgeInSeconds(31536000))
                .contentSecurityPolicy(csp -> csp.policyDirectives(
                    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:"))
            )
            .authorizeHttpRequests(auth -> auth

                // ── PÚBLICOS (sin login) ─────────────────────────────
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/api/tracking/**").permitAll()
                .requestMatchers("/api/viajes/publico").permitAll()
                .requestMatchers("/api/tarifas/publico").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/agencias").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/empresa-config").permitAll()
                .requestMatchers("/ws/**", "/ws-stomp", "/ws-stomp/**").permitAll()
                .requestMatchers("/actuator/health").permitAll()

                // ── SOLO SUPER_ADMIN ─────────────────────────────────
                .requestMatchers("/api/auditoria/exportar").hasRole("SUPER_ADMIN")
                .requestMatchers("/api/auditoria/exportar-pdf").hasRole("SUPER_ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/agencias/**").hasRole("SUPER_ADMIN")
                .requestMatchers("/api/modulos/**").hasRole("SUPER_ADMIN")
                .requestMatchers("/api/auth/desbloquear").hasRole("SUPER_ADMIN")
                .requestMatchers("/api/auth/intentos-fallidos").hasRole("SUPER_ADMIN")

                // ── SUPER_ADMIN + GERENTE (auditoría lectura) ────────
                .requestMatchers("/api/auditoria/resumen").hasAnyRole("SUPER_ADMIN","GERENTE")
                .requestMatchers("/api/auditoria/actividad").hasAnyRole("SUPER_ADMIN","GERENTE")
                .requestMatchers(HttpMethod.GET, "/api/auditoria").hasAnyRole("SUPER_ADMIN","GERENTE","ADMIN_AGENCIA")

                // ── SUPER_ADMIN + GERENTE ────────────────────────────
                .requestMatchers("/api/reportes/**").hasAnyRole("SUPER_ADMIN","GERENTE")
                .requestMatchers("/api/configuracion/**").hasAnyRole("SUPER_ADMIN","GERENTE")
                .requestMatchers(HttpMethod.POST, "/api/agencias").hasAnyRole("SUPER_ADMIN","GERENTE")
                .requestMatchers(HttpMethod.PUT, "/api/agencias/**").hasAnyRole("SUPER_ADMIN","GERENTE")

                // ── SUPER_ADMIN + GERENTE + ADMIN_AGENCIA ────────────
                // ADMIN_AGENCIA puede gestionar usuarios de su propia agencia
                .requestMatchers(HttpMethod.GET, "/api/usuarios/**").hasAnyRole("SUPER_ADMIN","GERENTE","ADMIN_AGENCIA","OPERADOR")
                .requestMatchers(HttpMethod.POST, "/api/usuarios/**").hasAnyRole("SUPER_ADMIN","GERENTE","ADMIN_AGENCIA")
                .requestMatchers(HttpMethod.PUT, "/api/usuarios/**").hasAnyRole("SUPER_ADMIN","GERENTE","ADMIN_AGENCIA")
                .requestMatchers(HttpMethod.PATCH, "/api/usuarios/**").hasAnyRole("SUPER_ADMIN","GERENTE","ADMIN_AGENCIA")

                // ── CONDUCTOR — lista visible para todos los roles operativos ────────
                .requestMatchers(HttpMethod.GET, "/api/conductor/lista").hasAnyRole("SUPER_ADMIN","GERENTE","ADMIN_AGENCIA","OPERADOR","CONDUCTOR")
                // El resto de /api/conductor/** solo el CONDUCTOR mismo
                .requestMatchers("/api/conductor/**").hasRole("CONDUCTOR")

                // ── OPERACIONES (encomiendas, caja, pasajes, etc.) — excluye CONDUCTOR ──
                .requestMatchers("/api/promociones/**").hasAnyRole("SUPER_ADMIN","GERENTE","ADMIN_AGENCIA","OPERADOR")
                .requestMatchers("/api/encomiendas/**").hasAnyRole("SUPER_ADMIN","GERENTE","ADMIN_AGENCIA","OPERADOR")
                .requestMatchers("/api/caja/**").hasAnyRole("SUPER_ADMIN","GERENTE","ADMIN_AGENCIA","OPERADOR")
                .requestMatchers("/api/pasajes/**").hasAnyRole("SUPER_ADMIN","GERENTE","ADMIN_AGENCIA","OPERADOR")
                .requestMatchers("/api/clientes/**").hasAnyRole("SUPER_ADMIN","GERENTE","ADMIN_AGENCIA","OPERADOR")
                .requestMatchers("/api/manifiestos/**").hasAnyRole("SUPER_ADMIN","GERENTE","ADMIN_AGENCIA","OPERADOR")
                .requestMatchers("/api/viajes/**").hasAnyRole("SUPER_ADMIN","GERENTE","ADMIN_AGENCIA","OPERADOR")
                .requestMatchers("/api/agencias/**").hasAnyRole("SUPER_ADMIN","GERENTE","ADMIN_AGENCIA","OPERADOR")
                .requestMatchers("/api/rutas/**").hasAnyRole("SUPER_ADMIN","GERENTE","ADMIN_AGENCIA","OPERADOR")

                // ── EL RESTO requiere autenticación ──────────────────
                .anyRequest().authenticated()
            )
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((request, response, authException) -> {
                    response.setContentType("application/json;charset=UTF-8");
                    response.setStatus(HttpStatus.UNAUTHORIZED.value());
                    response.getWriter().write(
                        "{\"success\":false,\"message\":\"Token inválido o expirado. Inicie sesión nuevamente.\"}");
                })
                .accessDeniedHandler((request, response, accessDeniedException) -> {
                    response.setContentType("application/json;charset=UTF-8");
                    response.setStatus(HttpStatus.FORBIDDEN.value());
                    response.getWriter().write(
                        "{\"success\":false,\"message\":\"No tiene permiso para acceder a este recurso.\"}");
                })
            )
            .authenticationProvider(authenticationProvider())
            .addFilterBefore(jwtAuthenticationFilter(), UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(allowedOrigins.split(",")));
        config.setAllowedMethods(List.of("GET","POST","PUT","PATCH","DELETE","OPTIONS"));
        config.setAllowedHeaders(List.of(
                "Authorization", "Content-Type", "X-Refresh-Token",
                "X-Requested-With", "Accept", "Origin"));
        config.setExposedHeaders(List.of("Content-Disposition"));
        config.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
