"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");
const browser = require("../src/web-browser");
const { T, Plugin: QT } = load();
const { WebBrowserView } = require("../src/web-browser-view");

test("addresses accept http and https, bare hosts and localhost, and search the rest", () => {
  assert.equal(browser.normalizeAddress("https://example.com/a").url, "https://example.com/a");
  assert.equal(browser.normalizeAddress("http://example.com").url, "http://example.com/");
  assert.equal(browser.normalizeAddress("example.com").url, "https://example.com/");
  assert.equal(browser.normalizeAddress("localhost:8080/x").url, "http://localhost:8080/x");
  assert.equal(browser.normalizeAddress("127.0.0.1:3000").url, "http://127.0.0.1:3000/");
  const search = browser.normalizeAddress("cell biology", "google");
  assert.equal(search.ok, true);
  assert.equal(search.kind, "search");
  assert.equal(search.url, "https://www.google.com/search?q=cell%20biology");
  assert.equal(browser.normalizeAddress("photosynthesis", "nope").kind, "search");
  assert.ok(browser.normalizeAddress("photosynthesis", "nope").url.startsWith("https://duckduckgo.com/?q="));
});

test("every non-http scheme and an empty box are refused before a frame exists", () => {
  for (const bad of ["javascript:alert(1)", "data:text/html,hi", "file:///etc/passwd", "obsidian://open", "about:blank"]) {
    const result = browser.normalizeAddress(bad);
    assert.equal(result.ok, false, bad);
    assert.equal(result.reason, "scheme", bad);
    assert.match(result.message, /http and https/);
  }
  assert.equal(browser.normalizeAddress("   ").reason, "empty");
});

test("settings are bounded: 200 bookmarks, 300 visits, http only, unknown engine falls back", () => {
  const bookmarks = [];
  for (let i = 0; i < 260; i += 1) bookmarks.push({ url: `https://example.com/${i}`, title: `Page ${i}` });
  bookmarks.push({ url: "javascript:alert(1)" }, { url: "https://example.com/0", title: "duplicate" });
  const history = [];
  for (let i = 0; i < 340; i += 1) history.push({ url: `https://history.example/${i}`, title: `Visit ${i}`, at: i });
  history.push({ url: "file:///etc/passwd" });
  const settings = browser.normalizeBrowserSettings({ enabled: "yes", home: "example.com/start", search: "altavista", bookmarks, history });
  assert.equal(settings.enabled, false);
  assert.equal(settings.home, "https://example.com/start");
  assert.equal(settings.search, "duckduckgo");
  assert.equal(settings.bookmarks.length, 200);
  assert.equal(settings.history.length, 300);
  assert.ok(settings.bookmarks.every((entry) => entry.url.startsWith("https://")));
  assert.equal(browser.normalizeBrowserSettings({ home: "javascript:alert(1)" }).home, "");
});

test("tabs, per-tab history, forward truncation and zoom are pure state", () => {
  const state = browser.createBrowserState({ enabled: true });
  assert.equal(state.tabs.length, 1);
  assert.equal(browser.browserLayout(state).frame, null);

  const first = browser.navigate(state, state.activeId, "example.com", { now: 1 });
  assert.equal(first.ok, true);
  assert.equal(first.tab.url, "https://example.com/");
  assert.equal(browser.browserLayout(first.state).frame.url, "https://example.com/");
  assert.equal(first.state.history.length, 1);
  assert.equal(state.tabs[0].url, "", "the old state is never mutated");
  assert.equal(browser.goBack(first.state, first.tab.id).ok, false);

  const second = browser.navigate(first.state, first.tab.id, "second.example", { now: 2 });
  const back = browser.goBack(second.state, first.tab.id);
  assert.equal(back.ok, true);
  assert.equal(browser.browserLayout(back.state).address, "https://example.com/");
  const forward = browser.goForward(back.state, first.tab.id);
  assert.equal(forward.url, "https://second.example/");
  const third = browser.navigate(back.state, first.tab.id, "third.example");
  assert.equal(browser.canGoForward(third.state.tabs[0]), false);

  assert.equal(browser.setZoom(third.state, first.tab.id, 1000).zoom, browser.MAX_ZOOM);
  assert.equal(browser.setZoom(third.state, first.tab.id, -1000).zoom, browser.MIN_ZOOM);

  const opts = browser.openTab(third.state, "fourth.example", { private: true });
  assert.equal(opts.ok, true);
  assert.equal(opts.tab.private, true);
  assert.ok(browser.tabLabel(opts.tab).startsWith("Private: "));
  assert.equal(opts.state.history.length, third.state.history.length, "a private tab records no visit");
});

