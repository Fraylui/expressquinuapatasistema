'use client'
import { create } from 'zustand'
import api from '@/services/api'
import { Agencia } from '@/types'

interface AgenciaState {
  agenciaActual: Agencia | null
  agencias: Agencia[]
  setAgencia: (agencia: Agencia) => void
  cargarAgencias: () => Promise<void>
}

export const useAgenciaStore = create<AgenciaState>((set) => ({
  agenciaActual: null,
  agencias: [],

  setAgencia: (agencia) => set({ agenciaActual: agencia }),

  cargarAgencias: async () => {
    try {
      const response = await api.get<any, any>('/api/agencias')
      // api interceptor already unwraps to ApiResponse; SWR fetcher calls .then(r => r.data)
      // Here we call api directly, so response IS the ApiResponse object
      const list: Agencia[] = Array.isArray(response)
        ? response
        : (response?.data ?? response ?? [])
      set({ agencias: list })
    } catch (error) {
      console.error('Error al cargar agencias:', error)
    }
  },
}))
