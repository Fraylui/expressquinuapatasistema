'use client'
import React, { useState } from 'react'
import useSWR from 'swr'
import { Bus, Clock, MapPin, Users, ChevronRight, User } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import api from '@/services/api'

interface ViajeDTO {
  id: number
  estado: string
  fechaHoraSal: string
  ruta?: { origen: string; destino: string; distanciaKm?: number }
  vehiculo?: { placa: string; tipo: string; numAsientos: number }
}

export default function ConductorPage() {
  const { data } = useSWR('/api/conductor/mis-viajes')
  const viajes: ViajeDTO[] = data || []
  const [viajeSel, setViajeSel] = useState<ViajeDTO | null>(null)
  const { data: pasajeros } = useSWR(
    viajeSel ? `/api/conductor/mis-viajes/${viajeSel.id}/pasajeros` : null
  )

  const formatFecha = (iso: string) => {
    try { return format(new Date(iso), "dd MMM · HH:mm", { locale: es }) } catch { return '—' }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Bus size={20} className="text-[#064e3b]" />
          Mis viajes
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {format(new Date(), "EEEE dd 'de' MMMM yyyy", { locale: es })}
        </p>
      </div>

      {viajes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16">
          <Bus size={40} className="text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">No tienes viajes asignados para hoy</p>
        </div>
      )}

      <div className="space-y-3">
        {viajes.map(v => (
          <div key={v.id}
            className={`bg-white rounded-xl border p-4 ${
              v.estado === 'EN_RUTA' ? 'border-green-200 bg-green-50' : 'border-gray-200'
            }`}>
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  v.estado === 'EN_RUTA' ? 'bg-green-600' : 'bg-[#064e3b]'
                }`}>
                  <Bus size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-base font-bold text-gray-900">
                    {v.ruta?.origen || '—'} → {v.ruta?.destino || '—'}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock size={11} />
                      {formatFecha(v.fechaHoraSal)}
                    </span>
                    {v.vehiculo && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Bus size={11} />
                        {v.vehiculo.placa}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Badge estado={v.estado} />
            </div>

            {/* Detalles */}
            <div className="flex gap-3 mb-3">
              {v.vehiculo && (
                <div className="flex-1 bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-400">Vehículo</p>
                  <p className="text-sm font-semibold text-gray-800 mt-0.5">{v.vehiculo.tipo}</p>
                  <p className="text-xs text-gray-500 font-mono">{v.vehiculo.placa}</p>
                </div>
              )}
              {v.ruta?.distanciaKm && (
                <div className="flex-1 bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-400">Distancia</p>
                  <p className="text-sm font-bold text-gray-800 mt-0.5">{v.ruta.distanciaKm} km</p>
                </div>
              )}
              {v.vehiculo && (
                <div className="flex-1 bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-400">Asientos</p>
                  <p className="text-sm font-bold text-gray-800 mt-0.5">{v.vehiculo.numAsientos - 1}</p>
                  <p className="text-xs text-gray-400">pasajeros</p>
                </div>
              )}
            </div>

            <Button
              variant="secondary"
              size="sm"
              icon={Users}
              onClick={() => setViajeSel(v)}
              className="w-full justify-center"
            >
              Ver lista de pasajeros
            </Button>
          </div>
        ))}
      </div>

      {/* Modal: lista de pasajeros */}
      <Modal
        open={!!viajeSel}
        onClose={() => setViajeSel(null)}
        title={`Pasajeros — ${viajeSel?.ruta?.origen} → ${viajeSel?.ruta?.destino}`}
        size="lg"
      >
        <div className="space-y-2">
          {!pasajeros || (pasajeros as any[]).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No hay pasajeros registrados</p>
          ) : (
            (pasajeros as any[]).map((p, i) => (
              <div key={i} className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-[#064e3b] flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {p.asientoId}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">Asiento #{p.asientoId}</p>
                  <p className="text-xs text-gray-500">
                    {p.serie}-{p.correlativo} · S/ {p.precioFinal}
                  </p>
                </div>
                <Badge estado={p.estado} />
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  )
}
