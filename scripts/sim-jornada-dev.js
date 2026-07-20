#!/usr/bin/env node
/* Simulación de jornada completa en DEV — todos los roles, varias agencias/sucursales,
 * varios vehículos y conductores. Objetivo: encontrar vacíos (errores, respuestas raras,
 * datos faltantes) en el flujo real de trabajo.
 */
const BASE = 'http://localhost:8080'
const PASS = 'Quinuapata2026!'

const hallazgos = []
const ok = []
function nota(tipo, paso, detalle) {
  (tipo === 'OK' ? ok : hallazgos).push(`[${tipo}] ${paso}: ${detalle}`)
  console.log(`[${tipo}] ${paso}: ${detalle}`)
}

async function api(method, path, token, body, esperaBinario = false) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (esperaBinario) {
    const buf = await res.arrayBuffer()
    return { status: res.status, bytes: buf.byteLength }
  }
  let json = null
  try { json = await res.json() } catch { /* sin cuerpo */ }
  return { status: res.status, json }
}

async function login(email) {
  const r = await api('POST', '/api/auth/login', null, { email, password: PASS })
  if (r.status >= 300 || !r.json?.data?.token) {
    nota('FALLO', 'login', `${email} -> HTTP ${r.status} ${r.json?.message ?? ''}`)
    return null
  }
  return r.json.data.token
}

