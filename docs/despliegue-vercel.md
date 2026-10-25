# Despliegue en Vercel

La app es un sitio estático generado por Vite. Vercel la construye y la sirve desde su CDN, sin necesidad de servidor propio.

## 1. Configuración del proyecto

El repositorio ya incluye `vercel.json`:

| Ajuste | Valor | Dónde |
|---|---|---|
| Framework | `vite` | `vercel.json` |
| Comando de build | `npm run build` | `vercel.json` |
| Instalación | `npm install` | `vercel.json` |
| Carpeta de salida | `dist` | `vercel.json` |
| URLs sin extensión | activadas (`cleanUrls`) | `vercel.json` |
| Caché de `catalog.json` | `public, max-age=3600, stale-while-revalidate=86400` | `vercel.json` |
| Versión de Node | 26 | `.nvmrc` y `engines` de `package.json` |

Con esto no hace falta configurar nada manualmente en el panel de Vercel.

## 2. Primer despliegue

### Opción A: desde el panel web (recomendada)

1. Sube el repositorio a GitHub, GitLab o Bitbucket.
2. En [vercel.com](https://vercel.com), pulsa **Add New → Project** e importa el repositorio.
3. Vercel detecta Vite. Revisa que los campos coincidan con la tabla anterior y pulsa **Deploy**.
4. Al terminar, obtienes una URL `https://<proyecto>.vercel.app`.

### Opción B: desde la CLI

```bash
npm install -g vercel
cd aws-cli-command-builder
vercel login
vercel              # primer despliegue (preview)
vercel --prod       # despliegue a producción
```

La CLI pide confirmar el proyecto y la configuración la primera vez y guarda el enlace en `.vercel/` (esa carpeta no debe versionarse; añádela a `.gitignore` si Vercel no lo hizo ya).

## 3. Despliegues continuos

Si el proyecto está conectado a Git:

| Evento | Resultado |
|---|---|
| Push a la rama de producción (normalmente `main`) | Despliegue de **producción**. |
| Push a otra rama o Pull Request | **Preview** con URL propia. |

Cada despliegue es inmutable: puedes volver a una versión anterior desde **Deployments → ⋯ → Promote to Production** (o *Rollback*).

## 4. Dominio propio

1. En el proyecto, ve a **Settings → Domains** y añade tu dominio.
2. Configura el DNS según indique Vercel (un registro `A` o `CNAME`).
3. Vercel emite el certificado HTTPS automáticamente.

## 5. Verificación tras desplegar

Comprueba lo siguiente en la URL publicada:

- [ ] La página carga y muestra la lista de servicios (no solo la muestra de pocos servicios). Si solo ves unos pocos, el `catalog.json` no se está cargando; revisa la pestaña **Network** del navegador.
- [ ] `https://<tu-url>/catalog.json` responde `200` y devuelve JSON.
- [ ] La cabecera `Cache-Control` de `catalog.json` es la de `vercel.json`.
- [ ] Al recargar una URL cualquiera no aparece un error 404 (la app no usa rutas, pero el hosting debe servir `index.html`).
- [ ] El tema claro/oscuro y el botón de copiar funcionan.

## 6. Consideraciones específicas

- **Tamaño del catálogo:** `catalog.json` pesa ~23 MB. Vercel lo comprime en tránsito, pero la primera carga puede tardar en conexiones lentas. Las cargas siguientes salen de caché del navegador.
- **Límites:** el plan gratuito de Vercel cubre sobradamente un sitio estático de este tipo. Los límites de ancho de banda y de builds están en la documentación de Vercel; revísalos si el tráfico crece.
- **Claves de IA:** las claves que el usuario introduce en el asistente se guardan en su navegador. **No** configures claves de proveedores como variables de entorno de Vercel: el código las leería desde el bundle público.
- **Variables de entorno:** la app no necesita ninguna.

## 7. Problemas frecuentes

| Síntoma | Causa probable | Solución |
|---|---|---|
| Error de build "command not found" | Versión de Node distinta | Vercel usa la versión de `.nvmrc` / `engines`. Confirma que el proyecto no fuerza otra versión en **Settings → Node.js Version**. |
| La página carga pero sin catálogo completo | `public/catalog.json` no se subió al repositorio, o el `.gitignore` lo excluye | Verifica con `git ls-files public/catalog.json`. |
| Despliegue lento o rechazado por tamaño | Artefactos grandes | `dist/` contiene `catalog.json` (~23 MB). Si el límite te afecta, considera comprimirlo o dividirlo por servicio (ver README, sección de mejoras). |
| Cambios no visibles tras desplegar | Caché del navegador de `catalog.json` (1 h) | Fuerza recarga (Ctrl+F5) o espera. |

## 8. Desplegar desde local sin Git

```bash
npm ci
npm run build
npx vercel deploy dist --prod
```

Subir `dist/` directamente funciona, pero entonces `vercel.json` no se aplica (incluido `cleanUrls` y la caché). Para un despliegue equivalente a producción, desplegar desde la raíz del proyecto con `vercel --prod` es lo recomendado.
