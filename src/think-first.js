"use strict";

/** Conservative chat nudge: short enough for normal use, long enough to interrupt autopilot. */
const DEFAULT_THINK_FIRST_SECONDS = 15;
const MIN_THINK_FIRST_SECONDS = 5;
const MAX_THINK_FIRST_SECONDS = 120;

/** Keep a saved threshold usable even if data.json was edited or came from an older build. */
function normalizeThinkFirstSeconds(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_THINK_FIRST_SECONDS;
  return Math.min(MAX_THINK_FIRST_SECONDS, Math.max(MIN_THINK_FIRST_SECONDS, n));
}

/** Milliseconds left in a countdown that began at `startedAt`; 0 when there is no start. */
function thinkFirstRemainingMs(startedAt, seconds, now) {
  const start = Number(startedAt);
  if (!Number.isFinite(start) || start <= 0) return 0;
  const current = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  const elapsed = Math.max(0, current - start);
  return Math.max(0, normalizeThinkFirstSeconds(seconds) * 1000 - elapsed);
}

function thinkFirstLabel(remainingMs) {
  const seconds = Math.max(0, Math.ceil(Number(remainingMs) / 1000));
  return seconds > 0 ? `Think first · ${seconds}s` : "";
}

module.exports = {
  DEFAULT_THINK_FIRST_SECONDS,
  MIN_THINK_FIRST_SECONDS,
  MAX_THINK_FIRST_SECONDS,
  normalizeThinkFirstSeconds,
  thinkFirstRemainingMs,
  thinkFirstLabel,
};
