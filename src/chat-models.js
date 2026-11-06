"use strict";
/*
 * Per-chat and per-command model selection for the Study agent.
 *
 * Resolution is deliberately conservative: an explicit chat override wins, then
 * a slash-command override, then the existing feature model. A model that is not
 * in the provider's fetched list (or is not a `provider/model` pair on OpenCode)
 * is skipped with a visible reason instead of being sent and failing the
 * request. No provider, key or model is invented here.
 */
const { str } = require("./util");

const MAX_MODEL_ID = 200;
const MAX_COMMAND_MODELS = 80;
const COMMAND_ID_RE = /^[a-z0-9][a-z0-9-]*$/;

function normalizeModel(value) {
  return str(value)
    .replace(/[\u0000-\u001f]/g, "")
    .trim()
    .slice(0, MAX_MODEL_ID);
}

/** The slash-command id at the start of a message, or "" when there is none. */
function commandIdFromText(text) {
  const match = /^\/([a-z0-9][a-z0-9-]*)\b/i.exec(str(text).trim());
  return match ? match[1].toLowerCase() : "";
}

function normalizeCommandModels(value) {
  const out = {};
  const source = value && typeof value === "object" ? value : {};
  for (const rawId of Object.keys(source)) {
    const id = str(rawId).trim().replace(/^\/+/, "").toLowerCase();
    const model = normalizeModel(source[rawId]);
    if (!COMMAND_ID_RE.test(id) || !model) continue;
    out[id] = model;
    if (Object.keys(out).length >= MAX_COMMAND_MODELS) break;
  }
  return out;
}

function commandModelsText(value) {
  const models = normalizeCommandModels(value);
  return Object.keys(models)
    .sort()
    .map((id) => `${id} | ${models[id]}`)
    .join("\n");
}

/** One override per line: `command-id | model`. Built-in and saved ids both work. */
function parseCommandModelsText(text) {
  const out = {};
  for (const line of str(text).split(/\r?\n/)) {
    const raw = line.trim();
    if (!raw) continue;
    const at = raw.indexOf("|");
    if (at < 0) continue;
    const id = raw.slice(0, at).trim().replace(/^\/+/, "").toLowerCase();
    const model = normalizeModel(raw.slice(at + 1));
    if (!COMMAND_ID_RE.test(id) || !model) continue;
    if (!(id in out) && Object.keys(out).length >= MAX_COMMAND_MODELS) break;
    out[id] = model;
  }
  return out;
}

function availableList(value) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(value) ? value : []) {
    const model = normalizeModel(raw);
    if (!model || seen.has(model)) continue;
    seen.add(model);
    out.push(model);
  }
  return out;
}

/** Known choices for the panel: global model, fetched models, then a saved override. */
function modelChoices(options) {
  const opts = options || {};
  const seen = new Set();
  const out = [];
  for (const raw of [opts.globalModel, ...(Array.isArray(opts.availableModels) ? opts.availableModels : []), opts.ownModel]) {
    const model = normalizeModel(raw);
    if (!model || seen.has(model)) continue;
    seen.add(model);
    out.push(model);
  }
  return out;
}

function modelAvailability(requested, options) {
  const opts = options || {};
  const model = normalizeModel(requested);
  if (!model) return { ok: false, reason: "no model name" };
  if (str(opts.backend).trim() === "opencode" && !/^[^/\s]+\/[^/\s]+$/.test(model)) {
    return { ok: false, reason: "OpenCode models must be written provider/model" };
  }
  const available = availableList(opts.availableModels);
  if (available.length && !available.includes(model)) {
    return { ok: false, reason: "not in the provider's fetched model list" };
  }
  return { ok: true, reason: "" };
}

/**
 * Resolve the model for one send. Every requested override that is skipped is
 * returned in `fallbacks` so the caller can show why the effective model differs.
 */
function resolveChatModel(options) {
  const opts = options || {};
  const backend = str(opts.backend).trim() === "opencode" ? "opencode" : "api";
  const global = normalizeModel(opts.globalModel);
  const availableModels = availableList(opts.availableModels);
  const fallbacks = [];
  const candidates = [
    { source: "chat", requested: normalizeModel(opts.chatModel) },
    { source: "command", requested: normalizeModel(opts.commandModel) },
  ];
  for (const candidate of candidates) {
    if (!candidate.requested) continue;
    if (global && candidate.requested === global) {
      return { model: global, source: candidate.source, requested: candidate.requested, requestedSource: candidate.source, fallbacks, availableModels, backend };
    }
    const check = modelAvailability(candidate.requested, { backend, availableModels });
    if (check.ok) {
      return { model: candidate.requested, source: candidate.source, requested: candidate.requested, requestedSource: candidate.source, fallbacks, availableModels, backend };
    }
    fallbacks.push({ source: candidate.source, requested: candidate.requested, reason: check.reason });
  }
  return {
    model: global,
    source: global ? "global" : "default",
    requested: "",
    requestedSource: "",
    fallbacks,
    availableModels,
    backend,
  };
}

function modelSourceLabel(source) {
  if (source === "chat") return "chat override";
  if (source === "command") return "command override";
  if (source === "global") return "global chat model";
  return "provider default";
}

function effectiveModelLabel(plan) {
  const model = plan && plan.model ? plan.model : "";
  return model || "provider default";
}

module.exports = {
  COMMAND_ID_RE,
  MAX_COMMAND_MODELS,
  MAX_MODEL_ID,
  commandIdFromText,
  commandModelsText,
  effectiveModelLabel,
  modelAvailability,
  modelChoices,
  modelSourceLabel,
  normalizeCommandModels,
  normalizeModel,
  parseCommandModelsText,
  resolveChatModel,
};
