-- Agrega columnas de seguridad de autenticación a usuarios.
-- Pre-existentes en la entidad pero faltaban en el esquema inicial.
ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS intentos_fallidos INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS bloqueado_hasta   TIMESTAMPTZ;
