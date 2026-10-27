// Generates public/catalog-aws.json from the botocore service models (the same JSON models the AWS CLI is built on).
// Each service directory becomes a service; each operation becomes a command (`aws <service> <operation>`),
// and the members of the operation input become its parameters.
//
// Why not `aws <service> <command> help`? The CLI only renders the botocore models, so reading them directly is
// faster (seconds instead of ~19k process spawns) and needs no AWS CLI, credentials or network.
//
// Usage (needs botocore, e.g. in a .venv: `python3 -m venv .venv && .venv/bin/pip install botocore`, or point --data at an extracted copy of botocore/data):
//   npm run catalog:aws
//   npm run catalog:aws -- --services ec2,s3,iam --out public/catalog-aws.json
//   npm run catalog:aws -- --concurrency 16
//   npm run catalog:aws -- --data /path/to/botocore/data
//   npm run catalog:aws -- --python /path/to/python
//
// Not covered: hand-written CLI commands that are not in the models (`aws s3 cp/sync`, `aws configure`, …).

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { gunzip } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DESC_MAX = 220;
const gunzipAsync = promisify(gunzip);

function parseArgs(argv) {
  const opts = { data: process.env.BOTOCORE_DATA || null, python: process.env.PYTHON_BIN || null, services: null, concurrency: 8, out: resolve(ROOT, 'public/catalog-aws.json') };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === '--data') opts.data = resolve(process.cwd(), value);
    else if (key === '--services') opts.services = value.split(',').map(s => s.trim()).filter(Boolean);
    else if (key === '--concurrency') opts.concurrency = Math.max(1, Number(value) || 8);
    else if (key === '--python') opts.python = value;
    else if (key === '--out') opts.out = resolve(process.cwd(), value);
    else continue;
    i++;
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));

