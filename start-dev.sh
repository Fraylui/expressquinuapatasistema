#!/bin/bash
set -e

echo "=================================================="
echo "  Express Quinuapata VRAEM SAC — Dev Environment"
echo "=================================================="

# Verifica .env
if [ ! -f .env ]; then
  echo "[INFO] Copiando .env.example → .env"
  cp .env.example .env
  echo "[WARN] Revise el archivo .env antes de continuar"
fi

# Verifica Docker
if ! docker info > /dev/null 2>&1; then
  echo "[ERROR] Docker no está en ejecución. Inicie Docker Desktop y vuelva a intentar."
  exit 1
fi

echo "[INFO] Iniciando servicios de desarrollo..."
docker compose -f docker-compose.dev.yml up --build

echo ""
echo "=================================================="
echo "  Servicios disponibles:"
echo "  Frontend:  http://localhost:3000"
echo "  Backend:   http://localhost:8080"
echo "  Postgres:  localhost:5432"
echo "  Tracking:  http://localhost:3000/tracking"
echo "=================================================="
