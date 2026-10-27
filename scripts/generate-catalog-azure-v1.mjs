// Generates public/catalog-azure.json from the Azure CLI. Each top-level group becomes a service; the
// commands below it (any depth) become its commands.
//
// Usage (requires the `az` command installed and on PATH, or AZ_BIN set):
//   npm run catalog:azure
//   npm run catalog:azure -- --services vm,storage,group --out public/catalog-azure.json
//
// Default (fast) mode: generate-catalog-azure-dump.py loads azure-cli's command table in one Python process.
//   --python <path> or AZ_PYTHON selects the Python that has azure-cli (default: the one `az` runs).
// `--mode help`: the original crawler, one `az <group> ... -h` per group and command (~1 hour for a
//   full run). `--concurrency` only applies to this mode.

import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENV = {
  ...process.env,
  AZURE_CORE_COLLECT_TELEMETRY: 'false',
  AZURE_CORE_NO_COLOR: 'true',
  AZURE_CORE_ONLY_SHOW_ERRORS: 'true',
};

function parseArgs(argv) {
  const opts = {
    az: process.env.AZ_BIN || 'az',
    python: process.env.AZ_PYTHON || null,
    mode: 'fast',
    services: null,
    concurrency: 8,
    out: resolve(ROOT, 'public/catalog-azure.json'),
  };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === '--services') opts.services = value.split(',').map(s => s.trim()).filter(Boolean);
    else if (key === '--concurrency') opts.concurrency = Math.max(1, Number(value) || 8);
    else if (key === '--az') opts.az = value;
    else if (key === '--python') opts.python = value;
    else if (key === '--mode') opts.mode = value === 'help' ? 'help' : 'fast';
    else if (key === '--out') opts.out = resolve(process.cwd(), value);
    else continue;
    i++;
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));

const ANSI = /\x1b\[[0-9;]*[A-Za-z]/g;

// Runs `az <argv>` and resolves with its text output (help is printed to stdout or stderr depending on the version).
function az(argv) {
  return new Promise(done => {
    execFile(opts.az, argv, { env: ENV, maxBuffer: 32 * 1024 * 1024, timeout: 300000 }, (err, stdout, stderr) => {
      if (err && err.code === 'ENOENT') {
        console.error(`Could not run "${opts.az}": the Azure CLI is not installed or is not on PATH.`);
        console.error('Install it (https://learn.microsoft.com/cli/azure/install-azure-cli) or set AZ_BIN / --az to its path.');
        process.exit(1);
      }
      done((stdout || stderr || '').replace(ANSI, ''));
    });
  });
}

// Returns the entries of one help section. `itemRe` must capture the description as its last group.
// Lines indented 8+ spaces right after an entry are its wrapped description.
function sectionEntries(text, sectionName, itemRe) {
  const entries = [];
  let section = null;
  let current = null;
  for (const line of text.split('\n')) {
    if (/^\S/.test(line)) {
      section = line.trim();
      current = null;
      continue;
    }
    if (typeof sectionName === 'function' ? !sectionName(section) : section !== sectionName) continue;
    if (!line.trim()) {
      current = null;
      continue;
    }
    const m = line.match(itemRe);
    if (m) {
      current = { m, desc: m[m.length - 1], section };
      entries.push(current);
    } else if (current && /^\s{8,}\S/.test(line)) {
      current.desc += ' ' + line.trim();
    }
  }
  return entries.map(e => ({ m: e.m, desc: e.desc.trim(), section: e.section }));
}

const SUBGROUP_OR_COMMAND = /^ {4}([a-z0-9][\w.-]*)(?:\s+\[[^\]]+\])?\s*:\s?(.*)$/i;

function parseIndex(text) {
  return {
    subgroups: sectionEntries(text, 'Subgroups:', SUBGROUP_OR_COMMAND).map(e => ({ name: e.m[1], desc: e.desc })),
    commands: sectionEntries(text, 'Commands:', SUBGROUP_OR_COMMAND).map(e => ({ name: e.m[1], desc: e.desc })),
  };
}

