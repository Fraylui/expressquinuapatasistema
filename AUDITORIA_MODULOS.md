# Auditoría Técnica — Módulo por Módulo
## Express Quinuapata VRAEM SAC
**Fecha:** 2026-06-10 | **Revisado por:** Claude Code

---

## Resumen ejecutivo

| Estado | Módulos |
|--------|---------|
| COMPLETO | 21 de 21 |
| PARCIAL / VERIFICAR | 0 de 21 |
| FALTA COMPLETAMENTE | 0 de 21 |

**El sistema está listo para producción.** Todos los módulos verificados. Backup automático configurado el 2026-06-10.

---

## Tabla de estado general

| # | Módulo | Backend | Frontend | Integración | Estado |
|---|--------|:-------:|:--------:|:-----------:|:------:|
| 1 | Auth / Login | COMPLETO | COMPLETO | OK | COMPLETO |
| 2 | Dashboard | COMPLETO | COMPLETO | OK | COMPLETO |
| 3 | Viajes | COMPLETO | COMPLETO | OK | COMPLETO |
| 4 | Pasajes | COMPLETO | COMPLETO | OK | COMPLETO |
| 5 | Encomiendas | COMPLETO | COMPLETO | OK | COMPLETO |
| 6 | Encomiendas Externas | COMPLETO | COMPLETO | OK | COMPLETO |
| 7 | Manifiestos | COMPLETO | COMPLETO | OK | COMPLETO |
| 8 | Caja | COMPLETO | COMPLETO | OK | COMPLETO |
| 9 | Clientes | COMPLETO | COMPLETO | OK | COMPLETO |
| 10 | Promociones | COMPLETO | COMPLETO | OK | COMPLETO |
| 11 | Rutas | COMPLETO | COMPLETO | OK | COMPLETO |
| 12 | Tarifas | COMPLETO | COMPLETO | OK | COMPLETO |
| 13 | Vehículos | COMPLETO | COMPLETO | OK | COMPLETO |
| 14 | Conductores | COMPLETO | COMPLETO | OK | COMPLETO |
| 15 | Usuarios | COMPLETO | COMPLETO | OK | COMPLETO |
| 16 | Agencias | COMPLETO | COMPLETO | OK | COMPLETO |
| 17 | Reportes | COMPLETO | COMPLETO | OK | COMPLETO |
| 18 | Auditoría | COMPLETO | COMPLETO | OK | COMPLETO |
| 19 | Config. Empresa | COMPLETO | COMPLETO | OK | COMPLETO |
| 20 | Tracking Público | COMPLETO | COMPLETO | OK | COMPLETO |
| 21 | WebSocket / Tiempo Real | COMPLETO | COMPLETO | OK | COMPLETO |
| + | `/horarios` (pública) | COMPLETO | VERIFICAR | — | VERIFICAR |
| + | `/sucursales` (pública) | COMPLETO | VERIFICAR | — | VERIFICAR |

---

## Detalle módulo por módulo

---

### 1. Auth / Login — COMPLETO

**Backend** (`AuthController.java`)
- `POST /api/auth/login` — valida credenciales, registra IP, emite JWT + refresh token
- `POST /api/auth/refresh` — renovación de token con header `X-Refresh-Token`
- `POST /api/auth/logout` — limpia sesión, registra en auditoría
- `GET /api/auth/me` — info del usuario actual
- `POST /api/auth/desbloquear` — solo SUPER_ADMIN
- `GET /api/auth/intentos-fallidos` — solo SUPER_ADMIN
- Bloqueo tras 5 intentos fallidos (1 min)
- Logs de IP en cada intento

**Frontend** (`/login`)
- Formulario con validación Zod
- Branding dinámico (logo desde BD)
- Redirección si ya está autenticado
- Animaciones y dark mode

**Nada que agregar.**

---

### 2. Dashboard — COMPLETO

**Backend**
- KPIs en tiempo real por agencia
- WebSocket para notificaciones en vivo
- Rate limiting activo

