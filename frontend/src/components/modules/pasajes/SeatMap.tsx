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
  tipoVehiculo: 'COMBI' | 'CAMIONETA' | 'MINIVAN'
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

function SeatBtn({ asiento, isSelected, onClick }: {
  asiento: Asiento; isSelected: boolean; onClick: () => void
}) {
  const libre = isLibre(asiento.estado)
  const color = isSelected
    ? 'bg-[#1F3864] border-[#0070C0] text-white shadow-md'
    : libre
      ? 'bg-[#DCFCE7] border-[#16A34A] text-[#15803D] hover:bg-green-200 cursor-pointer'
      : asiento.estado === 'RESERVADO'
        ? 'bg-[#DBEAFE] border-[#2563EB] text-[#1D4ED8] cursor-not-allowed'
        : 'bg-[#FEE2E2] border-[#DC2626] text-[#991B1B] cursor-not-allowed'

  return (
    <button onClick={libre ? onClick : undefined} disabled={!libre}
      title={`Asiento ${asiento.numero} — ${asiento.estado}`}
      style={{ width: 52, height: 52, borderRadius: 8, border: '2px solid', fontSize: 13, fontWeight: 700 }}
      className={`flex items-center justify-center transition-all select-none ${color}`}>
      {asiento.numero.toString().padStart(2, '0')}
    </button>
  )
}

function DriverSeat() {
  return (
    <div style={{ width: 52, height: 52, borderRadius: 8, border: '2px solid #d1d5db', background: '#f3f4f6' }}
      className="flex items-center justify-center">
      <span className="text-[9px] font-semibold text-gray-400 text-center leading-tight">COND</span>
    </div>
  )
}

function CombiLayout({ asientos, selectedNumero, onSelect }: {
  asientos: Asiento[]; selectedNumero?: number; onSelect: (n: number) => void
}) {
  const byNum = Object.fromEntries(asientos.map(a => [a.numero, a]))
  const Btn = ({ n }: { n: number }) => {
    const a = byNum[n]
    if (!a) return <div style={{ width: 52, height: 52 }} />
    return <SeatBtn asiento={a} isSelected={selectedNumero === a.numero} onClick={() => onSelect(a.numero)} />
  }
  const Aisle = () => <div style={{ width: 24 }} />
  const Row = ({ children }: { children: React.ReactNode }) => (
    <div className="flex items-center gap-2 justify-center">{children}</div>
  )

  return (
    <div className="space-y-2">
      <Row><DriverSeat /><Btn n={1} /><Btn n={2} /></Row>
      <div className="border-t border-dashed border-gray-300 mx-4" />
      {[[3,4,5],[6,7,8],[9,10,11]].map(([a,b,c],i) => (
        <Row key={i}><Btn n={a} /><Btn n={b} /><Aisle /><Btn n={c} /></Row>
      ))}
      <Row><Btn n={12} /><Btn n={13} /><Btn n={14} /><Btn n={15} /></Row>
    </div>
  )
}

function CamionetaLayout({ asientos, selectedNumero, onSelect }: {
  asientos: Asiento[]; selectedNumero?: number; onSelect: (n: number) => void
}) {
  const byNum = Object.fromEntries(asientos.map(a => [a.numero, a]))
  const Btn = ({ n }: { n: number }) => {
    const a = byNum[n]
    if (!a) return <div style={{ width: 52, height: 52 }} />
    return <SeatBtn asiento={a} isSelected={selectedNumero === a.numero} onClick={() => onSelect(a.numero)} />
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 justify-center"><DriverSeat /><Btn n={1} /></div>
      <div className="border-t border-dashed border-gray-300 mx-4" />
      <div className="flex items-center gap-3 justify-center"><Btn n={2} /><Btn n={3} /><Btn n={4} /></div>
    </div>
  )
}

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
    <div className="p-8 bg-gray-50 rounded-xl border border-gray-200 text-center text-sm text-gray-400">
      Cargando asientos...
    </div>
  )

  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {tipoVehiculo === 'CAMIONETA' ? 'Toyota Hilux' : 'Toyota Hiace'}
        </span>
        <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-medium">
          {data?.capacidadPasajeros ?? asientos.length} pasajeros
        </span>
      </div>

      <div className="bg-gray-300 rounded-t-xl text-center text-[10px] text-gray-600 py-1 mb-4 font-medium tracking-wider">
        — VOLANTE —
      </div>

      {tipoVehiculo === 'CAMIONETA'
        ? <CamionetaLayout asientos={asientos} selectedNumero={selectedNumero} onSelect={n => onSelect?.(n)} />
        : <CombiLayout     asientos={asientos} selectedNumero={selectedNumero} onSelect={n => onSelect?.(n)} />
      }

      <div className="flex flex-wrap gap-4 justify-center mt-5 pt-4 border-t border-gray-200">
        {[
          { color: 'bg-[#DCFCE7] border-[#16A34A]',  label: 'Disponible' },
          { color: 'bg-[#FEE2E2] border-[#DC2626]',  label: 'Vendido' },
          { color: 'bg-[#DBEAFE] border-[#2563EB]',  label: 'Reservado' },
          { color: 'bg-[#1F3864] border-[#0070C0]',  label: 'Seleccionado' },
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
