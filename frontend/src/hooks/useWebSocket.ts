'use client'
import { useEffect, useRef, useCallback, useState } from 'react'
import { Client, IMessage } from '@stomp/stompjs'
import { useAuthStore } from '@/stores/authStore'

const WS_URL = (() => {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
  // En producción NEXT_PUBLIC_API_URL="/" (mismo origen vía nginx): el broker
  // STOMP necesita URL absoluta, así que se deriva del origen del navegador
  const abs = base.startsWith('http')
    ? base
    : (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8080')
  return abs.replace(/^http/, 'ws') + '/ws-stomp'
})()

export function useWebSocket() {
  const clientRef = useRef<Client | null>(null)
  const { token } = useAuthStore()
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!token) return

    const client = new Client({
      brokerURL: WS_URL,
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5000,
      onConnect:    () => { setConnected(true) },
      onDisconnect: () => { setConnected(false) },
    })

    client.activate()
    clientRef.current = client

    return () => {
      client.deactivate()
    }
  }, [token])

  const suscribeToAsientos = useCallback(
    (viajeId: number, callback: (msg: any) => void) => {
      if (!clientRef.current?.active) return undefined
      return clientRef.current.subscribe(
        `/topic/asientos/${viajeId}`,
        (msg: IMessage) => callback(JSON.parse(msg.body))
      )
    },
    []
  )

  const suscribeToEncomienda = useCallback(
    (codigo: string, callback: (msg: any) => void) => {
      if (!clientRef.current?.active) return undefined
      return clientRef.current.subscribe(
        `/topic/encomiendas/${codigo}`,
        (msg: IMessage) => callback(JSON.parse(msg.body))
      )
    },
    []
  )

  const suscribeToCaja = useCallback(
    (cajaId: number, callback: (msg: any) => void) => {
      if (!clientRef.current?.active) return undefined
      return clientRef.current.subscribe(
        `/topic/caja/${cajaId}`,
        (msg: IMessage) => callback(JSON.parse(msg.body))
      )
    },
    []
  )

  const suscribeToNotificaciones = useCallback(
    (usuarioId: number, callback: (msg: any) => void) => {
      if (!clientRef.current?.active) return undefined
      return clientRef.current.subscribe(
        `/queue/notificaciones/${usuarioId}`,
        (msg: IMessage) => callback(JSON.parse(msg.body))
      )
    },
    []
  )

  const suscribeToAgenciaEncomiendas = useCallback(
    (agenciaId: number, callback: (msg: any) => void) => {
      if (!clientRef.current?.active) return undefined
      return clientRef.current.subscribe(
        `/topic/encomiendas/agencia/${agenciaId}`,
        (msg: IMessage) => callback(JSON.parse(msg.body))
      )
    },
    []
  )

  const suscribeToViajeCancelado = useCallback(
    (agenciaId: number, callback: (msg: any) => void) => {
      if (!clientRef.current?.active) return undefined
      return clientRef.current.subscribe(
        `/topic/viajes/cancelado/${agenciaId}`,
        (msg: IMessage) => callback(JSON.parse(msg.body))
      )
    },
    []
  )

  return {
    connected,
    suscribeToAsientos,
    suscribeToEncomienda,
    suscribeToCaja,
    suscribeToNotificaciones,
    suscribeToAgenciaEncomiendas,
    suscribeToViajeCancelado,
  }
}
