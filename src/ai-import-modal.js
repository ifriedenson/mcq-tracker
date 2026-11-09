"use strict";
const { Modal } = require("obsidian");
const { API_PRESETS } = require("./api-client");
const { resolveApiKey } = require("./secret-keys");
const { renderAiConnectionForm } = require("./ai-connection-form");

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
 * This is where a first-time user connects it: the provider is recommended,
 * the key page opens from here, one model is chosen from the fetched list, and
 * the connection is tested before the importer opens. Paste questions stays
 * visible as the offline way forward.
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

    el.createEl("h3", { text: "Connect AI to import a file" });
    el.createEl("p", {
      cls: "qt-hint",
      text:
        "Turning a PDF, PowerPoint or Word file into question notes is the one everyday step that needs AI. " +
        "Practice, timed tests, review and Today, cards, the calendar, assignments, and the reference and AP tools all work without it.",
    });
    el.createEl("p", {
      cls: "qt-hint",
      text:
        "Direct AI uses your own provider key. The file's text is sent to that provider, which may charge for long files. " +
        "The OpenCode agent (desktop) is the other route; its settings are under the advanced section below.",
    });

    const form = el.createDiv({ cls: "qt-onboard-form" });
    renderAiConnectionForm(form, {
      plugin: this.plugin,
      onReady: () => {
        this.close();
        this.plugin.openPdfImport();
      },
      onOffline: () => this.close(),
      onUseOpenCode: () => this.close(),
    });

    el.createEl("p", {
      cls: "qt-hint",
      text:
        "There is no offline PDF-to-question converter. Paste questions instead — Quick add works offline — " +
        "or import ready-made flashcards (Quizlet, Kahoot, Moodle, QTI, GIFT, CSV or Markdown). Both stay local.",
    });
    el.createEl("button", { text: "Close" }).addEventListener("click", () => this.close());
  }
}

module.exports = {
  AiImportHelpModal,
  importAiState,
};
