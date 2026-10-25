// Lectura y escritura tolerante a fallos de localStorage (modo privado, cuota, acceso bloqueado).

function readStorage(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);
    return value == null ? fallback : value;
  } catch (e) {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    // Sin almacenamiento disponible: la sesión sigue funcionando sin persistir.
  }
}
