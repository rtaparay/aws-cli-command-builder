// Detalle de un comando: formulario de parámetros, vista previa y botón de copiar.
// Solo existe un comando montado a la vez; detailRefs apunta a su caja de vista previa.
let detailRefs = null;

function previewBody(svc, cmd, parts) {
  const rows = [
    h("span", null,
      h("span", { class: "k" }, CLI), " ",
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

// Vuelve a pintar la vista previa y el aviso de parámetros requeridos (sin reconstruir el formulario).
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
        `${miss} parámetro${miss > 1 ? "s" : ""} requerido${miss > 1 ? "s" : ""} sin completar`,
      ),
    );
  }
  box.append(previewBody(svc, cmd, commandParts(cmd, values, globals)));
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
      h("span", { class: "t" }, h("span", { class: "pr" }, ">_"), " Vista previa del comando"),
      h("span", { class: "acts" },
        h("button", {
          title: "Copiar",
          onclick: () => copy(previewPlain(svc, cmd, state.values, state.globals)),
        }, icon("copy")),
      ),
    ),
  );
  detailRefs = { box };

  const note = h("div", { class: "note" });
  note.innerHTML =
    'Esta es una <b>recreación funcional</b> del patrón de constructor de comandos. Los datos son un subconjunto de ejemplo del catálogo de <b>AWS CLI v2</b>. El catálogo completo se genera desde los <b>service models de botocore</b> (JSON, Apache-2.0) — no hay llamadas a AWS en esta página; solo compone la cadena <code>aws …</code>.';

  const el = h("div", { class: "detail-in" },
    h("div", { class: "crumb" }, svc.id + " ", h("b", null, cmd.name)),
    h("p", { class: "d-desc" }, cmd.desc),
    box,
    cmd.required.length > 0 ? section("Parámetros requeridos", cmd.required, true) : null,
    cmd.optional.length > 0 ? section("Parámetros opcionales", cmd.optional, false) : null,
    note,
  );
  updatePreview();
  return el;
}
