'use client'
import React, { useState } from 'react'
import useSWR from 'swr'
import toast from 'react-hot-toast'
import { useParams, useRouter } from 'next/navigation'
import {
  Building2, MapPin, Phone, Mail, User, Hash,
  ChevronRight, Truck, Package, DollarSign, Users,
  Calendar, Settings, ArrowLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { useAuthStore } from '@/stores/authStore'
import { Agencia, AgenciaMetricas, UsuarioSimple, Viaje, Encomienda } from '@/types'
import api from '@/services/api'

// ---- Metric card ----
function BigMetricCard({
  label, value, icon: Icon, colorClass,
}: {
  label: string
  value: string | number
  icon: React.ElementType
  colorClass: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${colorClass}`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
      </div>
    </div>
  )
}

// ---- Form state ----
interface FormState {
  codigo: string
  nombre: string
  ciudad: string
  direccion: string
  telefono: string
  email: string
  ruc: string
  encargadoId: string
  esSedePrincipal: boolean
}

export default function AgenciaDetallePage() {
  const { id } = useParams<{ id: string }>()
  const agenciaId = Number(id)
  const router = useRouter()
  const { hasRole } = useAuthStore()
  const isSuperAdmin = hasRole('SUPER_ADMIN')

  const { data: agencia, mutate: mutateAgencia } = useSWR<Agencia>(`/api/agencias/${agenciaId}`)
  const { data: metricas } = useSWR<AgenciaMetricas>(`/api/agencias/${agenciaId}/metricas`)
  const { data: todosUsuarios } = useSWR<UsuarioSimple[]>('/api/usuarios')
  const { data: todosViajes } = useSWR<Viaje[]>('/api/viajes')
  const { data: todasEncomiendas } = useSWR<Encomienda[]>('/api/encomiendas')

  const usuariosAgencia = (todosUsuarios || []).filter(u => u.agenciaId === agenciaId)
  const viajesRecientes = (todosViajes || [])
    .filter(v => v.agenciaId === agenciaId)
    .slice(0, 10)
  const encomiendaRecientes = (todasEncomiendas || [])
    .filter(e => e.agenciaId === agenciaId)
    .slice(0, 10)

  const [modalEditar, setModalEditar] = useState(false)
  const [form, setForm] = useState<FormState>({
    codigo: '', nombre: '', ciudad: '', direccion: '',
    telefono: '', email: '', ruc: '', encargadoId: '', esSedePrincipal: false,
  })
  const [saving, setSaving] = useState(false)

  const openEditar = () => {
    if (!agencia) return
    setForm({
      codigo: agencia.codigo,
      nombre: agencia.nombre,
      ciudad: agencia.ciudad,
      direccion: agencia.direccion,
      telefono: agencia.telefono,
      email: agencia.email ?? '',
      ruc: agencia.ruc ?? '',
      encargadoId: agencia.encargadoId ? String(agencia.encargadoId) : '',
      esSedePrincipal: agencia.esSedePrincipal,
    })
    setModalEditar(true)
  }

  const guardar = async () => {
    if (!form.codigo || !form.nombre) { toast.error('Código y nombre son obligatorios'); return }
    if (form.ruc && form.ruc.length !== 11) { toast.error('El RUC debe tener 11 dígitos'); return }
    setSaving(true)
    try {
      await api.put(`/api/agencias/${agenciaId}`, {
        codigo: form.codigo,
        nombre: form.nombre,
        ciudad: form.ciudad,
        direccion: form.direccion,
        telefono: form.telefono,
        email: form.email || null,
        ruc: form.ruc || null,
        encargadoId: form.encargadoId ? Number(form.encargadoId) : null,
        esSedePrincipal: form.esSedePrincipal,
      })
      toast.success('Agencia actualizada')
      setModalEditar(false)
      mutateAgencia()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al actualizar agencia')
    } finally {
      setSaving(false)
    }
  }

  const quitarUsuario = async (userId: number) => {
    if (!confirm('¿Quitar usuario de esta agencia?')) return
    try {
      await api.patch(`/api/usuarios/${userId}/agencia`, { agenciaId: null })
      toast.success('Usuario quitado de la agencia')
      mutateAgencia()
    } catch {
      toast.error('No se pudo quitar el usuario')
    }
  }

  if (!agencia) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1F3864]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span>Express VRAEM</span>
        <ChevronRight size={14} />
        <button onClick={() => router.push('/agencias')} className="hover:text-gray-700 transition-colors">
          Agencias
        </button>
        <ChevronRight size={14} />
        <span className="text-gray-900 font-medium truncate max-w-xs">{agencia.nombre}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/agencias')}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={18} className="text-gray-500" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">{agencia.nombre}</h1>
              {agencia.esSedePrincipal && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-100 text-cyan-700">
                  SEDE PRINCIPAL
                </span>
              )}
              <Badge
                estado={agencia.estado === 'ACTIVA' ? 'DISPONIBLE' : 'CANCELADO'}
                label={agencia.estado}
              />
            </div>
            <p className="text-sm text-gray-400">{agencia.codigo}</p>
          </div>
        </div>
        <Button icon={Settings} variant="secondary" onClick={openEditar}>
          Editar agencia
        </Button>
      </div>

      {/* Top grid: datos + métricas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Datos generales */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Datos generales</h2>
          <div className="space-y-3">
            <DataRow icon={Hash} label="Código" value={agencia.codigo} />
            <DataRow icon={MapPin} label="Ciudad" value={agencia.ciudad} />
            <DataRow icon={Building2} label="Dirección" value={agencia.direccion} />
            <DataRow icon={Phone} label="Teléfono" value={agencia.telefono} />
            {agencia.email && <DataRow icon={Mail} label="Email" value={agencia.email} />}
            {agencia.ruc && <DataRow icon={Hash} label="RUC" value={agencia.ruc} />}
            <DataRow
              icon={User}
              label="Encargado"
              value={agencia.encargadoNombre ?? 'Sin encargado asignado'}
              muted={!agencia.encargadoNombre}
            />
            {agencia.fechaApertura && (
              <DataRow icon={Calendar} label="Apertura" value={agencia.fechaApertura} />
            )}
          </div>
        </div>

        {/* Métricas del mes */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Métricas del mes</h2>
          {!metricas ? (
            <div className="space-y-3">
              {[0,1,2,3,4].map(i => (
                <div key={i} className="animate-pulse bg-gray-200 rounded-xl h-16" />
              ))}
            </div>
          ) : (
            <>
              <BigMetricCard
                label="Viajes"
                value={metricas.totalViajesMes}
                icon={Truck}
                colorClass="bg-blue-100 text-blue-700"
              />
              <BigMetricCard
                label="Pasajes"
                value={metricas.totalPasajesMes}
                icon={Users}
                colorClass="bg-indigo-100 text-indigo-700"
              />
              <BigMetricCard
                label="Encomiendas"
                value={metricas.totalEncomiendaMes}
                icon={Package}
                colorClass="bg-amber-100 text-amber-700"
              />
              <BigMetricCard
                label="Ingresos del mes"
                value={`S/ ${Number(metricas.totalIngresosMes).toFixed(2)}`}
                icon={DollarSign}
                colorClass="bg-green-100 text-green-700"
              />
              <BigMetricCard
                label="Usuarios activos"
                value={metricas.usuariosActivos}
                icon={User}
                colorClass="bg-purple-100 text-purple-700"
              />
            </>
          )}
        </div>
      </div>

      {/* Usuarios */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">
            Usuarios ({usuariosAgencia.length})
          </h2>
        </div>
        {usuariosAgencia.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">No hay usuarios en esta agencia</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3 text-left">Nombre</th>
                  <th className="px-5 py-3 text-left">Email</th>
                  <th className="px-5 py-3 text-left">Rol</th>
                  <th className="px-5 py-3 text-left">Estado</th>
                  {isSuperAdmin && <th className="px-5 py-3 text-left">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {usuariosAgencia.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-800">
                      {u.nombres} {u.apellidos}
                    </td>
                    <td className="px-5 py-3 text-gray-500">{u.email}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                        {u.rol}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <Badge
                        estado={u.activo ? 'DISPONIBLE' : 'CANCELADO'}
                        label={u.activo ? 'ACTIVO' : 'INACTIVO'}
                      />
                    </td>
                    {isSuperAdmin && (
                      <td className="px-5 py-3">
                        <button
                          onClick={() => quitarUsuario(u.id)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Quitar
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Viajes recientes */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Viajes recientes</h2>
        </div>
        {viajesRecientes.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">No hay viajes</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3 text-left">Ruta</th>
                  <th className="px-5 py-3 text-left">Fecha/Hora</th>
                  <th className="px-5 py-3 text-left">Vehículo</th>
                  <th className="px-5 py-3 text-left">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {viajesRecientes.map(v => (
                  <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-gray-800">
                      {v.ruta ? `${v.ruta.origen} → ${v.ruta.destino}` : `Viaje #${v.id}`}
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {new Date(v.fechaHoraSal).toLocaleString('es-PE', {
                        dateStyle: 'short', timeStyle: 'short',
                      })}
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {v.vehiculo?.placa ?? '—'}
                    </td>
                    <td className="px-5 py-3">
                      <Badge estado={v.estado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Encomiendas recientes */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Encomiendas recientes</h2>
        </div>
        {encomiendaRecientes.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">No hay encomiendas</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3 text-left">Tracking</th>
                  <th className="px-5 py-3 text-left">Remitente</th>
                  <th className="px-5 py-3 text-left">Estado</th>
                  <th className="px-5 py-3 text-left">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {encomiendaRecientes.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-gray-700">
                      {e.codigoTracking ?? `#${e.id}`}
                    </td>
                    <td className="px-5 py-3 text-gray-700">
                      {e.remitenteNombre ?? `Cliente #${e.remitenteId}`}
                    </td>
                    <td className="px-5 py-3">
                      <Badge estado={e.estado} />
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {new Date(e.fechaRegistro).toLocaleDateString('es-PE')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal editar */}
      <Modal open={modalEditar} onClose={() => setModalEditar(false)} title="Editar agencia" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Código *</label>
              <input
                value={form.codigo}
                onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Teléfono *</label>
              <input
                value={form.telefono}
                onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nombre *</label>
            <input
              value={form.nombre}
              onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Ciudad *</label>
            <input
              value={form.ciudad}
              onChange={e => setForm(f => ({ ...f, ciudad: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Dirección *</label>
            <input
              value={form.direccion}
              onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                type="email"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">RUC</label>
              <input
                value={form.ruc}
                onChange={e => setForm(f => ({ ...f, ruc: e.target.value }))}
                maxLength={11}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Encargado</label>
            <select
              value={form.encargadoId}
              onChange={e => setForm(f => ({ ...f, encargadoId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">— Sin encargado —</option>
              {(todosUsuarios || []).map(u => (
                <option key={u.id} value={u.id}>
                  {u.nombres} {u.apellidos} ({u.rol})
                </option>
              ))}
            </select>
          </div>
          {isSuperAdmin && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.esSedePrincipal}
                onChange={e => setForm(f => ({ ...f, esSedePrincipal: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Es sede principal</span>
            </label>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalEditar(false)}>Cancelar</Button>
            <Button variant="primary" loading={saving} onClick={guardar}>Guardar</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ---- Helper ----
function DataRow({
  icon: Icon, label, value, muted = false,
}: {
  icon: React.ElementType
  label: string
  value: string
  muted?: boolean
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
        <Icon size={13} className="text-gray-500" />
      </div>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className={`text-sm ${muted ? 'text-gray-400 italic' : 'text-gray-800'}`}>{value}</p>
      </div>
    </div>
  )
}
