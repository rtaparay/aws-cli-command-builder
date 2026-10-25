// Ajustes guardados por proveedor (las claves se quedan solo en este navegador).
function loadSettings(provider) {
  const def = AI_PROVIDERS[provider];
  return {
    provider,
    key: readStorage("cli-ai-key-" + provider, ""),
    model: readStorage("cli-ai-model-" + provider, def.model),
    base: readStorage("cli-ai-base-" + provider, def.base),
  };
}

function loadActiveSettings() {
  const stored = readStorage("cli-ai-provider", "gemini");
  return loadSettings(AI_PROVIDERS[stored] ? stored : "gemini");
}

function saveSettings(settings) {
  writeStorage("cli-ai-provider", settings.provider);
  writeStorage("cli-ai-key-" + settings.provider, settings.key);
  writeStorage("cli-ai-model-" + settings.provider, settings.model);
  writeStorage("cli-ai-base-" + settings.provider, settings.base);
}
