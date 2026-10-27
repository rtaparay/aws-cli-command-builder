# Catalog generation (AWS)

The Azure catalog has its own generator; see [catalog-generation-azure.md](catalog-generation-azure.md).

This document explains how `public/catalog-aws.json` is generated and how to regenerate it. For the file format, see the root [README.md](../README.md); for how the app consumes it, see [architecture.md](architecture.md).

## 1. How it works

The catalog is built by `scripts/generate-catalog-aws-v1.mjs` from the **botocore service models**: the JSON files that the AWS CLI itself is generated from. There is no official API that lists AWS CLI commands, and running `aws <service> <command> help` for every command would take ~19,000 process spawns. Reading the models directly:

- takes a few seconds;
- does not need the AWS CLI, AWS credentials, or network access (once botocore is installed);
- produces the same service/command/parameter names the CLI uses.

Mapping:

| Catalog | botocore model |
|---|---|
| `services[].id` | Directory name in `botocore/data` (e.g. `ec2`, `s3`, `iam`) |
| `services[].name` | `metadata.serviceFullName` |
| `commands[].name` | Operation name in kebab-case (`RunInstances` → `run-instances`) |
| `commands[].desc` | First sentence of the operation documentation (HTML stripped, max 220 characters) |
| `required` / `optional` | Members of the operation input, split by the shape's `required` list |
| `flag` | Member name in kebab-case with `--` prefix |
| `type` | Shape type (`string`, `integer`, `structure`, `map`…, or `list<…>`) |

If a service has several API versions, the newest one is used.

### Not covered

Commands written by hand in the AWS CLI that are not in the models are not generated: `aws s3 cp/sync/ls/mv/rm`, `aws configure`, `aws cloudformation deploy`, etc. The low-level `s3api` service is covered.

## 2. Requirements

| Requirement | Version | Notes |
|---|---|---|
| Node.js | 24 | Same as the app (`engines` in `package.json`). |
| Python | 3.8+ | Only to install and locate botocore. |
| botocore | latest | Installed in a project-local virtual environment. |

## 3. Installation (one time)

Run these from the project root (`aws-cli-command-builder/`).

### 3.1 Create the virtual environment

```bash
python3 -m venv .venv
```

> **If it fails** with `ensurepip is not available … install the python3-venv package` (common on Ubuntu/WSL), either install the package (`sudo apt install python3-venv`) and repeat the command, or create the environment without pip and use the system pip to fill it:
>
> ```bash
> rm -rf .venv
> python3 -m venv --without-pip .venv
> pip --python .venv/bin/python install botocore     # replaces step 3.2
> ```

### 3.2 Install botocore

```bash
.venv/bin/pip install botocore
```

On Windows (PowerShell) the paths are `.venv\Scripts\python.exe` and `.venv\Scripts\pip.exe`:

```powershell
python -m venv .venv
.venv\Scripts\pip install botocore
```

### 3.3 Verify

```bash
.venv/bin/python -c "import botocore; print(botocore.__version__)"
```

It should print a version such as `1.43.119`. The `.venv` folder is in `.gitignore`; it is not committed.

## 4. Running the script

```bash
npm run catalog:aws
```

This overwrites `public/catalog-aws.json` (~17 MB) and prints a summary:

```
Reading the botocore 1.43.119 models in .../botocore/data (concurrency 8)…
11%  50/435 services  (0m 1s)
...
100%  435/435 services  (0m 6s)
Wrote 435 services and 19474 commands to .../public/catalog-aws.json in 0m 7s
```

Progress is exact (one model per service) and shows the elapsed time. In a terminal it updates in place; when the output is redirected (CI, logs) it prints a line every 50 services.

The `generated_from` field of the file records the botocore version used.

### Options

| Option | Default | Description |
|---|---|---|
| `--services a,b,c` | all | Generate only these services (by `id`). Useful for quick tests. |
| `--concurrency <n>` | `8` | How many service models are read in parallel. Higher is faster until the disk/CPU is saturated (try 16). |
| `--python <path>` | auto-detected | Python interpreter that has botocore installed. Also settable with `PYTHON_BIN`. |
| `--out <path>` | `public/catalog-aws.json` | Output file. |
| `--data <path>` | auto-detected | Path to a `botocore/data` directory. Also settable with the `BOTOCORE_DATA` environment variable. |

Examples:

```bash
# Quick test without touching the real catalog
npm run catalog:aws -- --services ec2,s3,iam --out /tmp/catalog-test.json

# Read faster with more parallelism
npm run catalog:aws -- --concurrency 16

# Less parallelism on a slow disk or a small machine
npm run catalog:aws -- --concurrency 4

# Use a specific Python that has botocore (e.g. a venv outside the project)
npm run catalog:aws -- --python ~/envs/aws/bin/python
PYTHON_BIN=~/envs/aws/bin/python npm run catalog:aws          # same, with the env variable

# Windows (PowerShell)
npm run catalog:aws -- --python C:\envs\aws\Scripts\python.exe --concurrency 16

# Combine options: two services, 16 workers, custom output
npm run catalog:aws -- --services ec2,s3 --concurrency 16 --out /tmp/catalog-test.json

# Use an extracted copy of botocore instead of an installed one
npm run catalog:aws -- --data /path/to/botocore/data
```

Tip: the arguments after `--` go to the script; without the `--`, npm would swallow them.

Measured timings (435 services, WSL on a local disk; yours will vary):

| `--concurrency` | 1 | 4 | 8 (default) | 16 | 32 |
|---|---|---|---|---|---|
| Time | 15s | 8s | 6s | 7s | 7s |

Gains stop around 8, so the default is fine; raise it only if your disk is much faster.

The script looks for botocore in this order: `--data` / `BOTOCORE_DATA`, then the interpreter from `--python` / `PYTHON_BIN`, `.venv` (Linux/macOS, then Windows), then `python3` and `python` on the `PATH`.

## 5. Updating the catalog

New AWS services and parameters appear in botocore releases (several times a week). To refresh:

```bash
.venv/bin/pip install --upgrade botocore
npm run catalog:aws
git diff --stat public/catalog-aws.json     # review the change
npm run build                           # make sure the app still builds
```

Then commit `public/catalog-aws.json` (the app loads it at startup; there is no bundled sample) and deploy as usual (see [deployment-vercel.md](deployment-vercel.md)).

## 6. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Could not find the botocore models…` | botocore is not installed in `.venv` or the system Python. Repeat section 3, or pass `--data`. |
| `ensurepip is not available` when creating the venv | Install `python3-venv` or use the `--without-pip` workaround in section 3.1. |
| `externally-managed-environment` from pip | You are installing into the system Python. Use the venv (`.venv/bin/pip …`). |
| `python3: command not found` (Windows) | Use `python` / `py -3` instead of `python3`. |
| Catalog looks outdated in the browser | Hard refresh (`Ctrl+Shift+R`); the file is cached by the browser/CDN. |
| The AWS card shows "loading catalog…" forever or "catalog failed to load" | `public/catalog-aws.json` was not loaded (missing, or the app was opened with `file://`). The app has no bundled sample data any more. Generate the file and use `npm run dev` / `npm run preview`. |
