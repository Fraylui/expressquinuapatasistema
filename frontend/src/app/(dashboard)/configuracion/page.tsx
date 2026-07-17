'use client'
import React, { useState, useMemo, useRef } from 'react'
import useSWR, { mutate } from 'swr'
import toast from 'react-hot-toast'
import {
  Plus, Pencil, ToggleLeft, ToggleRight, MapPin, Tag,
  Check, X, Truck, UserCircle, Search, AlertTriangle, Mail,
  Building2, Upload, Trash2, ImageIcon, Calendar,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import api from '@/services/api'
import { useEmpresaStore } from '@/stores/empresaStore'
import { useEffect } from 'react'

type Tab = 'empresa' | 'rutas' | 'tarifas' | 'temporadas' | 'vehiculos' | 'conductores'

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Ruta {
  id: number
  codigo: string
  origen: string
  destino: string
  distanciaKm: number | null
  duracionMin: number | null
  duracionTexto: string | null
  activo: boolean
}

interface Tarifa {
  id: number
  rutaId: number
  rutaOrigen: string
  rutaDestino: string
  tipoVehiculo: string
  precio: number
  vigente: boolean
  temporadaId: number | null
}

interface Vehiculo {
  id: number
  placa: string
  tipo: string
  marca: string | null
  modelo: string | null
  anio: number | null
  capacidad: number
  color: string | null
  numAsientos: number
  estado: string
  conductorHabitualId: number | null
  conductorHabitualNombre: string | null
}

interface Conductor {
  id: number
  nombres: string
  apellidos: string
  dni: string
  licencia: string
  categoriaLic: string | null
  telefono: string | null
  email: string | null
  fechaVencLic: string | null
  activo: boolean
}

interface Temporada {
  id: number
  nombre: string
  fechaIni: string
  fechaFin: string
  activo: boolean
  duracionDias: number | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent w-52"
      />
    </div>
  )
}

function inputCls(extra = '') {
  return `w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${extra}`
}

// ─── RutaForm ─────────────────────────────────────────────────────────────────

interface RutaFormState {
  codigo: string; origen: string; destino: string
  distanciaKm: string; duracionMin: string
}
const emptyRuta: RutaFormState = { codigo: '', origen: '', destino: '', distanciaKm: '', duracionMin: '' }

