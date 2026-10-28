"use strict";
/* Stand-ins for Obsidian's app, vault and page elements, enough to run the plugin code without Obsidian. */
const NOTE_TEXT = (id, answer) => `---
question_id: ${id}
---

## Question
What is ${id}?

## Answer Choices
- A. one
- B. two
- C. three
- D. four

## Answer
> [!answer]- Reveal answer
> **Correct Answer: ${answer}**
>
> Because.

## My Notes
`;

function makeApp(notes) {
  const { obsidian } = require("./load").load();
  const files = notes.map((n) => {
    const f = new obsidian.TFile();
    f.path = n.path;
    f.basename = n.path.replace(/^.*\//, "").replace(/\.md$/, "");
    f.extension = "md";
    f.parent = { path: n.path.includes("/") ? n.path.replace(/\/[^/]*$/, "") : "/" };
    f.fm = n.noFm ? {} : Object.assign({ question_id: f.basename }, n.fm);
    f.text = n.text || NOTE_TEXT(f.basename, (n.fm && n.fm.answer) || "B");
    // like Obsidian's cache: headings come from the note's text unless a test says otherwise
    f.headings = n.headings || [...f.text.matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)].map((m) => ({ heading: m[1] }));
    return f;
  });
  const handlers = {};
  const app = {
    files,
    handlers,
    opened: [],
    trashed: [],
    vault: {
      getMarkdownFiles: () => files,
      getFiles: () => files,
      getAllLoadedFiles: () => files,
      cachedRead: async (f) => f.text,
      read: async (f) => f.text,
      getAbstractFileByPath: (p) => files.find((f) => f.path === p) || null,
      create: async (p, text) => {
        const f = new obsidian.TFile();
        f.path = p;
        f.basename = p.replace(/^.*\//, "").replace(/\.md$/, "");
        f.extension = p.replace(/^.*\./, "");
        f.parent = { path: p.includes("/") ? p.replace(/\/[^/]*$/, "") : "/" };
        f.text = text;
        f.fm = {};
        f.headings = [];
        files.push(f);
        app.created = app.created || [];
        app.created.push({ path: p, text });
        return f;
      },
      modify: async (f, text) => {
        f.text = text;
        app.modified = app.modified || [];
        app.modified.push({ path: f.path, text });
      },
      createFolder: async (p) => {
        app.folders = app.folders || [];
        app.folders.push(p);
      },
      on: (name, cb) => ((handlers["vault:" + name] = cb), name),
      adapter: { exists: async () => false, list: async () => ({ files: [], folders: [] }) },
    },
    metadataCache: {
      getFileCache: (f) => ({ frontmatter: f.fm, headings: f.headings }),
      getFirstLinkpathDest: () => null,
      on: (name, cb) => ((handlers["cache:" + name] = cb), name),
    },
    fileManager: {
      processFrontMatter: async (f, fn) => fn(f.fm),
      trashFile: async (f) => app.trashed.push(f.path),
    },
    workspace: {
      on: (name, cb) => ((handlers["ws:" + name] = cb), name),
      onLayoutReady: () => {},
      getLeavesOfType: () => [],
      getLeaf: () => ({ openFile: async (f) => app.opened.push(f.path) }),
      getActiveFile: () => null,
    },
    loadLocalStorage: () => null,
    saveLocalStorage: () => {},
  };
  return app;
}

/** A page element that accepts any call; every button/input created is recorded so tests can click it. */
function makeDom() {
  const all = [];
  const make = (meta) => {
    const own = { meta, handlers: [] };
    all.push(own);
    return new Proxy(function () {}, {
      get(_t, k) {
        if (k === Symbol.toPrimitive) return () => "";
        if (k === "then") return undefined;
        if (k === "style") {
          if (!own.style) own.style = { setProperty(name, value) { this[name] = value; } };
          return own.style;
        }
        if (k === "value") return own.value === undefined ? "" : own.value;
        if (k === "hasClass") return () => false;
        if (k === "isConnected") return true;
        if (k === "scrollTop") return 0;
        if (k === "addEventListener") return (ev, fn) => own.handlers.push({ ev, fn });
        if (k === "setAttr") return (name, value) => {
          own.meta.attrs = own.meta.attrs || {};
          own.meta.attrs[name] = value;
        };
        if (k === "getAttr") return (name) => (own.meta.attrs || {})[name];
        if (k === "createEl" || k === "createDiv" || k === "createSpan") {
          return (a, b) => make(k === "createEl" ? Object.assign({ tag: a }, b || {}) : Object.assign({ tag: k === "createDiv" ? "div" : "span" }, a || {}));
        }
        return () => make({});
      },
      set(_t, k, v) {
        if (k === "value") own.value = v;
        return true;
      },
    });
  };
  const root = make({ tag: "root" });
  return {
    root,
    all,
    /** find recorded elements whose text matches */
    find: (text) => all.filter((o) => o.meta && typeof o.meta.text === "string" && (text instanceof RegExp ? text.test(o.meta.text) : o.meta.text === text)),
    click: async (text) => {
      const hit = all.find((o) => o.meta && (text instanceof RegExp ? text.test(o.meta.text || "") : o.meta.text === text) && o.handlers.some((h) => h.ev === "click"));
      if (!hit) throw new Error(`no clickable element with text ${text}`);
      for (const h of hit.handlers.filter((x) => x.ev === "click")) await h.fn({});
    },
    texts: () => all.map((o) => o.meta && o.meta.text).filter((t) => typeof t === "string"),
  };
}

module.exports = { makeApp, makeDom, NOTE_TEXT };
