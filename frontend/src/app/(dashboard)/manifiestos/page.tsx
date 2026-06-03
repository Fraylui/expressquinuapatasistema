'use client'
import React, { useState, useCallback } from 'react'
import useSWR from 'swr'
import toast from 'react-hot-toast'
import {
  FileText, Download, Bus, Clock, Users, Package,
  CheckCircle, AlertCircle, Loader2, History,
  ArrowRight, RefreshCw, ChevronDown, ChevronUp,
  PrinterIcon, Sparkles, Info,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  manifiestoService,
  type ManifiestoDetalle,
  type ManifiestoResumen,
  type ManifiestoViaje,
} from '@/services/manifiestos.service'
import { useAuthStore } from '@/stores/authStore'

type PageTab = 'viajes' | 'historial'

const ESTADO_COLORS: Record<string, string> = {
  BORRADOR: 'bg-gray-100 text-gray-600',
  EMITIDO:  'bg-blue-100 text-blue-700',
  ENVIADO:  'bg-green-100 text-green-700',
}

const ESTADO_NEXT: Record<string, string> = {
  BORRADOR: 'EMITIDO',
  EMITIDO:  'ENVIADO',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFecha(iso?: string | null) {
  if (!iso) return '—'
  try { return format(new Date(iso), "dd MMM yyyy · HH:mm", { locale: es }) } catch { return iso }
}

function openBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Historial tab ─────────────────────────────────────────────────────────────

function HistorialTab() {
  const { data, isLoading, mutate } = useSWR(
    '/api/manifiestos',
    () => manifiestoService.lista(),
    { revalidateOnFocus: false }
  )
  const historial: ManifiestoResumen[] = data ?? []
  const [cambiando, setCambiando] = useState<number | null>(null)

  const avanzarEstado = async (m: ManifiestoResumen) => {
    const next = ESTADO_NEXT[m.estado]
    if (!next) return
    setCambiando(m.id)
    try {
      await manifiestoService.cambiarEstado(m.id, next)
      toast.success(`Estado cambiado a ${next}`)
      mutate()
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Error al cambiar estado')
    } finally { setCambiando(null) }
  }

  if (isLoading) return (
    <div className="flex justify-center items-center py-20 text-gray-400">
      <Loader2 size={22} className="animate-spin mr-2" /> Cargando historial...
    </div>
  )

  if (historial.length === 0) return (
    <div className="text-center py-20 text-gray-400">
      <History size={40} className="mx-auto mb-2 opacity-30" />
      <p>No hay manifiestos guardados</p>
    </div>
  )

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800 text-sm">Manifiestos guardados</h3>
        <button onClick={() => mutate()} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
          <RefreshCw size={14} />
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {['Número', 'Viaje #', 'Pasajeros', 'Encomiendas', 'Fecha', 'Estado', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {historial.map(m => (
              <tr key={m.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono font-medium text-gray-800">{m.numero}</td>
                <td className="px-4 py-3 text-gray-500">#{m.viajeId}</td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1 text-gray-600">
                    <Users size={12} className="text-blue-500" /> {m.totalPasajeros}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1 text-gray-600">
                    <Package size={12} className="text-amber-500" /> {m.totalEncomiendas}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                  {formatFecha(m.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ESTADO_COLORS[m.estado] ?? 'bg-gray-100 text-gray-600'}`}>
                    {m.estado}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {ESTADO_NEXT[m.estado] && (
                    <button
                      onClick={() => avanzarEstado(m)}
                      disabled={cambiando === m.id}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                    >
                      {cambiando === m.id
                        ? <Loader2 size={11} className="animate-spin" />
                        : <ArrowRight size={11} />}
                      {ESTADO_NEXT[m.estado]}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Panel derecho del manifiesto ──────────────────────────────────────────────

interface ManifiestosPanelProps {
  viajeId: number
  result: ManifiestoViaje
  onGenerado: () => void
}

function ManifiestoPanel({ viajeId, result, onGenerado }: ManifiestosPanelProps) {
  const { datos, manifiesto } = result
  const [mostrarEnc, setMostrarEnc] = useState(true)
  const [descargando, setDescargando] = useState<'pdf' | 'pdf-enc' | number | null>(null)
  const [generando, setGenerando] = useState(false)

  const estaVacio = datos.totalPasajeros === 0 && datos.totalEncomiendas === 0

  const descargarPdf = async () => {
    setDescargando('pdf')
    try {
      const blob = await manifiestoService.descargarPdf(viajeId)
      openBlob(blob, `manifiesto-viaje-${viajeId}.pdf`)
      toast.success('PDF descargado')
    } catch { toast.error('Error al generar el PDF') }
    finally { setDescargando(null) }
  }

  const descargarPdfEncomiendas = async () => {
    setDescargando('pdf-enc')
    try {
      const blob = await manifiestoService.descargarPdfEncomiendas(viajeId)
      openBlob(blob, `encomiendas-viaje-${viajeId}.pdf`)
      toast.success('PDF de encomiendas descargado')
    } catch { toast.error('Error al generar el PDF de encomiendas') }
    finally { setDescargando(null) }
  }

  const descargarTicket = async (pasajeId: number, correlativo: string) => {
    setDescargando(pasajeId)
    try {
      const blob = await manifiestoService.descargarTicket(pasajeId)
      openBlob(blob, `ticket-${correlativo}.pdf`)
      toast.success('Ticket descargado')
    } catch { toast.error('Error al generar el ticket') }
    finally { setDescargando(null) }
  }

  const generarManifiesto = async () => {
    setGenerando(true)
    try {
      await manifiestoService.generar(viajeId)
      toast.success('Manifiesto generado correctamente')
      onGenerado()
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Error al generar el manifiesto')
    } finally { setGenerando(false) }
  }

  if (estaVacio) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 flex flex-col items-center justify-center">
        <Info size={36} className="text-gray-300 mb-3" />
        <p className="text-sm font-medium text-gray-500">Este viaje no tiene pasajeros ni encomiendas registradas aún.</p>
        <p className="text-xs text-gray-400 mt-1">Vende pasajes o registra encomiendas para generar el manifiesto.</p>
      </div>
    )
  }

  return (
    <>
      {/* Header del manifiesto */}
      <div className="bg-[#064e3b] rounded-xl p-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            {manifiesto && (
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-mono">
                  {manifiesto.numero}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  manifiesto.estado === 'EMITIDO' ? 'bg-blue-400/30 text-blue-100' :
                  manifiesto.estado === 'ENVIADO' ? 'bg-green-400/30 text-green-100' :
                  'bg-white/10 text-blue-200'
                }`}>{manifiesto.estado}</span>
              </div>
            )}
            <p className="text-xs text-blue-300 uppercase tracking-widest mb-0.5">Manifiesto de Pasajeros y Carga</p>
            <h2 className="text-lg font-bold">
              {datos.rutaOrigen} → {datos.rutaDestino}
            </h2>
            <p className="text-sm text-blue-200 mt-0.5">{formatFecha(datos.fechaHoraSal)}</p>
          </div>

          <div className="flex flex-col gap-2 shrink-0">
            {manifiesto ? (
              <>
                <button onClick={descargarPdf} disabled={descargando === 'pdf'}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white text-[#064e3b] text-xs rounded-lg hover:bg-blue-50 font-semibold disabled:opacity-50">
                  {descargando === 'pdf' ? <Loader2 size={12} className="animate-spin" /> : <PrinterIcon size={12} />}
                  Imprimir pasajeros PDF
                </button>
                <button onClick={descargarPdfEncomiendas} disabled={descargando === 'pdf-enc'}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white/10 text-white text-xs rounded-lg hover:bg-white/20 font-medium disabled:opacity-50">
                  {descargando === 'pdf-enc' ? <Loader2 size={12} className="animate-spin" /> : <PrinterIcon size={12} />}
                  Imprimir encomiendas PDF
                </button>
              </>
            ) : (
              <button onClick={generarManifiesto} disabled={generando}
                className="flex items-center gap-2 px-4 py-2.5 bg-white text-[#064e3b] text-sm rounded-lg hover:bg-blue-50 font-bold shadow disabled:opacity-50">
                {generando ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Generar manifiesto
              </button>
            )}
          </div>
        </div>

        {!manifiesto && (
          <div className="mt-3 flex items-center gap-2 bg-amber-400/20 rounded-lg px-3 py-2">
            <AlertCircle size={13} className="text-amber-300 shrink-0" />
            <p className="text-xs text-amber-200">Vista previa — el manifiesto aún no ha sido generado</p>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-blue-700">
          <div>
            <p className="text-xs text-blue-300">Vehículo</p>
            <p className="text-sm font-medium">{datos.vehiculoPlaca} · {datos.vehiculoTipo}</p>
          </div>
          <div>
            <p className="text-xs text-blue-300">Conductor</p>
            <p className="text-sm font-medium">{datos.conductorNombre || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-blue-300">Pasajeros</p>
            <p className="text-2xl font-bold">{datos.totalPasajeros}</p>
          </div>
          <div>
            <p className="text-xs text-blue-300">Encomiendas</p>
            <p className="text-2xl font-bold">{datos.totalEncomiendas}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-blue-800/50">
          <div>
            <p className="text-xs text-blue-300">Recaudado pasajes</p>
            <p className="text-base font-bold">S/ {(datos.totalRecaudado ?? 0).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-blue-300">Flete encomiendas</p>
            <p className="text-base font-bold">S/ {(datos.totalMontoEncomiendas ?? 0).toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Tabla de pasajeros */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Users size={15} className="text-blue-500" />
            Pasajeros ({datos.pasajeros.length})
          </h3>
          {datos.pasajeros.length === 0 && (
            <span className="text-xs text-amber-600 flex items-center gap-1">
              <AlertCircle size={12} /> Sin pasajeros vendidos
            </span>
          )}
        </div>

        {datos.pasajeros.length === 0 ? (
          <div className="py-8 text-center text-gray-400">
            <Users size={28} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No hay pasajeros en este viaje</p>
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
                {datos.pasajeros.map(p => (
                  <tr key={p.pasajeId} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-gray-400 font-mono">{p.item}</td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-gray-900">{p.apellidos}, {p.nombres}</p>
                      <p className="text-gray-400">{p.correlativo}</p>
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">
                      <span className="font-medium">{p.tipoDoc}</span> {p.numDoc}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#064e3b] text-white font-bold text-sm">
                        {p.numAsiento}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-gray-900">
                      S/ {p.precioFinal?.toFixed(2) ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        p.estadoPasaje === 'EMITIDO' ? 'bg-green-100 text-green-700' :
                        p.estadoPasaje === 'ANULADO' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {p.estadoPasaje === 'EMITIDO' && <CheckCircle size={10} />}
                        {p.estadoPasaje}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => descargarTicket(p.pasajeId, p.correlativo)}
                        disabled={descargando === p.pasajeId}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-[#064e3b] hover:bg-blue-50 disabled:opacity-50"
                        title="Descargar ticket">
                        {descargando === p.pasajeId
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

      {/* Tabla de encomiendas */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => setMostrarEnc(v => !v)}
          className="w-full px-4 py-3 border-b border-gray-100 flex items-center justify-between hover:bg-gray-50"
        >
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Package size={15} className="text-amber-500" />
            Encomiendas ({datos.encomiendas?.length ?? 0})
          </h3>
          {mostrarEnc ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </button>

        {mostrarEnc && (
          datos.encomiendas?.length === 0 ? (
            <div className="py-8 text-center text-gray-400">
              <Package size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Sin encomiendas en este viaje</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-amber-50 text-gray-500 uppercase tracking-wide">
                    <th className="px-3 py-2.5 text-left font-medium">#</th>
                    <th className="px-3 py-2.5 text-left font-medium">Tracking</th>
                    <th className="px-3 py-2.5 text-left font-medium">Descripción</th>
                    <th className="px-3 py-2.5 text-center font-medium">Kg / Bultos</th>
                    <th className="px-3 py-2.5 text-right font-medium">Flete</th>
                    <th className="px-3 py-2.5 text-left font-medium">Remitente</th>
                    <th className="px-3 py-2.5 text-left font-medium">Destinatario</th>
                    <th className="px-3 py-2.5 text-center font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {datos.encomiendas?.map(ei => (
                    <tr key={ei.encomiendaId} className="hover:bg-amber-50/40">
                      <td className="px-3 py-2.5 text-gray-400 font-mono">{ei.item}</td>
                      <td className="px-3 py-2.5 font-mono text-[#064e3b] font-medium">{ei.codigoTracking}</td>
                      <td className="px-3 py-2.5 text-gray-700 max-w-[160px] truncate">{ei.descripcion}</td>
                      <td className="px-3 py-2.5 text-center text-gray-600">
                        {ei.pesoKg != null ? `${ei.pesoKg} kg` : '—'}
                        {ei.numBultos != null ? ` / ${ei.numBultos} blt` : ''}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-gray-900">
                        S/ {ei.precioEnvio?.toFixed(2) ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-gray-600 max-w-[120px] truncate">{ei.remitente}</td>
                      <td className="px-3 py-2.5 text-gray-600 max-w-[120px] truncate">{ei.destinatario}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          {ei.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ManifiestosPage() {
  const { data: viajesData } = useSWR('/api/viajes')
  const viajes = (viajesData as any[]) ?? []

  const [tab, setTab] = useState<PageTab>('viajes')
  const [viajeSelId, setViajeSelId] = useState<number | null>(null)
  const [result, setResult] = useState<ManifiestoViaje | null>(null)
  const [cargando, setCargando] = useState(false)

  const viajesActivos = viajes.filter((v: any) =>
    ['PROGRAMADO', 'EN_RUTA', 'COMPLETADO'].includes(v.estado)
  )

  const cargarManifiesto = useCallback(async (viajeId: number) => {
    setViajeSelId(viajeId)
    setCargando(true)
    setResult(null)
    try {
      const data = await manifiestoService.getPorViaje(viajeId)
      setResult(data)
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Error al cargar el manifiesto'
      toast.error(msg)
    } finally {
      setCargando(false)
    }
  }, [])

  const recargar = useCallback(() => {
    if (viajeSelId) cargarManifiesto(viajeSelId)
  }, [viajeSelId, cargarManifiesto])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Manifiestos</h1>
          <p className="text-sm text-gray-500">Documento legal obligatorio — MTC Ley 27181</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['viajes', 'historial'] as PageTab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? 'border-[#064e3b] text-[#064e3b]' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t === 'viajes' ? 'Generar manifiesto' : 'Historial'}
          </button>
        ))}
      </div>

      {/* ── Historial ── */}
      {tab === 'historial' && <HistorialTab />}

      {/* ── Viajes ── */}
      {tab === 'viajes' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Panel izquierdo */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Selecciona un viaje</h3>
              {viajesActivos.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-8">No hay viajes disponibles</p>
              ) : (
                <div className="space-y-2">
                  {viajesActivos.map((v: any) => (
                    <button key={v.id} onClick={() => cargarManifiesto(v.id)}
                      className={`w-full p-3 rounded-lg border text-left transition-all ${
                        viajeSelId === v.id
                          ? 'border-[#064e3b] bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Bus size={13} className="text-[#064e3b] shrink-0" />
                        <span className="text-xs font-semibold text-gray-900 truncate">
                          {v.ruta?.origen ?? '—'} → {v.ruta?.destino ?? '—'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock size={10} />
                        {formatFecha(v.fechaHoraSal)}
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

          {/* Panel derecho */}
          <div className="lg:col-span-2 space-y-4">
            {!viajeSelId && (
              <div className="bg-white rounded-xl border border-gray-200 p-12 flex flex-col items-center justify-center">
                <FileText size={40} className="text-gray-300 mb-3" />
                <p className="text-sm text-gray-400">Selecciona un viaje para ver su manifiesto</p>
              </div>
            )}

            {viajeSelId && cargando && (
              <div className="bg-white rounded-xl border border-gray-200 p-12 flex flex-col items-center justify-center">
                <Loader2 size={32} className="text-[#064e3b] animate-spin mb-3" />
                <p className="text-sm text-gray-400">Cargando manifiesto...</p>
              </div>
            )}

            {viajeSelId && !cargando && !result && (
              <div className="bg-white rounded-xl border border-gray-200 p-12 flex flex-col items-center justify-center">
                <AlertCircle size={32} className="text-red-300 mb-3" />
                <p className="text-sm text-gray-500">No se pudo cargar el manifiesto</p>
                <button onClick={recargar} className="mt-3 text-xs text-[#064e3b] underline">Reintentar</button>
              </div>
            )}

            {result && !cargando && (
              <ManifiestoPanel
                viajeId={viajeSelId!}
                result={result}
                onGenerado={recargar}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
