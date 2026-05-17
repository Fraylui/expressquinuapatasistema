package com.expressvraem.security;

import com.expressvraem.AbstractIntegrationTest;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
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
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@DisplayName("Roles y Permisos — 6 escenarios")
class RolesPermisosTest extends AbstractIntegrationTest {

    @Autowired
    private TestRestTemplate http;

    private static final ParameterizedTypeReference<Map<String, Object>> MAP_TYPE =
            new ParameterizedTypeReference<>() {};

    private String tokenSuperAdmin;
    private String tokenGerente;
    private String tokenOperadorHmg;
    private String tokenConductor;

    @BeforeAll
    void obtenerTokens() {
        tokenSuperAdmin  = login("superadmin@test.com", "TestPass123!");
        tokenGerente     = login("gerente@test.com",    "TestPass123!");
        tokenOperadorHmg = login("operador1@test.com",  "TestPass123!");
        tokenConductor   = login("conductor@test.com",  "TestPass123!");
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private String login(String email, String password) {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        String body = String.format("{\"email\":\"%s\",\"password\":\"%s\"}", email, password);
        ResponseEntity<Map<String, Object>> resp = http.exchange("/api/auth/login", HttpMethod.POST,
                new HttpEntity<>(body, h), MAP_TYPE);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) resp.getBody().get("data");
        return (String) data.get("token");
    }

    private ResponseEntity<Map<String, Object>> get(String url, String token) {
        HttpHeaders h = new HttpHeaders();
        if (token != null) h.setBearerAuth(token);
        return http.exchange(url, HttpMethod.GET, new HttpEntity<>(h), MAP_TYPE);
    }

    // ── tests ─────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("E1 — SUPER_ADMIN accede a /api/auditoria")
    void superAdminVeAuditoria() {
        ResponseEntity<Map<String, Object>> resp = get("/api/auditoria", tokenSuperAdmin);
        assertThat(resp.getStatusCode()).isNotEqualTo(HttpStatus.FORBIDDEN);
        assertThat(resp.getStatusCode()).isNotEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    @DisplayName("E2 — GERENTE NO puede acceder a /api/auditoria → 403")
    void gerenteNoVeAuditoria() {
        ResponseEntity<Map<String, Object>> resp = get("/api/auditoria", tokenGerente);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    @DisplayName("E3 — OPERADOR puede listar encomiendas de su agencia")
    void operadorVeEncomiendas() {
        ResponseEntity<Map<String, Object>> resp = get("/api/encomiendas/lista", tokenOperadorHmg);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    @DisplayName("E4 — CONDUCTOR NO puede acceder a /api/encomiendas → 403")
    void conductorNoVeEncomiendas() {
        ResponseEntity<Map<String, Object>> resp = get("/api/encomiendas/lista", tokenConductor);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    @DisplayName("E5 — OPERADOR NO puede acceder a /api/reportes → 403")
    void operadorNoVeReportes() {
        ResponseEntity<Map<String, Object>> resp = get("/api/reportes/kpis", tokenOperadorHmg);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    @DisplayName("E6 — /api/tracking es público (sin token → no 401)")
    void trackingEsPublico() {
        ResponseEntity<Map<String, Object>> resp = get("/api/tracking/EXP-TEST-0001", null);
        assertThat(resp.getStatusCode()).isNotEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    @DisplayName("E7 — SUPER_ADMIN puede crear agencias (POST /api/agencias)")
    void superAdminCreaAgencia() {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        h.setBearerAuth(tokenSuperAdmin);
        String body = "{\"codigo\":\"TST\",\"nombre\":\"Test Agencia\",\"ciudad\":\"Lima\",\"departamento\":\"Lima\"}";
        ResponseEntity<Map<String, Object>> resp = http.exchange("/api/agencias", HttpMethod.POST,
                new HttpEntity<>(body, h), MAP_TYPE);
        assertThat(resp.getStatusCode()).isIn(HttpStatus.OK, HttpStatus.CREATED);
    }

    @Test
    @DisplayName("E8 — OPERADOR NO puede crear agencias → 403")
    void operadorNoCreaAgencia() {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        h.setBearerAuth(tokenOperadorHmg);
        String body = "{\"codigo\":\"TST2\",\"nombre\":\"Test Agencia 2\",\"ciudad\":\"Lima\",\"departamento\":\"Lima\"}";
        ResponseEntity<Map<String, Object>> resp = http.exchange("/api/agencias", HttpMethod.POST,
                new HttpEntity<>(body, h), MAP_TYPE);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }
}
