import { useState } from 'react';
import { AI_PROVIDERS, askAssistant } from '../lib/ai.js';
import { readStorage, writeStorage } from '../lib/storage.js';

// Settings saved per provider (keys stay only in this browser).
export function loadSettings(provider) {
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

export function saveSettings(settings) {
  writeStorage("cli-ai-provider", settings.provider);
  writeStorage("cli-ai-key-" + settings.provider, settings.key);
  writeStorage("cli-ai-model-" + settings.provider, settings.model);
  writeStorage("cli-ai-base-" + settings.provider, settings.base);
}

export function useAssistant(initialCloud = 'aws') {
  const [config, setConfig] = useState(loadActiveSettings);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [cfgOpen, setCfgOpen] = useState(false);
  const [cloud, setCloudState] = useState(initialCloud); // target CLI of the conversation

  const push = message => setMessages(list => [...list, message]);

  async function send() {
    const text = draft.trim();
    if (busy || !text) return;
    if (config.provider !== "custom" && !config.key) {
      push({ role: "assistant", content: "⚠️ Missing API key." });
      setCfgOpen(true);
      return;
    }
    const history = [...messages, { role: "user", content: text }];
    setMessages(history);
    setDraft("");
    setBusy(true);
    try {
      const reply = await askAssistant(config, history, cloud);
      push({ role: "assistant", content: reply || "…" });
    } catch (e) {
      push({ role: "assistant", content: "⚠️ Error querying the AI: " + ((e && e.message) ? e.message : e) });
    }
    setBusy(false);
  }

  function saveConfig(next) {
    saveSettings(next);
    setConfig(next);
    setCfgOpen(false);
  }

  // Switching the target CLI starts a new conversation (the prompt is different).
  function setCloud(next) {
    if (next === cloud) return;
    setCloudState(next);
    setMessages([]);
  }

  return {
    config,
    cloud,
    setCloud,
    messages,
    draft,
    setDraft,
    busy,
    cfgOpen,
    toggleCfg: () => setCfgOpen(open => !open),
    clear: () => setMessages([]),
    send,
    saveConfig,
  };
}
