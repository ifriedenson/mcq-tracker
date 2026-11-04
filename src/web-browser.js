"use strict";
/*
 * The Web browser module's local model: addresses, tabs, per-tab history,
 * bookmarks and zoom. Pure: no Obsidian, DOM, network or Electron. Only
 * http and https addresses can open; every other scheme is refused before a
 * frame is created, and nothing here fetches anything.
 */
const HOME_URL = "https://duckduckgo.com/";
const MAX_TABS = 24;
const MAX_HISTORY = 300;
const MAX_BOOKMARKS = 200;
const MAX_TITLE = 200;
const MIN_ZOOM = 50;
const MAX_ZOOM = 250;
const ZOOM_STEP = 10;
const SANDBOX = "allow-scripts allow-same-origin allow-forms allow-popups allow-downloads";
const SEARCH_ENGINES = {
  duckduckgo: { label: "DuckDuckGo", url: "https://duckduckgo.com/?q=" },
  google: { label: "Google", url: "https://www.google.com/search?q=" },
  bing: { label: "Bing", url: "https://www.bing.com/search?q=" },
  wikipedia: { label: "Wikipedia", url: "https://en.wikipedia.org/w/index.php?search=" },
};
const SEARCH_KEYS = Object.keys(SEARCH_ENGINES);
const SCHEME_REFUSAL = "Only http and https addresses can open in the browser.";

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseUrl(value) {
  try {
    const url = new URL(value);
    return url && url.hostname ? url : null;
  } catch (e) {
    return null;
  }
}

function webUrl(value) {
  const url = parseUrl(text(value));
  if (!url) return null;
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  return url;
}

function hostOf(value) {
  const url = webUrl(value);
  if (!url) return "";
  return url.hostname.replace(/^www\./i, "");
}

function normalizeSearchEngine(value) {
  const key = text(value).toLowerCase();
  return SEARCH_KEYS.includes(key) ? key : "duckduckgo";
}

function searchEngineLabel(value) {
  return SEARCH_ENGINES[normalizeSearchEngine(value)].label;
}

/**
 * Turn what the user typed into one http(s) address.
 * `{ok:true, kind:"url"|"search", url}` or `{ok:false, reason, message}`.
 */
function normalizeAddress(input, engine) {
  const raw = text(input);
  if (!raw) return { ok: false, reason: "empty", message: "Type a web address or a search." };
  // localhost and bare IPs carry a colon, so they are recognised before the scheme test.
  if (/^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?(\/.*)?$/i.test(raw)) {
    const local = parseUrl("http://" + raw);
    if (local) return { ok: true, kind: "url", url: local.href };
  }
  const scheme = raw.match(/^([a-z][a-z0-9+.-]*):/i);
  if (scheme) {
    const protocol = scheme[1].toLowerCase();
    if (protocol !== "http" && protocol !== "https") {
      return {
        ok: false,
        reason: "scheme",
        message: `${SCHEME_REFUSAL} "${protocol}:" links are never opened.`,
      };
    }
    const url = parseUrl(raw);
    if (!url) return { ok: false, reason: "url", message: "That web address is not valid." };
    return { ok: true, kind: "url", url: url.href };
  }
  const candidates = [];
  if (/^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?(\/.*)?$/i.test(raw)) candidates.push("http://" + raw);
  if (!/\s/.test(raw) && /^[^\s/]+\.[a-z]{2,}(:\d+)?(\/.*)?$/i.test(raw)) candidates.push("https://" + raw);
  for (const candidate of candidates) {
    const url = parseUrl(candidate);
    if (url) return { ok: true, kind: "url", url: url.href };
  }
  const base = SEARCH_ENGINES[normalizeSearchEngine(engine)].url;
  return { ok: true, kind: "search", url: base + encodeURIComponent(raw) };
}

