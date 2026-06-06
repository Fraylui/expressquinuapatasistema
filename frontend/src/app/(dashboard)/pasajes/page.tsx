'use client'
import React, { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import toast from 'react-hot-toast'
import QRCode from 'qrcode'
import {
  Bus, CheckCircle, ChevronRight, Clock, Printer,
  Search, Users, X, AlertTriangle, FileText, Ticket, Tag,
} from 'lucide-react'
import { SeatMap } from '@/components/modules/pasajes/SeatMap'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import api from '@/services/api'
import { pasajesService, PasajeResponseDTO, VentaPasajeDTO } from '@/services/pasajes.service'
import { promocionesService, PromocionDTO } from '@/services/promociones.service'
import { useAuthStore } from '@/stores/authStore'
import { useEmpresaStore } from '@/stores/empresaStore'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Pasaje } from '@/types'

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
  const { nombre: empNombre, ruc: empRuc, direccion: empDir, ciudad: empCiudad, telefono: empTel } = useEmpresaStore()
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
      <div class="c b lg">${empNombre}</div>
      <div class="c sm">RUC: ${empRuc}</div>
      <div class="c sm">${empDir}</div>
      <div class="c sm">${empCiudad} | ${empTel}</div>
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
        <div className="text-center font-bold text-[12px]">{empNombre}</div>
        <div className="text-center text-[9px] text-gray-500">RUC: {empRuc} · {empTel}</div>
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
      onFound({ id: c.id, nombres: c.nombres, apellidos: c.apellidos, numDoc: d, telefono: c.telefono })
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
        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#064e3b]/30 focus:border-[#064e3b] disabled:bg-gray-100"
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
    <div className="flex items-start w-full">
      {STEPS.map(({ n, label }, i) => {
        const done   = step > n
        const active = step === n
        return (
          <React.Fragment key={n}>
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-200 ${
                done    ? 'bg-green-500 border-green-500 text-white shadow-sm'
                : active ? 'bg-[#064e3b] border-[#064e3b] text-white ring-4 ring-[#064e3b]/20 shadow-md'
                : 'bg-white border-gray-200 text-gray-400'
              }`}>
                {done ? <CheckCircle size={15} /> : <span>{n}</span>}
              </div>
              <span className={`text-[11px] font-semibold whitespace-nowrap transition-colors ${
                done    ? 'text-green-600'
                : active ? 'text-[#064e3b]'
                : 'text-gray-400'
              }`}>{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mt-[18px] mx-1.5 rounded-full transition-all duration-300 ${
                step > n ? 'bg-green-400' : 'bg-gray-200'
              }`} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ─── Resumen lateral ──────────────────────────────────────────────────────────
function ResumenPanel({ step, viaje, asientoNum, precioBase, descuento, totalNum, tipoOp, pNombres, pApellidos, formaPago }: {
  step: Step
  viaje: ViajeDisponible | null
  asientoNum: number | null
  precioBase: string
  descuento: string
  totalNum: number
  tipoOp: 'VENTA' | 'RESERVA'
  pNombres: string
  pApellidos: string
  formaPago: string
}) {
  const baseNum = parseFloat(precioBase) || 0
  const descNum = parseFloat(descuento) || 0

  const subtitulo = step === 1 ? 'Elige un viaje para comenzar'
    : step === 2 ? 'Selecciona tu asiento'
    : step === 3 ? 'Confirma los datos del pasajero'
    : 'Operación completada'

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden sticky top-4">
      {/* Encabezado */}
      <div className="bg-[#064e3b] px-5 py-4">
        <p className="text-xs font-bold text-emerald-300 uppercase tracking-widest mb-0.5">Operación</p>
        <h3 className="text-base font-bold text-white leading-tight">Resumen</h3>
        <p className="text-xs text-emerald-200/70 mt-1">{subtitulo}</p>
      </div>

      <div className="divide-y divide-gray-100">

        {/* Viaje */}
        {viaje ? (
          <div className="px-5 py-4 space-y-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Viaje</p>
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-sm font-bold text-gray-900">{viaje.ruta?.origen}</span>
              <ChevronRight size={13} className="text-gray-300" />
              <span className="text-sm font-bold text-gray-900">{viaje.ruta?.destino}</span>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-500 flex items-center gap-1.5">
                <Clock size={10} className="text-gray-400" />
                {formatFecha(viaje.fechaHoraSal)}
              </p>
              {viaje.vehiculo && (
                <p className="text-xs text-gray-400 flex items-center gap-1.5">
                  <Bus size={10} className="text-gray-300" />
                  {viaje.vehiculo.tipo} · <span className="font-mono">{viaje.vehiculo.placa}</span>
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="px-5 py-8 text-center">
            <Bus size={24} className="mx-auto mb-2 text-gray-200" />
            <p className="text-xs text-gray-400">Sin viaje seleccionado</p>
          </div>
        )}

        {/* Asiento */}
        {asientoNum ? (
          <div className="px-5 py-4 flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-[#064e3b] flex items-center justify-center shrink-0">
              <span className="text-2xl font-black text-white font-mono leading-none">
                {String(asientoNum).padStart(2, '0')}
              </span>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Asiento seleccionado</p>
              <p className="text-sm font-semibold text-gray-700 mt-0.5">N° {String(asientoNum).padStart(2, '0')}</p>
            </div>
          </div>
        ) : step >= 2 ? (
          <div className="px-5 py-4 text-center text-xs text-gray-400">
            <Users size={20} className="mx-auto mb-1 text-gray-200" />
            Selecciona un asiento en el mapa
          </div>
        ) : null}

        {/* Pasajero */}
        {(pNombres || pApellidos) && step >= 3 && (
          <div className="px-5 py-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Pasajero</p>
            <p className="text-sm font-semibold text-gray-800 leading-tight">
              {pApellidos && pNombres ? `${pApellidos}, ${pNombres}` : pNombres || pApellidos}
            </p>
          </div>
        )}

        {/* Precio */}
        {baseNum > 0 && (
          <div className="px-5 py-4 space-y-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Cobro</p>
            <div className="flex justify-between text-xs text-gray-500">
              <span>Precio base</span>
              <span className="font-medium">S/ {baseNum.toFixed(2)}</span>
            </div>
            {descNum > 0 && (
              <div className="flex justify-between text-xs text-green-600">
                <span>Descuento</span>
                <span className="font-medium">− S/ {descNum.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-gray-100">
              <span className="text-sm font-bold text-gray-700">Total</span>
              <span className="text-2xl font-black text-green-600">S/ {totalNum.toFixed(2)}</span>
            </div>
            <p className="text-[11px] text-center text-gray-400 pt-1">
              {tipoOp === 'RESERVA' ? 'Pago diferido — confirmar en caja' : `Pago: ${formaPago}`}
            </p>
          </div>
        )}

        {/* Guía inicial */}
        {!viaje && step === 1 && (
          <div className="px-5 py-5">
            <div className="space-y-3">
              {[
                { n: 1, text: 'Selecciona el viaje' },
                { n: 2, text: 'Elige tu asiento' },
                { n: 3, text: 'Ingresa los datos' },
                { n: 4, text: 'Imprime el ticket' },
              ].map(({ n, text }) => (
                <div key={n} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-[10px] font-bold shrink-0">{n}</div>
                  <span className="text-xs text-gray-400">{text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatFecha(iso?: string) {
  if (!iso) return '—'
  try { return format(new Date(iso), "dd MMM · HH:mm", { locale: es }) } catch { return iso }
}

function estadoPasajeBadge(estado: string) {
  if (estado === 'VENDIDO')   return 'bg-green-100 text-green-700 border-green-300'
  if (estado === 'RESERVADO') return 'bg-amber-100 text-amber-700 border-amber-300'
  if (estado === 'ANULADO')   return 'bg-red-100 text-red-700 border-red-300'
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

  // Promociones
  const [promoSel, setPromoSel]       = useState<PromocionDTO | null>(null)
  const [codigoPromo, setCodigoPromo] = useState('')
  const [buscandoCodigo, setBuscandoCodigo] = useState(false)
  const { data: promosVigentes = [] } = useSWR<PromocionDTO[]>(
    'promos-pasajes',
    () => promocionesService.getVigentes('PASAJES'),
    { revalidateOnFocus: false }
  )

  // Pasajero form (filled after DNI search)
  const [pNombres, setPNombres]       = useState('')
  const [pApellidos, setPApellidos]   = useState('')
  const [pTelefono, setPTelefono]     = useState('')

  // Tipo de operación
  const [tipoOp, setTipoOp] = useState<'VENTA' | 'RESERVA'>('VENTA')

  // List + anular + confirmar
  const [listFiltroEstado, setListFiltroEstado]   = useState('')
  const [listFiltroCodigo, setListFiltroCodigo]   = useState('')
  const [anularModal, setAnularModal] = useState<{ open: boolean; id: number; codigo: string }>({
    open: false, id: 0, codigo: ''
  })
  const [anularMotivo, setAnularMotivo] = useState('')
  const [anulando, setAnulando]         = useState(false)
  const [confirmarModal, setConfirmarModal] = useState<{ open: boolean; id: number; codigo: string }>({
    open: false, id: 0, codigo: ''
  })
  const [confirmarFormaPago, setConfirmarFormaPago] = useState('EFECTIVO')
  const [confirmando, setConfirmando] = useState(false)

  // Data
  const { data: viajesData, mutate: mutateViajes } =
    useSWR<any>('/api/viajes/disponibles', fetcher, { refreshInterval: 60000 })
  const viajes: ViajeDisponible[] = viajesData ?? []

  const listParams = new URLSearchParams()
  if (listFiltroEstado) listParams.set('estado', listFiltroEstado)
  if (listFiltroCodigo) listParams.set('codigoBoleta', listFiltroCodigo)
  const { data: listData, mutate: mutateList } =
    useSWR<any>(`/api/pasajes?${listParams.toString()}`, fetcher, { refreshInterval: 30000 })
  const pasajes: Pasaje[] = listData ?? []

  // Tarifa automática al elegir viaje
  const cargarTarifa = async (v: ViajeDisponible) => {
    if (!v.ruta?.id || !v.vehiculo?.tipo) return
    try {
      const res = await api.get(`/api/tarifas/buscar?rutaId=${v.ruta.id}&tipoVehiculo=${v.vehiculo.tipo}`)
      const d = (res as any)?.data
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
    if (!dniVal) { toast.error('Busca al pasajero por DNI antes de emitir el pasaje'); return }
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
      formaPago: tipoOp === 'RESERVA' ? 'EFECTIVO' : formaPago,
      motivoDescuento: desc > 0 ? motivoDesc.trim() || undefined : undefined,
      promocionId: promoSel?.id ?? undefined,
      tipo: tipoOp,
    }

    setLoading(true)
    try {
      const res = await pasajesService.vender(dto)
      setResultado(res.data)
      toast.success(tipoOp === 'RESERVA' ? `Reserva registrada — ${res.data.codigoBoleta}` : `Pasaje emitido — ${res.data.codigoBoleta}`)
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

  const handleConfirmar = async () => {
    setConfirmando(true)
    try {
      await pasajesService.confirmar(confirmarModal.id, confirmarFormaPago)
      toast.success(`Reserva ${confirmarModal.codigo} confirmada y pagada`)
      setConfirmarModal({ open: false, id: 0, codigo: '' })
      setConfirmarFormaPago('EFECTIVO')
      mutateList()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al confirmar la reserva')
    } finally {
      setConfirmando(false)
    }
  }

  // Aplica o quita una promoción; recalcula descuento si hay precio base
  const aplicarPromo = (p: PromocionDTO | null) => {
    setPromoSel(p)
    if (!p) { setDescuento('0'); setMotivoDesc(''); return }
    const base = parseFloat(precioBase) || 0
    if (base > 0) {
      const desc = p.tipoDescuento === 'MONTO_FIJO'
        ? Math.min(p.valor, base)
        : parseFloat((base * p.valor / 100).toFixed(2))
      setDescuento(String(desc))
    }
    setMotivoDesc(p.nombre)
  }

  const buscarCodigo = async () => {
    if (!codigoPromo.trim()) return
    setBuscandoCodigo(true)
    try {
      const p = await promocionesService.validarCodigo(codigoPromo.trim(), 'PASAJES')
      aplicarPromo(p)
      toast.success(`Promoción "${p.nombre}" aplicada`)
      setCodigoPromo('')
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Código inválido')
    } finally { setBuscandoCodigo(false) }
  }

  const resetWizard = () => {
    setStep(1); setViaje(null); setAsientoNum(null)
    setClienteFound(null); setResultado(null); setTicketOpen(false)
    setPNombres(''); setPApellidos(''); setPTelefono('')
    setPrecioBase(''); setDescuento('0'); setFormaPago('EFECTIVO'); setMotivoDesc('')
    setTipoOp('VENTA')
    setPromoSel(null); setCodigoPromo('')
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
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#064e3b] flex items-center justify-center shrink-0">
            <Ticket size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Venta de Pasajes</h1>
            <p className="text-xs text-gray-500">Selecciona viaje, asiento y pasajero en 3 pasos</p>
          </div>
        </div>
        {step > 1 && step < 4 && (
          <button onClick={resetWizard}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-xl px-3 py-2 hover:bg-gray-50 transition-colors">
            <X size={12} /> Cancelar venta
          </button>
        )}
      </div>

      {/* ── Cuerpo: dos columnas ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[480px_1fr] gap-5 items-start">

        {/* ═══ Columna izquierda: Wizard ═══ */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">

          {/* Stepper en el encabezado del panel */}
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60">
            <Stepper step={step} />
          </div>

          <div className="p-5 space-y-4">

            {/* ── PASO 1: Viajes disponibles ── */}
            {step === 1 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Viajes disponibles
                  </p>
                  {viajes.length > 0 && (
                    <span className="text-[11px] text-gray-400">
                      {viajes.length} viaje{viajes.length !== 1 ? 's' : ''} activo{viajes.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                {viajes.length === 0 ? (
                  <div className="text-center py-14 text-gray-400">
                    <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                      <Bus size={24} className="text-gray-300" />
                    </div>
                    <p className="text-sm font-medium text-gray-500">Sin viajes disponibles</p>
                    <p className="text-xs mt-1 text-gray-400">Programa un viaje primero desde el módulo de Viajes</p>
                  </div>
                ) : (
                  viajes.map(v => {
                    const totalAsientos = (v.vehiculo?.numAsientos ?? 1) - 1
                    const ocupados = totalAsientos - (v.asientosLibres ?? 0)
                    const pct = totalAsientos > 0 ? Math.round((ocupados / totalAsientos) * 100) : 0
                    const pctBar = pct >= 90 ? 'bg-red-400' : pct >= 60 ? 'bg-amber-400' : 'bg-emerald-400'
                    return (
                      <button key={v.id} onClick={() => seleccionarViaje(v)}
                        className="w-full p-3.5 rounded-2xl border border-gray-200 hover:border-[#064e3b] hover:shadow-sm transition-all text-left group">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-[#064e3b]/8 group-hover:bg-[#064e3b] flex items-center justify-center shrink-0 transition-colors">
                              <Bus size={16} className="text-[#064e3b] group-hover:text-white transition-colors" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-gray-900 truncate">
                                {v.ruta?.origen ?? '—'}
                                <span className="text-gray-300 mx-1.5 font-normal">→</span>
                                {v.ruta?.destino ?? '—'}
                              </p>
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                <span className="flex items-center gap-1 text-xs text-gray-500">
                                  <Clock size={10} /> {formatFecha(v.fechaHoraSal)}
                                </span>
                                {v.vehiculo && (
                                  <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-medium">
                                    {v.vehiculo.placa}
                                  </span>
                                )}
                                {v.ruta?.distanciaKm && (
                                  <span className="text-xs text-gray-400">{v.ruta.distanciaKm} km</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <Badge estado={v.estado} />
                            <span className={`text-xs font-bold ${(v.asientosLibres ?? 0) <= 3 ? 'text-red-500' : 'text-emerald-600'}`}>
                              {v.asientosLibres} libre{(v.asientosLibres ?? 0) !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                        {/* Barra de ocupación */}
                        <div className="mt-3 space-y-1">
                          <div className="flex justify-between text-[10px] text-gray-400">
                            <span>{ocupados}/{totalAsientos} asientos ocupados</span>
                            <span className={pct >= 90 ? 'text-red-500 font-semibold' : pct >= 60 ? 'text-amber-500' : 'text-emerald-600'}>{pct}%</span>
                          </div>
                          <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${pctBar}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            )}

            {/* ── PASO 2: Mapa de asientos ── */}
            {step === 2 && viaje && (
              <div className="space-y-4">
                <div className="bg-[#064e3b] rounded-xl p-3.5 text-white">
                  <p className="text-[10px] text-blue-300 uppercase tracking-widest font-semibold">Viaje seleccionado</p>
                  <p className="text-base font-bold mt-0.5">
                    {viaje.ruta?.origen ?? '—'} → {viaje.ruta?.destino ?? '—'}
                  </p>
                  <p className="text-xs text-blue-200 mt-0.5">
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
                  <div className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">Asiento</p>
                      <p className="text-2xl font-bold text-[#064e3b]">
                        {String(asientoNum).padStart(2, '0')}
                      </p>
                    </div>
                    {precioBase && (
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">Precio base</p>
                        <p className="text-lg font-bold text-green-600">S/ {parseFloat(precioBase).toFixed(2)}</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-between gap-3 pt-1">
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
                {/* Chip resumen */}
                <div className="flex items-center gap-2.5 px-3 py-2.5 bg-[#064e3b]/5 border border-[#064e3b]/15 rounded-xl text-sm">
                  <div className="w-7 h-7 rounded-lg bg-[#064e3b] flex items-center justify-center shrink-0">
                    <Bus size={13} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-xs truncate">
                      {viaje.ruta?.origen} → {viaje.ruta?.destino}
                      <span className="font-normal text-gray-500 ml-2">
                        · Asiento {String(asientoNum).padStart(2, '0')}
                        {precioBase ? ` · S/ ${parseFloat(precioBase).toFixed(2)}` : ''}
                      </span>
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{formatFecha(viaje.fechaHoraSal)}</p>
                  </div>
                </div>

                {/* DNI */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Buscar pasajero por DNI <span className="text-red-500">*</span>
                  </label>
                  <BuscadorDni onFound={handleClienteFound} disabled={loading} />
                  {clienteFound?.numDoc ? (
                    <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1">
                      <CheckCircle size={11} /> DNI {clienteFound.numDoc} — {clienteFound.nombres} {clienteFound.apellidos}
                    </p>
                  ) : (
                    <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                      <AlertTriangle size={11} /> Obligatorio para emitir el pasaje
                    </p>
                  )}
                </div>

                {/* Nombres y apellidos */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Nombres *</label>
                    <input value={pNombres} onChange={e => setPNombres(e.target.value)}
                      placeholder="Nombres completos"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#064e3b]/30 focus:border-[#064e3b] transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Apellidos *</label>
                    <input value={pApellidos} onChange={e => setPApellidos(e.target.value)}
                      placeholder="Apellidos"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#064e3b]/30 focus:border-[#064e3b] transition-colors" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Teléfono *</label>
                  <input value={pTelefono}
                    onChange={e => setPTelefono(e.target.value.replace(/\D/g, '').slice(0, 9))}
                    placeholder="9XXXXXXXX" maxLength={9}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#064e3b]/30 focus:border-[#064e3b] transition-colors" />
                </div>

                <hr className="border-gray-100" />

                {/* Precio base */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Precio base S/ *</label>
                  <input value={precioBase}
                    onChange={e => {
                      const v = e.target.value.replace(/[^0-9.]/g, '')
                      setPrecioBase(v)
                      // Recalcula descuento si hay promo activa
                      if (promoSel) {
                        const base = parseFloat(v) || 0
                        const desc = promoSel.tipoDescuento === 'MONTO_FIJO'
                          ? Math.min(promoSel.valor, base)
                          : parseFloat((base * promoSel.valor / 100).toFixed(2))
                        setDescuento(String(desc))
                      }
                    }}
                    placeholder="0.00"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#064e3b]/30 focus:border-[#064e3b] transition-colors" />
                </div>

                {/* ── Selector de descuentos / promociones ── */}
                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 space-y-2.5">
                  <div className="flex items-center gap-1.5">
                    <Tag size={13} className="text-[#064e3b]" />
                    <span className="text-xs font-bold text-[#064e3b] uppercase tracking-wider">Descuento / Promoción</span>
                  </div>

                  {/* Chips de promociones vigentes */}
                  {promosVigentes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {promosVigentes.map(p => {
                        const sel = promoSel?.id === p.id
                        const label = p.tipoDescuento === 'MONTO_FIJO'
                          ? `S/ ${p.valor} off`
                          : `${p.valor}% off`
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => aplicarPromo(sel ? null : p)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                              sel
                                ? 'bg-[#064e3b] text-white border-[#064e3b]'
                                : 'bg-white text-gray-700 border-[#E2E8F0] hover:border-[#064e3b]/50'
                            }`}
                          >
                            <Tag size={10} />
                            {p.nombre}
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                              sel ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700'
                            }`}>{label}</span>
                            {sel && <X size={10} />}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {/* Código de campaña */}
                  <div className="flex gap-2">
                    <input
                      value={codigoPromo}
                      onChange={e => setCodigoPromo(e.target.value.toUpperCase())}
                      onKeyDown={e => e.key === 'Enter' && buscarCodigo()}
                      placeholder="Código de campaña (ej: JULIO25)"
                      className="flex-1 border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-[#064e3b]/20 focus:border-[#064e3b]"
                    />
                    <button
                      type="button"
                      onClick={buscarCodigo}
                      disabled={buscandoCodigo || !codigoPromo.trim()}
                      className="px-3 py-1.5 bg-[#064e3b] text-white rounded-lg text-xs font-medium disabled:opacity-40 hover:bg-[#065f46] transition-colors"
                    >
                      {buscandoCodigo ? '...' : 'Aplicar'}
                    </button>
                  </div>

                  {/* Promo seleccionada */}
                  {promoSel && (
                    <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle size={13} className="text-green-500" />
                        <span className="text-xs font-semibold text-green-700">{promoSel.nombre}</span>
                        <span className="text-xs text-green-600">
                          — {promoSel.tipoDescuento === 'MONTO_FIJO' ? `S/ ${promoSel.valor}` : `${promoSel.valor}%`} de descuento
                        </span>
                      </div>
                      <button type="button" onClick={() => aplicarPromo(null)} className="text-green-400 hover:text-green-700">
                        <X size={13} />
                      </button>
                    </div>
                  )}

                  {/* Descuento manual si no hay promo */}
                  {!promoSel && (
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                        Descuento manual S/ {maxDescuento < 9999 ? `(máx ${maxDescuento})` : ''}
                      </label>
                      <input value={descuento}
                        onChange={e => {
                          const v = e.target.value.replace(/[^0-9.]/g, '')
                          const n = parseFloat(v) || 0
                          if (n > maxDescuento) { toast.error(`Descuento máximo: S/ ${maxDescuento}`); setDescuento(String(maxDescuento)) }
                          else setDescuento(v)
                        }}
                        placeholder="0.00"
                        className="w-full border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#064e3b]/20 focus:border-[#064e3b]" />
                    </div>
                  )}

                  {descNum > 0 && !promoSel && (
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 mb-1">Motivo del descuento</label>
                      <input value={motivoDesc} onChange={e => setMotivoDesc(e.target.value)}
                        placeholder="Ej: adulto mayor, estudiante..."
                        className="w-full border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#064e3b]/20 focus:border-[#064e3b]" />
                    </div>
                  )}
                </div>

                {/* Tipo operación */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Tipo de operación</label>
                  <div className="flex gap-2">
                    {(['VENTA', 'RESERVA'] as const).map(t => (
                      <button key={t} type="button" onClick={() => setTipoOp(t)}
                        className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${
                          tipoOp === t
                            ? t === 'VENTA' ? 'bg-[#064e3b] text-white border-[#064e3b]' : 'bg-amber-500 text-white border-amber-500'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                        }`}>
                        {t === 'VENTA' ? 'Venta (pago ahora)' : 'Reserva (pago luego)'}
                      </button>
                    ))}
                  </div>
                  {tipoOp === 'RESERVA' && (
                    <p className="mt-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                      La reserva bloquea el asiento. El pasajero paga al confirmar en caja.
                    </p>
                  )}
                </div>

                {tipoOp === 'VENTA' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Forma de pago *</label>
                    <div className="flex flex-wrap gap-2">
                      {['EFECTIVO','YAPE','PLIN','TRANSFERENCIA'].map(fp => (
                        <button key={fp} type="button" onClick={() => setFormaPago(fp)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                            formaPago === fp
                              ? 'bg-[#064e3b] text-white border-[#064e3b]'
                              : 'bg-white text-gray-600 border-gray-300 hover:border-[#064e3b]'
                          }`}>
                          {fp}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Total */}
                {baseNum > 0 && (
                  <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
                    <span className="text-sm font-medium text-gray-600">Total a pagar</span>
                    <span className="text-xl font-bold text-green-600">S/ {totalNum.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between gap-3 pt-1">
                  <Button variant="secondary" onClick={() => setStep(2)}>Volver</Button>
                  <Button variant="primary" loading={loading} disabled={loading} onClick={handleVender}>
                    {tipoOp === 'RESERVA' ? 'Reservar asiento' : `Emitir pasaje · S/ ${totalNum.toFixed(2)}`}
                  </Button>
                </div>
              </div>
            )}

            {/* ── PASO 4: Éxito ── */}
            {step === 4 && resultado && viaje && (
              <div className="text-center space-y-5 py-2">
                <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto">
                  <CheckCircle size={32} className="text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {resultado.estado === 'RESERVADO' ? '¡Reserva registrada!' : '¡Pasaje emitido!'}
                  </h3>
                  <p className="text-sm font-semibold text-gray-700 mt-1">
                    {resultado.clienteApellidos}, {resultado.clienteNombres}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {viaje.ruta?.origen} → {viaje.ruta?.destino}
                    {' · '}{formatFecha(viaje.fechaHoraSal)}
                  </p>
                </div>

                {/* Boleta highlight */}
                <div className="bg-gradient-to-br from-[#064e3b] to-[#065f46] rounded-2xl px-6 py-5 text-white mx-4">
                  <div className="flex items-center justify-between">
                    <div className="text-left">
                      <p className="text-[10px] text-emerald-300 font-semibold uppercase tracking-widest">N° Boleta</p>
                      <p className="text-xl font-black font-mono mt-0.5">{resultado.codigoBoleta}</p>
                    </div>
                    <div className="text-center bg-white/10 rounded-xl px-4 py-2">
                      <p className="text-[10px] text-emerald-300 font-semibold">Asiento</p>
                      <p className="text-3xl font-black font-mono leading-none mt-0.5">
                        {String(resultado.asientoNumero).padStart(2, '0')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-emerald-300 font-semibold uppercase tracking-widest">Total</p>
                      <p className="text-xl font-black mt-0.5">S/ {resultado.precioFinal.toFixed(2)}</p>
                    </div>
                  </div>
                  {resultado.estado === 'RESERVADO' && (
                    <p className="mt-3 text-xs text-amber-300 bg-white/10 rounded-lg px-3 py-1.5 text-center">
                      Asiento reservado · Pago pendiente en caja
                    </p>
                  )}
                </div>

                <div className="flex gap-3 justify-center">
                  <button onClick={resetWizard}
                    className="flex items-center gap-2 px-5 py-2.5 border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50 transition-colors font-medium">
                    Nueva venta
                  </button>
                  {resultado.estado !== 'RESERVADO' && (
                    <button onClick={() => setTicketOpen(true)}
                      className="flex items-center gap-2 px-5 py-2.5 bg-[#064e3b] text-white text-sm rounded-xl hover:bg-[#065f46] transition-colors font-semibold">
                      <Printer size={14} /> Imprimir ticket
                    </button>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* ═══ Columna derecha: Resumen de Reserva ═══ */}
        <ResumenPanel
          step={step}
          viaje={viaje}
          asientoNum={asientoNum}
          precioBase={precioBase}
          descuento={descuento}
          totalNum={totalNum}
          tipoOp={tipoOp}
          pNombres={pNombres}
          pApellidos={pApellidos}
          formaPago={formaPago}
        />

      </div>{/* fin grid wizard+resumen */}

      {/* ═══ Lista de boletas ═══ */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Header con stats */}
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <FileText size={14} className="text-gray-400" /> Boletas del día
              </h3>
              {pasajes.length > 0 && (
                <div className="flex gap-2">
                  {[
                    { label: 'Vendidas', count: pasajes.filter(p => p.estado === 'VENDIDO').length, cls: 'bg-green-100 text-green-700' },
                    { label: 'Reservas', count: pasajes.filter(p => p.estado === 'RESERVADO').length, cls: 'bg-amber-100 text-amber-700' },
                    { label: 'Anuladas', count: pasajes.filter(p => p.estado === 'ANULADO').length, cls: 'bg-red-100 text-red-600' },
                  ].filter(s => s.count > 0).map(s => (
                    <span key={s.label} className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${s.cls}`}>
                      {s.count} {s.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  value={listFiltroCodigo}
                  onChange={e => setListFiltroCodigo(e.target.value.toUpperCase())}
                  placeholder="N° boleta…"
                  className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-xl text-xs w-36 focus:outline-none focus:ring-2 focus:ring-[#064e3b]/30 focus:border-[#064e3b] transition-colors"
                />
              </div>
              <div className="flex items-center gap-1 p-0.5 bg-gray-100 rounded-xl">
                {[{ v: '', l: 'Todos' }, { v: 'VENDIDO', l: 'Vendidos' }, { v: 'RESERVADO', l: 'Reservas' }, { v: 'ANULADO', l: 'Anulados' }].map(({ v, l }) => (
                  <button key={v} onClick={() => setListFiltroEstado(v)}
                    className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                      listFiltroEstado === v
                        ? 'bg-white text-gray-800 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}>{l}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {pasajes.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <FileText size={20} className="text-gray-300" />
            </div>
            <p className="text-sm text-gray-500 font-medium">Sin boletas registradas</p>
            <p className="text-xs text-gray-400 mt-1">Las boletas emitidas aparecerán aquí</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['N° Boleta', 'Pasajero', 'Asiento', 'Total', 'Estado', 'Fecha', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pasajes.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50/60 transition-colors group">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-bold text-[#064e3b]">{p.codigoBoleta}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 text-xs whitespace-nowrap">
                        {p.clienteApellidos}, {p.clienteNombres}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5 font-mono">DNI {p.clienteDni}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="w-8 h-8 rounded-lg bg-[#064e3b]/8 text-[#064e3b] text-xs font-black font-mono flex items-center justify-center">
                        {String(p.asientoNumero).padStart(2, '0')}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-gray-900 text-xs whitespace-nowrap tabular-nums">
                      S/ {Number(p.precioFinal).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${estadoPasajeBadge(p.estado)}`}>
                        {p.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-gray-400 whitespace-nowrap">
                      {formatFecha(p.fechaVenta)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        {p.estado === 'RESERVADO' && (
                          <button
                            onClick={() => { setConfirmarModal({ open: true, id: p.id, codigo: p.codigoBoleta }); setConfirmarFormaPago('EFECTIVO') }}
                            className="flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-700 text-[11px] font-semibold rounded-lg hover:bg-amber-200 transition-colors whitespace-nowrap">
                            <CheckCircle size={11} /> Confirmar
                          </button>
                        )}
                        {(p.estado === 'VENDIDO' || p.estado === 'RESERVADO') && (
                          <button
                            onClick={() => setAnularModal({ open: true, id: p.id, codigo: p.codigoBoleta })}
                            className="flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-600 text-[11px] font-semibold rounded-lg hover:bg-red-200 transition-colors">
                            <X size={11} /> Anular
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal ticket ── */}
      {ticketInfo && (
        <Modal open={ticketOpen} onClose={() => setTicketOpen(false)} title="Ticket de pasaje" size="sm">
          <TicketPreview t={ticketInfo} onClose={() => setTicketOpen(false)} />
        </Modal>
      )}

      {/* ── Modal confirmar reserva ── */}
      <Modal
        open={confirmarModal.open}
        onClose={() => { setConfirmarModal({ open: false, id: 0, codigo: '' }); setConfirmarFormaPago('EFECTIVO') }}
        title="Confirmar pago de reserva"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Confirma el pago de la reserva <span className="font-semibold text-gray-900">{confirmarModal.codigo}</span>.
            Esto registrará el ingreso en caja y emitirá el pasaje.
          </p>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Forma de pago</label>
            <div className="flex flex-wrap gap-2">
              {['EFECTIVO','YAPE','PLIN','TRANSFERENCIA'].map(fp => (
                <button key={fp} type="button" onClick={() => setConfirmarFormaPago(fp)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                    confirmarFormaPago === fp
                      ? 'bg-[#064e3b] text-white border-[#064e3b]'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-[#064e3b]'
                  }`}>
                  {fp}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setConfirmarModal({ open: false, id: 0, codigo: '' })} className="flex-1">Cancelar</Button>
            <Button variant="primary" onClick={handleConfirmar} loading={confirmando} disabled={confirmando} className="flex-1">
              Confirmar y registrar pago
            </Button>
          </div>
        </div>
      </Modal>

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
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Motivo de anulación *</label>
            <textarea value={anularMotivo} onChange={e => setAnularMotivo(e.target.value)} rows={3}
              placeholder="Describe el motivo de la anulación..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400/30 focus:border-red-400 resize-none" />
          </div>
          <div className="flex gap-3">
            <Button variant="secondary"
              onClick={() => { setAnularModal({ open: false, id: 0, codigo: '' }); setAnularMotivo('') }}
              className="flex-1">Cancelar</Button>
            <Button variant="danger" onClick={handleAnular} loading={anulando}
              disabled={!anularMotivo.trim() || anulando} className="flex-1">
              Anular boleta
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  )
}
