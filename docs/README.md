# Express Quinuapata VRAEM SAC — Sistema de Transporte

Sistema integral de gestión de transporte para rutas Huamanga-VRAEM.

## Requisitos

- Docker Desktop 4.x o superior
- Git

## Instalación rápida (3 pasos)

```bash
# 1. Clonar el repositorio
git clone <repo-url>
cd PROYECTO_TRASPORTES

# 2. Copiar variables de entorno
cp .env.example .env

# 3. Levantar desarrollo
bash start-dev.sh
```

## Levantar en desarrollo

```bash
docker compose -f docker-compose.dev.yml up --build
```

| Servicio   | URL                          |
|------------|------------------------------|
| Frontend   | http://localhost:3000        |
| Backend    | http://localhost:8080        |
| PostgreSQL | localhost:5432               |
| Tracking   | http://localhost:3000/tracking |

## Levantar en producción

```bash
docker compose up --build -d
```

Acceso en http://localhost (puerto 80 vía Nginx)

## Estructura del proyecto

```
PROYECTO_TRASPORTES/
├── backend/          # Spring Boot 3.3.12 + Java 17
├── frontend/         # Next.js 14 + TypeScript
├── database/         # Schema y seeds PostgreSQL
├── docker/           # Configuración Nginx
├── docs/             # Documentación
├── docker-compose.yml
└── docker-compose.dev.yml
```

## Usuarios de prueba

| Email                              | Contraseña         | Rol        | Agencia  |
|------------------------------------|--------------------|------------|----------|
| superadmin@expressvraem.com        | SuperAdmin2026!    | SUPER_ADMIN| Huamanga |
| kevin.sandoval@quinuapata.com      | Quinuapata2026!    | GERENTE    | Huamanga |
| carlos.quispe@quinuapata.com       | Quinuapata2024!    | OPERADOR   | Huamanga |
| maria.ccencho@quinuapata.com       | Quinuapata2024!    | OPERADOR   | Huamanga |
| juan.ccoyllo@quinuapata.com        | Quinuapata2024!    | CONDUCTOR  | Huamanga |
| rosa.sulca@quinuapata.com          | Quinuapata2024!    | OPERADOR   | Kimbiri  |

## Endpoints principales

```
POST /api/auth/login              # Autenticación
GET  /api/viajes                  # Lista viajes
POST /api/pasajes/vender          # Vender pasaje
POST /api/encomiendas             # Registrar encomienda
GET  /api/tracking/{codigo}       # Tracking público (sin auth)
POST /api/caja/abrir              # Abrir turno
POST /api/caja/cerrar             # Cerrar turno
GET  /api/reportes/ventas/excel   # Reporte Excel
GET  /api/auditoria               # Bitácora
```

## Agregar nueva agencia

1. Acceder con rol GERENTE o SUPER_ADMIN
2. Ir a **Gestión → Agencias → Nueva agencia**
3. Completar código, nombre, ciudad, teléfono
4. Crear usuarios para esa agencia asignando el agencia_id

## Rutas configuradas

| Código  | Ruta                          | Combi  | Camioneta |
|---------|-------------------------------|--------|-----------|
| HUA-KIM | Huamanga → Kimbiri            | S/55   | S/90      |
| HUA-PIC | Huamanga → Pichari            | S/55   | S/90      |
| HUA-SFR | Huamanga → San Francisco      | S/50   | S/80      |
| KIM-PIC | Kimbiri → Pichari (tramo)     | S/15   | S/20      |
