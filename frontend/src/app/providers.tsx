'use client'
import { useEffect } from 'react'
import { SWRConfig } from 'swr'
import api from '@/services/api'
import { useThemeStore } from '@/stores/themeStore'

const fetcher = (url: string) => api.get<any, any>(url).then(r => r.data)

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
      }}
    >
      <ThemeApplier />
      {children}
    </SWRConfig>
  )
}
