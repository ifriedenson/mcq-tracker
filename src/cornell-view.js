"use strict";
/*
 * Render a `cornell-note` block. The block is read-only and local: recall
 * mode hides note text until the reader reveals a cue, and nothing is written.
 */
const { parseCornellNote } = require("./cornell");

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
  const cueColumn = grid.createDiv({ cls: "qt-cornell-cues" });
  const noteColumn = grid.createDiv({ cls: "qt-cornell-notes" });
  cueColumn.createDiv({ cls: "qt-cornell-column-label", text: "Cues" });
  noteColumn.createDiv({ cls: "qt-cornell-column-label", text: "Notes" });

  let hiding = false;
  const rows = parsed.cues.map((row, index) => {
    const cue = cueColumn.createDiv({ cls: "qt-cornell-cue" });
    cue.createSpan({ cls: "qt-cornell-number", text: String(index + 1).padStart(2, "0") });
    cue.createSpan({ cls: "qt-cornell-cue-text", text: row.cue });
    const note = noteColumn.createDiv({ cls: "qt-cornell-note" });
    const text = note.createDiv({ cls: "qt-cornell-note-text", text: row.note });
    const reveal = note.createEl("button", { cls: "qt-cornell-reveal", text: "Reveal" });
    reveal.setAttr("aria-label", `Reveal note ${index + 1}`);
    reveal.addEventListener("click", () => {
      text.toggleClass("is-hidden", false);
      reveal.toggleClass("is-hidden", true);
    });
    return { note: text, reveal };
  });

  const setHiding = (next) => {
    hiding = next;
    recall.setText(hiding ? "Show notes" : "Start recall");
    recall.setAttr("aria-pressed", hiding ? "true" : "false");
    for (const row of rows) {
      row.note.toggleClass("is-hidden", hiding);
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
