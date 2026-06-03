'use client'
import React, { useState, useMemo } from 'react'
import useSWR from 'swr'
import toast from 'react-hot-toast'
import {
  Bus, Clock, MapPin, Users, CheckCircle, FileText, Plus,
  X, Package, UserCheck, AlertTriangle, ChevronDown, ChevronUp,
  Pencil, Search, Ticket,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useAuthStore } from '@/stores/authStore'
import { format, isToday, isThisWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import api from '@/services/api'
import Link from 'next/link'

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface ViajeDTO {
  id: number
  estado: string
  fechaHoraSal: string
  fechaHoraArr?: string
  observaciones?: string
  conductorNombre?: string
  asientosLibres?: number
  asientosOcupados?: number
  cantEncomiendas?: number
  ruta?: { origen: string; destino: string; distanciaKm?: number }
  vehiculo?: { id?: number; placa: string; tipo: string; numAsientos: number }
}
interface RutaOpt  { id: number; origen: string; destino: string }
interface VehOpt   { id: number; placa: string; tipo: string }
interface CondOpt  { id: number; nombres: string; apellidos: string; licencia: string }

const emptyForm     = { rutaId: '', vehiculoId: '', conductorId: '', fechaHoraSal: '', observaciones: '' }
const emptyEditForm = { conductorId: '', vehiculoId: '', fechaHoraSal: '', observaciones: '' }
type FiltroFecha    = 'hoy' | 'semana' | 'todos'

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatFechaLarga(iso: string) {
  try { return format(new Date(iso), "dd/MM/yy HH:mm", { locale: es }) } catch { return '—' }
}
function minDatetimeLocal() {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function ViajesPage() {
  const { data, mutate } = useSWR('/api/viajes')
  const viajes: ViajeDTO[] = data || []
  const { user, hasModulo } = useAuthStore()

  // Estado de acciones
  const [confirmando,           setConfirmando]           = useState<number | null>(null)
  const [cancelando,            setCancelando]            = useState<number | null>(null)
  const [confirmCancelId,       setConfirmCancelId]       = useState<number | null>(null)
  const [imprimiendoManifiesto, setImprimiendoManifiesto] = useState<number | null>(null)

  // Filtros y UI
  const [busqueda,          setBusqueda]          = useState('')
  const [mostrarHistorial,  setMostrarHistorial]  = useState(false)
  const [filtroFecha,       setFiltroFecha]       = useState<FiltroFecha>('todos')

  // Modal crear
  const [modalProgramar, setModalProgramar] = useState(false)
  const [form,           setForm]           = useState(emptyForm)
  const [guardando,      setGuardando]      = useState(false)

  // Modal editar
  const [modalEditar,   setModalEditar]   = useState(false)
  const [editandoViaje, setEditandoViaje] = useState<ViajeDTO | null>(null)
  const [editForm,      setEditForm]      = useState(emptyEditForm)
  const [guardandoEdit, setGuardandoEdit] = useState(false)

  // SWR lazy para selects
  const { data: rutasData } = useSWR<RutaOpt[]>(modalProgramar ? '/api/configuracion/rutas'  : null)
  const { data: vehData }   = useSWR<VehOpt[]>(
    (modalProgramar || modalEditar) ? '/api/configuracion/vehiculos' : null)
  const { data: condData }  = useSWR<CondOpt[]>(
    (modalProgramar || modalEditar) ? '/api/conductores' : null)
  const rutas       = rutasData ?? []
  const vehiculos   = vehData   ?? []
  const conductores = condData  ?? []

  const rol          = user?.rol ?? ''
  const rolesOp      = ['SUPER_ADMIN', 'GERENTE', 'ADMIN_AGENCIA', 'OPERADOR']
  const puedeOperar  = rolesOp.includes(rol)

  // ── Filtrado y agrupación ──────────────────────────────────────────────────
  const viajesFiltrados = useMemo(() => {
    if (!busqueda.trim()) return viajes
    const q = busqueda.toLowerCase()
    return viajes.filter(v =>
      v.ruta?.origen?.toLowerCase().includes(q) ||
      v.ruta?.destino?.toLowerCase().includes(q) ||
      v.conductorNombre?.toLowerCase().includes(q) ||
      v.vehiculo?.placa?.toLowerCase().includes(q)
    )
  }, [viajes, busqueda])

  const pasaFiltroFecha = (v: ViajeDTO) => {
    if (filtroFecha === 'todos') return true
    const d = new Date(v.fechaHoraSal)
    if (filtroFecha === 'hoy')    return isToday(d)
    if (filtroFecha === 'semana') return isThisWeek(d, { locale: es })
    return true
  }

  const programados = viajesFiltrados.filter(v => v.estado === 'PROGRAMADO')
  const enRuta      = viajesFiltrados.filter(v => v.estado === 'EN_RUTA')
  const completados = viajesFiltrados.filter(v => v.estado === 'COMPLETADO').filter(pasaFiltroFecha)
  const cancelados  = viajesFiltrados.filter(v => v.estado === 'CANCELADO').filter(pasaFiltroFecha)

  // ── Acciones ────────────────────────────────────────────────────────────────
  const programarViaje = async () => {
    if (!form.rutaId || !form.vehiculoId || !form.conductorId || !form.fechaHoraSal) {
      toast.error('Ruta, vehículo, conductor y fecha/hora son obligatorios')
      return
    }
    setGuardando(true)
    try {
      await api.post('/api/viajes', {
        rutaId:       parseInt(form.rutaId),
        vehiculoId:   parseInt(form.vehiculoId),
        conductorId:  parseInt(form.conductorId),
        fechaHoraSal: new Date(form.fechaHoraSal).toISOString(),
        observaciones: form.observaciones || null,
      })
      toast.success('Viaje programado correctamente')
      setModalProgramar(false)
      setForm(emptyForm)
      mutate()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al programar viaje')
    } finally { setGuardando(false) }
  }

  const abrirEditar = (v: ViajeDTO) => {
    setEditandoViaje(v)
    setEditForm({
      conductorId:  '',          // se dejará vacío para forzar selección
      vehiculoId:   String(v.vehiculo?.id ?? ''),
      fechaHoraSal: v.fechaHoraSal ? v.fechaHoraSal.slice(0, 16) : '',
      observaciones: v.observaciones ?? '',
    })
    setModalEditar(true)
  }

  const editarViaje = async () => {
    if (!editForm.conductorId || !editForm.fechaHoraSal) {
      toast.error('Conductor y fecha/hora son obligatorios')
      return
    }
    if (!editandoViaje) return
    setGuardandoEdit(true)
    try {
      await api.put(`/api/viajes/${editandoViaje.id}`, {
        conductorId:  parseInt(editForm.conductorId),
        vehiculoId:   editForm.vehiculoId ? parseInt(editForm.vehiculoId) : null,
        fechaHoraSal: new Date(editForm.fechaHoraSal).toISOString(),
        observaciones: editForm.observaciones || null,
      })
      toast.success('Viaje actualizado')
      setModalEditar(false)
      setEditandoViaje(null)
      mutate()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al editar viaje')
    } finally { setGuardandoEdit(false) }
  }

  const confirmarSalida = async (viajeId: number) => {
    setConfirmando(viajeId)
    try {
      await api.post(`/api/viajes/${viajeId}/confirmar-salida`)
      toast.success('Salida confirmada — viaje en ruta')
      mutate()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al confirmar salida')
    } finally { setConfirmando(null) }
  }

  const confirmarLlegada = async (viajeId: number) => {
    setConfirmando(viajeId)
    try {
      await api.post(`/api/viajes/${viajeId}/confirmar-llegada`)
      toast.success('Llegada confirmada — viaje completado')
      mutate()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al confirmar llegada')
    } finally { setConfirmando(null) }
  }

  const cancelarViaje = async (viajeId: number) => {
    setCancelando(viajeId)
    try {
      await api.post(`/api/viajes/${viajeId}/cancelar`)
      toast.success('Viaje cancelado')
      setConfirmCancelId(null)
      mutate()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al cancelar')
    } finally { setCancelando(null) }
  }

  const imprimirManifiesto = async (viajeId: number) => {
    setImprimiendoManifiesto(viajeId)
    try {
      const blob = await api.get(`/api/manifiestos/${viajeId}/pdf`, { responseType: 'blob' }) as unknown as Blob
      const url  = URL.createObjectURL(blob)
      window.open(url, '_blank')?.focus()
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch { toast.error('Error al generar el manifiesto') }
    finally  { setImprimiendoManifiesto(null) }
  }

  // ── Tarjeta de viaje ────────────────────────────────────────────────────────
  const ViajeCard = ({ v }: { v: ViajeDTO }) => {
    const pasajeros   = (v.vehiculo?.numAsientos ?? 1) - 1
    const vendidos    = v.asientosOcupados ?? 0
    const pct         = pasajeros > 0 ? Math.round((vendidos / pasajeros) * 100) : 0
    const esProg      = v.estado === 'PROGRAMADO'
    const esRuta      = v.estado === 'EN_RUTA'
    const esTerminado = v.estado === 'COMPLETADO' || v.estado === 'CANCELADO'
    const confirmCanc = confirmCancelId === v.id

    const border = { PROGRAMADO: 'border-blue-200', EN_RUTA: 'border-green-200',
                     COMPLETADO: 'border-gray-200',  CANCELADO: 'border-red-200' }[v.estado] ?? 'border-gray-200'
    const iconBg = esRuta ? 'bg-green-100' : esProg ? 'bg-blue-50' : 'bg-gray-100'
    const iconCl = esRuta ? 'text-green-700' : esProg ? 'text-blue-700' : 'text-gray-400'

    return (
      <div className={`bg-white rounded-xl border ${border} p-4 hover:shadow-sm transition-shadow ${esTerminado ? 'opacity-75' : ''}`}>

        {/* Cabecera */}
        <div className="flex items-start justify-between mb-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
              <Bus size={18} className={iconCl} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {v.ruta?.origen ?? '—'} → {v.ruta?.destino ?? '—'}
              </p>
              <p className="text-xs text-gray-400">
                #{v.id} · {formatFechaLarga(v.fechaHoraSal)}
                {v.ruta?.distanciaKm ? ` · ${v.ruta.distanciaKm} km` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            <Badge estado={v.estado} />
            {esProg && puedeOperar && (
              <button onClick={() => abrirEditar(v)} title="Editar viaje"
                className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                <Pencil size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Meta: vehículo + conductor */}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mb-2.5 text-xs text-gray-500">
          {v.vehiculo && (
            <span className="flex items-center gap-1">
              <Bus size={11} /> {v.vehiculo.placa} · {v.vehiculo.tipo}
            </span>
          )}
          {v.conductorNombre && v.conductorNombre !== '—' && (
            <span className="flex items-center gap-1">
              <UserCheck size={11} /> {v.conductorNombre}
            </span>
          )}
        </div>

        {/* Ocupación + encomiendas (solo activos) */}
        {!esTerminado && (
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1">
                <span className="flex items-center gap-1 text-gray-500">
                  <Users size={11} /> {vendidos}/{pasajeros} pasajeros
                </span>
                <span className={`font-semibold ${pct >= 80 ? 'text-red-600' : pct >= 50 ? 'text-amber-600' : 'text-green-600'}`}>
                  {pct}%
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                <div style={{ width: `${pct}%` }}
                  className={`h-1.5 rounded-full transition-all ${pct >= 80 ? 'bg-red-400' : pct >= 50 ? 'bg-amber-400' : 'bg-green-400'}`} />
              </div>
            </div>
            {(v.cantEncomiendas ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full shrink-0">
                <Package size={10} /> {v.cantEncomiendas}
              </span>
            )}
          </div>
        )}

        {/* Fecha de llegada real (solo completados) */}
        {v.estado === 'COMPLETADO' && v.fechaHoraArr && (
          <p className="text-xs text-gray-400 mb-2.5 flex items-center gap-1">
            <Clock size={11} /> Llegó: {formatFechaLarga(v.fechaHoraArr)}
          </p>
        )}

        {/* Botones */}
        <div className="flex gap-2 flex-wrap">

          {/* PROGRAMADO */}
          {esProg && puedeOperar && !confirmCanc && (
            <>
              <Button size="sm" variant="primary" icon={CheckCircle}
                loading={confirmando === v.id}
                onClick={() => confirmarSalida(v.id)}
                className="flex-1 justify-center">
                Confirmar salida
              </Button>
              <Link href={`/pasajes`}>
                <button title="Vender pasajes para este viaje"
                  className="p-2 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors">
                  <Ticket size={14} />
                </button>
              </Link>
              {hasModulo('MANIFIESTOS') && (
                <Button size="sm" variant="secondary" icon={FileText}
                  loading={imprimiendoManifiesto === v.id}
                  onClick={() => imprimirManifiesto(v.id)}>
                  Manif.
                </Button>
              )}
              <button onClick={() => setConfirmCancelId(v.id)} title="Cancelar viaje"
                className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                <X size={14} />
              </button>
            </>
          )}

          {/* Confirmación cancelar */}
          {esProg && puedeOperar && confirmCanc && (
            <div className="flex gap-2 w-full items-center p-2 bg-red-50 rounded-lg border border-red-200">
              <AlertTriangle size={13} className="text-red-500 shrink-0" />
              <span className="text-xs text-red-700 flex-1">¿Cancelar este viaje?</span>
              <button onClick={() => cancelarViaje(v.id)} disabled={cancelando === v.id}
                className="px-3 py-1 bg-red-600 text-white text-xs rounded font-medium hover:bg-red-700 disabled:opacity-50">
                {cancelando === v.id ? '…' : 'Sí, cancelar'}
              </button>
              <button onClick={() => setConfirmCancelId(null)}
                className="px-2 py-1 border border-gray-300 text-gray-600 text-xs rounded hover:bg-gray-50">
                No
              </button>
            </div>
          )}

          {/* EN_RUTA */}
          {esRuta && puedeOperar && (
            <>
              <Button size="sm" variant="primary" icon={CheckCircle}
                loading={confirmando === v.id}
                onClick={() => confirmarLlegada(v.id)}
                className="flex-1 justify-center bg-green-600 hover:bg-green-700">
                Confirmar llegada
              </Button>
              {hasModulo('MANIFIESTOS') && (
                <Button size="sm" variant="secondary" icon={FileText}
                  loading={imprimiendoManifiesto === v.id}
                  onClick={() => imprimirManifiesto(v.id)}>
                  Manif.
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Sección genérica ─────────────────────────────────────────────────────────
  const Seccion = ({ titulo, lista }: { titulo: string; lista: ViajeDTO[] }) => (
    lista.length === 0 ? null : (
      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
          {titulo} ({lista.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {lista.map(v => <ViajeCard key={v.id} v={v} />)}
        </div>
      </section>
    )
  )

  const hayHistorial = completados.length > 0 || cancelados.length > 0

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Cabecera */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Viajes</h1>
          <p className="text-sm text-gray-500" suppressHydrationWarning>
            {format(new Date(), "EEEE dd 'de' MMMM yyyy", { locale: es })}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-2 text-xs">
            {programados.length > 0 && (
              <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full font-medium">
                {programados.length} programados
              </span>
            )}
            {enRuta.length > 0 && (
              <span className="px-2.5 py-1 bg-green-50 text-green-700 rounded-full font-medium">
                {enRuta.length} en ruta
              </span>
            )}
          </div>
          {puedeOperar && (
            <Button icon={Plus} onClick={() => setModalProgramar(true)}>
              Programar viaje
            </Button>
          )}
        </div>
      </div>

      {/* Barra de búsqueda */}
      {viajes.length > 3 && (
        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por ruta, conductor o placa…"
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-400"
          />
          {busqueda && (
            <button onClick={() => setBusqueda('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={13} />
            </button>
          )}
        </div>
      )}

      {/* Estado vacío */}
      {viajes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Bus size={48} className="text-gray-200 mb-4" />
          <p className="text-gray-600 font-semibold">No hay viajes registrados</p>
          <p className="text-sm text-gray-400 mt-1">Programa el primer viaje para comenzar a operar</p>
          {puedeOperar && (
            <button onClick={() => setModalProgramar(true)}
              className="mt-5 px-5 py-2.5 bg-[#064e3b] text-white text-sm rounded-xl hover:bg-[#16294d] transition-colors">
              Programar primer viaje
            </button>
          )}
        </div>
      )}

      {/* Secciones activas */}
      <Seccion titulo="Programados" lista={programados} />
      <Seccion titulo="En ruta"     lista={enRuta} />

      {/* Historial colapsable */}
      {hayHistorial && (
        <section>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <button onClick={() => setMostrarHistorial(v => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-widest hover:text-gray-600 transition-colors">
              {mostrarHistorial ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              Historial ({completados.length + cancelados.length})
            </button>

            {mostrarHistorial && (
              <div className="flex gap-1">
                {(['hoy', 'semana', 'todos'] as FiltroFecha[]).map(f => (
                  <button key={f} onClick={() => setFiltroFecha(f)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      filtroFecha === f ? 'bg-[#064e3b] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}>
                    {f === 'hoy' ? 'Hoy' : f === 'semana' ? 'Esta semana' : 'Todos'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {mostrarHistorial && (
            <div className="space-y-4">
              {completados.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-2">Completados ({completados.length})</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {completados.map(v => <ViajeCard key={v.id} v={v} />)}
                  </div>
                </div>
              )}
              {cancelados.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-2">Cancelados ({cancelados.length})</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {cancelados.map(v => <ViajeCard key={v.id} v={v} />)}
                  </div>
                </div>
              )}
              {completados.length === 0 && cancelados.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">No hay viajes en este período</p>
              )}
            </div>
          )}
        </section>
      )}

      {/* ── Modal: Programar viaje ────────────────────────────────────────────── */}
      <Modal open={modalProgramar}
        onClose={() => { setModalProgramar(false); setForm(emptyForm) }}
        title="Programar nuevo viaje" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Ruta *</label>
            <select value={form.rutaId} onChange={e => setForm(f => ({ ...f, rutaId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
              <option value="">Selecciona una ruta</option>
              {rutas.map(r => <option key={r.id} value={r.id}>{r.origen} → {r.destino}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Vehículo *</label>
            <select value={form.vehiculoId} onChange={e => setForm(f => ({ ...f, vehiculoId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
              <option value="">Selecciona un vehículo</option>
              {vehiculos.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.tipo}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Conductor *</label>
            <select value={form.conductorId} onChange={e => setForm(f => ({ ...f, conductorId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
              <option value="">Selecciona un conductor</option>
              {conductores.map(c => (
                <option key={c.id} value={c.id}>{c.nombres} {c.apellidos} — Lic. {c.licencia}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Fecha y hora de salida *</label>
            <input type="datetime-local" value={form.fechaHoraSal}
              min={minDatetimeLocal()}
              onChange={e => setForm(f => ({ ...f, fechaHoraSal: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            <p className="text-xs text-gray-400 mt-1">No se permiten fechas en el pasado</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Observaciones</label>
            <textarea value={form.observaciones}
              onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
              rows={2} placeholder="Opcional…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="secondary" onClick={() => { setModalProgramar(false); setForm(emptyForm) }}>Cancelar</Button>
            <Button variant="primary" loading={guardando} onClick={programarViaje}>Programar viaje</Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Editar viaje ───────────────────────────────────────────────── */}
      <Modal open={modalEditar}
        onClose={() => { setModalEditar(false); setEditandoViaje(null) }}
        title={`Editar viaje #${editandoViaje?.id ?? ''}`} size="md">
        {editandoViaje && (
          <div className="space-y-4">
            {/* Info de ruta (no editable) */}
            <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700 border border-gray-200">
              <span className="font-medium">{editandoViaje.ruta?.origen} → {editandoViaje.ruta?.destino}</span>
              {editandoViaje.vehiculo && (
                <span className="text-gray-400 ml-2">· {editandoViaje.vehiculo.placa}</span>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Conductor *</label>
              <select value={editForm.conductorId}
                onChange={e => setEditForm(f => ({ ...f, conductorId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                <option value="">Selecciona conductor</option>
                {conductores.map(c => (
                  <option key={c.id} value={c.id}>{c.nombres} {c.apellidos} — Lic. {c.licencia}</option>
                ))}
              </select>
            </div>

            {/* Cambio de vehículo solo si no hay ventas */}
            {(editandoViaje.asientosOcupados ?? 0) === 0 ? (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Vehículo</label>
                <select value={editForm.vehiculoId}
                  onChange={e => setEditForm(f => ({ ...f, vehiculoId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                  <option value="">Sin cambio (mantener actual)</option>
                  {vehiculos.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.tipo}</option>)}
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                <AlertTriangle size={13} className="shrink-0" />
                No se puede cambiar el vehículo porque hay {editandoViaje.asientosOcupados} pasaje(s) vendido(s).
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Fecha y hora de salida *</label>
              <input type="datetime-local" value={editForm.fechaHoraSal}
                onChange={e => setEditForm(f => ({ ...f, fechaHoraSal: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Observaciones</label>
              <textarea value={editForm.observaciones}
                onChange={e => setEditForm(f => ({ ...f, observaciones: e.target.value }))}
                rows={2} placeholder="Opcional…"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <Button variant="secondary" onClick={() => { setModalEditar(false); setEditandoViaje(null) }}>
                Cancelar
              </Button>
              <Button variant="primary" loading={guardandoEdit} onClick={editarViaje}>
                Guardar cambios
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
