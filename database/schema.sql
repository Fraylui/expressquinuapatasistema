-- ============================================================
-- SCHEMA PostgreSQL — Express Quinuapata VRAEM SAC
-- Sistema de Transporte Multi-Agencia
-- Versión: 2.0 — 2026-05-13
-- Marcos: OWASP, COSO, COBIT 2019, ISO 27001, ITIL 4
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- LIMPIAR (orden inverso a FK)
-- ============================================================
DROP TABLE IF EXISTS usuario_modulos CASCADE;
DROP TABLE IF EXISTS modulos CASCADE;
DROP TABLE IF EXISTS auditoria CASCADE;
DROP TABLE IF EXISTS manifiestos CASCADE;
DROP TABLE IF EXISTS movimientos_caja CASCADE;
DROP TABLE IF EXISTS caja CASCADE;
DROP TABLE IF EXISTS historial_encomiendas CASCADE;
DROP TABLE IF EXISTS encomiendas CASCADE;
DROP TABLE IF EXISTS descuentos CASCADE;
DROP TABLE IF EXISTS pasajes CASCADE;
DROP TABLE IF EXISTS clientes CASCADE;
DROP TABLE IF EXISTS asientos CASCADE;
DROP TABLE IF EXISTS viajes CASCADE;
DROP TABLE IF EXISTS tarifas CASCADE;
DROP TABLE IF EXISTS temporadas CASCADE;
DROP TABLE IF EXISTS rutas CASCADE;
DROP TABLE IF EXISTS conductores CASCADE;
DROP TABLE IF EXISTS vehiculos CASCADE;
DROP TABLE IF EXISTS rol_permisos CASCADE;
DROP TABLE IF EXISTS permisos CASCADE;
DROP TABLE IF EXISTS usuario_roles CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS agencias CASCADE;

