import axios from 'axios'
import toast from 'react-hot-toast'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
  timeout: 30000,
})

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('auth-store')
    if (stored) {
      try {
        const { state } = JSON.parse(stored)
        if (state?.token) {
          config.headers.Authorization = `Bearer ${state.token}`
        }
      } catch {}
    }
  }
  return config
})

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    // Errores de red (backend reiniciando, sin conexión) — silencioso en dev
    const isNetworkError = !error.response &&
      (error.code === 'ERR_NETWORK' || error.code === 'ERR_EMPTY_RESPONSE' ||
       error.code === 'ERR_SOCKET_NOT_CONNECTED' || error.message === 'Network Error')
    if (isNetworkError) return Promise.reject(error)

    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth-store')
        window.location.href = '/login'
      }
    } else if (error.response?.status === 403) {
      toast.error('No tiene permisos para realizar esta acción')
    }
    return Promise.reject(error)
  }
)

export default api
