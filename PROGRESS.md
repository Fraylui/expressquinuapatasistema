# Sistema Express Quinuapata VRAEM — Estado del Proyecto v2.0
> Última actualización: 2026-06-11 | Estado: **EN MEJORA CONTINUA** 🔧

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
| elena.paredes@quinuapata.com | Quinuapata2024! | ADMIN_AGENCIA (Kimbiri) | VENTAS, ENCOMIENDAS, CAJA, MANIFIESTOS, REPORTES |

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
- [x] **Tarifas** — CRUD completo con solapamiento por temporada, safety check pasajes
- [x] **Temporadas** — CRUD completo con validación de rangos solapados
- [x] **Configuración** — tabs Empresa/Rutas/Tarifas/Temporadas/Vehículos/Conductores
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
- [x] `/configuracion` — Tabs Empresa/Rutas/Tarifas/Temporadas/Vehículos/Conductores

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

## Sesión 2026-06-11 — Auditoría y correcciones CRUD configuración

### Bugs corregidos (backend)
- `ViajeController` — 9 bugs: N+1 en confirmarSalida/confirmarLlegada, `agenciaId=1L` hardcoded, null concat en enrich, `validarConflictos` cargaba todos los viajes
- `ConfiguracionVehiculoController` — `@PreAuthorize` + `@Transactional` faltaban, `agenciaId=null`
- `ConfiguracionConductorController` — reescrito completo (CRUD full, alertas licencia, `diasVencLic`)
- `ConfiguracionRutaController` — reescrito completo (CRUD full, safety checks viajes activos)
- `ConfiguracionTarifaController` — reescrito completo (CRUD full, duplicado por agencia, `GET /{id}`, `DELETE`)
- `ConfiguracionTemporadaController` — creado desde cero (CRUD full, solapamiento de fechas, safety check tarifas)
- `ViajeScheduler` + `LiquidacionViajeService` — null concat en nombres de conductores

### Migraciones aplicadas
- `V1` — `intentos_fallidos`, `bloqueado_hasta` a `usuarios` (bug pre-existente)
- `V2` — `updated_at` a `conductores`
- `V3` — `updated_at` a `rutas`
- `V4` — `updated_at` a `temporadas`

### Nuevos archivos backend
- `Temporada.java` — entidad con `@PrePersist`/`@PreUpdate`
- `TemporadaRepository.java` — incluye `findSolapes()` para detectar rangos superpuestos
- `ConfiguracionTemporadaController.java`

### Frontend actualizado
- `configuracion/page.tsx` — tab Temporadas agregado, `TarifasTab` con selector de temporada, `TIPOS_TARIFA` vs `TIPOS_FLOTA` separados, PATCH con body explícito en todos los toggles

---

## Sesión 2026-06-11 (parte 2) — Control financiero y separación de ingresos

### Bugs críticos corregidos
- **Encomiendas al contado nunca entraban a caja** — `EncomiendaService.crear` solo registraba POR_COBRAR; ahora exige turno abierto (CAJA_REQUERIDA) y registra el ingreso real
- **Promociones sin validar vigencia** — nuevo `PromocionService.findVigenteById(id, aplicaA)`; aplicado en PasajeService (+ código muerto eliminado) y EncomiendaService
- **Comprobante de encomienda mostraba precio SIN descuento** — `ComprobantePdfService` usaba `monto` (base) en vez de `precioEnvio` (final); ahora muestra Precio/Descuento/Monto
- **`tarifaId` siempre quedaba en 1** — cast `Object[]` sobre query de una columna en PasajeService fallaba silenciosamente; corregido a escalar
- **`GET /caja/movimientos/{cajaId}` sin ownership** — cualquier operador leía cualquier caja; nuevo `CajaService.verificarAcceso(cajaId, userId, rol, agenciaId)` aplicado también a `/{id}/reporte`

