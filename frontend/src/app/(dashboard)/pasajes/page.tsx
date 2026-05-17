'use client'
import React, { useEffect, useState } from 'react'
import useSWR from 'swr'
import toast from 'react-hot-toast'
import QRCode from 'qrcode'
import { ChevronRight, CheckCircle, Bus, Clock, Users, Printer } from 'lucide-react'
import { SeatMap } from '@/components/modules/pasajes/SeatMap'
import { BuscadorCliente } from '@/components/modules/clientes/BuscadorCliente'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import api from '@/services/api'
import { pasajesService } from '@/services/pasajes.service'
import { useAuthStore } from '@/stores/authStore'
import type { Cliente } from '@/types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

// ─── Constantes de empresa ────────────────────────────────────────────────────

const EMPRESA = {
  nombre:    'EXPRESS QUINUAPATA VRAEM S.A.C.',
  ruc:       '20601234567',
  direccion: 'Jr. Lima 245, Mercado Andrés F. Vivanco',
  ciudad:    'Huamanga, Ayacucho',
  telefono:  '066-312456',
}

type Step = 1 | 2 | 3 | 4

interface ViajeItem {
  id: number
  estado: string
  fechaHoraSal: string
  ruta?: { id: number; origen: string; destino: string; distanciaKm: number }
  vehiculo?: { id: number; placa: string; tipo: string; numAsientos: number }
}

interface TicketData {
  correlativo: string
  pasajeId: number
  viaje: ViajeItem
  asientoNumero: number
  cliente: Cliente
  precio: number
  descuento: number
  operador: string
  emitidoEn: string
}

// ─── Ticket 80mm térmico ─────────────────────────────────────────────────────

