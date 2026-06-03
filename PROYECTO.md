# Sistema Integral de Transporte y Encomiendas
## Express Quinuapata VRAEM S.A.C. — Huamanga, Ayacucho, Perú

---

## Resumen del proyecto

Sistema web completo para gestionar la operación de una empresa de transporte interprovincial en el VRAEM. Cubre venta de pasajes, registro y tracking de encomiendas, control de caja por turno, manifiestos legales, reportes gerenciales, auditoría, conductores externos y encomiendas de terceros.

**Cliente:** Express Quinuapata VRAEM S.A.C.  
**Gerente:** Kevin Sandoval Torres  
**Rutas:** Huamanga → Kimbiri · Pichari · San Francisco · Lobo · Santa Rosa · Manitea  
**Vehículos:** Combis Toyota Hiace (15 pasajeros) y Camionetas Toyota Hilux (4 pasajeros)

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Backend | Spring Boot 3.5.14 / Java 17 |
| Seguridad | Spring Security 6.4 + JWT (HS256) + BCrypt (cost=12) |
| Base de datos | PostgreSQL 15 |
| Cache | Spring Cache + Caffeine (TTL 5 min) |
| WebSockets | STOMP nativo (sin SockJS) |
| Frontend | Next.js 14 + TypeScript + Tailwind CSS |
| Estado global | Zustand con persistencia (localStorage) |
| Fetch de datos | SWR + Axios |
| Gráficos | Recharts |
| Iconos | Lucide React |
| PDF | PDFBox 3.0 |
| Excel | Apache POI 5.2 |
| QR | ZXing 3.5 |
| Infraestructura | Docker + Docker Compose + Nginx + Let's Encrypt |

---

## Levantar en desarrollo

```bash
# 1. Copiar variables de entorno
cp .env.example .env          # Linux/Mac/Git Bash
Copy-Item .env.example .env   # Windows PowerShell

# 2. Editar .env con credenciales reales

# 3. Levantar todos los servicios con hot reload
docker compose -f docker-compose.dev.yml up --build
# O en Windows Git Bash:
bash start-dev.sh
```

| Servicio | URL |
|----------|-----|
| Frontend | http://localhost:3000 |
| Backend | http://localhost:8080 |
| PostgreSQL | localhost:5432 (quinuapata_db) |
| Tracking público | http://localhost:3000/tracking |

---

## Despliegue en producción

```bash
# Primera vez — obtener certificado SSL
bash scripts/init-ssl.sh

# Deploys siguientes
bash scripts/deploy.sh
```

Ver instrucciones completas en `docs/README.md`.

---

## Usuarios de prueba

| Email | Contraseña | Rol | Agencia |
|-------|-----------|-----|---------|
| superadmin@expressvraem.com | SuperAdmin2026! | SUPER_ADMIN | Huamanga |
| kevin.sandoval@quinuapata.com | Quinuapata2026! | GERENTE | Huamanga |
| carlos.quispe@quinuapata.com | Quinuapata2024! | OPERADOR | Huamanga |
| maria.ccencho@quinuapata.com | Quinuapata2024! | OPERADOR | Huamanga |
| juan.ccoyllo@quinuapata.com | Quinuapata2024! | CONDUCTOR | Huamanga |
| rosa.sulca@quinuapata.com | Quinuapata2024! | OPERADOR | Kimbiri |

> Credenciales de desarrollo. Los hashes están en `database/schema.sql`.

---

## Roles del sistema

| Rol | Acceso | Función principal |
|-----|--------|------------------|
| SUPER_ADMIN | Todo + configuración crítica + auditoría | Administración total |
| GERENTE | Reportes, dashboard, configuración | Supervisión gerencial |
| ADMIN_AGENCIA | Gestión de su agencia + usuarios | Jefe de sucursal |
| OPERADOR | Pasajes, encomiendas, caja | Ventas y operación |
| CONDUCTOR | Solo sus viajes asignados | Ver pasajeros y carga |

---

## Módulos del sistema (todos implementados)

### Operación
| Módulo | Descripción |
|--------|-------------|
| **Pasajes** | Venta, reserva, anulación, impresión de ticket PDF |
| **Encomiendas** | Registro, 10 estados, tracking público, etiqueta PDF, campo esFragil |
| **Enc. Externas** | Encomiendas de conductores externos con flujo recepción/entrega |
| **Viajes** | CRUD, confirmar salida/llegada, cancelar, conflictos de horario ±4h |
| **Manifiestos** | PDF de pasajeros y carga por viaje, persistencia en BD |
| **Caja** | Turno con apertura/cierre, egreso/ingreso manual, arqueo, PDF de cierre |

