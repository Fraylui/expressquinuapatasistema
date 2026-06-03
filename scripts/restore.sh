#!/bin/bash
# =============================================================
# Restaurar backup PostgreSQL — Express Quinuapata VRAEM SAC
# =============================================================
# Uso:
#   bash scripts/restore.sh                        — muestra los backups disponibles
#   bash scripts/restore.sh backups/quinuapata_X.sql.gz
#
# ADVERTENCIA: Este script reemplaza TODA la base de datos.
#              Haz un backup previo si hay datos recientes.
# =============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# ── Cargar .env ───────────────────────────────────────────────
ENV_FILE="$PROJECT_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo "[ERROR] No se encontró $ENV_FILE" >&2; exit 1
fi
set -a; source "$ENV_FILE"; set +a

CONTAINER="${POSTGRES_CONTAINER:-expressvraem_postgres}"
DB_NAME="${DB_NAME:?DB_NAME no está definida en .env}"
DB_USER="${DB_USER:?DB_USER no está definida en .env}"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"

# ── Sin argumento: listar backups disponibles ─────────────────
if [ $# -eq 0 ]; then
    echo "============================================================"
    echo " Backups disponibles en $BACKUP_DIR:"
    echo "============================================================"
    if ls "$BACKUP_DIR"/quinuapata_*.sql.gz 2>/dev/null | head -20; then
        echo ""
        echo "Uso: bash scripts/restore.sh <ruta-del-archivo>"
    else
        echo " (no hay backups en $BACKUP_DIR)"
    fi
    exit 0
fi

BACKUP_FILE="$1"

# Soporte para ruta relativa desde el proyecto
if [ ! -f "$BACKUP_FILE" ]; then
    BACKUP_FILE="$PROJECT_DIR/$1"
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "[ERROR] Archivo no encontrado: $1" >&2; exit 1
fi

# ── Verificar integridad antes de restaurar ───────────────────
echo "============================================================"
echo " Restaurando backup — Express Quinuapata VRAEM"
echo " Archivo : $BACKUP_FILE"
echo " DB      : $DB_NAME"
echo " $(date)"
echo "============================================================"
echo ""
echo " ADVERTENCIA: Esta operación REEMPLAZARÁ todos los datos actuales."
echo " ¿Estás seguro? Escribe 'SI' para continuar:"
read -r CONFIRM
if [ "$CONFIRM" != "SI" ]; then
    echo "Operación cancelada."; exit 0
fi

echo ""
echo "[1/4] Verificando integridad del archivo..."
if ! gzip -t "$BACKUP_FILE" 2>/dev/null; then
    echo "[ERROR] El archivo está corrupto." >&2; exit 1
fi
echo "      OK"

# ── Verificar que postgres esté corriendo ─────────────────────
echo "[2/4] Verificando conexión a PostgreSQL..."
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    echo "[ERROR] El contenedor $CONTAINER no está corriendo." >&2; exit 1
fi
echo "      OK"

# ── Detener backend y frontend para evitar escrituras ─────────
echo "[3/4] Deteniendo backend y frontend temporalmente..."
docker compose -f "$PROJECT_DIR/docker-compose.yml" stop backend frontend 2>/dev/null || true

# ── Restaurar ─────────────────────────────────────────────────
echo "[4/4] Restaurando base de datos..."

# Terminar conexiones activas
docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DB_NAME' AND pid <> pg_backend_pid();" \
    >/dev/null 2>&1 || true

# Drop y recrear la base de datos
docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$DB_NAME\";" >/dev/null
docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres -c "CREATE DATABASE \"$DB_NAME\";" >/dev/null

# Restaurar el dump
zcat "$BACKUP_FILE" | docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -q

echo ""
echo "      Restauración completada."

# ── Reiniciar servicios ───────────────────────────────────────
echo ""
echo " Reiniciando servicios..."
docker compose -f "$PROJECT_DIR/docker-compose.yml" start backend frontend 2>/dev/null || \
    docker compose -f "$PROJECT_DIR/docker-compose.yml" up -d 2>/dev/null

echo ""
echo "============================================================"
echo " Restauración exitosa: $(date)"
echo " Backup restaurado: $(basename "$BACKUP_FILE")"
echo "============================================================"
