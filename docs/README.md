# Express Quinuapata VRAEM SAC — Guía de Despliegue

Sistema integral de gestión de transporte interprovincial para rutas Huamanga-VRAEM.

---

## Requisitos

| Herramienta | Versión mínima |
|-------------|---------------|
| Docker | 24.x |
| Docker Compose | 2.x (plugin) |
| Git | 2.x |
| Servidor (producción) | 2 vCPU, 4GB RAM, 20GB disco, Ubuntu 22.04 |

---

## Desarrollo local

```bash
# 1. Clonar el repositorio
git clone <repo-url>
cd PROYECTO_TRASPORTES

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales locales

# 3. Levantar con hot reload
docker compose -f docker-compose.dev.yml up --build

# En Windows Git Bash también puedes usar:
bash start-dev.sh
```

| Servicio | URL |
|----------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8080 |
| PostgreSQL | localhost:5432 |
| Tracking público | http://localhost:3000/tracking |

---

## Producción — Guía paso a paso

### 1. Preparar el servidor

```bash
# Instalar Docker en Ubuntu 22.04
curl -fsSL https://get.docker.com | sh
apt install docker-compose-plugin -y
usermod -aG docker $USER
```

### 2. Clonar el proyecto en el servidor

```bash
git clone <repo-url> /app/expressvraem
cd /app/expressvraem
```

### 3. Configurar las variables de entorno

```bash
cp .env.production .env
nano .env
```

Completar todos los valores marcados con `<CAMBIAR_...>`:

```bash
# Generar JWT_SECRET seguro:
openssl rand -base64 64

# Generar DB_PASSWORD seguro:
openssl rand -base64 24
```

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `DB_NAME` | Nombre de la base de datos | `quinuapata_pdn` |
| `DB_USER` | Usuario de PostgreSQL | `expressadmin_pdn` |
| `DB_PASSWORD` | Contraseña (mín. 20 chars) | `openssl rand -base64 24` |
| `JWT_SECRET` | Secreto JWT (mín. 64 chars) | `openssl rand -base64 64` |
| `DOMAIN` | Dominio sin https:// | `sistema.quinuapata.com` |
| `CERTBOT_EMAIL` | Email para alertas SSL | `admin@quinuapata.com` |
| `ALLOWED_ORIGINS` | URL completa del frontend | `https://sistema.quinuapata.com` |
| `NEXT_PUBLIC_API_URL` | URL del backend | `https://sistema.quinuapata.com` |
| `NEXT_PUBLIC_WS_URL` | URL WebSocket | `wss://sistema.quinuapata.com` |

### 4. Configurar DNS

Crear un registro A en tu proveedor de dominio:
```
sistema.quinuapata.com  →  A  →  <IP del servidor>
```
Esperar que propague (5-30 minutos).

### 5. Primera vez — obtener certificado SSL

```bash
bash scripts/init-ssl.sh
```

Este script:
1. Levanta un nginx temporal en puerto 80
2. Obtiene el certificado Let's Encrypt para tu dominio
3. Levanta el stack completo con HTTPS

### 6. Deploys siguientes

```bash
# Hacer cambios, commit, push a main
git pull origin main
bash scripts/deploy.sh
```

El script `deploy.sh`:
1. Hace backup automático de la base de datos
2. Construye las imágenes Docker nuevas
3. Detiene y reinicia los servicios
4. Verifica que el backend esté saludable

### 7. CI/CD automático (opcional)

Cada push a `main` dispara el workflow `.github/workflows/deploy.yml`.

Configurar en GitHub → Settings → Secrets:

| Secret | Valor |
|--------|-------|
| `SERVER_HOST` | IP del servidor |
| `SERVER_USER` | Usuario SSH (ej: `root`) |
| `SERVER_SSH_KEY` | Contenido de `~/.ssh/id_rsa` |
| `SERVER_PORT` | Puerto SSH (default: 22) |

---

## Backups

