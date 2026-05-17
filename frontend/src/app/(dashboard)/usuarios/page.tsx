'use client'
import React from 'react'
import useSWR from 'swr'
import { Users, Shield, Settings } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/stores/authStore'
import Link from 'next/link'
import api from '@/services/api'
import toast from 'react-hot-toast'

const ROL_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  GERENTE:     'Gerente',
  OPERADOR:    'Operador',
  CONDUCTOR:   'Conductor',
}

const ROL_COLOR: Record<string, string> = {
  SUPER_ADMIN: 'bg-red-100 text-red-700',
  GERENTE:     'bg-indigo-100 text-indigo-700',
  OPERADOR:    'bg-emerald-100 text-emerald-700',
  CONDUCTOR:   'bg-amber-100 text-amber-700',
}

interface UsuarioRow {
  id: number
  nombres: string
  apellidos: string
  email: string
  dni: string
  rol: string
  agenciaId: number
  activo: boolean
}

export default function UsuariosPage() {
  const { user: me } = useAuthStore()
  const { data, mutate } = useSWR('/api/usuarios')
  const usuarios: UsuarioRow[] = data?.data ?? data ?? []

  const esSuperAdmin = me?.rol === 'SUPER_ADMIN'

  const toggleEstado = async (u: UsuarioRow) => {
    if (u.rol === 'SUPER_ADMIN') { toast.error('No se puede desactivar al Super Administrador'); return }
    try {
      await api.patch(`/api/usuarios/${u.id}/estado`, { activo: !u.activo })
      toast.success(`Usuario ${u.activo ? 'desactivado' : 'activado'}`)
      mutate()
    } catch {
      toast.error('Error al cambiar estado')
    }
  }

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Users size={20} className="text-primary-900" />
            Gestión de usuarios
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{usuarios.length} usuarios registrados</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Usuario</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rol</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">DNI</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {usuarios.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-10 text-gray-400 text-sm">
                  No hay usuarios registrados
                </td>
              </tr>
            )}
            {usuarios.map(u => (
              <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary-900 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {(u.nombres?.[0] ?? '?').toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{u.nombres} {u.apellidos}</p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${ROL_COLOR[u.rol] ?? 'bg-gray-100 text-gray-600'}`}>
                    {ROL_LABEL[u.rol] ?? u.rol}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-gray-600">{u.dni}</td>
                <td className="px-4 py-3">
                  <Badge
                    estado={u.activo ? 'DISPONIBLE' : 'CANCELADO'}
                    label={u.activo ? 'Activo' : 'Inactivo'}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {u.rol !== 'SUPER_ADMIN' && (
                      <Button
                        size="sm"
                        variant={u.activo ? 'danger' : 'secondary'}
                        onClick={() => toggleEstado(u)}
                      >
                        {u.activo ? 'Desactivar' : 'Activar'}
                      </Button>
                    )}
                    {esSuperAdmin && u.rol !== 'SUPER_ADMIN' && (
                      <Link href={`/usuarios/${u.id}/modulos`}>
                        <Button size="sm" variant="secondary" icon={Shield}>
                          Módulos
                        </Button>
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
