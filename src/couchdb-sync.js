"use strict";
/*
 * Optional CouchDB sync for card review state.
 *
 * Only scheduling/review properties leave the vault. Card text stays in the
 * Markdown note, so CouchDB is a review-state relay, not a note backup.
 * Conflicts use "last review wins" for the schedule, while histories are
 * unioned so no attempt is silently dropped from the append-only record.
 */
const { str } = require("./util");
const { safeApiBase } = require("./url-safety");
const { mergeHistory, repairHistoryCounters } = require("./history");

const COUCHDB_PASSWORD_SECRET = "mcq-tracker-couchdb-password";
const COUCHDB_SYNC_VERSION = 1;
const DOC_PREFIX = "mcq-card-";

const DEFAULT_COUCHDB = {
  enabled: false,
  url: "",
  database: "mcq-tracker",
  username: "",
  lastSync: "",
  lastError: "",
};

const SYNC_FIELDS = [
  "card_id",
  "attempts",
  "correct_count",
  "streak",
  "first_attempted",
  "date attempted",
  "time_spent_total",
  "last_time_spent",
  "last_answer",
  "last_confidence",
  "last_error_type",
  "result",
  "last_attempt_id",
  "history",
  "next_review",
  "scheduler",
  "srs",
  "sm2",
  "last_card_rating",
  "last_typed_answer",
  "last_verdict",
  "grade_status",
  "graded_by",
  "graded_on",
  "grade_confidence",
  "grade_feedback",
  "study_status",
  "known_until",
  "buried_until",
  "excluded_on",
  "review_updated",
];

function normalizeCouchDb(value) {
  const src = value && typeof value === "object" ? value : {};
  const database = str(src.database).trim() || DEFAULT_COUCHDB.database;
  return {
    enabled: src.enabled === true,
    url: str(src.url).trim().replace(/\/+$/, ""),
    database: database.replace(/^\/+|\/+$/g, "").slice(0, 200),
    username: str(src.username).trim(),
    lastSync: str(src.lastSync).trim(),
    lastError: str(src.lastError).trim().slice(0, 500),
  };
}

function couchDbAddress(config) {
  const c = normalizeCouchDb(config);
  if (!c.url) throw new Error("Enter the CouchDB server URL first.");
  if (!c.database) throw new Error("Enter a CouchDB database name.");
  return `${safeApiBase(c.url)}/${encodeURIComponent(c.database)}`;
}

function base64(text) {
  const raw = str(text);
  if (typeof Buffer !== "undefined") return Buffer.from(raw, "utf8").toString("base64");
  return btoa(unescape(encodeURIComponent(raw)));
}

function couchDbHeaders(config, json) {
  const headers = { Accept: "application/json" };
  if (json) headers["Content-Type"] = "application/json";
  const c = { ...normalizeCouchDb(config), password: str(config && config.password) };
  if (c.username) headers.Authorization = `Basic ${base64(`${c.username}:${c.password}`)}`;
  return headers;
}

function couchDbDocId(cardId) {
  return DOC_PREFIX + encodeURIComponent(str(cardId).trim());
}

function stateTimestamp(state) {
  const s = state || {};
  const explicit = str(s.review_updated).trim();
  if (explicit) return explicit;
  const dated = str(s["date attempted"]).trim();
  return dated ? dated.replace(" ", "T") : "";
}

function newerState(local, remote) {
  if (!local) return remote || null;
  if (!remote) return local;
  return stateTimestamp(remote) > stateTimestamp(local) ? remote : local;
}

function clone(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (e) {
    return value;
  }
}

/** A transport-safe snapshot of the review properties on a card note. */
function cardSyncState(fm) {
  const source = fm && typeof fm === "object" ? fm : {};
  const state = {};
  for (const key of SYNC_FIELDS) {
    if (source[key] !== undefined && source[key] !== null && source[key] !== "") state[key] = clone(source[key]);
  }
  if (!state.review_updated) {
    const latest = stateTimestamp(source);
    if (latest) state.review_updated = latest;
  }
  return state;
}

function sameState(a, b) {
  return JSON.stringify(cardSyncState(a)) === JSON.stringify(cardSyncState(b));
}

/**
 * Merge two snapshots. The newest review decides scheduling state; both
 * histories are kept and counters are rebuilt from the union.
 */
