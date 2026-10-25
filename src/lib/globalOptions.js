import { readStorage, writeStorage } from './storage.js';

// Opciones aceptadas por todo comando de AWS CLI.
export const GLOBAL_OPTS = [
  { flag: "--region", type: "string", hint: "La región a usar. Sobrescribe la configuración y las variables de entorno." },
  { flag: "--output", type: "select", values: ["json", "yaml", "yaml-stream", "text", "table"], hint: "El estilo de formato de la salida del comando." },
  { flag: "--profile", type: "string", hint: "Usa un perfil específico de tu archivo de credenciales." },
  { flag: "--query", type: "string", hint: "Una consulta JMESPath para filtrar los datos de la respuesta." },
  { flag: "--endpoint-url", type: "string", hint: "Sobrescribe la URL por defecto del comando con la URL indicada." },
  { flag: "--debug", type: "bool", hint: "Activa el registro de depuración (debug)." },
  { flag: "--no-verify-ssl", type: "bool", hint: "Desactiva la verificación de certificados SSL (por defecto está activada)." },
  { flag: "--no-paginate", type: "bool", hint: "Desactiva la paginación automática: hace una sola llamada (primera página)." },
  { flag: "--no-sign-request", type: "bool", hint: "No firma las solicitudes; no se cargarán credenciales con este argumento." },
  { flag: "--no-cli-pager", type: "bool", hint: "Desactiva el pager de la CLI para la salida." },
  { flag: "--cli-auto-prompt", type: "bool", hint: "Solicita automáticamente los parámetros de entrada de la CLI." },
  { flag: "--no-cli-auto-prompt", type: "bool", hint: "Desactiva la solicitud automática de parámetros de entrada." },
  { flag: "--color", type: "select", values: ["on", "off", "auto"], hint: "Activa/desactiva el color en la salida." },
  { flag: "--ca-bundle", type: "string", hint: "Bundle de certificados CA para verificar SSL. Sobrescribe la config/variables de entorno." },
  { flag: "--cli-read-timeout", type: "int", hint: "Tiempo máximo de lectura del socket en segundos. 0 = sin timeout (bloqueante)." },
  { flag: "--cli-connect-timeout", type: "int", hint: "Tiempo máximo de conexión del socket en segundos. 0 = sin timeout (bloqueante)." },
  { flag: "--cli-binary-format", type: "select", values: ["base64", "raw-in-base64-out"], hint: "Estilo de formato para blobs binarios. Por defecto base64." },
];

const STORAGE_KEY = "cli-globals";

export function loadGlobals() {
  try {
    return JSON.parse(readStorage(STORAGE_KEY, "{}")) || {};
  } catch (e) {
    return {};
  }
}

export function saveGlobals(globals) {
  writeStorage(STORAGE_KEY, JSON.stringify(globals));
}

// Convierte los valores guardados en partes {flag, val} para la línea de comando.
// Los booleanos no llevan valor (val null).
export function globalParts(globals) {
  const out = [];
  GLOBAL_OPTS.forEach(o => {
    const v = globals[o.flag];
    if (o.type === "bool") {
      if (v) out.push({ flag: o.flag, val: null });
    } else if (v != null && String(v).trim() !== "") {
      out.push({ flag: o.flag, val: String(v).trim() });
    }
  });
  return out;
}
