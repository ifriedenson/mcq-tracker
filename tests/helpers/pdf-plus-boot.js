"use strict";
/* A headless Obsidian surface for the real PDF++ bundle.
 *
 * This is deliberately a component/plugin lifecycle, not a bag of no-ops:
 * `around` patches, commands, setting tabs, events, intervals, child components
 * and DOM listeners are all tracked so teardown can be asserted. The app has no
 * PDF leaves by default; the harness is for boot, registration and teardown,
 * while the PDF viewer itself still needs a real Obsidian run.
 */
const Module = require("module");
const { load } = require("./load");

let installed = false;

class FakeElement {
  constructor(doc, tag) {
    this.doc = doc;
    this.tagName = String(tag || "div").toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.classes = new Set();
    this.attributes = {};
    this.listeners = {};
    this.style = { setProperty() {}, removeProperty() {} };
    this.textContent = "";
    this.ownerDocument = doc;
    this.nodeType = 1;
  }
  createEl(tag, opts) {
    const child = this.doc.createElement(tag);
    if (opts && typeof opts === "object") {
      if (opts.cls) child.addClass(...String(opts.cls).split(/\s+/));
      if (opts.text != null) child.textContent = String(opts.text);
      if (opts.attr) for (const [key, value] of Object.entries(opts.attr)) child.setAttribute(key, value);
    }
    this.appendChild(child);
    return child;
  }
  createDiv(arg) {
    if (typeof arg === "string") {
      const child = this.doc.createElement("div");
      child.addClass(...arg.split(/\s+/).filter(Boolean));
      this.appendChild(child);
      return child;
    }
    return this.createEl("div", arg);
  }
  createSpan(arg) {
    return this.createEl("span", typeof arg === "string" ? { text: arg } : arg);
  }
  appendChild(child) {
    if (child.parentNode) child.parentNode.removeChild(child);
    this.children.push(child);
    child.parentNode = this;
    if (child.id) this.doc.ids.set(child.id, child);
    return child;
  }
  removeChild(child) {
    const at = this.children.indexOf(child);
    if (at >= 0) this.children.splice(at, 1);
    if (child.parentNode === this) child.parentNode = null;
    if (child.id && this.doc.ids.get(child.id) === child) this.doc.ids.delete(child.id);
    return child;
  }
  append(...children) {
    for (const child of children) this.appendChild(typeof child === "string" ? this.doc.createTextNode(child) : child);
  }
  empty() {
    this.children.length = 0;
    this.textContent = "";
  }
  remove() {
    if (this.parentNode) this.parentNode.removeChild(this);
  }
  detach() {
    this.remove();
  }
  addClass(...names) {
    for (const name of names) for (const part of String(name).split(/\s+/).filter(Boolean)) this.classes.add(part);
    return this;
  }
  removeClass(...names) {
    for (const name of names) this.classes.delete(name);
    return this;
  }
  toggleClass(name, force) {
    const on = force === undefined ? !this.classes.has(name) : !!force;
    if (on) this.classes.add(name);
    else this.classes.delete(name);
    return on;
  }
  hasClass(name) {
    return this.classes.has(name);
  }
  setText(text) {
    this.textContent = String(text);
    return this;
  }
  setAttr(name, value) {
    return this.setAttribute(name, value);
  }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === "id") {
      this.id = String(value);
      this.doc.ids.set(this.id, this);
    }
    return this;
  }
  getAttribute(name) {
    return this.attributes[name] ?? null;
  }
  getAttr(name) {
    return this.getAttribute(name);
  }
  removeAttribute(name) {
    delete this.attributes[name];
  }
  addEventListener(name, fn) {
    (this.listeners[name] ||= []).push(fn);
  }
  removeEventListener(name, fn) {
    this.listeners[name] = (this.listeners[name] || []).filter((f) => f !== fn);
  }
  dispatchEvent(event) {
    for (const fn of this.listeners[event.type] || []) fn(event);
  }
  setCssStyles(styles) {
    Object.assign(this.style, styles || {});
    return this;
  }
  setCssProps(props) {
    for (const [key, value] of Object.entries(props || {})) this.style.setProperty(key, value);
    return this;
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, right: 200, bottom: 300, width: 200, height: 300, x: 0, y: 0 };
  }
  querySelector() {
    return null;
  }
  querySelectorAll() {
    return [];
  }
  closest() {
    return null;
  }
  matches() {
    return false;
  }
  contains() {
    return false;
  }
  focus() {}
  blur() {}
  click() {}
  scrollIntoView() {}
  get selection() {
    return null;
  }
  get win() {
    return global;
  }
}

