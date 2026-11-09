"use strict";
/*
 * A small inline Quick Ask panel, modelled on the interaction idea of Copilot's
 * Quick Ask without using its AGPL source, prompts or styles. It reuses the
 * plugin's existing chat provider, request limits and note-context guards.
 */
const { Modal, Notice } = require("obsidian");
const { str } = require("./util");
const { renderMarkdownInto } = require("./view-helpers");
const { buildGeneralContext } = require("./opencode-client");
const {
  QUICK_ACTIONS,
  quickAction,
  quickAskContext,
  quickAskQuestion,
  quickAskSystem,
  canReplaceSelection,
} = require("./quick-ask");
const { normalizeStudyCommands, applyStudyCommand } = require("./study-commands");
const { insertReplyIntoNote } = require("./agent-note");

class QuickAskModal extends Modal {
  constructor(app, plugin, options) {
    super(app);
    const opts = options && typeof options === "object" ? options : {};
    this.plugin = plugin;
    this.context = {
      path: str(opts.path).trim(),
      title: str(opts.title).trim(),
      text: str(opts.text),
      selection: str(opts.selection),
    };
    this.editor = opts.editor || null;
    if (this.editor && typeof this.editor.getSelection === "function") {
      this.context.selection = str(this.editor.getSelection());
    }
    this.from = opts.from || (this.editor && typeof this.editor.getCursor === "function" ? this.editor.getCursor("from") : null);
    this.to = opts.to || (this.editor && typeof this.editor.getCursor === "function" ? this.editor.getCursor("to") : null);
    this.originalSelection = this.context.selection;
    this.includeNote = opts.includeNote === true;
    this.commands = normalizeStudyCommands(opts.commands);
    this.action = str(opts.action).trim();
    this.answer = "";
    this.history = [];
    this.busy = false;
    this.question = str(opts.question).trim();
    if (!this.action) this.action = this.context.selection ? "explain" : "";
  }

  onOpen() {
    this.contentEl.addClass("qt-quick-ask");
    this.render();
    if (this.input && typeof this.input.focus === "function") this.input.focus();
  }

  actionValue() {
    if (this.action.startsWith("command:")) return this.action;
    return quickAction(this.action) ? this.action : "";
  }

  currentCommand() {
    if (!this.action.startsWith("command:")) return null;
    const id = this.action.slice("command:".length);
    return this.commands.find((command) => command.id === id) || null;
  }

  commandContext() {
    return {
      path: this.context.path,
      title: this.context.title,
      note: this.includeNote ? this.context.text : "",
      selection: this.context.selection,
      text: this.context.text,
    };
  }

  promptForAction() {
    const command = this.currentCommand();
    if (command) return applyStudyCommand(command, this.commandContext());
    const action = quickAction(this.action);
    return action ? action.prompt : "";
  }

