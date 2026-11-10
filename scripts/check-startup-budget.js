#!/usr/bin/env node
"use strict";
/*
 * Guards the plugin's module-load cost.
 *
 * Obsidian evaluates the entry module when it enables the plugin, before
 * `onload` runs, and every module reached by an eager `require` is paid for at
 * that moment. The 1.299 line moved the PDF editor stack behind calls that
 * require it on demand; this check keeps that win from being undone.
 *
 * Wall-clock timing is too environment-dependent for a deterministic gate, so
 * the budget is the source size of the modules actually evaluated while the
 * entry loads. A module counts as eager only when its `require` runs during
 * that evaluation; a require inside a function that runs later stays lazy.
 *
 * Raise the budget only with a measured reason: either keep the new dependency
 * behind a lazy require, or record why the startup cost is worth paying.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src");
const VENDOR = path.join(ROOT, "vendor");
const ENTRY = "main";

/*
 * Current load: 355 of 361 modules eager, 5,158,408 source bytes. The headroom
 * is roughly 6.7% of bytes and five modules, enough for ordinary feature work
 * but not for a vendored engine or the PDF editor stack.
 */
const BUDGET = { modules: 360, bytes: 5_500_000 };

/*
 * The modules that must not be evaluated with the entry point. The PDF editor
 * and its history, modal, ink reader and the vendored engines are loaded only
 * when a PDF is opened or edited.
 */
const MUST_STAY_LAZY = [
  "pdf-editor",
  "pdf-editor-history",
  "pdf-editor-modal",
  "pdf-ink-modal",
  "vendor/pdf-lib",
  "vendor/pdf-plus",
];

const GLOBAL_STUBS = ["window", "document", "activeWindow", "activeDocument", "localStorage", "app"];

/** Every module the build knows about, keyed the same way `__require` resolves it. */
function moduleFiles() {
  const files = new Map();
  for (const name of fs.readdirSync(SRC).filter((file) => file.endsWith(".js"))) {
    files.set(name.replace(/\.js$/, ""), path.join(SRC, name));
  }
  if (fs.existsSync(VENDOR)) {
    for (const name of fs.readdirSync(VENDOR).filter((file) => file.endsWith(".js"))) {
      files.set(`vendor/${name.replace(/\.js$/, "")}`, path.join(VENDOR, name));
    }
  }
  return files;
}

/** A constructible stand-in for the Obsidian API; module scope only defines against it. */
function makeStub() {
  const properties = new Map();
  return new Proxy(function () {}, {
    get(target, property) {
      if (property === "prototype") return target.prototype;
      if (property === "then" || property === Symbol.toPrimitive) return undefined;
      if (!properties.has(property)) properties.set(property, makeStub());
      return properties.get(property);
    },
    apply() {
      return makeStub();
    },
    construct() {
      return {};
    },
  });
}

/** Installs browser/app globals for one evaluation and restores the previous values. */
function withGlobals(run) {
  const previous = new Map();
  for (const name of GLOBAL_STUBS) {
    previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    const value = name === "window" || name === "activeWindow" ? globalThis : name === "document" || name === "activeDocument" ? makeStub() : name === "localStorage" ? { getItem: () => null, setItem() {}, removeItem() {} } : makeStub();
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }
  try {
    return run();
  } finally {
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
}

/**
 * Evaluates the entry the way the generated bundle does and reports the modules
 * and source bytes evaluated before `onload` would be called.
 */
function measure() {
  const files = moduleFiles();
  const loaded = [];
  const cache = new Map();
  const obsidian = makeStub();

  const load = (id) => {
    if (cache.has(id)) return cache.get(id).exports;
    if (!files.has(id)) throw new Error(`requires missing module ${id}`);
    const module = { exports: {} };
    cache.set(id, module);
    loaded.push(id);
    const code = fs.readFileSync(files.get(id), "utf8").replace(/^"use strict";\n/, "");
    const evaluate = new Function("module", "exports", "require", code);
    const localRequire = (name) => {
      if (name.startsWith("../vendor/")) return load(`vendor/${name.slice("../vendor/".length).replace(/\.js$/, "")}`);
      if (name.startsWith("./")) return load(name.slice(2).replace(/\.js$/, ""));
      if (name === "obsidian") return obsidian;
      try {
        return require(name);
      } catch (error) {
        return makeStub();
      }
    };
    try {
      evaluate(module, module.exports, localRequire);
    } catch (error) {
      throw new Error(`${id} failed to evaluate: ${error && error.message ? error.message : error}`);
    }
    return module.exports;
  };

  withGlobals(() => {
    if (!files.has(ENTRY)) throw new Error(`missing entry module ${ENTRY}`);
    load(ENTRY);
  });

  const eager = [...new Set(loaded)].sort();
  const bytes = eager.reduce((sum, id) => sum + fs.statSync(files.get(id)).size, 0);
  return { eager, modules: eager.length, bytes, total: files.size };
}

/** Every problem with a report against the budget and the lazy module list. */
function evaluate(report, budget = BUDGET, lazy = MUST_STAY_LAZY) {
  const problems = [];
  if (report.bytes > budget.bytes) {
    problems.push(`eager modules are ${report.bytes.toLocaleString("en-US")} source bytes, over the ${budget.bytes.toLocaleString("en-US")}-byte budget`);
  }
  if (report.modules > budget.modules) {
    problems.push(`${report.modules} modules load eagerly, over the ${budget.modules}-module budget`);
  }
  for (const id of lazy) {
    if (report.eager.includes(id)) problems.push(`${id} must stay lazy but loads with the entry point; keep its require inside the function that opens it`);
  }
  return { ok: problems.length === 0, problems };
}

module.exports = { BUDGET, MUST_STAY_LAZY, evaluate, measure, moduleFiles };

if (require.main === module) {
  let report;
  try {
    report = measure();
  } catch (error) {
    console.error(`check-startup-budget: ${error && error.message ? error.message : error}`);
    process.exit(1);
  }
  const result = evaluate(report);
  if (!result.ok) {
    for (const problem of result.problems) console.error(`check-startup-budget: ${problem}`);
    console.error(
      `check-startup-budget: ${report.modules} of ${report.total} modules load eagerly (${report.bytes.toLocaleString("en-US")} bytes), budget is ${BUDGET.modules} modules / ${BUDGET.bytes.toLocaleString("en-US")} bytes.`
    );
    console.error("Lazy-load the new dependency with a require inside the function that uses it, or raise the budget in scripts/check-startup-budget.js with a measured reason.");
    process.exit(1);
  }
  console.log(
    `check-startup-budget: ${report.modules} of ${report.total} modules load eagerly in ${report.bytes.toLocaleString("en-US")} bytes (budget ${BUDGET.modules} / ${BUDGET.bytes.toLocaleString("en-US")}); ${MUST_STAY_LAZY.length} PDF modules stay lazy.`
  );
}
