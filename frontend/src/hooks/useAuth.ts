'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'

export function useAuth() {
  const { user, isAuthenticated, hasModulo, hasRole } = useAuthStore()
  return { user, isAuthenticated, hasModulo, hasRole }
}

/** ¿Hay una sesión guardada en localStorage aunque el store aún no la hidrate?
 *  En un F5 el guard corre antes que la hidratación de zustand-persist; si
 *  redirigimos a /login en ese instante, el usuario pierde la página actual. */
function haySesionGuardada(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = localStorage.getItem('auth-store')
    return !!(raw && JSON.parse(raw)?.state?.token)
  } catch { return false }
}

export function useRequireAuth() {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()

  useEffect(() => {
    if (isAuthenticated) return
    if (haySesionGuardada()) {
      // Sesión pendiente de hidratar: forzarla y no redirigir
      useAuthStore.persist?.rehydrate?.()
      return
    }
    router.replace('/login')
  }, [isAuthenticated, router])

  return { isAuthenticated }
}

export function useRequireModulo(codigo: string) {
  const router = useRouter()
  const { user, isAuthenticated, hasModulo } = useAuthStore()

  useEffect(() => {
    if (isAuthenticated && user && !hasModulo(codigo)) {
      router.replace('/')
    }
  }, [isAuthenticated, user, codigo, hasModulo, router])
}