  render() {
    const root = this.contentEl;
    root.empty();
    root.createEl("h3", { text: "Quick Ask" });
    const source = this.context.path
      ? `Asking beside ${this.context.title || this.context.path}.`
      : "Ask about your selection, a note, or anything study-related.";
    root.createDiv({
      cls: "qt-hint",
      text: `${source} This uses the same AI provider, request cap and note-context rules as the Study agent.`,
    });

    const top = root.createDiv({ cls: "qt-row qt-small-row" });
    this.actionSelect = top.createEl("select", { cls: "qt-select", attr: { "aria-label": "Quick Ask action" } });
    this.actionSelect.createEl("option", { value: "", text: "Custom question" });
    for (const action of QUICK_ACTIONS) this.actionSelect.createEl("option", { value: action.id, text: action.label });
    for (const command of this.commands) {
      this.actionSelect.createEl("option", { value: `command:${command.id}`, text: `/${command.id} — ${command.name}` });
    }
    this.actionSelect.value = this.actionValue();
    this.actionSelect.addEventListener("change", () => {
      this.action = this.actionSelect.value;
      const prompt = this.promptForAction();
      if (this.input) {
        this.input.value = prompt;
        this.input.focus();
      }
    });

    if (this.context.text) {
      const noteRow = root.createEl("label", { cls: "qt-row qt-small-row qt-quick-note" });
      this.noteToggle = noteRow.createEl("input", { type: "checkbox", attr: { "aria-label": "Include the full note" } });
      this.noteToggle.checked = this.includeNote;
      noteRow.appendText(" Include the full note (otherwise only the selection is sent)");
      this.noteToggle.addEventListener("change", () => {
        this.includeNote = this.noteToggle.checked === true;
        if (this.currentCommand()) {
          this.input.value = this.promptForAction();
        }
      });
      if (this.context.selection) {
        root.createDiv({
          cls: "qt-hint",
          text: `Selection attached (${this.context.selection.length.toLocaleString()} characters).`,
        });
      }
    }

    this.input = root.createEl("textarea", {
      cls: "qt-chat-input qt-quick-input",
      attr: { rows: "3", placeholder: "Ask a question, or choose an action above...", "aria-label": "Quick Ask question" },
    });
    this.input.value = this.question || this.promptForAction();
    this.input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
      event.preventDefault();
      this.ask();
    });

    const sendRow = root.createDiv({ cls: "qt-row qt-small-row" });
    this.askButton = sendRow.createEl("button", { text: "Ask", cls: "mod-cta" });
    this.askButton.addEventListener("click", () => this.ask());
    this.newButton = sendRow.createEl("button", { text: "New question" });
    this.newButton.addEventListener("click", () => this.newQuestion());
    this.status = sendRow.createDiv({ cls: "qt-hint qt-quick-status" });

    this.answerEl = root.createDiv({ cls: "qt-quick-answer" });
    this.actionsRow = root.createDiv({ cls: "qt-row qt-small-row qt-quick-actions" });
    this.copyButton = this.actionsRow.createEl("button", { text: "Copy" });
    this.copyButton.addEventListener("click", () => this.copyAnswer());
    this.insertButton = this.actionsRow.createEl("button", { text: "Insert at cursor" });
    this.insertButton.addEventListener("click", () => this.insertAnswer());
    if (this.originalSelection) {
      this.replaceButton = this.actionsRow.createEl("button", { text: "Replace selection" });
      this.replaceButton.addEventListener("click", () => this.replaceAnswer());
    }
    this.paintAnswer();
  }

  paintAnswer() {
    if (!this.answerEl) return;
    this.answerEl.empty();
    if (this.answer) {
      renderMarkdownInto(this.app, this.answer, this.answerEl.createDiv({ cls: "qt-quick-answer-text" }), this.context.path || "", this);
    } else {
      const hint = this.busy
        ? "Working..."
        : this.originalSelection
          ? "The answer appears here. Nothing is written until you press Insert or Replace."
          : "The answer appears here. Nothing is written until you press Insert.";
      this.answerEl.createDiv({ cls: "qt-hint", text: hint });
    }
    for (const button of [this.copyButton, this.insertButton, this.replaceButton]) {
      if (button) button.disabled = !this.answer || this.busy;
    }
    if (this.askButton) this.askButton.disabled = this.busy;
  }

  async ask() {
    if (this.busy) return;
    const text = quickAskQuestion(this.input ? this.input.value : "", this.action.startsWith("command:") ? "" : this.action);
    if (!text) {
      if (this.status) this.status.setText("Type a question or choose an action first.");
      return;
    }
    if (!this.plugin || !this.plugin.settings || this.plugin.settings.ai.enabled !== true) {
      if (this.status) this.status.setText("Turn on AI features first (Settings, MCQ Tracker, AI).");
      return;
    }
    this.busy = true;
    this.answer = "";
    if (this.status) this.status.setText("Working...");
    this.paintAnswer();
    try {
      const base = buildGeneralContext(
        this.app,
        "tutor",
        this.plugin.settings.ai.tutorRole,
        "",
      );
      const context = quickAskContext(this.context, {
        includeNote: this.includeNote,
        includeSelection: true,
      });
      const system = quickAskSystem(base, context);
      const messages = this.history.concat([{ role: "user", content: text }]);
      const reply = await this.plugin.aiChat(system, messages, { feature: "chat" });
      const answer = str(reply).trim();
      if (!answer) throw new Error("The provider returned an empty reply.");
      this.answer = answer;
      this.history = messages.concat([{ role: "assistant", content: answer }]);
      if (this.input) this.input.value = "";
      if (this.status) this.status.setText("Answer ready. Ask a follow-up, or copy or insert it.");
    } catch (e) {
      if (this.status) this.status.setText(str(e && e.message ? e.message : e) || "Quick Ask failed.");
    } finally {
      this.busy = false;
      this.paintAnswer();
    }
  }

  newQuestion() {
    if (this.busy) return;
    this.answer = "";
    this.history = [];
    this.action = "";
    if (this.actionSelect) this.actionSelect.value = "";
    if (this.input) this.input.value = "";
    if (this.status) this.status.setText("");
    this.paintAnswer();
    if (this.input && typeof this.input.focus === "function") this.input.focus();
  }

  async copyAnswer() {
    if (!this.answer) return;
    try {
      const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : null;
      if (!clipboard || typeof clipboard.writeText !== "function") throw new Error("Clipboard unavailable");
      await clipboard.writeText(this.answer);
      if (this.status) this.status.setText("Copied to the clipboard.");
    } catch (e) {
      new Notice("Could not copy the answer. Select it and copy it instead.", 7000);
    }
  }

  async insertAnswer() {
    if (!this.answer) return;
    try {
      if (this.editor && typeof this.editor.replaceRange === "function" && typeof this.editor.getCursor === "function") {
        const cursor = this.editor.getCursor("to");
        this.editor.replaceRange(this.answer, cursor, cursor);
        if (this.status) this.status.setText("Inserted at the cursor.");
        return;
      }
      if (this.editor && typeof this.editor.replaceSelection === "function") {
        this.editor.replaceSelection(this.answer);
        if (this.status) this.status.setText("Inserted at the cursor.");
        return;
      }
      const result = await insertReplyIntoNote(this.app, this.answer);
      if (this.status) this.status.setText(result.mode === "append" ? "Added the answer to the end of the note." : "Inserted the answer.");
    } catch (e) {
      new Notice(str(e && e.message ? e.message : e) || "Could not insert the answer.", 8000);
    }
  }

  replaceAnswer() {
    if (!this.answer) return;
    if (!this.editor || !this.originalSelection) {
      new Notice("There is no original selection to replace.");
      return;
    }
    if (!canReplaceSelection(this.editor, this.originalSelection, { from: this.from, to: this.to })) {
      new Notice("The selection changed after Quick Ask opened, so nothing was replaced. Select the text again and retry.", 8000);
      return;
    }
    if (typeof this.editor.replaceSelection !== "function") {
      new Notice("This editor cannot replace the selection.");
      return;
    }
    this.editor.replaceSelection(this.answer);
    if (this.status) this.status.setText("Replaced the original selection.");
  }
}

module.exports = { QuickAskModal };
