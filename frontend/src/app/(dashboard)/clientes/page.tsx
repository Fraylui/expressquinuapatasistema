'use client'
import React, { useState, useMemo, useCallback } from 'react'
import useSWR from 'swr'
import toast from 'react-hot-toast'
import { format, parseISO, isThisMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Users, Search, Plus, Edit2, Trash2, Loader2,
  Building2, User, Phone, Mail, MapPin, Calendar,
  LayoutGrid, List, X, ChevronUp, ChevronDown,
  FileText, BadgeCheck, SlidersHorizontal,
} from 'lucide-react'
import { clientesService, type ClienteDTO } from '@/services/clientes.service'
import type { Cliente } from '@/types'

// ── Avatar ────────────────────────────────────────────────────────────────────
const AVATAR_PALETTES = [
  'from-emerald-500 to-teal-600',
  'from-blue-500 to-indigo-600',
  'from-violet-500 to-purple-600',
  'from-orange-500 to-amber-600',
  'from-pink-500 to-rose-600',
  'from-cyan-500 to-sky-600',
  'from-lime-500 to-green-600',
  'from-red-500 to-rose-600',
]

function avatarGradient(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return AVATAR_PALETTES[Math.abs(h) % AVATAR_PALETTES.length]
}

function getInitials(c: Cliente) {
  if (c.tipo === 'EMPRESA' || c.tipoDoc === 'RUC') {
    const name = c.razonSocial ?? c.nombres ?? '?'
    return name.slice(0, 2).toUpperCase()
  }
  return ((c.apellidos?.[0] ?? '') + (c.nombres?.[0] ?? '')).toUpperCase() || '??'
}

function getDisplayName(c: Cliente) {
  if (c.tipo === 'EMPRESA' || c.tipoDoc === 'RUC')
    return c.razonSocial ?? c.nombres ?? '—'
  return `${c.apellidos ?? ''}, ${c.nombres ?? ''}`
}

function getContactName(c: Cliente) {
  if (c.tipo !== 'EMPRESA' && c.tipoDoc !== 'RUC') return null
  if (!c.nombres || c.nombres === c.razonSocial) return null
  return `${c.apellidos ? c.apellidos + ' ' : ''}${c.nombres}`
}

function Avatar({ c, size = 'md' }: { c: Cliente; size?: 'sm' | 'md' | 'lg' }) {
  const esEmpresa = c.tipo === 'EMPRESA' || c.tipoDoc === 'RUC'
  const gradient = avatarGradient(getDisplayName(c))
  const sz = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-12 h-12 text-base' : 'w-10 h-10 text-sm'
  return (
    <div className={`${sz} rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold shrink-0`}>
      {esEmpresa ? <Building2 size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} /> : getInitials(c)}
    </div>
  )
}

// ── Badges ────────────────────────────────────────────────────────────────────
function TipoBadge({ c }: { c: Cliente }) {
  const esEmpresa = c.tipo === 'EMPRESA' || c.tipoDoc === 'RUC'
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
      esEmpresa
        ? 'bg-amber-100 text-amber-700'
        : 'bg-emerald-100 text-emerald-700'
    }`}>
      {esEmpresa ? <Building2 size={9} /> : <User size={9} />}
      {esEmpresa ? 'Empresa' : 'Persona'}
    </span>
  )
}

function DocBadge({ c }: { c: Cliente }) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-mono font-semibold">
      <FileText size={9} />
      {c.tipoDoc} {c.numDoc}
    </span>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color }: {
  label: string; value: number; icon: React.ReactNode
  color: 'green' | 'blue' | 'amber' | 'purple'
}) {
  const c = {
    green:  'bg-emerald-50 border-emerald-200 text-emerald-700',
    blue:   'bg-blue-50 border-blue-200 text-blue-700',
    amber:  'bg-amber-50 border-amber-200 text-amber-700',
    purple: 'bg-violet-50 border-violet-200 text-violet-700',
  }[color]
  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${c}`}>
      <div className="opacity-70">{icon}</div>
      <div>
        <p className="text-xl font-bold leading-none">{value}</p>
        <p className="text-xs opacity-70 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────
