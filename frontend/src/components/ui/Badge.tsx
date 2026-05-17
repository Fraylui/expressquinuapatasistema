import React from 'react'

interface BadgeProps {
  estado: string
  label?: string
  className?: string
}

const estadoConfig: Record<string, { color: string; label: string }> = {
  DISPONIBLE:   { color: 'bg-green-100 text-green-800 border-green-200',   label: 'Disponible' },
  VENDIDO:      { color: 'bg-red-100 text-red-800 border-red-200',         label: 'Vendido' },
  RESERVADO:    { color: 'bg-blue-100 text-blue-800 border-blue-200',      label: 'Reservado' },
  BLOQUEADO:    { color: 'bg-gray-100 text-gray-600 border-gray-200',      label: 'Bloqueado' },
  EN_TRANSITO:  { color: 'bg-cyan-100 text-cyan-800 border-cyan-200',      label: 'En tránsito' },
  ENTREGADO:    { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', label: 'Entregado' },
  REGISTRADO:   { color: 'bg-blue-100 text-blue-700 border-blue-200',      label: 'Registrado' },
  DEVUELTO:     { color: 'bg-orange-100 text-orange-800 border-orange-200',label: 'Devuelto' },
  PERDIDO:      { color: 'bg-red-200 text-red-900 border-red-300',         label: 'Perdido' },
  PROGRAMADO:   { color: 'bg-indigo-100 text-indigo-800 border-indigo-200',label: 'Programado' },
  EN_RUTA:      { color: 'bg-yellow-100 text-yellow-800 border-yellow-200',label: 'En ruta' },
  COMPLETADO:   { color: 'bg-green-100 text-green-800 border-green-200',   label: 'Completado' },
  CANCELADO:    { color: 'bg-red-100 text-red-700 border-red-200',         label: 'Cancelado' },
  ABIERTA:      { color: 'bg-green-100 text-green-800 border-green-200',   label: 'Abierta' },
  CERRADA:      { color: 'bg-gray-100 text-gray-700 border-gray-200',      label: 'Cerrada' },
  EMITIDO:      { color: 'bg-blue-100 text-blue-800 border-blue-200',      label: 'Emitido' },
  ANULADO:      { color: 'bg-red-100 text-red-700 border-red-200',         label: 'Anulado' },
  USADO:        { color: 'bg-gray-100 text-gray-600 border-gray-200',      label: 'Usado' },
}

export const Badge: React.FC<BadgeProps> = ({ estado, label, className = '' }) => {
  const config = estadoConfig[estado] || {
    color: 'bg-gray-100 text-gray-600 border-gray-200',
    label: estado,
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.color} ${className}`}>
      {label || config.label}
    </span>
  )
}