function normalizeHome(value) {
  const raw = text(value);
  if (!raw) return "";
  const direct = webUrl(raw);
  if (direct) return direct.href;
  if (/^[^\s/]+\.[a-z]{2,}(:\d+)?(\/.*)?$/i.test(raw)) {
    const bare = parseUrl("https://" + raw);
    if (bare) return bare.href;
  }
  return "";
}

function normalizeBookmark(entry) {
  if (!entry || typeof entry !== "object") return null;
  const url = webUrl(entry.url);
  if (!url) return null;
  return { url: url.href, title: text(entry.title).slice(0, MAX_TITLE), added: Number(entry.added) || 0 };
}

function normalizeVisit(entry) {
  if (!entry || typeof entry !== "object") return null;
  const url = webUrl(entry.url);
  if (!url) return null;
  return { url: url.href, title: text(entry.title).slice(0, MAX_TITLE), at: Number(entry.at) || 0 };
}

/** Bound the persisted slice: a bad entry is dropped, never repaired into a fake one. */
function normalizeBrowserSettings(source) {
  const s = source && typeof source === "object" ? source : {};
  const bookmarks = [];
  for (const entry of Array.isArray(s.bookmarks) ? s.bookmarks : []) {
    const clean = normalizeBookmark(entry);
    if (clean && !bookmarks.some((b) => b.url === clean.url)) bookmarks.push(clean);
  }
  const history = [];
  for (const entry of Array.isArray(s.history) ? s.history : []) {
    const clean = normalizeVisit(entry);
    if (clean) history.push(clean);
  }
  return {
    enabled: s.enabled === true,
    home: normalizeHome(s.home),
    search: normalizeSearchEngine(s.search),
    bookmarks: bookmarks.slice(0, MAX_BOOKMARKS),
    history: history.slice(0, MAX_HISTORY),
  };
}

function blankTab(id, isPrivate) {
  return {
    id: "tab-" + id,
    url: "",
    title: "New tab",
    entries: [],
    index: -1,
    zoom: 100,
    private: isPrivate === true,
    loading: false,
  };
}

function createBrowserState(settings) {
  const s = normalizeBrowserSettings(settings);
  const tab = blankTab(1, false);
  return {
    tabs: [tab],
    activeId: tab.id,
    bookmarks: s.bookmarks.map((b) => ({ ...b })),
    history: s.history.map((h) => ({ ...h })),
    nextId: 2,
    search: s.search,
    home: s.home || HOME_URL,
  };
}

function cloneState(state) {
  return {
    tabs: state.tabs.map((tab) => ({
      ...tab,
      entries: tab.entries.map((entry) => ({ ...entry })),
    })),
    activeId: state.activeId,
    bookmarks: state.bookmarks.map((b) => ({ ...b })),
    history: state.history.map((h) => ({ ...h })),
    nextId: state.nextId,
    search: state.search,
    home: state.home,
  };
}

function findTab(state, id) {
  return state.tabs.find((tab) => tab.id === id) || null;
}

function activeTab(state) {
  return findTab(state, state.activeId) || state.tabs[0] || null;
}

function remember(state, visit, isPrivate) {
  if (isPrivate) return;
  const first = state.history[0];
  if (first && first.url === visit.url) {
    state.history[0] = { ...first, title: visit.title || first.title, at: visit.at };
    return;
  }
  state.history.unshift(visit);
  if (state.history.length > MAX_HISTORY) state.history.length = MAX_HISTORY;
}

function openTab(state, address, options) {
  const opts = options || {};
  if (state.tabs.length >= MAX_TABS) {
    return { ok: false, reason: "limit", message: `Close a tab first: ${MAX_TABS} tabs are open.`, state };
  }
  const raw = text(address);
  let next = cloneState(state);
  const tab = blankTab(next.nextId, opts.private === true);
  next.nextId += 1;
  next.tabs.push(tab);
  next.activeId = tab.id;
  if (!raw) return { ok: true, state: next, tab };
  const moved = navigate(next, tab.id, raw, opts);
  if (!moved.ok) {
    // The blank tab is still useful, but the address refusal is reported.
    return { ok: false, reason: moved.reason, message: moved.message, state: next, tab };
  }
  return { ok: true, state: moved.state, tab: moved.tab };
}

