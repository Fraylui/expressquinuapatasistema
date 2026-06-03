#!/bin/bash
# Script de despliegue en producción — Express Quinuapata VRAEM SAC
# Uso:
#   ./scripts/deploy.sh          — con SSL (requiere dominio configurado)
#   ./scripts/deploy.sh --http   — sin SSL, solo HTTP (usar con IP directa)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
MODE="${1:-}"

cd "$PROJECT_DIR"

echo "=============================================="
echo " Express Quinuapata VRAEM — Deploy Producción"
echo " Modo: ${MODE:-SSL}"
echo " $(date)"
echo "=============================================="

# ── Verificar que existe .env ─────────────────────────────────
if [ ! -f ".env" ]; then
    echo "ERROR: No se encontró el archivo .env"
    echo "Copia .env.production como .env y completa los valores."
    exit 1
fi

set -a; source .env; set +a

# ── Validar variables críticas ────────────────────────────────
for VAR in DB_NAME DB_USER DB_PASSWORD JWT_SECRET NEXT_PUBLIC_API_URL; do
    VALUE="${!VAR:-}"
    if [ -z "$VALUE" ] || [[ "$VALUE" == *"<CAMBIAR"* ]]; then
        echo "ERROR: Variable $VAR no configurada o con valor de plantilla."
        exit 1
    fi
done

# ── Determinar compose file ───────────────────────────────────
if [ "$MODE" = "--http" ]; then
    COMPOSE_FILE="-f docker-compose.yml -f docker-compose.http.yml"
    echo " Usando nginx HTTP-only (sin SSL)"
else
    COMPOSE_FILE=""
    echo " Usando nginx con SSL/TLS"
fi

# ── Paso 1: Backup ────────────────────────────────────────────
echo ""
echo "[1/5] Backup de base de datos antes de actualizar..."
if docker ps --format '{{.Names}}' | grep -q "expressvraem_postgres"; then
    bash "$SCRIPT_DIR/backup.sh"
else
    echo "  Postgres no está corriendo — omitiendo backup."
fi

# ── Paso 2: Build ─────────────────────────────────────────────
echo ""
echo "[2/5] Construyendo imágenes..."
docker compose $COMPOSE_FILE build --no-cache

# ── Paso 3: Detener ───────────────────────────────────────────
echo ""
echo "[3/5] Deteniendo servicios anteriores..."
docker compose $COMPOSE_FILE down --remove-orphans

# ── Paso 4: Arrancar ──────────────────────────────────────────
echo ""
echo "[4/5] Iniciando servicios..."
docker compose $COMPOSE_FILE up -d

# ── Paso 5: Health check ──────────────────────────────────────
echo ""
echo "[5/5] Verificando estado..."
sleep 15
docker compose $COMPOSE_FILE ps

echo ""
echo "Esperando que el backend esté listo (hasta 2 minutos)..."
for i in $(seq 1 12); do
    STATUS=$(curl -sf http://localhost/actuator/health 2>/dev/null | grep -o '"status":"[^"]*"' || echo "")
    if [ "$STATUS" = '"status":"UP"' ]; then
        echo "  Backend UP después de $((i * 10)) segundos"
        break
    fi
    echo "  Esperando backend... ($i/12)"
    sleep 10
done

echo ""
echo "=============================================="
echo " Deploy completado: $(date)"
echo " URL: ${NEXT_PUBLIC_API_URL}"
echo "=============================================="
