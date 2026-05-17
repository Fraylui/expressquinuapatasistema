'use client'
import React, { useState, useEffect } from 'react'
import useSWR from 'swr'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import {
  Ticket, Package, DollarSign, ShieldCheck, AlertTriangle,
  TrendingUp, Activity, FileText, Download, Bus, Clock,
  ChevronRight, RefreshCw, Building2,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/stores/authStore'

// ── Types ──────────────────────────────────────────────────────────────────────
interface KPIs {
  pasajesHoy: number; ingresosHoy: number; encomiendaActivas: number
  cajasAbiertas: number; auditoriaHoy: number; viajesActivosHoy: number
  diferenciasHoy: number; fechaHora: string
}
type Periodo = 'HOY' | 'SEMANA' | 'MES'
type KPIColor = 'blue' | 'green' | 'emerald' | 'indigo' | 'amber' | 'red' | 'violet'

interface ViajeDelDia {
  viajeId: number; estado: string; hora: string
  origen: string; destino: string; placa: string; tipo: string
  totalAsientos: number; pasajerosVendidos: number
}
interface EncomiendaPendiente {
  id: number; codigoTracking: string; estado: string
  descripcion: string; horas: number; remitente: string; destinatario: string
}

// ── Color maps ────────────────────────────────────────────────────────────────
const colorMap: Record<KPIColor, { bg: string; text: string; badge: string }> = {
  blue:    { bg: 'bg-blue-50',    text: 'text-blue-600',    badge: 'bg-blue-100 text-blue-700' },
  green:   { bg: 'bg-green-50',   text: 'text-green-600',   badge: 'bg-green-100 text-green-700' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700' },
  indigo:  { bg: 'bg-indigo-50',  text: 'text-indigo-600',  badge: 'bg-indigo-100 text-indigo-700' },
  amber:   { bg: 'bg-amber-50',   text: 'text-amber-600',   badge: 'bg-amber-100 text-amber-700' },
  red:     { bg: 'bg-red-50',     text: 'text-red-600',     badge: 'bg-red-100 text-red-700' },
  violet:  { bg: 'bg-violet-50',  text: 'text-violet-600',  badge: 'bg-violet-100 text-violet-700' },
}

const ESTADO_VIAJE_BADGE: Record<string, string> = {
  PROGRAMADO: 'bg-blue-100 text-blue-700',
  EN_RUTA:    'bg-green-100 text-green-700',
  COMPLETADO: 'bg-gray-100 text-gray-600',
  CANCELADO:  'bg-red-100 text-red-700',
}

const ESTADO_ENC_BADGE: Record<string, string> = {
  REGISTRADO:      'bg-blue-50 text-blue-700',
  RECEPCIONADO:    'bg-indigo-50 text-indigo-700',
  ALMACENADO:      'bg-yellow-50 text-yellow-700',
  CARGADO:         'bg-orange-50 text-orange-700',
  EN_TRANSITO:     'bg-purple-50 text-purple-700',
  LLEGADO_AGENCIA: 'bg-cyan-50 text-cyan-700',
  DISPONIBLE:      'bg-teal-50 text-teal-700',
}

// ── Sub-components ────────────────────────────────────────────────────────────
function KPICard({ label, value, sub, icon: Icon, color, marco }: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; color: KPIColor; marco?: string
}) {
  const c = colorMap[color]
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${c.bg}`}>
          <Icon size={16} className={c.text} />
        </div>
        {marco && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${c.badge} uppercase tracking-wide`}>
            {marco}
          </span>
        )}
      </div>
      <div>
        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide leading-tight">{label}</p>
        <p className="mt-0.5 text-xl font-bold text-gray-900 tabular-nums">{value}</p>
        {sub && <p className="mt-0.5 text-[11px] text-gray-400">{sub}</p>}
      </div>
    </div>
  )
}

