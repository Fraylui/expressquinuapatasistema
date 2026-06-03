'use client'
import React, { useState } from 'react'
import useSWR from 'swr'
import {
  FileSpreadsheet, TrendingUp, Users, Package,
  DollarSign, AlertTriangle, Clock, Activity, Bus,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, LineChart, Line, Legend,
} from 'recharts'
import { Button } from '@/components/ui/Button'
import api from '@/services/api'
import toast from 'react-hot-toast'

type TabType    = 'ventas' | 'encomiendas' | 'caja'
type PeriodoType = '7' | '14' | '30'

interface KpisGerente {
  pasajesHoy: number
  ingresosHoy: number
  encomiendaActivas: number
  cajasAbiertas: number
  auditoriaHoy: number
  viajesActivosHoy: number
  diferenciasHoy: number
  fechaHora: string
}
interface TendenciaDia  { fecha: string; pasajes: number; encomiendas: number; ingresos: number }
interface VentaHora     { hora: string; pasajes: number; ingresos: number }
interface ViajesDia     { viajeId: number; estado: string; hora: string; origen: string; destino: string; placa: string; tipo: string; totalAsientos: number; pasajerosVendidos: number }
interface EncPendiente  { id: number; codigoTracking: string; estado: string; descripcion: string; horas: number; remitente: string; destinatario: string }
interface CajaItem      { id: number; fechaApertura: string; fechaCierre: string | null; estado: string; operadorNombre: string }

function fmt(n: number) { return `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2 })}` }

function KpiCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; color: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
      <div className={`p-2.5 rounded-lg ${color}`}>
        <Icon size={18} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 truncate">{label}</p>
        <p className="text-xl font-bold text-gray-900 leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  )
}

const ESTADO_COLOR: Record<string, string> = {
  PROGRAMADO: 'bg-blue-100 text-blue-700',
  EN_RUTA:    'bg-green-100 text-green-700',
  LLEGADO:    'bg-gray-100 text-gray-600',
  CANCELADO:  'bg-red-100 text-red-700',
}

const ENC_ESTADO_COLOR: Record<string, string> = {
  PENDIENTE:   'bg-yellow-100 text-yellow-700',
  EN_TRANSITO: 'bg-blue-100 text-blue-700',
  EN_DESTINO:  'bg-purple-100 text-purple-700',
}

