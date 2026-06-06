'use client'
import React, { useState, useCallback, useEffect } from 'react'
import useSWR from 'swr'
import {
  Download, FileText, Shield, Search, ChevronLeft, ChevronRight,
  BarChart2, X, RefreshCw, Activity, Lock, Unlock, AlertTriangle,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { Auditoria } from '@/types'
import api from '@/services/api'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from 'recharts'

// ── Acción badge ──────────────────────────────────────────────────────────────

const ACCION_STYLE: Record<string, string> = {
  INSERT:        'bg-emerald-100 text-emerald-800',
  UPDATE:        'bg-amber-100 text-amber-700',
  DELETE:        'bg-red-100 text-red-700',
  LOGIN:         'bg-blue-100 text-blue-700',
  LOGOUT:        'bg-indigo-100 text-indigo-700',
  SELECT:        'bg-gray-100 text-gray-600',
  LOGIN_FALLIDO: 'bg-orange-100 text-orange-700',
}

const ACCION_CHART_COLORS: Record<string, string> = {
  INSERT:        '#064e3b',
  UPDATE:        '#f59e0b',
  DELETE:        '#ef4444',
  LOGIN:         '#3b82f6',
  LOGIN_FALLIDO: '#f97316',
}

function AccionBadge({ accion, onClick }: { accion: string; onClick?: () => void }) {
  const cls = ACCION_STYLE[accion] ?? 'bg-gray-100 text-gray-500'
  return (
    <span
      onClick={onClick}
      className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${cls} ${onClick ? 'cursor-pointer hover:opacity-80' : ''}`}
    >
      {accion.replace('_', ' ')}
    </span>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, accent, clickable, active, onClick }: {
  label: string; value: number; accent: string
  clickable?: boolean; active?: boolean; onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl border p-4 flex flex-col gap-1.5 transition-all ${
        active ? 'border-[#064e3b] ring-2 ring-[#064e3b]/20 bg-emerald-50/30' : 'border-gray-100 shadow-sm'
      } ${clickable ? 'cursor-pointer hover:border-gray-300' : ''}`}
    >
      <div className={`w-2 h-2 rounded-full ${accent}`} />
      <p className="text-2xl font-black tabular-nums text-gray-900">{value}</p>
      <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide leading-tight">{label}</p>
    </div>
  )
}

// ── JSON diff preview ─────────────────────────────────────────────────────────

function tryFormat(s: string): string {
  try { return JSON.stringify(JSON.parse(s), null, 2) } catch { return s }
}

