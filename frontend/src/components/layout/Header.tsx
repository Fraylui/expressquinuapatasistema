'use client'
import React, { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Bell, ChevronRight, Home } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuthStore } from '@/stores/authStore'

const breadcrumbMap: Record<string, string> = {
  '/':             'Tablero',
  '/pasajes':      'Pasajes',
  '/encomiendas':  'Encomiendas',
  '/caja':         'Caja',
  '/viajes':       'Viajes',
  '/reportes':     'Reportes',
  '/usuarios':     'Usuarios',
  '/agencias':     'Agencias',
  '/auditoria':    'Auditoría',
}

export const Header: React.FC = () => {
  const pathname = usePathname()
  const { user } = useAuthStore()
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const segments = pathname.split('/').filter(Boolean)
  const crumbs = segments.map((_, i) => {
    const path = '/' + segments.slice(0, i + 1).join('/')
    return { path, label: breadcrumbMap[path] ?? segments[i] }
  })

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-5 shrink-0">
      <nav className="flex items-center gap-1 text-sm text-gray-500">
        <Home size={13} className="shrink-0" />
        {crumbs.length === 0 ? (
          <><ChevronRight size={13} className="text-gray-300 mx-0.5" />
          <span className="font-semibold text-gray-800">Tablero</span></>
        ) : (
          crumbs.map((c, i) => (
            <React.Fragment key={c.path}>
              <ChevronRight size={13} className="text-gray-300 mx-0.5" />
              <span className={i === crumbs.length - 1 ? 'font-semibold text-gray-800' : 'text-gray-400'}>
                {c.label}
              </span>
            </React.Fragment>
          ))
        )}
      </nav>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 text-xs text-gray-400 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span suppressHydrationWarning>
            {now ? format(now, 'HH:mm:ss · dd/MM/yyyy', { locale: es }) : '--:--:--'}
          </span>
        </div>

        <button className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <Bell size={16} className="text-gray-500" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
        </button>

        <div className="hidden lg:flex items-center gap-2.5 pl-3 border-l border-gray-100">
          <div className="w-7 h-7 rounded-full bg-primary-900 flex items-center justify-center text-xs font-bold text-white" suppressHydrationWarning>
            {user?.nombre?.charAt(0) ?? 'U'}
          </div>
          <div className="text-xs leading-tight">
            <p className="font-semibold text-gray-700" suppressHydrationWarning>
              {user?.nombre?.split(' ')[0] ?? ''}
            </p>
            <p className="text-gray-400" suppressHydrationWarning>{user?.rol ?? ''}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
