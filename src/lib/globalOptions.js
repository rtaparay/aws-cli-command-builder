import { CLOUD_IDS } from './clouds.js';
import { readStorage, writeStorage } from './storage.js';

// Options accepted by every command, per cloud CLI.
export const GLOBAL_OPTS_BY_CLOUD = {
  aws: [
    { flag: "--region", type: "string", hint: "The region to use. Overrides the configuration and environment variables." },
    { flag: "--output", type: "select", values: ["json", "yaml", "yaml-stream", "text", "table"], hint: "The output format style of the command." },
    { flag: "--profile", type: "string", hint: "Uses a specific profile from your credentials file." },
    { flag: "--query", type: "string", hint: "A JMESPath query to filter the response data." },
    { flag: "--endpoint-url", type: "string", hint: "Overrides the command's default URL with the given URL." },
    { flag: "--debug", type: "bool", hint: "Enables debug logging." },
    { flag: "--no-verify-ssl", type: "bool", hint: "Disables SSL certificate verification (enabled by default)." },
    { flag: "--no-paginate", type: "bool", hint: "Disables automatic pagination: makes a single call (first page only)." },
    { flag: "--no-sign-request", type: "bool", hint: "Does not sign requests; credentials will not be loaded with this argument." },
    { flag: "--no-cli-pager", type: "bool", hint: "Disables the CLI pager for output." },
    { flag: "--cli-auto-prompt", type: "bool", hint: "Automatically prompts for the CLI input parameters." },
    { flag: "--no-cli-auto-prompt", type: "bool", hint: "Disables automatic prompting for input parameters." },
    { flag: "--color", type: "select", values: ["on", "off", "auto"], hint: "Turns color in the output on/off." },
    { flag: "--ca-bundle", type: "string", hint: "CA certificate bundle used to verify SSL. Overrides the config/environment variables." },
    { flag: "--cli-read-timeout", type: "int", hint: "Maximum socket read time in seconds. 0 = no timeout (blocking)." },
    { flag: "--cli-connect-timeout", type: "int", hint: "Maximum socket connection time in seconds. 0 = no timeout (blocking)." },
    { flag: "--cli-binary-format", type: "select", values: ["base64", "raw-in-base64-out"], hint: "Format style for binary blobs. Defaults to base64." },
  ],
  azure: [
    { flag: "--subscription", type: "string", hint: "Name or ID of the subscription. Overrides the default set with 'az account set'." },
    { flag: "--output", type: "select", values: ["json", "jsonc", "none", "table", "tsv", "yaml", "yamlc"], hint: "Output format." },
    { flag: "--query", type: "string", hint: "JMESPath query string to filter the output." },
    { flag: "--only-show-errors", type: "bool", hint: "Only show errors, suppressing warnings." },
    { flag: "--verbose", type: "bool", hint: "Increase logging verbosity." },
    { flag: "--debug", type: "bool", hint: "Increase logging verbosity to show all debug logs." },
  ],
};

// AWS keeps the original key so values saved before multi-cloud are not lost.
const GLOBALS_STORAGE_KEYS = { aws: 'cli-globals', azure: 'cli-globals-azure' };

export function loadGlobals() {
  const out = {};
  CLOUD_IDS.forEach(c => {
    try {
      out[c] = JSON.parse(readStorage(GLOBALS_STORAGE_KEYS[c], '{}')) || {};
    } catch (e) {
      out[c] = {};
    }
  });
  return out;
}

export function saveGlobals(cloud, globals) {
  writeStorage(GLOBALS_STORAGE_KEYS[cloud], JSON.stringify(globals));
}

// Converts the saved values of one cloud into {flag, val} parts for the command line.
// Booleans carry no value (val null).
export function globalParts(cloud, globals) {
  const out = [];
  (GLOBAL_OPTS_BY_CLOUD[cloud] || []).forEach(o => {
    const v = globals[o.flag];
    if (o.type === 'bool') {
      if (v) out.push({ flag: o.flag, val: null });
    } else if (v != null && String(v).trim() !== '') {
      out.push({ flag: o.flag, val: String(v).trim() });
    }
  });
  return out;
}
