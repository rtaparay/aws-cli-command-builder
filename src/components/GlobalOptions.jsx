import CloudMark from './CloudMark.jsx';
import { CLOUDS, CLOUD_IDS } from '../lib/clouds.js';
import { GLOBAL_OPTS_BY_CLOUD } from '../lib/globalOptions.js';

const TYPE_LABELS = { bool: "boolean", int: "integer" };

function Control({ opt, value, onChange }) {
  if (opt.type === "select") {
    return (
      <select value={value} onChange={e => onChange(opt.flag, e.target.value)}>
        <option value="">Select a value…</option>
        {opt.values.map(x => (
          <option key={x} value={x}>{x}</option>
        ))}
      </select>
    );
  }
  if (opt.type === "bool") {
    return (
      <select value={value ? "1" : ""} onChange={e => onChange(opt.flag, e.target.value)}>
        <option value="">Not set</option>
        <option value="1">{opt.flag}</option>
      </select>
    );
  }
  return (
    <input
      type={opt.type === "int" ? "number" : "text"}
      value={value}
      onChange={e => onChange(opt.flag, e.target.value)}
      placeholder={opt.type === "int" ? "0" : "value"}
      autoComplete="off"
      spellCheck={false}
    />
  );
}

// Side panel with the global options of each cloud CLI (saved in the browser).
export default function GlobalOptions({ open, cloud, onCloud, globals, onChange, onClear, onClose }) {
  const values = globals[cloud] || {};
  const c = CLOUDS[cloud];
  return (
    <>
      <div className="gopts-overlay" hidden={!open} onClick={onClose} />
      <aside className="gopts" hidden={!open} data-cloud={cloud} aria-label="Global options">
        <div className="gopts-h">
          <div>
            <div className="gopts-t">Global options</div>
            <div className="gopts-s">
              Options accepted by every {c.cliName} command ({c.cli} …). They are applied to each command you build and persist across pages.
            </div>
            <div className="seg gopts-tabs" role="group" aria-label="CLI">
              {CLOUD_IDS.map(id => (
                <button key={id} className={'seg-btn ' + id} aria-pressed={id === cloud} onClick={() => onCloud(id)}>
                  <CloudMark cloud={id} size="xs" />
                  {CLOUDS[id].cliName}
                </button>
              ))}
            </div>
          </div>
          <button className="gopts-x" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        <div className="gopts-b">
          {GLOBAL_OPTS_BY_CLOUD[cloud].map(o => {
            const raw = values[o.flag];
            const value = o.type === 'bool' ? (raw ? '1' : '') : raw != null ? String(raw) : '';
            return (
              <div key={cloud + o.flag} className="gopt">
                <label>
                  <span className="flag">{o.flag}</span> <span className="type">{TYPE_LABELS[o.type] || 'string'}</span>
                </label>
                <Control opt={o} value={value} onChange={(flag, v) => onChange(cloud, flag, v)} />
                <p className="hint">{o.hint}</p>
              </div>
            );
          })}
        </div>
        <div className="gopts-foot">
          <span>Saved on this device.</span>
          <button className="gopts-clear" onClick={() => onClear(cloud)}>Clear all</button>
        </div>
      </aside>
    </>
  );
}
