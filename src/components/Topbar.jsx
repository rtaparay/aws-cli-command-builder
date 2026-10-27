import { GearIcon, HomeIcon, MoonIcon, SearchIcon, SidebarIcon, SunIcon } from './Icons.jsx';

export default function Topbar({ placeholder, search, onSearch, dark, onToggleTheme, onToggleSidebar, onHome, onOpenGlobals }) {
  return (
    <header className="topbar">
      <div className="brand" role="button" tabIndex={0} title="Home" style={{ cursor: 'pointer' }} onClick={onHome} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onHome()}>
        <span className="logo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 7l4 5-4 5" />
            <path d="M13 17h6" />
          </svg>
        </span>
        <div style={{ minWidth: 0 }}>
          <h1>CLI <b>Command</b> Builder</h1>
          <div className="sub">AWS + Azure CLI · step by step</div>
        </div>
      </div>
      <span className="divider" />
      <button className="icon-btn" title="Hide / show menu" onClick={onToggleSidebar}>
        <SidebarIcon />
      </button>
      <button className="icon-btn" title="Home" onClick={onHome}>
        <HomeIcon />
      </button>
      <button className="icon-btn" title="Global options" onClick={onOpenGlobals}>
        <GearIcon />
      </button>
      <div className="topsearch">
        <SearchIcon />
        <input
          type="search"
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          value={search}
          onChange={e => onSearch(e.target.value)}
        />
      </div>
      <span className="spacer" />
      <button className="icon-btn" title="Toggle theme" onClick={onToggleTheme}>
        {dark ? <SunIcon /> : <MoonIcon />}
      </button>
    </header>
  );
}
