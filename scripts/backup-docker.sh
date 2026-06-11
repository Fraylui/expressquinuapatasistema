#!/bin/sh
# Backup PostgreSQL — corre dentro del contenedor de backup (postgres:15-alpine)
# Se conecta directamente al servicio 'postgres' de la red Docker.
set -e

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="/backups/quinuapata_${TIMESTAMP}.sql.gz"

PGPASSWORD="$DB_PASSWORD" pg_dump \
    -h postgres \
    -U "$DB_USER" \
    --no-owner \
    --no-acl \
    "$DB_NAME" \
  | gzip > "$FILENAME"

if [ ! -s "$FILENAME" ] || ! gzip -t "$FILENAME" 2>/dev/null; then
    echo "[ERROR] Backup inválido o vacío — eliminando." >&2
    rm -f "$FILENAME"
    exit 1
fi

SIZE=$(du -sh "$FILENAME" | cut -f1)
echo "[OK] $FILENAME ($SIZE)"

# Rotación: eliminar backups más viejos que BACKUP_RETENTION_DAYS días
find /backups -name "quinuapata_*.sql.gz" -mtime "+${BACKUP_RETENTION_DAYS:-30}" -delete
