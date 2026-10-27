# aws-cli-command-builder — Project Documentation

## 1. What it is

**CLI Command Builder** (package `aws-cli-command-builder`) is a web application that helps you build **AWS CLI v2** commands without memorizing service names, subcommands, or flags. Users browse the catalog of services and commands, fill in the parameters in a form, and get the final command ready to copy and paste into a terminal.

The catalog is generated from the **botocore** *service models* (the library AWS CLI uses under the hood), so it covers every service and command in the CLI, not just a subset.

### About AWS CLI v2

AWS CLI is a unified tool that provides a consistent interface for interacting with all parts of AWS. The command syntax is:

```
aws <service> <subcommand> [options]
```

For example, `aws ec2 describe-instances --region us-east-1` uses the `ec2` service, the `describe-instances` subcommand, and the `--region` global option.

Reference material (as of AWS CLI **2.38.5**, the version shown on the documentation home page):

- [AWS CLI v2 Command Reference](https://docs.aws.amazon.com/cli/latest/) — one page per service, from `accessanalyzer` to `xray`.
- [User Guide](https://docs.aws.amazon.com/cli/latest/userguide/) — installation, configuration, and getting started.
- [GitHub repository](https://github.com/aws/aws-cli) — source code and `CONTRIBUTING.rst`.

The Command Reference index also lists a few CLI utilities that are not services, such as `configure`, `login`, `logout`, `history`, and `update`. The command reference page does not cover installation, supported platforms, configuration (`aws configure`, credentials, profiles), global options, or usage examples; those are in the User Guide.

This builder reflects the **Command Reference** structure: the catalog is organized by service and subcommand, and the global options in section 4.2 are the options that apply to every command.

## 2. Project contents

| Path | Description |
|---|---|
| `index.html` | Vite entry point. Contains the `<div id="root">` and loads `src/main.jsx`. |
| `src/main.jsx` | Mounts the React application and loads the styles. |
| `src/App.jsx` | Global state (active service and command, filters, theme, global options) and screen composition. |
| `src/components/` | UI components: `Topbar`, `ServicePane`, `CommandPane`, `CommandDetail`, `Home`, `AssistantCard`, `GlobalOptions`, `Icons`. |
| `src/hooks/useAssistant.js` | AI assistant state: per-provider configuration, messages, and sending. |
| `src/lib/` | Logic without UI: `command.js` (command building), `globalOptions.js`, `ai.js` (provider calls), `clipboard.js`, `storage.js`. |
| `src/data/awsSampleCatalog.js` | Sample catalog bundled as an offline fallback. |
| `src/styles.css` | Styles: color variables for light/dark theme, layout, and components. |
| `public/catalog-aws.json` | Full AWS CLI v2 catalog (435 services, ~19,470 commands). Served as-is at the root. |
| `public/catalog-azure.json` | Full Azure CLI catalog (91 services, ~6,090 commands). Accepts the app format or the raw `dump_commands.py` output. |
| `src/lib/clouds.js` | Cloud registry (AWS, Azure, upcoming OCI/GCP). Adding a cloud = one entry here. |
| `.nvmrc` | Node version used by the project (`26`, LTS). |
| `vercel.json` | Vercel deployment settings (Vite build, output in `dist/`). |

### `catalog-aws.json` / `catalog-azure.json` format

Real example with the EC2 service (one command, excerpt from `public/catalog.json`):

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
          "desc": "Describes the specified instances or all instances.",
          "required": [],
          "optional": [
            {
              "flag": "--instance-ids",
              "type": "list<string>",
              "desc": "The instance IDs."
            },
            {
              "flag": "--include-managed-resources",
              "type": "boolean",
              "desc": "Indicates whether to include managed resources in the output."
            },
            {
              "flag": "--dry-run",
              "type": "boolean",
              "desc": "Checks whether you have the required permissions for the operation, without actually making the request, and provides an error response."
            },
            {
              "flag": "--filters",
              "type": "list<structure>",
              "desc": "The filters."
            },
            {
              "flag": "--next-token",
              "type": "string",
              "desc": "The token returned from a previous paginated request."
            },
            {
              "flag": "--max-results",
              "type": "integer",
              "desc": "The maximum number of items to return for this request."
            }
          ]
        }
      ]
    }
  ]
}
```

- `services[].id`: the service identifier as the CLI uses it (`aws <id> ...`).
- `commands[].required` / `optional`: the command parameters, each with its flag, type (`string`, `integer`, `boolean`, `list<string>`, `list<structure>`, etc.), and description.

## 3. Requirements and running

Requires **Node 26** (LTS). With nvm:

```bash
nvm install 26
nvm use            # reads .nvmrc
npm install
npm run dev        # Vite development server
npm run build      # generates dist/
npm run preview    # serves dist/ locally
```

With `npm run dev` or `npm run preview` the app is served over HTTP and loads `catalog-aws.json` / `catalog-azure.json` without issues. Opening `index.html` directly with `file://` does not work: the browser blocks loading `catalog-aws.json` / `catalog-azure.json`, and the app shows only the embedded sample.

### Usage

1. **Pick a service** in the sidebar (with search and filter).
2. **Pick a command** from the service's list.
3. **Fill in the parameters.** Required ones appear first and are flagged if missing. Optional ones are in collapsible sections.
4. **Copy the generated command** with the copy button. The preview shows the complete command, including the global options.

### Global search

The top bar lets you search services and commands at the same time, so you can jump straight to the command you need.

### Home screen

When no service is selected, the home screen shows a summary of the catalog and the AI assistant.

