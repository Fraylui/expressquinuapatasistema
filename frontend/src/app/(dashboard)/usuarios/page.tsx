'use client'
import React, { useState, useEffect } from 'react'
import useSWR from 'swr'
import {
  Users, Shield, Plus, Pencil, X, Loader2, Check, Eye, EyeOff
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/stores/authStore'
import Link from 'next/link'
import api from '@/services/api'
import toast from 'react-hot-toast'
import type { Agencia } from '@/types'
import type { ApiResponse } from '@/types'

const ROL_LABEL: Record<string, string> = {
  SUPER_ADMIN:    'Super Admin',
  GERENTE:        'Gerente',
  ADMIN_AGENCIA:  'Jefe de Sucursal',
  OPERADOR:       'Operador',
  CONDUCTOR:      'Conductor',
}
const ROLES_DISPONIBLES = Object.keys(ROL_LABEL)

const ROL_COLOR: Record<string, string> = {
  SUPER_ADMIN:   'bg-red-100 text-red-700',
  GERENTE:       'bg-indigo-100 text-indigo-700',
  ADMIN_AGENCIA: 'bg-violet-100 text-violet-700',
  OPERADOR:      'bg-emerald-100 text-emerald-700',
  CONDUCTOR:     'bg-amber-100 text-amber-700',
}

interface UsuarioRow {
  id: number
  nombres: string
  apellidos: string
  email: string
  dni: string
  telefono?: string
  rol: string
  agenciaId: number
  agenciaNombre?: string
  activo: boolean
  ultimoAcceso?: string
  createdAt?: string
}

interface UsuarioForm {
  nombres: string; apellidos: string; email: string; dni: string
  telefono: string; password: string; rol: string; agenciaId: string
}

const FORM_INIT: UsuarioForm = {
  nombres: '', apellidos: '', email: '', dni: '',
  telefono: '', password: '', rol: 'OPERADOR', agenciaId: '',
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {error && <p className="text-[10px] text-red-500 mt-0.5">{error}</p>}
    </div>
  )
}

