"use strict";
/*
 * Local correct/incorrect tally counters for a `tally` block. The block is a
 * small practice aid: it never writes a note, result, card or scheduler row.
 * State is kept by source path + block id/content so a reload keeps the
 * current session.
 */
const { hashString, str } = require("./util");

const MAX_SESSIONS = 300;
const MAX_COUNT = 1000000;
const MAX_STEP = 100;
const MAX_STEPS = 6;
const MAX_LABEL = 40;
const DEFAULT_STEPS = [1, 2, 5];
const DEFAULT_STEP = 1;

function clampInt(value, low, high) {
  const n = Math.round(Number(value) || 0);
  return Math.max(low, Math.min(high, n));
}

function cleanLabel(value, fallback) {
  const text = str(value).replace(/\s+/g, " ").trim().slice(0, MAX_LABEL);
  return text || fallback;
}

function parseStep(value, issues, lineNo, key) {
  const number = Number(str(value).trim());
  if (!Number.isInteger(number) || number < 1 || number > MAX_STEP) {
    issues.push(`Line ${lineNo}: ${key} must be a whole number from 1 to ${MAX_STEP}.`);
    return null;
  }
  return number;
}

/** Parse the optional `key: value` header. Labels are plain text, never HTML. */
function parseTallyBlock(source) {
  const parsed = {
    title: "Tally",
    correct: "Correct",
    incorrect: "Incorrect",
    steps: DEFAULT_STEPS.slice(),
    step: DEFAULT_STEP,
    id: "",
    issues: [],
    valid: true,
  };
  const lines = str(source).replace(/\r\n?/g, "\n").split("\n");
  let explicitSteps = null;
  let explicitStep = null;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    const lineNo = index + 1;
    if (!line || line.startsWith("//")) continue;
    const match = line.match(/^([A-Za-z][A-Za-z-]*)\s*:\s*(.*)$/);
    if (!match) {
      parsed.issues.push(`Line ${lineNo}: use "key: value", or remove this line.`);
      continue;
    }
    const key = match[1].toLowerCase();
    const value = match[2].trim();
    if (key === "title") {
      parsed.title = cleanLabel(value, "Tally");
      if (!value) parsed.issues.push(`Line ${lineNo}: title cannot be empty.`);
    } else if (key === "correct") {
      parsed.correct = cleanLabel(value, "Correct");
      if (!value) parsed.issues.push(`Line ${lineNo}: correct label cannot be empty.`);
    } else if (key === "incorrect") {
      parsed.incorrect = cleanLabel(value, "Incorrect");
      if (!value) parsed.issues.push(`Line ${lineNo}: incorrect label cannot be empty.`);
    } else if (key === "step") {
      explicitStep = parseStep(value, parsed.issues, lineNo, "step");
    } else if (key === "steps") {
      const values = value.split(/[,\s]+/).filter(Boolean);
      const steps = [];
      for (const item of values) {
        const step = parseStep(item, parsed.issues, lineNo, "steps");
        if (step !== null && !steps.includes(step)) steps.push(step);
      }
      if (!steps.length) parsed.issues.push(`Line ${lineNo}: add at least one step from 1 to ${MAX_STEP}.`);
      else if (steps.length > MAX_STEPS) {
        parsed.issues.push(`Line ${lineNo}: use at most ${MAX_STEPS} step sizes.`);
        explicitSteps = steps.slice(0, MAX_STEPS);
      } else explicitSteps = steps;
    } else if (key === "id") {
      parsed.id = str(value).trim().slice(0, 80);
      if (!parsed.id) parsed.issues.push(`Line ${lineNo}: id cannot be empty.`);
    } else {
      parsed.issues.push(`Line ${lineNo}: "${match[1]}" is not a tally setting. Use title, correct, incorrect, step, steps or id.`);
    }
  }
  if (explicitSteps && explicitSteps.length) parsed.steps = explicitSteps;
  if (explicitStep !== null) {
    if (!parsed.steps.includes(explicitStep)) {
      if (parsed.steps.length >= MAX_STEPS) parsed.issues.push(`Add at most ${MAX_STEPS} step sizes, including the default step.`);
      else parsed.steps.push(explicitStep);
    }
    parsed.step = explicitStep;
  }
  if (!parsed.steps.includes(parsed.step)) parsed.step = parsed.steps[0];
  parsed.valid = parsed.issues.length === 0;
  return parsed;
}

