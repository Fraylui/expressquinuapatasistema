-- V6: cuota fija que paga cada combi por salida (requerimiento del cliente).
-- Se registra como ingreso CUOTA_SALIDA_COMBI al confirmar la salida del viaje.
-- Safe to run multiple times (IF NOT EXISTS).
ALTER TABLE empresa_config
    ADD COLUMN IF NOT EXISTS cuota_salida_combi NUMERIC(8,2) NOT NULL DEFAULT 0;
