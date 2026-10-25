export const AI_PROVIDERS = {
  gemini: { label: "Gemini (Google)", model: "gemini-2.0-flash", base: "", needsBase: false },
  claude: { label: "Claude (Anthropic)", model: "claude-3-5-haiku-latest", base: "", needsBase: false },
  openai: { label: "OpenAI", model: "gpt-4o-mini", base: "", needsBase: false },
  custom: { label: "Personalizada / IA local", model: "", base: "http://localhost:11434/v1", needsBase: true },
};

const SYSTEM_PROMPT = "Eres un asistente que SOLO genera comandos de AWS CLI v2. Dada la necesidad del usuario, responde con el o los comandos 'aws ...' correctos (servicio, operacion y flags). Devuelve cada comando en su propio bloque de codigo con triple backtick y una breve explicacion de una linea. Usa marcadores como <value> donde falten datos. No inventes flags que no existan. Si el usuario pide cualquier cosa que no sea un comando de AWS CLI (escribir codigo, texto general, usar otra herramienta, etc.), rechazalo brevemente e indica que solo generas comandos de AWS CLI. No ejecutas comandos ni accedes a ninguna cuenta. Responde en el idioma del usuario.";

async function checkedJson(response) {
  if (!response.ok) {
    throw new Error("HTTP " + response.status + " " + (await response.text()).slice(0, 240));
  }
  return response.json();
}

async function askClaude({ key, model }, messages) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    }),
  });
  const data = await checkedJson(response);
  return (data.content || []).map(b => b.text || "").join("").trim();
}

async function askGemini({ key, model }, messages) {
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(model) +
    ":generateContent?key=" +
    encodeURIComponent(key);
  const contents = messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ system_instruction: { parts: [{ text: SYSTEM_PROMPT }] }, contents }),
  });
  const data = await checkedJson(response);
  const parts = (((data.candidates || [])[0] || {}).content || {}).parts || [];
  return parts.map(x => x.text || "").join("").trim();
}

// OpenAI y cualquier endpoint compatible (p. ej. Ollama).
async function askOpenAICompatible({ provider, key, model, base }, messages) {
  const root = (provider === "custom" ? base || AI_PROVIDERS.custom.base : "https://api.openai.com/v1").replace(/\/+$/, "");
  const headers = { "content-type": "application/json" };
  if (key) headers["authorization"] = "Bearer " + key;
  const response = await fetch(root + "/chat/completions", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: SYSTEM_PROMPT }].concat(
        messages.map(m => ({ role: m.role, content: m.content })),
      ),
    }),
  });
  const data = await checkedJson(response);
  const message = ((data.choices || [])[0] || {}).message || {};
  return (message.content || "").trim();
}

// config: { provider, key, model, base }. messages: [{ role, content }].
export function askAssistant(config, messages) {
  const model = config.model || AI_PROVIDERS[config.provider].model;
  const args = { ...config, model };
  if (config.provider === "claude") return askClaude(args, messages);
  if (config.provider === "gemini") return askGemini(args, messages);
  return askOpenAICompatible(args, messages);
}
