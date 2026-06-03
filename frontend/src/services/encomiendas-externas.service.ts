import api from './api'
import type { ApiResponse } from '@/types'

export interface RegistrarEncomiendaExternaDTO {
  conductorNombre: string
  conductorDni: string
  conductorTel?: string
  conductorPlaca?: string
  destinatarioNombre: string
  destinatarioDni: string
  destinatarioTel?: string
  descripcion: string
  observaciones?: string
  monto: number
  estadoPago: 'PENDIENTE' | 'PAGADO'
  formaPago?: string
}

export interface EntregarEncomiendaExternaDTO {
  receptorNombre: string
  receptorDni: string
  nota?: string
  formaPago?: string
}

export interface EncomiendaExterna {
  id: number
  agenciaId: number
  correlativo: string
  secuencia: number
  anio: number
  conductorNombre: string
  conductorDni: string
  conductorTel?: string
  conductorPlaca?: string
  destinatarioNombre: string
  destinatarioDni: string
  destinatarioTel?: string
  descripcion: string
  observaciones?: string
  monto: number
  estadoPago: 'PENDIENTE' | 'PAGADO'
  formaPago?: string
  estado: 'PENDIENTE' | 'ENTREGADO'
  fechaEntrega?: string
  entregadoA?: string
  entregadoDni?: string
  operadorId: number
  operadorEntregaId?: number
  fechaRecepcion: string
  createdAt: string
}

export const encomiendaExternaService = {
  registrar: (dto: RegistrarEncomiendaExternaDTO) =>
    api.post<any, ApiResponse<EncomiendaExterna>>('/api/encomiendas-externas', dto),

  getLista: (estado?: string) =>
    api.get<any, ApiResponse<EncomiendaExterna[]>>('/api/encomiendas-externas/lista', {
      params: estado ? { estado } : undefined,
    }),

  entregar: (id: number, dto: EntregarEncomiendaExternaDTO) =>
    api.post<any, ApiResponse<{ encomienda: EncomiendaExterna; cobrado: boolean }>>(
      `/api/encomiendas-externas/${id}/entregar`, dto
    ),

  getTicketPDF: async (id: number): Promise<Blob> => {
    const r = await api.get(`/api/encomiendas-externas/${id}/ticket`, { responseType: 'blob' })
    return r as unknown as Blob
  },
}
