'use client'
import React, { useState } from 'react'
import useSWR from 'swr'
import {
  FileSpreadsheet, TrendingUp, Users, Package,
  Wallet, AlertTriangle, Clock, Activity, Bus,
  Download, BarChart2, ChevronRight, DollarSign,
  Ticket,
} from 'lucide-react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, AreaChart, Area,
} from 'recharts'
import api from '@/services/api'
import toast from 'react-hot-toast'

type TabType     = 'ventas' | 'encomiendas' | 'caja'
type PeriodoType = '7' | '14' | '30'

interface KpisGerente {
  pasajesHoy: number; ingresosHoy: number; encomiendaActivas: number
  cajasAbiertas: number; auditoriaHoy: number; viajesActivosHoy: number
  diferenciasHoy: number; fechaHora: string
}
interface TendenciaDia { fecha: string; pasajes: number; encomiendas: number; ingresos: number }
interface VentaHora    { hora: string; pasajes: number; ingresos: number }
interface ViajesDia    { viajeId: number; estado: string; hora: string; origen: string; destino: string; placa: string; tipo: string; totalAsientos: number; pasajerosVendidos: number }
interface EncPendiente { id: number; codigoTracking: string; estado: string; descripcion: string; horas: number; remitente: string; destinatario: string }
interface CajaItem     { id: number; fechaApertura: string; fechaCierre: string | null; estado: string; operadorNombre: string }

