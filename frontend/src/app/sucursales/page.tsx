'use client'
import React, { useEffect, useState } from 'react'
import { MapPin, Phone, Clock, Building2, Bus } from 'lucide-react'
import Link from 'next/link'
import api from '@/services/api'
import PublicShell, { syne, glassCard } from '@/components/public/PublicShell'

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
      .then((r: any) => setAgencias(r.data?.data || r.data || []))
      .catch(() => setAgencias([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <PublicShell active="sucursales" subtitle="Nuestras sucursales">
      {/* Hero */}
      <div className="mb-8 text-center">
        <div
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: 'rgba(22,163,74,0.14)', border: '1px solid rgba(22,163,74,0.3)' }}
        >
          <Building2 size={26} style={{ color: '#4ade80' }} />
        </div>
        <h1 className={`${syne.className} text-2xl font-extrabold text-white sm:text-[1.7rem]`}>
          Nuestras agencias
        </h1>
        <p className="mt-2 text-sm text-white/45">
          Encuentra la agencia más cercana y comunícate directamente con nosotros
        </p>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-36 animate-pulse rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }} />
          ))}
        </div>
      ) : agencias.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={glassCard}>
          <Building2 size={36} className="mx-auto mb-3 text-white/20" />
          <p className="text-sm text-white/60">Información de sucursales no disponible</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {agencias.map(a => (
            <div key={a.id} className="overflow-hidden rounded-xl" style={glassCard}>
              <div
                className="flex items-center gap-3 border-b px-4 py-3"
                style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)' }}
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: 'rgba(22,163,74,0.14)', border: '1px solid rgba(22,163,74,0.3)' }}
                >
                  <Building2 size={16} style={{ color: '#4ade80' }} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{a.nombre}</p>
                  {a.ciudad && <p className="text-xs text-white/40">{a.ciudad}</p>}
                </div>
              </div>
              <div className="space-y-2.5 p-4">
                {a.direccion && (
                  <div className="flex items-start gap-2.5 text-sm text-white/60">
                    <MapPin size={14} className="mt-0.5 shrink-0 text-white/30" />
                    <span>{a.direccion}</span>
                  </div>
                )}
                {a.telefono && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Phone size={14} className="shrink-0 text-white/30" />
                    <a
                      href={`tel:${a.telefono}`}
                      className="font-medium transition-colors duration-150"
                      style={{ color: '#4ade80' }}
                    >
                      {a.telefono}
                    </a>
                  </div>
                )}
                <div className="flex items-center gap-2.5 text-sm text-white/60">
                  <Clock size={14} className="shrink-0 text-white/30" />
                  <span>{a.horarioAtencion ?? HORARIO_DEFAULT}</span>
                </div>
                {a.email && (
                  <div className="flex items-center gap-2.5 text-xs text-white/35">
                    <span className="w-3.5" />
                    <a href={`mailto:${a.email}`} className="hover:underline">{a.email}</a>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div
        className="mt-8 flex gap-3 rounded-xl p-4"
        style={{ background: 'rgba(22,163,74,0.07)', border: '1px solid rgba(22,163,74,0.22)' }}
      >
        <Bus size={20} className="mt-0.5 shrink-0" style={{ color: '#4ade80' }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: '#4ade80' }}>¿Quieres viajar con nosotros?</p>
          <p className="mt-0.5 text-xs text-white/45">
            Acércate a cualquiera de nuestras agencias y adquiere tu pasaje. También puedes consultar{' '}
            <Link href="/horarios" className="font-medium underline" style={{ color: 'rgba(255,255,255,0.7)' }}>los horarios disponibles</Link> y{' '}
            <Link href="/tarifas" className="font-medium underline" style={{ color: 'rgba(255,255,255,0.7)' }}>nuestras tarifas</Link>.
          </p>
        </div>
      </div>
    </PublicShell>
  )
}
