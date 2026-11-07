"use strict";
/*
 * Local plan-then-act for the Study agent.
 *
 * A plan is model output from the existing chat request path: the panel asks
 * for a numbered list, parses it defensively, and shows every step before any
 * of them runs. Steps run one at a time through the same send path, and any
 * write a step asks for still goes through the existing review window. This
 * module is pure: no Obsidian API, no provider call and no file write.
 */
const { str } = require("./util");
const chatMemory = require("./chat-memory");

const MAX_GOAL = 2000;
const MAX_STEPS = 12;
const MAX_STEP = 1200;
const MAX_NOTE = 240;
const MAX_PROMPT = 4000;

const PLAN_SYSTEM = [
  "You write short, ordered action plans for a study assistant.",
  "Return only a numbered list of 3 to 8 steps.",
  "Each step is one short imperative sentence that names the note, card, deck or question it acts on.",
  "Do not add a title, preamble, closing note, code fence or explanation.",
  "If the goal cannot be planned, return exactly NO_PLAN and nothing else.",
].join(" ");

const STEP_STATUSES = ["pending", "approved", "skipped", "running", "done", "declined", "failed"];
const PLAN_STATUSES = ["draft", "running", "paused", "done"];
const STOP_REASONS = ["aborted", "declined", "partial", "error", "refused", "not-approved", "reload"];

/** One line, bounded, with control characters and key-like text removed. */
function cleanText(value, max) {
  return chatMemory
    .redactSecrets(str(value))
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function normalizeGoal(value) {
  return cleanText(value, MAX_GOAL);
}

/** The user turn that asks for a plan; empty for an empty goal. */
function planPrompt(goal) {
  const text = normalizeGoal(goal);
  if (!text) return "";
  return `Goal: ${text}\n\n${PLAN_SYSTEM}\n\nWrite the numbered plan now. Keep it to 3-8 steps.`;
}

function unfence(text) {
  const source = str(text).replace(/\r\n?/g, "\n");
  const match = source.trim().match(/^```[A-Za-z0-9_-]*[ \t]*\n([\s\S]*?)\n?```$/);
  return match ? match[1] : source;
}

/**
 * Numbered lines are the plan. A bullet list is accepted only when there are at
 * least two bullets and no numbered line, so one incidental dash is not a plan.
 * Indented lines continue the previous step; other prose is ignored.
 */
function planLines(text) {
  const numbered = [];
  const bullets = [];
  let current = "";
  for (const line of unfence(text).split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || /^#{1,6}\s/.test(trimmed) || /^[-=_*]{3,}$/.test(trimmed)) {
      current = "";
      continue;
    }
    const step = trimmed.match(/^(?:step\s*)?(\d{1,2})\s*[.):\-\u2013\u2014]\s+(.+)$/i);
    if (step) {
      numbered.push(cleanText(step[2], MAX_STEP));
      current = "numbered";
      if (numbered.length >= MAX_STEPS) return numbered;
      continue;
    }
    const bullet = trimmed.match(/^[-*\u2022]\s+(.+)$/);
    if (bullet) {
      bullets.push(cleanText(bullet[1], MAX_STEP));
      current = "bullet";
      if (bullets.length >= MAX_STEPS) return bullets;
      continue;
    }
    if (/^\s{2,}\S/.test(line) && current === "numbered") {
      numbered[numbered.length - 1] = cleanText(`${numbered[numbered.length - 1]} ${trimmed}`, MAX_STEP);
      continue;
    }
    if (/^\s{2,}\S/.test(line) && current === "bullet") {
      bullets[bullets.length - 1] = cleanText(`${bullets[bullets.length - 1]} ${trimmed}`, MAX_STEP);
      continue;
    }
    current = "";
  }
  if (numbered.length) return numbered;
  if (bullets.length >= 2) return bullets;
  return [];
}

/** Parse a model reply into ordered step strings; never throws. */
function parsePlan(reply) {
  const source = str(reply);
  const steps = planLines(source).map((step) => step.trim()).filter(Boolean);
  if (!steps.length) {
    return { ok: false, reason: /(^|\s)NO_PLAN(\s|$)/i.test(source) ? "none" : "empty", steps: [] };
  }
  return { ok: true, reason: "", steps: steps.slice(0, MAX_STEPS) };
}

