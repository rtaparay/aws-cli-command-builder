# Open CLI Builder — AWS + Azure

Constructor de comandos `aws …` y `az …` paso a paso. Misma arquitectura que la versión AWS (estado único en `app.js`, `update()` → `render()`, sin frameworks).

## Ejecutar

Sirve la carpeta con cualquier servidor estático (los catálogos se cargan con `fetch`):

```
python -m http.server 8080
```

Abre http://localhost:8080. Si abres `index.html` directo (file://), se usan los catálogos de muestra.

## Qué cambió

| Archivo | Cambio |
| --- | --- |
| `js/lib/clouds.js` | **Nuevo.** Registro de nubes (CLI, catálogo, fuente, logo). Agregar otra nube = una entrada aquí. |
| `js/data/azureSampleCatalog.js` | **Nuevo.** Muestra de Azure (respaldo si falta `azure-catalog.json`). |
| `azure-catalog.json` | **Nuevo.** Catálogo completo: 91 servicios, 6.029 comandos (azure-cli 2.91.0). |
| `tools/gen_azure_catalog.py` | **Nuevo.** Regenera `azure-catalog.json`: `pip install azure-cli && python tools/gen_azure_catalog.py azure-catalog.json` |
| `js/app.js` | Catálogos por nube, filtro de nube (se recuerda), menú de nubes con totales, servicios agrupados por nube, carga de ambos catálogos. |
| `js/lib/command.js` | El binario sale del servicio (`aws` / `az`). |
| `js/lib/globalOptions.js` | Opciones globales por nube (AWS conserva la clave `cli-globals`). |
| `js/lib/ai.js`, `js/ui/assistant.js` | Prompt por nube y selector AWS/Azure en el asistente. |
| `js/ui/home.js` | Inicio general con tarjeta por nube; inicio por nube con estadísticas y cuadrícula de servicios. |
| `js/ui/detail.js` | Migas con nube/servicio y nota según la nube. |
| `css/styles.css` | Acento por nube (`html[data-cloud]`), componentes nuevos, arreglos de desbordamiento en móvil. |

## Próximamente: OCI y GCP

Oracle Cloud (OCI) y Google Cloud (GCP) aparecen en el menú lateral (sección "Próximamente") y como tarjetas en el inicio. Al hacer clic muestran "Próximamente se va a agregar". Para activarlas cuando tengas su catálogo: en `js/lib/clouds.js` quita `soon: true` y agrega `catalogUrl`, `source`, `sourceSub` y `searchHint`; luego añade su muestra en `js/data/`, sus opciones globales en `globalOptions.js`, su prompt en `ai.js` y su paleta (`--oci-accent`, etc.) en `styles.css`.

## Logos oficiales

Las marcas "AWS" y "Az" son insignias de texto. Para usar los logos oficiales, descárgalos de las páginas de iconos de arquitectura de AWS y Azure, guárdalos en `assets/logos/` y define `logo` en `js/lib/clouds.js`.