class FakeDocument {
  constructor() {
    this.ids = new Map();
    this.head = new FakeElement(this, "head");
    this.body = new FakeElement(this, "body");
    this.documentElement = new FakeElement(this, "html");
    this.hidden = false;
  }
  createElement(tag) {
    return new FakeElement(this, tag);
  }
  createTextNode(text) {
    return { nodeType: 3, textContent: String(text), parentNode: null, doc: this };
  }
  createDocumentFragment() {
    return new FakeElement(this, "fragment");
  }
  getElementById(id) {
    return this.ids.get(id) || null;
  }
  querySelector() {
    return null;
  }
  querySelectorAll() {
    return [];
  }
  addEventListener() {}
  removeEventListener() {}
  getSelection() {
    return null;
  }
}

function install() {
  if (installed) return load().obsidian;
  installed = true;
  const obsidian = load().obsidian;
  // A mobile-style boot: installer/electron and desktop sync paths must not run.
  obsidian.Platform.isDesktopApp = false;
  obsidian.Platform.isMobile = true;
  obsidian.Platform.isAndroidApp = false;
  obsidian.Platform.isIosApp = false;
  obsidian.Platform.isMacOS = false;
  obsidian.Platform.isWin = false;
  const doc = new FakeDocument();
  global.document = doc;
  global.window = global;
  global.MutationObserver = class {
    observe() {}
    disconnect() {}
  };
  global.HTMLElement = FakeElement;
  global.HTMLButtonElement = class extends FakeElement {};
  global.HTMLInputElement = class extends FakeElement {};
  global.HTMLTextAreaElement = class extends FakeElement {};
  global.getComputedStyle = () => ({ getPropertyValue: () => "" });
  global.createEl = (tag, opts) => {
    const el = doc.createElement(tag);
    if (opts && opts.cls) el.addClass(...String(opts.cls).split(/\s+/));
    if (opts && opts.text != null) el.textContent = String(opts.text);
    return el;
  };
  global.createDiv = (arg) => doc.body.createDiv(arg);
  global.createSpan = (arg) => doc.body.createSpan(arg);
  global.createFragment = (fn) => {
    const fragment = doc.createDocumentFragment();
    fn(fragment);
    return fragment;
  };

  class Component {
    constructor() {
      this._children = [];
      this._cleanups = [];
      this._intervals = new Set();
      this._loaded = false;
    }
    load() {
      if (this._loaded) return;
      this._loaded = true;
      return this.onload ? this.onload() : undefined;
    }
    async unload() {
      if (!this._loaded) return;
      this._loaded = false;
      if (this.onunload) await this.onunload();
      for (const cleanup of this._cleanups.splice(0).reverse()) cleanup();
      for (const child of this._children.splice(0)) if (child.unload) await child.unload();
      for (const id of this._intervals) global.clearInterval(id);
      this._intervals.clear();
    }
    addChild(child) {
      (this._children ||= []).push(child);
      child.parent = this;
      if (this._loaded && child.load) child.load();
      return child;
    }
    removeChild(child) {
      const at = (this._children || []).indexOf(child);
      if (at >= 0) this._children.splice(at, 1);
      if (child.unload) child.unload();
    }
    register(fn) {
      if (typeof fn === "function") (this._cleanups ||= []).push(fn);
      return fn;
    }
    registerEvent(ref) {
      (this._cleanups ||= []).push(() => ref && ref.offref && ref.offref());
      return ref;
    }
    registerInterval(id) {
      if (id != null) (this._intervals ||= new Set()).add(id);
      return id;
    }
    registerDomEvent(el, name, fn, opts) {
      if (el && el.addEventListener) el.addEventListener(name, fn, opts);
      (this._cleanups ||= []).push(() => el && el.removeEventListener && el.removeEventListener(name, fn, opts));
    }
    registerScopeEvent() {}
    on() {
      return { offref() {} };
    }
    off() {}
    trigger() {}
  }

  obsidian.Component = Component;
  obsidian.PluginSettingTab = class PluginSettingTab {
    constructor(app, plugin) {
      this.app = app;
      this.plugin = plugin;
      this.containerEl = doc.createElement("div");
      this.containerEl.addClass("plugin-setting-tab");
    }
    display() {}
    hide() {}
  };
  obsidian.Scope = class Scope {
    constructor() {
      this.keys = [];
    }
    register() {}
    unregister() {}
    unregisterAllKeymaps() {}
    registerKeymaps() {}
  };
  obsidian.Workspace = class Workspace {
    async openLinkText() {}
  };
  obsidian.MarkdownView = class MarkdownView {};
  obsidian.FileSystemAdapter = class FileSystemAdapter {
    static async mkdir() {}
  };
  obsidian.Keymap = { isModEvent: () => false, isModifier: () => false };
  obsidian.requireApiVersion = () => true;
  obsidian.apiVersion = "1.9.0";
  obsidian.loadPdfJs = async () => ({});
  obsidian.addIcon = () => {};
  obsidian.setTooltip = () => {};
  obsidian.setIcon = () => {};
  obsidian.Menu = class Menu {
    constructor() {
      this.items = [];
      this.parentEl = null;
    }
    addItem(callback) {
      const item = {
        setIcon() { return item; },
        setTitle() { return item; },
        setChecked() { return item; },
        setDisabled() { return item; },
        onClick() { return item; },
      };
      callback(item);
      this.items.push(item);
      return this;
    }
    addSections() {}
    setUseNativeMenu() {}
    showAtMouseEvent() {}
    showAtPosition() {}
    hide() {}
    onHide() {}
  };
  obsidian.Events = class Events {
    constructor() {
      this._events = new Map();
    }
    on(name, fn) {
      const list = this._events.get(name) || [];
      list.push(fn);
      this._events.set(name, list);
      return { offref: () => this.off(name, fn) };
    }
    off(name, fn) {
      this._events.set(name, (this._events.get(name) || []).filter((f) => f !== fn));
    }
    offref(ref) {
      if (ref && ref.offref) ref.offref();
    }
    trigger(name, ...args) {
      for (const fn of this._events.get(name) || []) fn(...args);
    }
  };

  const proto = obsidian.Plugin.prototype;
  Object.assign(proto, {
    load: Component.prototype.load,
    unload: Component.prototype.unload,
    addChild: Component.prototype.addChild,
    removeChild: Component.prototype.removeChild,
    register: Component.prototype.register,
    registerEvent: Component.prototype.registerEvent,
    registerInterval: Component.prototype.registerInterval,
    registerDomEvent: Component.prototype.registerDomEvent,
    registerScopeEvent: Component.prototype.registerScopeEvent,
    addCommand(command) {
      if (!this.commands) this.commands = [];
      this.commands.push(command);
      if (this.app && this.app.commands) this.app.commands.push(command);
      if (!this._commands) this._commands = [];
      this._commands.push(command);
      return command;
    },
    addSettingTab(tab) {
      this._settingTabs = this._settingTabs || [];
      this._settingTabs.push(tab);
      tab.id = this.manifest.id;
      if (this.app && this.app.setting) this.app.setting.pluginTabs.push(tab);
      return tab;
    },
    addRibbonIcon() {
      return doc.createElement("div");
    },
    addStatusBarItem() {
      return doc.createElement("div");
    },
    registerHoverLinkSource(id, source) {
      if (this.app && this.app.workspace) {
        this.app.workspace.hoverLinkSources[id] = source;
        this.register(() => delete this.app.workspace.hoverLinkSources[id]);
      }
    },
    registerView(type, factory) {
      this.views = this.views || {};
      this.views[type] = factory;
      if (this.app && this.app.viewRegistry) this.app.viewRegistry[type] = factory;
      this.register(() => {
        delete this.views[type];
        if (this.app && this.app.viewRegistry) delete this.app.viewRegistry[type];
      });
    },
    registerObsidianProtocolHandler() {},
    registerMarkdownPostProcessor() {},
    registerEditorExtension() {},
  });
  proto.unload = async function () {
    if (!this._loaded) return;
    this._loaded = false;
    if (this.onunload) await this.onunload();
    for (const cleanup of (this._cleanups || []).splice(0).reverse()) cleanup();
    for (const child of (this._children || []).splice(0)) if (child.unload) await child.unload();
    for (const id of this._intervals || []) global.clearInterval(id);
    if (this._intervals) this._intervals.clear();
    for (const command of this._commands || []) {
      const at = this.app.commands.indexOf(command);
      if (at >= 0) this.app.commands.splice(at, 1);
    }
    for (const tab of this._settingTabs || []) {
      const at = this.app.setting.pluginTabs.indexOf(tab);
      if (at >= 0) this.app.setting.pluginTabs.splice(at, 1);
    }
    if (this.commands) this.commands.length = 0;
    if (this._settingTabs) this._settingTabs.length = 0;
  };
  return obsidian;
}

