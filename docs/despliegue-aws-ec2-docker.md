# Despliegue en AWS EC2 con Docker

Este documento describe cómo publicar la app en una instancia EC2 de Amazon Linux, ejecutándola como contenedor Docker detrás de nginx.

> **Requisito previo:** el `Dockerfile`, `nginx.conf` y `.dockerignore` del documento [despliegue-docker-local.md](despliegue-docker-local.md) deben existir en el repositorio. Pruébalos primero en local.

Este despliegue **no necesita credenciales de AWS dentro de la aplicación ni un rol IAM** en la instancia. La app es estática y no llama a AWS. El acceso a EC2 solo se usa para administrar el servidor.

## 1. Arquitectura

```
Usuario ──HTTP/HTTPS──► Elastic IP ──► EC2 (Amazon Linux 2023)
                                        └── Docker
                                             └── contenedor cli-command-builder
                                                  └── nginx :80  (sirve dist/)
```

Opcionalmente, un dominio y un proxy con HTTPS delante del contenedor (sección 7).

## 2. Recursos en AWS

| Recurso | Recomendación | Notas |
|---|---|---|
| Región | La más cercana a tus usuarios | Por ejemplo `eu-west-1` o `us-east-1`. |
| Instancia | `t3.micro` o `t4g.micro` (ARM) | Suficiente para servir archivos estáticos. |
| AMI | Amazon Linux 2023 | Incluye `dnf` y soporta Docker sin repositorios extra. |
| Almacenamiento | 8 GB gp3 | La imagen ocupa ~60 MB sin contar el build. |
| IP | Elastic IP asociada | Evita que cambie la IP al reiniciar. |
| Grupo de seguridad | Ver tabla siguiente | |

### Grupo de seguridad

| Tipo | Puerto | Origen | Motivo |
|---|---|---|---|
| SSH | 22 | **Tu IP** (`x.x.x.x/32`) | Administración. Nunca `0.0.0.0/0`. |
| HTTP | 80 | `0.0.0.0/0` | Acceso a la app. |
| HTTPS | 443 | `0.0.0.0/0` | Solo si configuras TLS (sección 7). |

Si usas una arquitectura ARM (`t4g`), construye la imagen en ese mismo tipo de instancia o usa `docker buildx` para `linux/arm64`. Un build hecho en un portátil x86 no se ejecuta en ARM sin `buildx`.

## 3. Preparar la instancia

Conecta por SSH (con la clave del par de claves elegido al crear la instancia):

```bash
ssh -i ~/clave.pem ec2-user@<ELASTIC_IP>
```

Instala y arranca Docker:

```bash
sudo dnf update -y
sudo dnf install -y docker git
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user
exit    # vuelve a entrar para que el grupo surta efecto
```

Comprueba:

```bash
ssh -i ~/clave.pem ec2-user@<ELASTIC_IP>
docker info --format '{{.ServerVersion}}'
```

Opcional, Docker Compose como plugin:

```bash
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
docker compose version
```

> Para `t4g` usa `docker-compose-linux-aarch64`.

## 4. Obtener el código

Opción A: clonar desde Git:

```bash
git clone https://github.com/<usuario>/aws-cli-command-builder.git
cd aws-cli-command-builder
```

Si el repositorio es privado, usa una clave de despliegue (*deploy key*) de solo lectura o un token de acceso personal con permiso de lectura. No dejes credenciales en el repositorio.

Opción B: copiar desde tu máquina con `scp` (sin Git en el servidor):

```bash
# Desde tu máquina, en la raíz del proyecto
tar --exclude=node_modules --exclude=dist --exclude=.git -czf app.tar.gz .
scp -i ~/clave.pem app.tar.gz ec2-user@<ELASTIC_IP>:~
ssh -i ~/clave.pem ec2-user@<ELASTIC_IP> 'mkdir -p ~/aws-cli-command-builder && tar -xzf ~/app.tar.gz -C ~/aws-cli-command-builder'
```

## 5. Construir y arrancar

En la instancia, dentro de la carpeta del proyecto:

```bash
docker build -t cli-command-builder:latest .
docker run -d \
  --name cli-builder \
  --restart unless-stopped \
  -p 80:80 \
  cli-command-builder:latest
```

- `--restart unless-stopped` hace que el contenedor se levante tras reiniciar la instancia o Docker.
- Puerto 80 del host → puerto 80 del contenedor.

Abre `http://<ELASTIC_IP>` en el navegador.

### Con Docker Compose

`docker-compose.yml` en la raíz del proyecto:

```yaml
services:
  web:
    build: .
    image: cli-command-builder:latest
    ports:
      - "80:80"
    restart: unless-stopped
```

```bash
docker compose up -d --build
```

## 6. Actualizar la versión

