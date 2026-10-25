import { GLOBAL_OPTS } from '../lib/globalOptions.js';

const TYPE_LABELS = { bool: "boolean", int: "integer" };

function Control({ opt, value, onChange }) {
  if (opt.type === "select") {
    return (
      <select value={value} onChange={e => onChange(opt.flag, e.target.value)}>
        <option value="">Selecciona un valor…</option>
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

// Panel lateral con las opciones globales de AWS CLI (se guardan en el navegador).
export default function GlobalOptions({ open, globals, onChange, onClear, onClose }) {
  return (
    <>
      <div className="gopts-overlay" hidden={!open} onClick={onClose} />
      <aside className="gopts" hidden={!open} aria-label="Opciones globales">
        <div className="gopts-h">
          <div>
            <div className="gopts-t">Opciones globales</div>
            <div className="gopts-s">Opciones aceptadas por todo comando de AWS CLI. Se aplican a cada comando que construyes y persisten entre páginas.</div>
          </div>
          <button className="gopts-x" aria-label="Cerrar" onClick={onClose}>✕</button>
        </div>
        <div className="gopts-b">
          {GLOBAL_OPTS.map(o => {
            const raw = globals[o.flag];
            const value = o.type === "bool" ? (raw ? "1" : "") : raw != null ? String(raw) : "";
            return (
              <div key={o.flag} className="gopt">
                <label>
                  <span className="flag">{o.flag}</span> <span className="type">{TYPE_LABELS[o.type] || "string"}</span>
                </label>
                <Control opt={o} value={value} onChange={onChange} />
                <p className="hint">{o.hint}</p>
              </div>
            );
          })}
        </div>
        <div className="gopts-foot">
          <span>Guardado en este dispositivo.</span>
          <button className="gopts-clear" onClick={onClear}>Limpiar todo</button>
        </div>
      </aside>
    </>
  );
}
