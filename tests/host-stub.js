// Stand-ins for the browser globals that src/config.js reads at load time.
// Import this file first in a test, before any module from src/.
// The seed is 12345. localStorage is an empty in-memory store.
const store = new Map();
globalThis.location = { search: '?seed=12345', pathname: '/', hash: '' };
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
  },
});
globalThis.history = { replaceState() {} };
