'use client'
import React, { useState, useEffect, useCallback } from 'react'
import useSWR from 'swr'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, BarChart, Cell, Legend,
} from 'recharts'
import {
  Ticket, Package, DollarSign, ShieldCheck, AlertTriangle,
  TrendingUp, TrendingDown, Activity, FileText, Download, Bus, Clock,
  ChevronRight, RefreshCw, Building2, ArrowUpRight, ArrowDownRight,
  Minus, MapPin, Users, Wallet, BarChart2, CheckCircle2,
} from 'lucide-react'
import Link from 'next/link'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/stores/authStore'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

// ── Types ──────────────────────────────────────────────────────────────────────
interface KPIs {
  pasajesHoy: number; ingresosHoy: number; encomiendaActivas: number
  cajasAbiertas: number; auditoriaHoy: number; viajesActivosHoy: number
  diferenciasHoy: number; fechaHora: string
}
interface Comparativa {
  pasajesHoy: number; pasajesAyer: number; pasajesDelta: number
  ingresosHoy: number; ingresosAyer: number; ingresosDelta: number
  encomiendasHoy: number; encomiendasAyer: number
}
interface ViajeDelDia {
  viajeId: number; estado: string; hora: string
  origen: string; destino: string; placa: string; tipo: string
  totalAsientos: number; pasajerosVendidos: number
}
interface EncomiendaPendiente {
  id: number; codigoTracking: string; estado: string
  descripcion: string; horas: number; remitente: string; destinatario: string
  esFragil?: boolean; criticidad?: 'NORMAL' | 'ALTA' | 'CRITICA'
  deViajeCancelado?: boolean; agenciaOrigen?: string; agenciaDestino?: string
}
interface ConductorActivo {
  viajeId: number; estado: string; fechaHoraSal: string
  origen: string; destino: string; placa: string; tipoVehiculo: string
  conductorNombre: string; licencia: string
  asientosOcupados: number; capacidad: number; ocupacionPct: number
}
interface EstadoOperador {
  usuarioId: number; nombre: string; tieneCaja: boolean
  cajaId?: number; fechaApertura?: string; saldoActual?: number
}
interface TopRuta {
  ruta: string; origen: string; destino: string; pasajes: number; ingresos: number
}
type Periodo = 'HOY' | 'SEMANA' | 'MES'

// ── Helpers ────────────────────────────────────────────────────────────────────
const ESTADO_VIAJE: Record<string, { label: string; cls: string }> = {
  PROGRAMADO: { label: 'Programado', cls: 'bg-blue-100 text-blue-700' },
  EN_RUTA:    { label: 'En ruta',    cls: 'bg-emerald-100 text-emerald-700' },
  COMPLETADO: { label: 'Completado', cls: 'bg-gray-100 text-gray-500' },
  CANCELADO:  { label: 'Cancelado',  cls: 'bg-red-100 text-red-700' },
}

const ESTADO_ENC: Record<string, string> = {
  REGISTRADO: 'bg-blue-50 text-blue-700',  RECEPCIONADO: 'bg-indigo-50 text-indigo-700',
  ALMACENADO: 'bg-yellow-50 text-yellow-700', CARGADO: 'bg-orange-50 text-orange-700',
  EN_TRANSITO: 'bg-purple-50 text-purple-700', LLEGADO_AGENCIA: 'bg-cyan-50 text-cyan-700',
  DISPONIBLE: 'bg-teal-50 text-teal-700',
}

const RUTA_COLORS = ['#064e3b', '#0f766e', '#0891b2', '#1d4ed8', '#7c3aed']

