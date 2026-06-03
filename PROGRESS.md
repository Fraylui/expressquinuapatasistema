# Sistema Express Quinuapata VRAEM — Estado del Proyecto v2.0
> Última actualización: 2026-06-03 | Estado: **LISTO PARA PRODUCCIÓN** ✅

---

## Resumen del estado actual

| Área | Estado |
|------|--------|
| Backend (Spring Boot 3.5.14) | Completo ✅ |
| Frontend (Next.js 14) | Completo ✅ |
| Base de datos (PostgreSQL 15) | Completo ✅ |
| Infraestructura (Docker + SSL) | Completo ✅ |
| CI/CD (GitHub Actions) | Configurado ✅ |
| Backups automáticos | Configurado ✅ |
| Optimización de rendimiento | Aplicada ✅ |

---

## Roles del sistema

| Rol | Descripción | Agencia | Módulos |
|-----|-------------|---------|---------|
| SUPER_ADMIN | Control total absoluto. Único. | Todas | Todos + AUDITORIA |
| GERENTE | Acceso completo operativo + gestión | Todas | Todos excepto AUDITORIA |
| ADMIN_AGENCIA | Gestión de su agencia | Su agencia | Configurable |
| OPERADOR | Operación del día a día | Su agencia | Configurable |
| CONDUCTOR | Solo lectura de sus viajes | Su agencia | Ninguno (ruta /conductor) |

## Módulos granulares

| Código | Módulo | Roles que lo usan |
|--------|--------|------------------|
| VENTAS | Pasajes | OPERADOR+ |
| ENCOMIENDAS | Encomiendas | OPERADOR+ |
| CAJA | Caja | OPERADOR+ |
| MANIFIESTOS | Manifiestos | OPERADOR+ |
| REPORTES | Reportes | GERENTE+ |
| USUARIOS | Usuarios | SUPER_ADMIN, GERENTE |
| AGENCIAS | Agencias | SUPER_ADMIN, GERENTE |
| CONFIGURACION | Configuración | SUPER_ADMIN, GERENTE |
| AUDITORIA | Auditoría | Solo SUPER_ADMIN |

---

## Credenciales de prueba

| Email | Contraseña | Rol | Módulos |
|-------|-----------|-----|---------|
| superadmin@expressvraem.com | SuperAdmin2026! | SUPER_ADMIN | Todos |
| kevin.sandoval@quinuapata.com | Quinuapata2026! | GERENTE | Todos excepto AUDITORIA |
| carlos.quispe@quinuapata.com | Quinuapata2024! | OPERADOR | VENTAS, ENCOMIENDAS, CAJA, MANIFIESTOS |
| maria.ccencho@quinuapata.com | Quinuapata2024! | OPERADOR | VENTAS, ENCOMIENDAS, CAJA |
| juan.ccoyllo@quinuapata.com | Quinuapata2024! | CONDUCTOR | Solo viajes propios |
| rosa.sulca@quinuapata.com | Quinuapata2024! | OPERADOR (Kimbiri) | VENTAS, ENCOMIENDAS, CAJA, MANIFIESTOS |

---

## Backend — Spring Boot 3.5.14

### Infraestructura y Seguridad
- [x] JWT auth con Spring Security 6.4 (HS256, BCrypt cost=12)
- [x] DaoAuthenticationProvider con constructor nuevo API (6.4)
- [x] Multi-agencia via AgenciaContext (SUPER_ADMIN/GERENTE sin filtro)
- [x] 5 roles: SUPER_ADMIN, GERENTE, ADMIN_AGENCIA, OPERADOR, CONDUCTOR
- [x] 9 módulos granulares con `@RequiereModulo` AOP
- [x] Rate limiting en login (5 intentos/minuto por IP → 429)
- [x] Auditoría automática de todos los requests
- [x] Headers de seguridad HTTP (CSP, HSTS, X-Frame-Options)
- [x] CORS restringido por ALLOWED_ORIGINS
- [x] WebSocket STOMP nativo `/ws-stomp`
- [x] Spring Cache + Caffeine (TTL 5min, max 500 entradas)
- [x] HikariCP: pool de 20 conexiones configurado
- [x] JPA batch: batch_size=25, order_inserts/updates=true
- [x] Compresión HTTP habilitada (JSON/HTML/CSS ≥ 1KB)

