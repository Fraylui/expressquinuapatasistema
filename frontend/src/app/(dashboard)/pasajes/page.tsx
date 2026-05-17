'use client'
import React, { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import toast from 'react-hot-toast'
import QRCode from 'qrcode'
import {
  Bus, CheckCircle, ChevronRight, Clock, Printer,
  Search, Users, X, AlertTriangle, FileText
} from 'lucide-react'
import { SeatMap } from '@/components/modules/pasajes/SeatMap'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import api from '@/services/api'
import { pasajesService, PasajeResponseDTO, VentaPasajeDTO } from '@/services/pasajes.service'
import { useAuthStore } from '@/stores/authStore'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Pasaje } from '@/types'

// ─── Empresa ──────────────────────────────────────────────────────────────────
const EMPRESA = {
  nombre:    'EXPRESS QUINUAPATA VRAEM S.A.C.',
  ruc:       '20601234567',
  direccion: 'Jr. Lima 245, Mercado Andrés F. Vivanco',
  ciudad:    'Huamanga, Ayacucho',
  telefono:  '066-312456',
}

// ─── Tipos locales ─────────────────────────────────────────────────────────────
type Step = 1 | 2 | 3 | 4

interface ViajeDisponible {
  id: number
  estado: string
  fechaHoraSal: string
  asientosLibres: number
  ruta?: { id: number; origen: string; destino: string; distanciaKm?: number }
  vehiculo?: { id: number; placa: string; tipo: string; numAsientos: number }
}

interface ClienteFound {
  id: number
  nombres: string
  apellidos: string
  numDoc: string
  telefono?: string
}

// ─── Ticket 80mm ─────────────────────────────────────────────────────────────
interface TicketInfo {
  codigoBoleta: string
  pasajeId: number
  viaje: ViajeDisponible
  asientoNumero: number
  clienteNombres: string
  clienteApellidos: string
  clienteDni: string
  precioBase: number
  descuento: number
  precioFinal: number
  formaPago: string
  operador: string
  emitidoEn: string
}