function UsuarioModal({
  modo, usuario, agencias, onClose, onSuccess, currentUser
}: {
  modo: 'crear' | 'editar'
  usuario?: UsuarioRow
  agencias: Agencia[]
  onClose: () => void
  onSuccess: () => void
  currentUser?: { rol: string; agenciaId?: number } | null
}) {
  const isAdminAgencia = currentUser?.rol === 'ADMIN_AGENCIA'

  // Roles que este usuario puede asignar (no puede crear roles superiores al propio)
  const rolesAsignables = ROLES_DISPONIBLES.filter(r => {
    if (r === 'SUPER_ADMIN') return false
    if (isAdminAgencia && (r === 'GERENTE' || r === 'ADMIN_AGENCIA')) return false
    return true
  })

  // Agencias visibles: ADMIN_AGENCIA solo ve la suya
  const agenciasVisibles = isAdminAgencia
    ? agencias.filter(a => a.id === currentUser?.agenciaId)
    : agencias

  const agenciaIdInicial = modo === 'editar' && usuario
    ? String(usuario.agenciaId)
    : isAdminAgencia && currentUser?.agenciaId
      ? String(currentUser.agenciaId)
      : ''

  const [form, setForm] = useState<UsuarioForm>(() =>
    modo === 'editar' && usuario
      ? { ...FORM_INIT, ...usuario, agenciaId: String(usuario.agenciaId), password: '' }
      : { ...FORM_INIT, agenciaId: agenciaIdInicial }
  )
  const [errors, setErrors] = useState<Partial<UsuarioForm>>({})
  const [guardando, setGuardando] = useState(false)
  const [showPass, setShowPass] = useState(false)

  const sf = (k: keyof UsuarioForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm(v => ({ ...v, [k]: e.target.value }))
      setErrors(v => ({ ...v, [k]: undefined }))
    }

  const validate = (): boolean => {
    const e: Partial<UsuarioForm> = {}
    if (!form.nombres.trim()) e.nombres = 'Obligatorio'
    if (!form.apellidos.trim()) e.apellidos = 'Obligatorio'
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Email inválido'
    if (!/^\d{8}$/.test(form.dni)) e.dni = '8 dígitos numéricos'
    if (form.telefono && !/^9\d{8}$/.test(form.telefono)) e.telefono = '9 dígitos, empieza en 9'
    if (modo === 'crear' && !form.telefono.trim()) e.telefono = 'Obligatorio'
    if (modo === 'crear') {
      if (!form.telefono.trim()) e.telefono = 'Obligatorio'
      if (!form.password || form.password.length < 8) e.password = 'Mínimo 8 caracteres'
    } else if (form.password && form.password.length < 8) {
      e.password = 'Mínimo 8 caracteres (dejar vacío para no cambiar)'
    }
    if (!form.rol) e.rol = 'Obligatorio'
    if (!form.agenciaId) e.agenciaId = 'Obligatorio'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const guardar = async () => {
    if (!validate()) return
    setGuardando(true)
    try {
      const payload: any = {
        nombres: form.nombres, apellidos: form.apellidos,
        email: form.email, dni: form.dni, telefono: form.telefono,
        rol: form.rol, agenciaId: parseInt(form.agenciaId),
      }
      if (modo === 'crear') {
        payload.password = form.password
        await api.post('/api/usuarios', payload)
        toast.success('Usuario creado. Se enviaron credenciales por email si está configurado.')
      } else {
        if (form.password) payload.nuevaPassword = form.password
        await api.put(`/api/usuarios/${usuario!.id}`, payload)
        toast.success('Usuario actualizado')
      }
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Error al guardar usuario')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Users size={16} className="text-[#064e3b]" />
            {modo === 'crear' ? 'Nuevo usuario' : 'Editar usuario'}
          </h3>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-3 flex-1">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombres *" error={errors.nombres}>
              <input value={form.nombres} onChange={sf('nombres')} placeholder="Juan"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </Field>
            <Field label="Apellidos *" error={errors.apellidos}>
              <input value={form.apellidos} onChange={sf('apellidos')} placeholder="Quispe"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </Field>
          </div>

          <Field label="Email *" error={errors.email}>
            <input type="email" value={form.email} onChange={sf('email')} placeholder="usuario@ejemplo.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="DNI (8 dígitos) *" error={errors.dni}>
              <input value={form.dni} onChange={e => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 8)
                setForm(f => ({ ...f, dni: v })); setErrors(er => ({ ...er, dni: undefined }))
              }} placeholder="12345678" maxLength={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500" />
            </Field>
            <Field label={`Teléfono (9 dígitos)${modo === 'crear' ? ' *' : ''}`} error={errors.telefono}>
              <input value={form.telefono} onChange={e => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 9)
                setForm(f => ({ ...f, telefono: v })); setErrors(er => ({ ...er, telefono: undefined }))
              }} placeholder="9XXXXXXXX" maxLength={9}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500" />
            </Field>
          </div>

          <Field label={modo === 'crear' ? 'Contraseña temporal *' : 'Nueva contraseña (dejar vacío para no cambiar)'} error={errors.password}>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} value={form.password} onChange={sf('password')}
                placeholder={modo === 'crear' ? 'Mínimo 8 caracteres' : '••••••••'}
                className="w-full px-3 py-2 pr-9 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              <button type="button" onClick={() => setShowPass(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Rol *" error={errors.rol}>
              <select value={form.rol} onChange={sf('rol')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500">
                <option value="">Seleccionar...</option>
                {rolesAsignables.map(r => (
                  <option key={r} value={r}>{ROL_LABEL[r]}</option>
                ))}
              </select>
            </Field>
            <Field label="Agencia *" error={errors.agenciaId}>
              <select value={form.agenciaId} onChange={sf('agenciaId')}
                disabled={isAdminAgencia}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed">
                <option value="">Seleccionar...</option>
                {agenciasVisibles.map(a => <option key={a.id} value={a.id}>{a.nombre} — {a.ciudad}</option>)}
              </select>
              {isAdminAgencia && (
                <p className="text-[10px] text-gray-400 mt-0.5">Los usuarios se crean en tu agencia</p>
              )}
            </Field>
          </div>

          {modo === 'crear' && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
              Se enviará un email con las credenciales al nuevo usuario si el servidor de correo está configurado.
            </div>
          )}
        </div>

        <div className="flex gap-3 p-5 border-t shrink-0">
          <button onClick={onClose}
            className="flex-1 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={guardar} disabled={guardando}
            className="flex-1 py-2 text-sm bg-[#064e3b] text-white rounded-lg hover:bg-[#16294d] disabled:opacity-50 flex items-center justify-center gap-2">
            {guardando && <Loader2 size={14} className="animate-spin" />}
            <Check size={14} />
            {modo === 'crear' ? 'Crear usuario' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────────
export default function UsuariosPage() {
  const { user: me } = useAuthStore()
  const { data, mutate } = useSWR('/api/usuarios')
  const todosUsuarios: UsuarioRow[] = data?.data ?? data ?? []

  const [agencias, setAgencias] = useState<Agencia[]>([])
  const [filtroRol, setFiltroRol] = useState('')
  const [filtroAgencia, setFiltroAgencia] = useState('')
  const [modal, setModal] = useState<{ modo: 'crear' | 'editar'; usuario?: UsuarioRow } | null>(null)

  const esSuperAdmin     = me?.rol === 'SUPER_ADMIN'
  const esGerente        = me?.rol === 'GERENTE' || esSuperAdmin
  const esAdminAgencia   = me?.rol === 'ADMIN_AGENCIA'
  const puedeGestionar   = esGerente || esAdminAgencia

  useEffect(() => {
    api.get<any, any>('/api/agencias').then(r => setAgencias(r.data ?? []))
  }, [])

  const usuarios = todosUsuarios.filter(u => {
    if (filtroRol && u.rol !== filtroRol) return false
    if (filtroAgencia && String(u.agenciaId) !== filtroAgencia) return false
    return true
  })

  const toggleEstado = async (u: UsuarioRow) => {
    if (u.rol === 'SUPER_ADMIN') { toast.error('No se puede desactivar al Super Administrador'); return }
    try {
      await api.patch(`/api/usuarios/${u.id}/estado`, { activo: !u.activo })
      toast.success(`Usuario ${u.activo ? 'desactivado' : 'activado'}`)
      mutate()
    } catch {
      toast.error('Error al cambiar estado')
    }
  }

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Users size={20} className="text-[#064e3b]" />
            Gestión de usuarios
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {todosUsuarios.length} usuarios registrados
          </p>
        </div>
        {puedeGestionar && (
          <button
            onClick={() => setModal({ modo: 'crear' })}
            className="flex items-center gap-2 px-4 py-2 bg-[#064e3b] text-white text-sm rounded-lg hover:bg-[#16294d] transition-colors"
          >
            <Plus size={16} /> Nuevo usuario
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Rol</label>
          <select value={filtroRol} onChange={e => setFiltroRol(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500">
            <option value="">Todos los roles</option>
            {ROLES_DISPONIBLES.map(r => <option key={r} value={r}>{ROL_LABEL[r]}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Agencia</label>
          <select value={filtroAgencia} onChange={e => setFiltroAgencia(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500">
            <option value="">Todas las agencias</option>
            {agencias.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
        </div>
        {(filtroRol || filtroAgencia) && (
          <button onClick={() => { setFiltroRol(''); setFiltroAgencia('') }}
            className="px-3 py-2 text-xs text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50">
            Limpiar filtros
          </button>
        )}
        <div className="ml-auto text-xs text-gray-400 self-center">
          Mostrando {usuarios.length} de {todosUsuarios.length}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Usuario</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rol</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">DNI</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Agencia</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Último acceso</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {usuarios.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-gray-400 text-sm">
                    No hay usuarios
                  </td>
                </tr>
              )}
              {usuarios.map(u => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#064e3b] rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {(u.nombres?.[0] ?? '?').toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{u.nombres} {u.apellidos}</p>
                        <p className="text-xs text-gray-400">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${ROL_COLOR[u.rol] ?? 'bg-gray-100 text-gray-600'}`}>
                      {ROL_LABEL[u.rol] ?? u.rol}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-600 text-xs">{u.dni}</td>
                  <td className="px-4 py-3 text-xs text-gray-700">{u.agenciaNombre ?? `#${u.agenciaId}`}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {u.ultimoAcceso ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge estado={u.activo ? 'DISPONIBLE' : 'CANCELADO'} label={u.activo ? 'Activo' : 'Inactivo'} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {puedeGestionar && u.rol !== 'SUPER_ADMIN' && (
                        <button
                          onClick={() => setModal({ modo: 'editar', usuario: u })}
                          title="Editar usuario"
                          className="p-1.5 rounded text-gray-400 hover:text-[#064e3b] hover:bg-blue-50"
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                      {u.rol !== 'SUPER_ADMIN' && (
                        <Button size="sm" variant={u.activo ? 'danger' : 'secondary'} onClick={() => toggleEstado(u)}>
                          {u.activo ? 'Desactivar' : 'Activar'}
                        </Button>
                      )}
                      {esSuperAdmin && u.rol !== 'SUPER_ADMIN' && (
                        <Link href={`/usuarios/${u.id}/modulos`}>
                          <Button size="sm" variant="secondary" icon={Shield}>Módulos</Button>
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <UsuarioModal
          modo={modal.modo}
          usuario={modal.usuario}
          agencias={agencias}
          onClose={() => setModal(null)}
          onSuccess={() => mutate()}
          currentUser={me ?? undefined}
        />
      )}
    </div>
  )
}