function hora(deltaHoras) {
  const d = new Date(Date.now() + deltaHoras * 3600e3)
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00-05:00`
}

async function tarifa(token, rutaId, tipoVehiculo) {
  const r = await api('GET', `/api/tarifas/buscar?rutaId=${rutaId}&tipoVehiculo=${tipoVehiculo}`, token)
  const d = r.json?.data
  const precio = d?.precio ?? d?.[0]?.precio
  return precio != null ? Number(precio) : null
}

async function main() {
  console.log('══════════ SIMULACIÓN DE JORNADA — DEV ══════════')

  // ── 1. Login de todos los roles ─────────────────────────────────────────
  // El rate-limit de /auth/login es por IP y por minuto: espaciar los logins
  const kevin  = await login('kevin.sandoval@quinuapata.com')   // GERENTE ag1
  const carlos = await login('carlos.quispe@quinuapata.com')    // OPERADOR ag1 Huamanga
  const rosaK  = await login('rosa.sulca@quinuapata.com')       // OPERADOR ag2 Kimbiri
  const mariaS = await login('maria.rios@quinuapata.com')       // OPERADOR ag4 San Francisco
  console.log('   … esperando 61s por el rate-limit de login …')
  await new Promise(r => setTimeout(r, 61000))
  const rosaN  = await login('rosa.nahui@quinuapata.com')       // OPERADOR ag5 (sucursal de SFR)
  const elena  = await login('elena.paredes@quinuapata.com')    // ADMIN_AGENCIA ag2
  const pedro  = await login('pedro.gomez@quinuapata.com')      // ADMIN_AGENCIA ag4
  if (!kevin || !carlos || !rosaK || !mariaS || !elena || !pedro) return resumen()
  nota('OK', 'logins', '7 usuarios autenticados (gerente, 4 operadores, 2 admins)')

  // ── 1b. Limpiar viajes PROGRAMADO de corridas anteriores ────────────────
  {
    const lista = await api('GET', '/api/viajes', kevin)
    const arr = Array.isArray(lista.json?.data) ? lista.json.data : []
    for (const v of arr.filter(x => x.estado === 'PROGRAMADO')) {
      await api('POST', `/api/viajes/${v.id}/cancelar`, kevin, { motivo: 'limpieza simulación' })
    }
    if (arr.length) console.log(`   … ${arr.filter(x => x.estado === 'PROGRAMADO').length} viajes previos cancelados …`)
  }

  // ── 2. Operadores abren caja ────────────────────────────────────────────
  const cajas = {}
  for (const [nombre, tok] of [['carlos', carlos], ['rosaK', rosaK], ['mariaS', mariaS], ['rosaN', rosaN]]) {
    if (!tok) continue
    const r = await api('POST', '/api/caja/abrir', tok, { montoInicial: 100 })
    if (r.status < 300) { cajas[nombre] = r.json.data.id; nota('OK', 'caja.abrir', `${nombre} caja=${r.json.data.id} agencia=${r.json.data.agenciaId}`) }
    else if ((r.json?.message ?? '').includes('turno abierto')) nota('OK', 'caja.abrir', `${nombre} ya tenía turno abierto — se reutiliza`)
    else nota('FALLO', 'caja.abrir', `${nombre} -> HTTP ${r.status} ${r.json?.message}`)
  }

  // ── 3. Programación de viajes (varias sedes, vehículos y conductores) ───
  //    Conductores con licencia VIGENTE en dev: 1, 3, 6, 7, 8
  //    Salidas dentro de la ventana de 2 h; KIM-PIC queda a 4 h para probar el rechazo
  const defViajes = [
    ['kevin', kevin, 1, 1, 1, 1.5, 'HUA-KIM combi'],
    ['kevin', kevin, 5, 3, 3, 1.5, 'HUA-SFR camioneta'],
    ['elena', elena, 2, 6, 6, 1.5, 'KIM-HUA combi'],
    ['elena', elena, 7, 7, 7, 4, 'KIM-PIC camioneta'],
    ['pedro', pedro, 6, 10, 8, 1.5, 'SFR-HUA combi'],
  ]
  const viajes = {}
  for (const [quien, tok, rutaId, vehiculoId, conductorId, delta, etiqueta] of defViajes) {
    const r = await api('POST', '/api/viajes', tok, { rutaId, vehiculoId, conductorId, fechaHoraSal: hora(delta) })
    if (r.status < 300 && r.json?.data?.id) { viajes[etiqueta] = r.json.data.id; nota('OK', 'viaje.crear', `${quien} ${etiqueta} id=${r.json.data.id}`) }
    else nota('FALLO', 'viaje.crear', `${quien} ${etiqueta} -> HTTP ${r.status} ${r.json?.message}`)
  }

  // ── 4. Ventas de pasajes (formas de pago variadas) ──────────────────────
  const ventas = []
  async function vender(quien, tok, etiqueta, tipoVeh, rutaId, asiento, formaPago, dni, nom, ape) {
    const viajeId = viajes[etiqueta]
    if (!viajeId) return
    const precio = await tarifa(tok, rutaId, tipoVeh)
    if (precio == null) { nota('VACIO', 'tarifa.buscar', `${etiqueta} sin tarifa vigente visible por API`); return }
    const r = await api('POST', '/api/pasajes/vender', tok, {
      viajeId, asientoNumero: asiento, clienteDni: dni, clienteNombres: nom, clienteApellidos: ape,
      clienteTelefono: '9' + dni, precioBase: precio, descuento: 0, formaPago, tipo: 'VENTA',
    })
    if (r.status < 300 && r.json?.data?.codigoBoleta) {
      ventas.push({ quien, etiqueta, id: r.json.data.id, boleta: r.json.data.codigoBoleta })
      nota('OK', 'venta', `${quien} ${etiqueta} asiento ${asiento} ${formaPago} -> ${r.json.data.codigoBoleta}`)
    } else nota('FALLO', 'venta', `${quien} ${etiqueta} asiento ${asiento} -> HTTP ${r.status} ${r.json?.message}`)
  }

  await vender('carlos', carlos, 'HUA-KIM combi', 'COMBI', 1, 1, 'EFECTIVO', '40111222', 'Lucia', 'Ramos Vega')
  await vender('carlos', carlos, 'HUA-KIM combi', 'COMBI', 1, 2, 'YAPE',     '40111223', 'Mario', 'Salas Poma')
  await vender('carlos', carlos, 'HUA-KIM combi', 'COMBI', 1, 3, 'EFECTIVO', '40111224', 'Nadia', 'Flores Cruz')
  await vender('carlos', carlos, 'HUA-KIM combi', 'COMBI', 1, 4, 'PLIN',     '40111225', 'Oscar', 'Meza Rivas')
  await vender('carlos', carlos, 'HUA-SFR camioneta', 'CAMIONETA', 5, 1, 'EFECTIVO', '40111226', 'Paula', 'Nina Soto')
  await vender('carlos', carlos, 'HUA-SFR camioneta', 'CAMIONETA', 5, 2, 'TRANSFERENCIA', '40111227', 'Raul', 'Cano Diaz')
  await vender('rosaK', rosaK, 'KIM-HUA combi', 'COMBI', 2, 1, 'EFECTIVO', '40111228', 'Sara', 'Lopez Kana')
  await vender('rosaK', rosaK, 'KIM-HUA combi', 'COMBI', 2, 2, 'EFECTIVO', '40111229', 'Tomas', 'Ruiz Bravo')
  await vender('rosaK', rosaK, 'KIM-PIC camioneta', 'CAMIONETA', 7, 1, 'YAPE', '40111230', 'Ursula', 'Vega Cusi')
  await vender('mariaS', mariaS, 'SFR-HUA combi', 'COMBI', 6, 1, 'EFECTIVO', '40111231', 'Victor', 'Anaya Roca')
  await vender('mariaS', mariaS, 'SFR-HUA combi', 'COMBI', 6, 2, 'EFECTIVO', '40111232', 'Wanda', 'Bustos Lima')
  // Operadora de SUCURSAL vende en viaje de su agencia matriz — ¿la deja el sistema?
  if (rosaN) await vender('rosaN(sucursal)', rosaN, 'SFR-HUA combi', 'COMBI', 6, 3, 'EFECTIVO', '40111233', 'Ximena', 'Ccama Puma')

  // Venta duplicada del mismo asiento: debe RECHAZARSE
  {
    const precio = await tarifa(carlos, 1, 'COMBI')
    const r = await api('POST', '/api/pasajes/vender', carlos, {
      viajeId: viajes['HUA-KIM combi'], asientoNumero: 1, clienteDni: '40111299', clienteNombres: 'Dup', clienteApellidos: 'Licado',
      clienteTelefono: '940111299', precioBase: precio, descuento: 0, formaPago: 'EFECTIVO', tipo: 'VENTA',
    })
    if (r.status < 300) nota('VACIO', 'venta.duplicada', '¡Se vendió dos veces el asiento 1 del mismo viaje!')
    else nota('OK', 'venta.duplicada', `rechazada correctamente (${r.json?.message})`)
  }

  // ── 5. Encomiendas (pago origen, por cobrar, frágil) ────────────────────
  const encomiendas = []
  async function registrarEnc(quien, tok, destinoAgId, etiquetaViaje, formaCobro, monto, desc, fragil) {
    const r = await api('POST', '/api/encomiendas', tok, {
      remitenteTipoDoc: 'DNI', remitenteDoc: '41222333', remitenteNombres: 'Elias', remitenteApellidos: 'Quispe Sulca', remitenteTelefono: '941222333',
      destinatarioTipoDoc: 'DNI', destinatarioDoc: '42333444', destinatarioNombres: 'Flor', destinatarioApellidos: 'Huaman Rojas', destinatarioTelefono: '942333444',
      descripcion: desc, pesoKg: 4.5, numBultos: fragil ? 2 : 1, esFragil: !!fragil,
      viajeId: viajes[etiquetaViaje] ?? null, agenciaDestinoId: destinoAgId, monto, formaCobro, observaciones: 'simulación jornada',
    })
    if (r.status < 300 && r.json?.data) {
      const e = { id: r.json.data.id, codigo: r.json.data.codigoTracking, viaje: etiquetaViaje }
      encomiendas.push(e)
      nota('OK', 'encomienda.registrar', `${quien} ${desc} ${formaCobro} -> ${e.codigo}`)
      return e
    }
    nota('FALLO', 'encomienda.registrar', `${quien} ${desc} -> HTTP ${r.status} ${r.json?.message}`)
    return null
  }

  // La ruta 1 de dev (código HUA-KIM) en realidad termina en Palmapampa (ag 5)
  const encKim = await registrarEnc('carlos', carlos, 5, 'HUA-KIM combi', 'EFECTIVO', 20, 'Caja de repuestos', false)
  const encSfr = await registrarEnc('carlos', carlos, 4, 'HUA-SFR camioneta', 'POR_COBRAR', 35, 'Televisor 43 pulgadas', true)
  const encHua = await registrarEnc('rosaK', rosaK, 1, 'KIM-HUA combi', 'YAPE', 15, 'Documentos notariales', false)

  // ── 5b. Reglas nuevas: pruebas negativas ─────────────────────────────────
  // Salida antes de la ventana de 2 h: debe RECHAZARSE (KIM-PIC sale en 4 h)
  if (viajes['KIM-PIC camioneta']) {
    const r = await api('POST', `/api/viajes/${viajes['KIM-PIC camioneta']}/confirmar-salida`, elena, {})
    if (r.status >= 300) nota('OK', 'regla.salida2h', `salida a 4h rechazada (${r.json?.message?.slice(0, 60)}…)`)
    else nota('VACIO', 'regla.salida2h', '¡se confirmó una salida 4 horas antes!')
  }
  // Encomienda a un viaje que no pasa por su destino: debe RECHAZARSE
  if (encKim && viajes['SFR-HUA combi']) {
    const r = await api('PATCH', `/api/encomiendas/${encKim.id}/asignar-viaje`, mariaS,
      { viajeId: viajes['SFR-HUA combi'] })
    if (r.status >= 300) nota('OK', 'regla.destinoEncomienda', `asignación a viaje equivocado rechazada (${r.json?.message?.slice(0, 70)}…)`)
    else nota('VACIO', 'regla.destinoEncomienda', '¡encomienda para Kimbiri subió a un viaje SFR→Huamanga!')
  }

  // ── 6. Salida y llegada de viajes ───────────────────────────────────────
  // Salida: la confirma el origen (la cuota de salida entra a la caja de quien
  // confirma). Llegada: SOLO la agencia de la ciudad destino, conductor o gerencia.
  const ciclos = [
    ['HUA-KIM combi',     carlos, rosaN,  'carlos sale, rosaN (Palmapampa) recibe'],
    ['HUA-SFR camioneta', carlos, mariaS, 'carlos sale (cuota camioneta a su caja), mariaS (SFR) recibe'],
    ['KIM-HUA combi',     rosaK,  carlos, 'rosaK sale, carlos (Huamanga) recibe'],
  ]
  let llegadaOrigenProbada = false
  for (const [etiqueta, tokSalida, tokLlegada, desc] of ciclos) {
    const id = viajes[etiqueta]
    if (!id) continue
    let r = await api('POST', `/api/viajes/${id}/confirmar-salida`, tokSalida, {})
    if (r.status >= 300) { nota('FALLO', 'viaje.salida', `${etiqueta} -> HTTP ${r.status} ${r.json?.message}`); continue }
    // Regla nueva: la agencia ORIGEN no puede confirmar la llegada
    if (!llegadaOrigenProbada && tokSalida !== tokLlegada) {
      const rMal = await api('POST', `/api/viajes/${id}/confirmar-llegada`, tokSalida, {})
      if (rMal.status >= 300) nota('OK', 'regla.llegadaOrigen', `llegada desde el origen rechazada (${rMal.json?.message?.slice(0, 60)}…)`)
      else nota('VACIO', 'regla.llegadaOrigen', '¡la agencia origen confirmó la llegada!')
      llegadaOrigenProbada = true
    }
    r = await api('POST', `/api/viajes/${id}/confirmar-llegada`, tokLlegada, {})
    if (r.status >= 300) nota('FALLO', 'viaje.llegada', `${etiqueta} -> HTTP ${r.status} ${r.json?.message}`)
    else nota('OK', 'viaje.ciclo', `${etiqueta}: ${desc}`)
  }

  // ── 7. Recepción y entrega en destino ───────────────────────────────────
  // Palmapampa (rosaN) recepciona y entrega lo del viaje HUA-KIM
  if (encKim && rosaN) {
    const vid = viajes['HUA-KIM combi']
    let r = await api('POST', `/api/encomiendas/viaje/${vid}/recepcionar`, rosaN, [{ encomiendaId: encKim.id, recibido: true, observacion: '' }])
    if (r.status >= 300) nota('FALLO', 'encomienda.recepcionar', `Palmapampa viaje ${vid} -> HTTP ${r.status} ${r.json?.message}`)
    r = await api('POST', `/api/encomiendas/${encKim.id}/entregar`, rosaN, { dniReceptor: '42333444', nombreReceptor: 'Flor Huaman Rojas', nota: 'entrega normal' })
    if (r.status < 300) nota('OK', 'encomienda.entrega', `${encKim.codigo} entregada en Palmapampa (pagada en origen)`)
    else nota('FALLO', 'encomienda.entrega', `${encKim.codigo} -> HTTP ${r.status} ${r.json?.message}`)
  }
  // San Francisco (mariaS) recepciona y entrega COBRANDO el POR_COBRAR
  if (encSfr) {
    const vid = viajes['HUA-SFR camioneta']
    let r = await api('POST', `/api/encomiendas/viaje/${vid}/recepcionar`, mariaS, [{ encomiendaId: encSfr.id, recibido: true, observacion: '' }])
    if (r.status >= 300) nota('FALLO', 'encomienda.recepcionar', `SFR viaje ${vid} -> HTTP ${r.status} ${r.json?.message}`)
    r = await api('POST', `/api/encomiendas/${encSfr.id}/entregar`, mariaS, { dniReceptor: '42333444', nombreReceptor: 'Flor Huaman Rojas', nota: 'cobro en destino', formaPago: 'EFECTIVO' })
    if (r.status < 300) nota('OK', 'encomienda.entregaPorCobrar', `${encSfr.codigo} entregada cobrando S/35 en destino`)
    else nota('FALLO', 'encomienda.entregaPorCobrar', `${encSfr.codigo} -> HTTP ${r.status} ${r.json?.message}`)
  }

  // ── 8. Movimientos manuales de caja ─────────────────────────────────────
  {
    const r = await api('POST', '/api/caja/egreso', carlos, { monto: 30, concepto: 'Combustible camioneta AYA-321' })
    if (r.status < 300) nota('OK', 'caja.egreso', 'carlos egreso S/30 combustible')
    else nota('FALLO', 'caja.egreso', `-> HTTP ${r.status} ${r.json?.message}`)
  }

  // ── 9. Tracking público (sin login) ─────────────────────────────────────
  if (encSfr) {
    const r = await api('GET', `/api/tracking/${encSfr.codigo}`, null)
    if (r.status < 300 && r.json?.data) nota('OK', 'tracking.publico', `${encSfr.codigo} estado=${r.json.data.estado ?? JSON.stringify(r.json.data).slice(0, 60)}`)
    else nota('FALLO', 'tracking.publico', `${encSfr.codigo} -> HTTP ${r.status}`)
  }

  // ── 10. PDFs y documentos ───────────────────────────────────────────────
  const docs = [
    ['ticket pasaje', carlos, ventas[0] ? `/api/pasajes/${ventas[0].id}/ticket` : null],
    ['manifiesto pasajeros PDF', kevin, viajes['HUA-KIM combi'] ? `/api/manifiestos/${viajes['HUA-KIM combi']}/pdf` : null],
    ['manifiesto encomiendas PDF', kevin, viajes['HUA-SFR camioneta'] ? `/api/manifiestos/${viajes['HUA-SFR camioneta']}/pdf/encomiendas` : null],
    ['comprobante encomienda', carlos, encKim ? `/api/encomiendas/${encKim.id}/comprobante` : null],
    ['comprobante entrega', mariaS, encSfr ? `/api/encomiendas/${encSfr.id}/comprobante-entrega` : null],
    ['etiqueta encomienda', carlos, encKim ? `/api/encomiendas/${encKim.id}/etiqueta` : null],
    ['liquidación viaje PDF', kevin, viajes['HUA-KIM combi'] ? `/api/viajes/${viajes['HUA-KIM combi']}/liquidacion-pdf` : null],
  ]
  for (const [nombre, tok, path] of docs) {
    if (!path) continue
    const r = await api('GET', path, tok, undefined, true)
    if (r.status < 300 && r.bytes > 800) nota('OK', 'pdf', `${nombre} (${r.bytes} bytes)`)
    else nota(r.status < 300 ? 'VACIO' : 'FALLO', 'pdf', `${nombre} -> HTTP ${r.status} ${r.bytes ?? 0} bytes`)
  }

  // ── 11. Cierres de caja ─────────────────────────────────────────────────
  async function cerrar(quien, tok, ajuste = 0) {
    const t = await api('GET', '/api/caja/turno-actual', tok)
    const saldo = Number(t.json?.data?.saldoActual ?? t.json?.data?.saldo ?? NaN)
    const body = { montoFisico: isNaN(saldo) ? 100 : saldo + ajuste }
    if (ajuste !== 0) {
      // Cerrar con diferencia SIN observación debe ser RECHAZADO (loop F)
      const rSin = await api('POST', '/api/caja/cerrar', tok, body)
      if (rSin.status < 300) nota('VACIO', 'caja.cerrarSinObs', `${quien} cerró con diferencia sin observación — ¡no debería!`)
      else nota('OK', 'caja.cerrarSinObs', `${quien} rechazado correctamente sin observación`)
      body.observacion = 'faltó vuelto de la mañana (prueba de simulación)'
    }
    const r = await api('POST', '/api/caja/cerrar', tok, body)
    if (r.status < 300) nota('OK', 'caja.cerrar', `${quien} cerró con diferencia=${r.json?.data?.diferencia}`)
    else nota('FALLO', 'caja.cerrar', `${quien} -> HTTP ${r.status} ${r.json?.message}`)
  }
  await cerrar('carlos', carlos)
  await cerrar('rosaK', rosaK, -10)           // cierre con faltante a propósito
  await cerrar('mariaS', mariaS)
  if (cajas.rosaN) await cerrar('rosaN', rosaN)

  // ── 12. Rendiciones: declarar y confirmar ───────────────────────────────
  const rend = []
  for (const [quien, tok, monto, modalidad] of [['elena(ag2)', elena, 110, 'ENTREGA_DIRECTA'], ['pedro(ag4)', pedro, 55, 'DEPOSITO_BANCARIO']]) {
    const r = await api('POST', '/api/caja/entregas', tok, { monto, modalidad, nroOperacion: modalidad === 'DEPOSITO_BANCARIO' ? 'BCP-778899' : null, observaciones: 'rendición simulación' })
    if (r.status < 300) { rend.push(r.json.data); nota('OK', 'rendicion.declarar', `${quien} ${r.json.data.numero} S/${monto}`) }
    else nota('FALLO', 'rendicion.declarar', `${quien} -> HTTP ${r.status} ${r.json?.message}`)
  }
  if (rend[0]) {
    const r = await api('PATCH', `/api/caja/entregas/${rend[0].id}/confirmar`, kevin, { montoConfirmado: rend[0].montoDeclarado })
    nota(r.status < 300 ? 'OK' : 'FALLO', 'rendicion.confirmar', `${rend[0].numero} -> ${r.json?.message ?? r.status}`)
  }
  if (rend[1]) {
    const r = await api('PATCH', `/api/caja/entregas/${rend[1].id}/confirmar`, kevin, { montoConfirmado: Number(rend[1].montoDeclarado) - 5, observacion: 'faltaron 5 soles' })
    nota(r.status < 300 ? 'OK' : 'FALLO', 'rendicion.confirmarConDiferencia', `${rend[1].numero} -> ${r.json?.message ?? r.status}`)
  }

  // ── 13. Verificaciones de gerente: correlativos, KPIs, excels ───────────
  const porAgencia = {}
  for (const v of ventas) {
    const m = v.boleta.match(/^VTA-(.+)-(\d{4})-(\d{5})$/)
    if (!m) { nota('VACIO', 'correlativo', `boleta con formato inesperado: ${v.boleta}`); continue }
    ;(porAgencia[m[1]] ??= []).push(Number(m[3]))
  }
  for (const [cod, nums] of Object.entries(porAgencia)) {
    nums.sort((a, b) => a - b)
    const sinHuecos = nums.every((n, i) => n === nums[0] + i)
    nota(sinHuecos ? 'OK' : 'VACIO', 'correlativo', `${cod}: ${nums.join(',')} ${sinHuecos ? '(consecutivos)' : '(¡HUECOS!)'}`)
  }

  const kpis = await api('GET', '/api/reportes/kpis', kevin)
  if (kpis.status < 300) {
    const nulos = Object.entries(kpis.json.data ?? {}).filter(([, v]) => v === null).map(([k]) => k)
    nota(nulos.length ? 'VACIO' : 'OK', 'kpis', nulos.length ? `campos null: ${nulos.join(', ')}` : 'sin campos null')
  } else nota('FALLO', 'kpis', `HTTP ${kpis.status}`)

  const hoy = new Date().toISOString().slice(0, 10)
  for (const [nombre, path] of [
    ['excel ventas', `/api/reportes/ventas/excel?desde=${hoy}T00:00:00&hasta=${hoy}T23:59:59`],
    ['excel encomiendas', '/api/reportes/encomiendas/excel'],
    ['excel rendiciones', '/api/reportes/rendiciones/excel'],
  ]) {
    const r = await api('GET', path, kevin, undefined, true)
    nota(r.status < 300 && r.bytes > 500 ? 'OK' : 'FALLO', 'reporte', `${nombre} -> HTTP ${r.status} ${r.bytes} bytes`)
  }

  const cons = await api('GET', '/api/caja/consolidado-agencias', kevin)
  nota(cons.status < 300 ? 'OK' : 'FALLO', 'consolidado', `HTTP ${cons.status}`)
  const ops = await api('GET', '/api/caja/estado-operadores', kevin)
  nota(ops.status < 300 ? 'OK' : 'FALLO', 'estado-operadores', `HTTP ${ops.status}`)

  resumen()
}

function resumen() {
  console.log('\n══════════ RESUMEN ══════════')
  console.log(`OK: ${ok.length}`)
  console.log(`HALLAZGOS (fallos/vacíos): ${hallazgos.length}`)
  for (const h of hallazgos) console.log('  ' + h)
}

main().catch(e => { console.error('ERROR FATAL:', e); resumen() })
