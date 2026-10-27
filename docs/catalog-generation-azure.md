# Catalog generation

This document explains how `public/catalog.json` is generated and how to regenerate it. For the file format, see the root [README.md](../README.md); for how the app consumes it, see [architecture.md](architecture.md).

## 1. How it works

The catalog is built by `scripts/generate-catalog.mjs` from the **help output of the Azure CLI**. Unlike AWS (whose CLI is generated from public JSON models), Azure has no official file or API that lists every `az` command with its arguments, so the script walks the command tree by running `az <path> -h`:

1. Reads `az -h` and finds the top-level groups (`vm`, `storage`, `network`…). Each one becomes a **service**.
2. For every group it reads the `Subgroups:` and `Commands:` sections and keeps descending (`az network vnet subnet -h`…).
3. For every command it reads the argument sections (`Arguments`, `Resource Id Arguments`, `Network Arguments`…) and splits them into required (`[Required]`) and optional.

Mapping:

| Catalog | Azure CLI help |
|---|---|
| `services[].id` | Top-level group (`vm`, `storage`…) |
| `services[].name` | Group description (`Group` section) |
| `commands[].name` | Path below the group (`network vnet subnet create` → `vnet subnet create`) |
| `commands[].desc` | Command description from its parent's `Commands:` list |
| `required` / `optional` | `[Required]` marker on each argument |
| `flag` | First long flag of the line (`--resource-group -g` → `--resource-group`) |
| `type` | `string`, or `boolean` when the allowed values are only `true`/`false` |

Details:

- Arguments from the `Global …` sections are skipped (`--debug`, `--output`, `--query`…); they are handled by the app's global options panel. `--subscription` under *Resource Id Arguments* is also skipped.
- Root-level commands such as `az login` have no group and are not part of the catalog.
- Extensions are not included: only what the installed `az` ships with (`extensions` is `{}` in `az version`).
- The catalog reflects the Azure CLI version installed on the machine that generates it; it is recorded in `generated_from`.

### Cost

Every group and every command is one `az` process, so a full run makes thousands of calls and takes about an hour. That is why the script runs them in parallel (`--concurrency`) and why a scheduled workflow exists (section 6).

## 2. Requirements

| Requirement | Version | Notes |
|---|---|---|
| Node.js | 24 | Same as the app (`engines` in `package.json`). |
| Azure CLI (`az`) | latest | Must be on the `PATH`, or pointed to with `--az` / `AZ_BIN`. |

Signing in (`az login`) is **not** required: only the help output is read, no Azure API is called. No Azure subscription is needed.

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

Useful in CI or when you cannot install system packages. From the project root:

```bash
python3 -m venv .venv
.venv/bin/pip install azure-cli
.venv/bin/az version
```

> If `python3 -m venv` fails with `ensurepip is not available` (common on Ubuntu/WSL), install `python3-venv` (`sudo apt install python3-venv`) or use `python3 -m venv --without-pip .venv` and then `pip --python .venv/bin/python install azure-cli`.

Then tell the script where `az` is (the script does not look inside `.venv` by itself):

```bash
npm run catalog -- --az .venv/bin/az
# or
AZ_BIN=.venv/bin/az npm run catalog
```

Add `.venv` to `.gitignore` if you use this method.

To keep up to date: `az upgrade` (installer methods) or `.venv/bin/pip install --upgrade azure-cli` (venv).

## 4. Running the script

```bash
npm run catalog
```

This overwrites `public/catalog.json` and prints progress with an estimated percentage and the elapsed time:

```
Reading the Azure CLI help with "az" (concurrency 8)…
~42%  1260 read / 3000 found  (24m 10s)
...
Wrote 70 services and 9500 commands to .../public/catalog.json
```

The total is unknown up front (every group reveals more commands), so the percentage is an estimate over what has been discovered so far and can move back a little while the queue grows. When the output is redirected (CI, logs), it prints a line every 50 reads instead of updating in place.

### Options

| Option | Default | Description |
|---|---|---|
| `--services a,b,c` | all | Only these top-level groups. Writes a catalog with **only** those groups. |
| `--concurrency <n>` | `8` | How many `az` processes run in parallel. |
| `--az <path>` | `az` | Azure CLI binary. Also settable with the `AZ_BIN` environment variable. |
| `--out <path>` | `public/catalog.json` | Output file. |

The script sets `AZURE_CORE_COLLECT_TELEMETRY=false`, `AZURE_CORE_NO_COLOR=true` and `AZURE_CORE_ONLY_SHOW_ERRORS=true` for its own `az` calls, and each call has a 5-minute timeout.

### Examples

```bash
# Quick test with a few groups, without touching the real catalog
npm run catalog -- --services vm,storage,network --out /tmp/catalog-test.json

# Fewer parallel processes (small machine, low memory)
npm run catalog -- --concurrency 4

# More parallelism (az starts a Python process each time; watch RAM)
npm run catalog -- --concurrency 16

# Measure how long it takes
time npm run catalog -- --services vm,storage,network --concurrency 4

# Use a specific az binary
npm run catalog -- --az /opt/az/bin/az
AZ_BIN=/opt/az/bin/az npm run catalog

# Combine options
npm run catalog -- --services vm,group --concurrency 8 --az .venv/bin/az --out /tmp/catalog-test.json
```

Tip: the arguments after `--` go to the script; without the `--`, npm would swallow them.

> Each `az` call starts a Python interpreter and takes roughly a second, so doubling `--concurrency` does not halve the time once the CPU or RAM is saturated. Measure with `time` on a few groups before a full run.

## 5. Updating the catalog

New commands and arguments arrive with every Azure CLI release. To refresh by hand:

```bash
az upgrade                                  # or: .venv/bin/pip install --upgrade azure-cli
npm run catalog                             # about an hour
git diff --stat public/catalog.json         # review the change
npm run build                               # make sure the app still builds
git add public/catalog.json
git commit -m "chore: update catalog"
git push                                    # Vercel deploys the new catalog
```

Do not commit a catalog generated with `--services`: it contains only those groups.

## 6. Automatic updates (GitHub Actions)

`.github/workflows/update-catalog.yml` runs the same script every Monday at 05:00 UTC (or on demand from the **Actions** tab → **Run workflow**): it installs the latest `azure-cli` with `pip`, runs `npm run catalog -- --concurrency 8`, and, if `public/catalog.json` changed, commits it as `chore: update catalog (azure-cli <version>)`. The push triggers a Vercel deployment.

Requirements and caveats are in the root [README.md](../README.md#updating-the-catalog): *Read and write permissions* for workflows, a branch that accepts bot pushes, a 180-minute job limit, and repository growth from committing a large JSON file.

## 7. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Could not run "az": the Azure CLI is not installed or is not on PATH.` | Install it (section 3) or pass `--az` / `AZ_BIN`. |
| `"az version" did not return JSON` | `az` is broken or printing something else. Run `az version` by hand and fix that first. |
| Run seems stuck at the start | The first `az` calls are slow (cold start, Python bytecode compile). Wait a minute. |
| Out of memory / machine freezes | Lower `--concurrency` (try 4). |
| A group or command is missing | It is an extension or is not in the installed version. Check with `az <group> -h`. |
| Catalog has only a few groups | It was generated with `--services`. Regenerate without that option. |
| Catalog looks outdated in the browser | Hard refresh (`Ctrl+Shift+R`); the file is cached by the browser/CDN. |
| Only a few groups appear in the app | The app fell back to `awsSampleCatalog.js`: `catalog.json` was not loaded (opened with `file://` or missing). Use `npm run dev` / `npm run preview`. |
