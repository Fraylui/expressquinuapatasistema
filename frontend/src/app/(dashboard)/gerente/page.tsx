'use client'
import React from 'react'
import useSWR from 'swr'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line,
} from 'recharts'
import {
  Ticket, Package, DollarSign, ShieldCheck,
  AlertTriangle, TrendingUp, Activity, FileText,
  Download,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import api from '@/services/api'
import toast from 'react-hot-toast'

interface KPIs {
  pasajesHoy: number
  ingresosHoy: number
  encomiendaActivas: number
  cajasAbiertas: number
  auditoriaHoy: number
  fechaHora: string
}

type KPIColor = 'blue' | 'green' | 'emerald' | 'indigo' | 'amber' | 'red'

const colorMap: Record<KPIColor, { bg: string; text: string; badge: string }> = {
  blue:    { bg: 'bg-blue-50',    text: 'text-blue-600',    badge: 'bg-blue-100 text-blue-700' },
  green:   { bg: 'bg-green-50',   text: 'text-green-600',   badge: 'bg-green-100 text-green-700' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700' },
  indigo:  { bg: 'bg-indigo-50',  text: 'text-indigo-600',  badge: 'bg-indigo-100 text-indigo-700' },
  amber:   { bg: 'bg-amber-50',   text: 'text-amber-600',   badge: 'bg-amber-100 text-amber-700' },
  red:     { bg: 'bg-red-50',     text: 'text-red-600',     badge: 'bg-red-100 text-red-700' },
}

function KPICard({
  label, value, sub, icon: Icon, color, marco,
}: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; color: KPIColor; marco?: string
}) {
  const c = colorMap[color]
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.bg}`}>
          <Icon size={18} className={c.text} />
        </div>
        {marco && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${c.badge} uppercase tracking-wide`}>
            {marco}
          </span>
        )}
      </div>
      <div>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="mt-0.5 text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
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

const ventasMock = [
  { hora: '05:00', pasajes: 3, ingresos: 165 },
  { hora: '06:00', pasajes: 8, ingresos: 440 },
  { hora: '07:00', pasajes: 12, ingresos: 660 },
  { hora: '08:00', pasajes: 5, ingresos: 275 },
  { hora: '09:00', pasajes: 7, ingresos: 385 },
  { hora: '10:00', pasajes: 4, ingresos: 220 },
  { hora: '11:00', pasajes: 9, ingresos: 495 },
  { hora: '12:00', pasajes: 6, ingresos: 330 },
]

