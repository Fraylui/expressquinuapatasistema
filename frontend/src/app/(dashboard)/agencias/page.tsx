'use client'
import React, { useState } from 'react'
import useSWR from 'swr'
import toast from 'react-hot-toast'
import {
  Plus, Building2, MapPin, Phone, User, Mail,
  ChevronRight, Settings, GitBranch,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { useAuthStore } from '@/stores/authStore'
import { useRouter } from 'next/navigation'
import { Agencia, AgenciaMetricas, UsuarioSimple } from '@/types'
import api from '@/services/api'

// ── Metric card ───────────────────────────────────────────────────────────────

function MetricasCard({ agenciaId }: { agenciaId: number }) {
  const { data: metricas, error } = useSWR<AgenciaMetricas>(`/api/agencias/${agenciaId}/metricas`)

  if (error) return null

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

// ── Tarjeta de agencia principal ──────────────────────────────────────────────

interface AgenciaCardProps {
  agencia: Agencia
  isSuperAdmin: boolean
  puedeGestionar: boolean
  onEdit: (a: Agencia) => void
  onToggleEstado: (a: Agencia) => void
  onAgregarSucursal: (padreId: number, padreNombre: string) => void
}

function AgenciaCard({ agencia, isSuperAdmin, puedeGestionar, onEdit, onToggleEstado, onAgregarSucursal }: AgenciaCardProps) {
  const router = useRouter()
  const esActiva = agencia.estado === 'ACTIVA'

  return (
    <div className="border-l-4 border-l-[#064e3b] bg-white rounded-r-xl border border-l-0 border-gray-200 shadow-sm overflow-hidden">
      <div className="p-4">
        {/* Top */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#064e3b]/10 rounded-xl flex items-center justify-center shrink-0">
              <Building2 size={20} className="text-[#064e3b]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-gray-900 leading-tight">{agencia.nombre}</p>
                {agencia.esSedePrincipal && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-[#064e3b]/10 text-[#064e3b]">
                    SEDE PRINCIPAL
                  </span>
                )}
              </div>
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
          {puedeGestionar && (
            <Button
              size="sm"
              variant="secondary"
              icon={GitBranch}
              onClick={() => onAgregarSucursal(agencia.id, agencia.nombre)}
              className="justify-center text-cyan-600 border-cyan-300 hover:bg-cyan-50"
            >
              Agregar sucursal
            </Button>
          )}
          {/* Desactivar/activar agencia: solo SUPER_ADMIN (así lo exige el backend) */}
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

      {/* Sucursales */}
      {(agencia.sucursales ?? []).length > 0 && (
        <div className="border-t border-gray-100 bg-gray-50/50 px-4 pt-3 pb-4 space-y-2">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Sucursales</p>
          {(agencia.sucursales ?? []).map(s => (
            <SucursalCard
              key={s.id}
              sucursal={s}
              puedeGestionar={puedeGestionar}
              onEdit={onEdit}
              onToggleEstado={onToggleEstado}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tarjeta de sucursal ───────────────────────────────────────────────────────

interface SucursalCardProps {
  sucursal: Agencia
  puedeGestionar: boolean
  onEdit: (a: Agencia) => void
  onToggleEstado: (a: Agencia) => void
}

function SucursalCard({ sucursal, puedeGestionar, onEdit, onToggleEstado }: SucursalCardProps) {
  const router = useRouter()
  const esActiva = sucursal.estado === 'ACTIVA'

  return (
    <div className="ml-6 border-l-[3px] border-l-cyan-400 bg-white rounded-r-lg border border-l-0 border-gray-200 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 bg-cyan-50 rounded-lg flex items-center justify-center shrink-0">
            <Building2 size={14} className="text-cyan-600" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-semibold text-gray-800 truncate">{sucursal.nombre}</p>
              <span className="shrink-0 text-xs px-1.5 py-0.5 bg-cyan-100 text-cyan-700 rounded font-medium">
                SUCURSAL
              </span>
            </div>
            <p className="text-xs text-gray-400">{sucursal.codigo} · {sucursal.ciudad}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge
            estado={esActiva ? 'DISPONIBLE' : 'CANCELADO'}
            label={esActiva ? 'ACTIVA' : 'INACTIVA'}
          />
          <button
            onClick={() => router.push(`/agencias/${sucursal.id}`)}
            className="p-1 text-gray-400 hover:text-[#0070C0] hover:bg-blue-50 rounded"
            title="Ver detalle"
          >
            <ChevronRight size={14} />
          </button>
          {puedeGestionar && (
            <button
              onClick={() => onEdit(sucursal)}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
              title="Configurar"
            >
              <Settings size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Form state ────────────────────────────────────────────────────────────────

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
  tipo: 'AGENCIA' | 'SUCURSAL'
  agenciaPadreId: string
}

const EMPTY_FORM: FormState = {
  codigo: '', nombre: '', ciudad: '', direccion: '',
  telefono: '', email: '', ruc: '', encargadoId: '',
  esSedePrincipal: false, tipo: 'AGENCIA', agenciaPadreId: '',
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AgenciasPage() {
  const { hasRole } = useAuthStore()
  const isSuperAdmin = hasRole('SUPER_ADMIN')
  // El backend permite crear/editar agencias a SUPER_ADMIN y GERENTE
  const puedeGestionar = isSuperAdmin || hasRole('GERENTE')

  // Hierarchical list (principals with nested sucursales)
  const { data: agencias, mutate } = useSWR<Agencia[]>('/api/agencias')
  // Flat list for selectors (principals only)
  const { data: principales } = useSWR<Agencia[]>('/api/agencias/principales')
  const { data: usuarios } = useSWR<UsuarioSimple[]>('/api/usuarios')

  const lista: Agencia[] = agencias || []
  const principalesActivas: Agencia[] = principales || []

  const [modalNueva, setModalNueva] = useState(false)
  const [modalEditar, setModalEditar] = useState<Agencia | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const openNueva = () => {
    setForm(EMPTY_FORM)
    setModalNueva(true)
  }

  const openAgregarSucursal = (padreId: number, _padreNombre: string) => {
    setForm({ ...EMPTY_FORM, tipo: 'SUCURSAL', agenciaPadreId: String(padreId) })
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
      tipo: a.tipo ?? 'AGENCIA',
      agenciaPadreId: a.agenciaPadreId ? String(a.agenciaPadreId) : '',
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
    esSedePrincipal: form.tipo === 'AGENCIA' ? form.esSedePrincipal : false,
    tipo: form.tipo,
    agenciaPadreId: form.tipo === 'SUCURSAL' && form.agenciaPadreId ? Number(form.agenciaPadreId) : null,
  })

  const crearAgencia = async () => {
    if (!form.codigo || !form.nombre || !form.ciudad.trim()) {
      toast.error('Código, nombre y ciudad son obligatorios')
      return
    }
    if (form.tipo === 'SUCURSAL' && !form.agenciaPadreId) {
      toast.error('Debe seleccionar una agencia principal para la sucursal')
      return
    }
    setSaving(true)
    try {
      await api.post('/api/agencias', buildPayload())
      toast.success(form.tipo === 'SUCURSAL' ? 'Sucursal creada correctamente' : 'Agencia creada correctamente')
      setModalNueva(false)
      mutate()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al crear')
    } finally {
      setSaving(false)
    }
  }

  const guardarAgencia = async () => {
    if (!modalEditar) return
    if (!form.codigo || !form.nombre || !form.ciudad.trim()) {
      toast.error('Código, nombre y ciudad son obligatorios')
      return
    }
    setSaving(true)
    try {
      await api.put(`/api/agencias/${modalEditar.id}`, buildPayload())
      toast.success('Actualizado correctamente')
      setModalEditar(null)
      mutate()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al actualizar')
    } finally {
      setSaving(false)
    }
  }

  const toggleEstado = async (a: Agencia) => {
    const nuevoEstado = a.estado === 'ACTIVA' ? 'INACTIVA' : 'ACTIVA'
    try {
      await api.patch(`/api/agencias/${a.id}/estado`, { estado: nuevoEstado })
      toast.success(`${nuevoEstado === 'ACTIVA' ? 'Activada' : 'Desactivada'} correctamente`)
      mutate()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al cambiar estado')
    }
  }

  // ── Modal form ────────────────────────────────────────────────────────────

  const AgenciaForm = ({ onSubmit, submitLabel }: { onSubmit: () => void; submitLabel: string }) => (
    <div className="space-y-4">
      {/* Tipo */}
      {puedeGestionar && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Tipo *</label>
          <div className="flex gap-2">
            {(['AGENCIA', 'SUCURSAL'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => handleField('tipo', t)}
                className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                  form.tipo === t
                    ? t === 'AGENCIA'
                      ? 'bg-[#064e3b] text-white border-[#064e3b]'
                      : 'bg-cyan-500 text-white border-cyan-500'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                }`}
              >
                {t === 'AGENCIA' ? 'Agencia principal' : 'Sucursal'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Agencia padre (solo si es sucursal) */}
      {form.tipo === 'SUCURSAL' && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Agencia principal *</label>
          <select
            value={form.agenciaPadreId}
            onChange={e => handleField('agenciaPadreId', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/30"
          >
            <option value="">— Selecciona la agencia principal —</option>
            {principalesActivas.map(p => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Código *</label>
          <input
            value={form.codigo}
            onChange={e => handleField('codigo', e.target.value)}
            placeholder={form.tipo === 'SUCURSAL' ? 'HUA-SUC-01' : 'AYA-02'}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0]/30"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Teléfono</label>
          <input
            value={form.telefono}
            onChange={e => handleField('telefono', e.target.value)}
            placeholder="066-000000"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0]/30"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Nombre *</label>
        <input
          value={form.nombre}
          onChange={e => handleField('nombre', e.target.value)}
          placeholder={form.tipo === 'SUCURSAL' ? 'Sucursal Huamanga Terminal' : 'Sede Ayacucho'}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0]/30"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Ciudad *</label>
        <input
          value={form.ciudad}
          onChange={e => handleField('ciudad', e.target.value)}
          placeholder="Ayacucho"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0]/30"
        />
        <p className="text-[10px] text-gray-400 mt-0.5">
          Escríbela igual que en las rutas: conecta la agencia con viajes, tracking y descargas
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Dirección</label>
        <input
          value={form.direccion}
          onChange={e => handleField('direccion', e.target.value)}
          placeholder="Jr. Lima 245"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0]/30"
        />
      </div>

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
      {/* El RUC es único de la empresa (Configuración → Empresa); no se pide por agencia */}

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Encargado</label>
        <select
          value={form.encargadoId}
          onChange={e => handleField('encargadoId', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0070C0]/30"
        >
          <option value="">— Sin encargado —</option>
          {(usuarios || []).filter(u => u.rol !== 'CONDUCTOR').map(u => (
            <option key={u.id} value={u.id}>
              {u.nombres} {u.apellidos} ({u.rol})
            </option>
          ))}
        </select>
      </div>

      {/* Es sede principal — solo agencias principales */}
      {isSuperAdmin && form.tipo === 'AGENCIA' && (
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
        <Button variant="primary" loading={saving} onClick={onSubmit}>
          {submitLabel}
        </Button>
      </div>
    </div>
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  const modalTitle = modalNueva
    ? form.tipo === 'SUCURSAL' ? 'Nueva Sucursal' : 'Nueva Agencia'
    : `Editar — ${modalEditar?.nombre ?? ''}`

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Agencias</h1>
          <p className="text-sm text-gray-500">Estructura jerárquica de agencias y sucursales</p>
        </div>
        {puedeGestionar && (
          <Button icon={Plus} onClick={openNueva}>Nueva agencia</Button>
        )}
      </div>

      {/* Hierarchy list */}
      {lista.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Building2 size={40} className="text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">No hay agencias registradas</p>
        </div>
      ) : (
        <div className="space-y-4">
          {lista.map(a => (
            <AgenciaCard
              key={a.id}
              agencia={a}
              isSuperAdmin={isSuperAdmin}
              puedeGestionar={puedeGestionar}
              onEdit={openEditar}
              onToggleEstado={toggleEstado}
              onAgregarSucursal={openAgregarSucursal}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal
        open={modalNueva || !!modalEditar}
        onClose={() => { setModalNueva(false); setModalEditar(null) }}
        title={modalTitle}
        size="lg"
      >
        {/* Llamada como función (no <AgenciaForm/>): al estar definida dentro del
            componente, usarla como JSX crea un "tipo" nuevo en cada render y React
            remonta el formulario — los inputs perdían el foco en cada tecla */}
        {AgenciaForm({
          onSubmit: modalNueva ? crearAgencia : guardarAgencia,
          submitLabel: modalNueva ? 'Crear' : 'Guardar',
        })}
      </Modal>
    </div>
  )
}
