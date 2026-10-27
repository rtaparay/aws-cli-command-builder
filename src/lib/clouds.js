// Cloud registry: everything that changes between AWS and Azure lives here.
// To use official logos, drop the SVG files in public/logos/ and set `logo` (e.g. "logos/aws.svg").
export const CLOUDS = {
  aws: {
    id: 'aws',
    short: 'AWS',
    name: 'Amazon Web Services',
    cli: 'aws',
    cliName: 'AWS CLI v2',
    catalogUrl: 'catalog-aws.json',
    source: 'botocore',
    sourceSub: 'service models (Apache-2.0)',
    mark: 'AWS',
    logo: null,
    searchHint: 'list S3 buckets',
  },
  azure: {
    id: 'azure',
    short: 'Azure',
    name: 'Microsoft Azure',
    cli: 'az',
    cliName: 'Azure CLI',
    catalogUrl: 'catalog-azure.json',
    source: 'azure-cli',
    sourceSub: 'command modules (MIT)',
    mark: 'Az',
    logo: null,
    searchHint: 'create a resource group in eastus',
  },
  // Upcoming modules: shown in the menu and home cards with a "Próximamente" message, no catalog yet.
  oci: {
    id: 'oci',
    short: 'OCI',
    name: 'Oracle Cloud Infrastructure',
    cli: 'oci',
    cliName: 'OCI CLI',
    mark: 'OCI',
    logo: null,
    soon: true,
  },
  gcp: {
    id: 'gcp',
    short: 'GCP',
    name: 'Google Cloud Platform',
    cli: 'gcloud',
    cliName: 'Google Cloud CLI',
    mark: 'GCP',
    logo: null,
    soon: true,
  },
};

export const CLOUD_IDS = Object.keys(CLOUDS).filter(id => !CLOUDS[id].soon); // clouds with a catalog
export const SOON_CLOUD_IDS = Object.keys(CLOUDS).filter(id => CLOUDS[id].soon); // coming soon
export const CLOUD_FILTERS = ['all', ...CLOUD_IDS];

export const SOON_MESSAGE = 'Próximamente se va a agregar';

// Each service is tagged with its cloud so the rest of the app knows which CLI to use.
export function tagCloud(services, cloud) {
  return services.map(s => (s.cloud === cloud ? s : { ...s, cloud }));
}

// Accepts the app format ({ generated_from, services }) and the raw Azure CLI dump
// ({ version, groups, commands }) and returns { source, services } or null.
export function normalizeCatalog(data) {
  if (!data) return null;
  if (Array.isArray(data.services) && data.services.length) {
    return { source: data.generated_from || 'catalog', services: data.services };
  }
  if (Array.isArray(data.commands) && data.commands.length && data.groups) {
    const services = new Map();
    const toParam = p => ({ flag: p.flag, type: p.boolean ? 'boolean' : 'string', desc: p.desc });
    for (const c of data.commands) {
      const [service, ...rest] = c.name.split(' ');
      if (!services.has(service)) services.set(service, { id: service, name: data.groups[service] || '', commands: [] });
      services.get(service).commands.push({
        name: rest.join(' '),
        desc: c.desc,
        required: c.params.filter(p => p.required).map(toParam),
        optional: c.params.filter(p => !p.required).map(toParam),
      });
    }
    return { source: 'azure-cli ' + data.version, services: [...services.values()] };
  }
  return null;
}
