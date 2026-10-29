"use strict";
const { Modal, Setting } = require("obsidian");
const { QUICK_START_URL } = require("./empty-state");
const { openExternal } = require("./settings-ui");
const {
  WELCOME_MODULE_INFO,
  WELCOME_PRESETS,
  WELCOME_STEPS,
  loadWelcomeState,
  markWelcomeSeen,
  markWelcomeStep,
} = require("./welcome");

class WelcomeModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.step = 0;
    this.state = loadWelcomeState(app);
  }

  onOpen() {
    this.modalEl.addClass("qt-welcome-modal");
    this.render();
  }

  onClose() {
    markWelcomeSeen(this.app, this.plugin.manifest && this.plugin.manifest.version);
    this.contentEl.empty();
  }

  finish() {
    markWelcomeSeen(this.app, this.plugin.manifest && this.plugin.manifest.version);
    this.close();
  }

  render() {
    const el = this.contentEl;
    el.empty();
    const card = el.createDiv({ cls: "qt-welcome" });
    card.createDiv({ cls: "qt-welcome-progress", text: `Step ${this.step + 1} of 3` });
    if (this.step === 0) this.renderWelcome(card);
    else if (this.step === 1) this.renderModules(card);
    else this.renderGuide(card);
  }

  renderWelcome(card) {
    card.createEl("h2", { text: "Welcome to MCQ Tracker" });
    card.createEl("p", {
      cls: "qt-welcome-lead",
      text: "Practice like the exam, review with spaced repetition, and optionally manage flashcards, a course calendar and local reference tools.",
    });
    const list = card.createEl("ul", { cls: "qt-welcome-list" });
    for (const item of [
      ["Practice questions", "Multiple choice, student-produced responses and timed tests."],
      ["Flashcards and vocabulary", "Decks, cloze and image occlusion, using the same review schedule."],
      ["Calendar and exams", "Classes, countdowns and study sessions from free periods."],
    ]) {
      const li = list.createEl("li");
      li.createEl("strong", { text: item[0] + ". " });
      li.createSpan({ text: item[1] });
    }
    const row = card.createDiv({ cls: "qt-welcome-actions" });
    row.createEl("button", { text: "Get started", cls: "mod-cta qt-primary" }).addEventListener("click", () => {
      this.step = 1;
      this.render();
    });
    row.createEl("button", { text: "Skip for now" }).addEventListener("click", () => this.finish());
    card
      .createEl("button", { text: "Read the quick start guide", cls: "qt-link" })
      .addEventListener("click", () => openExternal(QUICK_START_URL));
  }

  renderModules(card) {
    card.createEl("h2", { text: "Choose what you need" });
    card.createEl("p", {
      cls: "qt-welcome-lead",
      text: "Pick a starting point, then adjust any switch. Turning a module off hides its views and buttons, but never deletes notes, cards, schedules or settings.",
    });
    const presets = card.createDiv({ cls: "qt-welcome-presets" });
    for (const preset of WELCOME_PRESETS) {
      const button = presets.createEl("button", { cls: "qt-welcome-preset" });
      button.createEl("strong", { text: preset.label });
      button.createDiv({ cls: "qt-welcome-preset-desc", text: preset.description });
      button.addEventListener("click", async () => {
        await this.plugin.applyWelcomePreset(preset.id);
        this.render();
      });
    }

    card.createEl("h3", { text: "Modules" });
    for (const info of WELCOME_MODULE_INFO) {
      new Setting(card)
        .setName(info.label)
        .setDesc(info.description)
        .addToggle((toggle) =>
          toggle.setValue(this.plugin.welcomeModuleOn(info.id)).onChange(async (value) => {
            await this.plugin.setWelcomeModule(info.id, value);
          })
        );
    }
    const row = card.createDiv({ cls: "qt-welcome-actions" });
    row.createEl("button", { text: "Back" }).addEventListener("click", () => {
      this.step = 0;
      this.render();
    });
    row.createEl("button", { text: "Continue", cls: "mod-cta qt-primary" }).addEventListener("click", () => {
      this.step = 2;
      this.render();
    });
    card
      .createEl("button", { text: "Open Settings, Global, Modules", cls: "qt-link" })
      .addEventListener("click", () => this.plugin.openSettings());
  }

  renderGuide(card) {
    card.createEl("h2", { text: "How to use it" });
    card.createEl("p", { cls: "qt-welcome-lead", text: "These are the main workflows. You can reopen this guide from the command palette or Settings, Global, About." });
    const list = card.createDiv({ cls: "qt-welcome-steps" });
    for (const step of WELCOME_STEPS) {
      const item = list.createDiv({ cls: "qt-welcome-step" });
      const done = this.state.completed.includes(step.id);
      item.createSpan({ cls: `qt-welcome-check${done ? " is-done" : ""}`, text: done ? "Done" : "To do" });
      item.createEl("strong", { text: step.title });
      item.createDiv({ cls: "qt-welcome-step-body", text: step.body });
      item.createEl("button", { text: step.button, cls: "qt-welcome-step-button" }).addEventListener("click", () => {
        markWelcomeStep(this.app, step.id);
        this.state = loadWelcomeState(this.app);
        this.finish();
        this.runAction(step.action);
      });
    }
    const row = card.createDiv({ cls: "qt-welcome-actions" });
    row.createEl("button", { text: "Back" }).addEventListener("click", () => {
      this.step = 1;
      this.render();
    });
    row.createEl("button", { text: "Open practice", cls: "mod-cta qt-primary" }).addEventListener("click", () => {
      this.finish();
      this.plugin.activateView();
    });
    row.createEl("button", { text: "Reopen this guide later", cls: "qt-link" }).addEventListener("click", () => this.finish());
  }

  runAction(action) {
    if (action === "import") this.plugin.openPdfImport();
    else if (action === "practice") this.plugin.activateView();
    else if (action === "today") this.plugin.activateToday();
    else if (action === "card") this.plugin.openNewCard();
    else if (action === "calendar") this.plugin.activateCalendar();
    else if (action === "settings") this.plugin.openSettings();
  }
}

module.exports = {
  WelcomeModal,
};
