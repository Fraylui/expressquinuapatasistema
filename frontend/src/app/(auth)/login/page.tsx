'use client'
import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Eye, EyeOff, LogIn, Bus, Shield } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useEmpresaStore } from '@/stores/empresaStore'

const schema = z.object({
  email:    z.string().min(1, 'El email es obligatorio').email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})

type FormData = z.infer<typeof schema>

/* ── Puntos flotantes decorativos ── */
const DOTS = [
  { top: '12%',  left: '8%',  size: 6,  delay: '0s',    dur: '6s'  },
  { top: '28%',  left: '22%', size: 4,  delay: '1.2s',  dur: '8s'  },
  { top: '55%',  left: '14%', size: 8,  delay: '0.5s',  dur: '7s'  },
  { top: '70%',  left: '30%', size: 5,  delay: '2s',    dur: '9s'  },
  { top: '85%',  left: '10%', size: 3,  delay: '0.8s',  dur: '5s'  },
  { top: '40%',  left: '40%', size: 6,  delay: '1.8s',  dur: '10s' },
  { top: '18%',  left: '50%', size: 4,  delay: '0.3s',  dur: '7s'  },
  { top: '62%',  left: '48%', size: 5,  delay: '1s',    dur: '8s'  },
  { top: '90%',  left: '42%', size: 3,  delay: '2.5s',  dur: '6s'  },
]


