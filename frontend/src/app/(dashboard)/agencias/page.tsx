'use client'
import React, { useState } from 'react'
import useSWR from 'swr'
import toast from 'react-hot-toast'
import { Plus, Building2, MapPin, Phone } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { useAuthStore } from '@/stores/authStore'
import { Agencia } from '@/types'
import api from '@/services/api'

export default function AgenciasPage() {
  const { hasRole } = useAuthStore()
  const { data, mutate } = useSWR('/api/agencias')
  const agencias: Agencia[] = data || []
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ nombre: '', codigo: '', ciudad: '', telefono: '', email: '', ruc: '' })

  const crear = async () => {
    try {
      await api.post('/api/agencias', form)
      toast.success('Agencia creada')
      setModalOpen(false)
      mutate()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al crear agencia')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Agencias</h1>
          <p className="text-sm text-gray-500">Sucursales del sistema</p>
        </div>
        {(hasRole('GERENTE') || hasRole('SUPER_ADMIN')) && (
          <Button icon={Plus} onClick={() => setModalOpen(true)}>Nueva agencia</Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {agencias.map(a => (
          <div key={a.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
                  <Building2 size={20} className="text-primary-900" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{a.nombre}</p>
                  <p className="text-xs text-gray-400">{a.codigo}</p>
                </div>
              </div>
              <Badge estado={a.activo ? 'DISPONIBLE' : 'CANCELADO'} label={a.activo ? 'Activa' : 'Inactiva'} />
            </div>
            <div className="space-y-1.5">
              {a.ciudad && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <MapPin size={12} /> {a.ciudad}
                </div>
              )}
              {a.telefono && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Phone size={12} /> {a.telefono}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nueva Agencia">
        <div className="space-y-4">
          {[
            { label: 'Código',   key: 'codigo',   ph: 'AYA-02' },
            { label: 'Nombre',   key: 'nombre',   ph: 'Sede Ayacucho' },
            { label: 'Ciudad',   key: 'ciudad',   ph: 'Ayacucho' },
            { label: 'Teléfono', key: 'telefono', ph: '066-000000' },
            { label: 'Email',    key: 'email',    ph: 'sede@quinuapata.com' },
            { label: 'RUC',      key: 'ruc',      ph: '20601234567' },
          ].map(({ label, key, ph }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
              <input
                value={(form as any)[key]}
                onChange={e => setForm(v => ({ ...v, [key]: e.target.value }))}
                placeholder={ph}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          ))}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button variant="primary" onClick={crear}>Crear agencia</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
