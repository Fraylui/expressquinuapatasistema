'use client'
import React, { useState } from 'react'
import useSWR from 'swr'
import { Download, Shield } from 'lucide-react'
import { Table, Column } from '@/components/ui/Table'
import { MetricCard } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/stores/authStore'
import { Auditoria } from '@/types'
import api from '@/services/api'

export default function AuditoriaPage() {
  const { user, hasRole } = useAuthStore()
  const [filtros, setFiltros] = useState({ modulo: '', accion: '' })
  const params = new URLSearchParams()
  if (filtros.modulo) params.set('modulo', filtros.modulo)
  if (filtros.accion) params.set('accion', filtros.accion)
  const query = params.toString() ? `?${params}` : ''
  const { data } = useSWR(`/api/auditoria${query}`)
  const { data: resumenData } = useSWR('/api/auditoria/resumen')
  const logs: Auditoria[] = data?.content || []
  const resumen = resumenData || {}

  if (!hasRole('GERENTE') && !hasRole('SUPER_ADMIN') && !hasRole('ADMIN')) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Shield size={40} className="text-gray-300 mb-3" />
        <p className="text-gray-500 text-sm">Acceso restringido — Solo GERENTE y SUPER_ADMIN</p>
      </div>
    )
  }

  const exportar = async () => {
    const blob = await api.get('/api/auditoria/exportar', { responseType: 'blob' }) as unknown as Blob
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'auditoria.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  }

  const criticidad = (accion: string) => {
    switch (accion) {
      case 'DELETE': return 'bg-red-50'
      case 'UPDATE': return 'bg-yellow-50'
      default: return ''
    }
  }

  const columns: Column<Auditoria>[] = [
    { key: 'fecha',        header: 'Fecha/Hora', render: r => new Date(r.fecha).toLocaleString('es-PE') },
    { key: 'usuarioNombre',header: 'Usuario' },
    { key: 'modulo',       header: 'Módulo' },
    { key: 'accion',       header: 'Acción', render: r => (
      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
        r.accion === 'DELETE' ? 'bg-red-100 text-red-700'
        : r.accion === 'UPDATE' ? 'bg-yellow-100 text-yellow-700'
        : 'bg-blue-100 text-blue-700'
      }`}>{r.accion}</span>
    )},
    { key: 'ip', header: 'IP' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Auditoría del Sistema</h1>
          <p className="text-sm text-gray-500">Bitácora completa de actividad</p>
        </div>
        <Button icon={Download} variant="secondary" size="sm" onClick={exportar}>Exportar Excel</Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard label="Total hoy"  value={resumen.total  ?? 0} color="blue" icon={<Shield size={18}/>} />
        <MetricCard label="Registros"  value={resumen.inserts ?? 0} color="green" />
        <MetricCard label="Ediciones"  value={resumen.updates ?? 0} color="yellow" />
        <MetricCard label="Eliminados" value={resumen.deletes ?? 0} color="red" />
      </div>

      <div className="flex gap-3">
        <select value={filtros.modulo} onChange={e => setFiltros(v => ({ ...v, modulo: e.target.value }))}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="">Todos los módulos</option>
          {['PASAJES','ENCOMIENDAS','CAJA','AUTH','USUARIOS','AGENCIAS'].map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select value={filtros.accion} onChange={e => setFiltros(v => ({ ...v, accion: e.target.value }))}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="">Todas las acciones</option>
          {['INSERT','UPDATE','DELETE','READ'].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <Table columns={columns} data={logs} emptyMessage="Sin registros de auditoría" />
    </div>
  )
}
