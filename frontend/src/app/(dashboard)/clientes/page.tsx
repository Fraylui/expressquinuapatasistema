'use client'
import React, { useState } from 'react'
import useSWR from 'swr'
import toast from 'react-hot-toast'
import { UserCheck, Search, Plus, Edit2, Phone, Mail, User } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { clientesService, type ClienteDTO } from '@/services/clientes.service'
import type { Cliente } from '@/types'

const TIPO_DOC_OPTIONS = ['DNI', 'CE', 'PASAPORTE', 'RUC']

function ClienteForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<ClienteDTO>
  onSave: (dto: ClienteDTO) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState<ClienteDTO>({
    nombres:   initial?.nombres   ?? '',
    apellidos: initial?.apellidos ?? '',
    tipoDoc:   initial?.tipoDoc   ?? 'DNI',
    numDoc:    initial?.numDoc    ?? '',
    telefono:  initial?.telefono  ?? '',
    email:     initial?.email     ?? '',
    fechaNac:  initial?.fechaNac  ?? '',
  })
  const [saving, setSaving] = useState(false)

  const set = (k: keyof ClienteDTO) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(v => ({ ...v, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave(form)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Nombres *</label>
          <input value={form.nombres} onChange={set('nombres')} required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Apellidos *</label>
          <input value={form.apellidos} onChange={set('apellidos')} required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Tipo documento *</label>
          <select value={form.tipoDoc} onChange={set('tipoDoc')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white">
            {TIPO_DOC_OPTIONS.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Número de {form.tipoDoc} *
          </label>
          <input value={form.numDoc} onChange={set('numDoc')} required
            maxLength={form.tipoDoc === 'DNI' ? 8 : form.tipoDoc === 'RUC' ? 11 : 20}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Teléfono</label>
          <input value={form.telefono} onChange={set('telefono')} type="tel"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Correo electrónico</label>
          <input value={form.email} onChange={set('email')} type="email"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Fecha de nacimiento</label>
        <input value={form.fechaNac} onChange={set('fechaNac')} type="date"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" variant="primary" loading={saving}>Guardar</Button>
      </div>
    </form>
  )
}

function ClienteCard({ cliente, onEdit }: { cliente: Cliente; onEdit: () => void }) {
  const initials = [cliente.nombres[0], cliente.apellidos[0]].join('').toUpperCase()
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#1F3864] flex items-center justify-center text-white text-sm font-bold shrink-0">
            {initials}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {cliente.apellidos}, {cliente.nombres}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">
                {cliente.tipoDoc}
              </span>
              <span className="text-xs font-mono text-gray-700">{cliente.numDoc}</span>
            </div>
          </div>
        </div>
        <button
          onClick={onEdit}
          className="p-1.5 rounded-lg text-gray-400 hover:text-[#0070C0] hover:bg-blue-50 transition-colors"
        >
          <Edit2 size={14} />
        </button>
      </div>

      <div className="mt-3 space-y-1">
        {cliente.telefono && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Phone size={11} />
            {cliente.telefono}
          </div>
        )}
        {cliente.email && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Mail size={11} />
            {cliente.email}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ClientesPage() {
  const [q, setQ]                   = useState('')
  const [modalNuevo, setModalNuevo] = useState(false)
  const [editando, setEditando]     = useState<Cliente | null>(null)

  const { data, mutate } = useSWR(
    `/api/clientes${q ? `?q=${encodeURIComponent(q)}` : ''}`,
    { refreshInterval: 0 }
  )
  const clientes: Cliente[] = data || []

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

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <UserCheck size={20} className="text-[#1F3864]" />
            Clientes
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestión de pasajeros y remitentes registrados</p>
        </div>
        <Button variant="primary" icon={Plus} onClick={() => setModalNuevo(true)}>
          Nuevo cliente
        </Button>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar por DNI, nombre o apellido…"
          className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Stats */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <User size={12} />
        <span>{clientes.length} {clientes.length === 1 ? 'cliente' : 'clientes'} encontrados</span>
      </div>

      {/* Grid */}
      {clientes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <UserCheck size={40} className="text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">No se encontraron clientes</p>
          <button
            onClick={() => setModalNuevo(true)}
            className="mt-3 text-sm text-[#0070C0] hover:underline font-medium"
          >
            Registrar primer cliente
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {clientes.map(c => (
            <ClienteCard key={c.id} cliente={c} onEdit={() => setEditando(c)} />
          ))}
        </div>
      )}

      {/* Modal nuevo cliente */}
      <Modal open={modalNuevo} onClose={() => setModalNuevo(false)} title="Registrar cliente">
        <ClienteForm onSave={handleCrear} onCancel={() => setModalNuevo(false)} />
      </Modal>

      {/* Modal editar cliente */}
      <Modal open={!!editando} onClose={() => setEditando(null)} title="Editar cliente">
        {editando && (
          <ClienteForm
            initial={editando}
            onSave={handleActualizar}
            onCancel={() => setEditando(null)}
          />
        )}
      </Modal>
    </div>
  )
}
