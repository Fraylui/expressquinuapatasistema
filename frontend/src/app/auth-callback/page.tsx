'use client'
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'

export default function AuthCallbackPage() {
  const router  = useRouter()
  const done    = useRef(false)  // guard contra doble ejecución (StrictMode dev)

  useEffect(() => {
    if (done.current) return
    done.current = true

    try {
      // El hash llega desde la web pública: /auth-callback#<base64>
      const raw = window.location.hash.slice(1)
      if (!raw) { router.replace('/login'); return }

      const json  = decodeURIComponent(escape(atob(raw)))
      const state = JSON.parse(json)?.state

      if (!state?.token || !state?.user) { router.replace('/login'); return }

      // Actualiza el store en memoria (y persiste en localStorage via Zustand).
      // Hacerlo antes del replace evita la race condition con useRequireAuth.
      useAuthStore.setState({
        user:            state.user,
        token:           state.token,
        isAuthenticated: true,
      })

      // Limpiar el hash de la URL por seguridad
      window.history.replaceState(null, '', window.location.pathname)

      router.replace('/dashboard')
    } catch {
      router.replace('/login')
    }
  }, [router])

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: '#0A1628', color: '#e2e8f0',
      fontFamily: 'sans-serif', gap: '1rem',
    }}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
        stroke="#16a34a" strokeWidth="2.5"
        style={{ animation: 'spin 0.8s linear infinite' }}>
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <span>Iniciando sesión…</span>
    </div>
  )
}