### Automático (configurar una vez)

```bash
crontab -e
# Agregar:
0 2 * * * cd /app/expressvraem && bash scripts/backup.sh >> /var/log/expressvraem-backup.log 2>&1
```

Los backups se guardan en `/app/expressvraem/backups/` con retención de 30 días.

### Manual

```bash
# Hacer backup ahora mismo
bash scripts/backup.sh

# Con verificación profunda de contenido
bash scripts/backup.sh --verify

# Ver backups disponibles
bash scripts/restore.sh

# Restaurar un backup específico
bash scripts/restore.sh backups/quinuapata_20250603_020000.sql.gz
```

### Backup offsite (recomendado)

Con **Backblaze B2** (~gratis hasta 10GB):
```bash
apt install rclone
rclone config   # crear remote "backblaze"
```
```bash
# En .env agregar:
RCLONE_REMOTE=backblaze:expressvraem-backups
```

---

## Usuarios del sistema

| Email | Contraseña | Rol |
|-------|-----------|-----|
| superadmin@expressvraem.com | SuperAdmin2026! | SUPER_ADMIN |
| kevin.sandoval@quinuapata.com | Quinuapata2026! | GERENTE |
| carlos.quispe@quinuapata.com | Quinuapata2024! | OPERADOR (Huamanga) |
| maria.ccencho@quinuapata.com | Quinuapata2024! | OPERADOR (Huamanga) |
| juan.ccoyllo@quinuapata.com | Quinuapata2024! | CONDUCTOR |
| rosa.sulca@quinuapata.com | Quinuapata2024! | OPERADOR (Kimbiri) |

> Contraseñas de desarrollo. En producción, cambiarlas desde el panel de Usuarios.

---

## Rutas configuradas

| Código | Ruta | Combi | Camioneta |
|--------|------|-------|-----------|
| HUA-KIM | Huamanga → Kimbiri | S/55 | S/90 |
| HUA-PIC | Huamanga → Pichari | S/55 | S/90 |
| HUA-SFR | Huamanga → San Francisco | S/50 | S/80 |
| KIM-PIC | Kimbiri → Pichari (tramo) | S/15 | S/20 |

---

## Monitoreo

```bash
# Ver estado de todos los servicios
docker compose ps

# Logs del backend en tiempo real
docker compose logs -f backend

# Logs de nginx
docker compose logs -f nginx

# Health check manual
curl https://tu-dominio.com/actuator/health

# Espacio en disco usado por backups
du -sh /app/expressvraem/backups/
```

---

## Solución de problemas comunes

**El backend no inicia (OOM Kill)**
```bash
# Ver si fue matado por falta de memoria
docker inspect expressvraem_backend | grep -i oom
# Solución: aumentar RAM del servidor o el límite en docker-compose.yml
```

**Certificado SSL expirado**
```bash
# Renovar manualmente
docker compose exec certbot certbot renew --force-renewal
docker compose restart nginx
```

**Base de datos no inicia**
```bash
docker compose logs postgres
# Si hay datos corruptos, restaurar desde el último backup:
bash scripts/restore.sh
```

**WebSocket no conecta detrás de nginx**
```bash
# Verificar que nginx proxy_pass tenga headers Upgrade y Connection
docker compose logs nginx | grep ws
```

---

## Arquitectura de producción

```
Internet
    │
    ▼ :80/:443
┌─────────────────────────────────────────┐
│  Nginx (TLS 1.2+1.3, HSTS, rate limit) │
│  Certbot (renovación SSL cada 12h)      │
└────────┬───────────────┬────────────────┘
         │               │
         ▼               ▼
    Frontend          Backend
    Next.js 14     Spring Boot 3.5
    :3000              :8080
                        │
                        ▼
                   PostgreSQL 15
                      :5432
                   (volumen pdn)
```

---

*Express Quinuapata VRAEM SAC · Sistema v2.0 · Spring Boot 3.5 · Next.js 14*
