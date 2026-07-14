'use client'
import React, { useEffect, useMemo, useState } from 'react'
import { Clock, MapPin, ArrowRight, CalendarDays } from 'lucide-react'
import api from '@/services/api'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import PublicShell, { syne, glassCard, glassInput, EstadoChip } from '@/components/public/PublicShell'

interface ViajePublico {
  id: number
  estado: string
  fechaHoraSal: string
  ruta?: { origen: string; destino: string; distanciaKm?: number }
  vehiculo?: { placa: string; tipo: string; numAsientos: number }
}

const fmtHora = (iso: string) => {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '—' : format(d, 'HH:mm')
}
const fmtFecha = (iso: string) => {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '—' : format(d, "EEEE dd 'de' MMMM", { locale: es })
}
const mismaFecha = (iso: string, yyyymmdd: string) => {
  const d = new Date(iso)
  return !isNaN(d.getTime()) && format(d, 'yyyy-MM-dd') === yyyymmdd
}

export default function HorariosPage() {
  const [viajes, setViajes] = useState<ViajePublico[]>([])
  const [loading, setLoading] = useState(true)
  const [origen, setOrigen] = useState('')
  const [destino, setDestino] = useState('')
  const [fecha, setFecha] = useState('')

  useEffect(() => {
    api.get('/api/viajes/publico')
      .then((r: any) => setViajes(r.data?.data || r.data || []))
      .catch(() => setViajes([]))
      .finally(() => setLoading(false))
  }, [])

  /* Los orígenes/destinos salen de las rutas realmente programadas — nada hardcodeado */
  const origenes = useMemo(
    () => Array.from(new Set(viajes.map(v => v.ruta?.origen).filter(Boolean) as string[])).sort(),
    [viajes]
  )
  const destinos = useMemo(
    () => Array.from(new Set(viajes.map(v => v.ruta?.destino).filter(Boolean) as string[])).sort(),
    [viajes]
  )

  const filtrados = useMemo(() =>
    viajes
      .filter(v =>
        (!origen  || v.ruta?.origen  === origen) &&
        (!destino || v.ruta?.destino === destino) &&
        (!fecha   || mismaFecha(v.fechaHoraSal, fecha))
      )
      .sort((a, b) => (a.fechaHoraSal ?? '').localeCompare(b.fechaHoraSal ?? '')),
    [viajes, origen, destino, fecha]
  )

  const selectStyle: React.CSSProperties = { ...glassInput }
  const hayFiltro = !!(origen || destino || fecha)

  return (
    <PublicShell active="horarios" subtitle="Consulta de horarios">
      {/* Hero */}
      <div className="mb-8 text-center">
        <div
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: 'rgba(22,163,74,0.14)', border: '1px solid rgba(22,163,74,0.3)' }}
        >
          <Clock size={26} style={{ color: '#4ade80' }} />
        </div>
        <h1 className={`${syne.className} text-2xl font-extrabold text-white sm:text-[1.7rem]`}>
          Próximas salidas
        </h1>
        <p className="mt-2 text-sm text-white/45">
          Consulta los horarios programados y elige tu viaje
        </p>
      </div>

      {/* Filtros */}
      <div className="mb-6 rounded-2xl p-4 sm:p-5" style={glassCard}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-white/40">
              Origen
            </label>
            <select
              value={origen}
              onChange={e => setOrigen(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none"
              style={selectStyle}
            >
              <option value="">Todos</option>
              {origenes.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-white/40">
              Destino
            </label>
            <select
              value={destino}
              onChange={e => setDestino(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none"
              style={selectStyle}
            >
              <option value="">Todos</option>
              {destinos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-white/40">
              Fecha
            </label>
            <input
              type="date"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none"
              style={selectStyle}
            />
          </div>
        </div>
        {hayFiltro && (
          <button
            onClick={() => { setOrigen(''); setDestino(''); setFecha('') }}
            className="mt-3 text-xs font-medium text-white/40 transition-colors duration-150 hover:text-white/70"
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Resultados */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 animate-pulse rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }} />
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={glassCard}>
          <CalendarDays size={36} className="mx-auto mb-3 text-white/20" />
          <p className="text-sm text-white/60">
            {hayFiltro
              ? 'No hay salidas programadas para los filtros seleccionados'
              : 'Por el momento no hay salidas programadas'}
          </p>
          <p className="mt-1 text-xs text-white/35">
            Consulta en nuestras agencias o vuelve a revisar más tarde
          </p>
        </div>
      ) : (
        <div>
          <p className="mb-3 text-xs text-white/40">
            {filtrados.length} salida{filtrados.length !== 1 ? 's' : ''} programada{filtrados.length !== 1 ? 's' : ''}
          </p>
          <div className="space-y-3">
            {filtrados.map(v => (
              <div key={v.id} className="flex items-center gap-4 rounded-xl p-4" style={glassCard}>
                <div
                  className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl"
                  style={{ background: 'rgba(22,163,74,0.14)', border: '1px solid rgba(22,163,74,0.3)' }}
                >
                  <span className="font-mono text-lg font-bold leading-none" style={{ color: '#4ade80' }}>
                    {fmtHora(v.fechaHoraSal)}
                  </span>
                  <span className="mt-0.5 text-[9px] uppercase tracking-wider text-white/35">hrs</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-[0.95rem] font-semibold text-white">
                    <span>{v.ruta?.origen || '—'}</span>
                    <ArrowRight size={14} className="shrink-0 text-white/30" />
                    <span>{v.ruta?.destino || '—'}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                    <span className="text-xs capitalize text-white/40">{fmtFecha(v.fechaHoraSal)}</span>
                    {v.vehiculo && (
                      <span className="text-xs text-white/40">{v.vehiculo.tipo} · {v.vehiculo.placa}</span>
                    )}
                    {v.ruta?.distanciaKm && (
                      <span className="flex items-center gap-1 text-xs text-white/40">
                        <MapPin size={10} />
                        {v.ruta.distanciaKm} km
                      </span>
                    )}
                  </div>
                </div>
                <EstadoChip estado={v.estado} />
              </div>
            ))}
          </div>
        </div>
      )}
    </PublicShell>
  )
}
