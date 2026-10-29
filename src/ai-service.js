"use strict";
/*
 * One description of every AI feature, what it is allowed to send, which
 * backend can run it, which model it should use and how many requests it may
 * spend. Provider calls still happen in ./api-client and ./opencode-client;
 * this module is the shared policy layer around them.
 */
const { str } = require("./util");

const AI_USAGE_STORAGE_KEY = "question-tracker-ai-usage";

const AI_FEATURES = [
  {
    id: "chat",
    label: "Assistant chat",
    sends: "Your message, plus the current note or selection only while its switch is on for that chat.",
  },
  {
    id: "generation",
    label: "Generate practice and import",
    sends: "The lecture, document text or source pages you choose, and the prompt.",
  },
  {
    id: "verification",
    label: "Check AI-written answers",
    sends: "The question and choices; never the stored answer key.",
  },
  {
    id: "cardGrading",
    label: "Grade typed card answers",
    sends: "The card front, stored answer, your typed answer and the strictness.",
  },
  {
    id: "frqGrading",
    label: "Grade free-response answers",
    sends: "The prompt, your rubric, the optional sample answer and your typed answer.",
  },
  {
    id: "ocr",
    label: "Vision OCR",
    requires: "vision",
    sends: "The page images you choose.",
  },
];

const FEATURE_IDS = AI_FEATURES.map((feature) => feature.id);

const DEFAULT_AI_LIMITS = {
  maxTokens: 4000, // hard cap for one reply, even if a feature asks for more
  dailyRequests: 0, // 0 = no daily cap
  runRequests: 0, // 0 = no cap on one burst of work (a run resets after 10 idle minutes)
};

const AI_CAPABILITIES = {
  api: { vision: true, structured: true, streaming: false, tools: false },
  opencode: { vision: false, structured: true, streaming: true, tools: true },
};

const CAPABILITY_LABELS = {
  vision: "page images",
  structured: "JSON replies",
  streaming: "live progress",
  tools: "file tools",
};

function normalizeBackend(value) {
  return str(value).trim() === "opencode" ? "opencode" : "api";
}

function normalizeFeatureId(value) {
  const wanted = str(value).trim().toLowerCase();
  return FEATURE_IDS.find((id) => id.toLowerCase() === wanted) || "chat";
}

function featureDef(id) {
  const key = normalizeFeatureId(id);
  return AI_FEATURES.find((feature) => feature.id === key);
}

/** Capability flags for one backend. Unknown backends fall back to Direct API. */
function capabilities(backend) {
  return { ...AI_CAPABILITIES[normalizeBackend(backend)] };
}

/** Whether a feature can run on a backend, with a short reason when it cannot. */
function featureSupport(feature, backend) {
  const def = featureDef(feature);
  const caps = capabilities(backend);
  if (def.requires && !caps[def.requires]) {
    return {
      ok: false,
      reason: `${def.label} needs ${CAPABILITY_LABELS[def.requires] || def.requires}, which ${normalizeBackend(backend) === "opencode" ? "OpenCode" : "this backend"} cannot receive. Use Direct AI for this feature.`,
    };
  }
  return { ok: true, reason: "" };
}

/** The model for one feature: its override, else the backend-wide model. */
function featureModel(ai, feature, backend) {
  const id = normalizeFeatureId(feature);
  const features = (ai && ai.features) || {};
  const own = str(features[id] && features[id].model).trim();
  if (own) return own;
  return normalizeBackend(backend) === "opencode" ? str(ai && ai.model).trim() : str(ai && ai.api && ai.api.model).trim();
}

function clampInteger(value, fallback, min, max) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function normalizeLimits(value) {
  const limits = value && typeof value === "object" ? value : {};
  return {
    maxTokens: clampInteger(limits.maxTokens, DEFAULT_AI_LIMITS.maxTokens, 256, 32000),
    dailyRequests: clampInteger(limits.dailyRequests, DEFAULT_AI_LIMITS.dailyRequests, 0, 10000),
    runRequests: clampInteger(limits.runRequests, DEFAULT_AI_LIMITS.runRequests, 0, 1000),
  };
}

/** Fill in feature models and limits without dropping any existing AI setting. */
function normalizeAiService(ai) {
  const out = ai && typeof ai === "object" ? ai : {};
  const saved = out.features && typeof out.features === "object" ? out.features : {};
  out.features = {};
  for (const id of FEATURE_IDS) {
    out.features[id] = { model: str(saved[id] && saved[id].model).trim().slice(0, 200) };
  }
  out.limits = normalizeLimits(out.limits);
  return out;
}

