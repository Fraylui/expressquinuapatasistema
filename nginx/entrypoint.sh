#!/bin/sh
# Sustituye DOMAIN_PLACEHOLDER en la plantilla nginx antes de arrancar
set -e

if [ -z "${DOMAIN}" ]; then
    echo "ERROR: Variable de entorno DOMAIN no definida." >&2
    exit 1
fi

sed "s|DOMAIN_PLACEHOLDER|${DOMAIN}|g" /nginx.conf.template > /etc/nginx/nginx.conf

echo "[nginx] Configurado para dominio: ${DOMAIN}"
exec "$@"
