-- V7: la empresa solo opera COMBI y CAMIONETA — restringir los CHECK de tipo
-- de vehículo en vehiculos y tarifas (antes permitían BUS y MINIVAN).
-- Safe to run multiple times (DROP IF EXISTS + re-ADD).

ALTER TABLE vehiculos DROP CONSTRAINT IF EXISTS vehiculos_tipo_check;
ALTER TABLE vehiculos ADD CONSTRAINT vehiculos_tipo_check
    CHECK (tipo IN ('COMBI', 'CAMIONETA'));

ALTER TABLE tarifas DROP CONSTRAINT IF EXISTS tarifas_tipo_vehiculo_check;
ALTER TABLE tarifas ADD CONSTRAINT tarifas_tipo_vehiculo_check
    CHECK (tipo_vehiculo IN ('COMBI', 'CAMIONETA'));
