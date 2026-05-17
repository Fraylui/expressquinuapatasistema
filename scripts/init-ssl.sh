#!/bin/bash
# ============================================================
# Setup inicial SSL con Let's Encrypt — Express Quinuapata
# Ejecutar UNA SOLA VEZ en el servidor de producción
# Uso: bash scripts/init-ssl.sh
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# ── Cargar variables de entorno ──────────────────────────────
if [ ! -f ".env" ]; then
    echo "ERROR: No existe .env en $PROJECT_DIR"
    echo "Copia .env.production como .env y configura DOMAIN y CERTBOT_EMAIL."
    exit 1
fi
set -a; source .env; set +a

# ── Validar variables requeridas ─────────────────────────────
for VAR in DOMAIN CERTBOT_EMAIL; do
    VALUE="${!VAR:-}"
    if [ -z "$VALUE" ] || [[ "$VALUE" == *"<CAMBIAR"* ]] || [[ "$VALUE" == *"<IP_O"* ]]; then
        echo "ERROR: Variable $VAR no configurada. Edita el archivo .env."
        exit 1
    fi
done

echo "=============================================="
echo " Express Quinuapata — Setup SSL"
echo " Dominio : $DOMAIN"
echo " Email   : $CERTBOT_EMAIL"
echo "=============================================="

# ── Crear volúmenes Docker si no existen ─────────────────────
docker volume inspect expressvraem_certbot_conf  >/dev/null 2>&1 || docker volume create expressvraem_certbot_conf
docker volume inspect expressvraem_certbot_www   >/dev/null 2>&1 || docker volume create expressvraem_certbot_www

# ── Paso 1: Nginx HTTP-only temporal ─────────────────────────
echo ""
echo "[1/4] Iniciando nginx temporal (HTTP-only)..."

# Detener nginx de compose si estuviera corriendo
docker compose stop nginx 2>/dev/null || true

docker run -d \
    --name nginx_ssl_init \
    -p 80:80 \
    -v "$PROJECT_DIR/nginx/nginx-init.conf:/etc/nginx/nginx.conf:ro" \
    -v expressvraem_certbot_www:/var/www/certbot \
    nginx:1.25-alpine

sleep 3

# Verificar que nginx responde
if ! curl -sf "http://localhost/" >/dev/null 2>&1; then
    echo "ADVERTENCIA: nginx temporal no responde en localhost — puede que el puerto 80 esté bloqueado."
fi

# ── Paso 2: Obtener certificado ───────────────────────────────
echo "[2/4] Obteniendo certificado para $DOMAIN..."

# Verificar que el dominio apunta a este servidor
SERVER_IP=$(curl -sf https://api.ipify.org 2>/dev/null || echo "desconocida")
echo "  IP pública del servidor: $SERVER_IP"
echo "  Asegúrate que $DOMAIN apunta a esta IP antes de continuar."
echo "  Presiona ENTER para continuar o Ctrl+C para cancelar."
read -r

docker run --rm \
    -v expressvraem_certbot_conf:/etc/letsencrypt \
    -v expressvraem_certbot_www:/var/www/certbot \
    certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$CERTBOT_EMAIL" \
    --agree-tos \
    --no-eff-email \
    --domains "$DOMAIN"

echo "  Certificado obtenido exitosamente."

# ── Paso 3: Detener nginx temporal ───────────────────────────
echo "[3/4] Deteniendo nginx temporal..."
docker stop nginx_ssl_init && docker rm nginx_ssl_init

# ── Paso 4: Levantar stack completo ──────────────────────────
echo "[4/4] Iniciando stack completo con HTTPS..."
docker compose up -d

echo ""
echo "Esperando que los servicios estén listos..."
sleep 20

echo ""
echo "Verificando HTTPS en https://$DOMAIN ..."
if curl -sf "https://$DOMAIN/actuator/health" | grep -q UP; then
    echo "  HTTPS OK — sistema funcionando en https://$DOMAIN"
else
    echo "  ADVERTENCIA: El health check no respondió todavía (puede tardar 60-90s)."
    echo "  Verifica con: docker compose logs nginx"
fi

echo ""
echo "=============================================="
echo " SSL configurado exitosamente."
echo " Renovación automática: certbot verifica cada 12h"
echo " Cron manual (opcional): 0 2 * * * docker compose exec certbot certbot renew"
echo "=============================================="
