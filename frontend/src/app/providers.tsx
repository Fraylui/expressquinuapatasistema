'use client'
import { useEffect } from 'react'
import { SWRConfig } from 'swr'
import api from '@/services/api'
import { useThemeStore } from '@/stores/themeStore'

const fetcher = (url: string) => api.get<any, any>(url).then(r => r.data)

// Suprime ruido de consola en desarrollo:
// 1. recharts 2.x + React 18: defaultProps en function components
// 2. ERR_EMPTY_RESPONSE / ERR_NETWORK: backend reiniciando (Spring Boot DevTools ~40s)
if (typeof window !== 'undefined') {
  const _ce = console.error.bind(console)
  console.error = (...args: any[]) => {
    const msg = typeof args[0] === 'string' ? args[0] : (args[0]?.message ?? '')
    if (msg.includes('Support for defaultProps will be removed')) return
    if (msg.includes('ERR_EMPTY_RESPONSE') || msg.includes('ERR_NETWORK') ||
        msg.includes('ERR_SOCKET_NOT_CONNECTED') || msg.includes('Network Error')) return
    _ce(...args)
  }

  // Silencia el log nativo del XMLHttpRequest cuando el backend no está disponible
  const _cw = console.warn.bind(console)
  console.warn = (...args: any[]) => {
    const msg = typeof args[0] === 'string' ? args[0] : ''
    if (msg.includes('ERR_EMPTY_RESPONSE') || msg.includes('ERR_NETWORK')) return
    _cw(...args)
  }
}

function ThemeApplier() {
  const { theme } = useThemeStore()

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [theme])

  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        dedupingInterval: 5000,
        revalidateOnFocus: false,
        shouldRetryOnError: false,
        // Evita que errores de red (backend reiniciando) aparezcan en consola
        onError: (err) => {
          const isNetwork = !err.response &&
            (err.code === 'ERR_NETWORK' || err.code === 'ERR_EMPTY_RESPONSE' ||
             err.message === 'Network Error')
          if (!isNetwork) console.error(err)
        },
      }}
    >
      <ThemeApplier />
      {children}
    </SWRConfig>
  )
}
