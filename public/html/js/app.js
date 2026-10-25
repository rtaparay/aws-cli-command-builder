// Punto de entrada: estado de la aplicación, navegación y render de los paneles.
const NARROW_QUERY = "(max-width:1040px)";
const TYPE_LABELS = { bool: "boolean", int: "integer" };

const $ = id => document.getElementById(id);

const state = {
  catalog: SAMPLE_CATALOG, // arranca con la muestra y se reemplaza por catalog.json al cargar
  activeSvc: null,
  activeCmd: null,
  values: {}, // flag -> valor escrito
  search: "", // búsqueda global
  svcFilter: "",
  cmdFilter: "",
  sidebarHidden: false,
  goptsOpen: false,
  globals: loadGlobals(),
  theme: readStorage("cli-theme"), // null = según el sistema
  assistant: { config: loadActiveSettings(), messages: [], draft: "", busy: false, cfgOpen: false },
};

let items = []; // comandos visibles según búsqueda, servicio y filtro
let detailKey = null; // "home" o "svc/cmd" del detalle montado
let detailStale = true; // fuerza a reconstruir el detalle (p. ej. al reiniciar valores)
let toastTimer = 0;

function isDark() {
  return state.theme ? state.theme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function isHome() {
  return !state.activeSvc && !state.search.trim();
}

function isNarrow() {
  return window.matchMedia(NARROW_QUERY).matches;
}

function resetValues() {
  state.values = {};
  detailStale = true;
}

function computeItems() {
  const { catalog, activeSvc, search, cmdFilter } = state;
  const gt = search.trim().toLowerCase();
  let list;
  if (gt) {
    list = catalog
      .flatMap(s => s.commands.map(c => ({ svc: s, cmd: c })))
      .filter(x => (x.svc.id + " " + x.cmd.name + " " + x.cmd.desc).toLowerCase().includes(gt));
  } else if (activeSvc) {
    list = activeSvc.commands.map(c => ({ svc: activeSvc, cmd: c }));
  } else {
    list = [];
  }
  const ft = cmdFilter.trim().toLowerCase();
  if (ft) list = list.filter(x => (x.cmd.name + " " + x.cmd.desc).toLowerCase().includes(ft));
  return list;
}

// Si el comando activo no está en la lista visible, selecciona el primero.
function ensureSelection() {
  items = computeItems();
  if (!items.length) {
    state.activeCmd = null;
    return;
  }
  if (!state.activeCmd || !items.some(x => x.cmd === state.activeCmd)) {
    state.activeSvc = items[0].svc;
    state.activeCmd = items[0].cmd;
    resetValues();
  }
}

// Aplica un cambio de estado, recalcula la selección y repinta.
function update(change) {
  change();
  ensureSelection();
  render();
}

function render() {
  $("shell").className = "shell" + (isHome() ? " home" : "") + (state.sidebarHidden ? " hide-svc" : "");
  setInput($("search"), state.search);
  setInput($("svc-filter"), state.svcFilter);
  setInput($("cmd-filter"), state.cmdFilter);
  renderTheme();
  renderServices();
  renderCommands();
  renderDetail();
  renderGlobalsPanel();
}

function setInput(el, value) {
  if (el.value !== value) el.value = value;
}

function renderTheme() {
  const dark = isDark();
  $("btn-theme").replaceChildren(icon(dark ? "sun" : "moon"));
}

function renderServices() {
  const term = state.svcFilter.trim().toLowerCase();
  const list = state.catalog.filter(s => !term || (s.id + " " + s.name).toLowerCase().includes(term));
  $("svc-list").replaceChildren(
    ...(list.length === 0
      ? [h("div", { class: "empty" }, "Sin servicios.")]
      : list.map(s =>
        h("button", {
          class: "row",
          "aria-current": String(state.activeSvc?.id === s.id),
          onclick: () => pickService(s),
        },
          h("span", { style: { flex: "1", minWidth: "0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, s.id),
          h("span", { class: "count" }, String(s.commands.length)),
        ),
      )),
  );
}

// Lista de comandos del servicio activo (o de la búsqueda global).
function renderCommands() {
  const list = $("cmd-list");
  if (isHome()) {
    list.replaceChildren();
  } else if (items.length === 0) {
    list.replaceChildren(h("div", { class: "empty" }, "Sin comandos."));
  } else {
    list.replaceChildren(
      ...items.map(x =>
        h("button", {
          class: "cmd",
          "aria-current": String(x.cmd === state.activeCmd),
          onclick: () => pickCommand(x),
        }, x.cmd.name),
      ),
    );
  }
}

// Detalle: pantalla de inicio o comando. Solo se reconstruye cuando cambia la selección o se reinician valores.
function renderDetail() {
  const pane = $("detail-pane");
  const key = state.activeCmd ? state.activeSvc.id + "/" + state.activeCmd.name : "home";
  if (detailStale || key !== detailKey) {
    detailKey = key;
    detailStale = false;
    if (state.activeCmd) {
      pane.replaceChildren(buildCommandDetail(state.activeSvc, state.activeCmd));
    } else {
      assistantView = null;
      pane.replaceChildren(buildHome(state.catalog));
    }
  } else if (state.activeCmd) {
    updatePreview();
  }
}

function pickService(svc) {
  update(() => {
    state.activeSvc = svc;
    state.activeCmd = null;
    resetValues();
    state.search = "";
    state.cmdFilter = "";
  });
  if (isNarrow()) $("cmds-pane").scrollIntoView({ behavior: "smooth" });
}

function pickCommand({ svc, cmd }) {
  update(() => {
    state.activeSvc = svc;
    state.activeCmd = cmd;
    resetValues();
  });
  if (isNarrow()) $("detail-pane").scrollIntoView({ behavior: "smooth" });
}

// Cambiar un filtro reinicia la selección: se elige el primer comando de la nueva lista.
function changeSearch(value) {
  update(() => {
    state.search = value;
    state.activeCmd = null;
    resetValues();
  });
}

function changeCmdFilter(value) {
  update(() => {
    state.cmdFilter = value;
    state.activeCmd = null;
    resetValues();
  });
}

function goHome() {
  update(() => {
    state.activeSvc = null;
    state.activeCmd = null;
    resetValues();
    state.search = "";
    state.cmdFilter = "";
    state.svcFilter = "";
  });
}

function setTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute("data-theme", theme);
  writeStorage("cli-theme", theme);
  render();
}

// Vista previa y estado del formulario se actualizan sin reconstruir inputs (así no se pierde el foco).
function setGlobal(flag, value) {
  state.globals = { ...state.globals, [flag]: value };
  saveGlobals(state.globals);
  updatePreview();
}

function clearGlobals() {
  state.globals = {};
  saveGlobals(state.globals);
  renderGlobalsPanel();
  updatePreview();
}

function setGoptsOpen(open) {
  state.goptsOpen = open;
  renderGlobalsPanel();
}

// Panel de opciones globales: los controles se crean una vez y luego solo se sincronizan sus valores.
let globalControls = [];

function globalControl(opt) {
  const onChange = e => setGlobal(opt.flag, e.target.value);
  if (opt.type === "select") {
    return h("select", { onchange: onChange },
      h("option", { value: "" }, "Selecciona un valor…"),
      opt.values.map(x => h("option", { value: x }, x)),
    );
  }
  if (opt.type === "bool") {
    return h("select", { onchange: onChange },
      h("option", { value: "" }, "Not set"),
      h("option", { value: "1" }, opt.flag),
    );
  }
  return h("input", {
    type: opt.type === "int" ? "number" : "text",
    placeholder: opt.type === "int" ? "0" : "value",
    autocomplete: "off",
    spellcheck: "false",
    oninput: onChange,
  });
}

function buildGlobalsPanel() {
  globalControls = GLOBAL_OPTS.map(opt => ({ opt, el: globalControl(opt) }));
  $("gopts-body").replaceChildren(
    ...globalControls.map(({ opt, el }) =>
      h("div", { class: "gopt" },
        h("label", null,
          h("span", { class: "flag" }, opt.flag), " ",
          h("span", { class: "type" }, TYPE_LABELS[opt.type] || "string"),
        ),
        el,
        h("p", { class: "hint" }, opt.hint),
      ),
    ),
  );
}

function renderGlobalsPanel() {
  $("gopts-overlay").hidden = !state.goptsOpen;
  $("gopts").hidden = !state.goptsOpen;
  globalControls.forEach(({ opt, el }) => {
    const raw = state.globals[opt.flag];
    const value = opt.type === "bool" ? (raw ? "1" : "") : raw != null ? String(raw) : "";
    setInput(el, value);
  });
}

function notify(msg) {
  const toast = $("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 1600);
}

async function copy(text) {
  const ok = await copyText(text);
  notify(ok ? "Copiado al portapapeles" : "No se pudo copiar");
}

function applyStoredTheme() {
  if (state.theme) document.documentElement.setAttribute("data-theme", state.theme);
}

function init() {
  document.querySelectorAll("[data-icon]").forEach(el => {
    const svg = icon(el.dataset.icon);
    if (el.tagName === "BUTTON") el.replaceChildren(svg);
    else el.replaceWith(svg);
  });
  applyStoredTheme();
  buildGlobalsPanel();

  $("btn-sidebar").addEventListener("click", () => {
    state.sidebarHidden = !state.sidebarHidden;
    render();
  });
  $("btn-home").addEventListener("click", goHome);
  $("btn-gopts").addEventListener("click", () => setGoptsOpen(true));
  $("btn-theme").addEventListener("click", () => setTheme(isDark() ? "light" : "dark"));
  $("search").addEventListener("input", e => changeSearch(e.target.value));
  $("svc-filter").addEventListener("input", e => {
    state.svcFilter = e.target.value;
    renderServices();
  });
  $("cmd-filter").addEventListener("input", e => changeCmdFilter(e.target.value));
  $("gopts-overlay").addEventListener("click", () => setGoptsOpen(false));
  $("gopts-close").addEventListener("click", () => setGoptsOpen(false));
  $("gopts-clear").addEventListener("click", clearGlobals);

  ensureSelection();
  render();

  // Carga el catálogo completo; si falla (sin red, file://), se conserva la muestra.
  fetch("catalog.json")
    .then(r => {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(d => {
      if (!d || !Array.isArray(d.services) || !d.services.length) return;
      update(() => {
        state.catalog = d.services;
        state.activeSvc = null;
        state.activeCmd = null;
        resetValues();
        state.search = "";
        state.svcFilter = "";
        state.cmdFilter = "";
      });
    })
    .catch(() => { });
}

init();
