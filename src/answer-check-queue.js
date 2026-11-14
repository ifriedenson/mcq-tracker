"use strict";
/*
 * The verification pass: every question note with a stored answer but no
 * verdict gets its blind check, a few at a time, with frontmatter-only
 * write-back. Tracking properties are never touched; a spent request cap
 * pauses the pass instead of failing it.
 */
const { str } = require("./util");
const { findAnswerKey, parseSections } = require("./notes");
const { etaLabel, runCheckQueue } = require("./overnight-checks");
const { latestOvernightRun } = require("./overnight-run");

const CHECKED_VERDICTS = ["match", "mismatch", "review"];

/** Notes that read as questions, have a stored answer, and were never judged. */
async function findUncheckedNotes(plugin) {
  const vault = plugin && plugin.app && plugin.app.vault;
  if (!vault || typeof vault.getMarkdownFiles !== "function") return [];
  const found = [];
  for (const file of vault.getMarkdownFiles()) {
    if (!file || !/\.md$/i.test(file.path || "")) continue;
    let fm = {};
    try {
      const cache = plugin.app.metadataCache && typeof plugin.app.metadataCache.getFileCache === "function"
        ? plugin.app.metadataCache.getFileCache(file)
        : null;
      fm = (cache && cache.frontmatter) || file.fm || {};
    } catch (e) {
      fm = file.fm || {};
    }
    if (fm.question_id === undefined || fm.question_id === null || fm.question_id === "") continue;
    if (fm.verified === true) continue;
    let text = "";
    try {
      text = await vault.cachedRead(file);
    } catch (e) {
      continue;
    }
    let key = "";
    try {
      key = str(findAnswerKey(fm, parseSections(str(text)))).trim();
    } catch (e) {
      key = "";
    }
    if (!key) continue;
    if (CHECKED_VERDICTS.includes(str(fm.verification))) continue;
    found.push({ path: file.path, file });
  }
  return found;
}

/** Check every note without a verdict and write each one back to frontmatter. */
async function checkUncheckedNotes(plugin, opts) {
  const o = opts || {};
  const found = await findUncheckedNotes(plugin);
  const paths = found.map((entry) => entry.path);
  const outcome = await runCheckQueue(plugin, paths, {
    concurrency: o.concurrency,
    shouldStop: o.shouldStop,
    onProgress: o.onProgress,
    onNotice: o.onNotice,
    onItem: o.onItem,
    onWakeGap: o.onWakeGap,
    wakeGapMs: o.wakeGapMs,
    retryBaseMs: o.retryBaseMs,
  });
  return { notes: paths, results: outcome.results, summary: outcome.summary };
}

/** The per-check pace stored by the last finished run, or 0 when unknown. */
function storedCheckMedianMs(app) {
  const run = latestOvernightRun(app);
  const ms = Number(run && run.checkMedianMs);
  return Number.isFinite(ms) && ms > 0 ? Math.round(ms) : 0;
}

/** How long a queue of unchecked notes should take at the stored pace. */
function checkEta(count, medianMs) {
  return etaLabel(count, medianMs);
}

module.exports = {
  findUncheckedNotes,
  checkUncheckedNotes,
  storedCheckMedianMs,
  checkEta,
};
