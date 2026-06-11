-- Agrega updated_at a conductores para trazabilidad de cambios.
-- Safe to run multiple times (IF NOT EXISTS).
ALTER TABLE conductores
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Inicializar updated_at con el valor de created_at en registros existentes
UPDATE conductores SET updated_at = created_at WHERE updated_at IS NULL;
