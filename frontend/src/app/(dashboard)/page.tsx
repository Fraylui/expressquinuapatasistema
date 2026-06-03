'use client'
import React, { useState, useEffect } from 'react'
import useSWR from 'swr'
import { redirect } from 'next/navigation'
import {
  Ticket, Package, DollarSign, TrendingUp, Bus, ArrowRight,
  Activity, Clock, Wifi, Database, Tag, UserCheck, FileText,
  BarChart2, Users, Building2, Settings, ClipboardList,
  PackageSearch, ChevronRight, AlertCircle, CheckCircle,
  MapPin, Calendar,
} from 'lucide-react'
import Link from 'next/link'
import { useAuthStore } from '@/stores/authStore'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

// ─── Tipos ──────────────────────────────────────────────────────────────────
interface ViajeDisponible {
  id: number
  estado: string
  fechaHoraSal: string
  asientosLibres: number
  ruta?: { origen: string; destino: string }
  vehiculo?: { placa: string; tipo: string }
}

interface PromocionVigente {
  id: number
  nombre: string
  tipoDescuento: string
  valor: number
}

const rolLabels: Record<string, string> = {
  SUPER_ADMIN:   'Super Administrador',
  GERENTE:       'Gerente General',
  ADMIN_AGENCIA: 'Jefe de Sucursal',
  OPERADOR:      'Operador',
  CONDUCTOR:     'Conductor',
}

// ─── Módulos completos del sistema ──────────────────────────────────────────
const MODULOS_CONFIG = [
  // OPERACIÓN
  {
    section: 'OPERACIÓN',
    items: [
      { href: '/pasajes',              label: 'Pasajes',         desc: 'Venta y reserva de boletos',          icon: Ticket,        color: 'bg-emerald-500',  modulo: 'VENTAS',       roles: null },
      { href: '/encomiendas',          label: 'Encomiendas',     desc: 'Envíos y paquetes con tracking',      icon: Package,       color: 'bg-blue-500',     modulo: 'ENCOMIENDAS',  roles: null },
      { href: '/encomiendas-externas', label: 'Enc. Externas',   desc: 'Seguimiento de envíos de otras emp.', icon: PackageSearch, color: 'bg-cyan-500',     modulo: 'ENCOMIENDAS',  roles: null },
      { href: '/viajes',               label: 'Viajes',          desc: 'Programación de rutas y horarios',    icon: Bus,           color: 'bg-amber-500',    modulo: null,           roles: null },
      { href: '/caja',                 label: 'Caja',            desc: 'Turnos, ingresos y arqueos',          icon: DollarSign,    color: 'bg-green-600',    modulo: 'CAJA',         roles: null },
      { href: '/manifiestos',          label: 'Manifiestos',     desc: 'Gestión de carga por viaje',          icon: FileText,      color: 'bg-orange-500',   modulo: 'MANIFIESTOS',  roles: null },
      { href: '/clientes',             label: 'Clientes',        desc: 'Base de datos de pasajeros',          icon: UserCheck,     color: 'bg-violet-500',   modulo: null,           roles: ['SUPER_ADMIN','GERENTE','ADMIN_AGENCIA'] },
      { href: '/promociones',          label: 'Promociones',     desc: 'Descuentos y campañas activas',       icon: Tag,           color: 'bg-rose-500',     modulo: null,           roles: ['SUPER_ADMIN','GERENTE','ADMIN_AGENCIA'] },
    ],
  },
  // GESTIÓN
  {
    section: 'GESTIÓN',
    items: [
      { href: '/gerente',     label: 'Panel Gerencial', desc: 'KPIs, COBIT/COSO y análisis ejecutivo',  icon: TrendingUp,    color: 'bg-indigo-600',  modulo: 'REPORTES',      roles: ['SUPER_ADMIN','GERENTE'] },
      { href: '/reportes',    label: 'Reportes',        desc: 'Estadísticas y exportaciones',            icon: BarChart2,     color: 'bg-blue-600',    modulo: 'REPORTES',      roles: null },
      { href: '/usuarios',    label: 'Usuarios',        desc: 'Cuentas y permisos de acceso',            icon: Users,         color: 'bg-slate-600',   modulo: 'USUARIOS',      roles: null },
      { href: '/agencias',    label: 'Agencias',        desc: 'Red de sucursales y sedes',               icon: Building2,     color: 'bg-stone-500',   modulo: 'AGENCIAS',      roles: null },
      { href: '/configuracion',label: 'Configuración',  desc: 'Parámetros y ajustes del sistema',        icon: Settings,      color: 'bg-gray-600',    modulo: 'CONFIGURACION', roles: null },
      { href: '/auditoria',   label: 'Auditoría',       desc: 'Registro de actividad del sistema',       icon: ClipboardList, color: 'bg-red-600',     modulo: 'AUDITORIA',     roles: ['SUPER_ADMIN'] },
    ],
  },
]

