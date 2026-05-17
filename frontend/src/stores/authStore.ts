'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authService } from '@/services/auth.service'

export interface AuthUser {
  id: number
  nombre: string
  email: string
  rol: 'SUPER_ADMIN' | 'GERENTE' | 'OPERADOR' | 'CONDUCTOR'
  agenciaId: number
  permisos: string[]
  modulosActivos: string[]
}

interface AuthState {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  hasModulo: (codigo: string) => boolean
  hasRole: (...roles: string[]) => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (email, password) => {
        const response = await authService.login(email, password)
        const data = response.data
        set({
          user: {
            ...data.usuario,
            modulosActivos: data.usuario.modulosActivos ?? data.usuario.permisos ?? [],
          },
          token: data.token,
          isAuthenticated: true,
        })
      },

      logout: () => {
        authService.logout().catch(() => {})
        set({ user: null, token: null, isAuthenticated: false })
      },

      hasModulo: (codigo) => {
        const { user } = get()
        if (!user) return false
        if (user.rol === 'SUPER_ADMIN') return true
        return (user.modulosActivos ?? []).includes(codigo)
      },

      hasRole: (...roles) => {
        const { user } = get()
        if (!user) return false
        return roles.includes(user.rol)
      },
    }),
    {
      name: 'auth-store',
      onRehydrateStorage: () => (state) => {
        if (state?.user && !Array.isArray(state.user.modulosActivos)) {
          state.user.modulosActivos = state.user.permisos ?? []
        }
      },
    }
  )
)
