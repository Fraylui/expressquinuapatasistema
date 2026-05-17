'use client'
import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import QRCode from 'qrcode'
import {
  Package, Plus, Search, X, ChevronRight, ChevronLeft,
  Printer, Check, Loader2, Eye, RefreshCw
} from 'lucide-react'
import { encomiendaService, type RegistrarEncomiendaDTO } from '@/services/encomiendas.service'
import { BuscadorCliente } from '@/components/modules/clientes/BuscadorCliente'
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
  YAPE: 'Yape', PLIN: 'Plin', POR_COBRAR: 'Por cobrar',
}

type TipoEntidad = 'PERSONA_DNI' | 'PERSONA_CE' | 'EMPRESA_RUC'
function tipoToDoc(t: TipoEntidad): string {
  if (t === 'EMPRESA_RUC') return 'RUC'
  if (t === 'PERSONA_CE')  return 'CE'
  return 'DNI'
}

// ── Comprobante modal ─────────────────────────────────────────────────────────
interface ComprobanteData {
  enc: Encomienda
  remitenteNombre: string
  remitenteDoc: string
  destinatarioNombre: string
  destinatarioTel: string
}

function ComprobanteModal({ data, onClose }: { data: ComprobanteData; onClose: () => void }) {
  const [qrUrl, setQrUrl] = useState('')
  useEffect(() => {
    QRCode.toDataURL(data.enc.codigoTracking, { width: 140, margin: 1 }).then(setQrUrl)
  }, [data.enc.codigoTracking])

  const imprimir = () => {
    const win = window.open('', '_blank', 'width=340,height=600')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
@page { size: 80mm auto; margin: 0; }
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Courier New',monospace; font-size:9px; width:80mm; padding:6px; }
.center { text-align:center; } .bold { font-weight:bold; }
.big { font-size:12px; font-weight:bold; }
.hr { border-top:1px dashed #000; margin:4px 0; }
.row { display:flex; justify-content:space-between; margin:1px 0; }
.label { font-weight:bold; min-width:80px; }
.qr { display:block; margin:6px auto; }
.footer { font-size:7.5px; font-style:italic; text-align:center; margin-top:4px; }
</style></head><body>
<div class="center bold">EXPRESS QUINUAPATA VRAEM S.A.C.</div>
<div class="center">RUC: 20601234567</div>
<div class="center">Jr. Lima 245, Mercado Andrés F. Vivanco</div>
<div class="center">Huamanga - Ayacucho  Telf: 066-312456</div>
<div class="hr"></div>
<div class="center bold">COMPROBANTE DE ENCOMIENDA</div>
<div class="center big">${data.enc.codigoTracking}</div>
${qrUrl ? `<img class="qr" src="${qrUrl}" width="100" height="100"/>` : ''}
<div class="hr"></div>
<div class="row"><span class="label">REMITENTE:</span><span>${data.remitenteNombre}</span></div>
<div class="row"><span class="label">Documento:</span><span>${data.remitenteDoc}</span></div>
<div class="row"><span class="label">DESTINATARIO:</span><span>${data.destinatarioNombre}</span></div>
${data.destinatarioTel ? `<div class="row"><span class="label">Tel. dest.:</span><span>${data.destinatarioTel}</span></div>` : ''}
<div class="hr"></div>
<div class="row"><span class="label">Contenido:</span><span>${data.enc.descripcion}</span></div>
${data.enc.pesoKg ? `<div class="row"><span class="label">Peso:</span><span>${data.enc.pesoKg} kg</span></div>` : ''}
<div class="row"><span class="label">Monto:</span><span>S/ ${(data.enc.monto ?? data.enc.precioEnvio ?? 0).toFixed(2)}</span></div>
<div class="row"><span class="label">Forma pago:</span><span>${FORMA_COBRO_LABELS[data.enc.formaCobro ?? ''] ?? data.enc.formaCobro}</span></div>
<div class="hr"></div>
<div class="row"><span class="label">Fecha:</span><span>${data.enc.fechaRegistro ? format(new Date(data.enc.fechaRegistro), 'dd/MM/yyyy HH:mm') : '-'}</span></div>
<div class="hr"></div>
<div class="footer">Conserve este comprobante para rastrear su encomienda</div>
<div class="footer">Estado: ${ESTADO_CONFIG[data.enc.estado]?.label ?? data.enc.estado}</div>
</body></html>`)
    win.document.close()
    setTimeout(() => { win.print(); win.close() }, 400)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-gray-900">Encomienda registrada</h3>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="p-4 bg-gray-50 flex justify-center">
          <div style={{ width: 226, fontFamily: 'Courier New,monospace', fontSize: 8, padding: 8, border: '1px solid #e5e7eb', background: '#fff' }}>
            <p style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 9 }}>EXPRESS QUINUAPATA VRAEM S.A.C.</p>
            <p style={{ textAlign: 'center' }}>RUC: 20601234567</p>
            <hr style={{ borderStyle: 'dashed', margin: '3px 0' }} />
            <p style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 10 }}>{data.enc.codigoTracking}</p>
            {qrUrl && <img src={qrUrl} width={80} height={80} style={{ display: 'block', margin: '4px auto' }} alt="QR" />}
            <hr style={{ borderStyle: 'dashed', margin: '3px 0' }} />
            <div><b>REMITENTE: </b>{data.remitenteNombre}</div>
            <div><b>DESTINATARIO: </b>{data.destinatarioNombre}</div>
            <hr style={{ borderStyle: 'dashed', margin: '3px 0' }} />
            <div><b>Contenido: </b>{data.enc.descripcion}</div>
            <div><b>Monto: </b>S/ {(data.enc.monto ?? data.enc.precioEnvio ?? 0).toFixed(2)} — {FORMA_COBRO_LABELS[data.enc.formaCobro ?? ''] ?? data.enc.formaCobro}</div>
          </div>
        </div>
        <div className="flex gap-3 p-4">
          <button onClick={onClose} className="flex-1 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cerrar</button>
          <button onClick={imprimir} className="flex-1 py-2 text-sm bg-[#1F3864] text-white rounded-lg hover:bg-[#16294d] flex items-center justify-center gap-2">
            <Printer size={14} /> Imprimir 80mm
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Wizard ─────────────────────────────────────────────────────────────────────
const PASOS = ['Remitente', 'Destinatario', 'Paquete', 'Cobro', 'Obs.', 'Confirmar']

interface FormState {
  tipoRemitente: TipoEntidad; remitente: Cliente | null
  tipoDestinatario: TipoEntidad; destinatario: Cliente | null
  descripcion: string; pesoKg: string; agenciaDestinoId: string
  monto: string; formaCobro: string; observaciones: string
}
const INIT: FormState = {
  tipoRemitente: 'PERSONA_DNI', remitente: null,
  tipoDestinatario: 'PERSONA_DNI', destinatario: null,
  descripcion: '', pesoKg: '', agenciaDestinoId: '',
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
  const [vista, setVista] = useState<'lista' | 'nueva'>('lista')
  const [paso, setPaso] = useState(0)
  const [form, setForm] = useState<FormState>(INIT)
  const [guardando, setGuardando] = useState(false)
  const [comprobante, setComprobante] = useState<ComprobanteData | null>(null)
  const [lista, setLista] = useState<Encomienda[]>([])
  const [cargando, setCargando] = useState(false)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroQ, setFiltroQ] = useState('')
  const [agencias, setAgencias] = useState<Agencia[]>([])

  useEffect(() => {
    api.get<any, ApiResponse<Agencia[]>>('/api/agencias').then(r => setAgencias(r.data ?? []))
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
        agenciaDestinoId: parseInt(form.agenciaDestinoId),
        monto: parseFloat(form.monto || '0'),
        formaCobro: form.formaCobro,
        observaciones: form.observaciones || undefined,
      }
      const r = await encomiendaService.registrar(dto)
      const enc = r.data
      toast.success('Encomienda registrada: ' + enc.codigoTracking)
      setComprobante({
        enc,
        remitenteNombre: form.remitente.razonSocial ?? `${form.remitente.apellidos}, ${form.remitente.nombres}`,
        remitenteDoc: `${form.remitente.tipoDoc} ${form.remitente.numDoc}`,
        destinatarioNombre: form.destinatario.razonSocial ?? `${form.destinatario.apellidos}, ${form.destinatario.nombres}`,
        destinatarioTel: form.destinatario.telefono ?? '',
      })
      setForm(INIT); setPaso(0); setVista('lista')
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Error al registrar encomienda')
    } finally { setGuardando(false) }
  }

  const agenciaDestNombre = agencias.find(a => a.id.toString() === form.agenciaDestinoId)?.nombre ?? '—'

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
        <button onClick={() => { setVista(v => v === 'lista' ? 'nueva' : 'lista'); setPaso(0); setForm(INIT) }}
          className="flex items-center gap-2 px-4 py-2 bg-[#1F3864] text-white text-sm rounded-lg hover:bg-[#16294d] transition-colors">
          {vista === 'lista' ? <><Plus size={16} /> Nueva encomienda</> : <><X size={16} /> Cancelar</>}
        </button>
      </div>

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
                <BuscadorCliente label="Buscar remitente" value={form.remitente}
                  onChange={c => setForm(f => ({ ...f, remitente: c }))} tipoDoc={tipoToDoc(form.tipoRemitente)} />
              </div>
            )}

            {paso === 1 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-800 text-sm">¿Quién recibe?</h3>
                <TipoSelector value={form.tipoDestinatario} onChange={v => setForm(f => ({ ...f, tipoDestinatario: v, destinatario: null }))} />
                <BuscadorCliente label="Buscar destinatario" value={form.destinatario}
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
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Peso en kg (opcional)</label>
                    <input type="number" step="0.1" min="0" value={form.pesoKg} onChange={sf('pesoKg')} placeholder="0.5"
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
                    El monto será cobrado al destinatario al momento de la entrega.
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
                  <Row label="Destino" value={agenciaDestNombre} />
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
                <button onClick={() => setPaso(p => p + 1)} disabled={!puedeAvanzar()}
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
                          <td className="px-4 py-3 text-gray-800 max-w-[140px] truncate">{enc.remitenteNombre ?? `ID ${enc.remitenteId}`}</td>
                          <td className="px-4 py-3 text-gray-800 max-w-[140px] truncate">{enc.destinatarioNombre ?? `ID ${enc.destinatarioId}`}</td>
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
                            <a href={`/encomiendas/${enc.id}`}
                              className="p-1.5 rounded text-gray-400 hover:text-[#1F3864] hover:bg-blue-50 inline-flex">
                              <Eye size={15} />
                            </a>
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

      {comprobante && <ComprobanteModal data={comprobante} onClose={() => setComprobante(null)} />}
    </div>
  )
}