function fmtMoney(n: number) {
  return `S/ ${Number(n ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ── Delta badge ────────────────────────────────────────────────────────────────
function DeltaBadge({ delta, inverse = false }: { delta: number; inverse?: boolean }) {
  if (delta === 0) return (
    <span className="flex items-center gap-0.5 text-[10px] text-gray-400 font-medium">
      <Minus size={9} /> igual
    </span>
  )
  const positive = inverse ? delta < 0 : delta > 0
  return (
    <span className={`flex items-center gap-0.5 text-[10px] font-semibold ${positive ? 'text-emerald-600' : 'text-red-500'}`}>
      {delta > 0
        ? <ArrowUpRight size={10} />
        : <ArrowDownRight size={10} />}
      {Math.abs(delta)}%
    </span>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KPICard({ label, value, sub, icon: Icon, accent, delta, inverseAlert }: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; accent: string
  delta?: number; inverseAlert?: boolean
}) {
  const isAlert = inverseAlert && typeof value === 'number' && value > 0
  return (
    <div className={`bg-white rounded-2xl border p-4 flex flex-col gap-2.5 ${
      isAlert ? 'border-red-200 ring-1 ring-red-100' : 'border-gray-100'
    } shadow-sm`}>
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${accent}`}>
        <Icon size={15} className="text-white" />
      </div>
      <div>
        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide leading-tight">{label}</p>
        <div className="flex items-end justify-between mt-0.5">
          <p className={`text-2xl font-bold tabular-nums ${isAlert ? 'text-red-600' : 'text-gray-900'}`}>{value}</p>
          {delta !== undefined && <DeltaBadge delta={delta} inverse={inverseAlert} />}
        </div>
        {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Alert banner ──────────────────────────────────────────────────────────────
function AlertBanner({ diferencias, pendientes }: { diferencias: number; pendientes: number }) {
  if (diferencias === 0 && pendientes === 0) return null
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
      <AlertTriangle size={16} className="text-amber-500 shrink-0" />
      <div className="flex flex-wrap gap-3 flex-1">
        {diferencias > 0 && (
          <span className="font-medium">
            {diferencias} caja{diferencias > 1 ? 's' : ''} cerrada{diferencias > 1 ? 's' : ''} con diferencia de efectivo
          </span>
        )}
        {pendientes > 0 && (
          <span className="font-medium">
            {pendientes} encomienda{pendientes > 1 ? 's' : ''} sin movimiento en más de 24 h
          </span>
        )}
      </div>
      <Link href="/caja" className="text-xs font-semibold text-amber-700 hover:underline whitespace-nowrap">
        Revisar →
      </Link>
    </div>
  )
}

// ── Ocupación bar ─────────────────────────────────────────────────────────────
function OcupacionBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-400' : pct >= 30 ? 'bg-blue-400' : 'bg-gray-300'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="text-[10px] text-gray-500 tabular-nums w-6">{pct}%</span>
    </div>
  )
}

// ── Tooltip del gráfico ───────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-lg text-xs">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
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