function ClienteCard({ c, onEdit, onDelete }: {
  c: Cliente; onEdit: () => void; onDelete: () => void
}) {
  const contactName = getContactName(c)
  const fecha = c.fechaRegistro ?? c.createdAt

  return (
    <div className="group bg-white rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all duration-200 overflow-hidden">
      {/* Top strip color */}
      <div className={`h-1 bg-gradient-to-r ${avatarGradient(getDisplayName(c))}`} />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Avatar c={c} size="lg" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm leading-snug truncate">
              {getDisplayName(c)}
            </p>
            {contactName && (
              <p className="text-xs text-gray-500 truncate mt-0.5">{contactName}</p>
            )}
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <TipoBadge c={c} />
              <DocBadge c={c} />
            </div>
          </div>
          {/* Actions — aparecen en hover */}
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button onClick={onEdit}
              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
              <Edit2 size={13} />
            </button>
            <button onClick={onDelete}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Contacto */}
        {(c.telefono || c.email || c.direccion) && (
          <div className="mt-3 space-y-1.5 border-t border-gray-100 pt-3">
            {c.telefono && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Phone size={11} className="text-gray-400 shrink-0" />
                <span>{c.telefono}</span>
              </div>
            )}
            {c.email && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Mail size={11} className="text-gray-400 shrink-0" />
                <span className="truncate">{c.email}</span>
              </div>
            )}
            {c.direccion && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <MapPin size={11} className="text-gray-400 shrink-0" />
                <span className="truncate">{c.direccion}</span>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {fecha && (
          <div className="mt-3 pt-2 border-t border-gray-100 flex items-center gap-1 text-[10px] text-gray-400">
            <Calendar size={9} />
            Registrado {format(parseISO(fecha), "d 'de' MMM yyyy", { locale: es })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Table row ─────────────────────────────────────────────────────────────────
type SortKey = 'nombre' | 'tipoDoc' | 'tipo' | 'fecha'
type SortDir = 'asc' | 'desc'

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronUp size={12} className="opacity-20" />
  return sortDir === 'asc'
    ? <ChevronUp size={12} className="text-[#064e3b]" />
    : <ChevronDown size={12} className="text-[#064e3b]" />
}

function ClienteTable({ clientes, onEdit, onDelete, sortKey, sortDir, onSort }: {
  clientes: Cliente[]
  onEdit: (c: Cliente) => void
  onDelete: (c: Cliente) => void
  sortKey: SortKey
  sortDir: SortDir
  onSort: (k: SortKey) => void
}) {
  const thCls = 'px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:text-gray-700'
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className={thCls} onClick={() => onSort('nombre')}>
                <span className="flex items-center gap-1">Nombre / Empresa <SortIcon col="nombre" sortKey={sortKey} sortDir={sortDir} /></span>
              </th>
              <th className={thCls} onClick={() => onSort('tipo')}>
                <span className="flex items-center gap-1">Tipo <SortIcon col="tipo" sortKey={sortKey} sortDir={sortDir} /></span>
              </th>
              <th className={thCls} onClick={() => onSort('tipoDoc')}>
                <span className="flex items-center gap-1">Documento <SortIcon col="tipoDoc" sortKey={sortKey} sortDir={sortDir} /></span>
              </th>
              <th className={thCls}>Teléfono</th>
              <th className={thCls}>Email</th>
              <th className={thCls} onClick={() => onSort('fecha')}>
                <span className="flex items-center gap-1">Registro <SortIcon col="fecha" sortKey={sortKey} sortDir={sortDir} /></span>
              </th>
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {clientes.map(c => {
              const fecha = c.fechaRegistro ?? c.createdAt
              return (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar c={c} size="sm" />
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate max-w-[200px]">{getDisplayName(c)}</p>
                        {getContactName(c) && (
                          <p className="text-xs text-gray-400 truncate">{getContactName(c)}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><TipoBadge c={c} /></td>
                  <td className="px-4 py-3"><DocBadge c={c} /></td>
                  <td className="px-4 py-3 text-xs text-gray-600">{c.telefono ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-[180px] truncate">
                    {c.email ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                    {fecha ? format(parseISO(fecha), 'dd/MM/yyyy') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => onEdit(c)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => onDelete(c)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 text-xs text-gray-400">
        {clientes.length} cliente{clientes.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}

// ── Form ──────────────────────────────────────────────────────────────────────
type TipoEntidad = 'PERSONA' | 'EMPRESA'

function ClienteForm({ initial, onSave, onCancel }: {
  initial?: Cliente
  onSave: (dto: ClienteDTO) => Promise<void>
  onCancel: () => void
}) {
  const esEmpresaInit = initial?.tipo === 'EMPRESA' || initial?.tipoDoc === 'RUC'
  const [tipoEntidad, setTipoEntidad] = useState<TipoEntidad>(esEmpresaInit ? 'EMPRESA' : 'PERSONA')
  const esEmpresa = tipoEntidad === 'EMPRESA'
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    tipo:        esEmpresaInit ? 'EMPRESA' : 'PERSONA',
    razonSocial: initial?.razonSocial ?? '',
    nombres:     initial?.nombres ?? '',
    apellidos:   initial?.apellidos ?? '',
    tipoDoc:     initial?.tipoDoc ?? 'DNI',
    numDoc:      initial?.numDoc ?? '',
    dniContacto: initial?.dni ?? '',
    telefono:    initial?.telefono ?? '',
    email:       initial?.email ?? '',
    direccion:   initial?.direccion ?? '',
    fechaNac:    initial?.fechaNac ?? '',
  })

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(v => ({ ...v, [k]: e.target.value }))

  const maxDocLen = form.tipoDoc === 'DNI' ? 8 : form.tipoDoc === 'RUC' ? 11 : 20

  const switchTipo = (t: TipoEntidad) => {
    setTipoEntidad(t)
    setForm(v => ({ ...v, tipo: t, tipoDoc: t === 'EMPRESA' ? 'RUC' : 'DNI', numDoc: '' }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (esEmpresa) {
      if (!form.razonSocial.trim()) { toast.error('La razón social es obligatoria'); return }
      if (!form.numDoc.trim()) { toast.error('El RUC es obligatorio'); return }
      if (!/^(10|20)\d{9}$/.test(form.numDoc)) { toast.error('RUC inválido (debe empezar con 10 o 20)'); return }
    } else {
      if (!form.nombres.trim() || !form.apellidos.trim()) { toast.error('Nombres y apellidos son obligatorios'); return }
      if (!form.numDoc.trim()) { toast.error('El número de documento es obligatorio'); return }
    }
    const dto: ClienteDTO = {
      tipo:        form.tipo as 'PERSONA' | 'EMPRESA',
      razonSocial: esEmpresa ? form.razonSocial : undefined,
      nombres:     form.nombres || undefined,
      apellidos:   form.apellidos || undefined,
      tipoDoc:     esEmpresa ? 'RUC' : form.tipoDoc,
      numDoc:      form.numDoc,
      dniContacto: esEmpresa && form.dniContacto ? form.dniContacto : undefined,
      telefono:    form.telefono || undefined,
      email:       form.email || undefined,
      direccion:   form.direccion || undefined,
      fechaNac:    (!esEmpresa && form.fechaNac) ? form.fechaNac : undefined,
    }
    setSaving(true)
    try { await onSave(dto) }
    finally { setSaving(false) }
  }

  const inp = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#064e3b]/30 focus:border-[#064e3b] bg-white transition-colors placeholder:text-gray-400'
  const inpMono = inp + ' font-mono tracking-wide'

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Tipo toggle */}
      {!initial && (
        <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
          {(['PERSONA', 'EMPRESA'] as TipoEntidad[]).map(t => (
            <button key={t} type="button" onClick={() => switchTipo(t)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm rounded-lg font-medium transition-all ${
                tipoEntidad === t
                  ? 'bg-white text-[#064e3b] shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}>
              {t === 'EMPRESA' ? <Building2 size={14} /> : <User size={14} />}
              {t === 'EMPRESA' ? 'Empresa' : 'Persona natural'}
            </button>
          ))}
        </div>
      )}

      {/* Empresa */}
      {esEmpresa && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Razón Social *</label>
            <input value={form.razonSocial} onChange={set('razonSocial')}
              placeholder="Nombre legal de la empresa" className={inp} />
          </div>
          <div className="flex gap-3">
            <div className="w-24 shrink-0">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Tipo</label>
              <input value="RUC" disabled className={inp + ' bg-gray-50 text-gray-400 cursor-default'} />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">RUC *</label>
              <input value={form.numDoc}
                onChange={e => setForm(v => ({ ...v, numDoc: e.target.value.replace(/\D/g, '').slice(0, 11) }))}
                placeholder="20XXXXXXXXX" maxLength={11} className={inpMono} />
              {form.numDoc.length === 11 && !/^(10|20)\d{9}$/.test(form.numDoc) && (
                <p className="text-xs text-red-500 mt-1">Debe comenzar con 10 o 20</p>
              )}
            </div>
          </div>
          <div className="pt-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <BadgeCheck size={12} /> Representante / Contacto
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nombres *</label>
                <input value={form.nombres} onChange={set('nombres')} placeholder="Nombres" className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Apellidos *</label>
                <input value={form.apellidos} onChange={set('apellidos')} placeholder="Apellidos" className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">DNI representante</label>
                <input value={form.dniContacto}
                  onChange={e => setForm(v => ({ ...v, dniContacto: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
                  placeholder="12345678" maxLength={8} className={inpMono} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email</label>
                <input value={form.email} onChange={set('email')} type="email"
                  placeholder="contacto@empresa.com" className={inp} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Persona */}
      {!esEmpresa && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Apellidos *</label>
              <input value={form.apellidos} onChange={set('apellidos')}
                placeholder="Primer apellido" className={inp} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nombres *</label>
              <input value={form.nombres} onChange={set('nombres')}
                placeholder="Nombres completos" className={inp} />
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-32 shrink-0">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Tipo doc *</label>
              <select value={form.tipoDoc} onChange={set('tipoDoc')} className={inp + ' bg-white'}>
                {['DNI', 'CE', 'PASAPORTE'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Número *</label>
              <input value={form.numDoc}
                onChange={e => setForm(v => ({
                  ...v,
                  numDoc: form.tipoDoc === 'DNI'
                    ? e.target.value.replace(/\D/g, '').slice(0, maxDocLen)
                    : e.target.value.slice(0, maxDocLen),
                }))}
                maxLength={maxDocLen}
                placeholder={form.tipoDoc === 'DNI' ? '12345678' : 'N° documento'}
                className={inpMono} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email</label>
              <input value={form.email} onChange={set('email')} type="email"
                placeholder="nombre@correo.com" className={inp} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Fecha de nacimiento</label>
              <input value={form.fechaNac ?? ''} onChange={set('fechaNac')} type="date" className={inp} />
            </div>
          </div>
        </div>
      )}

      {/* Campos comunes */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
            <Phone size={10} className="inline mr-1" />Teléfono
          </label>
          <input value={form.telefono} onChange={set('telefono')} type="tel"
            placeholder="9XXXXXXXX" className={inpMono} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
            <MapPin size={10} className="inline mr-1" />Dirección
          </label>
          <input value={form.direccion} onChange={set('direccion')}
            placeholder="Av. / Jr. / Ca. ..." className={inp} />
        </div>
      </div>

      {/* Botones */}
      <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
          Cancelar
        </button>
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 px-5 py-2 bg-[#064e3b] text-white text-sm rounded-xl hover:bg-[#065f46] disabled:opacity-50 font-semibold transition-colors">
          {saving ? <Loader2 size={14} className="animate-spin" /> : null}
          {saving ? 'Guardando...' : (initial ? 'Actualizar' : 'Registrar cliente')}
        </button>
      </div>
    </form>
  )
}

// ── Confirm delete ────────────────────────────────────────────────────────────
function ConfirmDelete({ cliente, onConfirm, onCancel, deleting }: {
  cliente: Cliente; onConfirm: () => void; onCancel: () => void; deleting: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
        <Avatar c={cliente} size="md" />
        <div>
          <p className="font-semibold text-gray-900 text-sm">{getDisplayName(cliente)}</p>
          <p className="text-xs text-gray-500 mt-0.5">{cliente.tipoDoc} {cliente.numDoc}</p>
        </div>
      </div>
      <p className="text-sm text-gray-600">
        ¿Eliminar este cliente? Esta acción <strong>no se puede deshacer</strong>.
        Si tiene pasajes o encomiendas asociadas, no podrá eliminarlo.
      </p>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel}
          className="px-4 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
          Cancelar
        </button>
        <button onClick={onConfirm} disabled={deleting}
          className="flex items-center gap-2 px-5 py-2 bg-red-600 text-white text-sm rounded-xl hover:bg-red-700 disabled:opacity-50 font-semibold transition-colors">
          {deleting && <Loader2 size={14} className="animate-spin" />}
          Eliminar cliente
        </button>
      </div>
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">{title}</h2>
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
type ViewMode = 'grid' | 'table'
type FiltroTipo = 'TODOS' | 'PERSONA' | 'EMPRESA'

export default function ClientesPage() {
  const [q, setQ]                     = useState('')
  const [filtroTipo, setFiltroTipo]   = useState<FiltroTipo>('TODOS')
  const [viewMode, setViewMode]       = useState<ViewMode>('grid')
  const [sortKey, setSortKey]         = useState<SortKey>('nombre')
  const [sortDir, setSortDir]         = useState<SortDir>('asc')
  const [modalNuevo, setModalNuevo]   = useState(false)
  const [editando, setEditando]       = useState<Cliente | null>(null)
  const [eliminando, setEliminando]   = useState<Cliente | null>(null)
  const [deleting, setDeleting]       = useState(false)

  const { data, isLoading, mutate } = useSWR<{ data: Cliente[] }>(
    `/api/clientes${q ? `?q=${encodeURIComponent(q)}` : ''}`,
    { refreshInterval: 0 },
  )
  const todos: Cliente[] = (data as any)?.data ?? (Array.isArray(data) ? data : [])

  const nPersonas    = todos.filter(c => c.tipo !== 'EMPRESA' && c.tipoDoc !== 'RUC').length
  const nEmpresas    = todos.filter(c => c.tipo === 'EMPRESA' || c.tipoDoc === 'RUC').length
  const nEsteMes     = todos.filter(c => {
    const f = c.fechaRegistro ?? c.createdAt
    return f ? isThisMonth(parseISO(f)) : false
  }).length

  const handleSort = useCallback((key: SortKey) => {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }, [sortKey])

  const clientes = useMemo(() => {
    let list = filtroTipo === 'TODOS' ? todos : todos.filter(c => {
      const esEmpresa = c.tipo === 'EMPRESA' || c.tipoDoc === 'RUC'
      return filtroTipo === 'EMPRESA' ? esEmpresa : !esEmpresa
    })
    return [...list].sort((a, b) => {
      let va = '', vb = ''
      if (sortKey === 'nombre') { va = getDisplayName(a); vb = getDisplayName(b) }
      else if (sortKey === 'tipoDoc') { va = a.tipoDoc; vb = b.tipoDoc }
      else if (sortKey === 'tipo') { va = a.tipo ?? ''; vb = b.tipo ?? '' }
      else if (sortKey === 'fecha') {
        va = a.fechaRegistro ?? a.createdAt ?? ''
        vb = b.fechaRegistro ?? b.createdAt ?? ''
      }
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    })
  }, [todos, filtroTipo, sortKey, sortDir])

  const handleCrear = async (dto: ClienteDTO) => {
    await clientesService.crear(dto)
    toast.success('Cliente registrado correctamente')
    setModalNuevo(false)
    mutate()
  }

  const handleActualizar = async (dto: ClienteDTO) => {
    if (!editando) return
    await clientesService.actualizar(editando.id, dto)
    toast.success('Cliente actualizado')
    setEditando(null)
    mutate()
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
      toast.error(err?.response?.data?.message ?? 'No se puede eliminar — tiene registros asociados')
    } finally { setDeleting(false) }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#064e3b] flex items-center justify-center">
            <Users size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Clientes</h1>
            <p className="text-xs text-gray-500">Pasajeros, remitentes y empresas registradas</p>
          </div>
        </div>
        <button onClick={() => setModalNuevo(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#064e3b] text-white text-sm rounded-xl hover:bg-[#065f46] font-semibold transition-colors shadow-sm">
          <Plus size={15} /> Nuevo cliente
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total clientes" value={todos.length} icon={<Users size={18} />} color="green" />
        <StatCard label="Personas" value={nPersonas} icon={<User size={18} />} color="blue" />
        <StatCard label="Empresas" value={nEmpresas} icon={<Building2 size={18} />} color="amber" />
        <StatCard label="Nuevos este mes" value={nEsteMes} icon={<Calendar size={18} />} color="purple" />
      </div>

      {/* Barra de controles */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Buscador */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar por documento, nombre, apellido…"
            className="w-full pl-9 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#064e3b]/30 focus:border-[#064e3b] transition-colors"
          />
          {q && (
            <button onClick={() => setQ('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Filtros tipo */}
        <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl">
          {(['TODOS', 'PERSONA', 'EMPRESA'] as FiltroTipo[]).map(f => (
            <button key={f} onClick={() => setFiltroTipo(f)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
                filtroTipo === f
                  ? 'bg-white text-[#064e3b] shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}>
              {f === 'TODOS' ? 'Todos' : f === 'PERSONA' ? 'Personas' : 'Empresas'}
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl">
          <button onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-[#064e3b]' : 'text-gray-400 hover:text-gray-600'}`}
            title="Vista en tarjetas">
            <LayoutGrid size={15} />
          </button>
          <button onClick={() => setViewMode('table')}
            className={`p-1.5 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white shadow-sm text-[#064e3b]' : 'text-gray-400 hover:text-gray-600'}`}
            title="Vista en tabla">
            <List size={15} />
          </button>
        </div>

        {/* Contador */}
        <span className="text-xs text-gray-400 ml-1 hidden sm:block">
          {clientes.length} de {todos.length}
        </span>
      </div>

      {/* Contenido */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-gray-400">
          <Loader2 size={24} className="animate-spin mr-2" /> Cargando clientes…
        </div>
      ) : clientes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <Users size={28} className="text-gray-300" />
          </div>
          <p className="font-semibold text-gray-500">
            {q ? `Sin resultados para "${q}"` : 'No hay clientes registrados'}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {q ? 'Prueba con otro término de búsqueda' : 'Registra el primer cliente para comenzar'}
          </p>
          {!q && (
            <button onClick={() => setModalNuevo(true)}
              className="mt-4 flex items-center gap-2 px-5 py-2 bg-[#064e3b] text-white text-sm rounded-xl hover:bg-[#065f46] font-medium transition-colors">
              <Plus size={14} /> Registrar cliente
            </button>
          )}
          {q && (
            <button onClick={() => setQ('')}
              className="mt-3 text-sm text-[#064e3b] hover:underline">
              Limpiar búsqueda
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {clientes.map(c => (
            <ClienteCard key={c.id} c={c}
              onEdit={() => setEditando(c)}
              onDelete={() => setEliminando(c)} />
          ))}
        </div>
      ) : (
        <ClienteTable
          clientes={clientes}
          onEdit={setEditando}
          onDelete={setEliminando}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
        />
      )}

      {/* Modal nuevo */}
      <Modal open={modalNuevo} onClose={() => setModalNuevo(false)} title="Registrar nuevo cliente">
        <ClienteForm onSave={handleCrear} onCancel={() => setModalNuevo(false)} />
      </Modal>

      {/* Modal editar */}
      <Modal open={!!editando} onClose={() => setEditando(null)} title="Editar cliente">
        {editando && (
          <ClienteForm initial={editando} onSave={handleActualizar} onCancel={() => setEditando(null)} />
        )}
      </Modal>

      {/* Modal eliminar */}
      <Modal open={!!eliminando} onClose={() => setEliminando(null)} title="Eliminar cliente">
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