function parseGroupDesc(text) {
  const [entry] = sectionEntries(text, 'Group', /^ {4}az\b.*?:\s?(.*)$/);
  return entry ? entry.desc : '';
}

// Azure marks values with "Allowed values: a, b, c." at the end of the description.
function paramFrom(m, desc) {
  const allowed = desc.match(/Allowed values:\s*(.+?)\.?$/);
  let type = 'string';
  if (allowed) {
    const values = allowed[1].split(/,\s*/).map(v => v.trim()).filter(Boolean);
    if (values.length === 2 && values.includes('true') && values.includes('false')) type = 'boolean';
  }
  return { flag: m[1], type, desc, required: Boolean(m[2]) };
}

// Arguments can be split in several sections ("Arguments", "Resource Id Arguments", "Network Arguments"…).
// The "Global …" sections are skipped: the global arguments are handled by the settings panel.
const isArgumentsSection = name => /Arguments$/.test(name) && !name.startsWith('Global');

function parseArguments(text) {
  // Several long flags can share a line ("--name --subscription -n -s"); the first one is used.
  const entries = sectionEntries(text, isArgumentsSection, /^ {4}(--[\w-]+)(?:\s+--?[\w-]+)*\s*(\[Required\])?\s*:\s?(.*)$/);
  const seen = new Set();
  const params = [];
  for (const e of entries) {
    const param = paramFrom(e.m, e.desc);
    // --subscription in "Resource Id Arguments" is already a global argument.
    if (e.section === 'Resource Id Arguments' && param.flag === '--subscription') continue;
    if (seen.has(param.flag)) continue;
    seen.add(param.flag);
    params.push(param);
  }
  return params;
}

async function runPool(initial, handler, concurrency) {
  const queue = [...initial];
  let active = 0;
  return new Promise((finish, fail) => {
    const pump = () => {
      while (active < concurrency && queue.length) {
        active++;
        handler(queue.shift(), queue)
          .catch(fail)
          .finally(() => {
            active--;
            pump();
          });
      }
      if (active === 0 && queue.length === 0) finish();
    };
    pump();
  });
}

async function main() {
  const versionText = await az(['version']);
  const start = versionText.indexOf('{');
  if (start < 0) {
    console.error(`"${opts.az} version" did not return JSON. Output was:\n${versionText || '(empty)'}`);
    process.exit(1);
  }
  const version = (JSON.parse(versionText.slice(start)) || {})['azure-cli'] || 'unknown';

  const services = new Map();
  let done = 0;
  let queued = 0;
  const startedAt = Date.now();
  const tty = process.stderr.isTTY;

  // The total is unknown up front (each group reveals more commands), so the percentage is an
  // estimate over what has been discovered so far and can move back a little as the queue grows.
  function showProgress(final = false) {
    const total = queued + 1; // +1 for the root page
    const pct = Math.min(100, Math.floor((done / total) * 100));
    const secs = Math.round((Date.now() - startedAt) / 1000);
    const line = `~${pct}%  ${done} read / ${total} found  (${Math.floor(secs / 60)}m ${secs % 60}s)`;
    if (tty) process.stderr.write(`\r${line}${final ? '\n' : '   '}`);
    else if (final || done % 50 === 0) console.error(line);
  }

  const handler = async (job, queue) => {
    const text = await az([...job.path, '-h']);
    done++;
    showProgress();

    if (job.kind === 'group') {
      if (job.path.length === 1) {
        services.set(job.path[0], { id: job.path[0], name: parseGroupDesc(text), commands: [] });
      }
      const index = parseIndex(text);
      for (const sg of index.subgroups) {
        if (job.path.length === 0 && opts.services && !opts.services.includes(sg.name)) continue;
        queue.push({ kind: 'group', path: [...job.path, sg.name] });
        queued++;
      }
      // Root-level commands (login, logout…) have no service; they are not part of the catalog.
      if (job.path.length > 0) {
        for (const c of index.commands) {
          queue.push({ kind: 'command', path: [...job.path, c.name], desc: c.desc });
          queued++;
        }
      }
      return;
    }

    const [service, ...rest] = job.path;
    const svc = services.get(service);
    if (!svc) return;
    const params = parseArguments(text);
    svc.commands.push({
      name: rest.join(' '),
      desc: job.desc,
      required: params.filter(p => p.required).map(({ flag, type, desc }) => ({ flag, type, desc })),
      optional: params.filter(p => !p.required).map(({ flag, type, desc }) => ({ flag, type, desc })),
    });
  };

  console.error(`Reading the Azure CLI help with "${opts.az}" (concurrency ${opts.concurrency})…`);
  await runPool([{ kind: 'group', path: [] }], handler, opts.concurrency);
  showProgress(true);

  await writeCatalog(version, services);
}