function eventSource(target, track) {
  return {
    on(name, fn) {
      const ref = { name, fn, offref: () => { track.delete(ref); target._refs.delete(ref); } };
      target._refs.add(ref);
      track.add(ref);
      return ref;
    },
    offref(ref) {
      if (ref) ref.offref();
    },
    trigger() {},
  };
}

function makeApp() {
  const obsidian = install();
  const doc = global.document;
  const workspaceRefs = new Set();
  const vaultRefs = new Set();
  const cacheRefs = new Set();
  const timers = new Map();
  // How many patch layers actually reach the stock Obsidian behaviour. A probe call
  // increments each of these once per wrapped layer, so a doubly patched prototype
  // shows up as 2 instead of 1.
  const calls = { openLinkText: 0, menuShow: 0, menuHide: 0, onLinkHover: 0, embed: 0 };
  // The stock PDF embed/reader creator. PDF++ swaps it for its own through
  // embedRegistry and must put this exact function back on unload.
  const embedCreator = (file, subpath, ctx) => {
    calls.embed += 1;
    return { containerEl: doc.body, viewer: {}, file, subpath, ctx };
  };
  const originals = {
    workspace: function stockOpenLinkText() {
      calls.openLinkText += 1;
    },
    menuShow: function stockShowAtPosition() {
      calls.menuShow += 1;
    },
    menuHide: function stockHide() {
      calls.menuHide += 1;
    },
    pagePreview: function stockOnLinkHover() {
      calls.onLinkHover += 1;
    },
    embedCreator,
  };
  // Start every scenario from the stock prototypes even if an earlier test failed
  // before its teardown ran, so "restored" always means the stock function itself.
  obsidian.Workspace.prototype.openLinkText = originals.workspace;
  obsidian.Menu.prototype.showAtPosition = originals.menuShow;
  obsidian.Menu.prototype.hide = originals.menuHide;
  const interval = global.setInterval;
  global.setInterval = (fn, ms) => {
    const id = { id: timers.size + 1, fn, ms };
    timers.set(id, id);
    return id;
  };
  global.clearInterval = (id) => timers.delete(id);

  const workspace = {
    _refs: workspaceRefs,
    _layoutReady: [],
    activeLeaf: null,
    hoverLinkSources: {},
    on(name, fn) {
      return eventSource(this, workspaceRefs).on(name, fn);
    },
    offref(ref) {
      if (ref) ref.offref();
    },
    trigger() {},
    onLayoutReady(fn) {
      this._layoutReady.push(fn);
      fn();
    },
    iterateAllLeaves() {},
    getLeavesOfType() {
      return [];
    },
    getActiveViewOfType() {
      return null;
    },
    getActiveFile() {
      return null;
    },
    getLeaf() {
      return { openFile: async () => {} };
    },
    getRightLeaf() {
      return null;
    },
    getLeftLeaf() {
      return null;
    },
    getMostRecentLeaf() {
      return null;
    },
    createLeafInParent() {
      return this.getLeaf();
    },
    createLeafBySplit() {
      return this.getLeaf();
    },
    openLinkText: async () => {},
    recentFileTracker: { getRecentFiles: () => ({ first: () => null }) },
    containerEl: doc.body,
    rootSplit: { children: [] },
    leftSplit: {},
    rightSplit: {},
  };
  const pagePreview = { onLinkHover: originals.pagePreview };
  const adapter = new obsidian.FileSystemAdapter();
  adapter.getFullPath = (path) => `/vault/${path}`;
  adapter.exists = async () => false;
  adapter.list = async () => ({ files: [], folders: [] });
  adapter.mkdir = async () => {};
  adapter.write = async () => {};
  adapter.remove = async () => {};
  adapter.rmdir = async () => {};
  const vault = {
    _refs: vaultRefs,
    configDir: ".obsidian",
    adapter,
    on(name, fn) {
      return eventSource(this, vaultRefs).on(name, fn);
    },
    getFiles() {
      return [];
    },
    getMarkdownFiles() {
      return [];
    },
    getAbstractFileByPath() {
      return null;
    },
    getFileByPath() {
      return null;
    },
    read: async () => "",
    cachedRead: async () => "",
    readBinary: async () => new Uint8Array(),
    getResourcePath: () => "",
  };
  const metadataCache = {
    _refs: cacheRefs,
    on(name, fn) {
      return eventSource(this, cacheRefs).on(name, fn);
    },
    getCache() {
      return {};
    },
    getFileCache() {
      return {};
    },
    getFirstLinkpathDest() {
      return null;
    },
  };
  const app = {
    plugins: { plugins: {} },
    workspace,
    vault,
    metadataCache,
    setting: {
      pluginTabs: [],
      activeTab: null,
      open() {},
      openTabById() {
        return { id: "", setQuery() {} };
      },
    },
    commands: [],
    hotkeyManager: {
      getHotkeys() {
        return null;
      },
      removeHotkeys() {},
      setHotkeys() {},
    },
    embedRegistry: {
      embedByExtension: { pdf: embedCreator },
      registrations: [],
      registerExtension(extension, creator) {
        this.embedByExtension[extension] = creator;
        this.registrations.push({ extension, creator });
      },
      unregisterExtension(extension) {
        delete this.embedByExtension[extension];
        this.registrations = this.registrations.filter((entry) => entry.extension !== extension);
      },
    },
    internalPlugins: { plugins: { "page-preview": { instance: pagePreview } } },
    viewRegistry: {},
    fileManager: {},
    loadLocalStorage() {
      return null;
    },
    saveLocalStorage() {},
    openWithDefaultApp: async () => {},
    _timers: timers,
    _calls: calls,
    _originals: originals,
  };
  app.commands.findCommand = (id) => app.commands.find((command) => command.id === id);
  app.commands.executeCommandById = () => false;
  return app;
}

