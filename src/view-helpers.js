"use strict";
const { MarkdownRenderer } = require("obsidian");
const { findAnswerKey, inferMode, parseSections } = require("./notes");
const { str } = require("./util");
const { prepareMathMarkdown } = require("./math-rendering");
const parameterized = require("./parameterized");

/* ----------------------------------------------------------------- plugin */

/* ------------------------------------------------- shared view helpers */

function renderMarkdownInto(app, markdown, el, sourcePath, component) {
  const source = prepareMathMarkdown(markdown);
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
  let mode = inferMode(q.fm.question_type, key, sections.choices);
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
  return { file: q.file, fm: { ...q.fm }, sections, key, mode, variant };
}

module.exports = {
  renderMarkdownInto,
  loadQuestionData,
};
