'use client'
import { SWRConfig } from 'swr'
import api from '@/services/api'

const fetcher = (url: string) => api.get<any, any>(url).then(r => r.data)

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
      {children}
    </SWRConfig>
  )
}