function mergeCardSyncStates(local, remote) {
  if (!local) return cardSyncState(remote);
  if (!remote) return cardSyncState(local);
  const base = newerState(local, remote);
  const merged = clone(base) || {};
  const history = mergeHistory(local.history, remote.history);
  merged.history = history;
  const counters = { history: history.map((row) => row) };
  const repaired = repairHistoryCounters(counters);
  if (repaired.attempts) {
    for (const key of ["attempts", "correct_count", "time_spent_total", "streak", "first_attempted", "date attempted", "result", "last_answer", "last_confidence", "last_error_type"]) {
      if (counters[key] !== undefined) merged[key] = counters[key];
    }
  }
  merged.review_updated = str(base.review_updated) || stateTimestamp(base);
  return cardSyncState(merged);
}

/** Write a merged remote snapshot back onto a note's frontmatter. */
function applyCardSyncState(fm, state) {
  if (!fm || !state) return false;
  const before = JSON.stringify(cardSyncState(fm));
  for (const key of SYNC_FIELDS) {
    if (state[key] === undefined) continue;
    fm[key] = clone(state[key]);
  }
  return before !== JSON.stringify(cardSyncState(fm));
}

function errorMessage(error) {
  const text = str(error && error.message ? error.message : error).trim();
  return text || "CouchDB request failed.";
}

class CouchDbClient {
  constructor(config, options) {
    const opts = options || {};
    this.config = { ...normalizeCouchDb(config), password: str(opts.password) };
    this.address = couchDbAddress(this.config);
    this.request = typeof opts.request === "function" ? opts.request : null;
    if (!this.request) throw new Error("No HTTP transport was supplied for CouchDB.");
  }

  async call(method, path, body) {
    const response = await this.request({
      url: this.address + (path || ""),
      method,
      headers: couchDbHeaders(this.config, !!body),
      ...(body ? { body: JSON.stringify(body) } : {}),
      throw: false,
    });
    let data = null;
    try {
      data = response && response.json ? response.json : response && response.text ? JSON.parse(response.text) : null;
    } catch (e) {
      data = null;
    }
    const status = Number(response && response.status) || 0;
    if (status >= 400) {
      const reason = data && (data.reason || data.error);
      throw new Error(`CouchDB HTTP ${status}${reason ? `: ${reason}` : ""}`);
    }
    return data || {};
  }

  async ensureDatabase() {
    let status = 0;
    let data = null;
    const response = await this.request({
      url: this.address,
      method: "GET",
      headers: couchDbHeaders(this.config),
      throw: false,
    });
    status = Number(response && response.status) || 0;
    try {
      data = response && response.json ? response.json : null;
    } catch (e) {
      data = null;
    }
    if (status === 404) {
      await this.call("PUT", "");
      return true;
    }
    if (status >= 400 || status === 0) {
      const reason = data && (data.reason || data.error);
      throw new Error(`CouchDB HTTP ${status}${reason ? `: ${reason}` : ""}`);
    }
    return true;
  }

  async allCards() {
    // CouchDB expects startkey/endkey to be JSON values, including quotes for
    // strings. Without the quotes a real server rejects the view request.
    const query =
      "startkey=" +
      encodeURIComponent(JSON.stringify(DOC_PREFIX)) +
      "&endkey=" +
      encodeURIComponent(JSON.stringify(DOC_PREFIX + "\ufff0"));
    const data = await this.call("GET", `/_all_docs?include_docs=true&${query}`);
    const out = [];
    for (const row of Array.isArray(data.rows) ? data.rows : []) {
      const doc = row && row.doc;
      if (!doc || !doc.state) continue;
      out.push({ id: row.id, rev: doc._rev || "", state: cardSyncState(doc.state) });
    }
    return out;
  }

  async getCard(cardId) {
    const id = couchDbDocId(cardId);
    try {
      const doc = await this.call("GET", `/${encodeURIComponent(id)}`);
      return { id, rev: doc._rev || "", state: cardSyncState(doc.state) };
    } catch (e) {
      if (/HTTP 404\b/.test(errorMessage(e))) return null;
      throw e;
    }
  }

  async putCard(cardId, state, rev) {
    const id = couchDbDocId(cardId);
    const body = {
      _id: id,
      kind: "mcq-tracker-card-review",
      version: COUCHDB_SYNC_VERSION,
      card_id: str(cardId),
      updated_at: stateTimestamp(state),
      state: cardSyncState(state),
    };
    if (rev) body._rev = rev;
    const data = await this.call("PUT", `/${encodeURIComponent(id)}`, body);
    return { id, rev: data.rev || "" };
  }
}

module.exports = {
  COUCHDB_PASSWORD_SECRET,
  COUCHDB_SYNC_VERSION,
  DEFAULT_COUCHDB,
  SYNC_FIELDS,
  applyCardSyncState,
  cardSyncState,
  couchDbAddress,
  couchDbDocId,
  CouchDbClient,
  errorMessage,
  mergeCardSyncStates,
  newerState,
  normalizeCouchDb,
  sameState,
  stateTimestamp,
};
