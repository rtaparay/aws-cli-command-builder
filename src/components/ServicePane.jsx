import { SearchIcon } from './Icons.jsx';

export default function ServicePane({ services, activeId, filter, onFilter, onSelect }) {
  const term = filter.trim().toLowerCase();
  const list = services.filter(s => !term || (s.id + " " + s.name).toLowerCase().includes(term));

  return (
    <aside className="pane svc">
      <div className="pane-h">
        <div className="filt">
          <SearchIcon />
          <input
            type="search"
            placeholder="Filtrar servicios…"
            autoComplete="off"
            value={filter}
            onChange={e => onFilter(e.target.value)}
          />
        </div>
      </div>
      <nav className="svc-list">
        {list.length === 0 && <div className="empty">Sin servicios.</div>}
        {list.map(s => (
          <button key={s.id} className="row" aria-current={activeId === s.id} onClick={() => onSelect(s)}>
            <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {s.id}
            </span>
            <span className="count">{s.commands.length}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
