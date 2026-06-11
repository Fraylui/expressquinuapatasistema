-- Agrega updated_at a rutas para trazabilidad de cambios.
-- Safe to run multiple times (IF NOT EXISTS).
ALTER TABLE rutas
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE rutas SET updated_at = created_at WHERE updated_at IS NULL;
