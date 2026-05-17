import api from './api'
import { ApiResponse, Pasaje } from '@/types'

export const pasajesService = {
  getAsientosDisponibles: (viajeId: number) =>
    api.get<any, ApiResponse<any[]>>(`/api/pasajes/viaje/${viajeId}/asientos`),

  venderPasaje: (dto: {
    viajeId: number
    asientoId: number
    clienteId: number
    tarifaId: number
    descuentoId?: number
    montoDescuento?: number
    formaPago?: string
  }) => api.post<any, ApiResponse<Pasaje>>('/api/pasajes/vender', dto),

  anularPasaje: (id: number) =>
    api.post<any, ApiResponse<void>>(`/api/pasajes/${id}/anular`),

  getTicketPDF: async (id: number): Promise<Blob> => {
    const response = await api.get(`/api/pasajes/${id}/ticket`, { responseType: 'blob' })
    return response as unknown as Blob
  },

  getDetalle: (id: number) =>
    api.get<any, ApiResponse<Pasaje>>(`/api/pasajes/${id}`),
}
