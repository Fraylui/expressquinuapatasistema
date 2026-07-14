'use client'
import React, { useEffect, useRef, useState } from 'react'
import { Search, PackageSearch, ArrowRight, MapPin, CalendarClock } from 'lucide-react'
import { TrackingTimeline } from '@/components/modules/encomiendas/TrackingTimeline'
import { encomiendaService } from '@/services/encomiendas.service'
import PublicShell, { syne, glassCard, glassInput, EstadoChip, GREEN, GREEN_D } from '@/components/public/PublicShell'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const fmtFechaHora = (iso?: string) => {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return format(d, "dd 'de' MMMM yyyy, HH:mm", { locale: es })
}

/**
 * Vista de rastreo. Si llega initialCodigo (desde el QR del comprobante:
 * /tracking/EXP-2026-00001) busca automáticamente al cargar.
 */
export default function TrackingView({ initialCodigo }: { initialCodigo?: string }) {
  const [codigo, setCodigo] = useState(initialCodigo ?? '')
  const [resultado, setResultado] = useState<any>(null)
  const [noEncontrado, setNoEncontrado] = useState(false)
  const [loading, setLoading] = useState(false)
  const buscoInicial = useRef(false)

  const buscar = async (valor?: string) => {
    const cod = (valor ?? codigo).trim()
    if (!cod) return
    setLoading(true)
    setNoEncontrado(false)
    try {
      const res = await encomiendaService.getByTracking(cod.toUpperCase())
      setResultado(res.data)
    } catch {
      setResultado(null)
      setNoEncontrado(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (initialCodigo && !buscoInicial.current) {
      buscoInicial.current = true
      buscar(initialCodigo)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCodigo])

  const registrado = fmtFechaHora(resultado?.fechaRegistro)
  const entregaEst = fmtFechaHora(resultado?.fechaEntregaEst)

  return (
    <PublicShell active="tracking" subtitle="Seguimiento de encomiendas">
      {/* Hero */}
      <div className="mb-8 text-center">
        <div
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: 'rgba(22,163,74,0.14)', border: '1px solid rgba(22,163,74,0.3)' }}
        >
          <PackageSearch size={26} style={{ color: '#4ade80' }} />
        </div>
        <h1 className={`${syne.className} text-2xl font-extrabold text-white sm:text-[1.7rem]`}>
          Rastrea tu encomienda
        </h1>
        <p className="mt-2 text-sm text-white/45">
          Ingresa el código de seguimiento de tu comprobante para ver el estado de tu envío
        </p>
      </div>

      {/* Buscador */}
      <div className="mb-8 flex flex-col gap-2 sm:flex-row">
        <input
          value={codigo}
          onChange={e => setCodigo(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && buscar()}
          placeholder="Ej: EXP-2026-00001"
          autoCapitalize="characters"
          className="flex-1 rounded-xl px-4 py-3.5 font-mono text-sm uppercase tracking-wide text-white outline-none transition-all duration-200 placeholder:normal-case placeholder:text-white/25"
          style={glassInput}
          onFocus={e => {
            e.currentTarget.style.border = '1.5px solid rgba(22,163,74,0.55)'
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(22,163,74,0.12)'
          }}
          onBlur={e => {
            e.currentTarget.style.border = '1.5px solid rgba(255,255,255,0.09)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        />
        <button
          onClick={() => buscar()}
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-xl border-none px-6 py-3.5 text-sm font-bold text-white transition-all duration-200 hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          style={{ background: GREEN, boxShadow: '0 6px 20px rgba(22,163,74,0.3)', fontFamily: 'inherit' }}
          onMouseEnter={e => { if (!loading) e.currentTarget.style.background = GREEN_D }}
          onMouseLeave={e => { e.currentTarget.style.background = GREEN }}
        >
          {loading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-white" />
          ) : (
            <Search size={16} strokeWidth={2.5} />
          )}
          {loading ? 'Buscando…' : 'Buscar'}
        </button>
      </div>

      {/* No encontrado */}
      {noEncontrado && (
        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.22)' }}
        >
          <p className="text-sm font-semibold" style={{ color: '#fca5a5' }}>
            No encontramos ninguna encomienda con ese código
          </p>
          <p className="mt-1 text-xs text-white/40">
            Verifica que el código sea igual al de tu comprobante (ej. EXP-2026-00001)
          </p>
        </div>
      )}

      {/* Resultado */}
      {resultado && (
        <div className="space-y-5 rounded-2xl p-5 sm:p-7" style={glassCard}>
          {/* Código + estado */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-white/35">
                Código de seguimiento
              </p>
              <p className="font-mono text-xl font-bold text-white">{resultado.codigo}</p>
            </div>
            <EstadoChip estado={resultado.estado} />
          </div>

          {/* Ruta origen → destino */}
          {(resultado.agenciaOrigen || resultado.agenciaDestino) && (
            <div
              className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <MapPin size={16} className="shrink-0" style={{ color: '#4ade80' }} />
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-white">
                <span className="capitalize">{(resultado.agenciaOrigen || '—').toLowerCase()}</span>
                <ArrowRight size={14} className="shrink-0 text-white/30" />
                <span className="capitalize">{(resultado.agenciaDestino || '—').toLowerCase()}</span>
              </div>
            </div>
          )}

          {/* Descripción */}
          <div className="border-t pt-4" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <p className="mb-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-white/35">
              Descripción
            </p>
            <p className="text-sm text-white/80">{resultado.descripcion}</p>
          </div>

          {/* Timeline */}
          <div className="border-t pt-4" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <p className="mb-3 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-white/35">
              Historial de estados
            </p>
            <TrackingTimeline
              historial={resultado.historial || []}
              estadoActual={resultado.estado}
            />
          </div>

          {/* Fechas */}
          <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            {registrado && (
              <p className="flex items-center gap-2 text-xs text-white/40">
                <CalendarClock size={13} className="shrink-0" />
                Registrado el {registrado}
              </p>
            )}
            {entregaEst && (
              <p className="text-xs font-medium" style={{ color: '#4ade80' }}>
                Entrega estimada: {entregaEst}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Estado inicial (sin búsqueda aún) */}
      {!resultado && !noEncontrado && !loading && (
        <div className="py-10 text-center text-white/25">
          <PackageSearch size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">El código aparece en tu comprobante, junto al QR</p>
        </div>
      )}
    </PublicShell>
  )
}
