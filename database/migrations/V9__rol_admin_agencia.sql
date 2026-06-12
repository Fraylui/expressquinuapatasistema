-- V9: el rol ADMIN_AGENCIA existe en backend y frontend (5 roles del sistema)
-- pero el CHECK de usuarios no lo permitía: era imposible crear un jefe de sucursal.

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check
    CHECK (rol IN ('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA','OPERADOR','CONDUCTOR'));
