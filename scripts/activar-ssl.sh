#!/bin/bash
# activar-ssl.sh — Activa HTTPS en el servidor Contabo (ejecutar EN el servidor)
#
# Requisitos previos (una sola vez):
#   1. Verificar el correo del dominio en Namecheap (verificación ICANN)
#   2. Nameservers de Cloudflare configurados en Namecheap
#   3. Registros A en Cloudflare (nube GRIS mientras se emite el cert):
#        @ → 5.189.128.214 | www → 5.189.128.214 | sistema → 5.189.128.214
#
# Uso:  ssh root@5.189.128.214 'bash /opt/expressvraem/scripts/activar-ssl.sh'
set -euo pipefail

DOMAIN=expressquinuapata.com
IP_SERVIDOR=5.189.128.214
EMAIL=luisito.com10.pe@gmail.com
cd /opt/expressvraem

echo "══ 1/4 Verificando que el DNS ya apunte al servidor ══"
for host in $DOMAIN www.$DOMAIN sistema.$DOMAIN; do
  RESUELTO=$(getent hosts "$host" | awk '{print $1}' | head -1 || true)
  if [ "$RESUELTO" != "$IP_SERVIDOR" ]; then
    echo "❌ $host resuelve a '${RESUELTO:-nada}' en vez de $IP_SERVIDOR."
    echo "   Completa la verificación de Namecheap y los registros DNS en Cloudflare,"
    echo "   espera la propagación (dnschecker.org) y vuelve a ejecutar este script."
    exit 1
  fi
  echo "   $host → $RESUELTO ✓"
done

echo "══ 2/4 Emitiendo certificado Let's Encrypt (3 dominios) ══"
# --entrypoint es OBLIGATORIO: el servicio certbot del compose tiene como
# entrypoint el bucle de renovación; sin esto, certonly nunca se ejecuta
docker compose -f docker-compose.yml -f docker-compose.http.yml run --rm -T \
  --entrypoint certbot certbot certonly \
  --webroot -w /var/www/certbot \
  -d "$DOMAIN" -d "www.$DOMAIN" -d "sistema.$DOMAIN" \
  --email "$EMAIL" --agree-tos --no-eff-email --non-interactive

echo "══ 3/4 Cambiando nginx a modo HTTPS ══"
docker compose build nginx
docker compose up -d

echo "══ 4/4 Verificando ══"
sleep 5
curl -skf https://localhost/actuator/health --resolve "sistema.$DOMAIN:443:127.0.0.1" && echo " ← HTTPS OK"
echo
echo "✅ HTTPS activo. Pasos finales en Cloudflare:"
echo "   1. DNS → Records → activar nube NARANJA en @, www y sistema"
echo "   2. SSL/TLS → Overview → modo 'Full (strict)'"
echo "   3. SSL/TLS → Edge Certificates → 'Always Use HTTPS' ✓"
