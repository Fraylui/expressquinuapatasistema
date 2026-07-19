/** Utilidades de presentación compartidas */

/**
 * Nombre corto de una agencia para tablas y listas.
 * El API devuelve "Express Quinuapata VRAEM SAC — Huamanga — Ayacucho";
 * en una celda solo interesa "Huamanga — Ayacucho" (el prefijo de la
 * empresa se repite en todas las filas y obliga a truncar).
 */
export function nombreAgenciaCorto(nombre?: string | null): string {
  if (!nombre) return '—'
  const partes = nombre.split(' — ')
  return partes.length > 1 ? partes.slice(1).join(' — ') : nombre
}
