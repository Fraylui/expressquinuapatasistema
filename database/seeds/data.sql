-- ============================================================
-- Seeds de datos de prueba adicionales
-- Nota: Los datos principales están en schema.sql
-- ============================================================

-- ── Migración: agencias — jerarquía agencia/sucursal ────────────────────────
ALTER TABLE agencias ADD COLUMN IF NOT EXISTS agencia_padre_id BIGINT REFERENCES agencias(id);
ALTER TABLE agencias ADD COLUMN IF NOT EXISTS tipo VARCHAR(10) NOT NULL DEFAULT 'AGENCIA';

DO $$ BEGIN
  ALTER TABLE agencias ADD CONSTRAINT agencias_tipo_chk CHECK (tipo IN ('AGENCIA','SUCURSAL'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Marcar agencias existentes sin padre como AGENCIA
UPDATE agencias SET tipo = 'AGENCIA' WHERE agencia_padre_id IS NULL AND tipo = 'AGENCIA';

-- Sucursales de prueba
INSERT INTO agencias (codigo, nombre, ciudad, direccion, telefono, estado, tipo, agencia_padre_id)
SELECT 'HUA-SUC-01', 'Sucursal Huamanga Terminal', 'Ayacucho', 'Terminal Terrestre Libertadores', '066-312457', 'ACTIVA', 'SUCURSAL', id
FROM agencias WHERE codigo = 'AYA-01'
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO agencias (codigo, nombre, ciudad, direccion, telefono, estado, tipo, agencia_padre_id)
SELECT 'KIM-SUC-01', 'Sucursal Kimbiri Mercado', 'Kimbiri', 'Mercado Central de Kimbiri', '084-201346', 'ACTIVA', 'SUCURSAL', id
FROM agencias WHERE codigo = 'KIM-01'
ON CONFLICT (codigo) DO NOTHING;

-- Migración segura: agrega columnas nuevas a encomiendas si no existen
ALTER TABLE encomiendas ADD COLUMN IF NOT EXISTS agencia_destino_id BIGINT REFERENCES agencias(id);
ALTER TABLE encomiendas ADD COLUMN IF NOT EXISTS tamano VARCHAR(10) CHECK (tamano IN ('PEQUEÑO','MEDIANO','GRANDE'));

-- Viajes adicionales para mañana
INSERT INTO viajes (agencia_id, ruta_id, vehiculo_id, conductor_id, fecha_hora_sal, estado)
SELECT 1, 2, 2, 2, (NOW() + INTERVAL '1 day')::date + TIME '05:30:00', 'PROGRAMADO'
WHERE NOT EXISTS (SELECT 1 FROM viajes WHERE estado = 'PROGRAMADO' LIMIT 1);

-- Asientos para los viajes existentes (si no existen)
DO $$
DECLARE
  v RECORD;
  i INT;
BEGIN
  FOR v IN SELECT id FROM viajes WHERE estado = 'PROGRAMADO' LOOP
    IF NOT EXISTS (SELECT 1 FROM asientos WHERE viaje_id = v.id) THEN
      FOR i IN 1..15 LOOP
        INSERT INTO asientos (agencia_id, viaje_id, numero, estado)
        VALUES (1, v.id, i, 'DISPONIBLE');
      END LOOP;
    END IF;
  END LOOP;
END $$;
