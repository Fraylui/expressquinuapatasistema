'use client'
import React, { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  DollarSign, TrendingUp, TrendingDown, Lock, Unlock, Plus,
  Printer, RefreshCw, CheckCircle2, AlertCircle, Clock,
  Ticket, Package, ArrowDownCircle, ArrowUpCircle, Loader2, History,
  Wallet, ChevronRight, Search, X, Building2, Users,
} from 'lucide-react'
import { cajaService, type TurnoActual } from '@/services/caja.service'
import type { MovimientoCaja } from '@/types'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useAuthStore } from '@/stores/authStore'
import api from '@/services/api'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

// ── Tipo badge ────────────────────────────────────────────────────────────────
function TipoBadge({ mov }: { mov: MovimientoCaja }) {
  const ref = (mov as any).referenciaTipo as string | undefined
  if (mov.tipo === 'EGRESO')
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">EGRESO</span>
  if (ref === 'PAGO_DESTINO')
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">CONTRAENTREGA</span>
  if (ref === 'PASAJE')
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">PASAJE</span>
  if (ref === 'ENCOMIENDA')
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">ENCOMIENDA</span>
  if (ref === 'ENC_EXTERNA')
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-cyan-100 text-cyan-700">EXTERNA</span>
  if (ref === 'CUOTA_SALIDA_COMBI')
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-700">CUOTA COMBI</span>
  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">INGRESO</span>
}

// ── Denomination table (helper compacto) ─────────────────────────────────────
const DENOMINACIONES = [200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1]

function TablaDenominaciones({ onChange }: { onChange: (total: number) => void }) {
  const [counts, setCounts] = useState<Record<string, string>>({})

  const total = DENOMINACIONES.reduce((sum, d) => {
    const c = parseFloat(counts[String(d)] || '0') || 0
    return sum + c * d
  }, 0)

  useEffect(() => { onChange(total) }, [total])

  const update = (d: number, val: string) =>
    setCounts(prev => ({ ...prev, [String(d)]: val }))

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden text-xs">
      <div className="grid grid-cols-3 bg-gray-50 border-b border-gray-200 px-2 py-1.5 font-semibold text-gray-500 uppercase tracking-wide">
        <span>Billete/Moneda</span>
        <span className="text-center">Cantidad</span>
        <span className="text-right">Subtotal</span>
      </div>
      {DENOMINACIONES.map(d => {
        const c = parseFloat(counts[String(d)] || '0') || 0
        const subtotal = c * d
        return (
          <div key={d} className="grid grid-cols-3 items-center px-2 py-1 border-b border-gray-100 last:border-0 hover:bg-gray-50">
            <span className="font-mono font-semibold text-gray-700">
              S/ {d >= 1 ? d.toFixed(0) : d.toFixed(2)}
            </span>
            <div className="flex justify-center">
              <input
                type="number" min="0" step="1"
                value={counts[String(d)] || ''}
                onChange={e => update(d, e.target.value)}
                className="w-14 px-1.5 py-0.5 border border-gray-300 rounded text-center text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-400"
                placeholder="0"
              />
            </div>
            <span className="text-right font-mono text-gray-600">
              {subtotal > 0 ? `S/ ${subtotal.toFixed(2)}` : <span className="text-gray-300">—</span>}
            </span>
          </div>
        )
      })}
      <div className="grid grid-cols-3 px-2 py-1.5 bg-blue-50 border-t border-blue-100 font-bold text-xs">
        <span className="text-blue-800 col-span-2">Total contado</span>
        <span className="text-right font-mono text-blue-900">S/ {total.toFixed(2)}</span>
      </div>
    </div>
  )
}

