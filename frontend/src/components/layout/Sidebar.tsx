'use client'
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Ticket, Package, DollarSign,
  BarChart2, Users, Building2, ClipboardList,
  LogOut, Bus, UserCheck, TrendingUp, FileText,
  Settings, Shield, PackageSearch, Tag,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

type NavItem = {
  href: string
  icon: React.ElementType
  label: string
  /** null = visible para todos los autenticados */
  modulo: string | null
  /** null = cualquier rol; array = solo esos roles */
  roles: string[] | null
}

type Section = { section: string; items: NavItem[] }

const navItems: Section[] = [
  {
    section: 'OPERACIÓN',
    items: [
      { href: '/',            icon: LayoutDashboard, label: 'Tablero',      modulo: null,           roles: null },
      { href: '/viajes',      icon: Bus,             label: 'Viajes',       modulo: null,           roles: ['SUPER_ADMIN','GERENTE','ADMIN_AGENCIA','OPERADOR','CONDUCTOR'] },
      { href: '/pasajes',     icon: Ticket,          label: 'Pasajes',      modulo: 'VENTAS',       roles: null },
      { href: '/encomiendas',          icon: Package,       label: 'Encomiendas',  modulo: 'ENCOMIENDAS',  roles: null },
      { href: '/encomiendas-externas', icon: PackageSearch, label: 'Enc. Externas', modulo: 'ENCOMIENDAS',  roles: null },
      { href: '/caja',                 icon: DollarSign,    label: 'Caja',         modulo: 'CAJA',         roles: null },
      { href: '/manifiestos',  icon: FileText,  label: 'Manifiestos',  modulo: 'MANIFIESTOS',  roles: null },
      { href: '/promociones',  icon: Tag,       label: 'Promociones',  modulo: null,           roles: ['SUPER_ADMIN','GERENTE','ADMIN_AGENCIA'] },
      { href: '/clientes',     icon: UserCheck, label: 'Clientes',     modulo: null,           roles: ['SUPER_ADMIN','GERENTE','ADMIN_AGENCIA'] },
    ],
  },
  {
    section: 'GESTIÓN',
    items: [
      { href: '/gerente',       icon: TrendingUp,    label: 'Gerencial',      modulo: 'REPORTES',      roles: ['SUPER_ADMIN','GERENTE'] },
      { href: '/reportes',      icon: BarChart2,     label: 'Reportes',       modulo: 'REPORTES',      roles: null },
      { href: '/usuarios',      icon: Users,         label: 'Usuarios',       modulo: 'USUARIOS',      roles: null },
      { href: '/agencias',      icon: Building2,     label: 'Agencias',       modulo: 'AGENCIAS',      roles: null },
      { href: '/configuracion', icon: Settings,      label: 'Configuración',  modulo: 'CONFIGURACION', roles: null },
      { href: '/auditoria',     icon: ClipboardList, label: 'Auditoría',      modulo: 'AUDITORIA',     roles: ['SUPER_ADMIN'] },
    ],
  },
  {
    section: 'CONDUCTOR',
    items: [
      { href: '/conductor', icon: Bus, label: 'Mis viajes', modulo: null, roles: ['CONDUCTOR'] },
    ],
  },
]

function canSee(item: NavItem, rol: string | undefined, modulosActivos: string[]): boolean {
  if (!rol) return false
  // Filtro por rol
  if (item.roles !== null && !item.roles.includes(rol)) return false
  // Filtro por módulo
  if (item.modulo !== null) {
    if (rol === 'SUPER_ADMIN') return true
    if (!modulosActivos.includes(item.modulo)) return false
  }
  return true
}

function initials(nombre: string | undefined): string {
  if (!nombre) return 'U'
  const p = nombre.trim().split(' ')
  return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : p[0][0].toUpperCase()
}

const rolLabel: Record<string, string> = {
  SUPER_ADMIN:   'Super Administrador',
  GERENTE:       'Gerente General',
  ADMIN_AGENCIA: 'Jefe de Sucursal',
  OPERADOR:      'Operador',
  CONDUCTOR:     'Conductor',
}

const rolBadgeColor: Record<string, string> = {
  SUPER_ADMIN:   'bg-red-500/20 text-red-300',
  GERENTE:       'bg-indigo-500/20 text-indigo-300',
  ADMIN_AGENCIA: 'bg-violet-500/20 text-violet-300',
  OPERADOR:      'bg-emerald-500/20 text-emerald-300',
  CONDUCTOR:     'bg-amber-500/20 text-amber-300',
}

export const Sidebar: React.FC = () => {
  const pathname = usePathname()
  const { user, logout } = useAuthStore()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const modulosActivos = user?.modulosActivos ?? []

  return (
    <aside className="flex flex-col h-full w-60 bg-sidebar text-white select-none">

      {/* Logo */}
      <div className="px-5 py-4 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-accent rounded-lg flex items-center justify-center shrink-0">
            <Bus size={18} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold leading-tight">Express Quinuapata</p>
            <p className="text-xs text-white/40 tracking-widest uppercase mt-0.5">VRAEM SAC</p>
          </div>
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {navItems.map(({ section, items }) => {
          const visibles = mounted
            ? items.filter(i => canSee(i, user?.rol, modulosActivos))
            : items.filter(i => i.roles === null && i.modulo === null)

          if (visibles.length === 0) return null
          return (
            <div key={section} className="mb-4">
              <p className="px-3 mb-1 text-xs font-semibold text-white/30 uppercase tracking-widest">
                {section}
              </p>
              {visibles.map(({ href, icon: Icon, label }) => {
                const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    className={[
                      'relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium mb-0.5 transition-colors duration-150',
                      active
                        ? 'bg-white/15 text-white'
                        : 'text-white/60 hover:bg-white/10 hover:text-white',
                    ].join(' ')}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-accent rounded-r-full" />
                    )}
                    <Icon size={15} className={active ? 'text-accent-300' : ''} />
                    <span className="truncate">{label}</span>
                  </Link>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* Footer usuario */}
      <div className="px-2 py-3 border-t border-white/10 shrink-0">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-xs font-bold shrink-0">
            <span suppressHydrationWarning>{mounted ? initials(user?.nombre) : 'U'}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate" suppressHydrationWarning>
              {mounted ? (user?.nombre ?? 'Usuario') : ''}
            </p>
            <span
              suppressHydrationWarning
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${mounted ? (rolBadgeColor[user?.rol ?? ''] ?? 'bg-white/10 text-white/50') : ''}`}
            >
              {mounted ? (rolLabel[user?.rol ?? ''] ?? user?.rol ?? '') : ''}
            </span>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-white/55 hover:bg-white/10 hover:text-white transition-colors"
        >
          <LogOut size={15} />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  )
}
