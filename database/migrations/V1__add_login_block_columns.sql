-- Add login-block tracking columns to existing installations.
-- Safe to run multiple times (IF NOT EXISTS).
ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS intentos_fallidos INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS bloqueado_hasta   TIMESTAMPTZ;