### Funcionalidades nuevas
- **Migración V5**: `categoria_ingreso`, `viaje_id`, `vehiculo_id`, `tipo_vehiculo`, `conductor_id` en `movimientos_caja` + backfill histórico + índices (aplicada en dev)
- **Migración V6**: `cuota_salida_combi` en `empresa_config` (aplicada en dev)
- **Cuota fija de combi**: al `confirmarSalida()` de viaje COMBI se registra ingreso `CUOTA_SALIDA_COMBI` en la caja del operador (cuota configurable en Configuración → Empresa, 0 = deshabilitado)
- **CajaService.registrarMovimiento** sobrecargado con dimensiones; deriva categoría automáticamente (PASAJE_COMBI/PASAJE_CAMIONETA/ENCOMIENDA/ENC_PAGO_DESTINO/ENC_EXTERNA/OTRO)
- **GERENTE puede asignar módulos** (`GET /api/modulos` + `PUT /api/usuarios/{id}/modulos`) con guardas: no a SUPER_ADMIN/GERENTE, AUDITORIA sigue bloqueado
- **Ticket encomienda externa**: leyenda explícita "ENCOMIENDA DE CONDUCTOR EXTERNO / PERTENECE AL CONDUCTOR"
- **Frontend**: input "Cuota fija por salida de combi" en Configuración → Empresa (store + tab)

### Decisiones de negocio confirmadas
- La empresa vende pasajes de combi por ventanilla Y cobra la cuota fija por salida
- La cuota de combi es un monto único por empresa (en `empresa_config`)
- **La flota es SOLO COMBI y CAMIONETA** — eliminados BUS/MINIVAN/MINIBUS/SEDAN/SUV/CAMION de:
  - `ConfiguracionVehiculoController` (antes ni siquiera aceptaba COMBI/CAMIONETA — bug)
  - `ConfiguracionTarifaController`, `TipoVehiculo` enum, `SeatMap`, `TIPOS_TARIFA`/`TIPOS_FLOTA`, filtro de reportes
  - Migración **V7**: CHECK constraints de `vehiculos.tipo` y `tarifas.tipo_vehiculo` (aplicada en dev)

### Auditoría módulos Promociones y Clientes
- **Promociones — guard de eliminación**: borrar una promo ya usada rompía la referencia histórica de las boletas (`descuento_id`/`promocion_id`); ahora `PROMO_CON_USOS` bloquea y sugiere desactivar (probado en vivo con "Envio Gratis Sabado", 1 uso)
- Pluralización "1 usos" → "1 uso" en la tabla
- **Clientes — verificado sólido**: FKs en BD protegen contra borrado con pasajes/encomiendas asociados + mensaje claro `CLIENTE_CON_REFERENCIAS`; KPIs, filtros persona/empresa, búsqueda y CRUD completos
- Formulario de promos correcto: 3 tipos (%, monto fijo, ida y vuelta), aplica-a, fechas, límite de usos — sin selector de agencia (promos globales por diseño, coherente con el flujo de venta)

### Auditoría módulo Manifiestos
- Selector de viajes: ahora ordena EN_RUTA → PROGRAMADO → COMPLETADO (recientes primero) y muestra **fecha + hora** ("13 may · 11:00") — antes los completados de hace un mes aparecían primero mostrando solo la hora
- Verificado OK: detalle con conductor/licencia/totales (probado por API: 4 pasajeros S/134.50 + 2 encomiendas S/40), empty state, historial con flujo BORRADOR→EMITIDO→ENVIADO, PDFs de pasajeros/encomiendas y ticket por pasaje

### Auditoría módulo Encomiendas Externas
- Modelo de negocio confirmado y ya implementado: el conductor externo deja la encomienda solo para entrega; la empresa cobra su servicio **al conductor al dejarla** ("Ahora — conductor ya pagó") o **al destinatario al recoger** ("Al recoger — destinatario paga", badge "Cobrar S/ X" en la lista)
- **Fix financiero**: registrar con "conductor ya pagó" sin caja abierta solo dejaba un `log.warn` y el dinero del conductor no se registraba en ningún lado; ahora lanza `CAJA_REQUERIDA` (transacción revierte, probado en vivo: rechazo + rollback verificado en BD)
- Aviso rojo preventivo en el modal de registro cuando se elige "Ahora" sin turno de caja abierto (espejo del aviso ámbar existente para "Al recoger")