function RutasTab() {
  const { data: rutasData, isLoading } = useSWR<Ruta[]>('/api/configuracion/rutas')
  const rutas = rutasData ?? []

  const [open, setOpen]         = useState(false)
  const [editando, setEditando] = useState<Ruta | null>(null)
  const [form, setForm]         = useState<RutaFormState>(emptyRuta)
  const [saving, setSaving]     = useState(false)
  const [q, setQ]               = useState('')

  const filtered = useMemo(() => {
    const low = q.toLowerCase()
    return rutas.filter(r =>
      r.codigo.toLowerCase().includes(low) ||
      r.origen.toLowerCase().includes(low) ||
      r.destino.toLowerCase().includes(low)
    )
  }, [rutas, q])

  const activas = rutas.filter(r => r.activo).length

  const abrirCrear = () => { setEditando(null); setForm(emptyRuta); setOpen(true) }
  const abrirEditar = (r: Ruta) => {
    setEditando(r)
    setForm({
      codigo: r.codigo, origen: r.origen, destino: r.destino,
      distanciaKm: r.distanciaKm != null ? String(r.distanciaKm) : '',
      duracionMin:  r.duracionMin != null ? String(r.duracionMin) : '',
    })
    setOpen(true)
  }

  const guardar = async () => {
    if (!form.codigo || !form.origen || !form.destino) {
      toast.error('Código, origen y destino son obligatorios')
      return
    }
    if (form.origen.trim().toLowerCase() === form.destino.trim().toLowerCase()) {
      toast.error('Origen y destino no pueden ser iguales')
      return
    }
    setSaving(true)
    try {
      const body = {
        codigo: form.codigo,
        origen: form.origen,
        destino: form.destino,
        distanciaKm: form.distanciaKm ? parseFloat(form.distanciaKm) : null,
        duracionMin:  form.duracionMin ? parseInt(form.duracionMin)   : null,
      }
      if (editando) {
        await api.put(`/api/configuracion/rutas/${editando.id}`, body)
        toast.success('Ruta actualizada')
      } else {
        await api.post('/api/configuracion/rutas', body)
        toast.success('Ruta creada')
      }
      setOpen(false)
      mutate('/api/configuracion/rutas')
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const toggleActivo = async (r: Ruta) => {
    try {
      await api.patch(`/api/configuracion/rutas/${r.id}/activo`, { activo: !r.activo })
      mutate('/api/configuracion/rutas')
      toast.success(r.activo ? 'Ruta desactivada' : 'Ruta activada')
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Error al cambiar estado')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-500">
            <span className="font-semibold text-gray-900">{activas}</span> activas
            {rutas.length !== activas && (
              <span className="text-gray-400"> · {rutas.length - activas} inactivas</span>
            )}
          </p>
          <SearchBar value={q} onChange={setQ} placeholder="Buscar ruta..." />
        </div>
        <Button variant="primary" icon={Plus} onClick={abrirCrear}>Nueva ruta</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-gray-400">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <MapPin size={32} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">{q ? 'Sin resultados' : 'No hay rutas registradas'}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide border-b border-gray-100">
                <th className="px-4 py-3 text-left font-medium">Código</th>
                <th className="px-4 py-3 text-left font-medium">Ruta</th>
                <th className="px-4 py-3 text-right font-medium">Km</th>
                <th className="px-4 py-3 text-right font-medium">Duración</th>
                <th className="px-4 py-3 text-center font-medium">Estado</th>
                <th className="px-4 py-3 text-center font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(r => (
                <tr key={r.id} className={`hover:bg-gray-50 transition-colors ${!r.activo ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-mono font-semibold text-[#064e3b] text-xs">{r.codigo}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">{r.origen}</span>
                    <span className="text-gray-400 mx-1.5">→</span>
                    <span className="font-medium text-gray-900">{r.destino}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {r.distanciaKm != null ? `${r.distanciaKm} km` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {r.duracionTexto ?? (r.duracionMin != null ? `${Math.floor(r.duracionMin / 60)}h ${r.duracionMin % 60}m` : '—')}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      r.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {r.activo ? <Check size={10} /> : <X size={10} />}
                      {r.activo ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => abrirEditar(r)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-[#064e3b] hover:bg-emerald-50 transition-colors"
                        aria-label="Editar ruta">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => toggleActivo(r)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                        aria-label={r.activo ? 'Desactivar ruta' : 'Activar ruta'}>
                        {r.activo ? <ToggleRight size={16} className="text-green-500" /> : <ToggleLeft size={16} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editando ? 'Editar ruta' : 'Nueva ruta'} size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Código *</label>
              <input value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))}
                placeholder="HUA-KIM" className={inputCls('font-mono uppercase')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Distancia (km)</label>
              <input type="number" min="0" step="0.01" value={form.distanciaKm}
                onChange={e => setForm(f => ({ ...f, distanciaKm: e.target.value }))}
                placeholder="125.5" className={inputCls()} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Ciudad origen *</label>
            <input value={form.origen} onChange={e => setForm(f => ({ ...f, origen: e.target.value }))}
              placeholder="Huamanga" className={inputCls()} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Ciudad destino *</label>
            <input value={form.destino} onChange={e => setForm(f => ({ ...f, destino: e.target.value }))}
              placeholder="Kimbiri" className={inputCls()} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Duración estimada (min)</label>
            <input type="number" min="1" value={form.duracionMin}
              onChange={e => setForm(f => ({ ...f, duracionMin: e.target.value }))}
              placeholder="180" className={inputCls()} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="primary" loading={saving} onClick={guardar}>
              {editando ? 'Guardar cambios' : 'Crear ruta'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── TarifasTab ───────────────────────────────────────────────────────────────

interface TarifaFormState { rutaId: string; tipoVehiculo: string; precio: string; temporadaId: string }
const emptyTarifa: TarifaFormState = { rutaId: '', tipoVehiculo: '', precio: '', temporadaId: '' }
// La empresa solo opera combis y camionetas
const TIPOS_TARIFA  = ['COMBI', 'CAMIONETA']
const TIPOS_FLOTA   = ['COMBI', 'CAMIONETA']

function TarifasTab() {
  const { data: tarifasData, isLoading } = useSWR<Tarifa[]>('/api/configuracion/tarifas')
  const { data: rutasData }              = useSWR<Ruta[]>('/api/configuracion/rutas')
  // Todas las temporadas: una tarifa puede referenciar una inactiva (para el nombre en la tabla)
  const { data: temporadasData }         = useSWR<Temporada[]>('/api/configuracion/temporadas')

  const tarifas    = tarifasData ?? []
  const rutas      = (rutasData ?? []).filter(r => r.activo)
  const temporadas = (temporadasData ?? []).filter(t => t.activo)
  const temporadaNombre = useMemo(() => {
    const m = new Map<number, string>()
    for (const t of temporadasData ?? []) m.set(t.id, t.nombre)
    return m
  }, [temporadasData])

  const [open, setOpen]         = useState(false)
  const [editando, setEditando] = useState<Tarifa | null>(null)
  const [form, setForm]         = useState<TarifaFormState>(emptyTarifa)
  const [saving, setSaving]     = useState(false)
  const [q, setQ]               = useState('')

  const filtered = useMemo(() => {
    const low = q.toLowerCase()
    return tarifas.filter(t =>
      (t.rutaOrigen ?? '').toLowerCase().includes(low) ||
      (t.rutaDestino ?? '').toLowerCase().includes(low) ||
      t.tipoVehiculo.toLowerCase().includes(low)
    )
  }, [tarifas, q])

  const vigentes = tarifas.filter(t => t.vigente).length

  const abrirCrear = () => { setEditando(null); setForm(emptyTarifa); setOpen(true) }
  const abrirEditar = (t: Tarifa) => {
    setEditando(t)
    setForm({
      rutaId: String(t.rutaId), tipoVehiculo: t.tipoVehiculo,
      precio: String(t.precio), temporadaId: t.temporadaId != null ? String(t.temporadaId) : '',
    })
    setOpen(true)
  }

  const guardar = async () => {
    if (!form.rutaId || !form.tipoVehiculo || !form.precio) {
      toast.error('Todos los campos son obligatorios')
      return
    }
    setSaving(true)
    try {
      const body = {
        rutaId: parseInt(form.rutaId),
        tipoVehiculo: form.tipoVehiculo,
        precio: parseFloat(form.precio),
        temporadaId: form.temporadaId ? parseInt(form.temporadaId) : null,
      }
      if (editando) {
        await api.put(`/api/configuracion/tarifas/${editando.id}`, body)
        toast.success('Tarifa actualizada')
      } else {
        await api.post('/api/configuracion/tarifas', body)
        toast.success('Tarifa creada')
      }
      setOpen(false)
      mutate('/api/configuracion/tarifas')
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const toggleVigente = async (t: Tarifa) => {
    try {
      await api.patch(`/api/configuracion/tarifas/${t.id}/vigente`, { vigente: !t.vigente })
      mutate('/api/configuracion/tarifas')
      toast.success(t.vigente ? 'Tarifa desactivada' : 'Tarifa activada')
    } catch {
      toast.error('Error al cambiar estado')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-500">
            <span className="font-semibold text-gray-900">{vigentes}</span> vigentes
            {tarifas.length !== vigentes && (
              <span className="text-gray-400"> · {tarifas.length - vigentes} inactivas</span>
            )}
          </p>
          <SearchBar value={q} onChange={setQ} placeholder="Buscar tarifa..." />
        </div>
        <Button variant="primary" icon={Plus} onClick={abrirCrear}>Nueva tarifa</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-gray-400">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <Tag size={32} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">{q ? 'Sin resultados' : 'No hay tarifas registradas'}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide border-b border-gray-100">
                <th className="px-4 py-3 text-left font-medium">Ruta</th>
                <th className="px-4 py-3 text-left font-medium">Vehículo</th>
                <th className="px-4 py-3 text-left font-medium">Temporada</th>
                <th className="px-4 py-3 text-right font-medium">Precio</th>
                <th className="px-4 py-3 text-center font-medium">Estado</th>
                <th className="px-4 py-3 text-center font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(t => (
                <tr key={t.id} className={`hover:bg-gray-50 transition-colors ${!t.vigente ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">{t.rutaOrigen ?? '—'}</span>
                    <span className="text-gray-400 mx-1.5">→</span>
                    <span className="font-medium text-gray-900">{t.rutaDestino ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block bg-blue-50 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                      {t.tipoVehiculo}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {t.temporadaId != null ? (
                      <span className="inline-block bg-amber-50 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full">
                        {temporadaNombre.get(t.temporadaId) ?? `Temporada #${t.temporadaId}`}
                      </span>
                    ) : (
                      <span className="inline-block bg-gray-100 text-gray-500 text-xs font-medium px-2 py-0.5 rounded-full">
                        Base
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">
                    S/ {Number(t.precio).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      t.vigente ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {t.vigente ? <Check size={10} /> : <X size={10} />}
                      {t.vigente ? 'Vigente' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => abrirEditar(t)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-[#064e3b] hover:bg-emerald-50 transition-colors"
                        aria-label="Editar tarifa">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => toggleVigente(t)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                        aria-label={t.vigente ? 'Desactivar tarifa' : 'Activar tarifa'}>
                        {t.vigente ? <ToggleRight size={16} className="text-green-500" /> : <ToggleLeft size={16} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editando ? 'Editar tarifa' : 'Nueva tarifa'} size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Ruta *</label>
            <select value={form.rutaId} onChange={e => setForm(f => ({ ...f, rutaId: e.target.value }))}
              className={inputCls()}>
              <option value="">Selecciona una ruta</option>
              {rutas.map(r => (
                <option key={r.id} value={r.id}>{r.origen} → {r.destino}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tipo de vehículo *</label>
            <select value={form.tipoVehiculo} onChange={e => setForm(f => ({ ...f, tipoVehiculo: e.target.value }))}
              className={inputCls()}>
              <option value="">Selecciona tipo</option>
              {TIPOS_TARIFA.map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Precio (S/) *</label>
            <input type="number" min="0.10" step="0.50" value={form.precio}
              onChange={e => setForm(f => ({ ...f, precio: e.target.value }))}
              placeholder="25.00" className={inputCls()} />
          </div>
          {temporadas.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Temporada <span className="text-gray-400">(opcional)</span></label>
              <select value={form.temporadaId} onChange={e => setForm(f => ({ ...f, temporadaId: e.target.value }))}
                className={inputCls()}>
                <option value="">Sin temporada (precio base)</option>
                {temporadas.map(tp => (
                  <option key={tp.id} value={tp.id}>{tp.nombre}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="primary" loading={saving} onClick={guardar}>
              {editando ? 'Guardar cambios' : 'Crear tarifa'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── TemporadasTab ────────────────────────────────────────────────────────────

interface TemporadaFormState { nombre: string; fechaIni: string; fechaFin: string }
const emptyTemporada: TemporadaFormState = { nombre: '', fechaIni: '', fechaFin: '' }

function TemporadasTab() {
  const { data: tempData, isLoading } = useSWR<Temporada[]>('/api/configuracion/temporadas')
  const temporadas = tempData ?? []

  const [open, setOpen]         = useState(false)
  const [editando, setEditando] = useState<Temporada | null>(null)
  const [form, setForm]         = useState<TemporadaFormState>(emptyTemporada)
  const [saving, setSaving]     = useState(false)
  const [q, setQ]               = useState('')

  const filtered = useMemo(() => {
    const low = q.toLowerCase()
    return temporadas.filter(t => t.nombre.toLowerCase().includes(low))
  }, [temporadas, q])

  const activas = temporadas.filter(t => t.activo).length

  const abrirCrear = () => { setEditando(null); setForm(emptyTemporada); setOpen(true) }
  const abrirEditar = (t: Temporada) => {
    setEditando(t)
    setForm({ nombre: t.nombre, fechaIni: t.fechaIni, fechaFin: t.fechaFin })
    setOpen(true)
  }

  const guardar = async () => {
    if (!form.nombre || !form.fechaIni || !form.fechaFin) {
      toast.error('Todos los campos son obligatorios')
      return
    }
    if (form.fechaFin <= form.fechaIni) {
      toast.error('La fecha de fin debe ser posterior a la de inicio')
      return
    }
    setSaving(true)
    try {
      const body = { nombre: form.nombre, fechaIni: form.fechaIni, fechaFin: form.fechaFin }
      if (editando) {
        await api.put(`/api/configuracion/temporadas/${editando.id}`, body)
        toast.success('Temporada actualizada')
      } else {
        await api.post('/api/configuracion/temporadas', body)
        toast.success('Temporada creada')
      }
      setOpen(false)
      mutate('/api/configuracion/temporadas')
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const toggleActivo = async (t: Temporada) => {
    try {
      await api.patch(`/api/configuracion/temporadas/${t.id}/activo`, { activo: !t.activo })
      mutate('/api/configuracion/temporadas')
      toast.success(t.activo ? 'Temporada desactivada' : 'Temporada activada')
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Error al cambiar estado')
    }
  }

  const eliminar = async (t: Temporada) => {
    if (!confirm(`¿Eliminar la temporada "${t.nombre}"? Esta acción no se puede deshacer.`)) return
    try {
      await api.delete(`/api/configuracion/temporadas/${t.id}`)
      mutate('/api/configuracion/temporadas')
      toast.success('Temporada eliminada')
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Error al eliminar')
    }
  }

  const fmtFecha = (s: string) =>
    new Date(s + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-500">
            <span className="font-semibold text-gray-900">{activas}</span> activas
            {temporadas.length !== activas && (
              <span className="text-gray-400"> · {temporadas.length - activas} inactivas</span>
            )}
          </p>
          <SearchBar value={q} onChange={setQ} placeholder="Buscar temporada..." />
        </div>
        <Button variant="primary" icon={Plus} onClick={abrirCrear}>Nueva temporada</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-gray-400">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <Calendar size={32} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">{q ? 'Sin resultados' : 'No hay temporadas registradas'}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Inicio</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Fin</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Duración</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(t => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{t.nombre}</td>
                  <td className="px-4 py-3 text-gray-600">{fmtFecha(t.fechaIni)}</td>
                  <td className="px-4 py-3 text-gray-600">{fmtFecha(t.fechaFin)}</td>
                  <td className="px-4 py-3 text-center text-gray-500 text-xs">
                    {t.duracionDias != null ? `${t.duracionDias} días` : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      t.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {t.activo ? <Check size={10} /> : <X size={10} />}
                      {t.activo ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => abrirEditar(t)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-[#064e3b] hover:bg-emerald-50 transition-colors"
                        aria-label="Editar temporada">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => toggleActivo(t)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                        aria-label={t.activo ? 'Desactivar' : 'Activar'}>
                        {t.activo ? <ToggleRight size={16} className="text-green-500" /> : <ToggleLeft size={16} />}
                      </button>
                      {!t.activo && (
                        <button onClick={() => eliminar(t)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          aria-label="Eliminar temporada">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editando ? 'Editar temporada' : 'Nueva temporada'} size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nombre *</label>
            <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              placeholder="Ej: Fiestas Patrias 2026" className={inputCls()} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Fecha inicio *</label>
              <input type="date" value={form.fechaIni} onChange={e => setForm(f => ({ ...f, fechaIni: e.target.value }))}
                className={inputCls()} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Fecha fin *</label>
              <input type="date" value={form.fechaFin} min={form.fechaIni || undefined}
                onChange={e => setForm(f => ({ ...f, fechaFin: e.target.value }))}
                className={inputCls()} />
            </div>
          </div>
          {form.fechaIni && form.fechaFin && form.fechaFin > form.fechaIni && (
            <p className="text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">
              Duración: {Math.round((new Date(form.fechaFin).getTime() - new Date(form.fechaIni).getTime()) / 86400000) + 1} días
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="primary" loading={saving} onClick={guardar}>
              {editando ? 'Guardar cambios' : 'Crear temporada'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── VehiculosTab ─────────────────────────────────────────────────────────────

interface VehiculoFormState {
  placa: string; tipo: string; marca: string; modelo: string
  anio: string; capacidad: string; color: string; numAsientos: string
  conductorHabitualId: string
}
const emptyVehiculo: VehiculoFormState = {
  placa: '', tipo: '', marca: '', modelo: '', anio: '', capacidad: '', color: '', numAsientos: '',
  conductorHabitualId: '',
}
/** Asientos sugeridos por tipo (incluye al conductor, igual que el SeatMap) */
const ASIENTOS_POR_TIPO: Record<string, number> = { COMBI: 15, CAMIONETA: 5 }
const ESTADOS_VEHICULO = ['OPERATIVO', 'MANTENIMIENTO', 'BAJA']
const estadoColor: Record<string, string> = {
  OPERATIVO:    'bg-green-100 text-green-700',
  MANTENIMIENTO:'bg-amber-100 text-amber-700',
  BAJA:         'bg-red-100 text-red-700',
}

function VehiculosTab() {
  const { data: vehData, isLoading } = useSWR<Vehiculo[]>('/api/configuracion/vehiculos')
  const { data: condData } = useSWR<Conductor[]>('/api/conductor/lista')
  const vehiculos   = vehData ?? []
  const conductores = condData ?? []

  const [open, setOpen]         = useState(false)
  const [editando, setEditando] = useState<Vehiculo | null>(null)
  const [form, setForm]         = useState<VehiculoFormState>(emptyVehiculo)
  const [saving, setSaving]     = useState(false)
  const [q, setQ]               = useState('')

  const filtered = useMemo(() => {
    const low = q.toLowerCase()
    return vehiculos.filter(v =>
      v.placa.toLowerCase().includes(low) ||
      v.tipo.toLowerCase().includes(low) ||
      (v.marca ?? '').toLowerCase().includes(low) ||
      (v.modelo ?? '').toLowerCase().includes(low)
    )
  }, [vehiculos, q])

  const operativos = vehiculos.filter(v => v.estado === 'OPERATIVO').length

  const abrirCrear = () => { setEditando(null); setForm(emptyVehiculo); setOpen(true) }
  const abrirEditar = (v: Vehiculo) => {
    setEditando(v)
    setForm({
      placa: v.placa, tipo: v.tipo,
      marca: v.marca ?? '', modelo: v.modelo ?? '',
      anio: v.anio != null ? String(v.anio) : '',
      capacidad: String(v.capacidad), color: v.color ?? '',
      numAsientos: String(v.numAsientos),
      conductorHabitualId: v.conductorHabitualId != null ? String(v.conductorHabitualId) : '',
    })
    setOpen(true)
  }

  const guardar = async () => {
    if (!form.placa || !form.tipo || !form.numAsientos) {
      toast.error('Placa, tipo y n° de asientos son obligatorios')
      return
    }
    setSaving(true)
    try {
      const body = {
        placa: form.placa, tipo: form.tipo,
        marca: form.marca || null, modelo: form.modelo || null,
        anio: form.anio ? parseInt(form.anio) : null,
        // Capacidad opcional: el backend usa el n° de asientos si va vacía
        capacidad: form.capacidad ? parseInt(form.capacidad) : null,
        color: form.color || null,
        numAsientos: parseInt(form.numAsientos),
        conductorHabitualId: form.conductorHabitualId ? parseInt(form.conductorHabitualId) : null,
      }
      if (editando) {
        await api.put(`/api/configuracion/vehiculos/${editando.id}`, body)
        toast.success('Vehículo actualizado')
      } else {
        await api.post('/api/configuracion/vehiculos', body)
        toast.success('Vehículo registrado')
      }
      setOpen(false)
      mutate('/api/configuracion/vehiculos')
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const cambiarEstado = async (v: Vehiculo, estado: string) => {
    try {
      await api.patch(`/api/configuracion/vehiculos/${v.id}/estado?estado=${estado}`)
      mutate('/api/configuracion/vehiculos')
      toast.success(`Estado cambiado a ${estado}`)
    } catch {
      toast.error('Error al cambiar estado')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-500">
            <span className="font-semibold text-gray-900">{operativos}</span> operativos
            {vehiculos.length !== operativos && (
              <span className="text-gray-400"> · {vehiculos.length - operativos} fuera de servicio</span>
            )}
          </p>
          <SearchBar value={q} onChange={setQ} placeholder="Buscar vehículo..." />
        </div>
        <Button variant="primary" icon={Plus} onClick={abrirCrear}>Nuevo vehículo</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-gray-400">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <Truck size={32} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">{q ? 'Sin resultados' : 'No hay vehículos registrados'}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide border-b border-gray-100">
                <th className="px-4 py-3 text-left font-medium">Placa</th>
                <th className="px-4 py-3 text-left font-medium">Tipo</th>
                <th className="px-4 py-3 text-left font-medium">Marca / Modelo</th>
                <th className="px-4 py-3 text-left font-medium">Conductor habitual</th>
                <th className="px-4 py-3 text-center font-medium">Asientos</th>
                <th className="px-4 py-3 text-center font-medium">Estado</th>
                <th className="px-4 py-3 text-center font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(v => (
                <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-[#064e3b] text-sm">{v.placa}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block bg-blue-50 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                      {v.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {v.marca ?? '—'} {v.modelo ?? ''} {v.anio ? `(${v.anio})` : ''}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {v.conductorHabitualNombre
                      ? <span className="inline-flex items-center gap-1 text-gray-700">
                          <UserCircle size={12} className="text-gray-400" />{v.conductorHabitualNombre}
                        </span>
                      : <span className="text-gray-300">Sin asignar</span>}
                  </td>
                  <td className="px-4 py-3 text-center font-semibold text-gray-900">{v.numAsientos}</td>
                  <td className="px-4 py-3 text-center">
                    <select
                      value={v.estado}
                      onChange={e => cambiarEstado(v, e.target.value)}
                      className={`text-xs font-semibold px-2 py-1 rounded-full border-0 cursor-pointer focus:ring-2 focus:ring-emerald-500 ${estadoColor[v.estado] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {ESTADOS_VEHICULO.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => abrirEditar(v)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-[#064e3b] hover:bg-emerald-50 transition-colors"
                      aria-label="Editar vehículo">
                      <Pencil size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editando ? 'Editar vehículo' : 'Nuevo vehículo'} size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Placa *</label>
              <input value={form.placa} onChange={e => setForm(f => ({ ...f, placa: e.target.value }))}
                placeholder="ABC-123" className={inputCls('font-mono uppercase')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Tipo *</label>
              <select value={form.tipo}
                onChange={e => {
                  const tipo = e.target.value
                  setForm(f => ({
                    ...f, tipo,
                    // sugerir asientos según tipo si aún no se escribieron
                    numAsientos: f.numAsientos || (ASIENTOS_POR_TIPO[tipo] ? String(ASIENTOS_POR_TIPO[tipo]) : ''),
                  }))
                }}
                className={inputCls()}>
                <option value="">Seleccionar</option>
                {TIPOS_FLOTA.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Marca</label>
              <input value={form.marca} onChange={e => setForm(f => ({ ...f, marca: e.target.value }))}
                placeholder="Toyota" className={inputCls()} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Modelo</label>
              <input value={form.modelo} onChange={e => setForm(f => ({ ...f, modelo: e.target.value }))}
                placeholder="Hiace" className={inputCls()} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Año</label>
              <input type="number" min="2000" max="2030" value={form.anio}
                onChange={e => setForm(f => ({ ...f, anio: e.target.value }))}
                placeholder="2020" className={inputCls()} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Capacidad <span className="text-gray-400">(opcional)</span></label>
              <input type="number" min="1" value={form.capacidad}
                onChange={e => setForm(f => ({ ...f, capacidad: e.target.value }))}
                placeholder={form.numAsientos || 'auto'} className={inputCls()} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">N° asientos *</label>
              <input type="number" min="1" value={form.numAsientos}
                onChange={e => setForm(f => ({ ...f, numAsientos: e.target.value }))}
                placeholder="15" className={inputCls()} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Color</label>
              <input value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                placeholder="Blanco" className={inputCls()} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Conductor habitual <span className="text-gray-400">(opcional)</span></label>
              <select value={form.conductorHabitualId}
                onChange={e => setForm(f => ({ ...f, conductorHabitualId: e.target.value }))}
                className={inputCls()}>
                <option value="">Sin asignar</option>
                {conductores.map(c => (
                  <option key={c.id} value={c.id}>{c.nombres} {c.apellidos} — {c.licencia}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 -mt-2">
            El conductor habitual se preselecciona al programar viajes con este vehículo, pero puede cambiarse en cada viaje.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="primary" loading={saving} onClick={guardar}>
              {editando ? 'Guardar cambios' : 'Registrar vehículo'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── ConductoresTab ───────────────────────────────────────────────────────────

interface ConductorFormState {
  nombres: string; apellidos: string; dni: string; licencia: string
  categoriaLic: string; telefono: string; email: string; fechaVencLic: string
}
const emptyConductor: ConductorFormState = {
  nombres: '', apellidos: '', dni: '', licencia: '',
  categoriaLic: '', telefono: '', email: '', fechaVencLic: '',
}

function licenciaStatus(fechaVenc: string | null): 'ok' | 'pronto' | 'vencida' | null {
  if (!fechaVenc) return null
  const dias = Math.ceil((new Date(fechaVenc).getTime() - Date.now()) / 86_400_000)
  if (dias < 0)  return 'vencida'
  if (dias <= 30) return 'pronto'
  return 'ok'
}

function ConductoresTab() {
  const { data: condData, isLoading } = useSWR<Conductor[]>('/api/configuracion/conductores')
  const conductores = condData ?? []

  const [open, setOpen]         = useState(false)
  const [editando, setEditando] = useState<Conductor | null>(null)
  const [form, setForm]         = useState<ConductorFormState>(emptyConductor)
  const [saving, setSaving]     = useState(false)
  const [q, setQ]               = useState('')

  const filtered = useMemo(() => {
    const low = q.toLowerCase()
    return conductores.filter(c =>
      c.nombres.toLowerCase().includes(low) ||
      c.apellidos.toLowerCase().includes(low) ||
      c.dni.includes(low) ||
      c.licencia.toLowerCase().includes(low)
    )
  }, [conductores, q])

  const activos   = conductores.filter(c => c.activo).length
  const vencidos  = conductores.filter(c => licenciaStatus(c.fechaVencLic) === 'vencida').length
  const proximos  = conductores.filter(c => licenciaStatus(c.fechaVencLic) === 'pronto').length

  const abrirEditar = (c: Conductor) => {
    setEditando(c)
    setForm({
      nombres: c.nombres, apellidos: c.apellidos, dni: c.dni,
      licencia: c.licencia, categoriaLic: c.categoriaLic ?? '',
      telefono: c.telefono ?? '', email: c.email ?? '',
      fechaVencLic: c.fechaVencLic ?? '',
    })
    setOpen(true)
  }

  const guardar = async () => {
    if (!editando) return
    if (!form.nombres || !form.apellidos || !form.dni || !form.licencia) {
      toast.error('Nombres, apellidos, DNI y licencia son obligatorios')
      return
    }
    if (!/^\d{8}$/.test(form.dni)) {
      toast.error('DNI debe tener exactamente 8 dígitos')
      return
    }
    setSaving(true)
    try {
      const body = {
        nombres: form.nombres, apellidos: form.apellidos, dni: form.dni,
        licencia: form.licencia,
        categoriaLic: form.categoriaLic || null,
        telefono: form.telefono || null,
        email: form.email || null,
        fechaVencLic: form.fechaVencLic || null,
      }
      await api.put(`/api/configuracion/conductores/${editando.id}`, body)
      toast.success('Conductor actualizado')
      setOpen(false)
      mutate('/api/configuracion/conductores')
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const toggleActivo = async (c: Conductor) => {
    try {
      await api.patch(`/api/configuracion/conductores/${c.id}/activo`, { activo: !c.activo })
      mutate('/api/configuracion/conductores')
      toast.success(c.activo ? 'Conductor desactivado' : 'Conductor activado')
    } catch {
      toast.error('Error al cambiar estado')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-sm text-gray-500">
            <span className="font-semibold text-gray-900">{activos}</span> activos
            {conductores.length !== activos && (
              <span className="text-gray-400"> · {conductores.length - activos} inactivos</span>
            )}
          </p>
          {vencidos > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
              <AlertTriangle size={11} /> {vencidos} lic. vencida{vencidos > 1 ? 's' : ''}
            </span>
          )}
          {proximos > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              <AlertTriangle size={11} /> {proximos} vence pronto
            </span>
          )}
          <SearchBar value={q} onChange={setQ} placeholder="Buscar conductor..." />
        </div>
        <p className="text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          Los conductores se registran desde <span className="font-semibold text-gray-600">Usuarios → Nuevo usuario → rol Conductor</span>
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-gray-400">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <UserCircle size={32} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">{q ? 'Sin resultados' : 'No hay conductores registrados'}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide border-b border-gray-100">
                <th className="px-4 py-3 text-left font-medium">Conductor</th>
                <th className="px-4 py-3 text-left font-medium">DNI</th>
                <th className="px-4 py-3 text-left font-medium">Licencia</th>
                <th className="px-4 py-3 text-left font-medium">Contacto</th>
                <th className="px-4 py-3 text-left font-medium">Venc. lic.</th>
                <th className="px-4 py-3 text-center font-medium">Estado</th>
                <th className="px-4 py-3 text-center font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(c => {
                const licStatus = licenciaStatus(c.fechaVencLic)
                return (
                  <tr key={c.id} className={`hover:bg-gray-50 transition-colors ${!c.activo ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{c.nombres} {c.apellidos}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{c.dni}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className="inline-block bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-full">
                        {c.licencia}
                      </span>
                      {c.categoriaLic && (
                        <span className="ml-1 text-gray-400">({c.categoriaLic})</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      <div>{c.telefono ?? '—'}</div>
                      {c.email && (
                        <div className="flex items-center gap-1 text-gray-400 mt-0.5">
                          <Mail size={10} />{c.email}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {c.fechaVencLic ? (
                        <span className={`inline-flex items-center gap-1 ${
                          licStatus === 'vencida' ? 'text-red-600 font-semibold' :
                          licStatus === 'pronto'  ? 'text-amber-600 font-medium' :
                          'text-gray-600'
                        }`}>
                          {licStatus !== 'ok' && <AlertTriangle size={11} />}
                          {new Date(c.fechaVencLic).toLocaleDateString('es-PE')}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        c.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {c.activo ? <Check size={10} /> : <X size={10} />}
                        {c.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => abrirEditar(c)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-[#064e3b] hover:bg-emerald-50 transition-colors"
                          aria-label="Editar conductor">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => toggleActivo(c)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                          aria-label={c.activo ? 'Desactivar conductor' : 'Activar conductor'}>
                          {c.activo ? <ToggleRight size={16} className="text-green-500" /> : <ToggleLeft size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Editar conductor" size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nombres *</label>
              <input value={form.nombres} onChange={e => setForm(f => ({ ...f, nombres: e.target.value }))}
                placeholder="Carlos" className={inputCls()} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Apellidos *</label>
              <input value={form.apellidos} onChange={e => setForm(f => ({ ...f, apellidos: e.target.value }))}
                placeholder="García López" className={inputCls()} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">DNI * (8 dígitos)</label>
              <input value={form.dni}
                onChange={e => setForm(f => ({ ...f, dni: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
                placeholder="12345678" maxLength={8} className={inputCls('font-mono')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">N° Licencia *</label>
              <input value={form.licencia}
                onChange={e => setForm(f => ({ ...f, licencia: e.target.value.toUpperCase() }))}
                placeholder="Q12345678" className={inputCls('font-mono uppercase')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Categoría licencia</label>
              <select value={form.categoriaLic} onChange={e => setForm(f => ({ ...f, categoriaLic: e.target.value }))}
                className={inputCls()}>
                <option value="">Sin categoría</option>
                {['A-I','A-IIa','A-IIb','A-IIIa','A-IIIb','A-IIIc','B-I','B-IIa','B-IIb','B-IIc'].map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Teléfono</label>
              <input value={form.telefono}
                onChange={e => setForm(f => ({ ...f, telefono: e.target.value.replace(/\D/g, '').slice(0, 9) }))}
                placeholder="987654321" maxLength={9} className={inputCls('font-mono')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="conductor@ejemplo.com" className={inputCls()} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Vencimiento licencia</label>
              <input type="date" value={form.fechaVencLic}
                onChange={e => setForm(f => ({ ...f, fechaVencLic: e.target.value }))}
                className={inputCls()} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="primary" loading={saving} onClick={guardar}>
              Guardar cambios
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── EmpresaTab ───────────────────────────────────────────────────────────────

function EmpresaTab() {
  const { nombre, ruc, direccion, ciudad, telefono, logoBase64, cuotaSalidaCombi, setLogoBase64, fetchFromApi, saveToApi } = useEmpresaStore()
  const [localNombre,    setLocalNombre]    = useState(nombre)
  const [localRuc,       setLocalRuc]       = useState(ruc)
  const [localDireccion, setLocalDireccion] = useState(direccion)
  const [localCiudad,    setLocalCiudad]    = useState(ciudad)
  const [localTelefono,  setLocalTelefono]  = useState(telefono)
  const [localCuotaCombi, setLocalCuotaCombi] = useState(cuotaSalidaCombi)
  const [saving,         setSaving]         = useState(false)
  const [dragging,       setDragging]       = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { fetchFromApi() }, [])

  // Sync local state when store updates from API
  useEffect(() => {
    setLocalNombre(nombre); setLocalRuc(ruc)
    setLocalDireccion(direccion); setLocalCiudad(ciudad); setLocalTelefono(telefono)
    setLocalCuotaCombi(cuotaSalidaCombi)
  }, [nombre, ruc, direccion, ciudad, telefono, cuotaSalidaCombi])

  const handleGuardar = async () => {
    if (!localNombre.trim()) { toast.error('El nombre de la empresa es obligatorio'); return }
    setSaving(true)
    try {
      await saveToApi({
        nombre:    localNombre.trim(),
        ruc:       localRuc.trim(),
        direccion: localDireccion.trim(),
        ciudad:    localCiudad.trim(),
        telefono:  localTelefono.trim(),
        cuotaSalidaCombi: localCuotaCombi,
      })
      toast.success('Datos de empresa guardados')
    } catch { toast.error('Error al guardar. El backend debe estar activo.') }
    finally { setSaving(false) }
  }

  const procesarArchivo = (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Solo se permiten imágenes'); return }
    if (file.size > 2 * 1024 * 1024)    { toast.error('La imagen no debe superar 2 MB'); return }
    const reader = new FileReader()
    reader.onload = (e) => {
      setLogoBase64(e.target?.result as string)
      toast.success('Logo actualizado')
    }
    reader.readAsDataURL(file)
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) procesarArchivo(file)
    e.target.value = ''
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) procesarArchivo(file)
  }

  return (
    <div className="max-w-2xl space-y-6">

      {/* Logo */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        {/* Header con gradiente */}
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-gray-100 px-6 py-4">
          <h3 className="text-sm font-semibold text-gray-900">Logo de la empresa</h3>
          <p className="text-xs text-gray-500 mt-0.5">PNG o JPG, máx. 2 MB. Aparece en el login y documentos.</p>
        </div>

        <div className="p-6 space-y-5">
          {/* Preview oscuro estilo login */}
          <div className="relative rounded-xl overflow-hidden bg-[#0f172a] flex flex-col items-center justify-center py-7 gap-2 shadow-inner">
            {/* orbs decorativos */}
            <div className="pointer-events-none absolute -top-10 -left-10 h-32 w-32 rounded-full bg-emerald-700/20 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-teal-700/15 blur-2xl" />

            {logoBase64 ? (
              <img
                src={logoBase64}
                alt="Logo empresa"
                className="relative max-h-16 max-w-[180px] w-auto object-contain drop-shadow-lg"
              />
            ) : (
              <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600/90 shadow-lg shadow-emerald-900/40">
                <ImageIcon size={24} className="text-white" />
              </div>
            )}
            <p className="relative text-xs text-white/40 mt-1">Vista previa del login</p>
          </div>

          {/* Drop zone */}
          <div
            className={`relative border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all duration-200 ${
              dragging
                ? 'border-emerald-400 bg-emerald-50 scale-[1.01]'
                : 'border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/50'
            }`}
            onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100">
                <Upload size={16} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Arrastra tu logo aquí</p>
                <p className="text-xs text-gray-400 mt-0.5">o haz clic para seleccionar</p>
              </div>
            </div>
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
          </div>

          {logoBase64 && (
            <button
              onClick={() => { setLogoBase64(null); toast.success('Logo eliminado') }}
              className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-600 transition-colors cursor-pointer"
            >
              <Trash2 size={12} /> Quitar logo actual
            </button>
          )}
        </div>
      </div>

      {/* Datos */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">Datos de la empresa</h3>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Nombre de la empresa *</label>
          <input
            value={localNombre}
            onChange={e => setLocalNombre(e.target.value)}
            placeholder="Mi Empresa SAC"
            className={inputCls()}
          />
          <p className="text-xs text-gray-400 mt-1">Este nombre aparece en el login, cabeceras y documentos.</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">RUC</label>
          <input
            value={localRuc}
            onChange={e => setLocalRuc(e.target.value.replace(/\D/g, '').slice(0, 11))}
            placeholder="20123456789"
            maxLength={11}
            className={inputCls('font-mono')}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Dirección</label>
          <input
            value={localDireccion}
            onChange={e => setLocalDireccion(e.target.value)}
            placeholder="Jr. Lima 245, Mercado Andrés F. Vivanco"
            className={inputCls()}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Ciudad</label>
            <input
              value={localCiudad}
              onChange={e => setLocalCiudad(e.target.value)}
              placeholder="Huamanga, Ayacucho"
              className={inputCls()}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Teléfono</label>
            <input
              value={localTelefono}
              onChange={e => setLocalTelefono(e.target.value)}
              placeholder="066-312456"
              className={inputCls()}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Cuota fija por salida de combi (S/)</label>
          <input
            value={localCuotaCombi}
            onChange={e => setLocalCuotaCombi(e.target.value.replace(/[^\d.]/g, ''))}
            placeholder="0.00"
            inputMode="decimal"
            className={inputCls('font-mono')}
          />
          <p className="text-xs text-gray-400 mt-1">
            Se registra automáticamente en caja al confirmar la salida de un viaje en COMBI. Dejar en 0 para deshabilitar.
          </p>
        </div>

        <div className="pt-2">
          <Button variant="primary" loading={saving} onClick={handleGuardar}>
            Guardar cambios
          </Button>
        </div>
      </div>


    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'empresa',     label: 'Empresa',     icon: Building2 },
  { key: 'rutas',       label: 'Rutas',       icon: MapPin },
  { key: 'tarifas',     label: 'Tarifas',     icon: Tag },
  { key: 'temporadas',  label: 'Temporadas',  icon: Calendar },
  { key: 'vehiculos',   label: 'Vehículos',   icon: Truck },
  { key: 'conductores', label: 'Conductores', icon: UserCircle },
]

export default function ConfiguracionPage() {
  const [tab, setTab] = useState<Tab>('empresa')

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Configuración</h1>
        <p className="text-sm text-gray-500">Gestión de empresa, rutas, tarifas, flota y conductores</p>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit flex-wrap">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'empresa'     && <EmpresaTab />}
      {tab === 'rutas'       && <RutasTab />}
      {tab === 'tarifas'     && <TarifasTab />}
      {tab === 'temporadas'  && <TemporadasTab />}
      {tab === 'vehiculos'   && <VehiculosTab />}
      {tab === 'conductores' && <ConductoresTab />}
    </div>
  )
}
