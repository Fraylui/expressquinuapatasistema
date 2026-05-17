'use client'
import React, { useState } from 'react'
import useSWR from 'swr'
import toast from 'react-hot-toast'
import { Plus, Building2, MapPin, Phone, User, Mail, ChevronRight, Settings } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { useAuthStore } from '@/stores/authStore'
import { useRouter } from 'next/navigation'
import { Agencia, AgenciaMetricas, UsuarioSimple } from '@/types'
import api from '@/services/api'

// ---- Metric skeleton / card ----
function MetricasCard({ agenciaId }: { agenciaId: number }) {
  const { data: metricas } = useSWR<AgenciaMetricas>(`/api/agencias/${agenciaId}/metricas`)

  if (!metricas) {
    return (
      <div className="grid grid-cols-3 gap-2 mt-3">
        {[0, 1, 2].map(i => (
          <div key={i} className="animate-pulse bg-gray-200 rounded h-10" />
        ))}
      </div>
    )
  }

  const items = [
    { label: 'Viajes', value: metricas.totalViajesMes },
    { label: 'Pasajes', value: metricas.totalPasajesMes },
    { label: 'Encom.', value: metricas.totalEncomiendaMes },
  ]

  return (
    <div className="grid grid-cols-3 gap-2 mt-3">
      {items.map(({ label, value }) => (
        <div key={label} className="bg-gray-50 rounded-lg p-2 text-center">
          <p className="text-gray-400 text-xs uppercase tracking-wide">{label}</p>
          <p className="font-bold text-gray-800 text-sm">{value}</p>
        </div>
      ))}
    </div>
  )
}

// ---- AgenciaCard ----
interface AgenciaCardProps {
  agencia: Agencia
  isSuperAdmin: boolean
  onEdit: (a: Agencia) => void
  onToggleEstado: (a: Agencia) => void
}

