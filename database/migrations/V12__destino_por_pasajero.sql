-- V12: Destino por pasajero dentro del mismo viaje
--
-- Un viaje recorre el corredor completo (Huamanga -> Palmapampa) y cubre a
-- todos los clientes: cada pasajero escoge SU destino (San Francisco,
-- Kimbiri, ...) y paga LA TARIFA de esa ruta (el precio siempre sale del
-- catalogo de tarifas, nunca es manual). La boleta imprime su destino.
-- El asiento se ocupa el viaje completo: al bajar en una agencia intermedia
-- NO se revende (decision del negocio).
--
-- destino NULL = pasajero va al destino final de la ruta del viaje
-- (compatible con todos los pasajes existentes).

ALTER TABLE pasajes ADD COLUMN IF NOT EXISTS destino VARCHAR(80);