### Gestión
| Módulo | Descripción |
|--------|-------------|
| **Reportes** | KPIs, comparativa hoy/ayer, ventas por hora, Excel y PDF |
| **Gerente** | Dashboard COBIT/COSO, actividad por hora/día, top rutas |
| **Auditoría** | Bitácora inmutable con filtros, PDF y Excel exportables |
| **Usuarios** | CRUD con DTOs, email de bienvenida, asignación de módulos |
| **Clientes** | CRUD con búsqueda por DNI/RUC, soporte empresa |
| **Agencias** | Jerarquía principal/sucursal, métricas por agencia |
| **Conductores** | CRUD de conductores con licencia |
| **Configuración** | Rutas, tarifas, vehículos, conductores (CRUD completo) |
| **Promociones** | Descuentos y campañas activas |

### Portal público (sin login)
- `/tracking` — Rastrear encomienda por código
- `/horarios` — Horarios de viajes
- `/tarifas` — Precios por ruta
- `/sucursales` — Agencias y contactos

---

## Reglas de negocio críticas

1. **Concurrencia de asientos** — `SELECT FOR UPDATE` evita doble venta del mismo asiento
2. **Caja única** — Un operador no puede tener 2 turnos abiertos simultáneamente
3. **Multi-agencia** — `AgenciaFilterInterceptor` filtra datos automáticamente por JWT
4. **Auditoría inmutable** — Nadie puede editar logs de auditoría
5. **Confirmar salida** — Cambia todas las encomiendas del viaje a EN_TRÁNSITO
6. **Tracking censurado** — Ley 29733: nombre y DNI censurados en tracking público
7. **Validación peruana** — DNI: 8 dígitos, RUC: 11 dígitos empieza en 10 o 20
8. **Conflicto de horario** — Vehículo y conductor no pueden tener 2 viajes en ±4h
9. **Sucursal válida** — Una sucursal siempre debe tener agencia padre activa y de tipo AGENCIA

---

## Precios del negocio

| Tipo | Normal | Alta demanda |
|------|--------|-------------|
| Combi | S/50 – S/60 | S/70 |
| Camioneta | S/65 – S/90 | S/120 – S/150 |

**Cálculo encomienda:** S/5 base + S/2/kg + S/0.05/km (mínimo S/8)  
**Recargo frágil:** +20%  
**Temporadas:** Semana Santa +30%, Fiestas Patrias +40%, Navidad +50%

---

## Normativa peruana aplicada

- **Ley 29733** — Protección de datos personales en tracking público
- **Manifiesto de pasajeros** — Documento legal obligatorio antes de salida
- **Boletas de pago** — Comprobantes con RUC de la empresa
- **Formato fecha** — DD/MM/YYYY
- **Moneda** — Soles S/

---

## Estructura del proyecto

