'use client'
import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Shield, ArrowLeft, Check, X, User,
  Ticket, Package, DollarSign, FileText,
  BarChart2, Users, Building2, Settings, ClipboardList,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import api from '@/services/api'
import toast from 'react-hot-toast'

const MODULO_ICONOS: Record<string, React.ElementType> = {
  VENTAS:        Ticket,
  ENCOMIENDAS:   Package,
  CAJA:          DollarSign,
  MANIFIESTOS:   FileText,
  REPORTES:      BarChart2,
  USUARIOS:      Users,
  AGENCIAS:      Building2,
  CONFIGURACION: Settings,
  AUDITORIA:     ClipboardList,
}

const MODULO_COLORES: Record<string, string> = {
  VENTAS:        'bg-blue-50 text-blue-600 border-blue-200',
  ENCOMIENDAS:   'bg-emerald-50 text-emerald-600 border-emerald-200',
  CAJA:          'bg-green-50 text-green-600 border-green-200',
  MANIFIESTOS:   'bg-purple-50 text-purple-600 border-purple-200',
  REPORTES:      'bg-indigo-50 text-indigo-600 border-indigo-200',
  USUARIOS:      'bg-sky-50 text-sky-600 border-sky-200',
  AGENCIAS:      'bg-teal-50 text-teal-600 border-teal-200',
  CONFIGURACION: 'bg-gray-50 text-gray-600 border-gray-200',
  AUDITORIA:     'bg-red-50 text-red-600 border-red-200',
}

interface ModuloItem {
  moduloId: number
  codigo: string
  nombre: string
  descripcion: string
  icono: string
  activo: boolean
}

interface UsuarioInfo {
  id: number
  nombre: string
  email: string
  rol: string
  agencia: string
}

const ROL_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Administrador',
  GERENTE:     'Gerente General',
  OPERADOR:    'Operador',
  CONDUCTOR:   'Conductor',
}

