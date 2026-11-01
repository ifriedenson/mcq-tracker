"use strict";
/*
 * A bounded in-memory cache for derived, read-only view snapshots. Callers pass
 * a data version; any save or vault change bumps it and makes every entry stale.
 * The oldest entry is evicted first, so a long session cannot grow without end.
 */
function createSnapshotCache(options) {
  const opts = options || {};
  const limit = Math.max(1, Math.min(64, Math.round(Number(opts.limit) || 8)));
  const entries = new Map();
  let hits = 0;
  let misses = 0;

  function get(key, version, build) {
    const id = String(key);
    const hit = entries.get(id);
    if (hit && hit.version === version) {
      hits++;
      // Refresh insertion order for a true least-recently-used eviction.
      entries.delete(id);
      entries.set(id, hit);
      return hit.value;
    }
    misses++;
    const value = build();
    entries.delete(id);
    entries.set(id, { version, value });
    while (entries.size > limit) entries.delete(entries.keys().next().value);
    return value;
  }

  return {
    get,
    clear() {
      entries.clear();
    },
    get size() {
      return entries.size;
    },
    stats() {
      return { size: entries.size, limit, hits, misses };
    },
  };
}

module.exports = { createSnapshotCache };
