'use client'
import React, { useState, useCallback } from 'react'
import useSWR from 'swr'
import toast from 'react-hot-toast'
import {
  FileText, Bus, Clock, Users, Package,
  CheckCircle, AlertCircle, Loader2, History,
  ArrowRight, RefreshCw, ChevronDown, ChevronUp,
  Printer, Sparkles, Info, Download, MapPin,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  manifiestoService,
  type ManifiestoDetalle,
  type ManifiestoResumen,
  type ManifiestoViaje,
} from '@/services/manifiestos.service'

type PageTab = 'viajes' | 'historial'

const ESTADO_COLORS: Record<string, { bg: string; text: string }> = {
  BORRADOR: { bg: 'bg-gray-100',  text: 'text-gray-600'  },
  EMITIDO:  { bg: 'bg-blue-100',  text: 'text-blue-700'  },
  ENVIADO:  { bg: 'bg-emerald-100', text: 'text-emerald-700' },
}

const ESTADO_NEXT: Record<string, string> = {
  BORRADOR: 'EMITIDO',
  EMITIDO:  'ENVIADO',
}

const PASAJE_ESTADO_STYLE: Record<string, string> = {
  VENDIDO:   'bg-emerald-100 text-emerald-700',
  RESERVADO: 'bg-amber-100 text-amber-700',
  ANULADO:   'bg-red-100 text-red-600',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFecha(iso?: string | null) {
  if (!iso) return '—'
  try { return format(new Date(iso), "dd MMM yyyy · HH:mm", { locale: es }) } catch { return iso }
}

function formatHora(iso?: string | null) {
  if (!iso) return '—'
  try { return format(new Date(iso), 'HH:mm') } catch { return '—' }
}

function formatFechaCorta(iso?: string | null) {
  if (!iso) return '—'
  try { return format(new Date(iso), 'dd MMM · HH:mm', { locale: es }) } catch { return '—' }
}

function openBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
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
      toast.success(`Estado actualizado a ${next}`)
      mutate()
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Error al cambiar estado')
    } finally { setCambiando(null) }
  }

  if (isLoading) return (
    <div className="flex justify-center items-center py-20 text-gray-400">
      <Loader2 size={22} className="animate-spin mr-2" /> Cargando historial…
    </div>
  )

  if (historial.length === 0) return (
    <div className="text-center py-20">
      <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
        <History size={22} className="text-gray-300" />
      </div>
      <p className="text-sm font-medium text-gray-500">Sin manifiestos guardados</p>
      <p className="text-xs text-gray-400 mt-1">Los manifiestos generados aparecerán aquí</p>
    </div>
  )

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50/60">
        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <History size={14} className="text-gray-400" /> Manifiestos guardados
          <span className="text-[11px] font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{historial.length}</span>
        </h3>
        <button onClick={() => mutate()} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
          <RefreshCw size={13} />
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {['Número', 'Viaje', 'Pasajeros', 'Encomiendas', 'Fecha', 'Estado', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {historial.map(m => {
              const ec = ESTADO_COLORS[m.estado] ?? ESTADO_COLORS.BORRADOR
              return (
                <tr key={m.id} className="hover:bg-gray-50/60 transition-colors group">
                  <td className="px-4 py-3 font-mono text-xs font-bold text-[#064e3b]">{m.numero}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">#{m.viajeId}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 text-gray-700 text-xs">
                      <Users size={11} className="text-blue-500" /> {m.totalPasajeros}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 text-gray-700 text-xs">
                      <Package size={11} className="text-amber-500" /> {m.totalEncomiendas}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[11px] text-gray-400 whitespace-nowrap">
                    {formatFecha(m.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${ec.bg} ${ec.text}`}>
                      {m.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {ESTADO_NEXT[m.estado] && (
                      <button onClick={() => avanzarEstado(m)} disabled={cambiando === m.id}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors font-medium opacity-0 group-hover:opacity-100">
                        {cambiando === m.id ? <Loader2 size={10} className="animate-spin" /> : <ArrowRight size={10} />}
                        {ESTADO_NEXT[m.estado]}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Panel de manifiesto (columna derecha) ─────────────────────────────────────

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
      openBlob(await manifiestoService.descargarPdf(viajeId), `manifiesto-${viajeId}.pdf`)
      toast.success('PDF descargado')
    } catch { toast.error('Error al generar el PDF') }
    finally { setDescargando(null) }
  }

  const descargarPdfEncomiendas = async () => {
    setDescargando('pdf-enc')
    try {
      openBlob(await manifiestoService.descargarPdfEncomiendas(viajeId), `encomiendas-${viajeId}.pdf`)
      toast.success('PDF de encomiendas descargado')
    } catch { toast.error('Error al generar el PDF de encomiendas') }
    finally { setDescargando(null) }
  }

  // Agencias donde baja carga: una hoja de descarga firmable por cada parada
  const [descargandoAgencia, setDescargandoAgencia] = useState<number | null>(null)
  const agenciasDestino = React.useMemo(() => {
    const m = new Map<number, { nombre: string; cant: number }>()
    for (const e of datos.encomiendas ?? []) {
      if (e.agenciaDestinoId == null) continue
      const cur = m.get(e.agenciaDestinoId)
      if (cur) cur.cant++
      else m.set(e.agenciaDestinoId, { nombre: e.agenciaDestino ?? `Agencia #${e.agenciaDestinoId}`, cant: 1 })
    }
    return Array.from(m.entries()).sort((a, b) => a[1].nombre.localeCompare(b[1].nombre))
  }, [datos.encomiendas])

  const descargarHojaDescarga = async (agenciaId: number, nombre: string) => {
    setDescargandoAgencia(agenciaId)
    try {
      openBlob(await manifiestoService.descargarPdfDescarga(viajeId, agenciaId), `descarga-${viajeId}-${nombre}.pdf`)
      toast.success(`Hoja de descarga de ${nombre} lista`)
    } catch { toast.error('Error al generar la hoja de descarga') }
    finally { setDescargandoAgencia(null) }
  }

  const descargarTicket = async (pasajeId: number, correlativo: string) => {
    setDescargando(pasajeId)
    try {
      openBlob(await manifiestoService.descargarTicket(pasajeId), `ticket-${correlativo}.pdf`)
      toast.success('Ticket descargado')
    } catch { toast.error('Error al generar el ticket') }
    finally { setDescargando(null) }
  }

  const generarManifiesto = async () => {
    setGenerando(true)
    try {
      await manifiestoService.generar(viajeId)
      toast.success('Manifiesto generado')
      onGenerado()
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Error al generar el manifiesto')
    } finally { setGenerando(false) }
  }

  if (estaVacio) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-14 flex flex-col items-center justify-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
          <Info size={22} className="text-gray-300" />
        </div>
        <p className="text-sm font-medium text-gray-500">Sin pasajeros ni encomiendas aún</p>
        <p className="text-xs text-gray-400 mt-1">Vende pasajes o registra encomiendas para generar el manifiesto.</p>
      </div>
    )
  }

  return (
    <>
      {/* ── Encabezado del manifiesto ── */}
      <div className="bg-gradient-to-br from-[#064e3b] to-[#065f46] rounded-2xl p-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {manifiesto && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] bg-white/15 px-2.5 py-0.5 rounded-full font-mono font-semibold">
                  {manifiesto.numero}
                </span>
                <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${
                  manifiesto.estado === 'ENVIADO' ? 'bg-emerald-400/30 text-emerald-100'
                  : manifiesto.estado === 'EMITIDO' ? 'bg-sky-400/30 text-sky-100'
                  : 'bg-white/10 text-emerald-200'
                }`}>{manifiesto.estado}</span>
              </div>
            )}
            <p className="text-[11px] text-emerald-300 uppercase tracking-widest font-semibold mb-0.5">
              Manifiesto de Pasajeros y Carga
            </p>
            <h2 className="text-xl font-bold leading-tight">
              {datos.rutaOrigen}
              <span className="text-emerald-400 mx-2 font-normal">→</span>
              {datos.rutaDestino}
            </h2>
            <p className="text-sm text-emerald-200 mt-0.5">{formatFecha(datos.fechaHoraSal)}</p>
          </div>

          <div className="flex flex-col gap-2 shrink-0">
            {manifiesto ? (
              <>
                <button onClick={descargarPdf} disabled={descargando === 'pdf'}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white text-[#064e3b] text-xs rounded-xl hover:bg-emerald-50 font-semibold disabled:opacity-50 transition-colors whitespace-nowrap">
                  {descargando === 'pdf' ? <Loader2 size={12} className="animate-spin" /> : <Printer size={12} />}
                  Pasajeros PDF
                </button>
                <button onClick={descargarPdfEncomiendas} disabled={descargando === 'pdf-enc'}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white/10 text-white text-xs rounded-xl hover:bg-white/20 font-medium disabled:opacity-50 transition-colors whitespace-nowrap">
                  {descargando === 'pdf-enc' ? <Loader2 size={12} className="animate-spin" /> : <Printer size={12} />}
                  Encomiendas PDF
                </button>
              </>
            ) : (
              <button onClick={generarManifiesto} disabled={generando}
                className="flex items-center gap-2 px-4 py-2.5 bg-white text-[#064e3b] text-sm rounded-xl hover:bg-emerald-50 font-bold disabled:opacity-50 transition-colors shadow-sm whitespace-nowrap">
                {generando ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Generar manifiesto
              </button>
            )}
          </div>
        </div>

        {!manifiesto && (
          <div className="mt-3 flex items-center gap-2 bg-amber-400/15 border border-amber-400/20 rounded-xl px-3 py-2.5">
            <AlertCircle size={13} className="text-amber-300 shrink-0" />
            <p className="text-xs text-amber-200">Vista previa — el manifiesto aún no ha sido generado oficialmente</p>
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-white/10">
          <div>
            <p className="text-[11px] text-emerald-400 uppercase tracking-wide font-medium">Vehículo</p>
            <p className="text-sm font-semibold mt-0.5">{datos.vehiculoPlaca} · {datos.vehiculoTipo}</p>
          </div>
          <div>
            <p className="text-[11px] text-emerald-400 uppercase tracking-wide font-medium">Conductor</p>
            <p className="text-sm font-semibold mt-0.5">{datos.conductorNombre || '—'}</p>
          </div>
          <div>
            <p className="text-[11px] text-emerald-400 uppercase tracking-wide font-medium">Pasajeros</p>
            <p className="text-3xl font-black tabular-nums">{datos.totalPasajeros}</p>
          </div>
          <div>
            <p className="text-[11px] text-emerald-400 uppercase tracking-wide font-medium">Encomiendas</p>
            <p className="text-3xl font-black tabular-nums">{datos.totalEncomiendas}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-white/10">
          <div>
            <p className="text-[11px] text-emerald-400 uppercase tracking-wide font-medium">Recaudado pasajes</p>
            <p className="text-lg font-bold tabular-nums mt-0.5">S/ {(datos.totalRecaudado ?? 0).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-[11px] text-emerald-400 uppercase tracking-wide font-medium">Flete encomiendas</p>
            <p className="text-lg font-bold tabular-nums mt-0.5">S/ {(datos.totalMontoEncomiendas ?? 0).toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* ── Hojas de descarga por agencia (una por parada, con firma del receptor) ── */}
      {agenciasDestino.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Printer size={13} className="text-[#064e3b]" />
            <h3 className="text-sm font-semibold text-gray-800">Hojas de descarga por agencia</h3>
          </div>
          <p className="text-[11px] text-gray-400 mb-3">
            Imprime una por parada: el chofer la entrega y la agencia que recibe firma lo que le bajó.
          </p>
          <div className="flex flex-wrap gap-2">
            {agenciasDestino.map(([agId, info]) => (
              <button key={agId}
                onClick={() => descargarHojaDescarga(agId, info.nombre)}
                disabled={descargandoAgencia === agId}
                className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-700 text-xs rounded-xl hover:bg-emerald-50 hover:border-emerald-200 disabled:opacity-50 transition-colors font-medium">
                {descargandoAgencia === agId
                  ? <Loader2 size={12} className="animate-spin" />
                  : <Package size={12} className="text-amber-500" />}
                {info.nombre}
                <span className="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full text-[10px] font-bold">{info.cant}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Tabla pasajeros ── */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Users size={14} className="text-blue-500" />
            Pasajeros
            <span className="text-[11px] font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full tabular-nums">
              {datos.pasajeros.length}
            </span>
          </h3>
          {datos.pasajeros.length === 0 && (
            <span className="text-[11px] text-amber-600 flex items-center gap-1">
              <AlertCircle size={11} /> Sin pasajeros vendidos
            </span>
          )}
        </div>

        {datos.pasajeros.length === 0 ? (
          <div className="py-10 text-center">
            <Users size={22} className="mx-auto mb-2 text-gray-200" />
            <p className="text-sm text-gray-400">No hay pasajeros en este viaje</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">#</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Pasajero</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Documento</th>
                  <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Asiento</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Precio</th>
                  <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Ticket</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {datos.pasajeros.map(p => (
                  <tr key={p.pasajeId} className="hover:bg-gray-50/60 transition-colors group">
                    <td className="px-3 py-2.5 text-gray-400 font-mono">{p.item}</td>
                    <td className="px-3 py-2.5">
                      <p className="font-semibold text-gray-900">{p.apellidos}, {p.nombres}</p>
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5">{p.correlativo}</p>
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">
                      <span className="text-gray-400 mr-0.5">{p.tipoDoc}</span>
                      <span className="font-mono">{p.numDoc}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-[#064e3b] text-white font-bold text-sm tabular-nums">
                        {p.numAsiento}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-gray-900 tabular-nums">
                      S/ {p.precioFinal?.toFixed(2) ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        PASAJE_ESTADO_STYLE[p.estadoPasaje ?? 'VENDIDO'] ?? 'bg-gray-100 text-gray-600'
                      }`}>
                        {(p.estadoPasaje === 'VENDIDO' || p.estadoPasaje === 'EMITIDO') && <CheckCircle size={9} />}
                        {p.estadoPasaje ?? 'VENDIDO'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => descargarTicket(p.pasajeId, p.correlativo)}
                        disabled={descargando === p.pasajeId}
                        title="Descargar ticket PDF"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-[#064e3b] hover:bg-emerald-50 disabled:opacity-50 transition-colors opacity-0 group-hover:opacity-100">
                        {descargando === p.pasajeId
                          ? <Loader2 size={13} className="animate-spin" />
                          : <Printer size={13} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Totales */}
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-200">
                  <td colSpan={4} className="px-3 py-2 text-xs font-semibold text-gray-500 text-right">
                    Total recaudado:
                  </td>
                  <td className="px-3 py-2 text-right font-black text-gray-900 tabular-nums">
                    S/ {(datos.totalRecaudado ?? 0).toFixed(2)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── Tabla encomiendas ── */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => setMostrarEnc(v => !v)}
          className="w-full px-5 py-3.5 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between hover:bg-gray-100/60 transition-colors">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Package size={14} className="text-amber-500" />
            Encomiendas
            <span className="text-[11px] font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full tabular-nums">
              {datos.encomiendas?.length ?? 0}
            </span>
          </h3>
          {mostrarEnc
            ? <ChevronUp size={15} className="text-gray-400" />
            : <ChevronDown size={15} className="text-gray-400" />}
        </button>

        {mostrarEnc && (
          (datos.encomiendas?.length ?? 0) === 0 ? (
            <div className="py-10 text-center">
              <Package size={22} className="mx-auto mb-2 text-gray-200" />
              <p className="text-sm text-gray-400">Sin encomiendas en este viaje</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-amber-50/70 border-b border-amber-100">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">#</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Tracking</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Baja en</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Descripción</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Kg / Bultos</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Flete</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Remitente</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Destinatario</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {datos.encomiendas?.map(ei => (
                    <tr key={ei.encomiendaId} className="hover:bg-amber-50/30 transition-colors">
                      <td className="px-3 py-2.5 text-gray-400 font-mono">{ei.item}</td>
                      <td className="px-3 py-2.5 font-mono text-[#064e3b] font-bold">{ei.codigoTracking}</td>
                      <td className="px-3 py-2.5">
                        <span className="inline-block bg-emerald-50 text-emerald-700 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">
                          {ei.agenciaDestino ?? '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-700 max-w-[150px] truncate">{ei.descripcion}</td>
                      <td className="px-3 py-2.5 text-center text-gray-600 tabular-nums">
                        {ei.pesoKg != null ? `${ei.pesoKg} kg` : '—'}
                        {ei.numBultos != null ? ` / ${ei.numBultos}` : ''}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-gray-900 tabular-nums">
                        S/ {ei.precioEnvio?.toFixed(2) ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-gray-600 max-w-[110px] truncate">{ei.remitente}</td>
                      <td className="px-3 py-2.5 text-gray-600 max-w-[110px] truncate">{ei.destinatario}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600">
                          {ei.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {(datos.encomiendas?.length ?? 0) > 0 && (
                  <tfoot>
                    <tr className="bg-amber-50/50 border-t border-amber-100">
                      <td colSpan={5} className="px-3 py-2 text-xs font-semibold text-gray-500 text-right">
                        Total flete:
                      </td>
                      <td className="px-3 py-2 text-right font-black text-gray-900 tabular-nums">
                        S/ {(datos.totalMontoEncomiendas ?? 0).toFixed(2)}
                      </td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                )}
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

  // EN_RUTA primero (el manifiesto se necesita al salir), luego programados y completados recientes
  const ORDEN_ESTADO: Record<string, number> = { EN_RUTA: 0, PROGRAMADO: 1, COMPLETADO: 2 }
  const viajesActivos = viajes
    .filter((v: any) => ['PROGRAMADO', 'EN_RUTA', 'COMPLETADO'].includes(v.estado))
    .sort((a: any, b: any) => {
      const e = (ORDEN_ESTADO[a.estado] ?? 9) - (ORDEN_ESTADO[b.estado] ?? 9)
      if (e !== 0) return e
      return new Date(b.fechaHoraSal).getTime() - new Date(a.fechaHoraSal).getTime()
    })

  const cargarManifiesto = useCallback(async (viajeId: number) => {
    setViajeSelId(viajeId)
    setCargando(true)
    setResult(null)
    try {
      setResult(await manifiestoService.getPorViaje(viajeId))
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Error al cargar el manifiesto')
    } finally {
      setCargando(false)
    }
  }, [])

  const recargar = useCallback(() => {
    if (viajeSelId) cargarManifiesto(viajeSelId)
  }, [viajeSelId, cargarManifiesto])

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#064e3b] flex items-center justify-center shrink-0">
          <FileText size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Manifiestos</h1>
          <p className="text-xs text-gray-500">Documento legal obligatorio — MTC Ley 27181</p>
        </div>
      </div>

      {/* ── Tabs ── */}
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

          {/* Panel izquierdo — selector de viaje */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3.5 border-b border-gray-100 bg-gray-50/60">
                <h3 className="text-sm font-semibold text-gray-800">Seleccionar viaje</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">{viajesActivos.length} viaje{viajesActivos.length !== 1 ? 's' : ''} disponible{viajesActivos.length !== 1 ? 's' : ''}</p>
              </div>

              {viajesActivos.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-2">
                    <Bus size={18} className="text-gray-300" />
                  </div>
                  <p className="text-xs text-gray-400 font-medium">Sin viajes disponibles</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {viajesActivos.map((v: any) => {
                    const sel = viajeSelId === v.id
                    return (
                      <button key={v.id} onClick={() => cargarManifiesto(v.id)}
                        className={`w-full p-3.5 text-left transition-all ${
                          sel
                            ? 'bg-emerald-50 border-l-2 border-l-[#064e3b]'
                            : 'hover:bg-gray-50/60 border-l-2 border-l-transparent'
                        }`}>
                        {/* Ruta */}
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Bus size={12} className={sel ? 'text-[#064e3b]' : 'text-gray-400'} />
                          <span className={`text-xs font-bold truncate ${sel ? 'text-[#064e3b]' : 'text-gray-900'}`}>
                            {v.ruta?.origen ?? '—'}
                            <span className="mx-1 font-normal text-gray-300">→</span>
                            {v.ruta?.destino ?? '—'}
                          </span>
                        </div>

                        {/* Hora + placa */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1 text-[11px] text-gray-400">
                            <Clock size={10} />
                            {formatFechaCorta(v.fechaHoraSal)}
                            {v.vehiculo?.placa && (
                              <span className="ml-1 font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">
                                {v.vehiculo.placa}
                              </span>
                            )}
                          </div>
                          <Badge estado={v.estado} />
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Panel derecho — contenido del manifiesto */}
          <div className="lg:col-span-2 space-y-4">

            {/* Estado vacío: sin selección */}
            {!viajeSelId && (
              <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-14 flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
                  <FileText size={22} className="text-gray-300" />
                </div>
                <p className="text-sm font-medium text-gray-500">Selecciona un viaje</p>
                <p className="text-xs text-gray-400 mt-1">El manifiesto aparecerá aquí</p>
              </div>
            )}

            {/* Cargando */}
            {viajeSelId && cargando && (
              <div className="bg-white rounded-2xl border border-gray-200 p-14 flex flex-col items-center justify-center">
                <Loader2 size={28} className="text-[#064e3b] animate-spin mb-3" />
                <p className="text-sm text-gray-400">Cargando manifiesto…</p>
              </div>
            )}

            {/* Error */}
            {viajeSelId && !cargando && !result && (
              <div className="bg-white rounded-2xl border border-gray-200 p-14 flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mb-3">
                  <AlertCircle size={22} className="text-red-300" />
                </div>
                <p className="text-sm font-medium text-gray-500">No se pudo cargar el manifiesto</p>
                <button onClick={recargar}
                  className="mt-3 text-xs text-[#064e3b] hover:underline font-medium">
                  Reintentar
                </button>
              </div>
            )}

            {/* Contenido */}
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
