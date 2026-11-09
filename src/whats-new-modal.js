"use strict";
const { QtModal } = require("./a11y");
const { Modal } = require("obsidian");
const { markWhatsNewSeen } = require("./whats-new");

class WhatsNewModal extends QtModal {
  constructor(app, plugin, release, options) {
    super(app);
    this.plugin = plugin;
    this.release = release;
    this.automatic = !!(options && options.automatic);
  }

  onOpen() {
    this.modalEl.addClass("qt-whats-new-modal");
    this.render();
  }

  onClose() {
    markWhatsNewSeen(this.app, this.release && this.release.version);
    this.contentEl.empty();
  }

  render() {
    const el = this.contentEl;
    el.empty();
    const release = this.release;
    const card = el.createDiv({ cls: "qt-whats-new" });
    card.createDiv({
      cls: "qt-whats-new-kicker",
      text: this.automatic ? `Updated to ${release.version}` : "What's new",
    });
    card.createEl("h2", { text: release.title });
    card.createDiv({ cls: "qt-whats-new-meta", text: `Version ${release.version} · ${release.date}` });
    card.createEl("p", { cls: "qt-whats-new-lead", text: release.summary });

    const list = card.createDiv({ cls: "qt-whats-new-list" });
    for (let index = 0; index < release.highlights.length; index++) {
      const item = release.highlights[index];
      const row = list.createDiv({ cls: "qt-whats-new-item" });
      row.createSpan({ cls: "qt-whats-new-number", text: String(index + 1).padStart(2, "0") });
      const copy = row.createDiv({ cls: "qt-whats-new-copy" });
      copy.createEl("h3", { text: item.title });
      copy.createEl("p", { text: item.body });
    }

    const actions = card.createDiv({ cls: "qt-whats-new-actions" });
    const done = actions.createEl("button", { text: "Got it", cls: "mod-cta" });
    done.addEventListener("click", () => this.close());
    if (!this.plugin.mcqEnabled || this.plugin.mcqEnabled()) {
      const practice = actions.createEl("button", { text: "Open practice" });
      practice.addEventListener("click", () => {
        this.close();
        Promise.resolve(this.plugin.activateView()).catch(() => {});
      });
    }
    card.createDiv({
      cls: "qt-whats-new-foot",
      text: "Reopen this from the command palette with Show what's new.",
    });
  }
}

module.exports = { WhatsNewModal };
