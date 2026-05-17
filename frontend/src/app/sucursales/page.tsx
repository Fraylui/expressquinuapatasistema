'use client'
import React, { useEffect, useState } from 'react'
import { Bus, MapPin, Phone, Clock, Building2 } from 'lucide-react'
import Link from 'next/link'
import api from '@/services/api'

interface AgenciaPublica {
  id: number
  nombre: string
  ciudad?: string
  direccion?: string
  telefono?: string
  email?: string
  horarioAtencion?: string
}

const HORARIO_DEFAULT = 'Lun–Dom 5:00 am – 8:00 pm'

export default function SucursalesPage() {
  const [agencias, setAgencias] = useState<AgenciaPublica[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/agencias')
      .then(r => setAgencias(r.data?.data || r.data || []))
      .catch(() => setAgencias([]))
      .finally(() => setLoading(false))
  }, [])

  const CIUDAD_COLORS: Record<string, string> = {
    'Quinuapata': 'bg-primary-900',
    'Kimbiri':    'bg-emerald-700',
    'Pichari':    'bg-amber-700',
    'Llochegua':  'bg-indigo-700',
    'Sivia':      'bg-rose-700',
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-primary-900 text-white py-4 px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-accent-700 rounded-lg flex items-center justify-center">
              <Bus size={18} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-sm">Express Quinuapata VRAEM SAC</p>
              <p className="text-xs text-white/50">Nuestras sucursales</p>
            </div>
          </div>
          <nav className="flex gap-4 text-sm text-white/70">
            <Link href="/horarios" className="hover:text-white transition-colors">Horarios</Link>
            <Link href="/tarifas" className="hover:text-white transition-colors">Tarifas</Link>
            <Link href="/sucursales" className="text-white font-medium">Sucursales</Link>
            <Link href="/tracking" className="hover:text-white transition-colors">Rastrear</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 size={20} className="text-primary-900" />
            Nuestras agencias
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Encuentra la agencia más cercana y comunícate directamente con nosotros.
          </p>
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 h-36 animate-pulse" />
            ))}
          </div>
        ) : agencias.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <Building2 size={36} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm text-gray-500">Información de sucursales no disponible</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {agencias.map(a => {
              const color = CIUDAD_COLORS[a.ciudad ?? ''] ?? CIUDAD_COLORS[a.nombre] ?? 'bg-primary-900'
              return (
                <div key={a.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className={`${color} px-4 py-3 flex items-center gap-3`}>
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                      <Building2 size={16} className="text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-white text-sm">{a.nombre}</p>
                      {a.ciudad && <p className="text-xs text-white/70">{a.ciudad}</p>}
                    </div>
                  </div>
                  <div className="p-4 space-y-2.5">
                    {a.direccion && (
                      <div className="flex items-start gap-2.5 text-sm text-gray-600">
                        <MapPin size={14} className="text-gray-400 mt-0.5 shrink-0" />
                        <span>{a.direccion}</span>
                      </div>
                    )}
                    {a.telefono && (
                      <div className="flex items-center gap-2.5 text-sm text-gray-600">
                        <Phone size={14} className="text-gray-400 shrink-0" />
                        <a href={`tel:${a.telefono}`} className="hover:text-primary-900 font-medium transition-colors">
                          {a.telefono}
                        </a>
                      </div>
                    )}
                    <div className="flex items-center gap-2.5 text-sm text-gray-600">
                      <Clock size={14} className="text-gray-400 shrink-0" />
                      <span>{a.horarioAtencion ?? HORARIO_DEFAULT}</span>
                    </div>
                    {a.email && (
                      <div className="flex items-center gap-2.5 text-xs text-gray-400">
                        <span className="w-3.5" />
                        <a href={`mailto:${a.email}`} className="hover:underline">{a.email}</a>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-8 bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex gap-3">
          <Bus size={20} className="text-emerald-700 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">¿Quieres viajar con nosotros?</p>
            <p className="text-xs text-emerald-700 mt-0.5">
              Acércate a cualquiera de nuestras agencias y adquiere tu pasaje. También puedes consultar{' '}
              <Link href="/horarios" className="underline font-medium">los horarios disponibles</Link> y{' '}
              <Link href="/tarifas" className="underline font-medium">nuestras tarifas</Link>.
            </p>
          </div>
        </div>
      </main>

      <footer className="text-center text-xs text-gray-400 py-6 border-t border-gray-200 mt-8">
        Express Quinuapata VRAEM S.A.C. · Quinuapata, Ayacucho · © {new Date().getFullYear()}
      </footer>
    </div>
  )
}
