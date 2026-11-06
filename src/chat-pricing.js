"use strict";
/*
 * Local cost estimates. Pricing is entered by the user in settings as USD per
 * one million tokens; this module never fetches a price list. An unknown model
 * simply has no estimate, so the footer stays quiet.
 */
const { str } = require("./util");
const chatBudget = require("./chat-budget");

const MAX_MODELS = 100;
const MAX_HISTORY_MESSAGES = 80;
const MAX_PRICE = 100000;
const MAX_MODEL_CHARS = 200;

function price(value) {
  const text = str(value).replace(/[$,\s]/g, "");
  if (text === "") return null;
  const number = Number(text);
  if (!Number.isFinite(number) || number < 0 || number > MAX_PRICE) return null;
  return number;
}

function modelKey(value) {
  return str(value).trim().toLowerCase().slice(0, MAX_MODEL_CHARS);
}

/** `model | USD per 1M input | USD per 1M output`, one line per model. */
function parsePricingText(text) {
  const out = {};
  let count = 0;
  for (const line of str(text).split(/\r?\n/)) {
    const clean = line.trim();
    if (!clean || clean.startsWith("#") || count >= MAX_MODELS) continue;
    const parts = clean.split("|").map((part) => part.trim());
    if (parts.length !== 3 || !parts[0]) continue;
    const input = price(parts[1]);
    const output = price(parts[2]);
    if (input === null || output === null || (input === 0 && output === 0)) continue;
    const key = modelKey(parts[0]);
    if (!key) continue;
    out[key] = { model: parts[0].slice(0, MAX_MODEL_CHARS), input, output };
    count += 1;
  }
  return out;
}

function pricingText(value) {
  if (!value || typeof value !== "object") return "";
  return Object.keys(value)
    .sort()
    .map((key) => {
      const row = value[key] || {};
      return `${str(row.model || key).trim()} | ${Number(row.input) || 0} | ${Number(row.output) || 0}`;
    })
    .join("\n");
}

function findPricing(value, model) {
  if (!value || typeof value !== "object") return null;
  const key = modelKey(model);
  if (!key) return null;
  if (value[key] && typeof value[key] === "object") return value[key];
  for (const candidate of Object.keys(value)) {
    if (candidate.toLowerCase() === key && value[candidate] && typeof value[candidate] === "object") return value[candidate];
  }
  return null;
}

/** Estimate a single request; the output side is the configured reply cap. */
function estimateCost(value, model, inputTokens, outputTokens) {
  const row = findPricing(value, model);
  if (!row) return { ok: false, reason: "no pricing for this model" };
  const input = Math.max(0, Number(inputTokens) || 0);
  const output = Math.max(0, Number(outputTokens) || 0);
  const inputPrice = Math.max(0, Number(row.input) || 0);
  const outputPrice = Math.max(0, Number(row.output) || 0);
  if (inputPrice === 0 && outputPrice === 0) return { ok: false, reason: "pricing is zero" };
  const inputCost = (input / 1000000) * inputPrice;
  const outputCost = (output / 1000000) * outputPrice;
  return {
    ok: true,
    model: str(row.model || model),
    inputTokens: input,
    outputTokens: output,
    inputPerMillion: inputPrice,
    outputPerMillion: outputPrice,
    inputCost,
    outputCost,
    total: inputCost + outputCost,
  };
}

/**
 * Estimate a whole conversation from its stored messages. Each user turn is
 * treated as a prompt that resends the prior transcript, and each assistant
 * message is treated as output. `baseTokens` covers the system/context text the
 * caller already estimated. Pure arithmetic over the local price table.
 */
function estimateConversationCost(value, model, messages, options) {
  const row = findPricing(value, model);
  if (!row) return { ok: false, reason: "no pricing for this model" };
  const inputPrice = Math.max(0, Number(row.input) || 0);
  const outputPrice = Math.max(0, Number(row.output) || 0);
  if (inputPrice === 0 && outputPrice === 0) return { ok: false, reason: "pricing is zero" };
  const list = (Array.isArray(messages) ? messages : [])
    .filter(
      (message) =>
        message &&
        (message.role === "user" || message.role === "assistant") &&
        str(message.content).trim()
    )
    .slice(-MAX_HISTORY_MESSAGES);
  if (!list.length) return { ok: false, reason: "no messages yet" };
  const opts = options && typeof options === "object" ? options : {};
  let context = Math.max(0, Number(opts.baseTokens) || 0);
  let inputTokens = 0;
  let outputTokens = 0;
  let turns = 0;
  for (const message of list) {
    const tokens = chatBudget.estimateTokens(message.content);
    if (message.role === "assistant") {
      outputTokens += tokens;
      context += tokens;
    } else {
      inputTokens += context + tokens;
      context += tokens;
      turns += 1;
    }
  }
  const inputCost = (inputTokens / 1000000) * inputPrice;
  const outputCost = (outputTokens / 1000000) * outputPrice;
  return {
    ok: true,
    model: str(row.model || model),
    turns,
    inputTokens,
    outputTokens,
    inputPerMillion: inputPrice,
    outputPerMillion: outputPrice,
    inputCost,
    outputCost,
    total: inputCost + outputCost,
  };
}

function formatUsd(value) {
  const number = Math.max(0, Number(value) || 0);
  if (number === 0) return "$0.0000";
  if (number < 0.01) return `$${number.toFixed(4)}`;
  if (number < 1) return `$${number.toFixed(3)}`;
  return `$${number.toFixed(2)}`;
}

module.exports = {
  MAX_MODELS,
  estimateConversationCost,
  estimateCost,
  findPricing,
  formatUsd,
  modelKey,
  parsePricingText,
  pricingText,
};
