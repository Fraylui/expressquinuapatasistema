# Guía Completa de Despliegue
## Express Quinuapata VRAEM SAC

> Actualizado: Junio 2026 — Deploy en Contabo con Docker Compose.

---

## Estado actual del sistema

| Componente         | Estado                                                   |
|--------------------|----------------------------------------------------------|
| Servidor Contabo   | ✅ Activo — IP `5.189.128.214`                           |
| Docker + Compose   | ✅ Instalado y corriendo                                 |
| PostgreSQL         | ✅ Corriendo, base de datos `quinuapata_pdn`             |
| Backend (Spring)   | ✅ Healthy — `{"status":"UP"}`                           |
| Frontend (Next.js) | ✅ Corriendo en puerto 3000                              |
| Nginx              | ✅ Corriendo, expuesto en puerto 80                      |
| Dominio            | ✅ Comprado en Namecheap — `expressquinuapata.com`       |
| Cloudflare         | ✅ Cuenta creada                                         |
| DNS                | ⏳ Pendiente — apuntar dominio a la IP del servidor       |
| SSL / HTTPS        | ⏳ Pendiente — se hace después de configurar DNS         |

**El sistema ya es accesible en: http://5.189.128.214/**

---

## Lo que falta hacer (en orden)

```
0. Namecheap   → ⚠️ VERIFICAR EL CORREO DE CONTACTO (ver nota abajo)
1. Cloudflare  → Agregar dominio y registros A con la IP del servidor
2. Namecheap   → Cambiar nameservers a Cloudflare
3. Esperar     → Propagación DNS (10 min – 24 horas)
4. Servidor    → Obtener certificado SSL con Certbot
5. Servidor    → Cambiar contraseña root del servidor
```

> ### ⚠️ BLOQUEO DETECTADO (jul 2026): dominio suspendido por Namecheap
> Los nameservers actuales del dominio son `failed-whois-verification.namecheap.com`,
> es decir, **Namecheap suspendió el dominio porque no se verificó el correo del
> registrante (verificación ICANN)**. Hasta resolver esto, el dominio no apunta a
> ningún lado, sin importar lo que se configure en Cloudflare.
>
> **Cómo resolverlo:** entra a namecheap.com → Domain List → verás un banner rojo
> en `expressquinuapata.com` → clic en "Resend verification email" → abre el correo
> de Namecheap (asunto "IMPORTANT: Verify your contact information") → clic en el
> enlace de verificación. La suspensión se levanta en minutos/horas.

---

## Arquitectura de dominios (jul 2026)

| URL                                    | Contenido                              |
|----------------------------------------|----------------------------------------|
| `https://expressquinuapata.com` (+www) | Página web pública (estática)          |
| `https://sistema.expressquinuapata.com`| Panel de gestión (Next.js)             |
| `http://5.189.128.214`                 | Panel (acceso por IP, siempre activo)  |
| `http://5.189.128.214:8081`            | Vista previa de la web (temporal)      |

La página web vive en el repo `Fraylui/PaginaWebExpressQuinuapata`, clonado en el
servidor en `/opt/paginaweb` y montado en el contenedor nginx (`/var/www/web`).
El botón "Iniciar sesión" de la web llama a `/api` en su mismo origen (nginx lo
proxea al backend) y al entrar redirige al panel en `sistema.expressquinuapata.com`.

---

---

# PASO 1 — CLOUDFLARE
## Agregar el dominio y configurar DNS

---

### 1.1 Agregar el dominio

1. Ve a **dash.cloudflare.com** e inicia sesión
2. Clic en **Add a site** (o **Add a domain**)
3. Escribe: `expressquinuapata.com`
4. Clic en **Add site**
5. Selecciona el plan **Free** → clic en **Continue**
6. Cloudflare buscará registros existentes → clic en **Continue**
7. Cloudflare te mostrará **2 nameservers** como estos:
   ```
   ada.ns.cloudflare.com
   bob.ns.cloudflare.com
   ```
   **Anota exactamente esos dos nombres** — los usas en el Paso 2.

