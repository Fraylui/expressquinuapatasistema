# Manual de Trabajo — Express Quinuapata VRAEM SAC
**Sistema de gestión de transporte y encomiendas**
Versión: junio 2026

---

## Índice

1. [Roles y accesos](#1-roles-y-accesos)
2. [Inicio de sesión](#2-inicio-de-sesión)
3. [Flujo diario del OPERADOR](#3-flujo-diario-del-operador)
4. [Módulo Caja](#4-módulo-caja)
5. [Módulo Pasajes (Ventas)](#5-módulo-pasajes-ventas)
6. [Módulo Encomiendas](#6-módulo-encomiendas)
7. [Módulo Encomiendas Externas](#7-módulo-encomiendas-externas)
8. [Módulo Viajes](#8-módulo-viajes)
9. [Módulo Manifiestos](#9-módulo-manifiestos)
10. [Rendiciones de efectivo](#10-rendiciones-de-efectivo)
11. [Módulo Reportes](#11-módulo-reportes)
12. [Panel Gerente](#12-panel-gerente)
13. [Configuración (ADMIN_AGENCIA / SUPER_ADMIN)](#13-configuración)
14. [Reglas de negocio importantes](#14-reglas-de-negocio-importantes)
15. [Errores frecuentes y soluciones](#15-errores-frecuentes-y-soluciones)

---

## 1. Roles y accesos

| Rol | Descripción | Alcance |
|-----|-------------|---------|
| **SUPER_ADMIN** | Administrador total del sistema | Todo el sistema |
| **GERENTE** | Gerencia general de la empresa | Todas las agencias |
| **ADMIN_AGENCIA** | Administrador de una agencia/sucursal | Su agencia y sucursales dependientes |
| **OPERADOR** | Personal de ventanilla | Solo su agencia o sucursal |

> **Importante:** Un usuario nuevo no puede operar hasta que el GERENTE o SUPER_ADMIN le asigne los módulos correspondientes desde **Usuarios → [nombre] → Módulos**.

### Módulos disponibles

| Módulo | Qué permite |
|--------|-------------|
| **VENTAS** | Vender pasajes, gestionar viajes |
| **ENCOMIENDAS** | Registrar y entregar encomiendas |
| **CAJA** | Abrir turno, ver movimientos, cerrar turno, rendiciones |
| **MANIFIESTOS** | Crear y ver manifiestos de carga |
| **REPORTES** | Ver reportes de ingresos |
| **CONFIGURACION** | (Solo ADMIN_AGENCIA+) Gestionar flota, rutas, tarifas |

---

## 2. Inicio de sesión

1. Ingrese a la dirección del sistema en su navegador.
2. Escriba su **correo electrónico** y **contraseña**.
3. Haga clic en **Iniciar sesión**.

> El sistema bloquea la cuenta después de **5 intentos fallidos** en un minuto. Si esto ocurre, espere 1 minuto o contacte al administrador.

---

## 3. Flujo diario del OPERADOR

Este es el orden correcto de trabajo cada día:

```
1. Abrir turno de caja
       ↓
2. Vender pasajes / registrar encomiendas
       ↓
3. Confirmar salida de vehículos (cuando el vehículo parte)
       ↓
4. Generar manifiesto de cada viaje
       ↓
5. Entregar encomiendas en destino (módulo Encomiendas → Entregar)
       ↓
6. Cerrar turno de caja al final del día (con arqueo)
       ↓
7. Declarar rendición si corresponde
```

---

## 4. Módulo Caja

### 4.1 Abrir turno

**Debe hacerse lo primero, antes de cualquier otra operación del día.**

1. Ir a **Caja** en el menú lateral.
2. Si no hay turno abierto, aparece el botón **Abrir turno**.
3. Ingresar el **monto de apertura** (dinero en caja al iniciar el día).
4. Confirmar.

> Solo puede haber **un turno abierto por usuario** a la vez.

### 4.2 Ver movimientos del turno

En la pestaña **Turno actual** verá todos los ingresos y egresos del día en tiempo real:

| Etiqueta | Tipo de movimiento |
|----------|--------------------|
| Azul — PASAJE | Venta de pasaje |
| Naranja — ENCOMIENDA | Encomienda cobrada en origen |
| Ámbar — CONTRAENTREGA | Encomienda cobrada en destino (POR_COBRAR) |
| Cian — EXTERNA | Encomienda del conductor (ingreso del conductor, no la empresa) |
| Verde azulado — CUOTA COMBI | Cuota de salida de combi (S/ 10.00) |
| Rojo — EGRESO | Salida de dinero registrada manualmente |

### 4.3 Cerrar turno (arqueo)

Al final del día:

1. Hacer clic en **Cerrar turno**.
2. Completar la **tabla de denominaciones**: ingresar cuántos billetes y monedas de cada tipo hay físicamente en caja.
   - El sistema calcula el total contado automáticamente.
3. Revisar si hay **diferencia** (faltante o sobrante) entre lo que dice el sistema y lo que contó físicamente.
4. Confirmar el cierre.

> **Atención:** Si hay un faltante de S/ 10.00, verifique que la cuota de salida de combi esté en físico — el sistema la carga automáticamente a su caja cuando usted confirma la salida del vehículo.

### 4.4 Pestaña Rendiciones

Ver sección [10. Rendiciones de efectivo](#10-rendiciones-de-efectivo).

---

## 5. Módulo Pasajes (Ventas)

### 5.1 Vender un pasaje

**Requisito previo: tener el turno de caja abierto.**

1. Ir a **Pasajes** en el menú.
2. Hacer clic en **Nuevo pasaje**.
3. Completar el formulario:
   - **Viaje**: seleccionar el viaje programado.
   - **Cliente**: buscar por DNI. Si el cliente no existe, ingresar sus datos y se crea automáticamente.
   - **Asiento**: seleccionar el número de asiento disponible.
   - **Tarifa**: el sistema la propone según la ruta y temporada vigente.
   - **Descuento/Promoción**: si aplica, seleccionar la promoción activa.
   - **Método de pago**: EFECTIVO, YAPE, PLIN o TRANSFERENCIA.
4. Hacer clic en **Registrar pasaje**.
5. El sistema genera automáticamente el comprobante PDF para imprimir.

> **Nota sobre DNI:** Si un cliente ya existe por su DNI, sus datos se cargan automáticamente. El nombre no se actualiza aunque ingrese uno diferente — se usa el nombre ya registrado en el sistema.

### 5.2 Imprimir comprobante

El comprobante se genera en formato de **ticket 80mm** (compatible con impresoras térmicas). Haga clic en el ícono de impresora junto a cada pasaje para reimprimir.

---

## 6. Módulo Encomiendas

### 6.1 Registrar una encomienda

**Requisito previo: tener el turno de caja abierto si el pago es en origen.**

1. Ir a **Encomiendas** → **Nueva encomienda**.
2. Completar:
   - **Remitente y Destinatario**: buscar por DNI o crear nuevo.
   - **Descripción del paquete**: contenido, peso.
   - **Ruta**: origen → destino.
   - **Conductor**: quién transporta el paquete.
   - **Modalidad de pago**:
     - **EFECTIVO / YAPE / PLIN / TRANSFERENCIA** → se cobra ahora en origen y se registra en su caja.
     - **POR_COBRAR** → se cobra al entregar en destino (contraentrega). En origen queda S/ 0.00 en caja.
3. Registrar.
4. Imprimir el comprobante de encomienda.

### 6.2 Entregar una encomienda en destino

Cuando llega un paquete para entregar:

1. Ir a **Encomiendas** → buscar por número (EXP-XXXXX) o DNI del destinatario.
2. Hacer clic en **Entregar**.
3. Si era POR_COBRAR: confirmar el cobro al destinatario — el ingreso se registra en la caja de la agencia destino.
4. El sistema genera el comprobante de entrega.

---

## 7. Módulo Encomiendas Externas

Son encomiendas que transporta el **conductor por cuenta propia** (no de la empresa). El sistema las registra solo para control interno.

1. Ir a **Encomiendas Externas**.
2. Registrar: conductor, remitente, destinatario, descripción y monto.
3. El comprobante indica explícitamente **"Pertenece al Conductor"**.

> El dinero de estas encomiendas va al conductor, no a la empresa. En caja aparecen como tipo EXTERNA solo a efectos informativos.

---

## 8. Módulo Viajes

### 8.1 Crear un viaje

1. Ir a **Viajes** → **Nuevo viaje**.
2. Seleccionar: vehículo, conductor, ruta, fecha y hora de salida programada.
3. Guardar. El viaje queda en estado **PROGRAMADO**.

### 8.2 Confirmar salida

**Requisito previo obligatorio: tener el turno de caja abierto.**

Cuando el vehículo va a partir:

1. Ir a **Viajes** → localizar el viaje.
2. Hacer clic en **Confirmar salida**.
3. El sistema registra automáticamente la **cuota de salida de combi (S/ 10.00)** en la caja del usuario que confirma.
4. El viaje cambia a estado **EN_RUTA**.

> **Error frecuente:** Si aparece *"Debe tener un turno de caja abierto para registrar la cuota de salida"*, vaya primero a **Caja** y abra su turno del día.

### 8.3 Estados de un viaje

| Estado | Significado |
|--------|-------------|
| PROGRAMADO | Creado, aún no ha partido |
| EN_RUTA | Salida confirmada, en camino |
| COMPLETADO | Llegó a destino |
| CANCELADO | Anulado |

---

## 9. Módulo Manifiestos

El manifiesto es el registro oficial de pasajeros y encomiendas que lleva cada viaje.

### 9.1 Generar manifiesto

1. Ir a **Manifiestos** → **Nuevo manifiesto**.
2. Seleccionar el viaje.
3. El sistema lista automáticamente los pasajes y encomiendas asociados.
4. Hacer clic en **Generar** → se crea el PDF oficial.

### 9.2 Reimprimir

Desde la lista de manifiestos busque por fecha, ruta o número y haga clic en el ícono de impresora.

> La hora en el manifiesto se muestra en **hora Lima (GMT-5)**.

---

## 10. Rendiciones de efectivo

Las rendiciones son la entrega periódica del efectivo acumulado en cada agencia a la gerencia general.

### 10.1 ¿Cuándo rendir?

El sistema genera una alerta cuando:
- El efectivo pendiente de rendir supera **S/ 1,500**, o
- Han pasado más de **7 días** desde la última rendición.

No espere la alerta — si el gerente lo solicita antes, declare la rendición igualmente.

### 10.2 Declarar una rendición (OPERADOR / ADMIN_AGENCIA)

1. Ir a **Caja** → pestaña **Rendiciones**.
2. Revise el monto **"Pendiente de rendir"** (suma de los cierres de turno no rendidos aún).
3. Hacer clic en **Declarar rendición**.
4. Completar:
   - **Modalidad**: ENTREGA_DIRECTA (en mano al gerente) o DEPOSITO_BANCARIO.
   - Si es depósito: ingresar el **número de operación bancaria**.
   - **Monto declarado**: el monto que está entregando físicamente.
5. Confirmar.
6. El sistema genera el comprobante **REN-YYYY-NNNNN** en PDF con espacio para firma.

La rendición queda en estado **PENDIENTE** hasta que gerencia la confirme.

### 10.3 Confirmar una rendición (GERENTE / SUPER_ADMIN)

1. Ir a **Caja** → pestaña **Rendiciones** → panel por agencia.
2. Localizar la rendición en estado PENDIENTE.
3. Hacer clic en **Confirmar**.
4. Si el monto recibido no coincide con lo declarado:
   - Debe ingresar una **observación** obligatoria explicando la diferencia.
   - La rendición queda como **OBSERVADA** para seguimiento.
5. Si todo cuadra: queda como **CONFIRMADA**.

---

## 11. Módulo Reportes

| Rol | Lo que puede ver |
|-----|-----------------|
| OPERADOR | Solo ingresos de su agencia |
| ADMIN_AGENCIA | Su agencia y sucursales dependientes |
| GERENTE / SUPER_ADMIN | Todas las agencias |

### 11.1 Filtros disponibles

- **Rango de fechas**: desde / hasta.
- **Agencia**: (GERENTE puede filtrar por cualquiera).
- **Usuario**: ver solo los ingresos de un cajero específico.
- **Tipo de vehículo**: COMBI o CAMIONETA (flujos separados).
- **Categoría**: PASAJE, ENCOMIENDA, CUOTA_SALIDA_COMBI, etc.

### 11.2 Reportes disponibles

| Reporte | Descripción |
|---------|-------------|
| Ingresos por servicio | Totales agrupados por tipo de ingreso |
| Evolución diaria | Ingresos día a día en el período seleccionado |
| Por usuario | Desglose por cajero |
| Por vehículo / conductor | Rendimiento por unidad o conductor |

---

## 12. Panel Gerente

Acceso exclusivo para GERENTE y SUPER_ADMIN.

Muestra en tiempo real:
- **KPIs del día**: total ingresos, pasajes vendidos, encomiendas registradas.
- **Ingresos por categoría**: pasajes vs. encomiendas vs. cuotas de combi.
- **Resumen por agencia**: actividad de cada sede.
- **Rendiciones pendientes**: agencias que deben entregar efectivo con alerta de monto o días.

---

## 13. Configuración

Acceso para **ADMIN_AGENCIA** (su agencia) y **SUPER_ADMIN** (todo el sistema).

| Sección | Qué se configura |
|---------|-----------------|
| **Empresa** | Nombre, RUC, dirección, logo, **cuota de salida de combi** |
| **Vehículos** | Placa, tipo (COMBI/CAMIONETA), capacidad, estado |
| **Conductores** | Nombre, licencia, agencia |
| **Rutas** | Origen, destino, duración estimada |
| **Tarifas** | Precio base por ruta y tipo de vehículo |
| **Temporadas** | Períodos de tarifa especial (alta/baja temporada) |

> **Restricción:** Solo se pueden registrar vehículos tipo **COMBI** o **CAMIONETA**. No existen otros tipos en el sistema.

---

## 14. Reglas de negocio importantes

### Caja
- Cada usuario tiene su **propia caja individual**. Dos operadores en la misma agencia tienen cajas completamente separadas.
- La caja del **operador origen** registra: ventas de pasajes, encomiendas cobradas en origen, cuotas de salida de combi.
- La caja del **operador destino** registra: cobro de encomiendas POR_COBRAR al entregarlas.
- La **cuota de salida de combi (S/ 10.00)** se carga automáticamente a quien confirma la salida — ese dinero debe estar en el efectivo físico del turno.

### Separación contable
- Ingresos de **COMBI** y **CAMIONETA** son contablemente independientes — en reportes filtre por tipo de vehículo para verlos por separado.
- Encomiendas externas (del conductor) **no son ingresos de la empresa**.

### Clientes
- Se identifican por **DNI**. Si ya existe, el registro se reutiliza sin actualizar el nombre.
- Si un cliente viene con otro nombre al registrado, se opera igual — el sistema lo reconoce por DNI.

### Alcance por agencia
- Un OPERADOR de agencia A no puede ver datos de agencia B en ningún módulo.
- Un ADMIN_AGENCIA ve su agencia y todas sus sucursales dependientes.
- El GERENTE ve todo sin restricción.

---

## 15. Errores frecuentes y soluciones

| Mensaje de error | Causa | Solución |
|-----------------|-------|----------|
| *"Debe tener un turno de caja abierto para registrar la cuota de salida"* | Intentó confirmar salida sin abrir caja | Ir a **Caja** → **Abrir turno** |
| *"Ya tiene un turno abierto"* | Intentó abrir segunda caja sin cerrar la anterior | Cerrar el turno activo primero |
| *"No tiene acceso a este módulo"* | El módulo no está asignado a su usuario | Contactar al GERENTE para que asigne el módulo |
| *"Credenciales inválidas"* | Contraseña incorrecta (respetar mayúsculas) | Verificar la contraseña; tras 5 intentos esperar 1 minuto |
| Arqueo muestra faltante de S/ 10.00 | La cuota de combi ya fue registrada pero el efectivo físico estaba separado | El sistema ya la contabilizó — es correcta, incluya ese billete en el conteo |
| No aparece el módulo en el menú | El módulo no fue asignado | Contactar al GERENTE o SUPER_ADMIN |
| El viaje no aparece para vender pasaje | El viaje está COMPLETADO o CANCELADO | Verificar estado del viaje; crear nuevo si corresponde |

---

*Para soporte técnico o problemas de acceso, comunicarse con el administrador del sistema.*

> Cada usuario es responsable de los movimientos registrados bajo su cuenta. No comparta su contraseña.
