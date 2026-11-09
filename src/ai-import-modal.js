"use strict";
const { Modal } = require("obsidian");
const { API_PRESETS } = require("./api-client");
const { resolveApiKey } = require("./secret-keys");

/**
 * How ready the current settings are for the one AI-only import path.
 * "off": AI features are disabled. "no-key": Direct AI has no usable key.
 * "ready": the import can open (OpenCode supplies its own provider).
 */
function importAiState(plugin) {
  const ai = (plugin.settings && plugin.settings.ai) || {};
  if (ai.enabled !== true) return "off";
  if (typeof plugin.backend === "function" && plugin.backend() === "opencode") return "ready";
  const api = ai.api || {};
  const preset = API_PRESETS[api.provider] || API_PRESETS.custom;
  if (preset && preset.noKey) return "ready";
  let key = "";
  try {
    key = resolveApiKey(plugin.app, api);
  } catch (e) {
    key = "";
  }
  return key ? "ready" : "no-key";
}

/**
 * The document-to-question import is the one everyday workflow that needs AI.
 * This replaces the old one-line notice with the same split the Start here
 * note, README and website use, plus a direct setup or manual-question action.
 */
class AiImportHelpModal extends Modal {
  constructor(app, plugin, state) {
    super(app);
    this.plugin = plugin;
    this.state = state || importAiState(plugin);
  }

  onOpen() {
    this.render();
  }

  render() {
    const el = this.contentEl;
    el.empty();
    if (typeof el.addClass === "function") el.addClass("qt-ai-import-help");

    el.createEl("h3", {
      text: this.state === "no-key" ? "Add a provider key to import a file" : "Turning a file into questions needs AI",
    });
    el.createEl("p", {
      cls: "qt-hint",
      text:
        "Turning a PDF, PowerPoint or Word file into question notes is the one everyday step that needs AI. " +
        "Writing question notes by hand, practice, timed tests, review and Today, cards, the calendar, assignments, " +
        "and the reference and AP tools all work without it.",
    });

    el.createEl("h4", { text: "How the import gets AI" });
    const options = el.createEl("ul", { cls: "qt-ai-import-options" });
    options.createEl("li", {
      text:
        "Direct AI: turn on AI features and add a provider key. The file's text is sent to that provider, " +
        "which may charge for long files.",
    });
    options.createEl("li", {
      text:
        "OpenCode agent (desktop): install OpenCode and configure a provider there. The agent writes the notes " +
        "in your vault; the file's text still goes to that provider.",
    });

    el.createEl("p", {
      cls: "qt-hint",
      text:
        "There is no offline PDF-to-question converter. If you would rather not enable AI, write the question note " +
        "yourself, or import ready-made flashcards (Quizlet, Kahoot, Moodle, QTI, GIFT, CSV or Markdown). Both stay local.",
    });

    const row = el.createDiv({ cls: "qt-row qt-ai-import-actions" });
    if (this.state === "off") {
      const enable = row.createEl("button", { text: "Enable AI features and open settings", cls: "mod-cta" });
      enable.addEventListener("click", async () => {
        if (!this.plugin.settings.ai) this.plugin.settings.ai = {};
        this.plugin.settings.ai.enabled = true;
        await this.plugin.save();
        if (typeof this.plugin.refreshViews === "function") this.plugin.refreshViews();
        this.close();
        this.plugin.openSettings();
      });
    } else if (this.state === "no-key") {
      row
        .createEl("button", { text: "Add a provider key in settings", cls: "mod-cta" })
        .addEventListener("click", () => {
          this.close();
          this.plugin.openSettings();
        });
    }
    row
      .createEl("button", { text: "Write a question note instead" })
      .addEventListener("click", () => {
        this.close();
        this.plugin.openQuickAdd();
      });
    row.createEl("button", { text: "Close" }).addEventListener("click", () => this.close());
  }
}

module.exports = {
  AiImportHelpModal,
  importAiState,
};