### Módulos Backend
- [x] **Auth** — login, logout, refresh, audit de LOGIN/LOGOUT/LOGIN_FALLIDO
- [x] **Agencias** — CRUD + jerarquía principal/sucursal, métricas
- [x] **Usuarios** — CRUD con CrearUsuarioDTO/ActualizarUsuarioDTO, email de bienvenida
- [x] **Módulos** — gestión granular por usuario
- [x] **Rutas** — CRUD
- [x] **Vehículos** — CRUD
- [x] **Conductores** — CRUD (módulo nuevo)
- [x] **Configuración** — tabs Rutas/Vehículos/Conductores
- [x] **Viajes** — programar, confirmar salida/llegada, cancelar, editar, validar conflictos ±4h
- [x] **Asientos** — JPA + mapa en tiempo real
- [x] **Clientes** — CRUD + búsqueda DNI/RUC, soporte empresa con representante
- [x] **Pasajes** — vender, reservar, confirmar, anular, ticket PDF con QR
- [x] **Encomiendas** — 10 estados, tracking público, esFragil, etiqueta PDF, entrega
- [x] **Encomiendas Externas** — conductores externos con flujo recepción/entrega (módulo nuevo)
- [x] **Manifiestos** — generar, persistir, PDF pasajeros y carga por viaje
- [x] **Caja** — abrir/cerrar turno, egreso/ingreso, historial batch, PDF de cierre
- [x] **Promociones** — descuentos y campañas
- [x] **Reportes** — KPIs, comparativa hoy/ayer, ventas por hora, viajes del día, Excel
- [x] **Auditoría** — filtros full-text+fecha+ip, actividad por hora/día, PDF+Excel export
- [x] **Email** — credenciales iniciales a usuarios nuevos (EmailService)

### Optimizaciones de rendimiento
- [x] `batchEnrich()` en ViajeController — 5 queries fijas vs 6×N (elimina N+1 crítico)
- [x] `disponibles()` — 1 query GROUP BY vs N conteos individuales
- [x] Índices DB: `idx_viajes_agencia_estado`, `idx_asientos_viaje_estado`, `idx_encomiendas_viaje`, etc.
- [x] `AgenciaService` — batch loading de encargados y padres (2 queries vs N)
- [x] `CajaService.enrichCajaList()` — 3 queries batch vs N+1

### Correcciones VS Code warnings (Java Language Server)
- [x] Todos los `@SuppressWarnings("unchecked")` innecesarios eliminados
- [x] Imports no usados eliminados (Promocion en PasajeService, etc.)
- [x] `@RequiredArgsConstructor` redundante eliminado (EmailService)
- [x] Métodos privados no usados eliminados (resolveNombre en CajaController)
- [x] Campos `static final` no usados eliminados (CONTENT_W en CajaReportePdfService)
- [x] `mapstruct` eliminado del pom.xml (sin @Mapper en el proyecto)
- [x] Raw type warnings corregidos con casteos tipados

---

## Frontend — Next.js 14

### Layout y Navegación
- [x] Sidebar dinámico basado en `modulosActivos` del JWT
- [x] DashboardLayout con guardia de módulos
- [x] Dark mode completo con tema verde
- [x] WebSocket hook con reconexión automática

### Páginas del dashboard
- [x] `/` — Dashboard con KPIs + comparativa hoy/ayer + accesos rápidos
- [x] `/viajes` — Lista + programar + editar + cancelar + manifiestos
- [x] `/pasajes` — Flujo 4 pasos + mapa de asientos en tiempo real
- [x] `/encomiendas` — Registro + estados + etiqueta + entrega
- [x] `/encomiendas-externas` — Recepción y entrega de terceros
- [x] `/manifiestos` — Panel completo con PDF y persistencia
- [x] `/caja` — Apertura/cierre de turno + egreso/ingreso + historial + PDF
- [x] `/clientes` — CRUD con búsqueda por DNI/RUC
- [x] `/promociones` — Gestión de descuentos
- [x] `/reportes` — Gráficos Recharts + Excel export
- [x] `/gerente` — KPIs COBIT/COSO + actividad + top rutas
- [x] `/auditoria` — Bitácora + filtros + actividad + PDF/Excel
- [x] `/usuarios` — CRUD con formulario + asignación de módulos
- [x] `/agencias` — Jerarquía principal/sucursal
- [x] `/configuracion` — Tabs Rutas/Vehículos/Conductores

