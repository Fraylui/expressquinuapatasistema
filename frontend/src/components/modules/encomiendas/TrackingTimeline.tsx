'use client'
import React from 'react'
import { CheckCircle, Circle, Loader } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface TrackingTimelineProps {
  historial: Array<{
    estadoNuevo: string
    createdAt: string
    usuarioNombre?: string
    observacion?: string
  }>
  estadoActual: string
}

const ESTADOS_ORDEN = [
  { key: 'REGISTRADO',  label: 'Registrado' },
  { key: 'EN_TRANSITO', label: 'En tránsito' },
  { key: 'ENTREGADO',   label: 'Entregado' },
]

const ESTADOS_ALTERNATIVOS = [
  { key: 'DEVUELTO', label: 'Devuelto' },
  { key: 'PERDIDO',  label: 'Perdido' },
]

export const TrackingTimeline: React.FC<TrackingTimelineProps> = ({ historial, estadoActual }) => {
  const completados = historial.map(h => h.estadoNuevo)
  const esAlternativo = ESTADOS_ALTERNATIVOS.some(e => e.key === estadoActual)

  const estados = esAlternativo
    ? [...ESTADOS_ORDEN, ...ESTADOS_ALTERNATIVOS.filter(e => e.key === estadoActual)]
    : ESTADOS_ORDEN

  return (
    <div className="flex items-start gap-0 overflow-x-auto py-4">
      {estados.map((estado, i) => {
        const completado = completados.includes(estado.key)
        const esActual = estadoActual === estado.key
        const histItem = historial.find(h => h.estadoNuevo === estado.key)

        return (
          <React.Fragment key={estado.key}>
            <div className="flex flex-col items-center min-w-[100px]">
              <div className="flex items-center justify-center w-8 h-8 mb-2">
                {completado && !esActual ? (
                  <CheckCircle size={28} className="text-primary-900 fill-primary-900 text-white" />
                ) : esActual ? (
                  <div className="w-7 h-7 rounded-full bg-accent-700 flex items-center justify-center animate-pulse">
                    <Loader size={14} className="text-white animate-spin" />
                  </div>
                ) : (
                  <Circle size={28} className="text-gray-300" />
                )}
              </div>
              <p className={`text-xs font-semibold text-center leading-tight ${
                completado || esActual ? 'text-gray-800' : 'text-gray-400'
              }`}>
                {estado.label}
              </p>
              {histItem && !isNaN(new Date(histItem.createdAt).getTime()) && (
                <p className="text-xs text-gray-400 text-center mt-1">
                  {format(new Date(histItem.createdAt), 'dd MMM HH:mm', { locale: es })}
                </p>
              )}
              {histItem?.usuarioNombre && (
                <p className="text-xs text-gray-400 text-center">{histItem.usuarioNombre}</p>
              )}
            </div>
            {i < estados.length - 1 && (
              <div className={`flex-1 h-0.5 mt-4 min-w-[30px] ${
                completados.includes(estados[i + 1].key) || completado
                  ? 'bg-primary-900'
                  : 'bg-gray-200'
              }`} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}
