"use strict";
/*
 * One due list across questions, flashcards and vocabulary.
 *
 * The item types keep their own review screens, so this queue is deliberately
 * a shared list and launcher, not an interleaved session. It gives Today and
 * the command palette one place to see what is due and open the right review.
 */
const { Modal, Notice } = require("obsidian");
const { str } = require("./util");
const { isDue } = require("./filters");
const { isStudyable } = require("./study-status");

function dueDateOf(fm) {
  return str(fm && fm.next_review).slice(0, 10);
}

function titleOf(type, source) {
  const fm = source.fm || {};
  if (type === "question") return str(fm.question_id || source.file.basename);
  return str(fm.card_title || source.file.basename);
}

function metaOf(type, source) {
  const fm = source.fm || {};
  const bits = [type === "vocab" ? "Vocabulary" : type === "card" ? "Flashcard" : "Question"];
  if (source.course || fm.course) bits.push(source.course || fm.course);
  if (source.deck) bits.push(source.deck);
  return bits.join(" · ");
}

function rowFor(type, source, today) {
  const fm = source.fm || {};
  if (!isStudyable(fm, today)) return null;
  const isNew = !Number(fm.attempts);
  const dueDate = dueDateOf(fm);
  if (!isNew && !isDue(fm, today)) return null;
  return {
    type,
    source,
    file: source.file,
    path: source.file.path,
    title: titleOf(type, source),
    meta: metaOf(type, source),
    course: str(source.course || fm.course).trim(),
    deck: str(source.deck).trim(),
    isNew,
    dueDate,
  };
}

/**
 * Merge due questions and cards into one ordered list. Due items come before
 * new items; within each group the oldest next-review date wins.
 */
function buildDueQueue(questions, cards, options) {
  const opts = options || {};
  const today = str(opts.today);
  const rows = [];
  for (const source of Array.isArray(questions) ? questions : []) {
    const row = rowFor("question", source, today);
    if (row) rows.push(row);
  }
  for (const source of Array.isArray(cards) ? cards : []) {
    const row = rowFor(source.kind === "vocab" ? "vocab" : "card", source, today);
    if (row) rows.push(row);
  }
  rows.sort((a, b) => {
    if (a.isNew !== b.isNew) return a.isNew ? 1 : -1;
    if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    return a.type.localeCompare(b.type) || a.title.localeCompare(b.title) || a.path.localeCompare(b.path);
  });
  const counts = {
    questions: rows.filter((row) => row.type === "question").length,
    cards: rows.filter((row) => row.type === "card").length,
    vocab: rows.filter((row) => row.type === "vocab").length,
    total: rows.length,
  };
  const limit = opts.limit === undefined ? 20 : Math.max(0, Math.round(Number(opts.limit) || 0));
  return { items: limit ? rows.slice(0, limit) : [], all: rows, counts };
}

class DueQueueModal extends Modal {
  constructor(app, plugin, onDone) {
    super(app);
    this.plugin = plugin;
    this.onDone = onDone || (() => {});
  }

  onOpen() {
    const { contentEl } = this;
    const p = this.plugin;
    contentEl.empty();
    contentEl.createEl("h3", { text: "Due across modules" });
    const queue = p.getDueQueue({ limit: 100 });
    const c = queue.counts;
    contentEl.createEl("p", {
      cls: "setting-item-description",
      text: `${c.total} item${c.total === 1 ? "" : "s"} due or new · ${c.questions} question${c.questions === 1 ? "" : "s"} · ${c.cards + c.vocab} card${c.cards + c.vocab === 1 ? "" : "s"}`,
    });

    if (!queue.items.length) {
      contentEl.createDiv({ cls: "qt-hint", text: "Nothing is due across the enabled modules. New cards and questions will appear here." });
      return;
    }

    const list = contentEl.createDiv({ cls: "qt-due-list" });
    for (const item of queue.items) {
      const row = list.createDiv({ cls: `qt-due-row qt-due-${item.type}` });
      const main = row.createDiv({ cls: "qt-due-main" });
      main.createDiv({ cls: "qt-due-title", text: item.title });
      main.createDiv({ cls: "qt-due-meta", text: item.meta });
      row.createSpan({
        cls: `qt-due-badge${item.isNew ? " is-new" : ""}`,
        text: item.isNew ? "New" : item.dueDate ? `Due ${item.dueDate}` : "Due",
      });
      const open = row.createEl("button", { text: "Open", cls: "qt-link" });
      open.addEventListener("click", () => this.app.workspace.getLeaf("tab").openFile(item.file));
      const start = row.createEl("button", {
        text: item.type === "question" ? "Practice" : "Review",
        cls: "mod-cta",
      });
      start.addEventListener("click", () => this.start(item));
    }

    const actions = contentEl.createDiv({ cls: "qt-row" });
    if (c.questions) {
      actions.createEl("button", { text: `Practice ${c.questions} due question${c.questions === 1 ? "" : "s"}`, cls: "mod-cta qt-primary" }).addEventListener(
        "click",
        () => this.startQuestions(queue.all)
      );
    }
    if (c.cards + c.vocab) {
      actions.createEl("button", { text: `Review ${c.cards + c.vocab} due card${c.cards + c.vocab === 1 ? "" : "s"}` }).addEventListener(
        "click",
        () => this.startCards(queue.all)
      );
    }
  }

  async start(item) {
    this.close();
    if (item.type === "question") {
      await this.plugin.startQuickPractice({ minutes: 5, pool: [item.source], mode: "due", label: "due question" });
    } else {
      await this.plugin.reviewCard(item.source);
    }
    this.onDone(item);
  }

  async startQuestions(items) {
    const questions = items.filter((item) => item.type === "question").map((item) => item.source);
    if (!questions.length) return;
    this.close();
    await this.plugin.startQuickPractice({ minutes: 5, pool: questions, mode: "due", label: "questions due today" });
    this.onDone();
  }

  async startCards(items) {
    const cards = items.filter((item) => item.type !== "question").map((item) => item.source);
    if (!cards.length) return;
    this.close();
    await this.plugin.reviewCards(cards);
    this.onDone();
  }

  onClose() {
    this.contentEl.empty();
  }
}

module.exports = {
  buildDueQueue,
  DueQueueModal,
};
