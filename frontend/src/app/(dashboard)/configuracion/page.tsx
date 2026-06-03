'use client'
import React, { useState } from 'react'
import useSWR, { mutate } from 'swr'
import toast from 'react-hot-toast'
import { Plus, Pencil, ToggleLeft, ToggleRight, MapPin, Tag, Check, X, Truck, UserCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import api from '@/services/api'

type Tab = 'rutas' | 'tarifas' | 'vehiculos' | 'conductores'

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Ruta {
  id: number
  codigo: string
  origen: string
  destino: string
  distanciaKm: number | null
  duracionMin: number | null
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
}

// ─── RutaForm ─────────────────────────────────────────────────────────────────

interface RutaFormState {
  codigo: string
  origen: string
  destino: string
  distanciaKm: string
  duracionMin: string
}

const emptyRuta: RutaFormState = { codigo: '', origen: '', destino: '', distanciaKm: '', duracionMin: '' }

function RutasTab() {
  const { data: rutasData, isLoading } = useSWR<Ruta[]>('/api/configuracion/rutas')
  const rutas = rutasData ?? []

  const [open, setOpen] = useState(false)
  const [editando, setEditando] = useState<Ruta | null>(null)
  const [form, setForm] = useState<RutaFormState>(emptyRuta)
  const [saving, setSaving] = useState(false)

  const abrirCrear = () => { setEditando(null); setForm(emptyRuta); setOpen(true) }
  const abrirEditar = (r: Ruta) => {
    setEditando(r)
    setForm({
      codigo: r.codigo,
      origen: r.origen,
      destino: r.destino,
      distanciaKm: r.distanciaKm != null ? String(r.distanciaKm) : '',
      duracionMin: r.duracionMin != null ? String(r.duracionMin) : '',
    })
    setOpen(true)
  }

  const guardar = async () => {
    if (!form.codigo || !form.origen || !form.destino) {
      toast.error('Código, origen y destino son obligatorios')
      return
    }
    setSaving(true)
    try {
      const body = {
        codigo: form.codigo,
        origen: form.origen,
        destino: form.destino,
        distanciaKm: form.distanciaKm ? parseFloat(form.distanciaKm) : null,
        duracionMin: form.duracionMin ? parseInt(form.duracionMin) : null,
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
      await api.patch(`/api/configuracion/rutas/${r.id}/activo`)
      mutate('/api/configuracion/rutas')
      toast.success(r.activo ? 'Ruta desactivada' : 'Ruta activada')
    } catch {
      toast.error('Error al cambiar estado')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{rutas.length} ruta(s) registradas</p>
        <Button variant="primary" icon={Plus} onClick={abrirCrear}>Nueva ruta</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-gray-400">Cargando...</div>
        ) : rutas.length === 0 ? (
          <div className="py-12 text-center">
            <MapPin size={32} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No hay rutas registradas</p>
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
              {rutas.map(r => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
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
                    {r.duracionMin != null ? `${r.duracionMin} min` : '—'}
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
                        className="p-1.5 rounded-lg text-gray-400 hover:text-[#064e3b] hover:bg-blue-50 transition-colors"
                        title="Editar">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => toggleActivo(r)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                        title={r.activo ? 'Desactivar' : 'Activar'}>
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

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editando ? 'Editar ruta' : 'Nueva ruta'}
        size="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Código *</label>
              <input value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))}
                placeholder="HUA-KIM"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono uppercase focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Distancia (km)</label>
              <input type="number" min="0" step="0.01" value={form.distanciaKm}
                onChange={e => setForm(f => ({ ...f, distanciaKm: e.target.value }))}
                placeholder="125.5"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Ciudad origen *</label>
            <input value={form.origen} onChange={e => setForm(f => ({ ...f, origen: e.target.value }))}
              placeholder="Huamanga"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Ciudad destino *</label>
            <input value={form.destino} onChange={e => setForm(f => ({ ...f, destino: e.target.value }))}
              placeholder="Kimbiri"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Duración estimada (min)</label>
            <input type="number" min="1" value={form.duracionMin}
              onChange={e => setForm(f => ({ ...f, duracionMin: e.target.value }))}
              placeholder="180"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
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

interface TarifaFormState {
  rutaId: string
  tipoVehiculo: string
  precio: string
}

const emptyTarifa: TarifaFormState = { rutaId: '', tipoVehiculo: '', precio: '' }
const TIPOS_VEHICULO = ['COMBI', 'CAMIONETA', 'BUS', 'MINIVAN']

function TarifasTab() {
  const { data: tarifasData, isLoading } = useSWR<Tarifa[]>('/api/configuracion/tarifas')
  const { data: rutasData } = useSWR<Ruta[]>('/api/configuracion/rutas')

  const tarifas = tarifasData ?? []
  const rutas = rutasData ?? []

  const [open, setOpen] = useState(false)
  const [editando, setEditando] = useState<Tarifa | null>(null)
  const [form, setForm] = useState<TarifaFormState>(emptyTarifa)
  const [saving, setSaving] = useState(false)

  const abrirCrear = () => { setEditando(null); setForm(emptyTarifa); setOpen(true) }
  const abrirEditar = (t: Tarifa) => {
    setEditando(t)
    setForm({ rutaId: String(t.rutaId), tipoVehiculo: t.tipoVehiculo, precio: String(t.precio) })
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
      await api.patch(`/api/configuracion/tarifas/${t.id}/vigente`)
      mutate('/api/configuracion/tarifas')
      toast.success(t.vigente ? 'Tarifa desactivada' : 'Tarifa activada')
    } catch {
      toast.error('Error al cambiar estado')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{tarifas.length} tarifa(s) registradas</p>
        <Button variant="primary" icon={Plus} onClick={abrirCrear}>Nueva tarifa</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-gray-400">Cargando...</div>
        ) : tarifas.length === 0 ? (
          <div className="py-12 text-center">
            <Tag size={32} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No hay tarifas registradas</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide border-b border-gray-100">
                <th className="px-4 py-3 text-left font-medium">Ruta</th>
                <th className="px-4 py-3 text-left font-medium">Vehículo</th>
                <th className="px-4 py-3 text-right font-medium">Precio</th>
                <th className="px-4 py-3 text-center font-medium">Estado</th>
                <th className="px-4 py-3 text-center font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tarifas.map(t => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
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
                        className="p-1.5 rounded-lg text-gray-400 hover:text-[#064e3b] hover:bg-blue-50 transition-colors"
                        title="Editar">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => toggleVigente(t)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                        title={t.vigente ? 'Desactivar' : 'Activar'}>
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

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editando ? 'Editar tarifa' : 'Nueva tarifa'}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Ruta *</label>
            <select value={form.rutaId} onChange={e => setForm(f => ({ ...f, rutaId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option value="">Selecciona una ruta</option>
              {rutas.map(r => (
                <option key={r.id} value={r.id}>
                  {r.origen} → {r.destino}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tipo de vehículo *</label>
            <select value={form.tipoVehiculo} onChange={e => setForm(f => ({ ...f, tipoVehiculo: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option value="">Selecciona tipo</option>
              {TIPOS_VEHICULO.map(tipo => (
                <option key={tipo} value={tipo}>{tipo}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Precio (S/) *</label>
            <input type="number" min="0.10" step="0.50" value={form.precio}
              onChange={e => setForm(f => ({ ...f, precio: e.target.value }))}
              placeholder="25.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
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

// ─── VehiculosTab ─────────────────────────────────────────────────────────────

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
}

interface VehiculoFormState {
  placa: string; tipo: string; marca: string; modelo: string
  anio: string; capacidad: string; color: string; numAsientos: string
}

const emptyVehiculo: VehiculoFormState = {
  placa: '', tipo: '', marca: '', modelo: '', anio: '', capacidad: '', color: '', numAsientos: ''
}

const ESTADOS_VEHICULO = ['OPERATIVO', 'MANTENIMIENTO', 'BAJA']
const estadoColor: Record<string, string> = {
  OPERATIVO:    'bg-green-100 text-green-700',
  MANTENIMIENTO:'bg-amber-100 text-amber-700',
  BAJA:         'bg-red-100 text-red-700',
}

function VehiculosTab() {
  const { data: vehData, isLoading } = useSWR<Vehiculo[]>('/api/configuracion/vehiculos')
  const vehiculos = vehData ?? []

  const [open, setOpen] = useState(false)
  const [editando, setEditando] = useState<Vehiculo | null>(null)
  const [form, setForm] = useState<VehiculoFormState>(emptyVehiculo)
  const [saving, setSaving] = useState(false)

  const abrirCrear = () => { setEditando(null); setForm(emptyVehiculo); setOpen(true) }
  const abrirEditar = (v: Vehiculo) => {
    setEditando(v)
    setForm({
      placa: v.placa, tipo: v.tipo,
      marca: v.marca ?? '', modelo: v.modelo ?? '',
      anio: v.anio != null ? String(v.anio) : '',
      capacidad: String(v.capacidad), color: v.color ?? '',
      numAsientos: String(v.numAsientos),
    })
    setOpen(true)
  }

  const guardar = async () => {
    if (!form.placa || !form.tipo || !form.capacidad || !form.numAsientos) {
      toast.error('Placa, tipo, capacidad y asientos son obligatorios')
      return
    }
    setSaving(true)
    try {
      const body = {
        placa: form.placa, tipo: form.tipo,
        marca: form.marca || null, modelo: form.modelo || null,
        anio: form.anio ? parseInt(form.anio) : null,
        capacidad: parseInt(form.capacidad),
        color: form.color || null,
        numAsientos: parseInt(form.numAsientos),
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
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{vehiculos.length} vehículo(s) registrados</p>
        <Button variant="primary" icon={Plus} onClick={abrirCrear}>Nuevo vehículo</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-gray-400">Cargando...</div>
        ) : vehiculos.length === 0 ? (
          <div className="py-12 text-center">
            <Truck size={32} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No hay vehículos registrados</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide border-b border-gray-100">
                <th className="px-4 py-3 text-left font-medium">Placa</th>
                <th className="px-4 py-3 text-left font-medium">Tipo</th>
                <th className="px-4 py-3 text-left font-medium">Marca / Modelo</th>
                <th className="px-4 py-3 text-center font-medium">Asientos</th>
                <th className="px-4 py-3 text-center font-medium">Estado</th>
                <th className="px-4 py-3 text-center font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vehiculos.map(v => (
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
                  <td className="px-4 py-3 text-center font-semibold text-gray-900">{v.numAsientos}</td>
                  <td className="px-4 py-3 text-center">
                    <select
                      value={v.estado}
                      onChange={e => cambiarEstado(v, e.target.value)}
                      className={`text-xs font-semibold px-2 py-1 rounded-full border-0 cursor-pointer focus:ring-2 focus:ring-blue-500 ${estadoColor[v.estado] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {ESTADOS_VEHICULO.map(e => (
                        <option key={e} value={e}>{e}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => abrirEditar(v)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-[#064e3b] hover:bg-blue-50 transition-colors"
                      title="Editar">
                      <Pencil size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editando ? 'Editar vehículo' : 'Nuevo vehículo'}
        size="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Placa *</label>
              <input value={form.placa} onChange={e => setForm(f => ({ ...f, placa: e.target.value }))}
                placeholder="ABC-123"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono uppercase focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Tipo *</label>
              <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="">Seleccionar</option>
                {TIPOS_VEHICULO.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Marca</label>
              <input value={form.marca} onChange={e => setForm(f => ({ ...f, marca: e.target.value }))}
                placeholder="Toyota"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Modelo</label>
              <input value={form.modelo} onChange={e => setForm(f => ({ ...f, modelo: e.target.value }))}
                placeholder="Hiace"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Año</label>
              <input type="number" min="2000" max="2030" value={form.anio}
                onChange={e => setForm(f => ({ ...f, anio: e.target.value }))}
                placeholder="2020"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Capacidad *</label>
              <input type="number" min="1" value={form.capacidad}
                onChange={e => setForm(f => ({ ...f, capacidad: e.target.value }))}
                placeholder="15"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">N° asientos *</label>
              <input type="number" min="1" value={form.numAsientos}
                onChange={e => setForm(f => ({ ...f, numAsientos: e.target.value }))}
                placeholder="15"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Color</label>
            <input value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
              placeholder="Blanco"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
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

interface ConductorFormState {
  nombres: string; apellidos: string; dni: string; licencia: string
  categoriaLic: string; telefono: string; email: string; fechaVencLic: string
}

const emptyConductor: ConductorFormState = {
  nombres: '', apellidos: '', dni: '', licencia: '',
  categoriaLic: '', telefono: '', email: '', fechaVencLic: '',
}

function ConductoresTab() {
  const { data: condData, isLoading } = useSWR<Conductor[]>('/api/configuracion/conductores')
  const conductores = condData ?? []

  const [open, setOpen] = useState(false)
  const [editando, setEditando] = useState<Conductor | null>(null)
  const [form, setForm] = useState<ConductorFormState>(emptyConductor)
  const [saving, setSaving] = useState(false)

  const abrirCrear = () => { setEditando(null); setForm(emptyConductor); setOpen(true) }
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
      if (editando) {
        await api.put(`/api/configuracion/conductores/${editando.id}`, body)
        toast.success('Conductor actualizado')
      } else {
        await api.post('/api/configuracion/conductores', body)
        toast.success('Conductor registrado')
      }
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
      await api.patch(`/api/configuracion/conductores/${c.id}/activo`)
      mutate('/api/configuracion/conductores')
      toast.success(c.activo ? 'Conductor desactivado' : 'Conductor activado')
    } catch {
      toast.error('Error al cambiar estado')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{conductores.length} conductor(es) registrados</p>
        <Button variant="primary" icon={Plus} onClick={abrirCrear}>Nuevo conductor</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-gray-400">Cargando...</div>
        ) : conductores.length === 0 ? (
          <div className="py-12 text-center">
            <UserCircle size={32} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No hay conductores registrados</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide border-b border-gray-100">
                <th className="px-4 py-3 text-left font-medium">Conductor</th>
                <th className="px-4 py-3 text-left font-medium">DNI</th>
                <th className="px-4 py-3 text-left font-medium">Licencia</th>
                <th className="px-4 py-3 text-left font-medium">Teléfono</th>
                <th className="px-4 py-3 text-left font-medium">Venc. lic.</th>
                <th className="px-4 py-3 text-center font-medium">Estado</th>
                <th className="px-4 py-3 text-center font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {conductores.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
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
                  <td className="px-4 py-3 text-gray-600 text-xs">{c.telefono ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {c.fechaVencLic ? new Date(c.fechaVencLic).toLocaleDateString('es-PE') : '—'}
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
                        className="p-1.5 rounded-lg text-gray-400 hover:text-[#064e3b] hover:bg-blue-50 transition-colors"
                        title="Editar">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => toggleActivo(c)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                        title={c.activo ? 'Desactivar' : 'Activar'}>
                        {c.activo ? <ToggleRight size={16} className="text-green-500" /> : <ToggleLeft size={16} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editando ? 'Editar conductor' : 'Nuevo conductor'} size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nombres *</label>
              <input value={form.nombres} onChange={e => setForm(f => ({ ...f, nombres: e.target.value }))}
                placeholder="Carlos"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Apellidos *</label>
              <input value={form.apellidos} onChange={e => setForm(f => ({ ...f, apellidos: e.target.value }))}
                placeholder="García López"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">DNI * (8 dígitos)</label>
              <input value={form.dni} onChange={e => setForm(f => ({ ...f, dni: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
                placeholder="12345678" maxLength={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">N° Licencia *</label>
              <input value={form.licencia} onChange={e => setForm(f => ({ ...f, licencia: e.target.value.toUpperCase() }))}
                placeholder="Q12345678"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono uppercase focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Categoría licencia</label>
              <select value={form.categoriaLic} onChange={e => setForm(f => ({ ...f, categoriaLic: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="">Sin categoría</option>
                {['A-I','A-IIa','A-IIb','A-IIIa','A-IIIb','A-IIIc','B-I','B-IIa','B-IIb','B-IIc'].map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Teléfono</label>
              <input value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value.replace(/\D/g, '').slice(0, 9) }))}
                placeholder="987654321" maxLength={9}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="conductor@ejemplo.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Vencimiento licencia</label>
              <input type="date" value={form.fechaVencLic} onChange={e => setForm(f => ({ ...f, fechaVencLic: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="primary" loading={saving} onClick={guardar}>
              {editando ? 'Guardar cambios' : 'Registrar conductor'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'rutas',       label: 'Rutas',       icon: MapPin },
  { key: 'tarifas',     label: 'Tarifas',     icon: Tag },
  { key: 'vehiculos',   label: 'Vehículos',   icon: Truck },
  { key: 'conductores', label: 'Conductores', icon: UserCircle },
]

export default function ConfiguracionPage() {
  const [tab, setTab] = useState<Tab>('rutas')

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Configuración</h1>
        <p className="text-sm text-gray-500">Gestión de rutas, tarifas, flota y conductores</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
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

      {tab === 'rutas'       && <RutasTab />}
      {tab === 'tarifas'     && <TarifasTab />}
      {tab === 'vehiculos'   && <VehiculosTab />}
      {tab === 'conductores' && <ConductoresTab />}
    </div>
  )
}
