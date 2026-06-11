'use client'
import React, { useState, useEffect } from 'react'
import useSWR from 'swr'
import { useWebSocket } from '@/hooks/useWebSocket'
import api from '@/services/api'

type EstadoAsiento = 'LIBRE' | 'OCUPADO' | 'RESERVADO' | 'DISPONIBLE' | 'VENDIDO' | 'BLOQUEADO'

interface Asiento {
  id: number
  numero: number
  estado: EstadoAsiento
}

interface AsientosResponse {
  tipoVehiculo: 'COMBI' | 'CAMIONETA'
  totalAsientos: number
  capacidadPasajeros: number
  asientos: Asiento[]
}

interface SeatMapProps {
  viajeId: number
  onSelect?: (numero: number) => void
  selectedNumero?: number
}

const fetcher = (url: string) => api.get<any, any>(url).then(r => r.data)

function isLibre(estado: EstadoAsiento) {
  return estado === 'LIBRE' || estado === 'DISPONIBLE'
}

// ─── Botón de asiento — paleta nueva ────────────────────────────────────────
function SeatBtn({ asiento, isSelected, onClick, fluid }: {
  asiento: Asiento; isSelected: boolean; onClick: () => void; fluid?: boolean
}) {
  const libre     = isLibre(asiento.estado)
  const reservado = asiento.estado === 'RESERVADO'
  const vendido   = !libre && !reservado

  const base = `${fluid ? 'w-full' : 'w-[52px]'} h-[52px] rounded-[10px] flex flex-col items-center justify-center gap-0.5 transition-all duration-150 select-none`

  const variant = isSelected
    ? 'border-2 border-[#064e3b] bg-[#064e3b] text-white ring-4 ring-[#064e3b]/20'
    : libre
    ? 'border border-[#22C55E] bg-white text-[#15803D] hover:bg-[#F0FDF4] cursor-pointer active:scale-95'
    : reservado
    ? 'border border-dashed border-[#F59E0B] bg-[#FFFBEB] text-[#92400E] cursor-not-allowed'
    : 'border border-[#CBD5E1] bg-[#F1F5F9] text-[#94A3B8] opacity-60 cursor-not-allowed'

  return (
    <button
      onClick={libre ? onClick : undefined}
      disabled={!libre}
      title={`Asiento ${asiento.numero} — ${asiento.estado}`}
      className={`${base} ${variant}`}
    >
      <span className="text-[13px] font-bold leading-none">
        {String(asiento.numero).padStart(2, '0')}
      </span>
      {vendido && <span className="text-[9px] leading-none mt-0.5 opacity-70">✕</span>}
    </button>
  )
}

