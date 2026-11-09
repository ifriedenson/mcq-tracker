"use strict";
/* Bundled release notes and per-device "already seen" state. No network, no vault notes. */
const { loadWelcomeState } = require("./welcome");

const WHATS_NEW_STORAGE_KEY = "mcqTrackerWhatsNew";

const RELEASES = [
  {
    version: "1.299.3",
    date: "November 9, 2026",
    title: "Every control has a name",
    summary:
      "Screen readers now announce what each field is for across the shared Study Workspace forms, the primary modals and the Study agent.",
    highlights: [
      {
        title: "Named fields",
        body: "Shared form helpers pass their visible label to the control, so the Study Workspace and study tools no longer expose unnamed boxes.",
      },
      {
        title: "Filters you can hear",
        body: "The annotation, vocabulary, subject, time-block tag and PDF annotation filters each have their own name instead of relying on a placeholder.",
      },
      {
        title: "Answer boxes are labelled",
        body: "The Feynman and Deep Notes steps, typed card answers, FRQ prompts, card archive and OCR text name themselves to assistive technology.",
      },
      {
        title: "Nothing else changed",
        body: "No note format, review schedule, setting, data path or network request changed. The labels are additive.",
      },
    ],
  },
  {
    version: "1.299.2",
    date: "November 9, 2026",
    title: "A shortcut check you can trust",
    summary:
      "A new Hotkey audit command lists any MCQ Tracker shortcut that overlaps an Obsidian core shortcut, using the keys actually assigned on this device.",
    highlights: [
      {
        title: "One command, a clear list",
        body: "Run Hotkey audit from the command palette. It shows each collision with the MCQ Tracker command and the Obsidian command that shares the same keys.",
      },
      {
        title: "Current assignments only",
        body: "Custom hotkeys replace defaults, and a removed custom shortcut does not leak its old default back in. Other community plugins are left out, so the list stays focused on Obsidian core.",
      },
      {
        title: "Read-only and local",
        body: "The audit never changes a binding and makes no network request. It reads Obsidian's own hotkey tables in the current window.",
      },
      {
        title: "Works on every platform",
        body: "Mod is compared as Ctrl on Windows and Linux and as Cmd on macOS, so the same chord is not reported as a false collision across platforms.",
      },
    ],
  },
  {
    version: "1.299.1",
    date: "November 9, 2026",
    title: "Ctrl/Cmd+P stays yours",
    summary:
      "Pressing Ctrl/Cmd+P now opens Obsidian's command palette only, even on an older install that had also assigned the shortcut to Open cards.",
    highlights: [
      {
        title: "The command palette wins",
        body: "A leftover custom binding on Open cards that used Ctrl/Cmd+P is removed once when the plugin starts. The palette no longer competes with the Cards module.",
      },
      {
        title: "Nothing was taken away",
        body: "Open cards remains in the command palette, and the ribbon button stays whenever Cards is on. Only the duplicate Ctrl/Cmd+P assignment is removed; Shift and Alt variants and every other shortcut are left alone.",
      },
      {
        title: "Cards-off guidance stays",
        body: "If the Cards module is off, choosing Open cards still shows the existing notice and takes you to Settings, where Modules can be turned back on.",
      },
      {
        title: "No data changes",
        body: "Question notes, cards, review history, settings and saved hotkeys other than that one binding are unchanged.",
      },
    ],
  },
  {
    version: "1.299.0",
    date: "November 9, 2026",
    title: "OpenCode at the front door",
    summary:
      "A new desktop setup now starts with OpenCode: install it from the same first-run screen, test it, and continue. Direct API is still one click away for phones and as a fallback.",
    highlights: [
      {
        title: "OpenCode leads the setup",
        body: "The first-run and import connection screen opens on OpenCode on desktop. Install OpenCode is the main button, not a detour through the advanced section.",
      },
      {
        title: "Install, test, then continue",
        body: "Installing no longer silently turns AI on. The screen shows download progress, Test OpenCode starts the agent and checks that it answers with a provider, and Continue unlocks only after that test works.",
      },
      {
        title: "No false readiness",
        body: "Practice, the empty screen and the import helper now require an actual OpenCode install, or a server you configured yourself, before they call AI ready. A missing install points back to the button instead of failing later.",
      },
      {
        title: "Direct API stays one click away",
        body: "The same screen offers a Direct API key for phones, an existing key or a fallback. A saved Direct API setup from before this update keeps using Direct API.",
      },
      {
        title: "Offline still works",
        body: "Paste questions instead stays visible on both paths, and every setup failure names the next click instead of leaving the importer as a dead end.",
      },
    ],
  },
  {
    version: "1.298.0",
    date: "November 9, 2026",
    title: "A cleaner community listing",
    summary:
      "A small follow-up clears the Community Plugins review's blocking manifest issue and its one stylesheet compatibility warning, with no new settings or note changes.",
    highlights: [
      {
        title: "Listing description fixed",
        body: "The plugin description no longer repeats the word Obsidian, which the Community Plugins review rejects as redundant in its directory context.",
      },
      {
        title: "One stylesheet warning cleared",
        body: "The exam flag marker now uses a supported rounded shape instead of clip-path, which the review flags as only partially supported in Obsidian 1.7.4.",
      },
      {
        title: "Nothing else changed",
        body: "Practice, imports, the AI connection wizard, review and every note format are unchanged, so existing questions keep working exactly as before.",
      },
      {
        title: "Update as usual",
        body: "Install the update from Community Plugins or the release page; there is no migration and no new setting to review.",
      },
    ],
  },
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
