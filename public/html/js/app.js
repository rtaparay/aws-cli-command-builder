// Entry point: application state, navigation, and panel rendering.
const NARROW_QUERY = "(max-width:1040px)";
const TYPE_LABELS = { bool: "boolean", int: "integer" };
const CLOUD_FILTERS = ["all", ...CLOUD_IDS];

const $ = id => document.getElementById(id);

// Each service is tagged with its cloud so the rest of the app knows which CLI to use.
function tagCloud(services, cloud) {
  return services.map(s => (s.cloud === cloud ? s : { ...s, cloud }));
}

function storedCloud() {
  const v = readStorage("cli-cloud", "all");
  return CLOUD_FILTERS.includes(v) ? v : "all";
}

const state = {
  catalogs: { // start with the samples and are replaced by catalog.json / azure-catalog.json on load
    aws: tagCloud(SAMPLE_CATALOG, "aws"),
    azure: tagCloud(AZURE_SAMPLE_CATALOG, "azure"),
  },
  sources: { aws: "sample", azure: "sample" }, // generated_from of the loaded catalog
  cloud: storedCloud(), // "all" | "aws" | "azure": filter of the left menu
  activeSvc: null,
  activeCmd: null,
  values: {}, // flag -> valor escrito
  search: "", // global search
  svcFilter: "",
  cmdFilter: "",
  sidebarHidden: false,
  goptsOpen: false,
  goptsCloud: "aws",
  globals: loadGlobals(), // { aws: {...}, azure: {...} }
  theme: readStorage("cli-theme"), // null = follow the system
  assistant: { config: loadActiveSettings(), messages: [], draft: "", busy: false, cfgOpen: false, cloud: "aws" },
};
if (state.cloud !== "all") state.assistant.cloud = state.cloud;

let items = []; // commands visible given the search, service and filter
let detailKey = null; // "home:<cloud>" or "cloud/svc/cmd" of the mounted detail
let detailStale = true; // forces the detail to be rebuilt (e.g. when values are reset)
let toastTimer = 0;

// Services visible with the current cloud filter.
function visibleCatalog() {
  return state.cloud === "all" ? CLOUD_IDS.flatMap(c => state.catalogs[c]) : state.catalogs[state.cloud];
}

// The cloud that gives context to the screen (accent color, global options, AI prompt).
function contextCloud() {
  if (state.activeSvc) return state.activeSvc.cloud;
  return state.cloud === "all" ? "aws" : state.cloud;
}

function cloudTotals(cloud) {
  const list = state.catalogs[cloud];
  return { services: list.length, commands: list.reduce((a, s) => a + s.commands.length, 0) };
}

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
  const { activeSvc, search, cmdFilter } = state;
  const gt = search.trim().toLowerCase();
  let list;
  if (gt) {
    list = visibleCatalog()
      .flatMap(s => s.commands.map(c => ({ svc: s, cmd: c })))
      .filter(x => (CLOUDS[x.svc.cloud].cli + " " + x.svc.id + " " + x.cmd.name + " " + x.cmd.desc).toLowerCase().includes(gt));
  } else if (activeSvc) {
    list = activeSvc.commands.map(c => ({ svc: activeSvc, cmd: c }));
  } else {
    list = [];
  }
  const ft = cmdFilter.trim().toLowerCase();
  if (ft) list = list.filter(x => (x.cmd.name + " " + x.cmd.desc).toLowerCase().includes(ft));
  return list;
}

// If the active command is no longer in the visible list, select the first one.
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

// Applies a state change, recalculates the selection, and repaints.
function update(change) {
  change();
  ensureSelection();
  render();
}

