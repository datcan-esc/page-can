const clone = (value) => structuredClone(value);

function area(name) {
  return {
    async get(keys) {
      const source = globalThis.__pageCanStorageTestState[name];
      const requested = typeof keys === 'string'
        ? [keys]
        : Array.isArray(keys)
          ? keys
          : Object.keys(source);
      globalThis.__pageCanStorageTestState.storageGets[name].push([...requested]);
      return Object.fromEntries(requested
        .filter((key) => Object.hasOwn(source, key))
        .map((key) => [key, clone(source[key])]));
    },
    async set(values) {
      Object.assign(globalThis.__pageCanStorageTestState[name], clone(values));
    },
    async remove(keys) {
      const state = globalThis.__pageCanStorageTestState[name];
      for (const key of Array.isArray(keys) ? keys : [keys]) delete state[key];
    },
  };
}

export const browser = {
  runtime: {
    getURL: (path) => path,
    async sendMessage(message) {
      const state = globalThis.__pageCanStorageTestState;
      state.sentMessages ??= [];
      state.sentMessages.push(clone(message));
    },
  },
  alarms: {
    async clear(name) {
      const state = globalThis.__pageCanStorageTestState;
      state.alarms ??= {};
      const existed = Object.hasOwn(state.alarms, name);
      delete state.alarms[name];
      return existed;
    },
    async create(name, info) {
      const state = globalThis.__pageCanStorageTestState;
      state.alarms ??= {};
      state.alarms[name] = clone(info);
    },
  },
  notifications: {
    async clear() {
      return true;
    },
  },
  bookmarks: {
    async getRecent(numberOfItems) {
      const state = globalThis.__pageCanStorageTestState;
      state.calls.getRecent += 1;
      return clone(state.bookmarks.recent.slice(0, numberOfItems));
    },
    async getTree() {
      const state = globalThis.__pageCanStorageTestState;
      state.calls.getTree += 1;
      return clone(state.bookmarks.tree);
    },
    async remove(id) {
      const state = globalThis.__pageCanStorageTestState;
      state.bookmarks.recent = state.bookmarks.recent.filter((item) => item.id !== id);
    },
  },
  storage: {
    local: area('local'),
    sync: area('sync'),
  },
};
