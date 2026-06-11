-- Agrega updated_at a temporadas para trazabilidad de cambios.
-- Safe to run multiple times (IF NOT EXISTS).
ALTER TABLE temporadas
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE temporadas SET updated_at = created_at WHERE updated_at IS NULL;
