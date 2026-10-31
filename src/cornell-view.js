"use strict";
/*
 * Render a `cornell-note` block. The block is read-only and local: recall
 * mode hides note text until the reader reveals a cue, and nothing is written.
 */
const { cornellHighlightTerms, parseCornellNote } = require("./cornell");

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
/** Render text with explicit margin terms wrapped in a mark, leaving other text intact. */
function appendHighlighted(parent, text, terms) {
  const list = (Array.isArray(terms) ? terms : []).filter(Boolean).sort((a, b) => b.length - a.length);
  if (!list.length) {
    parent.createSpan({ text });
    return;
  }
  const pattern = new RegExp(`(${list.map(escapeRegExp).join("|")})`, "gi");
  let last = 0;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) parent.createSpan({ text: text.slice(last, match.index) });
    parent.createEl("mark", { cls: "qt-cornell-highlight", text: match[1] });
    last = match.index + match[0].length;
    if (!match[0].length) pattern.lastIndex += 1;
  }
  if (last < text.length) parent.createSpan({ text: text.slice(last) });
}

function renderCornellBlock(plugin, source, el) {
  if (plugin && typeof plugin.cornellNotesEnabled === "function" && !plugin.cornellNotesEnabled()) {
    el.createDiv({
      cls: "qt-cornell-empty",
      text: "Cornell notes are off. Turn on Cornell notes under Settings, Global, Modules.",
    });
    return;
  }
  const parsed = parseCornellNote(source);
  const box = el.createDiv({ cls: "qt-cornell" });
  const head = box.createDiv({ cls: "qt-cornell-head" });
  const titleWrap = head.createDiv({ cls: "qt-cornell-title-wrap" });
  titleWrap.createDiv({ cls: "qt-cornell-title", text: parsed.title || "Cornell note" });
  if (parsed.course) titleWrap.createDiv({ cls: "qt-cornell-course", text: parsed.course });
  const recall = head.createEl("button", { cls: "qt-cornell-recall", text: "Start recall" });
  recall.setAttr("aria-pressed", "false");

  if (!parsed.valid) {
    const issues = box.createDiv({ cls: "qt-cornell-issues" });
    issues.createDiv({ cls: "qt-cornell-issue-title", text: "This Cornell note needs a small fix" });
    for (const issue of parsed.issues.slice(0, 8)) issues.createDiv({ cls: "qt-cornell-issue", text: issue });
    return;
  }

  const grid = box.createDiv({ cls: "qt-cornell-grid" });
  const hasMargins = parsed.cues.some((row) => row.margin);
  if (hasMargins) grid.addClass("has-margins");
  const cueColumn = grid.createDiv({ cls: "qt-cornell-cues" });
  const noteColumn = grid.createDiv({ cls: "qt-cornell-notes" });
  const marginColumn = hasMargins ? grid.createDiv({ cls: "qt-cornell-margins" }) : null;
  cueColumn.createDiv({ cls: "qt-cornell-column-label", text: "Cues" });
  noteColumn.createDiv({ cls: "qt-cornell-column-label", text: "Notes" });
  if (marginColumn) marginColumn.createDiv({ cls: "qt-cornell-column-label", text: "Margins" });

  let hiding = false;
  const rows = parsed.cues.map((row, index) => {
    const cue = cueColumn.createDiv({ cls: "qt-cornell-cue" });
    cue.createSpan({ cls: "qt-cornell-number", text: String(index + 1).padStart(2, "0") });
    const cueText = cue.createSpan({ cls: "qt-cornell-cue-text" });
    appendHighlighted(cueText, row.cue, cornellHighlightTerms(row.margin));
    const note = noteColumn.createDiv({ cls: "qt-cornell-note" });
    const text = note.createDiv({ cls: "qt-cornell-note-text" });
    appendHighlighted(text, row.note, cornellHighlightTerms(row.margin));
    const margin = marginColumn ? marginColumn.createDiv({ cls: "qt-cornell-margin" }) : null;
    if (margin) margin.createDiv({ cls: "qt-cornell-margin-text", text: row.margin || "" });
    const reveal = note.createEl("button", { cls: "qt-cornell-reveal", text: "Reveal" });
    reveal.setAttr("aria-label", `Reveal note ${index + 1}`);
    reveal.addEventListener("click", () => {
      text.toggleClass("is-hidden", false);
      if (margin) margin.toggleClass("is-hidden", false);
      reveal.toggleClass("is-hidden", true);
    });
    return { note: text, reveal, margin };
  });

  const setHiding = (next) => {
    hiding = next;
    recall.setText(hiding ? "Show notes" : "Start recall");
    recall.setAttr("aria-pressed", hiding ? "true" : "false");
    for (const row of rows) {
      row.note.toggleClass("is-hidden", hiding);
      if (row.margin) row.margin.toggleClass("is-hidden", hiding);
      row.reveal.toggleClass("is-hidden", !hiding);
      if (!hiding) row.reveal.toggleClass("is-hidden", true);
    }
    box.toggleClass("is-recall", hiding);
  };
  recall.addEventListener("click", () => setHiding(!hiding));

  if (parsed.summary) {
    const summary = box.createDiv({ cls: "qt-cornell-summary" });
    summary.createDiv({ cls: "qt-cornell-column-label", text: "Summary" });
    summary.createDiv({ cls: "qt-cornell-summary-text", text: parsed.summary });
  }
}

module.exports = { renderCornellBlock };
