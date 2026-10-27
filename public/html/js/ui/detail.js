// Command detail: parameter form, preview, and copy button.
// Only one command is mounted at a time; detailRefs points to its preview box.
let detailRefs = null;

function previewBody(svc, cmd, parts) {
  const rows = [
    h("span", null,
      h("span", { class: "k" }, cliFor(svc)), " ",
      h("span", { class: "svc" }, svc.id), " ",
      h("span", { class: "cmd" }, cmd.name),
      parts.length > 0 ? h("span", { class: "cont" }, " \\") : null,
    ),
  ];
  parts.forEach((p, i) => {
    const last = i === parts.length - 1;
    rows.push(
      h("span", null,
        "    ",
        h("span", { class: "flag" }, p.flag),
        p.val != null ? [" ", h("span", { class: "val" }, p.val)] : null,
        !last ? h("span", { class: "cont" }, " \\") : null,
      ),
    );
  });
  return h("div", { class: "preview-body" }, rows.flatMap((row, i) => (i > 0 ? ["\n", row] : [row])));
}

// Repaints the preview and the missing required parameters warning (without rebuilding the form).
function updatePreview() {
  if (!detailRefs) return;
  const { activeSvc: svc, activeCmd: cmd, values, globals } = state;
  const box = detailRefs.box;
  box.querySelectorAll(".warn, .preview-body").forEach(n => n.remove());
  const miss = missingCount(cmd, values);
  if (miss > 0) {
    box.append(
      h("div", { class: "warn" },
        icon("warn"),
        `${miss} required parameter${miss > 1 ? "s" : ""} missing`,
      ),
    );
  }
  box.append(previewBody(svc, cmd, commandParts(svc, cmd, values, globals)));
}

function paramField(p, required) {
  const input = h("input", {
    type: "text",
    placeholder: p.type === "boolean" ? "true / false" : "value",
    autocomplete: "off",
    spellcheck: "false",
    value: state.values[p.flag] || "",
    oninput: e => {
      state.values[p.flag] = e.target.value;
      updatePreview();
    },
  });
  return h("div", { class: "param" },
    h("label", null,
      h("span", { class: "flag" }, p.flag),
      required ? h("span", { class: "req" }, "*") : null,
      h("span", { class: "type" }, p.type),
    ),
    input,
    p.desc ? h("p", { class: "hint" }, p.desc) : null,
  );
}

function section(title, params, required) {
  const sec = h("div", { class: "section" },
    h("div", { class: "section-h", onclick: () => sec.classList.toggle("collapsed") },
      title,
      h("span", { class: "n" }, String(params.length)),
      h("span", { class: "chev" }, "▾"),
    ),
    h("div", { class: "section-b" }, params.map(p => paramField(p, required))),
  );
  return sec;
}

function buildCommandDetail(svc, cmd) {
  const box = h("div", { class: "preview" },
    h("div", { class: "preview-h" },
      h("span", { class: "t" }, h("span", { class: "pr" }, ">_"), " Command preview"),
      h("span", { class: "acts" },
        h("button", {
          title: "Copy",
          onclick: () => copy(previewPlain(svc, cmd, state.values, state.globals)),
        }, icon("copy")),
      ),
    ),
  );
  detailRefs = { box };

  const cloud = CLOUDS[svc.cloud];
  const note = h("div", { class: "note" });
  note.innerHTML = svc.cloud === "azure"
    ? 'Functional recreation of the command builder pattern for the <b>Azure CLI</b>. The full catalog is generated from the <b>azure-cli command modules</b> (MIT) — this page makes no calls to Azure; it only composes the <code>az …</code> string.'
    : 'This is a <b>functional recreation</b> of the command builder pattern. The data is a sample subset of the <b>AWS CLI v2</b> catalog. The full catalog is generated from the <b>botocore service models</b> (JSON, Apache-2.0) — this page makes no calls to AWS; it only composes the <code>aws …</code> string.';

  const el = h("div", { class: "detail-in" },
    h("div", { class: "crumb-cloud" },
      cloudMark(svc.cloud, "xs"),
      h("span", null, cloud.name),
      h("span", { class: "sep" }, "/"),
      h("span", null, (svc.name || svc.id).replace(/\.$/, "")),
    ),
    h("div", { class: "crumb" }, svc.id + " ", h("b", null, cmd.name)),
    h("p", { class: "d-desc" }, cmd.desc),
    box,
    cmd.required.length > 0 ? section("Required parameters", cmd.required, true) : null,
    cmd.optional.length > 0 ? section("Optional parameters", cmd.optional, false) : null,
    note,
  );
  updatePreview();
  return el;
}
