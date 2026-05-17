import api from './api'
import type { ApiResponse, Encomienda, HistorialEncomienda } from '@/types'

export interface RegistrarEncomiendaDTO {
  // Remitente
  remitenteTipoDoc: string
  remitenteDoc: string
  remitenteNombres?: string
  remitenteApellidos?: string
  remitenteRazonSocial?: string
  remitenteTelefono?: string
  // Destinatario
  destinatarioTipoDoc: string
  destinatarioDoc: string
  destinatarioNombres?: string
  destinatarioApellidos?: string
  destinatarioRazonSocial?: string
  destinatarioTelefono?: string
  // Paquete
  descripcion: string
  pesoKg?: number
  numBultos?: number
  viajeId?: number
  agenciaDestinoId: number
  // Cobro
  monto: number
  formaCobro: string
  observaciones?: string
}

export const encomiendaService = {
  registrar: (dto: RegistrarEncomiendaDTO) =>
    api.post<any, ApiResponse<Encomienda>>('/api/encomiendas', dto),

  getLista: (filtros?: {
    estado?: string
    destino?: number
    desde?: string
    hasta?: string
    q?: string
  }) => api.get<any, ApiResponse<Encomienda[]>>('/api/encomiendas/lista', { params: filtros }),

  getById: (id: number) =>
    api.get<any, ApiResponse<Encomienda>>(`/api/encomiendas/${id}`),

  getByTracking: (codigo: string) =>
    api.get<any, ApiResponse<any>>(`/api/tracking/${codigo}`),

  cambiarEstado: (id: number, estado: string, observacion: string) =>
    api.patch<any, ApiResponse<Encomienda>>(`/api/encomiendas/${id}/estado`, { estado, observacion }),

  entregar: (id: number, recibidoPorDni: string, recibidoPorNombre: string) =>
    api.post<any, ApiResponse<Encomienda>>(`/api/encomiendas/${id}/entregar`,
      { recibidoPorDni, recibidoPorNombre }),

  getHistorial: (id: number) =>
    api.get<any, ApiResponse<HistorialEncomienda[]>>(`/api/encomiendas/${id}/historial`),

  getComprobantePDF: async (id: number): Promise<Blob> => {
    const response = await api.get(`/api/encomiendas/${id}/comprobante`, { responseType: 'blob' })
    return response as unknown as Blob
  },
}
