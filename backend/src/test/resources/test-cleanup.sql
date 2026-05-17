-- Limpieza de tablas antes de cada suite de tests
-- El orden respeta las FK (hijas primero)
TRUNCATE TABLE historial_encomiendas CASCADE;
TRUNCATE TABLE encomiendas          CASCADE;
TRUNCATE TABLE clientes             CASCADE;
TRUNCATE TABLE usuario_modulos      CASCADE;
TRUNCATE TABLE usuario_roles        CASCADE;
TRUNCATE TABLE usuarios             CASCADE;
TRUNCATE TABLE modulos              CASCADE;
TRUNCATE TABLE roles                CASCADE;
TRUNCATE TABLE agencias             CASCADE;