function normalizeTallySettings(value) {
  const src = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const source = src.sessions && typeof src.sessions === "object" && !Array.isArray(src.sessions) ? src.sessions : {};
  const sessions = {};
  const keys = Object.keys(source).slice(-MAX_SESSIONS);
  for (const key of keys) {
    const raw = source[key];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    sessions[key] = normalizeTallyState(raw, { steps: DEFAULT_STEPS, step: DEFAULT_STEP });
  }
  return { sessions };
}

function normalizeTallyState(value, options) {
  const src = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const parsed = options && typeof options === "object" ? options : {};
  const steps = Array.isArray(parsed.steps) && parsed.steps.length ? parsed.steps.filter((step) => Number.isInteger(step) && step >= 1 && step <= MAX_STEP) : DEFAULT_STEPS;
  const requestedStep = clampInt(src.step, 1, MAX_STEP);
  const step = steps.includes(requestedStep) ? requestedStep : steps.includes(parsed.step) ? parsed.step : steps[0] || DEFAULT_STEP;
  return {
    correct: clampInt(src.correct, 0, MAX_COUNT),
    incorrect: clampInt(src.incorrect, 0, MAX_COUNT),
    step,
    startedAt: Math.max(0, Math.round(Number(src.startedAt) || 0)),
    updated: Math.max(0, Math.round(Number(src.updated) || 0)),
  };
}

function tallyKey(sourcePath, source, id) {
  const stable = str(id).trim() ? `id:${str(id).trim()}` : `src:${str(source).replace(/\r\n?/g, "\n").trim()}`;
  return `tl-${hashString(`${str(sourcePath) || "note"}|${stable}`)}`;
}

function recordTally(state, kind, now, options) {
  const next = normalizeTallyState(state, options);
  const at = Math.max(0, Math.round(Number(now) || Date.now()));
  if (!next.startedAt) next.startedAt = at;
  if (kind === "correct") next.correct = Math.min(MAX_COUNT, next.correct + next.step);
  else if (kind === "incorrect") next.incorrect = Math.min(MAX_COUNT, next.incorrect + next.step);
  next.updated = at;
  return next;
}

function resetTally(state, options) {
  const next = normalizeTallyState(state, options);
  return { correct: 0, incorrect: 0, step: next.step, startedAt: 0, updated: 0 };
}

function setTallyStep(state, step, options) {
  const next = normalizeTallyState(state, options);
  next.step = clampInt(step, 1, MAX_STEP);
  return next;
}

function tallyStats(state, now) {
  const src = state && typeof state === "object" ? state : {};
  const correct = Math.max(0, Math.round(Number(src.correct) || 0));
  const incorrect = Math.max(0, Math.round(Number(src.incorrect) || 0));
  const total = correct + incorrect;
  const startedAt = Math.max(0, Math.round(Number(src.startedAt) || 0));
  const at = Math.max(0, Math.round(Number(now) || Date.now()));
  const elapsedMs = startedAt ? Math.max(0, at - startedAt) : 0;
  const seconds = elapsedMs / 1000;
  return {
    correct,
    incorrect,
    total,
    accuracy: total ? correct / total : null,
    elapsedMs,
    cps: seconds >= 1 ? total / seconds : 0,
    perMinute: seconds >= 1 ? (total / seconds) * 60 : 0,
  };
}

function formatTallyClock(ms) {
  const seconds = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

function tallySettings(plugin) {
  if (!plugin.settings.tallies || typeof plugin.settings.tallies !== "object" || Array.isArray(plugin.settings.tallies)) {
    plugin.settings.tallies = { sessions: {} };
  }
  if (!plugin.settings.tallies.sessions || typeof plugin.settings.tallies.sessions !== "object" || Array.isArray(plugin.settings.tallies.sessions)) {
    plugin.settings.tallies.sessions = {};
  }
  return plugin.settings.tallies;
}

module.exports = {
  DEFAULT_STEPS,
  MAX_COUNT,
  MAX_LABEL,
  MAX_SESSIONS,
  MAX_STEP,
  formatTallyClock,
  normalizeTallySettings,
  normalizeTallyState,
  parseTallyBlock,
  recordTally,
  resetTally,
  setTallyStep,
  tallyKey,
  tallySettings,
  tallyStats,
};