function reasonText(reason) {
  if (reason === "none") return "The model declined to plan that goal. Nothing was run.";
  if (reason === "empty") return "The reply did not contain a numbered plan. Nothing was run.";
  if (reason === "refused") return "The request was not sent. Nothing was run.";
  if (reason === "aborted") return "Stopped before a plan came back. Nothing was run.";
  if (reason === "error") return "The plan request failed. Nothing was run.";
  return "No usable plan came back. Nothing was run.";
}

function normalizeStep(raw, index) {
  const item = raw && typeof raw === "object" ? raw : {};
  const text = cleanText(item.text, MAX_STEP);
  if (!text) return null;
  const status = str(item.status).trim();
  return {
    id: `plan-step-${index + 1}`,
    text,
    status: STEP_STATUSES.includes(status) ? status : "pending",
    note: cleanText(item.note, MAX_NOTE),
  };
}

/** Bounded, valid plan state; null when there is no usable step. */
function normalizePlan(value) {
  const raw = value && typeof value === "object" ? value : null;
  if (!raw) return null;
  const steps = [];
  for (const item of Array.isArray(raw.steps) ? raw.steps : []) {
    const step = normalizeStep(item, steps.length);
    if (!step) continue;
    steps.push(step);
    if (steps.length >= MAX_STEPS) break;
  }
  if (!steps.length) return null;
  const status = str(raw.status).trim();
  const stopReason = str(raw.stopReason).trim();
  const createdAt = Number(raw.createdAt);
  const updatedAt = Number(raw.updatedAt);
  const stopStep = Number(raw.stopStep);
  return {
    goal: cleanText(raw.goal, MAX_GOAL),
    status: PLAN_STATUSES.includes(status) ? status : "draft",
    steps,
    createdAt: Number.isFinite(createdAt) && createdAt > 0 ? createdAt : 0,
    updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : 0,
    stopReason: STOP_REASONS.includes(stopReason) ? stopReason : "",
    stopStep: Number.isInteger(stopStep) && stopStep > 0 ? stopStep : 0,
  };
}

/**
 * A plan read back from storage. A run that was interrupted by a reload is not
 * running: it is paused at that step, and the step is approved again so it can
 * be retried rather than reported done.
 */
function restoredPlan(value) {
  const plan = normalizePlan(value);
  if (!plan || plan.status !== "running") return plan;
  let at = plan.stopStep;
  const steps = plan.steps.map((step, index) => {
    if (step.status !== "running") return step;
    if (!at) at = index + 1;
    return { ...step, status: "approved" };
  });
  return { ...plan, status: "paused", stopReason: "reload", stopStep: at, steps };
}

function createPlan(goal, steps, now) {
  const texts = (Array.isArray(steps) ? steps : [])
    .map((step) => cleanText(step, MAX_STEP))
    .filter(Boolean)
    .slice(0, MAX_STEPS);
  if (!texts.length) return null;
  const stamp = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  return {
    goal: normalizeGoal(goal),
    status: "draft",
    steps: texts.map((text, index) => ({ id: `plan-step-${index + 1}`, text, status: "pending", note: "" })),
    createdAt: stamp,
    updatedAt: stamp,
    stopReason: "",
    stopStep: 0,
  };
}

function withStep(plan, index, changes) {
  const p = normalizePlan(plan);
  const at = Number(index);
  if (!p || !Number.isInteger(at) || at < 0 || at >= p.steps.length) return null;
  return normalizePlan({
    ...p,
    steps: p.steps.map((step, i) => (i === at ? { ...step, ...changes } : step)),
    updatedAt: Date.now(),
  });
}

function stepAt(plan, index) {
  const p = normalizePlan(plan);
  const at = Number(index);
  if (!p || !Number.isInteger(at) || at < 0 || at >= p.steps.length) return null;
  return p.steps[at];
}

function approveStep(plan, index) {
  const p = normalizePlan(plan);
  if (!p || p.status === "running") return null;
  const step = stepAt(p, index);
  if (!step || step.status === "running" || step.status === "done") return null;
  return withStep(p, index, { status: "approved", note: "" });
}

function skipStep(plan, index) {
  const p = normalizePlan(plan);
  if (!p || p.status === "running") return null;
  const step = stepAt(p, index);
  if (!step || step.status === "running" || step.status === "done") return null;
  return withStep(p, index, { status: "skipped" });
}

/** Used by the runner while the plan is running, so it has no running guard. */
function markStep(plan, index, status, note) {
  const next = str(status).trim();
  if (!STEP_STATUSES.includes(next)) return null;
  return withStep(plan, index, { status: next, note: note === undefined ? undefined : cleanText(note, MAX_NOTE) });
}

