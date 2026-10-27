const AI_PROVIDERS = {
  gemini: { label: "Gemini (Google)", model: "gemini-2.0-flash", base: "", needsBase: false },
  claude: { label: "Claude (Anthropic)", model: "claude-3-5-haiku-latest", base: "", needsBase: false },
  openai: { label: "OpenAI", model: "gpt-4o-mini", base: "", needsBase: false },
  custom: { label: "Custom / Local AI", model: "", base: "http://localhost:11434/v1", needsBase: true },
};

const SYSTEM_PROMPTS = {
  aws: "You are an assistant that ONLY generates AWS CLI v2 commands. Given the user's need, reply with the correct 'aws ...' command or commands (service, operation and flags). Return each command in its own code block with triple backticks and a brief one-line explanation. Use placeholders such as <value> where data is missing. Do not invent flags that do not exist. If the user asks for anything that is not an AWS CLI command (writing code, general text, using another tool, etc.), decline briefly and state that you only generate AWS CLI commands. You do not run commands or access any account. Reply in the user's language.",
  azure: "You are an assistant that ONLY generates Azure CLI commands. Given the user's need, reply with the correct 'az ...' command or commands (group, subgroups, command and flags). Return each command in its own code block with triple backticks and a brief one-line explanation. Use placeholders such as <value> where data is missing. Do not invent flags that do not exist. If the user asks for anything that is not an Azure CLI command (writing code, general text, using another tool, etc.), decline briefly and state that you only generate Azure CLI commands. You do not run commands or access any subscription. Reply in the user's language.",
};

async function checkedJson(response) {
  if (!response.ok) {
    throw new Error("HTTP " + response.status + " " + (await response.text()).slice(0, 240));
  }
  return response.json();
}

async function askClaude({ key, model, system }, messages) {
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
      system,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    }),
  });
  const data = await checkedJson(response);
  return (data.content || []).map(b => b.text || "").join("").trim();
}

async function askGemini({ key, model, system }, messages) {
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
    body: JSON.stringify({ system_instruction: { parts: [{ text: system }] }, contents }),
  });
  const data = await checkedJson(response);
  const parts = (((data.candidates || [])[0] || {}).content || {}).parts || [];
  return parts.map(x => x.text || "").join("").trim();
}

// OpenAI y cualquier endpoint compatible (p. ej. Ollama).
async function askOpenAICompatible({ provider, key, model, base, system }, messages) {
  const root = (provider === "custom" ? base || AI_PROVIDERS.custom.base : "https://api.openai.com/v1").replace(/\/+$/, "");
  const headers = { "content-type": "application/json" };
  if (key) headers["authorization"] = "Bearer " + key;
  const response = await fetch(root + "/chat/completions", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }].concat(
        messages.map(m => ({ role: m.role, content: m.content })),
      ),
    }),
  });
  const data = await checkedJson(response);
  const message = ((data.choices || [])[0] || {}).message || {};
  return (message.content || "").trim();
}

// config: { provider, key, model, base }. messages: [{ role, content }]. cloud: "aws" | "azure".
function askAssistant(config, messages, cloud = "aws") {
  const model = config.model || AI_PROVIDERS[config.provider].model;
  const args = { ...config, model, system: SYSTEM_PROMPTS[cloud] || SYSTEM_PROMPTS.aws };
  if (config.provider === "claude") return askClaude(args, messages);
  if (config.provider === "gemini") return askGemini(args, messages);
  return askOpenAICompatible(args, messages);
}
