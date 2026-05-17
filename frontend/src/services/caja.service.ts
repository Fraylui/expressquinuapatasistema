import api from './api'
import { ApiResponse, Caja, MovimientoCaja } from '@/types'

export const cajaService = {
  abrir: (montoInicial: number) =>
    api.post<any, ApiResponse<Caja>>('/api/caja/abrir', { montoInicial }),

  registrarMovimiento: (dto: {
    cajaId: number
    tipo: 'INGRESO' | 'EGRESO'
    concepto: string
    monto: number
    referenciaTipo?: string
    referenciaId?: number
  }) => api.post<any, ApiResponse<MovimientoCaja>>('/api/caja/movimiento', dto),

  cerrar: (cajaId: number, montoFisico: number, observaciones?: string) =>
    api.post<any, ApiResponse<Caja>>('/api/caja/cerrar', { cajaId, montoFisico, observaciones }),

  getTurnoActual: () =>
    api.get<any, ApiResponse<any>>('/api/caja/turno-actual'),

  getMovimientos: (cajaId: number) =>
    api.get<any, ApiResponse<MovimientoCaja[]>>(`/api/caja/movimientos/${cajaId}`),
}
