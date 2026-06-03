import api from './api'
import { ApiResponse, MovimientoCaja } from '@/types'

export interface TurnoActual {
  id: number
  agenciaId: number
  agenciaNombre: string
  usuarioId: number
  operadorNombre: string
  fechaApertura: string
  fechaCierre?: string
  montoApertura: number
  totalIngresos: number
  totalEgresos: number
  montoCierre?: number
  diferencia?: number
  saldoActual?: number
  estado: string
  observaciones?: string
  cantPasajes: number
  montoPasajes: number
  cantEncomiendas: number
  montoEncomiendas: number
  cantPagoDestino: number
  montoPagoDestino: number
}

export const cajaService = {
  abrir: (montoInicial: number) =>
    api.post<any, ApiResponse<any>>('/api/caja/abrir', { montoInicial }),

  egreso: (concepto: string, monto: number) =>
    api.post<any, ApiResponse<MovimientoCaja>>('/api/caja/egreso', { concepto, monto }),

  ingreso: (concepto: string, monto: number) =>
    api.post<any, ApiResponse<MovimientoCaja>>('/api/caja/ingreso', { concepto, monto }),

  registrarMovimiento: (dto: {
    cajaId: number
    tipo: 'INGRESO' | 'EGRESO'
    concepto: string
    monto: number
    referenciaTipo?: string
    referenciaId?: number
  }) => api.post<any, ApiResponse<MovimientoCaja>>('/api/caja/movimiento', dto),

  cerrar: (montoFisico: number, observacion?: string) =>
    api.post<any, ApiResponse<TurnoActual>>('/api/caja/cerrar', { montoFisico, observacion }),

  getTurnoActual: () =>
    api.get<any, ApiResponse<TurnoActual | null>>('/api/caja/turno-actual'),

  getMovimientos: () =>
    api.get<any, ApiResponse<MovimientoCaja[]>>('/api/caja/movimientos'),

  getMovimientosByCaja: (cajaId: number) =>
    api.get<any, ApiResponse<MovimientoCaja[]>>(`/api/caja/movimientos/${cajaId}`),

  getHistorial: (params?: { agencia?: number; usuario?: number; page?: number }) =>
    api.get<any, ApiResponse<TurnoActual[]>>('/api/caja/historial', { params }),

  getReportePDF: async (cajaId: number): Promise<Blob> => {
    const response = await api.get(`/api/caja/${cajaId}/reporte`, { responseType: 'blob' })
    return response as unknown as Blob
  },
}
