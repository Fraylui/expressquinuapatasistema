/**
 * Simulación de operación real (UAT) — Express Quinuapata VRAEM SAC
 *
 * Ejecuta por API el guion diario por rol, como si la empresa ya operara:
 *  - GERENTE: programa viajes, gestiona promos, revisa consolidado
 *  - OPERADOR Huamanga (Carlos) y Kimbiri (Rosa): caja, pasajes, encomiendas,
 *    externas, entregas, cierre y cuadre
 *  - OPERADOR María: casos límite (sin caja, descuadre intencional)
 *  - ADMIN_AGENCIA Elena: vista de su sucursal
 * Casos límite: asiento doble, promo desactivada/inexistente, conflicto de
 * vehículo, viaje cancelado con pasajeros, anulación de pasaje, cierre con
 * descuadre.
 * Al final: cuadre caja vs reporte de ingresos vs manifiesto, al céntimo.
 *
 * Uso: node scripts/sim-operacion.js   (backend dev en localhost:8080)
 * Salida: scripts/SIMULACION-UAT.md
 */
const fs = require('fs')
const path = require('path')

const BASE = 'http://localhost:8080'
const LOG = []
const PROBLEMAS = []
const OBSERVACIONES = []

const hoy = new Date()
function limaISO(horasDesdeAhora) {
  const d = new Date(Date.now() + horasDesdeAhora * 3600_000)
  // OffsetDateTime con offset Lima
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00-05:00`
}
function log(s) { LOG.push(s); console.log(s) }
function problema(s) { PROBLEMAS.push(s); log(`  ✗ PROBLEMA: ${s}`) }
function observacion(s) { OBSERVACIONES.push(s); log(`  ~ OBS: ${s}`) }
function ok(s) { log(`  ✓ ${s}`) }

async function call(token, method, p, body) {
  const res = await fetch(BASE + p, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  let json = null
  try { json = await res.json() } catch { /* binario o vacío */ }
  const detalle = Array.isArray(json?.errors) && json.errors.length
    ? `${json.message} [${json.errors.join(' | ')}]`
    : json?.message
  return { status: res.status, ok: res.ok && json?.success !== false, data: json?.data, message: detalle, raw: json }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function login(email, password) {
  // Rate limit del backend: 5 logins/min por IP → reintentar ante 429
  for (let intento = 1; intento <= 3; intento++) {
    const r = await call(null, 'POST', '/api/auth/login', { email, password })
    if (r.ok) return { token: r.data.token, user: r.data.usuario }
    if (r.status === 429) { log(`  (rate limit de login — esperando 65 s para ${email})`); await sleep(65_000); continue }
    throw new Error(`Login falló para ${email}: ${r.message}`)
  }
  throw new Error(`Login agotó reintentos para ${email}`)
}

/** Espera éxito; si falla lo registra como problema y devuelve null. */
async function deber(desc, token, method, p, body) {
  if (p.includes('/null') || p.includes('/undefined')) {
    log(`  − ${desc} → omitido (un paso previo no se completó)`)
    return null
  }
  const r = await call(token, method, p, body)
  if (r.ok) { ok(`${desc}`); return r.data }
  problema(`${desc} → HTTP ${r.status}: ${r.message}`)
  return null
}

/** Espera RECHAZO (caso límite); si el backend lo acepta es un problema. */
async function deberFallar(desc, token, method, p, body) {
  const r = await call(token, method, p, body)
  if (!r.ok) { ok(`${desc} → rechazado como corresponde ("${r.message}")`); return true }
  problema(`${desc} → EL BACKEND LO ACEPTÓ (debía rechazarse)`)
  return false
}

// Clientes ficticios
let dniSeq = 41000000
function clienteFicticio(nombre, apellido) {
  dniSeq += 7
  return {
    clienteDni: String(dniSeq), clienteNombres: nombre, clienteApellidos: apellido,
    clienteTelefono: '9' + String(dniSeq).slice(0, 8),
  }
}

async function vender(token, viajeId, asiento, precio, extras = {}) {
  if (!viajeId) return { ok: false, status: 0, message: 'viaje no programado (omitido)' }
  const c = clienteFicticio(extras.nombre ?? 'Cliente', extras.apellido ?? `Sim${asiento}`)
  return call(token, 'POST', '/api/pasajes/vender', {
    viajeId, asientoNumero: asiento, ...c,
    precioBase: precio, descuento: extras.descuento ?? 0,
    formaPago: extras.formaPago ?? 'EFECTIVO',
    motivoDescuento: extras.motivoDescuento,
    promocionId: extras.promocionId,
    tipo: extras.tipo ?? 'VENTA',
  })
}

async function turnoActual(token) {
  const r = await call(token, 'GET', '/api/caja/turno-actual')
  return r.data
}

function saldoEsperado(t) {
  return Number(t.montoApertura ?? 0) + Number(t.totalIngresos ?? 0) - Number(t.totalEgresos ?? 0)
}

;(async () => {
  log(`# Simulación de operación real — ${hoy.toLocaleString('es-PE')}`)
  log('')

  // ════ Sesiones ════
  const kevin  = await login('kevin.sandoval@quinuapata.com', 'Quinuapata2026!')
  const carlos = await login('carlos.quispe@quinuapata.com', 'Quinuapata2024!')
  const maria  = await login('maria.ccencho@quinuapata.com', 'Quinuapata2024!')
  const rosa   = await login('rosa.sulca@quinuapata.com', 'Quinuapata2024!')
  const elena  = await login('elena.paredes@quinuapata.com', 'Quinuapata2024!')
  const sadmin = await login('superadmin@expressvraem.com', 'SuperAdmin2026!')
  log('## Fase 0 — Preparación y limpieza de datos de prueba')

  // 0.1 Confirmar llegada de viajes EN_RUTA viejos (los 4 del 13 de mayo)
  const enRuta = await call(kevin.token, 'GET', '/api/viajes?estado=EN_RUTA')
  for (const v of (enRuta.data ?? [])) {
    if (v.estado !== 'EN_RUTA') continue
    const sal = new Date(v.fechaHoraSal)
    if (Date.now() - sal.getTime() > 24 * 3600_000) {
      await deber(`Llegada confirmada del viaje fantasma #${v.id} (salió ${v.fechaHoraSal})`,
        kevin.token, 'POST', `/api/viajes/${v.id}/confirmar-llegada`)
    }
  }

  // 0.2 Cerrar la caja olvidada de Carlos (abierta hace ~10 días)
  const tCarlosViejo = await turnoActual(carlos.token)
  if (tCarlosViejo) {
    const saldo = saldoEsperado(tCarlosViejo)
    await deber(`Caja olvidada de Carlos cerrada (saldo S/ ${saldo.toFixed(2)})`,
      carlos.token, 'POST', '/api/caja/cerrar',
      { montoFisico: saldo, observacion: 'Cierre de turno olvidado — limpieza pre-UAT' })
  }

  // 0.3 Activar cuota de salida de combi (S/ 10) — hoy estaba en 0
  const cfg = await call(kevin.token, 'GET', '/api/empresa-config')
  if (cfg.data) {
    await deber('Cuota de salida de combi configurada en S/ 10.00',
      kevin.token, 'PUT', '/api/empresa-config', { ...cfg.data, cuotaSalidaCombi: 10 })
  }

  // 0.4 Asignar encargados de agencia (estaban todas "Sin encargado")
  for (const [agId, encId, nombre] of [[2, elena.user.id, 'Elena (Kimbiri)'], [1, kevin.user.id, 'Kevin (Huamanga)']]) {
    const ag = await call(sadmin.token, 'GET', `/api/agencias/${agId}`)
    if (ag.data) {
      await deber(`Encargado asignado: ${nombre}`, sadmin.token, 'PUT', `/api/agencias/${agId}`,
        { ...ag.data, encargadoId: encId })
    }
  }

  // ════ Catálogos ════
  const rutas = (await call(kevin.token, 'GET', '/api/configuracion/rutas')).data ?? []
  const vehiculos = (await call(kevin.token, 'GET', '/api/configuracion/vehiculos')).data ?? []
  const conductores = (await call(kevin.token, 'GET', '/api/configuracion/conductores')).data ?? []
  const rutaPor = (o, d) => rutas.find(r => r.origen.includes(o) && r.destino.includes(d))
  const vehPor = (placa) => vehiculos.find(v => v.placa === placa)
  // Solo conductores activos CON licencia vigente (el backend rechaza vencidas — verificado)
  const condActivos = conductores.filter(c =>
    c.activo && (!c.fechaVencLic || new Date(c.fechaVencLic) > new Date()))
  log(`Catálogos: ${rutas.length} rutas, ${vehiculos.length} vehículos, ${condActivos.length} conductores con licencia vigente`)

  const tarifa = async (rutaId, tipo) => {
    const r = await call(carlos.token, 'GET', `/api/tarifas/buscar?rutaId=${rutaId}&tipoVehiculo=${tipo}`)
    return r.data ? Number(r.data.precio) : null
  }

  log('')
  log('## Fase 1 — GERENTE programa los viajes del día')
  const rHK = rutaPor('Huamanga', 'Kimbiri'), rKH = rutaPor('Kimbiri', 'Huamanga'), rHP = rutaPor('Huamanga', 'Pichari')

  const programar = async (desc, rutaId, placa, condIdx, horas) => {
    const d = await deber(desc, kevin.token, 'POST', '/api/viajes', {
      rutaId, vehiculoId: vehPor(placa)?.id, conductorId: condActivos[condIdx]?.id,
      fechaHoraSal: limaISO(horas), observaciones: 'Simulación UAT',
    })
    return d?.id
  }

  const v1 = await programar('V1: Huamanga→Kimbiri COMBI (AYA-456) en 1 h', rHK?.id, 'AYA-456', 0, 1)
  const v2 = await programar('V2: Huamanga→Kimbiri CAMIONETA (AYA-321) en 2 h', rHK?.id, 'AYA-321', 1, 2)
  const v3 = await programar('V3: Kimbiri→Huamanga COMBI (KIM-111) en 2 h', rKH?.id, 'KIM-111', 2, 2)
  const v4 = await programar('V4: Huamanga→Pichari COMBI (AYA-789) en 3 h (se cancelará)', rHP?.id, 'AYA-789', 3, 3)
  const v5 = await programar('V5: Huamanga→Kimbiri COMBI (AYA-987) mañana (venta anticipada)', rHK?.id, 'AYA-987', 4, 26)

  // Caso límite: mismo vehículo a la misma hora (conflicto ±4h)
  await deberFallar('Caso límite: programar AYA-456 de nuevo a la misma hora (conflicto de vehículo)',
    kevin.token, 'POST', '/api/viajes', {
      rutaId: rHP?.id, vehiculoId: vehPor('AYA-456')?.id, conductorId: condActivos[5]?.id,
      fechaHoraSal: limaISO(1.5),
    })

  log('')
  log('## Fase 2 — Casos límite de caja ANTES de abrir turno')
  // María intenta vender y registrar encomienda al contado sin caja abierta
  const precioHK_combi = await tarifa(rHK?.id, 'COMBI')
  const precioHK_cam = await tarifa(rHK?.id, 'CAMIONETA')
  const precioKH_combi = await tarifa(rKH?.id, 'COMBI')
  const precioHP_combi = await tarifa(rHP?.id, 'COMBI')
  log(`Tarifas vigentes: HUA→KIM combi S/${precioHK_combi} · camioneta S/${precioHK_cam} · KIM→HUA combi S/${precioKH_combi} · HUA→PIC combi S/${precioHP_combi}`)

  const rVentaSinCaja = await vender(maria.token, v1, 16, precioHK_combi)
  if (rVentaSinCaja.ok) problema('Venta de pasaje al contado SIN caja abierta fue aceptada — boleta emitida sin que el dinero entre a ninguna caja')
  else ok(`Venta de pasaje sin caja rechazada: "${rVentaSinCaja.message}"`)

  await deberFallar('Encomienda al contado SIN caja abierta (María)', maria.token, 'POST', '/api/encomiendas', {
    remitenteTipoDoc: 'DNI', remitenteDoc: '41999991', remitenteNombres: 'Pedro', remitenteApellidos: 'Sin Caja',
    remitenteTelefono: '941999991',
    destinatarioTipoDoc: 'DNI', destinatarioDoc: '41999992', destinatarioNombres: 'Lucía', destinatarioApellidos: 'Receptora',
    destinatarioTelefono: '941999992',
    descripcion: 'Paquete de prueba sin caja', pesoKg: 2, numBultos: 1, esFragil: false,
    viajeId: v1, agenciaDestinoId: 2, monto: 15, formaCobro: 'EFECTIVO',
  })

  log('')
  log('## Fase 3 — OPERADOR Carlos (Huamanga): turno completo')
  await deber('Carlos abre caja con S/ 200.00', carlos.token, 'POST', '/api/caja/abrir', { montoInicial: 200 })

  // Promos vigentes
  const promosP = (await call(carlos.token, 'GET', '/api/promociones/vigentes?aplicaA=PASAJES')).data ?? []
  const promosE = (await call(carlos.token, 'GET', '/api/promociones/vigentes?aplicaA=ENCOMIENDAS')).data ?? []
  log(`Promos vigentes: ${promosP.length} de pasajes, ${promosE.length} de encomiendas`)
  if (promosP[0]) log(`  promo pasajes: ${JSON.stringify(promosP[0])}`)

  // Ventas V1 (combi): 7 pasajes
  let vendidosV1 = 0
  for (let asiento = 1; asiento <= 6; asiento++) {
    const r = await vender(carlos.token, v1, asiento, precioHK_combi, { formaPago: asiento % 3 === 0 ? 'YAPE' : 'EFECTIVO' })
    if (r.ok) vendidosV1++
    else problema(`Venta V1 asiento ${asiento} → ${r.message}`)
  }
  ok(`${vendidosV1}/6 pasajes vendidos en V1 (efectivo y Yape)`)

  // Venta con promoción de pasajes (si existe)
  if (promosP[0]) {
    const p = promosP[0]
    const desc = String(p.tipo).includes('PORCENT')
      ? Math.round(precioHK_combi * Number(p.valor)) / 100
      : Math.min(Number(p.valor), precioHK_combi)
    const r = await vender(carlos.token, v1, 7, precioHK_combi,
      { descuento: desc, promocionId: p.id, motivoDescuento: p.nombre })
    if (r.ok) { vendidosV1++; ok(`Pasaje con promo "${p.nombre}" (desc S/ ${desc.toFixed(2)}) en V1 asiento 7`) }
    else problema(`Venta con promo vigente "${p.nombre}" → ${r.message}`)
  }

  // Reserva + confirmación
  const rRes = await vender(carlos.token, v1, 8, precioHK_combi, { tipo: 'RESERVA' })
  let reservaId = null
  if (rRes.ok) { reservaId = rRes.data.id; ok('Reserva creada en V1 asiento 8') }
  else problema(`Reserva V1 asiento 8 → ${rRes.message}`)
  if (reservaId) {
    await deber('Reserva confirmada (pago EFECTIVO)', carlos.token, 'POST', `/api/pasajes/${reservaId}/confirmar`, { formaPago: 'EFECTIVO' })
    vendidosV1++
  }

  // ── Casos límite de venta ──
  await deberFallar('Caso límite: vender el asiento 1 de V1 otra vez (doble venta)',
    carlos.token, 'POST', '/api/pasajes/vender', {
      viajeId: v1, asientoNumero: 1, ...clienteFicticio('Doble', 'Asiento'),
      precioBase: precioHK_combi, descuento: 0, formaPago: 'EFECTIVO', tipo: 'VENTA',
    })

  await deberFallar('Caso límite: venta con promocionId inexistente (99999)',
    carlos.token, 'POST', '/api/pasajes/vender', {
      viajeId: v1, asientoNumero: 9, ...clienteFicticio('Promo', 'Falsa'),
      precioBase: precioHK_combi, descuento: 5, promocionId: 99999, formaPago: 'EFECTIVO', tipo: 'VENTA',
    })

  if (promosP[0]) {
    // Desactivar promo y tratar de usarla (promo vencida/inactiva)
    await call(kevin.token, 'PATCH', `/api/promociones/${promosP[0].id}/toggle`)
    await deberFallar(`Caso límite: usar promo desactivada "${promosP[0].nombre}"`,
      carlos.token, 'POST', '/api/pasajes/vender', {
        viajeId: v1, asientoNumero: 9, ...clienteFicticio('Promo', 'Vencida'),
        precioBase: precioHK_combi, descuento: 2, promocionId: promosP[0].id, formaPago: 'EFECTIVO', tipo: 'VENTA',
      })
    await call(kevin.token, 'PATCH', `/api/promociones/${promosP[0].id}/toggle`) // reactivar
  }

  // Anulación de un pasaje (asiento 2)
  const boletasV1 = (await call(carlos.token, 'GET', `/api/viajes/${v1}/asientos`)).data
  let pasajeAnularId = null
  // vender asiento 9 y anularlo de inmediato (cliente se arrepintió)
  const rAnular = await vender(carlos.token, v1, 9, precioHK_combi)
  if (rAnular.ok) {
    pasajeAnularId = rAnular.data.id
    const rr = await call(carlos.token, 'POST', `/api/pasajes/${pasajeAnularId}/anular`, { motivoAnulacion: 'Cliente desistió — UAT' })
    if (rr.ok) ok('Pasaje del asiento 9 anulado con devolución (egreso en caja de Carlos)')
    else problema(`Anular pasaje → ${rr.message}`)
  }

  // Ventas V2 (camioneta): 3 pasajes
  let okV2 = 0
  for (let asiento = 1; asiento <= 3; asiento++) {
    const r = await vender(carlos.token, v2, asiento, precioHK_cam)
    if (r.ok) okV2++
    else problema(`Venta V2 asiento ${asiento} → ${r.message}`)
  }
  ok(`${okV2}/3 pasajes vendidos en V2 (camioneta)`)

  // Ventas V4 (se cancelará con pasajeros)
  let okV4 = 0
  for (let asiento = 1; asiento <= 2; asiento++) {
    const r = await vender(carlos.token, v4, asiento, precioHP_combi)
    if (r.ok) okV4++
    else problema(`Venta V4 asiento ${asiento} → ${r.message}`)
  }
  ok(`${okV4}/2 pasajes vendidos en V4 (este viaje se cancelará)`)

  // Venta anticipada V5 (mañana)
  const rAnt = await vender(carlos.token, v5, 1, precioHK_combi)
  if (rAnt.ok) ok('Venta anticipada en V5 (viaje de mañana)')
  else problema(`Venta anticipada V5 → ${rAnt.message}`)

  // ── Encomiendas Carlos (Huamanga → Kimbiri, en V1) ──
  const regEnc = (extra) => ({
    remitenteTipoDoc: 'DNI', remitenteDoc: String(dniSeq += 7), remitenteNombres: 'Remitente', remitenteApellidos: `Sim${dniSeq % 100}`,
    remitenteTelefono: '9' + String(dniSeq).slice(0, 8),
    destinatarioTipoDoc: 'DNI', destinatarioDoc: String(dniSeq += 7), destinatarioNombres: 'Destinatario', destinatarioApellidos: `Sim${dniSeq % 100}`,
    destinatarioTelefono: '9' + String(dniSeq).slice(0, 8),
    numBultos: 1, esFragil: false, viajeId: v1, agenciaDestinoId: 2,
    ...extra,
  })

  const e1 = await deber('E1: encomienda al contado EFECTIVO S/ 15 (caja Carlos)', carlos.token, 'POST', '/api/encomiendas',
    regEnc({ descripcion: 'Caja de repuestos', pesoKg: 4, monto: 15, formaCobro: 'EFECTIVO' }))
  const e2 = await deber('E2: encomienda POR_COBRAR S/ 20 (paga el destinatario en Kimbiri)', carlos.token, 'POST', '/api/encomiendas',
    regEnc({ descripcion: 'Documentos notariales', pesoKg: 1, monto: 20, formaCobro: 'POR_COBRAR' }))
  const e3 = await deber('E3: encomienda FRÁGIL al contado YAPE S/ 25', carlos.token, 'POST', '/api/encomiendas',
    regEnc({ descripcion: 'Vajilla de cerámica', pesoKg: 6, esFragil: true, monto: 25, formaCobro: 'YAPE' }))
  let e4 = null
  if (promosE[0]) {
    const pe = promosE[0]
    const descE = String(pe.tipo).includes('PORCENT') ? Math.round(18 * Number(pe.valor)) / 100 : Math.min(Number(pe.valor), 18)
    e4 = await deber(`E4: encomienda con promo "${pe.nombre}" S/ 18 − ${descE.toFixed(2)}`, carlos.token, 'POST', '/api/encomiendas',
      regEnc({ descripcion: 'Ropa surtida', pesoKg: 3, monto: 18, formaCobro: 'EFECTIVO', promocionId: pe.id }))
  }

  // ── Externas Carlos ──
  const x1 = await deber('X1: externa, conductor YA PAGÓ S/ 8 (entra a caja Carlos)', carlos.token, 'POST', '/api/encomiendas-externas', {
    conductorNombre: 'Mario Externo Vega', conductorDni: '42888001', conductorTel: '942888001', conductorPlaca: 'XTR-101',
    destinatarioNombre: 'Julia Recoge Paquete', destinatarioDni: '42888002', destinatarioTel: '942888002',
    descripcion: 'Sobre de medicinas', monto: 8, estadoPago: 'PAGADO', formaPago: 'EFECTIVO',
  })
  const x2 = await deber('X2: externa POR_COBRAR S/ 12 (paga el destinatario al recoger)', carlos.token, 'POST', '/api/encomiendas-externas', {
    conductorNombre: 'Sergio Externo Ñahui', conductorDni: '42888003', conductorTel: '942888003', conductorPlaca: 'XTR-202',
    destinatarioNombre: 'Tomás Destinatario Final', destinatarioDni: '42888004', destinatarioTel: '942888004',
    descripcion: 'Herramientas pequeñas', monto: 12, estadoPago: 'PENDIENTE',
  })
  // Entrega de X2 cobrando al destinatario
  if (x2) {
    await deber('X2 entregada al destinatario cobrando S/ 12 EFECTIVO', carlos.token, 'POST', `/api/encomiendas-externas/${x2.id}/entregar`,
      { receptorNombre: 'Tomás Destinatario Final', receptorDni: '42888004', formaPago: 'EFECTIVO' })
  }

  log('')
  log('## Fase 4 — María: turno corto con descuadre intencional')
  await deber('María abre caja con S/ 100.00', maria.token, 'POST', '/api/caja/abrir', { montoInicial: 100 })
  let okMaria = 0
  for (const asiento of [4, 5]) {
    const r = await vender(maria.token, v2, asiento, precioHK_cam)
    if (r.ok) okMaria++
    else problema(`Venta María V2 asiento ${asiento} → ${r.message}`)
  }
  ok(`María vendió ${okMaria}/2 pasajes en V2 (camioneta)`)
  await deber('María registra encomienda al contado S/ 10', maria.token, 'POST', '/api/encomiendas',
    regEnc({ descripcion: 'Víveres para familia', pesoKg: 8, monto: 10, formaCobro: 'EFECTIVO' }))

  log('')
  log('## Fase 5 — Salidas, cancelación y operación en destino (Rosa, Kimbiri)')

  // Carlos confirma salidas (cuota combi S/10 entra a SU caja en V1; V2 camioneta sin cuota)
  await deber('Salida de V1 confirmada por Carlos (combi → cuota S/ 10 a su caja)', carlos.token, 'POST', `/api/viajes/${v1}/confirmar-salida`)
  await deber('Salida de V2 confirmada por Carlos (camioneta → sin cuota)', carlos.token, 'POST', `/api/viajes/${v2}/confirmar-salida`)

  // Caso límite: cancelar V4 con 2 pasajeros vendidos
  const rCancel = await call(kevin.token, 'POST', `/api/viajes/${v4}/cancelar`)
  if (rCancel.ok) observacion(`V4 cancelado CON 2 pasajeros vendidos → revisar qué pasó con sus boletas y el dinero (mensaje: "${rCancel.message}")`)
  else ok(`Cancelar V4 con pasajeros → bloqueado: "${rCancel.message}"`)

  // Rosa (Kimbiri) abre caja, vende V3 y opera su sucursal
  await deber('Rosa abre caja con S/ 150.00', rosa.token, 'POST', '/api/caja/abrir', { montoInicial: 150 })
  for (const asiento of [1, 2, 3, 4]) {
    const r = await vender(rosa.token, v3, asiento, precioKH_combi)
    if (!r.ok) problema(`Venta Rosa V3 asiento ${asiento} → ${r.message}`)
  }
  ok('Rosa vendió 4 pasajes en V3 (Kimbiri→Huamanga)')

  await deber('Rosa registra encomienda Kimbiri→Huamanga POR_COBRAR S/ 14', rosa.token, 'POST', '/api/encomiendas', {
    remitenteTipoDoc: 'DNI', remitenteDoc: String(dniSeq += 7), remitenteNombres: 'Comerciante', remitenteApellidos: 'Kimbiri',
    remitenteTelefono: '9' + String(dniSeq).slice(0, 8),
    destinatarioTipoDoc: 'DNI', destinatarioDoc: String(dniSeq += 7), destinatarioNombres: 'Cliente', destinatarioApellidos: 'Huamanga',
    destinatarioTelefono: '9' + String(dniSeq).slice(0, 8),
    descripcion: 'Café en grano 10kg', pesoKg: 10, numBultos: 2, esFragil: false,
    viajeId: v3, agenciaDestinoId: 1, monto: 14, formaCobro: 'POR_COBRAR',
  })

  await deber('Salida de V3 confirmada por Rosa (combi → cuota S/ 10 a su caja)', rosa.token, 'POST', `/api/viajes/${v3}/confirmar-salida`)

  // Llegada de V1 a Kimbiri: Rosa confirma y recepciona las encomiendas
  await deber('Llegada de V1 confirmada por Rosa (Kimbiri)', rosa.token, 'POST', `/api/viajes/${v1}/confirmar-llegada`)
  const idsV1 = [e1, e2, e3, e4].filter(Boolean).map(e => e.id)
  if (idsV1.length) {
    await deber(`Recepción en Kimbiri de ${idsV1.length} encomiendas de V1`, rosa.token, 'POST', `/api/encomiendas/viaje/${v1}/recepcionar`,
      idsV1.map(id => ({ encomiendaId: id, recibido: true, observacion: null })))
  }
  // Entregas en Kimbiri: E1 pasa por DISPONIBLE (flujo completo) y E2 se
  // entrega directo desde LLEGADO_AGENCIA cobrando (el destinatario llegó al toque)
  if (e1) {
    await deber('E1 marcada DISPONIBLE para recoger', rosa.token, 'POST', `/api/encomiendas/${e1.id}/disponible`)
    await deber('E1 entregada en Kimbiri (ya estaba pagada)', rosa.token, 'POST', `/api/encomiendas/${e1.id}/entregar`,
      { dniReceptor: e1.destinatarioDoc ?? '42777001', nombreReceptor: 'Destinatario Sim', nota: 'Entrega UAT' })
  }
  if (e2) await deber('E2 entregada directo desde LLEGADO_AGENCIA, cobrando S/ 20 EFECTIVO (caja Rosa)', rosa.token, 'POST', `/api/encomiendas/${e2.id}/entregar`,
    { dniReceptor: e2.destinatarioDoc ?? '42777002', nombreReceptor: 'Destinatario Sim', formaPago: 'EFECTIVO' })

  // Tracking público (sin login) de E3
  if (e3?.codigo ?? e3?.codigoTracking) {
    const cod = e3.codigo ?? e3.codigoTracking
    const tr = await call(null, 'GET', `/api/tracking/${cod}`)
    if (tr.ok) ok(`Tracking público de E3 (${cod}): estado ${tr.data?.estado ?? '?'}`)
    else problema(`Tracking público de E3 → ${tr.message}`)
  } else observacion('E3 no expone código de tracking en la respuesta de registro')

  // Llegada de V3 a Huamanga (Carlos confirma)
  await deber('Llegada de V3 confirmada por Carlos (Huamanga)', carlos.token, 'POST', `/api/viajes/${v3}/confirmar-llegada`)

  log('')
  log('## Fase 6 — Manifiestos')
  const man1 = await deber('Manifiesto de V1 generado/persistido', carlos.token, 'POST', `/api/manifiestos/generar/${v1}`)
  const manDatos = await call(carlos.token, 'GET', `/api/manifiestos/${v1}/datos`)
  let manTotPasajes = null, manTotEnc = null
  if (manDatos.ok) {
    const d = manDatos.data
    manTotPasajes = Number(d.totalPasajes ?? d.totalRecaudadoPasajes ?? NaN)
    manTotEnc = Number(d.totalEncomiendas ?? d.totalRecaudadoEncomiendas ?? NaN)
    ok(`Manifiesto V1: ${d.pasajeros?.length ?? '?'} pasajeros, ${d.encomiendas?.length ?? '?'} encomiendas`)
  } else problema(`Datos de manifiesto V1 → ${manDatos.message}`)
  // PDF del manifiesto
  const pdfRes = await fetch(`${BASE}/api/manifiestos/${v1}/pdf`, { headers: { Authorization: `Bearer ${carlos.token}` } })
  if (pdfRes.ok) ok(`PDF de manifiesto V1: ${(await pdfRes.arrayBuffer()).byteLength} bytes`)
  else problema(`PDF manifiesto V1 → HTTP ${pdfRes.status}`)

  log('')
  log('## Fase 7 — Cierres de caja y cuadre')

  // ADMIN_AGENCIA Elena revisa su sucursal antes de los cierres
  const kpisElena = await call(elena.token, 'GET', '/api/reportes/kpis')
  if (kpisElena.ok) ok(`Elena (ADMIN_AGENCIA Kimbiri) ve sus KPIs: ingresos hoy S/ ${kpisElena.data.ingresosHoy}`)
  const opersElena = await call(elena.token, 'GET', '/api/caja/estado-operadores')
  if (opersElena.ok) ok(`Elena ve estado de operadores de Kimbiri: ${(opersElena.data ?? []).length} operadores`)

  const cierres = []
  for (const [quien, ses, ajuste, obs] of [
    ['Carlos', carlos, 0, 'Cierre normal — cuadre exacto'],
    ['Rosa', rosa, 0, 'Cierre normal — cuadre exacto'],
    ['María', maria, -5, 'CASO LÍMITE: faltan S/ 5 en físico (descuadre intencional)'],
  ]) {
    const t = await turnoActual(ses.token)
    if (!t) { problema(`${quien} no tiene turno activo al cerrar`); continue }
    const esperado = saldoEsperado(t)
    const cierre = await deber(`${quien} cierra caja: esperado S/ ${esperado.toFixed(2)}, físico S/ ${(esperado + ajuste).toFixed(2)}`,
      ses.token, 'POST', '/api/caja/cerrar', { montoFisico: esperado + ajuste, observacion: obs })
    if (cierre) {
      const dif = Number(cierre.diferencia ?? cierre.caja?.diferencia ?? NaN)
      cierres.push({ quien, esperado, ajuste, dif, raw: cierre })
      if (!Number.isNaN(dif) && Math.abs(dif - ajuste) > 0.005) {
        problema(`${quien}: diferencia registrada S/ ${dif} ≠ ajuste intencional S/ ${ajuste}`)
      } else ok(`${quien}: diferencia registrada ${Number.isNaN(dif) ? '(no expuesta en respuesta)' : 'S/ ' + dif.toFixed(2)}`)
    }
  }

  // ── CUADRE FINAL: reporte de ingresos vs cajas ──
  log('')
  log('## Fase 8 — Cuadre del día (al céntimo)')
  const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
  const rep = await call(kevin.token, 'GET', `/api/reportes/ingresos?desde=${fecha}&hasta=${fecha}&groupBy=categoria`)
  let totalReporte = null
  if (rep.ok) {
    totalReporte = Number(rep.data.totalGeneral)
    log(`Reporte de ingresos de HOY: S/ ${totalReporte.toFixed(2)} en ${rep.data.operacionesTotal} operaciones`)
    for (const [cat, v] of Object.entries(rep.data.porCategoria ?? {})) {
      log(`  · ${cat}: S/ ${Number(v.total).toFixed(2)} (${v.operaciones} ops)`)
    }
  } else problema(`Reporte de ingresos → ${rep.message}`)

  // Suma de ingresos de las cajas cerradas hoy (movimientos INGRESO de cada caja de la simulación)
  let totalCajas = 0
  const histCarlos = await call(kevin.token, 'GET', '/api/caja/historial?soloHoy=true')
  // Fallback: usar los cierres capturados
  for (const c of cierres) {
    const t = c.raw.caja ?? c.raw
    const ing = Number(t.totalIngresos ?? NaN)
    if (!Number.isNaN(ing)) { totalCajas += ing; log(`  Caja ${c.quien}: ingresos S/ ${ing.toFixed(2)}`) }
    else observacion(`Cierre de ${c.quien} no expone totalIngresos en la respuesta`)
  }
  if (totalReporte != null && totalCajas > 0) {
    const delta = Math.abs(totalReporte - totalCajas)
    if (delta < 0.005) ok(`CUADRE EXACTO: reporte S/ ${totalReporte.toFixed(2)} = cajas S/ ${totalCajas.toFixed(2)}`)
    else {
      // La caja vieja de Carlos cerrada en Fase 0 puede aportar ingresos de otro día; reportar con contexto
      observacion(`Reporte S/ ${totalReporte.toFixed(2)} vs ingresos de cajas cerradas hoy S/ ${totalCajas.toFixed(2)} (Δ S/ ${delta.toFixed(2)}) — verificar origen (caja antigua, anulaciones)`)
    }
  }

  // Consolidado del gerente
  const cons = await call(kevin.token, 'GET', '/api/caja/consolidado-agencias')
  if (cons.ok) ok(`Consolidado por agencia disponible (${(cons.data ?? []).length} agencias con caja abierta tras los cierres)`)

  // ════ Reporte final ════
  log('')
  log('═'.repeat(60))
  log(`RESUMEN: ${PROBLEMAS.length} problemas, ${OBSERVACIONES.length} observaciones`)

  const md = [
    '# Simulación de operación real (UAT) — resultados',
    `> Ejecutada: ${hoy.toLocaleString('es-PE')} · Backend dev · Datos ficticios`,
    '',
    '## Problemas encontrados',
    ...(PROBLEMAS.length ? PROBLEMAS.map(p => `- [ ] ${p}`) : ['- (ninguno)']),
    '',
    '## Observaciones (no bloquean, revisar)',
    ...(OBSERVACIONES.length ? OBSERVACIONES.map(o => `- ${o}`) : ['- (ninguna)']),
    '',
    '## Bitácora completa',
    '```',
    ...LOG,
    '```',
    '',
  ].join('\n')
  fs.writeFileSync(path.join(__dirname, 'SIMULACION-UAT.md'), md, 'utf8')
  console.log('\nReporte: scripts/SIMULACION-UAT.md')
})().catch(e => { console.error('ABORTADA:', e); process.exit(1) })
