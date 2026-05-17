-- Seed mínimo para tests de integración
-- Contraseñas: TestPass123! (hash BCrypt cost=6, sin pgcrypto)
-- Hash 1 (SUPER_ADMIN/GERENTE/OPERADOR-agencia1): $2a$06$MMfCuD090hDcRUMWAfWh0uhYLTG0ZReseFSK5xTr7jieMr9oLzmRu
-- Hash 2 (OPERADOR-agencia2): $2a$06$QqxHDsaKQPpPL2hcZjdSvOrFLKGu0HM7VlGA8PWS7767eiQz390Gi

-- Agencias
INSERT INTO agencias (id, codigo, nombre, ciudad, departamento, activo, created_at, updated_at)
VALUES
  (1, 'HMG', 'Huamanga Central', 'Huamanga', 'Ayacucho', true, NOW(), NOW()),
  (2, 'KMB', 'Kimbiri',          'Kimbiri',  'Cusco',    true, NOW(), NOW());

-- Roles Spring Security
INSERT INTO roles (id, nombre, descripcion, activo) VALUES
  (1, 'SUPER_ADMIN', 'Administrador total', true),
  (2, 'GERENTE',     'Gerente',             true),
  (3, 'OPERADOR',    'Operador de agencia', true),
  (4, 'CONDUCTOR',   'Conductor',           true);

-- Módulos
INSERT INTO modulos (id, nombre, codigo, descripcion, icono, activo) VALUES
  (1, 'Ventas',         'VENTAS',         'Venta de pasajes',          'Ticket',        true),
  (2, 'Encomiendas',    'ENCOMIENDAS',    'Gestión de encomiendas',    'Package',       true),
  (3, 'Caja',           'CAJA',           'Control de caja',           'DollarSign',    true),
  (4, 'Manifiestos',    'MANIFIESTOS',    'Manifiestos de viaje',      'FileText',      true),
  (5, 'Reportes',       'REPORTES',       'Reportes y estadísticas',   'BarChart',      true),
  (6, 'Usuarios',       'USUARIOS',       'Gestión de usuarios',       'Users',         true),
  (7, 'Agencias',       'AGENCIAS',       'Gestión de agencias',       'Building',      true),
  (8, 'Configuración',  'CONFIGURACION',  'Configuración del sistema', 'Settings',      true),
  (9, 'Auditoría',      'AUDITORIA',      'Log de auditoría',          'ClipboardList', true);

-- Usuarios de prueba
INSERT INTO usuarios (id, agencia_id, nombres, apellidos, dni, email, telefono, password_hash, rol, activo, created_at, updated_at)
VALUES
  (1, 1, 'Test', 'SuperAdmin',    '00000001', 'superadmin@test.com',  '999000001', '$2a$06$MMfCuD090hDcRUMWAfWh0uhYLTG0ZReseFSK5xTr7jieMr9oLzmRu', 'SUPER_ADMIN', true, NOW(), NOW()),
  (2, 1, 'Test', 'Gerente',       '00000002', 'gerente@test.com',     '999000002', '$2a$06$MMfCuD090hDcRUMWAfWh0uhYLTG0ZReseFSK5xTr7jieMr9oLzmRu', 'GERENTE',     true, NOW(), NOW()),
  (3, 1, 'Test', 'OperadorHMG',   '00000003', 'operador1@test.com',   '999000003', '$2a$06$MMfCuD090hDcRUMWAfWh0uhYLTG0ZReseFSK5xTr7jieMr9oLzmRu', 'OPERADOR',    true, NOW(), NOW()),
  (4, 2, 'Test', 'OperadorKMB',   '00000004', 'operador2@test.com',   '999000004', '$2a$06$QqxHDsaKQPpPL2hcZjdSvOrFLKGu0HM7VlGA8PWS7767eiQz390Gi', 'OPERADOR',    true, NOW(), NOW()),
  (5, 1, 'Test', 'Conductor',     '00000005', 'conductor@test.com',   '999000005', '$2a$06$MMfCuD090hDcRUMWAfWh0uhYLTG0ZReseFSK5xTr7jieMr9oLzmRu', 'CONDUCTOR',   true, NOW(), NOW());

-- Roles Spring Security para cada usuario
INSERT INTO usuario_roles (usuario_id, rol_id) VALUES (1,1),(2,2),(3,3),(4,3),(5,4);

-- Módulos del OPERADOR de Huamanga: VENTAS, ENCOMIENDAS, CAJA
INSERT INTO usuario_modulos (usuario_id, modulo_id, activo, fecha_asignacion, asignado_por)
VALUES
  (3, 1, true, NOW(), 1),
  (3, 2, true, NOW(), 1),
  (3, 3, true, NOW(), 1);

-- Módulos del OPERADOR de Kimbiri: VENTAS, ENCOMIENDAS, CAJA
INSERT INTO usuario_modulos (usuario_id, modulo_id, activo, fecha_asignacion, asignado_por)
VALUES
  (4, 1, true, NOW(), 1),
  (4, 2, true, NOW(), 1),
  (4, 3, true, NOW(), 1);

-- Encomiendas de prueba para test A01 (una por agencia)
INSERT INTO clientes (id, agencia_id, nombres, apellidos, tipo_doc, num_doc, created_at, updated_at)
VALUES
  (1, 1, 'Remitente', 'Huamanga', 'DNI', '11111111', NOW(), NOW()),
  (2, 2, 'Remitente', 'Kimbiri',  'DNI', '22222222', NOW(), NOW());

-- vendedor_id = id del operador que registra (usuario 3 = operador Huamanga)
INSERT INTO encomiendas (id, agencia_id, codigo_tracking, remitente_id, destinatario_id, vendedor_id, descripcion, peso_kg, precio_envio, estado, serie, created_at, updated_at)
VALUES
  (1, 1, 'EXP-TEST-0001', 1, 1, 3, 'Paquete Huamanga',  2.5, 18.00, 'REGISTRADO', 'E001', NOW(), NOW()),
  (2, 2, 'EXP-TEST-0002', 2, 2, 4, 'Paquete Kimbiri',   1.0, 12.00, 'REGISTRADO', 'E001', NOW(), NOW());