function render() {
  $("shell").className = "shell" + (isHome() ? " home" : "") + (state.sidebarHidden ? " hide-svc" : "");
  document.documentElement.setAttribute("data-cloud", contextCloud());
  setInput($("search"), state.search);
  setInput($("svc-filter"), state.svcFilter);
  setInput($("cmd-filter"), state.cmdFilter);
  $("search").placeholder = state.cloud === "all"
    ? "Search AWS and Azure commands…"
    : "Search " + CLOUDS[state.cloud].short + " commands…";
  renderTheme();
  renderCloudNav();
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

// Cloud menu at the top of the left pane: "All", AWS and Azure with their totals.
function renderCloudNav() {
  const totalSvcs = CLOUD_IDS.reduce((a, c) => a + state.catalogs[c].length, 0);
  const rows = CLOUD_FILTERS.map(f => {
    const isAll = f === "all";
    const t = isAll ? null : cloudTotals(f);
    return h("button", {
      class: "cloud-row" + (isAll ? " all" : " " + f),
      "aria-current": String(state.cloud === f),
      title: isAll ? "All clouds" : CLOUDS[f].name,
      onclick: () => pickCloud(f),
    },
      isAll ? h("span", { class: "cloud-mark all", "aria-hidden": "true" }, icon("layers")) : cloudMark(f),
      h("span", { class: "cloud-txt" },
        h("span", { class: "cloud-name" }, isAll ? "All clouds" : CLOUDS[f].short + " commands"),
        h("span", { class: "cloud-sub" }, isAll
          ? CLOUD_IDS.map(c => CLOUDS[c].short).join(" + ")
          : t.commands.toLocaleString() + " commands"),
      ),
      h("span", { class: "count" }, (isAll ? totalSvcs : t.services).toLocaleString()),
    );
  });
  const soonRows = SOON_CLOUD_IDS.map(id =>
    h("button", {
      class: "cloud-row soon " + id,
      title: CLOUDS[id].name + " — " + SOON_MESSAGE,
      onclick: e => showComingSoon(id, e.currentTarget),
    },
      cloudMark(id),
      h("span", { class: "cloud-txt" },
        h("span", { class: "cloud-name" }, CLOUDS[id].short + " commands"),
        h("span", { class: "cloud-sub soon-sub" }, CLOUDS[id].cliName),
        h("span", { class: "cloud-sub soon-note", role: "status" }, SOON_MESSAGE),
      ),
      h("span", { class: "soon-badge" }, "Pronto"),
    ),
  );
  $("cloud-nav").replaceChildren(
    h("div", { class: "ph-title" }, "Clouds"), ...rows,
    h("div", { class: "ph-title soon-title" }, "Próximamente"), ...soonRows,
  );
}

function serviceRow(s) {
  return h("button", {
    class: "row",
    "aria-current": String(state.activeSvc === s),
    title: s.name,
    onclick: () => pickService(s),
  },
    h("span", { class: "svc-dot " + s.cloud, "aria-hidden": "true" }),
    h("span", { style: { flex: "1", minWidth: "0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, s.id),
    h("span", { class: "count" }, String(s.commands.length)),
  );
}

// Services grouped by cloud, each group with its header and total.
function renderServices() {
  const term = state.svcFilter.trim().toLowerCase();
  const clouds = state.cloud === "all" ? CLOUD_IDS : [state.cloud];
  const nodes = [];
  clouds.forEach(c => {
    const list = state.catalogs[c].filter(s => !term || (s.id + " " + s.name).toLowerCase().includes(term));
    if (!list.length) return;
    nodes.push(
      h("div", { class: "svc-group-h " + c },
        cloudMark(c, "xs"),
        h("span", null, CLOUDS[c].short + " services"),
        h("span", { class: "n" }, term ? list.length + " / " + state.catalogs[c].length : String(list.length)),
      ),
      ...list.map(serviceRow),
    );
  });
  $("svc-list").replaceChildren(...(nodes.length ? nodes : [h("div", { class: "empty" }, "No services.")]));
}

// List of commands for the active service (or the global search).
function renderCommands() {
  const list = $("cmd-list");
  const searching = !!state.search.trim();
  if (isHome()) {
    list.replaceChildren();
  } else if (items.length === 0) {
    list.replaceChildren(h("div", { class: "empty" }, "No commands."));
  } else {
    list.replaceChildren(
      ...items.map(x =>
        h("button", {
          class: "cmd",
          "aria-current": String(x.cmd === state.activeCmd),
          onclick: () => pickCommand(x),
        },
          searching ? h("span", { class: "cmd-svc " + x.svc.cloud }, CLOUDS[x.svc.cloud].cli + " " + x.svc.id) : null,
          x.cmd.name,
        ),
      ),
    );
  }
}

// Detail: home screen or command. Only rebuilt when the selection changes or values are reset.
function renderDetail() {
  const pane = $("detail-pane");
  const key = state.activeCmd
    ? state.activeSvc.cloud + "/" + state.activeSvc.id + "/" + state.activeCmd.name
    : "home:" + state.cloud;
  if (detailStale || key !== detailKey) {
    detailKey = key;
    detailStale = false;
    if (state.activeCmd) {
      pane.replaceChildren(buildCommandDetail(state.activeSvc, state.activeCmd));
    } else {
      assistantView = null;
      pane.replaceChildren(buildHome(state.cloud));
    }
  } else if (state.activeCmd) {
    updatePreview();
  }
}

// Selecting a cloud filters the menu and takes you to that cloud's home with its services.
function pickCloud(cloud) {
  writeStorage("cli-cloud", cloud);
  update(() => {
    state.cloud = cloud;
    if (cloud !== "all") state.assistant.cloud = cloud;
    state.activeSvc = null;
    state.activeCmd = null;
    resetValues();
    state.search = "";
    state.cmdFilter = "";
    state.svcFilter = "";
  });
  $("svc-list").scrollTop = 0;
  if (isNarrow()) $("detail-pane").scrollIntoView({ behavior: "smooth" });
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

// Changing a filter resets the selection: the first command of the new list is picked.
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

// The preview and form state are updated without rebuilding inputs (so focus is not lost).
function setGlobal(flag, value) {
  const c = state.goptsCloud;
  state.globals = { ...state.globals, [c]: { ...state.globals[c], [flag]: value } };
  saveGlobals(c, state.globals[c]);
  updatePreview();
}

function clearGlobals() {
  const c = state.goptsCloud;
  state.globals = { ...state.globals, [c]: {} };
  saveGlobals(c, {});
  renderGlobalsPanel();
  updatePreview();
}

function setGoptsOpen(open) {
  state.goptsOpen = open;
  if (open) setGoptsCloud(contextCloud());
  renderGlobalsPanel();
}

function setGoptsCloud(cloud) {
  if (state.goptsCloud !== cloud || !globalControls.length) {
    state.goptsCloud = cloud;
    buildGlobalsPanel();
  }
  renderGlobalsPanel();
}

// Global options panel: controls are created once per cloud and then only their values are synced.
let globalControls = [];

function globalControl(opt) {
  const onChange = e => setGlobal(opt.flag, e.target.value);
  if (opt.type === "select") {
    return h("select", { onchange: onChange },
      h("option", { value: "" }, "Select a value…"),
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
  const cloud = state.goptsCloud;
  globalControls = GLOBAL_OPTS_BY_CLOUD[cloud].map(opt => ({ opt, el: globalControl(opt) }));
  $("gopts-tabs").replaceChildren(
    ...CLOUD_IDS.map(c =>
      h("button", { class: "seg-btn " + c, "aria-pressed": String(c === cloud), onclick: () => setGoptsCloud(c) },
        cloudMark(c, "xs"), CLOUDS[c].cliName,
      ),
    ),
  );
  $("gopts-sub").textContent =
    "Options accepted by every " + CLOUDS[cloud].cliName + " command (" + CLOUDS[cloud].cli +
    " …). They are applied to each command you build and persist across pages.";
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
  $("gopts").setAttribute("data-cloud", state.goptsCloud);
  const values = state.globals[state.goptsCloud] || {};
  globalControls.forEach(({ opt, el }) => {
    const raw = values[opt.flag];
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
  notify(ok ? "Copied to clipboard" : "Could not copy");
}

function applyStoredTheme() {
  if (state.theme) document.documentElement.setAttribute("data-theme", state.theme);
}

// Loads one cloud's full catalog; if it fails (no network, file://, file missing), keeps the sample.
function loadCatalog(cloud) {
  fetch(CLOUDS[cloud].catalogUrl)
    .then(r => {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(d => {
      if (!d || !Array.isArray(d.services) || !d.services.length) return;
      update(() => {
        state.catalogs = { ...state.catalogs, [cloud]: tagCloud(d.services, cloud) };
        state.sources = { ...state.sources, [cloud]: d.generated_from || "catalog" };
        // Only the selection that belonged to this cloud is invalidated.
        if (!state.activeSvc || state.activeSvc.cloud === cloud) {
          state.activeSvc = null;
          state.activeCmd = null;
          resetValues();
        }
        detailStale = true;
      });
    })
    .catch(() => { });
}

function init() {
  document.querySelectorAll("[data-icon]").forEach(el => {
    const svg = icon(el.dataset.icon);
    if (el.tagName === "BUTTON") el.replaceChildren(svg);
    else el.replaceWith(svg);
  });
  applyStoredTheme();
  state.goptsCloud = contextCloud();
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
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && state.goptsOpen) setGoptsOpen(false);
  });

  ensureSelection();
  render();

  CLOUD_IDS.forEach(loadCatalog);
}

init();