### Auditoría módulo Encomiendas (foco: flujo de registro confuso)
- **"Buscar para registrar" rediseñado** en `BuscadorCliente` (remitente y destinatario):
  - Auto-búsqueda al completar el documento (DNI 8 dígitos / RUC 11) — ya no hay que pulsar "Buscar"
  - Si el cliente no existe, el mini-formulario de registro **se abre solo** con el documento pre-llenado (antes: franja amarilla con link pequeño "+ Registrar aquí" que nadie veía)
  - Texto de ayuda bajo el buscador explicando el comportamiento
- **Aviso de caja en el paso Cobro**: si la forma de cobro es al contado y el operador no tiene turno abierto, alerta roja ANTES de confirmar (el backend ahora exige caja — cambio de hoy); para POR_COBRAR ya existía el aviso del operador destino
- Verificado: promos del flujo filtran por `aplicaA=ENCOMIENDAS`; venta probada con Playwright (auto-search carga panel verde con Siguiente habilitado)

### Auditoría módulo Pasajes (flujo de venta)
- **`/api/viajes/disponibles` vendía asientos de viajes fantasma**: EN_RUTA sin límite de tiempo (aparecían los 4 viajes del 13 de mayo). Ahora excluye EN_RUTA con salida > 24 h (el abordaje en paraderos del mismo día sigue funcionando). Esto también corrige el badge "N viajes hoy" del Tablero
- **Tarifas ahora respetan temporada** (pendiente conocido de Opción A): nueva query `findVigenteEnTemporada` — prioriza la tarifa cuya temporada activa cubre hoy, cae a la general; usada en `/api/tarifas/buscar` (precio que ve el cajero) y en `PasajeService` (tarifaId registrado)
- Subtítulo "en 3 pasos" corregido (el stepper tiene 4) y "Boletas del día" → "Boletas emitidas" (lista boletas de fechas pasadas)
- Verificado: promos del flujo ya filtran por `aplicaA=PASAJES` (selector y código), compatible con la validación de vigencia nueva

### Auditoría módulo Viajes (capturas como OPERADOR y GERENTE)
- **Llegadas sin confirmar**: viajes EN_RUTA por más de 24 h (había 4 con 29 días) ahora muestran franja roja "X días en ruta — confirma la llegada" + banner de alerta explicando el impacto (encomiendas no disponibles, reportes desactualizados)
- **Ingresos por viaje en tarjeta**: chip "S/ X recaudado" alimentado por `ingresosViaje` — nuevo campo en `ViajeResponseDTO` calculado en `batchEnrich` con una query batch sobre `movimientos_caja.viaje_id` (dimensión V5)
- Helpers `horasEnRuta`/`llegadaPendiente`/`labelEnRuta` en viajes/page.tsx
- Observación de datos: hay un viaje con conductor "Super Admin Sistema" (conductor_id apunta a un usuario admin del seed)

### Auditoría módulo Caja (capturas como OPERADOR con turno y GERENTE)
- **Tarjetas del turno ciegas a Externas/Cuotas combi**: "Total ingresos S/23.50 — 0 cobros" cuando el dinero era de externas; ahora 6 tarjetas (Total, Pasajes, Encomiendas, Externas, Cuotas combi, Saldo) y el contador suma todas las categorías
- Chips de filtro nuevos: "Externas" y "Cuota combi"; `TipoBadge` muestra EXTERNA / CUOTA COMBI (antes caían en "INGRESO" genérico)
- GERENTE/SUPER_ADMIN aterrizan en la pestaña **Consolidado** (antes veían "Abra su turno para comenzar a operar")
- Consolidado por agencia (backend + frontend) ahora desglosa Externas y Cuotas combi
- **PDF de cierre de turno** incluye filas "Enc. externas" y "Cuotas combi"
- Dark mode: overrides para matices `green` e `indigo` (las tarjetas Total/Saldo quedaban claras en modo oscuro)
- `TurnoActual` (caja.service.ts) y `ConsolidadoAgencia` tipados con los campos nuevos

