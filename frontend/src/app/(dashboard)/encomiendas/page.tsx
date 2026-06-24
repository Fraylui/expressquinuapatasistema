'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import useSWR from 'swr'
import toast from 'react-hot-toast'
import {
  Package, Plus, Search, X, ChevronRight, ChevronLeft, ChevronDown, ChevronUp,
  Printer, Check, Loader2, Eye, RefreshCw, CheckCircle2,
  Truck, Bell, MapPin, Clock, Tag, AlertTriangle, QrCode, Bus, Info,
} from 'lucide-react'
import {
  encomiendaService,
  type RegistrarEncomiendaDTO,
  type EntregarEncomiendaDTO,
  type ViajeEnTransito,
  type RecepcionItemDTO,
  type RecepcionResultado,
} from '@/services/encomiendas.service'
import { promocionesService, type PromocionDTO } from '@/services/promociones.service'
import { BuscadorCliente, type BuscadorClienteRef } from '@/components/modules/clientes/BuscadorCliente'
import type { Encomienda, Cliente, Agencia } from '@/types'
import api from '@/services/api'
import type { ApiResponse } from '@/types'
import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuthStore } from '@/stores/authStore'
import { useWebSocket } from '@/hooks/useWebSocket'

// ── Estado badge ──────────────────────────────────────────────────────────────
const ESTADO_CONFIG: Record<string, { label: string; color: string }> = {
  REGISTRADO:      { label: 'Registrado',      color: 'bg-blue-100 text-blue-800' },
  RECEPCIONADO:    { label: 'Recepcionado',     color: 'bg-indigo-100 text-indigo-800' },
  ALMACENADO:      { label: 'Almacenado',       color: 'bg-yellow-100 text-yellow-800' },
  CARGADO:         { label: 'Cargado',          color: 'bg-orange-100 text-orange-800' },
  EN_TRANSITO:     { label: 'En tránsito',      color: 'bg-purple-100 text-purple-800' },
  LLEGADO_AGENCIA: { label: 'Llegó agencia',    color: 'bg-cyan-100 text-cyan-800' },
  DISPONIBLE:      { label: 'Disponible',       color: 'bg-teal-100 text-teal-800' },
  ENTREGADO:       { label: 'Entregado',        color: 'bg-green-100 text-green-800' },
  OBSERVADO:       { label: 'Observado',        color: 'bg-red-100 text-red-800' },
  DEVUELTO:        { label: 'Devuelto',         color: 'bg-gray-100 text-gray-800' },
}

const FORMA_COBRO_LABELS: Record<string, string> = {
  EFECTIVO: 'Efectivo', TRANSFERENCIA: 'Transferencia',
  YAPE: 'Yape', PLIN: 'Plin', POR_COBRAR: 'Pago en destino',
}

type TipoEntidad = 'PERSONA_DNI' | 'PERSONA_CE' | 'EMPRESA_RUC'
function tipoToDoc(t: TipoEntidad): string {
  if (t === 'EMPRESA_RUC') return 'RUC'
  if (t === 'PERSONA_CE')  return 'CE'
  return 'DNI'
}

interface ViajeSimple {
  id: number
  estado: string
  fechaHoraSal: string
  ruta?: { origen: string; destino: string }
  vehiculo?: { placa: string; tipo: string }
}

type EncomiendaEnriquecida = Encomienda & {
  agenciaOrigenNombre?: string
  agenciaDestinoNombre?: string
  remitenteNombre?: string
  remitenteTel?: string
  destinatarioNombre?: string
  destinatarioTel?: string
  fechaLlegada?: string
  montoDescuento?: number
  promocionId?: number
  esFragil?: boolean
  [k: string]: any
}

// ── Registration success screen ───────────────────────────────────────────────
interface SuccessData {
  enc: EncomiendaEnriquecida
  remitenteNombre: string
  destinatarioNombre: string
  agenciaDestNombre: string
  descripcion: string
}

function RegistroSuccessScreen({ data, onNueva, onPrint, onEtiqueta }: {
  data: SuccessData
  onNueva: () => void
  onPrint: () => void
  onEtiqueta: () => void
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center space-y-5 max-w-md mx-auto">
      <div className="flex justify-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center">
          <CheckCircle2 size={32} className="text-emerald-500" />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold text-gray-900">¡Encomienda registrada!</h3>
        <p className="text-xs text-gray-400 mt-0.5">Código de seguimiento</p>
      </div>

      {/* Código tracking destacado */}
      <div className="bg-gradient-to-br from-[#064e3b] to-[#065f46] rounded-2xl px-6 py-4 text-white">
        <p className="text-[10px] text-emerald-300 font-semibold uppercase tracking-widest mb-1">Tracking</p>
        <p className="text-2xl font-black font-mono">{data.enc.codigoTracking}</p>
        <p className="text-sm font-bold text-emerald-200 mt-2">
          S/ {Number(data.enc.monto ?? data.enc.precioEnvio ?? 0).toFixed(2)}
          {' · '}
          <span className="font-normal">{FORMA_COBRO_LABELS[data.enc.formaCobro ?? ''] ?? data.enc.formaCobro}</span>
        </p>
      </div>

      <div className="bg-gray-50 rounded-xl border border-gray-100 text-left divide-y divide-gray-100">
        {[
          ['Remitente', data.remitenteNombre],
          ['Destinatario', data.destinatarioNombre],
          ['Contenido', data.descripcion],
          ['Destino', data.agenciaDestNombre],
        ].map(([label, value]) => (
          <div key={label} className="flex gap-3 px-4 py-2.5">
            <span className="text-xs font-semibold text-gray-400 w-24 shrink-0">{label}</span>
            <span className="text-xs text-gray-800 font-medium">{value}</span>
          </div>
        ))}
      </div>

      {data.enc.formaCobro === 'POR_COBRAR' && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 text-left">
          <p className="font-semibold mb-0.5">Pago en destino</p>
          <p>El cobro de <strong>S/ {Number(data.enc.monto ?? data.enc.precioEnvio ?? 0).toFixed(2)}</strong> lo realiza el operador destino al entregar.</p>
        </div>
      )}

      <div className="flex gap-3 justify-center flex-wrap">
        <button onClick={onPrint}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#064e3b] text-white text-sm rounded-xl hover:bg-[#065f46] transition-colors font-semibold">
          <Printer size={14} /> Comprobante
        </button>
        <button onClick={onEtiqueta}
          className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 text-white text-sm rounded-xl hover:bg-amber-700 transition-colors font-semibold">
          <QrCode size={14} /> Etiqueta paquete
        </button>
        <button onClick={onNueva}
          className="flex items-center gap-2 px-5 py-2.5 border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50 transition-colors">
          <Plus size={14} /> Nueva
        </button>
      </div>
    </div>
  )
}

// ── Delivery success screen ───────────────────────────────────────────────────
function EntregaSuccessScreen({ enc, cobrado, onVolver, onPrint }: {
  enc: EncomiendaEnriquecida
  cobrado: boolean
  onVolver: () => void
  onPrint: () => void
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center space-y-5 max-w-md mx-auto">
      <div className="flex justify-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center">
          <CheckCircle2 size={32} className="text-emerald-500" />
        </div>
      </div>
      <div>
        <h3 className="text-lg font-bold text-gray-900">¡Encomienda entregada!</h3>
        <p className="text-xs text-gray-400 font-mono mt-0.5">{enc.codigoTracking}</p>
      </div>

      <div className="bg-gray-50 rounded-xl border border-gray-100 text-left divide-y divide-gray-100">
        {[
          ['Recibió', enc.recibidoPorNombre ?? '—'],
          ['DNI', enc.recibidoPorDni ?? '—'],
          ['Fecha', enc.fechaEntregaReal ? format(new Date(enc.fechaEntregaReal), 'dd/MM/yyyy HH:mm') : '—'],
          ...(cobrado ? [['Cobrado', `S/ ${Number(enc.monto ?? enc.precioEnvio ?? 0).toFixed(2)} en caja`]] : []),
        ].map(([label, value]) => (
          <div key={label} className="flex gap-3 px-4 py-2.5">
            <span className="text-xs font-semibold text-gray-400 w-24 shrink-0">{label}</span>
            <span className="text-xs text-gray-800 font-medium">{value}</span>
          </div>
        ))}
      </div>

      {cobrado && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-medium flex items-center gap-2">
          <CheckCircle2 size={14} /> Cobro registrado automáticamente en caja
        </div>
      )}

      <div className="flex gap-3 justify-center">
        <button onClick={onPrint}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#064e3b] text-white text-sm rounded-xl hover:bg-[#065f46] transition-colors font-semibold">
          <Printer size={14} /> Comprobante de entrega
        </button>
        <button onClick={onVolver}
          className="flex items-center gap-2 px-5 py-2.5 border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50 transition-colors">
          Volver a la lista
        </button>
      </div>
    </div>
  )
}

// ── Wizard helpers ─────────────────────────────────────────────────────────────
const PASOS = ['Remitente', 'Destinatario', 'Paquete', 'Cobro', 'Confirmar']

