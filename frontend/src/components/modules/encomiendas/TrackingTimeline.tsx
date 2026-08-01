'use client'
import React from 'react'
import { CheckCircle2, Circle, Loader } from 'lucide-react'
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

/** Cada paso puede agrupar varios estados internos del backend bajo un mismo hito visible al cliente. */
const ESTADOS_ORDEN = [
  { key: 'REGISTRADO',        keys: ['REGISTRADO', 'RECEPCIONADO', 'ALMACENADO', 'CARGADO'], label: 'Registrado' },
  { key: 'EN_TRANSITO',       keys: ['EN_TRANSITO'],                                          label: 'En tránsito' },
  { key: 'LLEGADO_AGENCIA',   keys: ['LLEGADO_AGENCIA', 'DISPONIBLE'],                        label: 'Disponible en agencia' },
  { key: 'ENTREGADO',         keys: ['ENTREGADO'],                                             label: 'Entregado' },
]

const ESTADOS_ALTERNATIVOS = [
  { key: 'DEVUELTO', keys: ['DEVUELTO'], label: 'Devuelto' },
  { key: 'PERDIDO',  keys: ['PERDIDO'],  label: 'Perdido' },
  { key: 'OBSERVADO', keys: ['OBSERVADO'], label: 'Observado' },
]

/* Color del estado actual: verde en el flujo normal, alerta en los alternativos */
const COLOR_ACTUAL: Record<string, string> = {
  DEVUELTO: '#ea580c',
  PERDIDO:  '#dc2626',
}

const GREEN = '#16a34a'

/** Timeline de la página pública de rastreo — estilado sobre fondo navy. */
export const TrackingTimeline: React.FC<TrackingTimelineProps> = ({ historial, estadoActual }) => {
  const completados = historial.map(h => h.estadoNuevo)
  const esAlternativo = ESTADOS_ALTERNATIVOS.some(e => e.keys.includes(estadoActual))

  const estados = esAlternativo
    ? [...ESTADOS_ORDEN, ...ESTADOS_ALTERNATIVOS.filter(e => e.keys.includes(estadoActual))]
    : ESTADOS_ORDEN

  return (
    <div className="flex items-start gap-0 overflow-x-auto py-3">
      {estados.map((estado, i) => {
        const completado = estado.keys.some(k => completados.includes(k))
        const esActual = estado.keys.includes(estadoActual)
        const histItem = [...historial].reverse().find(h => estado.keys.includes(h.estadoNuevo))
        const fecha = histItem ? new Date(histItem.createdAt) : null
        const fechaValida = fecha && !isNaN(fecha.getTime())
        const colorActual = COLOR_ACTUAL[estado.key] ?? GREEN

        return (
          <React.Fragment key={estado.key}>
            <div className="flex min-w-[100px] flex-col items-center">
              <div className="mb-2 flex h-8 w-8 items-center justify-center">
                {completado && !esActual ? (
                  <CheckCircle2 size={28} strokeWidth={2} style={{ color: '#4ade80' }} />
                ) : esActual ? (
                  <div
                    className="flex h-7 w-7 animate-pulse items-center justify-center rounded-full"
                    style={{ background: colorActual, boxShadow: `0 0 16px ${colorActual}66` }}
                  >
                    <Loader size={14} className="animate-spin text-white" />
                  </div>
                ) : (
                  <Circle size={28} style={{ color: 'rgba(255,255,255,0.18)' }} />
                )}
              </div>
              <p
                className="text-center text-xs font-semibold leading-tight"
                style={{ color: completado || esActual ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.32)' }}
              >
                {estado.label}
              </p>
              {fechaValida && (
                <p className="mt-1 text-center text-xs" style={{ color: 'rgba(255,255,255,0.38)' }}>
                  {format(fecha!, 'dd MMM HH:mm', { locale: es })}
                </p>
              )}
              {histItem?.usuarioNombre && (
                <p className="text-center text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {histItem.usuarioNombre}
                </p>
              )}
            </div>
            {i < estados.length - 1 && (
              <div
                className="mt-4 h-0.5 min-w-[30px] flex-1 rounded-full"
                style={{
                  background: estados[i + 1].keys.some(k => completados.includes(k))
                    ? GREEN
                    : 'rgba(255,255,255,0.1)',
                }}
              />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}
