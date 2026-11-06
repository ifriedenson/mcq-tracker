"use strict";
/*
 * Local-only diagnostics. This module is deliberately pure: it formats state the
 * plugin already has and never reads the network, telemetry or a hosted service.
 * Secrets are removed before a report is returned, including when they appear in
 * a recent error string rather than in their usual settings field.
 */
const { str } = require("./util");

const MAX_SETTINGS_CHARS = 24000;
const MAX_ERRORS = 20;
const MAX_ERROR_CHARS = 600;
const MAX_FIELD_CHARS = 1600;
const SENSITIVE_KEY = /api[-_]?key|keys?$|token|secret|password|passwd|credential|authorization|cookie|private[-_]?key/i;

function looksSecretKey(key) {
  return SENSITIVE_KEY.test(str(key));
}

function collectSecretValues(value, key, out, seen, depth) {
  if (value === null || value === undefined) return;
  if (depth > 8) return;
  if (typeof value === "string" || typeof value === "number") {
    const text = str(value);
    if (looksSecretKey(key) && text && !/^\[redacted\]$/.test(text)) out.add(text);
    return;
  }
  if (typeof value !== "object") return;
  if (seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 200)) collectSecretValues(item, key, out, seen, depth + 1);
    return;
  }
  for (const [childKey, child] of Object.entries(value)) {
    collectSecretValues(child, childKey, out, seen, depth + 1);
  }
}

/** Every secret-looking setting value, used to scrub accidental copies in logs. */
function secretValues(settings) {
  const out = new Set();
  collectSecretValues(settings, "", out, new Set(), 0);
  return [...out].filter((value) => value.length >= 3);
}

function scrubText(value, secrets) {
  let text = str(value);
  for (const secret of secrets) text = text.split(secret).join("[redacted]");
  text = text.replace(/([?&](?:api[_-]?key|key|token|secret|password)=)[^&\s]+/gi, "$1[redacted]");
  text = text.replace(/\b(?:sk|pk|rk)-[A-Za-z0-9_-]{8,}\b/g, "[redacted]");
  return text.length > MAX_FIELD_CHARS ? `${text.slice(0, MAX_FIELD_CHARS)}…` : text;
}

function safeUrl(value, secrets) {
  const text = scrubText(value, secrets);
  if (!text) return "";
  try {
    const url = new URL(text);
    url.username = "";
    url.password = "";
    return url.toString();
  } catch (e) {
    return text;
  }
}

function redactValue(value, key, secrets, seen, depth) {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return scrubText(value, secrets);
  if (typeof value === "number" || typeof value === "boolean") {
    return looksSecretKey(key) ? "[redacted]" : value;
  }
  if (typeof value !== "object") return scrubText(value, secrets);
  if (looksSecretKey(key)) {
    if (Array.isArray(value)) return value.map(() => "[redacted]");
    if (typeof value === "object") {
      const out = {};
      for (const child of Object.keys(value).sort()) out[child] = "[redacted]";
      return out;
    }
    return "[redacted]";
  }
  if (seen.has(value)) return "[circular]";
  seen.add(value);
  if (depth >= 6) return "[depth limit]";
  if (Array.isArray(value)) {
    return value.slice(0, 80).map((item) => redactValue(item, key, secrets, seen, depth + 1));
  }
  const out = {};
  for (const childKey of Object.keys(value).sort()) {
    out[childKey] = redactValue(value[childKey], childKey, secrets, seen, depth + 1);
  }
  return out;
}

function moduleFlags(settings) {
  const out = {};
  for (const key of Object.keys(settings || {}).sort()) {
    if (/^(?:enable|show|allow|open|.*Enabled)$/i.test(key) && typeof settings[key] === "boolean") out[key] = settings[key];
  }
  return out;
}

function safeFeatures(ai) {
  const features = ai && ai.features && typeof ai.features === "object" ? ai.features : {};
  const out = {};
  for (const key of Object.keys(features).sort().slice(0, 80)) {
    const value = features[key];
    if (value && typeof value === "object") {
      out[key] = {
        enabled: value.enabled === true,
        model: str(value.model).slice(0, 120),
      };
    } else {
      out[key] = value === true;
    }
  }
  return out;
}

