# Arquitectura

Este documento describe cómo está organizado el código, cómo fluyen los datos y qué decisiones de diseño se tomaron. Para la lista de funcionalidades de cara al usuario, ver el [README.md](../README.md).

## 1. Visión general

```
┌──────────────────────────────── Navegador ────────────────────────────────┐
│                                                                           │
│  index.html → main.jsx → App.jsx (estado global)                          │
│                              │                                            │
│        ┌─────────────────────┼──────────────────────┐                     │
│        ▼                     ▼                      ▼                     │
│  Panel de servicios   Panel de comandos     Panel de detalle              │
│  (ServicePane)        (CommandPane)         (CommandDetail / Home)        │
│                                                    │                     │
│                                   ┌────────────────┴───────────┐         │
│                                   ▼                            ▼         │
│                           Generación del comando      Asistente IA      │
│                           (lib/command.js)            (hooks + lib/ai)  │
│                                                                           │
│  localStorage  ◄── preferencias, claves API, opciones globales            │
└───────────────┬──────────────────────────────────────┬────────────────────┘
                │ GET /catalog.json                    │ fetch directo
                ▼                                      ▼
        Servidor estático                 API del proveedor de IA
   (Vercel, Docker/nginx, …)         (Gemini, Anthropic, OpenAI, local)
```

Características clave:

- **Sin backend propio.** Todo el código se ejecuta en el navegador. El servidor solo entrega archivos estáticos.
- **El asistente llama directamente a la API del proveedor** desde el navegador. No hay proxy intermedio.
- **La app no ejecuta comandos ni se conecta a AWS.** Solo genera texto.

## 2. Stack tecnológico

| Capa | Tecnología | Versión (`package.json`) |
|---|---|---|
| UI | React | 19.3.x |
| Build y servidor de desarrollo | Vite | 8.3.x |
| Plugin de React para Vite | `@vitejs/plugin-react` | 6.1.x |
| Estilos | CSS puro con variables (tokens de color) | — |
| Fuentes | Google Fonts (Space Grotesk, IBM Plex Mono) | — |
| Runtime de build | Node.js 26 (`.nvmrc`, `engines`) | — |

No hay librerías de estado, de enrutamiento ni de componentes. El proyecto usa únicamente React y Vite.

## 3. Estructura del repositorio

| Ruta | Responsabilidad |
|---|---|
| `index.html` | Plantilla HTML. Carga las fuentes de Google y el punto de entrada `src/main.jsx`. |
| `src/main.jsx` | Monta `<App />` en `#root` dentro de `StrictMode` e importa los estilos. |
| `src/App.jsx` | Componente raíz. Contiene el estado global de la aplicación y coordina los paneles. |
| `src/components/` | Componentes de interfaz (ver sección 4). |
| `src/hooks/useAssistant.js` | Estado y lógica del chat con el asistente de IA. |
| `src/lib/` | Lógica pura y utilidades sin React (ver sección 5). |
| `src/data/sampleCatalog.js` | Muestra de catálogo incluida en el bundle, usada como respaldo. |
| `src/styles.css` | Estilos, tokens de color para tema claro y oscuro, y layout responsive. |
| `public/catalog.json` | Catálogo completo de AWS CLI v2 (~23 MB). Se copia tal cual a la raíz del sitio. |
| `dist/` | Salida de `npm run build`. **No se versiona** (está en `.gitignore`). |
| `vite.config.js` | Configuración de Vite: solo el plugin de React. |
| `vercel.json` | Configuración de Vercel: comando de build, carpeta de salida y caché de `catalog.json`. |
| `.nvmrc` | Versión de Node usada en el proyecto (`26`). |

## 4. Componentes

Árbol de componentes:

```
App
├── Topbar                 búsqueda global, tema, panel de sidebar, opciones globales
├── shell
│   ├── ServicePane        lista de servicios con filtro
│   ├── CommandPane        lista de comandos del servicio (o resultados de búsqueda)
│   └── section.detail
│       ├── CommandDetail  formulario de parámetros + vista previa + copiar
│       └── Home           resumen del catálogo + AssistantCard
├── GlobalOptions          modal con las opciones globales de la CLI
└── toast                  notificación breve al copiar
```

