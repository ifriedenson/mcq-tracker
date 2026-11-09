"use strict";
const { QtModal } = require("./a11y");
/*
 * The presentation windows. Derivation and navigation stay in
 * canvas-presentations.js; these only draw the plan they are given and, for the
 * walkthrough, ask that module for the clamped next or previous step.
 */
const { Modal } = require("obsidian");
const presentations = require("./canvas-presentations");

class PresentationPlanModal extends QtModal {
  constructor(app, report) {
    super(app);
    this.report = report || { slides: [], unplaced: [], summary: "" };
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("qt-presentation-plan");
    contentEl.createEl("h3", { text: "Presentation plan" });
    contentEl.createEl("p", { cls: "setting-item-description", text: this.report.summary });
    if (!this.report.slides.length) {
      contentEl.createDiv({ cls: "qt-hint", text: "This board has no slides." });
    }
    for (const slide of this.report.slides) {
      const section = contentEl.createDiv({ cls: "qt-presentation-step" });
      section.createEl("h4", { text: slide.number + ". " + slide.title + " (" + slide.kind + ")" });
      if (!slide.members.length) {
        section.createDiv({ cls: "qt-hint", text: "This step has no cards." });
      } else {
        const list = section.createEl("ul", { cls: "qt-presentation-cards" });
        for (const member of slide.members) list.createEl("li", { text: member });
        if (slide.more) {
          section.createDiv({ cls: "qt-hint", text: slide.more + " more card" + (slide.more === 1 ? "" : "s") + " beyond the limit." });
        }
      }
      if (slide.body) section.createEl("p", { cls: "qt-presentation-body", text: slide.body });
      if (slide.links.length) {
        const links = section.createDiv({ cls: "qt-presentation-links" });
        links.createEl("h5", { text: "Links out (" + (slide.links.length + slide.linksMore) + ")" });
        const list = links.createEl("ul", { cls: "qt-presentation-cards" });
        for (const link of slide.links) list.createEl("li", { text: link });
        if (slide.linksMore) {
          links.createDiv({ cls: "qt-hint", text: slide.linksMore + " more link" + (slide.linksMore === 1 ? "" : "s") + "." });
        }
      }
    }
    if (this.report.unplaced.length) {
      const loose = contentEl.createDiv({ cls: "qt-presentation-unplaced" });
      loose.createEl("h4", { text: "Not on a slide (" + this.report.unplaced.length + ")" });
      const list = loose.createEl("ul", { cls: "qt-presentation-cards" });
      for (const card of this.report.unplaced) list.createEl("li", { text: card.label });
    }
    const done = contentEl.createEl("button", { text: "Done", cls: "qt-done" });
    done.addEventListener("click", () => this.close());
  }

  onClose() {
    this.contentEl.empty();
  }
}

class PresentationModal extends QtModal {
  constructor(app, plan, onMove) {
    super(app);
    this.plan = plan || { slides: [] };
    this.index = 0;
    this.onMove = typeof onMove === "function" ? onMove : null;
    this.keysBound = false;
  }

  slide() {
    return this.plan.slides[this.index] || null;
  }

  onOpen() {
    this.contentEl.addClass("qt-presentation");
    this.render();
  }

  render() {
    const { contentEl } = this;
    contentEl.empty();
    const slide = this.slide();
    if (!slide) {
      contentEl.createDiv({ cls: "qt-hint", text: "That presentation has no slides." });
      return;
    }
    contentEl.createEl("h3", { text: slide.title });
    contentEl.createEl("p", {
      cls: "setting-item-description",
      text: "Slide " + slide.number + " of " + this.plan.slides.length,
    });
    if (slide.members.length) {
      const list = contentEl.createEl("ul", { cls: "qt-presentation-cards" });
      for (const member of slide.members) list.createEl("li", { text: member.label });
      if (slide.more) {
        contentEl.createDiv({ cls: "qt-hint", text: slide.more + " more card" + (slide.more === 1 ? "" : "s") + "." });
      }
    }
    if (slide.body) contentEl.createEl("p", { cls: "qt-presentation-body", text: slide.body });
    if (slide.links.length) {
      const links = contentEl.createDiv({ cls: "qt-presentation-links" });
      links.createEl("h5", { text: "Links out (" + (slide.links.length + slide.linksMore) + ")" });
      const list = links.createEl("ul", { cls: "qt-presentation-cards" });
      for (const link of slide.links) list.createEl("li", { text: link.label });
    }
    const row = contentEl.createDiv({ cls: "qt-presentation-controls" });
    const back = row.createEl("button", { text: "Previous", cls: "qt-presentation-previous" });
    back.disabled = this.index === 0;
    back.addEventListener("click", () => this.previous());
    const next = row.createEl("button", { text: "Next", cls: "qt-presentation-next" });
    next.disabled = this.index >= this.plan.slides.length - 1;
    next.addEventListener("click", () => this.next());
    const exit = row.createEl("button", { text: "Exit", cls: "qt-presentation-exit" });
    exit.addEventListener("click", () => this.close());
    this.bindKeys();
  }

  /** Arrow keys move and Escape exits, when Obsidian gave this window a scope. */
  bindKeys() {
    if (this.keysBound) return;
    this.keysBound = true;
    const scope = this.scope;
    if (!scope || typeof scope.register !== "function") return;
    try {
      scope.register([], "ArrowRight", () => {
        this.next();
        return false;
      });
      scope.register([], "ArrowLeft", () => {
        this.previous();
        return false;
      });
      scope.register([], "Escape", () => {
        this.close();
        return false;
      });
    } catch (error) {
      /* the buttons still move between slides */
    }
  }

  go(delta) {
    const step = presentations.moveSlide(this.plan, this.index, delta);
    if (!step.ok) return step;
    this.index = step.index;
    this.render();
    if (this.onMove) this.onMove(step);
    return step;
  }

  next() {
    return this.go(1);
  }

  previous() {
    return this.go(-1);
  }

  onClose() {
    this.contentEl.empty();
  }
}

module.exports = { PresentationModal, PresentationPlanModal };