-- ============================================================
-- 1. AGENCIAS
-- ============================================================
CREATE TABLE agencias (
    id              BIGSERIAL PRIMARY KEY,
    codigo          VARCHAR(10)  NOT NULL UNIQUE,
    nombre          VARCHAR(120) NOT NULL,
    direccion       VARCHAR(200),
    ciudad          VARCHAR(80),
    departamento    VARCHAR(80),
    telefono        VARCHAR(20),
    email           VARCHAR(100),
    ruc             VARCHAR(11),
    activo          BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. ROLES (4 roles globales — COBIT APO01)
-- ============================================================
CREATE TABLE roles (
    id          BIGSERIAL PRIMARY KEY,
    nombre      VARCHAR(60)  NOT NULL UNIQUE,
    descripcion VARCHAR(200),
    activo      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. USUARIOS (rol directo + agencia — ISO 27001 A.9.2)
-- ============================================================
CREATE TABLE usuarios (
    id               BIGSERIAL PRIMARY KEY,
    agencia_id       BIGINT       NOT NULL REFERENCES agencias(id),
    nombres          VARCHAR(80)  NOT NULL,
    apellidos        VARCHAR(80)  NOT NULL,
    dni              VARCHAR(8)   NOT NULL UNIQUE,
    email            VARCHAR(100) UNIQUE,
    telefono         VARCHAR(20),
    password_hash    TEXT         NOT NULL,
    rol              VARCHAR(20)  NOT NULL DEFAULT 'OPERADOR'
                         CHECK (rol IN ('SUPER_ADMIN','GERENTE','OPERADOR','CONDUCTOR')),
    activo           BOOLEAN      NOT NULL DEFAULT TRUE,
    ultimo_acceso    TIMESTAMPTZ,
    ip_ultimo_acceso VARCHAR(45),
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. USUARIO_ROLES (mantiene compatibilidad con Spring Security)
-- ============================================================
CREATE TABLE usuario_roles (
    id          BIGSERIAL PRIMARY KEY,
    usuario_id  BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    rol_id      BIGINT NOT NULL REFERENCES roles(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (usuario_id, rol_id)
);

-- ============================================================
-- 5. MÓDULOS (permisos granulares — COBIT APO01.03)
-- ============================================================
CREATE TABLE modulos (
    id          BIGSERIAL PRIMARY KEY,
    nombre      VARCHAR(60)  NOT NULL,
    codigo      VARCHAR(30)  NOT NULL UNIQUE,
    descripcion VARCHAR(200),
    icono       VARCHAR(40),
    activo      BOOLEAN      NOT NULL DEFAULT TRUE
);

-- ============================================================
-- 6. USUARIO_MODULOS (asignación granular — COSO Control Activities)
-- ============================================================
CREATE TABLE usuario_modulos (
    id               BIGSERIAL PRIMARY KEY,
    usuario_id       BIGINT      NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    modulo_id        BIGINT      NOT NULL REFERENCES modulos(id),
    activo           BOOLEAN     NOT NULL DEFAULT TRUE,
    fecha_asignacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    asignado_por     BIGINT      REFERENCES usuarios(id),
    UNIQUE (usuario_id, modulo_id)
);

-- ============================================================
-- 7. PERMISOS (granulares — compatibilidad)
-- ============================================================
CREATE TABLE permisos (
    id          BIGSERIAL PRIMARY KEY,
    codigo      VARCHAR(60)  NOT NULL UNIQUE,
    modulo      VARCHAR(60)  NOT NULL,
    accion      VARCHAR(60)  NOT NULL,
    descripcion VARCHAR(200)
);

-- ============================================================
-- 8. ROL_PERMISOS
-- ============================================================
CREATE TABLE rol_permisos (
    id          BIGSERIAL PRIMARY KEY,
    rol_id      BIGINT NOT NULL REFERENCES roles(id),
    permiso_id  BIGINT NOT NULL REFERENCES permisos(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (rol_id, permiso_id)
);

-- ============================================================
-- 9. VEHICULOS
-- ============================================================
CREATE TABLE vehiculos (
    id              BIGSERIAL PRIMARY KEY,
    agencia_id      BIGINT       NOT NULL REFERENCES agencias(id),
    placa           VARCHAR(10)  NOT NULL UNIQUE,
    tipo            VARCHAR(20)  NOT NULL CHECK (tipo IN ('COMBI','CAMIONETA','BUS','MINIVAN')),
    marca           VARCHAR(50),
    modelo          VARCHAR(50),
    anio            INT,
    capacidad       INT          NOT NULL,
    color           VARCHAR(30),
    num_asientos    INT          NOT NULL,
    estado          VARCHAR(20)  NOT NULL DEFAULT 'OPERATIVO'
                        CHECK (estado IN ('OPERATIVO','MANTENIMIENTO','BAJA')),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 10. CONDUCTORES
-- ============================================================
CREATE TABLE conductores (
    id              BIGSERIAL PRIMARY KEY,
    agencia_id      BIGINT       NOT NULL REFERENCES agencias(id),
    nombres         VARCHAR(80)  NOT NULL,
    apellidos       VARCHAR(80)  NOT NULL,
    dni             VARCHAR(8)   NOT NULL UNIQUE,
    licencia        VARCHAR(20)  NOT NULL UNIQUE,
    categoria_lic   VARCHAR(10),
    telefono        VARCHAR(20),
    email           VARCHAR(100),
    fecha_venc_lic  DATE,
    activo          BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 11. RUTAS
-- ============================================================
CREATE TABLE rutas (
    id              BIGSERIAL PRIMARY KEY,
    agencia_id      BIGINT       NOT NULL REFERENCES agencias(id),
    codigo          VARCHAR(10)  NOT NULL UNIQUE,
    origen          VARCHAR(80)  NOT NULL,
    destino         VARCHAR(80)  NOT NULL,
    distancia_km    NUMERIC(8,2),
    duracion_min    INT,
    activo          BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 12. TEMPORADAS
-- ============================================================
CREATE TABLE temporadas (
    id          BIGSERIAL PRIMARY KEY,
    agencia_id  BIGINT       NOT NULL REFERENCES agencias(id),
    nombre      VARCHAR(60)  NOT NULL,
    fecha_ini   DATE         NOT NULL,
    fecha_fin   DATE         NOT NULL,
    activo      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 13. TARIFAS
-- ============================================================
CREATE TABLE tarifas (
    id              BIGSERIAL PRIMARY KEY,
    agencia_id      BIGINT          NOT NULL REFERENCES agencias(id),
    ruta_id         BIGINT          NOT NULL REFERENCES rutas(id),
    temporada_id    BIGINT          REFERENCES temporadas(id),
    tipo_vehiculo   VARCHAR(20)     NOT NULL CHECK (tipo_vehiculo IN ('COMBI','CAMIONETA','BUS','MINIVAN')),
    precio          NUMERIC(8,2)    NOT NULL,
    vigente         BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 14. VIAJES
-- ============================================================
CREATE TABLE viajes (
    id              BIGSERIAL PRIMARY KEY,
    agencia_id      BIGINT       NOT NULL REFERENCES agencias(id),
    ruta_id         BIGINT       NOT NULL REFERENCES rutas(id),
    vehiculo_id     BIGINT       NOT NULL REFERENCES vehiculos(id),
    conductor_id    BIGINT       NOT NULL REFERENCES conductores(id),
    fecha_hora_sal  TIMESTAMPTZ  NOT NULL,
    fecha_hora_arr  TIMESTAMPTZ,
    estado          VARCHAR(20)  NOT NULL DEFAULT 'PROGRAMADO'
                        CHECK (estado IN ('PROGRAMADO','EN_RUTA','COMPLETADO','CANCELADO')),
    observaciones   TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 15. ASIENTOS
-- ============================================================
CREATE TABLE asientos (
    id          BIGSERIAL PRIMARY KEY,
    agencia_id  BIGINT      NOT NULL REFERENCES agencias(id),
    viaje_id    BIGINT      NOT NULL REFERENCES viajes(id),
    numero      INT         NOT NULL,
    estado      VARCHAR(20) NOT NULL DEFAULT 'DISPONIBLE'
                    CHECK (estado IN ('DISPONIBLE','RESERVADO','VENDIDO','BLOQUEADO')),
    UNIQUE (viaje_id, numero)
);

-- ============================================================
-- 16. CLIENTES
-- ============================================================
CREATE TABLE clientes (
    id              BIGSERIAL PRIMARY KEY,
    agencia_id      BIGINT       NOT NULL REFERENCES agencias(id),
    nombres         VARCHAR(80)  NOT NULL,
    apellidos       VARCHAR(80)  NOT NULL,
    tipo_doc        VARCHAR(10)  NOT NULL DEFAULT 'DNI'
                        CHECK (tipo_doc IN ('DNI','CE','PASAPORTE','RUC')),
    num_doc         VARCHAR(20)  NOT NULL,
    telefono        VARCHAR(20),
    email           VARCHAR(100),
    fecha_nac       DATE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (tipo_doc, num_doc)
);

-- ============================================================
-- 17. DESCUENTOS
-- ============================================================
CREATE TABLE descuentos (
    id              BIGSERIAL PRIMARY KEY,
    agencia_id      BIGINT          NOT NULL REFERENCES agencias(id),
    nombre          VARCHAR(60)     NOT NULL,
    tipo            VARCHAR(20)     NOT NULL CHECK (tipo IN ('PORCENTAJE','MONTO_FIJO')),
    valor           NUMERIC(8,2)    NOT NULL,
    descripcion     VARCHAR(200),
    activo          BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 18. PASAJES
-- ============================================================
CREATE TABLE pasajes (
    id              BIGSERIAL PRIMARY KEY,
    agencia_id      BIGINT          NOT NULL REFERENCES agencias(id),
    viaje_id        BIGINT          NOT NULL REFERENCES viajes(id),
    asiento_id      BIGINT          NOT NULL REFERENCES asientos(id),
    cliente_id      BIGINT          NOT NULL REFERENCES clientes(id),
    tarifa_id       BIGINT          NOT NULL REFERENCES tarifas(id),
    descuento_id    BIGINT          REFERENCES descuentos(id),
    vendedor_id     BIGINT          NOT NULL REFERENCES usuarios(id),
    precio_base     NUMERIC(8,2)    NOT NULL,
    monto_descuento NUMERIC(8,2)    NOT NULL DEFAULT 0,
    precio_final    NUMERIC(8,2)    NOT NULL,
    forma_pago      VARCHAR(20)     NOT NULL DEFAULT 'EFECTIVO',
    estado          VARCHAR(20)     NOT NULL DEFAULT 'EMITIDO'
                        CHECK (estado IN ('EMITIDO','CONFIRMADO','ANULADO','USADO')),
    codigo_pasaje   VARCHAR(20),
    serie           VARCHAR(5),
    correlativo     VARCHAR(10),
    fecha_emision   TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 19. ENCOMIENDAS
-- ============================================================
CREATE TABLE encomiendas (
    id                  BIGSERIAL PRIMARY KEY,
    agencia_id          BIGINT          NOT NULL REFERENCES agencias(id),
    codigo_tracking     VARCHAR(30)     UNIQUE,
    viaje_id            BIGINT          REFERENCES viajes(id),
    remitente_id        BIGINT          NOT NULL REFERENCES clientes(id),
    destinatario_id     BIGINT          NOT NULL REFERENCES clientes(id),
    vendedor_id         BIGINT          NOT NULL REFERENCES usuarios(id),
    agencia_destino_id  BIGINT          REFERENCES agencias(id),
    descripcion         TEXT            NOT NULL,
    tamano              VARCHAR(10)     CHECK (tamano IN ('PEQUEÑO','MEDIANO','GRANDE')),
    peso_kg             NUMERIC(8,3),
    volumen_m3          NUMERIC(8,4),
    precio_envio        NUMERIC(8,2)    NOT NULL,
    estado              VARCHAR(20)     NOT NULL DEFAULT 'REGISTRADO'
                            CHECK (estado IN (
                                'REGISTRADO','RECOGIDO','EN_TERMINAL','EN_TRANSITO',
                                'EN_DESTINO','LISTO_ENTREGA','ENTREGADO',
                                'DEVUELTO','PERDIDO','SINIESTRADO'
                            )),
    serie               VARCHAR(5),
    correlativo         VARCHAR(10),
    fecha_registro      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    fecha_entrega_est   DATE,
    fecha_entrega_real  TIMESTAMPTZ,
    observaciones       TEXT,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 20. HISTORIAL_ENCOMIENDAS (ISO 27001 A.12.4 — trazabilidad)
-- ============================================================
CREATE TABLE historial_encomiendas (
    id              BIGSERIAL PRIMARY KEY,
    agencia_id      BIGINT      NOT NULL REFERENCES agencias(id),
    encomienda_id   BIGINT      NOT NULL REFERENCES encomiendas(id),
    usuario_id      BIGINT      NOT NULL REFERENCES usuarios(id),
    estado_anterior VARCHAR(20),
    estado_nuevo    VARCHAR(20) NOT NULL,
    observacion     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 21. CAJA (COSO — control de efectivo)
-- ============================================================
CREATE TABLE caja (
    id              BIGSERIAL PRIMARY KEY,
    agencia_id      BIGINT          NOT NULL REFERENCES agencias(id),
    usuario_id      BIGINT          NOT NULL REFERENCES usuarios(id),
    fecha_apertura  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    fecha_cierre    TIMESTAMPTZ,
    monto_apertura  NUMERIC(10,2)   NOT NULL DEFAULT 0,
    total_ingresos  NUMERIC(10,2)   NOT NULL DEFAULT 0,
    total_egresos   NUMERIC(10,2)   NOT NULL DEFAULT 0,
    monto_cierre    NUMERIC(10,2),
    diferencia      NUMERIC(10,2),
    estado          VARCHAR(20)     NOT NULL DEFAULT 'ABIERTA'
                        CHECK (estado IN ('ABIERTA','CERRADA')),
    observaciones   TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 22. MOVIMIENTOS_CAJA
-- ============================================================
CREATE TABLE movimientos_caja (
    id              BIGSERIAL PRIMARY KEY,
    agencia_id      BIGINT          NOT NULL REFERENCES agencias(id),
    caja_id         BIGINT          NOT NULL REFERENCES caja(id),
    usuario_id      BIGINT          NOT NULL REFERENCES usuarios(id),
    tipo            VARCHAR(20)     NOT NULL CHECK (tipo IN ('INGRESO','EGRESO')),
    concepto        VARCHAR(100)    NOT NULL,
    monto           NUMERIC(10,2)   NOT NULL,
    saldo_acumulado NUMERIC(10,2),
    referencia_tipo VARCHAR(30),
    referencia_id   BIGINT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 23. MANIFIESTOS (ITIL 4 — documento legal obligatorio Perú)
-- ============================================================
CREATE TABLE manifiestos (
    id                BIGSERIAL PRIMARY KEY,
    agencia_id        BIGINT      NOT NULL REFERENCES agencias(id),
    viaje_id          BIGINT      NOT NULL REFERENCES viajes(id),
    generado_por      BIGINT      NOT NULL REFERENCES usuarios(id),
    numero            VARCHAR(20) NOT NULL UNIQUE,
    estado            VARCHAR(20) NOT NULL DEFAULT 'BORRADOR'
                          CHECK (estado IN ('BORRADOR','EMITIDO','ENVIADO')),
    total_pasajeros   INT         NOT NULL DEFAULT 0,
    total_encomiendas INT         NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 24. AUDITORIA (ISO 27001 A.12.4 — COBIT MEA02 — solo SUPER_ADMIN)
-- ============================================================
CREATE TABLE auditoria (
    id              BIGSERIAL PRIMARY KEY,
    agencia_id      BIGINT          NOT NULL REFERENCES agencias(id),
    usuario_id      BIGINT          REFERENCES usuarios(id),
    usuario_nombre  VARCHAR(100),
    accion          VARCHAR(20)     NOT NULL CHECK (accion IN ('INSERT','UPDATE','DELETE','LOGIN','LOGOUT','ACCESS_DENIED')),
    modulo          VARCHAR(60),
    entidad         VARCHAR(60),
    registro_id     BIGINT,
    datos_antes     TEXT,
    datos_despues   TEXT,
    ip_cliente      VARCHAR(45),
    user_agent      VARCHAR(256),
    fecha           TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX idx_usuarios_agencia       ON usuarios(agencia_id);
CREATE INDEX idx_usuarios_rol           ON usuarios(rol);
CREATE INDEX idx_usuario_modulos_user   ON usuario_modulos(usuario_id);
CREATE INDEX idx_vehiculos_agencia      ON vehiculos(agencia_id);
CREATE INDEX idx_conductores_agencia    ON conductores(agencia_id);
CREATE INDEX idx_rutas_agencia          ON rutas(agencia_id);
CREATE INDEX idx_viajes_agencia         ON viajes(agencia_id);
CREATE INDEX idx_viajes_fecha           ON viajes(fecha_hora_sal);
CREATE INDEX idx_viajes_ruta            ON viajes(ruta_id);
CREATE INDEX idx_viajes_estado          ON viajes(estado);
CREATE INDEX idx_asientos_viaje         ON asientos(viaje_id);
CREATE INDEX idx_pasajes_viaje          ON pasajes(viaje_id);
CREATE INDEX idx_pasajes_cliente        ON pasajes(cliente_id);
CREATE INDEX idx_pasajes_estado         ON pasajes(estado);
CREATE INDEX idx_encomiendas_viaje      ON encomiendas(viaje_id);
CREATE INDEX idx_encomiendas_estado     ON encomiendas(estado);
CREATE INDEX idx_encomiendas_tracking   ON encomiendas(codigo_tracking);
CREATE INDEX idx_encomiendas_remitente  ON encomiendas(remitente_id);
CREATE INDEX idx_movimientos_caja_caja  ON movimientos_caja(caja_id);
CREATE INDEX idx_auditoria_fecha        ON auditoria(agencia_id, fecha);
CREATE INDEX idx_clientes_doc           ON clientes(tipo_doc, num_doc);

-- ============================================================
-- ============================================================
-- DATOS DE PRUEBA
-- ============================================================
-- ============================================================

-- ============================================================
-- AGENCIAS (3 sedes VRAEM)
-- ============================================================
INSERT INTO agencias (codigo, nombre, direccion, ciudad, departamento, telefono, email, ruc) VALUES
('AYA-01', 'Express Quinuapata VRAEM SAC — Huamanga',  'Jr. Lima 245, Mercado Andrés F. Vivanco', 'Ayacucho',  'Ayacucho', '066-312456', 'huamanga@quinuapata.com', '20601234567'),
('KIM-01', 'Express Quinuapata VRAEM SAC — Kimbiri',   'Av. Perú 180, Plaza Principal',          'Kimbiri',   'Cusco',    '084-201345', 'kimbiri@quinuapata.com',  '20601234567'),
('PIC-01', 'Express Quinuapata VRAEM SAC — Pichari',   'Jr. Ayacucho 90, frente al mercado',     'Pichari',   'Cusco',    '084-301456', 'pichari@quinuapata.com',  '20601234567');

-- ============================================================
-- ROLES (4 globales — COBIT APO01.02)
-- ============================================================
INSERT INTO roles (nombre, descripcion) VALUES
('SUPER_ADMIN', 'Control total absoluto del sistema. Único. No se puede desactivar.'),
('GERENTE',     'Acceso completo a operaciones y gestión. Ve todas las agencias.'),
('OPERADOR',    'Trabajador de agencia. Ve solo datos de su agencia asignada.'),
('CONDUCTOR',   'Solo lectura: sus viajes, pasajeros y encomiendas a cargo.');

-- ============================================================
-- MÓDULOS (9 módulos granulares — COSO Control Activities)
-- ============================================================
INSERT INTO modulos (nombre, codigo, descripcion, icono) VALUES
('Ventas',         'VENTAS',        'Vender y anular pasajes',                            'Ticket'),
('Encomiendas',    'ENCOMIENDAS',   'Registrar, cambiar estado y entregar encomiendas',   'Package'),
('Caja',           'CAJA',          'Abrir turno, movimientos y cierre de caja',          'DollarSign'),
('Manifiestos',    'MANIFIESTOS',   'Generar e imprimir manifiestos de pasajeros y carga','FileText'),
('Reportes',       'REPORTES',      'Ver y exportar reportes del negocio',                'BarChart2'),
('Usuarios',       'USUARIOS',      'Crear y gestionar usuarios de la empresa',           'Users'),
('Agencias',       'AGENCIAS',      'Ver y configurar agencias',                          'Building2'),
('Configuración',  'CONFIGURACION', 'Rutas, tarifas, vehículos y temporadas',             'Settings'),
('Auditoría',      'AUDITORIA',     'Auditoría técnica del sistema. Solo SUPER_ADMIN.',   'ClipboardList');

-- ============================================================
-- USUARIOS
-- Orden: 1=superadmin, 2=maria(mantiene id=2 para refs de datos),
--        3=carlos, 4=kevin, 5=juan(conductor), 6=rosa
-- Contraseñas: SuperAdmin2026!, Quinuapata2026!, Quinuapata2024!
-- ============================================================
INSERT INTO usuarios (agencia_id, nombres, apellidos, dni, email, telefono, password_hash, rol) VALUES
(1, 'Super',   'Admin Sistema',  '00000001', 'superadmin@expressvraem.com',    '000000000', crypt('SuperAdmin2026!',  gen_salt('bf')), 'SUPER_ADMIN'),
(1, 'María',   'Ccencho López',  '34567890', 'maria.ccencho@quinuapata.com',   '955234567', crypt('Quinuapata2024!',  gen_salt('bf')), 'OPERADOR'),
(1, 'Carlos',  'Quispe Huamán',  '23456789', 'carlos.quispe@quinuapata.com',   '966123456', crypt('Quinuapata2024!',  gen_salt('bf')), 'OPERADOR'),
(1, 'Kevin',   'Sandoval Torres','12345678', 'kevin.sandoval@quinuapata.com',  '966000001', crypt('Quinuapata2026!',  gen_salt('bf')), 'GERENTE'),
(1, 'Juan',    'Ccoyllo Ramos',  '99887766', 'juan.ccoyllo@quinuapata.com',    '966002233', crypt('Quinuapata2024!',  gen_salt('bf')), 'CONDUCTOR'),
(2, 'Rosa',    'Sulca Condori',  '56789012', 'rosa.sulca@quinuapata.com',      '933456789', crypt('Quinuapata2024!',  gen_salt('bf')), 'OPERADOR');

-- ============================================================
-- USUARIO_ROLES (Spring Security necesita esta tabla)
-- roles: 1=SUPER_ADMIN, 2=GERENTE, 3=OPERADOR, 4=CONDUCTOR
-- ============================================================
INSERT INTO usuario_roles (usuario_id, rol_id) VALUES
(1, 1),  -- superadmin → SUPER_ADMIN
(2, 3),  -- maria → OPERADOR
(3, 3),  -- carlos → OPERADOR
(4, 2),  -- kevin → GERENTE
(5, 4),  -- juan → CONDUCTOR
(6, 3);  -- rosa → OPERADOR

-- ============================================================
-- MÓDULOS POR USUARIO (COSO — principio de menor privilegio)
-- módulos: 1=VENTAS,2=ENCOMIENDAS,3=CAJA,4=MANIFIESTOS,
--          5=REPORTES,6=USUARIOS,7=AGENCIAS,8=CONFIGURACION,9=AUDITORIA
-- asignado_por = user 1 (superadmin)
-- ============================================================
INSERT INTO usuario_modulos (usuario_id, modulo_id, activo, asignado_por) VALUES
-- superadmin: TODOS los módulos
(1,1,true,1),(1,2,true,1),(1,3,true,1),(1,4,true,1),(1,5,true,1),
(1,6,true,1),(1,7,true,1),(1,8,true,1),(1,9,true,1),
-- maria (OPERADOR Huamanga): VENTAS, ENCOMIENDAS, CAJA
(2,1,true,1),(2,2,true,1),(2,3,true,1),
-- carlos (OPERADOR Huamanga): VENTAS, ENCOMIENDAS, CAJA, MANIFIESTOS
(3,1,true,1),(3,2,true,1),(3,3,true,1),(3,4,true,1),
-- kevin (GERENTE): todos excepto AUDITORIA
(4,1,true,1),(4,2,true,1),(4,3,true,1),(4,4,true,1),(4,5,true,1),
(4,6,true,1),(4,7,true,1),(4,8,true,1),
-- juan (CONDUCTOR): sin módulos — solo lectura viajes propios
-- rosa (OPERADOR Kimbiri): VENTAS, ENCOMIENDAS, CAJA, MANIFIESTOS
(6,1,true,1),(6,2,true,1),(6,3,true,1),(6,4,true,1);

-- ============================================================
-- PERMISOS (compatibilidad — referencia COSO)
-- ============================================================
INSERT INTO permisos (codigo, modulo, accion, descripcion) VALUES
('CREAR_PASAJE',       'VENTAS',      'CREAR',    'Emitir nuevos pasajes'),
('ANULAR_PASAJE',      'VENTAS',      'ANULAR',   'Anular pasajes emitidos'),
('CREAR_ENCOMIENDA',   'ENCOMIENDAS', 'CREAR',    'Registrar encomiendas'),
('ENTREGAR_ENCOMIENDA','ENCOMIENDAS', 'ENTREGAR', 'Marcar encomienda como entregada'),
('ABRIR_CAJA',         'CAJA',        'ABRIR',    'Apertura de caja'),
('CERRAR_CAJA',        'CAJA',        'CERRAR',   'Cierre de caja'),
('VER_REPORTES',       'REPORTES',    'VER',      'Ver reportes del sistema'),
('GESTIONAR_USUARIOS', 'USUARIOS',    'GESTIONAR','Crear y editar usuarios');

-- ============================================================
-- VEHÍCULOS (num_asientos: COMBI=16 → 15 pas; CAMIONETA=5 → 4 pas)
-- ============================================================
INSERT INTO vehiculos (agencia_id, placa, tipo, marca, modelo, anio, capacidad, color, num_asientos) VALUES
(1, 'AYA-456', 'COMBI',     'Toyota',    'Hiace',    2019, 15, 'Blanco', 16),
(1, 'AYA-789', 'COMBI',     'Toyota',    'Hiace',    2021, 15, 'Plata',  16),
(1, 'AYA-321', 'CAMIONETA', 'Toyota',    'Hilux',    2020,  4, 'Negro',   5),
(1, 'AYA-654', 'CAMIONETA', 'Nissan',    'Frontier', 2018,  4, 'Blanco',  5),
(1, 'AYA-987', 'COMBI',     'Mercedes',  'Sprinter', 2022, 15, 'Blanco', 16),
(2, 'KIM-111', 'COMBI',     'Toyota',    'Hiace',    2020, 15, 'Blanco', 16),
(2, 'KIM-222', 'CAMIONETA', 'Toyota',    'Hilux',    2021,  4, 'Gris',    5),
(3, 'PIC-333', 'COMBI',     'Toyota',    'Hiace',    2019, 15, 'Blanco', 16),
(3, 'PIC-444', 'CAMIONETA', 'Mitsubishi','L200',     2020,  4, 'Blanco',  5);

-- ============================================================
-- CONDUCTORES
-- ============================================================
INSERT INTO conductores (agencia_id, nombres, apellidos, dni, licencia, categoria_lic, telefono, fecha_venc_lic) VALUES
(1, 'Ángel',    'Huanca Quispe',  '11223344', 'Q12345678', 'AIIIB', '966001122', '2026-08-15'),
(1, 'Beto',     'Rojas Medina',   '22334455', 'Q23456789', 'AIIIB', '955002233', '2025-11-20'),
(1, 'César',    'Torres Prado',   '33445566', 'Q34567890', 'AIIIB', '944003344', '2027-03-10'),
(2, 'David',    'Meza Guillén',   '44556677', 'Q45678901', 'AIIIB', '933004455', '2026-06-30'),
(2, 'Elsa',     'Noa Ccorimanya', '55667788', 'Q56789012', 'AIIIB', '922005566', '2025-12-05'),
(3, 'Felipe',   'Uribe Tafur',    '66778899', 'Q67890123', 'AIIIB', '911006677', '2026-10-18'),
(3, 'Giovanna', 'Vera Pacheco',   '77889900', 'Q78901234', 'AIIIB', '900007788', '2027-01-25');

-- ============================================================
-- RUTAS
-- ============================================================
INSERT INTO rutas (agencia_id, codigo, origen, destino, distancia_km, duracion_min) VALUES
(1, 'HUA-KIM', 'Huamanga',     'Kimbiri',       280, 300),
(1, 'KIM-HUA', 'Kimbiri',      'Huamanga',      280, 300),
(1, 'HUA-PIC', 'Huamanga',     'Pichari',       275, 290),
(1, 'PIC-HUA', 'Pichari',      'Huamanga',      275, 290),
(1, 'HUA-SFR', 'Huamanga',     'San Francisco', 260, 270),
(1, 'SFR-HUA', 'San Francisco','Huamanga',      260, 270),
(1, 'KIM-PIC', 'Kimbiri',      'Pichari',        18,  25),
(1, 'PIC-KIM', 'Pichari',      'Kimbiri',         18,  25);

-- ============================================================
-- TEMPORADAS
-- ============================================================
INSERT INTO temporadas (agencia_id, nombre, fecha_ini, fecha_fin) VALUES
(1, 'Regular 2026',        '2026-01-01', '2026-06-30'),
(1, 'Fiestas Patrias 2026','2026-07-01', '2026-07-31'),
(1, 'Regular II 2026',     '2026-08-01', '2026-12-31');

-- ============================================================
-- TARIFAS
-- ============================================================
INSERT INTO tarifas (agencia_id, ruta_id, temporada_id, tipo_vehiculo, precio) VALUES
(1,1,1,'COMBI',55.00),(1,1,1,'CAMIONETA',90.00),(1,1,2,'COMBI',70.00),(1,1,2,'CAMIONETA',110.00),
(1,2,1,'COMBI',55.00),(1,2,1,'CAMIONETA',90.00),
(1,3,1,'COMBI',55.00),(1,3,1,'CAMIONETA',90.00),(1,3,2,'COMBI',70.00),(1,3,2,'CAMIONETA',110.00),
(1,4,1,'COMBI',55.00),(1,4,1,'CAMIONETA',90.00),
(1,5,1,'COMBI',50.00),(1,5,1,'CAMIONETA',80.00),(1,5,2,'COMBI',65.00),(1,5,2,'CAMIONETA',100.00),
(1,6,1,'COMBI',50.00),(1,6,1,'CAMIONETA',80.00),
(1,7,1,'COMBI',15.00),(1,7,1,'CAMIONETA',20.00),
(1,8,1,'COMBI',15.00),(1,8,1,'CAMIONETA',20.00);

-- ============================================================
-- VIAJES
-- ============================================================
INSERT INTO viajes (agencia_id, ruta_id, vehiculo_id, conductor_id, fecha_hora_sal, estado) VALUES
(1,1,1,1,'2026-05-13 05:00:00-05','PROGRAMADO'),
(1,1,2,2,'2026-05-13 11:00:00-05','PROGRAMADO'),
(1,3,3,3,'2026-05-13 06:00:00-05','PROGRAMADO'),
(1,5,5,1,'2026-05-14 05:00:00-05','PROGRAMADO'),
(1,2,6,4,'2026-05-13 05:30:00-05','PROGRAMADO'),
(1,4,8,6,'2026-05-13 06:30:00-05','PROGRAMADO'),
(1,1,1,1,'2026-05-12 05:00:00-05','COMPLETADO'),
(1,3,3,3,'2026-05-11 06:00:00-05','COMPLETADO'),
(1,5,5,2,'2026-05-10 05:00:00-05','COMPLETADO'),
(1,2,2,2,'2026-05-12 05:30:00-05','COMPLETADO');

-- ============================================================
-- ASIENTOS
-- ============================================================
INSERT INTO asientos (agencia_id, viaje_id, numero, estado) VALUES
(1,1,1,'VENDIDO'),(1,1,2,'VENDIDO'),(1,1,3,'RESERVADO'),
(1,1,4,'DISPONIBLE'),(1,1,5,'DISPONIBLE'),(1,1,6,'DISPONIBLE'),
(1,1,7,'DISPONIBLE'),(1,1,8,'DISPONIBLE'),(1,1,9,'DISPONIBLE'),
(1,1,10,'DISPONIBLE'),(1,1,11,'DISPONIBLE'),(1,1,12,'DISPONIBLE'),
(1,1,13,'DISPONIBLE'),(1,1,14,'DISPONIBLE'),(1,1,15,'DISPONIBLE'),
(1,2,1,'DISPONIBLE'),(1,2,2,'DISPONIBLE'),(1,2,3,'DISPONIBLE'),
(1,2,4,'DISPONIBLE'),(1,2,5,'DISPONIBLE'),(1,2,6,'DISPONIBLE'),
(1,2,7,'DISPONIBLE'),(1,2,8,'DISPONIBLE'),(1,2,9,'DISPONIBLE'),
(1,2,10,'DISPONIBLE'),(1,2,11,'DISPONIBLE'),(1,2,12,'DISPONIBLE'),
(1,2,13,'DISPONIBLE'),(1,2,14,'DISPONIBLE'),(1,2,15,'DISPONIBLE'),
(1,3,1,'VENDIDO'),(1,3,2,'VENDIDO'),(1,3,3,'RESERVADO'),(1,3,4,'DISPONIBLE');

-- ============================================================
-- CLIENTES (10 registros — Ley 29733 protección de datos)
-- ============================================================
INSERT INTO clientes (agencia_id, nombres, apellidos, tipo_doc, num_doc, telefono, fecha_nac) VALUES
(1,'Juan',     'Flores Quispe',   'DNI','10203040','966111222','1985-03-15'),
(1,'Lucía',    'Mamani Torres',   'DNI','20304050','955222333','1992-07-22'),
(1,'Roberto',  'García Vílchez',  'DNI','30405060','944333444','1978-11-08'),
(1,'Carmen',   'Soto Espinoza',   'DNI','40506070','933444555','2000-01-30'),
(1,'Miguel',   'Ríos Contreras',  'DNI','50607080','922555666','1995-05-12'),
(1,'Diana',    'Pariona Huayta',  'DNI','60708090','911666777','1988-09-25'),
(1,'Eduardo',  'Curi Bautista',   'DNI','70809001','900777888','1975-12-03'),
(1,'Sofía',    'Huamán Roca',     'DNI','80900102','966888999','2002-04-18'),
(1,'Andrés',   'Peña Solano',     'DNI','90010203','955999000','1990-08-07'),
(1,'Patricia', 'Zevallos Cruz',   'DNI','01020304','944000111','1983-06-14');

-- ============================================================
-- DESCUENTOS
-- ============================================================
INSERT INTO descuentos (agencia_id, nombre, tipo, valor, descripcion) VALUES
(1,'Niño (3-12 años)',   'PORCENTAJE',50.00,'Descuento para niños de 3 a 12 años'),
(1,'Adulto Mayor',       'PORCENTAJE',20.00,'Descuento para mayores de 65 años'),
(1,'Universitario',      'PORCENTAJE',10.00,'Con carnet universitario vigente'),
(1,'Promoción especial', 'MONTO_FIJO', 5.00,'Descuento por campaña promocional');

-- ============================================================
-- PASAJES (vendedor_id=2 → María Ccencho)
-- ============================================================
INSERT INTO pasajes (agencia_id, viaje_id, asiento_id, cliente_id, tarifa_id, vendedor_id, precio_base, monto_descuento, precio_final, estado, serie, correlativo) VALUES
(1,1,1,1,1,2,55.00, 0.00,55.00,'EMITIDO','T001','000001'),
(1,1,2,2,1,2,55.00, 5.50,49.50,'EMITIDO','T001','000002'),
(1,3,31,3,2,2,90.00, 0.00,90.00,'EMITIDO','T001','000003'),
(1,3,32,4,2,2,90.00,18.00,72.00,'EMITIDO','T001','000004');

-- ============================================================
-- ENCOMIENDAS (10 estados completos — código tracking EXP-YYYY-NNNNN)
-- ============================================================
INSERT INTO encomiendas (agencia_id, viaje_id, remitente_id, destinatario_id, vendedor_id, descripcion, peso_kg, precio_envio, estado, serie, correlativo, codigo_tracking, fecha_entrega_est) VALUES
(1,1,1,3,2,'Caja de medicamentos y ropa',        5.000,15.00,'EN_TRANSITO', 'E001','000001','EXP-2026-00001','2026-05-13'),
(1,1,2,4,2,'Repuestos de moto',                 12.500,25.00,'EN_TRANSITO', 'E001','000002','EXP-2026-00002','2026-05-13'),
(1,7,5,1,2,'Documentos notariales',              0.500, 8.00,'ENTREGADO',   'E001','000003','EXP-2026-00003','2026-05-12'),
(1,8,6,2,2,'Abarrotes (arroz, aceite)',          20.000,30.00,'ENTREGADO',   'E001','000004','EXP-2026-00004','2026-05-11'),
(1,9,7,3,2,'Ropa usada en bolsa',                 8.000,12.00,'ENTREGADO',   'E001','000005','EXP-2026-00005','2026-05-10'),
(1,10,8,5,2,'Electrodoméstico pequeño',           3.200,18.00,'ENTREGADO',   'E001','000006','EXP-2026-00006','2026-05-12'),
(1,NULL,9,10,2,'Encomienda sin viaje asignado',   2.000,10.00,'REGISTRADO',  'E001','000007','EXP-2026-00007','2026-05-15');

-- ============================================================
-- HISTORIAL ENCOMIENDAS
-- ============================================================
INSERT INTO historial_encomiendas (agencia_id, encomienda_id, usuario_id, estado_anterior, estado_nuevo, observacion) VALUES
(1,1,2,NULL,'REGISTRADO','Registro inicial'),
(1,1,2,'REGISTRADO','EN_TRANSITO','Viaje salió puntual'),
(1,3,2,NULL,'REGISTRADO','Registro inicial'),
(1,3,2,'REGISTRADO','EN_TRANSITO','Cargado en vehículo'),
(1,3,2,'EN_TRANSITO','ENTREGADO','Recogido por destinatario'),
(1,4,2,NULL,'REGISTRADO','Registro inicial'),
(1,4,2,'REGISTRADO','EN_TRANSITO','En camino'),
(1,4,2,'EN_TRANSITO','ENTREGADO','Entregado sin novedad');

-- ============================================================
-- CAJA (usuario_id=2 → María)
-- ============================================================
INSERT INTO caja (agencia_id, usuario_id, fecha_apertura, fecha_cierre, monto_apertura, monto_cierre, estado) VALUES
(1,2,'2026-05-12 07:30:00-05','2026-05-12 20:00:00-05',200.00,1450.00,'CERRADA'),
(1,2,'2026-05-11 07:30:00-05','2026-05-11 20:00:00-05',200.00, 980.00,'CERRADA'),
(1,2,'2026-05-13 07:30:00-05',NULL,200.00,NULL,'ABIERTA');

-- ============================================================
-- MOVIMIENTOS CAJA
-- ============================================================
INSERT INTO movimientos_caja (agencia_id, caja_id, usuario_id, tipo, concepto, monto, referencia_tipo, referencia_id) VALUES
(1,1,2,'INGRESO','Venta pasaje T001-000001',55.00,'PASAJE',1),
(1,1,2,'INGRESO','Venta pasaje T001-000002',49.50,'PASAJE',2),
(1,1,2,'INGRESO','Encomienda E001-000003',   8.00,'ENCOMIENDA',3),
(1,1,2,'EGRESO', 'Pago limpieza terminal',  30.00,NULL,NULL),
(1,2,2,'INGRESO','Venta pasaje anterior',   55.00,'PASAJE',NULL),
(1,2,2,'INGRESO','Encomienda anterior',     12.00,'ENCOMIENDA',NULL),
(1,3,2,'INGRESO','Venta pasaje T001-000004',72.00,'PASAJE',4);

-- ============================================================
-- MANIFIESTOS
-- ============================================================
INSERT INTO manifiestos (agencia_id, viaje_id, generado_por, numero, estado, total_pasajeros, total_encomiendas) VALUES
(1,7, 2,'MAN-2026-0001','ENVIADO', 5,2),
(1,8, 2,'MAN-2026-0002','ENVIADO', 8,3),
(1,9, 2,'MAN-2026-0003','ENVIADO', 6,1),
(1,10,2,'MAN-2026-0004','EMITIDO', 7,2),
(1,1, 2,'MAN-2026-0005','BORRADOR',2,2);

-- ============================================================
-- AUDITORÍA (solo SUPER_ADMIN puede ver — ISO 27001 A.12.4)
-- ============================================================
INSERT INTO auditoria (agencia_id, usuario_id, usuario_nombre, accion, modulo, entidad, registro_id, datos_despues) VALUES
(1,1,'Super Admin Sistema',        'LOGIN',  'AUTH',       'usuarios',    1, '{"ip":"127.0.0.1"}'),
(1,2,'María Ccencho López',        'INSERT', 'VENTAS',     'pasajes',     1, '{"id":1,"precio_final":55.00}'),
(1,2,'María Ccencho López',        'INSERT', 'ENCOMIENDAS','encomiendas', 1, '{"id":1,"estado":"REGISTRADO"}'),
(1,2,'María Ccencho López',        'UPDATE', 'VIAJES',     'viajes',      7, '{"id":7,"estado":"COMPLETADO"}'),
(1,4,'Kevin Sandoval Torres',      'LOGIN',  'AUTH',       'usuarios',    4, '{"ip":"192.168.1.10"}');

-- ============================================================
-- FIN DEL SCHEMA v2.0
-- ============================================================