/**
 * Everything the embedded PDF++ subsystem owns, as comparable data. Two snapshots
 * being equal means the UI surface, registrations and patches are the same size and
 * shape, so a resume cannot have duplicated or dropped part of it.
 */
function surface(app) {
  const obsidian = load().obsidian;
  const doc = global.document;
  const styles = (doc.head.children || []).filter((el) => el && el.id === "mcq-tracker-pdf-plus-styles");
  const commandIds = app.commands.map((command) => command.id);
  return {
    commands: commandIds.slice().sort(),
    commandCount: commandIds.length,
    duplicateCommands: commandIds.filter((id, index) => commandIds.indexOf(id) !== index),
    settingTabs: app.setting.pluginTabs.map((tab) => tab.id).sort(),
    styles: styles.length,
    workspaceRefs: app.workspace._refs.size,
    vaultRefs: app.vault._refs.size,
    metadataRefs: app.metadataCache._refs.size,
    intervals: app._timers.size,
    embedPatched: app.embedRegistry.embedByExtension.pdf !== app._originals.embedCreator,
    // Registrations pointing at PDF++'s creator: exactly one while running, 0 when stopped.
    pdfPlusEmbedRegistrations: app.embedRegistry.registrations.filter((entry) => entry.creator !== app._originals.embedCreator).length,
    hoverSources: Object.keys(app.workspace.hoverLinkSources).sort(),
    views: Object.keys(app.viewRegistry).sort(),
    patched: {
      workspace: obsidian.Workspace.prototype.openLinkText !== app._originals.workspace,
      menu: obsidian.Menu.prototype.showAtPosition !== app._originals.menuShow,
      pagePreview: app.internalPlugins.plugins["page-preview"].instance.onLinkHover !== app._originals.pagePreview,
    },
  };
}

/** Capture every external module requested while `fn` runs. */
async function trackLoads(fn) {
  const requests = [];
  const original = Module._load;
  Module._load = function (request, parent, isMain) {
    requests.push(request);
    return original.call(this, request, parent, isMain);
  };
  try {
    return { value: await fn(), requests };
  } finally {
    Module._load = original;
  }
}

module.exports = { install, makeApp, surface, trackLoads, FakeDocument, FakeElement };
