'use client'
import React, { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Bell, ChevronRight, Home, Sun, Moon } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'

const breadcrumbMap: Record<string, string> = {
  '/':                 'Tablero',
  '/pasajes':          'Pasajes',
  '/encomiendas':      'Encomiendas',
  '/caja':             'Caja',
  '/viajes':           'Viajes',
  '/reportes':         'Reportes',
  '/usuarios':         'Usuarios',
  '/agencias':         'Agencias',
  '/auditoria':        'Auditoría',
  '/promociones':      'Promociones',
  '/manifiestos':      'Manifiestos',
  '/configuracion':    'Configuración',
  '/gerente':          'Gerencial',
  '/clientes':         'Clientes',
}

export const Header: React.FC = () => {
  const pathname   = usePathname()
  const { user }   = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()
  const [now, setNow]           = useState<Date | null>(null)
  const [mounted, setMounted]   = useState(false)

  useEffect(() => {
    setMounted(true)
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const segments = pathname.split('/').filter(Boolean)
  const crumbs = segments.map((_, i) => {
    const path = '/' + segments.slice(0, i + 1).join('/')
    return { path, label: breadcrumbMap[path] ?? segments[i] }
  })

  const isDark = mounted && theme === 'dark'

  return (
    <header className="h-14 bg-white dark:bg-[#1e293b] border-b border-gray-100 dark:border-[#334155] flex items-center justify-between px-5 shrink-0 transition-colors duration-200">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-gray-500 dark:text-slate-400">
        <Home size={13} className="shrink-0" />
        {crumbs.length === 0 ? (
          <>
            <ChevronRight size={13} className="text-gray-300 dark:text-slate-600 mx-0.5" />
            <span className="font-semibold text-gray-800 dark:text-slate-200">Tablero</span>
          </>
        ) : (
          crumbs.map((c, i) => (
            <React.Fragment key={c.path}>
              <ChevronRight size={13} className="text-gray-300 dark:text-slate-600 mx-0.5" />
              <span className={i === crumbs.length - 1
                ? 'font-semibold text-gray-800 dark:text-slate-200'
                : 'text-gray-400 dark:text-slate-500'}>
                {c.label}
              </span>
            </React.Fragment>
          ))
        )}
      </nav>

      {/* Acciones */}
      <div className="flex items-center gap-2">

        {/* Reloj */}
        <div className="hidden sm:flex items-center gap-2 text-xs text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-[#293548] px-3 py-1.5 rounded-lg border border-gray-100 dark:border-[#334155]">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span suppressHydrationWarning>
            {now ? format(now, 'HH:mm:ss · dd/MM/yyyy', { locale: es }) : '--:--:--'}
          </span>
        </div>

        {/* Toggle dark/light */}
        <button
          onClick={toggleTheme}
          aria-label={isDark ? 'Activar modo claro' : 'Activar modo oscuro'}
          title={isDark ? 'Modo claro' : 'Modo oscuro'}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#334155] transition-colors cursor-pointer"
        >
          {mounted && isDark
            ? <Sun  size={16} className="text-amber-400" />
            : <Moon size={16} className="text-gray-500 dark:text-slate-400" />
          }
        </button>

        {/* Notificaciones */}
        <button className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#334155] transition-colors cursor-pointer">
          <Bell size={16} className="text-gray-500 dark:text-slate-400" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
        </button>

        {/* Usuario */}
        <div className="hidden lg:flex items-center gap-2.5 pl-3 border-l border-gray-100 dark:border-[#334155]">
          <div
            className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-white"
            suppressHydrationWarning
          >
            {user?.nombre?.charAt(0) ?? 'U'}
          </div>
          <div className="text-xs leading-tight">
            <p className="font-semibold text-gray-700 dark:text-slate-300" suppressHydrationWarning>
              {user?.nombre?.split(' ')[0] ?? ''}
            </p>
            <p className="text-gray-400 dark:text-slate-500" suppressHydrationWarning>
              {user?.rol ?? ''}
            </p>
          </div>
        </div>
      </div>
    </header>
  )
}
