-- V11: Flota (vehículos y conductores) a nivel empresa + vínculo conductor-usuario
-- + fixes del módulo viajes.
--
-- 1) Vehículos y conductores pertenecen a la empresa, no a una agencia:
--    agencia_id pasa a ser opcional. El gerente los registra sin agencia
--    y todas las agencias los ven.
-- 2) usuarios.agencia_id pasa a opcional: GERENTE y CONDUCTOR trabajan con
--    todas las agencias (los roles ADMIN_AGENCIA y OPERADOR siguen exigiendo
--    agencia a nivel de aplicación).
-- 3) conductores.usuario_id: vínculo explícito con la cuenta de login del
--    conductor (antes solo se adivinaba por DNI).
-- 4) vehiculos.conductor_habitual_id: conductor al que la empresa le entregó
--    el vehículo. Al programar un viaje se preselecciona, pero puede cambiarse.
-- 5) El CHECK de viajes.estado no permitía 'ATRASADO' aunque el scheduler lo
--    asigna cada 5 minutos: se recrea incluyéndolo.

ALTER TABLE vehiculos   ALTER COLUMN agencia_id DROP NOT NULL;
ALTER TABLE conductores ALTER COLUMN agencia_id DROP NOT NULL;
ALTER TABLE usuarios    ALTER COLUMN agencia_id DROP NOT NULL;

ALTER TABLE conductores
    ADD COLUMN IF NOT EXISTS usuario_id BIGINT UNIQUE REFERENCES usuarios(id);

-- Backfill: vincular conductores existentes con su cuenta por DNI
UPDATE conductores c
SET    usuario_id = u.id
FROM   usuarios u
WHERE  u.dni = c.dni
  AND  c.usuario_id IS NULL;

ALTER TABLE vehiculos
    ADD COLUMN IF NOT EXISTS conductor_habitual_id BIGINT REFERENCES conductores(id);

ALTER TABLE viajes DROP CONSTRAINT IF EXISTS viajes_estado_check;
ALTER TABLE viajes ADD CONSTRAINT viajes_estado_check
    CHECK (estado IN ('PROGRAMADO','ATRASADO','EN_RUTA','COMPLETADO','CANCELADO'));