// ── Main page ─────────────────────────────────────────────────────────────────
export default function GerentePage() {
  const { user } = useAuthStore()
  const [agenciaFiltro, setAgenciaFiltro] = useState<number | null>(null)
  const [periodo, setPeriodo] = useState<Periodo>('HOY')
  const [topDias, setTopDias] = useState(7)
  const [descargandoManif, setDescargandoManif] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [sinceRefresh, setSinceRefresh] = useState('ahora')

  useEffect(() => { setMounted(true) }, [])

  // Reloj de última actualización
  useEffect(() => {
    const id = setInterval(() => {
      const diff = Math.floor((Date.now() - lastRefresh.getTime()) / 1000)
      if (diff < 60) setSinceRefresh(`hace ${diff}s`)
      else setSinceRefresh(`hace ${Math.floor(diff / 60)}min`)
    }, 5000)
    return () => clearInterval(id)
  }, [lastRefresh])

  const puedeVerAgencias = mounted && (user?.rol === 'SUPER_ADMIN' || user?.rol === 'GERENTE')

  const ag = useCallback((base: string) =>
    agenciaFiltro ? `${base}${base.includes('?') ? '&' : '?'}agenciaId=${agenciaFiltro}` : base,
  [agenciaFiltro])

  // ── SWR ──────────────────────────────────────────────────────────────────────
  const { data: agenciasData } = useSWR(puedeVerAgencias ? '/api/agencias' : null)
  const agencias: { id: number; nombre: string; ciudad: string }[] = (agenciasData as any) ?? []

  const { data: kpis, mutate: mutateKpis } =
    useSWR<KPIs>(ag('/api/reportes/kpis'), { refreshInterval: 60_000 })

  const { data: comparativa } =
    useSWR<Comparativa>(ag('/api/reportes/comparativa'), { refreshInterval: 120_000 })

  const { data: ventasHoraRaw } = useSWR(
    periodo === 'HOY' ? ag('/api/reportes/ventas-hora') : null,
    { refreshInterval: 120_000 }
  )
  const { data: tendenciaRaw } = useSWR(
    periodo !== 'HOY' ? ag(`/api/reportes/tendencia?dias=${periodo === 'SEMANA' ? 7 : 30}`) : null,
    { refreshInterval: 300_000 }
  )

  const { data: viajesDiaRaw } = useSWR(ag('/api/reportes/viajes-dia'), { refreshInterval: 60_000 })
  const viajesDia: ViajeDelDia[] = (viajesDiaRaw as any) ?? []

  const { data: encPendRaw } = useSWR(ag('/api/reportes/encomiendas-pendientes'), { refreshInterval: 300_000 })
  const encPendientes: EncomiendaPendiente[] = (encPendRaw as any) ?? []

  const { data: auditoriaData } = useSWR('/api/auditoria/resumen', { refreshInterval: 60_000 })
  const auditoria = auditoriaData as any

  const { data: topRutasRaw } = useSWR(ag(`/api/reportes/top-rutas?dias=${topDias}`), { refreshInterval: 300_000 })
  const topRutas: TopRuta[] = (topRutasRaw as any) ?? []

  const { data: conductoresRaw } = useSWR(ag('/api/reportes/conductores-activos'), { refreshInterval: 60_000 })
  const conductoresActivos: ConductorActivo[] = (conductoresRaw as any) ?? []

  const { data: operadoresRaw } = useSWR(
    agenciaFiltro ? `/api/caja/estado-operadores` : null,
    { refreshInterval: 120_000 }
  )
  const estadoOperadores: EstadoOperador[] = (operadoresRaw as any) ?? []

  // ── Chart data ────────────────────────────────────────────────────────────────
  const chartData = periodo === 'HOY'
    ? ((ventasHoraRaw as any) ?? []).map((d: any) => ({
        label: d.hora, pasajes: Number(d.pasajes), ingresos: Number(d.ingresos),
      }))
    : ((tendenciaRaw as any) ?? []).map((d: any) => ({
        label: d.fecha, pasajes: Number(d.pasajes), ingresos: Number(d.ingresos),
      }))

  const maxTopRutas = topRutas.length > 0 ? Math.max(...topRutas.map(r => r.pasajes)) : 1

  // ── Refresh manual ────────────────────────────────────────────────────────────
  const handleRefresh = () => {
    mutateKpis()
    setLastRefresh(new Date())
    setSinceRefresh('ahora')
    toast.success('Dashboard actualizado')
  }

  // ── Exports ───────────────────────────────────────────────────────────────────
  const descargarExcel = async (tipo: string) => {
    const hoy = new Date().toISOString().split('T')[0]
    const extra = agenciaFiltro ? `&agenciaId=${agenciaFiltro}` : ''
    try {
      const blob = await api.get(
        `/api/reportes/${tipo}/excel?desde=${hoy}T00:00:00&hasta=${hoy}T23:59:59${extra}`,
        { responseType: 'blob' }
      ) as unknown as Blob
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob); a.download = `${tipo}-${hoy}.xlsx`; a.click()
      URL.revokeObjectURL(a.href)
      toast.success('Reporte descargado')
    } catch { toast.error('Error al generar reporte') }
  }

  const descargarManifiestosDia = async () => {
    const activos = viajesDia.filter(v => v.estado === 'EN_RUTA' || v.estado === 'COMPLETADO')
    if (activos.length === 0) { toast('Sin manifiestos disponibles hoy'); return }
    setDescargandoManif(true)
    try {
      for (const v of activos) {
        const blob = await api.get(`/api/manifiestos/${v.viajeId}/pdf`, { responseType: 'blob' }) as unknown as Blob
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `manifiesto-${v.origen}-${v.destino}-${v.hora.replace(':', '')}.pdf`
        a.click(); URL.revokeObjectURL(a.href)
      }
      toast.success(`${activos.length} manifiesto(s) descargado(s)`)
    } catch { toast.error('Error al descargar manifiestos') }
    finally { setDescargandoManif(false) }
  }

  const agenciaActual = agencias.find(a => a.id === agenciaFiltro)

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#064e3b] flex items-center justify-center">
            <BarChart2 size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Dashboard Gerencial</h1>
            <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
              <span>Métricas en tiempo real</span>
              <span className="text-gray-300">·</span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                Actualizado {sinceRefresh}
              </span>
              {agenciaActual && (
                <>
                  <span className="text-gray-300">·</span>
                  <span className="flex items-center gap-1 text-[#064e3b] font-medium">
                    <Building2 size={11} /> {agenciaActual.nombre}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {puedeVerAgencias && agencias.length > 0 && (
            <div className="flex items-center gap-1.5 border border-gray-200 rounded-xl px-3 py-2 bg-white text-sm">
              <Building2 size={13} className="text-gray-400 shrink-0" />
              <select
                value={agenciaFiltro ?? ''}
                onChange={e => setAgenciaFiltro(e.target.value ? Number(e.target.value) : null)}
                className="text-xs text-gray-700 bg-transparent focus:outline-none"
              >
                <option value="">Todas las agencias</option>
                {agencias.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </div>
          )}
          <button onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-xs text-gray-600 hover:bg-gray-50 transition-colors">
            <RefreshCw size={13} /> Actualizar
          </button>
          <button onClick={() => descargarExcel('ventas')}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-xs text-gray-600 hover:bg-gray-50 transition-colors">
            <Download size={13} /> Excel ventas
          </button>
          <Link href="/auditoria"
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-xs text-gray-600 hover:bg-gray-50 transition-colors">
            <ShieldCheck size={13} /> Auditoría
          </Link>
        </div>
      </div>

      {/* ── Alert banner ── */}
      <AlertBanner
        diferencias={kpis?.diferenciasHoy ?? 0}
        pendientes={encPendientes.length}
      />

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
        <KPICard
          label="Pasajes hoy"
          value={kpis?.pasajesHoy ?? '—'}
          sub={comparativa ? `ayer: ${comparativa.pasajesAyer}` : 'emitidos'}
          icon={Ticket} accent="bg-blue-500"
          delta={comparativa?.pasajesDelta}
        />
        <KPICard
          label="Ingresos hoy"
          value={kpis ? fmtMoney(kpis.ingresosHoy) : '—'}
          sub={comparativa ? `ayer: ${fmtMoney(comparativa.ingresosAyer)}` : 'en caja'}
          icon={Wallet} accent="bg-emerald-600"
          delta={comparativa?.ingresosDelta}
        />
        <KPICard
          label="Encomiendas activas"
          value={kpis?.encomiendaActivas ?? '—'}
          sub={comparativa ? `registradas hoy: ${comparativa.encomiendasHoy}` : 'en tránsito'}
          icon={Package} accent="bg-teal-600"
        />
        <KPICard
          label="Cajas abiertas"
          value={kpis?.cajasAbiertas ?? '—'}
          sub="turnos en curso"
          icon={DollarSign} accent="bg-indigo-500"
        />
        <KPICard
          label="Eventos hoy"
          value={kpis?.auditoriaHoy ?? '—'}
          sub="acciones registradas"
          icon={Activity} accent="bg-amber-500"
        />
        <KPICard
          label="Viajes activos"
          value={kpis?.viajesActivosHoy ?? '—'}
          sub="programados + en ruta"
          icon={Bus} accent="bg-violet-500"
        />
        <KPICard
          label="Descuadres de caja"
          value={kpis?.diferenciasHoy ?? '—'}
          sub="cierres con diferencia"
          icon={AlertTriangle}
          accent={kpis !== undefined && kpis.diferenciasHoy > 0 ? 'bg-red-500' : 'bg-gray-400'}
          inverseAlert
        />
      </div>

      {/* ── Grid principal ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Columna 2/3 */}
        <div className="lg:col-span-2 space-y-4">

          {/* Gráfico ventas */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">
                  {periodo === 'HOY' ? 'Ventas por hora — hoy'
                    : periodo === 'SEMANA' ? 'Tendencia últimos 7 días'
                    : 'Tendencia últimos 30 días'}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">Pasajes emitidos e ingresos acumulados</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs">
                  {(['HOY', 'SEMANA', 'MES'] as Periodo[]).map(p => (
                    <button key={p} onClick={() => setPeriodo(p)}
                      className={`px-3 py-1.5 font-medium transition-colors ${
                        periodo === p ? 'bg-[#064e3b] text-white' : 'text-gray-500 hover:bg-gray-50'
                      }`}>
                      {p === 'HOY' ? 'Hoy' : p === 'SEMANA' ? '7 días' : '30 días'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Leyenda */}
            <div className="flex items-center gap-5 mb-3 text-xs text-gray-400">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-2 rounded-sm bg-[#064e3b]" /> Pasajes (izq.)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-5 h-0.5 bg-[#0891b2] rounded" style={{borderTop: '2px dashed #0891b2'}} />
                Ingresos S/ (der.)
              </span>
            </div>

            <ResponsiveContainer width="100%" height={210}>
              <ComposedChart data={chartData} barSize={periodo === 'HOY' ? 10 : 14}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={28} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#9ca3af' }}
                  axisLine={false} tickLine={false} width={50} tickFormatter={v => `S/${v}`} />
                <Tooltip content={<ChartTooltip />} />
                <Bar yAxisId="left" dataKey="pasajes" fill="#064e3b" radius={[4, 4, 0, 0]} name="Pasajes" />
                <Line yAxisId="right" type="monotone" dataKey="ingresos" stroke="#0891b2"
                  strokeWidth={2} dot={false} name="Ingresos" />
              </ComposedChart>
            </ResponsiveContainer>

            {chartData.length === 0 && (
              <p className="text-center text-xs text-gray-400 py-4">Sin datos para el período seleccionado</p>
            )}
          </div>

          {/* Viajes del día */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <Bus size={14} className="text-[#064e3b]" /> Viajes del día
              </h3>
              <span className="text-xs text-gray-400">
                {viajesDia.length} programado{viajesDia.length !== 1 ? 's' : ''}
                {viajesDia.filter(v => v.estado === 'EN_RUTA').length > 0 && (
                  <span className="ml-2 text-emerald-600 font-medium">
                    · {viajesDia.filter(v => v.estado === 'EN_RUTA').length} en ruta
                  </span>
                )}
              </span>
            </div>

            {viajesDia.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-xs text-gray-400">
                No hay viajes programados para hoy
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Ruta', 'Salida', 'Vehículo', 'Ocupación', 'Estado'].map(h => (
                        <th key={h} className="pb-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {viajesDia.map(v => {
                      const pct = v.totalAsientos > 0
                        ? Math.round((v.pasajerosVendidos / v.totalAsientos) * 100) : 0
                      const est = ESTADO_VIAJE[v.estado] ?? { label: v.estado, cls: 'bg-gray-100 text-gray-600' }
                      return (
                        <tr key={v.viajeId} className="hover:bg-gray-50/60 transition-colors">
                          <td className="py-2.5 font-medium text-gray-800 whitespace-nowrap">
                            <span className="flex items-center gap-1">
                              {v.origen}
                              <ChevronRight size={10} className="text-gray-300" />
                              {v.destino}
                            </span>
                          </td>
                          <td className="py-2.5 text-gray-500">
                            <span className="flex items-center gap-1">
                              <Clock size={10} className="text-gray-300" /> {v.hora}
                            </span>
                          </td>
                          <td className="py-2.5 text-gray-500">
                            <span className="font-mono">{v.placa}</span>
                            <span className="text-gray-300 ml-1">({v.tipo})</span>
                          </td>
                          <td className="py-2.5">
                            <div className="space-y-0.5">
                              <span className="text-gray-600 tabular-nums">
                                {v.pasajerosVendidos}/{v.totalAsientos}
                              </span>
                              <OcupacionBar pct={pct} />
                            </div>
                          </td>
                          <td className="py-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${est.cls}`}>
                              {est.label}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Columna 1/3 */}
        <div className="space-y-4">

          {/* Top rutas */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <MapPin size={13} className="text-[#064e3b]" /> Top rutas
              </h3>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-[10px]">
                {[{ v: 1, l: 'Hoy' }, { v: 7, l: '7d' }, { v: 30, l: '30d' }].map(({ v, l }) => (
                  <button key={v} onClick={() => setTopDias(v)}
                    className={`px-2 py-1 font-medium transition-colors ${
                      topDias === v ? 'bg-[#064e3b] text-white' : 'text-gray-400 hover:bg-gray-50'
                    }`}>{l}</button>
                ))}
              </div>
            </div>
            {topRutas.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">Sin datos de rutas</p>
            ) : (
              <div className="space-y-2.5">
                {topRutas.map((r, i) => (
                  <div key={r.ruta} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-700 font-medium truncate max-w-[160px]" title={r.ruta}>
                        {r.origen} › {r.destino}
                      </span>
                      <span className="text-gray-500 tabular-nums shrink-0 ml-1">{r.pasajes} pax</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${(r.pasajes / maxTopRutas) * 100}%`, background: RUTA_COLORS[i % RUTA_COLORS.length] }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Estado de controles */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <ShieldCheck size={13} className="text-[#064e3b]" /> Controles activos
            </h3>
            <div className="space-y-2">
              {[
                { desc: 'Descuentos limitados según el rol del usuario' },
                { desc: 'Auditoría de todas las acciones con IP y hora' },
                { desc: 'Máximo 5 intentos de inicio de sesión por minuto' },
                { desc: 'Cada agencia solo ve sus propios datos' },
              ].map(({ desc }) => (
                <div key={desc} className="flex items-start gap-2 p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                  <CheckCircle2 size={12} className="text-emerald-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-gray-600">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Bitácora */}
          {auditoria && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Activity size={13} className="text-[#064e3b]" /> Bitácora hoy
              </h3>
              <div className="space-y-1.5">
                {[
                  { label: 'Total eventos', value: auditoria.total ?? 0, cls: 'text-gray-900' },
                  { label: 'Creaciones',    value: auditoria.inserts ?? 0, cls: 'text-blue-600' },
                  { label: 'Modificaciones',value: auditoria.updates ?? 0, cls: 'text-amber-600' },
                  { label: 'Eliminaciones', value: auditoria.deletes ?? 0, cls: 'text-red-600' },
                ].map(({ label, value, cls }) => (
                  <div key={label} className="flex justify-between items-center py-1 border-b border-gray-50 last:border-0">
                    <span className="text-xs text-gray-500">{label}</span>
                    <span className={`text-sm font-bold tabular-nums ${cls}`}>{value}</span>
                  </div>
                ))}
              </div>
              <Link href="/auditoria"
                className="mt-3 block text-center text-xs text-[#064e3b] hover:underline font-medium">
                Ver bitácora completa →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ── Conductores activos del día ── */}
      {conductoresActivos.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Bus size={14} className="text-[#064e3b]" />
            Conductores activos hoy
            <span className="ml-auto text-xs font-normal text-gray-400">{conductoresActivos.length} viaje{conductoresActivos.length !== 1 ? 's' : ''}</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Conductor', 'Ruta', 'Hora', 'Vehículo', 'Ocupación', 'Estado'].map(h => (
                    <th key={h} className="pb-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {conductoresActivos.map(c => (
                  <tr key={c.viajeId} className="hover:bg-gray-50 transition-colors">
                    <td className="py-2.5 pr-4">
                      <p className="font-medium text-gray-800">{c.conductorNombre}</p>
                      <p className="text-gray-400 font-mono text-[10px]">{c.licencia}</p>
                    </td>
                    <td className="py-2.5 pr-4 text-gray-600 whitespace-nowrap">{c.origen} → {c.destino}</td>
                    <td className="py-2.5 pr-4 font-mono text-gray-600 whitespace-nowrap">
                      {c.fechaHoraSal ? format(new Date(c.fechaHoraSal), 'HH:mm') : '—'}
                    </td>
                    <td className="py-2.5 pr-4 whitespace-nowrap">
                      <span className="font-mono text-gray-700">{c.placa}</span>
                      <span className="text-gray-400 ml-1">({c.tipoVehiculo})</span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${c.ocupacionPct >= 90 ? 'bg-emerald-500' : c.ocupacionPct >= 60 ? 'bg-amber-400' : 'bg-blue-400'}`}
                            style={{ width: `${Math.min(c.ocupacionPct, 100)}%` }} />
                        </div>
                        <span className="text-[10px] text-gray-500">{c.asientosOcupados}/{c.capacidad}</span>
                      </div>
                    </td>
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        c.estado === 'EN_RUTA' ? 'bg-emerald-100 text-emerald-700' :
                        c.estado === 'ATRASADO' ? 'bg-amber-100 text-amber-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>{c.estado === 'EN_RUTA' ? 'En ruta' : c.estado === 'ATRASADO' ? 'Atrasado' : 'Programado'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Estado operadores (solo cuando hay filtro de agencia) ── */}
      {agenciaFiltro && estadoOperadores.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Users size={14} className="text-[#064e3b]" />
            Estado de operadores
            {estadoOperadores.filter(o => !o.tieneCaja).length > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">
                {estadoOperadores.filter(o => !o.tieneCaja).length} sin caja
              </span>
            )}
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {estadoOperadores.map(op => (
              <div key={op.usuarioId} className={`flex items-center justify-between px-3 py-2.5 rounded-xl border ${
                op.tieneCaja ? 'border-emerald-100 bg-emerald-50/50' : 'border-red-100 bg-red-50/50'
              }`}>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${op.tieneCaja ? 'bg-emerald-400' : 'bg-red-400'}`} />
                  <span className="text-sm font-medium text-gray-800">{op.nombre}</span>
                </div>
                <div className="text-right">
                  {op.tieneCaja
                    ? <p className="text-xs font-mono text-emerald-700 font-semibold">S/ {Number(op.saldoActual ?? 0).toFixed(2)}</p>
                    : <p className="text-xs text-red-600 font-medium">Sin caja abierta</p>
                  }
                  {op.fechaApertura && (
                    <p className="text-[10px] text-gray-400">{format(new Date(op.fechaApertura), 'HH:mm')}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Encomiendas pendientes ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <AlertTriangle size={14} className={encPendientes.length > 0 ? 'text-amber-500' : 'text-gray-300'} />
            Encomiendas sin movimiento
            <span className="text-xs text-gray-400 font-normal">+24 h</span>
          </h3>
          <div className="flex items-center gap-2">
            {encPendientes.filter(e => e.criticidad === 'CRITICA').length > 0 && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-700">
                {encPendientes.filter(e => e.criticidad === 'CRITICA').length} crítica{encPendientes.filter(e => e.criticidad === 'CRITICA').length > 1 ? 's' : ''}
              </span>
            )}
            {encPendientes.length > 0 && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
                {encPendientes.length} total
              </span>
            )}
          </div>
        </div>

        {encPendientes.length === 0 ? (
          <div className="flex items-center gap-2.5 text-xs text-emerald-700 bg-emerald-50 px-4 py-3 rounded-xl border border-emerald-100">
            <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
            Todas las encomiendas tienen movimientos recientes. Sin alertas activas.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  {['', 'Código', 'Estado', 'Sin cambio', 'Origen → Destino', 'Remitente', 'Descripción'].map(h => (
                    <th key={h} className="pb-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide pr-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {encPendientes.map(enc => {
                  const critica = enc.criticidad === 'CRITICA'
                  const alta    = enc.criticidad === 'ALTA'
                  return (
                    <tr key={enc.id} className={`hover:bg-amber-50/40 transition-colors ${critica ? 'bg-red-50/30' : ''}`}>
                      <td className="py-2.5 pr-2">
                        <div className="flex gap-1">
                          {critica && <span title="Crítica" className="w-2 h-2 rounded-full bg-red-500 mt-1" />}
                          {!critica && alta && <span title="Alta" className="w-2 h-2 rounded-full bg-amber-500 mt-1" />}
                          {enc.esFragil && <span title="Frágil" className="text-[10px]">⚠</span>}
                          {enc.deViajeCancelado && <span title="De viaje cancelado" className="text-[10px] text-red-500">✕</span>}
                        </div>
                      </td>
                      <td className="py-2.5 font-mono text-gray-700 whitespace-nowrap pr-3">{enc.codigoTracking}</td>
                      <td className="py-2.5 pr-3">
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${ESTADO_ENC[enc.estado] ?? 'bg-gray-100 text-gray-600'}`}>
                          {enc.estado}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className={`font-bold tabular-nums ${critica ? 'text-red-600' : alta ? 'text-amber-600' : 'text-gray-500'}`}>
                          {enc.horas >= 168 ? `${Math.floor(enc.horas/24)}d` : `${enc.horas}h`}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-gray-500 text-[10px] whitespace-nowrap">
                        {enc.agenciaOrigen && enc.agenciaDestino ? `${enc.agenciaOrigen} → ${enc.agenciaDestino}` : '—'}
                      </td>
                      <td className="py-2.5 pr-3 text-gray-600 whitespace-nowrap">{enc.remitente}</td>
                      <td className="py-2.5 text-gray-400 max-w-[140px] truncate">{enc.descripcion}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="mt-3 flex items-center gap-4 text-[10px] text-gray-400 border-t border-gray-50 pt-3">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Crítica (+7 días o frágil +48h)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Alta (+48h)</span>
              <span className="flex items-center gap-1"><span className="text-red-500">✕</span> De viaje cancelado</span>
              <span className="flex items-center gap-1">⚠ Frágil</span>
            </div>
          </div>
        )}
      </div>

      {/* ── CAATs ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Download size={14} className="text-[#064e3b]" />
          <h3 className="text-sm font-semibold text-gray-800">Descargar reportes</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {([
            { label: 'Ventas del día',   tipo: 'ventas',      icon: Ticket,      color: 'from-blue-500 to-blue-600' },
            { label: 'Encomiendas',      tipo: 'encomiendas', icon: Package,     color: 'from-emerald-500 to-teal-600' },
            { label: 'Movim. caja',      tipo: 'caja',        icon: Wallet,      color: 'from-indigo-500 to-violet-600' },
          ] as const).map(({ label, tipo, icon: Icon, color }) => (
            <button key={tipo} onClick={() => descargarExcel(tipo)}
              className="group flex flex-col items-center gap-2 p-4 border border-gray-200 rounded-xl hover:border-transparent hover:shadow-md transition-all">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center`}>
                <Icon size={16} className="text-white" />
              </div>
              <span className="text-xs font-medium text-gray-600 text-center leading-tight">{label}</span>
              <Download size={10} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
            </button>
          ))}

          <button onClick={descargarManifiestosDia} disabled={descargandoManif}
            className="group flex flex-col items-center gap-2 p-4 border border-gray-200 rounded-xl hover:border-transparent hover:shadow-md transition-all disabled:opacity-50">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              {descargandoManif
                ? <RefreshCw size={16} className="text-white animate-spin" />
                : <Bus size={16} className="text-white" />}
            </div>
            <span className="text-xs font-medium text-gray-600 text-center leading-tight">Manifiestos del día</span>
            <Download size={10} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
          </button>

          <Link href="/auditoria"
            className="group flex flex-col items-center gap-2 p-4 border border-gray-200 rounded-xl hover:border-transparent hover:shadow-md transition-all">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center">
              <Activity size={16} className="text-white" />
            </div>
            <span className="text-xs font-medium text-gray-600 text-center leading-tight">Log auditoría</span>
            <ChevronRight size={10} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
          </Link>
        </div>
      </div>
    </div>
  )
}
