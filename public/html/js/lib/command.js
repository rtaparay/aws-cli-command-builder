const CLI = "aws";

// Command parts: required parameters (with a placeholder if missing), optional ones with a value, and globals.
function commandParts(cmd, values, globals) {
  const parts = [];
  cmd.required.forEach(p => {
    const v = (values[p.flag] || "").trim();
    parts.push({ flag: p.flag, val: v || "<value>" });
  });
  cmd.optional.forEach(p => {
    const v = (values[p.flag] || "").trim();
    if (v) parts.push({ flag: p.flag, val: v });
  });
  globalParts(globals).forEach(g => parts.push(g));
  return parts;
}

// Command as plain text, ready to copy.
function previewPlain(svc, cmd, values, globals) {
  const parts = commandParts(cmd, values, globals).map(p => (p.val == null ? p.flag : `${p.flag} ${p.val}`));
  return `${CLI} ${svc.id} ${cmd.name}${parts.length ? " " + parts.join(" ") : ""}`;
}

function missingCount(cmd, values) {
  return cmd.required.filter(p => (values[p.flag] || "").trim() === "").length;
}
