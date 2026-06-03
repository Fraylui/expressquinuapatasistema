'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import useSWR from 'swr'
import toast from 'react-hot-toast'
import {
  Package, Plus, Search, X, ChevronRight, ChevronLeft,
  Printer, Check, Loader2, Eye, RefreshCw, CheckCircle2,
  Truck, Bell, MapPin, Clock, Tag,
} from 'lucide-react'
import { encomiendaService, type RegistrarEncomiendaDTO, type EntregarEncomiendaDTO } from '@/services/encomiendas.service'
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
  [k: string]: any
}

// ── Registration success screen ───────────────────────────────────────────────
interface SuccessData {
  enc: EncomiendaEnriquecida
  remitenteNombre: string
  destinatarioNombre: string
  agenciaDestNombre: string
}

function RegistroSuccessScreen({ data, onNueva, onPrint }: {
  data: SuccessData
  onNueva: () => void
  onPrint: () => void
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center space-y-5">
      <div className="flex justify-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center animate-bounce">
          <CheckCircle2 size={36} className="text-green-500" />
        </div>
      </div>
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">¡Encomienda registrada!</h3>
        <p className="text-xs text-gray-500">Código de seguimiento</p>
        <div className="inline-block mt-2 px-6 py-2 bg-cyan-50 border-2 border-cyan-300 rounded-xl">
          <span className="text-xl font-bold font-mono text-cyan-700">{data.enc.codigoTracking}</span>
        </div>
      </div>
      <div className="bg-gray-50 rounded-lg border border-gray-200 text-left divide-y divide-gray-100 text-sm mx-auto max-w-xs">
        {[
          ['Remitente', data.remitenteNombre],
          ['Destinatario', data.destinatarioNombre],
          ['Destino', data.agenciaDestNombre],
          ['Monto', `S/ ${(data.enc.monto ?? data.enc.precioEnvio ?? 0).toFixed ? Number(data.enc.monto ?? data.enc.precioEnvio ?? 0).toFixed(2) : '0.00'} — ${FORMA_COBRO_LABELS[data.enc.formaCobro ?? ''] ?? data.enc.formaCobro}`],
        ].map(([label, value]) => (
          <div key={label} className="flex gap-2 px-4 py-2">
            <span className="text-xs font-semibold text-gray-500 w-24 shrink-0">{label}</span>
            <span className="text-xs text-gray-800">{value}</span>
          </div>
        ))}
      </div>
      {data.enc.formaCobro === 'POR_COBRAR' && (
        <div className="mx-auto max-w-xs p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 text-left space-y-1">
          <p className="font-semibold">Pago en destino</p>
          <p>El cobro de <strong>S/ {Number(data.enc.monto ?? data.enc.precioEnvio ?? 0).toFixed(2)}</strong> será realizado por el operador de la agencia destino al momento de entregar el paquete.</p>
        </div>
      )}
      <div className="flex gap-3 justify-center">
        <button onClick={onPrint}
          className="flex items-center gap-2 px-5 py-2 bg-[#064e3b] text-white text-sm rounded-lg hover:bg-[#16294d]">
          <Printer size={15} /> Imprimir comprobante
        </button>
        <button onClick={onNueva}
          className="flex items-center gap-2 px-5 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
          <Plus size={15} /> Nueva encomienda
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
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center space-y-5">
      <div className="flex justify-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 size={36} className="text-green-500" />
        </div>
      </div>
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">¡Encomienda entregada!</h3>
        <p className="text-xs text-gray-500 font-mono">{enc.codigoTracking}</p>
      </div>
      <div className="bg-gray-50 rounded-lg border border-gray-200 text-left divide-y divide-gray-100 mx-auto max-w-xs">
        {[
          ['Recibió', enc.recibidoPorNombre ?? '—'],
          ['DNI', enc.recibidoPorDni ?? '—'],
          ['Fecha', enc.fechaEntregaReal ? format(new Date(enc.fechaEntregaReal), 'dd/MM/yyyy HH:mm') : '—'],
          ...(cobrado ? [['Cobrado', `S/ ${Number(enc.monto ?? enc.precioEnvio ?? 0).toFixed(2)} en caja`]] : []),
        ].map(([label, value]) => (
          <div key={label} className="flex gap-2 px-4 py-2">
            <span className="text-xs font-semibold text-gray-500 w-24 shrink-0">{label}</span>
            <span className="text-xs text-gray-800">{value}</span>
          </div>
        ))}
      </div>
      {cobrado && (
        <div className="mx-auto max-w-xs p-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700 font-medium">
          Cobro registrado automáticamente en caja
        </div>
      )}
      <div className="flex gap-3 justify-center">
        <button onClick={onPrint}
          className="flex items-center gap-2 px-5 py-2 bg-[#064e3b] text-white text-sm rounded-lg hover:bg-[#16294d]">
          <Printer size={15} /> Comprobante de entrega
        </button>
        <button onClick={onVolver}
          className="flex items-center gap-2 px-5 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
          Volver a la lista
        </button>
      </div>
    </div>
  )
}

