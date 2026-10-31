"use strict";
/*
 * Runtime model discovery for the Direct AI provider. Providers return model
 * lists in a few common shapes; normalize them, drop specialist non-chat models
 * and cap the result so a settings dropdown cannot grow without bound.
 */
const { str } = require("./util");

const MAX_MODELS = 200;

// Model families that cannot answer a quiz prompt. Keep "vision" out of this
// list: multimodal chat models are useful for OCR and answer-checking.
const NON_CHAT = /(^|[-_/.])(embed|embedding|embeddings|whisper|tts|speech|transcribe|transcription|audio|moderation|rerank|clip|image|images|dall-e|imagen|sora|veo|realtime|guard|safety|ocr)([-_/.]|$)/i;

function cleanId(value) {
  return str(value)
    .trim()
    .replace(/^models\//i, "");
}

function entryId(entry) {
  if (typeof entry === "string") return cleanId(entry);
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return "";
  for (const key of ["id", "model", "name", "slug"]) {
    const value = cleanId(entry[key]);
    if (value) return value;
  }
  return "";
}

function isChatModel(id) {
  return !!id && !NON_CHAT.test(id);
}

function listFrom(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return null;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.models)) return payload.models;
  return null;
}

/**
 * Read a provider model payload. Returns chat models, how many specialist
 * models were skipped and whether the 200-model cap truncated the list.
 */
function parseModelList(payload) {
  const raw = listFrom(payload);
  if (!raw) {
    return {
      models: [],
      skipped: 0,
      truncated: false,
      issue: "The provider's model list was not in a recognised format.",
    };
  }
  const ids = [];
  const seen = new Set();
  for (const entry of raw) {
    const id = entryId(entry);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  if (!ids.length) {
    return {
      models: [],
      skipped: 0,
      truncated: false,
      issue: raw.length ? "The provider's model list did not contain any model names." : "The provider returned an empty model list.",
    };
  }
  const chat = ids.filter(isChatModel);
  const skipped = ids.length - chat.length;
  const models = chat.slice(0, MAX_MODELS);
  if (!models.length) {
    return {
      models: [],
      skipped,
      truncated: false,
      issue: "The provider returned only non-chat models (for example embeddings or speech). No quiz model can be selected from that list.",
    };
  }
  return { models, skipped, truncated: chat.length > MAX_MODELS, issue: "" };
}

/** Keep a saved discovery result bounded and free of specialist models. */
function normalizeModelList(value) {
  const list = Array.isArray(value) ? value : [];
  const out = [];
  const seen = new Set();
  for (const raw of list) {
    const id = cleanId(raw);
    if (!id || seen.has(id) || !isChatModel(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= MAX_MODELS) break;
  }
  return out;
}

module.exports = { MAX_MODELS, isChatModel, normalizeModelList, parseModelList };
