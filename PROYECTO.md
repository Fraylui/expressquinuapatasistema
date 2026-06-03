# Sistema Integral de Transporte y Encomiendas
## Express Quinuapata VRAEM S.A.C. — Huamanga, Ayacucho, Perú

---

## Resumen del proyecto

Sistema web completo para gestionar la operación de una empresa de transporte interprovincial en el VRAEM. Cubre venta de pasajes, registro y tracking de encomiendas, control de caja por turno, reportes gerenciales y auditoría.

**Cliente:** Express Quinuapata VRAEM S.A.C.  
**Gerente:** Kevin Sandoval Torres  
**Rutas:** Huamanga → Kimbiri · Pichari · San Francisco · Lobo · Santa Rosa · Manitea  
**Vehículos:** Combis Toyota Hiace (15 pasajeros) y Camionetas Toyota Hilux (4 pasajeros)

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Backend | Spring Boot 3.3.12 / Java 17 |
| Seguridad | Spring Security + JWT (HS256) + BCrypt (cost=12) |
| Base de datos | PostgreSQL 15 |
| WebSockets | STOMP + SockJS |
| Frontend | Next.js 14 + TypeScript + Tailwind CSS |
| Estado global | Zustand con persistencia (localStorage) |
| Fetch de datos | SWR + Axios 1.7.7 |
| Formularios | React Hook Form + Zod |
| Gráficos | Recharts |
| Iconos | Lucide React |
| Infraestructura | Docker + Docker Compose |

---

## Cómo levantar el proyecto en desarrollo

```bash
# 1. Copiar variables de entorno (Linux/Mac/Git Bash)
cp .env.example .env

# 1. Copiar variables de entorno (Windows PowerShell)
Copy-Item .env.example .env

# 2. Editar .env y completar las credenciales reales

# 3. Levantar todos los servicios
docker compose -f docker-compose.dev.yml up --build

# 4. Acceder al sistema
# Frontend:  http://localhost:3000
# Backend:   http://localhost:8080
# DB:        localhost:5432  (quinuapata_db)
```

> En Windows también puedes usar `start-dev.sh` desde Git Bash: `bash start-dev.sh`

---

## Usuarios de prueba

> **Seguridad:** las contraseñas reales nunca se documentan aquí.  
> Solicítalas al administrador del sistema o consulta el archivo `.env` (no versionado).

| Email | Contraseña | Rol | Agencia |
|-------|-----------|-----|---------|
| superadmin@expressvraem.com | SuperAdmin2026! | SUPER_ADMIN | Huamanga |
| kevin.sandoval@quinuapata.com | Quinuapata2026! | GERENTE | Huamanga |
| carlos.quispe@quinuapata.com | Quinuapata2024! | OPERADOR | Huamanga |
| maria.ccencho@quinuapata.com | Quinuapata2024! | OPERADOR | Huamanga |
| juan.ccoyllo@quinuapata.com | Quinuapata2024! | CONDUCTOR | Huamanga |
| rosa.sulca@quinuapata.com | Quinuapata2024! | OPERADOR | Kimbiri |

> Credenciales de desarrollo. Los hashes están en `database/schema.sql`.  
> Para tests automatizados ver `backend/src/test/resources/test-data.sql`.

---

## Roles del sistema

| Rol | Acceso | Función principal |
|-----|--------|------------------|
| SUPER_ADMIN | Todo + configuración crítica + auditoría | Administración total del sistema |
| GERENTE | Reportes, dashboard, configuración | Supervisión gerencial |
| OPERADOR | Pasajes, Encomiendas, Caja | Ventas y operación del día |
| CONDUCTOR | Solo sus viajes asignados | Ver pasajeros y encomiendas de su viaje |
| Público | Solo `/api/tracking/{codigo}` | Rastrear encomienda sin login |

---

## Módulos del sistema