```
PROYECTO_TRASPORTES/
├── backend/                     ← Spring Boot 3.5.14 / Java 17
│   ├── Dockerfile               ← Multi-stage Maven → JRE slim
│   └── src/main/java/com/expressvraem/
│       ├── modules/
│       │   ├── agencias/        ← CRUD + jerarquía principal/sucursal
│       │   ├── auditoria/       ← Bitácora + PDF + Excel export
│       │   ├── auth/            ← JWT + login audit
│       │   ├── caja/            ← Turnos + PDF de cierre
│       │   ├── clientes/        ← CRUD + búsqueda DNI/RUC
│       │   ├── conductores/     ← CRUD conductores externos
│       │   ├── configuracion/   ← Rutas, vehículos, conductores
│       │   ├── encomiendas/     ← 10 estados + etiqueta + entrega
│       │   ├── externas/        ← Encomiendas de terceros
│       │   ├── manifiestos/     ← PDF + persistencia
│       │   ├── modulos/         ← Gestión de módulos por usuario
│       │   ├── pasajes/         ← Venta + ticket PDF
│       │   ├── promociones/     ← Descuentos y campañas
│       │   ├── reportes/        ← KPIs + comparativa + Excel
│       │   ├── rutas/           ← CRUD rutas
│       │   ├── usuarios/        ← CRUD + email bienvenida
│       │   ├── vehiculos/       ← CRUD vehículos
│       │   └── viajes/          ← Programación + confirmación
│       └── shared/
│           ├── config/          ← SecurityConfig, AuditoriaTrigger
│           ├── email/           ← EmailService (credenciales)
│           ├── logs/            ← LogService
│           ├── middleware/      ← AgenciaContext, RateLimiter
│           ├── security/        ← JWT, UserDetails
│           ├── utils/           ← ExcelReportGenerator
│           └── websocket/       ← WebSocketEventPublisher
├── frontend/                    ← Next.js 14 + TypeScript + Tailwind
│   ├── Dockerfile               ← Multi-stage Node → standalone
│   └── src/
│       ├── app/
│       │   ├── (dashboard)/     ← Páginas del sistema (requieren auth)
│       │   └── (public)/        ← Tracking, horarios, tarifas
│       ├── components/          ← UI reutilizable
│       ├── hooks/               ← useWebSocket
│       ├── services/            ← Axios + servicios por módulo
│       ├── stores/              ← Zustand (auth, agencia)
│       └── types/               ← Tipos TypeScript
├── database/
│   ├── schema.sql               ← 28+ tablas + índices de rendimiento
│   └── seeds/data.sql           ← Datos iniciales
├── nginx/                       ← Nginx con TLS, WebSocket, rate limit
├── scripts/
│   ├── backup.sh                ← pg_dump + verificación + offsite
│   ├── restore.sh               ← Restauración interactiva
│   ├── deploy.sh                ← Build + deploy + health check
│   └── init-ssl.sh              ← Primer setup Let's Encrypt
├── .github/workflows/deploy.yml ← CI/CD automático al push a main
├── docker-compose.yml           ← Producción (nginx + SSL + certbot)
├── docker-compose.dev.yml       ← Desarrollo con hot reload
├── .env.example                 ← Plantilla desarrollo (versionada)
├── .env.production              ← Plantilla producción (versionada)
├── PROYECTO.md                  ← Este archivo
└── PROGRESS.md                  ← Bitácora de avance por sprint
```

---

## Endpoints principales

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | /api/auth/login | Iniciar sesión | No |
| POST | /api/auth/logout | Cerrar sesión (registra auditoría) | JWT |
| POST | /api/auth/refresh | Renovar token JWT | No |
| GET | /api/agencias | Jerarquía agencias/sucursales | No |
| GET | /api/agencias/arbol | Árbol completo | JWT |
| GET | /api/agencias/principales | Solo principales activas | JWT |
| GET | /api/viajes | Listar viajes | OPERADOR+ |
| GET | /api/viajes/disponibles | Viajes con asientos libres | OPERADOR+ |
| POST | /api/viajes | Programar viaje | GERENTE+ |
| POST | /api/viajes/{id}/confirmar-salida | Cambiar a EN_RUTA | OPERADOR+ |
| POST | /api/viajes/{id}/cancelar | Cancelar viaje | OPERADOR+ |
| POST | /api/pasajes/vender | Vender pasaje | VENTAS |
| GET | /api/pasajes/viaje/{id}/asientos | Mapa de asientos | VENTAS |
| GET | /api/manifiestos/viaje/{id} | Datos + manifiesto existente | MANIFIESTOS |
| POST | /api/manifiestos/generar/{id} | Generar/actualizar manifiesto | MANIFIESTOS |
| GET | /api/manifiestos/{id}/pdf | PDF del manifiesto | MANIFIESTOS |
| POST | /api/encomiendas | Registrar encomienda | ENCOMIENDAS |
| PATCH | /api/encomiendas/{id}/estado | Cambiar estado | ENCOMIENDAS |
| GET | /api/tracking/{codigo} | Tracking público | No |
| POST | /api/caja/abrir | Abrir turno | CAJA |
| POST | /api/caja/cerrar | Cerrar turno con arqueo | CAJA |
| POST | /api/caja/egreso | Registrar egreso | CAJA |
| POST | /api/caja/ingreso | Registrar ingreso | CAJA |
| GET | /api/caja/{id}/reporte | PDF del turno | CAJA |
| GET | /api/reportes/kpis | KPIs del dashboard | REPORTES |
| GET | /api/reportes/comparativa | Delta hoy vs ayer | REPORTES |
| GET | /api/auditoria | Bitácora con filtros | SUPER_ADMIN |
| GET | /api/auditoria/exportar | Excel de auditoría | SUPER_ADMIN |
| GET | /api/auditoria/exportar-pdf | PDF de auditoría | SUPER_ADMIN |
| GET | /api/conductores | Listar conductores | OPERADOR+ |
| GET | /api/externas | Encomiendas externas | OPERADOR+ |

---

*Desarrollado con Claude Code · Spring Boot 3.5 · Next.js 14 · PostgreSQL 15*