8. Clic en **Done, check nameservers**

---

### 1.2 Agregar registros DNS

1. Panel izquierdo → **DNS** → **Records**
2. Clic en **Add record** y crea estos 2 registros:

**Registro 1 — Dominio principal**

| Campo  | Valor           |
|--------|-----------------|
| Type   | A               |
| Name   | `@`             |
| IPv4   | `5.189.128.214` |
| Proxy  | **Desactivado (nube gris)** por ahora |
| TTL    | Auto            |

**Registro 2 — Subdominio www**

| Campo  | Valor           |
|--------|-----------------|
| Type   | A               |
| Name   | `www`           |
| IPv4   | `5.189.128.214` |
| Proxy  | **Desactivado (nube gris)** por ahora |
| TTL    | Auto            |

**Registro 3 — Subdominio sistema (el panel de gestión)**

| Campo  | Valor           |
|--------|-----------------|
| Type   | A               |
| Name   | `sistema`       |
| IPv4   | `5.189.128.214` |
| Proxy  | **Desactivado (nube gris)** por ahora |
| TTL    | Auto            |

> Dejamos la nube en **gris** temporalmente para que Certbot pueda verificar el dominio.
> Después de instalar SSL, volvemos a activarla en naranja.

---

### 1.3 Configurar modo SSL (por ahora: Flexible)

1. Panel izquierdo → **SSL/TLS** → **Overview**
2. Selecciona modo: **Flexible**

> Lo cambiamos a **Full (strict)** después de instalar el certificado.

---

---

# PASO 2 — NAMECHEAP
## Cambiar los nameservers al dominio

---

### 2.1 Cambiar los nameservers

1. Ve a **namecheap.com** e inicia sesión
2. Panel izquierdo → **Domain List**
3. Busca `expressquinuapata.com` → clic en **Manage**
4. Pestaña **Nameservers**
5. Cambia el selector de **Namecheap BasicDNS** a **Custom DNS**
6. En los dos campos ingresa los nameservers que Cloudflare te dio en el Paso 1.1:
   ```
   Nameserver 1: ada.ns.cloudflare.com    ← reemplaza por el tuyo exacto
   Nameserver 2: bob.ns.cloudflare.com    ← reemplaza por el tuyo exacto
   ```
7. Clic en el **✅ verde** para guardar

---

### 2.2 Esperar la propagación DNS

> La propagación tarda entre **10 minutos y 24 horas** (normalmente < 2 horas).

Verifica en: **dnschecker.org**
- Escribe: `expressquinuapata.com`
- Tipo: **NS**
- Cuando veas los nameservers de Cloudflare en verde, ya propagó

---

---

# PASO 3 — SERVIDOR
## Activar SSL con Certbot

> Haz esto solo después de confirmar que el DNS propagó.

---

### 3.1 Conectarte al servidor

Abre PowerShell y ejecuta:

```powershell
ssh root@5.189.128.214
```

Contraseña: la contraseña del servidor (ver nota de seguridad al final).

---

### 3.2 Obtener el certificado SSL

Dentro del servidor, ejecuta:

```bash
cd /opt/expressvraem
docker compose -f docker-compose.yml run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d expressquinuapata.com \
  -d www.expressquinuapata.com \
  -d sistema.expressquinuapata.com \
  --email luisito.com10.pe@gmail.com \
  --agree-tos --no-eff-email
```

Cuando termine exitosamente, verás:
```
Successfully received certificate.
Certificate is saved at: /etc/letsencrypt/live/expressquinuapata.com/fullchain.pem
```

---

### 3.3 Activar la configuración HTTPS completa

Reinicia todo con la configuración SSL (en lugar del override HTTP):

```bash
cd /opt/expressvraem

# Detener el nginx temporal
docker stop expressvraem_nginx
docker rm expressvraem_nginx

# Levantar todo con SSL
docker compose up -d
```

