import { redirect } from 'next/navigation'

// Redirige /dashboard → / (tablero principal)
export default function DashboardRedirect() {
  redirect('/')
}
