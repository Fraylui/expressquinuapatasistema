'use client'
import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Eye, EyeOff, LogIn, Mail, Lock, AlertCircle } from 'lucide-react'
import { Syne, Plus_Jakarta_Sans } from 'next/font/google'
import { useAuthStore } from '@/stores/authStore'
import { useEmpresaStore } from '@/stores/empresaStore'

const syne = Syne({ subsets: ['latin'], weight: ['700', '800'], display: 'swap' })
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['400', '600', '700'], display: 'swap' })

const schema = z.object({
  email:    z.string().min(1, 'El email es obligatorio').email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})

type FormData = z.infer<typeof schema>

/* Paleta idéntica a la página web pública (sd-quinuapata-web) */
const NAVY    = '#0A1628'
const GREEN   = '#16a34a'
const GREEN_D = '#15803d'
const GREEN_L = '#4ade80'

export default function LoginPage() {
  const router = useRouter()
  const { login, isAuthenticated } = useAuthStore()
  const { logoBase64, fetchFromApi } = useEmpresaStore()
  const [showPass, setShowPass] = useState(false)
  const [loginError, setLoginError] = useState('')

  useEffect(() => {
    if (isAuthenticated) router.replace('/')
  }, [isAuthenticated, router])

  useEffect(() => { fetchFromApi() }, [])

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setLoginError('')
    try {
      await login(data.email, data.password)
      toast.success('Bienvenido al sistema')
      router.replace('/')
    } catch (err: any) {
      setLoginError(err?.response?.data?.message || 'Credenciales incorrectas.')
    }
  }

  const inputBase: React.CSSProperties = {
    background: 'rgba(255,255,255,0.05)',
    border: '1.5px solid rgba(255,255,255,0.09)',
    fontFamily: 'inherit',
  }
  const inputError: React.CSSProperties = {
    background: 'rgba(255,255,255,0.05)',
    border: '1.5px solid rgba(248,113,113,0.6)',
    fontFamily: 'inherit',
  }
  const focusOn = (e: React.FocusEvent<HTMLInputElement>, hasError: boolean) => {
    if (hasError) return
    e.currentTarget.style.border = '1.5px solid rgba(22,163,74,0.55)'
    e.currentTarget.style.background = 'rgba(22,163,74,0.06)'
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(22,163,74,0.12)'
  }
  const focusOff = (e: React.FocusEvent<HTMLInputElement>, hasError: boolean) => {
    if (hasError) return
    e.currentTarget.style.border = '1.5px solid rgba(255,255,255,0.09)'
    e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
    e.currentTarget.style.boxShadow = 'none'
  }

  return (
    <div
      className={`${jakarta.className} flex min-h-screen w-full items-center justify-center overflow-hidden p-4`}
      style={{ background: `radial-gradient(ellipse at top, #0f1f3d 0%, ${NAVY} 55%, #020617 100%)` }}
    >
      {/* Tarjeta — réplica de .login-modal__box de la página web */}
      <div
        className="relative w-full max-w-[420px] overflow-hidden"
        style={{
          background: 'rgba(15,23,42,0.78)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 24,
          padding: '2.5rem 2.2rem',
          boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04) inset',
        }}
      >
        {/* Orbs decorativos */}
        <div
          className="pointer-events-none absolute"
          style={{
            top: -80, left: -80, width: 320, height: 320, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(22,163,74,0.18) 0%, transparent 70%)',
          }}
        />
        <div
          className="pointer-events-none absolute"
          style={{
            bottom: -60, right: -60, width: 260, height: 260, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)',
          }}
        />
        {/* Grid pattern */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            borderRadius: 24,
          }}
        />

        {/* Logo centrado */}
        <div className="relative z-[1] mb-6 flex flex-col items-center gap-3">
          {logoBase64 ? (
            <div
              className="flex items-center justify-center rounded-2xl p-2.5"
              style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(10px)' }}
            >
              <img src={logoBase64} alt="Express Quinuapata" className="max-h-14 w-auto max-w-[150px] object-contain" />
            </div>
          ) : (
            <div
              className="flex items-center justify-center"
              style={{
                width: 56, height: 56, borderRadius: 16, background: GREEN,
                boxShadow: '0 8px 24px rgba(22,163,74,0.35)',
              }}
            >
              {/* Mismo ícono de bus que la página web */}
              <svg viewBox="0 0 24 24" fill="currentColor" width={26} height={26} style={{ color: '#fff' }}>
                <path d="M4 16c0 .88.39 1.67 1 2.22V20a1 1 0 001 1h1a1 1 0 001-1v-1h8v1a1 1 0 001 1h1a1 1 0 001-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm9 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM6 6h12v4H6V6z" />
              </svg>
            </div>
          )}
          <div className={`${syne.className} text-center text-[1.05rem] font-extrabold leading-tight text-white`}>
            Express <span style={{ color: GREEN_L }}>Quinuapata</span>
          </div>
          <div
            className="text-center uppercase"
            style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', marginTop: '-0.4rem' }}
          >
            VRAEM SAC
          </div>
        </div>

        {/* Título */}
        <h2 className={`${syne.className} relative z-[1] mb-1 text-center text-[1.45rem] font-extrabold text-white`}>
          Iniciar sesión
        </h2>
        <p className="relative z-[1] mb-7 text-center text-[0.83rem]" style={{ color: 'rgba(255,255,255,0.45)' }}>
          Accede al panel de gestión
        </p>

        {/* Error del servidor — mismo estilo .lf-error de la web */}
        {loginError && (
          <div
            className="relative z-[1] mb-4 flex items-center gap-2 rounded-[10px] px-3.5 py-2.5 text-[0.8rem]"
            style={{
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.25)',
              color: '#fca5a5',
            }}
          >
            <AlertCircle size={15} className="shrink-0" />
            <span>{loginError}</span>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit(onSubmit)} className="relative z-[1]" noValidate>

          {/* Email */}
          <div className="mb-[1.1rem] flex flex-col gap-2">
            <label htmlFor="login-email" className="text-[0.78rem] font-semibold" style={{ color: 'rgba(255,255,255,0.6)', letterSpacing: '0.02em' }}>
              Correo electrónico
            </label>
            <div className="relative flex items-center">
              <span className="pointer-events-none absolute left-3.5 flex" style={{ color: 'rgba(255,255,255,0.25)' }}>
                <Mail size={15} />
              </span>
              <input
                id="login-email"
                type="email"
                placeholder="usuario@empresa.com"
                autoComplete="email"
                {...register('email')}
                className="w-full rounded-xl py-3 pl-10 pr-4 text-[0.9rem] text-white outline-none transition-all duration-200 placeholder:text-white/20"
                style={errors.email ? inputError : inputBase}
                onFocus={e => focusOn(e, !!errors.email)}
                onBlur={e => focusOff(e, !!errors.email)}
              />
            </div>
            {errors.email && (
              <p className="flex items-center gap-1.5 text-xs text-red-400">
                <span className="inline-block h-1 w-1 shrink-0 rounded-full bg-red-400" />
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Contraseña */}
          <div className="mb-[1.1rem] flex flex-col gap-2">
            <label htmlFor="login-password" className="text-[0.78rem] font-semibold" style={{ color: 'rgba(255,255,255,0.6)', letterSpacing: '0.02em' }}>
              Contraseña
            </label>
            <div className="relative flex items-center">
              <span className="pointer-events-none absolute left-3.5 flex" style={{ color: 'rgba(255,255,255,0.25)' }}>
                <Lock size={15} />
              </span>
              <input
                id="login-password"
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••"
                autoComplete="current-password"
                {...register('password')}
                className="w-full rounded-xl py-3 pl-10 pr-11 text-[0.9rem] text-white outline-none transition-all duration-200 placeholder:text-white/20"
                style={errors.password ? inputError : inputBase}
                onFocus={e => focusOn(e, !!errors.password)}
                onBlur={e => focusOff(e, !!errors.password)}
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute right-3.5 flex cursor-pointer border-none bg-transparent p-0 transition-colors duration-200 hover:text-white/70"
                style={{ color: 'rgba(255,255,255,0.3)' }}
                aria-label="Mostrar/ocultar contraseña"
              >
                {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            {errors.password && (
              <p className="flex items-center gap-1.5 text-xs text-red-400">
                <span className="inline-block h-1 w-1 shrink-0 rounded-full bg-red-400" />
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Botón submit — mismo estilo .lf-submit de la web */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="group relative mt-2 flex w-full cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-xl border-none py-3.5 text-[0.92rem] font-bold text-white transition-all duration-200 hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
            style={{
              background: GREEN,
              boxShadow: '0 6px 20px rgba(22,163,74,0.3)',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => { if (!isSubmitting) e.currentTarget.style.background = GREEN_D }}
            onMouseLeave={e => { e.currentTarget.style.background = GREEN }}
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              {isSubmitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-white" />
                  Verificando...
                </>
              ) : (
                <>
                  <LogIn size={16} strokeWidth={2.5} />
                  Ingresar al sistema
                </>
              )}
            </span>
            {/* Shimmer */}
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
          </button>
        </form>

        {/* Footer */}
        <p className="relative z-[1] mt-5 text-center" style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.22)' }}>
          Solo personal autorizado &middot; Express Quinuapata VRAEM SAC
        </p>
      </div>
    </div>
  )
}
