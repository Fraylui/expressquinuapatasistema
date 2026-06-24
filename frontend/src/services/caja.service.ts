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
  cantExternas: number
  montoExternas: number
  cantCuotasCombi: number
  montoCuotasCombi: number
}

// ── Rendiciones (entregas de efectivo a gerencia) ────────────────────────────
export interface EntregaEfectivo {
  id: number
  numero: string
  agenciaId: number
  agenciaNombre: string
  entregaNombre: string
  confirmaNombre?: string | null
  modalidad: 'ENTREGA_DIRECTA' | 'DEPOSITO_BANCARIO'
  nroOperacion?: string | null
  montoDeclarado: number
  montoConfirmado?: number | null
  diferencia?: number | null
  estado: 'PENDIENTE' | 'CONFIRMADA' | 'OBSERVADA' | 'ANULADA'
  observaciones?: string | null
  obsConfirmacion?: string | null
  fechaEntrega: string
  fechaConfirmacion?: string | null
}

export interface ResumenRendicion {
  agenciaId: number
  agenciaNombre?: string
  totalCierres: number
  totalEntregado: number
  pendienteRendir: number
  ultimaEntrega?: string | null
  diasSinRendir?: number | null
  enAlerta: boolean
  umbralMonto: number
  umbralDias: number
  entregasEnTransito?: number
  montoEnTransito?: number
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

  // ── Rendiciones ──
  declararEntrega: (dto: {
    monto: number
    modalidad: 'ENTREGA_DIRECTA' | 'DEPOSITO_BANCARIO'
    nroOperacion?: string
    observaciones?: string
  }) => api.post<any, ApiResponse<EntregaEfectivo>>('/api/caja/entregas', dto),

  confirmarEntrega: (id: number, montoConfirmado: number, observacion?: string) =>
    api.patch<any, ApiResponse<EntregaEfectivo>>(`/api/caja/entregas/${id}/confirmar`,
      { montoConfirmado, observacion }),

  anularEntrega: (id: number, motivo: string) =>
    api.patch<any, ApiResponse<EntregaEfectivo>>(`/api/caja/entregas/${id}/anular`, { motivo }),

  getEntregas: (agencia?: number) =>
    api.get<any, ApiResponse<EntregaEfectivo[]>>('/api/caja/entregas', { params: { agencia } }),

  getResumenRendicion: (agencia?: number) =>
    api.get<any, ApiResponse<ResumenRendicion>>('/api/caja/entregas/resumen-agencia', { params: { agencia } }),

  getPendientePorAgencia: () =>
    api.get<any, ApiResponse<ResumenRendicion[]>>('/api/caja/entregas/pendiente-por-agencia'),

  getComprobanteEntregaPDF: async (id: number): Promise<Blob> => {
    const response = await api.get(`/api/caja/entregas/${id}/comprobante`, { responseType: 'blob' })
    return response as unknown as Blob
  },
}
