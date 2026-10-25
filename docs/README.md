# Documentación — CLI Command Builder

Índice de la documentación técnica del proyecto. Para una visión general (qué es, funcionalidades, uso), ver el [README.md](../README.md) de la raíz.

| Documento | Contenido |
|---|---|
| [arquitectura.md](arquitectura.md) | Estructura del código, flujo de datos, estado, catálogo y asistente de IA. |
| [despliegue-vercel.md](despliegue-vercel.md) | Publicación como sitio estático en Vercel. |
| [despliegue-docker-local.md](despliegue-docker-local.md) | Construcción y ejecución de la imagen Docker en tu máquina. |
| [despliegue-aws-ec2-docker.md](despliegue-aws-ec2-docker.md) | Despliegue en una instancia EC2 con Docker. |

## Resumen de despliegue

| Objetivo | Documento | Qué necesitas |
|---|---|---|
| Ver la app en desarrollo | README raíz, sección 3 | Node 26, `npm run dev` |
| Publicar en la web pública sin mantener servidores | [despliegue-vercel.md](despliegue-vercel.md) | Cuenta de Vercel y repositorio conectado |
| Probar el contenedor en tu PC | [despliegue-docker-local.md](despliegue-docker-local.md) | Docker |
| Publicar en tu propio servidor AWS | [despliegue-aws-ec2-docker.md](despliegue-aws-ec2-docker.md) | Cuenta AWS, instancia EC2, Docker |

> **Nota:** la app es un sitio **100 % estático**. No tiene backend, base de datos ni variables de entorno obligatorias, y no necesita credenciales de AWS para funcionar. Cualquier hosting de archivos estáticos sirve.
