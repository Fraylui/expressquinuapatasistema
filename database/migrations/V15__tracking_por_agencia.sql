-- V15: códigos de encomienda por agencia y año (EXP-{COD_AGENCIA}-YYYY-NNNNN)
-- usando la tabla secuencias de V13. Los códigos antiguos EXP-YYYY-NNNNN siguen
-- siendo válidos para tracking; solo cambia el formato de los nuevos.
ALTER TABLE encomiendas ALTER COLUMN codigo_tracking TYPE VARCHAR(40);
