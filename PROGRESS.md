# Sistema Express Quinuapata VRAEM — Estado del Proyecto v2.0
> Fecha: 2026-05-14 | Sprint actual: 4 — COMPLETADO ✅

---

## Arquitectura de Roles y Permisos (DEFINITIVA)

### 4 Roles del sistema
| Rol | Descripción | Agencia | Módulos |
|-----|-------------|---------|---------|
| SUPER_ADMIN | Control total absoluto. Único. Nunca se desactiva. | Todas | Todos (incluye AUDITORIA) |
| GERENTE | Acceso completo operativo + gestión. | Todas | Todos excepto AUDITORIA |
| OPERADOR | Trabajador de agencia. | Solo su agencia | Configurable por SUPER_ADMIN |
| CONDUCTOR | Solo lectura: sus viajes y pasajeros. | Solo su agencia | Ninguno (acceso directo a /conductor) |

### 9 Módulos granulares
| Código | Módulo | Descripción |
|--------|--------|-------------|
| VENTAS | Ventas | Vender y anular pasajes |
| ENCOMIENDAS | Encomiendas | Registrar, cambiar estado, entregar |
| CAJA | Caja | Abrir turno, movimientos, cierre |
| MANIFIESTOS | Manifiestos | Generar e imprimir manifiestos |
| REPORTES | Reportes | Ver y exportar reportes |
| USUARIOS | Usuarios | Crear y gestionar usuarios |
| AGENCIAS | Agencias | Ver y configurar agencias |
| CONFIGURACION | Configuración | Rutas, tarifas, vehículos, temporadas |
| AUDITORIA | Auditoría | Solo SUPER_ADMIN, no asignable a otros |

### Portal público (sin login)
- `/tracking` — Rastrear encomienda por código EXP-2026-NNNNN
- `/horarios` — Consultar horarios por ruta y fecha
- `/tarifas` — Ver precios por ruta y tipo de vehículo
- `/sucursales` — Ver agencias con contacto y horarios

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

## Backend — Spring Boot

### Infraestructura y Seguridad
- [x] JWT auth con Spring Security (HS256)
- [x] Multi-agencia via AgenciaContext (SUPER_ADMIN y GERENTE sin filtro, OPERADOR/CONDUCTOR filtran)
- [x] 4 roles globales: SUPER_ADMIN, GERENTE, OPERADOR, CONDUCTOR
- [x] 9 módulos granulares en tabla `modulos`
- [x] `usuario_modulos` — asignación individual de módulos por usuario
- [x] `@RequiereModulo("VENTAS")` — anotación AOP para guardia de módulos
- [x] `ModuloPermissionAspect` — intercepta y valida módulos (SUPER_ADMIN bypasea)
- [x] JWT incluye `modulosActivos` como claim
- [x] Rate limiting (RateLimitInterceptor)
- [x] Auditoría automática (AuditoriaInterceptor)
- [x] GlobalExceptionHandler con mensaje de módulo denegado
- [x] WebSocket STOMP nativo `/ws-stomp` (SockJS eliminado — warnings Firefox corregidos)
- [x] WebSocketEventPublisher

### Módulos Backend implementados
- [x] Auth: login, logout, JWT refresh — incluye modulosActivos en respuesta
- [x] Agencias: CRUD + endpoint público GET
- [x] Usuarios: listar, cambiar estado, GET/PUT módulos por usuario
- [x] Módulos: GET lista, GET por usuario, PUT actualizar (solo SUPER_ADMIN)
- [x] Rutas: CRUD
- [x] Vehículos: tabla BD + native query
- [x] Conductores: tabla BD
- [x] Viajes: listar, detalle, confirmar-salida, asientos, endpoint público
- [x] Asientos: JPA + repository + endpoint
- [x] Clientes: CRUD completo + búsqueda por DNI
- [x] Pasajes: vender (@RequiereModulo VENTAS), anular, detalle
- [x] Encomiendas: registrar, actualizar estado, tracking público
- [x] Caja: abrir, cerrar, movimientos, turno actual
- [x] Tarifas: listar, endpoint público
- [x] Reportes: KPIs (COBIT MEA01)
- [x] Auditoría: listar (solo SUPER_ADMIN)
- [x] Conductor: mis-viajes, pasajeros por viaje