**Frontend** (`/`)
- KPI Cards: viajes hoy, encomiendas, ingresos turno, saldo caja
- Grid de módulos según permisos del usuario (se ocultan los que no tiene)
- Widget de viajes en vivo con asientos disponibles
- Estado de sistema (DB, API, turno de caja)
- Promociones activas del día

**Nada que agregar.**

---

### 3. Viajes — COMPLETO

**Backend** (`ViajeController.java` — 727 líneas)
- CRUD completo con validaciones robustas
- `POST /api/viajes/{id}/confirmar-salida` — cambia a EN_RUTA, encomiendas a EN_TRÁNSITO
- `POST /api/viajes/{id}/confirmar-llegada` — COMPLETADO
- `POST /api/viajes/{id}/cancelar` — solo si está PROGRAMADO/ATRASADO
- `GET /api/viajes/{id}/asientos` — mapa de asientos por tipo de vehículo
- `GET /api/viajes/{id}/liquidacion-pdf` — PDF con pasajeros + encomiendas + totales
- `GET /api/viajes/historial` — paginado con stats
- Validaciones: licencia vigente del conductor, conflictos horarios ±4h, no cambiar vehículo si hay ventas

**Frontend** (`/viajes`)
- Listado con filtros (estado, origen, destino, fecha)
- Mapa de asientos interactivo (SeatMap)
- Crear / editar / cancelar
- Liquidación PDF

**Nada que agregar.**

---

### 4. Pasajes — COMPLETO

**Backend** (`PasajeController.java`)
- `POST /api/pasajes/vender` — con `@RequiereModulo("VENTAS")`
- `POST /api/pasajes/{id}/confirmar` — pago (EFECTIVO / OTROS)
- `POST /api/pasajes/{id}/anular` — con motivo
- `GET /api/pasajes/{id}/ticket` — PDF 80mm (para impresora térmica)
- Aplicación automática de promociones vigentes
- Generación de código de boleta único
- Validación de asientos en tiempo real (sin doble venta)

**Frontend** (`/pasajes`)
- Flujo en 4 pasos: buscar viaje → seleccionar asiento → datos cliente → confirmar pago
- SeatMap interactivo (verde = libre, rojo = ocupado)
- Búsqueda de cliente por DNI/RUC
- QR generado en la preview del ticket
- Formato de impresión 80mm

**Nada que agregar.**

---

### 5. Encomiendas — COMPLETO

**Backend** (`EncomiendaController.java` — 457 líneas)

Máquina de estados:
```
REGISTRADA → RECEPCIONADA → ALMACENADA → CARGADA → EN_TRÁNSITO
→ LLEGADA_AGENCIA → DISPONIBLE → ENTREGADA
```
También: DEVUELTA, OBSERVADA

Endpoints clave:
- Registro, cambio de estado, entrega con firma
- Recepción masiva de viaje
- PDFs: comprobante, comprobante de entrega, etiqueta de envío
- Stats y encomiendas urgentes (de viajes cancelados)
- Tracking público sin login

**Frontend** (`/encomiendas`)
- Registro completo con búsqueda de cliente
- Filtros por estado, destino, fecha
- Timeline de historial de estados
- Formulario de entrega con DNI del receptor
- PDFs: comprobante, etiqueta, comprobante de entrega

**Nada que agregar.**

---

### 6. Encomiendas Externas — COMPLETO

**Backend** (`EncomiendaExternaController.java`)
- Registro de paquetes que llegan de otras empresas
- Entrega final con comprobante
- Ticket PDF

**Frontend** (`/encomiendas-externas`)
- Recepción y seguimiento
- Entrega con comprobante

**Nada que agregar.**

---

### 7. Manifiestos — COMPLETO

**Backend** (`ManifiestoController.java` — 461 líneas)
- Generación automática consolidando pasajeros + encomiendas del viaje
- PDF de pasajeros con tabla: asiento, nombres, tipo doc, num doc, precio, forma de pago
- PDF de encomiendas con tabla: código, descripción, peso, bultos, precio, estado
- Ticket individual por pasajero
- Estados: BORRADOR → EMITIDO → ENVIADO

**Frontend** (`/manifiestos`)
- Generación con un clic
- Vista previa antes de imprimir
- Descarga PDF
- Gestión de estado del manifiesto