// ─── Componente de tarjeta de módulo ────────────────────────────────────────
function ModuloCard({
  href, label, desc, icon: Icon, color, stat,
}: {
  href: string; label: string; desc: string
  icon: React.ElementType; color: string; stat?: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="group relative bg-white dark:bg-[#1e293b] rounded-2xl border border-gray-100 dark:border-[#334155] p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
    >
      {/* Glow sutil en hover */}
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-[0.04] ${color} transition-opacity duration-200`} />

      {/* Ícono */}
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3.5 shrink-0 ${color}`}>
        <Icon size={20} className="text-white" />
      </div>

      {/* Nombre */}
      <p className="font-bold text-gray-900 dark:text-slate-100 text-sm leading-tight">{label}</p>

      {/* Descripción */}
      <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 leading-snug">{desc}</p>

      {/* Stat badge */}
      {stat && <div className="mt-3">{stat}</div>}

      {/* Flecha */}
      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <ArrowRight size={14} className="text-gray-400 dark:text-slate-500" />
      </div>
    </Link>
  )
}

// ─── Tarjeta de viaje compacta ───────────────────────────────────────────────
function ViajeRow({ v }: { v: ViajeDisponible }) {
  const hora = format(new Date(v.fechaHoraSal), 'HH:mm')
  const libres = v.asientosLibres ?? 0
  const urgente = libres <= 2

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50 dark:border-[#293548] last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center shrink-0">
          <Bus size={14} className="text-amber-600 dark:text-amber-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800 dark:text-slate-200 truncate">
            {v.ruta?.origen ?? '—'} → {v.ruta?.destino ?? '—'}
          </p>
          <p className="text-xs text-gray-400 dark:text-slate-500">
            {v.vehiculo?.tipo} · {v.vehiculo?.placa}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-3">
        <span className="text-sm font-bold text-gray-700 dark:text-slate-300 tabular-nums">{hora}</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
          urgente
            ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'
            : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
        }`}>
          {libres} libre{libres !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  )
}

// ─── Stat badge pequeño ─────────────────────────────────────────────────────
function StatBadge({ value, variant = 'green' }: { value: string; variant?: 'green' | 'amber' | 'blue' | 'red' | 'gray' }) {
  const variants = {
    green: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400',
    blue:  'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
    red:   'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400',
    gray:  'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300',
  }
  return (
    <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full ${variants[variant]}`}>
      {value}
    </span>
  )
}

