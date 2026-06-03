package com.expressvraem.shared.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Instala un trigger PostgreSQL que impide UPDATE y DELETE sobre la tabla auditoria,
 * garantizando la inmutabilidad de la pista de auditoría a nivel de base de datos.
 *
 * Se ejecuta una vez al arrancar la aplicación usando SQL idempotente
 * (CREATE OR REPLACE FUNCTION + DROP/CREATE TRIGGER), por lo que es seguro
 * en reinicios y despliegues repetidos.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AuditoriaTriggerConfig {

    private final JdbcTemplate jdbc;

    @EventListener(ApplicationReadyEvent.class)
    public void instalarTriggerInmutabilidad() {
        try {
            // Función que lanza excepción ante cualquier intento de modificación
            jdbc.execute("""
                    CREATE OR REPLACE FUNCTION fn_auditoria_inmutable()
                    RETURNS trigger AS $$
                    BEGIN
                      RAISE EXCEPTION
                        'AUDIT_IMMUTABLE: Los registros de auditoría no pueden ser modificados ni eliminados.';
                    END;
                    $$ LANGUAGE plpgsql;
                    """);

            // Recrear el trigger de forma idempotente
            jdbc.execute("DROP TRIGGER IF EXISTS trg_auditoria_inmutable ON auditoria;");

            jdbc.execute("""
                    CREATE TRIGGER trg_auditoria_inmutable
                    BEFORE UPDATE OR DELETE ON auditoria
                    FOR EACH ROW EXECUTE FUNCTION fn_auditoria_inmutable();
                    """);

            log.info("Trigger de inmutabilidad de auditoría instalado correctamente.");
        } catch (Exception e) {
            log.warn("No se pudo instalar el trigger de inmutabilidad (sin impacto operativo): {}", e.getMessage());
        }
    }
}
