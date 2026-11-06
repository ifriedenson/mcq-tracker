"use strict";
/**
 * PDF++ 0.40.31 compatibility host.
 *
 * PDF++ is MIT-licensed (Copyright (c) 2023 Ryota Ushio). Its unmodified
 * production bundle lives in vendor/pdf-plus.js. It is loaded lazily so the
 * normal test harness and a plugin load without a real Obsidian plugin registry
 * never execute the native-viewer code.
 *
 * PDF++ was written as a standalone plugin. We host its Plugin instance as a
 * Component child, give it a private manifest and persist its settings under
 * MCQ Tracker's own data.json entry instead of a second data.json.
 */

const EMBEDDED_ID = "mcq-tracker-pdf-plus";
const EMBEDDED_VERSION = "0.40.31";
const STYLE_ID = "mcq-tracker-pdf-plus-styles";
const styleText = require("../vendor/pdf-plus-css");

function ensureStyles() {
  if (typeof document === "undefined" || !document.head) return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = styleText;
  document.head.appendChild(style);
}

function removeStyles() {
  if (typeof document === "undefined") return;
  const style = document.getElementById(STYLE_ID);
  if (style && style.parentNode) style.parentNode.removeChild(style);
}

function clone(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (e) {
    return null;
  }
}

/** `{ enabled, data }`; data is PDF++'s own settings object. */
function normalizePdfPlusSettings(value) {
  const saved = value && typeof value === "object" ? value : {};
  const data = saved.data && typeof saved.data === "object" && !Array.isArray(saved.data) ? saved.data : null;
  return { enabled: saved.enabled !== false, data };
}

/** A manifest PDF++ can use without colliding with an installed pdf-plus plugin. */
function embeddedManifest(manifest) {
  const base = manifest && manifest.dir ? String(manifest.dir).replace(/\/+$/, "") : "";
  return {
    id: EMBEDDED_ID,
    name: "PDF++",
    version: EMBEDDED_VERSION,
    minAppVersion: "1.5.8",
    description: "PDF++ native PDF features, embedded in MCQ Tracker.",
    author: "Ryota Ushio",
    authorUrl: "https://github.com/RyotaUshio",
    isDesktopOnly: false,
    dir: base,
  };
}

/** A real Obsidian app exposes the plugin registry; unit-test apps do not. */
function canEmbed(app) {
  return !!(app && app.plugins && app.plugins.plugins && app.workspace && app.vault);
}

function createHost(plugin) {
  const loaded = require("../vendor/pdf-plus");
  const Host = loaded && loaded.default ? loaded.default : loaded;
  if (typeof Host !== "function") throw new Error("The embedded PDF++ bundle did not export a plugin class.");
  const host = new Host(plugin.app, embeddedManifest(plugin.manifest));
  host.loadData = async () => {
    const data = normalizePdfPlusSettings(plugin.settings && plugin.settings.pdfPlus).data;
    return data ? clone(data) : null;
  };
  host.saveData = async (data) => {
    if (!plugin.settings) return;
    const next = normalizePdfPlusSettings(plugin.settings.pdfPlus);
    next.data = data && typeof data === "object" ? clone(data) : null;
    plugin.settings.pdfPlus = next;
    if (typeof plugin.save === "function") await plugin.save();
  };
  return host;
}

async function start(plugin) {
  if (!plugin || !plugin.settings) return null;
  if (!normalizePdfPlusSettings(plugin.settings.pdfPlus).enabled) return null;
  if (!canEmbed(plugin.app)) return null;
  if (plugin.app.plugins.plugins["pdf-plus"]) {
    plugin.pdfPlusError = "The standalone PDF++ plugin is enabled. Disable it so MCQ Tracker's embedded copy can run.";
    return null;
  }
  if (plugin.pdfPlus) return plugin.pdfPlus;
  const host = createHost(plugin);
  plugin.pdfPlus = host;
  try {
    ensureStyles();
    if (typeof plugin.addChild === "function") plugin.addChild(host);
    if (!host._loaded && typeof host.load === "function") await host.load();
    else if (!host._loaded && typeof host.onload === "function") await host.onload();
    return host;
  } catch (err) {
    plugin.pdfPlus = null;
    removeStyles();
    try {
      if (typeof host.unload === "function") host.unload();
    } catch (e) {
      // The original failure is the useful one.
    }
    throw err;
  }
}

async function stop(plugin) {
  if (!plugin || !plugin.pdfPlus) return;
  const host = plugin.pdfPlus;
  plugin.pdfPlus = null;
  try {
    if (typeof plugin.removeChild === "function") plugin.removeChild(host);
    if (typeof host.unload === "function") await host.unload();
    else if (typeof host.onunload === "function") await host.onunload();
  } catch (e) {
    plugin.pdfPlusError = e && e.message ? String(e.message) : String(e);
  } finally {
    removeStyles();
  }
}

module.exports = {
  EMBEDDED_ID,
  EMBEDDED_VERSION,
  normalizePdfPlusSettings,
  embeddedManifest,
  canEmbed,
  createHost,
  start,
  stop,
};
