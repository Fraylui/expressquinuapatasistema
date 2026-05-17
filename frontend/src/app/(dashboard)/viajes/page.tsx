'use client'
import React, { useState } from 'react'
import useSWR from 'swr'
import toast from 'react-hot-toast'
import { Bus, Clock, MapPin, Users, ChevronRight, CheckCircle, AlertCircle, FileText } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/stores/authStore'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import api from '@/services/api'
import { useRouter } from 'next/navigation'

interface ViajeDTO {
  id: number
  estado: string
  fechaHoraSal: string
  ruta?: { origen: string; destino: string; distanciaKm?: number }
  vehiculo?: { placa: string; tipo: string; numAsientos: number }
}

const ESTADO_COLOR: Record<string, string> = {
  PROGRAMADO: 'bg-blue-50 border-blue-200',
  EN_RUTA:    'bg-green-50 border-green-200',
  COMPLETADO: 'bg-gray-50 border-gray-200',
  CANCELADO:  'bg-red-50 border-red-200',
}

export default function ViajesPage() {
  const { data, mutate } = useSWR('/api/viajes')
  const viajes: ViajeDTO[] = data || []
  const { user, hasModulo } = useAuthStore()
  const [confirmando, setConfirmando] = useState<number | null>(null)
  const router = useRouter()

  const puedeConfirmar = user?.rol && ['SUPER_ADMIN','GERENTE','OPERADOR'].includes(user.rol)

  const confirmarSalida = async (viajeId: number) => {
    setConfirmando(viajeId)
    try {
      await api.post(`/api/viajes/${viajeId}/confirmar-salida`)
      toast.success('Salida confirmada — viaje en ruta')
      mutate()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al confirmar salida')
    } finally {
      setConfirmando(null)
    }
  }

  const formatFecha = (iso: string) => {
    try { return format(new Date(iso), "HH:mm", { locale: es }) } catch { return '—' }
  }

  const programados = viajes.filter(v => v.estado === 'PROGRAMADO')
  const enRuta      = viajes.filter(v => v.estado === 'EN_RUTA')
  const completados = viajes.filter(v => v.estado === 'COMPLETADO' || v.estado === 'CANCELADO')

  const ViajeCard = ({ v }: { v: ViajeDTO }) => (
    <div className={`bg-white rounded-xl border p-4 transition-shadow hover:shadow-sm ${ESTADO_COLOR[v.estado] ?? 'border-gray-200'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            v.estado === 'EN_RUTA' ? 'bg-green-100' : 'bg-[#1F3864]/10'
          }`}>
            <Bus size={18} className={v.estado === 'EN_RUTA' ? 'text-green-700' : 'text-[#1F3864]'} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {v.ruta?.origen || '—'} → {v.ruta?.destino || '—'}
            </p>
            <p className="text-xs text-gray-400">Viaje #{v.id}</p>
          </div>
        </div>
        <Badge estado={v.estado} />
      </div>

      <div className="flex flex-wrap gap-3 mb-3">
        <span className="flex items-center gap-1.5 text-xs text-gray-500">
          <Clock size={12} />
          {formatFecha(v.fechaHoraSal)}
        </span>
        {v.vehiculo && (
          <>
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <Bus size={12} />
              {v.vehiculo.placa}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <Users size={12} />
              {v.vehiculo.tipo} · {v.vehiculo.numAsientos - 1} pas.
            </span>
          </>
        )}
        {v.ruta?.distanciaKm && (
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <MapPin size={12} />
            {v.ruta.distanciaKm} km
          </span>
        )}
      </div>

      <div className="flex gap-2">
        {v.estado === 'PROGRAMADO' && puedeConfirmar && (
          <Button
            size="sm"
            variant="primary"
            icon={CheckCircle}
            loading={confirmando === v.id}
            onClick={() => confirmarSalida(v.id)}
            className="flex-1 justify-center"
          >
            Confirmar salida
          </Button>
        )}
        {v.estado === 'EN_RUTA' && (
          <div className="flex items-center gap-1.5 text-xs text-green-700 font-medium">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            En ruta
          </div>
        )}
        {hasModulo('MANIFIESTOS') && (
          <Button size="sm" variant="secondary" icon={FileText} className="justify-center"
            onClick={() => router.push('/manifiestos')}>
            Manifiesto
          </Button>
        )}
      </div>
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Viajes</h1>
          <p className="text-sm text-gray-500" suppressHydrationWarning>
            {format(new Date(), "EEEE dd 'de' MMMM yyyy", { locale: es })}
          </p>
        </div>
        <div className="flex gap-2 text-xs text-gray-500">
          <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full font-medium">
            {programados.length} programados
          </span>
          <span className="px-2 py-1 bg-green-50 text-green-700 rounded-full font-medium">
            {enRuta.length} en ruta
          </span>
        </div>
      </div>

      {viajes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16">
          <Bus size={40} className="text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">No hay viajes registrados</p>
        </div>
      )}

      {programados.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
            Programados ({programados.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {programados.map(v => <ViajeCard key={v.id} v={v} />)}
          </div>
        </div>
      )}

      {enRuta.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
            En ruta ({enRuta.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {enRuta.map(v => <ViajeCard key={v.id} v={v} />)}
          </div>
        </div>
      )}

      {completados.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
            Completados / Cancelados ({completados.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 opacity-70">
            {completados.map(v => <ViajeCard key={v.id} v={v} />)}
          </div>
        </div>
      )}
    </div>
  )
}