function DiffCell({ antes, despues }: { antes?: string; despues?: string }) {
  const [open, setOpen] = useState(false)
  if (!antes && !despues) return <span className="text-gray-300 text-xs">—</span>
  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="text-[11px] text-[#064e3b] underline underline-offset-2 hover:opacity-70 transition-opacity"
      >
        {open ? 'ocultar' : 'ver cambios'}
      </button>
      {open && (
        <div className="mt-1.5 space-y-1 max-w-xs">
          {antes && (
            <pre className="text-[10px] bg-red-50 text-red-700 rounded-lg px-2.5 py-1.5 max-h-28 overflow-auto whitespace-pre-wrap border border-red-100">
              {tryFormat(antes)}
            </pre>
          )}
          {despues && (
            <pre className="text-[10px] bg-emerald-50 text-emerald-700 rounded-lg px-2.5 py-1.5 max-h-28 overflow-auto whitespace-pre-wrap border border-emerald-100">
              {tryFormat(despues)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

// ── Pagination ────────────────────────────────────────────────────────────────

function Pagination({ page, totalPages, totalElements, size, onPage, onSize }: {
  page: number; totalPages: number; totalElements: number
  size: number; onPage: (p: number) => void; onSize: (s: number) => void
}) {
  const from = totalElements === 0 ? 0 : page * size + 1
  const to   = Math.min((page + 1) * size, totalElements)
  return (
    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span>Filas:</span>
        <select value={size} onChange={e => onSize(Number(e.target.value))}
          className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:ring-2 focus:ring-[#064e3b]/30 focus:border-[#064e3b] focus:outline-none transition-colors">
          {[10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <span className="text-gray-400">{from}–{to} de {totalElements}</span>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => onPage(0)} disabled={page === 0}
          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors">
          <ChevronLeft size={12} className="inline" /><ChevronLeft size={12} className="inline -ml-1.5" />
        </button>
        <button onClick={() => onPage(page - 1)} disabled={page === 0}
          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors">
          <ChevronLeft size={13} />
        </button>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          const start = Math.max(0, Math.min(page - 2, totalPages - 5))
          const p = start + i
          return (
            <button key={p} onClick={() => onPage(p)}
              className={`w-7 h-7 text-xs rounded-lg transition-colors ${
                p === page ? 'bg-[#064e3b] text-white' : 'hover:bg-gray-100 text-gray-600'
              }`}>
              {p + 1}
            </button>
          )
        })}
        <button onClick={() => onPage(page + 1)} disabled={page >= totalPages - 1}
          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors">
          <ChevronRight size={13} />
        </button>
        <button onClick={() => onPage(totalPages - 1)} disabled={page >= totalPages - 1}
          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors">
          <ChevronRight size={12} className="inline" /><ChevronRight size={12} className="inline -ml-1.5" />
        </button>
      </div>
    </div>
  )
}

// ── Helpers de estilo de fila ─────────────────────────────────────────────────

function rowBg(accion: string): string {
  if (accion === 'DELETE')        return 'bg-red-50/30'
  if (accion === 'LOGIN_FALLIDO') return 'bg-orange-50/30'
  return ''
}

function fallbackDetalle(a: Auditoria): string {
  const mod    = a.modulo  ?? 'SISTEMA'
  const entidad = a.entidad ?? mod
  const ref    = a.registroId ? ` #${a.registroId}` : ''
  const usr    = a.usuarioNombre ?? 'usuario'
  switch (a.accion) {
    case 'INSERT': return `Registró ${entidad.toLowerCase()}${ref} en ${mod}`
    case 'UPDATE': return `Modificó ${entidad.toLowerCase()}${ref} en ${mod}`
    case 'DELETE': return `Eliminó ${entidad.toLowerCase()}${ref} de ${mod}`
    case 'LOGIN':  return `${usr} inició sesión`
    case 'LOGOUT': return `${usr} cerró sesión`
    default:       return `${a.accion} en ${mod}`
  }
}

// ── Filtros state ─────────────────────────────────────────────────────────────

interface Filtros {
  q: string; modulo: string; accion: string
  desde: string; hasta: string; ip: string; registroId: string
  page: number; size: number
}

const MODULOS = ['AUTH','PASAJES','ENCOMIENDAS','CAJA','CLIENTES','USUARIOS','AGENCIAS','VIAJES','RUTAS','VEHICULOS']

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AuditoriaPage() {
  const { hasRole, user } = useAuthStore()
  const [mounted, setMounted]               = useState(false)
  const [desbloqueando, setDesbloqueando]   = useState<string | null>(null)

  const [filtros, setFiltros] = useState<Filtros>({
    q: '', modulo: '', accion: '', desde: '', hasta: '', ip: '', registroId: '', page: 0, size: 25,
  })
  const [fechaError, setFechaError] = useState('')
  const [periodo, setPeriodo]       = useState<'hoy' | 'semana'>('hoy')

  useEffect(() => { setMounted(true) }, [])

  const buildQuery = useCallback((f: Filtros) => {
    const p = new URLSearchParams()
    if (f.q)          p.set('q',          f.q)
    if (f.modulo)     p.set('modulo',     f.modulo)
    if (f.accion)     p.set('accion',     f.accion)
    if (f.desde)      p.set('desde',      f.desde)
    if (f.hasta)      p.set('hasta',      f.hasta)
    if (f.ip)         p.set('ip',         f.ip)
    if (f.registroId) p.set('registroId', f.registroId)
    p.set('page', String(f.page))
    p.set('size', String(f.size))
    return `/api/auditoria?${p}`
  }, [])

  const set = (patch: Partial<Filtros>) =>
    setFiltros(prev => ({ ...prev, ...patch, page: 'page' in patch ? (patch.page ?? 0) : 0 }))

  const setFecha = (campo: 'desde' | 'hasta', valor: string) => {
    const nuevo = { ...filtros, [campo]: valor, page: 0 }
    if (nuevo.desde && nuevo.hasta && nuevo.hasta < nuevo.desde)
      setFechaError('"Hasta" no puede ser anterior a "Desde"')
    else setFechaError('')
    setFiltros(nuevo)
  }

  const limpiar = () => {
    setFiltros({ q: '', modulo: '', accion: '', desde: '', hasta: '', ip: '', registroId: '', page: 0, size: filtros.size })
    setFechaError('')
  }

  const esSuperAdmin = mounted && user?.rol === 'SUPER_ADMIN'

  const { data, mutate }             = useSWR(buildQuery(filtros))
  const { data: resumen }            = useSWR('/api/auditoria/resumen', { refreshInterval: 300_000 })
  const { data: actividadRaw }       = useSWR(`/api/auditoria/actividad?periodo=${periodo}`, { refreshInterval: 300_000 })
  const { data: intentosRaw, mutate: mutateIntentos } =
    useSWR(esSuperAdmin ? '/api/auth/intentos-fallidos' : null, { refreshInterval: 30_000 })
  const actividadData: any[]      = actividadRaw ?? []

  const logs: Auditoria[]         = data?.content       ?? []
  const totalElements: number     = data?.totalElements  ?? 0
  const totalPages: number        = data?.totalPages     ?? 1
  const res: any                  = resumen              ?? {}

  const hayFiltros = !!(filtros.q || filtros.modulo || filtros.accion || filtros.desde || filtros.hasta || filtros.ip || filtros.registroId)

  if (mounted && !hasRole('GERENTE') && !hasRole('SUPER_ADMIN') && !hasRole('ADMIN')) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
          <Shield size={24} className="text-gray-300" />
        </div>
        <p className="text-sm text-gray-500 font-medium">Acceso restringido</p>
        <p className="text-xs text-gray-400">Solo GERENTE y SUPER_ADMIN</p>
      </div>
    )
  }

  const desbloquearCuenta = async (email: string) => {
    setDesbloqueando(email)
    try {
      await api.post(`/api/auth/desbloquear?email=${encodeURIComponent(email)}`)
      toast.success(`Cuenta ${email} desbloqueada`)
      mutateIntentos()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Error al desbloquear')
    } finally { setDesbloqueando(null) }
  }

  const exportExcel = async () => {
    const p = new URLSearchParams()
    if (filtros.desde) p.set('desde', filtros.desde)
    if (filtros.hasta) p.set('hasta', filtros.hasta)
    const blob = await api.get(`/api/auditoria/exportar?${p}`, { responseType: 'blob' }) as unknown as Blob
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = 'auditoria.xlsx'; a.click()
    URL.revokeObjectURL(a.href)
  }

  const exportPdf = async () => {
    const p = new URLSearchParams()
    if (filtros.desde) p.set('desde', filtros.desde)
    if (filtros.hasta) p.set('hasta', filtros.hasta)
    const blob = await api.get(`/api/auditoria/exportar-pdf?${p}`, { responseType: 'blob' }) as unknown as Blob
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#064e3b] flex items-center justify-center shrink-0">
            <Activity size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Auditoría del Sistema</h1>
            <p className="text-xs text-gray-500">Bitácora completa de actividad</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={exportPdf}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 text-xs rounded-xl hover:bg-gray-50 transition-colors font-medium">
            <FileText size={13} /> PDF
          </button>
          <button onClick={exportExcel}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 text-xs rounded-xl hover:bg-gray-50 transition-colors font-medium">
            <Download size={13} /> Excel
          </button>
        </div>
      </div>

      {/* ── Panel de seguridad — solo SUPER_ADMIN ── */}
      {esSuperAdmin && (() => {
        const intentos = intentosRaw as any
        const bloqueadas: any[] = intentos?.detalle?.filter((d: any) => d.bloqueado) ?? []
        const conIntentos: any[] = intentos?.detalle?.filter((d: any) => !d.bloqueado && d.intentos > 0) ?? []
        if (!intentos) return null
        return (
          <div className={`rounded-2xl border p-4 ${bloqueadas.length > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Shield size={15} className={bloqueadas.length > 0 ? 'text-red-500' : 'text-gray-400'} />
                <span className="text-sm font-semibold text-gray-800">Panel de seguridad</span>
                {bloqueadas.length > 0 && (
                  <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                    {bloqueadas.length} cuenta{bloqueadas.length > 1 ? 's' : ''} bloqueada{bloqueadas.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <button onClick={() => mutateIntentos()} className="text-gray-400 hover:text-gray-600">
                <RefreshCw size={13} />
              </button>
            </div>
            {bloqueadas.length === 0 && conIntentos.length === 0 ? (
              <p className="text-xs text-gray-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full inline-block" />
                Sin intentos fallidos activos
              </p>
            ) : (
              <div className="space-y-2">
                {[...bloqueadas, ...conIntentos].map((d: any) => (
                  <div key={d.email} className={`flex items-center justify-between px-3 py-2 rounded-xl ${
                    d.bloqueado ? 'bg-red-100/60 border border-red-200' : 'bg-amber-50 border border-amber-100'
                  }`}>
                    <div className="flex items-center gap-2">
                      {d.bloqueado ? <Lock size={13} className="text-red-500" /> : <AlertTriangle size={13} className="text-amber-500" />}
                      <div>
                        <p className="text-xs font-semibold text-gray-800">{d.email}</p>
                        <p className="text-[10px] text-gray-500">
                          {d.bloqueado
                            ? `Bloqueada — ${d.minutosRest} min restantes`
                            : `${d.intentos} intento(s) fallido(s)`}
                        </p>
                      </div>
                    </div>
                    {d.bloqueado && (
                      <button
                        onClick={() => desbloquearCuenta(d.email)}
                        disabled={desbloqueando === d.email}
                        className="flex items-center gap-1 px-2.5 py-1 bg-white border border-red-200 text-red-700 text-xs rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors font-medium">
                        <Unlock size={11} />
                        {desbloqueando === d.email ? 'Desbloqueando…' : 'Desbloquear'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        <StatCard label="Total hoy"   value={res.total    ?? 0} accent="bg-[#064e3b]" />
        <StatCard label="Creaciones"  value={res.inserts  ?? 0} accent="bg-emerald-500"
          clickable active={filtros.accion === 'INSERT'} onClick={() => set({ accion: filtros.accion === 'INSERT' ? '' : 'INSERT' })} />
        <StatCard label="Ediciones"   value={res.updates  ?? 0} accent="bg-amber-400"
          clickable active={filtros.accion === 'UPDATE'} onClick={() => set({ accion: filtros.accion === 'UPDATE' ? '' : 'UPDATE' })} />
        <StatCard label="Eliminados"  value={res.deletes  ?? 0} accent="bg-red-500"
          clickable active={filtros.accion === 'DELETE'} onClick={() => set({ accion: filtros.accion === 'DELETE' ? '' : 'DELETE' })} />
        <StatCard label="Inicios ses." value={res.logins   ?? 0} accent="bg-blue-500"
          clickable active={filtros.accion === 'LOGIN'} onClick={() => set({ accion: filtros.accion === 'LOGIN' ? '' : 'LOGIN' })} />
        <StatCard label="Login fallido" value={res.fallidos ?? 0} accent="bg-orange-500"
          clickable active={filtros.accion === 'LOGIN_FALLIDO'} onClick={() => set({ accion: filtros.accion === 'LOGIN_FALLIDO' ? '' : 'LOGIN_FALLIDO' })} />
      </div>

      {/* ── Gráfico de actividad ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <BarChart2 size={14} className="text-[#064e3b]" />
            <span className="text-sm font-semibold text-gray-800">Actividad</span>
            <span className="text-xs text-gray-400">
              {periodo === 'hoy' ? '— por hora (hoy)' : '— últimos 7 días'}
            </span>
          </div>
          <div className="flex items-center gap-1 p-0.5 bg-gray-100 rounded-xl">
            {(['hoy', 'semana'] as const).map(p => (
              <button key={p} onClick={() => setPeriodo(p)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  periodo === p ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}>
                {p === 'hoy' ? 'Hoy' : 'Semana'}
              </button>
            ))}
          </div>
        </div>
        {mounted && <ResponsiveContainer width="100%" height={160}>
          <BarChart data={actividadData} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}
            barSize={periodo === 'hoy' ? 8 : 18}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false}
              interval={periodo === 'hoy' ? 2 : 0} />
            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
              cursor={{ fill: '#f9fafb' }}
            />
            <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
            {Object.entries(ACCION_CHART_COLORS).map(([accion, color]) => (
              <Bar key={accion} dataKey={accion} stackId="a" fill={color}
                radius={accion === 'LOGIN_FALLIDO' ? [4, 4, 0, 0] : undefined} />
            ))}
          </BarChart>
        </ResponsiveContainer>}
      </div>

      {/* ── Filtros ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {/* Búsqueda */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input type="text" placeholder="Buscar usuario, módulo, IP…"
              value={filtros.q} onChange={e => set({ q: e.target.value })}
              className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#064e3b]/30 focus:border-[#064e3b] focus:outline-none transition-colors" />
          </div>

          {/* Módulo */}
          <select value={filtros.modulo} onChange={e => set({ modulo: e.target.value })}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-[#064e3b]/30 focus:border-[#064e3b] focus:outline-none transition-colors">
            <option value="">Todos los módulos</option>
            {MODULOS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          {/* Acción */}
          <select value={filtros.accion} onChange={e => set({ accion: e.target.value })}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-[#064e3b]/30 focus:border-[#064e3b] focus:outline-none transition-colors">
            <option value="">Todas las acciones</option>
            {['INSERT','UPDATE','DELETE','LOGIN','LOGOUT','LOGIN_FALLIDO','SELECT'].map(a => (
              <option key={a} value={a}>{a.replace('_', ' ')}</option>
            ))}
          </select>

          {/* Refresh + limpiar */}
          <button onClick={() => mutate()}
            className="p-2.5 border border-gray-200 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors" title="Actualizar">
            <RefreshCw size={14} />
          </button>

          {hayFiltros && (
            <button onClick={limpiar}
              className="flex items-center gap-1.5 px-3 py-2.5 border border-gray-200 text-gray-500 text-sm rounded-xl hover:bg-gray-50 transition-colors">
              <X size={13} /> Limpiar
            </button>
          )}
        </div>

        {/* Segunda fila — rango de fechas + IP + ID */}
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex items-center gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Desde</label>
              <input type="date" value={filtros.desde} onChange={e => setFecha('desde', e.target.value)}
                className={`px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-[#064e3b]/30 focus:border-[#064e3b] focus:outline-none transition-colors ${fechaError ? 'border-red-300' : 'border-gray-200'}`} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Hasta</label>
              <input type="date" value={filtros.hasta} onChange={e => setFecha('hasta', e.target.value)}
                className={`px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-[#064e3b]/30 focus:border-[#064e3b] focus:outline-none transition-colors ${fechaError ? 'border-red-300' : 'border-gray-200'}`} />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">IP</label>
            <input type="text" placeholder="192.168…" value={filtros.ip} onChange={e => set({ ip: e.target.value })}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm w-36 focus:ring-2 focus:ring-[#064e3b]/30 focus:border-[#064e3b] focus:outline-none transition-colors font-mono" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">ID Registro</label>
            <input type="number" placeholder="12345" value={filtros.registroId} onChange={e => set({ registroId: e.target.value })}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm w-28 focus:ring-2 focus:ring-[#064e3b]/30 focus:border-[#064e3b] focus:outline-none transition-colors"
              min={1} />
          </div>
          {fechaError && <p className="text-xs text-red-500 self-end pb-2">{fechaError}</p>}
        </div>

        {/* Chips de acción activa (visual indicator) */}
        {filtros.accion && (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[11px] text-gray-400">Filtrando por:</span>
            <AccionBadge accion={filtros.accion} onClick={() => set({ accion: '' })} />
            <X size={10} className="text-gray-400 cursor-pointer hover:text-gray-600" onClick={() => set({ accion: '' })} />
          </div>
        )}
      </div>

      {/* ── Tabla ── */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Fecha / Hora', 'Usuario', 'Módulo', 'Acción', 'Detalle', 'Cambios', 'IP'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <Activity size={24} className="text-gray-200" />
                      <p className="text-sm font-medium text-gray-500">Sin registros de auditoría</p>
                      {hayFiltros && (
                        <button onClick={limpiar} className="text-xs text-[#064e3b] hover:underline">
                          Limpiar filtros
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : logs.map(a => (
                <tr key={a.id} className={`hover:bg-gray-50/60 transition-colors ${rowBg(a.accion)}`}>
                  <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap text-[11px] font-mono">
                    {format(new Date(a.fecha), 'dd/MM/yy HH:mm:ss', { locale: es })}
                  </td>
                  <td className="px-4 py-2.5 text-gray-800 text-xs font-medium whitespace-nowrap">
                    {a.usuarioNombre ?? '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs text-gray-700 font-medium">{a.modulo}</span>
                    {a.entidad && a.entidad !== a.modulo && (
                      <span className="ml-1 text-[10px] text-gray-400">/ {a.entidad}</span>
                    )}
                    {a.registroId && (
                      <span className="ml-1 text-[10px] text-gray-300 font-mono">#{a.registroId}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <AccionBadge accion={a.accion} onClick={() => set({ accion: filtros.accion === a.accion ? '' : a.accion })} />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-600 max-w-[220px] truncate" title={a.detalle ?? fallbackDetalle(a)}>
                    {a.detalle ?? fallbackDetalle(a)}
                  </td>
                  <td className="px-4 py-2.5">
                    <DiffCell antes={a.datosAntes} despues={a.datosDespues} />
                  </td>
                  <td className="px-4 py-2.5 text-[11px] text-gray-400 font-mono whitespace-nowrap">{a.ip ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3">
          <Pagination
            page={filtros.page}
            totalPages={totalPages}
            totalElements={totalElements}
            size={filtros.size}
            onPage={p => setFiltros(prev => ({ ...prev, page: p }))}
            onSize={s => setFiltros(prev => ({ ...prev, size: s, page: 0 }))}
          />
        </div>
      </div>
    </div>
  )
}