---

### 3.4 Reactivar proxy de Cloudflare

1. Vuelve a **dash.cloudflare.com** → DNS → Records
2. En los registros A (`@` y `www`), clic en el ícono de nube gris → activa la **nube naranja**
3. Luego ve a **SSL/TLS** → **Overview** → cambia a **Full (strict)**
4. En **SSL/TLS** → **Edge Certificates**:
   - Activa **Always Use HTTPS** ✅
   - Activa **Automatic HTTPS Rewrites** ✅

---

### 3.5 Verificar que todo funciona

Desde el navegador:
- `https://expressquinuapata.com` → debe cargar el sistema ✅
- `https://www.expressquinuapata.com` → debe redirigir ✅

---

---

# PASO 4 — SEGURIDAD
## Cambiar contraseña del servidor

La contraseña del servidor fue compartida durante la configuración inicial.
**Cámbiala lo antes posible** desde dentro del servidor:

```bash
passwd root
```

Te pedirá:
1. Nueva contraseña → escribe una segura y anótala
2. Confirmación → repite la misma

---

---

# GESTIÓN DEL SERVIDOR

### Información del servidor

| Dato          | Valor                        |
|---------------|------------------------------|
| Proveedor     | Contabo Cloud                |
| Plan          | Cloud VPS 10 NVMe            |
| IP            | `5.189.128.214`              |
| OS            | Ubuntu 24.04                 |
| RAM           | 8 GB                         |
| Disco         | 72 GB                        |
| Costo         | ~$6.60/mes (€5.50)           |

---

### Carpeta del proyecto en el servidor

```
/opt/expressvraem/
├── docker-compose.yml
├── docker-compose.http.yml
├── .env                  ← contraseñas y configuración (NO subir a GitHub)
├── nginx/
│   ├── nginx.conf
│   └── nginx-http.conf   ← config HTTP temporal (sin SSL)
├── database/
│   ├── schema.sql
│   └── migrations/
└── backups/
```

---

### Comandos útiles del día a día

```bash
# Conectarse al servidor
ssh root@5.189.128.214

# Ver estado de todos los contenedores
cd /opt/expressvraem
docker compose ps

# Ver logs del backend en tiempo real
docker logs expressvraem_backend -f --tail 50

# Ver logs del frontend
docker logs expressvraem_frontend -f --tail 30

# Reiniciar un servicio específico
docker compose restart backend
docker compose restart frontend
docker compose restart nginx

# Reiniciar todo
docker compose down && docker compose up -d

# Ver uso de RAM
free -h

# Ver uso de disco
df -h
```

---

### Actualizar el sistema (nueva versión)

Cuando se suba código nuevo a GitHub:

```bash
# En el servidor
cd /opt/expressvraem

# 1. Bajar el código actualizado
git pull origin main

# 2. Reconstruir las imágenes
docker compose build backend frontend

# 3. Reiniciar con la nueva versión
docker compose up -d backend frontend

# 4. Verificar que arrancó bien
docker compose ps
docker logs expressvraem_backend --tail 20
```

---

### Base de datos — acceso directo

```bash
# Entrar a PostgreSQL
docker exec -it expressvraem_postgres psql -U expressadmin_pdn -d quinuapata_pdn

# Desde ahí puedes ejecutar SQL, por ejemplo:
\dt          -- listar tablas
\q           -- salir
```

---

## Costos mensuales

| Servicio        | Plan             | Costo          |
|-----------------|------------------|----------------|
| Namecheap       | Dominio .com     | ~$1.20/mes     |
| Contabo VPS     | Cloud VPS 10     | ~$6.60/mes     |
| Cloudflare      | Free             | $0.00          |
| **Total**       |                  | **~$7.80/mes** |

---

*Express Quinuapata VRAEM SAC — Guía de despliegue — Junio 2026*
