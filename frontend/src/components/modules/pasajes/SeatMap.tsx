'use client'
import React, { useState, useEffect } from 'react'
import useSWR from 'swr'
import { useWebSocket } from '@/hooks/useWebSocket'
import api from '@/services/api'

interface Asiento {
  id: number
  numero: number
  estado: 'DISPONIBLE' | 'VENDIDO' | 'RESERVADO' | 'BLOQUEADO'
}

interface AsientosResponse {
  tipoVehiculo: 'COMBI' | 'CAMIONETA' | 'MINIVAN'
  totalAsientos: number
  capacidadPasajeros: number
  asientos: Asiento[]
}

interface SeatMapProps {
  viajeId: number
  onSelect?: (asientoId: number, numero: number) => void
  selectedId?: number
}

const fetcher = (url: string) => api.get<any, any>(url).then(r => r.data)

function SeatBtn({
  asiento,
  isSelected,
  onClick,
}: {
  asiento: Asiento
  isSelected: boolean
  onClick: () => void
}) {
  const color = isSelected
    ? 'bg-[#0070C0] border-[#0070C0] text-white shadow-md'
    : asiento.estado === 'DISPONIBLE'
      ? 'bg-green-100 border-green-500 text-green-800 hover:bg-green-200 cursor-pointer'
      : asiento.estado === 'VENDIDO'
        ? 'bg-red-200 border-red-400 text-red-700 cursor-not-allowed opacity-80'
        : asiento.estado === 'RESERVADO'
          ? 'bg-blue-200 border-blue-400 text-blue-700 cursor-not-allowed opacity-80'
          : 'bg-gray-200 border-gray-400 text-gray-500 cursor-not-allowed opacity-60'

  return (
    <button
      onClick={asiento.estado === 'DISPONIBLE' ? onClick : undefined}
      disabled={asiento.estado !== 'DISPONIBLE'}
      title={`Asiento ${asiento.numero} — ${asiento.estado}`}
      className={`w-10 h-10 rounded-lg border-2 text-xs font-bold transition-all select-none ${color}`}
    >
      {asiento.numero}
    </button>
  )
}

function DriverSeat() {
  return (
    <div className="w-10 h-10 rounded-lg border-2 border-gray-300 bg-gray-100 flex items-center justify-center" title="Conductor">
      <span className="text-[9px] font-semibold text-gray-400 text-center leading-tight">COND</span>
    </div>
  )
}

/* ─── Layout COMBI ────────────────────────────────────────────
   Toyota Hiace · 16 posiciones = 1 conductor + 15 pasajeros

   Fila 1 (cabina):   [COND] [01] [02]
   Filas 2-4 (medio): [03][04] | pasillo | [05]
                      [06][07] | pasillo | [08]
                      [09][10] | pasillo | [11]
   Fila 5 (trasera):  [12][13][14][15]  (4 plazas ancho total)
────────────────────────────────────────────────────────────── */
function CombiLayout({
  asientos,
  selectedId,
  onSelect,
}: {
  asientos: Asiento[]
  selectedId?: number
  onSelect: (id: number, num: number) => void
}) {
  const byNum = Object.fromEntries(asientos.map(a => [a.numero, a]))

  const Row = ({ children }: { children: React.ReactNode }) => (
    <div className="flex items-center gap-2 justify-center">{children}</div>
  )

  const Aisle = () => <div className="w-6" />

  const Btn = ({ n }: { n: number }) => {
    const a = byNum[n]
    if (!a) return <div className="w-10 h-10" />
    return (
      <SeatBtn
        asiento={a}
        isSelected={selectedId === a.id}
        onClick={() => onSelect(a.id, a.numero)}
      />
    )
  }

  return (
    <div className="space-y-2">
      {/* Fila 1: conductor + 2 copiloto */}
      <Row>
        <DriverSeat />
        <Btn n={1} />
        <Btn n={2} />
      </Row>

      <div className="border-t border-dashed border-gray-300 mx-4" />

      {/* Filas 2-4: 2 izq + pasillo + 1 der */}
      {[[3,4,5],[6,7,8],[9,10,11]].map(([a, b, c], i) => (
        <Row key={i}>
          <Btn n={a} />
          <Btn n={b} />
          <Aisle />
          <Btn n={c} />
        </Row>
      ))}

      {/* Fila 5: trasera corrida de 4 */}
      <Row>
        <Btn n={12} />
        <Btn n={13} />
        <Btn n={14} />
        <Btn n={15} />
      </Row>
    </div>
  )
}

