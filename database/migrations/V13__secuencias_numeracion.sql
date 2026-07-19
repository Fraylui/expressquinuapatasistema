-- V13: numeración atómica en BD para boletas (por agencia+año) y rendiciones.
-- Reemplaza el contador en memoria (AtomicLong) que duplicaba códigos tras
-- reinicios y el count()+1 de REN con riesgo de colisión.

-- 1) Tabla de secuencias: una fila por (tipo, agencia, año).
--    El incremento se hace con INSERT .. ON CONFLICT .. RETURNING (atómico).
CREATE TABLE IF NOT EXISTS secuencias (
    tipo       VARCHAR(20) NOT NULL,
    agencia_id BIGINT      NOT NULL DEFAULT 0,   -- 0 = secuencia global (REN)
    anio       INT         NOT NULL,
    ultimo     BIGINT      NOT NULL DEFAULT 0,
    PRIMARY KEY (tipo, agencia_id, anio)
);

-- 2) Semilla REN desde lo ya emitido (formato REN-YYYY-NNNNN, global)
INSERT INTO secuencias (tipo, agencia_id, anio, ultimo)
SELECT 'REN', 0, split_part(numero, '-', 2)::int, MAX(split_part(numero, '-', 3)::bigint)
FROM entregas_efectivo
WHERE numero ~ '^REN-[0-9]{4}-[0-9]+$'
GROUP BY split_part(numero, '-', 2)::int
ON CONFLICT (tipo, agencia_id, anio) DO NOTHING;
-- (VTA no necesita semilla: el formato nuevo incluye el código de agencia,
--  así que no puede chocar con los códigos históricos VTA-YYYY-NNNNN)

-- 3) Renombrar boletas duplicadas históricas (conserva la más antigua intacta)
UPDATE pasajes p SET codigo_boleta = p.codigo_boleta || '-D' || p.id
FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY codigo_boleta ORDER BY id) AS rn
    FROM pasajes
) d
WHERE d.id = p.id AND d.rn > 1;

-- 4) El código nuevo incluye el código de agencia (VTA-SEDE-HMG-2026-00001)
--    y no cabe en VARCHAR(20)
ALTER TABLE pasajes ALTER COLUMN codigo_boleta TYPE VARCHAR(40);
ALTER TABLE pasajes ALTER COLUMN codigo_pasaje TYPE VARCHAR(40);

-- 5) Unicidad real: nunca más dos boletas o dos rendiciones con el mismo número
CREATE UNIQUE INDEX IF NOT EXISTS ux_pasajes_codigo_boleta ON pasajes (codigo_boleta);
CREATE UNIQUE INDEX IF NOT EXISTS ux_entregas_efectivo_numero ON entregas_efectivo (numero);
