// AI assistant chat. State lives in state.assistant (app.js), so it survives navigation.
const KEY_PLACEHOLDERS = { gemini: "AIza…", claude: "sk-ant-…", openai: "sk-…", custom: "—" };

// References to the assistant elements while the home screen is mounted.
let assistantView = null;

// Splits the AI text into text blocks and code blocks (```).
function assistantContent(content) {
  const parts = String(content).split("```");
  const nodes = parts
    .map((part, i) => {
      if (i % 2 === 1) {
        const code = part.replace(/^[a-zA-Z0-9_-]*\n/, "").trim();
        return h("div", { class: "ai-code" },
          h("code", null, code),
          h("div", { class: "ai-code-acts" },
            h("button", { class: "ai-mini", onclick: () => copy(code) }, "Copy"),
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
        h("label", null, "Provider", select),
        h("label", null, "Model",
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
        h("label", null, "API key",
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
        }, "Save"),
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
    placeholder: "Describe what you want to do in AWS… (e.g. list S3 buckets)",
    value: state.assistant.draft,
    oninput: e => (state.assistant.draft = e.target.value),
    onkeydown: e => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
  });
  const send = h("button", { class: "ai-send", onclick: sendMessage }, "Send");

  assistantView = { prov, transcript, cfgSlot, textarea, send };

  const card = h("div", { class: "ai-card" },
    h("div", { class: "ai-head" },
      h("div", { class: "ai-title" },
        h("span", { class: "ai-badge" }, "AI"),
        h("div", { style: { minWidth: "0" } },
          h("div", { class: "ai-h1" }, "AI Assistant — AWS CLI Commands"),
          h("div", { class: "ai-h2" }, "Describe what you want to do in AWS and the AI will give you the command."),
        ),
      ),
      h("div", { class: "ai-head-acts" },
        prov,
        h("button", { class: "ai-mini", onclick: clearChat }, "Clear chat"),
        h("button", { class: "ai-mini", onclick: toggleCfg }, "Settings"),
      ),
    ),
    cfgSlot,
    transcript,
    h("div", { class: "ai-input" }, textarea, send),
    h("div", { class: "ai-foot" }, "Only generates AWS CLI v2 commands. Review each command before running it."),
  );

  renderConfigSlot();
  renderAssistant();
  return card;
}

function renderTranscript() {
  const { messages, busy } = state.assistant;
  const nodes = messages.length === 0
    ? [h("div", { class: "ai-empty" }, "Configure a provider and an API key to get started.")]
    : messages.map(m =>
        h("div", { class: "ai-msg " + m.role },
          h("span", { class: "ai-who" }, m.role === "user" ? "You" : "AI"),
          h("div", { class: "ai-bubble" }, m.role === "assistant" ? assistantContent(m.content) : lines(m.content)),
        ),
      );
  if (busy) {
    nodes.push(
      h("div", { class: "ai-msg assistant" },
        h("span", { class: "ai-who" }, "AI"),
        h("div", { class: "ai-bubble ai-thinking" }, "Thinking…"),
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
    a.messages.push({ role: "assistant", content: "⚠️ Missing API key." });
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
    a.messages.push({ role: "assistant", content: "⚠️ Error querying the AI: " + ((e && e.message) ? e.message : e) });
  }
  a.busy = false;
  renderAssistant();
}