test("the tab limit, the last-tab replacement and bad addresses are refusals, not crashes", () => {
  let state = browser.createBrowserState({});
  for (let i = 0; i < browser.MAX_TABS - 1; i += 1) {
    const opened = browser.openTab(state, "");
    assert.equal(opened.ok, true);
    state = opened.state;
  }
  assert.equal(browser.openTab(state, "").ok, false);
  assert.equal(browser.openTab(state, "javascript:alert(1)").reason, "limit");
  assert.equal(browser.openTab(browser.createBrowserState({}), "javascript:alert(1)").reason, "scheme");
  let closed = state;
  for (const tab of state.tabs.slice()) closed = browser.closeTab(closed, tab.id).state;
  assert.equal(closed.tabs.length, 1, "closing every tab leaves one blank tab");
  assert.equal(closed.tabs[0].url, "");
  assert.equal(browser.closeTab(closed, "nope").ok, false);
});

test("bookmarks toggle, dedupe and refuse a non-http address", () => {
  const state = browser.createBrowserState({});
  const added = browser.toggleBookmark(state, "https://example.com/", "Example", 7);
  assert.equal(added.added, true);
  const again = browser.toggleBookmark(added.state, "https://example.com/", "Example");
  assert.equal(again.added, false);
  assert.equal(again.state.bookmarks.length, 0);
  assert.equal(browser.toggleBookmark(state, "javascript:alert(1)").reason, "url");
  const layout = browser.browserLayout(added.state);
  assert.equal(layout.bookmarks.length, 1);
  assert.equal(layout.bookmarked, false, "a blank tab has no bookmarked page");
});

test("the plugin ships the module off, registers the view and persists the toggle", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  assert.equal(plugin.webBrowserEnabled(), false);
  assert.ok(plugin.commands.some((command) => command.id === "open-web-browser"));
  assert.ok(plugin.views["question-tracker-web-browser"]);
  await plugin.updateWebBrowser({ enabled: true, search: "bing" });
  assert.equal(plugin.webBrowserEnabled(), true);
  assert.equal(plugin.webBrowserSettings().search, "bing");
  assert.equal(plugin.saved.webBrowser.enabled, true);
});

test("the view draws tabs, the address, a sandboxed frame and the off card", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  const dom = makeDom();
  const view = new WebBrowserView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.state = browser.createBrowserState(plugin.webBrowserSettings());
  view.render();
  assert.ok(dom.texts().includes("Web browser is off"));

  await plugin.updateWebBrowser({ enabled: true });
  view.render();
  assert.ok(dom.texts().some((text) => /Search with DuckDuckGo/.test(text)));
  view.go("example.com");
  assert.equal(view.state.tabs[0].url, "https://example.com/");
  const frame = dom.all.find((element) => element.meta.tag === "iframe");
  assert.ok(frame, "a frame is drawn for an http page");
  const attrs = frame.meta.attrs || frame.meta.attr || {};
  assert.equal(attrs.src, "https://example.com/");
  assert.match(attrs.sandbox, /allow-scripts/);
  assert.equal(attrs.referrerpolicy, "no-referrer");
  assert.ok(dom.texts().some((text) => /Some sites refuse/.test(text)));
  view.newTab("", true);
  assert.equal(view.state.tabs.length, 2);
  assert.ok(dom.texts().some((text) => /Private tab/.test(text)));
});
