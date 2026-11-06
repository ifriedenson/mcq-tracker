"use strict";
/*
 * A small Quick Chat surface. It deliberately does not call a provider itself:
 * submitting dispatches into the active Study agent ChatPanel, which already
 * owns model resolution, mentions, the local budget, streaming, Stop and error
 * handling. This keeps Quick Chat on the same path as the full panel.
 */
const { Modal, Notice } = require("obsidian");
const { str } = require("./util");

class QuickChatModal extends Modal {
  constructor(app, plugin, options) {
    super(app);
    const opts = options && typeof options === "object" ? options : {};
    this.plugin = plugin;
    this.initialPrompt = str(opts.prompt);
    this.submitted = false;
    this.statusText = "";
  }

  onOpen() {
    this.contentEl.addClass("qt-quick-chat");
    this.render();
    this.focus();
  }

  render() {
    const root = this.contentEl;
    root.empty();
    root.createEl("h3", { text: "Quick Chat" });
    root.createDiv({
      cls: "qt-hint",
      text: "Sends through the active Study agent conversation: same model, mentions, context switches, token budget, streaming and Stop.",
    });
    this.input = root.createEl("textarea", {
      cls: "qt-chat-input qt-quick-chat-input",
      attr: { rows: "3", placeholder: "Ask a quick question..." },
    });
    this.input.value = this.initialPrompt;
    this.input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
      event.preventDefault();
      this.submit();
    });
    const row = root.createDiv({ cls: "qt-row qt-small-row" });
    this.sendBtn = row.createEl("button", { text: "Send to Study agent", cls: "mod-cta" });
    this.sendBtn.addEventListener("click", () => this.submit());
    const close = row.createEl("button", { text: "Close" });
    close.addEventListener("click", () => this.close());
    this.status = row.createDiv({ cls: "qt-hint qt-quick-chat-status" });
    if (this.statusText) this.status.setText(this.statusText);
  }

  focus() {
    if (this.input && typeof this.input.focus === "function") this.input.focus();
    if (this.input && typeof this.input.select === "function") this.input.select();
  }

  /** Dispatch exactly once; repeated clicks or command invocations cannot double-send. */
  submit() {
    if (this.submitted) return false;
    const text = str(this.input ? this.input.value : "").trim();
    if (!text) {
      if (this.status) this.status.setText("Type a question first.");
      return false;
    }
    this.submitted = true;
    if (this.sendBtn) this.sendBtn.disabled = true;
    if (this.status) this.status.setText("Sending to the Study agent...");
    try {
      const pending = this.plugin.quickChat(text);
      if (pending && typeof pending.catch === "function") {
        pending.catch((e) => {
          new Notice(str(e && e.message ? e.message : e) || "Quick Chat could not send.", 8000);
        });
      }
      this.close();
      return true;
    } catch (e) {
      this.submitted = false;
      if (this.sendBtn) this.sendBtn.disabled = false;
      if (this.status) this.status.setText(str(e && e.message ? e.message : e) || "Quick Chat could not send.");
      return false;
    }
  }

  onClose() {
    this.contentEl.empty();
    if (typeof this.onClosed === "function") this.onClosed();
  }
}

module.exports = { QuickChatModal };
