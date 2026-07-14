#!/bin/sh
# Sustituye DOMAIN_PLACEHOLDER en la plantilla nginx antes de arrancar.
# Si /etc/nginx/nginx.conf viene montado desde el host (modo HTTP sin SSL),
# no se sustituye nada: se usa el archivo montado tal cual.
set -e

if [ -f /etc/nginx/nginx.conf ] && ! touch /etc/nginx/nginx.conf 2>/dev/null; then
    echo "[nginx] nginx.conf montado externamente — se omite la sustitución de dominio"
    exit 0
fi

if [ -z "${DOMAIN}" ]; then
    echo "ERROR: Variable de entorno DOMAIN no definida." >&2
    exit 1
fi

sed "s|DOMAIN_PLACEHOLDER|${DOMAIN}|g" /nginx.conf.template > /etc/nginx/nginx.conf

echo "[nginx] Configurado para dominio: ${DOMAIN}"
exec "$@"
