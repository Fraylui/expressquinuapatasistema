'use client'
import React, { useState, useEffect } from 'react'
import useSWR from 'swr'
import toast from 'react-hot-toast'
import { DollarSign, TrendingUp, TrendingDown, Lock, Unlock, Plus } from 'lucide-react'
import { MetricCard } from '@/components/ui/Card'
import { Table, Column } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { cajaService } from '@/services/caja.service'
import { MovimientoCaja } from '@/types'
import { useWebSocket } from '@/hooks/useWebSocket'

export default function CajaPage() {
  const { data: turnoData, mutate: mutateTurno } = useSWR('/api/caja/turno-actual')
  const turno = turnoData
  const [movimientos, setMovimientos] = useState<MovimientoCaja[]>([])
  const [modalEgreso, setModalEgreso] = useState(false)
  const [modalCierre, setModalCierre] = useState(false)
  const [egreso, setEgreso] = useState({ concepto: '', monto: '' })
  const [montoFisico, setMontoFisico] = useState('')
  const { suscribeToCaja, connected } = useWebSocket()

  const { data: movsData, mutate: mutateMovs } = useSWR(
    turno ? `/api/caja/movimientos/${turno.id}` : null
  )

  useEffect(() => {
    if (movsData) setMovimientos(movsData)
  }, [movsData])

  useEffect(() => {
    if (!turno?.id || !connected) return
    const sub = suscribeToCaja(turno.id, () => {
      mutateMovs()
      mutateTurno()
    })
    return () => sub?.unsubscribe()
  }, [turno?.id, connected])

  const abrirCaja = async () => {
    try {
      await cajaService.abrir(200)
      toast.success('Caja abierta con S/200.00')
      mutateTurno()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al abrir caja')
    }
  }

  const registrarEgreso = async () => {
    if (!turno?.id || !egreso.concepto || !egreso.monto) return
    try {
      await cajaService.registrarMovimiento({
        cajaId: turno.id, tipo: 'EGRESO', concepto: egreso.concepto, monto: parseFloat(egreso.monto)
      })
      toast.success('Egreso registrado')
      setModalEgreso(false)
      setEgreso({ concepto: '', monto: '' })
      mutateMovs()
      mutateTurno()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error')
    }
  }

  const cerrarCaja = async () => {
    if (!turno?.id || !montoFisico) return
    try {
      await cajaService.cerrar(turno.id, parseFloat(montoFisico))
      toast.success('Caja cerrada correctamente')
      setModalCierre(false)
      mutateTurno()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al cerrar caja')
    }
  }

  const columns: Column<MovimientoCaja>[] = [
    { key: 'createdAt', header: 'Hora', render: r => new Date(r.createdAt).toLocaleTimeString('es-PE') },
    { key: 'tipo',      header: 'Tipo', render: r => <Badge estado={r.tipo === 'INGRESO' ? 'DISPONIBLE' : 'CANCELADO'} label={r.tipo} /> },
    { key: 'concepto',  header: 'Concepto' },
    { key: 'monto',     header: 'Monto',   render: r => <span className={r.tipo === 'INGRESO' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
      {r.tipo === 'INGRESO' ? '+' : '-'}S/ {r.monto}
    </span>},
    { key: 'saldoAcumulado', header: 'Saldo', render: r => `S/ ${r.saldoAcumulado ?? '—'}` },
  ]

  if (!turno) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
          <Lock size={24} className="text-gray-400" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-gray-800">Caja no abierta</h3>
          <p className="text-sm text-gray-500 mt-1">Abra su turno para comenzar a operar</p>
        </div>
        <Button icon={Unlock} onClick={abrirCaja}>Abrir turno (S/200)</Button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Caja</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge estado={turno.estado} />
            <span className="text-xs text-gray-500">Turno activo</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={Plus} size="sm" onClick={() => setModalEgreso(true)}>Egreso</Button>
          <Button variant="danger" icon={Lock} size="sm" onClick={() => setModalCierre(true)}>Cerrar turno</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard label="Apertura"   value={`S/ ${turno.montoApertura}`}  icon={<DollarSign size={18}/>} color="blue" />
        <MetricCard label="Ingresos"   value={`S/ ${turno.totalIngresos}`}  icon={<TrendingUp size={18}/>} color="green" />
        <MetricCard label="Egresos"    value={`S/ ${turno.totalEgresos}`}   icon={<TrendingDown size={18}/>} color="red" />
        <MetricCard label="Saldo actual" value={`S/ ${turno.saldoActual}`} icon={<DollarSign size={18}/>} color="blue" />
      </div>

      <Table columns={columns} data={movimientos} emptyMessage="Sin movimientos en este turno" />

      <Modal open={modalEgreso} onClose={() => setModalEgreso(false)} title="Registrar Egreso">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Concepto</label>
            <input value={egreso.concepto} onChange={e => setEgreso(v => ({ ...v, concepto: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Descripción del egreso" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Monto S/</label>
            <input value={egreso.monto} onChange={e => setEgreso(v => ({ ...v, monto: e.target.value }))}
              type="number" step="0.01" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setModalEgreso(false)}>Cancelar</Button>
            <Button variant="danger" onClick={registrarEgreso}>Registrar egreso</Button>
          </div>
        </div>
      </Modal>

      <Modal open={modalCierre} onClose={() => setModalCierre(false)} title="Cerrar Turno — Arqueo">
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Apertura:</span><span>S/ {turno.montoApertura}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Ingresos:</span><span className="text-green-600">+S/ {turno.totalIngresos}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Egresos:</span><span className="text-red-500">-S/ {turno.totalEgresos}</span></div>
            <div className="flex justify-between font-semibold border-t pt-2"><span>Saldo sistema:</span><span>S/ {turno.saldoActual}</span></div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Monto físico contado S/</label>
            <input value={montoFisico} onChange={e => setMontoFisico(e.target.value)}
              type="number" step="0.01" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setModalCierre(false)}>Cancelar</Button>
            <Button variant="danger" icon={Lock} onClick={cerrarCaja}>Confirmar cierre</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