export default function ReportesPage() {
  const [tab, setTab]               = useState<TabType>('ventas')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [loading, setLoading]       = useState(false)
  const [periodo, setPeriodo]       = useState<PeriodoType>('7')
  const [cajaId, setCajaId]         = useState<string>('')

  const { data: kpis }         = useSWR<KpisGerente>('/api/reportes/kpis', { refreshInterval: 60000 })
  const { data: tendenciaData }= useSWR<TendenciaDia[]>(`/api/reportes/tendencia?dias=${periodo}`)
  const { data: horaData }     = useSWR<VentaHora[]>('/api/reportes/ventas-hora', { refreshInterval: 120000 })
  const { data: viajesData }   = useSWR<ViajesDia[]>('/api/reportes/viajes-dia', { refreshInterval: 60000 })
  const { data: encPendData }  = useSWR<EncPendiente[]>('/api/reportes/encomiendas-pendientes')
  const { data: cajasData }    = useSWR<CajaItem[]>('/api/caja/historial')

  const tendencia  = tendenciaData  ?? []
  const ventasHora = horaData       ?? []
  const viajes     = viajesData     ?? []
  const encPend    = encPendData    ?? []
  const cajas      = cajasData      ?? []

  const totalPasajes     = tendencia.reduce((s, d) => s + d.pasajes, 0)
  const totalEncomiendas = tendencia.reduce((s, d) => s + d.encomiendas, 0)
  const totalIngresos    = tendencia.reduce((s, d) => s + d.ingresos, 0)

  const descargar = async () => {
    if (tab === 'caja' && !cajaId) { toast.error('Seleccione un turno de caja'); return }
    if (tab !== 'encomiendas' && tab !== 'caja' && (!fechaDesde || !fechaHasta)) {
      toast.error('Seleccione el rango de fechas'); return
    }
    setLoading(true)
    try {
      const urlMap: Record<TabType, string> = {
        ventas:      `/api/reportes/ventas/excel?desde=${fechaDesde}T00:00:00&hasta=${fechaHasta}T23:59:59`,
        encomiendas: fechaDesde && fechaHasta
          ? `/api/reportes/encomiendas/excel?desde=${fechaDesde}T00:00:00&hasta=${fechaHasta}T23:59:59`
          : `/api/reportes/encomiendas/excel`,
        caja:        `/api/reportes/caja/excel?cajaId=${cajaId}`,
      }
      const res = await api.get(urlMap[tab], { responseType: 'blob' }) as unknown as Blob
      const href = URL.createObjectURL(res)
      const a = document.createElement('a')
      a.href = href
      a.download = `reporte-${tab}${fechaDesde ? '-' + fechaDesde : ''}.xlsx`
      a.click()
      URL.revokeObjectURL(href)
      toast.success('Reporte descargado')
    } catch {
      toast.error('Error al generar reporte')
    } finally {
      setLoading(false)
    }
  }

  const tabs: { key: TabType; label: string }[] = [
    { key: 'ventas',      label: 'Ventas de Pasajes' },
    { key: 'encomiendas', label: 'Encomiendas' },
    { key: 'caja',        label: 'Movimientos de Caja' },
  ]
  const periodos: { key: PeriodoType; label: string }[] = [
    { key: '7',  label: '7 días' },
    { key: '14', label: '14 días' },
    { key: '30', label: '30 días' },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Reportes Gerenciales</h1>
        <p className="text-sm text-gray-500">Indicadores en tiempo real y exportación de datos</p>
      </div>

      {/* ── KPIs en tiempo real ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Viajes hoy"           value={kpis?.viajesActivosHoy  ?? '—'} icon={Bus}           color="bg-[#064e3b]" />
        <KpiCard label="Pasajes hoy"          value={kpis?.pasajesHoy         ?? '—'} icon={Users}          color="bg-blue-500" />
        <KpiCard label="Ingresos hoy"         value={kpis ? fmt(Number(kpis.ingresosHoy)) : '—'} icon={DollarSign} color="bg-green-600" />
        <KpiCard label="Enc. en tránsito"     value={kpis?.encomiendaActivas  ?? '—'} icon={Package}        color="bg-purple-600" />
        <KpiCard label="Cajas abiertas"       value={kpis?.cajasAbiertas      ?? '—'} icon={Activity}       color="bg-amber-500" />
        <KpiCard
          label="Diferencias hoy"
          value={kpis?.diferenciasHoy ?? '—'}
          icon={AlertTriangle}
          color={(kpis?.diferenciasHoy ?? 0) > 0 ? 'bg-red-500' : 'bg-green-600'}
        />
      </div>

      {/* ── Tendencia operativa ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-[#064e3b]" />
            <h2 className="text-base font-semibold text-gray-900">Tendencia operativa</h2>
          </div>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
            {periodos.map(p => (
              <button key={p.key} onClick={() => setPeriodo(p.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  periodo === p.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-xs text-blue-500 font-medium">Pasajes vendidos</p>
            <p className="text-2xl font-bold text-blue-700">{totalPasajes}</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <p className="text-xs text-purple-500 font-medium">Encomiendas</p>
            <p className="text-2xl font-bold text-purple-700">{totalEncomiendas}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-xs text-green-500 font-medium">Ingresos totales</p>
            <p className="text-2xl font-bold text-green-700">S/ {totalIngresos.toFixed(0)}</p>
          </div>
        </div>

        {tendencia.length > 0 ? (
          <>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Pasajes y Encomiendas por día</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={tendencia} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="pasajes"     name="Pasajes"     fill="#064e3b" radius={[4,4,0,0]} />
                  <Bar dataKey="encomiendas" name="Encomiendas" fill="#0070C0" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Ingresos diarios (S/)</p>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={tendencia} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v: number) => [`S/ ${v.toFixed(2)}`, 'Ingresos']}
                    contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 12 }}
                  />
                  <Line type="monotone" dataKey="ingresos" name="Ingresos"
                    stroke="#22c55e" strokeWidth={2} dot={{ r: 3, fill: '#22c55e' }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <div className="py-8 text-center text-sm text-gray-400">No hay datos disponibles para este período</div>
        )}
      </div>

      {/* ── Ventas por hora + Viajes del día ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Ventas por hora */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-[#064e3b]" />
            <h2 className="text-base font-semibold text-gray-900">Ventas por hora — hoy</h2>
          </div>
          {ventasHora.some(h => h.pasajes > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={ventasHora} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="hora" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                  interval={1} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: number, name: string) =>
                    name === 'Ingresos' ? [`S/ ${v.toFixed(2)}`, name] : [v, name]}
                  contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="pasajes" name="Pasajes" fill="#064e3b" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-sm text-gray-400">
              Sin ventas registradas hoy
            </div>
          )}
        </div>

        {/* Viajes del día */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Bus size={16} className="text-[#064e3b]" />
            <h2 className="text-base font-semibold text-gray-900">Viajes del día</h2>
          </div>
          {viajes.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-sm text-gray-400">
              No hay viajes programados para hoy
            </div>
          ) : (
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {viajes.map(v => {
                const pct = v.totalAsientos > 0
                  ? Math.round((v.pasajerosVendidos / v.totalAsientos) * 100)
                  : 0
                const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-400' : 'bg-green-500'
                return (
                  <div key={v.viajeId} className="border border-gray-100 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-semibold text-gray-800 shrink-0">{v.hora}</span>
                        <span className="text-sm text-gray-600 truncate">{v.origen} → {v.destino}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="text-xs text-gray-500">{v.placa}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${ESTADO_COLOR[v.estado] ?? 'bg-gray-100 text-gray-600'}`}>
                          {v.estado}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div className={`${barColor} h-2 rounded-full transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 shrink-0 w-16 text-right">
                        {v.pasajerosVendidos}/{v.totalAsientos} asientos
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
        <div className="bg-white rounded-xl border border-amber-200 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" />
            <h2 className="text-base font-semibold text-gray-900">
              Encomiendas sin movimiento &gt;24h
              <span className="ml-2 text-xs font-normal bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                {encPend.length}
              </span>
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-100">
                  <th className="text-left pb-2 font-medium">Tracking</th>
                  <th className="text-left pb-2 font-medium">Descripción</th>
                  <th className="text-left pb-2 font-medium">Estado</th>
                  <th className="text-left pb-2 font-medium">Remitente</th>
                  <th className="text-left pb-2 font-medium">Destinatario</th>
                  <th className="text-right pb-2 font-medium">Tiempo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {encPend.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="py-2 font-mono text-xs text-gray-700">{e.codigoTracking}</td>
                    <td className="py-2 text-gray-600 max-w-[160px] truncate">{e.descripcion}</td>
                    <td className="py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ENC_ESTADO_COLOR[e.estado] ?? 'bg-gray-100 text-gray-600'}`}>
                        {e.estado}
                      </span>
                    </td>
                    <td className="py-2 text-gray-600">{e.remitente}</td>
                    <td className="py-2 text-gray-600">{e.destinatario}</td>
                    <td className="py-2 text-right">
                      <span className={`text-xs font-semibold ${e.horas > 72 ? 'text-red-600' : 'text-amber-600'}`}>
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

      {/* ── Exportar Excel ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">Exportar datos</h2>

        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {(tab === 'ventas' || tab === 'encomiendas') && (
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Desde {tab === 'encomiendas' && <span className="text-gray-400">(opcional)</span>}
              </label>
              <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Hasta {tab === 'encomiendas' && <span className="text-gray-400">(opcional)</span>}
              </label>
              <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <Button icon={FileSpreadsheet} loading={loading} onClick={descargar}>
              Descargar Excel
            </Button>
          </div>
        )}

        {tab === 'caja' && (
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Turno de caja</label>
              <select value={cajaId} onChange={e => setCajaId(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm min-w-[280px]">
                <option value="">— Seleccione un turno —</option>
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
            <Button icon={FileSpreadsheet} loading={loading} onClick={descargar} disabled={!cajaId}>
              Descargar Excel
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
