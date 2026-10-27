"use strict";
const { MarkdownRenderer } = require("obsidian");
const { findAnswerKey, inferMode, parseSections } = require("./notes");
const { str } = require("./util");

/* ----------------------------------------------------------------- plugin */

/* ------------------------------------------------- shared view helpers */

function renderMarkdownInto(app, markdown, el, sourcePath, component) {
  const p = MarkdownRenderer.render
    ? MarkdownRenderer.render(app, markdown, el, sourcePath, component)
    : MarkdownRenderer.renderMarkdown(markdown, el, sourcePath, component);
  Promise.resolve(p).catch(() => el.setText(markdown));
}

/** Reads a question note and works out how to present and grade it. */
async function loadQuestionData(plugin, q) {
  const app = plugin.app;
  const text = await app.vault.cachedRead(q.file);
  const sections = parseSections(text);
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
  const key = findAnswerKey(q.fm, sections);
  const mode = inferMode(q.fm.question_type, key, sections.choices);
  return { file: q.file, fm: { ...q.fm }, sections, key, mode };
}

module.exports = {
  renderMarkdownInto,
  loadQuestionData,
};
