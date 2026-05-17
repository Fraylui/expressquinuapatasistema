#!/bin/bash
# Script de despliegue en producción — Express Quinuapata VRAEM SAC
# Uso: ./scripts/deploy.sh
# Requisitos: Docker, docker-compose, archivo .env en la raíz del proyecto

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "=============================================="
echo " Express Quinuapata VRAEM — Deploy Producción"
echo " $(date)"
echo "=============================================="

# Verificar que existe .env
if [ ! -f ".env" ]; then
    echo "ERROR: No se encontró el archivo .env"
    echo "Copia .env.production como .env y completa los valores."
    exit 1
fi

# Cargar variables para validar
set -a; source .env; set +a

# Validar variables críticas
for VAR in DB_NAME DB_USER DB_PASSWORD JWT_SECRET NEXT_PUBLIC_API_URL; do
    VALUE="${!VAR:-}"
    if [ -z "$VALUE" ] || [[ "$VALUE" == *"<CAMBIAR"* ]]; then
        echo "ERROR: Variable $VAR no configurada o con valor de plantilla."
        exit 1
    fi
done

echo "[1/5] Backup de base de datos antes de actualizar..."
if docker ps --format '{{.Names}}' | grep -q "expressvraem_postgres"; then
    bash "$SCRIPT_DIR/backup.sh"
else
    echo "  Postgres no está corriendo, omitiendo backup."
fi

echo "[2/5] Construyendo imágenes de producción..."
docker compose build --no-cache

echo "[3/5] Deteniendo servicios anteriores..."
docker compose down --remove-orphans

echo "[4/5] Iniciando servicios..."
docker compose up -d

echo "[5/5] Verificando estado..."
sleep 15
docker compose ps

echo ""
echo "Verificando health del backend..."
for i in $(seq 1 12); do
    STATUS=$(curl -sf http://localhost/actuator/health 2>/dev/null | grep -o '"status":"[^"]*"' || echo "")
    if [ "$STATUS" = '"status":"UP"' ]; then
        echo "Backend UP despues de ${i}0 segundos"
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
