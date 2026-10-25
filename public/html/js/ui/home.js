// Pantalla de inicio: resumen del catálogo y asistente de IA.
function statCard(iconName, label, value, sub) {
  return h("div", { class: "stat" },
    h("div", { class: "h" }, h("span", null, label), h("span", { class: "ic" }, icon(iconName))),
    h("div", { class: "num" }, String(value)),
    h("div", { class: "s" }, sub),
  );
}

function buildHome(catalog) {
  const nCmds = catalog.reduce((a, s) => a + s.commands.length, 0);
  const nFlags = catalog.reduce((a, s) => a + s.commands.reduce((b, c) => b + c.required.length + c.optional.length, 0), 0);

  return h("div", { class: "detail-in" },
    h("div", { class: "hero" },
      h("span", { class: "eyebrow" }, ">_ Catálogo AWS CLI v2 · botocore"),
      h("h2", null, "Create AWS CLI commands step by step"),
      h("p", null, "Explore the services, choose a command, and complete it parameter by parameter. The preview will automatically assemble, ready to be copied to the terminal."),
    ),
    h("div", { class: "stats" },
      statCard("service", "Servicios", catalog.length, "servicios AWS"),
      statCard("cmd", "Comandos", nCmds, "componibles"),
      statCard("flag", "Parámetros", nFlags, "requeridos y opcionales"),
      statCard("source", "Fuente", "botocore", "service models (Apache-2.0)"),
    ),
    buildAssistantCard(),
  );
}
