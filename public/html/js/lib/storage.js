// Fault-tolerant localStorage read and write (private mode, quota, blocked access).

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
    // No storage available: the session keeps working without persisting.
  }
}
