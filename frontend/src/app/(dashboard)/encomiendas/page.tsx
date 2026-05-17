'use client'
import React, { useState } from 'react'
import useSWR from 'swr'
import toast from 'react-hot-toast'
import { Plus, Search, Package, X, UserCheck, Loader2 } from 'lucide-react'
import { Table, Column } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { TrackingTimeline } from '@/components/modules/encomiendas/TrackingTimeline'
import { encomiendaService } from '@/services/encomiendas.service'
import { clientesService } from '@/services/clientes.service'
import { Encomienda } from '@/types'
import type { Cliente } from '@/types'

// ─── Buscador de cliente por DNI ─────────────────────────────────────────────

interface BuscadorClienteProps {
  label: string
  value: Cliente | null
  onChange: (c: Cliente | null) => void
}

function BuscadorCliente({ label, value, onChange }: BuscadorClienteProps) {
  const [dniInput, setDniInput] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const buscar = async () => {
    const dni = dniInput.trim()
    if (!dni) return
    setBuscando(true)
    setError(null)
    try {
      const cliente = await clientesService.buscarPorDoc('DNI', dni)
      onChange(cliente)
    } catch {
      setError('No se encontró cliente con ese DNI')
      onChange(null)
    } finally {
      setBuscando(false)
    }
  }

  const limpiar = () => {
    onChange(null)
    setDniInput('')
    setError(null)
  }

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
            <p className="text-xs text-gray-500">DNI {value.numDoc}</p>
          </div>
          <button onClick={limpiar} className="p-1 rounded text-gray-400 hover:text-red-500 shrink-0">
            <X size={14} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex gap-2">
        <input
          value={dniInput}
          onChange={e => setDniInput(e.target.value.replace(/\D/g, '').slice(0, 8))}
          onKeyDown={e => e.key === 'Enter' && buscar()}
          placeholder="DNI (8 dígitos)"
          maxLength={8}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          type="button"
          onClick={buscar}
          disabled={buscando || dniInput.length < 8}
          className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 text-sm rounded-lg transition-colors"
        >
          {buscando ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Buscar
        </button>
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function EncomiendaPage() {
  const { data, mutate } = useSWR('/api/encomiendas/lista')
  const encomiendas: Encomienda[] = data || []

  const [modalOpen, setModalOpen]     = useState(false)
  const [detalleSel, setDetalleSel]   = useState<Encomienda | null>(null)
  const [saving, setSaving]           = useState(false)

  // Estado del formulario
  const [remitente, setRemitente]       = useState<Cliente | null>(null)
  const [destinatario, setDestinatario] = useState<Cliente | null>(null)
  const [descripcion, setDescripcion]   = useState('')
  const [pesoKg, setPesoKg]             = useState('')
  const [observaciones, setObservaciones] = useState('')

  const { data: historialData } = useSWR(
    detalleSel ? `/api/encomiendas/${detalleSel.id}/historial` : null
  )

  const abrirModal = () => {
    setRemitente(null); setDestinatario(null)
    setDescripcion(''); setPesoKg(''); setObservaciones('')
    setModalOpen(true)
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!remitente)    { toast.error('Ingresa el DNI del remitente'); return }
    if (!destinatario) { toast.error('Ingresa el DNI del destinatario'); return }
    if (!descripcion.trim()) { toast.error('La descripción es obligatoria'); return }

    setSaving(true)
    try {
      await encomiendaService.registrar({
        remitenteId:    remitente.id,
        destinatarioId: destinatario.id,
        descripcion:    descripcion.trim(),
        pesoKg:         pesoKg ? parseFloat(pesoKg) : undefined,
        observaciones:  observaciones.trim() || undefined,
      })
      toast.success('Encomienda registrada')
      setModalOpen(false)
      mutate()
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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nueva Encomienda" size="md">
        <form onSubmit={onSubmit} className="space-y-4">
          {/* Remitente */}
          <BuscadorCliente
            label="Remitente (quien envía) *"
            value={remitente}
            onChange={setRemitente}
          />

          {/* Destinatario */}
          <BuscadorCliente
            label="Destinatario (quien recibe) *"
            value={destinatario}
            onChange={setDestinatario}
          />

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
            <label className="block text-xs font-medium text-gray-700 mb-1">Peso (kg)</label>
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
              placeholder="Instrucciones especiales de manejo, etc."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Resumen de clientes */}
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
