export enum RolUsuario {
  SUPER_ADMIN = 'SUPER_ADMIN',
  GERENTE = 'GERENTE',
  ADMINISTRADOR = 'ADMINISTRADOR',
  SUPERVISOR = 'SUPERVISOR',
  OPERADOR = 'OPERADOR',
  CONDUCTOR = 'CONDUCTOR',
}

export enum EstadoEncomienda {
  REGISTRADO      = 'REGISTRADO',
  RECEPCIONADO    = 'RECEPCIONADO',
  ALMACENADO      = 'ALMACENADO',
  CARGADO         = 'CARGADO',
  EN_TRANSITO     = 'EN_TRANSITO',
  LLEGADO_AGENCIA = 'LLEGADO_AGENCIA',
  DISPONIBLE      = 'DISPONIBLE',
  ENTREGADO       = 'ENTREGADO',
  OBSERVADO       = 'OBSERVADO',
  DEVUELTO        = 'DEVUELTO',
}

export enum TipoVehiculo {
  COMBI = 'COMBI',
  CAMIONETA = 'CAMIONETA',
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
  ciudad: string
  direccion: string
  telefono: string
  email?: string
  ruc?: string
  encargadoId?: number
  encargadoNombre?: string
  estado: string
  esSedePrincipal: boolean
  tipo: 'AGENCIA' | 'SUCURSAL'
  agenciaPadreId?: number
  agenciaPadreNombre?: string
  sucursales?: Agencia[]
  fechaApertura?: string
  fechaRegistro?: string
  // legacy
  departamento?: string
  activo?: boolean
}

export interface AgenciaMetricas {
  totalViajesMes: number
  totalPasajesMes: number
  totalEncomiendaMes: number
  totalIngresosMes: number
  usuariosActivos: number
}

export interface UsuarioSimple {
  id: number
  agenciaId: number
  nombres: string
  apellidos: string
  email: string
  rol: string
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
  estado: 'LIBRE' | 'OCUPADO' | 'RESERVADO'
}

export interface Cliente {
  id: number
  agenciaId: number
  tipo?: 'PERSONA' | 'EMPRESA'
  razonSocial?: string
  nombres: string
  apellidos: string
  tipoDoc: string
  numDoc: string
  dni?: string
  telefono?: string
  email?: string
  direccion?: string
  fechaNac?: string
  fechaRegistro?: string
  createdAt?: string
}

export interface Pasaje {
  id: number
  agenciaId: number
  viajeId: number
  asientoNumero: number
  clienteId: number
  clienteNombres?: string
  clienteApellidos?: string
  clienteDni?: string
  precioBase: number
  descuento: number
  precioFinal: number
  formaPago: string
  estado: 'VENDIDO' | 'ANULADO' | 'RESERVADO'
  codigoBoleta: string
  motivoDescuento?: string
  motivoAnulacion?: string
  fechaVenta: string
  fechaAnulacion?: string
}

export interface Encomienda {
  id: number
  agenciaId: number
  agenciaOrigenId?: number
  agenciaDestinoId?: number
  codigoTracking: string
  remitenteId: number
  destinatarioId: number
  viajeId?: number
  vendedorId?: number
  descripcion: string
  pesoKg?: number
  monto?: number
  precioEnvio: number
  formaCobro?: string
  estado: EstadoEncomienda
  serie?: string
  correlativo?: string
  fechaRegistro: string
  fechaEntregaEst?: string
  fechaEntregaReal?: string
  recibidoPorDni?: string
  recibidoPorNombre?: string
  observaciones?: string
  // enriched by backend
  remitenteNombre?: string
  remitenteDoc?: string
  remitenteTel?: string
  destinatarioNombre?: string
  destinatarioDoc?: string
  destinatarioTel?: string
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
  agenciaId: number
  usuarioId: number
  tipo: 'INGRESO' | 'EGRESO'
  concepto: string
  monto: number
  saldoAcumulado: number
  referenciaTipo?: string
  referenciaId?: number
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
  userAgent?: string
  fecha: string
  detalle?: string
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
