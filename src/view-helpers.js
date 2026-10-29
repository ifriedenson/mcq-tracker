"use strict";
const { MarkdownRenderer } = require("obsidian");
const { findAnswerKey, inferMode, parseSections } = require("./notes");
const { normalizeAnswerKey } = require("./answer-types");
const { str } = require("./util");
const { prepareMathMarkdown } = require("./math-rendering");
const { normalizeFigureMarkers } = require("./figures");
const parameterized = require("./parameterized");

/* ----------------------------------------------------------------- plugin */

/* ------------------------------------------------- shared view helpers */

function renderMarkdownInto(app, markdown, el, sourcePath, component) {
  const source = prepareMathMarkdown(normalizeFigureMarkers(markdown));
  try {
    const p = MarkdownRenderer.render
      ? MarkdownRenderer.render(app, source, el, sourcePath, component)
      : MarkdownRenderer.renderMarkdown(source, el, sourcePath, component);
    Promise.resolve(p).catch(() => el.setText(markdown));
  } catch (e) {
    el.setText(markdown);
  }
}

/** Reads a question note and works out how to present and grade it. */
async function loadQuestionData(plugin, q, options) {
  const app = plugin.app;
  const text = await app.vault.cachedRead(q.file);
  let sections = parseSections(text);
  // Shared passage: if this note has none but names a stimulus_id, borrow it from a sibling note.
  if (!sections.stimulus && str(q.fm.stimulus_id).trim()) {
    const id = str(q.fm.stimulus_id).trim();
    for (const o of plugin.getQuestions()) {
      if (o.file.path === q.file.path || str(o.fm.stimulus_id).trim() !== id) continue;
      try {
        const st = parseSections(await app.vault.cachedRead(o.file)).stimulus;
        if (st) {
          sections.stimulus = st;
          break;
        }
      } catch (e) {
        /* ignore */
      }
    }
  }
  let key = findAnswerKey(q.fm, sections);
  const pairs = sections.pairs || [];
  let mode = inferMode(q.fm.question_type, key, sections.choices, pairs);
  // True/false and select-all keys are stored in one canonical form so the
  // practice view, timed tests and history all compare the same values.
  key = normalizeAnswerKey(mode, key, sections.choices);
  const variant = parameterized.buildVariant(q.fm, options && options.seed, q.file.path);
  if (variant.active) {
    if (variant.ok) {
      sections = parameterized.applyVariantToSections(sections, variant.values);
      key = variant.answerText;
      mode = "spr";
    } else {
      // Never grade a broken variant against a stale static answer.
      key = "";
      mode = "self";
    }
  }
  return { file: q.file, fm: { ...q.fm }, sections, key, mode, variant, pairs };
}

/** One matching row per pair, with the right column in `order`. */
function renderMatchPicker(options) {
  const opts = options || {};
  const pairs = Array.isArray(opts.pairs) ? opts.pairs : [];
  const order = Array.isArray(opts.order) ? opts.order : pairs.map((_pair, i) => i);
  const picks = Array.isArray(opts.picks) ? opts.picks : [];
  const list = opts.container.createDiv({ cls: "qt-match" });
  const selects = [];
  pairs.forEach((pair, i) => {
    const row = list.createDiv({ cls: "qt-match-row" });
    opts.renderLeft(pair.left, row.createDiv({ cls: "qt-match-left" }));
    const sel = row.createEl("select", { cls: "qt-select qt-match-select" });
    sel.createEl("option", { value: "", text: "Choose..." });
    for (const idx of order) if (pairs[idx]) sel.createEl("option", { value: String(idx), text: str(pairs[idx].right) });
    sel.value = Number.isInteger(picks[i]) && picks[i] >= 0 ? String(picks[i]) : "";
    sel.addEventListener("change", () => opts.onChange(i, sel.value === "" ? -1 : Number(sel.value)));
    selects.push(sel);
  });
  if (opts.hint) opts.container.createDiv({ cls: "qt-hint", text: opts.hint });
  return { list, selects };
}

module.exports = {
  renderMarkdownInto,
  loadQuestionData,
  renderMatchPicker,
};
