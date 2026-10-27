# Catalog generation (Azure)

This document explains how `public/catalog-azure.json` is generated and how to regenerate it. For the AWS catalog see [catalog-generation-aws.md](catalog-generation-aws.md); for the file format, see the root [README.md](../README.md); for how the app consumes it, see [architecture.md](architecture.md).

## 1. How it works

Azure has no official file or API that lists every `az` command with its arguments. The catalog is built by two scripts that work together:

| Script | Role |
|---|---|
| `scripts/generate-catalog-azure-v1.mjs` (Node) | Entry point (`npm run catalog:azure`). Parses the options, launches the Python script, converts its output to the app format (`{ generated_from, services }`) and writes `public/catalog-azure.json`. |
| `scripts/generate-catalog-azure-dump.py` (Python) | Imports `azure.cli.core` and loads the whole command table and every argument definition **once, in-process**, then prints it as JSON. It must run with the Python that has azure-cli installed. |

It takes about 30 seconds for the whole CLI, reads exactly what the installed `az` supports, and needs no login and no network.

The Python is found automatically from the `az` launcher (for the packaged CLI it is `/opt/az/bin/python3`); override it with `--python <path>` or `AZ_PYTHON`.

Mapping:

| Catalog | Azure CLI |
|---|---|
| `services[].id` | Top-level group (`vm`, `storage`…) |
| `services[].name` | Group `short-summary` |
| `commands[].name` | Path below the group (`network vnet subnet create` → `vnet subnet create`) |
| `commands[].desc` | Command `short-summary` (module YAML help, else the command's help or docstring) |
| `required` / `optional` | The argument's `required` setting |
| `flag` | First long flag in alphabetical order, as `az -h` lists it |
| `type` | `string`, or `boolean` when the allowed values are only `true`/`false` |

Details:

- Suppressed arguments are skipped. `--ids` is added to the commands that take a resource id, and the id-part arguments become optional, as azure-cli does at run time.
- The global arguments (`--debug`, `--output`, `--query`…) are not in the command table; the app handles them in its global options panel.
- **Root-level commands** (`az login`, `az logout`, `az rest`, `az version`, `az configure`, `az find`, `az upgrade`…) are grouped under a pseudo-service called `general`. The app builds them without the service name (`az login`, not `az general login`).
- **Extensions** are only included if they are installed in the `az` that runs the script (`az extension list`). With a plain install you get the core CLI only (about 90 groups); groups such as `devops`, `ml` or `aks-preview` need `az extension add -n <name>` before generating.
- The catalog reflects the Azure CLI version of the machine that generates it; it is recorded in `generated_from` (`azure-cli 2.xx.x`).
- The app also accepts the raw dump of the Python script (`{ version, groups, commands }`), so either format works in `public/catalog-azure.json`.

### Alternative: help crawler (`--mode help`)

The Node script keeps the original method: it runs `az <group> -h` and `az <group> <command> -h` for every group and command and parses the text. It needs no Python access, but makes thousands of `az` calls and takes about an hour, and it depends on the help format. Use it only if the Python mode cannot run. `--concurrency` only applies to this mode.

## 2. Requirements

| Requirement | Version | Notes |
|---|---|---|
| Node.js | 24 | Same as the app (`engines` in `package.json`). |
| Azure CLI (`az`) | latest | Must be on the `PATH`, or pointed to with `--az` / `AZ_BIN`. It brings its own Python. |

Signing in (`az login`) is **not** required, and no Azure subscription is needed: no Azure API is called.

## 3. Installing the Azure CLI (one time)

Pick one method. After installing, verify it with:

```bash
az version
```

It should print JSON with `"azure-cli": "2.xx.x"`.

### Linux (Debian/Ubuntu/WSL)

```bash
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
```

### macOS

```bash
brew update && brew install azure-cli
```

### Windows

```powershell
winget install --exact --id Microsoft.AzureCLI
```

### Without sudo: Python virtual environment

```bash
python3 -m venv .venv
.venv/bin/pip install azure-cli
.venv/bin/az version
```

> If `python3 -m venv` fails with `ensurepip is not available` (common on Ubuntu/WSL), install `python3-venv` (`sudo apt install python3-venv`) or use `python3 -m venv --without-pip .venv` and then `pip --python .venv/bin/python install azure-cli`.

Then tell the script where things are:

```bash
npm run catalog:azure -- --az .venv/bin/az --python .venv/bin/python
# or
AZ_BIN=.venv/bin/az AZ_PYTHON=.venv/bin/python npm run catalog:azure
```

Add `.venv` to `.gitignore` if you use this method. To keep up to date: `az upgrade` (installer methods) or `.venv/bin/pip install --upgrade azure-cli` (venv).

## 4. Running the script

```bash
npm run catalog:azure
```

This overwrites `public/catalog-azure.json` (~16 MB) and prints:

```
Reading the Azure CLI command table with "/opt/az/bin/python3"…
command table: 6105 commands in 7.7s
arguments loaded in 10.5s
dumped 6104 commands in 92 services
Command table read in 27s
Wrote 92 services and 6104 commands to .../public/catalog-azure.json
```

The exact counts depend on the installed version and extensions.

### Options

| Option | Default | Description |
|---|---|---|
| `--services a,b,c` | all | Only these top-level groups (`general` for the root commands). Writes a catalog with **only** those groups. |
| `--python <path>` | from the `az` launcher | Python that has azure-cli. Also `AZ_PYTHON`. |
| `--az <path>` | `az` | Azure CLI binary. Also `AZ_BIN`. |
| `--mode help` | fast (Python) | Use the slow help crawler instead. |
| `--concurrency <n>` | `8` | Parallel `az` processes; only for `--mode help`. |
| `--out <path>` | `public/catalog-azure.json` | Output file. |

The script sets `AZURE_CORE_COLLECT_TELEMETRY=false`, `AZURE_CORE_NO_COLOR=true` and `AZURE_CORE_ONLY_SHOW_ERRORS=true`.

### Examples

```bash
# Quick test with a few groups, without touching the real catalog
npm run catalog:azure -- --services vm,storage,network --out /tmp/catalog-test.json

# Only the root commands (login, rest, version…)
npm run catalog:azure -- --services general --out /tmp/catalog-test.json

# Specific Python / az binary
npm run catalog:azure -- --python /opt/az/bin/python3
npm run catalog:azure -- --az /opt/az/bin/az

# Slow crawler mode (about an hour)
npm run catalog:azure -- --mode help --concurrency 8
```

Tip: the arguments after `--` go to the script; without the `--`, npm would swallow them.

## 5. Updating the catalog

New commands and arguments arrive with every Azure CLI release:

```bash
az upgrade                                       # or: .venv/bin/pip install --upgrade azure-cli
npm run catalog:azure                            # about 30 seconds
git diff --stat public/catalog-azure.json        # review the change
npm run build                                    # make sure the app still builds
```

Then commit `public/catalog-azure.json` (the app loads it at startup; there is no bundled sample) and deploy as usual (see [deployment-vercel.md](deployment-vercel.md)). Do not commit a catalog generated with `--services`: it contains only those groups.

## 6. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Could not run "<python>". Pass the Python that has azure-cli…` | The Python was not found. Pass `--python` / `AZ_PYTHON` (for the packaged CLI: `/opt/az/bin/python3`). |
| `ModuleNotFoundError: azure` | That Python does not have azure-cli. Use the one `az` runs. |
| `Could not run "az"` (help mode) | Install the CLI (section 3) or pass `--az` / `AZ_BIN`. |
| `"az version" did not return JSON` | `az` is broken or printing something else. Run `az version` by hand first. |
| A group is missing | It is an extension (install it with `az extension add -n <name>`) or is not in the installed version. Compare with `az --help`. |
| Root commands such as `login` are missing | The catalog was generated before the `general` service existed. Regenerate. |
| Catalog has only a few groups | It was generated with `--services`. Regenerate without that option. |
| Catalog looks outdated in the browser | Hard refresh (`Ctrl+Shift+R`); the file is cached by the browser/CDN. |
| The Azure card shows "loading catalog…" forever or "catalog failed to load" | `public/catalog-azure.json` was not loaded (missing, or opened with `file://`). The app has no bundled sample data any more. Use `npm run dev` / `npm run preview`. |
