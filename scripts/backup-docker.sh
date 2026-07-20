#!/bin/sh
# Backup PostgreSQL — corre dentro del contenedor de backup (postgres:15-alpine)
# Se conecta directamente al servicio 'postgres' de la red Docker.
# PGPASSWORD ya viene en el entorno del contenedor (docker-compose lo inyecta
# desde DB_PASSWORD del .env) — no sobreescribirla aquí.
set -e

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="/backups/quinuapata_${TIMESTAMP}.sql.gz"

pg_dump \
    -h postgres \
    -U "$DB_USER" \
    --no-owner \
    --no-acl \
    "$DB_NAME" \
  | gzip > "$FILENAME"

# Un gzip puede ser "válido" pero estar vacío si pg_dump falló dentro del
# pipeline: exigir que el dump descomprimido tenga contenido real.
if ! gzip -t "$FILENAME" 2>/dev/null || [ "$(gzip -cd "$FILENAME" | head -c 1 | wc -c)" -eq 0 ]; then
    echo "[ERROR] Backup inválido o vacío — eliminando." >&2
    rm -f "$FILENAME"
    exit 1
fi

SIZE=$(du -sh "$FILENAME" | cut -f1)
echo "[OK] $FILENAME ($SIZE)"

# Rotación: eliminar backups más viejos que BACKUP_RETENTION_DAYS días
find /backups -name "quinuapata_*.sql.gz" -mtime "+${BACKUP_RETENTION_DAYS:-30}" -delete
