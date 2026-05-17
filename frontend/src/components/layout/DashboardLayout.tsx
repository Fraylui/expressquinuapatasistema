'use client'
import React, { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useRequireAuth } from '@/hooks/useAuth'
import { useAuthStore } from '@/stores/authStore'
import { Menu, X, ShieldOff } from 'lucide-react'

/** Mapa ruta → módulo requerido. null = accesible a cualquier rol autenticado */
const RUTA_MODULO: Record<string, string | null> = {
  '/':             null,
  '/viajes':       null,
  '/conductor':    null,
  '/pasajes':      'VENTAS',
  '/clientes':     'VENTAS',
  '/encomiendas':  'ENCOMIENDAS',
  '/caja':         'CAJA',
  '/manifiestos':  'MANIFIESTOS',
  '/gerente':      'REPORTES',
  '/reportes':     'REPORTES',
  '/usuarios':     'USUARIOS',
  '/agencias':     'AGENCIAS',
  '/configuracion':'CONFIGURACION',
  '/auditoria':    'AUDITORIA',
}

function resolverModulo(pathname: string): string | undefined {
  const ruta = Object.keys(RUTA_MODULO).find(r =>
    r === '/' ? pathname === '/' : pathname.startsWith(r)
  )
  if (!ruta) return undefined
  return RUTA_MODULO[ruta] ?? undefined
}

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useRequireAuth()
  const pathname = usePathname()
  const router = useRouter()
  const { user, hasModulo } = useAuthStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [accesoDenegado, setAccesoDenegado] = useState(false)

  useEffect(() => {
    if (!user) return
    // Conductor solo puede ir a /conductor y /
    if (user.rol === 'CONDUCTOR' && pathname !== '/conductor' && pathname !== '/') {
      router.replace('/conductor')
      return
    }
    const moduloRequerido = resolverModulo(pathname)
    if (moduloRequerido && !hasModulo(moduloRequerido)) {
      setAccesoDenegado(true)
    } else {
      setAccesoDenegado(false)
    }
  }, [pathname, user, hasModulo, router])

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* Overlay móvil */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-30 lg:static lg:z-auto
        transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <Sidebar />
      </div>

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Hamburguesa móvil */}
        <div className="flex items-center gap-3 lg:hidden bg-[#1F3864] h-14 px-4 shrink-0">
          <button onClick={() => setSidebarOpen(v => !v)} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
            {sidebarOpen ? <X size={20} className="text-white" /> : <Menu size={20} className="text-white" />}
          </button>
          <span className="text-white font-bold text-sm">Express Quinuapata</span>
        </div>

        {/* Header escritorio */}
        <div className="hidden lg:block"><Header /></div>

        {/* Página */}
        <main className="flex-1 overflow-y-auto p-5 lg:p-6">
          {accesoDenegado ? (
            <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto text-center">
              <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-4">
                <ShieldOff size={28} className="text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Acceso denegado</h2>
              <p className="text-sm text-gray-500 mb-6">
                No tienes acceso a este módulo. Contacta al administrador del sistema para solicitar el acceso correspondiente.
              </p>
              <button
                onClick={() => router.push('/')}
                className="px-4 py-2 bg-primary-900 text-white rounded-lg text-sm font-medium hover:bg-primary-800 transition-colors"
              >
                Volver al tablero
              </button>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  )
}
