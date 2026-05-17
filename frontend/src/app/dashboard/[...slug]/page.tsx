import { redirect } from 'next/navigation'

// Redirige /dashboard/cualquier-ruta → /cualquier-ruta
export default function DashboardSlugRedirect({
  params,
}: {
  params: { slug: string[] }
}) {
  redirect('/' + params.slug.join('/'))
}
