'use client'
import React, { useState, useEffect } from 'react'
import useSWR from 'swr'
import { redirect } from 'next/navigation'
import {
  Ticket, Package, DollarSign, TrendingUp,
  Bus, ArrowRight, ChevronRight, Activity,
  Clock, Wifi, Database, Plus,
} from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { useAuthStore } from '@/stores/authStore'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const rolLabels: Record<string, string> = {
  SUPER_ADMIN: 'Super Administrador',
  GERENTE:     'Gerente General',
  OPERADOR:    'Operador',
  CONDUCTOR:   'Conductor',
}

type KPIColor = 'blue' | 'green' | 'indigo' | 'emerald'

const kpiColors: Record<KPIColor, string> = {
  blue:    'bg-blue-50 text-blue-600',
  green:   'bg-green-50 text-green-600',
  indigo:  'bg-indigo-50 text-indigo-600',
  emerald: 'bg-emerald-50 text-emerald-600',
}

function KPICard({
  label, value, icon: Icon, color, sub,
}: {
  label: string; value: string; icon: React.ElementType; color: KPIColor; sub?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${kpiColors[color]}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="mt-0.5 text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  )
}

function QuickAction({
  href, label, icon: Icon, description, colorClass,
}: {
  href: string; label: string; icon: React.ElementType; description: string; colorClass: string
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-primary-200 hover:shadow-sm bg-white transition-all"
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}>
        <Icon size={18} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>
      <ChevronRight size={16} className="text-gray-300 group-hover:text-primary-500 transition-colors shrink-0" />
    </Link>
  )
}

export default function DashboardPage() {
  const { user, hasModulo } = useAuthStore()
  const { data: turno } = useSWR('/api/caja/turno-actual')

  // Redirige a vista especializada si el rol lo requiere
  if (user?.rol === 'CONDUCTOR') {
    redirect('/conductor')
  }

  const [hora, setHora] = useState<string | null>(null)
  const [fecha, setFecha] = useState<string | null>(null)

  useEffect(() => {
    const update = () => {
      const now = new Date()
      setHora(format(now, 'HH:mm'))
      setFecha(format(now, "EEEE dd 'de' MMMM", { locale: es }))
    }
    update()
    const id = setInterval(update, 10000)
    return () => clearInterval(id)
  }, [])

  const totalIngresos = (turno as any)?.totalIngresos ?? null
  const saldoActual   = (turno as any)?.saldoActual ?? null
  const cajaAbierta   = (turno as any)?.estado === 'ABIERTA'

  const kpis = [
    { label: 'Pasajes vendidos', value: '—', icon: Ticket,    color: 'blue'    as KPIColor, sub: 'en este turno' },
    { label: 'Encomiendas',      value: '—', icon: Package,   color: 'emerald' as KPIColor, sub: 'activas hoy' },
    { label: 'Ingresos turno',   value: totalIngresos != null ? `S/ ${Number(totalIngresos).toFixed(2)}` : '—', icon: DollarSign, color: 'green' as KPIColor, sub: cajaAbierta ? 'caja abierta' : 'sin turno' },
    { label: 'Saldo actual',     value: saldoActual != null ? `S/ ${Number(saldoActual).toFixed(2)}` : '—',     icon: TrendingUp, color: 'indigo' as KPIColor, sub: 'en caja' },
  ]

  const acciones = [
    { href: '/pasajes',     label: 'Vender pasaje',    icon: Ticket,    description: 'Buscar viaje y seleccionar asiento',      colorClass: 'bg-primary-900', modulo: 'VENTAS' },
    { href: '/encomiendas', label: 'Nueva encomienda', icon: Package,   description: 'Registrar paquete con código tracking',    colorClass: 'bg-emerald-600', modulo: 'ENCOMIENDAS' },
    { href: '/caja',        label: 'Ir a caja',        icon: DollarSign,description: cajaAbierta ? 'Turno en curso' : 'Abrir turno de trabajo', colorClass: cajaAbierta ? 'bg-green-600' : 'bg-gray-500', modulo: 'CAJA' },
    { href: '/viajes',      label: 'Ver viajes',       icon: Bus,       description: 'Programación del día',                    colorClass: 'bg-accent',      modulo: null },
    { href: '/gerente',     label: 'Panel gerencial',  icon: TrendingUp,description: 'KPIs, reportes COBIT/COSO',               colorClass: 'bg-indigo-600',  modulo: 'REPORTES' },
  ]

  const accionesFiltradas = acciones.filter(a =>
    a.modulo === null ? true : hasModulo(a.modulo)
  )

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Banner bienvenida */}
      <div className="bg-primary-900 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-primary-300 text-sm capitalize" suppressHydrationWarning>
              {fecha ?? ''}
            </p>
            <h1 className="text-2xl font-bold mt-1">
              Hola, {user?.nombre?.split(' ')[0] ?? 'bienvenido'} 👋
            </h1>
            <p className="text-primary-300 text-sm mt-1">
              {rolLabels[user?.rol ?? ''] ?? user?.rol ?? 'Sistema Express Quinuapata'}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-4xl font-bold tabular-nums" suppressHydrationWarning>
              {hora ?? '--:--'}
            </p>
            <div className="flex items-center gap-2 justify-end mt-1.5">
              <span className={`w-2 h-2 rounded-full ${cajaAbierta ? 'bg-green-400 animate-pulse' : 'bg-primary-600'}`} />
              <span className="text-xs text-primary-400">
                {cajaAbierta ? 'Caja abierta' : 'Caja cerrada'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map(k => <KPICard key={k.label} {...k} />)}
      </div>

      {/* Acciones rápidas + Estado */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Acciones */}
        <div className="lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
            <Plus size={14} className="text-gray-400" />
            Acciones rápidas
          </h3>
          <div className="space-y-2">
            {accionesFiltradas.map(a => (
              <QuickAction key={a.href} {...a} />
            ))}
          </div>
        </div>

        {/* Estado */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-600 flex items-center gap-2">
            <Activity size={14} className="text-gray-400" />
            Estado del sistema
          </h3>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            {[
              { label: 'Base de datos', icon: Database, ok: true, badge: null },
              { label: 'Servidor API',  icon: Wifi,     ok: true, badge: null },
              { label: 'Turno de caja', icon: Clock,    ok: cajaAbierta, badge: cajaAbierta ? 'ABIERTA' : 'CERRADA' },
            ].map(({ label, icon: Icon, ok, badge }) => (
              <div key={label} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5 text-sm text-gray-600">
                  <Icon size={14} className="text-gray-400" />
                  {label}
                </div>
                {badge
                  ? <Badge estado={badge} />
                  : <span className="flex items-center gap-1.5 text-xs font-medium text-green-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      Activo
                    </span>
                }
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Tu agencia</p>
            <p className="mt-1 text-sm font-semibold text-gray-800" suppressHydrationWarning>
              Agencia #{user?.agenciaId ?? '—'}
            </p>
            <Link
              href="/viajes"
              className="mt-2 flex items-center gap-1 text-xs text-accent-700 hover:underline font-medium"
            >
              Ver viajes del día <ArrowRight size={11} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
