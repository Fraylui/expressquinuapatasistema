'use client'
import React, { useEffect, useState } from 'react'
import { Bus, DollarSign, ArrowRight, Tag } from 'lucide-react'
import Link from 'next/link'
import api from '@/services/api'

interface TarifaPublica {
  id: number
  rutaOrigen?: string
  rutaDestino?: string
  tipoVehiculo?: string
  precio: number
  descripcion?: string
}

export default function TarifasPage() {
  const [tarifas, setTarifas] = useState<TarifaPublica[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/tarifas/publico')
      .then(r => setTarifas(r.data?.data || r.data || []))
      .catch(() => setTarifas([]))
      .finally(() => setLoading(false))
  }, [])

  const TIPO_COLOR: Record<string, string> = {
    COMBI:     'bg-blue-50 text-blue-700 border-blue-200',
    CAMIONETA: 'bg-amber-50 text-amber-700 border-amber-200',
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
              <p className="text-xs text-white/50">Tarifas y precios</p>
            </div>
          </div>
          <nav className="flex gap-4 text-sm text-white/70">
            <Link href="/horarios" className="hover:text-white transition-colors">Horarios</Link>
            <Link href="/tarifas" className="text-white font-medium">Tarifas</Link>
            <Link href="/sucursales" className="hover:text-white transition-colors">Sucursales</Link>
            <Link href="/tracking" className="hover:text-white transition-colors">Rastrear</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Tag size={20} className="text-primary-900" />
            Tarifas de pasaje
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Precios vigentes de pasajes por ruta y tipo de vehículo. Sujetos a cambio sin previo aviso.
          </p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1,2,3,4].map(i => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 h-20 animate-pulse" />
            ))}
          </div>
        ) : tarifas.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <Tag size={36} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm text-gray-500">Las tarifas serán publicadas próximamente</p>
            <p className="text-xs text-gray-400 mt-1">Consulte en nuestras oficinas o comuníquese por teléfono</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tarifas.map(t => (
              <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-primary-900 rounded-xl flex items-center justify-center shrink-0">
                  <DollarSign size={20} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 font-semibold text-gray-900">
                    <span>{t.rutaOrigen || '—'}</span>
                    <ArrowRight size={13} className="text-gray-400 shrink-0" />
                    <span>{t.rutaDestino || '—'}</span>
                  </div>
                  {t.descripcion && (
                    <p className="text-xs text-gray-500 mt-0.5">{t.descripcion}</p>
                  )}
                </div>
                {t.tipoVehiculo && (
                  <span className={`text-xs font-medium px-2 py-1 rounded-full border ${TIPO_COLOR[t.tipoVehiculo] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                    {t.tipoVehiculo}
                  </span>
                )}
                <div className="text-right shrink-0">
                  <p className="text-xs text-gray-400">Desde</p>
                  <p className="text-xl font-bold text-primary-900">S/ {Number(t.precio).toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
          <p className="font-semibold mb-1">¿Tienes dudas sobre las tarifas?</p>
          <p className="text-xs text-blue-600">
            Comunícate con nuestras agencias o visítanos en nuestras oficinas. Los precios pueden variar según temporada y disponibilidad.
          </p>
        </div>
      </main>

      <footer className="text-center text-xs text-gray-400 py-6 border-t border-gray-200 mt-8">
        Express Quinuapata VRAEM S.A.C. · Quinuapata, Ayacucho · © {new Date().getFullYear()}
      </footer>
    </div>
  )
}
