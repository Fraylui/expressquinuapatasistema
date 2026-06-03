'use client'
import React, { useState } from 'react'
import useSWR from 'swr'
import toast from 'react-hot-toast'
import {
  UserCheck, Search, Plus, Edit2, Phone, Mail,
  User, Building2, Trash2, Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { clientesService, type ClienteDTO } from '@/services/clientes.service'
import type { Cliente } from '@/types'

// ── Helpers ───────────────────────────────────────────────────────────────────
type TipoEntidad = 'PERSONA' | 'EMPRESA'

function initials(c: Cliente): string {
  if (c.tipo === 'EMPRESA' || c.tipoDoc === 'RUC') {
    return (c.razonSocial ?? c.nombres ?? '?')[0].toUpperCase()
  }
  const a = (c.apellidos ?? '?')[0]
  const n = (c.nombres  ?? '?')[0]
  return (a + n).toUpperCase()
}

// ── Form ──────────────────────────────────────────────────────────────────────
function ClienteForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Cliente
  onSave: (dto: ClienteDTO) => Promise<void>
  onCancel: () => void
}) {
  const esEmpresaInit = initial?.tipo === 'EMPRESA' || initial?.tipoDoc === 'RUC'
  const [tipoEntidad, setTipoEntidad] = useState<TipoEntidad>(esEmpresaInit ? 'EMPRESA' : 'PERSONA')
  const esEmpresa = tipoEntidad === 'EMPRESA'

  const [form, setForm] = useState({
    tipo:        esEmpresaInit ? 'EMPRESA' : 'PERSONA',
    razonSocial: initial?.razonSocial ?? '',
    nombres:     initial?.nombres     ?? '',
    apellidos:   initial?.apellidos   ?? '',
    tipoDoc:     initial?.tipoDoc     ?? 'DNI',
    numDoc:      initial?.numDoc      ?? '',
    dniContacto: initial?.dni         ?? '',
    telefono:    initial?.telefono    ?? '',
    email:       initial?.email       ?? '',
    direccion:   initial?.direccion   ?? '',
    fechaNac:    initial?.fechaNac    ?? '',
  })
  const [saving, setSaving] = useState(false)

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(v => ({ ...v, [k]: e.target.value }))

  const maxDocLen = form.tipoDoc === 'DNI' ? 8 : form.tipoDoc === 'RUC' ? 11 : 20

  const switchTipo = (t: TipoEntidad) => {
    setTipoEntidad(t)
    setForm(v => ({
      ...v,
      tipo:    t,
      tipoDoc: t === 'EMPRESA' ? 'RUC' : 'DNI',
      numDoc:  '',
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (esEmpresa) {
      if (!form.razonSocial.trim()) { toast.error('La razón social es obligatoria'); return }
      if (!form.numDoc.trim())      { toast.error('El RUC es obligatorio'); return }
      if (!/^(10|20)\d{9}$/.test(form.numDoc)) { toast.error('RUC inválido (debe empezar con 10 o 20)'); return }
    } else {
      if (!form.nombres.trim() || !form.apellidos.trim()) {
        toast.error('Nombres y apellidos son obligatorios'); return
      }
      if (!form.numDoc.trim()) { toast.error('El número de documento es obligatorio'); return }
    }

    const dto: ClienteDTO = {
      tipo:        form.tipo as 'PERSONA' | 'EMPRESA',
      razonSocial: esEmpresa ? form.razonSocial  : undefined,
      nombres:     form.nombres  || undefined,
      apellidos:   form.apellidos || undefined,
      tipoDoc:     esEmpresa ? 'RUC' : form.tipoDoc,
      numDoc:      form.numDoc,
      dniContacto: esEmpresa && form.dniContacto ? form.dniContacto : undefined,
      telefono:    form.telefono  || undefined,
      email:       form.email     || undefined,
      direccion:   form.direccion || undefined,
      fechaNac:    (!esEmpresa && form.fechaNac) ? form.fechaNac : undefined,
    }

    setSaving(true)
    try { await onSave(dto) }
    finally { setSaving(false) }
  }

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Tipo selector */}
      {!initial && (
        <div className="flex gap-2">
          {(['PERSONA', 'EMPRESA'] as TipoEntidad[]).map(t => (
            <button key={t} type="button" onClick={() => switchTipo(t)}
              className={`flex-1 py-2 text-sm rounded-lg border font-medium transition-colors ${
                tipoEntidad === t
                  ? 'bg-[#064e3b] text-white border-[#064e3b]'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-[#064e3b]'
              }`}>
              {t === 'EMPRESA' ? '🏢 Empresa' : '👤 Persona'}
            </button>
          ))}
        </div>
      )}

      {/* Empresa fields */}
      {esEmpresa && (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Razón Social *</label>
            <input value={form.razonSocial} onChange={set('razonSocial')}
              placeholder="Nombre legal de la empresa" className={inputCls} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">Tipo doc</label>
              <select value="RUC" disabled className={inputCls + ' bg-gray-50 text-gray-500'}>
                <option>RUC</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">RUC *</label>
              <input value={form.numDoc}
                onChange={e => setForm(v => ({ ...v, numDoc: e.target.value.replace(/\D/g, '').slice(0, 11) }))}
                placeholder="11 dígitos" maxLength={11}
                className={inputCls + ' font-mono'} />
              {form.numDoc.length === 11 && !/^(10|20)\d{9}$/.test(form.numDoc) && (
                <p className="text-[11px] text-red-500 mt-0.5">Debe empezar con 10 o 20</p>
              )}
            </div>
          </div>
          <p className="text-xs font-semibold text-gray-600 border-t border-gray-200 pt-3">Representante / Contacto</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nombres *</label>
              <input value={form.nombres} onChange={set('nombres')}
                placeholder="Nombres" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Apellidos *</label>
              <input value={form.apellidos} onChange={set('apellidos')}
                placeholder="Apellidos" className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">DNI representante</label>
              <input value={form.dniContacto}
                onChange={e => setForm(v => ({ ...v, dniContacto: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
                placeholder="8 dígitos" maxLength={8}
                className={inputCls + ' font-mono'} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input value={form.email} onChange={set('email')} type="email"
                placeholder="email@empresa.com" className={inputCls} />
            </div>
          </div>
        </>
      )}

      {/* Persona fields */}
      {!esEmpresa && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nombres *</label>
              <input value={form.nombres} onChange={set('nombres')} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Apellidos *</label>
              <input value={form.apellidos} onChange={set('apellidos')} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Tipo doc *</label>
              <select value={form.tipoDoc} onChange={set('tipoDoc')}
                className={inputCls + ' bg-white'}>
                {['DNI', 'CE', 'PASAPORTE'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Número *</label>
              <input value={form.numDoc}
                onChange={e => {
                  const raw = form.tipoDoc === 'DNI'
                    ? e.target.value.replace(/\D/g, '').slice(0, maxDocLen)
                    : e.target.value.slice(0, maxDocLen)
                  setForm(v => ({ ...v, numDoc: raw }))
                }}
                maxLength={maxDocLen}
                placeholder={form.tipoDoc === 'DNI' ? '8 dígitos' : 'N° documento'}
                className={inputCls + ' font-mono'} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input value={form.email} onChange={set('email')} type="email" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Fecha de nacimiento</label>
              <input value={form.fechaNac ?? ''} onChange={set('fechaNac')} type="date" className={inputCls} />
            </div>
          </div>
        </>
      )}

      {/* Common fields */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Teléfono</label>
          <input value={form.telefono} onChange={set('telefono')} type="tel"
            placeholder="9XXXXXXXX" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Dirección</label>
          <input value={form.direccion} onChange={set('direccion')}
            placeholder="Av. / Jr. ..." className={inputCls} />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" variant="primary" loading={saving}>Guardar</Button>
      </div>
    </form>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────
function ClienteCard({
  cliente,
  onEdit,
  onDelete,
}: {
  cliente: Cliente
  onEdit: () => void
  onDelete: () => void
}) {
  const esEmpresa = cliente.tipo === 'EMPRESA' || cliente.tipoDoc === 'RUC'
  const ini = initials(cliente)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${
            esEmpresa ? 'bg-amber-600' : 'bg-[#064e3b]'
          }`}>
            {esEmpresa ? <Building2 size={16} /> : ini}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {esEmpresa
                ? (cliente.razonSocial ?? cliente.nombres)
                : `${cliente.apellidos}, ${cliente.nombres}`}
            </p>
            {esEmpresa && (cliente.nombres || cliente.apellidos) && (
              <p className="text-xs text-gray-500 truncate">
                {cliente.apellidos ? `${cliente.apellidos} ${cliente.nombres}` : cliente.nombres}
              </p>
            )}
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">
                {cliente.tipoDoc}
              </span>
              <span className="text-xs font-mono text-gray-700">{cliente.numDoc}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-1 shrink-0 ml-2">
          <button onClick={onEdit}
            className="p-1.5 rounded-lg text-gray-400 hover:text-[#0070C0] hover:bg-blue-50 transition-colors">
            <Edit2 size={14} />
          </button>
          <button onClick={onDelete}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="mt-3 space-y-1">
        {cliente.telefono && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Phone size={11} /> {cliente.telefono}
          </div>
        )}
        {cliente.email && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Mail size={11} /> <span className="truncate">{cliente.email}</span>
          </div>
        )}
        {cliente.direccion && (
          <div className="flex items-center gap-2 text-xs text-gray-500 truncate">
            <span className="shrink-0">📍</span> {cliente.direccion}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Confirm delete dialog ─────────────────────────────────────────────────────
function ConfirmDelete({ cliente, onConfirm, onCancel, deleting }: {
  cliente: Cliente
  onConfirm: () => void
  onCancel: () => void
  deleting: boolean
}) {
  const nombre = cliente.tipo === 'EMPRESA' || cliente.tipoDoc === 'RUC'
    ? (cliente.razonSocial ?? cliente.nombres)
    : `${cliente.nombres} ${cliente.apellidos}`
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-700">
        ¿Eliminar a <span className="font-semibold">{nombre}</span>?
        <br />
        <span className="text-xs text-gray-500">Esta acción no se puede deshacer.</span>
      </p>
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <button onClick={onConfirm} disabled={deleting}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50">
          {deleting && <Loader2 size={14} className="animate-spin" />}
          Eliminar
        </button>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
type FiltroTipo = 'TODOS' | 'PERSONA' | 'EMPRESA'

export default function ClientesPage() {
  const [q, setQ]                       = useState('')
  const [filtroTipo, setFiltroTipo]     = useState<FiltroTipo>('TODOS')
  const [modalNuevo, setModalNuevo]     = useState(false)
  const [editando, setEditando]         = useState<Cliente | null>(null)
  const [eliminando, setEliminando]     = useState<Cliente | null>(null)
  const [deleting, setDeleting]         = useState(false)

  const { data, mutate } = useSWR(
    `/api/clientes${q ? `?q=${encodeURIComponent(q)}` : ''}`,
    { refreshInterval: 0 },
  )
  const todos: Cliente[] = data || []

  const clientes = filtroTipo === 'TODOS' ? todos : todos.filter(c => {
    const esEmpresa = c.tipo === 'EMPRESA' || c.tipoDoc === 'RUC'
    return filtroTipo === 'EMPRESA' ? esEmpresa : !esEmpresa
  })

  const handleCrear = async (dto: ClienteDTO) => {
    try {
      await clientesService.crear(dto)
      toast.success('Cliente registrado')
      setModalNuevo(false)
      mutate()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al registrar cliente')
    }
  }

  const handleActualizar = async (dto: ClienteDTO) => {
    if (!editando) return
    try {
      await clientesService.actualizar(editando.id, dto)
      toast.success('Cliente actualizado')
      setEditando(null)
      mutate()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al actualizar cliente')
    }
  }

  const handleEliminar = async () => {
    if (!eliminando) return
    setDeleting(true)
    try {
      await clientesService.eliminar(eliminando.id)
      toast.success('Cliente eliminado')
      setEliminando(null)
      mutate()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'No se puede eliminar — tiene registros asociados')
    } finally {
      setDeleting(false)
    }
  }

  const nPersonas  = todos.filter(c => c.tipo !== 'EMPRESA' && c.tipoDoc !== 'RUC').length
  const nEmpresas  = todos.filter(c => c.tipo === 'EMPRESA' || c.tipoDoc === 'RUC').length

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <UserCheck size={20} className="text-[#064e3b]" />
            Clientes
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestión de pasajeros, remitentes y empresas</p>
        </div>
        <Button variant="primary" icon={Plus} onClick={() => setModalNuevo(true)}>
          Nuevo cliente
        </Button>
      </div>

      {/* Buscador + filtros */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={e => setQ(e.target.value)}
            placeholder="Buscar por documento, nombre o apellido…"
            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>
        <div className="flex gap-1.5">
          {(['TODOS', 'PERSONA', 'EMPRESA'] as FiltroTipo[]).map(f => (
            <button key={f} onClick={() => setFiltroTipo(f)}
              className={`px-3 py-2 text-xs rounded-lg border font-medium transition-colors ${
                filtroTipo === f
                  ? 'bg-[#064e3b] text-white border-[#064e3b]'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-[#064e3b]'
              }`}>
              {f === 'TODOS' ? `Todos (${todos.length})` : f === 'PERSONA' ? `Personas (${nPersonas})` : `Empresas (${nEmpresas})`}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {clientes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <UserCheck size={40} className="text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">No se encontraron clientes</p>
          <button onClick={() => setModalNuevo(true)}
            className="mt-3 text-sm text-[#0070C0] hover:underline font-medium">
            Registrar primer cliente
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {clientes.map(c => (
            <ClienteCard key={c.id} cliente={c}
              onEdit={() => setEditando(c)}
              onDelete={() => setEliminando(c)} />
          ))}
        </div>
      )}

      {/* Modal nuevo */}
      <Modal open={modalNuevo} onClose={() => setModalNuevo(false)} title="Registrar cliente">
        <ClienteForm onSave={handleCrear} onCancel={() => setModalNuevo(false)} />
      </Modal>

      {/* Modal editar */}
      <Modal open={!!editando} onClose={() => setEditando(null)} title="Editar cliente">
        {editando && (
          <ClienteForm initial={editando} onSave={handleActualizar} onCancel={() => setEditando(null)} />
        )}
      </Modal>

      {/* Modal confirmar eliminación */}
      <Modal open={!!eliminando} onClose={() => setEliminando(null)} title="Confirmar eliminación">
        {eliminando && (
          <ConfirmDelete
            cliente={eliminando}
            onConfirm={handleEliminar}
            onCancel={() => setEliminando(null)}
            deleting={deleting}
          />
        )}
      </Modal>
    </div>
  )
}
