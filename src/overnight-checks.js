"use strict";
/* Overnight answer checking: every created note gets its blind check in a
 * second pass, a few at a time, with rate-limit backoff and a budget pause
 * instead of a failure. A sleep or reload resumes from the saved queue. */
const { localDate, sleep, str } = require("./util");
const { addVerificationBanner, verificationFields } = require("./answer-verification");
const { findAnswerKey } = require("./notes");
const { parseNote } = require("./importer");

/** A wall-clock gap that means the computer slept: re-probe before judging anything frozen. */
const WAKE_GAP_MS = 6 * 60 * 1000;
/** A rate limit waits instead of failing: at most this many tries per note. */
const MAX_BACKOFF_ATTEMPTS = 8;

function checkConcurrency(ai) {
  const raw = ai == null ? NaN : Number(ai.checkConcurrency);
  if (!Number.isFinite(raw)) return 2;
  return Math.max(1, Math.min(4, Math.round(raw)));
}

function normalizeConcurrency(value) {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return 2;
  return Math.max(1, Math.min(4, Math.round(raw)));
}

function isCapMessage(message) {
  return /request cap|no more AI requests|raise the cap/i.test(str(message));
}

function isRateLimitMessage(message) {
  return /429|rate limit|rate-limited|RESOURCE_EXHAUSTED|quota exceeded|exceeded.{0,20}quota|too many requests/i.test(str(message));
}

/** Seconds the provider asks to wait, else a backoff from `baseMs` with jitter. */
function retryAfterMs(message, attempt, baseMs) {
  const base = Number(baseMs) > 0 ? Number(baseMs) : 10000;
  const text = str(message);
  const seconds = /retry(?:-| )after\D{0,10}(\d+)s?/i.exec(text) || /try again in (\d+)\s*(second|minute)/i.exec(text);
  if (seconds) {
    const n = Number(seconds[1]);
    const scale = /minute/i.test(seconds[0]) ? 60 : 1;
    if (Number.isFinite(n) && n > 0) return Math.min(5 * 60 * 1000, n * scale * 1000);
  }
  const grown = Math.min(5 * 60 * 1000, base * Math.pow(2, Math.max(0, attempt)));
  return Math.round(grown * (0.7 + Math.random() * 0.6));
}