function AgenciaCard({ agencia, isSuperAdmin, onEdit, onToggleEstado }: AgenciaCardProps) {
  const router = useRouter()
  const esActiva = agencia.estado === 'ACTIVA'

  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden ${agencia.esSedePrincipal ? 'border-t-4 border-t-cyan-500' : ''}`}>
      {agencia.esSedePrincipal && (
        <div className="px-4 pt-2 pb-0">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-100 text-cyan-700">
            SEDE PRINCIPAL
          </span>
        </div>
      )}
      <div className="p-4">
        {/* Top */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#1F3864]/10 rounded-xl flex items-center justify-center shrink-0">
              <Building2 size={20} className="text-[#1F3864]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 leading-tight">{agencia.nombre}</p>
              <p className="text-xs text-gray-400">{agencia.codigo}</p>
            </div>
          </div>
          <Badge
            estado={esActiva ? 'DISPONIBLE' : 'CANCELADO'}
            label={esActiva ? 'ACTIVA' : 'INACTIVA'}
          />
        </div>

        {/* Details */}
        <div className="space-y-1.5 mb-3">
          {agencia.ciudad && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <MapPin size={12} />
              <span>{agencia.ciudad}</span>
            </div>
          )}
          {agencia.telefono && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Phone size={12} />
              <span>{agencia.telefono}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <User size={12} />
            <span className={agencia.encargadoNombre ? '' : 'text-gray-400 italic'}>
              {agencia.encargadoNombre ?? 'Sin encargado asignado'}
            </span>
          </div>
          {agencia.email && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Mail size={12} />
              <span className="truncate">{agencia.email}</span>
            </div>
          )}
        </div>

        {/* Metrics */}
        <MetricasCard agenciaId={agencia.id} />

        {/* Footer */}
        <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-gray-100">
          <Button
            size="sm"
            variant="secondary"
            icon={ChevronRight}
            iconPosition="right"
            onClick={() => router.push(`/agencias/${agencia.id}`)}
            className="flex-1 justify-center text-[#0070C0] border-[#0070C0]/30 hover:bg-blue-50"
          >
            Ver detalle
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={Settings}
            onClick={() => onEdit(agencia)}
            className="justify-center text-gray-600"
          >
            Configurar
          </Button>
          {isSuperAdmin && (
            <button
              onClick={() => onToggleEstado(agencia)}
              className={`text-xs font-medium px-2 py-1 rounded transition-colors ${
                esActiva
                  ? 'text-red-600 hover:bg-red-50'
                  : 'text-green-600 hover:bg-green-50'
              }`}
            >
              {esActiva ? 'Desactivar' : 'Activar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ---- Form fields config ----
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

const EMPTY_FORM: FormState = {
  codigo: '', nombre: '', ciudad: '', direccion: '',
  telefono: '', email: '', ruc: '', encargadoId: '', esSedePrincipal: false,
}

// ---- Main Page ----
export default function AgenciasPage() {
  const { hasRole } = useAuthStore()
  const isSuperAdmin = hasRole('SUPER_ADMIN')

  const { data: agencias, mutate } = useSWR<Agencia[]>('/api/agencias')
  const { data: usuarios } = useSWR<UsuarioSimple[]>('/api/usuarios')
  const lista: Agencia[] = agencias || []

  const [modalNueva, setModalNueva] = useState(false)
  const [modalEditar, setModalEditar] = useState<Agencia | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const openNueva = () => {
    setForm(EMPTY_FORM)
    setModalNueva(true)
  }

  const openEditar = (a: Agencia) => {
    setForm({
      codigo: a.codigo,
      nombre: a.nombre,
      ciudad: a.ciudad,
      direccion: a.direccion,
      telefono: a.telefono,
      email: a.email ?? '',
      ruc: a.ruc ?? '',
      encargadoId: a.encargadoId ? String(a.encargadoId) : '',
      esSedePrincipal: a.esSedePrincipal,
    })
    setModalEditar(a)
  }

  const handleField = (key: keyof FormState, val: string | boolean) =>
    setForm(f => ({ ...f, [key]: val }))

  const buildPayload = () => ({
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

  const crearAgencia = async () => {
    if (!form.codigo || !form.nombre) {
      toast.error('Código y nombre son obligatorios')
      return
    }
    if (form.ruc && form.ruc.length !== 11) {
      toast.error('El RUC debe tener 11 dígitos')
      return
    }
    setSaving(true)
    try {
      await api.post('/api/agencias', buildPayload())
      toast.success('Agencia creada correctamente')
      setModalNueva(false)
      mutate()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al crear agencia')
    } finally {
      setSaving(false)
    }
  }

  const guardarAgencia = async () => {
    if (!modalEditar) return
    if (!form.codigo || !form.nombre) {
      toast.error('Código y nombre son obligatorios')
      return
    }
    if (form.ruc && form.ruc.length !== 11) {
      toast.error('El RUC debe tener 11 dígitos')
      return
    }
    setSaving(true)
    try {
      await api.put(`/api/agencias/${modalEditar.id}`, buildPayload())
      toast.success('Agencia actualizada')
      setModalEditar(null)
      mutate()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al actualizar agencia')
    } finally {
      setSaving(false)
    }
  }

  const toggleEstado = async (a: Agencia) => {
    const nuevoEstado = a.estado === 'ACTIVA' ? 'INACTIVA' : 'ACTIVA'
    try {
      await api.patch(`/api/agencias/${a.id}/estado`, { estado: nuevoEstado })
      toast.success(`Agencia ${nuevoEstado === 'ACTIVA' ? 'activada' : 'desactivada'}`)
      mutate()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al cambiar estado')
    }
  }

  // ---- Modal form shared ----
  const AgenciaForm = ({ onSubmit, submitLabel }: { onSubmit: () => void; submitLabel: string }) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {/* Código */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Código *</label>
          <input
            value={form.codigo}
            onChange={e => handleField('codigo', e.target.value)}
            placeholder="AYA-02"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0]/30"
          />
        </div>
        {/* Teléfono */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Teléfono *</label>
          <input
            value={form.telefono}
            onChange={e => handleField('telefono', e.target.value)}
            placeholder="066-000000"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0]/30"
          />
        </div>
      </div>
      {/* Nombre */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Nombre *</label>
        <input
          value={form.nombre}
          onChange={e => handleField('nombre', e.target.value)}
          placeholder="Sede Ayacucho"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0]/30"
        />
      </div>
      {/* Ciudad */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Ciudad *</label>
        <input
          value={form.ciudad}
          onChange={e => handleField('ciudad', e.target.value)}
          placeholder="Ayacucho"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0]/30"
        />
      </div>
      {/* Dirección */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Dirección *</label>
        <input
          value={form.direccion}
          onChange={e => handleField('direccion', e.target.value)}
          placeholder="Jr. Lima 245"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0]/30"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {/* Email */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
          <input
            value={form.email}
            onChange={e => handleField('email', e.target.value)}
            placeholder="sede@quinuapata.com"
            type="email"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0]/30"
          />
        </div>
        {/* RUC */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">RUC</label>
          <input
            value={form.ruc}
            onChange={e => handleField('ruc', e.target.value)}
            placeholder="20601234567"
            maxLength={11}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0]/30"
          />
        </div>
      </div>
      {/* Encargado */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Encargado</label>
        <select
          value={form.encargadoId}
          onChange={e => handleField('encargadoId', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0]/30"
        >
          <option value="">— Sin encargado —</option>
          {(usuarios || []).map(u => (
            <option key={u.id} value={u.id}>
              {u.nombres} {u.apellidos} ({u.rol})
            </option>
          ))}
        </select>
      </div>
      {/* Es sede principal (solo SUPER_ADMIN) */}
      {isSuperAdmin && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.esSedePrincipal}
            onChange={e => handleField('esSedePrincipal', e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-[#0070C0]"
          />
          <span className="text-sm text-gray-700">Es sede principal</span>
        </label>
      )}
      <div className="flex justify-end gap-3 pt-2">
        <Button
          variant="secondary"
          onClick={() => { setModalNueva(false); setModalEditar(null) }}
        >
          Cancelar
        </Button>
        <Button
          variant="primary"
          loading={saving}
          onClick={onSubmit}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Agencias</h1>
          <p className="text-sm text-gray-500">Sucursales del sistema</p>
        </div>
        {isSuperAdmin && (
          <Button icon={Plus} onClick={openNueva}>Nueva agencia</Button>
        )}
      </div>

      {/* Grid */}
      {lista.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Building2 size={40} className="text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">No hay agencias registradas</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {lista.map(a => (
            <AgenciaCard
              key={a.id}
              agencia={a}
              isSuperAdmin={isSuperAdmin}
              onEdit={openEditar}
              onToggleEstado={toggleEstado}
            />
          ))}
        </div>
      )}

      {/* Modal nueva */}
      <Modal open={modalNueva} onClose={() => setModalNueva(false)} title="Nueva Agencia" size="lg">
        <AgenciaForm onSubmit={crearAgencia} submitLabel="Crear" />
      </Modal>

      {/* Modal editar */}
      <Modal
        open={!!modalEditar}
        onClose={() => setModalEditar(null)}
        title={`Editar — ${modalEditar?.nombre ?? ''}`}
        size="lg"
      >
        <AgenciaForm onSubmit={guardarAgencia} submitLabel="Guardar" />
      </Modal>
    </div>
  )
}