### Rediseño UX Tablero (auditado con capturas como GERENTE y OPERADOR)
- **Bug**: KPI "Encomiendas" estaba hardcodeado en "—" — conectado a `/api/encomiendas/stats` (registradas hoy + por entregar)
- KPI "Ingresos turno" ahora desglosa Pasajes · Encomiendas · Externas · Cuotas combi (backend: `buildMap` expone `montoExternas`/`montoCuotasCombi` — antes el desglose ignoraba esos tipos)
- Banner muestra el nombre real de la agencia (catálogo `/api/agencias` → `turno.agenciaNombre` → fallback `Agencia #id`)
- Eliminado panel "Sistema" (BD/API hardcodeados `ok: true`, teatro) y tarjeta "Tu agencia" (mostraba el ID numérico)
- Eliminada sección GESTIÓN del grid de módulos (duplicaba el sidebar); OPERACIÓN se mantiene como lanzador
- Promociones vigentes ahora en tarjeta propia junto a Viajes del día
- Script `frontend/screenshot-tablero.js` para auditar como ambos roles

### Rediseño UX gerencial/reportes (auditado con capturas Playwright)
- `/gerente`: eliminados paneles de relleno "Controles activos" y "Bitácora hoy" (jerga COBIT sin valor para el negocio) y el KPI "Eventos hoy"; tile "Log auditoría" duplicado removido
- `/gerente`: strip "Ingresos de hoy por servicio" SIEMPRE visible con las 6 categorías (S/ 0.00 atenuado cuando no hay) + link a reporte completo
- `/gerente`: panel "Cajas de operadores" siempre visible en columna derecha (antes solo aparecía al filtrar agencia) — muestra saldo y hora de apertura, badge "N sin caja"
- `/reportes`: eliminados KPIs duplicados del gerencial y tabla "Encomiendas sin movimiento" duplicada; la sección Ingresos ahora abre la página
- `/reportes`: presets de rango rápido (Hoy/7/30/90 días), default 30 días para que nunca abra vacío
- Dark mode: overrides para chips/badges de color (pasteles → translúcidos) y grises muted legibles (`text-gray-400` era #475569, ilegible) en `globals.css`
- Script `frontend/screenshot-audit.js` (Playwright) para auditar capturas de ambas páginas en claro/oscuro

### Reportes de ingresos (completado)
- [x] `GET /api/reportes/ingresos?desde&hasta&agenciaId&usuarioId&tipoVehiculo&categoria&groupBy=categoria|dia|agencia|usuario|vehiculo|conductor|viaje` — totales por categoría + desglose agrupado (whitelist anti SQL-injection, LIMIT 200)
- [x] `getKpisGerente` ahora incluye `ingresosPorCategoria` (desglose de hoy)
- [x] `/reportes` — nueva sección "Ingresos por servicio y vehículo": barra de filtros (fechas/agencia/usuario/tipoVehiculo/categoría), chips por categoría, selector de agrupación, gráfico horizontal + tabla
- [x] `/gerente` — strip "Ingresos de hoy por servicio" con tarjetas separadas (camioneta/combi/cuotas/encomiendas/externas)
- [x] Probado en vivo contra backend dev: agrupaciones por categoría, conductor y usuario+COMBI responden con datos reales

---

## Sesión 2026-06-11 (parte 3) — Mejoras pre-lanzamiento backend/frontend

### Bugs críticos encontrados y corregidos
- **El bloqueo por intentos fallidos NUNCA funcionó**: `login()` es `@Transactional` y lanza `BusinessException` justo después de guardar el contador → rollback lo borraba (siempre decía "restantes: 4" y nunca bloqueaba). Nuevo `LoginAttemptService` con `REQUIRES_NEW` para contador y auditoría. **Probado en vivo**: 5 intentos 1/5→5/5, bloqueo 30 min, clave correcta rechazada con `CUENTA_BLOQUEADA`
- **La auditoría `LOGIN_FALLIDO` nunca se guardó**: el CHECK `auditoria_accion_check` no incluía esa acción, y `agencia_id NOT NULL` impedía auditar intentos sobre emails desconocidos → **Migración V8** (aplicada en dev). Verificado: filas con `motivo=PASSWORD_INCORRECTO (intento N/5)` y `agencia_id NULL` para email inexistente
- **Era imposible crear usuarios ADMIN_AGENCIA**: el CHECK `usuarios_rol_check` en BD solo permitía 4 roles (el 5.º existe en todo el código) → **Migración V9** (aplicada en dev). Creada usuaria de prueba Elena Paredes (Kimbiri)
- **Health check `DOWN` resuelto**: sin `MAIL_HOST` el bean de mail se creaba igual (host vacío) y su indicador tumbaba `/actuator/health` — el que Docker usa para reiniciar el contenedor. `management.health.mail.enabled=false` (una caída del SMTP no debe reiniciar el sistema). Verificado: `{"status":"UP"}`

### Mejoras de interfaz (pendiente 4 — completado)
- **Logo de la empresa en el sidebar**: usa `logoBase64` de Configuración → Empresa en tarjeta blanca centrada con caption "Express Quinuapata · VRAEM SAC" debajo; fallback al ícono si no hay logo (login ya lo hacía)
- **Alerta "turno de caja abierto +24 h"** en `/gerente` → panel Cajas de operadores: badge rojo "N +24 h", banner explicando el impacto, fila del operador en rojo con "abierta hace X h" (probado con la caja de Carlos: 233 h)
- **REPORTES para ADMIN_AGENCIA con alcance forzado**: `SecurityConfig` + `@PreAuthorize` + `@RequiereModulo("REPORTES")` por endpoint; `resolveAgencia()` ignora el `agenciaId` del query param si hay agencia en contexto (JWT). `/reportes` oculta selectores de Agencia/Usuario para ADMIN_AGENCIA. **Probado**: Elena pidió `agenciaId=1` (Huamanga S/280) y recibió solo Kimbiri (vacío); export de caja ajena bloqueado vía `verificarAcceso`
- Capturas Playwright en claro/oscuro: `frontend/screenshot-prelanzamiento.js` y `screenshot-gerencial.js`

### Estado de pendientes técnicos (pendiente 5)
- [x] Health check `/actuator/health` → UP
- [x] Bloqueo por `intentos_fallidos` verificado (con fix de raíz)
- [ ] Push a GitHub (sigue sin remoto)
- [ ] Migraciones **V5–V9** en producción al desplegar (V8 y V9 son nuevas de hoy)

---

## PENDIENTES — Plan de pre-lanzamiento

### 1. Auditoría UX restante (capturas Playwright a detalle, claro/oscuro, por rol)
Método ya probado: capturar → analizar qué va / qué no va / qué falta → corregir → re-capturar.
- [ ] `/usuarios` — CRUD de cuentas + asignación de módulos (probar como SUPER_ADMIN y como GERENTE con las guardas nuevas)
- [ ] `/agencias` — jerarquía principal/sucursal, métricas, asignación de encargados
- [ ] `/configuracion` — los 6 tabs (Empresa con la cuota combi nueva, Rutas, Tarifas, Temporadas, Vehículos, Conductores)
- [ ] `/auditoria` — como SUPER_ADMIN (filtros, exports PDF/Excel, actividad)
- [ ] Segunda pasada fina a `/gerente` y `/reportes` (ya auditados hoy, revisar con datos de la simulación)

### 2. Simulación de operación real (UAT con datos ficticios) — ANTES de lanzar
Simular **1 semana a 1 mes de trabajo** de la empresa con datos no reales, como si los usuarios reales estuvieran operando, para detectar fallas y cosas que sobran:
- [ ] Guion diario por rol:
  - OPERADOR (Huamanga y Kimbiri): abrir caja → vender 10-20 pasajes (combi y camioneta, con y sin promo) → registrar 3-5 encomiendas (contado y por cobrar) → recibir 1-2 externas (pagada por conductor y por cobrar) → entregar encomiendas llegadas → cerrar caja CADA día y cuadrar
  - GERENTE: programar viajes del día siguiente, confirmar salidas (cuota combi) y llegadas, revisar consolidado, panel gerencial y reporte de ingresos semanal
  - ADMIN_AGENCIA: gestión de su sucursal
- [ ] Incluir casos límite: viaje cancelado con pasajeros, encomienda devuelta/observada, descuadre de caja intencional, promo vencida, asiento doble reservado, día de temporada alta (tarifa especial)
- [ ] Registrar TODO problema en una lista: errores, pasos confusos, datos faltantes, pantallas/funciones que nadie usó (candidatas a quitar)
- [ ] Al final: cuadrar caja vs reportes vs manifiestos del período completo — los totales deben coincidir al céntimo
- [ ] Se puede automatizar parte del guion con Playwright (base ya existe en `frontend/screenshot-*.js`) para generar el mes de datos rápido

### 3. Equipamiento recomendado por agencia (documentar y validar con Kevin)
- [ ] **Por cada agencia/sucursal**: PC o laptop (Chrome actualizado), **impresora térmica 80 mm** (tickets de pasaje, comprobantes de encomienda, cierre de caja), impresora A4 (manifiestos MTC, liquidaciones), internet estable (mín. 10 Mbps) + plan de datos de respaldo, UPS o estabilizador (cortes de luz en el VRAEM), celular con Yape/Plin de la empresa para cobros digitales
- [ ] Opcional: lector de código QR/barras (tracking de encomiendas), segunda pantalla para el mostrador
- [ ] Definir dónde se aloja producción (VPS) y quién administra los backups

### 4. Mejoras de interfaz anotadas — ✅ COMPLETADO (sesión parte 3)
- [x] **Logo de la empresa en el sidebar** (con fallback al ícono si no hay logo)
- [x] Alerta "turno de caja abierto +24 h" en el panel gerencial
- [x] Permitir REPORTES a ADMIN_AGENCIA con alcance forzado a su agencia

### 5. Técnicos
- [ ] **Push a GitHub** — el repo no tiene remoto configurado (crear repo privado y conectar)
- [x] **Health check `DOWN`** — era el indicador de mail sin SMTP; deshabilitado (no debe reiniciar el contenedor)
- [ ] **Migraciones V5–V9 en producción** al desplegar (con backup previo; el deploy no las corre solo)
- [x] Verificar bloqueo por `intentos_fallidos` en login — no funcionaba (rollback); corregido y probado

### 6. Limpieza de datos de prueba
- [ ] Confirmar llegada de los 4 viajes EN_RUTA del 13 de mayo (ya tienen alerta roja en /viajes)
- [ ] Corregir viaje con conductor "Super Admin Sistema" (seed)
- [ ] Cerrar el turno de caja de Carlos (+228 h abierto)

### 7. Funcionalidades nuevas (post-lanzamiento)
- [ ] Portal del conductor `/conductor` (rol existe, página no)
- [ ] Tracking QR público (backend listo, falta UI de escaneo)
- [ ] Notificaciones WebSocket al operador cuando llega un pasaje reservado
- [ ] Tests de integración Auth/Viajes/Pasajes + E2E Playwright

### 8. Entrega
- [ ] Manual PDF para usuario final (operador)
- [ ] Manual PDF para administrador del sistema
- [ ] Capacitación con usuarios reales de la empresa
- [ ] Entrega formal con firma de Kevin Sandoval Torres

### Para continuar en la próxima sesión, decirle al asistente:
> "Continúa desde PROGRESS.md — quiero trabajar en el pendiente [N]."