function fmtMoney(n: number) {
  return `S/ ${Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, accent, alert }: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; accent: string; alert?: boolean
}) {
  return (
    <div className={`bg-white rounded-2xl border p-4 flex gap-3 items-start ${alert ? 'border-red-200' : 'border-gray-100'} shadow-sm`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>
        <Icon size={16} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide leading-tight">{label}</p>
        <p className={`text-xl font-bold tabular-nums leading-tight mt-0.5 ${alert ? 'text-red-600' : 'text-gray-900'}`}>{value}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Resumen stat ──────────────────────────────────────────────────────────────
function StatChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className={`rounded-xl p-3 text-center border ${color}`}>
      <p className="text-[11px] font-medium opacity-70 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-black tabular-nums mt-0.5">{value}</p>
    </div>
  )
}

// ── Tooltip custom ────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-lg text-xs">
      <p className="font-semibold text-gray-700 mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-gray-500">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-bold text-gray-900">
            {p.dataKey === 'ingresos' ? fmtMoney(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Estado badges ─────────────────────────────────────────────────────────────
const ESTADO_VIAJE: Record<string, string> = {
  PROGRAMADO: 'bg-blue-100 text-blue-700',
  EN_RUTA:    'bg-emerald-100 text-emerald-700',
  COMPLETADO: 'bg-gray-100 text-gray-500',
  CANCELADO:  'bg-red-100 text-red-600',
}

const ENC_ESTADO: Record<string, string> = {
  EN_TRANSITO:     'bg-purple-100 text-purple-700',
  LLEGADO_AGENCIA: 'bg-cyan-100 text-cyan-700',
  DISPONIBLE:      'bg-teal-100 text-teal-700',
  REGISTRADO:      'bg-blue-100 text-blue-700',
  ALMACENADO:      'bg-amber-100 text-amber-700',
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReportesPage() {
  const [tab, setTab]               = useState<TabType>('ventas')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [loading, setLoading]       = useState(false)
  const [periodo, setPeriodo]       = useState<PeriodoType>('7')
  const [cajaId, setCajaId]         = useState<string>('')

  const { data: kpis }        = useSWR<KpisGerente>('/api/reportes/kpis', { refreshInterval: 60_000 })
  const { data: tendenciaRaw }= useSWR<TendenciaDia[]>(`/api/reportes/tendencia?dias=${periodo}`)
  const { data: horaRaw }     = useSWR<VentaHora[]>('/api/reportes/ventas-hora', { refreshInterval: 120_000 })
  const { data: viajesRaw }   = useSWR<ViajesDia[]>('/api/reportes/viajes-dia', { refreshInterval: 60_000 })
  const { data: encPendRaw }  = useSWR<EncPendiente[]>('/api/reportes/encomiendas-pendientes')
  const { data: cajasRaw }    = useSWR<CajaItem[]>('/api/caja/historial')

  const tendencia  = tendenciaRaw ?? []
  const ventasHora = horaRaw ?? []
  const viajes     = viajesRaw ?? []
  const encPend    = encPendRaw ?? []
  const cajas      = cajasRaw ?? []

  const totalPasajes     = tendencia.reduce((s, d) => s + d.pasajes, 0)
  const totalEncomiendas = tendencia.reduce((s, d) => s + d.encomiendas, 0)
  const totalIngresos    = tendencia.reduce((s, d) => s + d.ingresos, 0)

  const descargar = async () => {
    if (tab === 'caja' && !cajaId) { toast.error('Selecciona un turno de caja'); return }
    if (tab === 'ventas' && (!fechaDesde || !fechaHasta)) { toast.error('Selecciona el rango de fechas'); return }
    setLoading(true)
    try {
      const url = tab === 'ventas'
        ? `/api/reportes/ventas/excel?desde=${fechaDesde}T00:00:00&hasta=${fechaHasta}T23:59:59`
        : tab === 'encomiendas'
          ? fechaDesde && fechaHasta
            ? `/api/reportes/encomiendas/excel?desde=${fechaDesde}T00:00:00&hasta=${fechaHasta}T23:59:59`
            : `/api/reportes/encomiendas/excel`
          : `/api/reportes/caja/excel?cajaId=${cajaId}`
      const blob = await api.get(url, { responseType: 'blob' }) as unknown as Blob
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `reporte-${tab}${fechaDesde ? '-' + fechaDesde : ''}.xlsx`
      a.click()
      URL.revokeObjectURL(a.href)
      toast.success('Reporte descargado')
    } catch {
      toast.error('Error al generar reporte')
    } finally {
      setLoading(false)
    }
  }

  const periodos: { key: PeriodoType; label: string }[] = [
    { key: '7',  label: '7 días' },
    { key: '14', label: '14 días' },
    { key: '30', label: '30 días' },
  ]

  const exportTabs: { key: TabType; label: string; icon: React.ElementType; desc: string }[] = [
    { key: 'ventas',      label: 'Ventas',      icon: Ticket,         desc: 'Pasajes emitidos con detalle de ruta y cobro' },
    { key: 'encomiendas', label: 'Encomiendas', icon: Package,        desc: 'Registro de envíos y estado de entrega' },
    { key: 'caja',        label: 'Caja',        icon: Wallet,         desc: 'Movimientos de un turno de caja específico' },
  ]

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#064e3b] flex items-center justify-center shrink-0">
          <BarChart2 size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reportes</h1>
          <p className="text-xs text-gray-500">Indicadores en tiempo real y exportación de datos</p>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Viajes hoy"       value={kpis?.viajesActivosHoy ?? '—'}
          sub="activos"         icon={Bus}           accent="bg-[#064e3b]" />
        <KpiCard label="Pasajes hoy"      value={kpis?.pasajesHoy ?? '—'}
          sub="emitidos"        icon={Ticket}        accent="bg-blue-500" />
        <KpiCard label="Ingresos hoy"     value={kpis ? fmtMoney(Number(kpis.ingresosHoy)) : '—'}
          sub="en caja"         icon={Wallet}        accent="bg-emerald-600" />
        <KpiCard label="Enc. en tránsito" value={kpis?.encomiendaActivas ?? '—'}
          sub="activas"         icon={Package}       accent="bg-violet-600" />
        <KpiCard label="Cajas abiertas"   value={kpis?.cajasAbiertas ?? '—'}
          sub="turnos en curso" icon={Activity}      accent="bg-amber-500" />
        <KpiCard
          label="Descuadres hoy"
          value={kpis?.diferenciasHoy ?? '—'}
          sub="cierres con dif."
          icon={AlertTriangle}
          accent={(kpis?.diferenciasHoy ?? 0) > 0 ? 'bg-red-500' : 'bg-gray-400'}
          alert={(kpis?.diferenciasHoy ?? 0) > 0}
        />
      </div>

      {/* ── Tendencia operativa ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-[#064e3b]" />
            <h2 className="text-sm font-semibold text-gray-900">Tendencia operativa</h2>
          </div>
          <div className="flex items-center gap-1 p-0.5 bg-gray-100 rounded-xl">
            {periodos.map(p => (
              <button key={p.key} onClick={() => setPeriodo(p.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  periodo === p.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chips de resumen */}
        <div className="grid grid-cols-3 gap-3">
          <StatChip label="Pasajes"    value={String(totalPasajes)}           color="bg-blue-50 border-blue-100 text-blue-700" />
          <StatChip label="Encomiendas" value={String(totalEncomiendas)}       color="bg-violet-50 border-violet-100 text-violet-700" />
          <StatChip label="Ingresos"   value={`S/ ${totalIngresos.toFixed(0)}`} color="bg-emerald-50 border-emerald-100 text-emerald-700" />
        </div>

        {tendencia.length > 0 ? (
          <>
            {/* Gráfico principal: pasajes + encomiendas como barras, ingresos como línea */}
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Pasajes, encomiendas e ingresos diarios</p>
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={tendencia} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left"  tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={28} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#9ca3af' }}
                    axisLine={false} tickLine={false} width={50} tickFormatter={v => `S/${v}`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar yAxisId="left"  dataKey="pasajes"     name="Pasajes"     fill="#064e3b" radius={[4,4,0,0]} barSize={14} />
                  <Bar yAxisId="left"  dataKey="encomiendas" name="Encomiendas" fill="#7c3aed" radius={[4,4,0,0]} barSize={14} />
                  <Line yAxisId="right" type="monotone" dataKey="ingresos" name="Ingresos"
                    stroke="#059669" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <div className="py-10 text-center">
            <BarChart2 size={28} className="mx-auto mb-2 text-gray-200" />
            <p className="text-sm text-gray-400">Sin datos para este período</p>
          </div>
        )}
      </div>

      {/* ── Ventas por hora + Viajes del día ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Ventas por hora */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-[#064e3b]" />
            <h2 className="text-sm font-semibold text-gray-900">Ventas por hora — hoy</h2>
          </div>
          {ventasHora.some(h => h.pasajes > 0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={ventasHora} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="hora" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval={2} />
                <YAxis yAxisId="left"  tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={25} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#9ca3af' }}
                  axisLine={false} tickLine={false} width={45} tickFormatter={v => `S/${v}`} />
                <Tooltip content={<ChartTooltip />} />
                <Bar yAxisId="left"  dataKey="pasajes"  name="Pasajes"  fill="#064e3b" radius={[4,4,0,0]} barSize={12} />
                <Line yAxisId="right" type="monotone" dataKey="ingresos" name="Ingresos"
                  stroke="#0891b2" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex flex-col items-center justify-center gap-2 text-gray-400">
              <Clock size={24} className="text-gray-200" />
              <p className="text-sm">Sin ventas registradas hoy</p>
            </div>
          )}
        </div>

        {/* Viajes del día */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bus size={14} className="text-[#064e3b]" />
              <h2 className="text-sm font-semibold text-gray-900">Viajes del día</h2>
            </div>
            {viajes.length > 0 && (
              <span className="text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full tabular-nums">
                {viajes.length}
              </span>
            )}
          </div>
          {viajes.length === 0 ? (
            <div className="h-[200px] flex flex-col items-center justify-center gap-2 text-gray-400">
              <Bus size={24} className="text-gray-200" />
              <p className="text-sm">Sin viajes programados hoy</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-0.5">
              {viajes.map(v => {
                const pct = v.totalAsientos > 0
                  ? Math.round((v.pasajerosVendidos / v.totalAsientos) * 100) : 0
                const barColor = pct >= 90 ? 'bg-red-400' : pct >= 70 ? 'bg-amber-400' : 'bg-emerald-400'
                return (
                  <div key={v.viajeId} className="rounded-xl border border-gray-100 px-3 py-2.5 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold text-gray-700 tabular-nums shrink-0">{v.hora}</span>
                        <span className="text-xs text-gray-600 truncate">{v.origen}
                          <ChevronRight size={10} className="inline mx-0.5 text-gray-300" />
                          {v.destino}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] text-gray-400 font-mono">{v.placa}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${ESTADO_VIAJE[v.estado] ?? 'bg-gray-100 text-gray-600'}`}>
                          {v.estado === 'PROGRAMADO' ? 'Prog.' : v.estado === 'EN_RUTA' ? 'En ruta' : v.estado}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div className={`${barColor} h-full rounded-full transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                      <span className="text-[10px] text-gray-400 shrink-0 tabular-nums">
                        {v.pasajerosVendidos}/{v.totalAsientos}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Encomiendas pendientes >24h ── */}
      {encPend.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-200 overflow-hidden">
          <div className="px-5 py-3.5 bg-amber-50/60 border-b border-amber-100 flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-500" />
            <h2 className="text-sm font-semibold text-gray-900">
              Encomiendas sin movimiento +24h
            </h2>
            <span className="ml-1 text-[11px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
              {encPend.length} alerta{encPend.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Tracking', 'Descripción', 'Estado', 'Remitente', 'Destinatario', 'Sin cambio'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {encPend.map(e => (
                  <tr key={e.id} className="hover:bg-amber-50/40 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-[#064e3b]">{e.codigoTracking}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs max-w-[160px] truncate">{e.descripcion}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${ENC_ESTADO[e.estado] ?? 'bg-gray-100 text-gray-600'}`}>
                        {e.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{e.remitente}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{e.destinatario}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-xs font-bold tabular-nums ${e.horas > 72 ? 'text-red-600' : 'text-amber-600'}`}>
                        {e.horas}h
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Exportar ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
        <div className="flex items-center gap-2">
          <Download size={14} className="text-[#064e3b]" />
          <h2 className="text-sm font-semibold text-gray-900">Exportar reportes</h2>
        </div>

        {/* Selector de tipo */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {exportTabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
                tab === t.key
                  ? 'border-[#064e3b] bg-emerald-50/50 ring-1 ring-[#064e3b]/10'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                tab === t.key ? 'bg-[#064e3b]' : 'bg-gray-100'
              }`}>
                <t.icon size={16} className={tab === t.key ? 'text-white' : 'text-gray-500'} />
              </div>
              <div>
                <p className={`text-sm font-semibold ${tab === t.key ? 'text-[#064e3b]' : 'text-gray-800'}`}>{t.label}</p>
                <p className="text-[11px] text-gray-400 leading-tight mt-0.5">{t.desc}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Controles según tab */}
        <div className="pt-1 border-t border-gray-100">
          {(tab === 'ventas' || tab === 'encomiendas') && (
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  Desde {tab === 'encomiendas' && <span className="font-normal text-gray-400">(opcional)</span>}
                </label>
                <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)}
                  className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#064e3b]/30 focus:border-[#064e3b] focus:outline-none transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  Hasta {tab === 'encomiendas' && <span className="font-normal text-gray-400">(opcional)</span>}
                </label>
                <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)}
                  className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#064e3b]/30 focus:border-[#064e3b] focus:outline-none transition-colors" />
              </div>
              <button onClick={descargar} disabled={loading}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#064e3b] text-white text-sm rounded-xl hover:bg-[#065f46] disabled:opacity-50 font-semibold transition-colors">
                {loading
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <FileSpreadsheet size={14} />}
                Descargar Excel
              </button>
            </div>
          )}

          {tab === 'caja' && (
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Turno de caja</label>
                <select value={cajaId} onChange={e => setCajaId(e.target.value)}
                  className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white min-w-[280px] focus:ring-2 focus:ring-[#064e3b]/30 focus:border-[#064e3b] focus:outline-none transition-colors">
                  <option value="">— Selecciona un turno —</option>
                  {cajas.map(c => {
                    const fecha = new Date(c.fechaApertura).toLocaleDateString('es-PE', {
                      day: '2-digit', month: '2-digit', year: 'numeric'
                    })
                    return (
                      <option key={c.id} value={c.id}>
                        {fecha} — {c.operadorNombre} ({c.estado})
                      </option>
                    )
                  })}
                </select>
              </div>
              <button onClick={descargar} disabled={loading || !cajaId}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#064e3b] text-white text-sm rounded-xl hover:bg-[#065f46] disabled:opacity-50 font-semibold transition-colors">
                {loading
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <FileSpreadsheet size={14} />}
                Descargar Excel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
