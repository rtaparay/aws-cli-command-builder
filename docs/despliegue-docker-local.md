# Despliegue local con Docker

Este documento explica cómo construir y ejecutar la app en un contenedor Docker en tu máquina, para comprobar que el despliegue funciona igual que en producción.

> **Estado de los archivos:** el repositorio **no incluye** todavía `Dockerfile`, `nginx.conf` ni `.dockerignore`. Los contenidos de esos tres archivos están en la sección 2 de este documento. Créalos en la raíz del proyecto antes de seguir. El mismo `Dockerfile` se usa en [despliegue-aws-ec2-docker.md](despliegue-aws-ec2-docker.md).

## 1. Requisitos

| Requisito | Comprobación |
|---|---|
| Docker Engine o Docker Desktop | `docker --version` (cualquier versión reciente) |
| Docker Compose (opcional) | `docker compose version` |
| Puerto 8080 libre | `ss -ltn` o el Administrador de tareas en Windows |

No necesitas Node en tu máquina: la imagen compila la app dentro del contenedor.

En Windows, usa Docker Desktop con el backend WSL 2 (el proyecto está en `C:\…`, pero los comandos de Docker se ejecutan igual desde PowerShell o desde la terminal de WSL).

## 2. Archivos de Docker

### `Dockerfile`

Build en dos etapas: la primera compila con Node; la segunda solo copia `dist/` a un servidor nginx. La imagen final no contiene Node ni el código fuente.

```dockerfile
# Etapa 1: build con Node (versión de .nvmrc)
FROM node:26-alpine AS build
WORKDIR /app

# Primero las dependencias, para aprovechar la caché de capas
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Etapa 2: servidor estático
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```

### `nginx.conf`

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Compresión: catalog.json (~23 MB) se reduce mucho con gzip
    gzip on;
    gzip_comp_level 6;
    gzip_types application/json application/javascript text/css image/svg+xml;

    # Los archivos de assets llevan hash en el nombre: caché larga
    location /assets/ {
        try_files $uri =404;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # Catálogo: misma política que vercel.json
    location = /catalog.json {
        add_header Cache-Control "public, max-age=3600, stale-while-revalidate=86400";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### `.dockerignore`

Evita enviar al contexto de build carpetas pesadas o innecesarias. Sin este archivo, `node_modules` local se copiaría a la imagen.

```
node_modules
dist
.git
.vercel
docs
*.log
```

## 3. Construir la imagen

Desde la raíz del proyecto:

```bash
docker build -t cli-command-builder:local .
```

La primera vez tarda por la descarga de imágenes base y de dependencias. Las siguientes reutilizan la caché si `package-lock.json` no cambia.

## 4. Ejecutar el contenedor

```bash
docker run --rm -d --name cli-builder -p 8080:80 cli-command-builder:local
```

Abre <http://localhost:8080>.

| Opción | Significado |
|---|---|
| `-d` | Ejecuta en segundo plano. |
| `--rm` | Elimina el contenedor al detenerlo. |
| `-p 8080:80` | Puerto 8080 de tu máquina → puerto 80 del contenedor. |

### Comandos útiles

```bash
docker ps                        # contenedores en ejecución
docker logs -f cli-builder       # ver el log de nginx
docker exec -it cli-builder sh   # entrar al contenedor
docker stop cli-builder          # detener (y eliminar, por --rm)
```

## 5. Alternativa con Docker Compose

Crea `docker-compose.yml` en la raíz:

```yaml
services:
  web:
    build: .
    image: cli-command-builder:local
    ports:
      - "8080:80"
    restart: unless-stopped
```

```bash
docker compose up -d --build     # construir y arrancar
docker compose logs -f web       # logs
docker compose down              # detener y eliminar
```

## 6. Ciclo de trabajo

Cada cambio en el código requiere reconstruir la imagen; nginx sirve archivos generados, no el código fuente.

```bash
docker build -t cli-command-builder:local .
docker rm -f cli-builder 2>/dev/null
docker run --rm -d --name cli-builder -p 8080:80 cli-command-builder:local
```

Para desarrollo con recarga automática **no uses el contenedor**: usa `npm run dev`, que es más rápido (ver README, sección 3).

## 7. Verificación

- [ ] `docker build` termina sin errores.
- [ ] <http://localhost:8080> muestra la interfaz con la lista de servicios.
- [ ] `curl -I http://localhost:8080/catalog.json` responde `200 OK` con `Cache-Control: public, max-age=3600…`.
- [ ] `curl -sI -H "Accept-Encoding: gzip" http://localhost:8080/catalog.json` incluye `Content-Encoding: gzip`.
- [ ] Recargar una ruta inexistente (por ejemplo `/prueba`) devuelve la app, no un 404.

## 8. Problemas frecuentes

| Síntoma | Causa | Solución |
|---|---|---|
| `port is already allocated` | El 8080 está ocupado | Usa otro puerto: `-p 8090:80`. |
| `npm ci` falla por el lock | `package-lock.json` no coincide con `package.json` | Ejecuta `npm install` localmente, confirma el cambio y reconstruye. |
| `npm run build` falla por memoria | Poca memoria en Docker Desktop | Sube el límite de memoria en **Settings → Resources** (2 GB basta). |
| La app muestra solo la muestra de servicios | `catalog.json` no se copió | Revisa que `public/catalog.json` exista y no esté en `.dockerignore`. |
| Cambios en `src/` no se ven | La imagen no se reconstruyó | Ejecuta `docker build` de nuevo y reinicia el contenedor. |
| Caché de `catalog.json` en el navegador | Cabecera de 1 h | Recarga forzada (Ctrl+F5). |

## 9. Limpieza

```bash
docker rm -f cli-builder
docker image rm cli-command-builder:local
docker builder prune            # caché de build (libera espacio)
```
