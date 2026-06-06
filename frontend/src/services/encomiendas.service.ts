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
  esFragil?: boolean
  viajeId?: number
  agenciaDestinoId: number
  // Cobro
  monto: number
  formaCobro: string
  observaciones?: string
  promocionId?: number
}

export interface EntregarEncomiendaDTO {
  dniReceptor: string
  nombreReceptor: string
  nota?: string
  formaPago?: string
}

export interface RecepcionItemDTO {
  encomiendaId: number
  recibido: boolean
  observacion?: string
}

export interface ViajeEnTransito {
  viajeId: number
  rutaOrigen?: string
  rutaDestino?: string
  fechaHoraSal?: string
  vehiculoPlaca?: string
  vehiculoTipo?: string
  estadoViaje?: string
  totalEncomiendas: number
  encomiendas: any[]
}

export interface RecepcionResultado {
  recibidas: number
  faltantes: number
  total: number
  codigosFaltantes: string[]
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

  getParaEntrega: () =>
    api.get<any, ApiResponse<any[]>>('/api/encomiendas/para-entrega'),

  getById: (id: number) =>
    api.get<any, ApiResponse<Encomienda>>(`/api/encomiendas/${id}`),

  getByTracking: (codigo: string) =>
    api.get<any, ApiResponse<any>>(`/api/tracking/${codigo}`),

  cambiarEstado: (id: number, estado: string, observacion: string) =>
    api.patch<any, ApiResponse<Encomienda>>(`/api/encomiendas/${id}/estado`, { estado, observacion }),

  marcarLlegada: (id: number, observacion?: string) =>
    api.post<any, ApiResponse<Encomienda>>(`/api/encomiendas/${id}/marcar-llegada`,
      observacion ? { observacion } : {}),

  marcarDisponible: (id: number, observacion?: string) =>
    api.post<any, ApiResponse<Encomienda>>(`/api/encomiendas/${id}/disponible`,
      observacion ? { observacion } : {}),

  entregar: (id: number, dto: EntregarEncomiendaDTO) =>
    api.post<any, ApiResponse<{ encomienda: Encomienda; cobrado: boolean }>>(`/api/encomiendas/${id}/entregar`, dto),

  getHistorial: (id: number) =>
    api.get<any, ApiResponse<HistorialEncomienda[]>>(`/api/encomiendas/${id}/historial`),

  getComprobantePDF: async (id: number): Promise<Blob> => {
    const response = await api.get(`/api/encomiendas/${id}/comprobante`, { responseType: 'blob' })
    return response as unknown as Blob
  },

  getComprobanteEntregaPDF: async (id: number): Promise<Blob> => {
    const response = await api.get(`/api/encomiendas/${id}/comprobante-entrega`, { responseType: 'blob' })
    return response as unknown as Blob
  },

  getEtiquetaPDF: async (id: number): Promise<Blob> => {
    const response = await api.get(`/api/encomiendas/${id}/etiqueta`, { responseType: 'blob' })
    return response as unknown as Blob
  },

  getViajesEnTransito: () =>
    api.get<any, { data: ViajeEnTransito[] }>('/api/encomiendas/viajes-en-transito')
       .then((r: any) => (r.data ?? []) as ViajeEnTransito[]),

  recepcionar: (viajeId: number, items: RecepcionItemDTO[]) =>
    api.post<any, { data: RecepcionResultado }>(`/api/encomiendas/viaje/${viajeId}/recepcionar`, items)
       .then((r: any) => r.data as RecepcionResultado),
}