function medianMs(values) {
  const sorted = (Array.isArray(values) ? values : []).filter((n) => Number.isFinite(n) && n >= 0).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function etaLabel(remaining, median) {
  if (!(remaining > 0) || !(median > 0)) return "";
  const ms = remaining * median;
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return "under a minute";
  if (minutes < 60) return `about ${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `about ${hours} hour${hours === 1 ? "" : "s"}${rest ? ` ${rest} min` : ""}`;
}

async function interruptibleSleep(ms, shouldStop) {
  const end = Date.now() + Math.max(0, Number(ms) || 0);
  while (Date.now() < end) {
    if (typeof shouldStop === "function" && shouldStop()) return false;
    await sleep(Math.min(1000, Math.max(0, end - Date.now())));
  }
  return !(typeof shouldStop === "function" && shouldStop());
}

/** Read one written note back into the blind-check draft the import would have asked. */
function draftForNote(text) {
  let parsed = null;
  try {
    parsed = parseNote(str(text));
  } catch (e) {
    return null;
  }
  const sec = (parsed && parsed.sec) || {};
  const fm = (parsed && parsed.fm) || {};
  const key = str(findAnswerKey(fm, sec)).trim();
  if (!key || !str(sec.question).trim()) return null;
  return { question: sec.question, choices: Array.isArray(sec.choices) ? sec.choices : [], answer: key };
}

/** Write one verdict back to its note: frontmatter fields, a needs-review flag and the visible banner. */
async function writeCheckResult(plugin, file, text, verification) {
  await plugin.app.fileManager.processFrontMatter(file, (data) => {
    Object.assign(data, verificationFields(verification));
    delete data.answer_verified;
    delete data.answer_verified_on;
    delete data.answer_verified_model;
    delete data.answer_verification;
    if (!verification.match) data.needs_review = true;
    else if (data.needs_review === true && verification.status === "match") delete data.needs_review;
  });
  await plugin.app.vault.modify(file, addVerificationBanner(str(text), verification));
}

/**
 * Check every note at `paths`, two at a time by default, and write each
 * verdict back to its frontmatter. A rate limit waits and retries; a spent
 * request cap pauses the whole queue with { paused } so a later run resumes
 * it. Results carry per-note timings for the morning log.
 */
async function runCheckQueue(plugin, paths, opts) {
  const o = opts || {};
  const list = (Array.isArray(paths) ? paths : []).filter(Boolean);
  const shouldStop = typeof o.shouldStop === "function" ? o.shouldStop : null;
  const onNotice = typeof o.onNotice === "function" ? o.onNotice : () => {};
  const onProgress = typeof o.onProgress === "function" ? o.onProgress : null;
  const onItem = typeof o.onItem === "function" ? o.onItem : null;
  const onWakeGap = typeof o.onWakeGap === "function" ? o.onWakeGap : null;
  const wakeGapMs = Number(o.wakeGapMs) > 0 ? Number(o.wakeGapMs) : WAKE_GAP_MS;
  const retryBaseMs = Number(o.retryBaseMs) > 0 ? Number(o.retryBaseMs) : 10000;
  const slots = Math.max(1, Math.min(4, Math.floor(Number(o.concurrency) > 0 ? Number(o.concurrency) : checkConcurrency(plugin.settings && plugin.settings.ai))));
  const results = [];
  const timings = [];
  let nextIndex = 0;
  let completed = 0;
  let paused = null;
  let stopped = false;
  let lastBeat = Date.now();

  const checkOnePath = async (path) => {
    const file = plugin.app.vault.getAbstractFileByPath(path);
    if (!file) return { path, status: "missing", ms: 0 };
    const started = Date.now();
    let text = "";
    try {
      text = await plugin.app.vault.cachedRead(file);
    } catch (e) {
      return { path, status: "error", ms: Date.now() - started, error: str(e && e.message ? e.message : e) };
    }
    const draft = draftForNote(text);
    if (!draft) {
      return { path, status: "skipped", ms: Date.now() - started, error: "This note has no stored answer to check." };
    }
    const drafts = [draft];
    for (let attempt = 0; attempt < MAX_BACKOFF_ATTEMPTS; attempt++) {
      if (shouldStop && shouldStop()) return { path, status: "stopped", ms: Date.now() - started };
      await plugin.verifyDraftQuestions(drafts, {
        shouldStop,
        onNotice,
        concurrency: 1,
      });
      const current = drafts[0].verification || null;
      const problem = current && current.status === "error" ? str(current.error) : "";
      if (problem && isCapMessage(problem)) return { path, status: "paused", ms: Date.now() - started, error: problem };
      if (problem && isRateLimitMessage(problem) && attempt + 1 < MAX_BACKOFF_ATTEMPTS) {
        onNotice(`The provider is rate limited, so this check waits before trying again (note ${completed + 1} of ${list.length})...`);
        const ok = await interruptibleSleep(retryAfterMs(problem, attempt, retryBaseMs), shouldStop);
        if (!ok) return { path, status: "stopped", ms: Date.now() - started };
        continue;
      }
      break;
    }
    const done = drafts[0].verification || null;
    if (!done) {
      if (shouldStop && shouldStop()) {
        stopped = true;
        return { path, status: "stopped", ms: Date.now() - started };
      }
      return { path, status: "error", ms: Date.now() - started, error: "The check returned nothing." };
    }
    if (done.status === "error") {
      if (isCapMessage(done.error)) return { path, status: "paused", ms: Date.now() - started, error: str(done.error) };
      return { path, status: "error", ms: Date.now() - started, error: str(done.error) };
    }
    try {
      await writeCheckResult(plugin, file, text, done);
    } catch (e) {
      return { path, status: "error", ms: Date.now() - started, error: str(e && e.message ? e.message : e) };
    }
    return { path, status: done.status, ms: Date.now() - started, verification: done };
  };

  const worker = async () => {
    for (;;) {
      if (paused) return;
      if (shouldStop && shouldStop()) {
        if (nextIndex < list.length) stopped = true;
        return;
      }
      if (Date.now() - lastBeat > wakeGapMs) {
        const gap = Date.now() - lastBeat;
        lastBeat = Date.now();
        if (onWakeGap) await onWakeGap(gap);
      }
      const index = nextIndex++;
      if (index >= list.length) return;
      const outcome = await checkOnePath(list[index]);
      const beat = Date.now();
      if (onWakeGap && outcome.ms > wakeGapMs && outcome.status !== "stopped") await onWakeGap(outcome.ms);
      lastBeat = beat;
      if (outcome.status === "paused") {
        paused = outcome;
        results[index] = outcome;
        completed++;
        if (onProgress) onProgress(completed, list.length, list[index]);
        return;
      }
      results[index] = outcome;
      if (outcome.status !== "stopped" && outcome.status !== "missing" && outcome.status !== "skipped") timings.push(outcome.ms);
      completed++;
      if (onItem) {
        try {
          onItem({ path: list[index], index, outcome });
        } catch (e) {
          /* progress hooks must not fail a check */
        }
      }
      if (onProgress) onProgress(completed, list.length, list[index]);
    }
  };

  await Promise.all(Array.from({ length: Math.min(slots, Math.max(list.length, 1)) }, () => worker()));
  const summary = { checked: 0, matched: 0, mismatched: 0, errored: 0, skipped: 0, stopped, paused: null, medianMs: medianMs(timings) };
  for (const outcome of results) {
    if (!outcome) continue;
    if (outcome.status === "match") {
      summary.checked++;
      summary.matched++;
    } else if (outcome.status === "mismatch") {
      summary.checked++;
      summary.mismatched++;
    } else if (outcome.status === "error") {
      summary.checked++;
      summary.errored++;
    } else if (outcome.status === "skipped" || outcome.status === "missing") {
      summary.skipped++;
    } else if (outcome.status === "stopped") {
      summary.stopped = true;
      stopped = true;
    } else if (outcome.status === "paused") {
      summary.paused = outcome;
    }
  }
  return { results, summary };
}

module.exports = {
  WAKE_GAP_MS,
  MAX_BACKOFF_ATTEMPTS,
  checkConcurrency,
  normalizeConcurrency,
  isCapMessage,
  isRateLimitMessage,
  retryAfterMs,
  medianMs,
  etaLabel,
  runCheckQueue,
};
