-- V14: cuota de salida también para camionetas (la de combi ya existía).
-- 0 = deshabilitado; el gerente pone cada monto en Configuración → Empresa.
ALTER TABLE empresa_config
    ADD COLUMN IF NOT EXISTS cuota_salida_camioneta NUMERIC(8,2) DEFAULT 0;