interface FormState {
  tipoRemitente: TipoEntidad; remitente: Cliente | null
  tipoDestinatario: TipoEntidad; destinatario: Cliente | null
  descripcion: string; pesoKg: string; numBultos: string
  esFragil: boolean
  agenciaDestinoId: string; viajeId: string
  monto: string; formaCobro: string; observaciones: string
}
const INIT: FormState = {
  tipoRemitente: 'PERSONA_DNI', remitente: null,
  tipoDestinatario: 'PERSONA_DNI', destinatario: null,
  descripcion: '', pesoKg: '', numBultos: '1',
  esFragil: false,
  agenciaDestinoId: '', viajeId: '',
  monto: '', formaCobro: 'EFECTIVO', observaciones: '',
}

function TipoSelector({ value, onChange }: { value: TipoEntidad; onChange: (v: TipoEntidad) => void }) {
  return (
    <div className="flex gap-2 mb-3 flex-wrap">
      {(['PERSONA_DNI', 'PERSONA_CE', 'EMPRESA_RUC'] as TipoEntidad[]).map(t => (
        <button key={t} type="button" onClick={() => onChange(t)}
          className={`px-3 py-1 text-xs rounded-full border transition-colors ${
            value === t ? 'bg-[#064e3b] text-white border-[#064e3b]' : 'bg-white text-gray-600 border-gray-300 hover:border-[#064e3b]'
          }`}>
          {t === 'PERSONA_DNI' ? 'DNI' : t === 'PERSONA_CE' ? 'CE' : 'RUC/Empresa'}
        </button>
      ))}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 px-4 py-2.5">
      <span className="text-xs font-semibold text-gray-500 w-28 shrink-0">{label}</span>
      <span className="text-xs text-gray-800">{value}</span>
    </div>
  )
}

