"use strict";
const { Modal, Notice } = require("obsidian");
const { str } = require("./util");

/** Preview-then-write generation for the learner's weakest practised skill. */
class WeakSpotModal extends Modal {
  constructor(app, plugin, onDone) {
    super(app);
    this.plugin = plugin;
    this.onDone = onDone || (() => {});
    this.rows = [];
    this.skill = "";
    this.kind = "questions";
    this.count = 5;
    this.deck = "";
    this.folder = "";
    this.generated = null;
    this.busy = false;
    this.error = "";
  }

  onOpen() {
    this.modalEl.addClass("qt-transcript-modal");
    this.rows = this.plugin.weakSpotChoices();
    this.skill = this.rows[0] ? this.rows[0].value : "";
    this.folder = str(this.plugin.settings.questionFolder).trim() || "Questions";
    this.deck = this.plugin.settings.cards.defaultDeck || "General";
    this.render();
  }

  render() {
    const el = this.contentEl;
    el.empty();
    el.createEl("h3", { text: "Generate practice from a weak spot" });
    if (this.error) el.createEl("p", { cls: "qt-error", text: this.error });
    if (!this.rows.length) {
      el.createEl("p", { cls: "qt-hint", text: "Answer at least one question first, then come back. The weakest practised skills appear here." });
      el.createEl("button", { text: "Close" }).addEventListener("click", () => this.close());
      return;
    }
    if (this.generated && this.generated.items.length) return this.renderPreview(el);
    if (this.busy) {
      el.createEl("p", { cls: "qt-hint", text: "Drafting original practice items..." });
      return;
    }

    const skillWrap = el.createDiv({ cls: "qt-field" });
    skillWrap.createEl("label", { text: "Weak spot" });
    const skill = skillWrap.createEl("select", { cls: "qt-select" });
    for (const row of this.rows) {
      const pct = Math.round((row.accuracy || 0) * 100);
      skill.createEl("option", { value: row.value, text: `${row.value} (${pct}%, ${row.attempts} attempts)` });
    }
    skill.value = this.skill;
    skill.addEventListener("change", () => (this.skill = skill.value));

    const kindWrap = el.createDiv({ cls: "qt-field" });
    kindWrap.createEl("label", { text: "What should it make?" });
    const kind = kindWrap.createEl("select", { cls: "qt-select" });
    kind.createEl("option", { value: "questions", text: "Multiple-choice questions" });
    kind.createEl("option", { value: "cards", text: "Flashcards" });
    kind.value = this.kind;
    kind.addEventListener("change", () => {
      this.kind = kind.value;
      this.count = this.kind === "cards" ? 8 : 5;
      this.render();
    });

    const countWrap = el.createDiv({ cls: "qt-field" });
    countWrap.createEl("label", { text: "How many?" });
    const count = countWrap.createEl("select", { cls: "qt-select" });
    for (const n of [5, 8, 10, 12, 15, 20]) count.createEl("option", { value: String(n), text: `${n} items` });
    count.value = String(this.count);
    count.addEventListener("change", () => (this.count = Number(count.value)));

    el.createDiv({
      cls: "qt-hint",
      text: "Only the skill name, optional course and format are sent. No question text or notes are included. Review the draft before anything is written.",
    });

    const row = el.createDiv({ cls: "qt-row" });
    row.createEl("button", { text: "Cancel", cls: "qt-grow" }).addEventListener("click", () => this.close());
    const go = row.createEl("button", { text: "Draft items", cls: "mod-cta qt-grow" });
    go.addEventListener("click", () => this.generate());
  }

  renderPreview(el) {
    const g = this.generated;
    el.createEl("h4", { text: `Ready to write ${g.items.length} ${g.kind === "questions" ? "question" : "card"}${g.items.length === 1 ? "" : "s"}` });
    const list = el.createEl("ul", { cls: "qt-extract-preview" });
    for (const item of g.items.slice(0, 20)) {
      list.createEl("li", { text: g.kind === "questions" ? `${item.question} (answer ${item.answer})` : `${item.front} → ${item.back}` });
    }
    if (g.items.length > 20) el.createEl("p", { cls: "qt-hint", text: `…and ${g.items.length - 20} more.` });
    if (g.verification) {
      const v = g.verification;
      const bits = [`Checked ${v.checked} AI-written answer${v.checked === 1 ? "" : "s"} without showing the key.`];
      if (v.dropped) bits.push(`${v.dropped} mismatch${v.dropped === 1 ? " was" : "es were"} dropped by your setting.`);
      if (v.failed) bits.push(`${v.failed} check${v.failed === 1 ? "" : "s"} could not finish and will be marked for review.`);
      el.createDiv({ cls: "qt-hint", text: bits.join(" ") });
    }
    el.createDiv({ cls: "qt-hint", text: "These items were generated for a weak spot, not copied from a note. The files can be undone with AI: undo the last generated notes." });
    const row = el.createDiv({ cls: "qt-row" });
    row.createEl("button", { text: "Back", cls: "qt-grow" }).addEventListener("click", () => {
      this.generated = null;
      this.render();
    });
    row.createEl("button", { text: "Create these", cls: "mod-cta qt-grow" }).addEventListener("click", () => this.write());
  }

  async generate() {
    if (this.busy) return;
    this.busy = true;
    this.error = "";
    this.render();
    try {
      this.generated = await this.plugin.generateWeakSpotPractice({
        skill: this.skill,
        kind: this.kind,
        count: this.count,
        course: (this.rows.find((row) => row.value === this.skill) || {}).course || "",
      });
      if (!this.generated.items.length) this.error = "The AI returned no usable items. Try again or pick another weak spot.";
    } catch (e) {
      this.error = str(e && e.message ? e.message : e) || "Could not generate practice items.";
    }
    this.busy = false;
    this.render();
  }

  async write() {
    if (this.busy || !this.generated) return;
    this.busy = true;
    this.render();
    try {
      const result = await this.plugin.writeTranscriptPractice(this.generated, { deck: this.deck, folder: this.folder });
      const made = result.created || 0;
      new Notice(made ? `Created ${made} ${this.generated.kind === "questions" ? "question" : "card"}${made === 1 ? "" : "s"}.` : "Nothing new was written.", 6000);
      this.close();
      this.onDone(result);
    } catch (e) {
      this.error = str(e && e.message ? e.message : e) || "Could not write the generated items.";
      this.busy = false;
      this.render();
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}

module.exports = { WeakSpotModal };
