import api from './api'
import { Cliente } from '@/types'

export type { Cliente }

export interface ClienteDTO {
  nombres: string
  apellidos: string
  tipoDoc: string
  numDoc: string
  telefono?: string
  email?: string
  fechaNac?: string
}

export const clientesService = {
  listar: (q?: string) =>
    api.get<any, any>('/api/clientes', { params: q ? { q } : undefined }).then((r: any) => r.data as Cliente[]),

  buscarPorDoc: (tipoDoc: string, numDoc: string) =>
    api.get<any, any>('/api/clientes/buscar', { params: { tipoDoc, numDoc } }).then((r: any) => r.data as Cliente),

  crear: (dto: ClienteDTO) =>
    api.post<any, any>('/api/clientes', dto).then((r: any) => r.data as Cliente),

  actualizar: (id: number, dto: ClienteDTO) =>
    api.put<any, any>(`/api/clientes/${id}`, dto).then((r: any) => r.data as Cliente),

  detalle: (id: number) =>
    api.get<any, any>(`/api/clientes/${id}`).then((r: any) => r.data as Cliente),
}
