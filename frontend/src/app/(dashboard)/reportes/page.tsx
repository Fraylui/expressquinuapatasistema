'use client'
import React, { useState } from 'react'
import useSWR from 'swr'
import { Download, FileSpreadsheet, TrendingUp } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, LineChart, Line, Legend,
} from 'recharts'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import api from '@/services/api'
import toast from 'react-hot-toast'

type TabType = 'ventas' | 'encomiendas' | 'caja'
type PeriodoType = '7' | '14' | '30'

interface TendenciaDia {
  fecha: string
  pasajes: number
  encomiendas: number
  ingresos: number
}

export default function ReportesPage() {
  const [tab, setTab]             = useState<TabType>('ventas')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [loading, setLoading]     = useState(false)
  const [periodo, setPeriodo]     = useState<PeriodoType>('7')

  const { data: tendenciaData } = useSWR<TendenciaDia[]>(
    `/api/reportes/tendencia?dias=${periodo}`
  )
  const tendencia: TendenciaDia[] = tendenciaData ?? []

  const descargar = async () => {
    if (!fechaDesde || !fechaHasta) {
      toast.error('Seleccione el rango de fechas')
      return
    }
    setLoading(true)
    try {
      const urlMap: Record<TabType, string> = {
        ventas:       `/api/reportes/ventas/excel?desde=${fechaDesde}T00:00:00&hasta=${fechaHasta}T23:59:59`,
        encomiendas:  `/api/reportes/encomiendas/excel`,
        caja:         `/api/reportes/caja/excel?cajaId=1`,
      }
      const res = await api.get(urlMap[tab], { responseType: 'blob' }) as unknown as Blob
      const href = URL.createObjectURL(res)
      const a = document.createElement('a')
      a.href = href
      a.download = `reporte-${tab}-${fechaDesde}.xlsx`
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

  // KPIs de la tendencia
  const totalPasajes    = tendencia.reduce((s, d) => s + d.pasajes, 0)
  const totalEncomiendas = tendencia.reduce((s, d) => s + d.encomiendas, 0)
  const totalIngresos   = tendencia.reduce((s, d) => s + d.ingresos, 0)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Reportes</h1>
        <p className="text-sm text-gray-500">Tendencias y exportación de datos</p>
      </div>

      {/* ── Sección Tendencia ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-[#1F3864]" />
            <h2 className="text-base font-semibold text-gray-900">Tendencia operativa</h2>
          </div>
          {/* Selector de período */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
            {periodos.map(p => (
              <button
                key={p.key}
                onClick={() => setPeriodo(p.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  periodo === p.key
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Resumen KPIs del período */}
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

        {/* Gráfico de barras: pasajes y encomiendas por día */}
        {tendencia.length > 0 ? (
          <>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Pasajes y Encomiendas por día</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={tendencia} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="pasajes" name="Pasajes" fill="#1F3864" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="encomiendas" name="Encomiendas" fill="#0070C0" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Gráfico de línea: ingresos */}
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
                  <Line
                    type="monotone" dataKey="ingresos" name="Ingresos"
                    stroke="#22c55e" strokeWidth={2} dot={{ r: 3, fill: '#22c55e' }} activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <div className="py-8 text-center text-sm text-gray-400">
            No hay datos disponibles para este período
          </div>
        )}
      </div>

      {/* ── Sección Exportar ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">Exportar datos</h2>

        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'ventas' && (
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Desde</label>
              <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Hasta</label>
              <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <Button icon={FileSpreadsheet} loading={loading} onClick={descargar}>
              Descargar Excel
            </Button>
          </div>
        )}

        {tab === 'encomiendas' && (
          <div className="flex gap-3 items-center">
            <Button icon={FileSpreadsheet} loading={loading} onClick={descargar}>
              Descargar todas las encomiendas (Excel)
            </Button>
          </div>
        )}

        {tab === 'caja' && (
          <p className="text-sm text-gray-500">
            Seleccione el turno de caja directamente desde la página de Caja para exportar sus movimientos.
          </p>
        )}
      </div>
    </div>
  )
}
