export function createLocalStorageRepository(key, fallbackFactory, storage) {
  const engine = storage || globalThis.localStorage;

  return {
    key: key,
    load: function() {
      try {
        const item = JSON.parse(engine.getItem(key));
        if (item && item.version === 1) return item;
      } catch (e) {}
      return fallbackFactory();
    },
    save: function(state) {
      engine.setItem(key, JSON.stringify(state));
    },
    reset: function() {
      const next = fallbackFactory();
      engine.setItem(key, JSON.stringify(next));
      return next;
    }
  };
}