function TicketModal({ ticket, onClose }: { ticket: TicketData; onClose: () => void }) {
  const [qrUrl, setQrUrl] = useState('')

  useEffect(() => {
    QRCode.toDataURL(ticket.correlativo, {
      width: 96, margin: 1, color: { dark: '#000000', light: '#ffffff' }
    }).then(setQrUrl)
  }, [ticket.correlativo])

  const fecha = new Date(ticket.viaje.fechaHoraSal)
  const fmt   = (n: number) => String(n).padStart(2, '0')
  const fechaViaje = `${fmt(fecha.getDate())}/${fmt(fecha.getMonth()+1)}/${fecha.getFullYear()}`
  const horaViaje  = `${fmt(fecha.getHours())}:${fmt(fecha.getMinutes())}`
  const emitido    = ticket.emitidoEn

  const imprimir = () => {
    const ventana = window.open('', '_blank', 'width=360,height=750')
    if (!ventana) return
    ventana.document.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <title>Ticket ${ticket.correlativo}</title>
      <style>
        @page { size: 80mm auto; margin: 0; }
        * { box-sizing: border-box; }
        body {
          font-family: 'Courier New', Courier, monospace;
          font-size: 11px;
          width: 80mm;
          margin: 0 auto;
          padding: 6px 8px;
          color: #000;
        }
        .center { text-align: center; }
        .bold   { font-weight: bold; }
        .big    { font-size: 16px; font-weight: bold; letter-spacing: 2px; }
        .small  { font-size: 9px; }
        .row    { display: flex; justify-content: space-between; margin: 1.5px 0; }
        .val    { text-align: right; max-width: 55%; word-break: break-word; }
        hr      { border: none; border-top: 1px dashed #555; margin: 5px 0; }
        .total  { font-size: 13px; font-weight: bold; }
        img.qr  { display: block; margin: 4px auto; width: 80px; height: 80px; }
        .seat   { font-size: 28px; font-weight: bold; text-align: center; margin: 4px 0; }
      </style>
    </head><body>
      <div class="center bold">${EMPRESA.nombre}</div>
      <div class="center small">RUC: ${EMPRESA.ruc}</div>
      <div class="center small">${EMPRESA.direccion}</div>
      <div class="center small">${EMPRESA.ciudad} | ${EMPRESA.telefono}</div>
      <hr/>
      <div class="center bold">BOLETA DE PASAJE</div>
      <div class="center small">Serie E001 — N° ${ticket.correlativo}</div>
      <div class="center small">Emitido: ${emitido}</div>
      <hr/>
      <div class="center small">RUTA</div>
      <div class="center bold" style="font-size:13px">${ticket.viaje.ruta?.origen ?? '—'} → ${ticket.viaje.ruta?.destino ?? '—'}</div>
      <div class="row"><span>Fecha viaje:</span><span class="val">${fechaViaje}</span></div>
      <div class="row"><span>Hora salida:</span><span class="val bold">${horaViaje}</span></div>
      <div class="row"><span>Vehículo:</span><span class="val">${ticket.viaje.vehiculo?.tipo ?? '—'}</span></div>
      <div class="row"><span>Placa:</span><span class="val">${ticket.viaje.vehiculo?.placa ?? '—'}</span></div>
      <hr/>
      <div class="center small">ASIENTO</div>
      <div class="seat">${String(ticket.asientoNumero).padStart(2,'0')}</div>
      <hr/>
      <div class="center small">PASAJERO</div>
      <div class="row"><span>Nombre:</span><span class="val">${ticket.cliente.nombres} ${ticket.cliente.apellidos}</span></div>
      <div class="row"><span>DNI:</span><span class="val">${ticket.cliente.numDoc}</span></div>
      <hr/>
      <div class="row"><span>Precio:</span><span class="val">S/ ${ticket.precio.toFixed(2)}</span></div>
      ${ticket.descuento > 0 ? `<div class="row"><span>Descuento:</span><span class="val">- S/ ${ticket.descuento.toFixed(2)}</span></div>` : ''}
      <div class="row total"><span>TOTAL:</span><span>S/ ${(ticket.precio - ticket.descuento).toFixed(2)}</span></div>
      <hr/>
      ${qrUrl ? `<img class="qr" src="${qrUrl}" alt="QR"/>` : ''}
      <div class="center small">Código: ${ticket.correlativo}</div>
      <hr/>
      <div class="row small"><span>Operador:</span><span class="val">${ticket.operador}</span></div>
      <hr/>
      <div class="center small" style="margin-top:4px">
        Gracias por viajar con nosotros.<br/>
        Presente este ticket al abordar.
      </div>
    </body></html>`)
    ventana.document.close()
    setTimeout(() => { ventana.print(); ventana.close() }, 400)
  }

  return (
    <div className="space-y-3">
      {/* Vista previa 80mm */}
      <div className="mx-auto bg-white border border-dashed border-gray-400 rounded p-3 font-mono text-[11px] text-gray-900"
           style={{ width: 302, maxWidth: '100%' }}>
        <div className="text-center font-bold text-[12px]">{EMPRESA.nombre}</div>
        <div className="text-center text-[9px] text-gray-500">RUC: {EMPRESA.ruc} · {EMPRESA.telefono}</div>
        <hr className="border-dashed border-gray-400 my-1.5" />
        <div className="text-center font-bold text-[11px]">BOLETA DE PASAJE</div>
        <div className="text-center text-[9px] text-gray-400">Serie E001 — N° {ticket.correlativo}</div>
        <div className="text-center text-[9px] text-gray-400">{emitido}</div>
        <hr className="border-dashed border-gray-400 my-1.5" />
        <div className="text-center font-bold text-[13px]">
          {ticket.viaje.ruta?.origen ?? '—'} → {ticket.viaje.ruta?.destino ?? '—'}
        </div>
        <div className="flex justify-between mt-0.5"><span>Fecha:</span><span>{fechaViaje}</span></div>
        <div className="flex justify-between"><span>Hora:</span><span className="font-bold">{horaViaje}</span></div>
        <div className="flex justify-between"><span>Vehículo:</span><span>{ticket.viaje.vehiculo?.tipo} · {ticket.viaje.vehiculo?.placa}</span></div>
        <hr className="border-dashed border-gray-400 my-1.5" />
        <div className="text-center text-[9px] text-gray-400">ASIENTO</div>
        <div className="text-center font-bold text-[28px] leading-none my-1">
          {String(ticket.asientoNumero).padStart(2, '0')}
        </div>
        <hr className="border-dashed border-gray-400 my-1.5" />
        <div className="flex justify-between"><span>Pasajero:</span><span className="text-right max-w-[55%] leading-tight">{ticket.cliente.nombres} {ticket.cliente.apellidos}</span></div>
        <div className="flex justify-between"><span>DNI:</span><span>{ticket.cliente.numDoc}</span></div>
        <hr className="border-dashed border-gray-400 my-1.5" />
        <div className="flex justify-between font-bold text-[13px]">
          <span>TOTAL:</span>
          <span>S/ {(ticket.precio - ticket.descuento).toFixed(2)}</span>
        </div>
        <hr className="border-dashed border-gray-400 my-1.5" />
        {qrUrl && <img src={qrUrl} className="mx-auto my-1.5" width={80} height={80} alt="QR" />}
        <div className="text-center text-[8px] text-gray-400">{ticket.correlativo}</div>
        <hr className="border-dashed border-gray-400 my-1.5" />
        <div className="flex justify-between text-[9px] text-gray-500"><span>Operador:</span><span>{ticket.operador}</span></div>
        <hr className="border-dashed border-gray-400 my-1.5" />
        <div className="text-center text-[8px] text-gray-400 leading-snug">
          Gracias por viajar con nosotros.<br />Presente este ticket al abordar.
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="secondary" onClick={onClose} className="flex-1">Cerrar</Button>
        <Button variant="primary" icon={Printer} onClick={imprimir} className="flex-1">
          Imprimir (80mm)
        </Button>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function PasajesPage() {
  const { user } = useAuthStore()

  const [step, setStep]             = useState<Step>(1)
  const [viaje, setViaje]           = useState<ViajeItem | null>(null)
  const [asientoSel, setAsientoSel] = useState<{ id: number; numero: number } | null>(null)
  const [cliente, setCliente]       = useState<Cliente | null>(null)
  const [loading, setLoading]       = useState(false)
  const [tarifa, setTarifa]         = useState<{ id: number; precio: number } | null>(null)
  const [cargandoTarifa, setCargandoTarifa] = useState(false)
  const [ticket, setTicket]             = useState<TicketData | null>(null)
  const [ticketModalOpen, setTicketModalOpen] = useState(false)

  const { data: viajesData } = useSWR('/api/viajes?estado=PROGRAMADO')
  const viajes: ViajeItem[] = viajesData || []

  const seleccionarViaje = async (v: ViajeItem) => {
    setViaje(v)
    setTarifa(null)
    setAsientoSel(null)
    if (v.ruta?.id && v.vehiculo?.tipo) {
      setCargandoTarifa(true)
      try {
        const res = await api.get(`/api/tarifas/buscar?rutaId=${v.ruta.id}&tipoVehiculo=${v.vehiculo.tipo}`)
        const data = (res.data as any)?.data
        if (data) setTarifa({ id: data.id, precio: Number(data.precio) })
      } catch {
        toast('Sin tarifa registrada para esta ruta — usando precio base', { icon: '⚠️' })
      } finally {
        setCargandoTarifa(false)
      }
    }
    setStep(2)
  }

  const handleVenderPasaje = async () => {
    if (!viaje || !asientoSel || !cliente) return
    setLoading(true)
    try {
      const result = await pasajesService.venderPasaje({
        viajeId:   viaje.id,
        asientoId: asientoSel.id,
        clienteId: cliente.id,
        tarifaId:  tarifa?.id ?? 1,
      })
      const pasajeData = (result as any)?.data
      const ahora = new Date()
      const fmt = (n: number) => String(n).padStart(2, '0')

      setTicket({
        correlativo:    pasajeData?.correlativo ?? 'P-001',
        pasajeId:       pasajeData?.id ?? 0,
        viaje,
        asientoNumero:  asientoSel.numero,
        cliente,
        precio:         tarifa?.precio ?? pasajeData?.precioFinal ?? 0,
        descuento:      pasajeData?.montoDescuento ?? 0,
        operador:       user?.nombre ?? 'Operador',
        emitidoEn:      `${fmt(ahora.getDate())}/${fmt(ahora.getMonth()+1)}/${ahora.getFullYear()} ${fmt(ahora.getHours())}:${fmt(ahora.getMinutes())}`,
      })
      toast.success(`Pasaje emitido — asiento ${asientoSel.numero}`)
      setStep(4)
      setTicketModalOpen(true)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al vender el pasaje')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setStep(1); setViaje(null); setAsientoSel(null)
    setCliente(null); setTarifa(null); setTicket(null); setTicketModalOpen(false)
  }

  const steps = [
    { n: 1, label: 'Viaje' },
    { n: 2, label: 'Asiento' },
    { n: 3, label: 'Pasajero' },
    { n: 4, label: 'Confirmación' },
  ]

  const formatFecha = (iso: string) => {
    try { return format(new Date(iso), "dd MMM · HH:mm", { locale: es }) } catch { return iso }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Venta de Pasajes</h1>
        <p className="text-sm text-gray-500">Selecciona viaje, asiento y pasajero</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-1.5">
        {steps.map(({ n, label }, i) => (
          <React.Fragment key={n}>
            <div className="flex items-center gap-1.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                step > n  ? 'bg-green-500 text-white'
                : step === n ? 'bg-[#1F3864] text-white'
                : 'bg-gray-200 text-gray-500'
              }`}>
                {step > n ? <CheckCircle size={14} /> : n}
              </div>
              <span className={`text-sm hidden sm:inline ${step === n ? 'font-semibold text-gray-900' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && <ChevronRight size={14} className="text-gray-300 mx-1 shrink-0" />}
          </React.Fragment>
        ))}
      </div>

      {/* ── PASO 1: Lista de viajes ── */}
      {step === 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Viajes programados</h3>
          {viajes.length === 0 && (
            <p className="text-sm text-gray-400 py-6 text-center">No hay viajes programados disponibles</p>
          )}
          {viajes.map((v) => (
            <button key={v.id} onClick={() => seleccionarViaje(v)}
              className="w-full flex items-start justify-between p-4 rounded-xl border border-gray-200 hover:border-[#0070C0] hover:bg-blue-50 transition-all text-left">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#1F3864] flex items-center justify-center shrink-0">
                  <Bus size={16} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {v.ruta?.origen ?? '—'} → {v.ruta?.destino ?? '—'}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock size={11} /> {formatFecha(v.fechaHoraSal)}
                    </span>
                    {v.vehiculo && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Users size={11} /> {v.vehiculo.tipo} · {v.vehiculo.placa}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Badge estado={v.estado} />
            </button>
          ))}
        </div>
      )}

      {/* ── PASO 2: Mapa de asientos ── */}
      {step === 2 && viaje && (
        <div className="space-y-4">
          <div className="bg-[#1F3864] rounded-xl p-4 text-white">
            <p className="text-xs text-blue-300 uppercase tracking-wide">Viaje seleccionado</p>
            <p className="text-base font-bold mt-1">
              {viaje.ruta?.origen ?? '—'} → {viaje.ruta?.destino ?? '—'}
            </p>
            <p className="text-sm text-blue-200 mt-0.5">
              {formatFecha(viaje.fechaHoraSal)}
              {viaje.vehiculo && ` · ${viaje.vehiculo.tipo} ${viaje.vehiculo.placa}`}
            </p>
          </div>

          <SeatMap
            viajeId={viaje.id}
            selectedId={asientoSel?.id}
            onSelect={(id, numero) => setAsientoSel({ id, numero })}
          />

          {asientoSel && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">Asiento seleccionado</p>
                <p className="text-2xl font-bold text-[#1F3864]">
                  {String(asientoSel.numero).padStart(2, '0')}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Precio</p>
                {cargandoTarifa ? (
                  <p className="text-sm text-gray-400 animate-pulse">Consultando...</p>
                ) : (
                  <p className="text-lg font-bold text-green-600">
                    {tarifa ? `S/ ${tarifa.precio.toFixed(2)}` : 'S/ —'}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-between gap-3">
            <Button variant="secondary" onClick={() => { setStep(1); setAsientoSel(null) }}>Volver</Button>
            <Button variant="primary" disabled={!asientoSel} onClick={() => setStep(3)}>
              {asientoSel ? `Continuar — Asiento ${asientoSel.numero}` : 'Selecciona un asiento'}
            </Button>
          </div>
        </div>
      )}

      {/* ── PASO 3: Datos del pasajero ── */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Datos del pasajero</h3>

            {/* Resumen del viaje */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg text-sm">
              <div className="w-8 h-8 rounded-lg bg-[#1F3864] flex items-center justify-center shrink-0">
                <Bus size={14} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900">
                  {viaje?.ruta?.origen} → {viaje?.ruta?.destino}
                </p>
                <p className="text-xs text-gray-500">
                  {formatFecha(viaje?.fechaHoraSal ?? '')} · Asiento #{asientoSel?.numero}
                  {tarifa && ` · S/ ${tarifa.precio.toFixed(2)}`}
                </p>
              </div>
            </div>

            {/* BuscadorCliente compartido con registro inline */}
            <BuscadorCliente
              label="Pasajero *"
              value={cliente}
              onChange={setCliente}
            />
          </div>

          <div className="flex justify-between gap-3">
            <Button variant="secondary" onClick={() => setStep(2)}>Volver</Button>
            <Button
              variant="primary"
              disabled={!cliente || loading}
              loading={loading}
              onClick={handleVenderPasaje}
            >
              {cliente
                ? `Emitir pasaje${tarifa ? ` · S/ ${tarifa.precio.toFixed(2)}` : ''}`
                : 'Selecciona un pasajero'}
            </Button>
          </div>
        </div>
      )}

      {/* ── PASO 4: Éxito ── */}
      {step === 4 && ticket && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle size={32} className="text-green-500" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">¡Pasaje emitido!</h3>
          <div className="space-y-1 text-sm text-gray-500">
            <p className="font-semibold text-gray-800">
              {ticket.cliente.apellidos}, {ticket.cliente.nombres}
            </p>
            <p>
              Asiento <span className="font-semibold text-gray-800">
                {String(ticket.asientoNumero).padStart(2,'0')}
              </span>
              {' · '}
              {ticket.viaje.ruta?.origen} → {ticket.viaje.ruta?.destino}
            </p>
            <p>{formatFecha(ticket.viaje.fechaHoraSal)}</p>
            <p className="font-semibold text-green-600 text-base">
              S/ {(ticket.precio - ticket.descuento).toFixed(2)}
            </p>
          </div>

          <div className="inline-block bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
            <p className="text-xs text-blue-500 font-medium">N° Boleta</p>
            <p className="text-lg font-bold text-[#1F3864] font-mono">{ticket.correlativo}</p>
          </div>

          <div className="flex gap-3 justify-center pt-2">
            <Button variant="secondary" onClick={resetForm}>Nueva venta</Button>
            <Button variant="primary" icon={Printer} onClick={() => setTicketModalOpen(true)}>
              Ver e imprimir ticket
            </Button>
          </div>
        </div>
      )}

      {/* ── Modal ticket 80mm ── */}
      {ticket && (
        <Modal
          open={ticketModalOpen}
          onClose={() => setTicketModalOpen(false)}
          title="Ticket de pasaje"
          size="sm"
        >
          <TicketModal ticket={ticket} onClose={() => setTicketModalOpen(false)} />
        </Modal>
      )}
    </div>
  )
}
