# Local deployment with Docker

This document explains how to build and run the app in a Docker container on your machine, so you can verify that the deployment works the same way as in production.

> **File status:** the repository **does not yet include** a `Dockerfile`, `nginx.conf`, or `.dockerignore`. Their contents are in section 2 of this document. Create those three files in the project root before continuing. The same `Dockerfile` is used in [deployment-aws-ec2-docker.md](deployment-aws-ec2-docker.md).

## 1. Requirements

| Requirement | Check |
|---|---|
| Docker Engine or Docker Desktop | `docker --version` (any recent version) |
| Docker Compose (optional) | `docker compose version` |
| Port 8080 free | `ss -ltn`, or Task Manager on Windows |

You do not need Node on your machine: the image builds the app inside the container.

On Windows, use Docker Desktop with the WSL 2 backend (the project lives under `C:\…`, but the Docker commands work the same from PowerShell or from a WSL terminal).

## 2. Docker files

### `Dockerfile`

Two-stage build: the first stage compiles with Node; the second stage only copies `dist/` into an nginx server. The final image contains neither Node nor the source code.

```dockerfile
# Stage 1: build with Node (version from .nvmrc)
FROM node:26-alpine AS build
WORKDIR /app

# Dependencies first, to take advantage of layer caching
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: static server
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

    # Compression: catalog.json (~23 MB) shrinks a lot with gzip
    gzip on;
    gzip_comp_level 6;
    gzip_types application/json application/javascript text/css image/svg+xml;

    # Asset files carry a hash in their name: long cache
    location /assets/ {
        try_files $uri =404;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # Catalog: same policy as vercel.json
    location = /catalog.json {
        add_header Cache-Control "public, max-age=3600, stale-while-revalidate=86400";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### `.dockerignore`

Keeps heavy or unnecessary folders out of the build context. Without this file, a local `node_modules` would be copied into the image.

```
node_modules
dist
.git
.vercel
docs
*.log
```

## 3. Build the image

From the project root:

```bash
docker build -t cli-command-builder:local .
```

The first build is slow because of base image downloads and dependency installation. Later builds reuse the cache as long as `package-lock.json` does not change.

## 4. Run the container

```bash
docker run --rm -d --name cli-builder -p 8080:80 cli-command-builder:local
```

Open <http://localhost:8080>.

| Option | Meaning |
|---|---|
| `-d` | Runs in the background. |
| `--rm` | Removes the container when it stops. |
| `-p 8080:80` | Port 8080 on your machine → port 80 in the container. |

### Useful commands

```bash
docker ps                        # running containers
docker logs -f cli-builder       # nginx log
docker exec -it cli-builder sh   # open a shell in the container
docker stop cli-builder          # stop (and remove, because of --rm)
```

## 5. Alternative with Docker Compose

Create `docker-compose.yml` in the project root:

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
docker compose up -d --build     # build and start
docker compose logs -f web       # logs
docker compose down              # stop and remove
```

## 6. Working cycle

Every code change requires rebuilding the image; nginx serves generated files, not the source code.

```bash
docker build -t cli-command-builder:local .
docker rm -f cli-builder 2>/dev/null
docker run --rm -d --name cli-builder -p 8080:80 cli-command-builder:local
```

For development with automatic reload, **do not use the container**: use `npm run dev`, which is faster (see the README, section 3).

## 7. Verification

- [ ] `docker build` finishes without errors.
- [ ] <http://localhost:8080> shows the interface with the list of services.
- [ ] `curl -I http://localhost:8080/catalog.json` returns `200 OK` with `Cache-Control: public, max-age=3600…`.
- [ ] `curl -sI -H "Accept-Encoding: gzip" http://localhost:8080/catalog.json` includes `Content-Encoding: gzip`.
- [ ] Requesting a nonexistent path (for example `/test`) returns the app, not a 404.

## 8. Common problems

| Symptom | Cause | Solution |
|---|---|---|
| `port is already allocated` | Port 8080 is in use | Use another port: `-p 8090:80`. |
| `npm ci` fails because of the lock file | `package-lock.json` does not match `package.json` | Run `npm install` locally, commit the change, and rebuild. |
| `npm run build` fails due to memory | Not enough memory in Docker Desktop | Raise the limit in **Settings → Resources** (2 GB is enough). |
| The app shows only the sample services | `catalog.json` was not copied | Check that `public/catalog.json` exists and is not in `.dockerignore`. |
| Changes in `src/` do not show up | The image was not rebuilt | Run `docker build` again and restart the container. |
| `catalog.json` cached in the browser | One-hour header | Force reload (Ctrl+F5). |

## 9. Cleanup

```bash
docker rm -f cli-builder
docker image rm cli-command-builder:local
docker builder prune            # build cache (frees space)
```
