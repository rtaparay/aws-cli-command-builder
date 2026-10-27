// Home screen: catalog summary per cloud and AI assistant.
function statCard(iconName, label, value, sub) {
  return h("div", { class: "stat" },
    h("div", { class: "h" }, h("span", null, label), h("span", { class: "ic" }, icon(iconName))),
    h("div", { class: "num" }, typeof value === "number" ? value.toLocaleString() : String(value)),
    h("div", { class: "s" }, sub),
  );
}

function catalogCounts(catalog) {
  return {
    services: catalog.length,
    commands: catalog.reduce((a, s) => a + s.commands.length, 0),
    flags: catalog.reduce((a, s) => a + s.commands.reduce((b, c) => b + c.required.length + c.optional.length, 0), 0),
  };
}

function sourceLabel(cloud) {
  const src = state.sources[cloud];
  return src === "sample" ? "sample catalog" : src;
}

// "All clouds" view: one card per cloud that leads to its services.
function cloudCard(cloud) {
  const c = CLOUDS[cloud];
  const n = catalogCounts(state.catalogs[cloud]);
  return h("button", { class: "cloud-card " + cloud, onclick: () => pickCloud(cloud) },
    h("div", { class: "cc-head" },
      cloudMark(cloud, "lg"),
      h("div", { style: { minWidth: "0" } },
        h("div", { class: "cc-name" }, c.name),
        h("div", { class: "cc-cli" }, c.cliName + " · ", h("code", null, c.cli + " …")),
      ),
    ),
    h("div", { class: "cc-nums" },
      h("div", null, h("b", null, n.services.toLocaleString()), h("span", null, "services")),
      h("div", null, h("b", null, n.commands.toLocaleString()), h("span", null, "commands")),
      h("div", null, h("b", null, n.flags.toLocaleString()), h("span", null, "parameters")),
    ),
    h("div", { class: "cc-foot" },
      h("span", null, "Source: " + sourceLabel(cloud)),
      h("span", { class: "cc-go" }, "Browse " + c.short + " services →"),
    ),
  );
}

// Upcoming cloud card: same layout, no numbers yet; a click reveals the "Próximamente" message.
function soonCloudCard(cloud) {
  const c = CLOUDS[cloud];
  return h("button", {
    class: "cloud-card soon " + cloud,
    "aria-label": c.name + " — " + SOON_MESSAGE,
    onclick: e => showComingSoon(cloud, e.currentTarget),
  },
    h("div", { class: "cc-head" },
      cloudMark(cloud, "lg"),
      h("div", { style: { minWidth: "0" } },
        h("div", { class: "cc-name" }, c.name),
        h("div", { class: "cc-cli" }, c.cliName + " · ", h("code", null, c.cli + " …")),
      ),
      h("span", { class: "soon-badge" }, "Próximamente"),
    ),
    h("div", { class: "cc-soon", role: "status" },
      h("span", { class: "cc-soon-default" }, "Módulo en preparación. Haz clic para ver el estado."),
      h("span", { class: "cc-soon-msg" }, "⏳ " + SOON_MESSAGE),
    ),
    h("div", { class: "cc-foot" },
      h("span", null, "Catalog: pending"),
      h("span", { class: "cc-go" }, "Coming soon"),
    ),
  );
}

function serviceTile(s) {
  return h("button", { class: "svc-tile " + s.cloud, title: s.name, onclick: () => pickService(s) },
    h("span", { class: "st-id" }, s.id),
    h("span", { class: "st-name" }, s.name && s.name !== s.id ? s.name : " "),
    h("span", { class: "st-n" }, s.commands.length + " cmd"),
  );
}

function buildHome(filter) {
  if (filter === "all") {
    const total = CLOUD_IDS.reduce((a, c) => {
      const n = catalogCounts(state.catalogs[c]);
      return { services: a.services + n.services, commands: a.commands + n.commands };
    }, { services: 0, commands: 0 });
    return h("div", { class: "detail-in" },
      h("div", { class: "hero" },
        h("span", { class: "eyebrow" }, ">_ Multi-cloud catalog · AWS + Azure"),
        h("h2", null, "Create AWS and Azure CLI commands step by step"),
        h("p", null,
          "Pick a cloud, explore its services, choose a command and complete it parameter by parameter. " +
          total.services.toLocaleString() + " services and " + total.commands.toLocaleString() +
          " commands, with the preview assembled automatically and ready to be copied to the terminal."),
      ),
      h("div", { class: "cloud-cards" }, CLOUD_IDS.map(cloudCard)),
      h("div", { class: "svc-grid-h" }, h("span", null, "Próximamente"), h("span", { class: "n" }, String(SOON_CLOUD_IDS.length))),
      h("div", { class: "cloud-cards soon-cards" }, SOON_CLOUD_IDS.map(soonCloudCard)),
      buildAssistantCard(),
    );
  }

  const c = CLOUDS[filter];
  const catalog = state.catalogs[filter];
  const n = catalogCounts(catalog);
  return h("div", { class: "detail-in" },
    h("div", { class: "hero" },
      h("span", { class: "eyebrow" }, cloudMark(filter, "xs"), ">_ " + c.cliName + " catalog · " + c.source),
      h("h2", null, "Create " + c.short + " CLI commands step by step"),
      h("p", null, "Explore the " + c.name + " services, choose a command, and complete it parameter by parameter. The preview will automatically assemble the ", h("code", null, c.cli + " …"), " line, ready to be copied to the terminal."),
    ),
    h("div", { class: "stats" },
      statCard("service", "Services", n.services, c.short + " services"),
      statCard("cmd", "Commands", n.commands, "composable"),
      statCard("flag", "Parameters", n.flags, "required and optional"),
      statCard("source", "Source", c.source, c.sourceSub),
    ),
    buildAssistantCard(),
    h("div", { class: "svc-grid-h" },
      h("span", null, c.short + " services"),
      h("span", { class: "n" }, n.services.toLocaleString()),
    ),
    h("div", { class: "svc-grid" }, catalog.map(serviceTile)),
  );
}