function startPlan(plan) {
  const p = normalizePlan(plan);
  if (!p) return null;
  return normalizePlan({ ...p, status: "running", stopReason: "", stopStep: 0, updatedAt: Date.now() });
}

function pausePlan(plan, reason, stepIndex) {
  const p = normalizePlan(plan);
  if (!p) return null;
  const key = str(reason).trim();
  const at = Number(stepIndex);
  return normalizePlan({
    ...p,
    status: "paused",
    stopReason: STOP_REASONS.includes(key) ? key : "error",
    stopStep: Number.isInteger(at) && at >= 0 ? at + 1 : 0,
    updatedAt: Date.now(),
  });
}

function finishPlan(plan, reason) {
  const p = normalizePlan(plan);
  if (!p) return null;
  const complete = p.steps.every((step) => step.status === "done" || step.status === "skipped");
  if (complete) return normalizePlan({ ...p, status: "done", stopReason: "", stopStep: 0, updatedAt: Date.now() });
  return pausePlan(p, reason || "not-approved", 0);
}

function approvedIndexes(plan) {
  const p = normalizePlan(plan);
  if (!p) return [];
  const rows = [];
  p.steps.forEach((step, index) => {
    if (step.status === "approved") rows.push(index);
  });
  return rows;
}

function progressText(plan) {
  const p = normalizePlan(plan);
  if (!p) return "";
  const done = p.steps.filter((step) => step.status === "done").length;
  const skipped = p.steps.filter((step) => step.status === "skipped").length;
  return `${done} of ${p.steps.length} done${skipped ? `, ${skipped} skipped` : ""}`;
}

function stepStatusLabel(status) {
  if (status === "pending") return "not approved";
  if (status === "approved") return "approved";
  if (status === "skipped") return "skipped";
  if (status === "running") return "running";
  if (status === "done") return "done";
  if (status === "declined") return "declined";
  if (status === "failed") return "failed";
  return str(status);
}

function stopMessage(plan) {
  const p = normalizePlan(plan);
  if (!p) return "";
  const at = p.stopStep ? ` at step ${p.stopStep}` : "";
  if (p.stopReason === "aborted") return `Stopped${at}. No later step was run.`;
  if (p.stopReason === "declined") return `Stopped${at}: the proposed writes were not applied. No later step was run.`;
  if (p.stopReason === "partial") {
    return `Stopped${at}: only some proposed writes were applied and the rest were declined. No later step was run.`;
  }
  if (p.stopReason === "error") return `Stopped${at} after a step failed. No later step was run.`;
  if (p.stopReason === "refused") return `Stopped${at} because the request could not be sent. No later step was run.`;
  if (p.stopReason === "reload") return "The plan was paused when the plugin reloaded. Approve any remaining steps and run them again.";
  if (p.stopReason === "not-approved") {
    const pending = p.steps.filter((step) => step.status === "pending").length;
    if (!pending) return "Plan complete.";
    return `Finished the approved steps. ${pending} step${pending === 1 ? " was" : "s were"} not approved, so ${
      pending === 1 ? "it was" : "they were"
    } not run.`;
  }
  return p.status === "done" ? "Plan complete." : "";
}

/** The next user turn: one step only, with the goal as context. */
function stepPrompt(plan, index) {
  const p = normalizePlan(plan);
  const at = Number(index);
  if (!p || !Number.isInteger(at) || at < 0 || at >= p.steps.length) return "";
  const goal = p.goal ? `Plan goal: ${p.goal}\n` : "";
  const text = `${goal}Run only step ${at + 1} of ${p.steps.length}: ${p.steps[at].text}\n\nDo only this step. Do not start or describe the other steps. If this step needs a file change, use an allow-listed action so I can review it first.`;
  return text.slice(0, MAX_PROMPT);
}

module.exports = {
  MAX_GOAL,
  MAX_NOTE,
  MAX_PROMPT,
  MAX_STEP,
  MAX_STEPS,
  PLAN_SYSTEM,
  PLAN_STATUSES,
  STEP_STATUSES,
  approveStep,
  approvedIndexes,
  createPlan,
  finishPlan,
  markStep,
  normalizeGoal,
  normalizePlan,
  parsePlan,
  pausePlan,
  planPrompt,
  progressText,
  reasonText,
  restoredPlan,
  skipStep,
  startPlan,
  stepAt,
  stepPrompt,
  stepStatusLabel,
  stopMessage,
};
