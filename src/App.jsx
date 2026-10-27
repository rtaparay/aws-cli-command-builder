import { useEffect, useMemo, useRef, useState } from 'react';
import Topbar from './components/Topbar.jsx';
import ServicePane from './components/ServicePane.jsx';
import CommandPane from './components/CommandPane.jsx';
import CommandDetail from './components/CommandDetail.jsx';
import Home from './components/Home.jsx';
import GlobalOptions from './components/GlobalOptions.jsx';
import { useAssistant } from './hooks/useAssistant.js';
import { copyText } from './lib/clipboard.js';
import { CLOUDS, CLOUD_FILTERS, CLOUD_IDS, SOON_MESSAGE, normalizeCatalog, tagCloud } from './lib/clouds.js';
import { loadGlobals, saveGlobals } from './lib/globalOptions.js';
import { readStorage, writeStorage } from './lib/storage.js';

const NARROW_QUERY = '(max-width:1040px)';

function storedCloud() {
  const v = readStorage('cli-cloud', 'all');
  return CLOUD_FILTERS.includes(v) ? v : 'all';
}

export default function App() {
  // Catalogs per cloud: empty until public/catalog-<cloud>.json is loaded.
  const [catalogs, setCatalogs] = useState(() => ({ aws: [], azure: [] }));
  const [sources, setSources] = useState({ aws: 'loading', azure: 'loading' }); // generated_from of each catalog
  const [cloud, setCloud] = useState(storedCloud); // "all" | "aws" | "azure": filter of the left menu
  const [soon, setSoon] = useState({ id: null, where: null, n: 0 }); // upcoming cloud that was clicked
  const [activeSvc, setActiveSvc] = useState(null);
  const [activeCmd, setActiveCmd] = useState(null);
  const [values, setValues] = useState({}); // flag -> valor escrito
  const [search, setSearch] = useState(''); // global search
  const [svcFilter, setSvcFilter] = useState('');
  const [cmdFilter, setCmdFilter] = useState('');
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [goptsOpen, setGoptsOpen] = useState(false);
  const [goptsCloud, setGoptsCloud] = useState('aws');
  const [globals, setGlobals] = useState(loadGlobals);
  const [theme, setTheme] = useState(() => readStorage('cli-theme')); // null = follow the system
  const [toast, setToast] = useState({ msg: '', show: false });
  const toastTimer = useRef(0);
  const cmdsRef = useRef(null);
  const detailRef = useRef(null);
  const assistant = useAssistant(storedCloud() === 'all' ? 'aws' : storedCloud());
  const soonTimer = useRef(0);
  const activeSvcRef = useRef(null);
  activeSvcRef.current = activeSvc;

  const dark = theme ? theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  const home = !activeSvc && !search.trim();

  // Services visible with the current cloud filter.
  const visible = useMemo(
    () => (cloud === 'all' ? CLOUD_IDS.flatMap(c => catalogs[c]) : catalogs[cloud]),
    [catalogs, cloud],
  );
  const allCommands = useMemo(
    () => visible.flatMap(s => s.commands.map(c => ({ svc: s, cmd: c }))),
    [visible],
  );

  // The cloud that gives context to the screen (accent color, global options, AI prompt).
  const contextCloud = activeSvc ? activeSvc.cloud : cloud === 'all' ? 'aws' : cloud;

  const items = useMemo(() => {
    const gt = search.trim().toLowerCase();
    let list;
    if (gt) list = allCommands.filter(x => (CLOUDS[x.svc.cloud].cli + ' ' + x.svc.id + ' ' + x.cmd.name + ' ' + x.cmd.desc).toLowerCase().includes(gt));
    else if (activeSvc) list = activeSvc.commands.map(c => ({ svc: activeSvc, cmd: c }));
    else list = [];
    const ft = cmdFilter.trim().toLowerCase();
    if (ft) list = list.filter(x => (x.cmd.name + ' ' + x.cmd.desc).toLowerCase().includes(ft));
    return list;
  }, [allCommands, activeSvc, search, cmdFilter]);

  // If the active command is no longer in the visible list, select the first one.
  useEffect(() => {
    if (!items.length) {
      if (activeCmd) setActiveCmd(null);
      return;
    }
    if (!activeCmd || !items.some(x => x.cmd === activeCmd)) {
      setActiveSvc(items[0].svc);
      setActiveCmd(items[0].cmd);
      setValues({});
    }
  }, [items]);

  // Load each cloud's full catalog; if it fails, the source is marked as 'error'.
  useEffect(() => {
    let cancelled = false;
    CLOUD_IDS.forEach(id => {
      fetch(import.meta.env.BASE_URL + CLOUDS[id].catalogUrl)
        .then(r => {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        })
        .then(d => {
          const loaded = normalizeCatalog(d);
          if (cancelled || !loaded) return;
          setCatalogs(c => ({ ...c, [id]: tagCloud(loaded.services, id) }));
          setSources(s => ({ ...s, [id]: loaded.source }));
          // Only the selection that belonged to this cloud is invalidated.
          const current = activeSvcRef.current;
          if (!current || current.cloud === id) {
            setActiveSvc(null);
            setActiveCmd(null);
            setValues({});
          }
        })
        .catch(() => !cancelled && setSources(s => ({ ...s, [id]: 'error' })));
    });
    return () => {
      cancelled = true;
    };
  }, []);


  useEffect(() => {
    document.documentElement.setAttribute('data-cloud', contextCloud);
  }, [contextCloud]);

  useEffect(() => {
    if (theme) {
      document.documentElement.setAttribute('data-theme', theme);
      writeStorage('cli-theme', theme);
    }
  }, [theme]);

  useEffect(() => {
    const onKey = e => e.key === 'Escape' && setGoptsOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => () => {
    clearTimeout(toastTimer.current);
    clearTimeout(soonTimer.current);
  }, []);

  function notify(msg) {
    setToast({ msg, show: true });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(t => ({ ...t, show: false })), 1600);
  }

  async function copy(text) {
    const ok = await copyText(text);
    notify(ok ? 'Copied to clipboard' : 'Could not copy');
  }

  const isNarrow = () => window.matchMedia(NARROW_QUERY).matches;

  // Selecting a cloud filters the menu and takes you to that cloud's home with its services.
  function pickCloud(next) {
    writeStorage('cli-cloud', next);
    setCloud(next);
    if (next !== 'all') assistant.setCloud(next);
    setActiveSvc(null);
    setActiveCmd(null);
    setValues({});
    setSearch('');
    setCmdFilter('');
    setSvcFilter('');
    if (isNarrow()) detailRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  // Click on an upcoming cloud: shows the message on the card/row that was clicked and as a toast.
  function showComingSoon(id, where) {
    notify(CLOUDS[id].name + ': ' + SOON_MESSAGE.toLowerCase());
    setSoon(s => ({ id, where, n: s.n + 1 }));
    clearTimeout(soonTimer.current);
    soonTimer.current = setTimeout(() => setSoon(s => ({ ...s, id: null })), 3200);
  }

  function pickService(svc) {
    setActiveSvc(svc);
    setActiveCmd(null);
    setValues({});
    setSearch('');
    setCmdFilter('');
    if (isNarrow()) cmdsRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  function pickCommand({ svc, cmd }) {
    setActiveSvc(svc);
    setActiveCmd(cmd);
    setValues({});
    if (isNarrow()) detailRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  // Changing a filter resets the selection: the first command of the new list is picked.
  function changeSearch(value) {
    setSearch(value);
    setActiveCmd(null);
    setValues({});
  }

  function changeCmdFilter(value) {
    setCmdFilter(value);
    setActiveCmd(null);
    setValues({});
  }

  function goHome() {
    setActiveSvc(null);
    setActiveCmd(null);
    setValues({});
    setSearch('');
    setCmdFilter('');
    setSvcFilter('');
  }

  function setValue(flag, value) {
    setValues(v => ({ ...v, [flag]: value }));
  }

  function setGlobal(c, flag, value) {
    setGlobals(g => {
      const next = { ...g, [c]: { ...g[c], [flag]: value } };
      saveGlobals(c, next[c]);
      return next;
    });
  }

  function clearGlobals(c) {
    setGlobals(g => ({ ...g, [c]: {} }));
    saveGlobals(c, {});
  }

  function openGlobals() {
    setGoptsCloud(contextCloud);
    setGoptsOpen(true);
  }

  return (
    <>
      <Topbar
        placeholder={cloud === 'all' ? 'Search AWS and Azure commands…' : 'Search ' + CLOUDS[cloud].short + ' commands…'}
        search={search}
        onSearch={changeSearch}
        dark={dark}
        onToggleTheme={() => setTheme(dark ? 'light' : 'dark')}
        onToggleSidebar={() => setSidebarHidden(h => !h)}
        onHome={goHome}
        onOpenGlobals={openGlobals}
      />

      <div className={'shell' + (home ? ' home' : '') + (sidebarHidden ? ' hide-svc' : '')}>
        <ServicePane
          cloud={cloud}
          catalogs={catalogs}
          activeSvc={activeSvc}
          filter={svcFilter}
          onFilter={setSvcFilter}
          onSelect={pickService}
          soon={soon}
          onPickCloud={pickCloud}
          onSoon={showComingSoon}
        />
        <CommandPane
          paneRef={cmdsRef}
          home={home}
          searching={!!search.trim()}
          filter={cmdFilter}
          onFilter={changeCmdFilter}
          items={items}
          activeCmd={activeCmd}
          onSelect={pickCommand}
        />
        <section className="pane detail" ref={detailRef}>
          {activeCmd ? (
            <CommandDetail
              key={activeSvc.cloud + '/' + activeSvc.id + '/' + activeCmd.name}
              svc={activeSvc}
              cmd={activeCmd}
              values={values}
              globals={globals}
              onChange={setValue}
              onCopy={copy}
            />
          ) : (
            <Home
              cloud={cloud}
              catalogs={catalogs}
              sources={sources}
              assistant={assistant}
              soon={soon}
              onPickCloud={pickCloud}
              onSelectService={pickService}
              onSoon={showComingSoon}
              onCopy={copy}
            />
          )}
        </section>
      </div>

      <GlobalOptions
        open={goptsOpen}
        cloud={goptsCloud}
        onCloud={setGoptsCloud}
        globals={globals}
        onChange={setGlobal}
        onClear={clearGlobals}
        onClose={() => setGoptsOpen(false)}
      />

      <div className={'toast' + (toast.show ? ' show' : '')}>{toast.msg}</div>
    </>
  );
}