### Marcos de cumplimiento implementados
- [x] **OWASP A03**: Validación DNI/RUC en ClienteDTO + BCrypt 12 rounds
- [x] **OWASP A01**: Roles + módulos verificados por aspecto AOP
- [x] **COSO Actividades de control**: Venta pasaje → ingreso en caja automático
- [x] **COSO Principio de menor privilegio**: Módulos individuales por usuario
- [x] **COBIT APO01**: 4 roles globales definidos + gestión de identidad
- [x] **COBIT MEA01**: KPIs en /api/reportes/kpis
- [x] **COBIT MEA02**: Auditoría inmutable solo SUPER_ADMIN
- [x] **ISO 27001 A.9.2**: Gestión de acceso granular por módulos
- [x] **ISO 27001 A.12.4**: Log de auditoría con IP, timestamp, antes/después
- [x] **ITIL 4 SVC**: POST /api/viajes/{id}/confirmar-salida control de cambio de estado
- [x] **CAATs**: Dashboard gerente + descarga Excel
- [x] **Ley 29733 (Perú)**: Protección datos personales en clientes (tipo_doc, num_doc)

---

## Frontend — Next.js 14

### Layout y Navegación
- [x] Sidebar dinámico basado en `modulosActivos` del usuario
- [x] Badge de rol con color en footer del Sidebar
- [x] DashboardLayout con guardia de módulos (redirige con mensaje de acceso denegado)
- [x] Conductor redirige a /conductor automáticamente
- [x] Header con info de usuario
- [x] SWR fetcher global con JWT interceptor
- [x] WebSocket hook con guard `connected`

### Páginas del dashboard
- [x] `/` — Dashboard con KPIs filtrados por módulos
- [x] `/viajes` — Lista de viajes + confirmar salida
- [x] `/pasajes` — Flujo 4 pasos: viaje → asiento → pasajero (DNI) → confirmación
- [x] `/encomiendas` — Registrar y listar
- [x] `/caja` — Apertura, movimientos, cierre con arqueo
- [x] `/clientes` — CRUD completo con búsqueda por DNI
- [x] `/reportes` — BarChart + LineChart Recharts, selector período 7/14/30 días, KPIs resumen
- [x] `/gerente` — KPIs COBIT/COSO, gráficos Recharts, CAATs
- [x] `/conductor` — Mis viajes del día + lista de pasajeros
- [x] `/usuarios` — Gestión de usuarios + botón "Módulos" (solo SUPER_ADMIN)
- [x] `/usuarios/[id]/modulos` — Toggles individuales por módulo (solo SUPER_ADMIN)
- [x] `/agencias` — Gestión de agencias
- [x] `/auditoria` — Log de auditoría (solo SUPER_ADMIN en Sidebar)

### Portal público (sin login)
- [x] `/tracking` — Rastrear encomienda
- [x] `/horarios` — Horarios públicos de viajes
- [x] `/tarifas` — Precios por ruta
- [x] `/sucursales` — Agencias con contacto

---

## Base de Datos
- [x] 26 tablas: todas las operativas + modulos + usuario_modulos
- [x] Índices en campos críticos (rol, tracking, doc_tipo/num_doc)
- [x] Seeds completos con 6 usuarios, 9 módulos, asignaciones granulares
- [x] 10 estados de encomienda en CHECK constraint
- [x] Auditoría incluye LOGIN, LOGOUT, ACCESS_DENIED

---

## Pendiente / Por hacer