## 4. Features

### 4.1 Command builder
- Live command preview while values are typed.
- Validation of required parameters with a visual warning.
- Copy to clipboard (with a fallback for older browsers).
- Brief notifications (*toast*) when copying.

### 4.2 Global options
Settings panel (⚙) with the options that apply to **every** AWS CLI command:

| Option | Type | Use |
|---|---|---|
| `--region` | text | Region to use |
| `--output` | select | `json`, `yaml`, `yaml-stream`, `text`, `table` |
| `--profile` | text | Credentials profile |
| `--query` | text | JMESPath filter |
| `--endpoint-url` | text | Custom endpoint URL |
| `--debug` | boolean | Debug logging |
| `--no-verify-ssl` | boolean | Disables SSL certificate verification |
| `--no-paginate` | boolean | Single call (first page only) |
| `--no-sign-request` | boolean | Does not sign requests |
| `--no-cli-pager` | boolean | Disables the pager |
| `--cli-auto-prompt` / `--no-cli-auto-prompt` | boolean | Automatic prompting for input parameters |
| `--color` | select | `on`, `off`, `auto` |
| `--ca-bundle` | text | CA certificate bundle |
| `--cli-read-timeout` / `--cli-connect-timeout` | integer | Timeouts in seconds |
| `--cli-binary-format` | select | `base64`, `raw-in-base64-out` |

These options are saved in the browser (`localStorage`, key `cli-globals`) and persist across pages. They can be cleared with a single button.

### 4.3 Light / dark theme
Follows the operating system preference by default. The theme button switches it; the choice is saved in `localStorage` (key `cli-theme`).

### 4.4 AI assistant
A chat that generates AWS CLI commands from natural language (for example, *"list S3 buckets larger than 100 GB"*). The system prompt restricts the assistant to answering **only with AWS CLI v2 commands**.

Supported providers:

| Provider | Default model | Endpoint |
|---|---|---|
| Gemini (Google) | `gemini-2.0-flash` | `generativelanguage.googleapis.com` |
| Claude (Anthropic) | `claude-3-5-haiku-latest` | `api.anthropic.com` |
| OpenAI | `gpt-4o-mini` | `api.openai.com` |
| Custom / local AI | (free) | Defaults to `http://localhost:11434/v1` (e.g. Ollama) |

Configuration: provider, model, API key, and base URL (only for the custom option). Each provider stores its own key and model in `localStorage`. Requests are sent **directly from the browser** to the chosen provider's API; there is no intermediate server.

## 5. Technical architecture

- **Stack:** React 19 + Vite 8, JavaScript (JSX), and CSS with variables (color tokens). No external state libraries: state lives in `App.jsx` and in `useAssistant`.
- **Typefaces:** Google Fonts (Space Grotesk, IBM Plex Mono).
- **Persistence:** preferences in `localStorage` (see the table below). All access goes through `src/lib/storage.js`, which tolerates browsers with blocked storage.
- **Catalog loading:**
  1. On startup, the app uses the sample in `src/data/awsSampleCatalog.js` so it works without network access.
  2. It then calls `fetch(BASE_URL + 'catalog.json')` and, if the response is successful, replaces the sample with the full catalog.

### Main pieces

| Piece | Responsibility |
|---|---|
| `App` | Selection and filter state, automatic selection of the first visible command, catalog loading, theme, and toast |
| `ServicePane` / `CommandPane` | Service and command lists with filters |
| `CommandDetail` | Parameter form, preview, and copy button |
| `Home` | Catalog summary and assistant |
| `GlobalOptions` | Global options panel |
| `commandParts` / `previewPlain` (`lib/command.js`) | Building the final command |
| `askAssistant` (`lib/ai.js`) | Calls to the AI provider |
| `useAssistant` (`hooks/`) | State and sending for the AI chat |
| `copyText` (`lib/clipboard.js`) | Copy to clipboard |

### `localStorage` keys

| Key | Content |
|---|---|
| `cli-globals` | Global option values |
| `cli-theme` | Chosen theme (light/dark) |
| `cli-ai-provider` | Active AI provider |
| `cli-ai-key-<provider>` | Provider API key |
| `cli-ai-model-<provider>` | Provider model |
| `cli-ai-base-<provider>` | Provider base URL (custom only) |

## 6. Security and privacy considerations

- **Assistant API keys:** stored in the browser's `localStorage` as plain text. Any script running on the same origin can read them. Use keys with limited quotas and do not share the machine.
- **Generated commands:** the application **does not run** commands and does not connect to AWS. It only generates text. Always review a command before running it, especially those that create, modify, or delete resources.
- **Data sent:** anything typed in the assistant chat is sent to the chosen provider.

## 7. Known limitations

- Without access to `catalog-aws.json` / `catalog-azure.json`, only the embedded sample with a few services is available.
- The catalog matches the botocore version listed in `generated_from` (currently `botocore 1.43.118`). To update it, regenerate `public/catalog.json` from a newer botocore version; the generator script is not included in the repository.
- `catalog-aws.json` / `catalog-azure.json` is about 23 MB; the first load may be slow on slow connections.
- The AI assistant depends on the availability and quotas of the chosen provider.

## 8. Possible improvements

- Include the script that generates `catalog-aws.json` / `catalog-azure.json` from botocore, so it can be updated.
- Compress `catalog-aws.json` / `catalog-azure.json` (gzip) or split it per service to reduce the initial load.
- Add automated tests (Vitest) for command building (`src/lib/command.js`).
- Export or save favorite commands.
- Support for other CLIs (for example, Azure) in the future.
