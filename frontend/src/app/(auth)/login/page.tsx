'use client'
import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Eye, EyeOff, LogIn, Bus } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useEmpresaStore } from '@/stores/empresaStore'

const schema = z.object({
  email:    z.string().min(1, 'El email es obligatorio').email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})

type FormData = z.infer<typeof schema>

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
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#020617]">

      {/* ── Fondo animado ── */}
      <div className="pointer-events-none absolute inset-0">
        {/* Orbs de color */}
        <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-primary-700/20 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-primary-500/15 blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/10 blur-[80px]" />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* ── Card glassmorphism ── */}
      <div className="relative z-10 w-full max-w-md px-4">
        <div
          className="rounded-2xl border border-white/10 p-8 shadow-2xl"
          style={{
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          {/* Logo */}
          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            {logoBase64 ? (
              <img
                src={logoBase64}
                alt={nombre}
                className="max-h-20 max-w-[200px] w-auto object-contain drop-shadow-lg"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-600 shadow-lg shadow-primary-900/40">
                <Bus size={26} className="text-white" />
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold leading-tight text-white">{nombre}</h1>
            </div>
          </div>

          {/* Título */}
          <div className="mb-7 text-center">
            <h2 className="text-2xl font-bold text-white">Iniciar sesión</h2>
            <p className="mt-1 text-sm text-white/50">Accede al panel de gestión</p>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-white/70">
                Correo electrónico
              </label>
              <input
                type="email"
                placeholder="usuario@quinuapata.com"
                autoComplete="email"
                {...register('email')}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition-all duration-200 focus:border-primary-500/60 focus:bg-white/8 focus:ring-2 focus:ring-primary-500/20"
              />
              {errors.email && (
                <p className="flex items-center gap-1 text-xs text-red-400">
                  <span className="inline-block h-1 w-1 rounded-full bg-red-400" />
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Contraseña */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-white/70">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  {...register('password')}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-11 text-sm text-white placeholder-white/25 outline-none transition-all duration-200 focus:border-primary-500/60 focus:bg-white/8 focus:ring-2 focus:ring-primary-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-white/30 transition-colors duration-150 hover:text-white/70"
                  aria-label="Mostrar/ocultar contraseña"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="flex items-center gap-1 text-xs text-red-400">
                  <span className="inline-block h-1 w-1 rounded-full bg-red-400" />
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Botón submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative mt-2 flex w-full cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-900/40 transition-all duration-200 hover:bg-primary-500 hover:shadow-primary-800/50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <span>Verificando...</span>
                </>
              ) : (
                <>
                  <LogIn size={16} />
                  <span>Ingresar al sistema</span>
                </>
              )}
              {/* Shimmer on hover */}
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
            </button>
          </form>

          {/* Footer */}
          <p className="mt-7 text-center text-xs text-white/25">
            Solo personal autorizado · Express Quinuapata VRAEM SAC &copy; {new Date().getFullYear()}
          </p>
        </div>

      </div>
    </div>
  )
}