**Nada que agregar.**

---

### 8. Caja — COMPLETO

**Backend** (`CajaController.java`)
- Apertura con monto inicial
- Movimientos auto-registrados desde pasajes y encomiendas
- Cierre con ingreso de monto físico contado
- Diferencia calculada automáticamente (sobrante/faltante)
- Vista consolidada por agencia (GERENTE / SUPER_ADMIN)
- Reporte PDF del turno

**Frontend** (`/caja` — 700+ líneas)
- Tabla de denominaciones (S/.200, 100, 50... hasta S/.0.10) para conteo rápido
- Movimientos en tiempo real vía WebSocket
- Historial de turnos cerrados
- Reporte PDF exportable

**Nada que agregar.**

---

### 9. Clientes — COMPLETO

**Backend** (`ClienteController.java`)
- CRUD completo
- Búsqueda por DNI, RUC, CE
- Validación: DNI = 8 dígitos, RUC = 11 dígitos

**Frontend** (`/clientes`)
- Búsqueda rápida por documento
- Creación rápida durante venta de pasajes
- Historial de compras del cliente

**Nada que agregar.**

---

### 10. Promociones — COMPLETO

**Backend** (`PromocionController.java`)
- CRUD de promociones
- Tipos: MONTO_FIJO / PORCENTAJE
- Aplica a: PASAJES / ENCOMIENDAS / AMBOS
- Vigencia por fechas
- Validación de código antes de aplicar
- Toggle activo/inactivo

**Frontend** (`/promociones`)
- CRUD visual
- Calendario de vigencia
- Preview de aplicación del descuento

**Nada que agregar.**

---

### 11. Rutas — COMPLETO

**Backend** (`RutaController.java` + `ConfiguracionRutaController.java`)
- Rutas activas por agencia
- Crear / editar / activar-desactivar
- Campos: código único, origen, destino, distancia km, duración minutos

**Frontend**
- Gestión en `/configuracion`
- Selector en programación de viajes

**Nada que agregar.**

---

### 12. Tarifas — COMPLETO

**Backend** (`TarifaController.java` + `ConfiguracionTarifaController.java`)
- Tarifas públicas sin login (`/api/tarifas/publico`)
- Búsqueda por ruta + tipo vehículo
- Toggle vigente/no vigente

**Frontend**
- Página pública `/tarifas`
- Selector automático en venta de pasajes

**Nada que agregar.**

---

### 13. Vehículos — COMPLETO

**Backend** (`ConfiguracionVehiculoController.java`)
- CRUD con validación de placa única
- Estados: OPERATIVO / MANTENIMIENTO / BAJA
- Campos: placa, tipo, marca, modelo, año, capacidad, color

**Frontend**
- Gestión en `/configuracion`

**Nada que agregar.**

---

### 14. Conductores — COMPLETO

**Backend** (`ConductorQueryController.java` + `ConfiguracionConductorController.java`)
- CRUD con validación de DNI y licencia únicos
- Categorías de licencia: A1, A2, A3, B, C, D, E
- Validación de licencia vigente antes de asignar a viaje
- Panel del conductor: mis viajes, pasajeros, confirmar salida/llegada

**Frontend**
- Panel especial `/conductor` para el rol CONDUCTOR
- Gestión en `/configuracion`

**Nada que agregar.**

---

### 15. Usuarios — COMPLETO

**Backend** (`UsuarioController.java`)
- CRUD completo
- Asignación de rol + agencia
- Activar / desactivar
- Módulos granulares por usuario (`@RequiereModulo` aspect)

**Frontend** (`/usuarios`)
- CRUD de usuarios
- Vista de asignación de módulos: `/usuarios/[id]/modulos`
- SUPER_ADMIN ve todos los usuarios; ADMIN_AGENCIA solo los suyos

**Nada que agregar.**

---

### 16. Agencias — COMPLETO

**Backend** (`AgenciaController.java`)
- Jerarquía: agencia padre → sucursales
- Árbol completo, lista plana, solo principales
- Métricas de la agencia (viajes, ingresos, etc.)
- Solo SUPER_ADMIN puede crear

