# Servidor Contabo — Guía de Mantenimiento

## Datos de acceso

| Campo | Valor |
|-------|-------|
| Proveedor | Contabo VPS |
| IP servidor | `5.189.128.214` |
| Usuario SSH | `root` |
| Dominio | `expressquinuapata.com` |
| DNS | Namecheap (dominio) + Cloudflare (proxy) |
| Panel Contabo | contabo.com → Customer ID: 15136552 |

## Conectarse al servidor

```bash
ssh root@5.189.128.214
```

Ingresar contraseña cuando la pida.

## Arquitectura en producción

```
Internet → Cloudflare (HTTPS) → Servidor Contabo :80 → nginx → frontend:3000
                                                               → backend:8080
                                                               → postgres:5432
```

- **Cloudflare** maneja el SSL/HTTPS para los visitantes
- **nginx** en el servidor solo corre en HTTP (puerto 80), hace proxy al frontend y backend
- Todos los servicios corren en Docker dentro de la red `expressvraem_express-pdn-network`

## Archivos importantes en el servidor

| Ruta | Descripción |
|------|-------------|
| `/opt/expressvraem/` | Directorio principal del proyecto |
| `/opt/expressvraem/.env` | Variables de entorno de producción |
| `/opt/expressvraem/docker-compose.yml` | Configuración Docker principal |
| `/opt/expressvraem/nginx/nginx-cloudflare.conf` | Config nginx activa (HTTP + proxy) |

## Comandos útiles

### Ver estado de los contenedores
```bash
docker ps -a
```

### Ver logs de un servicio
```bash
docker logs expressvraem_backend --tail 50
docker logs expressvraem_frontend --tail 50
docker logs expressvraem_nginx --tail 50
```

### Reiniciar un servicio
```bash
cd /opt/expressvraem
docker compose restart backend
docker compose restart frontend
docker compose restart nginx
```

### Reiniciar todo
```bash
cd /opt/expressvraem
docker compose down
docker compose up -d
```

---

## PROBLEMA CONOCIDO: nginx se cae y el proxy no funciona

### Síntoma
- El frontend carga pero muestra errores `ERR_EMPTY_RESPONSE` o `Failed to load resource` en la API
- Los endpoints `/api/*` no responden
- WebSocket `/ws-stomp` falla

### Causa
El contenedor nginx se reinicia con la imagen base de nginx sin la configuración de proxy. Esto ocurre porque el nginx personalizado del docker-compose.yml falla al no encontrar certificados SSL en el volumen certbot.

### Solución rápida (ya configurada — julio 2026)

El nginx corre con la config HTTP simple en `/opt/expressvraem/nginx/nginx-cloudflare.conf`. Si el nginx se cae, levantarlo así:

```bash
# 1. Detener y eliminar el contenedor viejo
docker stop expressvraem_nginx
docker rm expressvraem_nginx

# 2. Levantar nginx con la config correcta
docker run -d \
  --name expressvraem_nginx \
  --restart always \
  --network expressvraem_express-pdn-network \
  -p 80:80 \
  -p 443:443 \
  -v /opt/expressvraem/nginx/nginx-cloudflare.conf:/etc/nginx/nginx.conf:ro \
  --memory 64m \
  nginx:stable-alpine
```

### Verificar que funciona

```bash
curl -s -o /dev/null -w '%{http_code}' http://localhost/api/empresa-config
# Debe responder: 200

curl -s http://localhost/actuator/health
# Debe responder: {"status":"UP"}
```

---

## Actualizar el sistema (nuevo deploy)

Cuando hay cambios en el código y se quiere actualizar el servidor:

```bash
cd /opt/expressvraem

# 1. Bajar el código nuevo (si usas git)
git pull

# 2. Reconstruir las imágenes
docker compose build backend frontend

# 3. Reiniciar con las nuevas imágenes
docker compose up -d backend frontend

# 4. Reiniciar nginx si es necesario
docker stop expressvraem_nginx && docker rm expressvraem_nginx
docker run -d \
  --name expressvraem_nginx \
  --restart always \
  --network expressvraem_express-pdn-network \
  -p 80:80 -p 443:443 \
  -v /opt/expressvraem/nginx/nginx-cloudflare.conf:/etc/nginx/nginx.conf:ro \
  --memory 64m \
  nginx:stable-alpine
```

---

## Base de datos PostgreSQL

### Conectarse a la DB
```bash
docker exec -it expressvraem_postgres psql -U expressadmin_pdn -d quinuapata_pdn
```

### Ver backups automáticos
```bash
ls /opt/expressvraem/backups/
```

Los backups se hacen automáticamente a las 2am todos los días.

---

## Cloudflare — Configuración importante

- El SSL en Cloudflare debe estar en modo **"Full"** (no Strict, no Flexible)
- Los registros DNS en Cloudflare deben apuntar a `5.189.128.214`
- Asegurarse que el proxy de Cloudflare (nube naranja) esté **activado** para el dominio