### Portal público (sin login)
- [x] `/tracking` — Rastrear encomienda
- [x] `/horarios` — Horarios públicos
- [x] `/tarifas` — Precios por ruta
- [x] `/sucursales` — Agencias con contacto

### Optimizaciones de rendimiento
- [x] Debounce 250ms en búsquedas (evita filtrado en cada keystroke)
- [x] `viajes/page.tsx` — Sin polling (WebSocket cubre actualizaciones en tiempo real)
- [x] `pasajes/page.tsx` — 15s→60s / 10s→30s
- [x] `auditoria/page.tsx` — 60s→300s
- [x] `reportes/page.tsx` — 60s→120s / 120s→300s
- [x] SWR `revalidateOnFocus: false` donde no es necesario

---

## Base de datos

- [x] 28+ tablas con agencia_id para multi-agencia
- [x] Índices en campos críticos: estado, viaje_id, agencia_id, fecha_emision, usuario_id
- [x] Seeds completos con 6 usuarios, 9 módulos, agencias, rutas, tarifas
- [x] 10 estados de encomienda en CHECK constraint
- [x] Columnas esFragil y montoDescuento en encomiendas
- [x] Jerarquía agencias: tipo (AGENCIA/SUCURSAL) + agencia_padre_id
- [x] Tabla encomiendas_externas para conductores externos
- [x] Tabla manifiestos para persistencia
- [x] Tabla conductores independiente

---

## Infraestructura de Producción

### Docker
- [x] `backend/Dockerfile` — multi-stage Maven → JRE slim, G1GC, 75% RAM container
- [x] `frontend/Dockerfile` — multi-stage Node → standalone, ARG env vars
- [x] `nginx/Dockerfile` — imagen con template DOMAIN sustitución en runtime
- [x] `docker-compose.yml` — restart:always, health checks, mem 896M backend
- [x] `.env.production` — plantilla completa con instrucciones

### SSL/TLS
- [x] `scripts/init-ssl.sh` — setup único: nginx temporal → certbot → stack
- [x] Let's Encrypt con renovación automática certbot cada 12h
- [x] TLS 1.2 + 1.3 en nginx, HSTS, OCSP stapling

### Deploy y Backup
- [x] `scripts/deploy.sh` — backup → build → restart → health check
- [x] `scripts/backup.sh` — pg_dump + verificación integridad + offsite (rclone/rsync)
- [x] `scripts/restore.sh` — restauración interactiva con confirmación
- [x] `.github/workflows/deploy.yml` — CI/CD automático al push a main

---

## Marcos de cumplimiento implementados

| Marco | Control | Estado |
|-------|---------|--------|
| OWASP A01 | Roles + módulos AOP, filtro agencia | ✅ |
| OWASP A02 | BCrypt 12 + JWT HS256 + HTTPS | ✅ |
| OWASP A03 | JPA parametrizado, validación DTO | ✅ |
| OWASP A05 | Solo /actuator/health expuesto | ✅ |
| OWASP A07 | Rate limit 5/min en login | ✅ |
| OWASP A08 | JWT adulterado → 401 | ✅ |
| COSO | Venta pasaje → ingreso caja automático | ✅ |
| COBIT APO01 | 5 roles + gestión de identidad | ✅ |
| COBIT MEA01 | KPIs en /api/reportes/kpis | ✅ |
| COBIT MEA02 | Auditoría inmutable solo SUPER_ADMIN | ✅ |
| ISO 27001 A.9.2 | Módulos granulares por usuario | ✅ |
| ISO 27001 A.12.4 | Log con IP, timestamp, antes/después | ✅ |
| Ley 29733 (Perú) | Datos censurados en tracking público | ✅ |

---

## Pendiente (bajo prioridad)

- [ ] Tests automatizados end-to-end (Playwright)
- [ ] Pruebas con usuarios reales de la empresa
- [ ] Manual PDF para usuario final
- [ ] Manual PDF para administrador del sistema
- [ ] QR en tracking público de encomiendas (backend listo, falta UI)
- [ ] Entrega formal con firma de Kevin Sandoval Torres