/* ─── Layout CAMIONETA ────────────────────────────────────────
   Toyota Hilux doble cabina · 5 posiciones = 1 conductor + 4 pasajeros
   Distribución:
     Fila delantera: [CONDUCTOR] [Asiento 1]
     Fila trasera:   [Asiento 2] [Asiento 3] [Asiento 4]
────────────────────────────────────────────────────────────── */
function CamionetaLayout({
  asientos,
  selectedId,
  onSelect,
}: {
  asientos: Asiento[]
  selectedId?: number
  onSelect: (id: number, num: number) => void
}) {
  const byNum = Object.fromEntries(asientos.map(a => [a.numero, a]))

  const Btn = ({ n }: { n: number }) => {
    const a = byNum[n]
    if (!a) return <div className="w-10 h-10" />
    return (
      <SeatBtn
        asiento={a}
        isSelected={selectedId === a.id}
        onClick={() => onSelect(a.id, a.numero)}
      />
    )
  }

  return (
    <div className="space-y-3">
      {/* Fila delantera */}
      <div className="flex items-center gap-3 justify-center">
        <DriverSeat />
        <Btn n={1} />
      </div>

      <div className="border-t border-dashed border-gray-300 mx-4" />

      {/* Fila trasera */}
      <div className="flex items-center gap-3 justify-center">
        <Btn n={2} />
        <Btn n={3} />
        <Btn n={4} />
      </div>
    </div>
  )
}

/* ─── Componente principal ──────────────────────────────────── */
export const SeatMap: React.FC<SeatMapProps> = ({ viajeId, onSelect, selectedId }) => {
  const { data, isLoading } = useSWR<AsientosResponse>(
    `/api/viajes/${viajeId}/asientos`,
    fetcher,
    { refreshInterval: 0 }
  )
  const { suscribeToAsientos, connected } = useWebSocket()
  const [asientos, setAsientos] = useState<Asiento[]>([])
  const tipoVehiculo = data?.tipoVehiculo ?? 'COMBI'

  useEffect(() => {
    if (data?.asientos) setAsientos(data.asientos)
  }, [data])

  useEffect(() => {
    if (!connected) return
    const sub = suscribeToAsientos(viajeId, (update) => {
      setAsientos(prev =>
        prev.map(a =>
          a.numero === update.asientoNumero
            ? { ...a, estado: update.estado as Asiento['estado'] }
            : a
        )
      )
    })
    return () => sub?.unsubscribe()
  }, [viajeId, suscribeToAsientos, connected])

  const handleSelect = (id: number, num: number) => {
    onSelect?.(id, num)
  }

  if (isLoading) {
    return (
      <div className="p-8 bg-gray-50 rounded-xl border border-gray-200 text-center text-sm text-gray-400">
        Cargando asientos...
      </div>
    )
  }

  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
      {/* Cabecera vehículo */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {tipoVehiculo === 'CAMIONETA' ? 'Toyota Hilux' : 'Toyota Hiace'}
        </span>
        <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-medium">
          {data?.capacidadPasajeros ?? asientos.length} pasajeros
        </span>
      </div>

      {/* Parabrisas visual */}
      <div className="bg-gray-300 rounded-t-xl text-center text-[10px] text-gray-600 py-1 mb-4 font-medium tracking-wider">
        — VOLANTE —
      </div>

      {/* Grid según tipo */}
      {tipoVehiculo === 'CAMIONETA'
        ? <CamionetaLayout asientos={asientos} selectedId={selectedId} onSelect={handleSelect} />
        : <CombiLayout     asientos={asientos} selectedId={selectedId} onSelect={handleSelect} />
      }

      {/* Leyenda */}
      <div className="flex flex-wrap gap-4 justify-center mt-5 pt-4 border-t border-gray-200">
        {[
          { color: 'bg-green-100 border-green-500',   label: 'Disponible' },
          { color: 'bg-red-200 border-red-400',       label: 'Vendido' },
          { color: 'bg-blue-200 border-blue-400',     label: 'Reservado' },
          { color: 'bg-[#0070C0] border-[#0070C0]',  label: 'Seleccionado' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-4 h-4 rounded border-2 ${color}`} />
            <span className="text-xs text-gray-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
