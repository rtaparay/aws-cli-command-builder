import { FlagIcon, CmdIcon, ServiceIcon, SourceIcon } from './Icons.jsx';
import AssistantCard from './AssistantCard.jsx';
import CloudMark from './CloudMark.jsx';
import { CLOUDS, CLOUD_IDS, SOON_CLOUD_IDS, SOON_MESSAGE } from '../lib/clouds.js';

function Stat({ icon, label, value, sub }) {
  return (
    <div className="stat">
      <div className="h">
        <span>{label}</span>
        <span className="ic">{icon}</span>
      </div>
      <div className="num">{typeof value === 'number' ? value.toLocaleString() : value}</div>
      <div className="s">{sub}</div>
    </div>
  );
}

function catalogCounts(catalog) {
  return {
    services: catalog.length,
    commands: catalog.reduce((a, s) => a + s.commands.length, 0),
    flags: catalog.reduce((a, s) => a + s.commands.reduce((b, c) => b + c.required.length + c.optional.length, 0), 0),
  };
}

function CloudHead({ cloud }) {
  const c = CLOUDS[cloud];
  return (
    <div className="cc-head">
      <CloudMark cloud={cloud} size="lg" />
      <div style={{ minWidth: 0 }}>
        <div className="cc-name">{c.name}</div>
        <div className="cc-cli">{c.cliName} · <code>{c.cli} …</code></div>
      </div>
    </div>
  );
}

// "All clouds" view: one card per cloud that leads to its services.
function CloudCard({ cloud, catalog, source, onPick }) {
  const c = CLOUDS[cloud];
  const n = catalogCounts(catalog);
  return (
    <button className={'cloud-card ' + cloud} onClick={() => onPick(cloud)}>
      <CloudHead cloud={cloud} />
      <div className="cc-nums">
        <div><b>{n.services.toLocaleString()}</b><span>services</span></div>
        <div><b>{n.commands.toLocaleString()}</b><span>commands</span></div>
        <div><b>{n.flags.toLocaleString()}</b><span>parameters</span></div>
      </div>
      <div className="cc-foot">
        <span>Source: {source}</span>
        <span className="cc-go">Browse {c.short} services →</span>
      </div>
    </button>
  );
}

// Upcoming cloud card: same layout, no numbers yet; a click reveals the "Próximamente" message.
function SoonCard({ cloud, open, n, onSoon }) {
  return (
    <button
      key={cloud + (open ? n : '')}
      className={'cloud-card soon ' + cloud + (open ? ' soon-open' : '')}
      aria-label={CLOUDS[cloud].name + ' — ' + SOON_MESSAGE}
      onClick={() => onSoon(cloud, 'card')}
    >
      <div className="cc-head">
        <CloudMark cloud={cloud} size="lg" />
        <div style={{ minWidth: 0 }}>
          <div className="cc-name">{CLOUDS[cloud].name}</div>
          <div className="cc-cli">{CLOUDS[cloud].cliName} · <code>{CLOUDS[cloud].cli} …</code></div>
        </div>
        <span className="soon-badge">Próximamente</span>
      </div>
      <div className="cc-soon" role="status">
        <span className="cc-soon-default">Módulo en preparación. Haz clic para ver el estado.</span>
        <span className="cc-soon-msg">⏳ {SOON_MESSAGE}</span>
      </div>
      <div className="cc-foot">
        <span>Catalog: pending</span>
        <span className="cc-go">Coming soon</span>
      </div>
    </button>
  );
}

function ServiceTile({ svc, onSelect }) {
  return (
    <button className={'svc-tile ' + svc.cloud} title={svc.name} onClick={() => onSelect(svc)}>
      <span className="st-id">{svc.id}</span>
      <span className="st-name">{svc.name && svc.name !== svc.id ? svc.name : ' '}</span>
      <span className="st-n">{svc.commands.length} cmd</span>
    </button>
  );
}

// Home screen: catalog summary per cloud and AI assistant.
export default function Home({ cloud, catalogs, sources, assistant, soon, onPickCloud, onSelectService, onSoon, onCopy }) {
  const sourceLabel = c => (sources[c] === 'loading' ? 'loading catalog…' : sources[c] === 'error' ? 'catalog failed to load' : sources[c]);

  if (cloud === 'all') {
    const total = CLOUD_IDS.reduce(
      (a, c) => {
        const n = catalogCounts(catalogs[c]);
        return { services: a.services + n.services, commands: a.commands + n.commands };
      },
      { services: 0, commands: 0 },
    );
    return (
      <div className="detail-in">
        <div className="hero">
          <span className="eyebrow">&gt;_ Multi-cloud catalog · AWS + Azure</span>
          <h2>Create AWS and Azure CLI commands step by step</h2>
          <p>
            Pick a cloud, explore its services, choose a command and complete it parameter by parameter.{' '}
            {total.services.toLocaleString()} services and {total.commands.toLocaleString()} commands, with the preview
            assembled automatically and ready to be copied to the terminal.
          </p>
        </div>
        <div className="cloud-cards">
          {CLOUD_IDS.map(c => (
            <CloudCard key={c} cloud={c} catalog={catalogs[c]} source={sourceLabel(c)} onPick={onPickCloud} />
          ))}
        </div>
        <div className="svc-grid-h">
          <span>Próximamente</span>
          <span className="n">{SOON_CLOUD_IDS.length}</span>
        </div>
        <div className="cloud-cards soon-cards">
          {SOON_CLOUD_IDS.map(c => (
            <SoonCard key={c} cloud={c} open={soon.id === c && soon.where === 'card'} n={soon.n} onSoon={onSoon} />
          ))}
        </div>
        <AssistantCard assistant={assistant} onCopy={onCopy} />
      </div>
    );
  }

  const c = CLOUDS[cloud];
  const catalog = catalogs[cloud];
  const n = catalogCounts(catalog);
  return (
    <div className="detail-in">
      <div className="hero">
        <span className="eyebrow">
          <CloudMark cloud={cloud} size="xs" />
          &gt;_ {c.cliName} catalog · {c.source}
        </span>
        <h2>Create {c.short} CLI commands step by step</h2>
        <p>
          Explore the {c.name} services, choose a command, and complete it parameter by parameter. The preview will
          automatically assemble the <code>{c.cli} …</code> line, ready to be copied to the terminal.
        </p>
      </div>
      <div className="stats">
        <Stat icon={<ServiceIcon />} label="Services" value={n.services} sub={c.short + ' services'} />
        <Stat icon={<CmdIcon />} label="Commands" value={n.commands} sub="composable" />
        <Stat icon={<FlagIcon />} label="Parameters" value={n.flags} sub="required and optional" />
        <Stat icon={<SourceIcon />} label="Source" value={c.source} sub={c.sourceSub} />
      </div>
      <AssistantCard assistant={assistant} onCopy={onCopy} />
      <div className="svc-grid-h">
        <span>{c.short} services</span>
        <span className="n">{n.services.toLocaleString()}</span>
      </div>
      <div className="svc-grid">
        {catalog.map(s => (
          <ServiceTile key={s.id} svc={s} onSelect={onSelectService} />
        ))}
      </div>
    </div>
  );
}
