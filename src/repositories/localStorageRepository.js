export function createLocalStorageRepository(key, fallbackFactory, storage) {
  const engine = storage || globalThis.localStorage;

  function readRaw() {
    try {
      return JSON.parse(engine.getItem(key));
    } catch (e) {
      return null;
    }
  }

  return {
    kind: "local",
    key: key,
    async load() {
      const item = readRaw();
      if (item && item.version === 1) return item;
      return fallbackFactory();
    },
    async saveState(state) {
      engine.setItem(key, JSON.stringify(state));
      return state;
    },
    async reset() {
      const next = fallbackFactory();
      engine.setItem(key, JSON.stringify(next));
      return next;
    },
    readRaw: readRaw,
    backup: function(backupKey) {
      const raw = engine.getItem(key);
      if (raw) engine.setItem(backupKey, raw);
      return raw;
    },
    setMigrationStatus: function(statusKey, status) {
      engine.setItem(statusKey, JSON.stringify(status));
    },
    getMigrationStatus: function(statusKey) {
      try {
        return JSON.parse(engine.getItem(statusKey));
      } catch (e) {
        return null;
      }
    }
  };
}