// ─── Asiento del conductor — volante SVG ────────────────────────────────────
function DriverSeat({ fluid }: { fluid?: boolean }) {
  return (
    <div className={`${fluid ? 'w-full' : 'w-[52px]'} h-[52px] rounded-[10px] border border-[#CBD5E1] bg-[#E2E8F0] flex flex-col items-center justify-center gap-1 select-none`}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-[#64748B]">
        <circle cx="12" cy="12" r="9"   stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M12 9.5V3"           stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M5.2 15.6l4.1-2.4"   stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M18.8 15.6l-4.1-2.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      <span className="text-[8px] font-semibold text-[#64748B] leading-none tracking-tight">Cond.</span>
    </div>
  )
}

// ─── Indicador de puerta de ingreso ─────────────────────────────────────────
function DoorIndicator() {
  return (
    <div className="w-[52px] h-[52px] rounded-[10px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] flex flex-col items-center justify-center gap-1 select-none">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-[#94A3B8]">
        <path d="M12 5v14M5 12l7 7 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span className="text-[7px] font-semibold text-[#94A3B8] tracking-widest leading-none">PUERTA</span>
    </div>
  )
}

// ─── Layout Toyota Hiace 15 pasajeros ───────────────────────────────────────
//
//  Distribución real (4 columnas simétricas):
//
//  Fila 0 (Cabina):   COND  |  01  |  02  |  ──
//  ────────────────────────────────────────────────
//  Fila 1 (Pasaj. 1):  03  |  04  |  05   | PUERTA
//  ────────────────────────────────────────────────
//  Fila 2:             06  |  07  | PASAD |  08
//  Fila 3:             09  |  10  | PASAD |  11
//  ────────────────────────────────────────────────
//  Fila 4 (Fondo):     12  |  13  |  14   |  15
//
function CombiLayout({ asientos, selectedNumero, onSelect }: {
  asientos: Asiento[]; selectedNumero?: number; onSelect: (n: number) => void
}) {
  const S = 52
  const G = 8
  const W = 4 * S + 3 * G   // 232 px — ancho fijo garantiza alineación perfecta

  const byNum = Object.fromEntries(asientos.map(a => [a.numero, a]))
  const Seat = ({ n }: { n: number }) => {
    const a = byNum[n]
    if (!a) return <div style={{ width: S, height: S }} />
    return <SeatBtn asiento={a} isSelected={selectedNumero === a.numero} onClick={() => onSelect(a.numero)} />
  }

  const SeatFluid = ({ n }: { n: number }) => {
    const a = byNum[n]
    if (!a) return <div style={{ height: S }} className="w-full" />
    return <SeatBtn asiento={a} isSelected={selectedNumero === a.numero} onClick={() => onSelect(a.numero)} fluid />
  }

  return (
    <div className="mx-auto" style={{ width: W }}>

      {/* ── Fila 0: Cabina delantera — COND y asiento 02 se estiran a los costados ── */}
      <div style={{ display: 'flex', gap: G, marginBottom: G }}>
        <div style={{ flex: 1 }}><DriverSeat fluid /></div>
        <div style={{ width: S, flexShrink: 0 }}><Seat n={1} /></div>
        <div style={{ flex: 1 }}><SeatFluid n={2} /></div>
      </div>

      {/* ── Separador 1 ── */}
      <div className="border-t border-dashed border-[#E2E8F0]" style={{ marginBottom: G }} />

      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(4, ${S}px)`,
        gridTemplateRows: `${S}px 1px ${S}px ${S}px 1px ${S}px`,
        columnGap: G,
        rowGap: G,
        alignItems: 'start',
      }}>

        {/* ── Fila 1: Primera fila de pasajeros (03 | 04 | 05 | PUERTA) ── */}
        <div style={{ gridColumn: 1, gridRow: 1 }}><Seat n={3} /></div>
        <div style={{ gridColumn: 2, gridRow: 1 }}><Seat n={4} /></div>
        <div style={{ gridColumn: 3, gridRow: 1 }}><Seat n={5} /></div>
        <div style={{ gridColumn: 4, gridRow: 1 }}><DoorIndicator /></div>

        {/* ── Separador 2 ── */}
        <div style={{ gridColumn: '1 / 5', gridRow: 2 }}
          className="border-t border-dashed border-[#E2E8F0]" />

        {/* ── PASADIZO: col 3, filas 3-4 (2 filas intermedias) ── */}
        <div style={{ gridColumn: 3, gridRow: '3 / 5' }}
          className="flex items-center justify-center rounded-xl
                     bg-[#F1F5F9]/70 border border-dashed border-[#E2E8F0]">
          <span className="text-[7px] font-semibold text-[#94A3B8] tracking-[4px] select-none"
                style={{ writingMode: 'vertical-lr', textOrientation: 'mixed' }}>
            PASADIZO
          </span>
        </div>

        {/* ── Fila 2 (06 | 07 | PASADIZO | 08) ── */}
        <div style={{ gridColumn: 1, gridRow: 3 }}><Seat n={6} /></div>
        <div style={{ gridColumn: 2, gridRow: 3 }}><Seat n={7} /></div>
        <div style={{ gridColumn: 4, gridRow: 3 }}><Seat n={8} /></div>

        {/* ── Fila 3 (09 | 10 | PASADIZO | 11) ── */}
        <div style={{ gridColumn: 1, gridRow: 4 }}><Seat n={9} /></div>
        <div style={{ gridColumn: 2, gridRow: 4 }}><Seat n={10} /></div>
        <div style={{ gridColumn: 4, gridRow: 4 }}><Seat n={11} /></div>

        {/* ── Separador 3 ── */}
        <div style={{ gridColumn: '1 / 5', gridRow: 5 }}
          className="border-t border-dashed border-[#E2E8F0]" />

        {/* ── Fila 4: Asientos traseros (12 | 13 | 14 | 15) ── */}
        <div style={{ gridColumn: 1, gridRow: 6 }}><Seat n={12} /></div>
        <div style={{ gridColumn: 2, gridRow: 6 }}><Seat n={13} /></div>
        <div style={{ gridColumn: 3, gridRow: 6 }}><Seat n={14} /></div>
        <div style={{ gridColumn: 4, gridRow: 6 }}><Seat n={15} /></div>

      </div>
    </div>
  )
}

// ─── Layout Toyota Hilux doble cabina (4 pasajeros) ─────────────────────────
//
//  Distribución real (3 columnas):
//
//  Cabina delantera:  COND  |  01  |  ────
//  ─────────────────────────────────────────
//  Cabina trasera:    02    |  03  |  04
//
function CamionetaLayout({ asientos, selectedNumero, onSelect }: {
  asientos: Asiento[]; selectedNumero?: number; onSelect: (n: number) => void
}) {
  const S = 52
  const G = 8
  const W = 3 * S + 2 * G   // 3 columnas: 172 px

  const byNum = Object.fromEntries(asientos.map(a => [a.numero, a]))
  const Seat = ({ n }: { n: number }) => {
    const a = byNum[n]
    if (!a) return <div style={{ width: S, height: S }} />
    return <SeatBtn asiento={a} isSelected={selectedNumero === a.numero} onClick={() => onSelect(a.numero)} />
  }

  return (
    <div className="mx-auto" style={{ width: W }}>

      {/* ── Cabina delantera: COND + Seat 01, centrados en el ancho total ── */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 border-t border-[#E2E8F0]" />
        <span className="text-[8px] font-semibold text-[#94A3B8] tracking-[3px] uppercase">Cabina</span>
        <div className="flex-1 border-t border-[#E2E8F0]" />
      </div>

      <div className="flex justify-center" style={{ gap: G }}>
        <DriverSeat />
        <Seat n={1} />
      </div>

      {/* ── Separador entre cabinas ── */}
      <div className="relative my-3">
        <div className="border-t border-dashed border-[#CBD5E1]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="bg-white px-2 text-[9px] text-[#CBD5E1] select-none">●  ●</span>
        </div>
      </div>

      {/* ── Asientos traseros: 02 | 03 | 04 en línea recta ── */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 border-t border-[#E2E8F0]" />
        <span className="text-[8px] font-semibold text-[#94A3B8] tracking-[3px] uppercase">Asientos traseros</span>
        <div className="flex-1 border-t border-[#E2E8F0]" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(3, ${S}px)`, gap: G }}>
        <Seat n={2} />
        <Seat n={3} />
        <Seat n={4} />
      </div>

    </div>
  )
}

// ─── Componente principal ────────────────────────────────────────────────────
export const SeatMap: React.FC<SeatMapProps> = ({ viajeId, onSelect, selectedNumero }) => {
  const { data, isLoading } = useSWR<AsientosResponse>(
    `/api/viajes/${viajeId}/asientos`, fetcher, { refreshInterval: 0 })
  const { suscribeToAsientos, connected } = useWebSocket()
  const [asientos, setAsientos] = useState<Asiento[]>([])
  const tipoVehiculo = data?.tipoVehiculo ?? 'COMBI'

  useEffect(() => { if (data?.asientos) setAsientos(data.asientos) }, [data])

  useEffect(() => {
    if (!connected) return
    const sub = suscribeToAsientos(viajeId, (update) => {
      setAsientos(prev => prev.map(a =>
        a.numero === update.asientoNumero
          ? { ...a, estado: update.estado as EstadoAsiento }
          : a
      ))
    })
    return () => sub?.unsubscribe()
  }, [viajeId, suscribeToAsientos, connected])

  if (isLoading) return (
    <div className="p-8 bg-white rounded-xl border border-[#E2E8F0] text-center text-sm text-[#94A3B8]">
      Cargando asientos...
    </div>
  )

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm">

      {/* Cabecera: nombre + capacidad */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-[#475569] uppercase tracking-wider flex items-center gap-1.5">
          {tipoVehiculo === 'CAMIONETA' ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-[#64748B]">
                <path d="M3 17h18M5 17V9l3-5h8l3 5v8" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                <circle cx="7.5" cy="17" r="1.5" fill="currentColor"/>
                <circle cx="16.5" cy="17" r="1.5" fill="currentColor"/>
                <path d="M5 9h14" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
              Toyota Hilux
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-[#64748B]">
                <path d="M2 17h20M4 17V10l4-6h8l4 6v7" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                <circle cx="7" cy="17" r="1.5" fill="currentColor"/>
                <circle cx="17" cy="17" r="1.5" fill="currentColor"/>
              </svg>
              Toyota Hiace
            </>
          )}
        </span>
        <span className="text-xs bg-[#F1F5F9] text-[#64748B] px-2.5 py-0.5 rounded-full font-medium">
          {data?.capacidadPasajeros ?? asientos.length} pasajeros
        </span>
      </div>

      {/* Indicador de orientación */}
      <div className="rounded-t-xl bg-[#E2E8F0] text-center text-[9px] font-semibold text-[#94A3B8]
                      tracking-[4px] uppercase py-2 mb-4">
        — Frente del vehículo —
      </div>

      {tipoVehiculo === 'CAMIONETA'
        ? <CamionetaLayout asientos={asientos} selectedNumero={selectedNumero} onSelect={n => onSelect?.(n)} />
        : <CombiLayout     asientos={asientos} selectedNumero={selectedNumero} onSelect={n => onSelect?.(n)} />
      }

      {/* Leyenda de estados */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 justify-center mt-5 pt-4 border-t border-[#F1F5F9]">
        {[
          {
            cls:  'border border-[#22C55E] bg-white',
            label: 'Disponible',
          },
          {
            cls:  'border-2 border-[#064e3b] bg-[#064e3b]',
            label: 'Seleccionado',
          },
          {
            cls:  'border border-[#CBD5E1] bg-[#F1F5F9] opacity-60',
            label: 'Ocupado',
          },
          {
            cls:  'border border-dashed border-[#F59E0B] bg-[#FFFBEB]',
            label: 'Reservado',
          },
        ].map(({ cls, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-[18px] h-[18px] rounded-[5px] shrink-0 ${cls}`} />
            <span className="text-[11px] text-[#64748B]">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
