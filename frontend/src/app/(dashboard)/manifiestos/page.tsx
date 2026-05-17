'use client'
import React, { useState } from 'react'
import useSWR from 'swr'
import toast from 'react-hot-toast'
import {
  FileText, Download, Bus, Clock, Users, MapPin,
  CheckCircle, AlertCircle, Loader2, Eye
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import api from '@/services/api'

interface ViajeItem {
  id: number
  estado: string
  fechaHoraSal: string
  ruta?: { origen: string; destino: string }
  vehiculo?: { placa: string; tipo: string; numAsientos: number }
}

interface PasajeroItem {
  item: number
  pasajeId: number
  correlativo: string
  nombres: string
  apellidos: string
  tipoDoc: string
  numDoc: string
  numAsiento: number
  precioFinal: number
  formaPago: string
  estadoPasaje: string
}

interface ManifiestoData {
  viajeId: number
  estado: string
  fechaHoraSal: string
  rutaOrigen: string
  rutaDestino: string
  vehiculoPlaca: string
  vehiculoTipo: string
  conductorNombre: string
  conductorLicencia: string
  agenciaNombre: string
  totalPasajeros: number
  totalRecaudado: number
  pasajeros: PasajeroItem[]
}

export default function ManifiestosPage() {
  const { data: viajesData } = useSWR('/api/viajes')
  const viajes: ViajeItem[] = viajesData || []

  const [viajeSelId, setViajeSelId] = useState<number | null>(null)
  const [manifiesto, setManifiesto] = useState<ManifiestoData | null>(null)
  const [cargando, setCargando]     = useState(false)
  const [descargando, setDescargando] = useState<'pdf' | 'ticket' | null>(null)

  const viajeActivos = viajes.filter(v =>
    ['PROGRAMADO', 'EN_RUTA', 'COMPLETADO'].includes(v.estado)
  )

  const cargarManifiesto = async (viajeId: number) => {
    setViajeSelId(viajeId)
    setCargando(true)
    setManifiesto(null)
    try {
      const res = await api.get(`/api/manifiestos/${viajeId}/datos`)
      setManifiesto((res.data as any).data)
    } catch {
      toast.error('Error al cargar el manifiesto')
    } finally {
      setCargando(false)
    }
  }

  const descargarPdfManifiesto = async () => {
    if (!viajeSelId) return
    setDescargando('pdf')
    try {
      const res = await api.get(`/api/manifiestos/${viajeSelId}/pdf`, {
        responseType: 'blob'
      })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `manifiesto-viaje-${viajeSelId}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Manifiesto descargado')
    } catch {
      toast.error('Error al generar el PDF')
    } finally {
      setDescargando(null)
    }
  }

  const descargarTicket = async (pasajeId: number, correlativo: string) => {
    setDescargando('ticket')
    try {
      const res = await api.get(`/api/manifiestos/ticket/${pasajeId}/pdf`, {
        responseType: 'blob'
      })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `ticket-${correlativo}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Ticket descargado')
    } catch {
      toast.error('Error al generar el ticket')
    } finally {
      setDescargando(null)
    }
  }

  const formatFecha = (iso: string) => {
    try { return format(new Date(iso), "dd MMM yyyy · HH:mm", { locale: es }) } catch { return iso }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Manifiestos</h1>
        <p className="text-sm text-gray-500">Documento legal obligatorio — MTC Ley 27181</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Panel izquierdo: lista de viajes ── */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Selecciona un viaje</h3>
            {viajeActivos.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8">No hay viajes disponibles</p>
            ) : (
              <div className="space-y-2">
                {viajeActivos.map(v => (
                  <button
                    key={v.id}
                    onClick={() => cargarManifiesto(v.id)}
                    className={`w-full p-3 rounded-lg border text-left transition-all ${
                      viajeSelId === v.id
                        ? 'border-[#1F3864] bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Bus size={13} className="text-[#1F3864] shrink-0" />
                      <span className="text-xs font-semibold text-gray-900 truncate">
                        {v.ruta?.origen ?? '—'} → {v.ruta?.destino ?? '—'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock size={10} />
                        {formatFecha(v.fechaHoraSal)}
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <Badge estado={v.estado} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Panel derecho: contenido del manifiesto ── */}
        <div className="lg:col-span-2">
          {!viajeSelId && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 flex flex-col items-center justify-center">
              <FileText size={40} className="text-gray-300 mb-3" />
              <p className="text-sm text-gray-400">Selecciona un viaje para ver su manifiesto</p>
            </div>
          )}

          {viajeSelId && cargando && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 flex flex-col items-center justify-center">
              <Loader2 size={32} className="text-[#1F3864] animate-spin mb-3" />
              <p className="text-sm text-gray-400">Cargando manifiesto...</p>
            </div>
          )}

          {manifiesto && !cargando && (
            <div className="space-y-4">
              {/* Header del manifiesto */}
              <div className="bg-[#1F3864] rounded-xl p-5 text-white">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-blue-300 uppercase tracking-widest mb-1">Manifiesto de Pasajeros</p>
                    <h2 className="text-lg font-bold">
                      {manifiesto.rutaOrigen} → {manifiesto.rutaDestino}
                    </h2>
                    <p className="text-sm text-blue-200 mt-1">{formatFecha(manifiesto.fechaHoraSal)}</p>
                  </div>
                  <Button
                    variant="primary"
                    icon={Download}
                    loading={descargando === 'pdf'}
                    onClick={descargarPdfManifiesto}
                    className="bg-white text-[#1F3864] hover:bg-blue-50 shrink-0"
                  >
                    Descargar PDF
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-blue-700">
                  <div>
                    <p className="text-xs text-blue-300">Vehículo</p>
                    <p className="text-sm font-medium">{manifiesto.vehiculoPlaca} · {manifiesto.vehiculoTipo}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-300">Conductor</p>
                    <p className="text-sm font-medium">{manifiesto.conductorNombre || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-300">Total pasajeros</p>
                    <p className="text-2xl font-bold">{manifiesto.totalPasajeros}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-300">Total recaudado</p>
                    <p className="text-2xl font-bold">
                      S/ {manifiesto.totalRecaudado?.toFixed(2) ?? '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Tabla de pasajeros */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">
                    Lista de pasajeros ({manifiesto.pasajeros.length})
                  </h3>
                  {manifiesto.pasajeros.length === 0 && (
                    <span className="text-xs text-amber-600 flex items-center gap-1">
                      <AlertCircle size={12} />
                      Sin pasajeros registrados
                    </span>
                  )}
                </div>

                {manifiesto.pasajeros.length === 0 ? (
                  <div className="py-10 text-center">
                    <Users size={32} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No hay pasajeros en este viaje</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 uppercase tracking-wide">
                          <th className="px-3 py-2.5 text-left font-medium">#</th>
                          <th className="px-3 py-2.5 text-left font-medium">Pasajero</th>
                          <th className="px-3 py-2.5 text-left font-medium">Doc</th>
                          <th className="px-3 py-2.5 text-center font-medium">Asiento</th>
                          <th className="px-3 py-2.5 text-right font-medium">Precio</th>
                          <th className="px-3 py-2.5 text-center font-medium">Estado</th>
                          <th className="px-3 py-2.5 text-center font-medium">Ticket</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {manifiesto.pasajeros.map(p => (
                          <tr key={p.pasajeId} className="hover:bg-gray-50 transition-colors">
                            <td className="px-3 py-2.5 text-gray-400 font-mono">{p.item}</td>
                            <td className="px-3 py-2.5">
                              <p className="font-medium text-gray-900">{p.apellidos}, {p.nombres}</p>
                              <p className="text-gray-400">{p.correlativo}</p>
                            </td>
                            <td className="px-3 py-2.5 text-gray-600">
                              <span className="font-medium">{p.tipoDoc}</span> {p.numDoc}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#1F3864] text-white font-bold text-sm">
                                {p.numAsiento}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right font-semibold text-gray-900">
                              S/ {p.precioFinal?.toFixed(2) ?? '—'}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                p.estadoPasaje === 'EMITIDO'
                                  ? 'bg-green-100 text-green-700'
                                  : p.estadoPasaje === 'ANULADO'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-gray-100 text-gray-600'
                              }`}>
                                {p.estadoPasaje === 'EMITIDO' && <CheckCircle size={10} />}
                                {p.estadoPasaje}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <button
                                onClick={() => descargarTicket(p.pasajeId, p.correlativo)}
                                disabled={descargando === 'ticket'}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-[#1F3864] hover:bg-blue-50 transition-colors disabled:opacity-50"
                                title="Descargar ticket"
                              >
                                {descargando === 'ticket'
                                  ? <Loader2 size={14} className="animate-spin" />
                                  : <Download size={14} />}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
