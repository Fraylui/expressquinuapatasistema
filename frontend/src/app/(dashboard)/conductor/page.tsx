'use client'
import React, { useState } from 'react'
import useSWR from 'swr'
import toast from 'react-hot-toast'
import {
  Bus, Clock, MapPin, Users, Navigation, CheckCircle,
  Package, Loader2, AlertTriangle,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import api from '@/services/api'

interface ViajeDTO {
  id: number
  estado: string
  fechaHoraSal: string
  fechaHoraArr?: string
  ruta?: { origen: string; destino: string; distanciaKm?: number }
  vehiculo?: { placa: string; tipo: string; numAsientos: number }
  asientosLibres?: number
  asientosOcupados?: number
}

export default function ConductorPage() {
  const { data, mutate } = useSWR<ViajeDTO[]>('/api/conductor/mis-viajes')
  const viajes: ViajeDTO[] = data || []

  const [viajeSel,       setViajeSel]       = useState<ViajeDTO | null>(null)
  const [confirmando,    setConfirmando]    = useState<number | null>(null)
  const [llegando,       setLlegando]       = useState<number | null>(null)

  const { data: pasajeros } = useSWR(
    viajeSel ? `/api/conductor/mis-viajes/${viajeSel.id}/pasajeros` : null
  )

  const fmt = (iso: string) => {
    try { return format(new Date(iso), "EEEE dd MMM · HH:mm", { locale: es }) } catch { return '—' }
  }
  const fmtHora = (iso: string) => {
    try { return format(new Date(iso), "HH:mm") } catch { return '—' }
  }

  const confirmarSalida = async (id: number) => {
    setConfirmando(id)
    try {
      await api.post(`/api/conductor/mis-viajes/${id}/confirmar-salida`)
      toast.success('Salida confirmada — ¡buen viaje!')
      mutate()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Error al confirmar salida')
    } finally { setConfirmando(null) }
  }

  const confirmarLlegada = async (id: number) => {
    setLlegando(id)
    try {
      await api.post(`/api/conductor/mis-viajes/${id}/confirmar-llegada`)
      toast.success('Llegada confirmada — viaje completado')
      mutate()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Error al confirmar llegada')
    } finally { setLlegando(null) }
  }

  return (
    <div className="space-y-5 max-w-2xl">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#064e3b] flex items-center justify-center">
          <Bus size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Mis viajes</h1>
          <p className="text-xs text-gray-500">
            {format(new Date(), "EEEE dd 'de' MMMM yyyy", { locale: es })}
          </p>
        </div>
      </div>

      {/* Estado vacío */}
      {viajes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <Bus size={28} className="text-gray-300" />
          </div>
          <p className="text-sm font-semibold text-gray-600">Sin viajes asignados</p>
          <p className="text-xs text-gray-400 mt-1">Cuando te asignen un viaje aparecerá aquí</p>
        </div>
      )}

      {/* Tarjetas de viaje */}
      <div className="space-y-4">
        {viajes.map(v => {
          const esRuta     = v.estado === 'EN_RUTA'
          const esProg     = v.estado === 'PROGRAMADO' || v.estado === 'ATRASADO'
          const atrasado   = v.estado === 'ATRASADO'
          const ocupados   = v.asientosOcupados ?? 0
          const total      = (v.vehiculo?.numAsientos ?? 1) - 1
          const pct        = total > 0 ? Math.round((ocupados / total) * 100) : 0

          return (
            <div key={v.id} className={`bg-white rounded-2xl border overflow-hidden ${
              esRuta ? 'border-emerald-200' : atrasado ? 'border-amber-300' : 'border-gray-200'
            }`}>

              {/* Barra de estado */}
              <div className={`h-1.5 w-full ${esRuta ? 'bg-emerald-500' : atrasado ? 'bg-amber-400 animate-pulse' : 'bg-blue-400'}`} />

              <div className="p-4 space-y-4">

                {/* Ruta + badge */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 text-base font-bold text-gray-900">
                      <MapPin size={14} className="text-[#064e3b] shrink-0" />
                      {v.ruta?.origen || '—'}
                      <span className="text-gray-300">→</span>
                      {v.ruta?.destino || '—'}
                    </div>
                    {v.ruta?.distanciaKm && (
                      <p className="text-xs text-gray-400 mt-0.5 ml-5">{v.ruta.distanciaKm} km</p>
                    )}
                  </div>
                  <Badge estado={v.estado} />
                </div>

                {/* Info: hora + vehículo */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Hora salida</p>
                    <p className="text-lg font-bold text-gray-900 font-mono">{fmtHora(v.fechaHoraSal)}</p>
                    <p className="text-[11px] text-gray-400">{fmt(v.fechaHoraSal).split('·')[0]}</p>
                  </div>
                  {v.vehiculo && (
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Vehículo</p>
                      <p className="text-sm font-bold text-gray-900 font-mono">{v.vehiculo.placa}</p>
                      <p className="text-[11px] text-gray-400">{v.vehiculo.tipo}</p>
                    </div>
                  )}
                </div>

                {/* Ocupación */}
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span className="flex items-center gap-1"><Users size={11} /> {ocupados} / {total} pasajeros</span>
                    <span>{pct}% ocupado</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-red-400' : pct >= 60 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Alerta atrasado */}
                {atrasado && (
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-800">
                    <AlertTriangle size={13} className="shrink-0" />
                    Viaje atrasado — confirma salida cuando estés listo
                  </div>
                )}

                {/* Acciones */}
                <div className="flex gap-2">
                  {/* Ver pasajeros */}
                  <button onClick={() => setViajeSel(v)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50 transition-colors">
                    <Users size={14} /> Ver pasajeros
                  </button>

                  {/* Confirmar salida */}
                  {esProg && (
                    <button
                      onClick={() => confirmarSalida(v.id)}
                      disabled={confirmando === v.id}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors">
                      {confirmando === v.id
                        ? <Loader2 size={14} className="animate-spin" />
                        : <Navigation size={14} />}
                      {confirmando === v.id ? 'Confirmando…' : 'Confirmar salida'}
                    </button>
                  )}

                  {/* Confirmar llegada */}
                  {esRuta && (
                    <button
                      onClick={() => confirmarLlegada(v.id)}
                      disabled={llegando === v.id}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors">
                      {llegando === v.id
                        ? <Loader2 size={14} className="animate-spin" />
                        : <CheckCircle size={14} />}
                      {llegando === v.id ? 'Confirmando…' : 'Confirmar llegada'}
                    </button>
                  )}
                </div>

              </div>
            </div>
          )
        })}
      </div>

      {/* Modal lista de pasajeros */}
      <Modal
        open={!!viajeSel}
        onClose={() => setViajeSel(null)}
        title={viajeSel ? `${viajeSel.ruta?.origen} → ${viajeSel.ruta?.destino}` : ''}
        size="lg"
      >
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {!pasajeros || (pasajeros as any[]).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Package size={32} className="mb-2 opacity-40" />
              <p className="text-sm">Sin pasajeros registrados aún</p>
            </div>
          ) : (
            (pasajeros as any[]).map((p, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-9 h-9 rounded-xl bg-[#064e3b] flex items-center justify-center text-white text-sm font-bold shrink-0">
                  {p.asiento}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{p.nombre}</p>
                  <p className="text-xs text-gray-500">DNI: {p.dni} · Boleta: {p.boleta}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-mono font-bold text-gray-800">S/ {Number(p.precio).toFixed(2)}</p>
                  <Badge estado={p.estado} />
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>

    </div>
  )
}
