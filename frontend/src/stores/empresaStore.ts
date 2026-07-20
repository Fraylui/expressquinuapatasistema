import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '@/services/api'

interface EmpresaState {
  nombre: string
  ruc: string
  direccion: string
  ciudad: string
  telefono: string
  logoBase64: string | null
  cuotaSalidaCombi: string
  cuotaSalidaCamioneta: string
  loaded: boolean
  setNombre:     (v: string) => void
  setRuc:        (v: string) => void
  setDireccion:  (v: string) => void
  setCiudad:     (v: string) => void
  setTelefono:   (v: string) => void
  setLogoBase64: (v: string | null) => void
  setCuotaSalidaCombi: (v: string) => void
  fetchFromApi:  () => Promise<void>
  saveToApi:     (data: Partial<EmpresaState>) => Promise<void>
}

export const useEmpresaStore = create<EmpresaState>()(
  persist(
    (set, get) => ({
      nombre:      'Mi Empresa de Transporte S.A.C.',
      ruc:         '',
      direccion:   '',
      ciudad:      '',
      telefono:    '',
      logoBase64:  null,
      cuotaSalidaCombi: '0',
      cuotaSalidaCamioneta: '0',
      loaded:      false,

      setNombre:     (nombre)     => set({ nombre }),
      setRuc:        (ruc)        => set({ ruc }),
      setDireccion:  (direccion)  => set({ direccion }),
      setCiudad:     (ciudad)     => set({ ciudad }),
      setTelefono:   (telefono)   => set({ telefono }),
      setLogoBase64: (logoBase64) => set({ logoBase64 }),
      setCuotaSalidaCombi: (cuotaSalidaCombi) => set({ cuotaSalidaCombi }),

      fetchFromApi: async () => {
        try {
          const res: any = await api.get('/api/empresa-config')
          const d = res?.data
          if (d) {
            set({
              nombre:     d.nombre     ?? get().nombre,
              ruc:        d.ruc        ?? '',
              direccion:  d.direccion  ?? '',
              ciudad:     d.ciudad     ?? '',
              telefono:   d.telefono   ?? '',
              logoBase64: d.logoBase64 ?? null,
              cuotaSalidaCombi: d.cuotaSalidaCombi != null ? String(d.cuotaSalidaCombi) : '0',
              cuotaSalidaCamioneta: d.cuotaSalidaCamioneta != null ? String(d.cuotaSalidaCamioneta) : '0',
              loaded:     true,
            })
          }
        } catch { /* usa los valores del localStorage */ }
      },

      saveToApi: async (data) => {
        const current = {
          nombre:     get().nombre,
          ruc:        get().ruc,
          direccion:  get().direccion,
          ciudad:     get().ciudad,
          telefono:   get().telefono,
          logoBase64: get().logoBase64,
          cuotaSalidaCombi: get().cuotaSalidaCombi,
          cuotaSalidaCamioneta: get().cuotaSalidaCamioneta,
          ...data,
        }
        set(current)
        const payload = {
          ...current,
          cuotaSalidaCombi: parseFloat(String(current.cuotaSalidaCombi)) || 0,
          cuotaSalidaCamioneta: parseFloat(String(current.cuotaSalidaCamioneta)) || 0,
        }
        const res: any = await api.put('/api/empresa-config', payload)
        const saved = res?.data
        if (saved) set({
          ...saved,
          cuotaSalidaCombi: saved.cuotaSalidaCombi != null ? String(saved.cuotaSalidaCombi) : '0',
          cuotaSalidaCamioneta: saved.cuotaSalidaCamioneta != null ? String(saved.cuotaSalidaCamioneta) : '0',
          loaded: true,
        })
      },
    }),
    { name: 'empresa-config' }
  )
)
