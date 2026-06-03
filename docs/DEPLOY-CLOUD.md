# Despliegue en la Nube — Express Quinuapata VRAEM SAC

---

## ¿Hetzner o DigitalOcean?

| | Hetzner | DigitalOcean |
|---|---|---|
| **Precio** | €4.49/mes (CX22) | $12/mes (Basic) |
| **RAM** | 4 GB | 2 GB |
| **vCPU** | 2 | 2 |
| **Disco** | 40 GB SSD | 60 GB SSD |
| **Transferencia** | 20 TB | 2 TB |
| **Datacenter más cercano a Perú** | Ashburn, Virginia (USA) | Nueva York (USA) |
| **Panel de control** | Sencillo | Muy completo |
| **Soporte** | Solo tickets | Chat + tickets |
| **Facturación** | Por hora, en euros | Por hora, en dólares |
| **Registro** | Puede pedir documento de identidad | Solo tarjeta |

### Recomendación: **Hetzner** ✅

Hetzner da el **doble de RAM por menos de la mitad del precio**. Para un sistema Spring Boot + PostgreSQL + Next.js necesitas mínimo 4 GB de RAM. En DigitalOcean tendrías que pagar $24/mes para llegar a 4 GB.

> Si ya tienes cuenta en DigitalOcean o prefieres interfaz en inglés más pulida, también funciona perfectamente con el plan de $24/mes (4 GB).

---

## Requisitos antes de empezar (ambas opciones)

- [ ] Tarjeta de crédito o débito (Visa/Mastercard)
- [ ] Correo electrónico
- [ ] Acceso al repositorio GitHub del proyecto
- [ ] Un dominio (opcional pero recomendado para HTTPS)

---

---

# OPCIÓN A — Hetzner Cloud

## 1. Crear cuenta en Hetzner