export default function ModulosUsuarioPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user: me } = useAuthStore()

  const [usuario, setUsuario] = useState<UsuarioInfo | null>(null)
  const [modulos, setModulos] = useState<ModuloItem[]>([])
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState<string | null>(null)

  // Solo SUPER_ADMIN puede acceder
  useEffect(() => {
    if (me && me.rol !== 'SUPER_ADMIN') {
      router.replace('/')
    }
  }, [me, router])

  useEffect(() => {
    Promise.all([
      api.get(`/api/usuarios/${id}/modulos`),
      api.get(`/api/usuarios/${id}`),
    ]).then(([modRes, usrRes]) => {
      setModulos(modRes.data?.data ?? modRes.data ?? [])
      const u = usrRes.data?.data ?? usrRes.data
      if (u) {
        setUsuario({
          id: u.id,
          nombre: u.nombre ?? `${u.nombres} ${u.apellidos}`,
          email: u.email,
          rol: u.rol,
          agencia: u.agencia ?? u.agenciaNombre ?? `Agencia #${u.agenciaId}`,
        })
      }
    }).catch(() => toast.error('Error al cargar datos del usuario'))
      .finally(() => setLoading(false))
  }, [id])

  const toggleModulo = async (modulo: ModuloItem) => {
    // AUDITORIA nunca se puede asignar
    if (modulo.codigo === 'AUDITORIA') return
    // SUPER_ADMIN tiene todos siempre
    if (usuario?.rol === 'SUPER_ADMIN') return

    setGuardando(modulo.codigo)
    const nuevoEstado = !modulo.activo
    const modulosActivos = modulos
      .filter(m => m.codigo !== 'AUDITORIA')
      .map(m => m.codigo === modulo.codigo ? { ...m, activo: nuevoEstado } : m)
      .filter(m => m.activo)
      .map(m => m.moduloId)

    try {
      await api.put(`/api/usuarios/${id}/modulos`, { moduloIds: modulosActivos })
      setModulos(prev => prev.map(m =>
        m.codigo === modulo.codigo ? { ...m, activo: nuevoEstado } : m
      ))
      toast.success(`Módulo ${modulo.nombre} ${nuevoEstado ? 'habilitado' : 'deshabilitado'}`)
    } catch {
      toast.error('Error al actualizar módulo')
    } finally {
      setGuardando(null)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl space-y-4 animate-pulse">
        <div className="h-24 bg-white rounded-2xl border border-gray-200" />
        {[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-white rounded-xl border border-gray-200" />)}
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/usuarios')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={18} className="text-gray-500" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Shield size={20} className="text-primary-900" />
            Gestión de módulos
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Controla qué partes del sistema puede usar este usuario
          </p>
        </div>
      </div>

      {/* Tarjeta del usuario */}
      {usuario && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-primary-900 rounded-xl flex items-center justify-center text-white font-bold shrink-0">
            <User size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900">{usuario.nombre}</p>
            <p className="text-sm text-gray-500">{usuario.email}</p>
            <p className="text-xs text-gray-400 mt-0.5">{usuario.agencia}</p>
          </div>
          <span className="text-xs font-medium px-3 py-1 bg-primary-50 text-primary-800 rounded-full border border-primary-200">
            {ROL_LABEL[usuario.rol] ?? usuario.rol}
          </span>
        </div>
      )}

      {/* Aviso SUPER_ADMIN */}
      {usuario?.rol === 'SUPER_ADMIN' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
          <p className="font-semibold">El Super Administrador tiene acceso total permanente.</p>
          <p className="text-xs text-red-600 mt-0.5">No es posible restringir módulos para este rol.</p>
        </div>
      )}

      {/* Lista de módulos */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Módulos del sistema
          </p>
          {usuario?.rol !== 'SUPER_ADMIN' && (
            <span className="text-xs font-medium px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
              {modulos.filter(m => m.activo && m.codigo !== 'AUDITORIA').length} de {modulos.filter(m => m.codigo !== 'AUDITORIA').length} módulos activos
            </span>
          )}
          {usuario?.rol === 'SUPER_ADMIN' && (
            <span className="text-xs font-medium px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded-full">
              Acceso total — {modulos.length} módulos
            </span>
          )}
        </div>
        {modulos.map(m => {
          const Icon = MODULO_ICONOS[m.codigo] ?? Shield
          const colorClass = MODULO_COLORES[m.codigo] ?? 'bg-gray-50 text-gray-600 border-gray-200'
          const esSuperAdmin = usuario?.rol === 'SUPER_ADMIN'
          const esAuditoria = m.codigo === 'AUDITORIA'
          const deshabilitado = esSuperAdmin || esAuditoria
          const isLoading = guardando === m.codigo

          return (
            <div
              key={m.codigo}
              className={`
                bg-white rounded-xl border p-4 flex items-center gap-4
                ${deshabilitado ? 'opacity-60' : 'hover:border-gray-300 cursor-pointer'}
                ${m.activo && !deshabilitado ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-200'}
                transition-all
              `}
              onClick={() => !deshabilitado && !isLoading && toggleModulo(m)}
            >
              {/* Ícono del módulo */}
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${colorClass}`}>
                <Icon size={18} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-800">{m.nombre}</p>
                  {esAuditoria && (
                    <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">
                      Solo SUPER_ADMIN
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{m.descripcion}</p>
              </div>

              {/* Toggle */}
              <div className={`
                w-11 h-6 rounded-full flex items-center px-0.5 shrink-0 transition-colors duration-200
                ${isLoading ? 'opacity-50' : ''}
                ${esSuperAdmin || m.activo ? 'bg-emerald-500' : 'bg-gray-200'}
              `}>
                <div className={`
                  w-5 h-5 bg-white rounded-full shadow-sm flex items-center justify-center
                  transition-transform duration-200
                  ${esSuperAdmin || m.activo ? 'translate-x-5' : 'translate-x-0'}
                `}>
                  {isLoading
                    ? <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                    : (esSuperAdmin || m.activo)
                      ? <Check size={10} className="text-emerald-600" />
                      : <X size={10} className="text-gray-400" />
                  }
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-gray-400 text-center pb-2">
        Los cambios se aplican inmediatamente. El usuario verá los módulos actualizados en su próximo inicio de sesión.
      </p>
    </div>
  )
}
