import { useState } from 'react';
import { CLI, commandParts, missingCount, previewPlain } from '../lib/command.js';
import { CopyIcon, WarnIcon } from './Icons.jsx';

function Preview({ svc, cmd, values, globals }) {
  const parts = commandParts(cmd, values, globals);
  const lines = [
    <span key="head">
      <span className="k">{CLI}</span> <span className="svc">{svc.id}</span> <span className="cmd">{cmd.name}</span>
      {parts.length > 0 && <span className="cont"> \</span>}
    </span>,
  ];
  parts.forEach((p, i) => {
    const last = i === parts.length - 1;
    lines.push(
      <span key={i}>
        {"    "}
        <span className="flag">{p.flag}</span>
        {p.val != null && (
          <>
            {" "}
            <span className="val">{p.val}</span>
          </>
        )}
        {!last && <span className="cont"> \</span>}
      </span>,
    );
  });
  return (
    <div className="preview-body">
      {lines.map((line, i) => (
        <span key={i}>
          {i > 0 && "\n"}
          {line}
        </span>
      ))}
    </div>
  );
}

function ParamField({ param, required, value, onChange }) {
  return (
    <div className="param">
      <label>
        <span className="flag">{param.flag}</span>
        {required && <span className="req">*</span>}
        <span className="type">{param.type}</span>
      </label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(param.flag, e.target.value)}
        placeholder={param.type === "boolean" ? "true / false" : "value"}
        autoComplete="off"
        spellCheck={false}
      />
      {param.desc && <p className="hint">{param.desc}</p>}
    </div>
  );
}

function Section({ title, count, children }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className={"section" + (collapsed ? " collapsed" : "")}>
      <div className="section-h" onClick={() => setCollapsed(c => !c)}>
        {title}
        <span className="n">{count}</span>
        <span className="chev">▾</span>
      </div>
      <div className="section-b">{children}</div>
    </div>
  );
}

// Command detail: parameter form, preview, and copy button.
// Mounted with a key per command so sections and values reset when the command changes.
export default function CommandDetail({ svc, cmd, values, globals, onChange, onCopy }) {
  const miss = missingCount(cmd, values);
  const field = (p, required) => (
    <ParamField
      key={p.flag}
      param={p}
      required={required}
      value={values[p.flag] || ""}
      onChange={onChange}
    />
  );

  return (
    <div className="detail-in">
      <div className="crumb">
        {svc.id} <b>{cmd.name}</b>
      </div>
      <p className="d-desc">{cmd.desc}</p>

      <div className="preview">
        <div className="preview-h">
          <span className="t">
            <span className="pr">&gt;_</span> Command preview
          </span>
          <span className="acts">
            <button title="Copy" onClick={() => onCopy(previewPlain(svc, cmd, values, globals))}>
              <CopyIcon />
            </button>
          </span>
        </div>
        {miss > 0 && (
          <div className="warn">
            <WarnIcon />
            {miss} required parameter{miss > 1 ? "s" : ""} missing
          </div>
        )}
        <Preview svc={svc} cmd={cmd} values={values} globals={globals} />
      </div>

      {cmd.required.length > 0 && (
        <Section title="Required parameters" count={cmd.required.length}>
          {cmd.required.map(p => field(p, true))}
        </Section>
      )}
      {cmd.optional.length > 0 && (
        <Section title="Optional parameters" count={cmd.optional.length}>
          {cmd.optional.map(p => field(p, false))}
        </Section>
      )}

      <div className="note">
        This is a <b>functional recreation</b> of the command builder pattern. The data is a sample subset of the <b>AWS CLI v2</b> catalog. The full catalog is generated from the <b>botocore service models</b> (JSON, Apache-2.0) — this page makes no calls to AWS; it only composes the <code>aws …</code> string.
      </div>
    </div>
  );
}
