"use strict";
const { ItemView } = require("obsidian");
const { VIEW_TYPE_IMPORT_WINDOW } = require("./constants");
const { PdfImportModal } = require("./import-modal");

/**
 * A full popout window for one import session.
 *
 * The modal and its panel are owned by the plugin, not this view. Closing the
 * popout only detaches the panel: the batch keeps running, and opening the
 * import again reattaches the same panel with its review/progress state.
 */
class ImportWindowView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.modal = null;
  }

  getViewType() {
    return VIEW_TYPE_IMPORT_WINDOW;
  }

  getDisplayText() {
    return "Import questions";
  }

  getIcon() {
    return "file-plus";
  }

  async onOpen() {
    this.contentEl.addClass("qt-root");
    this.contentEl.addClass("qt-import-window");
    const session = this.liveSession();
    if (session) this.attachSession(session);
    else this.createSession();
  }

  /** The session outlives this leaf, so a closed popout can be opened again. */
  liveSession() {
    const session = this.plugin.importSession;
    if (!session || !session.modal || session.modal.closed) {
      if (this.plugin.importSession === session) this.plugin.importSession = null;
      return null;
    }
    return session;
  }

  createSession() {
    const opts = this.plugin.pendingImportOptions || {};
    this.plugin.pendingImportOptions = null;
    const panelEl = this.createPanel();
    const modal = new PdfImportModal(this.app, this.plugin, opts);
    modal.windowMode = true;
    modal.contentEl = panelEl;
    modal.modalEl = panelEl;
    const session = { modal, panelEl, view: this, leaf: this.leaf || null, closed: false };
    modal.close = () => this.closeSession(session);
    this.plugin.importSession = session;
    this.attachSession(session);
    modal.onOpen();
  }

  createPanel() {
    // The panel must outlive the popout document. Create it in the main
    // workspace document, then let appendChild adopt it into the popout.
    try {
      const host = this.app && this.app.workspace && this.app.workspace.containerEl;
      const doc = host && host.ownerDocument;
      if (doc && typeof doc.createElement === "function") {
        const panel = doc.createElement("div");
        panel.className = "qt-import-panel";
        return panel;
      }
    } catch (e) {
      /* fall back to the view document */
    }
    return this.contentEl.createDiv({ cls: "qt-import-panel" });
  }

  attachSession(session) {
    // Move the panel rather than rebuilding it, so review choices and the
    // current progress screen survive a close/reopen of the window.
    this.contentEl.empty();
    this.contentEl.appendChild(session.panelEl);
    this.modal = session.modal;
    session.view = this;
    session.leaf = this.leaf || null;
  }

  /** An explicit Cancel/Close ends the batch and its notice. A window close does not. */
  closeSession(session) {
    if (!session || session.closed) return;
    session.closed = true;
    if (this.plugin.importSession === session) this.plugin.importSession = null;
    const owner = session.view;
    session.view = null;
    session.leaf = null;
    if (!session.modal.closed) session.modal.onClose();
    if (owner && owner.leaf && owner.leaf.view === owner && typeof owner.leaf.detach === "function") owner.leaf.detach();
  }

  async onClose() {
    // Obsidian calls this when the popout is closed or the leaf is detached.
    // Detach only the panel; PdfImportModal.onClose() is reserved for an explicit
    // cancel and would abort the in-flight import and hide the progress notice.
    const session = this.plugin.importSession;
    if (session && session.view === this) {
      session.view = null;
      session.leaf = null;
    }
    this.modal = null;
    this.contentEl.empty();
  }
}

module.exports = { ImportWindowView };