async function writeCatalog(version, services) {
  const catalog = {
    generated_from: `azure-cli ${version}`,
    services: [...services.values()]
      .map(s => ({ ...s, commands: s.commands.sort((a, b) => a.name.localeCompare(b.name)) }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };

  await writeFile(opts.out, JSON.stringify(catalog, null, 2) + '\n', 'utf8');
  const nCmds = catalog.services.reduce((n, s) => n + s.commands.length, 0);
  console.error(`Wrote ${catalog.services.length} services and ${nCmds} commands to ${opts.out}`);
}

// Finds the Python that has azure-cli installed: --python / AZ_PYTHON, else the interpreter the `az` launcher runs.
function locatePython() {
  if (opts.python) return opts.python;
  for (const dir of (process.env.PATH || '').split(delimiter)) {
    const file = join(dir, opts.az);
    if (!existsSync(file)) continue;
    const head = readFileSync(file, 'utf8').slice(0, 4096);
    const m = head.match(/(\/\S*python[\d.]*)(?=\s)/);
    if (m && existsSync(m[1])) return resolve(m[1]);
  }
  return process.platform === 'win32' ? 'python' : 'python3';
}

// Fast path: one Python process loads azure-cli's command table and prints it as JSON (see generate-catalog-azure-dump.py).
async function mainFromPython() {
  const python = locatePython();
  const script = join(dirname(fileURLToPath(import.meta.url)), 'generate-catalog-azure-dump.py');
  const args = ['-I', script];
  if (opts.services) args.push('--services', opts.services.join(','));

  console.error(`Reading the Azure CLI command table with "${python}"…`);
  const startedAt = Date.now();
  const stdout = await new Promise((done, fail) => {
    const child = execFile(python, args, { env: ENV, maxBuffer: 512 * 1024 * 1024, timeout: 1800000 }, (err, out) => {
      if (err) fail(err.code === 'ENOENT' ? new Error(`Could not run "${python}". Pass the Python that has azure-cli with --python or AZ_PYTHON.`) : err);
      else done(out);
    });
    child.stderr.pipe(process.stderr);
  });
  const dump = JSON.parse(stdout);
  console.error(`Command table read in ${Math.round((Date.now() - startedAt) / 1000)}s`);

  const services = new Map();
  for (const c of dump.commands) {
    const [service, ...rest] = c.name.split(' ');
    if (!services.has(service)) services.set(service, { id: service, name: dump.groups[service] || '', commands: [] });
    const toParam = p => ({ flag: p.flag, type: p.boolean ? 'boolean' : 'string', desc: p.desc });
    services.get(service).commands.push({
      name: rest.join(' '),
      desc: c.desc,
      required: c.params.filter(p => p.required).map(toParam),
      optional: c.params.filter(p => !p.required).map(toParam),
    });
  }
  await writeCatalog(dump.version, services);
}

(opts.mode === 'help' ? main() : mainFromPython()).catch(err => {
  console.error(err);
  process.exit(1);
});
