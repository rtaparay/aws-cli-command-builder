import { FlagIcon, CmdIcon, ServiceIcon, SourceIcon } from './Icons.jsx';
import AssistantCard from './AssistantCard.jsx';

function Stat({ icon, label, value, sub }) {
  return (
    <div className="stat">
      <div className="h">
        <span>{label}</span>
        <span className="ic">{icon}</span>
      </div>
      <div className="num">{value}</div>
      <div className="s">{sub}</div>
    </div>
  );
}

// Home screen: catalog summary and AI assistant.
export default function Home({ catalog, assistant, onCopy }) {
  const nCmds = catalog.reduce((a, s) => a + s.commands.length, 0);
  const nFlags = catalog.reduce((a, s) => a + s.commands.reduce((b, c) => b + c.required.length + c.optional.length, 0), 0);

  return (
    <div className="detail-in">
      <div className="hero">
        <span className="eyebrow">&gt;_ AWS CLI v2 catalog · botocore</span>
        <h2>Create AWS CLI commands step by step</h2>
        <p>Explore the services, choose a command, and complete it parameter by parameter. The preview will automatically assemble, ready to be copied to the terminal.</p>
      </div>
      <div className="stats">
        <Stat icon={<ServiceIcon />} label="Services" value={catalog.length} sub="AWS services" />
        <Stat icon={<CmdIcon />} label="Comandos" value={nCmds} sub="composable" />
        <Stat icon={<FlagIcon />} label="Parameters" value={nFlags} sub="required and optional" />
        <Stat icon={<SourceIcon />} label="Fuente" value="botocore" sub="service models (Apache-2.0)" />
      </div>
      <AssistantCard assistant={assistant} onCopy={onCopy} />
    </div>
  );
}
