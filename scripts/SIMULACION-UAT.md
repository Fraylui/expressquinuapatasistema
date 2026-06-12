# Simulación de operación real (UAT) — resultados
> Ejecutada: 12/6/2026, 12:49:50 a. m. · Backend dev · Datos ficticios

## Problemas encontrados
- (ninguno)

## Observaciones (no bloquean, revisar)
- V4 cancelado CON 2 pasajeros vendidos → revisar qué pasó con sus boletas y el dinero (mensaje: "Viaje cancelado")

## Bitácora completa
```
# Simulación de operación real — 12/6/2026, 12:49:50 a. m.

  (rate limit de login — esperando 65 s para superadmin@expressvraem.com)
## Fase 0 — Preparación y limpieza de datos de prueba
  ✓ Cuota de salida de combi configurada en S/ 10.00
  ✓ Encargado asignado: Elena (Kimbiri)
  ✓ Encargado asignado: Kevin (Huamanga)
Catálogos: 8 rutas, 9 vehículos, 5 conductores con licencia vigente

## Fase 1 — GERENTE programa los viajes del día
  ✓ V1: Huamanga→Kimbiri COMBI (AYA-456) en 1 h
  ✓ V2: Huamanga→Kimbiri CAMIONETA (AYA-321) en 2 h
  ✓ V3: Kimbiri→Huamanga COMBI (KIM-111) en 2 h
  ✓ V4: Huamanga→Pichari COMBI (AYA-789) en 3 h (se cancelará)
  ✓ V5: Huamanga→Kimbiri COMBI (AYA-987) mañana (venta anticipada)
  ✓ Caso límite: programar AYA-456 de nuevo a la misma hora (conflicto de vehículo) → rechazado como corresponde ("Error de validación [must not be null]")

## Fase 2 — Casos límite de caja ANTES de abrir turno
Tarifas vigentes: HUA→KIM combi S/55 · camioneta S/90 · KIM→HUA combi S/55 · HUA→PIC combi S/55
  ✓ Venta de pasaje sin caja rechazada: "Debe tener un turno de caja abierto para vender pasajes al contado. Abra su caja primero."
  ✓ Encomienda al contado SIN caja abierta (María) → rechazado como corresponde ("Debe tener un turno de caja abierto para cobrar encomiendas al contado. Abra su caja primero.")

## Fase 3 — OPERADOR Carlos (Huamanga): turno completo
  ✓ Carlos abre caja con S/ 200.00
Promos vigentes: 1 de pasajes, 1 de encomiendas
  promo pasajes: {"id":2,"nombre":"Ida y Vuelta","descripcion":null,"codigo":null,"tipoDescuento":"IDA_VUELTA","valor":15,"aplicaA":"PASAJES","fechaInicio":null,"fechaFin":null,"activa":true,"vigente":true,"limiteUsos":null,"usosActuales":4,"agenciaId":null,"creadoEn":"2026-06-03T01:29:59.680214"}
  ✓ 6/6 pasajes vendidos en V1 (efectivo y Yape)
  ✓ Pasaje con promo "Ida y Vuelta" (desc S/ 15.00) en V1 asiento 7
  ✓ Reserva creada en V1 asiento 8
  ✓ Reserva confirmada (pago EFECTIVO)
  ✓ Caso límite: vender el asiento 1 de V1 otra vez (doble venta) → rechazado como corresponde ("El asiento número 1 ya fue ocupado o reservado. Por favor selecciona otro asiento.")
  ✓ Caso límite: venta con promocionId inexistente (99999) → rechazado como corresponde ("Promocion no encontrado con id: 99999")
  ✓ Caso límite: usar promo desactivada "Ida y Vuelta" → rechazado como corresponde ("La promoción «Ida y Vuelta» no está vigente o no aplica aquí")
  ✓ Pasaje del asiento 9 anulado con devolución (egreso en caja de Carlos)
  ✓ 3/3 pasajes vendidos en V2 (camioneta)
  ✓ 2/2 pasajes vendidos en V4 (este viaje se cancelará)
  ✓ Venta anticipada en V5 (viaje de mañana)
  ✓ E1: encomienda al contado EFECTIVO S/ 15 (caja Carlos)
  ✓ E2: encomienda POR_COBRAR S/ 20 (paga el destinatario en Kimbiri)
  ✓ E3: encomienda FRÁGIL al contado YAPE S/ 25
  ✓ E4: encomienda con promo "Envio Gratis Sabado" S/ 18 − 5.00
  ✓ X1: externa, conductor YA PAGÓ S/ 8 (entra a caja Carlos)
  ✓ X2: externa POR_COBRAR S/ 12 (paga el destinatario al recoger)
  ✓ X2 entregada al destinatario cobrando S/ 12 EFECTIVO

## Fase 4 — María: turno corto con descuadre intencional
  ✓ María abre caja con S/ 100.00
  ✓ María vendió 2/2 pasajes en V2 (camioneta)
  ✓ María registra encomienda al contado S/ 10

## Fase 5 — Salidas, cancelación y operación en destino (Rosa, Kimbiri)
  ✓ Salida de V1 confirmada por Carlos (combi → cuota S/ 10 a su caja)
  ✓ Salida de V2 confirmada por Carlos (camioneta → sin cuota)
  ~ OBS: V4 cancelado CON 2 pasajeros vendidos → revisar qué pasó con sus boletas y el dinero (mensaje: "Viaje cancelado")
  ✓ Rosa abre caja con S/ 150.00
  ✓ Rosa vendió 4 pasajes en V3 (Kimbiri→Huamanga)
  ✓ Rosa registra encomienda Kimbiri→Huamanga POR_COBRAR S/ 14
  ✓ Salida de V3 confirmada por Rosa (combi → cuota S/ 10 a su caja)
  ✓ Llegada de V1 confirmada por Rosa (Kimbiri)
  ✓ Recepción en Kimbiri de 4 encomiendas de V1
  ✓ E1 marcada DISPONIBLE para recoger
  ✓ E1 entregada en Kimbiri (ya estaba pagada)
  ✓ E2 entregada directo desde LLEGADO_AGENCIA, cobrando S/ 20 EFECTIVO (caja Rosa)
  ✓ Tracking público de E3 (EXP-2026-00034): estado LLEGADO_AGENCIA
  ✓ Llegada de V3 confirmada por Carlos (Huamanga)

## Fase 6 — Manifiestos
  ✓ Manifiesto de V1 generado/persistido
  ✓ Manifiesto V1: 8 pasajeros, 5 encomiendas
  ✓ PDF de manifiesto V1: 3809 bytes

## Fase 7 — Cierres de caja y cuadre
  ✓ Elena (ADMIN_AGENCIA Kimbiri) ve sus KPIs: ingresos hoy S/ 250
  ✓ Elena ve estado de operadores de Kimbiri: 2 operadores
  ✓ Carlos cierra caja: esperado S/ 1149.75, físico S/ 1149.75
  ✓ Carlos: diferencia registrada S/ 0.00
  ✓ Rosa cierra caja: esperado S/ 400.00, físico S/ 400.00
  ✓ Rosa: diferencia registrada S/ 0.00
  ✓ María cierra caja: esperado S/ 290.00, físico S/ 285.00
  ✓ María: diferencia registrada S/ -5.00

## Fase 8 — Cuadre del día (al céntimo)
Reporte de ingresos de HOY: S/ 1444.75 en 30 operaciones
  · PASAJE_COMBI: S/ 871.75 (16 ops)
  · PASAJE_CAMIONETA: S/ 450.00 (5 ops)
  · ENCOMIENDA: S/ 63.00 (4 ops)
  · CUOTA_SALIDA_COMBI: S/ 20.00 (2 ops)
  · ENC_EXTERNA: S/ 20.00 (2 ops)
  · ENC_PAGO_DESTINO: S/ 20.00 (1 ops)
  Caja Carlos: ingresos S/ 1004.75
  Caja Rosa: ingresos S/ 250.00
  Caja María: ingresos S/ 190.00
  ✓ CUADRE EXACTO: reporte S/ 1444.75 = cajas S/ 1444.75
  ✓ Consolidado por agencia disponible (0 agencias con caja abierta tras los cierres)

════════════════════════════════════════════════════════════
RESUMEN: 0 problemas, 1 observaciones
```
