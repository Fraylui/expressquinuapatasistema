'use client'
import React, { useState, useMemo, useEffect, useCallback } from 'react'
import useSWR from 'swr'
import toast from 'react-hot-toast'
import {
  Bus, Clock, MapPin, Users, CheckCircle, FileText, Plus,
  X, Package, UserCheck, AlertTriangle, ChevronDown, ChevronUp,
  Pencil, Search, Ticket, Calendar, Navigation, Gauge,
  ArrowRight, Route, Layers, ChevronRight, History, TrendingUp,
  DollarSign, Filter, Download, RefreshCw, CheckCircle2,
  XCircle, Timer, Loader2,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/stores/authStore'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import api from '@/services/api'
import Link from 'next/link'
import { useWebSocket } from '@/hooks/useWebSocket'

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface ViajeDTO {
  id: number; estado: string
  fechaHoraSal: string; fechaHoraArr?: string; observaciones?: string
  conductorId?: number; conductorNombre?: string
  asientosLibres?: number; asientosOcupados?: number; cantEncomiendas?: number
  ingresosViaje?: number
  ruta?:    { origen: string; destino: string; distanciaKm?: number }
  vehiculo?: { id?: number; placa: string; tipo: string; numAsientos: number }
}
interface ViajeHistorial {
  id: number; estado: string
  fechaHoraSal: string; fechaHoraArr?: string; observaciones?: string
  conductorNombre?: string
  rutaOrigen?: string; rutaDestino?: string; distanciaKm?: number
  vehiculoPlaca?: string; vehiculoTipo?: string; vehiculoAsientos?: number
  totalPasajeros: number; totalEncomiendas: number
  ingresosPasajes: number; ingresosEncomiendas: number; totalIngresos: number
  duracionMinutos?: number
}
interface RutaOpt { id: number; origen: string; destino: string; distanciaKm?: number }
interface VehOpt  { id: number; placa: string; tipo: string; numAsientos?: number; conductorHabitualId?: number | null }
interface CondOpt { id: number; nombres: string; apellidos: string; licencia: string }

const emptyForm     = { rutaId: '', vehiculoId: '', conductorId: '', fechaHoraSal: '', observaciones: '' }
const emptyEditForm = { conductorId: '', vehiculoId: '', fechaHoraSal: '', observaciones: '' }

type PageTab = 'operaciones' | 'historial'

interface AlertaCancelacion {
  viajeId:              number
  ruta:                 string
  horaProgramada:       string
  totalPasajeros:       number
  totalEncomiendas:     number
  pasajerosAfectados:   { pasajeId: number; boleta: string; asiento: number; monto: number; clienteNombre: string }[]
  encomiendasRetenidas: { encomiendaId: number; codigo: string; descripcion: string }[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDuracion(mins?: number): string {
  if (!mins) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
function fmtMoney(n: number): string {
  return `S/ ${Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
}

// ── Componente de Historial ────────────────────────────────────────────────────
function HistorialTab() {
  const [viajes, setViajes]         = useState<ViajeHistorial[]>([])
  const [cargando, setCargando]     = useState(false)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroDesde, setFiltroDesde]   = useState('')
  const [filtroHasta, setFiltroHasta]   = useState('')
  const [filtroBusq,  setFiltroBusq]    = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const params: Record<string, string> = {}
      if (filtroEstado) params.estado = filtroEstado
      if (filtroDesde)  params.desde  = filtroDesde
      if (filtroHasta)  params.hasta  = filtroHasta
      const r: any = await api.get('/api/viajes/historial', { params })
      setViajes((r.data ?? []) as ViajeHistorial[])
    } catch { toast.error('Error cargando historial') }
    finally { setCargando(false) }
  }, [filtroEstado, filtroDesde, filtroHasta])

  useEffect(() => { cargar() }, [cargar])

  const filtrados = useMemo(() => {
    if (!filtroBusq.trim()) return viajes
    const q = filtroBusq.toLowerCase()
    return viajes.filter(v =>
      v.rutaOrigen?.toLowerCase().includes(q) ||
      v.rutaDestino?.toLowerCase().includes(q) ||
      v.conductorNombre?.toLowerCase().includes(q) ||
      v.vehiculoPlaca?.toLowerCase().includes(q)
    )
  }, [viajes, filtroBusq])

  // Métricas agregadas
  const completados = filtrados.filter(v => v.estado === 'COMPLETADO')
  const totalPax    = completados.reduce((s, v) => s + v.totalPasajeros,    0)
  const totalEnc    = completados.reduce((s, v) => s + v.totalEncomiendas,  0)
  const totalIng    = completados.reduce((s, v) => s + v.totalIngresos,     0)

  const descargarLiquidacion = async (id: number) => {
    try {
      const blob = await api.get(`/api/viajes/${id}/liquidacion-pdf`, { responseType: 'blob' }) as unknown as Blob
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')?.focus()
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch { toast.error('Error generando liquidación') }
  }

  const imprimirManifiesto = async (id: number) => {
    try {
      const blob = await api.get(`/api/manifiestos/${id}/pdf`, { responseType: 'blob' }) as unknown as Blob
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')?.focus()
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch { toast.error('Error al generar el manifiesto') }
  }

  return (
    <div className="space-y-5">

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Viajes completados', value: completados.length, icon: CheckCircle2, color: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-l-emerald-400' },
          { label: 'Pasajeros transportados', value: totalPax, icon: Users, color: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400', border: 'border-l-blue-400' },
          { label: 'Encomiendas', value: totalEnc, icon: Package, color: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400', border: 'border-l-amber-400' },
          { label: 'Ingresos totales', value: fmtMoney(totalIng), icon: DollarSign, color: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-l-indigo-400' },
        ].map(({ label, value, icon: Icon, color, text, border }) => (
          <div key={label} className={`bg-white dark:bg-[#1e293b] rounded-xl border border-gray-100 dark:border-[#334155] border-l-4 ${border} p-4 flex items-center gap-3`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
              <Icon size={18} className={text} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider leading-tight">{label}</p>
              <p className="text-xl font-extrabold text-gray-900 dark:text-slate-100 tabular-nums leading-tight mt-0.5">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filtros ── */}
      <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-gray-100 dark:border-[#334155] p-4">
        <div className="flex flex-wrap items-end gap-3">
          {/* Búsqueda */}
          <div className="relative flex-1 min-w-[180px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input value={filtroBusq} onChange={e => setFiltroBusq(e.target.value)}
              placeholder="Ruta, conductor, placa…"
              className="w-full pl-8 pr-3 py-2 border border-gray-200 dark:border-[#334155] bg-white dark:bg-[#0f172a] rounded-xl text-sm text-gray-800 dark:text-slate-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#064e3b]/30 focus:border-[#064e3b] transition-colors" />
          </div>

          {/* Estado */}
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
            className="px-3 py-2 border border-gray-200 dark:border-[#334155] bg-white dark:bg-[#0f172a] rounded-xl text-sm text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#064e3b]/30 transition-colors">
            <option value="">Todos</option>
            <option value="COMPLETADO">Completados</option>
            <option value="CANCELADO">Cancelados</option>
          </select>

          {/* Desde */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Desde</label>
            <input type="date" value={filtroDesde} onChange={e => setFiltroDesde(e.target.value)}
              className="px-3 py-2 border border-gray-200 dark:border-[#334155] bg-white dark:bg-[#0f172a] rounded-xl text-sm text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#064e3b]/30 transition-colors" />
          </div>

          {/* Hasta */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Hasta</label>
            <input type="date" value={filtroHasta} onChange={e => setFiltroHasta(e.target.value)}
              className="px-3 py-2 border border-gray-200 dark:border-[#334155] bg-white dark:bg-[#0f172a] rounded-xl text-sm text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#064e3b]/30 transition-colors" />
          </div>

          {/* Limpiar + Actualizar */}
          {(filtroEstado || filtroDesde || filtroHasta || filtroBusq) && (
            <button onClick={() => { setFiltroEstado(''); setFiltroDesde(''); setFiltroHasta(''); setFiltroBusq('') }}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-[#334155] text-gray-500 dark:text-slate-400 text-sm rounded-xl hover:bg-gray-50 dark:hover:bg-[#293548] transition-colors">
              <X size={13} /> Limpiar
            </button>
          )}
          <button onClick={cargar} disabled={cargando}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-[#334155] text-gray-500 dark:text-slate-400 text-xs rounded-xl hover:bg-gray-50 dark:hover:bg-[#293548] transition-colors ml-auto">
            {cargando ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Actualizar
          </button>
        </div>
      </div>

      {/* ── Lista ── */}
      {cargando ? (
        <div className="flex justify-center items-center py-16 text-gray-400 dark:text-slate-500">
          <Loader2 size={22} className="animate-spin mr-2" /> Cargando historial…
        </div>
      ) : filtrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-[#293548] flex items-center justify-center mb-4">
            <History size={28} className="text-gray-300 dark:text-slate-600" />
          </div>
          <p className="text-base font-bold text-gray-700 dark:text-slate-300">Sin viajes en el historial</p>
          <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
            {(filtroEstado || filtroDesde || filtroHasta || filtroBusq)
              ? 'No hay resultados para los filtros seleccionados'
              : 'Los viajes completados y cancelados aparecerán aquí'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtrados.map(v => {
            const esCompletado = v.estado === 'COMPLETADO'
            const esCancelado  = v.estado === 'CANCELADO'
            let sal: { fecha: string; hora: string } = { fecha: '—', hora: '—' }
            try {
              const d = new Date(v.fechaHoraSal)
              sal = { fecha: format(d, "dd MMM yyyy", { locale: es }), hora: format(d, 'HH:mm') }
            } catch {}
            let arrStr = '—'
            try {
              if (v.fechaHoraArr) arrStr = format(new Date(v.fechaHoraArr), 'dd/MM HH:mm', { locale: es })
            } catch {}

            return (
              <div key={v.id}
                className={`bg-white dark:bg-[#1e293b] rounded-2xl border overflow-hidden transition-all hover:shadow-md ${
                  esCompletado ? 'border-gray-200 dark:border-[#334155]' : 'border-red-200 dark:border-red-900/40'
                }`}>

                {/* Barra superior de color */}
                <div className={`h-1 w-full ${esCompletado ? 'bg-emerald-400' : 'bg-red-400'}`} />

                <div className="p-4">
                  {/* Fila principal */}
                  <div className="flex items-start gap-4">

                    {/* Ícono estado */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      esCompletado ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20'
                    }`}>
                      {esCompletado
                        ? <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400" />
                        : <XCircle size={18} className="text-red-500 dark:text-red-400" />}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      {/* Ruta */}
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-bold text-gray-900 dark:text-slate-100 text-sm">
                          {v.rutaOrigen ?? '—'}
                        </span>
                        <ArrowRight size={13} className="text-gray-400 dark:text-slate-500 shrink-0" />
                        <span className="font-bold text-gray-900 dark:text-slate-100 text-sm">
                          {v.rutaDestino ?? '—'}
                        </span>
                        {v.distanciaKm && (
                          <span className="text-[11px] bg-gray-100 dark:bg-[#293548] text-gray-500 dark:text-slate-400 px-2 py-0.5 rounded-full font-mono">
                            {v.distanciaKm} km
                          </span>
                        )}
                        <span className={`ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          esCompletado ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                       : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                        }`}>
                          {esCompletado ? 'Completado' : 'Cancelado'}
                        </span>
                      </div>

                      {/* Vehículo + Conductor */}
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500 dark:text-slate-400 mb-2">
                        {v.vehiculoPlaca && (
                          <span className="flex items-center gap-1">
                            <Bus size={11} />
                            <span className="font-mono font-semibold text-gray-700 dark:text-slate-300">{v.vehiculoPlaca}</span>
                            <span>· {v.vehiculoTipo}</span>
                          </span>
                        )}
                        {v.conductorNombre && (
                          <span className="flex items-center gap-1">
                            <UserCheck size={11} />
                            {v.conductorNombre}
                          </span>
                        )}
                      </div>

                      {/* Fechas + duración */}
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-400 dark:text-slate-500 mb-3">
                        <span className="flex items-center gap-1">
                          <Calendar size={11} />
                          <span className="font-medium text-gray-600 dark:text-slate-400">{sal.fecha}</span>
                          <span className="font-mono">{sal.hora}</span>
                        </span>
                        {v.fechaHoraArr && (
                          <span className="flex items-center gap-1">
                            <CheckCircle size={11} />
                            Llegó: <span className="font-mono">{arrStr}</span>
                          </span>
                        )}
                        {v.duracionMinutos != null && (
                          <span className="flex items-center gap-1">
                            <Timer size={11} />
                            {fmtDuracion(v.duracionMinutos)}
                          </span>
                        )}
                      </div>

                      {/* Stats del viaje */}
                      {esCompletado && (
                        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-gray-50 dark:border-[#293548]">
                          <div className="flex items-center gap-1.5 text-xs">
                            <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                              <Users size={11} className="text-blue-600 dark:text-blue-400" />
                            </div>
                            <span className="font-bold text-gray-900 dark:text-slate-100">{v.totalPasajeros}</span>
                            <span className="text-gray-400 dark:text-slate-500">pasajero{v.totalPasajeros !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs">
                            <div className="w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                              <Package size={11} className="text-amber-600 dark:text-amber-400" />
                            </div>
                            <span className="font-bold text-gray-900 dark:text-slate-100">{v.totalEncomiendas}</span>
                            <span className="text-gray-400 dark:text-slate-500">encomienda{v.totalEncomiendas !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs">
                            <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                              <DollarSign size={11} className="text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <span className="font-bold text-emerald-700 dark:text-emerald-400">{fmtMoney(v.totalIngresos)}</span>
                            <span className="text-gray-400 dark:text-slate-500 text-[10px]">
                              ({fmtMoney(v.ingresosPasajes)} pasajes + {fmtMoney(v.ingresosEncomiendas)} encom.)
                            </span>
                          </div>

                          {/* Acciones: Manifiesto + Liquidación */}
                          <div className="ml-auto flex items-center gap-2">
                            <button onClick={() => imprimirManifiesto(v.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 dark:border-[#334155] text-gray-500 dark:text-slate-400 text-xs rounded-lg hover:bg-gray-50 dark:hover:bg-[#293548] hover:text-gray-700 dark:hover:text-slate-300 transition-colors font-medium">
                              <FileText size={12} /> Manifiesto
                            </button>
                            {esCompletado && (
                              <button onClick={() => descargarLiquidacion(v.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#064e3b] text-white text-xs rounded-lg hover:bg-[#065f46] transition-colors font-semibold">
                                <DollarSign size={12} /> Liquidación
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Cancelado: observación */}
                      {esCancelado && v.observaciones && (
                        <div className="mt-2 text-xs text-red-600 dark:text-red-400 flex items-start gap-1.5">
                          <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                          {v.observaciones}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatFechaLarga(iso: string) {
  try { return format(new Date(iso), "dd/MM/yy HH:mm", { locale: es }) } catch { return '—' }
}
function formatFechaHora(iso: string) {
  try {
    const d = new Date(iso)
    return { fecha: format(d, "dd MMM yyyy", { locale: es }), hora: format(d, 'HH:mm') }
  } catch { return { fecha: '—', hora: '—' } }
}
function minDatetimeLocal() {
  const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
}

/** Devuelve cuántos minutos lleva atrasado un viaje PROGRAMADO (positivo = atrasado). */
function minutosAtraso(fechaHoraSal: string): number {
  try {
    return Math.floor((Date.now() - new Date(fechaHoraSal).getTime()) / 60000)
  } catch { return 0 }
}
function estaAtrasado(v: ViajeDTO): boolean {
  return v.estado === 'ATRASADO' || (v.estado === 'PROGRAMADO' && minutosAtraso(v.fechaHoraSal) > 0)
}
/** Horas transcurridas desde la salida de un viaje EN_RUTA. */
function horasEnRuta(v: ViajeDTO): number {
  return Math.floor((Date.now() - new Date(v.fechaHoraSal).getTime()) / 3_600_000)
}
/** EN_RUTA hace más de 24 h ⇒ alguien olvidó confirmar la llegada. */
function llegadaPendiente(v: ViajeDTO): boolean {
  return v.estado === 'EN_RUTA' && horasEnRuta(v) > 24
}
function labelEnRuta(horas: number): string {
  return horas < 48 ? `${horas}h en ruta` : `${Math.floor(horas / 24)} días en ruta`
}

function labelAtraso(mins: number): string {
  if (mins < 60) return `${mins} min atrasado`
  const h = Math.floor(mins / 60), m = mins % 60
  return m > 0 ? `${h}h ${m}m atrasado` : `${h}h atrasado`
}

// ── Estilos de estado ─────────────────────────────────────────────────────────
const ESTADO_STYLES: Record<string, { border: string; iconBg: string; iconText: string; dot: string; leftBar: string }> = {
  PROGRAMADO: { border: 'border-blue-200 dark:border-blue-900/50',    iconBg: 'bg-blue-50 dark:bg-blue-900/20',    iconText: 'text-blue-600 dark:text-blue-400',    dot: 'bg-blue-400',    leftBar: 'bg-blue-400' },
  ATRASADO:   { border: 'border-amber-300 dark:border-amber-700/60',  iconBg: 'bg-amber-50 dark:bg-amber-900/20',  iconText: 'text-amber-600 dark:text-amber-400',  dot: 'bg-amber-400 animate-pulse', leftBar: 'bg-amber-400' },
  EN_RUTA:    { border: 'border-emerald-200 dark:border-emerald-900/50', iconBg: 'bg-emerald-50 dark:bg-emerald-900/20', iconText: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-400 animate-pulse', leftBar: 'bg-emerald-500' },
  COMPLETADO: { border: 'border-gray-200 dark:border-[#334155]',      iconBg: 'bg-gray-100 dark:bg-[#293548]',     iconText: 'text-gray-400 dark:text-slate-500',   dot: 'bg-gray-300',    leftBar: 'bg-gray-300' },
  CANCELADO:  { border: 'border-red-200 dark:border-red-900/40',      iconBg: 'bg-red-50 dark:bg-red-900/20',      iconText: 'text-red-500 dark:text-red-400',      dot: 'bg-red-400',     leftBar: 'bg-red-400' },
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function ViajesPage() {
  // Sin refreshInterval — WebSocket notifica cambios en tiempo real
  const { data, mutate } = useSWR('/api/viajes', { revalidateOnFocus: false })
  const viajes: ViajeDTO[] = data || []
  const { user, hasModulo } = useAuthStore()
  const { connected, suscribeToViajeCancelado } = useWebSocket()

  const [tab,                   setTab]                   = useState<PageTab>('operaciones')
  const [confirmando,           setConfirmando]           = useState<number | null>(null)
  const [cancelando,            setCancelando]            = useState<number | null>(null)
  const [confirmCancelId,       setConfirmCancelId]       = useState<number | null>(null)
  const [imprimiendoManifiesto, setImprimiendoManifiesto] = useState<number | null>(null)
  const [busqueda,              setBusqueda]              = useState('')
  const [busquedaDebounced,     setBusquedaDebounced]     = useState('')
  const [alertasCancelacion,    setAlertasCancelacion]    = useState<AlertaCancelacion[]>([])

  // Modal crear
  const [modalProgramar, setModalProgramar] = useState(false)
  const [form,           setForm]           = useState(emptyForm)
  const [guardando,      setGuardando]      = useState(false)

  // Modal editar
  const [modalEditar,   setModalEditar]   = useState(false)
  const [editandoViaje, setEditandoViaje] = useState<ViajeDTO | null>(null)
  const [editForm,      setEditForm]      = useState(emptyEditForm)
  const [guardandoEdit, setGuardandoEdit] = useState(false)

  // SWR lazy
  const { data: rutasData } = useSWR<RutaOpt[]>((modalProgramar) ? '/api/configuracion/rutas' : null)
  const { data: vehData }   = useSWR<VehOpt[]>((modalProgramar || modalEditar) ? '/api/configuracion/vehiculos' : null)
  const { data: condData }  = useSWR<CondOpt[]>((modalProgramar || modalEditar) ? '/api/conductor/lista' : null)
  const rutas       = rutasData ?? []
  const vehiculos   = vehData   ?? []
  const conductores = condData  ?? []

  const rol         = user?.rol ?? ''
  const puedeOperar = ['SUPER_ADMIN','GERENTE','ADMIN_AGENCIA','OPERADOR'].includes(rol)

  // Suscripción WebSocket — alerta cuando el sistema cancela un viaje automáticamente
  useEffect(() => {
    if (!connected || !user?.agenciaId) return
    const sub = suscribeToViajeCancelado(user.agenciaId, (evt: AlertaCancelacion) => {
      setAlertasCancelacion(prev => [evt, ...prev])
      mutate() // recargar lista de viajes
      toast.error(
        `⚠ Viaje cancelado automáticamente: ${evt.ruta} — ${evt.totalPasajeros} pasajero(s) afectados`,
        { duration: 8000 }
      )
    })
    return () => sub?.unsubscribe()
  }, [connected, user?.agenciaId])

  // Debounce búsqueda — evita filtrar en cada keystroke
  useEffect(() => {
    const t = setTimeout(() => setBusquedaDebounced(busqueda), 250)
    return () => clearTimeout(t)
  }, [busqueda])

  const viajesFiltrados = useMemo(() => {
    if (!busquedaDebounced.trim()) return viajes
    const q = busquedaDebounced.toLowerCase()
    return viajes.filter(v =>
      v.ruta?.origen?.toLowerCase().includes(q) ||
      v.ruta?.destino?.toLowerCase().includes(q) ||
      v.conductorNombre?.toLowerCase().includes(q) ||
      v.vehiculo?.placa?.toLowerCase().includes(q)
    )
  }, [viajes, busquedaDebounced])

  // Atrasados primero, luego por hora de salida
  const programados = viajesFiltrados
    .filter(v => v.estado === 'PROGRAMADO' || v.estado === 'ATRASADO')
    .sort((a, b) => {
      const aAt = estaAtrasado(a) ? 1 : 0
      const bAt = estaAtrasado(b) ? 1 : 0
      if (aAt !== bAt) return bAt - aAt  // atrasados primero
      return new Date(a.fechaHoraSal).getTime() - new Date(b.fechaHoraSal).getTime()
    })
  const enRuta      = viajesFiltrados.filter(v => v.estado === 'EN_RUTA')

  // ── Acciones ─────────────────────────────────────────────────────────────────
  const programarViaje = async () => {
    if (!form.rutaId || !form.vehiculoId || !form.conductorId || !form.fechaHoraSal) {
      toast.error('Ruta, vehículo, conductor y fecha/hora son obligatorios'); return
    }
    setGuardando(true)
    try {
      await api.post('/api/viajes', {
        rutaId: parseInt(form.rutaId), vehiculoId: parseInt(form.vehiculoId),
        conductorId: parseInt(form.conductorId),
        fechaHoraSal: new Date(form.fechaHoraSal).toISOString(),
        observaciones: form.observaciones || null,
      })
      toast.success('Viaje programado correctamente')
      setModalProgramar(false); setForm(emptyForm); mutate()
    } catch (err: any) { toast.error(err?.response?.data?.message || 'Error al programar viaje')
    } finally { setGuardando(false) }
  }

  const abrirEditar = (v: ViajeDTO) => {
    setEditandoViaje(v)
    setEditForm({ conductorId: String(v.conductorId ?? ''), vehiculoId: String(v.vehiculo?.id ?? ''), fechaHoraSal: v.fechaHoraSal?.slice(0, 16) ?? '', observaciones: v.observaciones ?? '' })
    setModalEditar(true)
  }

  const editarViaje = async () => {
    if (!editForm.conductorId || !editForm.fechaHoraSal) { toast.error('Conductor y fecha/hora son obligatorios'); return }
    if (!editandoViaje) return
    setGuardandoEdit(true)
    try {
      await api.put(`/api/viajes/${editandoViaje.id}`, {
        conductorId: parseInt(editForm.conductorId),
        vehiculoId: editForm.vehiculoId ? parseInt(editForm.vehiculoId) : null,
        fechaHoraSal: new Date(editForm.fechaHoraSal).toISOString(),
        observaciones: editForm.observaciones || null,
      })
      toast.success('Viaje actualizado'); setModalEditar(false); setEditandoViaje(null); mutate()
    } catch (err: any) { toast.error(err?.response?.data?.message || 'Error al editar')
    } finally { setGuardandoEdit(false) }
  }

  const confirmarSalida  = async (id: number) => { setConfirmando(id); try { await api.post(`/api/viajes/${id}/confirmar-salida`);  toast.success('Salida confirmada'); mutate() } catch (e: any) { toast.error(e?.response?.data?.message || 'Error') } finally { setConfirmando(null) } }
  const confirmarLlegada = async (id: number) => { setConfirmando(id); try { await api.post(`/api/viajes/${id}/confirmar-llegada`); toast.success('Llegada confirmada'); mutate() } catch (e: any) { toast.error(e?.response?.data?.message || 'Error') } finally { setConfirmando(null) } }
  const cancelarViaje    = async (id: number) => { setCancelando(id);  try { await api.post(`/api/viajes/${id}/cancelar`);          toast.success('Viaje cancelado');   setConfirmCancelId(null); mutate() } catch (e: any) { toast.error(e?.response?.data?.message || 'Error') } finally { setCancelando(null) } }
  const imprimirManifiesto = async (id: number) => {
    setImprimiendoManifiesto(id)
    try {
      const blob = await api.get(`/api/manifiestos/${id}/pdf`, { responseType: 'blob' }) as unknown as Blob
      const url = URL.createObjectURL(blob); window.open(url, '_blank')?.focus(); setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch { toast.error('Error al generar el manifiesto') } finally { setImprimiendoManifiesto(null) }
  }

  // ── Tarjeta de viaje ─────────────────────────────────────────────────────────
  const ViajeCard = ({ v }: { v: ViajeDTO }) => {
    const totalAsientos = Math.max(1, (v.vehiculo?.numAsientos ?? 1) - 1)
    const vendidos      = v.asientosOcupados ?? 0
    const libres        = v.asientosLibres ?? (totalAsientos - vendidos)
    const pct           = Math.round((vendidos / totalAsientos) * 100)
    const esProg        = v.estado === 'PROGRAMADO' || v.estado === 'ATRASADO'
    const esRuta        = v.estado === 'EN_RUTA'
    const esTerminado   = ['COMPLETADO', 'CANCELADO'].includes(v.estado)
    const atrasado      = estaAtrasado(v)
    const minsAtraso    = atrasado ? minutosAtraso(v.fechaHoraSal) : 0
    const confirmCanc   = confirmCancelId === v.id
    const st            = atrasado
                            ? ESTADO_STYLES.ATRASADO
                            : (ESTADO_STYLES[v.estado] ?? ESTADO_STYLES.COMPLETADO)
    const { fecha, hora } = formatFechaHora(v.fechaHoraSal)

    const pctColor = pct >= 90 ? 'bg-red-400' : pct >= 60 ? 'bg-amber-400' : 'bg-emerald-400'
    const pctText  = pct >= 90 ? 'text-red-600 dark:text-red-400'
                   : pct >= 60 ? 'text-amber-600 dark:text-amber-400'
                   : 'text-emerald-600 dark:text-emerald-400'

    return (
      <div className={`group relative bg-white dark:bg-[#1e293b] rounded-2xl border ${st.border} overflow-hidden hover:shadow-md transition-all duration-200 ${esTerminado ? 'opacity-65' : ''}`}>

        {/* Franja de estado */}
        <div className={`h-1 w-full ${st.leftBar}`} />

        <div className="p-4 space-y-3">

          {/* ── Ruta + badge + edit ── */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${st.iconBg}`}>
                <Bus size={17} className={st.iconText} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-sm font-bold text-gray-900 dark:text-slate-100 truncate">{v.ruta?.origen ?? '—'}</span>
                  <ArrowRight size={12} className="text-gray-300 dark:text-slate-600 shrink-0" />
                  <span className="text-sm font-bold text-gray-900 dark:text-slate-100 truncate">{v.ruta?.destino ?? '—'}</span>
                </div>
                {v.ruta?.distanciaKm && (
                  <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">{v.ruta.distanciaKm} km</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
              <Badge estado={v.estado} />
              {atrasado && (
                <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                  <AlertTriangle size={10} /> {labelAtraso(minsAtraso)}
                </span>
              )}
              {esProg && puedeOperar && (
                <button onClick={() => abrirEditar(v)} title="Editar viaje"
                  className="p-1.5 rounded-lg text-gray-300 dark:text-slate-600 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors opacity-0 group-hover:opacity-100">
                  <Pencil size={13} />
                </button>
              )}
            </div>
          </div>

          {/* ── Llegada sin confirmar (EN_RUTA vencido) ── */}
          {llegadaPendiente(v) && (
            <div className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-100 dark:border-red-900/40">
              <AlertTriangle size={11} className="shrink-0" />
              {labelEnRuta(horasEnRuta(v))} — confirma la llegada
            </div>
          )}

          {/* ── Fecha / Hora / Vehículo ── */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 dark:bg-[#0f172a] rounded-lg border border-gray-100 dark:border-[#293548] flex-1">
              <Calendar size={11} className="text-gray-400 dark:text-slate-500 shrink-0" />
              <span className="text-xs text-gray-600 dark:text-slate-400">{fecha}</span>
              <span className="text-gray-200 dark:text-slate-700 mx-0.5">·</span>
              <Clock size={11} className={`${st.iconText} shrink-0`} />
              <span className="text-xs font-bold text-gray-800 dark:text-slate-200">{hora}</span>
            </div>
            {v.vehiculo && (
              <div className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-50 dark:bg-[#0f172a] rounded-lg border border-gray-100 dark:border-[#293548] text-xs text-gray-500 dark:text-slate-400 shrink-0">
                <Bus size={11} className="text-gray-400 dark:text-slate-500" />
                <span className="font-mono">{v.vehiculo.placa}</span>
              </div>
            )}
          </div>

          {/* ── Conductor ── */}
          {v.conductorNombre && v.conductorNombre !== '—' && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
              <UserCheck size={11} className="text-gray-300 dark:text-slate-600 shrink-0" />
              <span>{v.conductorNombre}</span>
              {v.vehiculo?.tipo && (
                <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-[#293548] text-gray-500 dark:text-slate-400 rounded text-[10px] font-medium">
                  {v.vehiculo.tipo}
                </span>
              )}
            </div>
          )}

          {/* ── Ocupación ── */}
          {!esTerminado && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-gray-500 dark:text-slate-400">
                  <Users size={11} />
                  <span>{vendidos} de {totalAsientos} asientos</span>
                  {libres > 0 && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">· {libres} libre{libres !== 1 ? 's' : ''}</span>
                  )}
                </div>
                <span className={`font-bold tabular-nums ${pctText}`}>{pct}%</span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 dark:bg-[#293548] rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${pctColor}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}

          {/* ── Chips extra ── */}
          {((v.cantEncomiendas ?? 0) > 0 || (v.ingresosViaje ?? 0) > 0 || v.observaciones || (v.estado === 'COMPLETADO' && v.fechaHoraArr)) && (
            <div className="flex flex-wrap gap-1.5">
              {(v.ingresosViaje ?? 0) > 0 && (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-900/40">
                  S/ {Number(v.ingresosViaje).toFixed(2)} recaudado
                </span>
              )}
              {(v.cantEncomiendas ?? 0) > 0 && (
                <span className="flex items-center gap-1 text-[11px] text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded-full border border-orange-100 dark:border-orange-900/40">
                  <Package size={10} /> {v.cantEncomiendas} encomienda{(v.cantEncomiendas ?? 0) !== 1 ? 's' : ''}
                </span>
              )}
              {v.estado === 'COMPLETADO' && v.fechaHoraArr && (
                <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-900/40">
                  <CheckCircle size={10} /> Llegó: {formatFechaLarga(v.fechaHoraArr)}
                </span>
              )}
              {v.observaciones && (
                <span className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-[#0f172a] px-2 py-0.5 rounded-full border border-gray-100 dark:border-[#293548] max-w-full">
                  <FileText size={10} className="shrink-0" />
                  <span className="truncate">{v.observaciones}</span>
                </span>
              )}
            </div>
          )}

          {/* ── Acciones ── */}
          {(esProg || esRuta) && puedeOperar && (
            <div className="pt-2 border-t border-gray-100 dark:border-[#293548]">
              {confirmCanc ? (
                <div className="flex items-center gap-2 p-2.5 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-900/50">
                  <AlertTriangle size={13} className="text-red-500 shrink-0" />
                  <span className="text-xs text-red-700 dark:text-red-400 flex-1">¿Cancelar este viaje?</span>
                  <button onClick={() => cancelarViaje(v.id)} disabled={cancelando === v.id}
                    className="px-3 py-1 bg-red-600 text-white text-xs rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors">
                    {cancelando === v.id ? '…' : 'Sí, cancelar'}
                  </button>
                  <button onClick={() => setConfirmCancelId(null)}
                    className="px-2 py-1 text-xs text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-[#293548] rounded-lg transition-colors">
                    No
                  </button>
                </div>
              ) : (
                <div className="flex gap-1.5">
                  {esProg && (
                    <>
                      <button onClick={() => confirmarSalida(v.id)} disabled={confirmando === v.id}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-50">
                        <Navigation size={12} />
                        {confirmando === v.id ? 'Confirmando…' : 'Confirmar salida'}
                      </button>
                      <Link href="/pasajes">
                        <button title="Vender pasajes" className="p-2 rounded-xl border border-blue-200 dark:border-blue-900/50 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                          <Ticket size={14} />
                        </button>
                      </Link>
                      {hasModulo('MANIFIESTOS') && (
                        <button onClick={() => imprimirManifiesto(v.id)} disabled={imprimiendoManifiesto === v.id} title="Manifiesto PDF"
                          className="p-2 rounded-xl border border-gray-200 dark:border-[#334155] text-gray-400 dark:text-slate-500 hover:bg-gray-50 dark:hover:bg-[#293548] transition-colors disabled:opacity-50">
                          <FileText size={14} />
                        </button>
                      )}
                      <button onClick={() => setConfirmCancelId(v.id)} title="Cancelar viaje"
                        className="p-2 rounded-xl text-gray-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <X size={14} />
                      </button>
                    </>
                  )}
                  {esRuta && (
                    <>
                      <button onClick={() => confirmarLlegada(v.id)} disabled={confirmando === v.id}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-50">
                        <CheckCircle size={12} />
                        {confirmando === v.id ? 'Confirmando…' : 'Confirmar llegada'}
                      </button>
                      {hasModulo('MANIFIESTOS') && (
                        <button onClick={() => imprimirManifiesto(v.id)} disabled={imprimiendoManifiesto === v.id} title="Manifiesto PDF"
                          className="p-2 rounded-xl border border-gray-200 dark:border-[#334155] text-gray-400 dark:text-slate-500 hover:bg-gray-50 dark:hover:bg-[#293548] transition-colors disabled:opacity-50">
                          <FileText size={14} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Sección ───────────────────────────────────────────────────────────────────
  const Seccion = ({ titulo, lista, dot }: { titulo: string; lista: ViajeDTO[]; dot: string }) =>
    lista.length === 0 ? null : (
      <section>
        <div className="flex items-center gap-3 mb-4">
          <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
          <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">{titulo}</span>
          <span className="text-[11px] font-semibold text-gray-400 dark:text-slate-500 bg-gray-100 dark:bg-[#293548] px-2 py-0.5 rounded-full tabular-nums">{lista.length}</span>
          <div className="flex-1 h-px bg-gray-100 dark:bg-[#293548]" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {lista.map(v => <ViajeCard key={v.id} v={v} />)}
        </div>
      </section>
    )

  // ── Preview para el modal ─────────────────────────────────────────────────────
  const rutaSel  = rutas.find(r => r.id === parseInt(form.rutaId))
  const vehSel   = vehiculos.find(v => v.id === parseInt(form.vehiculoId))
  const condSel  = conductores.find(c => c.id === parseInt(form.conductorId))
  const tienePreview = !!(rutaSel || vehSel || condSel || form.fechaHoraSal)

  // ── Stats rápidos ─────────────────────────────────────────────────────────────
  const totalLibres    = [...enRuta, ...programados].reduce((s, v) => s + (v.asientosLibres ?? 0), 0)
  const totalVendidos  = [...enRuta, ...programados].reduce((s, v) => s + (v.asientosOcupados ?? 0), 0)

  // ── Render ─────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#064e3b] flex items-center justify-center">
            <Bus size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Viajes</h1>
            <p className="text-xs text-gray-400 dark:text-slate-500 capitalize" suppressHydrationWarning>
              {format(new Date(), "EEEE dd 'de' MMMM yyyy", { locale: es })}
            </p>
          </div>
        </div>
        {puedeOperar && tab === 'operaciones' && (
          <button onClick={() => setModalProgramar(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#064e3b] hover:bg-[#065f46] text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
            <Plus size={15} /> Programar viaje
          </button>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-[#334155]">
        <button onClick={() => setTab('operaciones')}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'operaciones'
              ? 'border-[#064e3b] text-[#064e3b] dark:text-emerald-400 dark:border-emerald-400'
              : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
          }`}>
          <Bus size={14} />
          Operaciones
          {(enRuta.length > 0 || programados.length > 0) && (
            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
              tab === 'operaciones'
                ? 'bg-[#064e3b]/10 dark:bg-emerald-900/30 text-[#064e3b] dark:text-emerald-400'
                : 'bg-gray-100 dark:bg-[#293548] text-gray-500 dark:text-slate-400'
            }`}>
              {enRuta.length + programados.length}
            </span>
          )}
        </button>
        <button onClick={() => setTab('historial')}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'historial'
              ? 'border-[#064e3b] text-[#064e3b] dark:text-emerald-400 dark:border-emerald-400'
              : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
          }`}>
          <History size={14} />
          Historial
        </button>
      </div>

      {/* ── Tab: Operaciones ── */}
      {tab === 'operaciones' && (
        <>
          {/* ── Alerta viajes atrasados ── */}
          {programados.filter(estaAtrasado).length > 0 && (
            <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-2xl px-4 py-3.5">
              <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
                  {programados.filter(estaAtrasado).length === 1
                    ? '1 viaje no salió a tiempo'
                    : `${programados.filter(estaAtrasado).length} viajes no salieron a tiempo`}
                </p>
                <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-0.5">
                  Confirma la salida o cancela los viajes marcados como <strong>ATRASADO</strong>.
                  Se cancelarán automáticamente a las 4 horas de su hora programada.
                </p>
              </div>
            </div>
          )}

          {/* ── Alerta llegadas sin confirmar (EN_RUTA hace más de 24 h) ── */}
          {enRuta.filter(llegadaPendiente).length > 0 && (
            <div className="flex items-start gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-2xl px-4 py-3.5">
              <div className="w-8 h-8 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle size={16} className="text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-red-800 dark:text-red-300">
                  {enRuta.filter(llegadaPendiente).length === 1
                    ? '1 viaje lleva más de 24 h "en ruta" sin confirmar llegada'
                    : `${enRuta.filter(llegadaPendiente).length} viajes llevan más de 24 h "en ruta" sin confirmar llegada`}
                </p>
                <p className="text-xs text-red-700/80 dark:text-red-400/80 mt-0.5">
                  Mientras no confirmes la llegada, sus encomiendas no pasan a disponibles para entrega
                  y los reportes del día quedan desactualizados. Usa <strong>Confirmar llegada</strong> en cada tarjeta.
                </p>
              </div>
            </div>
          )}

          {/* Stats */}
          {viajes.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {enRuta.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900/50 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {enRuta.length} en ruta
                </div>
              )}
              {programados.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/40 rounded-xl text-xs font-semibold text-blue-700 dark:text-blue-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  {programados.length} programado{programados.length !== 1 ? 's' : ''}
                </div>
              )}
              {totalVendidos > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 dark:bg-[#1e293b] border border-gray-200 dark:border-[#334155] rounded-xl text-xs text-gray-600 dark:text-slate-400">
                  <Users size={12} className="text-gray-400" />
                  <span><strong>{totalVendidos}</strong> pasajeros vendidos</span>
                  {totalLibres > 0 && <span className="text-gray-300 dark:text-slate-600 mx-0.5">·</span>}
                  {totalLibres > 0 && <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{totalLibres} libres</span>}
                </div>
              )}
            </div>
          )}

          {/* Búsqueda */}
          {viajes.length > 0 && (
            <div className="relative max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar ruta, conductor, placa…"
                className="w-full pl-9 pr-8 py-2.5 border border-gray-200 dark:border-[#334155] bg-white dark:bg-[#1e293b] rounded-xl text-sm text-gray-800 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#064e3b]/30 focus:border-[#064e3b] transition-colors" />
              {busqueda && (
                <button onClick={() => setBusqueda('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
                  <X size={13} />
                </button>
              )}
            </div>
          )}

          {/* Empty state */}
          {viajes.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-20 h-20 rounded-2xl bg-gray-100 dark:bg-[#293548] flex items-center justify-center mb-4">
                <Bus size={32} className="text-gray-300 dark:text-slate-600" />
              </div>
              <p className="text-base font-semibold text-gray-600 dark:text-slate-300">Sin viajes activos</p>
              <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">Programa un viaje para comenzar a vender pasajes</p>
              {puedeOperar && (
                <button onClick={() => setModalProgramar(true)}
                  className="mt-5 flex items-center gap-2 px-6 py-2.5 bg-[#064e3b] text-white text-sm font-semibold rounded-xl hover:bg-[#065f46] transition-colors">
                  <Plus size={15} /> Programar primer viaje
                </button>
              )}
            </div>
          )}

          {/* ── Alertas de viajes cancelados automáticamente ── */}
          {alertasCancelacion.map((alerta, idx) => (
            <div key={idx} className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-2xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-red-500 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-red-800 dark:text-red-300">
                      Viaje #{alerta.viajeId} cancelado automáticamente
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-400">
                      {alerta.ruta} · programado {alerta.horaProgramada ? format(new Date(alerta.horaProgramada), 'HH:mm', { locale: es }) : '—'}
                    </p>
                  </div>
                </div>
                <button onClick={() => setAlertasCancelacion(prev => prev.filter((_, i) => i !== idx))}
                  className="text-red-400 hover:text-red-600 shrink-0">
                  <X size={14} />
                </button>
              </div>

              {alerta.totalPasajeros > 0 && (
                <div className="bg-white dark:bg-[#1e293b] rounded-xl border border-red-100 dark:border-red-900/40 p-3">
                  <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-2 flex items-center gap-1">
                    <Ticket size={11} /> {alerta.totalPasajeros} pasajero(s) — dinero devuelto a caja · deben re-comprar boleta
                  </p>
                  <div className="space-y-1">
                    {alerta.pasajerosAfectados.map(p => (
                      <div key={p.pasajeId} className="flex items-center justify-between text-xs text-gray-700 dark:text-slate-300 py-1 border-b border-gray-100 dark:border-[#293548] last:border-0">
                        <span className="font-medium">{p.clienteNombre}</span>
                        <span className="flex items-center gap-3 text-gray-500 dark:text-slate-400">
                          <span>Asiento {p.asiento}</span>
                          <span className="font-mono text-red-600 dark:text-red-400">S/ {Number(p.monto).toFixed(2)}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {alerta.totalEncomiendas > 0 && (
                <div className="bg-white dark:bg-[#1e293b] rounded-xl border border-orange-100 dark:border-orange-900/40 p-3">
                  <p className="text-xs font-semibold text-orange-700 dark:text-orange-400 mb-2 flex items-center gap-1">
                    <Package size={11} /> {alerta.totalEncomiendas} encomienda(s) — regresadas a ALMACENADO · asignarlas al próximo viaje
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {alerta.encomiendasRetenidas.map(e => (
                      <span key={e.encomiendaId} className="px-2 py-0.5 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/50 rounded-full text-[11px] font-mono text-orange-700 dark:text-orange-300">
                        {e.codigo}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Viajes activos */}
          <Seccion titulo="En ruta"     lista={enRuta}     dot="bg-emerald-400 animate-pulse" />
          <Seccion titulo="Programados" lista={programados} dot="bg-blue-400" />

          {viajes.length > 0 && viajesFiltrados.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-[#293548] flex items-center justify-center mb-3">
                <Search size={20} className="text-gray-400 dark:text-slate-500" />
              </div>
              <p className="text-sm font-semibold text-gray-600 dark:text-slate-300">Sin resultados para &ldquo;{busqueda}&rdquo;</p>
              <button onClick={() => setBusqueda('')} className="mt-3 text-xs text-[#064e3b] dark:text-emerald-400 hover:underline">
                Limpiar búsqueda
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Tab: Historial ── */}
      {tab === 'historial' && <HistorialTab />}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: PROGRAMAR VIAJE
      ══════════════════════════════════════════════════════════════════════════ */}
      {modalProgramar && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#0f172a] rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col border border-gray-100 dark:border-[#1e293b]">

            {/* ── Header con gradiente ── */}
            <div className="relative overflow-hidden shrink-0">
              <div className="absolute inset-0 bg-gradient-to-br from-[#064e3b] via-[#065f46] to-[#047857]" />
              {/* Decoración de fondo */}
              <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/5" />
              <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full bg-white/5" />
              <div className="relative flex items-center justify-between px-6 py-5">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20">
                    <Bus size={20} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white leading-tight tracking-tight">Programar nuevo viaje</h2>
                    <p className="text-xs text-emerald-200/80 mt-0.5">Completa los 4 pasos para registrar el viaje</p>
                  </div>
                </div>
                <button onClick={() => { setModalProgramar(false); setForm(emptyForm) }}
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer border border-white/10">
                  <X size={15} className="text-white" />
                </button>
              </div>
            </div>

            {/* ── Cuerpo scrollable ── */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

              {/* Preview en tiempo real */}
              <div className={`rounded-2xl overflow-hidden transition-all duration-500 ${
                tienePreview
                  ? 'ring-1 ring-emerald-400/30 dark:ring-emerald-600/40'
                  : 'ring-1 ring-dashed ring-gray-200 dark:ring-[#293548]'
              }`}>
                {tienePreview ? (
                  <div className="bg-gradient-to-br from-[#022c22] via-[#064e3b] to-[#065f46]">
                    {/* Encabezado ruta */}
                    <div className="px-4 pt-4 pb-3 border-b border-white/10">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-1.5 min-w-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                          <span className="text-white text-sm font-bold truncate">{rutaSel?.origen ?? '—'}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <div className="w-4 h-px bg-emerald-500/50" />
                          <ArrowRight size={13} className="text-emerald-400" />
                          <div className="w-4 h-px bg-emerald-500/50" />
                        </div>
                        <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-1.5 min-w-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-300 shrink-0" />
                          <span className="text-white text-sm font-bold truncate">{rutaSel?.destino ?? '—'}</span>
                        </div>
                        {rutaSel?.distanciaKm && (
                          <span className="ml-auto text-[11px] bg-white/10 text-emerald-300 px-2 py-1 rounded-lg font-mono shrink-0">
                            {rutaSel.distanciaKm} km
                          </span>
                        )}
                      </div>
                    </div>
                    {/* 3 tarjetas de datos */}
                    <div className="grid grid-cols-3 gap-2 p-3">
                      {[
                        {
                          icon: <Bus size={12} />,
                          label: 'Vehículo',
                          main: vehSel ? vehSel.placa : '—',
                          sub: vehSel ? `${vehSel.tipo}${vehSel.numAsientos ? ` · ${vehSel.numAsientos} asientos` : ''}` : 'Sin asignar',
                        },
                        {
                          icon: <UserCheck size={12} />,
                          label: 'Conductor',
                          main: condSel ? condSel.nombres : '—',
                          sub: condSel ? condSel.apellidos : 'Sin asignar',
                        },
                        {
                          icon: <Clock size={12} />,
                          label: 'Salida',
                          main: form.fechaHoraSal ? format(new Date(form.fechaHoraSal), 'HH:mm') : '—',
                          sub: form.fechaHoraSal ? format(new Date(form.fechaHoraSal), 'dd MMM', { locale: es }) : 'Sin definir',
                        },
                      ].map(({ icon, label, main, sub }) => (
                        <div key={label} className="bg-white/8 rounded-xl p-2.5 border border-white/10">
                          <div className="flex items-center gap-1.5 text-emerald-300/80 mb-1.5">
                            {icon}
                            <span className="text-[10px] uppercase tracking-wide font-semibold">{label}</span>
                          </div>
                          <p className="text-white text-xs font-bold truncate leading-tight">{main}</p>
                          <p className="text-emerald-400/70 text-[10px] truncate mt-0.5">{sub}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-3 py-6 bg-gray-50 dark:bg-[#1e293b]/50">
                    <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-[#293548] flex items-center justify-center">
                      <Layers size={16} className="text-gray-300 dark:text-slate-600" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-400 dark:text-slate-500">Vista previa del viaje</p>
                      <p className="text-[11px] text-gray-300 dark:text-slate-600 mt-0.5">Aparecerá aquí mientras completas el formulario</p>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Paso 1: Itinerario ── */}
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">1</span>
                  </div>
                  <span className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest">Itinerario</span>
                  <div className="flex-1 h-px bg-gray-100 dark:bg-[#1e293b]" />
                  {form.rutaId && <CheckCircle size={13} className="text-emerald-500 shrink-0" />}
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                    <MapPin size={11} className="text-emerald-500" /> Ruta de viaje *
                  </label>
                  <select value={form.rutaId} onChange={e => setForm(f => ({ ...f, rutaId: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-[#293548] bg-white dark:bg-[#1e293b] rounded-xl text-sm text-gray-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 transition-colors cursor-pointer hover:border-gray-300 dark:hover:border-[#334155]">
                    <option value="">— Selecciona una ruta —</option>
                    {rutas.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.origen} → {r.destino}{r.distanciaKm ? ` (${r.distanciaKm} km)` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ── Paso 2: Tripulación ── */}
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400">2</span>
                  </div>
                  <span className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest">Tripulación</span>
                  <div className="flex-1 h-px bg-gray-100 dark:bg-[#1e293b]" />
                  {form.vehiculoId && form.conductorId && <CheckCircle size={13} className="text-emerald-500 shrink-0" />}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                      <Bus size={11} className="text-amber-500" /> Vehículo *
                    </label>
                    <select value={form.vehiculoId}
                      onChange={e => {
                        const vehiculoId = e.target.value
                        // Preseleccionar el conductor habitual del vehículo (editable)
                        const habitual = vehiculos.find(v => String(v.id) === vehiculoId)?.conductorHabitualId
                        setForm(f => ({
                          ...f, vehiculoId,
                          conductorId: habitual != null ? String(habitual) : f.conductorId,
                        }))
                      }}
                      className="w-full px-4 py-3 border border-gray-200 dark:border-[#293548] bg-white dark:bg-[#1e293b] rounded-xl text-sm text-gray-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 transition-colors cursor-pointer hover:border-gray-300 dark:hover:border-[#334155]">
                      <option value="">— Selecciona —</option>
                      {vehiculos.map(v => (
                        <option key={v.id} value={v.id}>{v.placa} — {v.tipo}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                      <UserCheck size={11} className="text-violet-500" /> Conductor *
                    </label>
                    <select value={form.conductorId} onChange={e => setForm(f => ({ ...f, conductorId: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-200 dark:border-[#293548] bg-white dark:bg-[#1e293b] rounded-xl text-sm text-gray-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 transition-colors cursor-pointer hover:border-gray-300 dark:hover:border-[#334155]">
                      <option value="">— Selecciona —</option>
                      {conductores.map(c => (
                        <option key={c.id} value={c.id}>{c.nombres} {c.apellidos} — {c.licencia}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* ── Paso 3: Horario ── */}
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800/60 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400">3</span>
                  </div>
                  <span className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest">Horario</span>
                  <div className="flex-1 h-px bg-gray-100 dark:bg-[#1e293b]" />
                  {form.fechaHoraSal && <CheckCircle size={13} className="text-emerald-500 shrink-0" />}
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                    <Calendar size={11} className="text-blue-500" /> Fecha y hora de salida *
                  </label>
                  <input type="datetime-local" value={form.fechaHoraSal} min={minDatetimeLocal()}
                    onChange={e => setForm(f => ({ ...f, fechaHoraSal: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-[#293548] bg-white dark:bg-[#1e293b] rounded-xl text-sm text-gray-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 transition-colors hover:border-gray-300 dark:hover:border-[#334155]" />
                  <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1.5 flex items-center gap-1">
                    <AlertTriangle size={10} /> No se permiten fechas en el pasado
                  </p>
                </div>
              </div>

              {/* ── Paso 4: Observaciones ── */}
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-[#293548] border border-gray-200 dark:border-[#334155] flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400">4</span>
                  </div>
                  <span className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest">Notas</span>
                  <span className="text-[10px] text-gray-300 dark:text-slate-600 font-medium">(opcional)</span>
                  <div className="flex-1 h-px bg-gray-100 dark:bg-[#1e293b]" />
                </div>
                <textarea value={form.observaciones}
                  onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
                  rows={2} placeholder="Condiciones especiales, carga adicional, observaciones del viaje…"
                  className="w-full px-4 py-3 border border-gray-200 dark:border-[#293548] bg-white dark:bg-[#1e293b] rounded-xl text-sm text-gray-800 dark:text-slate-200 placeholder-gray-300 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 resize-none transition-colors hover:border-gray-300 dark:hover:border-[#334155]" />
              </div>

            </div>

            {/* ── Footer con barra de progreso ── */}
            <div className="shrink-0 border-t border-gray-100 dark:border-[#1e293b]">
              {/* Barra de progreso */}
              <div className="h-1 bg-gray-100 dark:bg-[#1e293b] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500 ease-out"
                  style={{ width: `${[form.rutaId, form.vehiculoId, form.conductorId, form.fechaHoraSal].filter(Boolean).length * 25}%` }}
                />
              </div>
              <div className="flex justify-between items-center px-6 py-4 bg-gray-50/60 dark:bg-[#0a1628]/40">
                <div className="text-xs text-gray-400 dark:text-slate-500">
                  {!form.rutaId || !form.vehiculoId || !form.conductorId || !form.fechaHoraSal ? (
                    <span>
                      <span className="font-semibold text-gray-600 dark:text-slate-300">
                        {[form.rutaId, form.vehiculoId, form.conductorId, form.fechaHoraSal].filter(Boolean).length}
                      </span>
                      <span className="text-gray-400 dark:text-slate-500"> / 4 campos completados</span>
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                      <CheckCircle size={13} /> Listo para programar
                    </span>
                  )}
                </div>
                <div className="flex gap-2.5">
                  <button onClick={() => { setModalProgramar(false); setForm(emptyForm) }}
                    className="px-4 py-2.5 text-sm text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-[#334155] rounded-xl hover:bg-gray-100 dark:hover:bg-[#1e293b] transition-colors cursor-pointer">
                    Cancelar
                  </button>
                  <button onClick={programarViaje}
                    disabled={guardando || !form.rutaId || !form.vehiculoId || !form.conductorId || !form.fechaHoraSal}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#064e3b] hover:bg-[#065f46] text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm hover:shadow-emerald-900/40 hover:shadow-md">
                    {guardando
                      ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Programando…</>
                      : <><Bus size={14} /> Programar viaje</>}
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: EDITAR VIAJE
      ══════════════════════════════════════════════════════════════════════════ */}
      {modalEditar && editandoViaje && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#0f172a] rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-gray-100 dark:border-[#1e293b]">

            {/* ── Header con gradiente azul ── */}
            <div className="relative overflow-hidden shrink-0">
              <div className="absolute inset-0 bg-gradient-to-br from-[#1e3a5f] via-[#1d4ed8] to-[#2563eb]" />
              <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/5" />
              <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full bg-white/5" />
              <div className="relative flex items-center justify-between px-6 py-5">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20">
                    <Pencil size={18} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white leading-tight tracking-tight">
                      Editar viaje <span className="text-blue-200 font-mono">#{editandoViaje.id}</span>
                    </h2>
                    <p className="text-xs text-blue-200/80 mt-0.5 flex items-center gap-1.5">
                      <span>{editandoViaje.ruta?.origen ?? '—'}</span>
                      <ArrowRight size={10} className="text-blue-300/60" />
                      <span>{editandoViaje.ruta?.destino ?? '—'}</span>
                    </p>
                  </div>
                </div>
                <button onClick={() => { setModalEditar(false); setEditandoViaje(null) }}
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer border border-white/10">
                  <X size={15} className="text-white" />
                </button>
              </div>
            </div>

            {/* ── Banner del viaje actual ── */}
            <div className="mx-5 mt-5 rounded-2xl overflow-hidden border border-gray-100 dark:border-[#1e293b]">
              <div className="bg-gray-50 dark:bg-[#1e293b] px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                  <Bus size={15} className="text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800 dark:text-slate-200 truncate">
                    {editandoViaje.ruta?.origen} → {editandoViaje.ruta?.destino}
                    {editandoViaje.ruta?.distanciaKm && (
                      <span className="text-xs font-normal text-gray-400 dark:text-slate-500 ml-1.5">· {editandoViaje.ruta.distanciaKm} km</span>
                    )}
                  </p>
                  <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">
                    {editandoViaje.vehiculo ? `${editandoViaje.vehiculo.placa} · ${editandoViaje.vehiculo.tipo}` : '—'}
                    {editandoViaje.conductorNombre && editandoViaje.conductorNombre !== '—'
                      ? ` · ${editandoViaje.conductorNombre}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {(editandoViaje.asientosOcupados ?? 0) > 0 && (
                    <span className="flex items-center gap-1 text-[11px] bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-1 rounded-lg border border-blue-100 dark:border-blue-900/50">
                      <Users size={10} /> {editandoViaje.asientosOcupados} vendido{(editandoViaje.asientosOcupados ?? 0) !== 1 ? 's' : ''}
                    </span>
                  )}
                  <Badge estado={editandoViaje.estado} />
                </div>
              </div>
            </div>

            {/* ── Cuerpo ── */}
            <div className="px-5 py-5 space-y-5 flex-1 overflow-y-auto">

              {/* Sección Tripulación */}
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/40 border border-violet-200 dark:border-violet-800/60 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-violet-700 dark:text-violet-400">1</span>
                  </div>
                  <span className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest">Tripulación</span>
                  <div className="flex-1 h-px bg-gray-100 dark:bg-[#1e293b]" />
                </div>

                {/* Conductor */}
                <div>
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                    <UserCheck size={11} className="text-violet-500" /> Conductor *
                  </label>
                  <select value={editForm.conductorId}
                    onChange={e => setEditForm(f => ({ ...f, conductorId: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-[#293548] bg-white dark:bg-[#1e293b] rounded-xl text-sm text-gray-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 transition-colors cursor-pointer hover:border-gray-300 dark:hover:border-[#334155]">
                    <option value="">— Selecciona conductor —</option>
                    {conductores.map(c => (
                      <option key={c.id} value={c.id}>{c.nombres} {c.apellidos} — {c.licencia}</option>
                    ))}
                  </select>
                </div>

                {/* Vehículo */}
                {(editandoViaje.asientosOcupados ?? 0) === 0 ? (
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                      <Bus size={11} className="text-amber-500" /> Vehículo
                      <span className="text-gray-300 dark:text-slate-600 font-normal normal-case tracking-normal">(opcional)</span>
                    </label>
                    <select value={editForm.vehiculoId}
                      onChange={e => setEditForm(f => ({ ...f, vehiculoId: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-200 dark:border-[#293548] bg-white dark:bg-[#1e293b] rounded-xl text-sm text-gray-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 transition-colors cursor-pointer hover:border-gray-300 dark:hover:border-[#334155]">
                      <option value="">Sin cambio (mantener actual)</option>
                      {vehiculos.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.tipo}</option>)}
                    </select>
                  </div>
                ) : (
                  <div className="flex items-start gap-2.5 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl">
                    <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-amber-800 dark:text-amber-400">Vehículo bloqueado</p>
                      <p className="text-[11px] text-amber-700 dark:text-amber-500 mt-0.5">
                        No se puede cambiar: hay {editandoViaje.asientosOcupados} pasaje{(editandoViaje.asientosOcupados ?? 0) !== 1 ? 's' : ''} vendido{(editandoViaje.asientosOcupados ?? 0) !== 1 ? 's' : ''} en este viaje.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Sección Horario */}
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800/60 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400">2</span>
                  </div>
                  <span className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest">Horario</span>
                  <div className="flex-1 h-px bg-gray-100 dark:bg-[#1e293b]" />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                    <Calendar size={11} className="text-blue-500" /> Fecha y hora de salida *
                  </label>
                  <input type="datetime-local" value={editForm.fechaHoraSal}
                    onChange={e => setEditForm(f => ({ ...f, fechaHoraSal: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-[#293548] bg-white dark:bg-[#1e293b] rounded-xl text-sm text-gray-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 transition-colors hover:border-gray-300 dark:hover:border-[#334155]" />
                </div>
              </div>

              {/* Sección Notas */}
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-[#293548] border border-gray-200 dark:border-[#334155] flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400">3</span>
                  </div>
                  <span className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest">Notas</span>
                  <span className="text-[10px] text-gray-300 dark:text-slate-600 font-medium">(opcional)</span>
                  <div className="flex-1 h-px bg-gray-100 dark:bg-[#1e293b]" />
                </div>
                <textarea value={editForm.observaciones}
                  onChange={e => setEditForm(f => ({ ...f, observaciones: e.target.value }))}
                  rows={2} placeholder="Condiciones especiales, cambios de ruta, notas…"
                  className="w-full px-4 py-3 border border-gray-200 dark:border-[#293548] bg-white dark:bg-[#1e293b] rounded-xl text-sm text-gray-800 dark:text-slate-200 placeholder-gray-300 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 resize-none transition-colors hover:border-gray-300 dark:hover:border-[#334155]" />
              </div>

            </div>

            {/* ── Footer ── */}
            <div className="shrink-0 border-t border-gray-100 dark:border-[#1e293b]">
              <div className="flex justify-between items-center px-5 py-4 bg-gray-50/60 dark:bg-[#0a1628]/40">
                <p className="text-xs text-gray-400 dark:text-slate-500">
                  {!editForm.conductorId || !editForm.fechaHoraSal
                    ? <span>Conductor y horario son obligatorios</span>
                    : <span className="text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1.5"><CheckCircle size={13} /> Listo para guardar</span>
                  }
                </p>
                <div className="flex gap-2.5">
                  <button onClick={() => { setModalEditar(false); setEditandoViaje(null) }}
                    className="px-4 py-2.5 text-sm text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-[#334155] rounded-xl hover:bg-gray-100 dark:hover:bg-[#1e293b] transition-colors cursor-pointer">
                    Cancelar
                  </button>
                  <button onClick={editarViaje}
                    disabled={guardandoEdit || !editForm.conductorId || !editForm.fechaHoraSal}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm hover:shadow-blue-900/40 hover:shadow-md">
                    {guardandoEdit
                      ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Guardando…</>
                      : <><CheckCircle size={14} /> Guardar cambios</>}
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