**Frontend** (`/agencias`)
- Vista jerárquica
- Detalle con métricas
- Crear sucursales bajo una agencia padre

**Nada que agregar.**

---

### 17. Reportes — COMPLETO

**Backend** (`ReporteController.java`)

Endpoints disponibles:
- KPIs gerenciales (ventas, encomiendas, ingresos, diferencias de caja, auditoría)
- Tendencia de los últimos N días
- Distribución de ventas por hora
- Viajes del día con stats
- Encomiendas pendientes
- Comparativa hoy vs. ayer (con delta %)
- Top 5 rutas en N días
- Conductores activos hoy
- Exportación Excel: ventas, encomiendas, caja

**Frontend** (`/reportes`)
- Dashboard con gráficos (Recharts)
- Filtros por agencia y rango de fechas
- Exportación Excel / PDF

**Nada que agregar.**

---

### 18. Auditoría — COMPLETO

**Backend** (`AuditoriaController.java`)
- Registro automático de todos los cambios CRUD
- Login/logout con IP
- Cambios en caja, pasajes, encomiendas
- Cambio de módulos de usuario
- Filtros: usuario, módulo, acción, IP, fecha
- Exportación Excel y PDF

**Frontend** (`/auditoria`)
- Listado paginado con filtros
- Búsqueda por usuario, módulo, acción
- Exportar Excel / PDF
- Acceso exclusivo SUPER_ADMIN

**Nada que agregar.**

---

### 19. Configuración Empresa — COMPLETO

**Backend** (`EmpresaConfigController.java`)
- GET y PUT de configuración global
- Campos: nombre, RUC, dirección, ciudad, teléfono, email, logo (base64)

**Frontend** (`/configuracion`)
- Formulario de configuración
- Upload de logo
- Datos legales

**Nada que agregar.**

---

### 20. Tracking Público — COMPLETO

**Backend**
- `GET /api/tracking/{codigo}` — sin autenticación
- Retorna: código, estado, descripción, fechas, historial completo
- Datos personales censurados parcialmente (privacidad)

**Frontend** (`/tracking`)
- Sin login requerido
- Búsqueda por código de rastreo
- Timeline visual de estados
- Fecha estimada de entrega
- Diseño mobile-friendly

**Nada que agregar.**

---

### 21. WebSocket / Tiempo Real — COMPLETO

**Backend** (`WebSocketEventPublisher.java`)
- Eventos: asiento actualizado, estado de encomienda, encomienda en camino
- Topics por agencia, por viaje, por usuario

**Frontend** (`useWebSocket.ts`)
- Hook activo en caja (movimientos en vivo), encomiendas (cambios de estado), mapa de asientos
- Auto-refresh sin recargar página

**Nada que agregar.**

---

## Fortalezas del sistema

### Seguridad
- JWT con refresh token automático
- Bloqueo tras 5 intentos fallidos
- Control de acceso por rol + por módulo granular (`@RequiereModulo`)
- Rate limiting en endpoints sensibles
- Auditoría completa con IP y datos antes/después

### Performance
- Batch queries para evitar N+1 (especialmente en manifiestos y reportes)
- Caché Caffeine con TTL de 5 minutos
- Connection pooling HikariCP
- Compresión de respuestas HTTP
- WebSocket para evitar polling innecesario

### Experiencia de usuario
- Dark mode integrado
- Formularios con validación en tiempo real (Zod)
- Toasts de confirmación en acciones
- Diseño responsive (móvil, tablet, escritorio)
- Impresión de tickets en formato 80mm para impresoras térmicas

---

## Conclusión

El sistema tiene **cobertura funcional del 100% en todos los módulos**. Verificado el 2026-06-10:

- Páginas públicas `/horarios` y `/sucursales` — implementadas y conectadas a la API
- WebSocket en Nginx — configurado con `Upgrade: websocket` en `nginx/nginx.conf`
- Backup automático — servicio `backup` agregado a `docker-compose.yml`, corre diariamente a las 02:00 AM con rotación de 30 días
- Límites de archivo — 10MB en Spring, 15MB en Nginx, alineados

---

*Auditoría generada el 2026-06-10 — Express Quinuapata VRAEM SAC*
