"use strict";
/* Bundled release notes and per-device "already seen" state. No network, no vault notes. */
const { loadWelcomeState } = require("./welcome");

const WHATS_NEW_STORAGE_KEY = "mcqTrackerWhatsNew";

const RELEASES = [
  {
    version: "1.297.0",
    date: "November 9, 2026",
    title: "A first import anyone can finish",
    summary:
      "The PDF path now says it needs AI, offers an offline paste route beside it, and walks a first-time user from a recommended provider to a tested model without ever guessing a model name.",
    highlights: [
      {
        title: "The AI step is labelled",
        body: "The empty screen and Practice now say Import files (needs AI). Paste questions instead (works offline) sits beside it and opens Quick add, which needs no key.",
      },
      {
        title: "Three steps to a working connection",
        body: "A recommended provider is preselected, Create a key opens that provider's key page, and Fetch models chooses a sensible model from the provider's own list so the field is never empty.",
      },
      {
        title: "Tested before the import",
        body: "Test connection sends one short request and explains a rejected key, an empty model list or an offline device. Continue stays disabled until the setup actually works.",
      },
      {
        title: "One implementation everywhere",
        body: "The inline wizard and Settings share the same model fetch and connection test, so a setup that works in one place works in the other.",
      },
      {
        title: "Start here names the offline route",
        body: "Where the guide used to say write a note by hand, it now points at Quick add questions from pasted text, which works with AI off.",
      },
    ],
  },
  {
    version: "1.296.0",
    date: "November 9, 2026",
    title: "A simpler start",
    summary:
      "The everyday path is shorter: fewer settings to scan, Import at the top of Practice, and the less-used practice actions out of the way until you need them.",
    highlights: [
      {
        title: "Simple settings",
        body: "New installs start with Practice, review, the Study agent and app settings. Show all settings reveals every specialist page and remembers the choice.",
      },
      {
        title: "Import is at the top",
        body: "Import questions now sits above the practice filters. If AI is not set up, it goes straight to the setup screen instead of hiding the button.",
      },
      {
        title: "Everyday actions stay clear",
        body: "Skip, mark known, bury, suspend and exclude moved under More actions. Confidence and Submit remain the obvious next step.",
      },
      {
        title: "Import details on request",
        body: "Course, unit, skill and other note properties wait behind Add details. Importing into an existing folder now adds questions instead of stopping.",
      },
      {
        title: "Clearer confidence labels",
        body: "The default middle choice is now Probably Right, so Guessing, Probably Right and Confident read as one scale. Custom labels are unchanged.",
      },
    ],
  },
];

function cleanVersion(value) {
  const text = String(value || "")
    .trim()
    .replace(/^v/i, "");
  return /^\d+\.\d+\.\d+$/.test(text) ? text : "";
}

function normalizeWhatsNewState(value) {
  let src = value;
  if (typeof src === "string") {
    try {
      src = JSON.parse(src);
    } catch (e) {
      src = null;
    }
  }
  if (!src || typeof src !== "object") return { seenVersion: "", seenAt: "" };
  return {
    seenVersion: cleanVersion(src.seenVersion),
    seenAt: typeof src.seenAt === "string" ? src.seenAt : "",
  };
}

function releaseFor(version) {
  const wanted = cleanVersion(version);
  if (!wanted) return null;
  return RELEASES.find((release) => release.version === wanted) || null;
}

function latestRelease() {
  return RELEASES[0] || null;
}

function loadWhatsNewState(app) {
  try {
    const raw = app && app.loadLocalStorage ? app.loadLocalStorage(WHATS_NEW_STORAGE_KEY) : null;
    return normalizeWhatsNewState(raw);
  } catch (e) {
    return normalizeWhatsNewState(null);
  }
}

function saveWhatsNewState(app, state) {
  if (!app || !app.saveLocalStorage) return;
  try {
    app.saveLocalStorage(WHATS_NEW_STORAGE_KEY, normalizeWhatsNewState(state));
  } catch (e) {
    // Storage can be unavailable in a restricted workspace; the popup still works for this run.
  }
}

/**
 * An update shows once. A first install does not: the Start here note owns onboarding.
 * Existing installs already carry a welcome version, which acts as the first baseline.
 */
function whatsNewShouldShow(app, version) {
  const current = cleanVersion(version);
  if (!releaseFor(current)) return false;
  const seen = loadWhatsNewState(app).seenVersion || cleanVersion(loadWelcomeState(app).seenVersion);
  return !!seen && seen !== current;
}

function markWhatsNewSeen(app, version) {
  const current = cleanVersion(version);
  if (!current) return loadWhatsNewState(app);
  const state = { seenVersion: current, seenAt: new Date().toISOString() };
  saveWhatsNewState(app, state);
  return state;
}

module.exports = {
  RELEASES,
  WHATS_NEW_STORAGE_KEY,
  cleanVersion,
  latestRelease,
  loadWhatsNewState,
  markWhatsNewSeen,
  normalizeWhatsNewState,
  releaseFor,
  saveWhatsNewState,
  whatsNewShouldShow,
};