function safeLimits(ai) {
  const limits = ai && ai.limits && typeof ai.limits === "object" ? ai.limits : {};
  const out = {};
  for (const key of Object.keys(limits).sort()) {
    if (typeof limits[key] === "number" || typeof limits[key] === "boolean") out[key] = limits[key];
  }
  return out;
}

function budgetSnapshot(panelState) {
  const budget = panelState && panelState.budget;
  if (!budget || !Number.isFinite(Number(budget.limit)) || Number(budget.limit) <= 0) {
    return { available: false, note: "The Study agent panel was not open, so no live chat-budget state was available." };
  }
  return {
    available: true,
    tokens: Math.max(0, Math.round(Number(budget.tokens) || 0)),
    limit: Math.max(0, Math.round(Number(budget.limit) || 0)),
    chars: Math.max(0, Math.round(Number(budget.chars) || 0)),
    ratio: Number.isFinite(Number(budget.ratio)) ? Number(budget.ratio) : 0,
    level: str(budget.level),
    warn: budget.warn === true,
    over: budget.over === true,
    parts: Array.isArray(budget.parts) ? budget.parts.slice(0, 20).map((part) => ({
      label: str(part && part.label),
      chars: Math.max(0, Math.round(Number(part && part.chars) || 0)),
      tokens: Math.max(0, Math.round(Number(part && part.tokens) || 0)),
    })) : [],
  };
}

function modelSnapshot(panelState) {
  const plan = panelState && panelState.modelPlan;
  if (!plan || typeof plan !== "object") return { available: false };
  return {
    available: true,
    model: str(plan.model),
    source: str(plan.source),
    fallbacks: Array.isArray(plan.fallbacks)
      ? plan.fallbacks.slice(0, 10).map((item) => ({
          requested: str(item && item.requested),
          source: str(item && item.source),
          reason: str(item && item.reason),
        }))
      : [],
  };
}

function errorRows(input) {
  const rows = [];
  const add = (scope, value) => {
    const message = str(value).trim();
    if (!message) return;
    rows.push({ scope: str(scope || "local"), message: message.length > MAX_ERROR_CHARS ? `${message.slice(0, MAX_ERROR_CHARS)}…` : message });
  };
  if (input.panelState && input.panelState.error) add("study chat", input.panelState.error);
  for (const item of Array.isArray(input.recentErrors) ? input.recentErrors : []) {
    if (item && typeof item === "object") add(item.scope, item.message);
    else add("local", item);
  }
  add("opencode setup", input.setupError);
  add("couchdb", input.couchdbError);
  return rows.slice(-MAX_ERRORS);
}

function settingsSnapshot(settings, secrets) {
  const redacted = redactValue(settings, "", secrets, new Set(), 0);
  const text = JSON.stringify(redacted, null, 2);
  return {
    redacted,
    markdown: text.length > MAX_SETTINGS_CHARS ? `${text.slice(0, MAX_SETTINGS_CHARS)}\n… (settings snapshot truncated)` : text,
  };
}

/**
 * Build a self-contained Markdown bundle plus its structured data. Nothing here
 * touches the filesystem or the network; the caller owns the write and notice.
 */
