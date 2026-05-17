'use client'
import React, { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Bus, Eye, EyeOff, LogIn } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { useState } from 'react'

const schema = z.object({
  email:    z.string().min(1, 'El email es obligatorio').email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})

type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const router = useRouter()
  const { login, isAuthenticated } = useAuthStore()
  const [showPass, setShowPass] = useState(false)

  useEffect(() => {
    if (isAuthenticated) router.replace('/')
  }, [isAuthenticated, router])

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
    <div className="flex min-h-screen w-full">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-primary-900 text-white p-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent-700 rounded-xl flex items-center justify-center">
            <Bus size={22} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-lg leading-tight">Express Quinuapata</p>
            <p className="text-xs text-white/50">VRAEM SAC</p>
          </div>
        </div>
        <div>
          <h1 className="text-3xl font-bold mb-3 leading-tight">
            Sistema Integral de<br />Transporte VRAEM
          </h1>
          <p className="text-white/60 text-sm leading-relaxed">
            Gestión completa de pasajes, encomiendas, caja y reportes
            para las rutas Huamanga-Kimbiri, Huamanga-Pichari y
            Huamanga-San Francisco.
          </p>
        </div>
        <div className="flex gap-6 text-white/40 text-xs">
          <span>Huamanga · Kimbiri · Pichari · San Francisco</span>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-6 lg:hidden">
              <div className="w-8 h-8 bg-primary-900 rounded-lg flex items-center justify-center">
                <Bus size={16} className="text-white" />
              </div>
              <span className="font-bold text-gray-900">Express Quinuapata VRAEM</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Iniciar sesión</h2>
            <p className="text-sm text-gray-500 mt-1">Ingrese sus credenciales para continuar</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Correo electrónico
              </label>
              <input
                type="email"
                placeholder="usuario@quinuapata.com"
                autoComplete="email"
                {...register('email')}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              {errors.email && (
                <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  {...register('password')}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={isSubmitting}
              icon={LogIn}
              className="w-full justify-center"
            >
              Ingresar al sistema
            </Button>
          </form>

          <p className="mt-6 text-xs text-gray-400 text-center">
            Express Quinuapata VRAEM SAC &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  )
}
