# Deploying to Vercel with the CLI

This guide explains how to deploy the project from your terminal with the Vercel CLI, without using the web dashboard for each deployment. It complements [deployment-vercel.md](deployment-vercel.md), which covers the dashboard, Git integration, and custom domains.

Verified with **Vercel CLI 65.2.0** running on **Node.js 24.18.0**. The project's `.nvmrc` asks for Node 26, so use that version if you want the local build to match production exactly.

## 1. Install the CLI

```bash
npm install -g vercel
vercel --version
```

The CLI also runs through `npx vercel` without a global install.

To update later:

```bash
npm install -g vercel@latest
```

## 2. Sign in

```bash
vercel login
```

This opens a browser window to authorize the CLI. Once authorized, check the account:

```bash
vercel whoami
```

If you have several teams or scopes, list them and switch with:

```bash
vercel teams list
vercel switch
```

> `vercel login` needs a browser. If you are on a machine without one, run it from your own terminal or use a token (see section 8).

## 3. Link the project

Linking connects the local folder to a Vercel project. It creates a `.vercel/` folder in the project root with the project and org IDs.

```bash
cd aws-cli-command-builder
vercel link
```

The CLI asks:

1. Which scope (account or team) to use.
2. Whether to link to an existing project or create a new one.
3. The project name (for example `aws-cli-command-builder`).
4. The root directory (press Enter for `./`, the project root).

The CLI detects Vite and uses the settings from `vercel.json`. No manual configuration is needed.

> **Add `.vercel/` to `.gitignore`.** It is not in the repository's `.gitignore` yet. The folder contains local project identifiers and should not be committed.
>
> ```
> .vercel
> ```

To link without prompts (for example in a script), pass the project explicitly:

```bash
vercel link --yes --project aws-cli-command-builder
```

## 4. Deploy

### Preview deployment

A preview is a unique URL for testing changes. It does not affect production.

```bash
vercel
```

`vercel` is the same as `vercel deploy`. The CLI uploads the project, builds it on Vercel with `npm run build`, and prints the preview URL.

### Production deployment

```bash
vercel --prod
```

`--prod` is shorthand for `--environment production`. It promotes the deployment to the production domain (`<project>.vercel.app` or your custom domain).

### Useful deployment flags

| Flag | Use |
|---|---|
| `--prod` | Deploy to production. |
| `--environment <name>` | Deploy to `production`, `preview`, or a custom environment. |
| `--yes` / `-y` | Accept defaults and skip prompts. |
| `--logs` | Print build logs during the deployment. |
| `--no-wait` | Return immediately without waiting for the build to finish. |
| `--force` | Deploy even if nothing has changed (skips the build cache). |
| `--skip-domain` | Create the production deployment without assigning the domains. Assign them later with `vercel promote`. |
| `--dry` | Show the detected framework and the files that would be uploaded, without deploying. |
| `--build-env KEY=VALUE` | Set an environment variable for the build only. |
| `--env KEY=VALUE` | Set an environment variable for runtime only. |
| `--json` | Print the result as JSON (useful in scripts). |
| `--cwd <dir>` | Run the command against another folder. |

### Check what will be uploaded

```bash
vercel --dry
```

Use this to confirm the framework is detected as Vite and that large folders such as `node_modules/` are not uploaded unnecessarily. To exclude more files from uploads, add a `.vercelignore` file in the project root.

### Build locally, then deploy the output

Vercel can deploy an output you have already built:

```bash
npm run build
vercel build
vercel deploy --prebuilt --prod
```

Use this if you need the build to run on your machine (for example, to reuse a local artifact). The default flow (`vercel --prod`) is simpler and recommended.

## 5. Verify the deployment

Each deployment prints a URL. Check it and then inspect the deployment from the terminal:

```bash
vercel inspect <deployment-url>            # summary: status, aliases, regions
vercel inspect <deployment-url> --logs     # build logs
vercel inspect <deployment-url> --verify   # opens the URL and reports status code and page title
```

