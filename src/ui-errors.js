"use strict";
/*
 * One safety net for click handlers.
 *
 * Almost every button in this plugin is `async`, and most of them call a plugin
 * method without a try/catch: if that method throws, the browser reports an
 * unhandled rejection, the click appears to do nothing, and the user is left
 * with a dead control and no explanation. Rather than wrap 160 handlers, the
 * plugin listens for `unhandledrejection` once and reports it here, so a failure
 * is always visible.
 *
 * The same message inside the repeat window is dropped: a button that fails on
 * every click must not fill the screen with notices.
 */
const { Notice } = require("obsidian");

const REPEAT_MS = 10000;
const MESSAGE_LIMIT = 180;

/** The one-line message shown when an async action fails outside a try/catch. */
function rejectionMessage(reason) {
  let raw = reason && (reason.message || reason);
  // A rejection reason can be anything: an Error, a string, or a plain object
  // with no message. Only text is worth showing; "[object Object]" is noise.
  if (typeof raw !== "string" && typeof raw !== "number") raw = "";
  const text = String(raw)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MESSAGE_LIMIT);
  return `MCQ Tracker hit an error: ${text || "unknown error"}. Try again; if it keeps happening, send feedback from Settings, About.`;
}

/**
 * Build the reporter. `notice` and `now` are injectable so the throttle can be
 * tested without a clock or a screen.
 */
function makeRejectionReporter(options) {
  const opts = options || {};
  const show = opts.notice || ((message, ms) => new Notice(message, ms));
  const now = opts.now || (() => Date.now());
  let lastText = "";
  let lastAt = 0;
  return function report(reason) {
    const text = rejectionMessage(reason);
    const at = now();
    if (text === lastText && at - lastAt < REPEAT_MS) return "";
    lastText = text;
    lastAt = at;
    show(text, 8000);
    return text;
  };
}

module.exports = { MESSAGE_LIMIT, REPEAT_MS, makeRejectionReporter, rejectionMessage };