```bash
cd ~/aws-cli-command-builder
git pull                                  # o volver a copiar el tar
docker build -t cli-command-builder:latest .
docker rm -f cli-builder
docker run -d --name cli-builder --restart unless-stopped -p 80:80 cli-command-builder:latest
```

Con Compose: `git pull && docker compose up -d --build`.

Para revertir, reconstruye desde el commit anterior (`git checkout <commit>`) y repite el paso. Conviene etiquetar las imágenes con el hash de commit en lugar de `latest` si quieres volver atrás rápido:

```bash
docker build -t cli-command-builder:$(git rev-parse --short HEAD) .
```

## 7. HTTPS (recomendado con dominio propio)

Sin HTTPS, la página se sirve en claro. Un atacante en la red podría modificar el código JavaScript que recibe el usuario, y ese código es el que lee las claves de IA guardadas en `localStorage` y las envía a los proveedores. Por eso se recomienda TLS siempre que la instancia sea accesible desde Internet.

Una forma sencilla es **Caddy** delante del contenedor, que obtiene el certificado de Let's Encrypt automáticamente:

1. Apunta un registro DNS `A` de tu dominio a la Elastic IP.
2. Publica el contenedor en un puerto interno, por ejemplo `-p 127.0.0.1:8080:80` en lugar de `-p 80:80`.
3. Instala Caddy en la instancia y configura `/etc/caddy/Caddyfile`:

```
tu-dominio.com {
    reverse_proxy 127.0.0.1:8080
}
```

4. Abre el puerto 443 en el grupo de seguridad (sección 2).

Alternativa: **AWS Application Load Balancer** con certificado de ACM. Es más cara y tiene más piezas, pero no requiere gestionar certificados en la instancia.

## 8. Verificación

Desde tu máquina:

```bash
curl -I http://<ELASTIC_IP>/                 # 200 OK
curl -I http://<ELASTIC_IP>/catalog.json     # 200 OK, Cache-Control de catálogo
```

En la instancia:

```bash
docker ps                          # el contenedor debe aparecer como "Up"
docker logs --tail 50 cli-builder  # sin errores de nginx
```

- [ ] La página carga la lista completa de servicios.
- [ ] El contenedor sobrevive a un reinicio: `sudo reboot` y comprobar con `docker ps`.

## 9. Operación

| Tarea | Comando |
|---|---|
| Ver logs | `docker logs -f cli-builder` |
| Reiniciar | `docker restart cli-builder` |
| Uso de disco de Docker | `docker system df` |
| Limpiar imágenes antiguas | `docker image prune -f` |
| Estado del servicio Docker | `sudo systemctl status docker` |

### Copias de seguridad

La aplicación no guarda datos en el servidor. No hay nada que respaldar del contenedor. Lo que sí conviene conservar es la configuración del servidor (`Caddyfile`, `docker-compose.yml`), que está en el repositorio.

### Costes

Una instancia `t3.micro` o `t4g.micro` puede estar cubierta por la capa gratuita de AWS según la antigüedad de la cuenta. Las Elastic IP **no asociadas** a una instancia en ejecución tienen coste; asóciala siempre. Revisa la página de precios de EC2 para tu región.

## 10. Problemas frecuentes

| Síntoma | Causa probable | Solución |
|---|---|---|
| `Connection timed out` al abrir la IP | El grupo de seguridad no permite el puerto 80 | Revisa la sección 2. |
| `permission denied` al ejecutar `docker` | El usuario no está en el grupo `docker` o no se volvió a entrar por SSH | `sudo usermod -aG docker ec2-user` y reconectar. |
| `exec format error` | Imagen construida para otra arquitectura (x86 vs ARM) | Construye en la misma arquitectura de la instancia o usa `docker buildx build --platform linux/arm64`. |
| Build muy lento o se queda sin memoria | Instancia micro con poca RAM | Añade swap (`sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`) o construye en local y sube la imagen. |
| La página carga pero sin catálogo completo | `public/catalog.json` ausente en la imagen | Revisa `.dockerignore` y que el archivo esté en el repositorio. |
| Contenedor no arranca tras reinicio | Falta `--restart unless-stopped` | Vuelve a crear el contenedor con esa opción. |

### Alternativa: construir en local y subir la imagen

Si la instancia es muy pequeña para compilar, construye en tu máquina y transfiere la imagen:

```bash
docker build -t cli-command-builder:latest .
docker save cli-command-builder:latest | gzip > imagen.tar.gz
scp -i ~/clave.pem imagen.tar.gz ec2-user@<ELASTIC_IP>:~
ssh -i ~/clave.pem ec2-user@<ELASTIC_IP> 'gunzip -c ~/imagen.tar.gz | docker load'
```

Luego arranca el contenedor como en la sección 5 (sin `--build`). Para una alternativa más limpia, usa un registro como Amazon ECR.
