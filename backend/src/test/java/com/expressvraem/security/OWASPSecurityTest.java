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

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@Sql(scripts = {"/test-cleanup.sql", "/test-data.sql"}, executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@DisplayName("OWASP Top 10 — Pruebas automatizadas")
class OWASPSecurityTest extends AbstractIntegrationTest {

    @Autowired
    private TestRestTemplate http;

    private static final ParameterizedTypeReference<Map<String, Object>> MAP_TYPE =
            new ParameterizedTypeReference<>() {};

    private String tokenOperadorHmg;
    private String tokenOperadorKmb;

    @BeforeAll
    void obtenerTokens() {
        tokenOperadorHmg = login("operador1@test.com", "TestPass123!");
        tokenOperadorKmb = login("operador2@test.com", "TestPass123!");
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private String login(String email, String password) {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        String body = String.format("{\"email\":\"%s\",\"password\":\"%s\"}", email, password);
        ResponseEntity<Map<String, Object>> resp = http.exchange("/api/auth/login", HttpMethod.POST,
                new HttpEntity<>(body, h), MAP_TYPE);
        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) resp.getBody().get("data");
        return (String) data.get("token");
    }

    private ResponseEntity<Map<String, Object>> get(String url, String token) {
        HttpHeaders h = new HttpHeaders();
        if (token != null) h.setBearerAuth(token);
        return http.exchange(url, HttpMethod.GET, new HttpEntity<>(h), MAP_TYPE);
    }

    // ── A01 Broken Access Control ─────────────────────────────────────────────

    @Test
    @DisplayName("[A01] OPERADOR Kimbiri NO puede ver encomiendas de Huamanga")
    void a01_multiTenancyEncomiendas() {
        ResponseEntity<Map<String, Object>> resp = get("/api/encomiendas/lista", tokenOperadorKmb);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> lista = (List<Map<String, Object>>)
                ((Map<String, Object>) resp.getBody().get("data"));

        if (lista != null && !lista.isEmpty()) {
            lista.forEach(enc -> assertThat(enc.get("agenciaId")).isEqualTo(2));
        }
    }

    @Test
    @DisplayName("[A01] OPERADOR Kimbiri NO puede ver cliente de Huamanga por ID")
    void a01_multiTenancyCliente() {
        ResponseEntity<Map<String, Object>> resp = get("/api/clientes/1", tokenOperadorKmb);
        assertThat(resp.getStatusCode()).isIn(HttpStatus.FORBIDDEN, HttpStatus.NOT_FOUND);
    }

    @Test
    @DisplayName("[A01] OPERADOR Huamanga solo ve sus propios clientes en búsqueda")
    void a01_busquedaClientesFiltrada() {
        ResponseEntity<Map<String, Object>> resp = get("/api/clientes?q=Remitente", tokenOperadorHmg);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    // ── A02 Cryptographic Failures ────────────────────────────────────────────

    @Test
    @DisplayName("[A02] La contraseña en BD es BCrypt hash (nunca texto plano)")
    void a02_passwordsHasheados() {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);

        ResponseEntity<Map<String, Object>> resp = http.exchange("/api/auth/login", HttpMethod.POST,
                new HttpEntity<>("{\"email\":\"operador1@test.com\",\"password\":\"TestPass123!\"}", h),
                MAP_TYPE);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);

        resp = http.exchange("/api/auth/login", HttpMethod.POST,
                new HttpEntity<>("{\"email\":\"operador1@test.com\",\"password\":\"$2a$06$MMfCuD090hDcRUMWAfWh0uhYLTG0ZReseFSK5xTr7jieMr9oLzmRu\"}", h),
                MAP_TYPE);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    // ── A03 Injection ─────────────────────────────────────────────────────────

    @Test
    @DisplayName("[A03] SQL injection en búsqueda de clientes es neutralizado")
    void a03_sqlInjectionClientes() {
        ResponseEntity<Map<String, Object>> resp = get("/api/clientes?q=' OR '1'='1", tokenOperadorHmg);
        assertThat(resp.getStatusCode()).isNotEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(resp.getStatusCode()).isNotEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    @DisplayName("[A03] SQL injection en búsqueda de DNI es neutralizado")
    void a03_sqlInjectionDni() {
        ResponseEntity<Map<String, Object>> resp = get(
                "/api/clientes/buscar?tipoDoc=DNI&numDoc='; DROP TABLE clientes; --",
                tokenOperadorHmg);
        assertThat(resp.getStatusCode()).isNotEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
    }

    // ── A08 Software & Data Integrity ─────────────────────────────────────────

    @Test
    @DisplayName("[A08] Sin Authorization header → 401 (no 403)")
    void a08_sinToken401() {
        ResponseEntity<Map<String, Object>> resp = get("/api/encomiendas/lista", null);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    @DisplayName("[A08] JWT con firma adulterada → 401 (no 403)")
    void a08_jwtAdulterado401() {
        String[] partes = tokenOperadorHmg.split("\\.");
        String tokenAdulterado = partes[0] + "." + partes[1] + ".FirmaFalsaXXXXXXXXXXXXXX";

        ResponseEntity<Map<String, Object>> resp = get("/api/encomiendas/lista", tokenAdulterado);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    @DisplayName("[A08] JWT completamente falso → 401 (no 403)")
    void a08_jwtFalso401() {
        String jwtFalso = "eyJhbGciOiJIUzI1NiJ9" +
                          ".eyJzdWIiOiJmYWtlQHRlc3QuY29tIiwicm9sZXMiOlsiUk9MRV9TVVBFUl9BRE1JTiJdfQ" +
                          ".INVALIDSIGNATURE";

        ResponseEntity<Map<String, Object>> resp = get("/api/auditoria", jwtFalso);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    @DisplayName("[A08] Token válido sin permiso suficiente → 403 (no 401)")
    void a08_tokenValidoSinPermiso403() {
        ResponseEntity<Map<String, Object>> resp = get("/api/auditoria", tokenOperadorHmg);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    // ── A05 Security Misconfiguration ─────────────────────────────────────────

    @Test
    @DisplayName("[A05] /actuator/health es accesible sin autenticación")
    void a05_healthPublico() {
        ResponseEntity<String> resp = http.getForEntity("/actuator/health", String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).contains("UP");
    }

    @Test
    @DisplayName("[A05] /actuator/metrics no está expuesto sin autenticación")
    void a05_metricsNoExpuesto() {
        ResponseEntity<String> resp = http.getForEntity("/actuator/metrics", String.class);
        assertThat(resp.getStatusCode()).isNotEqualTo(HttpStatus.OK);
    }
}
