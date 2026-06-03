import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Toaster } from 'react-hot-toast'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  preload: false,
})

export const metadata: Metadata = {
  title: 'Express Quinuapata VRAEM SAC',
  description: 'Sistema de Gestión de Transporte Express Quinuapata VRAEM SAC',
}

// Script inline que aplica el tema ANTES de que React hidrate — evita el flash
const themeScript = `
try {
  const saved = JSON.parse(localStorage.getItem('theme-preference') || '{}');
  if (saved?.state?.theme === 'dark') document.documentElement.classList.add('dark');
} catch(e) {}
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={inter.className}>
        <Providers>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: { fontSize: '14px', borderRadius: '10px', padding: '12px 16px' },
            }}
          />
        </Providers>
      </body>
    </html>
  )
}
