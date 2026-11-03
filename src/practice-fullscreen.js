"use strict";
/*
 * Distraction-free practice chrome.
 *
 * The plugin adds one body class only while the active practice view is showing
 * a question or a result. The stylesheet uses body.is-mobile plus that class to
 * hide Obsidian's view header and mobile navbar. The class is removed on close,
 * unload, setting off, active-leaf change and any return to the idle screen.
 */
const PRACTICE_FULLSCREEN_CLASS = "mcq-practice-mode";
const PRACTICE_ACTIVE_STATES = new Set(["question", "result"]);

function practiceSessionActive(state) {
  return PRACTICE_ACTIVE_STATES.has(String(state || ""));
}

/** The real document body, with the test/active-document fallbacks Obsidian uses. */
function documentBody(doc) {
  if (doc && doc.body) return doc.body;
  if (typeof activeDocument !== "undefined" && activeDocument && activeDocument.body) return activeDocument.body;
  if (typeof document !== "undefined" && document && document.body) return document.body;
  return null;
}

function isMobileDocument(doc) {
  const body = documentBody(doc);
  return !!(body && body.classList && typeof body.classList.contains === "function" && body.classList.contains("is-mobile"));
}

/** The setting is on by default; only an explicit false turns the mode off. */
function shouldHidePracticeChrome(options) {
  const opts = options || {};
  return opts.enabled !== false && opts.isMobile === true && opts.active === true;
}

/** Idempotent: adding or removing the class twice is safe. */
function setPracticeFullscreen(doc, on) {
  const body = documentBody(doc);
  if (!body || !body.classList || typeof body.classList.toggle !== "function") return false;
  body.classList.toggle(PRACTICE_FULLSCREEN_CLASS, !!on);
  return !!on;
}

module.exports = {
  PRACTICE_FULLSCREEN_CLASS,
  documentBody,
  isMobileDocument,
  practiceSessionActive,
  setPracticeFullscreen,
  shouldHidePracticeChrome,
};
