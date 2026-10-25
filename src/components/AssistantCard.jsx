import { useEffect, useRef, useState } from 'react';
import { AI_PROVIDERS } from '../lib/ai.js';
import { loadSettings } from '../hooks/useAssistant.js';

const KEY_PLACEHOLDERS = { gemini: "AIza…", claude: "sk-ant-…", openai: "sk-…", custom: "—" };

// Splits the AI text into text blocks and code blocks (```).
function AssistantContent({ content, onCopy }) {
  const parts = String(content).split("```");
  const nodes = parts.map((part, i) => {
    if (i % 2 === 1) {
      const code = part.replace(/^[a-zA-Z0-9_-]*\n/, "").trim();
      return (
        <div key={i} className="ai-code">
          <code>{code}</code>
          <div className="ai-code-acts">
            <button className="ai-mini" onClick={() => onCopy(code)}>Copy</button>
          </div>
        </div>
      );
    }
    if (!part.trim()) return null;
    return <div key={i} className="ai-text"><Lines text={part} /></div>;
  }).filter(Boolean);
  return nodes.length ? nodes : <div className="ai-text">{content}</div>;
}

function Lines({ text }) {
  return text.split("\n").map((line, i, all) => (
    <span key={i}>
      {line}
      {i < all.length - 1 && <br />}
    </span>
  ));
}

function ConfigPanel({ config, onSave }) {
  const [draft, setDraft] = useState(config);
  const provider = AI_PROVIDERS[draft.provider];
  const update = (field, value) => setDraft(d => ({ ...d, [field]: value }));
  const changeProvider = provider => setDraft({ ...loadSettings(provider), provider });

  return (
    <div className="ai-cfg">
      <div className="ai-cfg-row">
        <label>
          Provider
          <select value={draft.provider} onChange={e => changeProvider(e.target.value)}>
            {Object.entries(AI_PROVIDERS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </label>
        <label>
          Model
          <input
            type="text"
            value={draft.model}
            onChange={e => update("model", e.target.value)}
            placeholder={provider.model || ""}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
      </div>
      <div className="ai-cfg-row">
        <label>
          API key
          <input
            type="password"
            value={draft.key}
            onChange={e => update("key", e.target.value)}
            placeholder={KEY_PLACEHOLDERS[draft.provider]}
            autoComplete="off"
          />
        </label>
        {provider.needsBase && (
          <label>
            Base URL
            <input
              type="text"
              value={draft.base}
              onChange={e => update("base", e.target.value)}
              placeholder="http://localhost:11434/v1"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        )}
      </div>
      <div className="ai-cfg-foot">
        <span className="ai-hint">The key is stored only in this browser.</span>
        <button className="ai-mini solid" onClick={() => onSave({ ...draft, key: draft.key.trim(), model: draft.model.trim(), base: draft.base.trim() })}>
          Save
        </button>
      </div>
    </div>
  );
}

// AI assistant chat. State lives in useAssistant (App), so it survives navigation.
export default function AssistantCard({ assistant, onCopy }) {
  const { config, messages, draft, setDraft, busy, cfgOpen, toggleCfg, clear, send, saveConfig } = assistant;
  const transcriptRef = useRef(null);
  const provider = AI_PROVIDERS[config.provider];

  useEffect(() => {
    if (transcriptRef.current) transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [messages, busy]);

  return (
    <div className="ai-card">
      <div className="ai-head">
        <div className="ai-title">
          <span className="ai-badge">AI</span>
          <div style={{ minWidth: 0 }}>
            <div className="ai-h1">AI Assistant — AWS CLI Commands</div>
            <div className="ai-h2">Describe what you want to do in AWS and the AI will give you the command.</div>
          </div>
        </div>
        <div className="ai-head-acts">
          <span className="ai-prov">{provider.label}</span>
          <button className="ai-mini" onClick={clear}>Clear chat</button>
          <button className="ai-mini" onClick={toggleCfg}>Settings</button>
        </div>
      </div>

      {cfgOpen && <ConfigPanel key={config.provider} config={config} onSave={saveConfig} />}

      <div className="ai-transcript" ref={transcriptRef}>
        {messages.length === 0 ? (
          <div className="ai-empty">Configure a provider and an API key to get started.</div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={"ai-msg " + m.role}>
              <span className="ai-who">{m.role === "user" ? "You" : "AI"}</span>
              <div className="ai-bubble">
                {m.role === "assistant" ? <AssistantContent content={m.content} onCopy={onCopy} /> : <Lines text={m.content} />}
              </div>
            </div>
          ))
        )}
        {busy && (
          <div className="ai-msg assistant">
            <span className="ai-who">AI</span>
            <div className="ai-bubble ai-thinking">Thinking…</div>
          </div>
        )}
      </div>

      <div className="ai-input">
        <textarea
          rows={2}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Describe what you want to do in AWS… (e.g. list S3 buckets)"
        />
        <button className="ai-send" disabled={busy} onClick={send}>Send</button>
      </div>
      <div className="ai-foot">Only generates AWS CLI v2 commands. Review each command before running it.</div>
    </div>
  );
}