| Componente | Función |
|---|---|
| `Topbar` | Campo de búsqueda global, botón de tema claro/oscuro, mostrar/ocultar sidebar, abrir opciones globales. |
| `ServicePane` | Lista de servicios del catálogo, con filtro por texto. |
| `CommandPane` | Lista de comandos. Recibe `items` ya filtrados desde `App`. |
| `CommandDetail` | Formulario dinámico generado a partir de `required` y `optional` del comando. Muestra la línea de comando en vivo. |
| `Home` | Pantalla inicial sin servicio seleccionado: resumen y asistente. |
| `AssistantCard` | Interfaz del chat: mensajes, entrada, configuración del proveedor. |
| `GlobalOptions` | Modal para fijar las opciones que se añaden a todo comando. |
| `Icons` | Iconos SVG en componentes de función. |

Todos los componentes son **presentacionales**: reciben datos y callbacks por props. La excepción es `useAssistant`, que es un hook con estado propio.

## 5. Módulos de `src/lib/` y hooks

| Módulo | Responsabilidad |
|---|---|
| `command.js` | Construye el comando: `commandParts`, `previewPlain` y `missingCount`. Los parámetros requeridos sin valor se muestran como `<value>`. |
| `globalOptions.js` | Define `GLOBAL_OPTS` (las 17 opciones globales), carga y guarda sus valores, y los convierte en partes del comando con `globalParts`. |
| `ai.js` | Proveedores de IA (`AI_PROVIDERS`), prompt de sistema y adaptadores HTTP para Claude, Gemini y OpenAI/compatibles. Expone `askAssistant`. |
| `storage.js` | `readStorage` / `writeStorage` que nunca lanzan excepciones (modo privado, cuota llena, acceso bloqueado). |
| `clipboard.js` | `copyText`: usa `navigator.clipboard` y, si falla, un `textarea` oculto con `execCommand("copy")`. |
| `hooks/useAssistant.js` | Mensajes, borrador, estado de envío, y carga/guardado de la configuración del proveedor. |

### Formación del comando

`previewPlain(svc, cmd, values, globals)` produce la línea final:

```
aws <servicio> <comando> [parámetros requeridos] [parámetros opcionales con valor] [opciones globales]
```

- Los requeridos siempre aparecen; si están vacíos se muestran como `<value>`.
- Los opcionales solo aparecen si tienen valor.
- Las opciones globales se añaden al final, en el orden de `GLOBAL_OPTS`. Las booleanas no llevan valor.

## 6. Estado y flujo de datos

Todo el estado de navegación vive en `App.jsx`. No se usa Context ni Redux.

| Estado | Tipo | Significado |
|---|---|---|
| `catalog` | `Service[]` | Catálogo activo. Empieza con `SAMPLE_CATALOG`. |
| `activeSvc` / `activeCmd` | objeto o `null` | Servicio y comando seleccionados. |
| `values` | `{ [flag]: string }` | Valores escritos en el formulario del comando activo. |
| `search` / `svcFilter` / `cmdFilter` | `string` | Filtros de búsqueda global y de cada panel. |
| `globals` | `{ [flag]: valor }` | Opciones globales. Persisten en `localStorage`. |
| `theme` | `'light' \| 'dark' \| null` | `null` sigue la preferencia del sistema. |
| `sidebarHidden`, `goptsOpen`, `toast` | varios | Estado de la interfaz. |

### Ciclo de carga del catálogo

1. Al montar, el catálogo es `SAMPLE_CATALOG` (unos pocos servicios incluidos en el bundle). La app es usable de inmediato.
2. Se hace `fetch(import.meta.env.BASE_URL + 'catalog.json')`.
3. Si la respuesta es correcta y tiene `services` no vacío, reemplaza el catálogo y reinicia la selección.
4. Si falla (sin red, `file://`, error HTTP), **se conserva la muestra** sin mostrar error.

### Reglas de selección

- Una búsqueda global (`search`) tiene prioridad y busca en todos los servicios.
- Si no hay búsqueda, se muestran los comandos del servicio activo.
- Si el comando activo deja de estar visible tras un filtro, `App` selecciona automáticamente el primero de la lista.
- Cambiar un filtro borra los valores del formulario para no mezclar parámetros de comandos distintos.
- La clave del `CommandDetail` (`servicio/comando`) fuerza un formulario nuevo al cambiar de comando.

### Adaptación a pantallas estrechas

Por debajo de 1040 px (`NARROW_QUERY`), al elegir un servicio o comando la app hace scroll suave hacia el panel correspondiente. El diseño de tres columnas se apila en vertical.

## 7. Catálogo (`catalog.json`)

### Formato

```json
{
  "generated_from": "botocore 1.43.118",
  "services": [
    {
      "id": "ec2",
      "name": "Amazon Elastic Compute Cloud",
      "commands": [
        {
          "name": "describe-instances",
          "desc": "…",
          "required": [ { "flag": "--…", "type": "…", "desc": "…" } ],
          "optional": [ { "flag": "--…", "type": "…", "desc": "…" } ]
        }
      ]
    }
  ]
}
```

