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
  cantEncomiendas?: number
}

interface PerfilConductor {
  tieneFicha: boolean
  licencia?: string
  fechaVencLic?: string | null
  diasVencLic?: number | null
  alertaLicencia?: 'VENCIDA' | 'PROXIMA_A_VENCER' | 'VIGENTE' | 'SIN_FECHA'
}

interface EncomiendaAbordo {
  codigo: string; descripcion: string; bultos: number; fragil: boolean
  estado: string; pagoEnDestino: boolean
  agenciaDestino: string; ciudadDestino?: string; destinatario?: string
}

export default function ConductorPage() {
  const { data, mutate } = useSWR<ViajeDTO[]>('/api/conductor/mis-viajes')
  const viajes: ViajeDTO[] = data || []
  const { data: perfil } = useSWR<PerfilConductor>('/api/conductor/mi-perfil')

  const [viajeSel,       setViajeSel]       = useState<ViajeDTO | null>(null)
  const [viajeEnc,       setViajeEnc]       = useState<ViajeDTO | null>(null)
  const [confirmando,    setConfirmando]    = useState<number | null>(null)
  const [llegando,       setLlegando]       = useState<number | null>(null)

  const { data: pasajeros } = useSWR(
    viajeSel ? `/api/conductor/mis-viajes/${viajeSel.id}/pasajeros` : null
  )
  const { data: encData } = useSWR<EncomiendaAbordo[]>(
    viajeEnc ? `/api/conductor/mis-viajes/${viajeEnc.id}/encomiendas` : null
  )
  // Agrupar encomiendas por agencia de destino (orden del backend)
  const encPorAgencia = React.useMemo(() => {
    const grupos = new Map<string, EncomiendaAbordo[]>()
    for (const e of encData ?? []) {
      const key = e.agenciaDestino + (e.ciudadDestino ? ` — ${e.ciudadDestino}` : '')
      if (!grupos.has(key)) grupos.set(key, [])
      grupos.get(key)!.push(e)
    }
    return grupos
  }, [encData])

  const fmt = (iso: string) => {
    try { return format(new Date(iso), "EEEE dd MMM · HH:mm", { locale: es }) } catch { return '—' }
  }
  const fmtHora = (iso: string) => {
    try { return format(new Date(iso), "HH:mm") } catch { return '—' }
  }

  const confirmarSalida = async (v: ViajeDTO) => {
    // Evitar toques accidentales: la salida mueve las encomiendas a EN_TRANSITO
    if (!confirm(`¿Confirmar salida del viaje ${v.ruta?.origen ?? ''} → ${v.ruta?.destino ?? ''}?`)) return
    setConfirmando(v.id)
    try {
      await api.post(`/api/conductor/mis-viajes/${v.id}/confirmar-salida`)
      toast.success('Salida confirmada — ¡buen viaje!')
      mutate()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Error al confirmar salida')
    } finally { setConfirmando(null) }
  }

  const confirmarLlegada = async (v: ViajeDTO) => {
    if (!confirm(`¿Confirmar que llegaste a ${v.ruta?.destino ?? 'destino'}?`)) return
    setLlegando(v.id)
    try {
      await api.post(`/api/conductor/mis-viajes/${v.id}/confirmar-llegada`)
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

      {/* Alerta de licencia (solo aviso, no bloquea) */}
      {perfil?.tieneFicha && (perfil.alertaLicencia === 'VENCIDA' || perfil.alertaLicencia === 'PROXIMA_A_VENCER') && (
        <div className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm ${
          perfil.alertaLicencia === 'VENCIDA'
            ? 'bg-red-50 border-red-200 text-red-800'
            : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}>
          <AlertTriangle size={16} className="shrink-0" />
          <div>
            <p className="font-semibold">
              {perfil.alertaLicencia === 'VENCIDA'
                ? `Tu licencia ${perfil.licencia} está VENCIDA`
                : `Tu licencia ${perfil.licencia} vence en ${perfil.diasVencLic} día${perfil.diasVencLic === 1 ? '' : 's'}`}
            </p>
            <p className="text-xs opacity-80">Coordina la renovación con la oficina para evitar problemas en ruta.</p>
          </div>
        </div>
      )}

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
                <div className="flex gap-2 flex-wrap">
                  {/* Ver pasajeros */}
                  <button onClick={() => setViajeSel(v)}
                    className="flex-1 min-w-[130px] flex items-center justify-center gap-1.5 px-3 py-2.5 border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50 transition-colors">
                    <Users size={14} /> Pasajeros
                  </button>

                  {/* Ver encomiendas a bordo */}
                  <button onClick={() => setViajeEnc(v)}
                    className="flex-1 min-w-[130px] flex items-center justify-center gap-1.5 px-3 py-2.5 border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50 transition-colors">
                    <Package size={14} /> Encomiendas
                    {(v.cantEncomiendas ?? 0) > 0 && (
                      <span className="bg-[#064e3b] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        {v.cantEncomiendas}
                      </span>
                    )}
                  </button>

                  {/* Confirmar salida */}
                  {esProg && (
                    <button
                      onClick={() => confirmarSalida(v)}
                      disabled={confirmando === v.id}
                      className="flex-1 min-w-[150px] flex items-center justify-center gap-1.5 px-3 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors">
                      {confirmando === v.id
                        ? <Loader2 size={14} className="animate-spin" />
                        : <Navigation size={14} />}
                      {confirmando === v.id ? 'Confirmando…' : 'Confirmar salida'}
                    </button>
                  )}

                  {/* Confirmar llegada */}
                  {esRuta && (
                    <button
                      onClick={() => confirmarLlegada(v)}
                      disabled={llegando === v.id}
                      className="flex-1 min-w-[150px] flex items-center justify-center gap-1.5 px-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors">
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

      {/* Modal encomiendas a bordo, agrupadas por agencia destino */}
      <Modal
        open={!!viajeEnc}
        onClose={() => setViajeEnc(null)}
        title={viajeEnc ? `Encomiendas — ${viajeEnc.ruta?.origen} → ${viajeEnc.ruta?.destino}` : ''}
        size="lg"
      >
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {!encData || encData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Package size={32} className="mb-2 opacity-40" />
              <p className="text-sm">Este viaje no lleva encomiendas</p>
            </div>
          ) : (
            Array.from(encPorAgencia.entries()).map(([agencia, items]) => (
              <div key={agencia}>
                <div className="flex items-center gap-2 mb-2">
                  <MapPin size={13} className="text-[#064e3b]" />
                  <p className="text-sm font-bold text-gray-800">{agencia}</p>
                  <span className="text-xs text-gray-400">
                    {items.length} paquete{items.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="space-y-2">
                  {items.map(e => (
                    <div key={e.codigo} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <div className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center shrink-0">
                        <Package size={15} className="text-[#064e3b]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{e.descripcion}</p>
                        <p className="text-xs text-gray-500 font-mono">{e.codigo}</p>
                        {e.destinatario && (
                          <p className="text-xs text-gray-400 truncate">Para: {e.destinatario}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0 space-y-1">
                        <p className="text-xs text-gray-500">{e.bultos} bulto{e.bultos === 1 ? '' : 's'}</p>
                        <div className="flex gap-1 justify-end">
                          {e.fragil && (
                            <span className="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">FRÁGIL</span>
                          )}
                          {e.pagoEnDestino && (
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">COBRAR</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>

    </div>
  )
}