// ── Delivery modal ─────────────────────────────────────────────────────────────
function ModalEntrega({ enc, onClose, onSuccess }: {
  enc: EncomiendaEnriquecida
  onClose: () => void
  onSuccess: (result: { enc: EncomiendaEnriquecida; cobrado: boolean }) => void
}) {
  const [dniReceptor, setDniReceptor] = useState('')
  const [nombreReceptor, setNombreReceptor] = useState('')
  const [nota, setNota] = useState('')
  const [formaPago, setFormaPago] = useState('EFECTIVO')
  const [buscandoDni, setBuscandoDni] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const esPorCobrar = enc.formaCobro === 'POR_COBRAR'

  const buscarPorDni = async () => {
    if (dniReceptor.length !== 8) return
    setBuscandoDni(true)
    try {
      const r = await api.get<any, ApiResponse<any>>('/api/clientes/buscar', {
        params: { dni: dniReceptor }
      })
      if (r.data) {
        const c = r.data
        setNombreReceptor(c.razonSocial ?? `${c.apellidos ?? ''} ${c.nombres ?? ''}`.trim())
      }
    } catch {
      // not found — leave nombre empty for manual entry
    } finally {
      setBuscandoDni(false)
    }
  }

  const handleDniBlur = () => {
    if (dniReceptor.length === 8 && !nombreReceptor) buscarPorDni()
  }

  const confirmar = async () => {
    if (!dniReceptor || !nombreReceptor) {
      toast.error('DNI y nombre del receptor son obligatorios')
      return
    }
    setGuardando(true)
    try {
      const dto: EntregarEncomiendaDTO = {
        dniReceptor,
        nombreReceptor,
        nota: nota || undefined,
        formaPago: esPorCobrar ? formaPago : undefined,
      }
      const r = await encomiendaService.entregar(enc.id, dto)
      const result = r.data
      onSuccess({
        enc: { ...enc, ...result.encomienda },
        cobrado: result.cobrado,
      })
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Error al registrar entrega')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900">Registrar entrega</h3>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{enc.codigoTracking}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Resumen del paquete */}
          <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-1">
            <div className="flex gap-2">
              <span className="text-gray-500 w-20 shrink-0">Remitente:</span>
              <span className="font-medium text-gray-800">{enc.remitenteNombre ?? `ID ${enc.remitenteId}`}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500 w-20 shrink-0">Destinatario:</span>
              <span className="font-medium text-gray-800">{enc.destinatarioNombre ?? `ID ${enc.destinatarioId}`}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500 w-20 shrink-0">Contenido:</span>
              <span className="text-gray-700">{enc.descripcion}</span>
            </div>
            {esPorCobrar && (
              <div className="flex gap-2">
                <span className="text-gray-500 w-20 shrink-0">A cobrar:</span>
                <span className="font-bold text-amber-700">S/ {Number(enc.monto ?? enc.precioEnvio ?? 0).toFixed(2)} <span className="text-amber-600 font-normal">(pago en destino)</span></span>
              </div>
            )}
          </div>

          {/* Receptor */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">DNI del receptor *</label>
            <div className="flex gap-2">
              <input
                value={dniReceptor}
                onChange={e => setDniReceptor(e.target.value.replace(/\D/g, '').slice(0, 8))}
                onKeyDown={e => e.key === 'Enter' && buscarPorDni()}
                onBlur={handleDniBlur}
                placeholder="12345678"
                maxLength={8}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-[#064e3b]/30 focus:border-[#064e3b] focus:outline-none"
              />
              <button onClick={buscarPorDni} disabled={dniReceptor.length !== 8 || buscandoDni}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg disabled:opacity-50 flex items-center gap-1">
                {buscandoDni ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                Buscar
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nombre del receptor *</label>
            <input
              value={nombreReceptor}
              onChange={e => setNombreReceptor(e.target.value)}
              placeholder="Apellidos y nombres"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#064e3b]/30 focus:border-[#064e3b] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nota (opcional)</label>
            <textarea
              value={nota}
              onChange={e => setNota(e.target.value)}
              rows={2}
              placeholder="Observaciones sobre la entrega..."
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none focus:ring-2 focus:ring-[#064e3b]/30 focus:border-[#064e3b] focus:outline-none"
            />
          </div>

          {/* Pago en destino */}
          {esPorCobrar && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
              <div className="flex items-start gap-2 text-xs">
                <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-900">Cobrar S/ {Number(enc.monto ?? enc.precioEnvio ?? 0).toFixed(2)} al entregar</p>
                  <p className="text-amber-700 mt-0.5">El cobro ingresará a tu caja activa. <strong>Debes tener turno abierto.</strong></p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Forma de pago recibida *</label>
                <div className="flex gap-2 flex-wrap">
                  {['EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA'].map(f => (
                    <button key={f} type="button" onClick={() => setFormaPago(f)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        formaPago === f ? 'bg-[#064e3b] text-white border-[#064e3b]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#064e3b]'
                      }`}>
                      {f.charAt(0) + f.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button onClick={confirmar} disabled={guardando || !dniReceptor || !nombreReceptor}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm rounded-xl hover:bg-emerald-700 disabled:opacity-50 font-semibold transition-colors">
            {guardando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Confirmar entrega
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Para entregar tab ──────────────────────────────────────────────────────────
type FiltroEntrega = 'todos' | 'EN_TRANSITO' | 'LLEGADO_AGENCIA' | 'DISPONIBLE' | 'ENTREGADO'

function ParaEntregarTab({ onEntregaSuccess, onCountChange }: {
  onEntregaSuccess: (enc: EncomiendaEnriquecida, cobrado: boolean) => void
  onCountChange?: (n: number) => void
}) {
  const [lista, setLista] = useState<EncomiendaEnriquecida[]>([])
  const [cargando, setCargando] = useState(false)
  const [filtro, setFiltro] = useState<FiltroEntrega>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [accionando, setAccionando] = useState<number | null>(null)
  const [modalEntrega, setModalEntrega] = useState<EncomiendaEnriquecida | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const r = await encomiendaService.getParaEntrega()
      const data = (r.data ?? []) as EncomiendaEnriquecida[]
      setLista(data)
      onCountChange?.(data.length)
    } catch { toast.error('Error cargando encomiendas para entrega') }
    finally { setCargando(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const porEstado = filtro === 'todos'
    ? lista.filter(e => e.estado !== 'ENTREGADO')
    : lista.filter(e => e.estado === filtro)
  const filtradas = busqueda.trim()
    ? porEstado.filter(e =>
        e.codigoTracking?.toLowerCase().includes(busqueda.toLowerCase()) ||
        e.destinatarioNombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
        e.remitenteNombre?.toLowerCase().includes(busqueda.toLowerCase())
      )
    : porEstado

  const marcarLlegada = async (enc: EncomiendaEnriquecida) => {
    setAccionando(enc.id)
    try {
      await encomiendaService.marcarLlegada(enc.id)
      toast.success('Llegada confirmada')
      cargar()
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Error')
    } finally { setAccionando(null) }
  }

  const marcarDisponible = async (enc: EncomiendaEnriquecida) => {
    setAccionando(enc.id)
    try {
      await encomiendaService.marcarDisponible(enc.id)
      toast.success('Marcado como disponible')
      cargar()
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Error')
    } finally { setAccionando(null) }
  }

  const handleEntregaSuccess = (result: { enc: EncomiendaEnriquecida; cobrado: boolean }) => {
    setModalEntrega(null)
    cargar()
    onEntregaSuccess(result.enc, result.cobrado)
  }

  const FILTROS: { key: FiltroEntrega; label: string }[] = [
    { key: 'todos',           label: 'Todos' },
    { key: 'EN_TRANSITO',     label: 'En tránsito' },
    { key: 'LLEGADO_AGENCIA', label: 'Llegaron' },
    { key: 'DISPONIBLE',      label: 'Disponibles' },
    { key: 'ENTREGADO',       label: 'Entregadas hoy' },
  ]

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Segmented control */}
        <div className="flex items-center gap-0.5 p-1 bg-gray-100 rounded-xl flex-wrap">
          {FILTROS.map(f => {
            const count = f.key !== 'todos'
              ? lista.filter(e => e.estado === f.key).length
              : lista.filter(e => e.estado !== 'ENTREGADO').length
            return (
              <button key={f.key} onClick={() => setFiltro(f.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
                  filtro === f.key
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}>
                {f.label}
                {count > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none ${
                    filtro === f.key
                      ? f.key === 'DISPONIBLE' ? 'bg-teal-100 text-teal-700' : f.key === 'ENTREGADO' ? 'bg-emerald-100 text-emerald-700' : 'bg-[#064e3b]/10 text-[#064e3b]'
                      : 'bg-gray-200 text-gray-500'
                  }`}>{count}</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Búsqueda */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar tracking, remitente, destinatario…"
            className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-[#064e3b]/30 focus:border-[#064e3b] focus:outline-none transition-colors" />
        </div>

        <button onClick={cargar}
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-xs text-gray-500 hover:bg-gray-50 transition-colors shrink-0">
          <RefreshCw size={12} /> Actualizar
        </button>
      </div>

      {/* Cards */}
      {cargando ? (
        <div className="flex justify-center items-center py-16 text-gray-400">
          <Loader2 size={22} className="animate-spin mr-2" /> Cargando…
        </div>
      ) : filtradas.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <Truck size={22} className="text-gray-300" />
          </div>
          <p className="text-sm text-gray-500 font-medium">
            {filtro !== 'todos' ? 'Sin encomiendas con este estado' : 'Sin encomiendas para entregar'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtradas.map(enc => {
            const cfg = ESTADO_CONFIG[enc.estado] ?? { label: enc.estado, color: 'bg-gray-100 text-gray-800' }
            const tiempoLlegada = enc.fechaLlegada
              ? formatDistanceToNow(new Date(enc.fechaLlegada), { addSuffix: true, locale: es })
              : null
            const isActuando = accionando === enc.id
            const esEntregado = enc.estado === 'ENTREGADO'
            const esDisponible = enc.estado === 'DISPONIBLE'

            // Color de franja según estado
            const franjaColor = esEntregado ? 'bg-emerald-400'
              : esDisponible ? 'bg-teal-500'
              : enc.estado === 'EN_TRANSITO' ? 'bg-purple-400'
              : enc.estado === 'LLEGADO_AGENCIA' ? 'bg-cyan-400'
              : 'bg-gray-300'

            return (
              <div key={enc.id} className={`rounded-2xl border overflow-hidden transition-all ${
                esEntregado ? 'bg-emerald-50/50 border-emerald-200 opacity-80'
                : esDisponible ? 'bg-white border-teal-200 shadow-sm ring-1 ring-teal-100'
                : 'bg-white border-gray-200'
              }`}>
                {/* Franja de estado */}
                <div className={`h-1 w-full ${franjaColor}`} />

                <div className="p-4 flex items-start gap-4">
                  {/* Info principal */}
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Código + badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-mono text-xs font-bold ${esEntregado ? 'text-emerald-700' : 'text-[#064e3b]'}`}>
                        {enc.codigoTracking}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.color}`}>{cfg.label}</span>
                      {esDisponible && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-teal-600 text-white">
                          Listo p/entregar
                        </span>
                      )}
                      {enc.formaCobro === 'POR_COBRAR' && !esEntregado && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700">
                          Cobrar S/ {Number(enc.monto ?? enc.precioEnvio ?? 0).toFixed(2)}
                        </span>
                      )}
                      {enc.esFragil && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-yellow-100 text-yellow-700">
                          <AlertTriangle size={10} /> Frágil
                        </span>
                      )}
                    </div>

                    {/* Datos */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <div className="text-gray-600">
                        <span className="text-gray-400 mr-1">De:</span>
                        <span className="font-medium">{enc.remitenteNombre ?? `ID ${enc.remitenteId}`}</span>
                      </div>
                      <div className="text-gray-600">
                        <span className="text-gray-400 mr-1">Para:</span>
                        <span className="font-medium">{enc.destinatarioNombre ?? `ID ${enc.destinatarioId}`}</span>
                        {enc.destinatarioTel && (
                          <span className="text-[#064e3b] font-medium ml-1">· {enc.destinatarioTel}</span>
                        )}
                      </div>
                      <div className="col-span-2 text-gray-500">{enc.descripcion}
                        {enc.pesoKg && <span className="ml-2 text-gray-400">· {enc.pesoKg} kg{enc.numBultos && enc.numBultos > 1 ? ` · ${enc.numBultos} bultos` : ''}</span>}
                      </div>
                      {esEntregado && enc.recibidoPorNombre && (
                        <div className="col-span-2 flex items-center gap-1 text-emerald-700 font-medium">
                          <Check size={11} />
                          Recibió: {enc.recibidoPorNombre}
                          {enc.recibidoPorDni && <span className="text-emerald-600 font-normal"> (DNI {enc.recibidoPorDni})</span>}
                          {enc.fechaEntregaReal && <span className="text-emerald-600 font-normal ml-1">· {format(new Date(enc.fechaEntregaReal), 'HH:mm', { locale: es })}</span>}
                        </div>
                      )}
                    </div>

                    {tiempoLlegada && !esEntregado && (
                      <div className="flex items-center gap-1 text-[11px] text-gray-400">
                        <Clock size={10} /> Llegó {tiempoLlegada}
                      </div>
                    )}
                  </div>

                  {/* Acción */}
                  <div className="shrink-0">
                    {enc.estado === 'EN_TRANSITO' && (
                      <button onClick={() => marcarLlegada(enc)} disabled={isActuando}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs bg-cyan-600 text-white rounded-xl hover:bg-cyan-700 disabled:opacity-50 whitespace-nowrap transition-colors font-medium">
                        {isActuando ? <Loader2 size={12} className="animate-spin" /> : <MapPin size={12} />}
                        Confirmar llegada
                      </button>
                    )}
                    {enc.estado === 'LLEGADO_AGENCIA' && (
                      <button onClick={() => marcarDisponible(enc)} disabled={isActuando}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 whitespace-nowrap transition-colors font-medium">
                        {isActuando ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        Marcar disponible
                      </button>
                    )}
                    {enc.estado === 'DISPONIBLE' && (
                      <button onClick={() => setModalEntrega(enc)}
                        className="flex items-center gap-1.5 px-4 py-2.5 text-sm bg-[#064e3b] text-white rounded-xl hover:bg-[#065f46] font-semibold whitespace-nowrap shadow-sm transition-colors">
                        <Package size={14} /> Entregar
                      </button>
                    )}
                    {esEntregado && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-xl text-xs font-semibold">
                        <CheckCircle2 size={13} /> Entregado
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Delivery modal */}
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

// ── Enviadas tab (list) ────────────────────────────────────────────────────────
const ESTADOS_DEVOLVIBLES = ['REGISTRADO', 'RECEPCIONADO', 'ALMACENADO', 'OBSERVADO']

const HISTORIAL_ESTADO_COLOR: Record<string, string> = {
  REGISTRADO:      'bg-blue-100 text-blue-700',
  RECEPCIONADO:    'bg-indigo-100 text-indigo-700',
  ALMACENADO:      'bg-yellow-100 text-yellow-700',
  CARGADO:         'bg-orange-100 text-orange-700',
  EN_TRANSITO:     'bg-purple-100 text-purple-700',
  LLEGADO_AGENCIA: 'bg-cyan-100 text-cyan-700',
  DISPONIBLE:      'bg-teal-100 text-teal-700',
  ENTREGADO:       'bg-green-100 text-green-700',
  OBSERVADO:       'bg-red-100 text-red-700',
  DEVUELTO:        'bg-gray-100 text-gray-700',
}

function EnviadasTab({ viajes = [] }: { viajes?: ViajeSimple[] }) {
  const [lista, setLista] = useState<EncomiendaEnriquecida[]>([])
  const [cargando, setCargando] = useState(false)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroQ, setFiltroQ] = useState('')
  const [filtroDe, setFiltroDe] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')
  const [imprimiendo, setImprimiendo] = useState<number | null>(null)
  const [devolviendo, setDevolviendo] = useState<number | null>(null)
  const [confirmDevolver, setConfirmDevolver] = useState<number | null>(null)
  const [historialesAbiertos, setHistorialesAbiertos] = useState<Set<number>>(new Set())
  const [historiales, setHistoriales] = useState<Record<number, any[]>>({})
  const [asignandoViaje, setAsignandoViaje] = useState<number | null>(null)

  const cargarLista = async () => {
    setCargando(true)
    try {
      const r = await encomiendaService.getLista({
        estado: filtroEstado || undefined,
        q: filtroQ || undefined,
        desde: filtroDe || undefined,
        hasta: filtroHasta || undefined,
      })
      setLista((r.data ?? []) as EncomiendaEnriquecida[])
    } catch { toast.error('Error cargando lista') }
    finally { setCargando(false) }
  }

  const imprimirEtiqueta = async (encId: number) => {
    try {
      const blob = await encomiendaService.getEtiquetaPDF(encId)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')?.focus()
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch { toast.error('Error al generar etiqueta') }
  }

  useEffect(() => { cargarLista() }, [filtroEstado])

  const toggleHistorial = async (encId: number) => {
    const nuevos = new Set(historialesAbiertos)
    if (nuevos.has(encId)) { nuevos.delete(encId); setHistorialesAbiertos(nuevos); return }
    nuevos.add(encId)
    setHistorialesAbiertos(nuevos)
    if (!historiales[encId]) {
      try {
        const r = await encomiendaService.getHistorial(encId)
        setHistoriales(prev => ({ ...prev, [encId]: r.data ?? [] }))
      } catch { toast.error('Error cargando historial') }
    }
  }

  const asignarViajeEnc = async (encId: number, viajeId: string) => {
    setAsignandoViaje(encId)
    try {
      await api.patch(`/api/encomiendas/${encId}/asignar-viaje`, {
        viajeId: viajeId ? parseInt(viajeId) : null
      })
      toast.success(viajeId ? 'Viaje asignado' : 'Viaje removido')
      cargarLista()
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Error al asignar viaje')
    } finally { setAsignandoViaje(null) }
  }

  const devolverEncomienda = async (encId: number) => {
    setDevolviendo(encId)
    try {
      await encomiendaService.cambiarEstado(encId, 'DEVUELTO', 'Devuelto al remitente')
      toast.success('Encomienda marcada como devuelta')
      setConfirmDevolver(null)
      cargarLista()
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Error al devolver')
    } finally { setDevolviendo(null) }
  }

  const imprimirComprobante = async (encId: number) => {
    setImprimiendo(encId)
    try {
      const blob = await encomiendaService.getComprobantePDF(encId)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')?.focus()
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch { toast.error('Error al generar comprobante') }
    finally { setImprimiendo(null) }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">Tracking o contenido</label>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={filtroQ} onChange={e => setFiltroQ(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && cargarLista()} placeholder="EXP-2026-…"
              className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#064e3b]/30 focus:border-[#064e3b] focus:outline-none transition-colors" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">Estado</label>
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white transition-colors focus:ring-2 focus:ring-[#064e3b]/30 focus:border-[#064e3b] focus:outline-none">
            <option value="">Todos</option>
            {Object.entries(ESTADO_CONFIG).map(([k, { label }]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">Desde</label>
          <input type="date" value={filtroDe} onChange={e => setFiltroDe(e.target.value)}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#064e3b]/30 focus:border-[#064e3b] focus:outline-none transition-colors" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">Hasta</label>
          <input type="date" value={filtroHasta} onChange={e => setFiltroHasta(e.target.value)}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#064e3b]/30 focus:border-[#064e3b] focus:outline-none transition-colors" />
        </div>
        <button onClick={cargarLista}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-[#064e3b] text-white text-sm rounded-xl hover:bg-[#065f46] transition-colors font-semibold">
          <Search size={13} /> Buscar
        </button>
        {(filtroQ || filtroEstado || filtroDe || filtroHasta) && (
          <button onClick={() => { setFiltroQ(''); setFiltroEstado(''); setFiltroDe(''); setFiltroHasta(''); }}
            className="flex items-center gap-1.5 px-3 py-2.5 border border-gray-200 text-gray-500 text-sm rounded-xl hover:bg-gray-50 transition-colors">
            <X size={13} /> Limpiar
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {cargando ? (
          <div className="flex justify-center items-center py-16 text-gray-400">
            <Loader2 size={22} className="animate-spin mr-2" /> Cargando…
          </div>
        ) : lista.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <Package size={20} className="text-gray-300" />
            </div>
            <p className="text-sm text-gray-500 font-medium">Sin encomiendas</p>
            <p className="text-xs text-gray-400 mt-1">Ajusta los filtros o registra una nueva</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Tracking', 'Remitente', 'Destinatario', 'Destino', 'Estado', 'Monto', 'Fecha', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lista.map(enc => {
                  const cfg = ESTADO_CONFIG[enc.estado] ?? { label: enc.estado, color: 'bg-gray-100 text-gray-800' }
                  const histAbierto = historialesAbiertos.has(enc.id)
                  const hist = historiales[enc.id] ?? []
                  const tieneDescuento = enc.montoDescuento && Number(enc.montoDescuento) > 0
                  return (
                    <React.Fragment key={enc.id}>
                      <tr className="hover:bg-gray-50/60 transition-colors group">
                        <td className="px-4 py-3">
                          <p className="font-mono text-xs font-bold text-[#064e3b]">{enc.codigoTracking}</p>
                          {enc.descripcion && (
                            <p className="text-[10px] text-gray-400 truncate max-w-[100px] mt-0.5" title={enc.descripcion}>{enc.descripcion}</p>
                          )}
                          {enc.esFragil && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-yellow-600 font-semibold mt-0.5">
                              <AlertTriangle size={9} /> Frágil
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-800 text-xs max-w-[130px] truncate font-medium">{enc.remitenteNombre ?? `ID ${enc.remitenteId}`}</td>
                        <td className="px-4 py-3 text-gray-800 text-xs max-w-[130px] truncate font-medium">{enc.destinatarioNombre ?? `ID ${enc.destinatarioId}`}</td>
                        <td className="px-4 py-3 text-xs max-w-[150px]">
                          <p className="text-gray-500 truncate">{enc.agenciaDestinoNombre ?? '—'}</p>
                          {enc.estado === 'REGISTRADO' && (
                            <select
                              defaultValue={enc.viajeId ?? ''}
                              disabled={asignandoViaje === enc.id}
                              onChange={e => asignarViajeEnc(enc.id, e.target.value)}
                              className="mt-1 w-full text-[10px] border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-600 focus:ring-1 focus:ring-emerald-400 cursor-pointer disabled:opacity-50"
                              title="Asignar viaje"
                            >
                              <option value="">{enc.viajeId ? `Viaje #${enc.viajeId}` : 'Sin viaje'}</option>
                              {viajes.filter(v => v.estado === 'PROGRAMADO' || v.estado === 'EN_RUTA').map(v => (
                                <option key={v.id} value={v.id}>
                                  {v.ruta?.origen ?? '?'}→{v.ruta?.destino ?? '?'} {v.vehiculo?.placa ?? ''} {v.fechaHoraSal ? format(new Date(v.fechaHoraSal), 'HH:mm') : ''}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.color}`}>{cfg.label}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="font-mono text-xs font-semibold text-gray-800 tabular-nums">
                            S/ {Number(enc.precioEnvio ?? enc.monto ?? 0).toFixed(2)}
                          </p>
                          {tieneDescuento && (
                            <p className="text-[10px] text-green-600 font-medium">
                              −S/ {Number(enc.montoDescuento).toFixed(2)}
                            </p>
                          )}
                          {enc.formaCobro === 'POR_COBRAR' && (
                            <p className="text-[10px] text-amber-600 font-medium">En destino</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[11px] text-gray-400 whitespace-nowrap">
                          {enc.fechaRegistro ? format(new Date(enc.fechaRegistro), 'dd/MM/yy HH:mm') : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {/* Historial */}
                            <button onClick={() => toggleHistorial(enc.id)}
                              title={histAbierto ? 'Ocultar historial' : 'Ver historial'}
                              className={`p-1.5 rounded-lg transition-colors ${histAbierto ? 'text-[#064e3b] bg-emerald-50' : 'text-gray-400 hover:text-[#064e3b] hover:bg-emerald-50'}`}>
                              <Eye size={13} />
                            </button>
                            {/* Etiqueta */}
                            <button onClick={() => imprimirEtiqueta(enc.id)}
                              title="Imprimir etiqueta del paquete"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors">
                              <QrCode size={13} />
                            </button>
                            {/* Imprimir */}
                            <button onClick={() => imprimirComprobante(enc.id)} disabled={imprimiendo === enc.id}
                              title="Imprimir comprobante"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-[#064e3b] hover:bg-emerald-50 disabled:opacity-40 transition-colors">
                              {imprimiendo === enc.id ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />}
                            </button>
                            {/* Devolver */}
                            {ESTADOS_DEVOLVIBLES.includes(enc.estado) && (
                              confirmDevolver === enc.id ? (
                                <span className="flex items-center gap-1">
                                  <button onClick={() => devolverEncomienda(enc.id)} disabled={devolviendo === enc.id}
                                    className="flex items-center gap-1 px-2 py-1 text-[10px] bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors">
                                    {devolviendo === enc.id && <Loader2 size={10} className="animate-spin" />}
                                    Sí
                                  </button>
                                  <button onClick={() => setConfirmDevolver(null)}
                                    className="px-2 py-1 text-[10px] border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 transition-colors">
                                    No
                                  </button>
                                </span>
                              ) : (
                                <button onClick={() => setConfirmDevolver(enc.id)} title="Devolver al remitente"
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                                  <X size={13} />
                                </button>
                              )
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* ── Fila de historial expandible ── */}
                      {histAbierto && (
                        <tr className="bg-gray-50/80">
                          <td colSpan={8} className="px-6 py-3">
                            {hist.length === 0 ? (
                              <p className="text-xs text-gray-400 italic">Cargando historial…</p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {hist.map((h: any, idx: number) => (
                                  <div key={idx} className="flex items-center gap-1.5 text-[11px]">
                                    {h.estadoAnterior && (
                                      <>
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${HISTORIAL_ESTADO_COLOR[h.estadoAnterior] ?? 'bg-gray-100 text-gray-600'}`}>
                                          {ESTADO_CONFIG[h.estadoAnterior]?.label ?? h.estadoAnterior}
                                        </span>
                                        <span className="text-gray-300">→</span>
                                      </>
                                    )}
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${HISTORIAL_ESTADO_COLOR[h.estadoNuevo] ?? 'bg-gray-100 text-gray-600'}`}>
                                      {ESTADO_CONFIG[h.estadoNuevo]?.label ?? h.estadoNuevo}
                                    </span>
                                    <span className="text-gray-400">
                                      {h.createdAt ? format(new Date(h.createdAt), 'dd/MM HH:mm') : ''}
                                    </span>
                                    {h.observacion && (
                                      <span className="text-gray-500 italic truncate max-w-[160px]" title={h.observacion}>
                                        · {h.observacion}
                                      </span>
                                    )}
                                    {idx < hist.length - 1 && <span className="text-gray-200 mx-1">|</span>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Recepcionar Tab ───────────────────────────────────────────────────────────

interface EstadoRecepcion {
  recibido: boolean
  observacion: string
}

function RecepcionarTab({ onBadgeChange }: { onBadgeChange?: (n: number) => void }) {
  const [viajes, setViajes] = useState<ViajeEnTransito[]>([])
  const [cargando, setCargando] = useState(false)
  const [viajeExpandido, setViajeExpandido] = useState<number | null>(null)
  const [estados, setEstados] = useState<Record<number, Record<number, EstadoRecepcion>>>({})
  const [procesando, setProcesando] = useState<number | null>(null)
  const [resultados, setResultados] = useState<Record<number, RecepcionResultado>>({})

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const data = await encomiendaService.getViajesEnTransito()
      setViajes(data)
      onBadgeChange?.(data.length)
      // Init estado: todos marcados como recibido por defecto
      const init: Record<number, Record<number, EstadoRecepcion>> = {}
      data.forEach(v => {
        init[v.viajeId] = {}
        v.encomiendas.forEach((e: any) => {
          init[v.viajeId][e.id] = { recibido: true, observacion: '' }
        })
      })
      setEstados(init)
    } catch {
      toast.error('Error cargando viajes en tránsito')
    } finally {
      setCargando(false)
    }
  }, [onBadgeChange])

  useEffect(() => { cargar() }, [cargar])

  const toggleViaje = (viajeId: number) =>
    setViajeExpandido(v => v === viajeId ? null : viajeId)

  const toggleRecibido = (viajeId: number, encId: number) =>
    setEstados(prev => ({
      ...prev,
      [viajeId]: {
        ...prev[viajeId],
        [encId]: { ...prev[viajeId][encId], recibido: !prev[viajeId][encId].recibido },
      },
    }))

  const setObservacion = (viajeId: number, encId: number, obs: string) =>
    setEstados(prev => ({
      ...prev,
      [viajeId]: {
        ...prev[viajeId],
        [encId]: { ...prev[viajeId][encId], observacion: obs },
      },
    }))

  const confirmarRecepcion = async (viaje: ViajeEnTransito) => {
    const estadosViaje = estados[viaje.viajeId] ?? {}
    const items: RecepcionItemDTO[] = viaje.encomiendas.map((e: any) => ({
      encomiendaId: e.id,
      recibido: estadosViaje[e.id]?.recibido ?? true,
      observacion: estadosViaje[e.id]?.observacion || undefined,
    }))

    const faltantes = items.filter(i => !i.recibido).length
    if (faltantes > 0) {
      const faltantesConMotivo = items.filter(i => !i.recibido && !i.observacion)
      if (faltantesConMotivo.length > 0) {
        toast.error(`Ingresa el motivo para los ${faltantesConMotivo.length} paquete(s) no recibido(s)`)
        return
      }
    }

    setProcesando(viaje.viajeId)
    try {
      const resultado = await encomiendaService.recepcionar(viaje.viajeId, items)
      setResultados(prev => ({ ...prev, [viaje.viajeId]: resultado }))
      // Remove the processed viaje from list
      setViajes(prev => prev.filter(v => v.viajeId !== viaje.viajeId))
      onBadgeChange?.(viajes.length - 1)
      if (resultado.faltantes === 0) {
        toast.success(`✓ ${resultado.recibidas} encomienda(s) recibidas correctamente`)
      } else {
        toast.error(`${resultado.faltantes} encomienda(s) no llegaron — marcadas como OBSERVADO`)
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Error al procesar recepción')
    } finally {
      setProcesando(null)
    }
  }

  const formatHora = (iso?: string) => {
    if (!iso) return '—'
    try { return format(new Date(iso), 'dd/MM HH:mm', { locale: es }) } catch { return '—' }
  }

  if (cargando) {
    return (
      <div className="flex justify-center items-center py-20 text-gray-400">
        <Loader2 size={22} className="animate-spin mr-2" /> Cargando viajes en tránsito…
      </div>
    )
  }

  // Show completed results
  const completados = Object.entries(resultados)
  if (viajes.length === 0 && completados.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={28} className="text-emerald-500" />
        </div>
        <p className="text-base font-bold text-gray-800 dark:text-slate-200">Sin viajes pendientes de recepción</p>
        <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
          Todas las encomiendas en tránsito ya fueron recibidas o no hay envíos hacia esta agencia.
        </p>
        <button onClick={cargar}
          className="mt-4 flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-[#334155] rounded-xl text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-[#293548] transition-colors mx-auto">
          <RefreshCw size={13} /> Actualizar
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {viajes.length > 0
              ? `${viajes.length} viaje(s) con encomiendas pendientes de verificar`
              : 'Todos los viajes procesados'}
          </p>
        </div>
        <button onClick={cargar}
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-[#334155] rounded-xl text-xs text-gray-500 hover:bg-gray-50 dark:hover:bg-[#293548] transition-colors">
          <RefreshCw size={12} /> Actualizar
        </button>
      </div>

      {/* Completed results */}
      {completados.length > 0 && (
        <div className="space-y-2">
          {completados.map(([vId, res]) => (
            <div key={vId} className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${
              res.faltantes > 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'
            }`}>
              {res.faltantes > 0
                ? <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                : <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />}
              <div className="flex-1 text-sm">
                <span className="font-semibold">Viaje #{vId} procesado:</span>
                <span className="ml-2 text-emerald-700 font-medium">{res.recibidas} recibidas</span>
                {res.faltantes > 0 && (
                  <>
                    <span className="mx-1.5 text-gray-300">·</span>
                    <span className="text-amber-700 font-medium">{res.faltantes} faltantes</span>
                    <span className="ml-2 text-amber-600 text-xs">{res.codigosFaltantes.join(', ')}</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Viajes pendientes */}
      {viajes.map(viaje => {
        const expandido = viajeExpandido === viaje.viajeId
        const estadosViaje = estados[viaje.viajeId] ?? {}
        const procesandoEste = procesando === viaje.viajeId
        const pendientes = Object.values(estadosViaje).filter(e => !e.recibido).length

        return (
          <div key={viaje.viajeId}
            className="bg-white dark:bg-[#1e293b] rounded-2xl border border-gray-200 dark:border-[#334155] overflow-hidden shadow-sm">

            {/* Franja superior */}
            <div className="h-1 w-full bg-purple-400" />

            {/* Header del viaje */}
            <button
              onClick={() => toggleViaje(viaje.viajeId)}
              className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50/50 dark:hover:bg-[#293548]/50 transition-colors text-left">

              {/* Ícono */}
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center shrink-0">
                <Truck size={18} className="text-purple-600 dark:text-purple-400" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-gray-900 dark:text-slate-100 text-sm">
                    {viaje.rutaOrigen ?? '—'} → {viaje.rutaDestino ?? '—'}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium">
                    En tránsito
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400 dark:text-slate-500">
                  {viaje.vehiculoPlaca && (
                    <span className="flex items-center gap-1">
                      <Bus size={11} /> {viaje.vehiculoPlaca} · {viaje.vehiculoTipo}
                    </span>
                  )}
                  {viaje.fechaHoraSal && (
                    <span className="flex items-center gap-1">
                      <Clock size={11} /> {formatHora(viaje.fechaHoraSal)}
                    </span>
                  )}
                </div>
              </div>

              {/* Count + chevron */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <span className="text-lg font-black text-gray-900 dark:text-slate-100 tabular-nums">
                    {viaje.totalEncomiendas}
                  </span>
                  <p className="text-[10px] text-gray-400 dark:text-slate-500 leading-none">paquetes</p>
                </div>
                {pendientes > 0 && (
                  <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                    {pendientes} sin recibir
                  </span>
                )}
                {expandido
                  ? <ChevronUp size={16} className="text-gray-400" />
                  : <ChevronDown size={16} className="text-gray-400" />}
              </div>
            </button>

            {/* Checklist expandido */}
            {expandido && (
              <div className="border-t border-gray-100 dark:border-[#293548]">

                {/* Instrucción */}
                <div className="px-5 py-3 bg-blue-50 dark:bg-blue-900/10 flex items-start gap-2">
                  <Info size={13} className="text-blue-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Verifica físicamente cada paquete. Desmarca los que <strong>no llegaron</strong> e ingresa el motivo.
                  </p>
                </div>

                {/* Lista de encomiendas */}
                <div className="divide-y divide-gray-50 dark:divide-[#293548]">
                  {viaje.encomiendas.map((enc: any) => {
                    const estado = estadosViaje[enc.id] ?? { recibido: true, observacion: '' }
                    return (
                      <div key={enc.id} className={`px-5 py-3 transition-colors ${
                        !estado.recibido ? 'bg-red-50/50 dark:bg-red-900/10' : ''
                      }`}>
                        <div className="flex items-start gap-3">
                          {/* Checkbox */}
                          <button
                            onClick={() => toggleRecibido(viaje.viajeId, enc.id)}
                            className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                              estado.recibido
                                ? 'bg-emerald-500 border-emerald-500 shadow-sm'
                                : 'border-red-400 bg-red-50 dark:bg-red-900/20'
                            }`}>
                            {estado.recibido && <Check size={11} className="text-white" />}
                            {!estado.recibido && <X size={11} className="text-red-500" />}
                          </button>

                          {/* Info del paquete */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-bold text-[#064e3b] dark:text-emerald-400">
                                {enc.codigoTracking}
                              </span>
                              {enc.esFragil && (
                                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-semibold">
                                  <AlertTriangle size={9} /> Frágil
                                </span>
                              )}
                              {enc.formaCobro === 'POR_COBRAR' && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">
                                  Cobrar S/ {Number(enc.monto ?? enc.precioEnvio ?? 0).toFixed(2)}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-600 dark:text-slate-400 mt-0.5">
                              <span className="text-gray-400">Para:</span>{' '}
                              <span className="font-medium">{enc.destinatarioNombre ?? `ID ${enc.destinatarioId}`}</span>
                              {enc.destinatarioTel && (
                                <span className="text-gray-400 ml-1.5">· {enc.destinatarioTel}</span>
                              )}
                            </p>
                            <p className="text-[11px] text-gray-400 dark:text-slate-500">
                              {enc.descripcion}
                              {enc.pesoKg && <span className="ml-1.5">· {enc.pesoKg} kg</span>}
                              {enc.numBultos && enc.numBultos > 1 && <span className="ml-1">· {enc.numBultos} bultos</span>}
                            </p>

                            {/* Motivo si no recibido */}
                            {!estado.recibido && (
                              <input
                                value={estado.observacion}
                                onChange={e => setObservacion(viaje.viajeId, enc.id, e.target.value)}
                                placeholder="Motivo: no llegó, dañado, incompleto…"
                                className="mt-2 w-full px-3 py-1.5 border border-red-200 dark:border-red-800 rounded-lg text-xs focus:ring-2 focus:ring-red-300/40 focus:border-red-400 focus:outline-none bg-white dark:bg-[#1e293b] text-gray-700 dark:text-slate-300 placeholder-gray-400"
                              />
                            )}
                          </div>

                          {/* Estado visual */}
                          <div className="shrink-0">
                            {estado.recibido
                              ? <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-semibold">Recibido</span>
                              : <span className="text-[10px] px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-semibold">Faltante</span>
                            }
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Footer de acción */}
                <div className="px-5 py-4 bg-gray-50/80 dark:bg-[#293548]/50 border-t border-gray-100 dark:border-[#293548] flex items-center justify-between gap-4">
                  <div className="text-sm text-gray-600 dark:text-slate-400">
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                      {Object.values(estadosViaje).filter(e => e.recibido).length}
                    </span> recibidas
                    {pendientes > 0 && (
                      <>
                        <span className="mx-2 text-gray-300">·</span>
                        <span className="font-semibold text-red-600 dark:text-red-400">{pendientes}</span> faltantes
                      </>
                    )}
                    <span className="ml-2 text-gray-400">de {viaje.totalEncomiendas} totales</span>
                  </div>

                  <button
                    onClick={() => confirmarRecepcion(viaje)}
                    disabled={procesandoEste}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#064e3b] text-white text-sm font-semibold rounded-xl hover:bg-[#065f46] disabled:opacity-50 transition-colors shadow-sm">
                    {procesandoEste
                      ? <><Loader2 size={14} className="animate-spin" /> Procesando…</>
                      : <><CheckCircle2 size={14} /> Confirmar recepción</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
type PageTab = 'enviadas' | 'para-entregar' | 'recepcionar'
type PageVista = 'tabs' | 'nueva' | 'exito-registro' | 'exito-entrega'

export default function EncomiendaPage() {
  const { user } = useAuthStore()
  const agenciaId = user?.agenciaId ?? null
  const { connected, suscribeToAgenciaEncomiendas } = useWebSocket()

  const [tab, setTab] = useState<PageTab>('enviadas')
  const [vista, setVista] = useState<PageVista>('tabs')
  const [paso, setPaso] = useState(0)
  const [form, setForm] = useState<FormState>(INIT)
  const [guardando, setGuardando] = useState(false)
  const [successData, setSuccessData] = useState<SuccessData | null>(null)

  // Promociones
  const [promoSelEnc, setPromoSelEnc]       = useState<PromocionDTO | null>(null)
  const [codigoPromoEnc, setCodigoPromoEnc] = useState('')
  const [buscandoCodigoEnc, setBuscandoCodigoEnc] = useState(false)
  const { data: promosEnc = [] } = useSWR<PromocionDTO[]>(
    'promos-encomiendas',
    () => promocionesService.getVigentes('ENCOMIENDAS'),
    { revalidateOnFocus: false }
  )
  const [entregaSuccessData, setEntregaSuccessData] = useState<{ enc: EncomiendaEnriquecida; cobrado: boolean } | null>(null)
  const [wsBadge, setWsBadge] = useState(0)
  const [recepcionBadge, setRecepcionBadge] = useState(0)

  const remitenteRef = useRef<BuscadorClienteRef>(null)
  const destinatarioRef = useRef<BuscadorClienteRef>(null)

  const { data: agencias = [] } = useSWR<Agencia[]>('/api/agencias')
  const { data: viajes  = [] } = useSWR<ViajeSimple[]>('/api/viajes/disponibles')
  const { data: statsData }    = useSWR<Record<string, number>>('/api/encomiendas/stats')
  const { data: turnoCaja }    = useSWR<any>('/api/caja/turno-actual')
  const cajaAbierta = (turnoCaja as any)?.estado === 'ABIERTA'

  // Subscribe to WS notifications for this agency's incoming packages
  useEffect(() => {
    if (!connected || !agenciaId) return
    const sub = suscribeToAgenciaEncomiendas(agenciaId, () => {
      setWsBadge(n => n + 1)
    })
    return () => sub?.unsubscribe()
  }, [connected, agenciaId, suscribeToAgenciaEncomiendas])

  const sf = (k: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(v => ({ ...v, [k]: e.target.value }))

  const puedeAvanzar = (): boolean => {
    if (paso === 0) return !!form.remitente
    if (paso === 1) return !!form.destinatario
    if (paso === 2) return !!form.descripcion.trim() && !!form.agenciaDestinoId
    if (paso === 3) return !!form.monto && parseFloat(form.monto) >= 0 && !!form.formaCobro
    return true
  }

  const avanzar = async () => {
    if (paso === 0) {
      const ok = await remitenteRef.current?.saveIfNeeded() ?? true
      if (!ok) return
    }
    if (paso === 1) {
      const ok = await destinatarioRef.current?.saveIfNeeded() ?? true
      if (!ok) return
    }
    setPaso(p => p + 1)
  }

  const aplicarPromoEnc = (p: PromocionDTO | null) => {
    setPromoSelEnc(p)
  }

  const buscarCodigoEnc = async () => {
    if (!codigoPromoEnc.trim()) return
    setBuscandoCodigoEnc(true)
    try {
      const p = await promocionesService.validarCodigo(codigoPromoEnc.trim(), 'ENCOMIENDAS')
      aplicarPromoEnc(p)
      toast.success(`Promoción "${p.nombre}" aplicada`)
      setCodigoPromoEnc('')
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Código inválido')
    } finally { setBuscandoCodigoEnc(false) }
  }

  const registrar = async () => {
    if (!form.remitente || !form.destinatario) return
    setGuardando(true)
    try {
      const dto: RegistrarEncomiendaDTO = {
        remitenteTipoDoc: form.remitente.tipoDoc,
        remitenteDoc: form.remitente.numDoc,
        remitenteNombres: form.remitente.nombres,
        remitenteApellidos: form.remitente.apellidos,
        remitenteRazonSocial: form.remitente.razonSocial,
        remitenteTelefono: form.remitente.telefono,
        destinatarioTipoDoc: form.destinatario.tipoDoc,
        destinatarioDoc: form.destinatario.numDoc,
        destinatarioNombres: form.destinatario.nombres,
        destinatarioApellidos: form.destinatario.apellidos,
        destinatarioRazonSocial: form.destinatario.razonSocial,
        destinatarioTelefono: form.destinatario.telefono,
        descripcion: form.descripcion,
        pesoKg: form.pesoKg ? parseFloat(form.pesoKg) : undefined,
        numBultos: parseInt(form.numBultos || '1'),
        esFragil: form.esFragil,
        agenciaDestinoId: parseInt(form.agenciaDestinoId),
        viajeId: form.viajeId ? parseInt(form.viajeId) : undefined,
        monto: parseFloat(form.monto || '0'),
        formaCobro: form.formaCobro,
        observaciones: form.observaciones || undefined,
        promocionId: promoSelEnc?.id ?? undefined,
      }
      const r = await encomiendaService.registrar(dto)
      const enc = r.data as EncomiendaEnriquecida
      const agDest = agencias.find(a => a.id.toString() === form.agenciaDestinoId)

      setSuccessData({
        enc,
        remitenteNombre: form.remitente.razonSocial ?? `${form.remitente.apellidos}, ${form.remitente.nombres}`,
        destinatarioNombre: form.destinatario.razonSocial ?? `${form.destinatario.apellidos}, ${form.destinatario.nombres}`,
        agenciaDestNombre: agDest ? `${agDest.nombre} — ${agDest.ciudad}` : '—',
        descripcion: form.descripcion,
      })
      setForm(INIT); setPaso(0); setPromoSelEnc(null); setVista('exito-registro')
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Error al registrar encomienda')
    } finally { setGuardando(false) }
  }

  const imprimirComprobante = async (encId: number) => {
    try {
      const blob = await encomiendaService.getComprobantePDF(encId)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')?.focus()
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch { toast.error('Error al generar comprobante') }
  }

  const imprimirComprobanteEntrega = async (encId: number) => {
    try {
      const blob = await encomiendaService.getComprobanteEntregaPDF(encId)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')?.focus()
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch { toast.error('Error al generar comprobante de entrega') }
  }

  const imprimirEtiqueta = async (encId: number) => {
    try {
      const blob = await encomiendaService.getEtiquetaPDF(encId)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')?.focus()
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch { toast.error('Error al generar etiqueta') }
  }

  const handleEntregaSuccess = (enc: EncomiendaEnriquecida, cobrado: boolean) => {
    setEntregaSuccessData({ enc, cobrado })
    setVista('exito-entrega')
  }

  const agenciaDestNombre = agencias.find(a => a.id.toString() === form.agenciaDestinoId)?.nombre ?? '—'
  const viajeSeleccionado = viajes.find(v => v.id.toString() === form.viajeId)
  const viajeLabel = viajeSeleccionado
    ? `${viajeSeleccionado.ruta?.origen ?? ''} → ${viajeSeleccionado.ruta?.destino ?? ''} · ${
        viajeSeleccionado.vehiculo?.placa ?? ''
      } · ${viajeSeleccionado.fechaHoraSal ? format(new Date(viajeSeleccionado.fechaHoraSal), 'HH:mm dd/MM') : ''}`
    : '—'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#064e3b] flex items-center justify-center">
            <Package size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Encomiendas</h1>
            <p className="text-xs text-gray-500">Registro y seguimiento de paquetes</p>
          </div>
        </div>
        {vista === 'tabs' && statsData && (
          <div className="hidden sm:flex items-center gap-2 text-xs">
            {(statsData.registradasHoy ?? 0) > 0 && (
              <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-medium">
                {statsData.registradasHoy} hoy
              </span>
            )}
            {(statsData.disponibles ?? 0) > 0 && (
              <span className="bg-teal-50 text-teal-700 px-2.5 py-1 rounded-full font-medium">
                {statsData.disponibles} p/entregar
              </span>
            )}
            {(statsData.enTransito ?? 0) > 0 && (
              <span className="bg-purple-50 text-purple-700 px-2.5 py-1 rounded-full font-medium">
                {statsData.enTransito} en tránsito
              </span>
            )}
          </div>
        )}
        {vista === 'tabs' && (
          <button onClick={() => { setVista('nueva'); setPaso(0); setForm(INIT) }}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#064e3b] text-white text-sm rounded-xl hover:bg-[#065f46] transition-colors font-semibold shadow-sm">
            <Plus size={15} /> Nuevo Envío
          </button>
        )}
        {vista === 'nueva' && (
          <button onClick={() => setVista('tabs')}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50 transition-colors">
            <X size={15} /> Cancelar
          </button>
        )}
      </div>

      {/* ── Registration success ── */}
      {vista === 'exito-registro' && successData && (
        <RegistroSuccessScreen
          data={successData}
          onNueva={() => { setVista('nueva'); setSuccessData(null) }}
          onPrint={() => imprimirComprobante(successData.enc.id)}
          onEtiqueta={() => imprimirEtiqueta(successData.enc.id)}
        />
      )}

      {/* ── Delivery success ── */}
      {vista === 'exito-entrega' && entregaSuccessData && (
        <EntregaSuccessScreen
          enc={entregaSuccessData.enc}
          cobrado={entregaSuccessData.cobrado}
          onVolver={() => { setEntregaSuccessData(null); setVista('tabs') }}
          onPrint={() => imprimirComprobanteEntrega(entregaSuccessData.enc.id)}
        />
      )}

      {/* ── Wizard ── */}
      {vista === 'nueva' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
          <div className="px-6 pt-5 pb-4 border-b border-gray-100 bg-gray-50/60">
            <div className="flex items-center">
              {PASOS.map((p, i) => (
                <React.Fragment key={p}>
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                      i < paso ? 'bg-[#064e3b] border-[#064e3b] text-white shadow-sm'
                        : i === paso ? 'border-[#064e3b] text-[#064e3b] bg-white ring-4 ring-[#064e3b]/10'
                        : 'border-gray-200 text-gray-400 bg-white'
                    }`}>
                      {i < paso ? <Check size={13} /> : i + 1}
                    </div>
                    <span className={`text-[10px] mt-1 whitespace-nowrap font-medium ${i === paso ? 'text-[#064e3b]' : i < paso ? 'text-emerald-600' : 'text-gray-400'}`}>{p}</span>
                  </div>
                  {i < PASOS.length - 1 && (
                    <div className={`flex-1 h-0.5 mb-5 mx-1 rounded-full transition-all ${i < paso ? 'bg-[#064e3b]' : 'bg-gray-200'}`} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="px-6 pb-6">
            {paso === 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-800 text-sm">¿Quién envía?</h3>
                <TipoSelector value={form.tipoRemitente} onChange={v => setForm(f => ({ ...f, tipoRemitente: v, remitente: null }))} />
                <BuscadorCliente ref={remitenteRef} label="Buscar remitente" value={form.remitente}
                  onChange={c => setForm(f => ({ ...f, remitente: c }))} tipoDoc={tipoToDoc(form.tipoRemitente)} />
              </div>
            )}

            {paso === 1 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-800 text-sm">¿Quién recibe?</h3>
                <TipoSelector value={form.tipoDestinatario} onChange={v => setForm(f => ({ ...f, tipoDestinatario: v, destinatario: null }))} />
                <BuscadorCliente ref={destinatarioRef} label="Buscar destinatario" value={form.destinatario}
                  onChange={c => setForm(f => ({ ...f, destinatario: c }))} tipoDoc={tipoToDoc(form.tipoDestinatario)} />
              </div>
            )}

            {paso === 2 && (
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-800 text-sm">Datos del paquete</h3>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Descripción del contenido *</label>
                  <textarea value={form.descripcion} onChange={sf('descripcion')} rows={2}
                    placeholder="Ej: Ropa, electrónicos, documentos..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none focus:ring-2 focus:ring-[#064e3b]/30 focus:border-[#064e3b] focus:outline-none" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Peso en kg</label>
                    <input type="number" step="0.1" min="0" value={form.pesoKg} onChange={sf('pesoKg')} placeholder="0.5"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#064e3b]/30 focus:border-[#064e3b] focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">N° bultos</label>
                    <input type="number" min="1" max="99" value={form.numBultos} onChange={sf('numBultos')} placeholder="1"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#064e3b]/30 focus:border-[#064e3b] focus:outline-none" />
                  </div>
                  <div className="flex flex-col justify-end pb-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Frágil</label>
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, esFragil: !f.esFragil }))}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                        form.esFragil
                          ? 'bg-amber-50 border-amber-400 text-amber-700'
                          : 'bg-white border-gray-200 text-gray-500 hover:border-amber-300'
                      }`}
                    >
                      <AlertTriangle size={13} className={form.esFragil ? 'text-amber-500' : 'text-gray-400'} />
                      {form.esFragil ? 'Frágil ✓' : 'Marcar frágil'}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Agencia destino *</label>
                    <select value={form.agenciaDestinoId} onChange={sf('agenciaDestinoId')}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white transition-colors focus:ring-2 focus:ring-[#064e3b]/30 focus:border-[#064e3b] focus:outline-none">
                      <option value="">Seleccionar...</option>
                      {agencias.map(a => <option key={a.id} value={a.id}>{a.nombre} — {a.ciudad}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Viaje <span className="text-gray-400 font-normal">(opcional)</span>
                    </label>
                    <select value={form.viajeId} onChange={sf('viajeId')}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white transition-colors focus:ring-2 focus:ring-[#064e3b]/30 focus:border-[#064e3b] focus:outline-none">
                      <option value="">Sin viaje</option>
                      {viajes
                        .filter(v => v.estado === 'PROGRAMADO' || v.estado === 'EN_RUTA')
                        .map(v => (
                          <option key={v.id} value={v.id}>
                            {v.ruta?.origen ?? '?'}→{v.ruta?.destino ?? '?'} {v.vehiculo?.placa ?? ''} {v.fechaHoraSal ? format(new Date(v.fechaHoraSal), 'HH:mm') : ''}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {paso === 3 && (
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-800 text-sm">Cobro del envío</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Monto (S/) *</label>
                    <input type="number" step="0.5" min="0" value={form.monto} onChange={sf('monto')} placeholder="0.00"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-[#064e3b]/30 focus:border-[#064e3b] focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Forma de cobro *</label>
                    <select value={form.formaCobro} onChange={sf('formaCobro')}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white transition-colors focus:ring-2 focus:ring-[#064e3b]/30 focus:border-[#064e3b] focus:outline-none">
                      {Object.entries(FORMA_COBRO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                </div>
                {form.formaCobro === 'POR_COBRAR' && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 space-y-1">
                    <p className="font-semibold text-amber-900">Pago en destino</p>
                    <p>El monto <strong>S/ {parseFloat(form.monto || '0').toFixed(2)}</strong> será cobrado al destinatario por el operador de la agencia de destino al momento de entregar el paquete.</p>
                    <p>El operador destino <strong>debe tener caja abierta</strong> para completar la entrega.</p>
                  </div>
                )}
                {form.formaCobro !== 'POR_COBRAR' && !cajaAbierta && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 space-y-1">
                    <p className="font-semibold text-red-900">Necesitas un turno de caja abierto</p>
                    <p>El cobro al contado se registra en tu caja. Abre tu turno en <strong>Caja</strong> antes
                    de confirmar, o cambia la forma de cobro a <strong>Pago en destino</strong>.</p>
                  </div>
                )}

                {/* ── Selector de descuentos / promociones ── */}
                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 space-y-2.5">
                  <div className="flex items-center gap-1.5">
                    <Tag size={13} className="text-[#064e3b]" />
                    <span className="text-xs font-bold text-[#064e3b] uppercase tracking-wider">Descuento / Promoción</span>
                  </div>

                  {promosEnc.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {promosEnc.map(p => {
                        const sel = promoSelEnc?.id === p.id
                        const label = p.tipoDescuento === 'MONTO_FIJO' ? `S/ ${p.valor} off` : `${p.valor}% off`
                        return (
                          <button key={p.id} type="button"
                            onClick={() => aplicarPromoEnc(sel ? null : p)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                              sel ? 'bg-[#064e3b] text-white border-[#064e3b]' : 'bg-white text-gray-700 border-[#E2E8F0] hover:border-[#064e3b]/50'
                            }`}>
                            <Tag size={10} />
                            {p.nombre}
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${sel ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700'}`}>{label}</span>
                            {sel && <X size={10} />}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <input value={codigoPromoEnc}
                      onChange={e => setCodigoPromoEnc(e.target.value.toUpperCase())}
                      onKeyDown={e => e.key === 'Enter' && buscarCodigoEnc()}
                      placeholder="Código de campaña (ej: ENVIO10)"
                      className="flex-1 border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-[#064e3b]/20 focus:border-[#064e3b]" />
                    <button type="button" onClick={buscarCodigoEnc}
                      disabled={buscandoCodigoEnc || !codigoPromoEnc.trim()}
                      className="px-3 py-1.5 bg-[#064e3b] text-white rounded-lg text-xs font-medium disabled:opacity-40 hover:bg-[#065f46] transition-colors">
                      {buscandoCodigoEnc ? '...' : 'Aplicar'}
                    </button>
                  </div>

                  {promoSelEnc && (
                    <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <Check size={13} className="text-green-500" />
                        <span className="text-xs font-semibold text-green-700">{promoSelEnc.nombre}</span>
                        <span className="text-xs text-green-600">
                          — {promoSelEnc.tipoDescuento === 'MONTO_FIJO' ? `S/ ${promoSelEnc.valor}` : `${promoSelEnc.valor}%`} de descuento
                        </span>
                      </div>
                      <button type="button" onClick={() => aplicarPromoEnc(null)} className="text-green-400 hover:text-green-700">
                        <X size={13} />
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Observaciones <span className="text-gray-400 font-normal">(opcional)</span>
                  </label>
                  <textarea value={form.observaciones} onChange={sf('observaciones')} rows={2}
                    placeholder="Frágil, requiere refrigeración, etc."
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none focus:ring-2 focus:ring-[#064e3b]/30 focus:border-[#064e3b] focus:outline-none" />
                </div>
              </div>
            )}

            {paso === 4 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-800 text-sm">Confirmar registro</h3>
                <div className="bg-gray-50 rounded-lg border border-gray-200 divide-y divide-gray-100 text-sm">
                  <Row label="Remitente" value={form.remitente?.razonSocial ?? `${form.remitente?.apellidos ?? ''}, ${form.remitente?.nombres ?? ''}`} />
                  <Row label="Destinatario" value={form.destinatario?.razonSocial ?? `${form.destinatario?.apellidos ?? ''}, ${form.destinatario?.nombres ?? ''}`} />
                  <Row label="Contenido" value={form.descripcion} />
                  {form.pesoKg && <Row label="Peso" value={form.pesoKg + ' kg'} />}
                  <Row label="Bultos" value={form.numBultos || '1'} />
                  {form.esFragil && <Row label="Frágil" value="Sí — manejar con cuidado" />}
                  <Row label="Destino" value={agenciaDestNombre} />
                  {form.viajeId && <Row label="Viaje" value={viajeLabel} />}
                  <Row label="Monto" value={`S/ ${parseFloat(form.monto || '0').toFixed(2)}`} />
                  <Row label="Forma cobro" value={FORMA_COBRO_LABELS[form.formaCobro] ?? form.formaCobro} />
                  {form.observaciones && <Row label="Obs." value={form.observaciones} />}
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
              {paso > 0 && (
                <button onClick={() => setPaso(p => p - 1)}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors">
                  <ChevronLeft size={14} /> Anterior
                </button>
              )}
              <div className="flex-1" />
              {paso < PASOS.length - 1 ? (
                <button onClick={avanzar} disabled={!puedeAvanzar()}
                  className="flex items-center gap-1.5 px-5 py-2.5 text-sm bg-[#064e3b] text-white rounded-xl hover:bg-[#065f46] disabled:opacity-40 transition-colors font-semibold">
                  Siguiente <ChevronRight size={14} />
                </button>
              ) : (
                <button onClick={registrar} disabled={guardando}
                  className="flex items-center gap-2 px-6 py-2.5 text-sm bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors font-semibold">
                  {guardando && <Loader2 size={14} className="animate-spin" />}
                  <Check size={14} /> Registrar envío
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      {vista === 'tabs' && (
        <div className="space-y-4">
          <div className="flex gap-1 border-b border-gray-200">
            <button
              onClick={() => setTab('enviadas')}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === 'enviadas'
                  ? 'border-[#064e3b] text-[#064e3b]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              Enviadas
            </button>
            <button
              onClick={() => { setTab('para-entregar'); setWsBadge(0) }}
              className={`relative px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === 'para-entregar'
                  ? 'border-[#064e3b] text-[#064e3b]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              Para entregar
              {wsBadge > 0 && tab !== 'para-entregar' && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {wsBadge > 9 ? '9+' : wsBadge}
                </span>
              )}
            </button>
            <button
              onClick={() => setTab('recepcionar')}
              className={`relative px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === 'recepcionar'
                  ? 'border-purple-600 text-purple-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              Recepcionar
              {recepcionBadge > 0 && tab !== 'recepcionar' && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-purple-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {recepcionBadge > 9 ? '9+' : recepcionBadge}
                </span>
              )}
            </button>
          </div>

          {tab === 'enviadas' && <EnviadasTab viajes={viajes} />}
          {tab === 'para-entregar' && (
            <ParaEntregarTab onEntregaSuccess={handleEntregaSuccess} />
          )}
          {tab === 'recepcionar' && (
            <RecepcionarTab onBadgeChange={setRecepcionBadge} />
          )}
        </div>
      )}
    </div>
  )
}
