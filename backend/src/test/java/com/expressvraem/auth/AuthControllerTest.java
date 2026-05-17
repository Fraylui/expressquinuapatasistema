package com.expressvraem.auth;

import com.expressvraem.AbstractIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.jdbc.Sql;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@Sql(scripts = {"/test-cleanup.sql", "/test-data.sql"}, executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@DisplayName("Auth — Login y Rate Limiting")
class AuthControllerTest extends AbstractIntegrationTest {

    @Autowired
    private TestRestTemplate http;

    private static final ParameterizedTypeReference<Map<String, Object>> MAP_TYPE =
            new ParameterizedTypeReference<>() {};

    // ── helpers ──────────────────────────────────────────────────────────────

    private ResponseEntity<Map<String, Object>> doLogin(String email, String password) {
        return doLogin(email, password, null);
    }

    private ResponseEntity<Map<String, Object>> doLogin(String email, String password, String fakeIp) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (fakeIp != null) headers.set("X-Forwarded-For", fakeIp);
        String body = String.format("{\"email\":\"%s\",\"password\":\"%s\"}", email, password);
        return http.exchange("/api/auth/login", HttpMethod.POST,
                new HttpEntity<>(body, headers), MAP_TYPE);
    }

    // ── tests ─────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("T01 — Login correcto devuelve 200 + token JWT")
    void loginCorrecto() {
        ResponseEntity<Map<String, Object>> resp = doLogin("superadmin@test.com", "TestPass123!");

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).containsKey("data");

        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) resp.getBody().get("data");
        assertThat(data).containsKey("token");
        assertThat((String) data.get("token")).startsWith("eyJ");
    }

    @Test
    @DisplayName("T02 — Login con contraseña incorrecta devuelve 401")
    void loginConPasswordIncorrecto() {
        ResponseEntity<Map<String, Object>> resp = doLogin("superadmin@test.com", "WrongPassword!");

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    @DisplayName("T03 — Login con email inexistente devuelve 401")
    void loginConEmailInexistente() {
        ResponseEntity<Map<String, Object>> resp = doLogin("noexiste@test.com", "TestPass123!");

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    @DisplayName("T04 — Login con email inválido devuelve 400 (validación DTO)")
    void loginConEmailInvalido() {
        ResponseEntity<Map<String, Object>> resp = doLogin("no-es-email", "TestPass123!");

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    @DisplayName("T05 — JWT devuelto contiene rol y agenciaId")
    void tokenContieneClaimsCorrectos() {
        ResponseEntity<Map<String, Object>> resp = doLogin("operador1@test.com", "TestPass123!");

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);

        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) resp.getBody().get("data");
        @SuppressWarnings("unchecked")
        Map<String, Object> usuario = (Map<String, Object>) data.get("usuario");

        assertThat(usuario.get("rol")).isEqualTo("OPERADOR");
        assertThat(usuario.get("agenciaId")).isNotNull();
        assertThat(usuario.get("modulosActivos")).isNotNull();
    }

    @Test
    @DisplayName("T06 [A07] — 6 intentos fallidos seguidos son bloqueados por rate limiter")
    void rateLimiterBloquea() {
        String ipTest = "192.168.99.99";

        for (int i = 0; i < 5; i++) {
            doLogin("superadmin@test.com", "wrong-" + i, ipTest);
        }

        ResponseEntity<Map<String, Object>> resp = doLogin("superadmin@test.com", "wrong-final", ipTest);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
    }
}
