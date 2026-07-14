#!/bin/bash
# ============================================================
# Ejecutar suite de tests de integración (JUnit + Testcontainers)
# Uso: bash scripts/run-tests.sh
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=========================================="
echo " Express Quinuapata — Tests de integración"
echo "=========================================="

# Los tests usan Testcontainers (levanta PostgreSQL automáticamente).
# El contenedor Maven necesita acceder al socket Docker del host.
docker run --rm \
  -v "$PROJECT_DIR/backend:/app" \
  -v "$HOME/.m2:/root/.m2" \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -w /app \
  maven:3.9.9-eclipse-temurin-21-alpine \
  mvn test -Dspring.profiles.active=test 2>&1

echo ""
echo "=========================================="
echo " Tests completados."
echo "=========================================="
