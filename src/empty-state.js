"use strict";
const { API_PRESETS } = require("./api-client");
const { cacheIssues, looksLikeQuestion } = require("./importer");
const { str } = require("./util");

/* First-run screen: what to show when the practice view finds no usable questions. */

const QUICK_START_URL = "https://github.com/ifriedenson/mcq-tracker#quick-start";

const inFolder = (path, folder) => !folder || path === folder || path.startsWith(folder + "/");
const cleanFolder = (f) => str(f).trim().replace(/^\/+|\/+$/g, "");

/** Visits every note in the question folder, reading only the metadata cache. Calls fn(file, fm, headings). Stops when fn returns true. */
function eachNote(app, folder, fn) {
  const dir = cleanFolder(folder);
  for (const file of app.vault.getMarkdownFiles()) {
    if (!inFolder(file.path, dir)) continue;
    const cache = app.metadataCache.getFileCache(file);
    if (fn(file, (cache && cache.frontmatter) || {}, cache && cache.headings) === true) return;
  }
}

/** True as soon as one note passes. Cheap: stops at the first hit. */
function hasValidQuestion(app, folder) {
  let found = false;
  eachNote(app, folder, (_f, fm, headings) => {
    if (looksLikeQuestion(fm, headings) && !cacheIssues(fm, headings).length) found = true;
    return found;
  });
  return found;
}

/** { valid, broken: [{path, problems}] }: every note that looks like a question, sorted into passing and failing. */
function scanQuestionNotes(app, folder) {
  let valid = 0;
  const broken = [];
  eachNote(app, folder, (file, fm, headings) => {
    if (!looksLikeQuestion(fm, headings)) return;
    const problems = cacheIssues(fm, headings);
    if (problems.length) broken.push({ path: file.path, problems });
    else valid++;
  });
  return { valid, broken };
}

/** The first-run state: null when at least one valid question exists, otherwise { broken: [...] }. */
function emptyState(app, folder) {
  if (hasValidQuestion(app, folder)) return null;
  return { broken: scanQuestionNotes(app, folder).broken };
}

/** Whether document import can run without more setup. */
function aiReady(plugin) {
  const ai = plugin.settings.ai || {};
  if (!ai.enabled) return false;
  if (plugin.backend() === "opencode") return true; // OpenCode keeps its own provider login and says so if it has none
  const api = ai.api || {};
  const preset = API_PRESETS[api.provider] || API_PRESETS.custom;
  if (!str(api.model).trim()) return false;
  return !!preset.noKey || !!str((api.keys || {})[api.provider]).trim();
}

module.exports = { QUICK_START_URL, aiReady, emptyState, hasValidQuestion, scanQuestionNotes };
