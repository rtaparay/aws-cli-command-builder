# Architecture

This document describes how the code is organized, how data flows, and which design decisions were made. For the user-facing feature list, see the [README.md](../README.md).

## 1. Overview

```
┌──────────────────────────────── Browser ──────────────────────────────────┐
│                                                                           │
│  index.html → main.jsx → App.jsx (global state)                           │
│                              │                                            │
│        ┌─────────────────────┼──────────────────────┐                     │
│        ▼                     ▼                      ▼                     │
│  Service panel        Command panel         Detail panel                 │
│  (ServicePane)        (CommandPane)         (CommandDetail / Home)        │
│                                                    │                     │
│                                   ┌────────────────┴───────────┐         │
│                                   ▼                            ▼         │
│                           Command generation          AI assistant      │
│                           (lib/command.js)            (hooks + lib/ai)  │
│                                                                           │
│  localStorage  ◄── preferences, API keys, global options                  │
└───────────────┬──────────────────────────────────────┬────────────────────┘
                │ GET /catalog.json                    │ direct fetch
                ▼                                      ▼
        Static server                     AI provider API
   (Vercel, Docker/nginx, …)         (Gemini, Anthropic, OpenAI, local)
```

Key characteristics:

- **No backend of its own.** All code runs in the browser. The server only delivers static files.
- **The assistant calls the provider's API directly** from the browser. There is no intermediate proxy.
- **The app does not execute commands or connect to AWS.** It only generates text.

## 2. Technology stack

| Layer | Technology | Version (`package.json`) |
|---|---|---|
| UI | React | 19.3.x |
| Build and dev server | Vite | 8.3.x |
| React plugin for Vite | `@vitejs/plugin-react` | 6.1.x |
| Styles | Plain CSS with variables (color tokens) | — |
| Fonts | Google Fonts (Space Grotesk, IBM Plex Mono) | — |
| Build runtime | Node.js 26 (`.nvmrc`, `engines`) | — |

There are no state, routing, or component libraries. The project uses only React and Vite.

## 3. Repository structure

| Path | Responsibility |
|---|---|
| `index.html` | HTML template. Loads the Google Fonts and the entry point `src/main.jsx`. |
| `src/main.jsx` | Mounts `<App />` into `#root` inside `StrictMode` and imports the styles. |
| `src/App.jsx` | Root component. Holds the global application state and coordinates the panels. |
| `src/components/` | UI components (see section 4). |
| `src/hooks/useAssistant.js` | State and logic for the AI assistant chat. |
| `src/lib/` | Pure logic and utilities without React (see section 5). |
| `src/data/awsSampleCatalog.js` | Sample catalog bundled into the build, used as a fallback. |
| `src/styles.css` | Styles, color tokens for light and dark themes, and responsive layout. |
| `public/catalog.json` | Full AWS CLI v2 catalog (~23 MB). Copied as-is to the site root. |
| `dist/` | Output of `npm run build`. **Not versioned** (it is in `.gitignore`). |
| `vite.config.js` | Vite configuration: only the React plugin. |
| `vercel.json` | Vercel configuration: build command, output folder, and `catalog.json` caching. |
| `.nvmrc` | Node version used by the project (`26`). |

## 4. Components

Component tree:

```
App
├── Topbar                 global search, theme, sidebar toggle, global options
├── shell
│   ├── ServicePane        list of services with filter
│   ├── CommandPane        list of commands for the service (or search results)
│   └── section.detail
│       ├── CommandDetail  parameter form + preview + copy
│       └── Home           catalog summary + AssistantCard
├── GlobalOptions          modal with the CLI global options
└── toast                  short notification when copying
```

| Component | Role |
|---|---|
| `Topbar` | Global search field, light/dark theme button, show/hide sidebar, open global options. |
| `ServicePane` | List of catalog services, with a text filter. |
| `CommandPane` | List of commands. Receives `items` already filtered by `App`. |
| `CommandDetail` | Dynamic form generated from the command's `required` and `optional` parameters. Shows the command line live. |
| `Home` | Initial screen with no service selected: summary and assistant. |
| `AssistantCard` | Chat UI: messages, input, provider configuration. |
| `GlobalOptions` | Modal to set the options added to every command. |
| `Icons` | SVG icons as function components. |

All components are **presentational**: they receive data and callbacks through props. The exception is `useAssistant`, a hook with its own state.

## 5. `src/lib/` modules and hooks

| Module | Responsibility |
|---|---|
| `command.js` | Builds the command: `commandParts`, `previewPlain`, and `missingCount`. Required parameters without a value are shown as `<value>`. |
| `globalOptions.js` | Defines `GLOBAL_OPTS` (the 17 global options), loads and saves their values, and converts them into command parts with `globalParts`. |
| `ai.js` | AI providers (`AI_PROVIDERS`), system prompt, and HTTP adapters for Claude, Gemini, and OpenAI-compatible APIs. Exposes `askAssistant`. |
| `storage.js` | `readStorage` / `writeStorage` that never throw (private mode, full quota, blocked access). |
| `clipboard.js` | `copyText`: uses `navigator.clipboard` and, if that fails, a hidden `textarea` with `execCommand("copy")`. |
| `hooks/useAssistant.js` | Messages, draft input, sending state, and loading/saving of provider configuration. |

### Command construction

