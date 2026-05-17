'use client'
import React, { useState } from 'react'
import { Bus, Clock, MapPin, Search, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import Link from 'next/link'
import api from '@/services/api'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface ViajePublico {
  id: number
  estado: string
  fechaHoraSal: string
  ruta?: { origen: string; destino: string; distanciaKm?: number }
  vehiculo?: { placa: string; tipo: string; numAsientos: number }
}

const AGENCIAS = ['Quinuapata', 'Kimbiri', 'Pichari', 'Llochegua', 'Sivia']

export default function HorariosPage() {
  const [origen, setOrigen] = useState('')
  const [destino, setDestino] = useState('')
  const [fecha, setFecha] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [viajes, setViajes] = useState<ViajePublico[]>([])
  const [buscado, setBuscado] = useState(false)
  const [loading, setLoading] = useState(false)

  const buscar = async () => {
    setLoading(true)
    setBuscado(true)
    try {
      const res = await api.get('/api/viajes/publico', { params: { origen, destino, fecha } })
      setViajes(res.data?.data || res.data || [])
    } catch {
      setViajes([])
    } finally {
      setLoading(false)
    }
  }

  const formatHora = (iso: string) => {
    try { return format(new Date(iso), 'HH:mm') } catch { return '—' }
  }

  const formatFecha = (iso: string) => {
    try { return format(new Date(iso), "EEEE dd 'de' MMMM", { locale: es }) } catch { return '—' }
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
              <p className="text-xs text-white/50">Consulta de horarios</p>
            </div>
          </div>
          <nav className="flex gap-4 text-sm text-white/70">
            <Link href="/horarios" className="text-white font-medium">Horarios</Link>
            <Link href="/tarifas" className="hover:text-white transition-colors">Tarifas</Link>
            <Link href="/sucursales" className="hover:text-white transition-colors">Sucursales</Link>
            <Link href="/tracking" className="hover:text-white transition-colors">Rastrear</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Buscador */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
          <h1 className="text-xl font-bold text-gray-900 mb-5 flex items-center gap-2">
            <Clock size={20} className="text-primary-900" />
            Consultar horarios
          </h1>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Origen</label>
              <select
                value={origen}
                onChange={e => setOrigen(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Todos</option>
                {AGENCIAS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Destino</label>
              <select
                value={destino}
                onChange={e => setDestino(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Todos</option>
                {AGENCIAS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={e => setFecha(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex items-end">
              <Button icon={Search} loading={loading} onClick={buscar} className="w-full justify-center">
                Buscar
              </Button>
            </div>
          </div>
        </div>

        {/* Resultados */}
        {buscado && (
          <div>
            <p className="text-sm text-gray-500 mb-3">
              {viajes.length > 0
                ? `${viajes.length} viaje${viajes.length > 1 ? 's' : ''} encontrado${viajes.length > 1 ? 's' : ''}`
                : 'No se encontraron viajes para los filtros seleccionados'}
            </p>
            <div className="space-y-3">
              {viajes.map(v => (
                <div key={v.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
                  <div className="w-14 h-14 bg-primary-900 rounded-xl flex flex-col items-center justify-center shrink-0 text-white">
                    <span className="text-xl font-bold leading-none">{formatHora(v.fechaHoraSal)}</span>
                    <span className="text-[10px] text-white/60 mt-0.5">hrs</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-base font-semibold text-gray-900">
                      <span>{v.ruta?.origen || '—'}</span>
                      <ArrowRight size={14} className="text-gray-400 shrink-0" />
                      <span>{v.ruta?.destino || '—'}</span>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1">
                      <span className="text-xs text-gray-500 capitalize">{formatFecha(v.fechaHoraSal)}</span>
                      {v.vehiculo && (
                        <span className="text-xs text-gray-500">{v.vehiculo.tipo} · {v.vehiculo.placa}</span>
                      )}
                      {v.ruta?.distanciaKm && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <MapPin size={10} />
                          {v.ruta.distanciaKm} km
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge estado={v.estado} />
                </div>
              ))}
            </div>
          </div>
        )}

        {!buscado && (
          <div className="text-center py-16 text-gray-400">
            <Clock size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Selecciona origen, destino y fecha para ver los horarios disponibles</p>
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-gray-400 py-6 border-t border-gray-200 mt-8">
        Express Quinuapata VRAEM S.A.C. · Quinuapata, Ayacucho · © {new Date().getFullYear()}
      </footer>
    </div>
  )
}
