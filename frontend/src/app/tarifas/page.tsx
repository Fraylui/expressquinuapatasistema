'use client'
import React, { useEffect, useState } from 'react'
import { Tag, ArrowRight } from 'lucide-react'
import api from '@/services/api'
import PublicShell, { syne, glassCard } from '@/components/public/PublicShell'

interface TarifaPublica {
  id: number
  rutaOrigen?: string
  rutaDestino?: string
  tipoVehiculo?: string
  precio: number
  descripcion?: string
}

const TIPO_CHIP: Record<string, React.CSSProperties> = {
  COMBI:     { background: 'rgba(59,130,246,0.12)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.35)' },
  CAMIONETA: { background: 'rgba(250,204,21,0.10)', color: '#fde047', border: '1px solid rgba(250,204,21,0.30)' },
}
const TIPO_CHIP_DEFAULT: React.CSSProperties = {
  background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.15)',
}

export default function TarifasPage() {
  const [tarifas, setTarifas] = useState<TarifaPublica[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/tarifas/publico')
      .then((r: any) => setTarifas(r.data?.data || r.data || []))
      .catch(() => setTarifas([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <PublicShell active="tarifas" subtitle="Tarifas y precios">
      {/* Hero */}
      <div className="mb-8 text-center">
        <div
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: 'rgba(22,163,74,0.14)', border: '1px solid rgba(22,163,74,0.3)' }}
        >
          <Tag size={26} style={{ color: '#4ade80' }} />
        </div>
        <h1 className={`${syne.className} text-2xl font-extrabold text-white sm:text-[1.7rem]`}>
          Tarifas de pasaje
        </h1>
        <p className="mt-2 text-sm text-white/45">
          Precios vigentes por ruta y tipo de vehículo. Sujetos a cambio sin previo aviso.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 animate-pulse rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }} />
          ))}
        </div>
      ) : tarifas.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={glassCard}>
          <Tag size={36} className="mx-auto mb-3 text-white/20" />
          <p className="text-sm text-white/60">Las tarifas serán publicadas próximamente</p>
          <p className="mt-1 text-xs text-white/35">Consulta en nuestras oficinas o comunícate por teléfono</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tarifas.map(t => (
            <div key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl p-4" style={glassCard}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-[0.95rem] font-semibold text-white">
                  <span>{t.rutaOrigen || '—'}</span>
                  <ArrowRight size={14} className="shrink-0 text-white/30" />
                  <span>{t.rutaDestino || '—'}</span>
                </div>
                {t.descripcion && (
                  <p className="mt-0.5 text-xs text-white/40">{t.descripcion}</p>
                )}
              </div>
              {t.tipoVehiculo && (
                <span
                  className="rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={TIPO_CHIP[t.tipoVehiculo] ?? TIPO_CHIP_DEFAULT}
                >
                  {t.tipoVehiculo}
                </span>
              )}
              <div className="shrink-0 text-right">
                <p className="text-[0.65rem] uppercase tracking-wider text-white/30">Desde</p>
                <p className={`${syne.className} text-xl font-extrabold`} style={{ color: '#4ade80' }}>
                  S/ {Number(t.precio).toFixed(2)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div
        className="mt-8 rounded-xl p-4"
        style={{ background: 'rgba(22,163,74,0.07)', border: '1px solid rgba(22,163,74,0.22)' }}
      >
        <p className="text-sm font-semibold" style={{ color: '#4ade80' }}>¿Tienes dudas sobre las tarifas?</p>
        <p className="mt-0.5 text-xs text-white/45">
          Comunícate con nuestras agencias o visítanos en nuestras oficinas. Los precios pueden variar según temporada y disponibilidad.
        </p>
      </div>
    </PublicShell>
  )
}