`previewPlain(svc, cmd, values, globals)` produces the final line:

```
aws <service> <command> [required parameters] [optional parameters with a value] [global options]
```

- Required parameters always appear; if empty, they are shown as `<value>`.
- Optional parameters appear only if they have a value.
- Global options are appended at the end, in the order of `GLOBAL_OPTS`. Boolean options carry no value.

## 6. State and data flow

All navigation state lives in `App.jsx`. Neither Context nor Redux is used.

| State | Type | Meaning |
|---|---|---|
| `catalog` | `Service[]` | Active catalog. Starts as `AWS_SAMPLE_CATALOG`. |
| `activeSvc` / `activeCmd` | object or `null` | Selected service and command. |
| `values` | `{ [flag]: string }` | Values typed into the form of the active command. |
| `search` / `svcFilter` / `cmdFilter` | `string` | Global search filter and per-panel filters. |
| `globals` | `{ [flag]: value }` | Global options. Persisted in `localStorage`. |
| `theme` | `'light' \| 'dark' \| null` | `null` follows the system preference. |
| `sidebarHidden`, `goptsOpen`, `toast` | various | UI state. |

### Catalog loading cycle

1. On mount, the catalog is `AWS_SAMPLE_CATALOG` (empty) until `public/catalog-aws.json` loads.
2. It calls `fetch(import.meta.env.BASE_URL + 'catalog.json')`.
3. If the response is successful and `services` is not empty, it replaces the catalog and resets the selection.
4. If it fails (no network, `file://`, HTTP error), **the sample is kept** and no error is shown.

### Selection rules

- A global search (`search`) takes priority and searches all services.
- Without a search, the commands of the active service are shown.
- If the active command is no longer visible after a filter, `App` automatically selects the first item in the list.
- Changing a filter clears the form values so parameters from different commands are not mixed.
- The `CommandDetail` key (`service/command`) forces a fresh form when the command changes.

### Narrow screens

Below 1040 px (`NARROW_QUERY`), selecting a service or command smoothly scrolls to the matching panel. The three-column layout stacks vertically.

## 7. Catalog (`catalog.json`)

### Format

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

- `id` is the identifier the CLI uses (`aws <id> …`).
- `type` describes the expected value (`string`, `integer`, `boolean`, `list<string>`, `list<structure>`…). The interface shows it as help text; values are not strictly validated.
- Size: ~23 MB, 435 services and 19,437 commands (according to the README).

### Origin and regeneration

The catalog is generated from the service models of **botocore**, the library AWS CLI v2 uses. The source version is in `generated_from`. **The generator script is not in the repository**, so updating the catalog requires regenerating it manually.

### Why `awsSampleCatalog.js` exists

So the app works without network access or under `file://`, where the catalog `fetch` fails. It is a small subset and is not kept in sync with the full catalog.

## 8. AI assistant

### Flow

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

- Each provider has its own request format. All three receive the same `SYSTEM_PROMPT`, which restricts answers to AWS CLI v2 commands.
- The **entire conversation history** is sent with every request.
- `max_tokens` is fixed at 1024 for Claude only.
- HTTP errors become an error message in the chat (first 240 characters of the response).

### Configuration and storage

| `localStorage` key | Content |
|---|---|
| `cli-ai-provider` | Active provider. |
| `cli-ai-key-<provider>` | API key for that provider. |
| `cli-ai-model-<provider>` | Chosen model. |
| `cli-ai-base-<provider>` | Base URL (only for `custom`). |

If there is no key and the provider is not `custom`, the chat shows a warning and opens the configuration without calling the API.

### Security

- Keys are stored **in plain text** in `localStorage`. Any script running on the same origin can read them.
- Requests leave from the user's browser, so the key travels in that request's headers. The `anthropic-dangerous-direct-browser-access` header is used because Anthropic requires it for browser calls.
- The `custom` provider (for example Ollama at `http://localhost:11434/v1`) does not require a key.

## 9. Styles and theme

- Colors are defined as CSS variables on `:root` and overridden for the dark theme.
- The theme is applied with the `data-theme` attribute on `<html>`. Without a saved value, `prefers-color-scheme` is followed.
- The layout is a three-panel grid with a breakpoint at 1040 px.

## 10. Browser persistence

| Key | Use | Module |
|---|---|---|
| `cli-globals` | Global options. | `globalOptions.js` |
| `cli-theme` | Chosen theme. | `App.jsx` |
| `cli-ai-*` | Assistant configuration. | `hooks/useAssistant.js` |

All reads and writes go through `storage.js`, which tolerates failures.

## 11. Known limitations

- Without the full catalog, only the bundled sample is available.
- Values are not validated against the parameter `type`.
- The app does not read the real CLI history or the user's profile configuration.
- The catalog is static: it does not follow new AWS CLI releases until it is regenerated.

## 12. Where to extend

| To… | Change |
|---|---|
| Add an AI provider | `AI_PROVIDERS` and an `askX` function in `lib/ai.js`; the `AssistantCard` UI must recognize it. |
| Add a global option | One entry in `GLOBAL_OPTS` (`lib/globalOptions.js`). The modal and command line pick it up automatically. |
| Change the command format | `lib/command.js`. |
| Change selection or search rules | `App.jsx` (`items`, the selection `useEffect`). |
| Add a color or theme | Variables in `src/styles.css`. |
