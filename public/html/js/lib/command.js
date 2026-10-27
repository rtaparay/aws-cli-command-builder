// The CLI binary depends on the cloud of the service: "aws" or "az".
function cliFor(svc) {
  return CLOUDS[svc.cloud || "aws"].cli;
}

// Command parts: required parameters (with a placeholder if missing), optional ones with a value, and globals.
// `globals` is the map of saved values for every cloud ({ aws: {...}, azure: {...} }).
function commandParts(svc, cmd, values, globals) {
  const parts = [];
  cmd.required.forEach(p => {
    const v = (values[p.flag] || "").trim();
    parts.push({ flag: p.flag, val: v || "<value>" });
  });
  cmd.optional.forEach(p => {
    const v = (values[p.flag] || "").trim();
    if (v) parts.push({ flag: p.flag, val: v });
  });
  const cloud = svc.cloud || "aws";
  globalParts(cloud, globals[cloud] || {}).forEach(g => parts.push(g));
  return parts;
}

// Command as plain text, ready to copy.
function previewPlain(svc, cmd, values, globals) {
  const parts = commandParts(svc, cmd, values, globals).map(p => (p.val == null ? p.flag : `${p.flag} ${p.val}`));
  return `${cliFor(svc)} ${svc.id} ${cmd.name}${parts.length ? " " + parts.join(" ") : ""}`;
}

function missingCount(cmd, values) {
  return cmd.required.filter(p => (values[p.flag] || "").trim() === "").length;
}
