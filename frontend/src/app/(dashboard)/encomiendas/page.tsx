'use client'
import React, { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import toast from 'react-hot-toast'
import QRCode from 'qrcode'
import { Plus, Printer, MapPin, ChevronDown } from 'lucide-react'
import { Table, Column } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { TrackingTimeline } from '@/components/modules/encomiendas/TrackingTimeline'
import { BuscadorCliente } from '@/components/modules/clientes/BuscadorCliente'
import { encomiendaService } from '@/services/encomiendas.service'
import { useAuthStore } from '@/stores/authStore'
import { Encomienda } from '@/types'
import type { Cliente } from '@/types'

// ─── Constantes de empresa ────────────────────────────────────────────────────

const EMPRESA = {
  nombre:    'EXPRESS QUINUAPATA VRAEM S.A.C.',
  ruc:       '20601234567',
  direccion: 'Jr. Lima 245, Mercado Andrés F. Vivanco',
  ciudad:    'Huamanga, Ayacucho',
  telefono:  '066-312456',
  email:     'huamanga@quinuapata.com',
}

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Agencia { id: number; nombre: string; ciudad: string }

// ─── Voucher de encomienda (80mm térmico) ─────────────────────────────────────

function Voucher({ enc, remitente, destinatario, agenciaOrigen, agenciaDestino, operador, onClose }: {
  enc: Encomienda
  remitente: Cliente
  destinatario: Cliente
  agenciaOrigen: string
  agenciaDestino: string
  operador: string
  onClose: () => void
}) {
  const [qrUrl, setQrUrl] = useState('')

  useEffect(() => {
    QRCode.toDataURL(enc.codigoTracking, {
      width: 96, margin: 1, color: { dark: '#000000', light: '#ffffff' }
    }).then(setQrUrl)
  }, [enc.codigoTracking])

  const fecha = new Date(enc.fechaRegistro ?? Date.now())
  const fmt = (n: number) => String(n).padStart(2, '0')
  const fechaStr = `${fmt(fecha.getDate())}/${fmt(fecha.getMonth()+1)}/${fecha.getFullYear()}`
  const horaStr  = `${fmt(fecha.getHours())}:${fmt(fecha.getMinutes())}`

  const imprimir = () => {
    const ventana = window.open('', '_blank', 'width=360,height=700')
    if (!ventana) return
    ventana.document.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <title>${enc.codigoTracking}</title>
      <style>
        @page { size: 80mm auto; margin: 0; }
        * { box-sizing: border-box; }
        body {
          font-family: 'Courier New', Courier, monospace;
          font-size: 11px;
          width: 80mm;
          margin: 0 auto;
          padding: 6px 8px;
          color: #000;
        }
        .center  { text-align: center; }
        .bold    { font-weight: bold; }
        .big     { font-size: 15px; font-weight: bold; letter-spacing: 3px; }
        .small   { font-size: 9px; }
        .row     { display: flex; justify-content: space-between; margin: 1.5px 0; }
        .row .val{ text-align: right; max-width: 55%; word-break: break-word; }
        hr       { border: none; border-top: 1px dashed #555; margin: 5px 0; }
        .total   { font-size: 13px; font-weight: bold; }
        img.qr   { display: block; margin: 4px auto; width: 80px; height: 80px; }
      </style>
    </head><body>
      <div class="center bold">${EMPRESA.nombre}</div>
      <div class="center small">RUC: ${EMPRESA.ruc}</div>
      <div class="center small">${EMPRESA.direccion}</div>
      <div class="center small">${EMPRESA.ciudad} | ${EMPRESA.telefono}</div>
      <hr/>
      <div class="center small">COMPROBANTE DE ENCOMIENDA</div>
      <div class="center big">${enc.codigoTracking}</div>
      ${qrUrl ? `<img class="qr" src="${qrUrl}" alt="QR"/>` : ''}
      <div class="center small">Escanee para rastrear su encomienda</div>
      <hr/>
      <div class="row"><span>Fecha:</span><span class="val">${fechaStr} ${horaStr}</span></div>
      <div class="row"><span>Origen:</span><span class="val">${agenciaOrigen}</span></div>
      <div class="row"><span>Destino:</span><span class="val">${agenciaDestino}</span></div>
      <hr/>
      <div class="bold small">REMITENTE</div>
      <div class="row"><span>Nombre:</span><span class="val">${remitente.nombres} ${remitente.apellidos}</span></div>
      <div class="row"><span>DNI:</span><span class="val">${remitente.numDoc}</span></div>
      <div class="bold small" style="margin-top:4px">DESTINATARIO</div>
      <div class="row"><span>Nombre:</span><span class="val">${destinatario.nombres} ${destinatario.apellidos}</span></div>
      <div class="row"><span>DNI:</span><span class="val">${destinatario.numDoc}</span></div>
      ${destinatario.telefono ? `<div class="row"><span>Tel:</span><span class="val">${destinatario.telefono}</span></div>` : ''}
      <hr/>
      <div class="row"><span>Contenido:</span><span class="val">${enc.descripcion}</span></div>
      ${enc.pesoKg   ? `<div class="row"><span>Peso:</span><span class="val">${enc.pesoKg} kg</span></div>` : ''}
      ${enc.observaciones ? `<div class="row"><span>Nota:</span><span class="val">${enc.observaciones}</span></div>` : ''}
      <hr/>
      <div class="row total"><span>PRECIO:</span><span>S/ ${Number(enc.precioEnvio).toFixed(2)}</span></div>
      <hr/>
      <div class="row small"><span>Operador:</span><span class="val">${operador}</span></div>
      <hr/>
      <div class="center small" style="margin-top:4px">
        Conserve este comprobante para rastrear su encomienda.<br/>
        Gracias por confiar en Express Quinuapata VRAEM.
      </div>
    </body></html>`)
    ventana.document.close()
    setTimeout(() => { ventana.print(); ventana.close() }, 400)
  }

  return (
    <div className="space-y-3">
      {/* Vista previa 80mm */}
      <div className="mx-auto bg-white border border-dashed border-gray-400 rounded p-3 font-mono text-[11px] text-gray-900"
           style={{ width: 302, maxWidth: '100%' }}>
        <div className="text-center font-bold text-[12px]">{EMPRESA.nombre}</div>
        <div className="text-center text-[9px] text-gray-500">RUC: {EMPRESA.ruc}</div>
        <div className="text-center text-[9px] text-gray-500">{EMPRESA.direccion} · {EMPRESA.telefono}</div>
        <hr className="border-dashed border-gray-400 my-1.5" />
        <div className="text-center text-[9px] text-gray-400">COMPROBANTE DE ENCOMIENDA</div>
        <div className="text-center font-bold text-[14px] tracking-widest mt-0.5">{enc.codigoTracking}</div>
        {qrUrl && <img src={qrUrl} className="mx-auto my-1.5" width={80} height={80} alt="QR" />}
        <div className="text-center text-[8px] text-gray-400 mb-1">Escanee para rastrear</div>
        <hr className="border-dashed border-gray-400 my-1.5" />
        <div className="flex justify-between"><span>Fecha:</span><span>{fechaStr} {horaStr}</span></div>
        <div className="flex justify-between"><span>Origen:</span><span className="text-right max-w-[55%] leading-tight">{agenciaOrigen}</span></div>
        <div className="flex justify-between"><span>Destino:</span><span className="text-right max-w-[55%] leading-tight font-semibold">{agenciaDestino}</span></div>
        <hr className="border-dashed border-gray-400 my-1.5" />
        <div className="text-[9px] font-bold text-gray-500 mb-0.5">REMITENTE</div>
        <div className="flex justify-between"><span>Nombre:</span><span>{remitente.nombres} {remitente.apellidos}</span></div>
        <div className="flex justify-between"><span>DNI:</span><span>{remitente.numDoc}</span></div>
        <div className="text-[9px] font-bold text-gray-500 mt-1.5 mb-0.5">DESTINATARIO</div>
        <div className="flex justify-between"><span>Nombre:</span><span>{destinatario.nombres} {destinatario.apellidos}</span></div>
        <div className="flex justify-between"><span>DNI:</span><span>{destinatario.numDoc}</span></div>
        {destinatario.telefono && <div className="flex justify-between"><span>Tel:</span><span>{destinatario.telefono}</span></div>}
        <hr className="border-dashed border-gray-400 my-1.5" />
        <div className="flex justify-between"><span>Contenido:</span><span className="text-right max-w-[55%] leading-tight">{enc.descripcion}</span></div>
        {enc.pesoKg  && <div className="flex justify-between"><span>Peso:</span><span>{enc.pesoKg} kg</span></div>}
        <hr className="border-dashed border-gray-400 my-1.5" />
        <div className="flex justify-between font-bold text-[13px]">
          <span>PRECIO:</span><span>S/ {Number(enc.precioEnvio).toFixed(2)}</span>
        </div>
        <hr className="border-dashed border-gray-400 my-1.5" />
        <div className="flex justify-between text-[9px] text-gray-500"><span>Operador:</span><span>{operador}</span></div>
        <hr className="border-dashed border-gray-400 my-1.5" />
        <div className="text-center text-[8px] text-gray-400 leading-snug">
          Conserve este comprobante para rastrear su encomienda.<br />
          Gracias por confiar en Express Quinuapata VRAEM.
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="secondary" onClick={onClose} className="flex-1">Cerrar</Button>
        <Button variant="primary" icon={Printer} onClick={imprimir} className="flex-1">
          Imprimir (80mm)
        </Button>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function EncomiendaPage() {
  const { data, mutate }      = useSWR('/api/encomiendas/lista')
  const { data: agenciasRaw } = useSWR('/api/agencias')

  const encomiendas: Encomienda[] = data || []
  const agencias: Agencia[]       = agenciasRaw?.data ?? agenciasRaw ?? []

  const [modalOpen, setModalOpen]     = useState(false)
  const [detalleSel, setDetalleSel]   = useState<Encomienda | null>(null)
  const [saving, setSaving]           = useState(false)
  const { user } = useAuthStore()
  // Voucher
  const [voucher, setVoucher] = useState<{
    enc: Encomienda; remitente: Cliente; destinatario: Cliente
    agenciaOrigen: string; agenciaDestino: string; operador: string
  } | null>(null)

  // Estado del formulario
  const [remitente, setRemitente]           = useState<Cliente | null>(null)
  const [destinatario, setDestinatario]     = useState<Cliente | null>(null)
  const [agenciaDestinoId, setAgenciaDestinoId] = useState<string>('')
  const [descripcion, setDescripcion]       = useState('')
  const [pesoKg, setPesoKg]                 = useState('')
  const [observaciones, setObservaciones]   = useState('')

  const { data: historialData } = useSWR(
    detalleSel ? `/api/encomiendas/${detalleSel.id}/historial` : null
  )

  const abrirModal = () => {
    setRemitente(null); setDestinatario(null); setAgenciaDestinoId('')
    setDescripcion(''); setPesoKg(''); setObservaciones('')
    setModalOpen(true)
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!remitente)          { toast.error('Ingresa el remitente'); return }
    if (!destinatario)       { toast.error('Ingresa el destinatario'); return }
    if (!agenciaDestinoId)   { toast.error('Selecciona la agencia de destino'); return }
    if (!descripcion.trim()) { toast.error('La descripción es obligatoria'); return }

    setSaving(true)
    try {
      const res = await encomiendaService.registrar({
        remitenteId:      remitente.id,
        destinatarioId:   destinatario.id,
        agenciaDestinoId: Number(agenciaDestinoId),
        descripcion:      descripcion.trim(),
        pesoKg:           pesoKg ? parseFloat(pesoKg) : undefined,
        observaciones:    observaciones.trim() || undefined,
      })
      const enc = (res as any).data as Encomienda
      toast.success(`Encomienda ${enc.codigoTracking} registrada`)
      setModalOpen(false)
      mutate()

      const agDest = agencias.find(a => a.id === Number(agenciaDestinoId))
      setVoucher({
        enc,
        remitente,
        destinatario,
        agenciaOrigen: 'Huamanga — Ayacucho',
        agenciaDestino: agDest ? `${agDest.nombre.replace('Express Quinuapata VRAEM SAC — ', '')} — ${agDest.ciudad}` : 'Destino',
        operador: user?.nombre ?? 'Operador',
      })
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al registrar')
    } finally {
      setSaving(false)
    }
  }

  const columns: Column<Encomienda>[] = [
    {
      key: 'codigoTracking',
      header: 'Código',
      render: r => (
        <span className="font-mono text-xs font-semibold text-[#1F3864]">{r.codigoTracking}</span>
      )
    },
    {
      key: 'descripcion',
      header: 'Descripción',
      render: r => <span className="truncate max-w-xs block text-sm">{r.descripcion}</span>
    },
    {
      key: 'pesoKg',
      header: 'Peso',
      render: r => r.pesoKg ? `${r.pesoKg} kg` : '—'
    },
    {
      key: 'precioEnvio',
      header: 'Precio',
      render: r => (
        <span className="font-semibold text-gray-900">S/ {r.precioEnvio}</span>
      )
    },
    {
      key: 'estado',
      header: 'Estado',
      render: r => <Badge estado={r.estado} />
    },
    {
      key: 'id',
      header: '',
      render: r => (
        <Button size="sm" variant="ghost" onClick={() => setDetalleSel(r)}>Ver</Button>
      )
    },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Encomiendas</h1>
          <p className="text-sm text-gray-500">Registro y seguimiento de envíos</p>
        </div>
        <Button icon={Plus} onClick={abrirModal}>Nueva encomienda</Button>
      </div>

      <Table columns={columns} data={encomiendas} emptyMessage="Sin encomiendas registradas" />

      {/* ── Modal nueva encomienda ── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nueva Encomienda" size="lg">
        <form onSubmit={onSubmit} className="space-y-4">

          {/* Remitente + Destinatario */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <BuscadorCliente
              label="Remitente (quien envía) *"
              value={remitente}
              onChange={setRemitente}
            />
            <BuscadorCliente
              label="Destinatario (quien recibe) *"
              value={destinatario}
              onChange={setDestinatario}
            />
          </div>

          {/* Ruta: origen → destino */}
          <div className="flex items-center gap-2">
            <MapPin size={14} className="text-[#1F3864] shrink-0" />
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">Agencia destino *</label>
              <div className="relative">
                <select
                  value={agenciaDestinoId}
                  onChange={e => setAgenciaDestinoId(e.target.value)}
                  className="w-full appearance-none px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">— Seleccionar agencia destino —</option>
                  {agencias.map(a => (
                    <option key={a.id} value={a.id}>{a.nombre} — {a.ciudad}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Descripción del contenido *</label>
            <input
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              placeholder="Ej: Ropa, electrodoméstico, documentos..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Peso */}
          <div>
              <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                <Weight size={11} /> Peso (kg) — opcional
              </label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={pesoKg}
                onChange={e => setPesoKg(e.target.value)}
                placeholder="Ej: 2.5"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Observaciones</label>
            <textarea
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
              rows={2}
              placeholder="Instrucciones especiales: frágil, no apilar, etc."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Resumen */}
          {(remitente || destinatario) && (
            <div className="bg-blue-50 rounded-lg p-3 text-xs space-y-1">
              {remitente && (
                <p className="flex items-center gap-1.5 text-blue-700">
                  <UserCheck size={12} />
                  <span className="font-medium">Envía:</span> {remitente.apellidos}, {remitente.nombres}
                </p>
              )}
              {destinatario && (
                <p className="flex items-center gap-1.5 text-blue-700">
                  <UserCheck size={12} />
                  <span className="font-medium">Recibe:</span> {destinatario.apellidos}, {destinatario.nombres}
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button variant="primary" type="submit" loading={saving}>Registrar encomienda</Button>
          </div>
        </form>
      </Modal>

      {/* ── Modal voucher ── */}
      {voucher && (
        <Modal
          open={!!voucher}
          onClose={() => setVoucher(null)}
          title="Comprobante de envío"
          size="sm"
        >
          <Voucher
            enc={voucher.enc}
            remitente={voucher.remitente}
            destinatario={voucher.destinatario}
            agenciaOrigen={voucher.agenciaOrigen}
            agenciaDestino={voucher.agenciaDestino}
            operador={voucher.operador}
            onClose={() => setVoucher(null)}
          />
        </Modal>
      )}

      {/* ── Modal detalle ── */}
      <Modal
        open={!!detalleSel}
        onClose={() => setDetalleSel(null)}
        title={`Detalle — ${detalleSel?.codigoTracking}`}
        size="lg"
      >
        {detalleSel && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs text-gray-500 block">Estado</span>
                <Badge estado={detalleSel.estado} />
              </div>
              <div>
                <span className="text-xs text-gray-500 block">Precio</span>
                <span className="font-semibold">S/ {detalleSel.precioEnvio}</span>
              </div>
              {detalleSel.pesoKg && (
                <div>
                  <span className="text-xs text-gray-500 block">Peso</span>
                  <span>{detalleSel.pesoKg} kg</span>
                </div>
              )}
              <div className="col-span-2">
                <span className="text-xs text-gray-500 block">Descripción</span>
                <span>{detalleSel.descripcion}</span>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                Historial de estados
              </h4>
              <TrackingTimeline
                historial={historialData || []}
                estadoActual={detalleSel.estado}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
