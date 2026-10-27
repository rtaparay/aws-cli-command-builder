import CloudMark from './CloudMark.jsx';
import { LayersIcon } from './Icons.jsx';
import { CLOUDS, CLOUD_FILTERS, CLOUD_IDS, SOON_CLOUD_IDS, SOON_MESSAGE } from '../lib/clouds.js';

// Cloud menu at the top of the left pane: "All", AWS and Azure with their totals, then upcoming clouds.
export default function CloudNav({ cloud, catalogs, soon, onPick, onSoon }) {
  const totalSvcs = CLOUD_IDS.reduce((a, c) => a + catalogs[c].length, 0);
  return (
    <nav className="cloud-nav" aria-label="Clouds">
      <div className="ph-title">Clouds</div>
      {CLOUD_FILTERS.map(f => {
        const isAll = f === 'all';
        const commands = isAll ? 0 : catalogs[f].reduce((a, s) => a + s.commands.length, 0);
        return (
          <button
            key={f}
            className={'cloud-row' + (isAll ? ' all' : ' ' + f)}
            aria-current={cloud === f}
            title={isAll ? 'All clouds' : CLOUDS[f].name}
            onClick={() => onPick(f)}
          >
            {isAll ? (
              <span className="cloud-mark all" aria-hidden="true"><LayersIcon /></span>
            ) : (
              <CloudMark cloud={f} />
            )}
            <span className="cloud-txt">
              <span className="cloud-name">{isAll ? 'All clouds' : CLOUDS[f].short + ' commands'}</span>
              <span className="cloud-sub">
                {isAll ? CLOUD_IDS.map(c => CLOUDS[c].short).join(' + ') : commands.toLocaleString() + ' commands'}
              </span>
            </span>
            <span className="count">{(isAll ? totalSvcs : catalogs[f].length).toLocaleString()}</span>
          </button>
        );
      })}
      <div className="ph-title soon-title">Próximamente</div>
      {SOON_CLOUD_IDS.map(id => {
        const open = soon.id === id && soon.where === 'nav';
        return (
          <button
            key={id + (open ? soon.n : '')}
            className={'cloud-row soon ' + id + (open ? ' soon-open' : '')}
            title={CLOUDS[id].name + ' — ' + SOON_MESSAGE}
            onClick={() => onSoon(id, 'nav')}
          >
            <CloudMark cloud={id} />
            <span className="cloud-txt">
              <span className="cloud-name">{CLOUDS[id].short} commands</span>
              <span className="cloud-sub soon-sub">{CLOUDS[id].cliName}</span>
              <span className="cloud-sub soon-note" role="status">{SOON_MESSAGE}</span>
            </span>
            <span className="soon-badge">Pronto</span>
          </button>
        );
      })}
    </nav>
  );
}
