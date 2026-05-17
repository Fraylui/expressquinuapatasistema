'use client'
import React, { useState } from 'react'
import useSWR from 'swr'
import toast from 'react-hot-toast'
import { ChevronRight, CheckCircle, Bus, Clock, Users, Search, UserCheck, X } from 'lucide-react'
import { SeatMap } from '@/components/modules/pasajes/SeatMap'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import api from '@/services/api'
import { pasajesService } from '@/services/pasajes.service'
import { clientesService } from '@/services/clientes.service'
import type { Cliente } from '@/types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

type Step = 1 | 2 | 3 | 4

interface ViajeItem {
  id: number
  estado: string
  fechaHoraSal: string
  ruta?: { id: number; origen: string; destino: string; distanciaKm: number }
  vehiculo?: { id: number; placa: string; tipo: string; numAsientos: number }
  tarifaVigente?: number   // tarifaId que el backend puede incluir en el futuro
}

export default function PasajesPage() {
  const [step, setStep]             = useState<Step>(1)
  const [viaje, setViaje]           = useState<ViajeItem | null>(null)
  const [asientoSel, setAsientoSel] = useState<{ id: number; numero: number } | null>(null)
  const [cliente, setCliente]       = useState<Cliente | null>(null)
  const [dniInput, setDniInput]     = useState('')
  const [buscandoCliente, setBuscandoCliente] = useState(false)
  const [loading, setLoading]       = useState(false)
  const [codigoVenta, setCodigoVenta] = useState<string | null>(null)
  const [pasajeId, setPasajeId]       = useState<number | null>(null)
  const [tarifa, setTarifa]         = useState<{ id: number; precio: number } | null>(null)
  const [cargandoTarifa, setCargandoTarifa] = useState(false)

  const { data: viajesData } = useSWR('/api/viajes?estado=PROGRAMADO')
  const viajes: ViajeItem[] = viajesData || []

  const seleccionarViaje = async (v: ViajeItem) => {
    setViaje(v)
    setTarifa(null)
    if (v.ruta?.id && v.vehiculo?.tipo) {
      setCargandoTarifa(true)
      try {
        const res = await api.get(`/api/tarifas/buscar?rutaId=${v.ruta.id}&tipoVehiculo=${v.vehiculo.tipo}`)
        const data = (res.data as any)?.data
        if (data) setTarifa({ id: data.id, precio: Number(data.precio) })
      } catch {
        toast('Sin tarifa registrada para esta ruta — usando precio base', { icon: '⚠️' })
      } finally {
        setCargandoTarifa(false)
      }
    }
    setStep(2)
  }

  const buscarCliente = async () => {
    if (!dniInput.trim()) return
    setBuscandoCliente(true)
    try {
      const c = await clientesService.buscarPorDoc('DNI', dniInput.trim())
      setCliente(c)
    } catch {
      toast.error('Cliente no encontrado con ese DNI')
      setCliente(null)
    } finally {
      setBuscandoCliente(false)
    }
  }

  const handleVenderPasaje = async () => {
    if (!viaje || !asientoSel || !cliente) return
    setLoading(true)
    try {
      const result = await pasajesService.venderPasaje({
        viajeId:   viaje.id,
        asientoId: asientoSel.id,
        clienteId: cliente.id,
        tarifaId:  tarifa?.id ?? 1,
      })
      const pasajeData = (result as any)?.data
      setCodigoVenta(pasajeData?.correlativo ?? 'OK')
      setPasajeId(pasajeData?.id ?? null)
      toast.success(`Pasaje emitido — asiento ${asientoSel.numero}`)
      setStep(4)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al vender el pasaje')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setStep(1); setViaje(null); setAsientoSel(null)
    setCliente(null); setDniInput(''); setCodigoVenta(null); setTarifa(null); setPasajeId(null)
  }

  const steps = [
    { n: 1, label: 'Viaje' },
    { n: 2, label: 'Asiento' },
    { n: 3, label: 'Pasajero' },
    { n: 4, label: 'Confirmación' },
  ]

  const formatFecha = (iso: string) => {
    try { return format(new Date(iso), "dd MMM · HH:mm", { locale: es }) } catch { return iso }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Venta de Pasajes</h1>
        <p className="text-sm text-gray-500">Selecciona viaje, asiento y pasajero</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-1.5">
        {steps.map(({ n, label }, i) => (
          <React.Fragment key={n}>
            <div className="flex items-center gap-1.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                step > n  ? 'bg-green-500 text-white'
                : step === n ? 'bg-[#1F3864] text-white'
                : 'bg-gray-200 text-gray-500'
              }`}>
                {step > n ? <CheckCircle size={14} /> : n}
              </div>
              <span className={`text-sm hidden sm:inline ${step === n ? 'font-semibold text-gray-900' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && <ChevronRight size={14} className="text-gray-300 mx-1 shrink-0" />}
          </React.Fragment>
        ))}
      </div>

      {/* ── PASO 1: Lista de viajes ── */}
      {step === 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Viajes programados hoy</h3>
          {viajes.length === 0 && (
            <p className="text-sm text-gray-400 py-6 text-center">No hay viajes programados disponibles</p>
          )}
          {viajes.map((v) => (
            <button key={v.id} onClick={() => seleccionarViaje(v)}
              className="w-full flex items-start justify-between p-4 rounded-xl border border-gray-200 hover:border-[#0070C0] hover:bg-blue-50 transition-all text-left">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#1F3864] flex items-center justify-center shrink-0">
                  <Bus size={16} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {v.ruta?.origen ?? '—'} → {v.ruta?.destino ?? '—'}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock size={11} />
                      {formatFecha(v.fechaHoraSal)}
                    </span>
                    {v.vehiculo && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Users size={11} />
                        {v.vehiculo.tipo} · {v.vehiculo.placa}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Badge estado={v.estado} />
            </button>
          ))}
        </div>
      )}

      {/* ── PASO 2: Mapa de asientos ── */}
      {step === 2 && viaje && (
        <div className="space-y-4">
          <div className="bg-[#1F3864] rounded-xl p-4 text-white">
            <p className="text-xs text-blue-300 uppercase tracking-wide">Viaje seleccionado</p>
            <p className="text-base font-bold mt-1">
              {viaje.ruta?.origen ?? '—'} → {viaje.ruta?.destino ?? '—'}
            </p>
            <p className="text-sm text-blue-200 mt-0.5">
              {formatFecha(viaje.fechaHoraSal)}
              {viaje.vehiculo && ` · ${viaje.vehiculo.tipo} ${viaje.vehiculo.placa}`}
            </p>
          </div>

          <SeatMap
            viajeId={viaje.id}
            selectedId={asientoSel?.id}
            onSelect={(id, numero) => setAsientoSel({ id, numero })}
          />

          {asientoSel && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">Asiento seleccionado</p>
                <p className="text-2xl font-bold text-[#1F3864]">#{asientoSel.numero}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Precio</p>
                {cargandoTarifa ? (
                  <p className="text-sm text-gray-400 animate-pulse">Consultando...</p>
                ) : (
                  <p className="text-lg font-bold text-green-600">
                    {tarifa ? `S/ ${tarifa.precio.toFixed(2)}` : 'S/ —'}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-between gap-3">
            <Button variant="secondary" onClick={() => { setStep(1); setAsientoSel(null) }}>Volver</Button>
            <Button variant="primary" disabled={!asientoSel} onClick={() => setStep(3)}>
              {asientoSel ? `Continuar — Asiento ${asientoSel.numero}` : 'Selecciona un asiento'}
            </Button>
          </div>
        </div>
      )}

      {/* ── PASO 3: Datos del pasajero ── */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Datos del pasajero</h3>

            {/* Resumen del viaje */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg mb-5 text-sm">
              <div className="w-8 h-8 rounded-lg bg-[#1F3864] flex items-center justify-center shrink-0">
                <Bus size={14} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900">{viaje?.ruta?.origen} → {viaje?.ruta?.destino}</p>
                <p className="text-xs text-gray-500">{formatFecha(viaje?.fechaHoraSal ?? '')} · Asiento #{asientoSel?.numero}</p>
              </div>
            </div>

            {/* Búsqueda por DNI */}
            <div className="space-y-3">
              <label className="block text-xs font-medium text-gray-700">Buscar cliente por DNI</label>
              <div className="flex gap-2">
                <input
                  value={dniInput}
                  onChange={e => setDniInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && buscarCliente()}
                  placeholder="Ej: 12345678"
                  maxLength={8}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <Button variant="secondary" icon={Search} loading={buscandoCliente} onClick={buscarCliente}>
                  Buscar
                </Button>
              </div>

              {cliente ? (
                <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-[#1F3864] flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {(cliente.nombres[0] + cliente.apellidos[0]).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">{cliente.apellidos}, {cliente.nombres}</p>
                    <p className="text-xs text-gray-500">DNI {cliente.numDoc} · {cliente.telefono ?? 'sin tel.'}</p>
                  </div>
                  <button onClick={() => { setCliente(null); setDniInput('') }}
                    className="p-1 rounded text-gray-400 hover:text-red-500">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <p className="text-xs text-gray-400 text-center py-4">
                  Ingresa el DNI del pasajero y presiona Buscar
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-between gap-3">
            <Button variant="secondary" onClick={() => setStep(2)}>Volver</Button>
            <Button
              variant="primary"
              disabled={!cliente || loading}
              loading={loading}
              onClick={handleVenderPasaje}
            >
              {cliente
                ? `Emitir pasaje${tarifa ? ` · S/ ${tarifa.precio.toFixed(2)}` : ''}`
                : 'Selecciona un pasajero'}
            </Button>
          </div>
        </div>
      )}

      {/* ── PASO 4: Éxito ── */}
      {step === 4 && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle size={32} className="text-green-500" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">¡Pasaje emitido!</h3>
          <div className="space-y-1 text-sm text-gray-500">
            <p>
              <span className="font-semibold text-gray-800">{cliente?.apellidos}, {cliente?.nombres}</span>
            </p>
            <p>
              Asiento <span className="font-semibold text-gray-800">#{asientoSel?.numero}</span>
              {' · '}
              {viaje?.ruta?.origen} → {viaje?.ruta?.destino}
            </p>
            <p>{formatFecha(viaje?.fechaHoraSal ?? '')}</p>
            {tarifa && (
              <p className="font-semibold text-green-600 text-base">S/ {tarifa.precio.toFixed(2)}</p>
            )}
          </div>
          {codigoVenta && (
            <div className="inline-block bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
              <p className="text-xs text-blue-500 font-medium">Código de pasaje</p>
              <p className="text-lg font-bold text-[#1F3864] font-mono">{codigoVenta}</p>
            </div>
          )}
          <div className="flex gap-3 justify-center pt-2">
            <Button variant="secondary" onClick={resetForm}>Nueva venta</Button>
            <Button
              variant="primary"
              onClick={async () => {
                if (!pasajeId || !codigoVenta) return
                try {
                  const res = await api.get(`/api/manifiestos/ticket/${pasajeId}/pdf`, { responseType: 'blob' })
                  const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `ticket-${codigoVenta}.pdf`
                  a.click()
                  URL.revokeObjectURL(url)
                } catch {
                  toast.error('Error al generar el ticket')
                }
              }}
            >
              Imprimir ticket
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
