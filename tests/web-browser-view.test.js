"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");
const { Plugin: QT, obsidian } = load();
const { WebBrowserView } = require("../src/web-browser-view");

function latestRender(dom) {
  const children = dom.root.__own.children;
  return children[children.length - 1] || null;
}

/* The fake DOM records every render, so lookups are scoped to the newest one. */
function isCurrent(dom, el) {
  const root = latestRender(dom);
  for (let node = el; node; node = node.parent) if (node === root) return true;
  return false;
}

function byLabel(dom, label) {
  return dom.all
    .filter((el) => {
      const attrs = el.meta.attrs || el.meta.attr || {};
      return attrs["aria-label"] === label && isCurrent(dom, el);
    })
    .pop();
}

function byClass(dom, cls) {
  return dom.all.filter((el) => el.classes && el.classes.has(cls) && isCurrent(dom, el));
}

function click(el) {
  assert.ok(el, "element to click");
  const handlers = el.handlers.filter((h) => h.ev === "click");
  assert.ok(handlers.length, "click handler");
  for (const handler of handlers) handler.fn({});
}

function typeAddress(dom, text) {
  const input = byLabel(dom, "Address or search");
  assert.ok(input, "the address bar is drawn");
  input.value = text;
  const handler = input.handlers.find((h) => h.ev === "keydown");
  assert.ok(handler, "the address bar handles Enter");
  handler.fn({ key: "Enter", preventDefault() {} });
}

function frame(dom) {
  return dom.all.find((el) => el.meta.tag === "iframe" && isCurrent(dom, el));
}

function attrsOf(el) {
  return el.meta.attrs || el.meta.attr || {};
}

async function mount() {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  await plugin.updateWebBrowser({ enabled: true });
  const dom = makeDom();
  const view = new WebBrowserView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  await view.onOpen();
  return { app, plugin, dom, view };
}

test("the view navigates by domain and by search from its address bar", async () => {
  const { dom, view } = await mount();
  assert.ok(dom.texts().includes("New tab"));
  assert.equal(frame(dom), undefined, "a blank tab draws no frame");

  typeAddress(dom, "example.com");
  assert.equal(view.state.tabs[0].url, "https://example.com/");
  const direct = frame(dom);
  assert.ok(direct, "a page frame is drawn");
  assert.equal(attrsOf(direct).src, "https://example.com/");
  assert.match(attrsOf(direct).sandbox, /allow-scripts/);
  assert.equal(attrsOf(direct).referrerpolicy, "no-referrer");
  assert.equal(byLabel(dom, "Address or search").value, "https://example.com/");

  typeAddress(dom, "cell biology revision");
  const searchUrl = view.state.tabs[0].url;
  assert.ok(searchUrl.startsWith("https://duckduckgo.com/?q="), searchUrl);
  assert.ok(searchUrl.endsWith("cell%20biology%20revision"));
  assert.equal(attrsOf(frame(dom)).src, searchUrl);

  assert.equal(byLabel(dom, "Back").disabled, false, "back is available after a second page");
  click(byLabel(dom, "Back"));
  assert.equal(view.state.tabs[0].url, "https://example.com/");
  assert.equal(attrsOf(frame(dom)).src, "https://example.com/");
});

test("a second tab opens, switches and closes through the tab strip", async () => {
  const { dom, view } = await mount();
  typeAddress(dom, "example.com");
  click(byLabel(dom, "New tab"));
  assert.equal(view.state.tabs.length, 2);
  assert.equal(byClass(dom, "qt-web-browser-tab-label").length, 2);

  typeAddress(dom, "second.example");
  assert.equal(view.state.tabs[1].url, "https://second.example/");
  assert.equal(view.state.tabs[0].url, "https://example.com/", "the first tab keeps its page");

  const first = byClass(dom, "qt-web-browser-tab-label").find((el) => el.meta.text === "example.com");
  click(first);
  assert.equal(view.state.activeId, view.state.tabs[0].id);
  assert.equal(byLabel(dom, "Address or search").value, "https://example.com/");
  assert.equal(attrsOf(frame(dom)).src, "https://example.com/");

  click(byLabel(dom, "Close example.com"));
  assert.equal(view.state.tabs.length, 1);
  assert.equal(view.state.tabs[0].url, "https://second.example/");
  assert.equal(byClass(dom, "qt-web-browser-tab-label").length, 1);
});

test("a bookmark renders in the bar and survives rebuilding the view from saved settings", async () => {
  const { plugin, dom, view } = await mount();
  typeAddress(dom, "example.com");
  click(byLabel(dom, "Bookmark this page"));
  assert.equal(byLabel(dom, "Bookmark this page").meta.text, "★", "the star fills in");
  const chips = byClass(dom, "qt-web-browser-bookmark");
  assert.equal(chips.length, 1);
  assert.equal(chips[0].meta.text, "example.com");
  assert.equal(plugin.settings.webBrowser.bookmarks.length, 1);
  assert.equal(plugin.settings.webBrowser.bookmarks[0].url, "https://example.com/");

  const dom2 = makeDom();
  const reopened = new WebBrowserView({ app: view.app }, plugin);
  reopened.app = view.app;
  reopened.contentEl = dom2.root;
  await reopened.onOpen();
  const reloaded = byClass(dom2, "qt-web-browser-bookmark");
  assert.equal(reloaded.length, 1, "the bookmark is drawn after a reload");
  assert.equal(reloaded[0].meta.text, "example.com");
  click(reloaded[0]);
  assert.equal(reopened.state.tabs[0].url, "https://example.com/");

  click(byLabel(dom2, "Bookmark this page"));
  assert.equal(byClass(dom2, "qt-web-browser-bookmark").length, 0, "clicking the star again removes it");
});

test("javascript:, data: and file: addresses leave no frame and say why", async () => {
  const { dom, view } = await mount();
  for (const bad of ["javascript:alert(1)", "data:text/html,<b>x</b>", "file:///etc/passwd"]) {
    typeAddress(dom, bad);
    assert.equal(view.state.tabs[0].url, "", `${bad} does not navigate`);
    assert.equal(frame(dom), undefined, `${bad} draws no frame`);
  }
  assert.ok(
    obsidian.notices.some((notice) => /Only http and https addresses/.test(notice)),
    "the refusal is announced"
  );
});

test("the command opens the view in a leaf, navigates it and reuses the same view", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  await plugin.updateWebBrowser({ enabled: true });
  const dom = makeDom();
  const leaf = { app };
  app.workspace.getLeavesOfType = () => (leaf.view ? [leaf] : []);
  app.workspace.getRightLeaf = () => leaf;
  app.workspace.revealLeaf = () => {};
  leaf.setViewState = async () => {
    if (leaf.view) return;
    const view = new WebBrowserView({ app }, plugin);
    view.app = app;
    view.contentEl = dom.root;
    leaf.view = view;
    await view.onOpen();
  };

  const opened = await plugin.openWebBrowser("example.com");
  assert.ok(opened, "the command returns the view");
  assert.equal(opened.state.tabs[0].url, "https://example.com/");
  assert.equal(attrsOf(frame(dom)).src, "https://example.com/");

  const again = await plugin.openWebBrowser("second.example");
  assert.equal(again, opened, "an open browser is reused");
  assert.equal(again.state.tabs[0].url, "https://second.example/");
});
