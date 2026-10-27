# Deploying to AWS EC2 with Docker

This document describes how to publish the app on an Amazon Linux EC2 instance, running it as a Docker container behind nginx.

> **Prerequisite:** the `Dockerfile`, `nginx.conf`, and `.dockerignore` from [deployment-docker-local.md](deployment-docker-local.md) must exist in the repository. Test them locally first.

This deployment **does not need AWS credentials inside the application or an IAM role on the instance**. The app is static and does not call AWS. EC2 access is only used to administer the server.

## 1. Architecture

```
User ──HTTP/HTTPS──► Elastic IP ──► EC2 (Amazon Linux 2023)
                                     └── Docker
                                          └── cli-command-builder container
                                               └── nginx :80  (serves dist/)
```

Optionally, a domain and an HTTPS proxy sit in front of the container (section 7).

## 2. AWS resources

| Resource | Recommendation | Notes |
|---|---|---|
| Region | The one closest to your users | For example `eu-west-1` or `us-east-1`. |
| Instance | `t3.micro` or `t4g.micro` (ARM) | Enough to serve static files. |
| AMI | Amazon Linux 2023 | Includes `dnf` and supports Docker without extra repositories. |
| Storage | 8 GB gp3 | The image is ~60 MB, not counting the build. |
| IP | Associated Elastic IP | Prevents the IP from changing on restart. |
| Security group | See the table below | |

### Security group

| Type | Port | Source | Reason |
|---|---|---|---|
| SSH | 22 | **Your IP** (`x.x.x.x/32`) | Administration. Never `0.0.0.0/0`. |
| HTTP | 80 | `0.0.0.0/0` | Access to the app. |
| HTTPS | 443 | `0.0.0.0/0` | Only if you configure TLS (section 7). |

If you use an ARM architecture (`t4g`), build the image on that same instance type or use `docker buildx` for `linux/arm64`. An image built on an x86 laptop will not run on ARM without `buildx`.

## 3. Prepare the instance

Connect over SSH (with the key pair chosen when creating the instance):

```bash
ssh -i ~/key.pem ec2-user@<ELASTIC_IP>
```

Install and start Docker:

```bash
sudo dnf update -y
sudo dnf install -y docker git
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user
exit    # log back in so the group change takes effect
```

Check:

```bash
ssh -i ~/key.pem ec2-user@<ELASTIC_IP>
docker info --format '{{.ServerVersion}}'
```

Optional, Docker Compose as a plugin:

```bash
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
docker compose version
```

> For `t4g` use `docker-compose-linux-aarch64`.

## 4. Get the code

Option A: clone from Git:

```bash
git clone https://github.com/<user>/open-cli-builder.git
cd open-cli-builder
```

If the repository is private, use a read-only deploy key or a personal access token with read permission. Do not leave credentials in the repository.

Option B: copy from your machine with `scp` (no Git on the server):

```bash
# From your machine, in the project root
tar --exclude=node_modules --exclude=dist --exclude=.git -czf app.tar.gz .
scp -i ~/key.pem app.tar.gz ec2-user@<ELASTIC_IP>:~
ssh -i ~/key.pem ec2-user@<ELASTIC_IP> 'mkdir -p ~/open-cli-builder && tar -xzf ~/app.tar.gz -C ~/open-cli-builder'
```

## 5. Build and start

On the instance, inside the project folder:

```bash
docker build -t cli-command-builder:latest .
docker run -d \
  --name cli-builder \
  --restart unless-stopped \
  -p 80:80 \
  cli-command-builder:latest
```

- `--restart unless-stopped` brings the container back after the instance or Docker restarts.
- Host port 80 → container port 80.

Open `http://<ELASTIC_IP>` in the browser.

### With Docker Compose

`docker-compose.yml` in the project root:

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

## 6. Update the version

