'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'

export function useAuth() {
  const { user, isAuthenticated, hasModulo, hasRole } = useAuthStore()
  return { user, isAuthenticated, hasModulo, hasRole }
}

export function useRequireAuth() {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login')
    }
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