// ─── Página principal ────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, hasModulo } = useAuthStore()

  if (user?.rol === 'CONDUCTOR') redirect('/conductor')

  const [mounted, setMounted] = useState(false)
  const [hora,    setHora]    = useState<string | null>(null)
  const [fecha,   setFecha]   = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
    const update = () => {
      const now = new Date()
      setHora(format(now, 'HH:mm'))
      setFecha(format(now, "EEEE dd 'de' MMMM", { locale: es }))
    }
    update()
    const id = setInterval(update, 10000)
    return () => clearInterval(id)
  }, [])

  const { data: turno }   = useSWR('/api/caja/turno-actual')
  const { data: viajesD } = useSWR('/api/viajes/disponibles')
  const { data: promosD } = useSWR('/api/promociones/vigentes')

  const cajaAbierta   = (turno as any)?.estado === 'ABIERTA'
  const totalIngresos = (turno as any)?.totalIngresos
  const saldoActual   = (turno as any)?.saldoActual
  const viajes: ViajeDisponible[] = (viajesD as any) ?? []
  const promos: PromocionVigente[] = (promosD as any) ?? []

  // Filtrar módulos según rol y permisos
  const puedeVer = (m: { modulo: string | null; roles: string[] | null }) => {
    if (!mounted || !user) return false
    if (m.roles !== null && !m.roles.includes(user.rol)) return false
    if (m.modulo !== null) {
      if (user.rol === 'SUPER_ADMIN') return true
      if (!hasModulo(m.modulo)) return false
    }
    return true
  }

  // Stats dinámicos por módulo
  const moduloStat = (href: string): React.ReactNode => {
    if (href === '/viajes') {
      if (!mounted) return null
      const n = viajes.length
      return n > 0
        ? <StatBadge value={`${n} disponible${n !== 1 ? 's' : ''}`} variant="amber" />
        : <StatBadge value="Sin viajes hoy" variant="gray" />
    }
    if (href === '/caja') {
      if (!mounted) return null
      return cajaAbierta
        ? <StatBadge value="Turno abierto" variant="green" />
        : <StatBadge value="Sin turno" variant="gray" />
    }
    if (href === '/promociones') {
      if (!mounted) return null
      const n = promos.length
      return n > 0
        ? <StatBadge value={`${n} vigente${n !== 1 ? 's' : ''}`} variant="blue" />
        : null
    }
    return null
  }

  return (
    <div className="space-y-6 max-w-6xl">

      {/* ── Banner de bienvenida ────────────────────────────────────────────── */}
      <div className="bg-primary-900 dark:bg-[#064e3b] rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-emerald-300 text-sm capitalize" suppressHydrationWarning>
              {fecha ?? ''}
            </p>
            <h1 className="text-2xl font-bold mt-1">
              Hola, {user?.nombre?.split(' ')[0] ?? 'bienvenido'} 👋
            </h1>
            <p className="text-emerald-300 text-sm mt-0.5">
              {rolLabels[user?.rol ?? ''] ?? user?.rol ?? 'Sistema Express Quinuapata'}
            </p>
          </div>

          <div className="flex items-start gap-6">
            {/* Hora */}
            <div className="text-right">
              <p className="text-4xl font-bold tabular-nums" suppressHydrationWarning>
                {hora ?? '--:--'}
              </p>
              <div className="flex items-center gap-1.5 justify-end mt-1">
                <span className={`w-2 h-2 rounded-full ${cajaAbierta ? 'bg-green-400 animate-pulse' : 'bg-emerald-700'}`} />
                <span className="text-xs text-emerald-400">
                  {cajaAbierta ? `Caja abierta · S/ ${Number(totalIngresos ?? 0).toFixed(2)}` : 'Caja cerrada'}
                </span>
              </div>
            </div>

            {/* Stats rápidas */}
            <div className="flex flex-col gap-1 text-right min-w-[100px]">
              <div className="text-xs text-emerald-400 flex items-center justify-end gap-1.5">
                <Bus size={11} />
                <span suppressHydrationWarning>
                  {mounted ? `${viajes.length} viaje${viajes.length !== 1 ? 's' : ''} hoy` : '—'}
                </span>
              </div>
              <div className="text-xs text-emerald-400 flex items-center justify-end gap-1.5">
                <Tag size={11} />
                <span suppressHydrationWarning>
                  {mounted ? `${promos.length} promo${promos.length !== 1 ? 's' : ''} activa${promos.length !== 1 ? 's' : ''}` : '—'}
                </span>
              </div>
              <div className="text-xs text-emerald-400 flex items-center justify-end gap-1.5">
                <MapPin size={11} />
                <span suppressHydrationWarning>
                  {mounted ? `Agencia #${user?.agenciaId ?? '—'}` : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPIs ─────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Viajes hoy',
            value: mounted ? String(viajes.length) : '—',
            icon: Bus,
            colorIcon: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
            sub: viajes.length > 0 ? `${viajes.reduce((s, v) => s + (v.asientosLibres ?? 0), 0)} asientos libres` : 'Sin programación',
          },
          {
            label: 'Encomiendas',
            value: '—',
            icon: Package,
            colorIcon: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
            sub: 'activas hoy',
          },
          {
            label: 'Ingresos turno',
            value: totalIngresos != null ? `S/ ${Number(totalIngresos).toFixed(2)}` : '—',
            icon: DollarSign,
            colorIcon: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
            sub: cajaAbierta ? 'turno en curso' : 'sin turno activo',
          },
          {
            label: 'Saldo en caja',
            value: saldoActual != null ? `S/ ${Number(saldoActual).toFixed(2)}` : '—',
            icon: TrendingUp,
            colorIcon: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400',
            sub: 'saldo actual',
          },
        ].map(({ label, value, icon: Icon, colorIcon, sub }) => (
          <div key={label} className="bg-white dark:bg-[#1e293b] rounded-xl border border-gray-100 dark:border-[#334155] shadow-sm p-4 flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colorIcon}`}>
              <Icon size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-gray-400 dark:text-slate-500 uppercase tracking-wide">{label}</p>
              <p className="mt-0.5 text-xl font-bold text-gray-900 dark:text-slate-100 tabular-nums">{value}</p>
              <p className="mt-0.5 text-[11px] text-gray-400 dark:text-slate-500">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Módulos del sistema ───────────────────────────────────────────────── */}
      {mounted && MODULOS_CONFIG.map(({ section, items }) => {
        const visibles = items.filter(puedeVer)
        if (visibles.length === 0) return null
        return (
          <div key={section}>
            <div className="flex items-center gap-3 mb-3">
              <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">
                {section}
              </p>
              <div className="flex-1 h-px bg-gray-100 dark:bg-[#293548]" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {visibles.map(m => (
                <ModuloCard
                  key={m.href}
                  href={m.href}
                  label={m.label}
                  desc={m.desc}
                  icon={m.icon}
                  color={m.color}
                  stat={moduloStat(m.href)}
                />
              ))}
            </div>
          </div>
        )
      })}

      {/* ── Viajes de hoy + Estado del sistema ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Viajes del día */}
        <div className="lg:col-span-3 bg-white dark:bg-[#1e293b] rounded-2xl border border-gray-100 dark:border-[#334155] shadow-sm">
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-50 dark:border-[#293548]">
            <div className="flex items-center gap-2">
              <Calendar size={15} className="text-amber-500" />
              <h3 className="text-sm font-bold text-gray-800 dark:text-slate-200">Viajes del día</h3>
              {viajes.length > 0 && (
                <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-semibold px-2 py-0.5 rounded-full">
                  {viajes.length}
                </span>
              )}
            </div>
            <Link href="/viajes" className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium flex items-center gap-1">
              Ver todos <ChevronRight size={12} />
            </Link>
          </div>
          <div className="px-5 py-2 max-h-64 overflow-y-auto">
            {viajes.length === 0 ? (
              <div className="py-8 text-center">
                <Bus size={28} className="mx-auto text-gray-200 dark:text-slate-600 mb-2" />
                <p className="text-sm text-gray-400 dark:text-slate-500">No hay viajes programados hoy</p>
              </div>
            ) : (
              viajes.map(v => <ViajeRow key={v.id} v={v} />)
            )}
          </div>
        </div>

        {/* Estado + Agencia */}
        <div className="lg:col-span-2 space-y-3">

          {/* Estado del sistema */}
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-gray-100 dark:border-[#334155] shadow-sm">
            <div className="flex items-center gap-2 px-5 pt-4 pb-3 border-b border-gray-50 dark:border-[#293548]">
              <Activity size={14} className="text-gray-400 dark:text-slate-500" />
              <h3 className="text-sm font-bold text-gray-700 dark:text-slate-300">Estado del sistema</h3>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-[#293548]">
              {[
                { label: 'Base de datos', icon: Database, status: 'ok' as const },
                { label: 'Servidor API',  icon: Wifi,     status: 'ok' as const },
                { label: 'Turno de caja', icon: Clock,    status: cajaAbierta ? 'open' : 'closed' as const },
              ].map(({ label, icon: Icon, status }) => (
                <div key={label} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-2.5 text-sm text-gray-600 dark:text-slate-400">
                    <Icon size={13} className="text-gray-400 dark:text-slate-500" />
                    {label}
                  </div>
                  {status === 'ok' ? (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Activo
                    </span>
                  ) : status === 'open' ? (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle size={12} /> Abierta
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 dark:text-slate-500">
                      <AlertCircle size={12} /> Cerrada
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Agencia + Promos */}
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-gray-100 dark:border-[#334155] shadow-sm p-5">
            <p className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2">Tu agencia</p>
            <p className="text-sm font-bold text-gray-800 dark:text-slate-200" suppressHydrationWarning>
              Agencia #{user?.agenciaId ?? '—'}
            </p>
            <Link
              href="/viajes"
              className="mt-1.5 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
            >
              Ver viajes del día <ArrowRight size={11} />
            </Link>

            {promos.length > 0 && (
              <>
                <div className="my-3 h-px bg-gray-50 dark:bg-[#293548]" />
                <p className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2">Promos activas</p>
                <div className="space-y-1.5">
                  {promos.slice(0, 3).map(p => (
                    <div key={p.id} className="flex items-center justify-between text-xs">
                      <span className="text-gray-700 dark:text-slate-300 font-medium truncate">{p.nombre}</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold shrink-0 ml-2">
                        {p.tipoDescuento === 'MONTO_FIJO' ? `S/ ${p.valor}` : `${p.valor}%`}
                      </span>
                    </div>
                  ))}
                  {promos.length > 3 && (
                    <Link href="/promociones" className="text-xs text-gray-400 dark:text-slate-500 hover:underline">
                      +{promos.length - 3} más...
                    </Link>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
