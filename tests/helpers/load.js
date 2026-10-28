"use strict";
/*
 * Loads the built plugin (../../main.js, or the file in $MCQ_MAIN) with a stand-in for the
 * `obsidian` module, so the plugin's logic can be tested with plain Node.
 */
const Module = require("module");
const path = require("path");

/* ---- a tiny YAML subset: enough for question-note properties */
function scalar(v) {
  v = v.trim();
  if (v === "") return "";
  if (/^\[.*\]$/.test(v)) return v.slice(1, -1).split(",").map((x) => x.trim()).filter(Boolean).map(scalar);
  if (/^"(.*)"$/.test(v)) return JSON.parse(v);
  if (/^'(.*)'$/.test(v)) return v.slice(1, -1);
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if (v === "true") return true;
  if (v === "false") return false;
  return v;
}
function parseYaml(text) {
  const out = {};
  let key = null;
  for (const line of String(text).split("\n")) {
    const li = line.match(/^\s+-\s+(.*)$/);
    if (li && key) {
      if (!Array.isArray(out[key])) out[key] = [];
      out[key].push(scalar(li[1]));
      continue;
    }
    const m = line.match(/^([^:#\s][^:]*):\s*(.*)$/);
    if (!m) continue;
    key = m[1].trim();
    out[key] = scalar(m[2]);
  }
  return out;
}
function stringifyYaml(o) {
  const q = (v) => (typeof v === "string" && (v === "" || /[:#\[\]{}",]|^\s|\s$|^(true|false|-?\d+(\.\d+)?)$/.test(v)) ? JSON.stringify(v) : String(v));
  return (
    Object.entries(o)
      .map(([k, v]) => (Array.isArray(v) ? (v.length ? `${k}:\n${v.map((x) => `  - ${q(x)}`).join("\n")}` : `${k}: []`) : `${k}: ${q(v)}`))
      .join("\n") + "\n"
  );
}

class Base {
  constructor(...a) {
    this.args = a;
  }
}
class Plugin extends Base {
  constructor(app) {
    super();
    this.app = app;
    this.commands = [];
    this.events = [];
    this.views = {};
    this.saved = null;
  }
  addCommand(c) {
    this.commands.push(c);
  }
  addRibbonIcon() {}
  addSettingTab() {}
  registerView(type, fn) {
    this.views[type] = fn;
  }
  registerEvent(e) {
    this.events.push(e);
  }
  registerDomEvent() {}
  registerInterval() {}
  async loadData() {
    return this.saved;
  }
  async saveData(d) {
    this.saved = JSON.parse(JSON.stringify(d));
  }
}
class TFile {}
class TFolder {}

const obsidian = {
  Plugin,
  ItemView: class extends Base {
    constructor(leaf) {
      super();
      this.leaf = leaf;
      this.app = leaf && leaf.app;
    }
    registerEvent() {}
    registerInterval() {}
  },
  PluginSettingTab: class extends Base {},
  Setting: class extends Base {},
  Modal: class extends Base {},
  FuzzySuggestModal: class extends Base {
    setPlaceholder() {}
  },
  AbstractInputSuggest: class extends Base {},
  Notice: class {
    constructor(msg) {
      obsidian.notices.push(String(msg));
    }
    setMessage() {}
    hide() {}
  },
  MarkdownRenderer: { render: async () => {} },
  Platform: { isDesktopApp: true, isMobile: false },
  TFile,
  TFolder,
  setIcon() {},
  requestUrl: (...a) => (obsidian.requestImpl ? obsidian.requestImpl(...a) : Promise.resolve({})), // tests can set obsidian.requestImpl
  loadPdfJs: async () => ({}),
  stringifyYaml,
  parseYaml,
  normalizePath: (p) => String(p).replace(/\/+/g, "/").replace(/^\/|\/$/g, ""),
  notices: [],
};

let cached = null;
/** Loads the plugin bundle (the default one is cached). Pass a file path to load a different bundle. */
function load(fileOverride) {
  if (!fileOverride && cached) return cached;
  const orig = Module._load;
  Module._load = function (request, ...rest) {
    if (request === "obsidian") return obsidian;
    return orig.call(this, request, ...rest);
  };
  // timers: repeating ones are not started (they would keep Node running); one-off ones are real but don't hold Node open
  global.window = global;
  global.activeWindow = {
    setInterval: () => 0,
    clearInterval() {},
    setTimeout: (fn, ms) => {
      const t = setTimeout(fn, ms);
      if (t && t.unref) t.unref();
      return t;
    },
    clearTimeout: (t) => clearTimeout(t),
  };
  global.activeDocument = { hidden: false };
  const file = fileOverride || (process.env.MCQ_MAIN ? path.resolve(process.env.MCQ_MAIN) : path.join(__dirname, "..", "..", "main.js"));
  delete require.cache[require.resolve(file)];
  const Plugin_ = require(file);
  const loaded = { T: Plugin_.__test, Plugin: Plugin_, obsidian };
  if (!fileOverride) cached = loaded;
  return loaded;
}

/** A question as the plugin sees it: { file: {path, basename}, fm } */
function q(filePath, fm) {
  return { file: { path: filePath, basename: filePath.replace(/^.*\//, "").replace(/\.md$/, "") }, fm: Object.assign({ question_id: "X" }, fm) };
}

module.exports = { load, q, obsidian, TFile, TFolder };