function closeTab(state, id) {
  const next = cloneState(state);
  const index = next.tabs.findIndex((tab) => tab.id === id);
  if (index < 0) return { ok: false, reason: "tab", message: "That tab is not open.", state };
  next.tabs.splice(index, 1);
  if (!next.tabs.length) {
    const tab = blankTab(next.nextId, false);
    next.nextId += 1;
    next.tabs.push(tab);
    next.activeId = tab.id;
  } else if (next.activeId === id) {
    const neighbour = next.tabs[Math.max(0, index - 1)];
    next.activeId = neighbour.id;
  }
  return { ok: true, state: next };
}

function activateTab(state, id) {
  if (!findTab(state, id)) return { ok: false, reason: "tab", message: "That tab is not open.", state };
  const next = cloneState(state);
  next.activeId = id;
  return { ok: true, state: next };
}

function navigate(state, tabId, address, options) {
  const opts = options || {};
  const result = normalizeAddress(address, state.search);
  if (!result.ok) return { ok: false, reason: result.reason, message: result.message, state };
  const next = cloneState(state);
  const tab = findTab(next, tabId);
  if (!tab) return { ok: false, reason: "tab", message: "That tab is not open.", state };
  const kept = tab.index >= 0 ? tab.entries.slice(0, tab.index + 1) : [];
  kept.push({ url: result.url, title: "" });
  tab.entries = kept;
  tab.index = kept.length - 1;
  tab.url = result.url;
  tab.title = hostOf(result.url);
  tab.loading = true;
  next.activeId = tab.id;
  remember(next, { url: result.url, title: tab.title, at: Number(opts.now) || Date.now() }, tab.private);
  return { ok: true, state: next, url: result.url, kind: result.kind, tab };
}

function step(state, tabId, delta) {
  const next = cloneState(state);
  const tab = findTab(next, tabId);
  if (!tab || tab.index < 0) return { ok: false, reason: "history", message: "There is no page to go back to.", state };
  const target = tab.index + delta;
  if (target < 0) return { ok: false, reason: "history", message: "There is no page to go back to.", state };
  if (target >= tab.entries.length) return { ok: false, reason: "history", message: "There is no page to go forward to.", state };
  const entry = tab.entries[target];
  tab.index = target;
  tab.url = entry.url;
  tab.title = text(entry.title) || hostOf(entry.url);
  tab.loading = true;
  next.activeId = tab.id;
  return { ok: true, state: next, url: tab.url };
}

function goBack(state, tabId) {
  return step(state, tabId, -1);
}

function goForward(state, tabId) {
  return step(state, tabId, 1);
}

function canGoBack(tab) {
  return !!tab && tab.index > 0;
}

function canGoForward(tab) {
  return !!tab && tab.index >= 0 && tab.index < tab.entries.length - 1;
}

function setTabTitle(state, tabId, title) {
  const next = cloneState(state);
  const tab = findTab(next, tabId);
  if (!tab) return { ok: false, reason: "tab", message: "That tab is not open.", state };
  const clean = text(title).slice(0, MAX_TITLE);
  if (!clean) return { ok: false, reason: "title", message: "A page title cannot be empty.", state };
  tab.title = clean;
  tab.loading = false;
  if (tab.index >= 0 && tab.entries[tab.index]) tab.entries[tab.index].title = clean;
  return { ok: true, state: next };
}

function setTabLoaded(state, tabId) {
  const next = cloneState(state);
  const tab = findTab(next, tabId);
  if (!tab) return { ok: false, reason: "tab", message: "That tab is not open.", state };
  tab.loading = false;
  return { ok: true, state: next };
}

function setZoom(state, tabId, delta) {
  const next = cloneState(state);
  const tab = findTab(next, tabId);
  if (!tab) return { ok: false, reason: "tab", message: "That tab is not open.", state };
  const value = Number(tab.zoom) || 100;
  tab.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value + (Number(delta) || 0)));
  return { ok: true, state: next, zoom: tab.zoom };
}

