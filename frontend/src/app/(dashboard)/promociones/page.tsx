'use client'
import React, { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Tag, X, Check, AlertCircle } from 'lucide-react'
import { promocionesService, PromocionDTO, PromocionRequestDTO } from '@/services/promociones.service'
import toast from 'react-hot-toast'

const fetcher = () => promocionesService.getAll()

const TIPO_LABELS: Record<string, string> = {
  PORCENTAJE: '% Porcentaje',
  MONTO_FIJO: 'S/ Monto fijo',
  IDA_VUELTA: '↔ Ida y vuelta',
}
const APLICA_LABELS: Record<string, string> = {
  PASAJES:     'Pasajes',
  ENCOMIENDAS: 'Encomiendas',
  AMBOS:       'Pasajes + Encomiendas',
}
const TIPO_COLOR: Record<string, string> = {
  PORCENTAJE: 'bg-blue-50 text-blue-700 border-blue-200',
  MONTO_FIJO: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  IDA_VUELTA: 'bg-violet-50 text-violet-700 border-violet-200',
}

const EMPTY: PromocionRequestDTO = {
  nombre: '', descripcion: '', codigo: '',
  tipoDescuento: 'PORCENTAJE', valor: 0,
  aplicaA: 'PASAJES', fechaInicio: '', fechaFin: '',
  activa: true, limiteUsos: undefined,
}

