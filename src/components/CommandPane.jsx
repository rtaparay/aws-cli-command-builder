import { SearchIcon } from './Icons.jsx';
import { CLOUDS } from '../lib/clouds.js';

// List of commands for the active service (or the global search).
export default function CommandPane({ paneRef, home, searching, filter, onFilter, items, activeCmd, onSelect }) {
  return (
    <section className="pane cmds" ref={paneRef}>
      <div className="pane-h">
        <div className="filt">
          <SearchIcon />
          <input
            type="search"
            placeholder="Filter commands…"
            autoComplete="off"
            value={filter}
            onChange={e => onFilter(e.target.value)}
          />
        </div>
      </div>
      <div className="cmd-list">
        {home ? null : items.length === 0 ? (
          <div className="empty">No commands.</div>
        ) : (
          items.map(x => (
            <button
              key={x.svc.cloud + "/" + x.svc.id + "/" + x.cmd.name}
              className="cmd"
              aria-current={x.cmd === activeCmd}
              onClick={() => onSelect(x)}
            >
              {searching && <span className={'cmd-svc ' + x.svc.cloud}>{CLOUDS[x.svc.cloud].cli} {x.svc.id}</span>}
              {x.cmd.name}
            </button>
          ))
        )}
      </div>
    </section>
  );
}
