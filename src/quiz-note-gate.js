"use strict";
/*
 * Quiz Blocks-style note gating.
 *
 * A `mcq-quiz` block with `gated: true` can hide the rest of its reading-view
 * note until every question is answered. Only complete, supported quizzes are
 * gated; malformed blocks and unavailable question types leave the note visible
 * so a reader can never get stuck behind an unanswerable question.
 */

function canGate(parsed, settings) {
  if (!parsed || parsed.gated !== true || parsed.mode === "static") return false;
  const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
  if (!questions.length) return false;
  const opts = settings || {};
  return questions.every((question) => {
    if (!question || question.valid !== true) return false;
    if (question.sharedOptions && opts.inlineQuizSharedChoice !== true) return false;
    if (question.type === "reorder" && opts.inlineQuizReorder !== true) return false;
    if (question.type === "numeric" && opts.inlineQuizNumeric !== true) return false;
    return true;
  });
}

function begin(el, total) {
  if (!el || typeof el.closest !== "function" || typeof el.createDiv !== "function") return null;
  // Embedded notes are a reader inside another note; hiding the host's siblings
  // would hide unrelated content outside the embed.
  if (el.closest(".markdown-embed")) return null;
  const root = el.closest(".markdown-preview-view") || el.closest(".markdown-reading-view");
  if (!root) return null;

  const hidden = [];
  let node = el;
  while (node && node !== root) {
    let sibling = node.nextElementSibling;
    while (sibling) {
      if (sibling.style) {
        hidden.push({ node: sibling, display: sibling.style.display || "" });
        sibling.style.display = "none";
      }
      sibling = sibling.nextElementSibling;
    }
    if (!node.parentElement || node.parentElement === root) break;
    node = node.parentElement;
  }
  if (!hidden.length) return null;

  const panel = el.createDiv({ cls: "qt-quiz-note-gate" });
  panel.createDiv({ cls: "qt-quiz-note-gate-title", text: "Finish the quiz to unlock this note" });
  const progress = panel.createDiv({ cls: "qt-quiz-note-gate-progress", text: `0 of ${total} answered` });
  panel.createDiv({ cls: "qt-quiz-note-gate-hint", text: "Answer every question above; the rest of the note will appear." });

  let open = false;
  const unlock = () => {
    if (open) return;
    open = true;
    for (const item of hidden) {
      if (item.node && item.node.style) item.node.style.display = item.display;
    }
    if (typeof panel.remove === "function") panel.remove();
    else panel.style.display = "none";
  };
  const update = (answered) => {
    if (open) return;
    progress.setText(`${answered} of ${total} answered`);
    if (answered >= total) unlock();
  };
  return { update, unlock };
}

module.exports = { canGate, begin };
