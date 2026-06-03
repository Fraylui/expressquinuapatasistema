import api from './api'

export interface PromocionDTO {
  id: number
  nombre: string
  descripcion?: string
  codigo?: string
  tipoDescuento: 'PORCENTAJE' | 'MONTO_FIJO' | 'IDA_VUELTA'
  valor: number
  aplicaA: 'PASAJES' | 'ENCOMIENDAS' | 'AMBOS'
  fechaInicio?: string
  fechaFin?: string
  activa: boolean
  vigente: boolean
  limiteUsos?: number
  usosActuales: number
  agenciaId?: number
  creadoEn?: string
}

export interface PromocionRequestDTO {
  nombre: string
  descripcion?: string
  codigo?: string
  tipoDescuento: string
  valor: number
  aplicaA: string
  fechaInicio?: string
  fechaFin?: string
  activa?: boolean
  limiteUsos?: number
}

interface ApiResponse<T> { success: boolean; message: string; data: T }

export const promocionesService = {
  getAll: () =>
    api.get<any, ApiResponse<PromocionDTO[]>>('/api/promociones').then(r => r.data),

  getVigentes: (aplicaA?: string) =>
    api.get<any, ApiResponse<PromocionDTO[]>>('/api/promociones/vigentes', {
      params: aplicaA ? { aplicaA } : undefined,
    }).then(r => r.data),

  validarCodigo: (codigo: string, aplicaA?: string) =>
    api.post<any, ApiResponse<PromocionDTO>>('/api/promociones/validar-codigo', {
      codigo, aplicaA,
    }).then(r => r.data),

  crear: (dto: PromocionRequestDTO) =>
    api.post<any, ApiResponse<PromocionDTO>>('/api/promociones', dto).then(r => r.data),

  actualizar: (id: number, dto: PromocionRequestDTO) =>
    api.put<any, ApiResponse<PromocionDTO>>(`/api/promociones/${id}`, dto).then(r => r.data),

  toggle: (id: number) =>
    api.patch<any, ApiResponse<void>>(`/api/promociones/${id}/toggle`).then(r => r.data),

  eliminar: (id: number) =>
    api.delete<any, ApiResponse<void>>(`/api/promociones/${id}`).then(r => r.data),
}
