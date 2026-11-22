// Tiny in-memory cache with a time-to-live and a size cap.
// On serverless platforms every instance keeps its own copy, so this only trims repeated reads;
// it is not shared storage.
export function createTtlCache({ ttlMs, maxEntries = 50, now = () => Date.now() }) {
  const entries = new Map();
  return {
    get(key) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (entry.expires <= now()) {
        entries.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key, value) {
      // Re-insert so the Map's insertion order tracks the oldest entries first.
      entries.delete(key);
      entries.set(key, { value, expires: now() + ttlMs });
      while (entries.size > maxEntries) entries.delete(entries.keys().next().value);
    }
  };
}
