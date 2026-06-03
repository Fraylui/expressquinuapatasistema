'use client'
import React, { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  PackageSearch, Plus, Search, X, Check, Loader2, Printer,
  CheckCircle2, Clock, User, Car, Phone, RefreshCw, Package,
} from 'lucide-react'
import {
  encomiendaExternaService,
  type EncomiendaExterna,
  type RegistrarEncomiendaExternaDTO,
  type EntregarEncomiendaExternaDTO,
} from '@/services/encomiendas-externas.service'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import toast_component from 'react-hot-toast'

// ── Helpers ────────────────────────────────────────────────────────────────────

const FORMA_PAGO_OPTS = ['EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA']

function montoFmt(v: number | string | undefined) {
  return `S/ ${Number(v ?? 0).toFixed(2)}`
}

// ── Modal: Registrar entrega ───────────────────────────────────────────────────

function ModalEntrega({
  enc,
  onClose,
  onSuccess,
}: {
  enc: EncomiendaExterna
  onClose: () => void
  onSuccess: (enc: EncomiendaExterna, cobrado: boolean) => void
}) {
  const [receptorNombre, setReceptorNombre] = useState(enc.destinatarioNombre)
  const [receptorDni,    setReceptorDni]    = useState(enc.destinatarioDni)
  const [nota,           setNota]           = useState('')
  const [formaPago,      setFormaPago]      = useState('EFECTIVO')
  const [guardando,      setGuardando]      = useState(false)

  const cobrarAlEntrega = enc.estadoPago === 'PENDIENTE'

  const confirmar = async () => {
    if (!receptorNombre.trim() || !receptorDni.trim()) {
      toast.error('Nombre y DNI del receptor son obligatorios')
      return
    }
    if (cobrarAlEntrega && !formaPago) {
      toast.error('Seleccione la forma de pago')
      return
    }
    setGuardando(true)
    try {
      const dto: EntregarEncomiendaExternaDTO = {
        receptorNombre: receptorNombre.trim(),
        receptorDni:    receptorDni.trim(),
        nota:           nota.trim() || undefined,
        formaPago:      cobrarAlEntrega ? formaPago : undefined,
      }
      const r = await encomiendaExternaService.entregar(enc.id, dto)
      onSuccess(r.data.encomienda, r.data.cobrado)
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Error al registrar entrega')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h3 className="font-semibold text-gray-900">Registrar entrega</h3>
            <p className="text-xs text-gray-500 font-mono">{enc.correlativo}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Resumen */}
          <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-1">
            <div className="flex gap-2">
              <span className="text-gray-500 w-24 shrink-0">Conductor:</span>
              <span className="font-medium text-gray-800">{enc.conductorNombre}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500 w-24 shrink-0">Destinatario:</span>
              <span className="font-medium text-gray-800">{enc.destinatarioNombre}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500 w-24 shrink-0">Contenido:</span>
              <span className="text-gray-700">{enc.descripcion}</span>
            </div>
            {cobrarAlEntrega && (
              <div className="flex gap-2 pt-1 border-t border-gray-200">
                <span className="text-gray-500 w-24 shrink-0">A cobrar:</span>
                <span className="font-bold text-amber-700">{montoFmt(enc.monto)}</span>
              </div>
            )}
          </div>

          {/* Receptor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">DNI receptor *</label>
              <input
                value={receptorDni}
                onChange={e => setReceptorDni(e.target.value.replace(/\D/g, '').slice(0, 20))}
                placeholder="DNI"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nombre receptor *</label>
              <input
                value={receptorNombre}
                onChange={e => setReceptorNombre(e.target.value)}
                placeholder="Nombre completo"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nota (opcional)</label>
            <textarea
              value={nota}
              onChange={e => setNota(e.target.value)}
              rows={2}
              placeholder="Observaciones sobre la entrega..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {cobrarAlEntrega && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
              <div className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5 text-sm">⚠</span>
                <div>
                  <p className="text-xs font-semibold text-amber-900">
                    Cobrar {montoFmt(enc.monto)} al destinatario
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Este pago ingresará a tu caja activa. <strong>Debes tener caja abierta.</strong>
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Forma de pago recibida *</label>
                <select
                  value={formaPago}
                  onChange={e => setFormaPago(e.target.value)}
                  className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-500"
                >
                  {FORMA_PAGO_OPTS.map(f => (
                    <option key={f} value={f}>{f.charAt(0) + f.slice(1).toLowerCase()}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={guardando || !receptorNombre.trim() || !receptorDni.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50">
            {guardando ? <Loader2 size={14} className="animate-spin" /> : <Check size={15} />}
            Confirmar entrega
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal: Registrar nueva encomienda externa ─────────────────────────────────

function ModalRegistrar({ onClose, onSuccess }: {
  onClose: () => void
  onSuccess: (enc: EncomiendaExterna) => void
}) {
  const [form, setForm] = useState({
    conductorNombre: '', conductorDni: '', conductorTel: '', conductorPlaca: '',
    destinatarioNombre: '', destinatarioDni: '', destinatarioTel: '',
    descripcion: '', observaciones: '',
    monto: '', estadoPago: 'PENDIENTE' as 'PENDIENTE' | 'PAGADO', formaPago: 'EFECTIVO',
  })
  const [guardando, setGuardando] = useState(false)

  const sf = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(v => ({ ...v, [k]: e.target.value }))

  const canSubmit =
    form.conductorNombre.trim() &&
    form.conductorDni.length === 8 &&
    form.destinatarioNombre.trim() &&
    form.destinatarioDni.trim() &&
    form.descripcion.trim() &&
    form.monto && parseFloat(form.monto) >= 0

  const registrar = async () => {
    if (!canSubmit) return
    setGuardando(true)
    try {
      const dto: RegistrarEncomiendaExternaDTO = {
        conductorNombre:    form.conductorNombre.trim(),
        conductorDni:       form.conductorDni,
        conductorTel:       form.conductorTel.trim() || undefined,
        conductorPlaca:     form.conductorPlaca.trim().toUpperCase() || undefined,
        destinatarioNombre: form.destinatarioNombre.trim(),
        destinatarioDni:    form.destinatarioDni.trim(),
        destinatarioTel:    form.destinatarioTel.trim() || undefined,
        descripcion:        form.descripcion.trim(),
        observaciones:      form.observaciones.trim() || undefined,
        monto:              parseFloat(form.monto),
        estadoPago:         form.estadoPago,
        formaPago:          form.estadoPago === 'PAGADO' ? form.formaPago : undefined,
      }
      const r = await encomiendaExternaService.registrar(dto)
      onSuccess(r.data)
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Error al registrar')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg my-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h3 className="font-semibold text-gray-900">Nueva encomienda externa</h3>
            <p className="text-xs text-gray-500">Depósito de conductor externo</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">

          {/* Conductor */}
          <div>
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Car size={13} /> Conductor externo
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Nombre completo *</label>
                <input value={form.conductorNombre} onChange={sf('conductorNombre')}
                  placeholder="Nombres y apellidos"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">DNI *</label>
                <input value={form.conductorDni}
                  onChange={e => setForm(v => ({ ...v, conductorDni: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
                  placeholder="12345678" maxLength={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Teléfono</label>
                <input value={form.conductorTel} onChange={sf('conductorTel')}
                  placeholder="9XXXXXXXX"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Placa del vehículo</label>
                <input value={form.conductorPlaca} onChange={sf('conductorPlaca')}
                  placeholder="ABC-123"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono uppercase focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>

          {/* Destinatario */}
          <div>
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <User size={13} /> Destinatario
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Nombre completo *</label>
                <input value={form.destinatarioNombre} onChange={sf('destinatarioNombre')}
                  placeholder="Nombres y apellidos"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">DNI *</label>
                <input value={form.destinatarioDni} onChange={sf('destinatarioDni')}
                  placeholder="DNI o CE"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Teléfono</label>
                <input value={form.destinatarioTel} onChange={sf('destinatarioTel')}
                  placeholder="9XXXXXXXX"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>

          {/* Encomienda */}
          <div>
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Package size={13} /> Encomienda
            </h4>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Descripción del contenido *</label>
                <textarea value={form.descripcion} onChange={sf('descripcion')} rows={2}
                  placeholder="Ej: Ropa, documentos, encargo..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Observaciones</label>
                <textarea value={form.observaciones} onChange={sf('observaciones')} rows={2}
                  placeholder="Fragil, urgente, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>

          {/* Cobro */}
          <div>
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Cobro</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Monto (S/) *</label>
                <input type="number" step="0.5" min="0" value={form.monto} onChange={sf('monto')}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">¿Cuándo se cobra?</label>
                <select value={form.estadoPago} onChange={sf('estadoPago')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500">
                  <option value="PENDIENTE">Al recoger (destinatario paga)</option>
                  <option value="PAGADO">Ahora (conductor ya pagó)</option>
                </select>
              </div>
              {form.estadoPago === 'PAGADO' && (
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Forma de pago *</label>
                  <select value={form.formaPago} onChange={sf('formaPago')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500">
                    {FORMA_PAGO_OPTS.map(f => (
                      <option key={f} value={f}>{f.charAt(0) + f.slice(1).toLowerCase()}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            {form.estadoPago === 'PENDIENTE' && form.monto && parseFloat(form.monto) > 0 && (
              <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                Se cobrará <strong>S/ {parseFloat(form.monto).toFixed(2)}</strong> al destinatario cuando venga a recoger.
                El operador que entregue debe tener caja abierta.
              </p>
            )}
          </div>

        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={registrar} disabled={guardando || !canSubmit}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#064e3b] text-white text-sm rounded-lg hover:bg-[#16294d] disabled:opacity-50">
            {guardando ? <Loader2 size={14} className="animate-spin" /> : <Check size={15} />}
            Registrar encomienda
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Success screen post-entrega ───────────────────────────────────────────────

function EntregaSuccess({ enc, cobrado, onVolver, onPrint }: {
  enc: EncomiendaExterna
  cobrado: boolean
  onVolver: () => void
  onPrint: () => void
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center space-y-5 max-w-sm mx-auto">
      <div className="flex justify-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 size={36} className="text-green-500" />
        </div>
      </div>
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">¡Encomienda entregada!</h3>
        <p className="text-xs text-gray-500 font-mono">{enc.correlativo}</p>
      </div>
      <div className="bg-gray-50 rounded-lg border border-gray-200 text-left divide-y divide-gray-100">
        {[
          ['Recibió',  enc.entregadoA ?? '—'],
          ['DNI',      enc.entregadoDni ?? '—'],
          ['Fecha',    enc.fechaEntrega ? format(new Date(enc.fechaEntrega), 'dd/MM/yyyy HH:mm') : '—'],
          ...(cobrado ? [['Cobrado', `${montoFmt(enc.monto)} en caja`]] : []),
        ].map(([label, value]) => (
          <div key={label} className="flex gap-2 px-4 py-2">
            <span className="text-xs font-semibold text-gray-500 w-20 shrink-0">{label}</span>
            <span className="text-xs text-gray-800">{value}</span>
          </div>
        ))}
      </div>
      {cobrado && (
        <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg p-2 font-medium">
          Cobro registrado automáticamente en caja
        </p>
      )}
      <div className="flex gap-3 justify-center">
        <button onClick={onPrint}
          className="flex items-center gap-2 px-4 py-2 bg-[#064e3b] text-white text-sm rounded-lg hover:bg-[#16294d]">
          <Printer size={14} /> Imprimir ticket
        </button>
        <button onClick={onVolver}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
          Volver a la lista
        </button>
      </div>
    </div>
  )
}

// ── Card de encomienda ────────────────────────────────────────────────────────

function EncomiendaCard({
  enc,
  onEntregar,
  onPrint,
}: {
  enc: EncomiendaExterna
  onEntregar: (enc: EncomiendaExterna) => void
  onPrint: (enc: EncomiendaExterna) => void
}) {
  const entregado  = enc.estado === 'ENTREGADO'
  const porCobrar  = enc.estadoPago === 'PENDIENTE'

  return (
    <div className={`rounded-xl border p-4 shadow-sm transition-all ${
      entregado ? 'bg-green-50/40 border-green-200 opacity-80' : 'bg-white border-gray-200'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2 min-w-0 flex-1">

          {/* Header */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-bold text-[#064e3b]">{enc.correlativo}</span>
            {entregado ? (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 flex items-center gap-1">
                <CheckCircle2 size={10} /> Entregado
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                Pendiente retiro
              </span>
            )}
            {porCobrar && !entregado && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                Cobrar {montoFmt(enc.monto)}
              </span>
            )}
            {!porCobrar && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                Pagado
              </span>
            )}
          </div>

          {/* Datos */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
            <div className="text-gray-500">
              <span className="font-medium text-gray-700">Conductor: </span>
              {enc.conductorNombre}
              {enc.conductorDni && <span className="text-gray-400"> · {enc.conductorDni}</span>}
            </div>
            <div className="text-gray-500">
              <span className="font-medium text-gray-700">Destinatario: </span>
              {enc.destinatarioNombre}
              {enc.destinatarioTel && (
                <span className="ml-1 text-blue-600 font-medium">· {enc.destinatarioTel}</span>
              )}
            </div>
            <div className="text-gray-500 col-span-2">
              <span className="font-medium text-gray-700">Contenido: </span>
              {enc.descripcion}
            </div>
            {enc.conductorPlaca && (
              <div className="text-gray-500 flex items-center gap-1">
                <Car size={11} />
                <span className="font-mono font-medium">{enc.conductorPlaca}</span>
              </div>
            )}
          </div>

          {/* Footer info */}
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Clock size={11} />
              {enc.fechaRecepcion ? format(new Date(enc.fechaRecepcion), 'dd/MM HH:mm') : '—'}
            </span>
            {entregado && enc.fechaEntrega && (
              <span className="flex items-center gap-1 text-green-600">
                <Check size={11} />
                Entregado a {enc.entregadoA} · {format(new Date(enc.fechaEntrega), 'dd/MM HH:mm')}
              </span>
            )}
          </div>

        </div>

        {/* Acciones */}
        <div className="shrink-0 flex flex-col gap-2">
          <button onClick={() => onPrint(enc)} title="Imprimir ticket"
            className="p-1.5 rounded text-gray-400 hover:text-[#064e3b] hover:bg-blue-50">
            <Printer size={15} />
          </button>
          {!entregado && (
            <button onClick={() => onEntregar(enc)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold whitespace-nowrap">
              <Package size={13} /> Entregar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type TabType  = 'pendientes' | 'historial'
type VistaType = 'lista' | 'exito-entrega'

export default function EncomiendaExternaPage() {
  const [tab,      setTab]      = useState<TabType>('pendientes')
  const [vista,    setVista]    = useState<VistaType>('lista')
  const [lista,    setLista]    = useState<EncomiendaExterna[]>([])
  const [cargando, setCargando] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  const [modalRegistrar, setModalRegistrar] = useState(false)
  const [modalEntrega,   setModalEntrega]   = useState<EncomiendaExterna | null>(null)
  const [entregaResult,  setEntregaResult]  = useState<{ enc: EncomiendaExterna; cobrado: boolean } | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const estado = tab === 'pendientes' ? 'PENDIENTE' : undefined
      const r = await encomiendaExternaService.getLista(estado)
      setLista(r.data ?? [])
    } catch {
      toast.error('Error cargando encomiendas externas')
    } finally {
      setCargando(false)
    }
  }, [tab])

  useEffect(() => { cargar() }, [cargar])

  const filtradas = busqueda.trim()
    ? lista.filter(e =>
        e.correlativo.toLowerCase().includes(busqueda.toLowerCase()) ||
        e.destinatarioNombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        e.conductorNombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        e.destinatarioDni.includes(busqueda)
      )
    : lista

  const pendientesCount = lista.filter(e => e.estado === 'PENDIENTE').length

  const handleRegistrarSuccess = (enc: EncomiendaExterna) => {
    setModalRegistrar(false)
    toast.success(`Registrado: ${enc.correlativo}`)
    cargar()
  }

  const handleEntregaSuccess = (enc: EncomiendaExterna, cobrado: boolean) => {
    setModalEntrega(null)
    setEntregaResult({ enc, cobrado })
    setVista('exito-entrega')
  }

  const imprimirTicket = async (enc: EncomiendaExterna) => {
    try {
      const blob = await encomiendaExternaService.getTicketPDF(enc.id)
      const url  = URL.createObjectURL(blob)
      window.open(url, '_blank')?.focus()
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch { toast.error('Error al generar ticket') }
  }

  // ── Success screen ──
  if (vista === 'exito-entrega' && entregaResult) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#064e3b] flex items-center justify-center">
            <PackageSearch size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Encomiendas Externas</h1>
            <p className="text-xs text-gray-500">Depósitos de conductores externos</p>
          </div>
        </div>
        <EntregaSuccess
          enc={entregaResult.enc}
          cobrado={entregaResult.cobrado}
          onVolver={() => { setEntregaResult(null); setVista('lista'); cargar() }}
          onPrint={() => imprimirTicket(entregaResult.enc)}
        />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#064e3b] flex items-center justify-center">
            <PackageSearch size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Encomiendas Externas</h1>
            <p className="text-xs text-gray-500">Depósitos de conductores externos para retiro</p>
          </div>
        </div>
        <button
          onClick={() => setModalRegistrar(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#064e3b] text-white text-sm rounded-lg hover:bg-[#16294d] transition-colors">
          <Plus size={16} /> Nueva encomienda
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-4">
        <button
          onClick={() => setTab('pendientes')}
          className={`relative px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'pendientes' ? 'border-[#064e3b] text-[#064e3b]' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}>
          Pendientes de retiro
          {pendientesCount > 0 && (
            <span className="ml-2 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full">
              {pendientesCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('historial')}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'historial' ? 'border-[#064e3b] text-[#064e3b]' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}>
          Historial completo
        </button>
      </div>

      {/* Barra de búsqueda */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por correlativo, conductor o destinatario..."
            className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button onClick={cargar}
          className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs rounded-lg">
          <RefreshCw size={13} /> Actualizar
        </button>
      </div>

      {/* Lista */}
      {cargando ? (
        <div className="flex justify-center items-center py-20 text-gray-400">
          <Loader2 size={24} className="animate-spin mr-2" /> Cargando...
        </div>
      ) : filtradas.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <PackageSearch size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            {tab === 'pendientes'
              ? 'No hay encomiendas pendientes de retiro'
              : 'No hay registros'}
          </p>
          {tab === 'pendientes' && (
            <button
              onClick={() => setModalRegistrar(true)}
              className="mt-4 flex items-center gap-2 mx-auto px-4 py-2 bg-[#064e3b] text-white text-sm rounded-lg hover:bg-[#16294d]">
              <Plus size={14} /> Registrar nueva
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtradas.map(enc => (
            <EncomiendaCard
              key={enc.id}
              enc={enc}
              onEntregar={e => setModalEntrega(e)}
              onPrint={imprimirTicket}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {modalRegistrar && (
        <ModalRegistrar
          onClose={() => setModalRegistrar(false)}
          onSuccess={handleRegistrarSuccess}
        />
      )}
      {modalEntrega && (
        <ModalEntrega
          enc={modalEntrega}
          onClose={() => setModalEntrega(null)}
          onSuccess={handleEntregaSuccess}
        />
      )}

    </div>
  )
}
