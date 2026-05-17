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
      set({ agencias: response.data || [] })
    } catch (error) {
      console.error('Error al cargar agencias:', error)
    }
  },
}))
