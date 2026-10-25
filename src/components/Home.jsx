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

// Pantalla de inicio: resumen del catálogo y asistente de IA.
export default function Home({ catalog, assistant, onCopy }) {
  const nCmds = catalog.reduce((a, s) => a + s.commands.length, 0);
  const nFlags = catalog.reduce((a, s) => a + s.commands.reduce((b, c) => b + c.required.length + c.optional.length, 0), 0);

  return (
    <div className="detail-in">
      <div className="hero">
        <span className="eyebrow">&gt;_ Catálogo AWS CLI v2 · botocore</span>
        <h2>Compón comandos de CLI sin salir de los docs.</h2>
        <p>Explora los servicios, elige un comando y complétalo parámetro por parámetro. La vista previa se arma sola, lista para copiar al terminal.</p>
      </div>
      <div className="stats">
        <Stat icon={<ServiceIcon />} label="Servicios" value={catalog.length} sub="servicios AWS" />
        <Stat icon={<CmdIcon />} label="Comandos" value={nCmds} sub="componibles" />
        <Stat icon={<FlagIcon />} label="Parámetros" value={nFlags} sub="requeridos y opcionales" />
        <Stat icon={<SourceIcon />} label="Fuente" value="botocore" sub="service models (Apache-2.0)" />
      </div>
      <AssistantCard assistant={assistant} onCopy={onCopy} />
    </div>
  );
}
