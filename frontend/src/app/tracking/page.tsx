'use client'
import React, { useState } from 'react'
import { Search, Package, Bus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { TrackingTimeline } from '@/components/modules/encomiendas/TrackingTimeline'
import { encomiendaService } from '@/services/encomiendas.service'
import Link from 'next/link'
import toast from 'react-hot-toast'

export default function TrackingPage() {
  const [codigo, setCodigo] = useState('')
  const [resultado, setResultado] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const buscar = async () => {
    if (!codigo.trim()) { toast.error('Ingrese un código de seguimiento'); return }
    setLoading(true)
    try {
      const res = await encomiendaService.getByTracking(codigo.trim().toUpperCase())
      setResultado(res.data)
    } catch {
      toast.error('No se encontró la encomienda con ese código')
      setResultado(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-primary-900 text-white py-4 px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-accent-700 rounded-lg flex items-center justify-center">
              <Bus size={18} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-sm">Express Quinuapata VRAEM SAC</p>
              <p className="text-xs text-white/50">Seguimiento de encomiendas</p>
            </div>
          </div>
          <nav className="flex gap-4 text-sm text-white/70">
            <Link href="/horarios" className="hover:text-white transition-colors">Horarios</Link>
            <Link href="/tarifas" className="hover:text-white transition-colors">Tarifas</Link>
            <Link href="/sucursales" className="hover:text-white transition-colors">Sucursales</Link>
            <Link href="/tracking" className="text-white font-medium">Rastrear</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Package size={28} className="text-primary-900" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Rastrear encomienda</h1>
          <p className="text-sm text-gray-500 mt-2">
            Ingresa el código de seguimiento para ver el estado de tu envío
          </p>
        </div>

        <div className="flex gap-2 mb-8">
          <input
            value={codigo}
            onChange={e => setCodigo(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && buscar()}
            placeholder="Ej: EXP-2026-00001"
            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 uppercase"
          />
          <Button icon={Search} loading={loading} onClick={buscar} size="lg">
            Buscar
          </Button>
        </div>

        {resultado && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Código de seguimiento</p>
                <p className="text-lg font-bold text-gray-900 font-mono">{resultado.codigo}</p>
              </div>
              <Badge estado={resultado.estado} />
            </div>

            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Descripción</p>
              <p className="text-sm text-gray-800">{resultado.descripcion}</p>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Historial de estados</p>
              <TrackingTimeline
                historial={resultado.historial || []}
                estadoActual={resultado.estado}
              />
            </div>

            {resultado.fechaEntregaEst && (
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <p className="text-xs text-blue-600 font-medium">
                  Entrega estimada: {resultado.fechaEntregaEst}
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