export default function GerentePage() {
  const { data: kpisData } = useSWR('/api/reportes/kpis', { refreshInterval: 60_000 })
  const { data: auditoriaData } = useSWR('/api/auditoria/resumen', { refreshInterval: 60_000 })

  const kpis = kpisData as KPIs | undefined
  const auditoria = auditoriaData as any

  const descargarExcel = async (tipo: string) => {
    const hoy = new Date().toISOString().split('T')[0]
    try {
      const blob = await api.get(
        `/api/reportes/${tipo}/excel?desde=${hoy}T00:00:00&hasta=${hoy}T23:59:59`,
        { responseType: 'blob' }
      ) as unknown as Blob
      const href = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = href; a.download = `${tipo}-${hoy}.xlsx`; a.click()
      URL.revokeObjectURL(href)
      toast.success('Reporte descargado')
    } catch {
      toast.error('Error al generar reporte')
    }
  }

  return (
    <div className="space-y-6 max-w-6xl">

      {/* Encabezado con marco */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard Gerencial</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Métricas de control interno — COBIT 2019 · COSO · ISO 27001
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={Download}
            onClick={() => descargarExcel('ventas')}>
            Pasajes Excel
          </Button>
          <Button variant="secondary" size="sm" icon={FileText}
            onClick={() => descargarExcel('encomiendas')}>
            Encomiendas
          </Button>
          <Link href="/auditoria">
            <Button variant="secondary" size="sm" icon={ShieldCheck}>
              Auditoría
            </Button>
          </Link>
        </div>
      </div>

      {/* KPIs principales — COBIT MEA01 + COSO */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard
          label="Pasajes hoy"
          value={kpis?.pasajesHoy ?? '—'}
          sub="emitidos en este turno"
          icon={Ticket} color="blue" marco="COSO"
        />
        <KPICard
          label="Ingresos hoy"
          value={kpis ? `S/ ${Number(kpis.ingresosHoy ?? 0).toFixed(2)}` : '—'}
          sub="movimientos de caja"
          icon={DollarSign} color="green" marco="COSO"
        />
        <KPICard
          label="Encomiendas activas"
          value={kpis?.encomiendaActivas ?? '—'}
          sub="en tránsito"
          icon={Package} color="emerald" marco="ITIL"
        />
        <KPICard
          label="Cajas abiertas"
          value={kpis?.cajasAbiertas ?? '—'}
          sub="turnos en curso"
          icon={TrendingUp} color="indigo" marco="COSO"
        />
        <KPICard
          label="Auditoría hoy"
          value={kpis?.auditoriaHoy ?? '—'}
          sub="eventos registrados"
          icon={Activity} color="amber" marco="COBIT"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Gráfico de ventas por hora */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Ventas por hora</h3>
              <p className="text-xs text-gray-400">Pasajes e ingresos — hoy</p>
            </div>
            <span className="text-[10px] font-bold bg-[#1F3864] text-white px-1.5 py-0.5 rounded uppercase">
              COBIT MEA01
            </span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={ventasMock} barSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="hora" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
              />
              <Bar yAxisId="left" dataKey="pasajes" fill="#1F3864" radius={[3,3,0,0]} name="Pasajes" />
              <Bar yAxisId="right" dataKey="ingresos" fill="#0070C0" radius={[3,3,0,0]} name="S/ Ingresos" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Panel de control de marcos */}
        <div className="space-y-3">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <ShieldCheck size={14} className="text-[#1F3864]" />
              Estado de controles
            </h3>
            <div className="space-y-2">
              <MarcoTag
                marco="COSO"
                descripcion="Descuentos limitados por rol (OPERADOR S/5, SUPERVISOR S/10, GERENTE sin límite)"
              />
              <MarcoTag
                marco="ISO 27001"
                descripcion="Auditoría inmutable activa — todos los eventos registrados con IP y timestamp"
              />
              <MarcoTag
                marco="OWASP"
                descripcion="Rate limiting activo — máx 5 intentos de login por IP por minuto"
              />
              <MarcoTag
                marco="COBIT"
                descripcion="Multi-agencia: cada usuario solo accede a datos de su agencia"
              />
            </div>
          </div>

          {/* Auditoría resumen */}
          {auditoria && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Bitácora hoy</h3>
              <div className="space-y-2">
                {[
                  { label: 'Total eventos', value: auditoria.total ?? 0, color: 'text-gray-900' },
                  { label: 'Creaciones',    value: auditoria.inserts ?? 0, color: 'text-blue-600' },
                  { label: 'Modificaciones',value: auditoria.updates ?? 0, color: 'text-amber-600' },
                  { label: 'Eliminaciones', value: auditoria.deletes ?? 0, color: 'text-red-600' },
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

      {/* Accesos rápidos CAATs */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <FileText size={15} className="text-[#1F3864]" />
          <h3 className="text-sm font-semibold text-gray-800">Exportar para auditoría</h3>
          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded uppercase ml-auto">
            CAATs
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Ventas del día',   tipo: 'ventas',      icon: Ticket  },
            { label: 'Encomiendas',      tipo: 'encomiendas', icon: Package },
            { label: 'Movimientos caja', tipo: 'caja',        icon: DollarSign },
          ].map(({ label, tipo, icon: Icon }) => (
            <button key={tipo}
              onClick={() => descargarExcel(tipo)}
              className="flex flex-col items-center gap-2 p-4 border border-gray-200 rounded-xl hover:border-[#0070C0] hover:bg-blue-50 transition-all group">
              <div className="w-9 h-9 rounded-lg bg-gray-100 group-hover:bg-[#1F3864] flex items-center justify-center transition-colors">
                <Icon size={16} className="text-gray-500 group-hover:text-white" />
              </div>
              <span className="text-xs font-medium text-gray-600 text-center">{label}</span>
              <Download size={11} className="text-gray-400" />
            </button>
          ))}
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
