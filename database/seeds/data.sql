-- ============================================================
-- Seeds de datos de prueba adicionales
-- Nota: Los datos principales están en schema.sql
-- ============================================================

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
