'use client'
import React, { useState, useEffect } from 'react'
import useSWR from 'swr'
import { redirect } from 'next/navigation'
import {
  Ticket, Package, DollarSign, TrendingUp, Bus, ArrowRight,
  Activity, Clock, Wifi, Database, Tag, UserCheck, FileText,
  BarChart2, Users, Building2, Settings, ClipboardList,
  PackageSearch, ChevronRight, AlertCircle, CheckCircle,
  MapPin, Plus, Zap, LayoutGrid, RefreshCw,
} from 'lucide-react'
import Link from 'next/link'
import { useAuthStore } from '@/stores/authStore'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface ViajeDisponible {
  id: number
  estado: string
  fechaHoraSal: string
  asientosLibres: number
  totalAsientos?: number
  ruta?: { origen: string; destino: string }
  vehiculo?: { placa: string; tipo: string; numAsientos?: number }
}
interface PromocionVigente {
  id: number; nombre: string; tipoDescuento: string; valor: number
}

const rolLabels: Record<string, string> = {
  SUPER_ADMIN:   'Super Administrador',
  GERENTE:       'Gerente General',
  ADMIN_AGENCIA: 'Jefe de Sucursal',
  OPERADOR:      'Operador',
  CONDUCTOR:     'Conductor',
}

// ─── Módulos del sistema ──────────────────────────────────────────────────────
const MODULOS_CONFIG = [
  {
    section: 'OPERACIÓN',
    items: [
      { href: '/pasajes',              label: 'Pasajes',         desc: 'Venta y reserva de boletos',          icon: Ticket,        bg: 'bg-emerald-500',  light: 'bg-emerald-50 dark:bg-emerald-900/20',  text: 'text-emerald-600 dark:text-emerald-400',  modulo: 'VENTAS',       roles: null },
      { href: '/encomiendas',          label: 'Encomiendas',     desc: 'Envíos y paquetes con tracking',      icon: Package,       bg: 'bg-blue-500',     light: 'bg-blue-50 dark:bg-blue-900/20',        text: 'text-blue-600 dark:text-blue-400',        modulo: 'ENCOMIENDAS',  roles: null },
      { href: '/encomiendas-externas', label: 'Enc. Externas',   desc: 'Seguimiento de envíos externos',      icon: PackageSearch,  bg: 'bg-cyan-500',     light: 'bg-cyan-50 dark:bg-cyan-900/20',        text: 'text-cyan-600 dark:text-cyan-400',        modulo: 'ENCOMIENDAS',  roles: null },
      { href: '/viajes',               label: 'Viajes',          desc: 'Rutas, horarios y asientos',          icon: Bus,           bg: 'bg-amber-500',    light: 'bg-amber-50 dark:bg-amber-900/20',      text: 'text-amber-600 dark:text-amber-400',      modulo: null,           roles: null },
      { href: '/caja',                 label: 'Caja',            desc: 'Turnos, ingresos y arqueos',          icon: DollarSign,    bg: 'bg-green-600',    light: 'bg-green-50 dark:bg-green-900/20',      text: 'text-green-600 dark:text-green-400',      modulo: 'CAJA',         roles: null },
      { href: '/manifiestos',          label: 'Manifiestos',     desc: 'Gestión de carga por viaje',          icon: FileText,      bg: 'bg-orange-500',   light: 'bg-orange-50 dark:bg-orange-900/20',    text: 'text-orange-600 dark:text-orange-400',    modulo: 'MANIFIESTOS',  roles: null },
      { href: '/clientes',             label: 'Clientes',        desc: 'Base de datos de pasajeros',          icon: UserCheck,     bg: 'bg-violet-500',   light: 'bg-violet-50 dark:bg-violet-900/20',    text: 'text-violet-600 dark:text-violet-400',    modulo: null,           roles: ['SUPER_ADMIN','GERENTE','ADMIN_AGENCIA'] },
      { href: '/promociones',          label: 'Promociones',     desc: 'Descuentos y campañas activas',       icon: Tag,           bg: 'bg-rose-500',     light: 'bg-rose-50 dark:bg-rose-900/20',        text: 'text-rose-600 dark:text-rose-400',        modulo: null,           roles: ['SUPER_ADMIN','GERENTE','ADMIN_AGENCIA'] },
    ],
  },
  {
    section: 'GESTIÓN',
    items: [
      { href: '/gerente',      label: 'Panel Gerencial', desc: 'KPIs, COBIT/COSO y análisis',   icon: TrendingUp,  bg: 'bg-indigo-600',  light: 'bg-indigo-50 dark:bg-indigo-900/20',  text: 'text-indigo-600 dark:text-indigo-400',  modulo: 'REPORTES',      roles: ['SUPER_ADMIN','GERENTE'] },
      { href: '/reportes',     label: 'Reportes',        desc: 'Estadísticas y exportaciones',  icon: BarChart2,   bg: 'bg-blue-600',    light: 'bg-blue-50 dark:bg-blue-900/20',      text: 'text-blue-700 dark:text-blue-400',      modulo: 'REPORTES',      roles: null },
      { href: '/usuarios',     label: 'Usuarios',        desc: 'Cuentas y permisos de acceso',  icon: Users,       bg: 'bg-slate-600',   light: 'bg-slate-50 dark:bg-slate-800',       text: 'text-slate-600 dark:text-slate-400',    modulo: 'USUARIOS',      roles: null },
      { href: '/agencias',     label: 'Agencias',        desc: 'Red de sucursales y sedes',     icon: Building2,   bg: 'bg-stone-500',   light: 'bg-stone-50 dark:bg-stone-900/20',    text: 'text-stone-600 dark:text-stone-400',    modulo: 'AGENCIAS',      roles: null },
      { href: '/configuracion',label: 'Configuración',   desc: 'Parámetros del sistema',        icon: Settings,    bg: 'bg-gray-600',    light: 'bg-gray-50 dark:bg-gray-800',         text: 'text-gray-600 dark:text-gray-400',      modulo: 'CONFIGURACION', roles: null },
      { href: '/auditoria',    label: 'Auditoría',       desc: 'Registro de actividad',         icon: ClipboardList,bg: 'bg-red-600',    light: 'bg-red-50 dark:bg-red-900/20',        text: 'text-red-600 dark:text-red-400',        modulo: 'AUDITORIA',     roles: ['SUPER_ADMIN'] },
    ],
  },
]