function MarcoTag({ marco, descripcion }: { marco: string; descripcion: string }) {
  return (
    <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
      <span className="text-[10px] font-bold bg-[#1F3864] text-white px-1.5 py-0.5 rounded uppercase shrink-0 mt-0.5">
        {marco}
      </span>
      <p className="text-xs text-gray-600">{descripcion}</p>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function GerentePage() {
  const { user } = useAuthStore()
  const [agenciaFiltro, setAgenciaFiltro] = useState<number | null>(null)
  const [periodo, setPeriodo] = useState<Periodo>('HOY')
  const [descargandoManif, setDescargandoManif] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const puedeVerAgencias = mounted && (user?.rol === 'SUPER_ADMIN' || user?.rol === 'GERENTE')

  // Construye URL con agenciaId opcional
  const ag = (base: string) =>
    agenciaFiltro
      ? `${base}${base.includes('?') ? '&' : '?'}agenciaId=${agenciaFiltro}`
      : base

  // ── SWR ──────────────────────────────────────────────────────────────────
  const { data: agenciasData } = useSWR(puedeVerAgencias ? '/api/agencias' : null)
  const agencias: { id: number; nombre: string }[] = (agenciasData as any) ?? []

  const { data: kpisRaw } = useSWR(ag('/api/reportes/kpis'), { refreshInterval: 60_000 })
  const kpis = kpisRaw as KPIs | undefined

  const { data: ventasHoraRaw } = useSWR(
    periodo === 'HOY' ? ag('/api/reportes/ventas-hora') : null,
    { refreshInterval: 120_000 }
  )
  const { data: tendenciaRaw } = useSWR(
    periodo !== 'HOY'
      ? ag(`/api/reportes/tendencia?dias=${periodo === 'SEMANA' ? 7 : 30}`)
      : null,
    { refreshInterval: 300_000 }
  )

  const { data: viajesDiaRaw } = useSWR(ag('/api/reportes/viajes-dia'), { refreshInterval: 60_000 })
  const viajesDia: ViajeDelDia[] = (viajesDiaRaw as any) ?? []

  const { data: encPendRaw } = useSWR(ag('/api/reportes/encomiendas-pendientes'), { refreshInterval: 300_000 })
  const encPendientes: EncomiendaPendiente[] = (encPendRaw as any) ?? []

  const { data: auditoriaData } = useSWR('/api/auditoria/resumen', { refreshInterval: 60_000 })
  const auditoria = auditoriaData as any

  // ── Chart data ────────────────────────────────────────────────────────────
  const chartData = periodo === 'HOY'
    ? ((ventasHoraRaw as any) ?? []).map((d: any) => ({
        label: d.hora, pasajes: d.pasajes, ingresos: Number(d.ingresos),
      }))
    : ((tendenciaRaw as any) ?? []).map((d: any) => ({
        label: d.fecha, pasajes: d.pasajes, ingresos: Number(d.ingresos),
      }))

  const chartXLabel = periodo === 'HOY' ? 'hora' : 'día'

  // ── Actions ───────────────────────────────────────────────────────────────
  const descargarExcel = async (tipo: string) => {
    const hoy = new Date().toISOString().split('T')[0]
    const extra = agenciaFiltro ? `&agenciaId=${agenciaFiltro}` : ''
    try {
      const blob = await api.get(
        `/api/reportes/${tipo}/excel?desde=${hoy}T00:00:00&hasta=${hoy}T23:59:59${extra}`,
        { responseType: 'blob' }
      ) as unknown as Blob
      const href = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = href; a.download = `${tipo}-${hoy}.xlsx`; a.click()
      URL.revokeObjectURL(href)
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
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `manifiesto-${v.origen}-${v.destino}-${v.hora.replace(':', '')}.pdf`
        a.click()
        URL.revokeObjectURL(url)
      }
      toast.success(`${activos.length} manifiesto(s) descargado(s)`)
    } catch { toast.error('Error al descargar manifiestos') }
    finally { setDescargandoManif(false) }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-6xl">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard Gerencial</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Métricas de control interno — COBIT 2019 · COSO · ISO 27001
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Selector de agencia — solo SUPER_ADMIN / GERENTE */}
          {puedeVerAgencias && agencias.length > 0 && (
            <div className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white">
              <Building2 size={13} className="text-gray-400 shrink-0" />
              <select
                value={agenciaFiltro ?? ''}
                onChange={e => setAgenciaFiltro(e.target.value ? Number(e.target.value) : null)}
                className="text-xs text-gray-700 bg-transparent focus:outline-none"
              >
                <option value="">Todas las agencias</option>
                {agencias.map(a => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
              </select>
            </div>
          )}
          <Button variant="secondary" size="sm" icon={Download} onClick={() => descargarExcel('ventas')}>
            Pasajes Excel
          </Button>
          <Button variant="secondary" size="sm" icon={FileText} onClick={() => descargarExcel('encomiendas')}>
            Encomiendas
          </Button>
          <Link href="/auditoria">
            <Button variant="secondary" size="sm" icon={ShieldCheck}>Auditoría</Button>
          </Link>
        </div>
      </div>

      {/* ── KPIs (7 tarjetas) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
        <KPICard label="Pasajes hoy"         value={kpis?.pasajesHoy ?? '—'}
          sub="emitidos"         icon={Ticket}         color="blue"   marco="COSO" />
        <KPICard label="Ingresos hoy"
          value={kpis ? `S/ ${Number(kpis.ingresosHoy ?? 0).toFixed(2)}` : '—'}
          sub="en caja"          icon={DollarSign}     color="green"  marco="COSO" />
        <KPICard label="Encomiendas activas" value={kpis?.encomiendaActivas ?? '—'}
          sub="en tránsito"      icon={Package}        color="emerald" marco="ITIL" />
        <KPICard label="Cajas abiertas"      value={kpis?.cajasAbiertas ?? '—'}
          sub="turnos en curso"  icon={TrendingUp}     color="indigo" marco="COSO" />
        <KPICard label="Auditoría hoy"       value={kpis?.auditoriaHoy ?? '—'}
          sub="eventos"          icon={Activity}       color="amber"  marco="COBIT" />
        <KPICard label="Viajes activos hoy"  value={kpis?.viajesActivosHoy ?? '—'}
          sub="progr. + en ruta" icon={Bus}            color="violet" marco="COSO" />
        <KPICard
          label="Diferencias caja"
          value={kpis?.diferenciasHoy ?? '—'}
          sub="cierres con diff."
          icon={AlertTriangle}
          color={kpis !== undefined && kpis.diferenciasHoy > 0 ? 'red' : 'green'}
          marco="COSO"
        />
      </div>

      {/* ── Gráfico + sidebar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Izquierda: gráfico + tabla viajes */}
        <div className="lg:col-span-2 space-y-4">

          {/* Gráfico de ventas */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">
                  Ventas por {periodo === 'HOY' ? 'hora — hoy' : periodo === 'SEMANA' ? 'día — últimos 7 días' : 'día — últimos 30 días'}
                </h3>
                <p className="text-xs text-gray-400">Pasajes e ingresos acumulados</p>
              </div>
              <div className="flex items-center gap-2">
                {/* Selector de período */}
                <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                  {(['HOY', 'SEMANA', 'MES'] as Periodo[]).map(p => (
                    <button key={p} onClick={() => setPeriodo(p)}
                      className={`px-3 py-1.5 font-medium transition-colors ${
                        periodo === p ? 'bg-[#1F3864] text-white' : 'text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {p === 'HOY' ? 'Hoy' : p === 'SEMANA' ? 'Semana' : 'Mes'}
                    </button>
                  ))}
                </div>
                <span className="text-[10px] font-bold bg-[#1F3864] text-white px-1.5 py-0.5 rounded uppercase">
                  MEA01
                </span>
              </div>
            </div>

            {/* Leyenda manual */}
            <div className="flex items-center gap-5 mb-3 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: '#1F3864' }} />
                Pasajes vendidos (eje izquierdo)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: '#0070C0' }} />
                Ingresos S/ (eje derecho)
              </span>
            </div>

            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} barSize={12} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis yAxisId="left"  tick={{ fontSize: 10 }} width={28} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} width={44}
                  tickFormatter={v => `S/${v}`} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                  formatter={(value: any, name: string) => [
                    name === 'ingresos' ? `S/ ${Number(value).toFixed(2)}` : value,
                    name === 'ingresos' ? 'Ingresos' : 'Pasajes',
                  ]}
                  labelFormatter={l => `${chartXLabel === 'hora' ? 'Hora' : 'Fecha'}: ${l}`}
                />
                <Bar yAxisId="left"  dataKey="pasajes"  fill="#1F3864" radius={[3,3,0,0]} name="Pasajes" />
                <Bar yAxisId="right" dataKey="ingresos" fill="#0070C0" radius={[3,3,0,0]} name="Ingresos S/" />
              </BarChart>
            </ResponsiveContainer>
            {chartData.length === 0 && (
              <p className="text-center text-xs text-gray-400 py-2">Sin datos para el período seleccionado</p>
            )}
          </div>

          {/* Tabla de viajes del día */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <Bus size={14} className="text-[#1F3864]" />
                Viajes del día
              </h3>
              <span className="text-xs text-gray-400">{viajesDia.length} programados</span>
            </div>

            {viajesDia.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No hay viajes para hoy</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Ruta', 'Hora', 'Vehículo', 'Pasajeros', 'Estado'].map(h => (
                        <th key={h} className="pb-2 text-left font-medium text-gray-400 uppercase tracking-wide text-[10px]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {viajesDia.map(v => {
                      const pct = v.totalAsientos > 0
                        ? Math.round((v.pasajerosVendidos / v.totalAsientos) * 100) : 0
                      return (
                        <tr key={v.viajeId} className="hover:bg-gray-50">
                          <td className="py-2 font-medium text-gray-800 whitespace-nowrap">
                            {v.origen}
                            <ChevronRight size={10} className="inline mx-0.5 text-gray-400" />
                            {v.destino}
                          </td>
                          <td className="py-2 text-gray-500 whitespace-nowrap">
                            <span className="flex items-center gap-1">
                              <Clock size={11} className="text-gray-400" />{v.hora}
                            </span>
                          </td>
                          <td className="py-2 text-gray-500 whitespace-nowrap">
                            {v.placa} <span className="text-gray-400">({v.tipo})</span>
                          </td>
                          <td className="py-2">
                            <div className="flex items-center gap-2">
                              <span className="tabular-nums text-gray-700">
                                {v.pasajerosVendidos}/{v.totalAsientos}
                              </span>
                              <div className="w-14 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-400' : 'bg-blue-400'
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-2">
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                              ESTADO_VIAJE_BADGE[v.estado] ?? 'bg-gray-100 text-gray-600'
                            }`}>
                              {v.estado}
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

        {/* Derecha: controles + auditoría */}
        <div className="space-y-3">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <ShieldCheck size={14} className="text-[#1F3864]" />
              Estado de controles
            </h3>
            <div className="space-y-2">
              <MarcoTag marco="COSO"     descripcion="Descuentos limitados por rol (OPERADOR S/5, SUPERVISOR S/10, GERENTE sin límite)" />
              <MarcoTag marco="ISO 27001" descripcion="Auditoría inmutable activa — todos los eventos con IP y timestamp" />
              <MarcoTag marco="OWASP"    descripcion="Rate limiting activo — máx 5 intentos de login por IP/min" />
              <MarcoTag marco="COBIT"    descripcion="Multi-agencia: cada usuario solo accede a datos de su agencia" />
            </div>
          </div>

          {auditoria && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Bitácora hoy</h3>
              <div className="space-y-2">
                {[
                  { label: 'Total eventos',   value: auditoria.total   ?? 0, color: 'text-gray-900' },
                  { label: 'Creaciones',       value: auditoria.inserts ?? 0, color: 'text-blue-600' },
                  { label: 'Modificaciones',   value: auditoria.updates ?? 0, color: 'text-amber-600' },
                  { label: 'Eliminaciones',    value: auditoria.deletes ?? 0, color: 'text-red-600' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">{label}</span>
                    <span className={`font-bold tabular-nums ${color}`}>{value}</span>
                  </div>
                ))}
              </div>
              <Link href="/auditoria"
                className="mt-3 block text-center text-xs text-[#0070C0] hover:underline font-medium">
                Ver bitácora completa →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ── Encomiendas pendientes >24h ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <AlertTriangle size={14} className={encPendientes.length > 0 ? 'text-amber-500' : 'text-gray-300'} />
            Encomiendas pendientes
            <span className="text-xs text-gray-400 font-normal">(sin cambio de estado en +24 h)</span>
          </h3>
          {encPendientes.length > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              {encPendientes.length} alerta{encPendientes.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {encPendientes.length === 0 ? (
          <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 px-4 py-3 rounded-lg">
            <span className="w-2 h-2 bg-green-500 rounded-full shrink-0" />
            Todas las encomiendas activas tienen movimientos recientes. Sin alertas.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Código', 'Estado', 'Espera', 'Remitente', 'Destinatario', 'Descripción'].map(h => (
                    <th key={h} className="pb-2 text-left font-medium text-gray-400 uppercase tracking-wide text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {encPendientes.map(enc => (
                  <tr key={enc.id} className="hover:bg-amber-50/30">
                    <td className="py-2 font-mono text-gray-700 whitespace-nowrap">{enc.codigoTracking}</td>
                    <td className="py-2">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                        ESTADO_ENC_BADGE[enc.estado] ?? 'bg-gray-100 text-gray-600'
                      }`}>
                        {enc.estado}
                      </span>
                    </td>
                    <td className="py-2">
                      <span className={`font-semibold tabular-nums ${enc.horas >= 48 ? 'text-red-600' : 'text-amber-600'}`}>
                        {enc.horas}h
                      </span>
                    </td>
                    <td className="py-2 text-gray-600 whitespace-nowrap">{enc.remitente}</td>
                    <td className="py-2 text-gray-600 whitespace-nowrap">{enc.destinatario}</td>
                    <td className="py-2 text-gray-400 max-w-[140px] truncate">{enc.descripcion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── CAATs — Exportar para auditoría ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <FileText size={15} className="text-[#1F3864]" />
          <h3 className="text-sm font-semibold text-gray-800">Exportar para auditoría</h3>
          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded uppercase ml-auto">
            CAATs
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {([
            { label: 'Ventas del día',   tipo: 'ventas',      icon: Ticket      },
            { label: 'Encomiendas',      tipo: 'encomiendas', icon: Package     },
            { label: 'Movimientos caja', tipo: 'caja',        icon: DollarSign  },
          ] as const).map(({ label, tipo, icon: Icon }) => (
            <button key={tipo} onClick={() => descargarExcel(tipo)}
              className="flex flex-col items-center gap-2 p-4 border border-gray-200 rounded-xl hover:border-[#0070C0] hover:bg-blue-50 transition-all group">
              <div className="w-9 h-9 rounded-lg bg-gray-100 group-hover:bg-[#1F3864] flex items-center justify-center transition-colors">
                <Icon size={16} className="text-gray-500 group-hover:text-white" />
              </div>
              <span className="text-xs font-medium text-gray-600 text-center">{label}</span>
              <Download size={11} className="text-gray-400" />
            </button>
          ))}

          {/* Manifiestos del día */}
          <button onClick={descargarManifiestosDia} disabled={descargandoManif}
            className="flex flex-col items-center gap-2 p-4 border border-gray-200 rounded-xl hover:border-[#0070C0] hover:bg-blue-50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed">
            <div className="w-9 h-9 rounded-lg bg-gray-100 group-hover:bg-[#1F3864] flex items-center justify-center transition-colors">
              {descargandoManif
                ? <RefreshCw size={16} className="text-gray-500 animate-spin" />
                : <Bus size={16} className="text-gray-500 group-hover:text-white" />
              }
            </div>
            <span className="text-xs font-medium text-gray-600 text-center">Manifiestos del día</span>
            <Download size={11} className="text-gray-400" />
          </button>

          <Link href="/auditoria"
            className="flex flex-col items-center gap-2 p-4 border border-gray-200 rounded-xl hover:border-[#0070C0] hover:bg-blue-50 transition-all group">
            <div className="w-9 h-9 rounded-lg bg-gray-100 group-hover:bg-[#1F3864] flex items-center justify-center transition-colors">
              <Activity size={16} className="text-gray-500 group-hover:text-white" />
            </div>
            <span className="text-xs font-medium text-gray-600 text-center">Log auditoría</span>
            <Download size={11} className="text-gray-400" />
          </Link>
        </div>
      </div>
    </div>
  )
}
