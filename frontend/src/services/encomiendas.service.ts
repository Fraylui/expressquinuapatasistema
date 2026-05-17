import api from './api'
import { ApiResponse, Encomienda, HistorialEncomienda } from '@/types'

export const encomiendaService = {
  registrar: (dto: {
    remitenteId: number
    destinatarioId: number
    viajeId?: number
    descripcion: string
    pesoKg?: number
    fechaEntregaEst?: string
    observaciones?: string
  }) => api.post<any, ApiResponse<Encomienda>>('/api/encomiendas', dto),

  getByTracking: (codigo: string) =>
    api.get<any, ApiResponse<any>>(`/api/tracking/${codigo}`),

  cambiarEstado: (id: number, estado: string, observacion: string) =>
    api.patch<any, ApiResponse<Encomienda>>(`/api/encomiendas/${id}/estado`, { estado, observacion }),

  getLista: (filtros?: { estado?: string }) =>
    api.get<any, ApiResponse<Encomienda[]>>('/api/encomiendas/lista', { params: filtros }),

  getHistorial: (id: number) =>
    api.get<any, ApiResponse<HistorialEncomienda[]>>(`/api/encomiendas/${id}/historial`),

  getComprobantePDF: async (id: number): Promise<Blob> => {
    const response = await api.get(`/api/encomiendas/pdf/${id}/comprobante`, { responseType: 'blob' })
    return response as unknown as Blob
  },
}
