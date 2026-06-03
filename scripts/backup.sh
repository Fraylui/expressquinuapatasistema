#!/bin/bash
# =============================================================
# Backup PostgreSQL — Express Quinuapata VRAEM SAC
# =============================================================
# Uso:
#   bash scripts/backup.sh            — backup normal
#   bash scripts/backup.sh --verify   — backup + verificación extra
#
# Cron diario a las 2:00 AM:
#   0 2 * * * cd /app/expressvraem && bash scripts/backup.sh >> /var/log/expressvraem-backup.log 2>&1
# =============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# ── Cargar .env ───────────────────────────────────────────────
ENV_FILE="$PROJECT_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo "[ERROR] No se encontró $ENV_FILE — abortando backup." >&2
    exit 1
fi
set -a; source "$ENV_FILE"; set +a

# ── Configuración ─────────────────────────────────────────────
CONTAINER="${POSTGRES_CONTAINER:-expressvraem_postgres}"
DB_NAME="${DB_NAME:?DB_NAME no está definida en .env}"
DB_USER="${DB_USER:?DB_USER no está definida en .env}"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="$BACKUP_DIR/quinuapata_${TIMESTAMP}.sql.gz"
VERIFY="${1:-}"

mkdir -p "$BACKUP_DIR"

echo "============================================================"
echo " Backup Express Quinuapata VRAEM — $(date)"
echo " DB: $DB_NAME | Destino: $FILENAME"
echo "============================================================"

# ── Verificar que postgres esté corriendo ─────────────────────
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    echo "[ERROR] El contenedor $CONTAINER no está corriendo." >&2
    exit 1
fi

# ── Ejecutar pg_dump ──────────────────────────────────────────
echo "[1/4] Ejecutando pg_dump..."
docker exec "$CONTAINER" pg_dump \
    --no-password \
    --format=plain \
    --no-owner \
    --no-acl \
    -U "$DB_USER" \
    "$DB_NAME" \
  | gzip > "$FILENAME"

# ── Verificar que el archivo no está vacío ni corrupto ────────
echo "[2/4] Verificando integridad..."
if [ ! -s "$FILENAME" ]; then
    echo "[ERROR] El archivo de backup está vacío." >&2
    rm -f "$FILENAME"
    exit 1
fi

if ! gzip -t "$FILENAME" 2>/dev/null; then
    echo "[ERROR] El archivo de backup está corrupto." >&2
    rm -f "$FILENAME"
    exit 1
fi

# Verificación extra: el dump debe contener al menos la tabla pasajes
if [ "$VERIFY" = "--verify" ]; then
    echo "[2/4] Verificación profunda del contenido..."
    if ! zcat "$FILENAME" | grep -q "CREATE TABLE\|-- PostgreSQL"; then
        echo "[ERROR] El backup no parece contener datos SQL válidos." >&2
        rm -f "$FILENAME"
        exit 1
    fi
fi

SIZE=$(du -sh "$FILENAME" | cut -f1)
echo "[2/4] Backup verificado — tamaño: $SIZE"

# ── Copia offsite opcional (rclone / rsync) ───────────────────
echo "[3/4] Copia offsite..."
if command -v rclone &>/dev/null && [ -n "${RCLONE_REMOTE:-}" ]; then
    rclone copy "$FILENAME" "${RCLONE_REMOTE}/backups/" --quiet
    echo "      Copiado a $RCLONE_REMOTE"
elif [ -n "${BACKUP_RSYNC_DEST:-}" ]; then
    rsync -az "$FILENAME" "$BACKUP_RSYNC_DEST/"
    echo "      Sincronizado con $BACKUP_RSYNC_DEST"
else
    echo "      (sin destino offsite configurado — solo local)"
fi

# ── Rotación: eliminar backups viejos ─────────────────────────
echo "[4/4] Rotación de backups (retención: ${RETENTION_DAYS} días)..."
find "$BACKUP_DIR" -name "quinuapata_*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete
TOTAL=$(find "$BACKUP_DIR" -name "quinuapata_*.sql.gz" | wc -l)
echo "      Backups conservados: $TOTAL"

echo ""
echo "============================================================"
echo " Backup completado exitosamente: $(date)"
echo " Archivo: $FILENAME ($SIZE)"
echo "============================================================"