// ─── Tarjeta de módulo ────────────────────────────────────────────────────────
function ModuloCard({
  href, label, desc, icon: Icon, bg, light, text, stat,
}: {
  href: string; label: string; desc: string
  icon: React.ElementType; bg: string; light: string; text: string
  stat?: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={`group relative flex flex-col bg-white dark:bg-[#1e293b] rounded-2xl border border-gray-100 dark:border-[#334155] p-5 hover:shadow-xl hover:-translate-y-1 transition-all duration-200 overflow-hidden min-h-[150px]`}
    >
      {/* Borde superior de color */}
      <div className={`absolute top-0 left-0 right-0 h-[3px] ${bg} rounded-t-2xl`} />

      {/* Fondo tintado muy sutil */}
      <div className={`absolute inset-0 opacity-[0.035] ${bg}`} />

      {/* Ícono */}
      <div className={`relative w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${light}`}>
        <Icon size={22} className={text} />
      </div>

      {/* Contenido */}
      <div className="relative flex-1 flex flex-col">
        <p className="font-bold text-gray-900 dark:text-slate-100 text-sm">{label}</p>
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 leading-snug flex-1">{desc}</p>
        {stat && <div className="mt-2.5">{stat}</div>}
      </div>

      {/* Flecha hover */}
      <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-150 translate-x-1 group-hover:translate-x-0">
        <div className={`w-6 h-6 rounded-full ${light} flex items-center justify-center`}>
          <ArrowRight size={12} className={text} />
        </div>
      </div>
    </Link>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({
  label, value, icon: Icon, iconBg, iconText, borderColor, sub, action,
}: {
  label: string; value: string; icon: React.ElementType
  iconBg: string; iconText: string; borderColor: string
  sub: string; action?: { label: string; href: string }
}) {
  return (
    <div className={`bg-white dark:bg-[#1e293b] rounded-xl border border-gray-100 dark:border-[#334155] shadow-sm p-4 flex flex-col gap-3 border-l-[4px] ${borderColor}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">{label}</p>
          <p className="mt-1 text-2xl font-extrabold text-gray-900 dark:text-slate-100 tabular-nums leading-none">{value}</p>
          <p className="mt-1 text-[11px] text-gray-400 dark:text-slate-500">{sub}</p>
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon size={18} className={iconText} />
        </div>
      </div>
      {action && (
        <Link href={action.href}
          className={`text-xs font-semibold ${iconText} hover:underline flex items-center gap-1`}>
          {action.label} <ArrowRight size={10} />
        </Link>
      )}
    </div>
  )
}

// ─── Stat badge ───────────────────────────────────────────────────────────────
function Chip({ value, variant = 'green' }: { value: string; variant?: 'green' | 'amber' | 'blue' | 'red' | 'gray' | 'rose' }) {
  const v = {
    green: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400',
    blue:  'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
    red:   'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
    rose:  'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400',
    gray:  'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300',
  }
  return (
    <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full ${v[variant]}`}>
      {value}
    </span>
  )
}

// ─── Fila de viaje ────────────────────────────────────────────────────────────
function ViajeRow({ v }: { v: ViajeDisponible }) {
  const hora    = format(new Date(v.fechaHoraSal), 'HH:mm')
  const libres  = v.asientosLibres ?? 0
  const total   = v.vehiculo?.numAsientos ?? v.totalAsientos ?? 15
  const pct     = Math.max(0, Math.min(100, Math.round(((total - libres) / total) * 100)))
  const urgente = libres <= 2
  const barColor = urgente ? 'bg-red-400' : libres <= Math.ceil(total * 0.3) ? 'bg-amber-400' : 'bg-emerald-400'

  return (
    <div className="py-3 border-b border-gray-50 dark:border-[#293548] last:border-0">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center shrink-0">
            <Bus size={13} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-800 dark:text-slate-200 truncate leading-tight">
              {v.ruta?.origen ?? '—'} → {v.ruta?.destino ?? '—'}
            </p>
            <p className="text-[11px] text-gray-400 dark:text-slate-500">
              {v.vehiculo?.tipo} · {v.vehiculo?.placa}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          <span className="text-sm font-bold text-gray-700 dark:text-slate-300 tabular-nums">{hora}</span>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
            urgente
              ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'
              : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
          }`}>
            {libres} libre{libres !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
      {/* Barra de ocupación */}
      <div className="h-1.5 bg-gray-100 dark:bg-[#293548] rounded-full overflow-hidden ml-9">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-gray-400 dark:text-slate-600 ml-9 mt-0.5">
        {pct}% ocupado · {total - libres}/{total} asientos
      </p>
    </div>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────
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
  const { data: viajesD, mutate: mutateViajes } = useSWR('/api/viajes/disponibles')
  const { data: promosD } = useSWR('/api/promociones/vigentes')

  const cajaAbierta   = (turno as any)?.estado === 'ABIERTA'
  const totalIngresos = (turno as any)?.totalIngresos
  const saldoActual   = (turno as any)?.saldoActual
  const viajes: ViajeDisponible[] = (viajesD as any) ?? []
  const promos: PromocionVigente[] = (promosD as any) ?? []
  const totalLibres = viajes.reduce((s, v) => s + (v.asientosLibres ?? 0), 0)

  // Filtro de módulos
  const puedeVer = (m: { modulo: string | null; roles: string[] | null }) => {
    if (!mounted || !user) return false
    if (m.roles !== null && !m.roles.includes(user.rol)) return false
    if (m.modulo !== null) {
      if (user.rol === 'SUPER_ADMIN') return true
      return hasModulo(m.modulo)
    }
    return true
  }

  // Stats por módulo
  const moduloStat = (href: string): React.ReactNode => {
    if (!mounted) return null
    if (href === '/viajes') {
      return viajes.length > 0
        ? <Chip value={`${viajes.length} disponible${viajes.length !== 1 ? 's' : ''}`} variant="amber" />
        : <Chip value="Sin viajes hoy" variant="gray" />
    }
    if (href === '/caja') {
      return cajaAbierta
        ? <Chip value="Turno abierto" variant="green" />
        : <Chip value="Sin turno" variant="gray" />
    }
    if (href === '/promociones') {
      return promos.length > 0
        ? <Chip value={`${promos.length} vigente${promos.length !== 1 ? 's' : ''}`} variant="rose" />
        : null
    }
    return null
  }

  // Acciones rápidas (las más usadas operativamente)
  const acciones = [
    { href: '/pasajes',     label: 'Nuevo pasaje',    icon: Ticket,     color: 'bg-emerald-500',  modulo: 'VENTAS' },
    { href: '/encomiendas', label: 'Encomienda',      icon: Package,    color: 'bg-blue-500',     modulo: 'ENCOMIENDAS' },
    { href: '/caja',        label: 'Ir a caja',       icon: DollarSign, color: 'bg-green-600',    modulo: 'CAJA' },
    { href: '/viajes',      label: 'Ver viajes',      icon: Bus,        color: 'bg-amber-500',    modulo: null },
    { href: '/manifiestos', label: 'Manifiesto',      icon: FileText,   color: 'bg-orange-500',   modulo: 'MANIFIESTOS' },
  ]

  return (
    <div className="space-y-5 max-w-6xl">

      {/* ── Banner ─────────────────────────────────────────────────────────── */}
      <div className="relative bg-primary-900 dark:bg-[#064e3b] rounded-2xl p-6 text-white shadow-lg overflow-hidden">
        {/* Patrón decorativo */}
        <div className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '28px 28px' }}
        />
        {/* Círculo decorativo */}
        <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-white/[0.04]" />
        <div className="absolute -right-6 top-8 w-32 h-32 rounded-full bg-white/[0.05]" />

        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-emerald-300 text-sm capitalize font-medium" suppressHydrationWarning>
              {fecha ?? ''}
            </p>
            <h1 className="text-2xl font-bold mt-0.5">
              Hola, {user?.nombre?.split(' ')[0] ?? 'bienvenido'} 👋
            </h1>
            <p className="text-emerald-300/80 text-sm mt-0.5">
              {rolLabels[user?.rol ?? ''] ?? user?.rol ?? 'Sistema Express Quinuapata'}
            </p>

            {/* Badges inline */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="flex items-center gap-1.5 text-xs bg-white/10 px-2.5 py-1 rounded-full font-medium">
                <MapPin size={11} className="text-emerald-300" />
                <span suppressHydrationWarning>Agencia #{user?.agenciaId ?? '—'}</span>
              </span>
              <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${
                cajaAbierta ? 'bg-green-400/20 text-green-200' : 'bg-white/10 text-white/70'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cajaAbierta ? 'bg-green-300 animate-pulse' : 'bg-white/40'}`} />
                {cajaAbierta ? 'Caja abierta' : 'Caja cerrada'}
              </span>
              {mounted && viajes.length > 0 && (
                <span className="flex items-center gap-1.5 text-xs bg-amber-400/20 text-amber-200 px-2.5 py-1 rounded-full font-medium">
                  <Bus size={11} /> {viajes.length} viaje{viajes.length !== 1 ? 's' : ''} hoy
                </span>
              )}
              {mounted && promos.length > 0 && (
                <span className="flex items-center gap-1.5 text-xs bg-rose-400/20 text-rose-200 px-2.5 py-1 rounded-full font-medium">
                  <Tag size={11} /> {promos.length} promo{promos.length !== 1 ? 's' : ''} activa{promos.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>

          {/* Hora grande */}
          <div className="text-right shrink-0">
            <p className="text-5xl font-black tabular-nums tracking-tight" suppressHydrationWarning>
              {hora ?? '--:--'}
            </p>
            {cajaAbierta && totalIngresos != null && (
              <p className="text-sm text-emerald-300 mt-1 font-semibold">
                S/ {Number(totalIngresos).toFixed(2)} recaudados
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Acciones rápidas ─────────────────────────────────────────────────── */}
      {mounted && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 mr-1">
            <Zap size={13} className="text-gray-400 dark:text-slate-500" />
            <span className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-widest">
              Rápido
            </span>
          </div>
          {acciones
            .filter(a => a.modulo === null ? true : (user?.rol === 'SUPER_ADMIN' || hasModulo(a.modulo)))
            .map(a => (
              <Link key={a.href} href={a.href}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-gray-200 dark:border-[#334155] bg-white dark:bg-[#1e293b] hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 text-sm font-semibold text-gray-700 dark:text-slate-300 group"
              >
                <div className={`w-5 h-5 rounded-md flex items-center justify-center ${a.color}`}>
                  <a.icon size={12} className="text-white" />
                </div>
                {a.label}
              </Link>
            ))
          }
          <button
            onClick={() => mutateViajes()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-[#334155] text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300 hover:bg-gray-50 dark:hover:bg-[#293548] transition-all text-xs font-medium ml-auto"
            title="Actualizar datos"
          >
            <RefreshCw size={12} /> Actualizar
          </button>
        </div>
      )}

      {/* ── KPIs ─────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          label="Viajes hoy"
          value={mounted ? String(viajes.length) : '—'}
          icon={Bus}
          iconBg="bg-amber-50 dark:bg-amber-900/20"
          iconText="text-amber-600 dark:text-amber-400"
          borderColor="border-l-amber-400"
          sub={mounted && totalLibres > 0 ? `${totalLibres} asientos libres` : 'sin programación'}
          action={viajes.length > 0 ? { label: 'Ver todos', href: '/viajes' } : undefined}
        />
        <KPICard
          label="Encomiendas"
          value="—"
          icon={Package}
          iconBg="bg-blue-50 dark:bg-blue-900/20"
          iconText="text-blue-600 dark:text-blue-400"
          borderColor="border-l-blue-400"
          sub="activas hoy"
          action={{ label: 'Ir a encomiendas', href: '/encomiendas' }}
        />
        <KPICard
          label="Ingresos turno"
          value={totalIngresos != null ? `S/ ${Number(totalIngresos).toFixed(2)}` : '—'}
          icon={DollarSign}
          iconBg="bg-emerald-50 dark:bg-emerald-900/20"
          iconText="text-emerald-600 dark:text-emerald-400"
          borderColor="border-l-emerald-400"
          sub={cajaAbierta ? 'turno en curso' : 'sin turno activo'}
          action={!cajaAbierta ? { label: 'Abrir turno', href: '/caja' } : { label: 'Ver caja', href: '/caja' }}
        />
        <KPICard
          label="Saldo en caja"
          value={saldoActual != null ? `S/ ${Number(saldoActual).toFixed(2)}` : '—'}
          icon={TrendingUp}
          iconBg="bg-indigo-50 dark:bg-indigo-900/20"
          iconText="text-indigo-600 dark:text-indigo-400"
          borderColor="border-l-indigo-400"
          sub="saldo actual"
        />
      </div>

      {/* ── Grid de módulos ───────────────────────────────────────────────────── */}
      {mounted && MODULOS_CONFIG.map(({ section, items }) => {
        const visibles = items.filter(puedeVer)
        if (visibles.length === 0) return null
        return (
          <div key={section}>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center gap-2">
                <LayoutGrid size={13} className="text-gray-400 dark:text-slate-500" />
                <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">
                  {section}
                </p>
              </div>
              <div className="flex-1 h-px bg-gray-100 dark:bg-[#293548]" />
              <span className="text-[11px] text-gray-300 dark:text-slate-600 font-medium">
                {visibles.length} módulos
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {visibles.map(m => (
                <ModuloCard
                  key={m.href}
                  href={m.href}
                  label={m.label}
                  desc={m.desc}
                  icon={m.icon}
                  bg={m.bg}
                  light={m.light}
                  text={m.text}
                  stat={moduloStat(m.href)}
                />
              ))}
            </div>
          </div>
        )
      })}

      {/* ── Sección inferior: Viajes del día + Sistema + Promos ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Viajes del día */}
        <div className="lg:col-span-3 bg-white dark:bg-[#1e293b] rounded-2xl border border-gray-100 dark:border-[#334155] shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-50 dark:border-[#293548]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                <Bus size={15} className="text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-800 dark:text-slate-200 leading-none">Viajes del día</h3>
                <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">
                  {viajes.length > 0 ? `${totalLibres} asientos libres en total` : 'Sin viajes programados'}
                </p>
              </div>
            </div>
            <Link href="/viajes"
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-semibold flex items-center gap-1">
              Ver todos <ChevronRight size={12} />
            </Link>
          </div>
          <div className="px-5 py-1 max-h-72 overflow-y-auto">
            {viajes.length === 0 ? (
              <div className="py-10 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gray-50 dark:bg-[#293548] flex items-center justify-center mx-auto mb-3">
                  <Bus size={24} className="text-gray-300 dark:text-slate-600" />
                </div>
                <p className="text-sm font-medium text-gray-400 dark:text-slate-500">No hay viajes hoy</p>
                <Link href="/viajes" className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium">
                  <Plus size={11} /> Programar viaje
                </Link>
              </div>
            ) : (
              viajes.map(v => <ViajeRow key={v.id} v={v} />)
            )}
          </div>
        </div>

        {/* Panel derecho */}
        <div className="lg:col-span-2 space-y-3">

          {/* Estado del sistema */}
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-gray-100 dark:border-[#334155] shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 pt-4 pb-3 border-b border-gray-50 dark:border-[#293548]">
              <Activity size={13} className="text-gray-400 dark:text-slate-500" />
              <h3 className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest">Sistema</h3>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-[#293548]">
              {[
                { label: 'Base de datos', icon: Database, ok: true },
                { label: 'Servidor API',  icon: Wifi,     ok: true },
                { label: 'Turno de caja', icon: Clock,    ok: cajaAbierta, badge: mounted ? (cajaAbierta ? 'Abierta' : 'Cerrada') : null },
              ].map(({ label, icon: Icon, ok, badge }) => (
                <div key={label} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-2.5 text-sm text-gray-600 dark:text-slate-400">
                    <Icon size={13} className="text-gray-400 dark:text-slate-500" />
                    {label}
                  </div>
                  {badge ? (
                    <span className={`flex items-center gap-1.5 text-xs font-semibold ${
                      ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-slate-500'
                    }`}>
                      {ok ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                      {badge}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Activo
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Agencia */}
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-gray-100 dark:border-[#334155] shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <MapPin size={13} className="text-emerald-500" />
              <p className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest">Tu agencia</p>
            </div>
            <p className="text-base font-bold text-gray-800 dark:text-slate-200" suppressHydrationWarning>
              Agencia #{user?.agenciaId ?? '—'}
            </p>
            <Link href="/viajes"
              className="mt-1.5 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-semibold">
              Viajes del día <ArrowRight size={11} />
            </Link>

            {/* Promos activas */}
            {promos.length > 0 && (
              <>
                <div className="my-3 h-px bg-gray-50 dark:bg-[#293548]" />
                <div className="flex items-center gap-2 mb-2">
                  <Tag size={12} className="text-rose-500" />
                  <p className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest">Promos activas</p>
                </div>
                <div className="space-y-1.5">
                  {promos.slice(0, 3).map(p => (
                    <div key={p.id} className="flex items-center justify-between">
                      <span className="text-xs text-gray-700 dark:text-slate-300 font-medium truncate mr-2">{p.nombre}</span>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                        {p.tipoDescuento === 'MONTO_FIJO' ? `S/ ${p.valor}` : `${p.valor}%`}
                      </span>
                    </div>
                  ))}
                  {promos.length > 3 && (
                    <Link href="/promociones" className="text-xs text-gray-400 dark:text-slate-500 hover:underline">
                      +{promos.length - 3} más
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