function buildDiagnosticsBundle(input) {
  const source = input && typeof input === "object" ? input : {};
  const settings = source.settings && typeof source.settings === "object" ? source.settings : {};
  const secrets = secretValues(settings);
  const ai = settings.ai && typeof settings.ai === "object" ? settings.ai : {};
  const api = ai.api && typeof ai.api === "object" ? ai.api : {};
  const platform = source.platform && typeof source.platform === "object" ? source.platform : {};
  const manifest = source.manifest && typeof source.manifest === "object" ? source.manifest : {};
  const generatedAt = source.now instanceof Date ? source.now : new Date();
  const panelState = source.panelState || null;
  const settingsView = settingsSnapshot(settings, secrets);
  const data = {
    generatedAt: generatedAt.toISOString(),
    plugin: {
      id: scrubText(manifest.id || "mcq-tracker", secrets),
      name: scrubText(manifest.name || "MCQ Tracker", secrets),
      version: scrubText(manifest.version || "unknown", secrets),
    },
    app: {
      version: scrubText(source.appVersion || "", secrets),
      desktop: platform.isDesktopApp === true,
      mobile: platform.isMobile === true || platform.isPhone === true,
    },
    configuration: {
      modules: moduleFlags(settings),
      ai: {
        enabled: ai.enabled === true,
        backend: scrubText(ai.backend || "", secrets),
        mode: scrubText(ai.mode || "", secrets),
        managed: ai.managed === true,
        provider: scrubText(api.provider || "", secrets),
        baseUrl: safeUrl(api.baseUrl, secrets),
        model: scrubText(api.model || "", secrets),
        configuredProviders: Object.keys(api.keys && typeof api.keys === "object" ? api.keys : {}).sort(),
        configuredSecrets: Object.keys(api.secrets && typeof api.secrets === "object" ? api.secrets : {}).sort(),
        passwordConfigured: !!ai.password,
        features: safeFeatures(ai),
        limits: safeLimits(ai),
      },
      chat: {
        historyMessages: source.historyMessages === undefined ? null : Math.max(0, Math.round(Number(source.historyMessages) || 0)),
        openSessions: source.openSessions === undefined ? null : Math.max(0, Math.round(Number(source.openSessions) || 0)),
        bookmarks: source.bookmarks === undefined ? null : Math.max(0, Math.round(Number(source.bookmarks) || 0)),
        model: scrubText(source.chatModel || "", secrets),
      },
    },
    plan: {
      release: scrubText(manifest.version || "unknown", secrets),
      roadmap: "plan.md is the source of truth. This bundle records the installed release and observable capability state only.",
      commandsRegistered: source.commandCount === undefined ? null : Math.max(0, Math.round(Number(source.commandCount) || 0)),
      capabilities: source.capabilities && typeof source.capabilities === "object" ? redactValue(source.capabilities, "capabilities", secrets, new Set(), 0) : {},
    },
    budget: budgetSnapshot(panelState),
    model: modelSnapshot(panelState),
    errors: errorRows(source).map((row) => ({ scope: row.scope, message: scrubText(row.message, secrets) })),
    settings: settingsView.redacted,
  };
  const lines = [
    "# MCQ Tracker diagnostics bundle",
    "",
    `Generated: ${data.generatedAt}`,
    "Local only: this report was built from plugin state. No network request or telemetry was made.",
    "",
    "## Plugin",
    "",
    `- Name: ${data.plugin.name}`,
    `- Id: ${data.plugin.id}`,
    `- Version: ${data.plugin.version}`,
    `- Obsidian: ${data.app.version || "unknown"}`,
    `- Platform: ${data.app.desktop ? "desktop" : data.app.mobile ? "mobile" : "unknown"}`,
    "",
    "## Configuration",
    "",
    "```json",
    JSON.stringify(data.configuration, null, 2),
    "```",
    "",
    "## Chat budget and model",
    "",
    "```json",
    JSON.stringify({ budget: data.budget, model: data.model }, null, 2),
    "```",
    "",
    "## Plan and capability status",
    "",
    `- Installed release: ${data.plan.release}`,
    `- Commands registered: ${data.plan.commandsRegistered === null ? "not reported" : data.plan.commandsRegistered}`,
    `- Roadmap: ${data.plan.roadmap}`,
    "",
    "```json",
    JSON.stringify(data.plan.capabilities, null, 2),
    "```",
    "",
    "## Recent local errors",
    "",
  ];
  if (data.errors.length) {
    for (const row of data.errors) lines.push(`- ${row.scope}: ${row.message}`);
  } else {
    lines.push("No recent local errors were recorded.");
  }
  lines.push(
    "",
    "## Settings snapshot (secrets redacted)",
    "",
    "```json",
    settingsView.markdown,
    "```",
    ""
  );
  const markdown = lines.join("\n");
  return { markdown, data };
}

function bundleFileName(now) {
  const date = now instanceof Date ? now : new Date();
  const pad = (number) => String(number).padStart(2, "0");
  return `Study agent diagnostics ${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}${pad(date.getMinutes())}.md`;
}

function bundleFolder() {
  return "Study agent diagnostics";
}

module.exports = {
  MAX_SETTINGS_CHARS,
  MAX_ERRORS,
  buildDiagnosticsBundle,
  bundleFileName,
  bundleFolder,
  redactValue,
  secretValues,
  scrubText,
};
