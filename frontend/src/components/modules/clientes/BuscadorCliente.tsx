'use client'
import React, { useState } from 'react'
import toast from 'react-hot-toast'
import { Search, X, UserCheck, Loader2 } from 'lucide-react'
import { clientesService, type ClienteDTO } from '@/services/clientes.service'
import type { Cliente } from '@/types'

interface Props {
  label: string
  value: Cliente | null
  onChange: (c: Cliente | null) => void
  /** Restringe el tipo de doc a buscar (default: DNI) */
  tipoDoc?: string
}

export function BuscadorCliente({ label, value, onChange, tipoDoc = 'DNI' }: Props) {
  const [docInput, setDocInput]         = useState('')
  const [buscando, setBuscando]         = useState(false)
  const [noEncontrado, setNoEncontrado] = useState(false)
  const [registrando, setRegistrando]   = useState(false)
  const [form, setForm]                 = useState<Partial<ClienteDTO>>({ tipoDoc })
  const [guardando, setGuardando]       = useState(false)

  const maxLen = tipoDoc === 'DNI' ? 8 : tipoDoc === 'RUC' ? 11 : 20

  const buscar = async () => {
    const doc = docInput.trim()
    if (!doc) return
    setBuscando(true)
    setNoEncontrado(false)
    try {
      const cliente = await clientesService.buscarPorDoc(tipoDoc, doc)
      onChange(cliente)
    } catch {
      setNoEncontrado(true)
      onChange(null)
    } finally {
      setBuscando(false)
    }
  }

  const limpiar = () => {
    onChange(null)
    setDocInput('')
    setNoEncontrado(false)
    setRegistrando(false)
    setForm({ tipoDoc })
  }

  const iniciarRegistro = () => {
    setForm({ tipoDoc, numDoc: docInput })
    setRegistrando(true)
    setNoEncontrado(false)
  }

  const guardarNuevo = async () => {
    if (!form.nombres?.trim() || !form.apellidos?.trim() || !form.numDoc?.trim()) {
      toast.error('Nombres, apellidos y documento son obligatorios')
      return
    }
    setGuardando(true)
    try {
      const nuevo = await clientesService.crear(form as ClienteDTO)
      onChange(nuevo)
      setRegistrando(false)
      toast.success('Cliente registrado')
    } catch {
      toast.error('Error al registrar cliente')
    } finally {
      setGuardando(false)
    }
  }

  const sf = (k: keyof ClienteDTO) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(v => ({ ...v, [k]: e.target.value }))

  // ── Cliente encontrado ────────────────────────────────────────────────────
  if (value) {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
        <div className="flex items-center gap-3 p-2.5 bg-green-50 border border-green-200 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-[#1F3864] flex items-center justify-center text-white text-xs font-bold shrink-0">
            {(value.nombres[0] + (value.apellidos[0] ?? '')).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {value.apellidos}, {value.nombres}
            </p>
            <p className="text-xs text-gray-500">{tipoDoc} {value.numDoc}</p>
          </div>
          <button onClick={limpiar} className="p-1 rounded text-gray-400 hover:text-red-500 shrink-0">
            <X size={14} />
          </button>
        </div>
      </div>
    )
  }

  // ── Mini-formulario de registro inline ────────────────────────────────────
  if (registrando) {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
        <div className="border border-blue-200 rounded-lg bg-blue-50 p-3 space-y-2">
          <p className="text-xs font-semibold text-blue-700 flex items-center gap-1">
            <UserCheck size={12} /> Registrar nuevo cliente
          </p>
          <div className="grid grid-cols-2 gap-2">
            <input value={form.nombres ?? ''} onChange={sf('nombres')} placeholder="Nombres *"
              className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500" />
            <input value={form.apellidos ?? ''} onChange={sf('apellidos')} placeholder="Apellidos *"
              className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <select value={form.tipoDoc ?? tipoDoc} onChange={sf('tipoDoc')}
              className="px-2 py-1.5 border border-gray-300 rounded text-xs bg-white focus:ring-1 focus:ring-blue-500">
              {['DNI', 'CE', 'PASAPORTE', 'RUC'].map(t => <option key={t}>{t}</option>)}
            </select>
            <input value={form.numDoc ?? ''} onChange={sf('numDoc')} placeholder="N° doc *"
              className="col-span-2 px-2 py-1.5 border border-gray-300 rounded text-xs font-mono focus:ring-1 focus:ring-blue-500" />
          </div>
          <input value={form.telefono ?? ''} onChange={sf('telefono')} placeholder="Teléfono (opcional)"
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500" />
          <div className="flex gap-2">
            <button onClick={limpiar}
              className="flex-1 py-1.5 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-100">
              Cancelar
            </button>
            <button onClick={guardarNuevo} disabled={guardando}
              className="flex-1 py-1.5 text-xs text-white bg-[#1F3864] rounded hover:bg-[#16294d] disabled:opacity-50 flex items-center justify-center gap-1">
              {guardando && <Loader2 size={11} className="animate-spin" />}
              Guardar cliente
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Buscador inicial ──────────────────────────────────────────────────────
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex gap-2">
        <input
          value={docInput}
          onChange={e => {
            const v = tipoDoc === 'DNI' || tipoDoc === 'RUC'
              ? e.target.value.replace(/\D/g, '').slice(0, maxLen)
              : e.target.value.slice(0, maxLen)
            setDocInput(v)
            setNoEncontrado(false)
          }}
          onKeyDown={e => e.key === 'Enter' && buscar()}
          placeholder={`${tipoDoc} (${maxLen} dígitos)`}
          maxLength={maxLen}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          type="button"
          onClick={buscar}
          disabled={buscando || docInput.length < (tipoDoc === 'DNI' ? 8 : tipoDoc === 'RUC' ? 11 : 3)}
          className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 text-sm rounded-lg transition-colors"
        >
          {buscando ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Buscar
        </button>
      </div>
      {noEncontrado && (
        <div className="mt-1.5 flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
          <span className="text-xs text-yellow-700">
            No encontrado: {tipoDoc} {docInput}
          </span>
          <button
            type="button"
            onClick={iniciarRegistro}
            className="text-xs text-[#0070C0] font-semibold hover:underline ml-2 shrink-0"
          >
            + Registrar aquí
          </button>
        </div>
      )}
    </div>
  )
}