1. Ve a **[hetzner.com/cloud](https://www.hetzner.com/cloud)**
2. Clic en **Get started**
3. Regístrate con tu correo
4. Verifica tu correo y activa la cuenta
5. Agrega un método de pago (tarjeta de crédito)

> Hetzner puede pedir verificación de identidad (foto de DNI). Es normal y tarda menos de 24 horas.

---

## 2. Crear el servidor (Droplet/VPS)

1. Entra a **[console.hetzner.cloud](https://console.hetzner.cloud)**
2. Clic en **+ Create Server**
3. Configura así:

| Campo | Valor |
|-------|-------|
| **Location** | Ashburn, VA (US East) — más cercano a Perú |
| **Image** | Ubuntu 22.04 |
| **Type** | Shared CPU → **CX22** (2 vCPU, 4 GB RAM, 40 GB) |
| **SSH Key** | Agrega tu clave pública (ver paso siguiente) |
| **Name** | `expressvraem-pdn` |

### Generar clave SSH (si no tienes una)

En tu PC local, abre PowerShell o Git Bash:

```bash
ssh-keygen -t ed25519 -C "expressvraem-server"
# Presiona Enter en todas las preguntas (sin contraseña)
```

Esto crea dos archivos:
- `~/.ssh/id_ed25519` — clave privada (NUNCA la compartas)
- `~/.ssh/id_ed25519.pub` — clave pública (esta se sube a Hetzner)

Para ver la clave pública:
```bash
cat ~/.ssh/id_ed25519.pub
# Copia todo el texto que aparece
```

En Hetzner: clic en **Add SSH Key**, pega el texto y ponle nombre `mi-pc`.

4. Clic en **Create & Buy Now**
5. Copia la **IP pública** que aparece (ej: `49.13.45.123`)

---

## 3. Conectarse al servidor

```bash
ssh root@49.13.45.123
```

La primera vez te preguntará si confías en el servidor — escribe `yes`.

---

## 4. Instalar Docker en el servidor

```bash
# Actualizar paquetes
apt update && apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com | sh

# Instalar plugin de Docker Compose
apt install docker-compose-plugin -y

# Verificar instalación
docker --version
docker compose version
```

---

## 5. Clonar el proyecto

```bash
# Crear directorio de trabajo
mkdir -p /app && cd /app

# Clonar el repositorio
git clone https://github.com/TU_USUARIO/expressvraem.git
cd expressvraem
```

---

## 6. Configurar variables de entorno

```bash
cp .env.production .env
nano .env
```

Genera las claves seguras:
```bash
# JWT Secret (ejecuta esto y copia el resultado)
openssl rand -base64 64

# Password de base de datos
openssl rand -base64 24
```

Rellena el `.env`:
```bash
# Base de datos
DB_NAME=quinuapata_pdn
DB_USER=expressadmin_pdn
DB_PASSWORD=PEGA_TU_PASSWORD_AQUI

# JWT
JWT_SECRET=PEGA_TU_JWT_SECRET_AQUI
JWT_EXPIRATION=86400000

# Dominio — si no tienes dominio, pon la IP del servidor
DOMAIN=49.13.45.123
CERTBOT_EMAIL=tu@email.com

# URLs — con IP sin dominio usa HTTP
ALLOWED_ORIGINS=http://49.13.45.123
NEXT_PUBLIC_API_URL=http://49.13.45.123
NEXT_PUBLIC_WS_URL=ws://49.13.45.123

# Backup
BACKUP_DIR=/app/expressvraem/backups
BACKUP_RETENTION_DAYS=30
POSTGRES_CONTAINER=expressvraem_postgres
```

Guardar en nano: `Ctrl+O` → Enter → `Ctrl+X`

---

## 7. Primer despliegue

### Sin dominio (HTTP):
```bash
bash scripts/deploy.sh --http
```

### Con dominio y HTTPS:
```bash
# Primero configura el DNS de tu dominio apuntando a la IP
# Luego:
bash scripts/init-ssl.sh
```

---

## 8. Verificar que funciona

```bash
# Ver todos los contenedores corriendo
docker compose ps

# Ver logs del backend
docker compose logs -f backend

# Verificar health
curl http://49.13.45.123/actuator/health
```

Abre el navegador en: **http://49.13.45.123**

---

## 9. Configurar backup automático

```bash
crontab -e
```
Agrega esta línea:
```
0 2 * * * cd /app/expressvraem && bash scripts/backup.sh >> /var/log/expressvraem-backup.log 2>&1
```

---

## 10. Firewall en Hetzner (recomendado)

En el panel de Hetzner → **Firewalls → Create Firewall**:

| Regla | Protocolo | Puerto | Fuente |
|-------|-----------|--------|--------|
| SSH | TCP | 22 | Tu IP (o Any) |
| HTTP | TCP | 80 | Any |
| HTTPS | TCP | 443 | Any |

Bloquear todo lo demás. Esto evita acceso directo al puerto 8080 del backend y 5432 de PostgreSQL.

---

---

# OPCIÓN B — DigitalOcean

## 1. Crear cuenta en DigitalOcean

1. Ve a **[digitalocean.com](https://www.digitalocean.com)**
2. Clic en **Sign Up**
3. Regístrate con correo o GitHub
4. Agrega tarjeta de crédito (cobran $1 de verificación que se devuelve)

> DigitalOcean a veces da $200 de crédito gratis por 60 días para nuevas cuentas.

---

## 2. Crear el servidor (Droplet)

1. Clic en **Create → Droplets**
2. Configura así:

| Campo | Valor |
|-------|-------|
| **Region** | New York 1 o San Francisco — más cercano a Perú |
| **OS** | Ubuntu 22.04 LTS |
| **Plan** | Basic → Regular SSD → **2 vCPU / 4 GB / 80 GB** ($24/mes) |
| **Authentication** | SSH Key (ver paso siguiente) |
| **Hostname** | `expressvraem-pdn` |

### Generar clave SSH (si no tienes una)

En tu PC local:
```bash
ssh-keygen -t ed25519 -C "expressvraem-server"
# Presiona Enter en todas las preguntas

# Ver la clave pública para copiarla
cat ~/.ssh/id_ed25519.pub
```

En DigitalOcean: clic en **New SSH Key**, pega la clave pública.

3. Clic en **Create Droplet**
4. Copia la **IP pública** del Droplet (ej: `157.230.45.123`)

---

## 3. Conectarse al servidor

```bash
ssh root@157.230.45.123
```

---

## 4. Instalar Docker

```bash
apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh
apt install docker-compose-plugin -y
docker --version
docker compose version
```

---

## 5. Clonar el proyecto

```bash
mkdir -p /app && cd /app
git clone https://github.com/TU_USUARIO/expressvraem.git
cd expressvraem
```

---

## 6. Configurar variables de entorno

```bash
cp .env.production .env
nano .env
```

Genera las claves:
```bash
openssl rand -base64 64   # JWT_SECRET
openssl rand -base64 24   # DB_PASSWORD
```

Rellena el `.env` igual que en Hetzner (ver sección anterior), cambiando la IP por la de DigitalOcean.

---

## 7. Primer despliegue

```bash
# Sin dominio (HTTP)
bash scripts/deploy.sh --http

# Con dominio y HTTPS
bash scripts/init-ssl.sh
```

---

## 8. Verificar que funciona

```bash
docker compose ps
curl http://157.230.45.123/actuator/health
```

Abrir en navegador: **http://157.230.45.123**

---

## 9. Backup automático

```bash
crontab -e
# Agregar:
0 2 * * * cd /app/expressvraem && bash scripts/backup.sh >> /var/log/expressvraem-backup.log 2>&1
```

---

## 10. Firewall en DigitalOcean

Panel → **Networking → Firewalls → Create Firewall**:

| Tipo | Protocolo | Puerto |
|------|-----------|--------|
| Inbound | TCP | 22 (SSH) |
| Inbound | TCP | 80 (HTTP) |
| Inbound | TCP | 443 (HTTPS) |

Aplicar el firewall al Droplet. Bloquea el puerto 8080 y 5432 del exterior.

---

---

# CI/CD automático (ambas opciones)

Una vez el servidor está funcionando, configura el deploy automático al hacer `git push`:

## En GitHub → Settings → Secrets → Actions → New repository secret

| Secret | Valor |
|--------|-------|
| `SERVER_HOST` | IP del servidor (ej: `49.13.45.123`) |
| `SERVER_USER` | `root` |
| `SERVER_SSH_KEY` | Contenido de `~/.ssh/id_ed25519` (clave **privada**) |

Ver contenido de la clave privada:
```bash
cat ~/.ssh/id_ed25519
# Copia TODO el texto incluyendo -----BEGIN y -----END-----
```

Desde ese momento, cada `git push` a `main` desplegará automáticamente.

---

# Agregar dominio propio (opcional pero recomendado)

Si compras un dominio (ej: en Namecheap, GoDaddy, o NIC.pe para dominio .pe peruano):

1. En el panel DNS de tu proveedor, crea un registro:
   ```
   Tipo: A
   Nombre: sistema  (o @ para el dominio raíz)
   Valor: 49.13.45.123  (tu IP)
   TTL: 3600
   ```

2. Espera 10-30 minutos que propague el DNS

3. En el servidor, edita `.env`:
   ```bash
   DOMAIN=sistema.quinuapata.com
   CERTBOT_EMAIL=admin@quinuapata.com
   ALLOWED_ORIGINS=https://sistema.quinuapata.com
   NEXT_PUBLIC_API_URL=https://sistema.quinuapata.com
   NEXT_PUBLIC_WS_URL=wss://sistema.quinuapata.com
   ```

4. Ejecuta:
   ```bash
   bash scripts/init-ssl.sh
   ```

El sistema queda disponible en `https://sistema.quinuapata.com` con certificado SSL gratuito.

---

# Resumen de costos mensuales estimados

| Servicio | Hetzner | DigitalOcean |
|---------|---------|-------------|
| Servidor (4 GB RAM) | €4.49 (~$5) | $24 |
| Dominio .com/año | ~$12/año (~$1/mes) | ~$12/año |
| SSL (Let's Encrypt) | Gratis | Gratis |
| Backups automáticos | Incluido | Incluido |
| **Total mensual** | **~$6/mes** | **~$25/mes** |

---

# Comandos de mantenimiento frecuentes

```bash
# Ver estado del sistema
docker compose ps

# Ver logs en tiempo real
docker compose logs -f backend
docker compose logs -f frontend

# Reiniciar solo el backend
docker compose restart backend

# Hacer backup manual
bash scripts/backup.sh

# Ver backups disponibles
bash scripts/restore.sh

# Actualizar el sistema (pull + redeploy)
git pull origin main && bash scripts/deploy.sh --http

# Ver uso de disco
df -h
du -sh /app/expressvraem/backups/
```
