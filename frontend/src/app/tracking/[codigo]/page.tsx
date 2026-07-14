'use client'
import { useParams } from 'next/navigation'
import TrackingView from '../TrackingView'

/** Ruta del QR de los comprobantes: /tracking/EXP-2026-00001 → busca solo. */
export default function TrackingByCodigoPage() {
  const params = useParams<{ codigo: string }>()
  const codigo = decodeURIComponent(String(params?.codigo ?? ''))
  return <TrackingView initialCodigo={codigo} />
}
