import { useEffect, useMemo, useRef, useState } from 'react';
import Topbar from './components/Topbar.jsx';
import ServicePane from './components/ServicePane.jsx';
import CommandPane from './components/CommandPane.jsx';
import CommandDetail from './components/CommandDetail.jsx';
import Home from './components/Home.jsx';
import GlobalOptions from './components/GlobalOptions.jsx';
import { SAMPLE_CATALOG } from './data/sampleCatalog.js';
import { useAssistant } from './hooks/useAssistant.js';
import { copyText } from './lib/clipboard.js';
import { loadGlobals, saveGlobals } from './lib/globalOptions.js';
import { readStorage, writeStorage } from './lib/storage.js';

const NARROW_QUERY = '(max-width:1040px)';

export default function App() {
  // Catálogo: arranca con la muestra incluida y se reemplaza por catalog.json al cargar.
  const [catalog, setCatalog] = useState(SAMPLE_CATALOG);
  const [activeSvc, setActiveSvc] = useState(null);
  const [activeCmd, setActiveCmd] = useState(null);
  const [values, setValues] = useState({}); // flag -> valor escrito
  const [search, setSearch] = useState(''); // búsqueda global
  const [svcFilter, setSvcFilter] = useState('');
  const [cmdFilter, setCmdFilter] = useState('');
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [goptsOpen, setGoptsOpen] = useState(false);
  const [globals, setGlobals] = useState(loadGlobals);
  const [theme, setTheme] = useState(() => readStorage('cli-theme')); // null = según el sistema
  const [toast, setToast] = useState({ msg: '', show: false });
  const toastTimer = useRef(0);
  const cmdsRef = useRef(null);
  const detailRef = useRef(null);
  const assistant = useAssistant();

  const dark = theme ? theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  const home = !activeSvc && !search.trim();

  const allCommands = useMemo(
    () => catalog.flatMap(s => s.commands.map(c => ({ svc: s, cmd: c }))),
    [catalog],
  );

  const items = useMemo(() => {
    const gt = search.trim().toLowerCase();
    let list;
    if (gt) list = allCommands.filter(x => (x.svc.id + ' ' + x.cmd.name + ' ' + x.cmd.desc).toLowerCase().includes(gt));
    else if (activeSvc) list = activeSvc.commands.map(c => ({ svc: activeSvc, cmd: c }));
    else list = [];
    const ft = cmdFilter.trim().toLowerCase();
    if (ft) list = list.filter(x => (x.cmd.name + ' ' + x.cmd.desc).toLowerCase().includes(ft));
    return list;
  }, [allCommands, activeSvc, search, cmdFilter]);

  // Si el comando activo no está en la lista visible, selecciona el primero.
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

  // Carga el catálogo completo; si falla (sin red, file://), se conserva la muestra.
  useEffect(() => {
    let cancelled = false;
    fetch(import.meta.env.BASE_URL + 'catalog.json')
      .then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(d => {
        if (cancelled || !d || !Array.isArray(d.services) || !d.services.length) return;
        setCatalog(d.services);
        setActiveSvc(null);
        setActiveCmd(null);
        setValues({});
        setSearch('');
        setSvcFilter('');
        setCmdFilter('');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    saveGlobals(globals);
  }, [globals]);

  useEffect(() => {
    if (theme) {
      document.documentElement.setAttribute('data-theme', theme);
      writeStorage('cli-theme', theme);
    }
  }, [theme]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  function notify(msg) {
    setToast({ msg, show: true });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(t => ({ ...t, show: false })), 1600);
  }

  async function copy(text) {
    const ok = await copyText(text);
    notify(ok ? 'Copiado al portapapeles' : 'No se pudo copiar');
  }

  const isNarrow = () => window.matchMedia(NARROW_QUERY).matches;

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

  // Cambiar un filtro reinicia la selección: se elige el primer comando de la nueva lista.
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

  function setGlobal(flag, value) {
    setGlobals(g => ({ ...g, [flag]: value }));
  }

  return (
    <>
      <Topbar
        search={search}
        onSearch={changeSearch}
        dark={dark}
        onToggleTheme={() => setTheme(dark ? 'light' : 'dark')}
        onToggleSidebar={() => setSidebarHidden(h => !h)}
        onHome={goHome}
        onOpenGlobals={() => setGoptsOpen(true)}
      />

      <div className={'shell' + (home ? ' home' : '') + (sidebarHidden ? ' hide-svc' : '')}>
        <ServicePane
          services={catalog}
          activeId={activeSvc?.id}
          filter={svcFilter}
          onFilter={setSvcFilter}
          onSelect={pickService}
        />
        <CommandPane
          paneRef={cmdsRef}
          home={home}
          filter={cmdFilter}
          onFilter={changeCmdFilter}
          items={items}
          activeCmd={activeCmd}
          onSelect={pickCommand}
        />
        <section className="pane detail" ref={detailRef}>
          {activeCmd ? (
            <CommandDetail
              key={activeSvc.id + '/' + activeCmd.name}
              svc={activeSvc}
              cmd={activeCmd}
              values={values}
              globals={globals}
              onChange={setValue}
              onCopy={copy}
            />
          ) : (
            <Home catalog={catalog} assistant={assistant} onCopy={copy} />
          )}
        </section>
      </div>

      <GlobalOptions
        open={goptsOpen}
        globals={globals}
        onChange={setGlobal}
        onClear={() => setGlobals({})}
        onClose={() => setGoptsOpen(false)}
      />

      <div className={'toast' + (toast.show ? ' show' : '')}>{toast.msg}</div>
    </>
  );
}
