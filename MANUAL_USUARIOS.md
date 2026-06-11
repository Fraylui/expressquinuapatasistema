# Manual de Trabajo por Rol — Express Quinuapata VRAEM SAC

> Cómo trabaja cada persona en el sistema, qué puede hacer y en qué orden.

---

## Índice

1. [Vista rápida de roles](#1-vista-rápida-de-roles)
2. [OPERADOR — trabajo diario](#2-operador--trabajo-diario)
3. [CONDUCTOR — su panel](#3-conductor--su-panel)
4. [ADMIN_AGENCIA — gestión de sucursal](#4-admin_agencia--gestión-de-sucursal)
5. [GERENTE — control y reportes](#5-gerente--control-y-reportes)
6. [SUPER_ADMIN — administración total](#6-super_admin--administración-total)
7. [Flujos transversales](#7-flujos-transversales)
8. [Reglas importantes que todos deben conocer](#8-reglas-importantes-que-todos-deben-conocer)

---

## 1. Vista rápida de roles

| Rol | Quién es | Acceso principal |
|---|---|---|
| `OPERADOR` | Persona en ventanilla | Ventas, encomiendas, caja |
| `CONDUCTOR` | Conductor de bus | Solo sus viajes asignados |
| `ADMIN_AGENCIA` | Jefe de agencia/sucursal | Su agencia + usuarios de ella |
| `GERENTE` | Gerencia general | Dashboard, reportes, configuración |
| `SUPER_ADMIN` | Administrador del sistema | Todo + auditoría + empresa |

---

## 2. OPERADOR — trabajo diario

El operador es quien atiende en ventanilla. Su día gira en torno a tres acciones: **vender pasajes, registrar encomiendas y manejar la caja**.

### Inicio de turno

1. Ingresar a `/login` con su usuario y contraseña.
2. El sistema lo lleva al **Dashboard** (`/`) donde ve los viajes del día y los KPIs de su agencia.
3. **Abrir la caja del día** en `/caja` → botón "Abrir Caja". Sin caja abierta no puede registrar movimientos de dinero.

---

### Vender pasajes — `/pasajes`

1. Ir a **Viajes** (`/viajes`) y buscar el viaje por fecha y ruta.
2. Seleccionar el viaje → se abre el mapa de asientos del bus.
3. Hacer clic en un asiento disponible (color verde).
4. Ingresar datos del pasajero:
   - DNI (8 dígitos) o RUC (11 dígitos) — el sistema valida automáticamente.
   - Si el cliente ya existe en el sistema, sus datos se cargan solos.
5. Elegir si aplica alguna **promoción** activa.
6. Confirmar la venta → el sistema genera el **código QR del boleto**.
7. Imprimir o mostrar el QR al pasajero.

> **Regla importante:** Dos operadores no pueden vender el mismo asiento al mismo tiempo. El sistema bloquea el asiento en el momento de selección.

---

### Registrar encomienda — `/encomiendas`

1. Ir a **Encomiendas** y hacer clic en "Nueva Encomienda".
2. Ingresar datos del remitente y destinatario (DNI/RUC).
3. Describir el paquete: peso, descripción, valor declarado.
4. Asociar al viaje que la transportará.
5. El sistema genera un **código de rastreo** único.
6. El cliente puede rastrear su encomienda en `/tracking` con ese código (sin necesidad de iniciar sesión).

**Estados por los que pasa una encomienda:**

```
REGISTRADA → PAGADA → EN_AGENCIA_ORIGEN → CARGADA → EN_TRÁNSITO
→ EN_AGENCIA_DESTINO → LISTA_PARA_ENTREGAR → ENTREGADA
```

Si hay problema: puede pasar a `DEVUELTA` o `PERDIDA`.

**Encomiendas externas** (`/encomiendas-externas`): para paquetes que vienen de otras empresas y se reciben en la agencia para entrega final.

---

### Manifiesto de viaje — `/manifiestos`

Antes de que salga el bus, el operador debe **generar el manifiesto**:

1. Ir a **Manifiestos** y buscar el viaje.
2. Hacer clic en "Generar Manifiesto".
3. El sistema consolida automáticamente pasajeros y encomiendas del viaje.
4. Revisar y confirmar.
5. Imprimir el PDF para entregarlo al conductor.

---

### Cierre de caja — `/caja`

Al terminar el turno:

1. Ir a **Caja** y revisar todos los movimientos del día (ingresos por pasajes, encomiendas, egresos).
2. Hacer clic en "Cerrar Caja".
3. Ingresar el monto físico contado.
4. El sistema calcula si hay diferencia (sobrante o faltante).
5. El reporte queda guardado para que el gerente lo revise.

---

## 3. CONDUCTOR — su panel

El conductor tiene un panel simplificado en `/conductor`.

### Qué puede hacer

- **Ver sus viajes asignados**: fecha, ruta, origen, destino, hora de salida.
- **Ver el manifiesto de cada viaje**: lista de pasajeros y encomiendas que lleva.
- **No puede** vender, modificar datos ni acceder a caja.

### Cómo trabaja

1. Iniciar sesión → el sistema lo redirige automáticamente a `/conductor`.
2. Ver el viaje del día o próximos viajes.
3. Descargar o consultar el manifiesto antes de salir.
4. Si hay un cambio de viaje, el operador o admin de agencia se lo notifica y él ve el cambio en su panel.

---

## 4. ADMIN_AGENCIA — gestión de sucursal

El administrador de agencia supervisa las operaciones de **su sucursal** y gestiona el personal.

### Gestión de usuarios de su agencia

1. Ir a **Usuarios** (`/usuarios`).
2. Crear nuevos operadores o conductores asignados a su agencia.
3. Asignar **módulos granulares** a cada usuario (ejemplo: darle acceso a VENTAS y ENCOMIENDAS pero no a CAJA).
4. Desactivar usuarios que ya no trabajen.

> Solo puede ver y gestionar usuarios de **su propia agencia**. No puede ver otras agencias.

### Supervisión operativa

- Revisar las **cajas del día** de sus operadores.
- Consultar el estado de encomiendas de su agencia.
- Ver los viajes programados desde/hacia su agencia.
- Revisar el **Dashboard** con KPIs de su sucursal.

### Gestión de clientes — `/clientes`

- Registrar o buscar clientes por DNI/RUC.
- Ver historial de compras de un cliente.
- Corregir datos de clientes si hay errores.

---

## 5. GERENTE — control y reportes

El gerente tiene visión de toda la empresa pero **no puede tocar configuración crítica del sistema**.

### Dashboard gerencial — `/gerente`

Al entrar ve:
- Ingresos del día/semana/mes comparados con períodos anteriores.
- Viajes realizados vs. programados.
- Encomiendas por estado.
- Agencias con mejor/peor rendimiento.

### Reportes — `/reportes`

Puede generar y exportar reportes en **Excel o PDF**:

| Reporte | Qué muestra |
|---|---|
| Ventas por período | Pasajes vendidos, ingresos, rutas más populares |
| Encomiendas | Volumen, estados, ingresos por agencia |
| Caja | Movimientos, cierres, diferencias por operador |
| Conductores | Viajes realizados, rutas asignadas |

Pasos:
1. Ir a **Reportes** (`/reportes`).
2. Seleccionar tipo de reporte y rango de fechas.
3. Filtrar por agencia si necesita.
4. Hacer clic en "Exportar Excel" o "Exportar PDF".

### Configuración operativa — `/configuracion`

El gerente puede ajustar:
- **Rutas**: crear o desactivar rutas entre ciudades.
- **Tarifas**: actualizar precios por ruta y tipo de asiento.
- **Promociones** (`/promociones`): crear descuentos con fecha de vigencia.
- **Vehículos**: registrar buses, capacidad, características.
- **Conductores**: registrar conductores, licencias, datos de contacto.

> **No puede** acceder a auditoría ni a configuración de empresa (eso es solo SUPER_ADMIN).

---

## 6. SUPER_ADMIN — administración total

Solo existe **un SUPER_ADMIN** en el sistema. Es el administrador técnico/dueño.

### Configuración de empresa — `/configuracion`

- Datos legales de la empresa (RUC, razón social, dirección).
- Logo e imagen corporativa.
- Configuraciones globales del sistema.

### Gestión de agencias — `/agencias`

- Crear nuevas agencias/sucursales con su dirección y datos.
- Activar o desactivar agencias.
- Asignar administradores a cada agencia.
- Ver la **jerarquía completa**: empresa → agencias → usuarios.

### Auditoría — `/auditoria`

Registro completo de **quién hizo qué y cuándo**:
- Cada acción importante queda registrada (ventas, cambios de precio, modificaciones de usuarios).
- Se puede filtrar por usuario, tipo de acción, fecha y agencia.
- Útil para investigar inconsistencias en caja o cambios no autorizados.

### Gestión global de usuarios — `/usuarios`

- Ver y gestionar usuarios de **todas las agencias**.
- Cambiar roles.
- Restablecer contraseñas.
- Crear nuevos ADMIN_AGENCIA y asignarlos a sus sucursales.

---

## 7. Flujos transversales

### Ciclo completo de un viaje

```
SUPER_ADMIN/GERENTE crea la ruta y tarifa
         ↓
GERENTE programa el viaje (asigna bus y conductor)
         ↓
OPERADOR vende pasajes y registra encomiendas
         ↓
OPERADOR genera el manifiesto
         ↓
CONDUCTOR consulta el manifiesto y sale
         ↓
OPERADOR en destino recibe encomiendas y actualiza estados
         ↓
GERENTE revisa el reporte de cierre del viaje
```

---

### Tracking público (sin login)

Cualquier persona puede ir a **`/tracking`** e ingresar el código de rastreo de su encomienda para ver en qué estado está. No necesita cuenta.

También están disponibles sin login:
- `/horarios` — horarios de salida por ruta
- `/tarifas` — precios por ruta
- `/sucursales` — direcciones y contacto de agencias

---

### Notificaciones en tiempo real

El sistema tiene **WebSocket activo**. Esto significa que:
- Cuando un asiento se vende, el mapa de asientos de otros operadores se actualiza automáticamente.
- Los cambios de estado de encomiendas se reflejan sin necesidad de recargar la página.

---

## 8. Reglas importantes que todos deben conocer

| Regla | Detalle |
|---|---|
| **Un asiento, una venta** | El sistema bloquea asientos en tiempo real. No se puede duplicar. |
| **Caja obligatoria** | El operador no puede registrar pagos sin tener la caja abierta del día. |
| **DNI = 8 dígitos, RUC = 11** | El sistema valida esto al momento de ingresar. Si el dato está mal, no guarda. |
| **Tracking censurado** | En la vista pública de tracking, los datos personales del destinatario están parcialmente ocultos (privacidad). |
| **Módulos asignables** | Un usuario solo ve en el menú los módulos que su administrador le habilitó. Si no ve una opción, pedirle al ADMIN_AGENCIA que la active. |
| **Sesión segura** | Después de inactividad, la sesión expira. Hay que volver a iniciar sesión. |
| **Intentos de login** | Si se equivoca la contraseña 5 veces seguidas, el acceso se bloquea temporalmente (1 minuto). |
| **Manifiesto antes de salida** | El manifiesto debe generarse antes de que el bus salga. Es requisito operativo. |

---

*Documento generado el 2026-06-10 — Express Quinuapata VRAEM SAC*