Check the items in [deployment-vercel.md, section 5](deployment-vercel.md#5-verification-after-deploying): the catalog loads, `catalog.json` returns JSON with the expected cache header, and the theme and copy button work.

## 6. List, logs, and rollback

```bash
vercel list                      # recent deployments of the linked project
vercel list --environment production
vercel logs                      # runtime and request logs (newest first)
```

To revert production to a previous deployment:

```bash
vercel rollback <deployment-url>     # promotes the given deployment back to production
vercel rollback status               # shows pending rollbacks
```

To promote a specific preview to production (without rebuilding):

```bash
vercel promote <deployment-url>
vercel promote status
```

To rebuild an old deployment from its source:

```bash
vercel redeploy <deployment-url> --environment production
```

## 7. Environment variables

The app needs **no** environment variables. Do not add AI provider keys as Vercel variables: they would be embedded in the public bundle (see [architecture.md, section 8](architecture.md#8-ai-assistant)).

If you add variables later, use:

```bash
vercel env add MY_VARIABLE production      # prompts for the value
vercel env list
vercel env pull .env.local                 # download to a local file
```

`vercel env pull` writes secrets to disk. Name the file so it is ignored by Git: the repository's `.gitignore` already ignores `*.local`, so `.env.local` is safe to use.

To sync project settings and variables into `.vercel/` for local use:

```bash
vercel pull --environment production
```

## 8. Domains and aliases

```bash
vercel domains ls                              # domains in the account
vercel alias list                              # aliases of the project
vercel alias set <deployment-url> <domain>     # point a domain to a deployment
```

To add a custom domain to the project, see [deployment-vercel.md, section 4](deployment-vercel.md#4-custom-domain). Adding a domain in the dashboard is usually easier than with the CLI.

## 9. Non-interactive use (CI and scripts)

For scripts or CI pipelines, authenticate with a token instead of `vercel login`:

1. Create a token in the Vercel dashboard under **Account Settings → Tokens**.
2. Store it as a secret in your CI system. Never commit it.
3. Deploy with the token:

```bash
vercel deploy --prod --yes --token "$VERCEL_TOKEN"
```

Alternatively, set `VERCEL_TOKEN` in the environment. The `.vercel/project.json` created by `vercel link` must also be available (commit it only if your CI needs it and the repository is private; it contains no secrets, but it identifies the project).

## 10. Cleanup

```bash
vercel remove <project-name> --safe   # deletes deployments of a project, skipping those with an active alias
vercel remove <deployment-url> --yes  # deletes a single deployment
```

Deleting deployments is permanent. Check the target first with `vercel list`.

## 11. Common problems

| Symptom | Cause | Solution |
|---|---|---|
| `Error: No existing credentials found` | Not signed in | Run `vercel login`. |
| `Error: Command "npm run build" exited with 1` | Build failed on Vercel | Run `npm run build` locally to reproduce; check `vercel inspect <url> --logs`. |
| The CLI deploys to the wrong project | `.vercel/project.json` points to another project | Run `vercel link` again, or pass `--project`. |
| Page loads but without the full catalog | `public/catalog.json` was not uploaded | Run `vercel --dry` and confirm the file is in the list. Check that it is not excluded by `.gitignore` or `.vercelignore`. |
| `Node.js Version` mismatch warning | Local Node differs from `.nvmrc` | Use `nvm use` (Node 26). The build runs on Vercel with the version from `.nvmrc` / `engines`. |
| Upload is slow | `catalog.json` is ~23 MB | Expected on slow connections. Vercel compresses it in transit. |
| `vercel: command not found` after install | npm global folder not in `PATH` | Run `npm config get prefix` and add `<prefix>/bin` to `PATH`. |

## 12. Quick reference

```bash
npm install -g vercel          # install
vercel login                   # sign in
vercel link                    # connect the folder to a project (once)
vercel                         # preview deployment
vercel --prod                  # production deployment
vercel inspect <url> --logs    # build logs
vercel rollback <url>          # revert production to a previous deployment
vercel env list                # environment variables
vercel logout                  # sign out
```