### Alta prioridad — TODO COMPLETADO ✅
- [x] Resolver tarifaId real en venta de pasajes — usa /api/tarifas/buscar
- [x] Manifiestos: generar e imprimir PDF — ManifiestoPdfService + ManifiestoController
- [x] Imprimir ticket de pasaje — GET /api/manifiestos/ticket/{pasajeId}/pdf

### Media prioridad — TODO COMPLETADO ✅
- [x] Encomiendas page: búsqueda de remitente/destinatario por DNI — componente BuscadorCliente
- [x] Configuración: página /configuracion con tabs Rutas, Tarifas y Vehículos — CRUD completo
- [x] Reportes: gráfico de tendencias — BarChart + LineChart últimos 7/14/30 días
- [x] Vehículos: UI de gestión en tab /configuracion — ConfiguracionVehiculoController + tab Vehículos

### Correcciones aplicadas en sesión anterior
- [x] SockJS eliminado → WebSocket nativo /ws-stomp (warning Firefox corregido)
- [x] Font preload: `preload: false` en Inter (warning WOFF2 corregido)
- [x] Docker down -v + fresh restart → schema correcto con tabla modulos
- [x] Roles y permisos auditados: sistema completo y funcional (ver sección abajo)

### Baja prioridad — Sprint 5
- [ ] QR code en tracking de encomiendas
- [ ] Push notifications WebSocket en tiempo real
- [ ] Tests automatizados: 403 módulos, BCrypt, rate limiter, JWT expiración

---

## Verificación del Sistema de Roles y Permisos (2026-05-14)

### Escenario 1: SUPER_ADMIN ve todos los módulos incluyendo Auditoría
- Backend: `/api/auditoria/**` → `hasRole("SUPER_ADMIN")` ✅
- Sidebar: `/auditoria` tiene `roles: ['SUPER_ADMIN']` ✅  
- authStore: `hasModulo()` retorna `true` para SUPER_ADMIN sin verificar array ✅
- DashboardLayout: RUTA_MODULO['/auditoria'] = 'AUDITORIA', SUPER_ADMIN bypasea ✅
- **RESULTADO: PASA** ✅

### Escenario 2: GERENTE ve todos los módulos excepto Auditoría, ve todas las agencias
- Sidebar: `/auditoria` tiene `roles: ['SUPER_ADMIN']` → GERENTE no lo ve ✅
- SecurityConfig: `/api/reportes/**`, `/api/configuracion/**` → `hasAnyRole("SUPER_ADMIN","GERENTE")` ✅
- JWT: `agenciaId: null` para GERENTE → AgenciaFilterInterceptor no filtra → ve todas las agencias ✅
- **RESULTADO: PASA** ✅

### Escenario 3: OPERADOR (carlos.quispe) solo ve pasajes/encomiendas/caja/manifiestos, solo datos de su agencia
- JWT: incluye `modulosActivos: ["VENTAS","ENCOMIENDAS","CAJA","MANIFIESTOS"]` desde `usuario_modulos` ✅
- authStore: `hasModulo()` verifica `user.modulosActivos.includes(codigo)` ✅
- DashboardLayout: módulos no asignados muestran "Acceso denegado" en español ✅
- JWT: `agenciaId: {id_huamanga}` → AgenciaFilterInterceptor filtra todos los queries ✅
- **RESULTADO: PASA** ✅

### Escenario 4: CONDUCTOR (juan.ccoyllo) solo ve sus viajes, no puede acceder a otros módulos
- DashboardLayout: `if (user.rol === 'CONDUCTOR' && pathname !== '/conductor' && pathname !== '/')` → `router.replace('/conductor')` ✅
- SecurityConfig: `/api/conductor/**` → `hasRole("CONDUCTOR")`, el resto requiere otros roles ✅
- Sidebar: solo muestra sección CONDUCTOR con "Mis viajes" ✅
- **RESULTADO: PASA** ✅

