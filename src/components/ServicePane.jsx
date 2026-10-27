import { Fragment } from 'react';
import CloudMark from './CloudMark.jsx';
import CloudNav from './CloudNav.jsx';
import { SearchIcon } from './Icons.jsx';
import { CLOUDS, CLOUD_IDS } from '../lib/clouds.js';

// Left pane: cloud menu plus the services of the selected cloud(s), grouped by cloud.
export default function ServicePane({ cloud, catalogs, activeSvc, filter, onFilter, onSelect, soon, onPickCloud, onSoon }) {
  const term = filter.trim().toLowerCase();
  const clouds = cloud === 'all' ? CLOUD_IDS : [cloud];
  const groups = clouds
    .map(c => ({ c, list: catalogs[c].filter(s => !term || (s.id + ' ' + s.name).toLowerCase().includes(term)) }))
    .filter(g => g.list.length);

  return (
    <aside className="pane svc">
      <div className="pane-h">
        <CloudNav cloud={cloud} catalogs={catalogs} soon={soon} onPick={onPickCloud} onSoon={onSoon} />
        <div className="filt">
          <SearchIcon />
          <input
            type="search"
            placeholder="Filter services…"
            autoComplete="off"
            value={filter}
            onChange={e => onFilter(e.target.value)}
          />
        </div>
      </div>
      <nav className="svc-list">
        {groups.length === 0 && <div className="empty">No services.</div>}
        {groups.map(({ c, list }) => (
          <Fragment key={c}>
            <div className={'svc-group-h ' + c}>
              <CloudMark cloud={c} size="xs" />
              <span>{CLOUDS[c].short} services</span>
              <span className="n">{term ? list.length + ' / ' + catalogs[c].length : String(list.length)}</span>
            </div>
            {list.map(s => (
              <button key={s.id} className="row" aria-current={activeSvc === s} title={s.name} onClick={() => onSelect(s)}>
                <span className={'svc-dot ' + c} aria-hidden="true" />
                <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {s.id}
                </span>
                <span className="count">{s.commands.length}</span>
              </button>
            ))}
          </Fragment>
        ))}
      </nav>
    </aside>
  );
}