function clampMaxTokens(ai, requested) {
  const limits = normalizeLimits(ai && ai.limits);
  const wanted = Math.round(Number(requested));
  if (!Number.isFinite(wanted) || wanted <= 0) return limits.maxTokens;
  return Math.min(wanted, limits.maxTokens);
}

/** Rough size estimate used before sending, without a tokenizer dependency. */
function estimateTokens(text) {
  return Math.ceil(str(text).length / 4);
}

function estimateRequestTokens(system, messages, images) {
  let total = estimateTokens(system);
  for (const message of Array.isArray(messages) ? messages : []) total += estimateTokens(message && message.content);
  for (const image of Array.isArray(images) ? images : []) if (image && image.data) total += 1200;
  return total;
}

function usageForDate(value, today) {
  let raw = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch (e) {
      raw = null;
    }
  }
  const date = str(today).trim();
  if (!raw || typeof raw !== "object" || str(raw.date).trim() !== date) {
    return { date, requests: 0, tokens: 0, features: {} };
  }
  const features = {};
  for (const id of FEATURE_IDS) {
    const item = raw.features && raw.features[id];
    if (!item) continue;
    const requests = Math.max(0, Number(item.requests) || 0);
    const tokens = Math.max(0, Number(item.tokens) || 0);
    if (requests || tokens) features[id] = { requests, tokens };
  }
  return {
    date,
    requests: Math.max(0, Number(raw.requests) || 0),
    tokens: Math.max(0, Number(raw.tokens) || 0),
    features,
  };
}

function packUsage(usage) {
  return JSON.stringify(usage || { date: "", requests: 0, tokens: 0, features: {} });
}

/** Count one request before it is sent, so a failing provider cannot bypass the cap. */
function recordUsage(usage, feature, tokens, today) {
  const base = usageForDate(usage, today);
  const id = normalizeFeatureId(feature);
  const addTokens = Math.max(0, Math.round(Number(tokens) || 0));
  const item = base.features[id] || { requests: 0, tokens: 0 };
  base.requests += 1;
  base.tokens += addTokens;
  base.features[id] = { requests: item.requests + 1, tokens: item.tokens + addTokens };
  return base;
}

function budgetState(usage, limits, today) {
  const current = usageForDate(usage, today);
  const clean = normalizeLimits(limits);
  const cap = clean.dailyRequests;
  const remaining = cap ? Math.max(0, cap - current.requests) : null;
  return {
    used: current.requests,
    tokens: current.tokens,
    features: current.features,
    cap,
    remaining,
    allowed: !cap || current.requests < cap,
    message: cap && current.requests >= cap ? `The daily AI request cap (${cap}) has been reached. Raise it in Settings, MCQ Tracker, AI, or try again tomorrow.` : "",
  };
}

function runBudgetState(run, limits, now) {
  const clean = normalizeLimits(limits);
  const started = Number(run && run.startedAt) || 0;
  const fresh = !started || now - started > 10 * 60 * 1000;
  const requests = fresh ? 0 : Math.max(0, Number(run && run.requests) || 0);
  const cap = clean.runRequests;
  return {
    requests,
    cap,
    remaining: cap ? Math.max(0, cap - requests) : null,
    allowed: !cap || requests < cap,
    message: cap && requests >= cap ? `This AI run has reached its request cap (${cap}). Finish this batch, or raise the cap in Settings, MCQ Tracker, AI.` : "",
  };
}

/** A 401/400 will not fix itself; 429, 5xx and network errors may. */
function isRetryableError(error) {
  const m = str(error && error.message ? error.message : error);
  if (/HTTP 40[0134]|HTTP 422/.test(m)) return false;
  if (/HTTP 408|HTTP 409|HTTP 425|HTTP 429|HTTP 5\d\d/.test(m)) return true;
  return /ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|Failed to fetch|net::|network/i.test(m);
}

function featureListText() {
  return AI_FEATURES.map((feature) => `${feature.label}: ${feature.sends}`).join("\n");
}

module.exports = {
  AI_USAGE_STORAGE_KEY,
  AI_FEATURES,
  FEATURE_IDS,
  DEFAULT_AI_LIMITS,
  AI_CAPABILITIES,
  CAPABILITY_LABELS,
  normalizeBackend,
  normalizeFeatureId,
  featureDef,
  capabilities,
  featureSupport,
  featureModel,
  normalizeLimits,
  normalizeAiService,
  clampMaxTokens,
  estimateTokens,
  estimateRequestTokens,
  usageForDate,
  packUsage,
  recordUsage,
  budgetState,
  runBudgetState,
  isRetryableError,
  featureListText,
};