```bash
cd ~/open-cli-builder
git pull                                  # or copy the tar again
docker build -t cli-command-builder:latest .
docker rm -f cli-builder
docker run -d --name cli-builder --restart unless-stopped -p 80:80 cli-command-builder:latest
```

With Compose: `git pull && docker compose up -d --build`.

To roll back, rebuild from the previous commit (`git checkout <commit>`) and repeat the step. It helps to tag images with the commit hash instead of `latest` if you want to go back quickly:

```bash
docker build -t cli-command-builder:$(git rev-parse --short HEAD) .
```

## 7. HTTPS (recommended with your own domain)

Without HTTPS, the page is served in clear text. An attacker on the network could modify the JavaScript the user receives, and that code is what reads the AI keys stored in `localStorage` and sends them to the providers. For that reason TLS is recommended whenever the instance is reachable from the Internet.

A simple option is **Caddy** in front of the container, which obtains a Let's Encrypt certificate automatically:

1. Point a DNS `A` record for your domain to the Elastic IP.
2. Publish the container on an internal port, for example `-p 127.0.0.1:8080:80` instead of `-p 80:80`.
3. Install Caddy on the instance and configure `/etc/caddy/Caddyfile`:

```
your-domain.com {
    reverse_proxy 127.0.0.1:8080
}
```

4. Open port 443 in the security group (section 2).

Alternative: an **AWS Application Load Balancer** with an ACM certificate. It is more expensive and has more moving parts, but it does not require managing certificates on the instance.

## 8. Verification

From your machine:

```bash
curl -I http://<ELASTIC_IP>/                 # 200 OK
curl -I http://<ELASTIC_IP>/catalog.json     # 200 OK, catalog Cache-Control
```

On the instance:

```bash
docker ps                          # the container should show as "Up"
docker logs --tail 50 cli-builder  # no nginx errors
```

- [ ] The page loads the full list of services.
- [ ] The container survives a restart: run `sudo reboot`, then check with `docker ps`.

## 9. Operations

| Task | Command |
|---|---|
| View logs | `docker logs -f cli-builder` |
| Restart | `docker restart cli-builder` |
| Docker disk usage | `docker system df` |
| Remove old images | `docker image prune -f` |
| Docker service status | `sudo systemctl status docker` |

### Backups

The application stores no data on the server. There is nothing to back up from the container. What is worth keeping is the server configuration (`Caddyfile`, `docker-compose.yml`), which lives in the repository.

### Costs

A `t3.micro` or `t4g.micro` may be covered by the AWS free tier depending on the age of the account. Elastic IPs **not associated** with a running instance are charged; always associate them. Check the EC2 pricing page for your region.

## 10. Common problems

| Symptom | Likely cause | Solution |
|---|---|---|
| `Connection timed out` when opening the IP | Security group does not allow port 80 | Review section 2. |
| `permission denied` when running `docker` | The user is not in the `docker` group, or you did not log back in over SSH | `sudo usermod -aG docker ec2-user` and reconnect. |
| `exec format error` | Image built for a different architecture (x86 vs ARM) | Build on the instance's architecture, or use `docker buildx build --platform linux/arm64`. |
| Build is very slow or runs out of memory | Micro instance with little RAM | Add swap (`sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`), or build locally and upload the image. |
| Page loads but without the full catalog | `public/catalog.json` missing from the image | Check `.dockerignore` and that the file is in the repository. |
| Container does not start after a reboot | `--restart unless-stopped` is missing | Recreate the container with that option. |

### Alternative: build locally and upload the image

If the instance is too small to compile, build on your machine and transfer the image:

```bash
docker build -t cli-command-builder:latest .
docker save cli-command-builder:latest | gzip > image.tar.gz
scp -i ~/key.pem image.tar.gz ec2-user@<ELASTIC_IP>:~
ssh -i ~/key.pem ec2-user@<ELASTIC_IP> 'gunzip -c ~/image.tar.gz | docker load'
```

Then start the container as in section 5 (without `--build`). For a cleaner alternative, use a registry such as Amazon ECR.