// Finds botocore/data through the Python that has botocore installed (the project's .venv first).
function locateData() {
  for (const py of [opts.python, resolve(ROOT, '.venv/bin/python'), resolve(ROOT, '.venv/Scripts/python.exe'), 'python3', 'python']) {
    if (!py) continue;
    try {
      const dir = execFileSync(py, ['-c', 'import botocore,os;print(os.path.join(os.path.dirname(botocore.__file__),"data"))'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      if (dir) return dir;
    } catch {
      // try the next interpreter
    }
  }
  return null;
}

// Same transformation as botocore.xform_name(name, '-'): "DescribeDBInstances" -> "describe-db-instances".
const SPECIAL_CASE = /[A-Z]{2,}s$/;
const FIRST_CAP = /(.)([A-Z][a-z]+)/g;
const END_CAP = /([a-z0-9])([A-Z])/g;
const XFORM_CACHE = {
  CreateCachediSCSIVolume: 'create-cached-iscsi-volume',
  DescribeCachediSCSIVolumes: 'describe-cached-iscsi-volumes',
  DescribeStorediSCSIVolumes: 'describe-stored-iscsi-volumes',
  CreateStorediSCSIVolume: 'create-stored-iscsi-volume',
  ListHITsForQualificationType: 'list-hits-for-qualification-type',
  ExecutePartiQLStatement: 'execute-partiql-statement',
  ExecutePartiQLTransaction: 'execute-partiql-transaction',
  ExecutePartiQLBatch: 'execute-partiql-batch',
};
function xformName(name) {
  if (name.includes('-')) return name;
  if (XFORM_CACHE[name]) return XFORM_CACHE[name];
  const special = name.match(SPECIAL_CASE);
  if (special) name = `${name.slice(0, -special[0].length)}-${special[0].toLowerCase()}`;
  return name.replace(FIRST_CAP, '$1-$2').replace(END_CAP, '$1-$2').toLowerCase();
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

// The models document everything in HTML; the catalog keeps the first sentence as plain text.
function plainText(html) {
  if (!html) return '';
  let text = html
    .replace(/<(?:note|important|examples?|codeblock|pre)\b[\s\S]*?<\/(?:note|important|examples?|codeblock|pre)>/gi, ' ')
    .replace(/<\/(?:p|li|ul|ol|div|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => {
      if (e[0] === '#') {
        const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    });
  text = text.replace(/\s+/g, ' ').trim();
  const sentence = text.match(/^.*?[.!?](?=\s|$)/);
  text = sentence ? sentence[0] : text;
  return text.length > DESC_MAX ? text.slice(0, DESC_MAX) : text;
}

// Maps a model shape to the type shown in the UI: string, integer, list<structure>, map…
function typeOf(shapes, shapeName) {
  const shape = shapes[shapeName];
  if (!shape) return 'string';
  if (shape.type === 'list') {
    const member = shapes[shape.member?.shape];
    return `list<${member ? member.type : 'string'}>`;
  }
  return shape.type;
}

async function readJson(path) {
  const buf = await readFile(path);
  return JSON.parse((path.endsWith('.gz') ? await gunzipAsync(buf) : buf).toString('utf8'));
}

// Loads the newest API version of a service directory.
async function loadModel(serviceDir) {
  const versions = readdirSync(serviceDir)
    .filter(v => statSync(join(serviceDir, v)).isDirectory())
    .sort();
  for (const version of versions.reverse()) {
    for (const file of ['service-2.json.gz', 'service-2.json']) {
      const path = join(serviceDir, version, file);
      if (existsSync(path)) return await readJson(path);
    }
  }
  return null;
}

function buildCommand(model, op) {
  const shapes = model.shapes || {};
  const input = op.input ? shapes[op.input.shape] : null;
  const requiredSet = new Set(input?.required || []);
  const params = Object.entries(input?.members || {}).map(([name, ref]) => ({
    flag: `--${xformName(name)}`,
    type: typeOf(shapes, ref.shape),
    desc: plainText(ref.documentation || shapes[ref.shape]?.documentation),
    required: requiredSet.has(name),
  }));
  const strip = ({ flag, type, desc }) => (desc ? { flag, type, desc } : { flag, type });
  return {
    // CloudFront operations carry a version suffix in the model ("DeleteKeyGroup2020_05_31"); the CLI drops it.
    name: xformName(op.name.replace(/\d{4}_\d{2}_\d{2}$/, '')),
    desc: plainText(op.documentation),
    required: params.filter(p => p.required).map(strip),
    optional: params.filter(p => !p.required).map(strip),
  };
}

// Runs `handler` over all items with at most `concurrency` in flight.
async function runPool(items, handler, concurrency) {
  const queue = [...items];
  const worker = async () => {
    while (queue.length) await handler(queue.shift());
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
}

async function main() {
  const data = opts.data || locateData();
  if (!data || !existsSync(data)) {
    console.error('Could not find the botocore models. Install them with `pip install botocore`,');
    console.error('or pass --data /path/to/botocore/data (or set BOTOCORE_DATA).');
    process.exit(1);
  }

  let version = 'unknown';
  const init = join(data, '..', '__init__.py');
  if (existsSync(init)) version = readFileSync(init, 'utf8').match(/__version__\s*=\s*['"]([^'"]+)['"]/)?.[1] || version;

  const ids = readdirSync(data)
    .sort()
    .filter(id => statSync(join(data, id)).isDirectory() && (!opts.services || opts.services.includes(id)));

  const services = [];
  let done = 0;
  const startedAt = Date.now();
  const tty = process.stderr.isTTY;
  const elapsed = () => {
    const secs = Math.round((Date.now() - startedAt) / 1000);
    return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  };
  // The total is known up front (one model per service), so the percentage is exact.
  function showProgress(final = false) {
    const pct = ids.length ? Math.floor((done / ids.length) * 100) : 100;
    const line = `${pct}%  ${done}/${ids.length} services  (${elapsed()})`;
    if (tty) process.stderr.write(`\r${line}${final ? '\n' : '   '}`);
    else if (final || done % 50 === 0) console.error(line);
  }

  console.error(`Reading the botocore ${version} models in ${data} (concurrency ${opts.concurrency})…`);
  await runPool(
    ids,
    async id => {
      const model = await loadModel(join(data, id));
      done++;
      showProgress();
      if (!model) return;
      const commands = Object.values(model.operations || {})
        .map(op => buildCommand(model, op))
        .sort((a, b) => a.name.localeCompare(b.name));
      services.push({ id, name: model.metadata?.serviceFullName || model.metadata?.serviceId || id, commands });
    },
    opts.concurrency,
  );
  showProgress(true);

  // Workers finish out of order; sort so the output is deterministic.
  services.sort((a, b) => a.id.localeCompare(b.id));
  const catalog = { generated_from: `botocore ${version}`, services };
  await writeFile(opts.out, JSON.stringify(catalog, null, 2) + '\n', 'utf8');
  const nCmds = services.reduce((n, s) => n + s.commands.length, 0);
  console.error(`Wrote ${services.length} services and ${nCmds} commands to ${opts.out} in ${elapsed()}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