- `id` es el identificador que usa la CLI (`aws <id> …`).
- `type` describe el valor esperado (`string`, `integer`, `boolean`, `list<string>`, `list<structure>`…). La interfaz lo muestra como ayuda; no hay validación estricta del valor.
- Tamaño: ~23 MB, 435 servicios y 19 437 comandos (según el README).

### Origen y regeneración

El catálogo se genera a partir de los modelos de servicio de **botocore**, la librería que usa AWS CLI v2. La versión de origen está en `generated_from`. **El script generador no está en el repositorio**, por lo que actualizar el catálogo requiere volver a generarlo manualmente.

### Por qué existe `sampleCatalog.js`

Para que la app funcione sin red o en `file://`, donde el `fetch` del catálogo falla. Es un subconjunto pequeño y no se mantiene a la par del catálogo completo.

## 8. Asistente de IA

### Flujo

```
UI (AssistantCard)
   │  send()
   ▼
useAssistant ──► askAssistant(config, messages)   [lib/ai.js]
                    │
                    ├── claude  → POST api.anthropic.com/v1/messages
                    ├── gemini  → POST generativelanguage.googleapis.com/…:generateContent
                    └── openai / custom → POST {base}/chat/completions
```

- Cada proveedor tiene su propio formato de petición. Los tres reciben el mismo `SYSTEM_PROMPT`, que limita las respuestas a comandos de AWS CLI v2.
- Se envía **todo el historial** de la conversación en cada petición.
- `max_tokens` está fijado a 1024 solo para Claude.
- Los errores HTTP se convierten en un mensaje de error en el chat (primeros 240 caracteres de la respuesta).

### Configuración y almacenamiento

| Clave en `localStorage` | Contenido |
|---|---|
| `cli-ai-provider` | Proveedor activo. |
| `cli-ai-key-<proveedor>` | Clave API de ese proveedor. |
| `cli-ai-model-<proveedor>` | Modelo elegido. |
| `cli-ai-base-<proveedor>` | URL base (solo para `custom`). |

Si no hay clave y el proveedor no es `custom`, el chat muestra un aviso y abre la configuración sin llamar a la API.

### Seguridad

- Las claves se guardan **en texto plano** en `localStorage`. Cualquier script que se ejecute en el mismo origen puede leerlas.
- Las peticiones salen desde el navegador del usuario, así que la clave viaja en las cabeceras de esa petición. Se usa la cabecera `anthropic-dangerous-direct-browser-access` porque Anthropic la requiere para llamadas desde navegador.
- El proveedor `custom` (por ejemplo Ollama en `http://localhost:11434/v1`) no requiere clave.

## 9. Estilos y tema

- Los colores están definidos como variables CSS en `:root` y se redefinen para el tema oscuro.
- El tema se aplica con el atributo `data-theme` en `<html>`. Sin valor guardado, se sigue `prefers-color-scheme`.
- El layout es una cuadrícula de tres paneles con un breakpoint en 1040 px.

## 10. Persistencia en el navegador

| Clave | Uso | Módulo |
|---|---|---|
| `cli-globals` | Opciones globales. | `globalOptions.js` |
| `cli-theme` | Tema elegido. | `App.jsx` |
| `cli-ai-*` | Configuración del asistente. | `hooks/useAssistant.js` |

Todas las lecturas y escrituras pasan por `storage.js`, que tolera fallos.

## 11. Limitaciones conocidas

- Sin catálogo completo, solo está disponible la muestra incluida.
- No hay validación de valores según el `type` del parámetro.
- La app no lee el historial real de la CLI ni la configuración de perfiles del usuario.
- El catálogo es estático: no se actualiza con nuevas versiones de AWS CLI hasta regenerarlo.

## 12. Dónde extender

| Para… | Tocar |
|---|---|
| Añadir un proveedor de IA | `AI_PROVIDERS` y una función `askX` en `lib/ai.js`; la UI de `AssistantCard` debe reconocerlo. |
| Añadir una opción global | Una entrada en `GLOBAL_OPTS` (`lib/globalOptions.js`). El modal y la línea de comando la toman solos. |
| Cambiar el formato del comando | `lib/command.js`. |
| Cambiar la regla de selección o búsqueda | `App.jsx` (`items`, `useEffect` de selección). |
| Añadir un color o tema | Variables en `src/styles.css`. |
