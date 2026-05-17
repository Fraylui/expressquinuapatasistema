'use client'
import React, { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import {
  Package, Plus, Search, X, ChevronRight, ChevronLeft,
  Printer, Check, Loader2, Eye, RefreshCw, CheckCircle2
} from 'lucide-react'
import { encomiendaService, type RegistrarEncomiendaDTO } from '@/services/encomiendas.service'
import { BuscadorCliente, type BuscadorClienteRef } from '@/components/modules/clientes/BuscadorCliente'
import type { Encomienda, Cliente, Agencia } from '@/types'
import api from '@/services/api'
import type { ApiResponse } from '@/types'
import { format } from 'date-fns'

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
  YAPE: 'Yape', PLIN: 'Plin', POR_COBRAR: 'Por cobrar (en destino)',
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

// ── Success screen ────────────────────────────────────────────────────────────
interface SuccessData {
  enc: Encomienda & { [k: string]: any }
  remitenteNombre: string
  destinatarioNombre: string
  agenciaDestNombre: string
}

function SuccessScreen({ data, onNueva, onPrint }: {
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
        <div className="flex gap-2 px-4 py-2">
          <span className="text-xs font-semibold text-gray-500 w-24 shrink-0">Remitente</span>
          <span className="text-xs text-gray-800">{data.remitenteNombre}</span>
        </div>
        <div className="flex gap-2 px-4 py-2">
          <span className="text-xs font-semibold text-gray-500 w-24 shrink-0">Destinatario</span>
          <span className="text-xs text-gray-800">{data.destinatarioNombre}</span>
        </div>
        <div className="flex gap-2 px-4 py-2">
          <span className="text-xs font-semibold text-gray-500 w-24 shrink-0">Destino</span>
          <span className="text-xs text-gray-800">{data.agenciaDestNombre}</span>
        </div>
        <div className="flex gap-2 px-4 py-2">
          <span className="text-xs font-semibold text-gray-500 w-24 shrink-0">Monto</span>
          <span className="text-xs text-gray-800 font-mono">
            S/ {(data.enc.monto ?? data.enc.precioEnvio ?? 0).toFixed(2)} — {FORMA_COBRO_LABELS[data.enc.formaCobro ?? ''] ?? data.enc.formaCobro}
          </span>
        </div>
      </div>
      <div className="flex gap-3 justify-center">
        <button onClick={onPrint}
          className="flex items-center gap-2 px-5 py-2 bg-[#1F3864] text-white text-sm rounded-lg hover:bg-[#16294d]">
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

// ── Wizard ─────────────────────────────────────────────────────────────────────
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
            value === t ? 'bg-[#1F3864] text-white border-[#1F3864]' : 'bg-white text-gray-600 border-gray-300 hover:border-[#1F3864]'
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

// ── Page ───────────────────────────────────────────────────────────────────────
export default function EncomiendaPage() {
  const [vista, setVista] = useState<'lista' | 'nueva' | 'exito'>('lista')
  const [paso, setPaso] = useState(0)
  const [form, setForm] = useState<FormState>(INIT)
  const [guardando, setGuardando] = useState(false)
  const [successData, setSuccessData] = useState<SuccessData | null>(null)
  const [lista, setLista] = useState<Encomienda[]>([])
  const [cargando, setCargando] = useState(false)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroQ, setFiltroQ] = useState('')
  const [agencias, setAgencias] = useState<Agencia[]>([])
  const [viajes, setViajes] = useState<ViajeSimple[]>([])
  const [imprimiendo, setImprimiendo] = useState<number | null>(null)

  const remitenteRef = useRef<BuscadorClienteRef>(null)
  const destinatarioRef = useRef<BuscadorClienteRef>(null)

  useEffect(() => {
    api.get<any, ApiResponse<Agencia[]>>('/api/agencias').then(r => setAgencias(r.data ?? []))
    api.get<any, any>('/api/viajes').then(r => setViajes(r.data ?? []))
  }, [])

  const cargarLista = async () => {
    setCargando(true)
    try {
      const r = await encomiendaService.getLista({ estado: filtroEstado || undefined, q: filtroQ || undefined })
      setLista((r.data ?? []) as Encomienda[])
    } catch { toast.error('Error cargando lista') }
    finally { setCargando(false) }
  }

  useEffect(() => { if (vista === 'lista') cargarLista() }, [vista, filtroEstado])

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
      }
      const r = await encomiendaService.registrar(dto)
      const enc = r.data as any
      const agDest = agencias.find(a => a.id.toString() === form.agenciaDestinoId)

      setSuccessData({
        enc,
        remitenteNombre: form.remitente.razonSocial ?? `${form.remitente.apellidos}, ${form.remitente.nombres}`,
        destinatarioNombre: form.destinatario.razonSocial ?? `${form.destinatario.apellidos}, ${form.destinatario.nombres}`,
        agenciaDestNombre: agDest ? `${agDest.nombre} — ${agDest.ciudad}` : '—',
      })
      setForm(INIT); setPaso(0); setVista('exito')
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Error al registrar encomienda')
    } finally { setGuardando(false) }
  }

  const imprimirComprobante = async (encId: number) => {
    setImprimiendo(encId)
    try {
      const blob = await api.get(`/api/encomiendas/${encId}/comprobante`, {
        responseType: 'blob'
      }) as unknown as Blob
      const url = URL.createObjectURL(blob)
      const win = window.open(url, '_blank')
      win?.focus()
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch {
      toast.error('Error al generar comprobante')
    } finally {
      setImprimiendo(null)
    }
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
          <div className="w-10 h-10 rounded-xl bg-[#1F3864] flex items-center justify-center">
            <Package size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Encomiendas</h1>
            <p className="text-xs text-gray-500">Gestión de paquetes y envíos</p>
          </div>
        </div>
        {vista !== 'exito' && (
          <button onClick={() => { setVista(v => v === 'lista' ? 'nueva' : 'lista'); setPaso(0); setForm(INIT) }}
            className="flex items-center gap-2 px-4 py-2 bg-[#1F3864] text-white text-sm rounded-lg hover:bg-[#16294d] transition-colors">
            {vista === 'lista' ? <><Plus size={16} /> Nueva encomienda</> : <><X size={16} /> Cancelar</>}
          </button>
        )}
      </div>

      {/* ── Success Screen ── */}
      {vista === 'exito' && successData && (
        <SuccessScreen
          data={successData}
          onNueva={() => { setVista('nueva'); setSuccessData(null) }}
          onPrint={() => imprimirComprobante(successData.enc.id)}
        />
      )}

      {/* ── Wizard ── */}
      {vista === 'nueva' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          {/* Progress bar */}
          <div className="px-6 pt-5 pb-3">
            <div className="flex items-center">
              {PASOS.map((p, i) => (
                <React.Fragment key={p}>
                  <div className="flex flex-col items-center">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                      i < paso ? 'bg-[#1F3864] border-[#1F3864] text-white'
                        : i === paso ? 'border-[#1F3864] text-[#1F3864] bg-white'
                        : 'border-gray-300 text-gray-400 bg-white'
                    }`}>
                      {i < paso ? <Check size={13} /> : i + 1}
                    </div>
                    <span className={`text-[10px] mt-1 ${i === paso ? 'text-[#1F3864] font-semibold' : 'text-gray-400'}`}>{p}</span>
                  </div>
                  {i < PASOS.length - 1 && (
                    <div className={`flex-1 h-0.5 mb-4 mx-1 ${i < paso ? 'bg-[#1F3864]' : 'bg-gray-200'}`} />
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
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                    El monto será cobrado al destinatario al momento de la entrega. Se imprimirá <b>EN DESTINO</b> en el comprobante.
                  </div>
                )}
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
                  className="flex items-center gap-1 px-4 py-2 text-sm bg-[#1F3864] text-white rounded-lg hover:bg-[#16294d] disabled:opacity-50">
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

      {/* ── Lista ── */}
      {vista === 'lista' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-medium text-gray-600 mb-1">Buscar tracking</label>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
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
            <button onClick={cargarLista}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg">
              <RefreshCw size={14} /> Buscar
            </button>
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
                      {['Tracking', 'Remitente', 'Destinatario', 'Estado', 'Monto', 'Fecha', ''].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lista.map(enc => {
                      const cfg = ESTADO_CONFIG[enc.estado] ?? { label: enc.estado, color: 'bg-gray-100 text-gray-800' }
                      return (
                        <tr key={enc.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs font-semibold text-[#1F3864]">{enc.codigoTracking}</td>
                          <td className="px-4 py-3 text-gray-800 max-w-[140px] truncate">{(enc as any).remitenteNombre ?? `ID ${enc.remitenteId}`}</td>
                          <td className="px-4 py-3 text-gray-800 max-w-[140px] truncate">{(enc as any).destinatarioNombre ?? `ID ${enc.destinatarioId}`}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-gray-800">
                            S/ {(enc.monto ?? enc.precioEnvio ?? 0).toFixed(2)}
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
                                className="p-1.5 rounded text-gray-400 hover:text-[#1F3864] hover:bg-blue-50 inline-flex disabled:opacity-40"
                              >
                                {imprimiendo === enc.id
                                  ? <Loader2 size={14} className="animate-spin" />
                                  : <Printer size={14} />}
                              </button>
                              <a href={`/encomiendas/${enc.id}`}
                                className="p-1.5 rounded text-gray-400 hover:text-[#1F3864] hover:bg-blue-50 inline-flex">
                                <Eye size={15} />
                              </a>
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
      )}
    </div>
  )
}
