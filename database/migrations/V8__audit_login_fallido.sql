-- V8: la auditoría de intentos de login fallidos nunca se guardaba.
-- 1) El CHECK de accion no incluía 'LOGIN_FALLIDO' (la app lo registra desde el inicio).
-- 2) agencia_id NOT NULL impedía auditar intentos sobre emails que no existen
--    (no hay agencia que asignar en ese caso).

ALTER TABLE auditoria DROP CONSTRAINT IF EXISTS auditoria_accion_check;
ALTER TABLE auditoria ADD CONSTRAINT auditoria_accion_check
    CHECK (accion IN ('INSERT','UPDATE','DELETE','LOGIN','LOGOUT','LOGIN_FALLIDO','ACCESS_DENIED'));

ALTER TABLE auditoria ALTER COLUMN agencia_id DROP NOT NULL;
