export enum RolUsuario {
  SUPER_ADMIN = 'SUPER_ADMIN',
  GERENTE = 'GERENTE',
  ADMINISTRADOR = 'ADMINISTRADOR',
  SUPERVISOR = 'SUPERVISOR',
  OPERADOR = 'OPERADOR',
  CONDUCTOR = 'CONDUCTOR',
}

export enum EstadoEncomienda {
  REGISTRADO = 'REGISTRADO',
  EN_TRANSITO = 'EN_TRANSITO',
  ENTREGADO = 'ENTREGADO',
  DEVUELTO = 'DEVUELTO',
  PERDIDO = 'PERDIDO',
}

export enum TipoVehiculo {
  COMBI = 'COMBI',
  CAMIONETA = 'CAMIONETA',
  BUS = 'BUS',
  MINIVAN = 'MINIVAN',
}

export enum EstadoCaja {
  ABIERTA = 'ABIERTA',
  CERRADA = 'CERRADA',
}

export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
  errors?: string[]
  timestamp: string
}

export interface LoginResponse {
  token: string
  refreshToken: string
  tipo: string
  expiresIn: number
  usuario: {
    id: number
    nombre: string
    email: string
    rol: string
    agenciaId: number
    permisos: string[]
  }
}

export interface Usuario {
  id: number
  agenciaId: number
  nombres: string
  apellidos: string
  email: string
  dni: string
  activo: boolean
  roles: Role[]
  createdAt: string
  ultimoAcceso?: string
}

export interface Role {
  id: number
  nombre: string
  descripcion?: string
}

export interface Agencia {
  id: number
  codigo: string
  nombre: string
  direccion?: string
  ciudad: string
  departamento?: string
  telefono?: string
  email?: string
  ruc?: string
  activo: boolean
}

export interface Ruta {
  id: number
  agenciaId: number
  codigo: string
  origen: string
  destino: string
  distanciaKm: number
  duracionMin: number
  activo: boolean
}

export interface Vehiculo {
  id: number
  agenciaId: number
  placa: string
  tipo: TipoVehiculo
  marca: string
  modelo: string
  capacidad: number
  numAsientos: number
  estado: string
}

export interface Viaje {
  id: number
  agenciaId: number
  rutaId: number
  vehiculoId: number
  conductorId: number
  fechaHoraSal: string
  fechaHoraArr?: string
  estado: 'PROGRAMADO' | 'EN_RUTA' | 'COMPLETADO' | 'CANCELADO'
  ruta?: Ruta
  vehiculo?: Vehiculo
}

export interface Asiento {
  id: number
  viajeId: number
  numero: number
  estado: 'DISPONIBLE' | 'RESERVADO' | 'VENDIDO' | 'BLOQUEADO'
}

export interface Cliente {
  id: number
  agenciaId: number
  nombres: string
  apellidos: string
  tipoDoc: string
  numDoc: string
  telefono?: string
  email?: string
}

export interface Pasaje {
  id: number
  agenciaId: number
  viajeId: number
  asientoId: number
  clienteId: number
  precioBase: number
  montoDescuento: number
  precioFinal: number
  estado: string
  codigoPasaje?: string
  fechaEmision: string
}

export interface Encomienda {
  id: number
  agenciaId: number
  agenciaDestinoId?: number
  codigoTracking: string
  remitenteId: number
  destinatarioId: number
  viajeId?: number
  descripcion: string
  tamano?: 'PEQUEÑO' | 'MEDIANO' | 'GRANDE'
  pesoKg?: number
  precioEnvio: number
  estado: EstadoEncomienda
  serie?: string
  correlativo?: string
  fechaRegistro: string
  fechaEntregaEst?: string
  fechaEntregaReal?: string
  observaciones?: string
}

export interface HistorialEncomienda {
  id: number
  encomiendaId: number
  estadoAnterior?: string
  estadoNuevo: string
  usuarioId: number
  observacion?: string
  createdAt: string
}

export interface Caja {
  id: number
  agenciaId: number
  usuarioId: number
  fechaApertura: string
  fechaCierre?: string
  montoApertura: number
  totalIngresos: number
  totalEgresos: number
  montoCierre?: number
  diferencia?: number
  estado: EstadoCaja
}

export interface MovimientoCaja {
  id: number
  cajaId: number
  tipo: 'INGRESO' | 'EGRESO'
  concepto: string
  monto: number
  saldoAcumulado: number
  createdAt: string
}

export interface Auditoria {
  id: number
  agenciaId: number
  usuarioId?: number
  usuarioNombre?: string
  accion: string
  modulo: string
  entidad?: string
  registroId?: number
  datosAntes?: string
  datosDespues?: string
  ip?: string
  fecha: string
}

export interface AsientoUpdate {
  viajeId: number
  asientoNumero: number
  estado: string
  timestamp: string
}

export interface EstadoEncomiendaWS {
  codigoTracking: string
  estadoAnterior: string
  estadoNuevo: string
  observacion?: string
  usuario: string
  timestamp: string
}
