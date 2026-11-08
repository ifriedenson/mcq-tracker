"use strict";
const { Modal, Notice, Platform, Setting } = require("obsidian");
const { QUICK_START_URL } = require("./empty-state");
const { openExternal } = require("./settings-ui");
const { supportLinks } = require("./support");
const {
  WELCOME_EXAMPLE,
  WELCOME_MODULE_INFO,
  WELCOME_PRESETS,
  WELCOME_SETUP_STEPS,
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
    if (this.step === 0) {
      this.renderQuickStart(card);
      return;
    }
    card.createDiv({ cls: "qt-welcome-progress", text: this.step === 1 ? "Optional setup" : "More workflows" });
    if (this.step === 1) this.renderModules(card);
    else this.renderGuide(card);
  }

  renderQuickStart(card) {
    card.createDiv({ cls: "qt-welcome-kicker", text: "Start here" });
    card.createEl("h2", { text: "Welcome to MCQ Tracker" });
    card.createEl("p", {
      cls: "qt-welcome-lead",
      text: "Turn a question note into practice, and let the plugin schedule the next review. No setup is needed to try it.",
    });

    const setup = card.createDiv({ cls: "qt-welcome-setup" });
    WELCOME_SETUP_STEPS.forEach((step, index) => {
      const item = setup.createDiv({ cls: "qt-welcome-setup-step" });
      item.createSpan({ cls: "qt-welcome-number", text: String(index + 1) });
      const copy = item.createDiv({ cls: "qt-welcome-setup-copy" });
      copy.createEl("strong", { text: step.title });
      copy.createDiv({ cls: "qt-welcome-step-body", text: step.body });
    });

    const example = card.createDiv({ cls: "qt-welcome-example" });
    example.createEl("h3", { text: "Example question" });
    example.createEl("p", { cls: "qt-welcome-example-question", text: WELCOME_EXAMPLE.question });
    const choices = example.createEl("ul", { cls: "qt-welcome-example-choices" });
    WELCOME_EXAMPLE.choices.forEach((choice, index) => choices.createEl("li", { text: `${"ABCD"[index]}. ${choice}` }));
    const exampleActions = example.createDiv({ cls: "qt-welcome-actions" });
    const exampleButton = exampleActions.createEl("button", {
      text: "Try the example question",
      cls: "mod-cta qt-primary",
    });
    exampleButton.addEventListener("click", async () => {
      exampleButton.disabled = true;
      exampleButton.setText("Adding...");
      this.finish();
      try {
        await this.plugin.openWelcomeExample();
      } catch (e) {
        new Notice(String((e && e.message) || e) || "Could not create the example question.", 10000);
      }
    });
    example.createDiv({
      cls: "qt-welcome-hint",
      text: "Adds one ordinary note to Questions and opens it in Practice. You can edit or delete it like any other note.",
    });

    this.renderAi(card);

    const actions = card.createDiv({ cls: "qt-welcome-actions" });
    actions.createEl("button", { text: "Open practice" }).addEventListener("click", () => {
      this.finish();
      this.plugin.activateView();
    });
    actions.createEl("button", { text: "Skip for now" }).addEventListener("click", () => this.finish());
    const links = card.createDiv({ cls: "qt-welcome-links" });
    links
      .createEl("button", { text: "Choose modules", cls: "qt-link" })
      .addEventListener("click", () => {
        this.step = 1;
        this.render();
      });
    links
      .createEl("button", { text: "More workflows", cls: "qt-link" })
      .addEventListener("click", () => {
        this.step = 2;
        this.render();
      });

    this.renderSupport(card);
  }

  renderAi(card) {
    const section = card.createDiv({ cls: "qt-welcome-ai" });
    section.createEl("h3", { text: "Optional: AI study agent" });
    const status = section.createDiv({ cls: "qt-welcome-ai-status" });
    status.setAttr("aria-live", "polite");

    if (!Platform.isDesktopApp) {
      status.setText("OpenCode is desktop-only. On mobile, add a Direct API provider key in Settings.");
      return;
    }

    const ai = this.plugin.settings.ai || {};
    const installed = !!(ai.managedBinary || ai.binaryPath || (this.plugin.manager && this.plugin.manager.foundPath));
    if (installed) {
      status.setText(
        `OpenCode is installed${ai.installedVersion ? ` (v${ai.installedVersion})` : ""}. Add a provider key in Settings, MCQ Tracker, AI to chat.`
      );
      this.renderAiSettingsLink(section);
      return;
    }

    section.createEl("p", {
      cls: "qt-welcome-hint",
      text: "Install OpenCode here if you want the desktop AI agent. The installer downloads the supported 1.x build from GitHub, checks its SHA-256, and keeps it outside your vault.",
    });
    const actions = section.createDiv({ cls: "qt-welcome-actions" });
    const install = actions.createEl("button", { text: "Install OpenCode", cls: "mod-cta" });
    install.addEventListener("click", async () => {
      install.disabled = true;
      install.setText("Installing...");
      status.setText("Preparing the OpenCode download...");
      try {
        const result = await this.plugin.installOpenCodeFromWelcome((message) => status.setText(message));
        const version = result && result.version ? ` v${result.version}` : "";
        status.setText(
          result && result.already
            ? "OpenCode is already installed. Add a provider key in Settings, MCQ Tracker, AI to chat."
            : `OpenCode${version} installed. Add a provider key in Settings, MCQ Tracker, AI to chat.`
        );
        install.setText("Installed");
      } catch (e) {
        status.setText(`OpenCode install failed: ${String((e && e.message) || e)}`);
        install.disabled = false;
        install.setText("Try again");
      }
    });
    actions
      .createEl("button", { text: "Use Direct API", cls: "qt-link" })
      .addEventListener("click", () => this.plugin.openSettings());
  }

  renderAiSettingsLink(section) {
    const actions = section.createDiv({ cls: "qt-welcome-actions" });
    actions
      .createEl("button", { text: "Open settings" })
      .addEventListener("click", () => this.plugin.openSettings());
    actions
      .createEl("button", { text: "Use Direct API", cls: "qt-link" })
      .addEventListener("click", () => this.plugin.openSettings());
  }

  renderSupport(card) {
    const links = supportLinks(this.plugin.settings.support);
    const support = card.createDiv({ cls: "qt-welcome-support" });
    support.createSpan({ cls: "qt-welcome-support-label", text: "Help and feedback" });
    if (links.feedback) {
      support
        .createEl("button", { text: "Send feedback", cls: "qt-link" })
        .addEventListener("click", () => openExternal(links.feedback));
    }
    if (links.donation) {
      support
        .createEl("button", { text: "Support the plugin", cls: "qt-link" })
        .addEventListener("click", () => openExternal(links.donation));
    }
    support
      .createEl("button", { text: "Read the quick start guide", cls: "qt-link" })
      .addEventListener("click", () => openExternal(QUICK_START_URL));
  }

  renderModules(card) {
    card.createEl("h2", { text: "Choose modules" });
    card.createEl("p", {
      cls: "qt-welcome-lead",
      text: "This is optional. MCQ Tracker is on by default. Pick a starting point, then adjust any switch. Turning a module off hides its views and buttons, but never deletes notes, cards, schedules or settings.",
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
    card.createEl("h2", { text: "More workflows" });
    card.createEl("p", { cls: "qt-welcome-lead", text: "These workflows are optional. You can reopen this guide from the command palette or Settings, Global, About." });
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
    row.createEl("button", { text: "Back to quick start", cls: "qt-link" }).addEventListener("click", () => {
      this.step = 0;
      this.render();
    });
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
