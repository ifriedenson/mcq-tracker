"use strict";
/* Bundled release notes and per-device "already seen" state. No network, no vault notes. */
const { loadWelcomeState } = require("./welcome");

const WHATS_NEW_STORAGE_KEY = "mcqTrackerWhatsNew";

const RELEASES = [
  {
    version: "1.301.9",
    date: "November 13, 2026",
    title: "No time limit, and a one-press OpenCode check",
    summary:
      "A file is never stopped for taking a long time, so a 100-page PDF can finish on its own. When OpenCode stops answering, the import summary offers a Check OpenCode button that says in plain words whether it is running and restarts it.",
    highlights: [
      {
        title: "No time limit at all",
        body: "The 20-minute cap is gone too. A file now runs until the agent finishes it, you press Stop, Undo everything or Discard this file, or OpenCode stops answering.",
      },
      {
        title: "Check OpenCode, in one press",
        body: "A lost-contact failure now shows a Check OpenCode button under the file list. It restarts the plugin's own server and tells you plainly, for example OpenCode is running 1.19.5 and answering normally.",
      },
      {
        title: "Also a command",
        body: "Run Check that OpenCode is running from the command palette at any time, whether or not an import is open.",
      },
      {
        title: "No format changes",
        body: "Question notes, review dates, saved settings, provider keys and network defaults are unchanged.",
      },
    ],
  },
  {
    version: "1.301.8",
    date: "November 12, 2026",
    title: "No more silence cutoff on the agent",
    summary:
      "The OpenCode agent watchdog no longer stops a file for going quiet: a slow model keeps working until it finishes, you stop it, or a 20-minute absolute backstop ends it. Lost contact with the server still fails fast.",
    highlights: [
      {
        title: "Quiet work is never cut off",
        body: "The old 3-minute silence cutoff is gone, so a long illustrated PDF that keeps the model thinking silently can no longer be stopped at 181s. Stop, Undo everything and Discard this file still end a file the moment you ask.",
      },
      {
        title: "The backstops that stay",
        body: "An unreadable server still fails fast with Lost contact, and a 20-minute absolute cap ends a file that never finishes, naming what the agent was last seen doing and the file-edit permission fix.",
      },
      {
        title: "No format changes",
        body: "Question notes, review dates, saved settings, provider keys and network defaults are unchanged.",
      },
      {
        title: "Covered by a test",
        body: "A quiet agent is proven to run past any silence and stop only at the absolute backstop, with the reason intact.",
      },
    ],
  },
  {
    version: "1.301.7",
    date: "November 12, 2026",
    title: "Long imports get proportional patience",
    summary:
      "The OpenCode agent watchdog now scales its silence allowance with the document length instead of cutting every file off at the same 3 minutes, so a long illustrated PDF can think silently for minutes without being stopped.",
    highlights: [
      {
        title: "Patience grows with the page count",
        body: "A short file keeps the 3-minute allowance; a 100-page file gets over 7 minutes of quiet thinking time, capped at 10 minutes. The timeout message still reports how long the agent was quiet and what it was last seen doing.",
      },
      {
        title: "No format changes",
        body: "Question notes, review dates, saved settings, provider keys and network defaults are unchanged.",
      },
      {
        title: "Covered by a new test",
        body: "The page-count scaling, the 10-minute cap and an explicitly configured base are pinned by tests.",
      },
      {
        title: "Pairs with always-allowed edits",
        body: "Together with 1.301.6, the two watchdog stalls are addressed: the agent is allowed to write, and a slow agent on a long file is allowed the time.",
      },
    ],
  },
  {
    version: "1.301.6",
    date: "November 12, 2026",
    title: "The agent can always write the notes",
    summary:
      "The OpenCode server this plugin starts now always allows file edits, so an import can no longer stall waiting for a permission prompt nobody can answer. Reads, bash and every other permission stay exactly as you set them.",
    highlights: [
      {
        title: "Imports never wait on a permission prompt",
        body: "A stored OpenCode edit permission of ask would leave every note write waiting for an approval that the import window cannot show. The server the plugin runs now starts with edits allowed.",
      },
      {
        title: "Your own OpenCode config is left alone",
        body: "Only file edits are changed. Reads, bash and other permission rules keep your values, and a config you supply yourself through OPENCODE_CONFIG_CONTENT is never overwritten.",
      },
      {
        title: "The vault stays reachable",
        body: "Edits are also allowed inside your vault folder when OpenCode treats it as an external directory, so note files can be written wherever the vault lives.",
      },
      {
        title: "No format changes",
        body: "Question notes, review dates, saved settings, provider keys and network defaults are unchanged.",
      },
    ],
  },
  {
    version: "1.301.5",
    date: "November 12, 2026",
    title: "Import failures that explain themselves",
    summary:
      "A batch summary now keeps each file's reason instead of a bare Could not import, empty errors fall back to an actionable message, and the OpenCode agent watchdog tells lost contact apart from an idle agent while naming its last work and the file-permission fix.",
    highlights: [
      {
        title: "The summary keeps the reason",
        body: "Every failed file in the end-of-batch summary now shows its error text, and files with no notes show why they produced nothing, so a failed import can be acted on.",
      },
      {
        title: "An agent stall names its cause",
        body: "Repeatedly unreadable agent status fails fast with Lost contact, while a quiet agent reports how long it was quiet, what it was last seen doing, and the OpenCode file-edit permission to check. Direct AI (you review first) needs no file permission.",
      },
      {
        title: "Covered by new tests",
        body: "The failure-detail summary, the lost-contact fast path and the idle-agent message are pinned by new tests, and the release inventory is regenerated.",
      },
      {
        title: "No format changes",
        body: "Question notes, review dates, saved settings, provider keys and network defaults are unchanged.",
      },
    ],
  },
  {
    version: "1.301.4",
    date: "November 12, 2026",
    title: "Recover locked installs and protected imports",
    summary:
      "Password-protected PDFs can now ask for their password inside the import window, unreadable files carry a clear next step, and a saved OpenCode install folder is repaired instead of failing to start. Closing an import also stops its outstanding AI wait.",
    highlights: [
      {
        title: "Unlock a protected PDF",
        body: "The import window asks for the password, tries it without saving it, and can retry a wrong one. A batch asks once per file; skipping one protected file leaves the rest of the batch running.",
      },
      {
        title: "Readable failures",
        body: "Empty PDFs, zero-byte documents, corrupt Office files and files over 80 MB now explain what to do next before anything is copied into the vault.",
      },
      {
        title: "Repair a saved OpenCode folder",
        body: "If the saved OpenCode path is its install folder, the app finds the executable inside it. A missing executable is repaired from another installed copy or a confirmed reinstall, and a locked old folder no longer blocks the new copy.",
      },
      {
        title: "No format changes",
        body: "Question notes, review dates, saved settings, provider keys and network defaults are unchanged. PDF passwords stay in memory for this import only.",
      },
    ],
  },
  {
    version: "1.301.3",
    date: "November 11, 2026",
    title: "Keep a stalled answer check from freezing an import",
    summary:
      "Imports now show which imported answer is being checked, and a blind answer check that stops responding is cut off after 60 seconds. The note is kept and the rest of the file continues instead of leaving the import on Checking the notes forever.",
    highlights: [
      {
        title: "A stalled check cannot freeze the import",
        body: "Each blind answer check has a 60-second limit. A timeout is recorded as a verification error on that note, so the file finishes and the batch moves to the next PDF.",
      },
      {
        title: "See which answer is being checked",
        body: "The import window and main-window progress now name the note being checked and its position in the file instead of leaving one generic Checking the notes message on screen.",
      },
      {
        title: "The rest of the batch keeps going",
        body: "A timed-out check no longer holds up the current PDF or the files queued after it. The summary still reports the file as imported, and the note keeps its imported answer for you to review.",
      },
      {
        title: "No format changes",
        body: "Question notes, review dates, saved settings and provider keys are unchanged. A timeout keeps the imported question rather than deleting it.",
      },
    ],
  },
  {
    version: "1.301.2",
    date: "November 11, 2026",
    title: "Stop an import cleanly",
    summary:
      "The running import now offers Undo everything, Finish this file then stop, and Discard this file. Hanging AI or OpenCode requests end promptly, stopped work is cleaned up, and the summary says what was kept, stopped or undone.",
    highlights: [
      {
        title: "Three explicit stop choices",
        body: "Undo everything removes the notes, source copies and pictures this import made. Finish this file then stop saves the current file before stopping. Discard this file keeps finished files and removes only the current one.",
      },
      {
        title: "Hanging requests end promptly",
        body: "Stopping cancels the in-flight AI or OpenCode wait instead of leaving it running. A stalled OpenCode send is aborted, and a hanging Direct AI request leaves nothing behind.",
      },
      {
        title: "Honest stopped summaries",
        body: "Stopped batches report the files that finished, the current file marked Stopped, and any failures. An undone import reports the removed files and keeps the Practice button hidden.",
      },
      {
        title: "No format changes",
        body: "Question notes, review dates, cards, saved settings and provider keys are unchanged; existing imports and practice sessions keep working.",
      },
    ],
  },
  {
    version: "1.301.1",
    date: "November 10, 2026",
    title: "Batch import from the import window",
    summary:
      "Choose PDFs from the separate import window, add another file while the first is importing, keep the main-window progress after closing it, and practice the exact folder the batch filled.",
    highlights: [
      {
        title: "Pick files in the import window",
        body: "The source chooser opens from the button's own window, so the desktop popout can select several PDFs before the import starts.",
      },
      {
        title: "Add a PDF mid-import",
        body: "Add more files on the running or review screen queues another PDF; a single import becomes a batch and the notice totals move from 1 of 1 to 1 of 2 and 2 of 2.",
      },
      {
        title: "Progress outlives the window",
        body: "Closing the import window leaves the live notice in the main window, and refocusing the main window keeps the session, review and queue running to completion.",
      },
      {
        title: "Practice the imported folder",
        body: "The completion summary reports the true file and note counts, and Practice these questions opens the imported parent folder with the new questions.",
      },
      {
        title: "No format changes",
        body: "Question notes, review dates, cards, saved settings and provider keys are unchanged; existing imports and practice sessions keep working.",
      },
    ],
  },
  {
    version: "1.301.0",
    date: "November 10, 2026",
    title: "Import a batch, practice the result",
    summary:
      "Import several PDFs, PowerPoint or Word files at once, follow the queue from the main window while the import runs in its own desktop window, and start practicing the imported folder when the batch finishes.",
    highlights: [
      {
        title: "Several files, one batch",
        body: "The source picker accepts multiple documents. Each file gets its own review and subfolder, and a file that fails is recorded without stopping the rest of the queue.",
      },
      {
        title: "Progress that stays visible",
        body: "The main window keeps a live notice with the current file, queue position, stage and progress bar. It keeps updating when you click away or close the import window.",
      },
      {
        title: "A real import window",
        body: "On desktop the importer opens in a separate Obsidian window. Closing that window does not cancel the batch; run the import command again to return to the same panel and review.",
      },
      {
        title: "Practice what you imported",
        body: "When the batch finishes, the summary lists every file and offers Practice these questions. The button opens Practice on the imported parent folder, including after a partial failure.",
      },
      {
        title: "A clearer interface",
        body: "A shared design-token layer now drives type, spacing, colour, focus, motion and target sizes across the plugin, with stronger light and dark contrast and a keyboard-friendly statistics heatmap.",
      },
      {
        title: "No format changes",
        body: "Question notes, cards, review dates, saved settings and provider keys are unchanged. Existing imports keep working.",
      },
    ],
  },
  {
    version: "1.300.0",
    date: "November 10, 2026",
    title: "Questions from more places",
    summary:
      "Find or generate quiz questions now starts from your notes, a plain-language brief, pasted text, or up to three PDFs, and file import checks that a document is readable before it asks for AI or writes anything.",
    highlights: [
      {
        title: "Four ways to ask",
        body: "Choose My notes to search your folders, My prompt for original questions from the model's own knowledge, PDFs in my vault, or Text I paste. Prompt mode does not browse the web.",
      },
      {
        title: "A readable file first",
        body: "Import reads the PDF, PowerPoint or Word text locally before AI setup. A scanned file explains the OCR fix and leaves your vault untouched; the offline paste route stays visible.",
      },
      {
        title: "Nothing half-written",
        body: "A cancelled or failed import removes the source copy, captured figures, new notes and folders it created. Closing while the agent is still answering cleans up after it finishes.",
      },
      {
        title: "OpenCode says what is wrong",
        body: "The managed server now starts before the connection test, readiness is bounded, and a server stuck on an old database is repaired once. OpenCode 2.x names its unsupported routes instead of failing mid-chat.",
      },
      {
        title: "A lighter startup",
        body: "The PDF editor, reader and vendored PDF engines load only when a PDF opens, and question and card reads reuse path indexes with scoped invalidation. Two new checks keep both gains from eroding.",
      },
      {
        title: "No format changes",
        body: "Question notes, cards, review dates, settings, saved layouts and network behaviour are unchanged. Existing PDFs, imports and provider keys keep working.",
      },
    ],
  },
  {
    version: "1.299.5",
    date: "November 9, 2026",
    title: "Dialogs announce themselves",
    summary:
      "Every modal and picker now names its dialog window from the title it already shows, so a screen reader announces the surface before the first field.",
    highlights: [
      {
        title: "A name on every window",
        body: "The card editor, imports, exam and quiz builders, PDF editor and readers, summaries, reports and pickers all carry a dialog name.",
      },
      {
        title: "Named from what you see",
        body: "The window points at its visible heading, so its name matches the title on screen. No visible copy moved.",
      },
      {
        title: "Pickers state their purpose",
        body: "PDF, image, folder and question pickers have written names because they have no heading of their own.",
      },
      {
        title: "Enforced by tests",
        body: "The source audit now fails on a modal that bypasses the shared base, a dialog with no heading or purpose name, and an unnamed custom dialog overlay.",
      },
      {
        title: "Nothing else changed",
        body: "No note format, review schedule, setting, data path or network request changed. Every association is additive.",
      },
    ],
  },
  {
    version: "1.299.4",
    date: "November 9, 2026",
    title: "Every field has a name",
    summary:
      "A whole-surface pass names the remaining form fields and icon-only buttons, so a screen reader announces what each control does instead of reading a placeholder.",
    highlights: [
      {
        title: "Named fields everywhere",
        body: "The card editor, deck imports, exam builder, practice answers, PDF editor, reference searches, Quick add, Quick Chat and the Study agent all name their controls.",
      },
      {
        title: "Placeholders are hints again",
        body: "Text like e.g. BIOL 201 or Your answer stays visible as an example, but it is no longer the only thing describing the field.",
      },
      {
        title: "Buttons speak",
        body: "Icon-only and text-less buttons carry a real name, including the practice explanation and AI toggles and the PDF editor history controls.",
      },
      {
        title: "Enforced by tests",
        body: "A static audit reads every input, textarea, select and button in the source and fails the suite when a new one has no accessible name.",
      },
      {
        title: "Nothing else changed",
        body: "No note format, review schedule, setting, data path or network request changed. Every label is additive.",
      },
    ],
  },
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