function TicketPreview({ t, onClose }: { t: TicketInfo; onClose: () => void }) {
  const [qrUrl, setQrUrl] = useState('')

  useEffect(() => {
    QRCode.toDataURL(t.codigoBoleta, {
      width: 96, margin: 1, color: { dark: '#000000', light: '#ffffff' }
    }).then(setQrUrl)
  }, [t.codigoBoleta])

  const fecha = new Date(t.viaje.fechaHoraSal)
  const pad   = (n: number) => String(n).padStart(2, '0')
  const fechaViaje = `${pad(fecha.getDate())}/${pad(fecha.getMonth() + 1)}/${fecha.getFullYear()}`
  const horaViaje  = `${pad(fecha.getHours())}:${pad(fecha.getMinutes())}`

  const imprimir = () => {
    const w = window.open('', '_blank', 'width=360,height=800')
    if (!w) return
    w.document.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <title>Ticket ${t.codigoBoleta}</title>
      <style>
        @page { size: 80mm auto; margin: 0; }
        * { box-sizing: border-box; }
        body { font-family: 'Courier New', monospace; font-size: 11px; width: 80mm; margin: 0 auto; padding: 6px 8px; color: #000; }
        .c  { text-align: center; }
        .b  { font-weight: bold; }
        .sm { font-size: 9px; }
        .lg { font-size: 16px; font-weight: bold; letter-spacing: 1px; }
        .row{ display: flex; justify-content: space-between; margin: 1.5px 0; }
        .v  { text-align: right; max-width: 55%; word-break: break-word; }
        hr  { border: none; border-top: 1px dashed #555; margin: 4px 0; }
        .seat{ font-size: 30px; font-weight: bold; text-align: center; margin: 4px 0; }
        .tot { font-size: 13px; font-weight: bold; }
        img.qr{ display: block; margin: 3px auto; width: 80px; height: 80px; }
      </style>
    </head><body>
      <div class="c b lg">${EMPRESA.nombre}</div>
      <div class="c sm">RUC: ${EMPRESA.ruc}</div>
      <div class="c sm">${EMPRESA.direccion}</div>
      <div class="c sm">${EMPRESA.ciudad} | ${EMPRESA.telefono}</div>
      <hr/>
      <div class="c b" style="font-size:13px">BOLETA DE PASAJE</div>
      <div class="c sm">N° ${t.codigoBoleta}</div>
      <div class="c sm">Emitido: ${t.emitidoEn}</div>
      <hr/>
      <div class="c sm">RUTA</div>
      <div class="c b" style="font-size:14px">${t.viaje.ruta?.origen ?? '—'} → ${t.viaje.ruta?.destino ?? '—'}</div>
      <div class="row"><span>Fecha:</span><span class="v">${fechaViaje}</span></div>
      <div class="row"><span>Hora salida:</span><span class="v b">${horaViaje}</span></div>
      <div class="row"><span>Vehículo:</span><span class="v">${t.viaje.vehiculo?.tipo ?? '—'}</span></div>
      <div class="row"><span>Placa:</span><span class="v">${t.viaje.vehiculo?.placa ?? '—'}</span></div>
      <hr/>
      <div class="c sm">ASIENTO</div>
      <div class="seat">${String(t.asientoNumero).padStart(2, '0')}</div>
      <hr/>
      <div class="c sm">PASAJERO</div>
      <div class="row"><span>Nombre:</span><span class="v">${t.clienteNombres} ${t.clienteApellidos}</span></div>
      <div class="row"><span>DNI:</span><span class="v">${t.clienteDni}</span></div>
      <hr/>
      <div class="row"><span>Precio base:</span><span class="v">S/ ${t.precioBase.toFixed(2)}</span></div>
      ${t.descuento > 0 ? `<div class="row"><span>Descuento:</span><span class="v">- S/ ${t.descuento.toFixed(2)}</span></div>` : ''}
      <div class="row tot"><span>TOTAL A PAGAR:</span><span>S/ ${t.precioFinal.toFixed(2)}</span></div>
      <div class="row sm"><span>Forma de pago:</span><span class="v">${t.formaPago}</span></div>
      <hr/>
      ${qrUrl ? `<img class="qr" src="${qrUrl}" alt="QR"/>` : ''}
      <div class="c sm">Código: ${t.codigoBoleta}</div>
      <hr/>
      <div class="row sm"><span>Operador:</span><span class="v">${t.operador}</span></div>
      <hr/>
      <div class="c sm" style="margin-top:5px">¡Buen viaje! Presente este ticket al abordar.</div>
    </body></html>`)
    w.document.close()
    setTimeout(() => { w.print(); w.close() }, 400)
  }

  return (
    <div className="space-y-3">
      {/* Vista previa */}
      <div className="mx-auto bg-white border border-dashed border-gray-400 rounded p-3 font-mono text-[11px] text-gray-900"
           style={{ width: 302, maxWidth: '100%' }}>
        <div className="text-center font-bold text-[12px]">{EMPRESA.nombre}</div>
        <div className="text-center text-[9px] text-gray-500">RUC: {EMPRESA.ruc} · {EMPRESA.telefono}</div>
        <hr className="border-dashed border-gray-400 my-1.5" />
        <div className="text-center font-bold text-[11px]">BOLETA DE PASAJE</div>
        <div className="text-center text-[9px] text-gray-400">N° {t.codigoBoleta}</div>
        <div className="text-center text-[9px] text-gray-400">{t.emitidoEn}</div>
        <hr className="border-dashed border-gray-400 my-1.5" />
        <div className="text-center font-bold text-[13px]">
          {t.viaje.ruta?.origen ?? '—'} → {t.viaje.ruta?.destino ?? '—'}
        </div>
        <div className="flex justify-between mt-0.5 text-[10px]">
          <span>Fecha:</span><span>{fechaViaje}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span>Hora:</span><span className="font-bold">{horaViaje}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span>Vehículo:</span>
          <span>{t.viaje.vehiculo?.tipo} · {t.viaje.vehiculo?.placa}</span>
        </div>
        <hr className="border-dashed border-gray-400 my-1.5" />
        <div className="text-center text-[9px] text-gray-400">ASIENTO</div>
        <div className="text-center font-bold text-[28px] leading-none my-1">
          {String(t.asientoNumero).padStart(2, '0')}
        </div>
        <hr className="border-dashed border-gray-400 my-1.5" />
        <div className="flex justify-between text-[10px]">
          <span>Pasajero:</span>
          <span className="text-right max-w-[55%] leading-tight">{t.clienteNombres} {t.clienteApellidos}</span>
        </div>
        <div className="flex justify-between text-[10px]"><span>DNI:</span><span>{t.clienteDni}</span></div>
        <hr className="border-dashed border-gray-400 my-1.5" />
        <div className="flex justify-between font-bold text-[13px]">
          <span>TOTAL:</span><span>S/ {t.precioFinal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-[9px] text-gray-500">
          <span>Forma pago:</span><span>{t.formaPago}</span>
        </div>
        <hr className="border-dashed border-gray-400 my-1.5" />
        {qrUrl && <img src={qrUrl} className="mx-auto my-1" width={80} height={80} alt="QR" />}
        <div className="text-center text-[8px] text-gray-400">{t.codigoBoleta}</div>
        <hr className="border-dashed border-gray-400 my-1.5" />
        <div className="flex justify-between text-[9px] text-gray-500">
          <span>Operador:</span><span>{t.operador}</span>
        </div>
        <hr className="border-dashed border-gray-400 my-1.5" />
        <div className="text-center text-[8px] text-gray-400 leading-snug">
          ¡Buen viaje! Presente este ticket al abordar.
        </div>
      </div>
      <div className="flex gap-3">
        <Button variant="secondary" onClick={onClose} className="flex-1">Cerrar</Button>
        <Button variant="primary" icon={Printer} onClick={imprimir} className="flex-1">
          Imprimir 80mm
        </Button>
      </div>
    </div>
  )
}

// ─── Búsqueda DNI ─────────────────────────────────────────────────────────────
function BuscadorDni({
  onFound, disabled
}: {
  onFound: (c: ClienteFound) => void
  disabled?: boolean
}) {
  const [dni, setDni]         = useState('')
  const [buscando, setBuscando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const buscar = async () => {
    const d = dni.trim()
    if (d.length !== 8) { toast.error('El DNI debe tener exactamente 8 dígitos'); return }
    setBuscando(true)
    try {
      const res = await api.get(`/api/clientes/buscar?dni=${d}`)
      const c = (res as any)?.data?.data ?? (res as any)?.data
      onFound({ id: c.id, nombres: c.nombres, apellidos: c.apellidos, numDoc: c.numDoc, telefono: c.telefono })
    } catch {
      toast('DNI no encontrado — puede registrar los datos manualmente', { icon: 'ℹ️' })
      onFound({ id: 0, nombres: '', apellidos: '', numDoc: d, telefono: '' })
    } finally {
      setBuscando(false)
    }
  }

  return (
    <div className="flex gap-2">
      <input
        ref={inputRef}
        value={dni}
        onChange={e => setDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
        onKeyDown={e => e.key === 'Enter' && buscar()}
        placeholder="DNI (8 dígitos)"
        disabled={disabled || buscando}
        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30 focus:border-[#1F3864] disabled:bg-gray-100"
        maxLength={8}
      />
      <Button
        variant="secondary"
        icon={Search}
        onClick={buscar}
        loading={buscando}
        disabled={dni.length !== 8 || disabled}
      >
        Buscar
      </Button>
    </div>
  )
}

// ─── Stepper ──────────────────────────────────────────────────────────────────
const STEPS = [
  { n: 1, label: 'Viaje' },
  { n: 2, label: 'Asiento' },
  { n: 3, label: 'Pasajero' },
  { n: 4, label: 'Listo' },
] as const

function Stepper({ step }: { step: Step }) {
  return (
    <div className="flex items-center gap-1.5">
      {STEPS.map(({ n, label }, i) => (
        <React.Fragment key={n}>
          <div className="flex items-center gap-1.5">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
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
          {i < STEPS.length - 1 && <ChevronRight size={14} className="text-gray-300 mx-1 shrink-0" />}
        </React.Fragment>
      ))}
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatFecha(iso?: string) {
  if (!iso) return '—'
  try { return format(new Date(iso), "dd MMM · HH:mm", { locale: es }) } catch { return iso }
}

function estadoPasajeBadge(estado: string) {
  if (estado === 'VENDIDO') return 'bg-green-100 text-green-700 border-green-300'
  if (estado === 'ANULADO') return 'bg-red-100 text-red-700 border-red-300'
  return 'bg-gray-100 text-gray-600 border-gray-300'
}

const fetcher = (url: string) => api.get<any, any>(url).then(r => r.data)

// ─── Página principal ─────────────────────────────────────────────────────────
export default function PasajesPage() {
  const { user } = useAuthStore()
  const rol = user?.rol ?? ''
  const maxDescuento = rol === 'OPERADOR' ? 5 : 9999

  // Wizard state
  const [step, setStep]               = useState<Step>(1)
  const [viaje, setViaje]             = useState<ViajeDisponible | null>(null)
  const [asientoNum, setAsientoNum]   = useState<number | null>(null)
  const [clienteFound, setClienteFound] = useState<ClienteFound | null>(null)
  const [resultado, setResultado]     = useState<PasajeResponseDTO | null>(null)
  const [ticketOpen, setTicketOpen]   = useState(false)
  const [loading, setLoading]         = useState(false)

  // Tarifa
  const [precioBase, setPrecioBase]   = useState('')
  const [descuento, setDescuento]     = useState('0')
  const [formaPago, setFormaPago]     = useState('EFECTIVO')
  const [motivoDesc, setMotivoDesc]   = useState('')

  // Pasajero form (filled after DNI search)
  const [pNombres, setPNombres]       = useState('')
  const [pApellidos, setPApellidos]   = useState('')
  const [pTelefono, setPTelefono]     = useState('')

  // List + anular
  const [listFiltroEstado, setListFiltroEstado]   = useState('')
  const [listFiltroCodigo, setListFiltroCodigo]   = useState('')
  const [anularModal, setAnularModal] = useState<{ open: boolean; id: number; codigo: string }>({
    open: false, id: 0, codigo: ''
  })
  const [anularMotivo, setAnularMotivo] = useState('')
  const [anulando, setAnulando]         = useState(false)

  // Data
  const { data: viajesData, mutate: mutateViajes } =
    useSWR<any>('/api/viajes/disponibles', fetcher, { refreshInterval: 15000 })
  const viajes: ViajeDisponible[] = viajesData?.data ?? []

  const listParams = new URLSearchParams()
  if (listFiltroEstado) listParams.set('estado', listFiltroEstado)
  if (listFiltroCodigo) listParams.set('codigoBoleta', listFiltroCodigo)
  const { data: listData, mutate: mutateList } =
    useSWR<any>(`/api/pasajes?${listParams.toString()}`, fetcher, { refreshInterval: 10000 })
  const pasajes: Pasaje[] = listData?.data ?? []

  // Tarifa automática al elegir viaje
  const cargarTarifa = async (v: ViajeDisponible) => {
    if (!v.ruta?.id || !v.vehiculo?.tipo) return
    try {
      const res = await api.get(`/api/tarifas/buscar?rutaId=${v.ruta.id}&tipoVehiculo=${v.vehiculo.tipo}`)
      const d = (res as any)?.data?.data
      if (d?.precio) setPrecioBase(String(Number(d.precio).toFixed(2)))
    } catch {
      /* sin tarifa registrada — usuario ingresa precio manualmente */
    }
  }

  const seleccionarViaje = async (v: ViajeDisponible) => {
    setViaje(v)
    setAsientoNum(null)
    setPrecioBase('')
    setDescuento('0')
    setFormaPago('EFECTIVO')
    await cargarTarifa(v)
    setStep(2)
  }

  const continuarAStep3 = () => {
    if (!asientoNum) { toast.error('Selecciona un asiento'); return }
    setStep(3)
  }

  // Cuando se encuentra el cliente por DNI
  const handleClienteFound = (c: ClienteFound) => {
    setClienteFound(c)
    setPNombres(c.nombres)
    setPApellidos(c.apellidos)
    setPTelefono(c.telefono ?? '')
  }

  const handleVender = async () => {
    if (!viaje || !asientoNum) return
    const dniVal = clienteFound?.numDoc ?? ''
    if (!/^\d{8}$/.test(dniVal)) { toast.error('El DNI debe tener exactamente 8 dígitos'); return }
    if (!pNombres.trim()) { toast.error('Ingresa el nombre del pasajero'); return }
    if (!pApellidos.trim()) { toast.error('Ingresa los apellidos del pasajero'); return }
    if (!/^9\d{8}$/.test(pTelefono.trim())) { toast.error('El teléfono debe tener 9 dígitos y empezar en 9'); return }
    const base = parseFloat(precioBase)
    if (isNaN(base) || base <= 0) { toast.error('Ingresa un precio base válido'); return }
    const desc = parseFloat(descuento) || 0
    if (desc > maxDescuento) {
      toast.error(`Descuento máximo para tu rol: S/ ${maxDescuento.toFixed(2)}`)
      return
    }

    const dto: VentaPasajeDTO = {
      viajeId: viaje.id,
      asientoNumero: asientoNum,
      clienteDni: dniVal,
      clienteNombres: pNombres.trim(),
      clienteApellidos: pApellidos.trim(),
      clienteTelefono: pTelefono.trim(),
      precioBase: base,
      descuento: desc,
      formaPago,
      motivoDescuento: desc > 0 ? motivoDesc.trim() || undefined : undefined,
    }

    setLoading(true)
    try {
      const res = await pasajesService.vender(dto)
      setResultado(res.data)
      toast.success(`Pasaje emitido — ${res.data.codigoBoleta}`)
      setStep(4)
      setTicketOpen(true)
      mutateList()
      mutateViajes()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al vender el pasaje')
    } finally {
      setLoading(false)
    }
  }

  const handleAnular = async () => {
    if (!anularMotivo.trim()) { toast.error('El motivo de anulación es obligatorio'); return }
    setAnulando(true)
    try {
      await pasajesService.anular(anularModal.id, anularMotivo.trim())
      toast.success('Pasaje anulado correctamente')
      setAnularModal({ open: false, id: 0, codigo: '' })
      setAnularMotivo('')
      mutateList()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al anular el pasaje')
    } finally {
      setAnulando(false)
    }
  }

  const resetWizard = () => {
    setStep(1); setViaje(null); setAsientoNum(null)
    setClienteFound(null); setResultado(null); setTicketOpen(false)
    setPNombres(''); setPApellidos(''); setPTelefono('')
    setPrecioBase(''); setDescuento('0'); setFormaPago('EFECTIVO'); setMotivoDesc('')
  }

  // ── Ticket info para preview ─────────────────────────────────────────────
  const ticketInfo: TicketInfo | null = resultado && viaje ? {
    codigoBoleta:   resultado.codigoBoleta,
    pasajeId:       resultado.id,
    viaje,
    asientoNumero:  resultado.asientoNumero,
    clienteNombres: resultado.clienteNombres,
    clienteApellidos: resultado.clienteApellidos,
    clienteDni:     resultado.clienteDni,
    precioBase:     resultado.precioBase,
    descuento:      resultado.descuento,
    precioFinal:    resultado.precioFinal,
    formaPago:      resultado.formaPago,
    operador:       user?.nombre ?? 'Operador',
    emitidoEn:      formatFecha(resultado.fechaVenta),
  } : null

  const descNum = parseFloat(descuento) || 0
  const baseNum = parseFloat(precioBase) || 0
  const totalNum = Math.max(0, baseNum - descNum)

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Venta de Pasajes</h1>
        <p className="text-sm text-gray-500">Selecciona el viaje, asiento y datos del pasajero</p>
      </div>

      {/* Stepper */}
      <Stepper step={step} />

      {/* ── PASO 1: Viajes disponibles ── */}
      {step === 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Viajes disponibles hoy</h3>
          {viajes.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No hay viajes con asientos disponibles</p>
          ) : (
            viajes.map(v => (
              <button key={v.id} onClick={() => seleccionarViaje(v)}
                className="w-full flex items-start justify-between p-4 rounded-xl border border-gray-200 hover:border-[#0070C0] hover:bg-blue-50 transition-all text-left gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-[#1F3864] flex items-center justify-center shrink-0">
                    <Bus size={16} className="text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {v.ruta?.origen ?? '—'} → {v.ruta?.destino ?? '—'}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 mt-1">
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
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge estado={v.estado} />
                  <span className="text-xs text-green-600 font-medium">{v.asientosLibres} libres</span>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* ── PASO 2: Mapa de asientos ── */}
      {step === 2 && viaje && (
        <div className="space-y-4">
          <div className="bg-[#1F3864] rounded-xl p-4 text-white">
            <p className="text-xs text-blue-300 uppercase tracking-wide">Viaje seleccionado</p>
            <p className="text-base font-bold mt-0.5">
              {viaje.ruta?.origen ?? '—'} → {viaje.ruta?.destino ?? '—'}
            </p>
            <p className="text-sm text-blue-200 mt-0.5">
              {formatFecha(viaje.fechaHoraSal)}
              {viaje.vehiculo && ` · ${viaje.vehiculo.tipo} ${viaje.vehiculo.placa}`}
            </p>
          </div>

          <SeatMap
            viajeId={viaje.id}
            selectedNumero={asientoNum ?? undefined}
            onSelect={n => setAsientoNum(n)}
          />

          {asientoNum && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">Asiento seleccionado</p>
                <p className="text-2xl font-bold text-[#1F3864]">
                  {String(asientoNum).padStart(2, '0')}
                </p>
              </div>
              {precioBase && (
                <div className="text-right">
                  <p className="text-xs text-gray-400">Precio base</p>
                  <p className="text-lg font-bold text-green-600">S/ {parseFloat(precioBase).toFixed(2)}</p>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between gap-3">
            <Button variant="secondary" onClick={() => { setStep(1); setAsientoNum(null) }}>Volver</Button>
            <Button variant="primary" disabled={!asientoNum} onClick={continuarAStep3}>
              {asientoNum ? `Continuar — Asiento ${String(asientoNum).padStart(2,'0')}` : 'Selecciona un asiento'}
            </Button>
          </div>
        </div>
      )}

      {/* ── PASO 3: Datos del pasajero ── */}
      {step === 3 && viaje && (
        <div className="space-y-4">
          {/* Resumen */}
          <div className="flex items-center gap-3 p-3 bg-[#1F3864]/5 border border-[#1F3864]/20 rounded-xl text-sm">
            <div className="w-8 h-8 rounded-lg bg-[#1F3864] flex items-center justify-center shrink-0">
              <Bus size={14} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900">
                {viaje.ruta?.origen} → {viaje.ruta?.destino}
              </p>
              <p className="text-xs text-gray-500">
                {formatFecha(viaje.fechaHoraSal)} · Asiento {String(asientoNum).padStart(2, '0')}
                {precioBase ? ` · S/ ${parseFloat(precioBase).toFixed(2)}` : ''}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            {/* DNI Búsqueda */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Buscar pasajero por DNI
              </label>
              <BuscadorDni onFound={handleClienteFound} disabled={loading} />
            </div>

            {/* Datos pasajero */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nombres *</label>
                <input
                  value={pNombres}
                  onChange={e => setPNombres(e.target.value)}
                  placeholder="Nombres completos"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30 focus:border-[#1F3864]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Apellidos *</label>
                <input
                  value={pApellidos}
                  onChange={e => setPApellidos(e.target.value)}
                  placeholder="Apellidos"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30 focus:border-[#1F3864]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Teléfono *</label>
              <input
                value={pTelefono}
                onChange={e => setPTelefono(e.target.value.replace(/\D/g, '').slice(0, 9))}
                placeholder="9XXXXXXXX"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30 focus:border-[#1F3864]"
                maxLength={9}
              />
            </div>

            <hr className="border-gray-100" />

            {/* Precio y descuento */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Precio base S/ *</label>
                <input
                  value={precioBase}
                  onChange={e => setPrecioBase(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="0.00"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30 focus:border-[#1F3864]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Descuento S/ {maxDescuento < 9999 ? `(máx ${maxDescuento})` : ''}
                </label>
                <input
                  value={descuento}
                  onChange={e => {
                    const v = e.target.value.replace(/[^0-9.]/g, '')
                    const n = parseFloat(v) || 0
                    if (n > maxDescuento) {
                      toast.error(`Descuento máximo: S/ ${maxDescuento}`)
                      setDescuento(String(maxDescuento))
                    } else {
                      setDescuento(v)
                    }
                  }}
                  placeholder="0.00"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30 focus:border-[#1F3864]"
                />
              </div>
            </div>

            {descNum > 0 && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Motivo del descuento</label>
                <input
                  value={motivoDesc}
                  onChange={e => setMotivoDesc(e.target.value)}
                  placeholder="Ej: adulto mayor, estudiante..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30 focus:border-[#1F3864]"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Forma de pago *</label>
              <div className="flex flex-wrap gap-2">
                {['EFECTIVO','YAPE','PLIN','TRANSFERENCIA'].map(fp => (
                  <button key={fp} type="button"
                    onClick={() => setFormaPago(fp)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                      formaPago === fp
                        ? 'bg-[#1F3864] text-white border-[#1F3864]'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-[#1F3864]'
                    }`}>
                    {fp}
                  </button>
                ))}
              </div>
            </div>

            {/* Total */}
            {baseNum > 0 && (
              <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-gray-600">Total a pagar</span>
                <span className="text-xl font-bold text-green-600">S/ {totalNum.toFixed(2)}</span>
              </div>
            )}
          </div>

          <div className="flex justify-between gap-3">
            <Button variant="secondary" onClick={() => setStep(2)}>Volver</Button>
            <Button
              variant="primary"
              loading={loading}
              disabled={loading}
              onClick={handleVender}
            >
              Emitir pasaje · S/ {totalNum.toFixed(2)}
            </Button>
          </div>
        </div>
      )}

      {/* ── PASO 4: Éxito ── */}
      {step === 4 && resultado && viaje && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle size={32} className="text-green-500" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">¡Pasaje emitido!</h3>
          <div className="space-y-1 text-sm text-gray-500">
            <p className="font-semibold text-gray-800 text-base">
              {resultado.clienteApellidos}, {resultado.clienteNombres}
            </p>
            <p>
              Asiento <span className="font-semibold text-gray-800">
                {String(resultado.asientoNumero).padStart(2, '0')}
              </span>
              {' · '}
              {viaje.ruta?.origen} → {viaje.ruta?.destino}
            </p>
            <p>{formatFecha(viaje.fechaHoraSal)}</p>
            <p className="font-bold text-green-600 text-lg">S/ {resultado.precioFinal.toFixed(2)}</p>
          </div>

          <div className="inline-block bg-blue-50 border border-blue-200 rounded-lg px-5 py-2.5">
            <p className="text-xs text-blue-500 font-medium">N° Boleta</p>
            <p className="text-xl font-bold text-[#1F3864] font-mono">{resultado.codigoBoleta}</p>
          </div>

          <div className="flex gap-3 justify-center pt-2">
            <Button variant="secondary" onClick={resetWizard}>Nueva venta</Button>
            <Button variant="primary" icon={Printer} onClick={() => setTicketOpen(true)}>
              Ver e imprimir ticket
            </Button>
          </div>
        </div>
      )}

      {/* ── Modal ticket ── */}
      {ticketInfo && (
        <Modal
          open={ticketOpen}
          onClose={() => setTicketOpen(false)}
          title="Ticket de pasaje"
          size="sm"
        >
          <TicketPreview t={ticketInfo} onClose={() => setTicketOpen(false)} />
        </Modal>
      )}

      {/* ── Lista de pasajes ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <FileText size={15} className="text-gray-400" />
            Registro de boletas
          </h3>
          <div className="flex flex-wrap gap-2">
            <input
              value={listFiltroCodigo}
              onChange={e => setListFiltroCodigo(e.target.value.toUpperCase())}
              placeholder="Buscar N° boleta..."
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30 focus:border-[#1F3864]"
            />
            <select
              value={listFiltroEstado}
              onChange={e => setListFiltroEstado(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30 focus:border-[#1F3864]"
            >
              <option value="">Todos los estados</option>
              <option value="VENDIDO">VENDIDO</option>
              <option value="ANULADO">ANULADO</option>
            </select>
          </div>
        </div>

        {pasajes.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400">
            No se encontraron boletas con los filtros actuales
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['N° Boleta','Pasajero','Ruta / Asiento','Total','Estado','Fecha',''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pasajes.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-[#1F3864]">
                      {p.codigoBoleta}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 whitespace-nowrap">
                        {p.clienteApellidos}, {p.clienteNombres}
                      </p>
                      <p className="text-xs text-gray-400">DNI: {p.clienteDni}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      Asiento {String(p.asientoNumero).padStart(2, '0')}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">
                      S/ {Number(p.precioFinal).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${estadoPasajeBadge(p.estado)}`}>
                        {p.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                      {formatFecha(p.fechaVenta)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {p.estado === 'VENDIDO' && (
                        <button
                          onClick={() => setAnularModal({ open: true, id: p.id, codigo: p.codigoBoleta })}
                          className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1 ml-auto"
                        >
                          <X size={12} /> Anular
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal anulación ── */}
      <Modal
        open={anularModal.open}
        onClose={() => { setAnularModal({ open: false, id: 0, codigo: '' }); setAnularMotivo('') }}
        title="Anular pasaje"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">¿Anular boleta {anularModal.codigo}?</p>
              <p className="text-xs text-red-600 mt-0.5">Esta acción no se puede deshacer.</p>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Motivo de anulación *
            </label>
            <textarea
              value={anularMotivo}
              onChange={e => setAnularMotivo(e.target.value)}
              rows={3}
              placeholder="Describe el motivo de la anulación..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400/30 focus:border-red-400 resize-none"
            />
          </div>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => { setAnularModal({ open: false, id: 0, codigo: '' }); setAnularMotivo('') }}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={handleAnular}
              loading={anulando}
              disabled={!anularMotivo.trim() || anulando}
              className="flex-1"
            >
              Anular boleta
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