export default function PromocionesPage() {
  const { data: promos = [], isLoading } = useSWR('promociones', fetcher)
  const [modal, setModal] = useState<{ open: boolean; editing?: PromocionDTO }>({ open: false })
  const [form, setForm] = useState<PromocionRequestDTO>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [delModal, setDelModal] = useState<{ open: boolean; id?: number; nombre?: string }>({ open: false })

  function abrirCrear() {
    setForm(EMPTY)
    setModal({ open: true })
  }
  function abrirEditar(p: PromocionDTO) {
    setForm({
      nombre: p.nombre, descripcion: p.descripcion ?? '',
      codigo: p.codigo ?? '', tipoDescuento: p.tipoDescuento,
      valor: p.valor, aplicaA: p.aplicaA,
      fechaInicio: p.fechaInicio ?? '', fechaFin: p.fechaFin ?? '',
      activa: p.activa, limiteUsos: p.limiteUsos,
    })
    setModal({ open: true, editing: p })
  }

  async function guardar() {
    if (!form.nombre.trim()) { toast.error('El nombre es obligatorio'); return }
    if (!form.valor || form.valor <= 0) { toast.error('El valor del descuento debe ser mayor a 0'); return }
    setSaving(true)
    try {
      const payload: PromocionRequestDTO = {
        ...form,
        codigo:     form.codigo?.trim() || undefined,
        fechaInicio: form.fechaInicio || undefined,
        fechaFin:    form.fechaFin    || undefined,
        limiteUsos:  form.limiteUsos  || undefined,
      }
      if (modal.editing) {
        await promocionesService.actualizar(modal.editing.id, payload)
        toast.success('Promoción actualizada')
      } else {
        await promocionesService.crear(payload)
        toast.success('Promoción creada')
      }
      mutate('promociones')
      setModal({ open: false })
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function toggle(p: PromocionDTO) {
    try {
      await promocionesService.toggle(p.id)
      mutate('promociones')
      toast.success(p.activa ? 'Promoción desactivada' : 'Promoción activada')
    } catch {
      toast.error('Error al cambiar estado')
    }
  }

  async function eliminar() {
    if (!delModal.id) return
    try {
      await promocionesService.eliminar(delModal.id)
      mutate('promociones')
      toast.success('Promoción eliminada')
      setDelModal({ open: false })
    } catch {
      toast.error('Error al eliminar')
    }
  }

  const formatValor = (p: PromocionDTO) =>
    p.tipoDescuento === 'MONTO_FIJO' ? `S/ ${p.valor.toFixed(2)}` : `${p.valor}%`

  const formatFecha = (f?: string) => f ? new Date(f).toLocaleDateString('es-PE') : '—'

  return (
    <div className="max-w-5xl mx-auto space-y-5">

      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Tag size={20} className="text-[#064e3b]" />
            Promociones y Descuentos
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Crea y gestiona descuentos para pasajes y encomiendas
          </p>
        </div>
        <button
          onClick={abrirCrear}
          className="flex items-center gap-2 px-4 py-2 bg-[#064e3b] text-white rounded-lg text-sm font-medium hover:bg-[#065f46] transition-colors"
        >
          <Plus size={15} /> Nueva promoción
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-gray-400">Cargando promociones...</div>
        ) : promos.length === 0 ? (
          <div className="p-10 text-center">
            <Tag size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">No hay promociones. Crea la primera.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  {['Nombre / Código', 'Tipo', 'Descuento', 'Aplica a', 'Vigencia', 'Usos', 'Estado', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {promos.map(p => (
                  <tr key={p.id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{p.nombre}</p>
                      {p.codigo && (
                        <span className="inline-block mt-0.5 text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono tracking-wider">
                          {p.codigo}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${TIPO_COLOR[p.tipoDescuento]}`}>
                        {TIPO_LABELS[p.tipoDescuento]}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-[#064e3b]">{formatValor(p)}</td>
                    <td className="px-4 py-3 text-gray-600">{APLICA_LABELS[p.aplicaA]}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {p.fechaInicio || p.fechaFin
                        ? <>{formatFecha(p.fechaInicio)} → {formatFecha(p.fechaFin)}</>
                        : <span className="text-gray-400">Sin límite</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {p.limiteUsos
                        ? <>{p.usosActuales} / {p.limiteUsos}</>
                        : <span className="text-gray-400">{p.usosActuales} usos</span>}
                    </td>
                    <td className="px-4 py-3">
                      {p.vigente ? (
                        <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Vigente
                        </span>
                      ) : p.activa ? (
                        <span className="flex items-center gap-1 text-amber-600 text-xs font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Fuera de fecha
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-gray-400 text-xs font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-300" /> Inactiva
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => toggle(p)}
                          title={p.activa ? 'Desactivar' : 'Activar'}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                        >
                          {p.activa
                            ? <ToggleRight size={16} className="text-emerald-500" />
                            : <ToggleLeft size={16} />}
                        </button>
                        <button
                          onClick={() => abrirEditar(p)}
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setDelModal({ open: true, id: p.id, nombre: p.nombre })}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal crear / editar */}
      {modal.open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#F1F5F9]">
              <h2 className="font-bold text-gray-900">
                {modal.editing ? 'Editar promoción' : 'Nueva promoción'}
              </h2>
              <button onClick={() => setModal({ open: false })} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X size={16} className="text-gray-500" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Nombre */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre *</label>
                <input
                  value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  placeholder="Ej: Descuento Fiestas Patrias"
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#064e3b]/20 focus:border-[#064e3b]"
                />
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Descripción</label>
                <input
                  value={form.descripcion}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Descripción breve (opcional)"
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#064e3b]/20 focus:border-[#064e3b]"
                />
              </div>

              {/* Código de campaña */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Código de campaña <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <input
                  value={form.codigo}
                  onChange={e => setForm(f => ({ ...f, codigo: e.target.value.toUpperCase() }))}
                  placeholder="Ej: JULIO25"
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#064e3b]/20 focus:border-[#064e3b]"
                />
                <p className="text-[11px] text-gray-400 mt-1">El cajero puede ingresar este código para aplicar la promo manualmente</p>
              </div>

              {/* Tipo + Valor */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo de descuento *</label>
                  <select
                    value={form.tipoDescuento}
                    onChange={e => setForm(f => ({ ...f, tipoDescuento: e.target.value }))}
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#064e3b]/20 focus:border-[#064e3b]"
                  >
                    <option value="PORCENTAJE">% Porcentaje</option>
                    <option value="MONTO_FIJO">S/ Monto fijo</option>
                    <option value="IDA_VUELTA">↔ Ida y vuelta (%)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Valor * {form.tipoDescuento === 'MONTO_FIJO' ? '(S/)' : '(%)'}
                  </label>
                  <input
                    type="number" min="0.01" step="0.01"
                    value={form.valor || ''}
                    onChange={e => setForm(f => ({ ...f, valor: parseFloat(e.target.value) || 0 }))}
                    placeholder={form.tipoDescuento === 'MONTO_FIJO' ? '5.00' : '20'}
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#064e3b]/20 focus:border-[#064e3b]"
                  />
                </div>
              </div>

              {/* Aplica a */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Aplica a *</label>
                <div className="flex gap-2">
                  {(['PASAJES', 'ENCOMIENDAS', 'AMBOS'] as const).map(op => (
                    <button
                      key={op}
                      onClick={() => setForm(f => ({ ...f, aplicaA: op }))}
                      className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-all ${
                        form.aplicaA === op
                          ? 'bg-[#064e3b] text-white border-[#064e3b]'
                          : 'bg-white text-gray-600 border-[#E2E8F0] hover:border-[#064e3b]/40'
                      }`}
                    >
                      {APLICA_LABELS[op]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Fecha inicio</label>
                  <input
                    type="date"
                    value={form.fechaInicio}
                    onChange={e => setForm(f => ({ ...f, fechaInicio: e.target.value }))}
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#064e3b]/20 focus:border-[#064e3b]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Fecha fin</label>
                  <input
                    type="date"
                    value={form.fechaFin}
                    onChange={e => setForm(f => ({ ...f, fechaFin: e.target.value }))}
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#064e3b]/20 focus:border-[#064e3b]"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">Vacío = sin vencimiento</p>
                </div>
              </div>

              {/* Límite de usos */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Límite de usos <span className="text-gray-400 font-normal">(vacío = ilimitado)</span>
                </label>
                <input
                  type="number" min="1"
                  value={form.limiteUsos || ''}
                  onChange={e => setForm(f => ({ ...f, limiteUsos: parseInt(e.target.value) || undefined }))}
                  placeholder="Ej: 100"
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#064e3b]/20 focus:border-[#064e3b]"
                />
              </div>

              {/* Activa */}
              <div className="flex items-center justify-between p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
                <div>
                  <p className="text-sm font-medium text-gray-700">Activar promoción</p>
                  <p className="text-xs text-gray-400">Visible para los cajeros inmediatamente</p>
                </div>
                <button
                  onClick={() => setForm(f => ({ ...f, activa: !f.activa }))}
                  className={`w-11 h-6 rounded-full transition-colors relative ${form.activa ? 'bg-emerald-500' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.activa ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-[#F1F5F9]">
              <button
                onClick={() => setModal({ open: false })}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-[#E2E8F0] rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-[#064e3b] text-white rounded-lg text-sm font-medium hover:bg-[#065f46] disabled:opacity-50 transition-colors"
              >
                <Check size={14} />
                {saving ? 'Guardando...' : modal.editing ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal eliminar */}
      {delModal.open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <AlertCircle size={22} className="text-red-500" />
            </div>
            <h3 className="font-bold text-gray-900 mb-1">¿Eliminar promoción?</h3>
            <p className="text-sm text-gray-500 mb-5">
              Se eliminará <strong>"{delModal.nombre}"</strong> permanentemente.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDelModal({ open: false })}
                className="flex-1 py-2 border border-[#E2E8F0] rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={eliminar}
                className="flex-1 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
