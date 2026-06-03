import api from './api'

export interface ManifiestoResumen {
  id: number
  agenciaId: number
  viajeId: number
  generadoPor: number
  numero: string
  estado: 'BORRADOR' | 'EMITIDO' | 'ENVIADO'
  totalPasajeros: number
  totalEncomiendas: number
  createdAt: string
}

export interface PasajeroItem {
  item: number
  pasajeId: number
  correlativo: string
  nombres: string
  apellidos: string
  tipoDoc: string
  numDoc: string
  numAsiento: number
  precioFinal: number
  formaPago: string
  estadoPasaje: string
}

export interface EncomiendaItem {
  item: number
  encomiendaId: number
  codigoTracking: string
  descripcion: string
  pesoKg: number | null
  numBultos: number | null
  precioEnvio: number
  formaCobro: string
  estado: string
  remitente: string
  destinatario: string
}

export interface ManifiestoDetalle {
  viajeId: number
  estado: string
  fechaHoraSal: string
  fechaHoraArr?: string
  rutaOrigen: string
  rutaDestino: string
  distanciaKm?: number
  vehiculoPlaca: string
  vehiculoTipo: string
  vehiculoAsientos?: number
  conductorNombre?: string
  conductorLicencia?: string
  agenciaNombre: string
  agenciaDireccion?: string
  agenciaRuc?: string
  pasajeros: PasajeroItem[]
  totalPasajeros: number
  totalRecaudado: number
  encomiendas: EncomiendaItem[]
  totalEncomiendas: number
  totalMontoEncomiendas: number
}

export interface ManifiestoViaje {
  datos: ManifiestoDetalle
  manifiesto: ManifiestoResumen | null
}

// Interceptor returns response.data (ApiResponse). Base unwraps ApiResponse.data.
const base = (r: any) => (r as any).data

export const manifiestoService = {
  lista: (): Promise<ManifiestoResumen[]> =>
    api.get('/api/manifiestos').then(r => base(r) as ManifiestoResumen[]),

  getDatos: (viajeId: number): Promise<ManifiestoDetalle> =>
    api.get(`/api/manifiestos/${viajeId}/datos`).then(r => base(r) as ManifiestoDetalle),

  getPorViaje: (viajeId: number): Promise<ManifiestoViaje> =>
    api.get(`/api/manifiestos/viaje/${viajeId}`).then(r => base(r) as ManifiestoViaje),

  generar: (viajeId: number): Promise<ManifiestoResumen> =>
    api.post(`/api/manifiestos/generar/${viajeId}`).then(r => base(r) as ManifiestoResumen),

  guardar: (viajeId: number, estado?: string): Promise<ManifiestoResumen> =>
    api.post(`/api/manifiestos/${viajeId}/guardar`, estado ? { estado } : {})
       .then(r => base(r) as ManifiestoResumen),

  cambiarEstado: (id: number, estado: string): Promise<ManifiestoResumen> =>
    api.patch(`/api/manifiestos/${id}/estado`, { estado })
       .then(r => base(r) as ManifiestoResumen),

  descargarPdf: async (viajeId: number): Promise<Blob> => {
    const res = await api.get(`/api/manifiestos/${viajeId}/pdf`, { responseType: 'blob' })
    return res as unknown as Blob
  },

  descargarPdfEncomiendas: async (viajeId: number): Promise<Blob> => {
    const res = await api.get(`/api/manifiestos/${viajeId}/pdf/encomiendas`, { responseType: 'blob' })
    return res as unknown as Blob
  },

  descargarTicket: async (pasajeId: number): Promise<Blob> => {
    const res = await api.get(`/api/manifiestos/ticket/${pasajeId}/pdf`, { responseType: 'blob' })
    return res as unknown as Blob
  },
}