### Escenario 5: Cualquier persona puede rastrear en /tracking sin login
- `/tracking/page.tsx`: no tiene `useRequireAuth()` ni está dentro de `(dashboard)` ✅
- Backend: `/api/tracking/**` → `permitAll()` en SecurityConfig ✅
- **RESULTADO: PASA** ✅

### Escenario 6: OPERADOR que intenta acceder a /reportes → acceso denegado en español
- DashboardLayout: `RUTA_MODULO['/reportes'] = 'REPORTES'` ✅
- `hasModulo('REPORTES')` → false (OPERADOR sin módulo REPORTES) → `setAccesoDenegado(true)` ✅
- Muestra: "Acceso denegado" + "No tienes acceso a este módulo. Contacta al administrador del sistema para solicitar el acceso correspondiente." ✅
- Botón "Volver al tablero" → `router.push('/')` ✅
- **RESULTADO: PASA** ✅

### Puntuación final: 6/6 escenarios PASAN ✅

---

## Infraestructura de Producción — Sprint 5 (2026-05-14)

### Docker — Producción
- [x] `backend/Dockerfile` — multi-stage Maven → JRE slim, `/app/logs` creado, flags G1GC
- [x] `frontend/Dockerfile` — multi-stage Node, ARG NEXT_PUBLIC_API_URL/WS_URL, ENV HOSTNAME=0.0.0.0
- [x] `nginx/Dockerfile` — imagen personalizada con template DOMAIN_PLACEHOLDER
- [x] `nginx/entrypoint.sh` — sustitución de dominio en runtime vía `sed`
- [x] `nginx/nginx.conf.template` — TLS 1.2+1.3, HSTS, OCSP, rate limiting, proxy_pass
- [x] `nginx/nginx-init.conf` — HTTP-only para primer challenge Let's Encrypt
- [x] `docker-compose.yml` — restart:always, health checks, mem limits, certbot 12h renewal
- [x] `.env.production` — plantilla con instrucciones, sin valores reales en git

### SSL/TLS con Let's Encrypt
- [x] `scripts/init-ssl.sh` — setup único: nginx temporal → certbot → stack completo
- [x] `scripts/deploy.sh` — backup → build → restart → health check
- [x] `scripts/backup.sh` — pg_dump + gzip + rotación 30 días

### Seguridad OWASP Top 10 — Tests en vivo (2026-05-14)
| Control | Test | Resultado |
|---------|------|-----------|
| A01 Broken Access Control | OPERADOR no ve encomiendas de otra agencia | **PASA** ✅ |
| A01 Broken Access Control | ClienteService.findById() valida agenciaId | **PASA** ✅ |
| A02 Cryptographic Failures | BCrypt(12) + JWT HS256 + HTTPS en producción | **PASA** ✅ |
| A03 Injection | JPA queries parametrizadas, validación en DTOs | **PASA** ✅ |
| A05 Security Misconfiguration | Solo /actuator/health expuesto | **PASA** ✅ |
| A07 Auth Failures | Rate limiting 5/min en /api/auth/login | **PASA** ✅ |
| A08 Data Integrity | JWT adulterado → 401, JWT falso → 401, sin token → 401, válido sin permiso → 403 | **PASA** ✅ |

### Correcciones aplicadas en Sprint 5
- [x] `EncomiendaService.getLista()` — bug crítico: `findAll()` ignoraba agenciaId del OPERADOR → corregido
- [x] `ClienteService.findById()` — sin validación de agencia → corregido con `AccessDeniedException`
- [x] `SecurityConfig` — CONDUCTOR podía acceder a endpoints operativos → reglas explícitas añadidas
- [x] `SecurityConfig.exceptionHandling()` — JWT inválido devolvía 403 (incorrecto) → ahora devuelve 401
- [x] `backend/Dockerfile` — `/app/logs` no existía → añadido `mkdir -p /app/logs`
