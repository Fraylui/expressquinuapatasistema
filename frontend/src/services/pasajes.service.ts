import api from './api'
import { ApiResponse, Pasaje } from '@/types'

export interface VentaPasajeDTO {
  viajeId: number
  asientoNumero: number
  clienteDni: string
  clienteNombres: string
  clienteApellidos: string
  clienteTelefono: string
  clienteDireccion?: string
  precioBase: number
  descuento: number
  formaPago: string
  motivoDescuento?: string
  promocionId?: number
  /** Ruta del destino del pasajero (baja en agencia intermedia). Opcional. */
  rutaDestinoId?: number
  tipo?: 'VENTA' | 'RESERVA'
}

export interface PasajeResponseDTO {
  id: number
  codigoBoleta: string
  destino?: string | null
  viajeId: number
  asientoNumero: number
  clienteId: number
  clienteNombres: string
  clienteApellidos: string
  clienteDni: string
  precioBase: number
  descuento: number
  precioFinal: number
  formaPago: string
  estado: string
  fechaVenta: string
}

export const pasajesService = {
  vender: (dto: VentaPasajeDTO) =>
    api.post<any, ApiResponse<PasajeResponseDTO>>('/api/pasajes/vender', dto),

  anular: (id: number, motivoAnulacion: string) =>
    api.post<any, ApiResponse<void>>(`/api/pasajes/${id}/anular`, { motivoAnulacion }),

  confirmar: (id: number, formaPago: string) =>
    api.post<any, ApiResponse<PasajeResponseDTO>>(`/api/pasajes/${id}/confirmar`, { formaPago }),

  getLista: (params?: { estado?: string; codigoBoleta?: string }) =>
    api.get<any, ApiResponse<Pasaje[]>>('/api/pasajes', { params }),

  getDetalle: (id: number) =>
    api.get<any, ApiResponse<Pasaje>>(`/api/pasajes/${id}`),

  getTicketBlob: async (id: number): Promise<Blob> => {
    const response = await api.get(`/api/pasajes/${id}/ticket`, { responseType: 'blob' })
    return response as unknown as Blob
  },
}