export default function LoginPage() {
  const router = useRouter()
  const { login, isAuthenticated } = useAuthStore()
  const { nombre, logoBase64, fetchFromApi } = useEmpresaStore()
  const [showPass, setShowPass] = useState(false)

  useEffect(() => {
    if (isAuthenticated) router.replace('/')
  }, [isAuthenticated, router])

  useEffect(() => { fetchFromApi() }, [])

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    try {
      await login(data.email, data.password)
      toast.success('Bienvenido al sistema')
      router.replace('/')
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Credenciales incorrectas'
      toast.error(msg)
    }
  }

  return (
    <div className="flex min-h-screen w-full overflow-hidden bg-[#020b14]">

      {/* ════════════════════════════════════════════════════
          PANEL IZQUIERDO — Branding animado (oculto en móvil)
      ════════════════════════════════════════════════════ */}
      <div className="relative hidden lg:flex lg:w-[52%] xl:w-[55%] flex-col overflow-hidden">

        {/* Gradiente de fondo del panel */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, #011a0f 0%, #022d1a 35%, #064e3b 70%, #047857 100%)',
          }}
        />

        {/* Orbs profundos */}
        <div className="absolute -top-20 -left-20 h-[500px] w-[500px] rounded-full bg-emerald-400/10 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-teal-500/15 blur-[100px]" />
        <div className="absolute top-1/2 left-1/3 h-[250px] w-[250px] -translate-y-1/2 rounded-full bg-emerald-600/20 blur-[80px]" />

        {/* Grid hexagonal sutil */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />

        {/* Líneas diagonales decorativas */}
        <div className="absolute inset-0 opacity-[0.06]">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute h-px w-full"
              style={{
                top: `${15 + i * 14}%`,
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 40%, rgba(255,255,255,0.6) 60%, transparent 100%)',
                transform: `rotate(-${8 + i * 2}deg)`,
                transformOrigin: 'left center',
              }}
            />
          ))}
        </div>

        {/* Puntos flotantes con animación */}
        {DOTS.map((d, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-emerald-300/40"
            style={{
              top: d.top, left: d.left,
              width: d.size, height: d.size,
              animation: `floatDot ${d.dur} ${d.delay} ease-in-out infinite alternate`,
            }}
          />
        ))}

        {/* Contenido central del panel */}
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-12 xl:px-16">

          {/* Logo o ícono de empresa */}
          <div className="mb-8 flex flex-col items-center gap-4 text-center">
            {logoBase64 ? (
              <div
                className="rounded-2xl p-3"
                style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(10px)' }}
              >
                <img
                  src={logoBase64}
                  alt={nombre}
                  className="max-h-20 max-w-[180px] w-auto object-contain"
                />
              </div>
            ) : (
              <div
                className="flex h-20 w-20 items-center justify-center rounded-3xl shadow-2xl"
                style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  boxShadow: '0 20px 60px rgba(16,185,129,0.4)',
                }}
              >
                <Bus size={36} className="text-white" />
              </div>
            )}

            <div>
              <h1 className="text-2xl xl:text-3xl font-bold leading-tight text-white tracking-tight">
                {nombre}
              </h1>
              <p className="mt-1 text-sm text-emerald-300/70 font-medium tracking-widest uppercase">
                Sistema de Gestión
              </p>
            </div>
          </div>

        </div>

      </div>

      {/* ════════════════════════════════════════════════════
          PANEL DERECHO — Formulario
      ════════════════════════════════════════════════════ */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-6 sm:px-10 lg:px-12 xl:px-16">

        {/* Fondo del panel derecho */}
        <div className="absolute inset-0 bg-[#060d16]" />
        <div className="absolute top-0 right-0 h-[300px] w-[300px] rounded-full bg-emerald-900/15 blur-[80px]" />
        <div className="absolute bottom-0 left-0 h-[200px] w-[200px] rounded-full bg-teal-900/10 blur-[60px]" />

        {/* Logo móvil (solo visible en sm/md cuando el panel izquierdo está oculto) */}
        <div className="relative z-10 mb-8 flex flex-col items-center gap-3 lg:hidden">
          {logoBase64 ? (
            <img src={logoBase64} alt={nombre}
              className="max-h-16 max-w-[160px] w-auto object-contain" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 shadow-lg">
              <Bus size={24} className="text-white" />
            </div>
          )}
          <h1 className="text-base font-bold text-white">{nombre}</h1>
        </div>

        {/* Card del formulario */}
        <div className="relative z-10 w-full max-w-sm">

          {/* Encabezado */}
          <div className="mb-8">
            <h2 className="text-[28px] font-bold leading-tight text-white tracking-tight">
              Iniciar sesión
            </h2>
            <p className="mt-2 text-sm text-white/40">
              Accede al panel de gestión interno
            </p>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="block text-[13px] font-semibold text-white/60 tracking-wide uppercase">
                Correo electrónico
              </label>
              <div className="relative">
                <input
                  type="email"
                  placeholder="usuario@expressvraem.com"
                  autoComplete="email"
                  {...register('email')}
                  className="
                    w-full rounded-xl px-4 py-3.5 text-sm text-white
                    outline-none transition-all duration-200
                    placeholder-white/20
                    focus:ring-2
                  "
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: errors.email
                      ? '1px solid rgba(248,113,113,0.6)'
                      : '1px solid rgba(255,255,255,0.08)',
                  }}
                  onFocus={e => {
                    if (!errors.email) {
                      e.currentTarget.style.border = '1px solid rgba(16,185,129,0.5)'
                      e.currentTarget.style.background = 'rgba(255,255,255,0.07)'
                    }
                  }}
                  onBlur={e => {
                    if (!errors.email) {
                      e.currentTarget.style.border = '1px solid rgba(255,255,255,0.08)'
                      e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                    }
                  }}
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
            <div className="space-y-1.5">
              <label className="block text-[13px] font-semibold text-white/60 tracking-wide uppercase">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  {...register('password')}
                  className="
                    w-full rounded-xl px-4 py-3.5 pr-12 text-sm text-white
                    outline-none transition-all duration-200
                    placeholder-white/20
                  "
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: errors.password
                      ? '1px solid rgba(248,113,113,0.6)'
                      : '1px solid rgba(255,255,255,0.08)',
                  }}
                  onFocus={e => {
                    if (!errors.password) {
                      e.currentTarget.style.border = '1px solid rgba(16,185,129,0.5)'
                      e.currentTarget.style.background = 'rgba(255,255,255,0.07)'
                    }
                  }}
                  onBlur={e => {
                    if (!errors.password) {
                      e.currentTarget.style.border = '1px solid rgba(255,255,255,0.08)'
                      e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 cursor-pointer rounded-lg p-1 text-white/25 transition-all duration-150 hover:bg-white/5 hover:text-white/70"
                  aria-label="Mostrar/ocultar contraseña"
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.password && (
                <p className="flex items-center gap-1.5 text-xs text-red-400">
                  <span className="inline-block h-1 w-1 shrink-0 rounded-full bg-red-400" />
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Botón submit */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="group relative w-full cursor-pointer overflow-hidden rounded-xl py-3.5 text-sm font-semibold text-white transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  background: isSubmitting
                    ? 'rgba(5,150,105,0.7)'
                    : 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  boxShadow: isSubmitting ? 'none' : '0 8px 32px rgba(5,150,105,0.35)',
                }}
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {isSubmitting ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Verificando...
                    </>
                  ) : (
                    <>
                      <LogIn size={15} />
                      Ingresar al sistema
                    </>
                  )}
                </span>
                {/* Shimmer effect */}
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              </button>
            </div>
          </form>

          {/* Divisor con seguridad */}
          <div className="mt-8 flex items-center gap-3">
            <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
            <div className="flex items-center gap-1.5 text-[11px] text-white/20">
              <Shield size={10} />
              <span>Conexión cifrada</span>
            </div>
            <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
          </div>

          {/* Footer */}
          <p className="mt-6 text-center text-[11px] text-white/20 leading-relaxed">
            Solo personal autorizado
            <br />
            Express Quinuapata VRAEM SAC &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>

      {/* ── Animación de los puntos flotantes ── */}
      <style jsx>{`
        @keyframes floatDot {
          from { transform: translate(0, 0) scale(1); opacity: 0.3; }
          to   { transform: translate(8px, -12px) scale(1.3); opacity: 0.6; }
        }
      `}</style>
    </div>
  )
}
