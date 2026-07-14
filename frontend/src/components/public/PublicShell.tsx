'use client'
import React, { useEffect } from 'react'
import Link from 'next/link'
import { Syne, Plus_Jakarta_Sans } from 'next/font/google'
import { useEmpresaStore } from '@/stores/empresaStore'

/* Identidad de la página web pública (misma paleta que el login del panel) */
export const NAVY    = '#0A1628'
export const GREEN   = '#16a34a'
export const GREEN_D = '#15803d'
export const GREEN_L = '#4ade80'

export const syne    = Syne({ subsets: ['latin'], weight: ['700', '800'], display: 'swap' })
export const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], display: 'swap' })

export const glassCard: React.CSSProperties = {
  background: 'rgba(15,23,42,0.72)',
  border: '1px solid rgba(255,255,255,0.09)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
}

export const glassInput: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1.5px solid rgba(255,255,255,0.09)',
  colorScheme: 'dark',
}

/* Chips de estado legibles sobre fondo navy (los Badge del panel son pastel claro) */
const CHIP: Record<string, { bg: string; fg: string; bd: string; label: string }> = {
  REGISTRADO:  { bg: 'rgba(59,130,246,0.12)', fg: '#93c5fd', bd: 'rgba(59,130,246,0.35)', label: 'Registrado' },
  EN_TRANSITO: { bg: 'rgba(250,204,21,0.10)', fg: '#fde047', bd: 'rgba(250,204,21,0.30)', label: 'En tránsito' },
  ENTREGADO:   { bg: 'rgba(34,197,94,0.12)',  fg: '#4ade80', bd: 'rgba(34,197,94,0.35)',  label: 'Entregado' },
  DEVUELTO:    { bg: 'rgba(249,115,22,0.12)', fg: '#fdba74', bd: 'rgba(249,115,22,0.35)', label: 'Devuelto' },
  PERDIDO:     { bg: 'rgba(239,68,68,0.12)',  fg: '#fca5a5', bd: 'rgba(239,68,68,0.35)',  label: 'Perdido' },
  PROGRAMADO:  { bg: 'rgba(59,130,246,0.12)', fg: '#93c5fd', bd: 'rgba(59,130,246,0.35)', label: 'Programado' },
  EN_RUTA:     { bg: 'rgba(34,197,94,0.12)',  fg: '#4ade80', bd: 'rgba(34,197,94,0.35)',  label: 'En ruta' },
}

export function EstadoChip({ estado }: { estado: string }) {
  const c = CHIP[estado] ?? { bg: 'rgba(255,255,255,0.07)', fg: 'rgba(255,255,255,0.6)', bd: 'rgba(255,255,255,0.15)', label: estado }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ background: c.bg, color: c.fg, border: `1px solid ${c.bd}` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.fg }} />
      {c.label}
    </span>
  )
}

const LINKS = [
  { key: 'horarios',   href: '/horarios',   label: 'Horarios' },
  { key: 'tarifas',    href: '/tarifas',    label: 'Tarifas' },
  { key: 'sucursales', href: '/sucursales', label: 'Sucursales' },
  { key: 'tracking',   href: '/tracking',   label: 'Rastrear' },
] as const

export type PublicSection = (typeof LINKS)[number]['key']

/**
 * Marco compartido de las páginas públicas (cliente final, mayormente en celular):
 * header con el logo real de la empresa, nav, fondo navy de la web oficial y footer.
 */
export default function PublicShell({ active, subtitle, children }: {
  active: PublicSection
  subtitle: string
  children: React.ReactNode
}) {
  const { logoBase64, fetchFromApi } = useEmpresaStore()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchFromApi() }, [])

  return (
    <div
      className={`${jakarta.className} flex min-h-screen flex-col`}
      style={{ background: `radial-gradient(ellipse at top, #0f1f3d 0%, ${NAVY} 55%, #020617 100%)` }}
    >
      <header
        className="sticky top-0 z-20 border-b"
        style={{
          borderColor: 'rgba(255,255,255,0.08)',
          background: 'rgba(10,22,40,0.85)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
        }}
      >
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <Link href="/tracking" className="flex items-center gap-2.5">
            {logoBase64 ? (
              <span className="flex items-center justify-center rounded-xl px-2 py-1.5" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <img src={logoBase64} alt="Express Quinuapata VRAEM SAC" className="h-8 w-auto max-w-[110px] object-contain sm:h-9" />
              </span>
            ) : (
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ background: GREEN, boxShadow: '0 6px 18px rgba(22,163,74,0.35)' }}
              >
                {/* Mismo ícono de bus que la página web (fallback si no hay logo) */}
                <svg viewBox="0 0 24 24" fill="currentColor" width={18} height={18} style={{ color: '#fff' }}>
                  <path d="M4 16c0 .88.39 1.67 1 2.22V20a1 1 0 001 1h1a1 1 0 001-1v-1h8v1a1 1 0 001 1h1a1 1 0 001-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm9 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM6 6h12v4H6V6z" />
                </svg>
              </span>
            )}
            <span className="leading-tight">
              <span className={`${syne.className} block text-[0.92rem] font-extrabold text-white`}>
                Express <span style={{ color: GREEN_L }}>Quinuapata</span>
              </span>
              <span className="block text-[0.6rem] uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {subtitle}
              </span>
            </span>
          </Link>

          <nav className="flex items-center gap-1 text-[0.82rem]">
            {LINKS.map(l => (
              active === l.key ? (
                <span
                  key={l.key}
                  className="rounded-lg px-2.5 py-1.5 font-semibold text-white"
                  style={{ background: 'rgba(22,163,74,0.18)', border: '1px solid rgba(22,163,74,0.35)' }}
                >
                  {l.label}
                </span>
              ) : (
                <Link
                  key={l.key}
                  href={l.href}
                  className="rounded-lg px-2.5 py-1.5 font-medium text-white/55 transition-colors duration-150 hover:text-white"
                >
                  {l.label}
                </Link>
              )
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>

      <footer
        className="border-t py-6 text-center text-xs"
        style={{ borderColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.28)' }}
      >
        Express Quinuapata VRAEM S.A.C. · Cargas y encomiendas · © {new Date().getFullYear()}
      </footer>
    </div>
  )
}