### Sprint 1 — Login + Dashboard + Seguridad (COMPLETADO)
- [x] Autenticación JWT multi-rol (HS256, BCrypt cost=12)
- [x] Dashboard con KPIs por rol
- [x] Sidebar con menú según módulos activos del usuario
- [x] Header con hora en vivo y breadcrumb
- [x] Multi-agencia con filtro automático por agenciaId del JWT
- [x] Rate limiter en login (5 intentos / minuto por IP → 429)
- [x] Auditoría de todos los requests (incluye 401/403, usuario "ANONIMO")
- [x] Headers de seguridad HTTP (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
- [x] CORS restringido por `ALLOWED_ORIGINS` (no wildcard)
- [x] WebSocket CORS restringido (no wildcard)
- [x] JWT sin datos sensibles en `auth.setDetails()`
- [x] Tests de integración OWASP Top 10 (A01–A08)
- [x] Tests de roles y permisos (8 escenarios)
- [x] Tests de autenticación y rate limiting

### Sprint 2 — Pasajes + Encomiendas + Caja (PENDIENTE)
- [ ] Venta de pasajes (3 pasos: buscar → asiento → confirmar)
- [ ] Mapa de asientos interactivo con WebSocket en tiempo real
- [ ] Registro de encomiendas con búsqueda por DNI/RUC
- [ ] Código tracking automático EXP-2026-NNNNN
- [ ] 10 estados de encomienda con historial
- [ ] Tracking público sin login en /api/tracking/{codigo}
- [ ] Módulo de caja: apertura, movimientos, cierre con arqueo

### Sprint 3 — Manifiestos + Reportes + Dashboard Gerencial (PENDIENTE)
- [ ] Manifiesto de pasajeros A4 (documento legal obligatorio)
- [ ] Manifiesto de carga de encomiendas A4
- [ ] Reportes exportables a Excel (Apache POI) y PDF (PDFBox)
- [ ] Dashboard gerencial con gráficos de ingresos por agencia

### Sprint 4 — Auditoría + Usuarios + Configuración (EN PROGRESO)
- [ ] Bitácora de auditoría completa e inmutable
- [ ] Gestión de usuarios con checkboxes de módulos
- [x] Configuración de rutas, tarifas, vehículos y conductores (CRUD completo, búsqueda, validación duplicados, indicador licencia vencida)

### Sprint 5 — Producción (PENDIENTE)
- [ ] Docker producción multi-stage
- [ ] Despliegue en DigitalOcean con HTTPS (Let's Encrypt)
- [ ] Backups automáticos 2 AM + al cerrar turno de caja

### Sprint 6 — Pruebas y Entrega (PENDIENTE)
- [ ] 10 flujos funcionales probados end-to-end
- [ ] Pruebas de seguridad (403, SQL injection, BCrypt, JWT)
- [ ] Pruebas con usuarios reales de la empresa
- [ ] Manuales PDF para usuario y administrador
- [ ] Entrega formal con firma de Kevin Sandoval

---

## Precios del negocio

| Tipo | Normal | Alta demanda |
|------|--------|-------------|
| Combi | S/50 – S/60 | S/70 |
| Camioneta | S/65 – S/90 | S/120 – S/150 |

**Cálculo encomienda:** S/5 base + S/2/kg + S/0.05/km (mínimo S/8)  
**Recargo frágil:** +20%  
**Temporadas:** Semana Santa +30%, Fiestas Patrias +40%, Navidad +50%

**Límites de descuento:**
- Operador: máx S/5
- Gerente: sin límite

---

## Reglas de negocio críticas

1. **Concurrencia de asientos** — `SELECT FOR UPDATE` evita que 2 operadores vendan el mismo asiento
2. **Caja única** — No puede haber 2 cajas abiertas para el mismo operador
3. **Multi-agencia** — `AgenciaFilterInterceptor` filtra datos automáticamente por `agenciaId` del JWT
4. **Auditoría inmutable** — Nadie puede editar ni eliminar logs de auditoría (solo `SUPER_ADMIN` los lee)
5. **Confirmar salida** — Cambia automáticamente todas las encomiendas del viaje a `EN_TRÁNSITO`
6. **Tracking censurado** — Ley 29733: nombre y DNI censurados en tracking público
7. **Validación peruana** — DNI: 8 dígitos exactos, RUC: 11 dígitos empieza en 10 o 20

---

## Normativa peruana aplicada

- **Ley 29733** — Protección de datos personales en tracking público
- **Manifiesto de pasajeros** — Documento legal obligatorio antes de salida del vehículo
- **Boletas de pago** — Comprobantes con RUC de la empresa
- **Formato fecha** — DD/MM/YYYY
- **Moneda** — Soles S/ (no dólares ni pesos)

---

## Estructura del proyecto

```
PROYECTO_TRASPORTES/
├── backend/                  ← Spring Boot 3.3.12 / Java 17
│   └── src/
│       ├── main/             ← Código fuente principal
│       └── test/             ← Tests integración (Testcontainers + PostgreSQL real)
├── frontend/                 ← Next.js 14 / TypeScript
│   └── src/
│       ├── app/              ← App Router (dashboard, login, tracking)
│       ├── components/       ← Componentes reutilizables
│       ├── stores/           ← Zustand (authStore)
│       ├── services/         ← Axios (api.ts)
│       └── types/            ← Tipos TypeScript compartidos
├── database/
│   ├── schema.sql            ← 22+ tablas con agencia_id para multi-agencia
│   └── seeds/
│       └── data.sql          ← Datos iniciales de producción
├── docker/                   ← Configuración Docker auxiliar
├── nginx/                    ← nginx.conf para producción
├── scripts/                  ← Scripts de utilidad (backup, deploy)
├── docs/                     ← Documentación técnica adicional
├── docker-compose.yml        ← Producción (multi-stage, nginx, HTTPS)
├── docker-compose.dev.yml    ← Desarrollo con hot reload
├── start-dev.sh              ← Script rápido de arranque (Linux/Mac/Git Bash)
├── PROYECTO.md               ← Este archivo
├── PROGRESS.md               ← Bitácora de avance por sprint
├── .env                      ← Variables reales (NO versionado, en .gitignore)
├── .env.example              ← Plantilla sin credenciales reales (versionado)
└── .env.production           ← Plantilla de producción con placeholders (versionado)
```

---

## Endpoints principales

| Método | Endpoint | Descripción | Auth requerida |
|--------|----------|-------------|----------------|
| POST | /api/auth/login | Iniciar sesión | No |
| POST | /api/auth/refresh | Renovar token JWT | No (token en body) |
| GET | /api/agencias | Listar agencias | No (solo lectura) |
| GET | /api/viajes | Listar viajes | OPERADOR+ |
| GET | /api/rutas | Listar rutas | OPERADOR+ |
| POST | /api/pasajes/vender | Vender pasaje | OPERADOR+ |
| GET | /api/pasajes/viaje/{id}/asientos | Asientos disponibles | OPERADOR+ |
| POST | /api/encomiendas | Registrar encomienda | OPERADOR+ |
| GET | /api/encomiendas/lista | Listar encomiendas (filtradas por agencia) | OPERADOR+ |
| PATCH | /api/encomiendas/{id}/estado | Cambiar estado de encomienda | OPERADOR+ |
| GET | /api/encomiendas/{id}/historial | Historial de estados | OPERADOR+ |
| GET | /api/tracking/{codigo} | Rastrear encomienda (público) | No |
| POST | /api/caja/abrir | Abrir turno de caja | OPERADOR+ |
| POST | /api/caja/cerrar | Cerrar turno de caja | OPERADOR+ |
| POST | /api/caja/movimiento | Registrar movimiento | OPERADOR+ |
| GET | /api/caja/turno-actual | Estado del turno activo | OPERADOR+ |
| GET | /api/reportes/ventas/excel | Exportar Excel | GERENTE+ |
| GET | /api/auditoria | Bitácora de eventos | Solo SUPER_ADMIN |
| GET | /api/usuarios | Listar usuarios | SUPER_ADMIN, GERENTE |
| POST | /api/usuarios | Crear usuario | SUPER_ADMIN, GERENTE |
| POST | /api/agencias | Crear agencia | SUPER_ADMIN, GERENTE |

---

##


*Desarrollado con Claude Code · Metodología Scrum adaptado · Sprints de 2 semanas*
