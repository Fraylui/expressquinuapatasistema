#!/bin/bash
# deploy-server.sh — Despliegue en el servidor Contabo (5.189.128.214)
# Lo ejecuta GitHub Actions en cada push a main (o manualmente: bash scripts/deploy-server.sh)
#
# - Actualiza el código del sistema y de la página web (git pull)
# - Reconstruye las imágenes backend/frontend
# - Elige automáticamente modo HTTPS (si ya existe el certificado) o HTTP
# - Verifica que el backend quede sano; si algo falla, el script termina con error
set -euo pipefail

APP_DIR=/opt/expressvraem
WEB_DIR=/opt/paginaweb
DOMAIN=$(grep -oP '^DOMAIN=\K.*' "$APP_DIR/.env" || echo "expressquinuapata.com")
CERT="/var/lib/docker/volumes/expressvraem_certbot_conf/_data/live/${DOMAIN}/fullchain.pem"

cd "$APP_DIR"

echo "══ 1/5 Actualizando código del sistema ══"
git fetch origin main
git reset --hard origin/main

if [ -d "$WEB_DIR/.git" ]; then
  echo "══ 2/5 Actualizando página web ══"
  git -C "$WEB_DIR" fetch origin main
  git -C "$WEB_DIR" reset --hard origin/main
else
  echo "══ 2/5 Clonando página web ══"
  git clone https://github.com/Fraylui/PaginaWebExpressQuinuapata.git "$WEB_DIR"
fi

echo "══ 3/5 Reconstruyendo imágenes ══"
if [ -f "$CERT" ]; then
  COMPOSE="docker compose"
  echo "   (modo HTTPS — certificado presente)"
else
  COMPOSE="docker compose -f docker-compose.yml -f docker-compose.http.yml"
  echo "   (modo HTTP — aún sin certificado SSL)"
fi
$COMPOSE build backend frontend nginx

echo "══ 4/5 Levantando servicios ══"
$COMPOSE up -d

echo "══ 5/5 Verificando salud ══"
# -L: en modo HTTPS nginx redirige http→https (301); -k: el cert es del dominio, no de localhost
for i in $(seq 1 30); do
  if curl -skfL http://localhost/actuator/health | grep -q UP; then
    echo "   Backend UP tras $((i*5))s"
    docker compose ps --format 'table {{.Name}}\t{{.Status}}'
    echo "✅ Despliegue completado"
    exit 0
  fi
  sleep 5
done

echo "❌ El backend no respondió sano tras 150s" >&2
docker compose ps
docker logs expressvraem_backend --tail 30
exit 1
