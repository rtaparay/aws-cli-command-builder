import { SearchIcon } from './Icons.jsx';

// Lista de comandos del servicio activo (o de la búsqueda global).
export default function CommandPane({ paneRef, home, filter, onFilter, items, activeCmd, onSelect }) {
  return (
    <section className="pane cmds" ref={paneRef}>
      <div className="pane-h">
        <div className="filt">
          <SearchIcon />
          <input
            type="search"
            placeholder="Filtrar comandos…"
            autoComplete="off"
            value={filter}
            onChange={e => onFilter(e.target.value)}
          />
        </div>
      </div>
      <div className="cmd-list">
        {home ? null : items.length === 0 ? (
          <div className="empty">Sin comandos.</div>
        ) : (
          items.map(x => (
            <button
              key={x.svc.id + "/" + x.cmd.name}
              className="cmd"
              aria-current={x.cmd === activeCmd}
              onClick={() => onSelect(x)}
            >
              {x.cmd.name}
            </button>
          ))
        )}
      </div>
    </section>
  );
}
