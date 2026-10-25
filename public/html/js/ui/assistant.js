// Chat del asistente de IA. El estado vive en state.assistant (app.js), así sobrevive a la navegación.
const KEY_PLACEHOLDERS = { gemini: "AIza…", claude: "sk-ant-…", openai: "sk-…", custom: "—" };

// Referencias a los elementos del asistente mientras la pantalla de inicio está montada.
let assistantView = null;

// Separa el texto de la IA en bloques de texto y bloques de código (```).
function assistantContent(content) {
  const parts = String(content).split("```");
  const nodes = parts
    .map((part, i) => {
      if (i % 2 === 1) {
        const code = part.replace(/^[a-zA-Z0-9_-]*\n/, "").trim();
        return h("div", { class: "ai-code" },
          h("code", null, code),
          h("div", { class: "ai-code-acts" },
            h("button", { class: "ai-mini", onclick: () => copy(code) }, "Copiar"),
          ),
        );
      }
      if (!part.trim()) return null;
      return h("div", { class: "ai-text" }, lines(part));
    })
    .filter(Boolean);
  return nodes.length ? nodes : h("div", { class: "ai-text" }, content);
}

function buildConfigPanel(config) {
  let draft = { ...config };
  const panel = h("div", { class: "ai-cfg" });

  const paint = () => {
    const provider = AI_PROVIDERS[draft.provider];

    const select = h("select", {
      onchange: e => {
        draft = { ...loadSettings(e.target.value), provider: e.target.value };
        paint();
      },
    }, Object.entries(AI_PROVIDERS).map(([k, v]) => h("option", { value: k }, v.label)));
    select.value = draft.provider;

    panel.replaceChildren(
      h("div", { class: "ai-cfg-row" },
        h("label", null, "Proveedor", select),
        h("label", null, "Modelo",
          h("input", {
            type: "text",
            value: draft.model,
            placeholder: provider.model || "",
            autocomplete: "off",
            spellcheck: "false",
            oninput: e => (draft.model = e.target.value),
          }),
        ),
      ),
      h("div", { class: "ai-cfg-row" },
        h("label", null, "Clave API",
          h("input", {
            type: "password",
            value: draft.key,
            placeholder: KEY_PLACEHOLDERS[draft.provider],
            autocomplete: "off",
            oninput: e => (draft.key = e.target.value),
          }),
        ),
        provider.needsBase
          ? h("label", null, "URL base",
              h("input", {
                type: "text",
                value: draft.base,
                placeholder: "http://localhost:11434/v1",
                autocomplete: "off",
                spellcheck: "false",
                oninput: e => (draft.base = e.target.value),
              }),
            )
          : null,
      ),
      h("div", { class: "ai-cfg-foot" },
        h("span", { class: "ai-hint" }, "La clave se guarda solo en este navegador."),
        h("button", {
          class: "ai-mini solid",
          onclick: () => saveConfig({
            ...draft,
            key: draft.key.trim(),
            model: draft.model.trim(),
            base: draft.base.trim(),
          }),
        }, "Guardar"),
      ),
    );
  };

  paint();
  return panel;
}

function buildAssistantCard() {
  const prov = h("span", { class: "ai-prov" });
  const transcript = h("div", { class: "ai-transcript" });
  const cfgSlot = h("div");
  const textarea = h("textarea", {
    rows: "2",
    placeholder: "Describe qué quieres hacer en AWS… (ej. listar buckets de S3)",
    value: state.assistant.draft,
    oninput: e => (state.assistant.draft = e.target.value),
    onkeydown: e => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
  });
  const send = h("button", { class: "ai-send", onclick: sendMessage }, "Enviar");

  assistantView = { prov, transcript, cfgSlot, textarea, send };

  const card = h("div", { class: "ai-card" },
    h("div", { class: "ai-head" },
      h("div", { class: "ai-title" },
        h("span", { class: "ai-badge" }, "AI"),
        h("div", { style: { minWidth: "0" } },
          h("div", { class: "ai-h1" }, "Asistente IA — Comandos AWS CLI"),
          h("div", { class: "ai-h2" }, "Describe qué quieres hacer en AWS y la IA te dará el comando."),
        ),
      ),
      h("div", { class: "ai-head-acts" },
        prov,
        h("button", { class: "ai-mini", onclick: clearChat }, "Limpiar chat"),
        h("button", { class: "ai-mini", onclick: toggleCfg }, "Configurar"),
      ),
    ),
    cfgSlot,
    transcript,
    h("div", { class: "ai-input" }, textarea, send),
    h("div", { class: "ai-foot" }, "Solo genera comandos de AWS CLI v2. Revisa cada comando antes de ejecutarlo."),
  );

  renderConfigSlot();
  renderAssistant();
  return card;
}

function renderTranscript() {
  const { messages, busy } = state.assistant;
  const nodes = messages.length === 0
    ? [h("div", { class: "ai-empty" }, "Configura un proveedor y una clave API para empezar.")]
    : messages.map(m =>
        h("div", { class: "ai-msg " + m.role },
          h("span", { class: "ai-who" }, m.role === "user" ? "Tú" : "IA"),
          h("div", { class: "ai-bubble" }, m.role === "assistant" ? assistantContent(m.content) : lines(m.content)),
        ),
      );
  if (busy) {
    nodes.push(
      h("div", { class: "ai-msg assistant" },
        h("span", { class: "ai-who" }, "IA"),
        h("div", { class: "ai-bubble ai-thinking" }, "Pensando…"),
      ),
    );
  }
  assistantView.transcript.replaceChildren(...nodes);
  assistantView.transcript.scrollTop = assistantView.transcript.scrollHeight;
}

function renderConfigSlot() {
  if (!assistantView) return;
  const { config, cfgOpen } = state.assistant;
  assistantView.cfgSlot.replaceChildren(...(cfgOpen ? [buildConfigPanel(config)] : []));
}

function renderAssistant() {
  if (!assistantView) return;
  const a = state.assistant;
  assistantView.prov.textContent = AI_PROVIDERS[a.config.provider].label;
  assistantView.send.disabled = a.busy;
  if (assistantView.textarea.value !== a.draft) assistantView.textarea.value = a.draft;
  renderTranscript();
}

function clearChat() {
  state.assistant.messages = [];
  renderAssistant();
}

function toggleCfg() {
  state.assistant.cfgOpen = !state.assistant.cfgOpen;
  renderConfigSlot();
}

function saveConfig(next) {
  saveSettings(next);
  state.assistant.config = next;
  state.assistant.cfgOpen = false;
  renderConfigSlot();
  renderAssistant();
}

async function sendMessage() {
  const a = state.assistant;
  const text = a.draft.trim();
  if (a.busy || !text) return;
  if (a.config.provider !== "custom" && !a.config.key) {
    a.messages.push({ role: "assistant", content: "⚠️ Falta la clave API." });
    a.cfgOpen = true;
    renderConfigSlot();
    renderAssistant();
    return;
  }
  a.messages = [...a.messages, { role: "user", content: text }];
  a.draft = "";
  a.busy = true;
  renderAssistant();
  try {
    const reply = await askAssistant(a.config, a.messages);
    a.messages.push({ role: "assistant", content: reply || "…" });
  } catch (e) {
    a.messages.push({ role: "assistant", content: "⚠️ Error al consultar la IA: " + ((e && e.message) ? e.message : e) });
  }
  a.busy = false;
  renderAssistant();
}