// ── Metric card ───────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, icon, color }: {
  label: string; value: string; sub?: string
  icon: React.ReactNode; color: 'green' | 'blue' | 'red' | 'amber' | 'indigo' | 'cyan' | 'teal'
}) {
  const colors = {
    green:  'bg-green-50  text-green-700  border-green-200',
    blue:   'bg-blue-50   text-blue-700   border-blue-200',
    red:    'bg-red-50    text-red-700    border-red-200',
    amber:  'bg-amber-50  text-amber-700  border-amber-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    cyan:   'bg-cyan-50   text-cyan-700   border-cyan-100',
    teal:   'bg-teal-50   text-teal-700   border-teal-100',
  }
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-1 opacity-70">{icon}<span className="text-xs font-medium uppercase tracking-wide">{label}</span></div>
      <p className="text-xl font-bold font-mono">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Duration helper ───────────────────────────────────────────────────────────
function calcDuracion(apertura: string, cierre?: string): string {
  const diff = (cierre ? new Date(cierre).getTime() : Date.now()) - new Date(apertura).getTime()
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return `${h}h ${m.toString().padStart(2, '0')}m`
}

// ── Cierre modal (CIEGO) ──────────────────────────────────────────────────────
function ModalCierre({ turno, onClose, onSuccess }: {
  turno: TurnoActual
  onClose: () => void
  onSuccess: (resultado: TurnoActual) => void
}) {
  const [montoStr, setMontoStr] = useState('')
  const [montoFisico, setMontoFisico] = useState(0)
  const [showDenomin, setShowDenomin] = useState(false)
  const [observacion, setObservacion] = useState('')
  const [cerrando, setCerrando] = useState(false)

  const setDesdeInput = (val: string) => {
    setMontoStr(val)
    const n = parseFloat(val)
    setMontoFisico(!isNaN(n) && n >= 0 ? n : 0)
  }

  const setDesdeDenomin = (total: number) => {
    setMontoFisico(total)
    setMontoStr(total > 0 ? total.toFixed(2) : '')
  }

  const puedeConfirmar = montoStr.trim() !== '' && montoFisico >= 0

  const confirmar = async () => {
    if (!puedeConfirmar) { toast.error('Ingresa el total de efectivo en caja'); return }
    setCerrando(true)
    try {
      const r = await cajaService.cerrar(montoFisico, observacion.trim() || undefined)
      toast.success('Turno cerrado correctamente')
      onSuccess(r.data as TurnoActual)
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Error al cerrar turno')
    } finally { setCerrando(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h3 className="font-bold text-gray-900">Cierre de turno</h3>
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[220px]">
              {turno.operadorNombre} · {turno.agenciaNombre}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">

          {/* Aviso ciego */}
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800">
            <AlertCircle size={13} className="shrink-0 mt-0.5" />
            <span>Ingresa el total de efectivo que tienes en caja. El cuadre se verifica internamente.</span>
          </div>

          {/* Input de monto — protagonista */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Total en caja (S/) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg select-none">
                S/
              </span>
              <input
                autoFocus
                type="number" step="0.01" min="0"
                value={montoStr}
                onChange={e => setDesdeInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && confirmar()}
                placeholder="0.00"
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-xl text-2xl font-bold font-mono text-gray-900 text-center focus:ring-0 focus:border-red-400 transition-colors"
              />
            </div>
            {montoFisico > 0 && (
              <p className="text-xs text-center text-gray-400 mt-1">
                Declararás <span className="font-semibold text-gray-600">S/ {montoFisico.toFixed(2)}</span> en efectivo
              </p>
            )}
          </div>

          {/* Toggle denominaciones */}
          <div>
            <button
              type="button"
              onClick={() => setShowDenomin(v => !v)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
            >
              <ChevronRight
                size={13}
                className={`transition-transform duration-200 ${showDenomin ? 'rotate-90' : ''}`}
              />
              {showDenomin ? 'Ocultar conteo por denominaciones' : 'Contar por denominaciones (ayuda)'}
            </button>

            {showDenomin && (
              <div className="mt-2">
                <TablaDenominaciones onChange={setDesdeDenomin} />
                {montoFisico > 0 && (
                  <p className="text-xs text-blue-700 mt-1.5 text-center">
                    Total calculado: <strong>S/ {montoFisico.toFixed(2)}</strong> — se aplicará al campo de arriba
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Observación */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Observación <span className="text-gray-400">(opcional)</span>
            </label>
            <textarea
              value={observacion}
              onChange={e => setObservacion(e.target.value)}
              rows={2}
              placeholder="Alguna nota sobre el turno..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
            />
          </div>
        </div>

        {/* Botones */}
        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={cerrando || !puedeConfirmar}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-40 font-semibold transition-colors">
            {cerrando
              ? <Loader2 size={14} className="animate-spin" />
              : <Lock size={14} />}
            {puedeConfirmar
              ? `Cerrar con S/ ${montoFisico.toFixed(2)}`
              : 'Confirmar cierre'}
          </button>
        </div>

      </div>
    </div>
  )
}

// ── Historial tab ─────────────────────────────────────────────────────────────
interface AgenciaSimple { id: number; nombre: string; ciudad: string }

const SCOPE_BADGE: Record<string, { label: string; color: string }> = {
  SUPER_ADMIN:   { label: 'Vista global',    color: 'bg-red-100 text-red-700' },
  GERENTE:       { label: 'Vista global',    color: 'bg-indigo-100 text-indigo-700' },
  ADMIN_AGENCIA: { label: 'Tu agencia',      color: 'bg-violet-100 text-violet-700' },
  OPERADOR:      { label: 'Tus turnos',      color: 'bg-gray-100 text-gray-600' },
}

function HistorialTab({ rol }: { rol: string }) {
  const esGlobal     = rol === 'SUPER_ADMIN' || rol === 'GERENTE'
  const esAdminAg    = rol === 'ADMIN_AGENCIA'
  const verFiltros   = esGlobal || esAdminAg

  const [historial,     setHistorial]     = useState<TurnoActual[]>([])
  const [cargando,      setCargando]      = useState(false)
  const [imprimiendo,   setImprimiendo]   = useState<number | null>(null)
  const [busqueda,      setBusqueda]      = useState('')
  const [filtroAgencia, setFiltroAgencia] = useState<number | ''>('')
  const [agencias,      setAgencias]      = useState<AgenciaSimple[]>([])
  const [pagina,        setPagina]        = useState(0)
  const [hayMas,        setHayMas]        = useState(false)

  // Carga lista de agencias solo para roles globales
  useEffect(() => {
    if (!esGlobal) return
    api.get<any, any>('/api/agencias').then(r => setAgencias(r.data ?? []))
  }, [esGlobal])

  const cargar = useCallback(async (page = 0, append = false) => {
    setCargando(true)
    try {
      const params: Record<string, any> = { page }
      if (esGlobal && filtroAgencia) params.agencia = filtroAgencia
      const r = await cajaService.getHistorial(params)
      const nuevos = (r.data ?? []) as TurnoActual[]
      setHistorial(prev => append ? [...prev, ...nuevos] : nuevos)
      setHayMas(nuevos.length === 30)
      setPagina(page)
    } catch { toast.error('Error cargando historial') }
    finally { setCargando(false) }
  }, [filtroAgencia, esGlobal])

  useEffect(() => { cargar(0) }, [cargar])

  const descargarPdf = async (id: number) => {
    setImprimiendo(id)
    try {
      const blob = await cajaService.getReportePDF(id)
      const url  = URL.createObjectURL(blob)
      window.open(url, '_blank')?.focus()
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch { toast.error('Error generando reporte') }
    finally { setImprimiendo(null) }
  }

  // Filtro client-side por nombre de operador o agencia
  const historialFiltrado = busqueda.trim()
    ? historial.filter(t =>
        t.operadorNombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
        t.agenciaNombre?.toLowerCase().includes(busqueda.toLowerCase())
      )
    : historial

  const badge = SCOPE_BADGE[rol] ?? SCOPE_BADGE['OPERADOR']

  // ── Columnas según rol ───────────────────────────────────────────────────────
  const colsHeader = verFiltros
    ? ['Operador', 'Agencia', 'Apertura', 'Cierre', 'Duración', 'M. Inicial', 'Ingresos', 'Egresos', 'Diferencia', '']
    : ['Apertura', 'Cierre', 'Duración', 'M. Inicial', 'Ingresos', 'Egresos', 'Diferencia', '']

  return (
    <div className="space-y-3">

      {/* Barra de controles */}
      <div className="flex items-center gap-2 flex-wrap">

        {/* Badge de alcance */}
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${badge.color}`}>
          {badge.label}
        </span>

        {verFiltros && (
          <>
            {/* Búsqueda por operador */}
            <div className="relative flex-1 min-w-[180px]">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder={esGlobal ? 'Buscar operador o agencia…' : 'Buscar operador…'}
                className="w-full pl-8 pr-7 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-400"
              />
              {busqueda && (
                <button onClick={() => setBusqueda('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Filtro por agencia — solo GERENTE/SUPER_ADMIN */}
            {esGlobal && agencias.length > 0 && (
              <select
                value={filtroAgencia}
                onChange={e => setFiltroAgencia(e.target.value ? Number(e.target.value) : '')}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 max-w-[200px]"
              >
                <option value="">Todas las agencias</option>
                {agencias.map(a => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
              </select>
            )}
          </>
        )}

        {/* Contador + refresh */}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {historialFiltrado.length > 0 && (
            <span className="text-xs text-gray-400 hidden sm:block">
              {historialFiltrado.length}{hayMas ? '+' : ''} turno{historialFiltrado.length !== 1 ? 's' : ''}
            </span>
          )}
          <button onClick={() => cargar(0)} disabled={cargando} title="Actualizar"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-40">
            <RefreshCw size={14} className={cargando ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Estados: cargando inicial / vacío / tabla */}
      {cargando && historial.length === 0 ? (
        <div className="flex justify-center items-center py-16 text-gray-400">
          <Loader2 size={22} className="animate-spin mr-2" /> Cargando historial…
        </div>
      ) : historialFiltrado.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <History size={40} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">
            {busqueda ? `Sin resultados para "${busqueda}"` : 'No hay turnos anteriores'}
          </p>
          {busqueda && (
            <button onClick={() => setBusqueda('')}
              className="mt-2 text-xs text-blue-600 hover:underline">
              Limpiar búsqueda
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {colsHeader.map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {historialFiltrado.map(t => {
                    const dif   = t.diferencia ?? 0
                    const cuadra = Math.abs(dif) < 0.01
                    return (
                      <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                        {verFiltros && (
                          <>
                            <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap text-sm">
                              {t.operadorNombre}
                            </td>
                            <td className="px-4 py-3 text-gray-500 text-xs max-w-[160px] truncate">
                              {t.agenciaNombre}
                            </td>
                          </>
                        )}
                        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                          {t.fechaApertura ? format(new Date(t.fechaApertura), 'dd/MM/yy HH:mm') : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                          {t.fechaCierre
                            ? format(new Date(t.fechaCierre), 'dd/MM/yy HH:mm')
                            : <span className="text-green-600 font-semibold text-xs">● Abierto</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                          {t.fechaApertura ? calcDuracion(t.fechaApertura, t.fechaCierre) : '—'}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">S/ {t.montoApertura?.toFixed(2)}</td>
                        <td className="px-4 py-3 text-xs">
                          <span className="font-mono text-green-700">+S/ {t.totalIngresos?.toFixed(2)}</span>
                          {(t as any).montoPagoDestino > 0 && (
                            <span className="block text-amber-600 font-normal mt-0.5">
                              ↳ S/ {Number((t as any).montoPagoDestino).toFixed(2)} contraentrega
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-red-600">-S/ {t.totalEgresos?.toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            cuadra ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {cuadra ? 'Cuadra' : (dif > 0 ? `+S/${Math.abs(dif).toFixed(2)}` : `-S/${Math.abs(dif).toFixed(2)}`)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {t.estado === 'CERRADA' && (
                            <button onClick={() => descargarPdf(t.id)} disabled={imprimiendo === t.id}
                              title="Descargar reporte PDF"
                              className="p-1.5 rounded text-gray-400 hover:text-[#064e3b] hover:bg-blue-50 inline-flex disabled:opacity-40 transition-colors">
                              {imprimiendo === t.id
                                ? <Loader2 size={14} className="animate-spin" />
                                : <Printer size={14} />}
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

          {/* Paginación */}
          {hayMas && (
            <div className="text-center pt-1">
              <button
                onClick={() => cargar(pagina + 1, true)}
                disabled={cargando}
                className="inline-flex items-center gap-2 px-5 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors">
                {cargando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Cargar más turnos
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Consolidado por agencia (GERENTE / SUPER_ADMIN) ──────────────────────────
interface ConsolidadoAgencia {
  agenciaId:       number | null
  agenciaNombre:   string
  turnosAbiertos:  number
  totalIngresos:   number
  totalEgresos?:   number
  saldoActual:     number
  montoPasajes?:   number
  cantPasajes?:    number
  montoEncomiendas?: number
  cantEncomiendas?:  number
  montoPagoDestino?: number
  cantPagoDestino?:  number
  montoExternas?:    number
  cantExternas?:     number
  montoCuotasCombi?: number
  cantCuotasCombi?:  number
}

function ConsolidadoTab() {
  const [datos,     setDatos]     = useState<ConsolidadoAgencia[]>([])
  const [cargando,  setCargando]  = useState(false)
  const [ultimaAct, setUltimaAct] = useState<Date | null>(null)

  const cargar = async () => {
    setCargando(true)
    try {
      const r = await api.get<any, any>('/api/caja/consolidado-agencias')
      setDatos(r.data ?? [])
      setUltimaAct(new Date())
    } catch { toast.error('Error cargando consolidado') }
    finally { setCargando(false) }
  }

  useEffect(() => {
    cargar()
    const id = setInterval(cargar, 60_000)
    return () => clearInterval(id)
  }, [])

  const agencias = datos.filter(d => d.agenciaNombre !== '__TOTAL__')
  const total    = datos.find(d => d.agenciaNombre === '__TOTAL__')

  const fmt = (n?: number) => `S/ ${(n ?? 0).toFixed(2)}`

  if (cargando && datos.length === 0) {
    return (
      <div className="flex justify-center items-center py-20 text-gray-400">
        <Loader2 size={22} className="animate-spin mr-2" /> Cargando consolidado…
      </div>
    )
  }

  if (agencias.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <Building2 size={40} className="mx-auto mb-3 opacity-30" />
        <p className="text-sm font-medium">No hay turnos abiertos en ninguna agencia</p>
        <p className="text-xs mt-1">El consolidado aparece cuando hay operadores con turno activo</p>
        <button onClick={cargar} className="mt-4 text-xs text-blue-600 hover:underline flex items-center gap-1 mx-auto">
          <RefreshCw size={12} /> Actualizar
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* Header con última actualización */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">
            {agencias.length} agencia{agencias.length !== 1 ? 's' : ''} con turnos abiertos ·{' '}
            <span className="font-semibold text-gray-700">{total?.turnosAbiertos ?? 0} operadores activos</span>
          </p>
          {ultimaAct && (
            <p className="text-xs text-gray-400 mt-0.5">
              Actualizado {format(ultimaAct, 'HH:mm:ss')} · se refresca cada 60s
            </p>
          )}
        </div>
        <button onClick={cargar} disabled={cargando} title="Actualizar ahora"
          className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-40 transition-colors">
          <RefreshCw size={15} className={cargando ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Cards por agencia */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {agencias.map(ag => (
          <div key={ag.agenciaId} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Header de la card */}
            <div className="bg-gradient-to-r from-[#064e3b] to-emerald-700 px-4 py-3 text-white">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-sm leading-tight">{ag.agenciaNombre}</p>
                  <div className="flex items-center gap-1 mt-1 text-emerald-100 text-xs">
                    <Users size={11} />
                    <span>{ag.turnosAbiertos} turno{ag.turnosAbiertos !== 1 ? 's' : ''} abierto{ag.turnosAbiertos !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-emerald-200">Saldo total</p>
                  <p className="text-lg font-bold font-mono">{fmt(ag.saldoActual)}</p>
                </div>
              </div>
            </div>

            {/* Detalle */}
            <div className="divide-y divide-gray-100 text-sm">
              <div className="flex justify-between px-4 py-2.5">
                <span className="flex items-center gap-1.5 text-gray-500 text-xs">
                  <TrendingUp size={12} className="text-green-500" /> Total ingresos
                </span>
                <span className="font-mono font-semibold text-green-700">{fmt(ag.totalIngresos)}</span>
              </div>

              {(ag.cantPasajes ?? 0) > 0 && (
                <div className="flex justify-between px-4 py-2 bg-blue-50/50">
                  <span className="flex items-center gap-1.5 text-blue-600 text-xs">
                    <Ticket size={11} /> Pasajes ({ag.cantPasajes})
                  </span>
                  <span className="font-mono text-xs text-blue-700">{fmt(ag.montoPasajes)}</span>
                </div>
              )}

              {(ag.cantEncomiendas ?? 0) > 0 && (
                <div className="flex justify-between px-4 py-2 bg-orange-50/50">
                  <span className="flex items-center gap-1.5 text-orange-600 text-xs">
                    <Package size={11} /> Encomiendas ({ag.cantEncomiendas})
                  </span>
                  <span className="font-mono text-xs text-orange-700">{fmt(ag.montoEncomiendas)}</span>
                </div>
              )}

              {(ag.cantPagoDestino ?? 0) > 0 && (
                <div className="flex justify-between px-4 py-2 bg-amber-50/50">
                  <span className="flex items-center gap-1.5 text-amber-600 text-xs">
                    <ArrowDownCircle size={11} /> Contraentrega ({ag.cantPagoDestino})
                  </span>
                  <span className="font-mono text-xs text-amber-700">{fmt(ag.montoPagoDestino)}</span>
                </div>
              )}

              {(ag.cantExternas ?? 0) > 0 && (
                <div className="flex justify-between px-4 py-2 bg-cyan-50/50">
                  <span className="flex items-center gap-1.5 text-cyan-600 text-xs">
                    <Package size={11} /> Enc. externas ({ag.cantExternas})
                  </span>
                  <span className="font-mono text-xs text-cyan-700">{fmt(ag.montoExternas)}</span>
                </div>
              )}

              {(ag.cantCuotasCombi ?? 0) > 0 && (
                <div className="flex justify-between px-4 py-2 bg-teal-50/50">
                  <span className="flex items-center gap-1.5 text-teal-600 text-xs">
                    <DollarSign size={11} /> Cuotas combi ({ag.cantCuotasCombi})
                  </span>
                  <span className="font-mono text-xs text-teal-700">{fmt(ag.montoCuotasCombi)}</span>
                </div>
              )}

              <div className="flex justify-between px-4 py-2.5">
                <span className="flex items-center gap-1.5 text-gray-500 text-xs">
                  <TrendingDown size={12} className="text-red-400" /> Egresos
                </span>
                <span className="font-mono text-xs text-red-600">-{fmt(ag.totalEgresos)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Fila total empresa */}
      {total && (
        <div className="bg-gray-900 text-white rounded-xl px-5 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
              <DollarSign size={18} />
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Total empresa — hoy</p>
              <p className="text-sm text-gray-300">{total.turnosAbiertos} turno{total.turnosAbiertos !== 1 ? 's' : ''} · {agencias.length} agencia{agencias.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="flex gap-8">
            <div className="text-right">
              <p className="text-xs text-gray-400">Total ingresos</p>
              <p className="text-xl font-bold font-mono text-green-400">{fmt(total.totalIngresos)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Saldo en cajas</p>
              <p className="text-xl font-bold font-mono text-white">{fmt(total.saldoActual)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Filter pills ──────────────────────────────────────────────────────────────
type TipoFiltro = 'TODOS' | 'PASAJE' | 'ENCOMIENDA' | 'PAGO_DESTINO' | 'ENC_EXTERNA' | 'CUOTA_SALIDA_COMBI' | 'EGRESO' | 'INGRESO'

const FILTROS: { key: TipoFiltro; label: string; color: string }[] = [
  { key: 'TODOS',              label: 'Todos',         color: 'bg-gray-100 text-gray-700 hover:bg-gray-200' },
  { key: 'PASAJE',             label: 'Pasajes',       color: 'bg-blue-100 text-blue-700 hover:bg-blue-200' },
  { key: 'ENCOMIENDA',         label: 'Encomiendas',   color: 'bg-orange-100 text-orange-700 hover:bg-orange-200' },
  { key: 'PAGO_DESTINO',       label: 'Contraentrega', color: 'bg-amber-100 text-amber-700 hover:bg-amber-200' },
  { key: 'ENC_EXTERNA',        label: 'Externas',      color: 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200' },
  { key: 'CUOTA_SALIDA_COMBI', label: 'Cuota combi',   color: 'bg-teal-100 text-teal-700 hover:bg-teal-200' },
  { key: 'EGRESO',             label: 'Egresos',       color: 'bg-red-100 text-red-700 hover:bg-red-200' },
  { key: 'INGRESO',            label: 'Ingresos',      color: 'bg-green-100 text-green-700 hover:bg-green-200' },
]

function filtrarMovimientos(movs: MovimientoCaja[], filtro: TipoFiltro): MovimientoCaja[] {
  if (filtro === 'TODOS') return movs
  if (filtro === 'EGRESO') return movs.filter(m => m.tipo === 'EGRESO')
  if (filtro === 'INGRESO') return movs.filter(m => m.tipo === 'INGRESO' && !(m as any).referenciaTipo)
  return movs.filter(m => (m as any).referenciaTipo === filtro)
}

// ── Main page ─────────────────────────────────────────────────────────────────
type PageTab = 'turno' | 'historial' | 'consolidado'

export default function CajaPage() {
  const { user } = useAuthStore()
  const rol = user?.rol ?? 'OPERADOR'
  const { suscribeToCaja, connected } = useWebSocket()

  const [tab, setTab] = useState<PageTab>('turno')
  const [tabInicializado, setTabInicializado] = useState(false)
  const [turno, setTurno] = useState<TurnoActual | null | undefined>(undefined)

  // GERENTE/SUPER_ADMIN no venden: aterrizan en el consolidado, no en "abrir turno"
  useEffect(() => {
    if (!tabInicializado && user) {
      if (user.rol === 'GERENTE' || user.rol === 'SUPER_ADMIN') setTab('consolidado')
      setTabInicializado(true)
    }
  }, [user, tabInicializado])

  const [movimientos, setMovimientos] = useState<MovimientoCaja[]>([])
  const [mostrarTodos, setMostrarTodos] = useState(false)
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>('TODOS')
  const [duracion, setDuracion] = useState('')

  // Modals
  const [modalApertura, setModalApertura] = useState(false)
  const [montoApertura, setMontoApertura] = useState('')
  const [modalEgreso, setModalEgreso] = useState(false)
  const [egreso, setEgreso] = useState({ concepto: '', monto: '' })
  const [modalIngreso, setModalIngreso] = useState(false)
  const [ingreso, setIngreso] = useState({ concepto: '', monto: '' })
  const [modalCierre, setModalCierre] = useState(false)
  const [cierreExito, setCierreExito] = useState<TurnoActual | null>(null)

  // Loading states
  const [abriendo, setAbriendo] = useState(false)
  const [registrandoEgreso, setRegistrandoEgreso] = useState(false)
  const [registrandoIngreso, setRegistrandoIngreso] = useState(false)
  const [cargandoMovs, setCargandoMovs] = useState(false)
  const [imprimiendoReporte, setImprimiendoReporte] = useState(false)

  // Live duration timer
  useEffect(() => {
    if (!turno?.fechaApertura) { setDuracion(''); return }
    const tick = () => {
      const diff = Date.now() - new Date(turno.fechaApertura).getTime()
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setDuracion(`${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [turno?.fechaApertura])

  // Escape key closes modals
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (modalCierre) { setModalCierre(false); return }
      if (modalEgreso) { setModalEgreso(false); setEgreso({ concepto: '', monto: '' }); return }
      if (modalIngreso) { setModalIngreso(false); setIngreso({ concepto: '', monto: '' }); return }
      if (modalApertura) { setModalApertura(false); return }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [modalCierre, modalEgreso, modalIngreso, modalApertura])

  const cargarTurno = useCallback(async () => {
    try {
      const r = await cajaService.getTurnoActual()
      setTurno(r.data ?? null)
    } catch { setTurno(null) }
  }, [])

  const cargarMovimientos = useCallback(async () => {
    if (!turno) return
    setCargandoMovs(true)
    try {
      const r = await cajaService.getMovimientos()
      setMovimientos((r.data ?? []) as MovimientoCaja[])
    } catch { }
    finally { setCargandoMovs(false) }
  }, [turno?.id])

  useEffect(() => { cargarTurno() }, [cargarTurno])
  useEffect(() => { if (turno) cargarMovimientos() }, [cargarMovimientos])

  // WebSocket: update metrics + prepend movement
  useEffect(() => {
    if (!turno?.id || !connected) return
    const sub = suscribeToCaja(turno.id, (evt: any) => {
      if (evt.totalIngresos !== undefined) {
        setTurno(prev => prev ? {
          ...prev,
          totalIngresos:    Number(evt.totalIngresos),
          totalEgresos:     Number(evt.totalEgresos),
          saldoActual:      Number(evt.montoApertura) + Number(evt.totalIngresos) - Number(evt.totalEgresos),
          cantPasajes:       evt.referenciaTipo === 'PASAJE'       ? (prev.cantPasajes + 1)       : prev.cantPasajes,
          cantEncomiendas:   evt.referenciaTipo === 'ENCOMIENDA'   ? (prev.cantEncomiendas + 1)   : prev.cantEncomiendas,
          cantPagoDestino:   evt.referenciaTipo === 'PAGO_DESTINO' ? (prev.cantPagoDestino + 1)   : prev.cantPagoDestino,
          montoPasajes:      evt.referenciaTipo === 'PASAJE'       ? (prev.montoPasajes + Number(evt.monto)) : prev.montoPasajes,
          montoEncomiendas:  evt.referenciaTipo === 'ENCOMIENDA'   ? (prev.montoEncomiendas + Number(evt.monto)) : prev.montoEncomiendas,
          montoPagoDestino:  evt.referenciaTipo === 'PAGO_DESTINO' ? (prev.montoPagoDestino + Number(evt.monto)) : prev.montoPagoDestino,
        } : prev)
      }
      const newMov: MovimientoCaja = {
        id: evt.movimientoId ?? Date.now(),
        cajaId: turno.id,
        tipo: evt.tipo,
        concepto: evt.concepto,
        monto: Number(evt.monto),
        saldoAcumulado: Number(evt.saldoAcumulado),
        createdAt: new Date().toISOString(),
        agenciaId: turno.agenciaId,
        usuarioId: turno.usuarioId,
        referenciaTipo: evt.referenciaTipo,
        referenciaId: evt.referenciaId,
      } as any
      setMovimientos(prev => [newMov, ...prev])
    })
    return () => sub?.unsubscribe()
  }, [turno?.id, connected])

  const abrirCaja = async () => {
    const monto = parseFloat(montoApertura)
    if (!montoApertura || isNaN(monto) || monto < 0) {
      toast.error('Ingrese un monto de apertura válido (0 o mayor)')
      return
    }
    setAbriendo(true)
    try {
      await cajaService.abrir(monto)
      toast.success(`Turno abierto con S/ ${monto.toFixed(2)}`)
      setModalApertura(false)
      setMontoApertura('')
      await cargarTurno()
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Error al abrir turno')
    } finally { setAbriendo(false) }
  }

  const registrarEgreso = async () => {
    if (!egreso.concepto.trim()) { toast.error('El concepto es obligatorio'); return }
    const monto = parseFloat(egreso.monto)
    if (!egreso.monto || isNaN(monto) || monto <= 0) { toast.error('El monto debe ser mayor que cero'); return }
    setRegistrandoEgreso(true)
    try {
      await cajaService.egreso(egreso.concepto, monto)
      toast.success('Egreso registrado')
      setModalEgreso(false)
      setEgreso({ concepto: '', monto: '' })
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Error')
    } finally { setRegistrandoEgreso(false) }
  }

  const registrarIngreso = async () => {
    if (!ingreso.concepto.trim()) { toast.error('El concepto es obligatorio'); return }
    const monto = parseFloat(ingreso.monto)
    if (!ingreso.monto || isNaN(monto) || monto <= 0) { toast.error('El monto debe ser mayor que cero'); return }
    setRegistrandoIngreso(true)
    try {
      await cajaService.ingreso(ingreso.concepto, monto)
      toast.success('Ingreso registrado')
      setModalIngreso(false)
      setIngreso({ concepto: '', monto: '' })
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Error')
    } finally { setRegistrandoIngreso(false) }
  }

  const handleCierreExito = async (resultado: TurnoActual) => {
    setModalCierre(false)
    setCierreExito(resultado)
    setTurno(null)
    setMovimientos([])
  }

  const descargarReporte = async (cajaId: number) => {
    setImprimiendoReporte(true)
    try {
      const blob = await cajaService.getReportePDF(cajaId)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')?.focus()
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch { toast.error('Error generando reporte') }
    finally { setImprimiendoReporte(false) }
  }

  const movsFiltrados = filtrarMovimientos(movimientos, tipoFiltro)
  const movsVisible = mostrarTodos ? movsFiltrados : movsFiltrados.slice(0, 20)

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (turno === undefined) {
    return (
      <div className="flex justify-center items-center h-64 text-gray-400">
        <Loader2 size={28} className="animate-spin mr-2" /> Cargando...
      </div>
    )
  }

  // ── Cierre exitoso ───────────────────────────────────────────────────────────
  if (cierreExito) {
    const saldo = (cierreExito.montoApertura ?? 0) + (cierreExito.totalIngresos ?? 0) - (cierreExito.totalEgresos ?? 0)
    const dif = cierreExito.diferencia ?? 0
    const cuadra = Math.abs(dif) < 0.01
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center space-y-5">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 size={36} className="text-green-500" />
            </div>
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">¡Turno cerrado!</h3>
            <p className="text-sm text-gray-500 mt-1">{cierreExito.operadorNombre} — {cierreExito.agenciaNombre}</p>
          </div>
          <div className="bg-gray-50 rounded-lg border border-gray-200 divide-y divide-gray-100 text-sm mx-auto max-w-xs">
            {[
              ['Monto inicial',   `S/ ${(cierreExito.montoApertura ?? 0).toFixed(2)}`],
              ['Total ingresos',  `S/ ${(cierreExito.totalIngresos ?? 0).toFixed(2)}`],
              ['Total egresos',   `S/ ${(cierreExito.totalEgresos ?? 0).toFixed(2)}`],
              ['Total esperado',  `S/ ${saldo.toFixed(2)}`],
              ['Dinero contado',  `S/ ${(cierreExito.montoCierre ?? 0).toFixed(2)}`],
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between px-4 py-2">
                <span className="text-gray-500">{l}</span>
                <span className="font-mono font-medium">{v}</span>
              </div>
            ))}
            <div className="flex justify-between px-4 py-2">
              <span className="text-gray-500">Diferencia</span>
              <span className={`font-mono font-bold ${cuadra ? 'text-green-600' : 'text-red-600'}`}>
                {cuadra ? 'S/ 0.00 ✓' : (dif > 0 ? '+' : '') + `S/ ${dif.toFixed(2)}`}
              </span>
            </div>
          </div>
          <div className="flex gap-3 justify-center">
            <button onClick={() => descargarReporte(cierreExito.id)} disabled={imprimiendoReporte}
              className="flex items-center gap-2 px-5 py-2 bg-[#064e3b] text-white text-sm rounded-lg hover:bg-[#16294d] disabled:opacity-50">
              {imprimiendoReporte ? <Loader2 size={14} className="animate-spin" /> : <Printer size={15} />}
              Descargar reporte PDF
            </button>
            <button onClick={() => { setCierreExito(null); setTab('historial') }}
              className="flex items-center gap-2 px-5 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
              <History size={15} /> Ver historial
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#064e3b] flex items-center justify-center">
            <DollarSign size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Caja</h1>
            <p className="text-xs text-gray-500">Control de efectivo por turno</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['turno', 'historial', ...(rol === 'SUPER_ADMIN' || rol === 'GERENTE' ? ['consolidado'] : [])] as PageTab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? 'border-[#064e3b] text-[#064e3b]' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t === 'turno' ? 'Turno actual' : t === 'historial' ? 'Historial de turnos' : 'Consolidado'}
          </button>
        ))}
      </div>

      {/* ── Historial tab ── */}
      {tab === 'historial' && <HistorialTab rol={rol ?? ''} />}

      {/* ── Consolidado tab ── */}
      {tab === 'consolidado' && <ConsolidadoTab />}

      {/* ── Turno tab ── */}
      {tab === 'turno' && (
        <>
          {/* No turno */}
          {!turno && (
            <>
              <div className="flex flex-col items-center justify-center py-20 space-y-5">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
                  <Lock size={32} className="text-gray-400" />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-bold text-gray-800">Caja no abierta</h3>
                  <p className="text-sm text-gray-500 mt-1">Abra su turno para comenzar a operar</p>
                </div>
                <button onClick={() => setModalApertura(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-[#064e3b] text-white rounded-xl font-semibold hover:bg-[#16294d] transition-colors text-base">
                  <Unlock size={18} /> Abrir turno
                </button>
              </div>

              {/* Apertura modal */}
              {modalApertura && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
                    <div className="px-6 py-5 border-b border-gray-200">
                      <h3 className="font-bold text-gray-900">Abrir turno</h3>
                      <p className="text-xs text-gray-500 mt-1">Ingresa el monto inicial en efectivo que tienes disponible</p>
                    </div>
                    <div className="p-6 space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Monto inicial (S/)</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-sm">S/</span>
                          <input
                            autoFocus
                            type="number" step="0.01" min="0"
                            value={montoApertura}
                            onChange={e => setMontoApertura(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && abrirCaja()}
                            placeholder="0.00"
                            className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Puede ser S/ 0.00 si no hay fondo inicial</p>
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => setModalApertura(false)}
                          className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
                          Cancelar
                        </button>
                        <button onClick={abrirCaja} disabled={abriendo}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold">
                          {abriendo ? <Loader2 size={14} className="animate-spin" /> : <Unlock size={14} />}
                          Abrir turno
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Active turno */}
          {turno && (
            <>
              {/* Banner */}
              <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl p-5 text-white">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-white/20 text-white text-xs font-bold rounded-full animate-pulse">
                        ● TURNO ABIERTO
                      </span>
                    </div>
                    <p className="text-xl font-bold">{turno.operadorNombre}</p>
                    <p className="text-green-100 text-sm">{turno.agenciaNombre}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-green-100 mt-1">
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        Apertura: {turno.fechaApertura ? format(new Date(turno.fechaApertura), 'hh:mm a', { locale: es }) : '—'}
                      </span>
                      <span>Fondo inicial: <strong>S/ {turno.montoApertura?.toFixed(2)}</strong></span>
                      {duracion && (
                        <span className="flex items-center gap-1 bg-white/15 px-2 py-0.5 rounded-full font-mono">
                          <Clock size={11} /> {duracion}
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setModalCierre(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg font-semibold transition-colors shrink-0">
                    <Lock size={15} /> Cerrar turno
                  </button>
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
                <MetricCard
                  label="Total ingresos"
                  value={`S/ ${turno.totalIngresos?.toFixed(2)}`}
                  sub={`${turno.cantPasajes + turno.cantEncomiendas + (turno.cantPagoDestino ?? 0) + (turno.cantExternas ?? 0) + (turno.cantCuotasCombi ?? 0)} cobros registrados`}
                  icon={<TrendingUp size={16} />}
                  color="green"
                />
                <MetricCard
                  label="Pasajes"
                  value={`S/ ${turno.montoPasajes?.toFixed(2)}`}
                  sub={`${turno.cantPasajes} boleta${turno.cantPasajes !== 1 ? 's' : ''}`}
                  icon={<Ticket size={16} />}
                  color="blue"
                />
                <MetricCard
                  label="Encomiendas"
                  value={`S/ ${((turno.montoEncomiendas ?? 0) + (turno.montoPagoDestino ?? 0)).toFixed(2)}`}
                  sub={
                    (turno.cantPagoDestino ?? 0) > 0
                      ? `${turno.cantEncomiendas} cobradas · ${turno.cantPagoDestino} contraentrega`
                      : `${turno.cantEncomiendas} cobrada${turno.cantEncomiendas !== 1 ? 's' : ''}`
                  }
                  icon={<Package size={16} />}
                  color="amber"
                />
                <MetricCard
                  label="Externas"
                  value={`S/ ${(turno.montoExternas ?? 0).toFixed(2)}`}
                  sub={`${turno.cantExternas ?? 0} de conductores`}
                  icon={<Package size={16} />}
                  color="cyan"
                />
                <MetricCard
                  label="Cuotas combi"
                  value={`S/ ${(turno.montoCuotasCombi ?? 0).toFixed(2)}`}
                  sub={`${turno.cantCuotasCombi ?? 0} salida${(turno.cantCuotasCombi ?? 0) !== 1 ? 's' : ''}`}
                  icon={<DollarSign size={16} />}
                  color="teal"
                />
                <MetricCard
                  label="Saldo en caja"
                  value={`S/ ${(turno.saldoActual ?? 0).toFixed(2)}`}
                  sub={`Egresos: -S/ ${turno.totalEgresos?.toFixed(2)}`}
                  icon={<Wallet size={16} />}
                  color="indigo"
                />
              </div>

              {/* Movements */}
              <div className="bg-white rounded-xl border border-gray-200">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                  <div>
                    <h3 className="font-semibold text-gray-800">Movimientos del turno</h3>
                    <p className="text-xs text-gray-500">{movimientos.length} movimiento{movimientos.length !== 1 ? 's' : ''} en total</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={cargarMovimientos} title="Actualizar"
                      className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                      <RefreshCw size={15} />
                    </button>
                    <button onClick={() => setModalIngreso(true)}
                      className="flex items-center gap-1.5 px-3 py-2 border border-green-300 text-green-600 text-xs rounded-lg hover:bg-green-50 font-medium">
                      <ArrowUpCircle size={14} /> Registrar ingreso
                    </button>
                    <button onClick={() => setModalEgreso(true)}
                      className="flex items-center gap-1.5 px-3 py-2 border border-red-300 text-red-600 text-xs rounded-lg hover:bg-red-50 font-medium">
                      <ArrowDownCircle size={14} /> Registrar egreso
                    </button>
                  </div>
                </div>

                {/* Filter pills */}
                <div className="flex flex-wrap gap-2 px-5 py-3 border-b border-gray-100">
                  {FILTROS.map(f => (
                    <button
                      key={f.key}
                      onClick={() => { setTipoFiltro(f.key); setMostrarTodos(false) }}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        tipoFiltro === f.key
                          ? f.color + ' ring-2 ring-offset-1 ring-current'
                          : f.color
                      }`}>
                      {f.label}
                      {f.key !== 'TODOS' && (
                        <span className="ml-1 opacity-70">
                          ({filtrarMovimientos(movimientos, f.key).length})
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {cargandoMovs ? (
                  <div className="flex justify-center items-center py-12 text-gray-400">
                    <Loader2 size={20} className="animate-spin mr-2" /> Cargando...
                  </div>
                ) : movsFiltrados.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <DollarSign size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">
                      {tipoFiltro === 'TODOS' ? 'Sin movimientos en este turno' : `No hay movimientos de tipo "${tipoFiltro}"`}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Hora</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Tipo</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Concepto</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Ref.</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Monto</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Saldo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {movsVisible.map(mov => {
                          const esEgreso = mov.tipo === 'EGRESO'
                          return (
                            <tr key={mov.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 text-gray-500 text-xs font-mono whitespace-nowrap">
                                {mov.createdAt ? format(new Date(mov.createdAt), 'HH:mm') : '—'}
                              </td>
                              <td className="px-4 py-3"><TipoBadge mov={mov} /></td>
                              <td className="px-4 py-3 text-gray-700 max-w-[220px] truncate">{mov.concepto}</td>
                              <td className="px-4 py-3 text-gray-400 text-xs font-mono">
                                {(mov as any).referenciaId ? `#${(mov as any).referenciaId}` : ''}
                              </td>
                              <td className={`px-4 py-3 text-right font-mono font-semibold ${esEgreso ? 'text-red-600' : 'text-green-700'}`}>
                                {esEgreso ? '-' : '+'}S/ {Number(mov.monto).toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-gray-500 text-xs">
                                S/ {Number(mov.saldoAcumulado ?? 0).toFixed(2)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    {movsFiltrados.length > 20 && (
                      <div className="text-center py-3 border-t border-gray-100">
                        <button onClick={() => setMostrarTodos(v => !v)}
                          className="text-xs text-[#064e3b] hover:underline font-medium">
                          {mostrarTodos ? 'Mostrar menos' : `Ver todos (${movsFiltrados.length} movimientos)`}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* ── Modal Egreso ── */}
      {modalEgreso && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="font-bold text-gray-900">Registrar egreso</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Concepto o motivo *</label>
                <input
                  autoFocus
                  value={egreso.concepto}
                  onChange={e => setEgreso(v => ({ ...v, concepto: e.target.value }))}
                  placeholder="Ej: Compra papel térmico"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Monto (S/) *</label>
                <input
                  value={egreso.monto}
                  onChange={e => setEgreso(v => ({ ...v, monto: e.target.value }))}
                  type="number" step="0.01" min="0.01"
                  onKeyDown={e => e.key === 'Enter' && registrarEgreso()}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setModalEgreso(false); setEgreso({ concepto: '', monto: '' }) }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
                  Cancelar
                </button>
                <button onClick={registrarEgreso} disabled={registrandoEgreso}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 font-semibold">
                  {registrandoEgreso ? <Loader2 size={14} className="animate-spin" /> : <ArrowDownCircle size={14} />}
                  Registrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Ingreso ── */}
      {modalIngreso && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="font-bold text-gray-900">Registrar ingreso</h3>
              <p className="text-xs text-gray-500 mt-0.5">Efectivo recibido que no corresponde a pasaje ni encomienda</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Concepto o motivo *</label>
                <input
                  autoFocus
                  value={ingreso.concepto}
                  onChange={e => setIngreso(v => ({ ...v, concepto: e.target.value }))}
                  placeholder="Ej: Devolución de adelanto"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Monto (S/) *</label>
                <input
                  value={ingreso.monto}
                  onChange={e => setIngreso(v => ({ ...v, monto: e.target.value }))}
                  type="number" step="0.01" min="0.01"
                  onKeyDown={e => e.key === 'Enter' && registrarIngreso()}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setModalIngreso(false); setIngreso({ concepto: '', monto: '' }) }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
                  Cancelar
                </button>
                <button onClick={registrarIngreso} disabled={registrandoIngreso}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold">
                  {registrandoIngreso ? <Loader2 size={14} className="animate-spin" /> : <ArrowUpCircle size={14} />}
                  Registrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Cierre ── */}
      {modalCierre && turno && (
        <ModalCierre
          turno={turno}
          onClose={() => setModalCierre(false)}
          onSuccess={handleCierreExito}
        />
      )}
    </div>
  )
}
