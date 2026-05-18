'use client'
import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import toast from 'react-hot-toast'
import { Search, X, UserCheck, Building2, Loader2 } from 'lucide-react'
import { clientesService, type ClienteDTO } from '@/services/clientes.service'
import type { Cliente } from '@/types'

export interface BuscadorClienteRef {
  saveIfNeeded: () => Promise<boolean>
}

interface Props {
  label: string
  value: Cliente | null
  onChange: (c: Cliente | null) => void
  tipoDoc?: string
}

export const BuscadorCliente = forwardRef<BuscadorClienteRef, Props>(
  function BuscadorCliente({ label, value, onChange, tipoDoc = 'DNI' }, ref) {
    const esEmpresa = tipoDoc === 'RUC'

    const [docInput, setDocInput]         = useState('')
    const [buscando, setBuscando]         = useState(false)
    const [noEncontrado, setNoEncontrado] = useState(false)
    const [registrando, setRegistrando]   = useState(false)
    const [form, setForm]                 = useState<Partial<ClienteDTO>>({
      tipoDoc,
      tipo: esEmpresa ? 'EMPRESA' : 'PERSONA',
    })
    const [guardando, setGuardando]       = useState(false)
    const [editData, setEditData]         = useState<Cliente | null>(null)

    useEffect(() => {
      if (value && !editData) setEditData({ ...value })
      if (!value && !registrando) setEditData(null)
    }, [value?.id])

    // Reset form tipo when tipoDoc prop changes
    useEffect(() => {
      setForm(f => ({
        ...f,
        tipoDoc,
        tipo: tipoDoc === 'RUC' ? 'EMPRESA' : 'PERSONA',
      }))
    }, [tipoDoc])

    const maxLen = tipoDoc === 'DNI' ? 8 : tipoDoc === 'RUC' ? 11 : 20

    const validatePhone = (tel: string) => /^9\d{8}$/.test(tel.trim())

    useImperativeHandle(ref, () => ({
      saveIfNeeded: async () => {
        if (registrando) {
          if (esEmpresa) {
            if (!form.razonSocial?.trim() || !form.numDoc?.trim()) {
              toast.error('Razón social y RUC son obligatorios')
              return false
            }
          } else {
            if (!form.nombres?.trim() || !form.apellidos?.trim() || !form.numDoc?.trim()) {
              toast.error('Nombres, apellidos y documento son obligatorios')
              return false
            }
          }
          if (!form.telefono?.trim()) {
            toast.error('El teléfono es obligatorio')
            return false
          }
          if (!validatePhone(form.telefono)) {
            toast.error('Teléfono debe tener 9 dígitos y empezar con 9')
            return false
          }
          return await guardarNuevo()
        }
        return !!value
      }
    }))

    const buscar = async () => {
      const doc = docInput.trim()
      if (!doc) return
      setBuscando(true)
      setNoEncontrado(false)
      try {
        const cliente = await clientesService.buscarPorDoc(tipoDoc, doc)
        setEditData({ ...cliente })
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
      setEditData(null)
      setForm({ tipoDoc, tipo: esEmpresa ? 'EMPRESA' : 'PERSONA' })
    }

    const iniciarRegistro = () => {
      setForm({
        tipoDoc,
        tipo: esEmpresa ? 'EMPRESA' : 'PERSONA',
        numDoc: docInput,
      })
      setRegistrando(true)
      setNoEncontrado(false)
    }

    const guardarNuevo = async (): Promise<boolean> => {
      setGuardando(true)
      try {
        const nuevo = await clientesService.crear(form as ClienteDTO)
        setEditData({ ...nuevo })
        onChange(nuevo)
        setRegistrando(false)
        toast.success('Cliente registrado')
        return true
      } catch {
        toast.error('Error al registrar cliente')
        return false
      } finally {
        setGuardando(false)
      }
    }

    const sfEdit = (k: keyof Cliente) =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!editData) return
        const updated = { ...editData, [k]: e.target.value }
        setEditData(updated)
        onChange(updated)
      }

    const sf = (k: keyof ClienteDTO) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setForm(v => ({ ...v, [k]: e.target.value }))

    const docLabel = tipoDoc === 'RUC' ? 'RUC' : tipoDoc === 'CE' ? 'CE' : 'DNI'
    const isEmpresaFound = value?.tipo === 'EMPRESA' || (value?.tipoDoc === 'RUC')

    // ── Cliente encontrado — panel editable ──────────────────────────────────
    if (value && editData) {
      return (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
          <div className="border border-green-200 rounded-lg bg-green-50 p-3 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-green-700 flex items-center gap-1">
                {isEmpresaFound
                  ? <><Building2 size={12} /> Empresa encontrada — RUC {editData.numDoc}</>
                  : <><UserCheck size={12} /> Cliente encontrado — {docLabel} {editData.numDoc}</>
                }
              </p>
              <button onClick={limpiar} className="p-1 rounded text-gray-400 hover:text-red-500 shrink-0">
                <X size={14} />
              </button>
            </div>

            {isEmpresaFound ? (
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">Razón Social *</label>
                <input value={editData.razonSocial ?? ''} onChange={sfEdit('razonSocial')}
                  placeholder="Razón social"
                  className="w-full px-2 py-1.5 border border-green-300 rounded text-xs bg-white focus:ring-1 focus:ring-green-500" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">Nombres *</label>
                  <input value={editData.nombres} onChange={sfEdit('nombres')}
                    className="w-full px-2 py-1.5 border border-green-300 rounded text-xs bg-white focus:ring-1 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">Apellidos *</label>
                  <input value={editData.apellidos} onChange={sfEdit('apellidos')}
                    className="w-full px-2 py-1.5 border border-green-300 rounded text-xs bg-white focus:ring-1 focus:ring-green-500" />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">Teléfono</label>
                <input value={editData.telefono ?? ''} onChange={sfEdit('telefono')}
                  placeholder="9XXXXXXXX"
                  className="w-full px-2 py-1.5 border border-green-300 rounded text-xs bg-white focus:ring-1 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">Dirección</label>
                <input value={editData.direccion ?? ''} onChange={sfEdit('direccion')}
                  placeholder="Dirección (opcional)"
                  className="w-full px-2 py-1.5 border border-green-300 rounded text-xs bg-white focus:ring-1 focus:ring-green-500" />
              </div>
            </div>
          </div>
        </div>
      )
    }

    // ── Mini-formulario de registro inline ───────────────────────────────────
    if (registrando) {
      const telOk = form.telefono ? validatePhone(form.telefono) : false
      const formOk = esEmpresa
        ? !!(form.razonSocial?.trim() && form.numDoc?.trim() && telOk)
        : !!(form.nombres?.trim() && form.apellidos?.trim() && form.numDoc?.trim() && telOk)

      return (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
          <div className="border border-amber-200 rounded-lg bg-amber-50 p-3 space-y-2">
            <p className="text-xs font-semibold text-amber-700 flex items-center gap-1">
              {esEmpresa
                ? <><Building2 size={12} /> Empresa no encontrada. Completa los datos para registrarla.</>
                : 'Cliente no encontrado. Completa los datos para registrarlo.'
              }
            </p>

            {esEmpresa ? (
              <input value={form.razonSocial ?? ''} onChange={sf('razonSocial')}
                placeholder="Razón social *"
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-amber-400" />
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <input value={form.nombres ?? ''} onChange={sf('nombres')} placeholder="Nombres *"
                  className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-amber-400" />
                <input value={form.apellidos ?? ''} onChange={sf('apellidos')} placeholder="Apellidos *"
                  className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-amber-400" />
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <select value={form.tipoDoc ?? tipoDoc} onChange={sf('tipoDoc')}
                className="px-2 py-1.5 border border-gray-300 rounded text-xs bg-white focus:ring-1 focus:ring-amber-400">
                {['DNI', 'CE', 'PASAPORTE', 'RUC'].map(t => <option key={t}>{t}</option>)}
              </select>
              <input value={form.numDoc ?? ''} onChange={sf('numDoc')}
                placeholder={`N° ${docLabel} *`}
                maxLength={maxLen}
                className="col-span-2 px-2 py-1.5 border border-gray-300 rounded text-xs font-mono focus:ring-1 focus:ring-amber-400" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <input
                  value={form.telefono ?? ''} onChange={sf('telefono')}
                  placeholder="Teléfono * (9XXXXXXXX)"
                  maxLength={9}
                  className={`w-full px-2 py-1.5 border rounded text-xs focus:ring-1 ${
                    form.telefono && !telOk
                      ? 'border-red-300 focus:ring-red-400'
                      : 'border-gray-300 focus:ring-amber-400'
                  }`}
                />
                {form.telefono && !telOk && (
                  <p className="text-[10px] text-red-500 mt-0.5">9 dígitos, empieza en 9</p>
                )}
              </div>
              <input value={form.direccion ?? ''} onChange={sf('direccion')} placeholder="Dirección (opcional)"
                className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-amber-400" />
            </div>

            <div className="flex gap-2">
              <button onClick={limpiar}
                className="flex-1 py-1.5 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-100">
                Cancelar
              </button>
              <button onClick={guardarNuevo} disabled={guardando || !formOk}
                className="flex-1 py-1.5 text-xs text-white bg-[#1F3864] rounded hover:bg-[#16294d] disabled:opacity-50 flex items-center justify-center gap-1">
                {guardando && <Loader2 size={11} className="animate-spin" />}
                {esEmpresa ? 'Registrar empresa' : 'Registrar cliente'}
              </button>
            </div>
          </div>
        </div>
      )
    }

    // ── Buscador inicial ─────────────────────────────────────────────────────
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
            placeholder={
              tipoDoc === 'DNI' ? 'DNI (8 dígitos)'
              : tipoDoc === 'RUC' ? 'RUC (11 dígitos)'
              : tipoDoc === 'CE' ? 'Carnet de extranjería'
              : `${tipoDoc}`
            }
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
              No encontrado: {docLabel} {docInput}
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
)