// ── Wizard helpers ─────────────────────────────────────────────────────────────
const PASOS = ['Remitente', 'Destinatario', 'Paquete', 'Cobro', 'Obs.', 'Confirmar']

interface FormState {
  tipoRemitente: TipoEntidad; remitente: Cliente | null
  tipoDestinatario: TipoEntidad; destinatario: Cliente | null
  descripcion: string; pesoKg: string; numBultos: string
  agenciaDestinoId: string; viajeId: string
  monto: string; formaCobro: string; observaciones: string
}
const INIT: FormState = {
  tipoRemitente: 'PERSONA_DNI', remitente: null,
  tipoDestinatario: 'PERSONA_DNI', destinatario: null,
  descripcion: '', pesoKg: '', numBultos: '1',
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h3 className="font-semibold text-gray-900">Registrar entrega</h3>
            <p className="text-xs text-gray-500 font-mono">{enc.codigoTracking}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-400">
            <X size={18} />
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
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
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

          {/* Pago en destino — cobro obligatorio */}
          {esPorCobrar && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
              <div className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">⚠</span>
                <div>
                  <p className="text-xs font-semibold text-amber-900">
                    Pago en destino — cobrar S/ {Number(enc.monto ?? enc.precioEnvio ?? 0).toFixed(2)}
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Esta encomienda se paga aquí. El cobro ingresará a tu caja activa.
                    <strong> Debes tener un turno de caja abierto.</strong>
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Forma de pago recibida *</label>
                <select value={formaPago} onChange={e => setFormaPago(e.target.value)}
                  className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-500">
                  {['EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA'].map(f => (
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
          <button onClick={confirmar} disabled={guardando || !dniReceptor || !nombreReceptor}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50">
            {guardando ? <Loader2 size={14} className="animate-spin" /> : <Check size={15} />}
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
      {/* Filter bar + search + refresh */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex gap-2 flex-wrap">
            {FILTROS.map(f => {
              const count = f.key !== 'todos' ? lista.filter(e => e.estado === f.key).length : lista.filter(e => e.estado !== 'ENTREGADO').length
              return (
                <button key={f.key} onClick={() => setFiltro(f.key)}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors font-medium ${
                    filtro === f.key
                      ? f.key === 'ENTREGADO'
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-[#064e3b] text-white border-[#064e3b]'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-[#064e3b]'
                  }`}>
                  {f.label}
                  {count > 0 && (
                    <span className={`ml-1.5 px-1.5 rounded-full text-[10px] font-bold ${
                      filtro === f.key ? 'bg-white/25 text-white' : f.key === 'DISPONIBLE' ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <button onClick={cargar}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs rounded-lg">
            <RefreshCw size={13} /> Actualizar
          </button>
        </div>
        {lista.length > 3 && (
          <div className="relative max-w-sm">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por tracking, remitente o destinatario…"
              className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
      </div>

      {/* Cards */}
      {cargando ? (
        <div className="flex justify-center items-center py-16 text-gray-400">
          <Loader2 size={24} className="animate-spin mr-2" /> Cargando...
        </div>
      ) : filtradas.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Truck size={40} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No hay encomiendas {filtro !== 'todos' ? 'con este estado' : 'para entregar'}</p>
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

            return (
              <div key={enc.id} className={`rounded-xl border p-4 shadow-sm transition-all ${
                esEntregado
                  ? 'bg-green-50/50 border-green-200 opacity-80'
                  : esDisponible
                    ? 'bg-white border-teal-300 ring-1 ring-teal-200'
                    : 'bg-white border-gray-200'
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-mono text-xs font-bold ${esEntregado ? 'text-green-700' : 'text-[#064e3b]'}`}>
                        {enc.codigoTracking}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                      {esDisponible && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-600 text-white animate-pulse">
                          Listo para entregar
                        </span>
                      )}
                      {enc.formaCobro === 'POR_COBRAR' && !esEntregado && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          Cobrar S/ {Number(enc.monto ?? enc.precioEnvio ?? 0).toFixed(2)}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs mt-2">
                      <div className="text-gray-500">
                        <span className="font-medium text-gray-700">Remitente: </span>
                        {enc.remitenteNombre ?? `ID ${enc.remitenteId}`}
                        {enc.agenciaOrigenNombre && (
                          <span className="ml-1 text-gray-400">({enc.agenciaOrigenNombre})</span>
                        )}
                      </div>
                      <div className="text-gray-500">
                        <span className="font-medium text-gray-700">Destinatario: </span>
                        {enc.destinatarioNombre ?? `ID ${enc.destinatarioId}`}
                        {enc.destinatarioTel && (
                          <span className="ml-1 text-blue-600 font-medium">· {enc.destinatarioTel}</span>
                        )}
                      </div>
                      <div className="text-gray-500">
                        <span className="font-medium text-gray-700">Contenido: </span>
                        {enc.descripcion}
                      </div>
                      {enc.pesoKg && (
                        <div className="text-gray-500">
                          <span className="font-medium text-gray-700">Peso: </span>
                          {enc.pesoKg} kg
                          {enc.numBultos && enc.numBultos > 1 && ` · ${enc.numBultos} bultos`}
                        </div>
                      )}
                      {esEntregado && enc.recibidoPorNombre && (
                        <div className="col-span-2 text-green-700 font-medium mt-0.5">
                          <Check size={11} className="inline mr-1" />
                          Recibió: {enc.recibidoPorNombre}
                          {enc.recibidoPorDni && <span className="text-green-600 font-normal"> (DNI {enc.recibidoPorDni})</span>}
                          {enc.fechaEntregaReal && (
                            <span className="text-green-600 font-normal ml-2">
                              · {format(new Date(enc.fechaEntregaReal), 'HH:mm', { locale: es })}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {tiempoLlegada && !esEntregado && (
                      <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                        <Clock size={11} />
                        Llegó {tiempoLlegada}
                      </div>
                    )}
                  </div>

                  {/* Action button */}
                  <div className="shrink-0">
                    {enc.estado === 'EN_TRANSITO' && (
                      <button onClick={() => marcarLlegada(enc)} disabled={isActuando}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 whitespace-nowrap">
                        {isActuando ? <Loader2 size={12} className="animate-spin" /> : <MapPin size={13} />}
                        Confirmar llegada
                      </button>
                    )}
                    {enc.estado === 'LLEGADO_AGENCIA' && (
                      <button onClick={() => marcarDisponible(enc)} disabled={isActuando}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 whitespace-nowrap">
                        {isActuando ? <Loader2 size={12} className="animate-spin" /> : <Check size={13} />}
                        Disponible p/entrega
                      </button>
                    )}
                    {enc.estado === 'DISPONIBLE' && (
                      <button onClick={() => setModalEntrega(enc)}
                        className="flex items-center gap-1.5 px-4 py-2.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold whitespace-nowrap shadow-sm">
                        <Package size={15} />
                        Registrar entrega
                      </button>
                    )}
                    {esEntregado && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-semibold">
                        <CheckCircle2 size={14} />
                        Entregado
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

function EnviadasTab() {
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
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Tracking / nombre</label>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={filtroQ} onChange={e => setFiltroQ(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && cargarLista()} placeholder="EXP-2026-..."
              className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Estado</label>
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500">
            <option value="">Todos</option>
            {Object.entries(ESTADO_CONFIG).map(([k, { label }]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Desde</label>
          <input type="date" value={filtroDe} onChange={e => setFiltroDe(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Hasta</label>
          <input type="date" value={filtroHasta} onChange={e => setFiltroHasta(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
        </div>
        <button onClick={cargarLista}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#064e3b] text-white text-sm rounded-lg hover:bg-[#16294d]">
          <Search size={14} /> Buscar
        </button>
        {(filtroQ || filtroEstado || filtroDe || filtroHasta) && (
          <button onClick={() => { setFiltroQ(''); setFiltroEstado(''); setFiltroDe(''); setFiltroHasta(''); }}
            className="px-3 py-2 border border-gray-300 text-gray-500 text-sm rounded-lg hover:bg-gray-50">
            Limpiar
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {cargando ? (
          <div className="flex justify-center items-center py-16 text-gray-400">
            <Loader2 size={24} className="animate-spin mr-2" /> Cargando...
          </div>
        ) : lista.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Package size={40} className="mx-auto mb-2 opacity-30" />
            <p>No hay encomiendas</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {['Tracking', 'Remitente', 'Destinatario', 'Destino', 'Estado', 'Monto', 'Fecha', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lista.map(enc => {
                  const cfg = ESTADO_CONFIG[enc.estado] ?? { label: enc.estado, color: 'bg-gray-100 text-gray-800' }
                  return (
                    <tr key={enc.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-[#064e3b]">{enc.codigoTracking}</td>
                      <td className="px-4 py-3 text-gray-800 max-w-[120px] truncate">{enc.remitenteNombre ?? `ID ${enc.remitenteId}`}</td>
                      <td className="px-4 py-3 text-gray-800 max-w-[120px] truncate">{enc.destinatarioNombre ?? `ID ${enc.destinatarioId}`}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[120px] truncate">{enc.agenciaDestinoNombre ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-800">
                        S/ {Number(enc.monto ?? enc.precioEnvio ?? 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {enc.fechaRegistro ? format(new Date(enc.fechaRegistro), 'dd/MM/yy HH:mm') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => imprimirComprobante(enc.id)}
                            disabled={imprimiendo === enc.id}
                            title="Imprimir comprobante"
                            className="p-1.5 rounded text-gray-400 hover:text-[#064e3b] hover:bg-blue-50 inline-flex disabled:opacity-40">
                            {imprimiendo === enc.id
                              ? <Loader2 size={14} className="animate-spin" />
                              : <Printer size={14} />}
                          </button>
                          {ESTADOS_DEVOLVIBLES.includes(enc.estado) && (
                            confirmDevolver === enc.id ? (
                              <span className="flex items-center gap-1">
                                <button
                                  onClick={() => devolverEncomienda(enc.id)}
                                  disabled={devolviendo === enc.id}
                                  className="px-2 py-1 text-[10px] bg-red-600 text-white rounded font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center gap-1">
                                  {devolviendo === enc.id ? <Loader2 size={10} className="animate-spin" /> : null}
                                  Sí, devolver
                                </button>
                                <button
                                  onClick={() => setConfirmDevolver(null)}
                                  className="px-2 py-1 text-[10px] border border-gray-300 text-gray-500 rounded hover:bg-gray-50">
                                  Cancelar
                                </button>
                              </span>
                            ) : (
                              <button
                                onClick={() => setConfirmDevolver(enc.id)}
                                title="Devolver al remitente"
                                className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 inline-flex">
                                <X size={14} />
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
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

// ── Page ───────────────────────────────────────────────────────────────────────
type PageTab = 'enviadas' | 'para-entregar'
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
  const [agencias, setAgencias] = useState<Agencia[]>([])
  const [viajes, setViajes] = useState<ViajeSimple[]>([])
  const [wsBadge, setWsBadge] = useState(0)

  const remitenteRef = useRef<BuscadorClienteRef>(null)
  const destinatarioRef = useRef<BuscadorClienteRef>(null)

  useEffect(() => {
    api.get<any, ApiResponse<Agencia[]>>('/api/agencias').then(r => setAgencias(r.data ?? []))
    api.get<any, any>('/api/viajes').then(r => setViajes(r.data ?? []))
  }, [])

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
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#064e3b] flex items-center justify-center">
            <Package size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Encomiendas</h1>
            <p className="text-xs text-gray-500">Gestión de paquetes y envíos</p>
          </div>
        </div>
        {vista === 'tabs' && (
          <button onClick={() => { setVista('nueva'); setPaso(0); setForm(INIT) }}
            className="flex items-center gap-2 px-4 py-2 bg-[#064e3b] text-white text-sm rounded-lg hover:bg-[#16294d] transition-colors">
            <Plus size={16} /> Nueva encomienda
          </button>
        )}
        {vista === 'nueva' && (
          <button onClick={() => setVista('tabs')}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
            <X size={16} /> Cancelar
          </button>
        )}
      </div>

      {/* ── Registration success ── */}
      {vista === 'exito-registro' && successData && (
        <RegistroSuccessScreen
          data={successData}
          onNueva={() => { setVista('nueva'); setSuccessData(null) }}
          onPrint={() => imprimirComprobante(successData.enc.id)}
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
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 pt-5 pb-3">
            <div className="flex items-center">
              {PASOS.map((p, i) => (
                <React.Fragment key={p}>
                  <div className="flex flex-col items-center">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                      i < paso ? 'bg-[#064e3b] border-[#064e3b] text-white'
                        : i === paso ? 'border-[#064e3b] text-[#064e3b] bg-white'
                        : 'border-gray-300 text-gray-400 bg-white'
                    }`}>
                      {i < paso ? <Check size={13} /> : i + 1}
                    </div>
                    <span className={`text-[10px] mt-1 ${i === paso ? 'text-[#064e3b] font-semibold' : 'text-gray-400'}`}>{p}</span>
                  </div>
                  {i < PASOS.length - 1 && (
                    <div className={`flex-1 h-0.5 mb-4 mx-1 ${i < paso ? 'bg-[#064e3b]' : 'bg-gray-200'}`} />
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Peso en kg</label>
                    <input type="number" step="0.1" min="0" value={form.pesoKg} onChange={sf('pesoKg')} placeholder="0.5"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">N° bultos</label>
                    <input type="number" min="1" max="99" value={form.numBultos} onChange={sf('numBultos')} placeholder="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Agencia destino *</label>
                    <select value={form.agenciaDestinoId} onChange={sf('agenciaDestinoId')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500">
                      <option value="">Seleccionar...</option>
                      {agencias.map(a => <option key={a.id} value={a.id}>{a.nombre} — {a.ciudad}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Viaje asignado <span className="text-gray-400 font-normal">(opcional)</span>
                  </label>
                  <select value={form.viajeId} onChange={sf('viajeId')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500">
                    <option value="">Sin viaje asignado</option>
                    {viajes
                      .filter(v => v.estado === 'PROGRAMADO' || v.estado === 'EN_RUTA')
                      .map(v => (
                        <option key={v.id} value={v.id}>
                          {v.ruta?.origen ?? '?'} → {v.ruta?.destino ?? '?'} · {v.vehiculo?.placa ?? ''} · {v.fechaHoraSal ? format(new Date(v.fechaHoraSal), 'HH:mm dd/MM') : ''}
                        </option>
                      ))}
                  </select>
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Forma de cobro *</label>
                    <select value={form.formaCobro} onChange={sf('formaCobro')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500">
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
              </div>
            )}

            {paso === 4 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-800 text-sm">Observaciones (opcional)</h3>
                <textarea value={form.observaciones} onChange={sf('observaciones')} rows={3}
                  placeholder="Frágil, requiere refrigeración, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500" />
              </div>
            )}

            {paso === 5 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-800 text-sm">Confirmar registro</h3>
                <div className="bg-gray-50 rounded-lg border border-gray-200 divide-y divide-gray-100 text-sm">
                  <Row label="Remitente" value={form.remitente?.razonSocial ?? `${form.remitente?.apellidos ?? ''}, ${form.remitente?.nombres ?? ''}`} />
                  <Row label="Destinatario" value={form.destinatario?.razonSocial ?? `${form.destinatario?.apellidos ?? ''}, ${form.destinatario?.nombres ?? ''}`} />
                  <Row label="Contenido" value={form.descripcion} />
                  {form.pesoKg && <Row label="Peso" value={form.pesoKg + ' kg'} />}
                  <Row label="Bultos" value={form.numBultos || '1'} />
                  <Row label="Destino" value={agenciaDestNombre} />
                  {form.viajeId && <Row label="Viaje" value={viajeLabel} />}
                  <Row label="Monto" value={`S/ ${parseFloat(form.monto || '0').toFixed(2)}`} />
                  <Row label="Forma cobro" value={FORMA_COBRO_LABELS[form.formaCobro] ?? form.formaCobro} />
                  {form.observaciones && <Row label="Obs." value={form.observaciones} />}
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              {paso > 0 && (
                <button onClick={() => setPaso(p => p - 1)}
                  className="flex items-center gap-1 px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                  <ChevronLeft size={15} /> Anterior
                </button>
              )}
              <div className="flex-1" />
              {paso < PASOS.length - 1 ? (
                <button onClick={avanzar} disabled={!puedeAvanzar()}
                  className="flex items-center gap-1 px-4 py-2 text-sm bg-[#064e3b] text-white rounded-lg hover:bg-[#16294d] disabled:opacity-50">
                  Siguiente <ChevronRight size={15} />
                </button>
              ) : (
                <button onClick={registrar} disabled={guardando}
                  className="flex items-center gap-2 px-6 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                  {guardando && <Loader2 size={14} className="animate-spin" />}
                  <Check size={15} /> Registrar encomienda
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
          </div>

          {tab === 'enviadas' && <EnviadasTab />}
          {tab === 'para-entregar' && (
            <ParaEntregarTab onEntregaSuccess={handleEntregaSuccess} />
          )}
        </div>
      )}
    </div>
  )
}
