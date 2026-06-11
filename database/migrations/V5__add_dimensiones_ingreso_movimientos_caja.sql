-- V5: dimensiones de ingreso en movimientos_caja para separar la contabilidad
-- por tipo de servicio (pasajes/encomiendas/externas), tipo de vehículo
-- (combi/camioneta), viaje y conductor.
-- Safe to run multiple times (IF NOT EXISTS / categoria_ingreso IS NULL).

ALTER TABLE movimientos_caja ADD COLUMN IF NOT EXISTS categoria_ingreso VARCHAR(30);
ALTER TABLE movimientos_caja ADD COLUMN IF NOT EXISTS viaje_id BIGINT;
ALTER TABLE movimientos_caja ADD COLUMN IF NOT EXISTS vehiculo_id BIGINT;
ALTER TABLE movimientos_caja ADD COLUMN IF NOT EXISTS tipo_vehiculo VARCHAR(20);
ALTER TABLE movimientos_caja ADD COLUMN IF NOT EXISTS conductor_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_mov_caja_categoria ON movimientos_caja(categoria_ingreso);
CREATE INDEX IF NOT EXISTS idx_mov_caja_tipo_veh  ON movimientos_caja(tipo_vehiculo);
CREATE INDEX IF NOT EXISTS idx_mov_caja_viaje     ON movimientos_caja(viaje_id);

-- ── Backfill histórico ──────────────────────────────────────────────────────

-- Pasajes: dimensiones completas vía pasajes → viajes → vehiculos
UPDATE movimientos_caja mc SET
    viaje_id          = v.id,
    vehiculo_id       = v.vehiculo_id,
    tipo_vehiculo     = veh.tipo,
    conductor_id      = v.conductor_id,
    categoria_ingreso = 'PASAJE_' || veh.tipo
FROM pasajes p
JOIN viajes v     ON v.id = p.viaje_id
JOIN vehiculos veh ON veh.id = v.vehiculo_id
WHERE mc.referencia_tipo = 'PASAJE'
  AND mc.referencia_id   = p.id
  AND mc.categoria_ingreso IS NULL;

-- Encomiendas propias (cobro en origen y pago en destino)
UPDATE movimientos_caja mc SET
    viaje_id          = e.viaje_id,
    vehiculo_id       = v.vehiculo_id,
    tipo_vehiculo     = veh.tipo,
    conductor_id      = v.conductor_id,
    categoria_ingreso = CASE WHEN mc.referencia_tipo = 'PAGO_DESTINO'
                             THEN 'ENC_PAGO_DESTINO' ELSE 'ENCOMIENDA' END
FROM encomiendas e
LEFT JOIN viajes v     ON v.id = e.viaje_id
LEFT JOIN vehiculos veh ON veh.id = v.vehiculo_id
WHERE mc.referencia_tipo IN ('ENCOMIENDA', 'PAGO_DESTINO')
  AND mc.referencia_id   = e.id
  AND mc.categoria_ingreso IS NULL;

-- Encomiendas externas (de conductores terceros)
UPDATE movimientos_caja
SET categoria_ingreso = 'ENC_EXTERNA'
WHERE referencia_tipo = 'ENC_EXTERNA'
  AND categoria_ingreso IS NULL;

-- Resto de ingresos manuales sin referencia
UPDATE movimientos_caja
SET categoria_ingreso = 'OTRO'
WHERE tipo = 'INGRESO'
  AND categoria_ingreso IS NULL;