function toggleBookmark(state, url, title, now) {
  const target = webUrl(url);
  if (!target) return { ok: false, reason: "url", message: SCHEME_REFUSAL, state };
  const next = cloneState(state);
  const index = next.bookmarks.findIndex((b) => b.url === target.href);
  if (index >= 0) {
    next.bookmarks.splice(index, 1);
    return { ok: true, state: next, added: false };
  }
  if (next.bookmarks.length >= MAX_BOOKMARKS) {
    return { ok: false, reason: "limit", message: `Remove a bookmark first: ${MAX_BOOKMARKS} are saved.`, state };
  }
  next.bookmarks.unshift({
    url: target.href,
    title: text(title).slice(0, MAX_TITLE) || hostOf(target.href),
    added: Number(now) || Date.now(),
  });
  return { ok: true, state: next, added: true };
}

function removeBookmark(state, url) {
  const target = webUrl(url);
  const next = cloneState(state);
  next.bookmarks = next.bookmarks.filter((b) => !target || b.url !== target.href);
  return { ok: true, state: next };
}

function clearHistory(state) {
  const next = cloneState(state);
  next.history = [];
  return { ok: true, state: next };
}

function historyRows(state, query) {
  const needle = text(query).toLowerCase();
  const rows = state.history.map((entry) => ({
    ...entry,
    label: entry.title || hostOf(entry.url),
    host: hostOf(entry.url),
  }));
  if (!needle) return rows;
  return rows.filter((row) => row.label.toLowerCase().includes(needle) || row.url.toLowerCase().includes(needle));
}

function tabLabel(tab) {
  if (!tab) return "New tab";
  if (tab.private) return "Private: " + (text(tab.title) || hostOf(tab.url) || "new tab");
  return text(tab.title) || hostOf(tab.url) || "New tab";
}

/** What the view draws, as plain data so it can be asserted without a DOM. */
function browserLayout(state) {
  const tab = activeTab(state);
  return {
    address: tab ? tab.url : "",
    tabs: state.tabs.map((item) => ({
      id: item.id,
      label: tabLabel(item),
      active: item.id === state.activeId,
      private: item.private === true,
      loading: item.loading === true,
      canClose: true,
    })),
    bookmarks: state.bookmarks.map((entry) => ({
      url: entry.url,
      label: entry.title || hostOf(entry.url),
      active: !!tab && tab.url === entry.url,
    })),
    frame: tab && tab.url ? { url: tab.url, sandbox: SANDBOX, zoom: tab.zoom } : null,
    history: historyRows(state, ""),
    zoom: tab ? tab.zoom : 100,
    canBack: canGoBack(tab),
    canForward: canGoForward(tab),
    canBookmark: !!tab && !!tab.url,
    bookmarked: !!tab && !!tab.url && state.bookmarks.some((b) => b.url === tab.url),
    private: !!tab && tab.private === true,
    hint: "Pages load inside Obsidian. Some sites refuse to be embedded; use Open in browser for those.",
    home: state.home,
  };
}

module.exports = {
  HOME_URL,
  MAX_TABS,
  MAX_HISTORY,
  MAX_BOOKMARKS,
  MAX_TITLE,
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_STEP,
  SANDBOX,
  SEARCH_ENGINES,
  SEARCH_KEYS,
  SCHEME_REFUSAL,
  normalizeAddress,
  normalizeHome,
  normalizeBrowserSettings,
  createBrowserState,
  openTab,
  closeTab,
  activateTab,
  navigate,
  goBack,
  goForward,
  canGoBack,
  canGoForward,
  setTabTitle,
  setTabLoaded,
  setZoom,
  toggleBookmark,
  removeBookmark,
  clearHistory,
  historyRows,
  tabLabel,
  browserLayout,
  hostOf,
  normalizeSearchEngine,
  searchEngineLabel,
};
