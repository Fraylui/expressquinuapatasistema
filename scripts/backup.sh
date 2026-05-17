#!/bin/bash
# Backup automático PostgreSQL — Express Quinuapata VRAEM SAC
# Cron sugerido: 0 2 * * * /app/scripts/backup.sh >> /var/log/backup.log 2>&1

set -euo pipefail

BACKUP_DIR="/app/backups"
CONTAINER="expressvraem_postgres"
DB_NAME="${DB_NAME:-quinuapata_pdn}"
DB_USER="${DB_USER:-expressadmin_pdn}"
RETENTION_DAYS=30

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="$BACKUP_DIR/quinuapata_${TIMESTAMP}.sql.gz"

echo "[$(date)] Iniciando backup de $DB_NAME..."

docker exec "$CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" \
  | gzip > "$FILENAME"

SIZE=$(du -sh "$FILENAME" | cut -f1)
echo "[$(date)] Backup completado: $FILENAME ($SIZE)"

# Eliminar backups con más de RETENTION_DAYS días
find "$BACKUP_DIR" -name "quinuapata_*.sql.gz" -mtime "+$RETENTION_DAYS" -delete
DELETED=$(find "$BACKUP_DIR" -name "quinuapata_*.sql.gz" | wc -l)
echo "[$(date)] Backups actuales conservados: $DELETED"
