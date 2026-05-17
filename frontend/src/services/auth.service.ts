import api from './api'
import { ApiResponse, LoginResponse } from '@/types'

export const authService = {
  login: (email: string, password: string) =>
    api.post<any, ApiResponse<LoginResponse>>('/api/auth/login', { email, password }),

  refreshToken: (token: string) =>
    api.post<any, ApiResponse<LoginResponse>>('/api/auth/refresh', null, {
      headers: { 'X-Refresh-Token': token },
    }),

  logout: () =>
    api.post<any, ApiResponse<null>>('/api/auth/logout'),

  getMe: () =>
    api.get<any, ApiResponse<any>>('/api/auth/me'),
}
