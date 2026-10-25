import { GearIcon, HomeIcon, MoonIcon, SearchIcon, SidebarIcon, SunIcon } from './Icons.jsx';

export default function Topbar({ search, onSearch, dark, onToggleTheme, onToggleSidebar, onHome, onOpenGlobals }) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 7l4 5-4 5" />
            <path d="M13 17h6" />
          </svg>
        </span>
        <div style={{ minWidth: 0 }}>
          <h1>CLI <b>Command</b> Builder</h1>
          <div className="sub">compón comandos sin salir de los docs</div>
        </div>
      </div>
      <span className="divider" />
      <button className="icon-btn" title="Ocultar / mostrar menú" onClick={onToggleSidebar}>
        <SidebarIcon />
      </button>
      <button className="icon-btn" title="Inicio" onClick={onHome}>
        <HomeIcon />
      </button>
      <button className="icon-btn" title="Opciones globales" onClick={onOpenGlobals}>
        <GearIcon />
      </button>
      <div className="topsearch">
        <SearchIcon />
        <input
          type="search"
          placeholder="Buscar comandos…"
          autoComplete="off"
          spellCheck={false}
          value={search}
          onChange={e => onSearch(e.target.value)}
        />
      </div>
      <span className="spacer" />
      <button className="icon-btn" title="Cambiar tema" onClick={onToggleTheme}>
        {dark ? <SunIcon /> : <MoonIcon />}
      </button>
    </header>
  );
}
