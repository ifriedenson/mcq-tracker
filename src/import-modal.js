"use strict";
const { QtModal } = require("./a11y");
const { Modal, Notice, Platform, Setting, TFile, normalizePath } = require("obsidian");
const { importAiState } = require("./ai-import-modal");
const { FolderSuggest } = require("./modals");
const { ensureFolder, localDate, sleep, str, uniquePath } = require("./util");
const { chunkPages, readPdfPages, slugId } = require("./pdf");
const { DOCUMENT_EXTENSIONS, documentBaseName, documentKind, documentLabel, extensionOf } = require("./documents");
const { readDocumentSource, readPagesForSource } = require("./document-source");
const { AGENT_SYSTEM, agentPrompt, aiFlags, answerKeyText, buildReportMarkdown, carryPassages, ensureProviders, extractNotesChunk, finalizeNote, groupIssues, mergeNotes, modelFromMessages, noteIssues, parseNote } = require("./importer");
const { friendlyError, modelFromString, partsToTurns } = require("./opencode-client");
const { findDuplicateIds, indexOfficialIds, officialIdOf } = require("./filters");
const { friendlyApiError } = require("./api-client");
const { checkDocumentText, summaryText } = require("./import-preflight");
const { ImportCompleteModal } = require("./import-complete-modal");

function importNoticeDocument(app) {
  try {
    const ws = app && app.workspace;
    if (ws && ws.containerEl && ws.containerEl.ownerDocument) return ws.containerEl.ownerDocument;
  } catch (e) {
    /* use the active document */
  }
  return typeof activeDocument !== "undefined" ? activeDocument : null;
}

/** Notices follow the active window; move this one to the main window after creation. */
function importHostWindow(app) {
  try {
    const doc = importNoticeDocument(app);
    if (doc && doc.defaultView && typeof doc.defaultView.setTimeout === "function") return doc.defaultView;
  } catch (e) {
    /* use the focused window */
  }
  if (typeof window !== "undefined" && window && typeof window.setTimeout === "function") return window;
  return typeof activeWindow !== "undefined" ? activeWindow : null;
}

function moveNoticeToMain(notice, doc) {
  if (!notice || !notice.noticeEl || !doc || !doc.body || typeof doc.createElement !== "function") return;
  let container = typeof doc.body.querySelector === "function" ? doc.body.querySelector(".notice-container") : null;
  if (!container) {
    container = doc.createElement("div");
    container.className = "notice-container";
    doc.body.appendChild(container);
  }
  const el = notice.noticeEl;
  if (el.parentNode && el.parentNode !== container) el.parentNode.removeChild(el);
  if (el.parentNode !== container) container.appendChild(el);
}

/** Notice.hide() is the supported API; remove the moved element as a fallback. */
function dismissNotice(notice) {
  if (!notice) return;
  try {
    if (typeof notice.hide === "function") notice.hide();
  } catch (e) {
    /* the popout may already be gone */
  }
  const el = notice.noticeEl;
  try {
    if (el && el.parentNode) el.parentNode.removeChild(el);
    else if (el && typeof el.remove === "function") el.remove();
  } catch (e) {
    /* already detached */
  }
}

class ImportProgressNotice {
  constructor(app, total) {
    this.total = total;
    this.doc = importNoticeDocument(app);
    this.win = importHostWindow(app);
    this.notice = new Notice("Preparing import...", 0);
    moveNoticeToMain(this.notice, this.doc);
    this.fill = null;
    const el = this.notice && this.notice.noticeEl;
    if (el) {
      if (typeof el.addClass === "function") el.addClass("qt-import-progress-notice");
      if (typeof el.createDiv === "function") {
        const track = el.createDiv({ cls: "qt-import-progress-track" });
        this.fill = track.createDiv({ cls: "qt-import-progress-fill" });
      }
    }
  }
  update(label, detail, fraction) {
    const message = detail ? label + "\n" + detail : label;
    if (this.notice && typeof this.notice.setMessage === "function") this.notice.setMessage(message);
    if (this.fill && this.fill.style) this.fill.style.width = Math.round(Math.max(0, Math.min(1, Number(fraction) || 0)) * 100) + "%";
  }
  cancel() { dismissNotice(this.notice); this.notice = null; }
  finish(message) {
    this.cancel();
    // A zero-duration notice lives in the main window even after the popout
    // closes, so its 12 seconds are timed by that window rather than the popout.
    const done = new Notice(message, 0);
    moveNoticeToMain(done, this.doc);
    const win = this.win;
    if (win && typeof win.setTimeout === "function") {
      const timer = win.setTimeout(() => dismissNotice(done), 12000);
      if (timer && typeof timer.unref === "function") timer.unref();
    }
  }
}
class PdfImportModal extends QtModal {
  constructor(app, plugin, options) {
    super(app);
    this.plugin = plugin;
    this.hostWindow = importHostWindow(app);
    const init = options || {};
    this.files = Array.isArray(init.files) ? init.files.filter(Boolean) : init.file ? [init.file] : [];
    if (!this.files.length && init.file) this.files = [init.file];
    this.file = this.files[0] || init.file || null;
    this.vaultDoc = init.vaultDoc || "";
    this.preflight = init.preflight || null;
    this.preflights = Array.isArray(init.preflights) ? init.preflights : [];
    this.preflightBusy = false;
    this.stop = false;
    this.closed = false;
    this.items = [];
    this.warnings = [];
    this.folderTouched = false;
    this.confirming = false;
    this.beforeImages = new Set();
    this.artifacts = null;
    this.agentBefore = null;
    this.batchMode = this.files.length > 1;
    this.batchStarted = false;
    this.batchStopped = false;
    this.batchParent = "";
    this.batchJobs = [];
    this.batchIndex = 0;
    this.batchResults = [];
    this.batchNotes = 0;
    this.progress = null;
    this.progressLabel = "";
    this._nextBatchTimer = null;
    this.finishedBatch = false;
    this.running = false;
    const st = plugin.settings;
    this.meta = Object.assign(
      { test: "", course: "", section: "", domain: "", skill: "", unit: "", difficulty: "", prefix: "", start: "1", pages: "" },
      st.importDefaults || {}
    );
    this.opts = Object.assign({ capture: true, pagePics: false }, st.importOptions || {});
    this.parent = st.importFolder || st.questionFolder || "Questions";
    this.folder = "";
    this.method = this.agentAvailable() ? "agent" : "api";
  }

  agentAvailable() {
    return Platform.isDesktopApp && this.plugin.backend() === "opencode";
  }

  onOpen() {
    if (this.modalEl && typeof this.modalEl.addClass === "function") this.modalEl.addClass("qt-import-modal");
    // File first: the AI gate comes only after the text layer is known to be readable.
    if (importAiState(this.plugin) !== "ready") this.showPreflight();
    else this.showSetup();
  }

  onClose() {
    this.closed = true;
    // A closed preview or a closed failed import must not leave a half-made folder behind.
    // While an import is still running, its own finally cleans up after the last
    // write; cleaning now would race the work in flight and miss later files.
    if (this.progress) { this.progress.cancel(); this.progress = null; }
    if (this._nextBatchTimer) {
      const win = this.hostWindow || (typeof activeWindow !== "undefined" ? activeWindow : null);
      if (win) win.clearTimeout(this._nextBatchTimer);
      this._nextBatchTimer = null;
    }
    if (this.artifacts && !this.artifacts.committed && !this.running) this.cleanupPromise = this.cleanupArtifacts();
    this.contentEl.empty();
    this.plugin.refreshEmptyViews(); // the first-run screen goes away once the new notes are indexed
  }

  status(msg) {
    if (this.statusEl) this.statusEl.setText(msg);
    if (this.batchMode && this.progress) this.progress.update(this.progressLabel || "Importing...", msg, this.batchIndex / Math.max(1, this.batchJobs.length));
  }

  sourceEntries() {
    if (this.files.length) return this.files.map((file) => ({ file, vaultDoc: "" }));
    if (this.file) return [{ file: this.file, vaultDoc: this.vaultDoc || "" }];
    return [];
  }

  fileSummary() {
    const names = this.files.map((file) => file && file.name).filter(Boolean);
    if (!names.length) return this.vaultDoc || "No file chosen";
    if (names.length <= 3) return names.join(", ");
    return names.length + " files chosen";
  }

  modelLabel() {
    const api = this.plugin.settings.ai.api || {};
    return `${api.model || "your AI model"}${api.provider ? ` (${api.provider})` : ""}`;
  }

  autoFolder(name) {
    return normalizePath(`${this.parent}/${name}`);
  }

  /** True when the target is an existing folder that already holds files or subfolders. */
  folderHasFiles(path) {
    const vault = this.app.vault;
    const existing = typeof vault.getFolderByPath === "function"
      ? vault.getFolderByPath(path)
      : vault.getAbstractFileByPath(path);
    return !!(existing && Array.isArray(existing.children) && existing.children.length);
  }

  /** Ask before adding to an occupied folder. Nothing is written unless the user agrees. */
  confirmExistingFolder(path) {
    if (typeof this.plugin.askConfirm !== "function") return Promise.resolve(false);
    return this.plugin.askConfirm(
      "Add to this existing folder?",
      `"${path}" already has files in it. Add the imported questions to it?\n\n` +
        "Existing notes stay as they are. New note names, the copied original file and any pictures are given a free name, and the agent is told not to overwrite existing notes.",
      "Add to this folder"
    );
  }

  /* ---- step 1: check the file locally, before AI setup or any vault write */

  renderSourcePicker(el, onChange) {
    const docs = this.app.vault.getFiles().filter((f) => documentKind(f.path || f.name));
    const picked = new Setting(el).setName("Files").setDesc(this.fileSummary());
    const input = createEl("input", { type: "file", attr: { accept: DOCUMENT_EXTENSIONS.map((e) => "." + e).join(","), multiple: "" } });
    input.multiple = true;
    input.hidden = true;
    input.addEventListener("change", () => {
      const chosen = input.files ? Array.from(input.files) : [];
      if (!chosen.length) return;
      this.files = chosen;
      this.file = chosen[0];
      this.vaultDoc = "";
      this.preflight = null;
      this.preflights = [];
      this.batchMode = chosen.length > 1;
      picked.setDesc(this.fileSummary());
      if (typeof onChange === "function") onChange(chosen.map((file) => file.name), chosen.length);
    });
    picked.addButton((b) => b.setButtonText("Choose files...").onClick(() => input.click()));
    if (docs.length) {
      new Setting(el).setName("...or a file in your vault").addDropdown((d) => {
        d.addOption("", "Choose...");
        for (const f of docs) d.addOption(f.path, f.path);
        d.setValue(this.vaultDoc).onChange((v) => {
          this.vaultDoc = v;
          if (v) {
            this.files = []; this.file = null; this.batchMode = false; this.preflight = null; this.preflights = [];
            picked.setDesc(v);
            if (typeof onChange === "function") onChange([v], 1);
          }
        });
      });
    }
    return picked;
  }

  showPreflight() {
    this.preflight = null;
    const multiple = this.files.length > 1;
    const el = this.contentEl;
    el.empty();
    el.createEl("h3", { text: multiple ? "Import questions from files" : "Import questions from a file" });
    el.createEl("p", {
      cls: "qt-hint",
      text: multiple
        ? "Choose two or more PDFs, PowerPoints or Word files. We'll read each one first and tell you which are usable before you connect AI. Nothing is written to your vault in this step."
        : "Choose a PDF, PowerPoint or Word file. We'll read its text first and tell you whether it is usable before you connect AI. Nothing is written to your vault in this step.",
    });
    this.renderSourcePicker(el);
    this.preflightStatus = el.createDiv({
      cls: "qt-hint",
      text: this.files.length > 1 ? "Ready to check " + this.files.length + " files." : this.file || this.vaultDoc ? "Ready to check this file." : "Choose a file to check.",
    });
    const row = el.createDiv({ cls: "qt-row" });
    row.createEl("button", { text: "Cancel", cls: "qt-grow" }).addEventListener("click", () => this.close());
    const check = row.createEl("button", { text: multiple ? "Check " + this.files.length + " files" : "Check this file", cls: "mod-cta qt-grow" });
    check.addEventListener("click", () => this.runPreflight(check));
    this.renderOfflineButton(el);
  }

  renderOfflineButton(el) {
    el.createEl("button", { text: "Paste questions instead (works offline)" }).addEventListener("click", () => {
      this.close();
      this.plugin.openQuickAdd();
    });
  }

  async runPreflight(button) {
    if (this.files.length > 1) return this.runBatchPreflight(button);
    if (this.preflightBusy) return;
    if (!this.file && !this.vaultDoc) {
      if (this.preflightStatus) this.preflightStatus.setText("Choose a file first.");
      return;
    }
    this.preflightBusy = true;
    if (button) button.disabled = true;
    const status = (message) => {
      if (this.preflightStatus && !this.closed) this.preflightStatus.setText(message);
    };
    status("Reading the file...");
    try {
      const src = await this.readSource();
      if (!src.kind) throw new Error(`This plugin can't read ${src.ext ? `.${src.ext}` : "that kind of"} files.`);
      const read = await this.readPages(src, status, null, "");
      const check = checkDocumentText(read.pages, { kind: src.kind, label: documentLabel(`${src.name}.${src.ext}`) });
      if (!check.ok) {
        this.showPreflightError(check.message);
        return;
      }
      this.preflight = { ...check, sourceName: src.name, sourceKind: src.kind };
      this.showPreflightReady();
    } catch (e) {
      this.showPreflightError(e && e.message ? e.message : String(e));
    } finally {
      this.preflightBusy = false;
      if (button) button.disabled = false;
    }
  }

  async readSourceFor(entry) { return readDocumentSource(this.app, entry); }

  async runBatchPreflight(button) {
    if (this.preflightBusy) return;
    this.preflightBusy = true;
    if (button) button.disabled = true;
    const status = (message) => { if (this.preflightStatus && !this.closed) this.preflightStatus.setText(message); };
    const results = [];
    try {
      for (let i = 0; i < this.files.length; i++) {
        const file = this.files[i];
        status("Checking " + (i + 1) + " of " + this.files.length + ": " + file.name + "...");
        try {
          const src = await this.readSourceFor({ file, vaultDoc: "" });
          if (!src.kind) throw new Error("This plugin can't read " + (src.ext ? "." + src.ext : "that kind of") + " files.");
          const read = await this.readPages(src, status, null, "");
          const check = checkDocumentText(read.pages, { kind: src.kind, label: documentLabel(src.name + "." + src.ext) });
          results.push({ file, name: file.name, ok: !!check.ok, message: check.ok ? "" : check.message, preflight: { ...check, sourceName: src.name, sourceKind: src.kind } });
        } catch (e) {
          results.push({ file, name: file.name, ok: false, message: e && e.message ? e.message : String(e), preflight: null });
        }
      }
      const good = results.filter((entry) => entry.ok);
      if (!good.length) { this.showPreflightError(results[0] ? results[0].message : "No file could be read."); return; }
      this.files = good.map((entry) => entry.file);
      this.preflights = good.map((entry) => entry.preflight);
      this.preflight = this.preflights[0] || null;
      this.batchMode = this.files.length > 1;
      this.showBatchPreflightReady(results);
    } finally {
      this.preflightBusy = false;
      if (button) button.disabled = false;
    }
  }

  showBatchPreflightReady(results) {
    const good = results.filter((entry) => entry.ok);
    const el = this.contentEl;
    el.empty();
    el.createEl("h3", { text: good.length + " of " + results.length + " files are readable" });
    el.createEl("p", { cls: "qt-hint", text: "Nothing has been written to your vault yet. The unreadable files will be skipped." });
    const list = el.createDiv({ cls: "qt-import-file-list" });
    for (const entry of results) {
      const row = list.createDiv({ cls: "qt-import-file-row" });
      row.createSpan({ cls: entry.ok ? "qt-import-file-state is-ready" : "qt-import-file-state is-error", text: entry.ok ? "Readable" : "Skipped" });
      const body = row.createDiv({ cls: "qt-import-file-body" });
      body.createDiv({ cls: "qt-import-file-name", text: entry.name });
      body.createDiv({ cls: "qt-import-file-detail", text: entry.ok ? summaryText(entry.preflight) : entry.message });
    }
    const row = el.createDiv({ cls: "qt-row" });
    row.createEl("button", { text: "Choose other files", cls: "qt-grow" }).addEventListener("click", () => this.showPreflight());
    row.createEl("button", { text: "Continue to AI setup", cls: "mod-cta qt-grow" }).addEventListener("click", () => this.beginAiSetup());
    this.renderOfflineButton(el);
  }

  showPreflightReady() {
    const el = this.contentEl;
    el.empty();
    el.createEl("h3", { text: "This file is readable" });
    el.createEl("p", { cls: "qt-hint", text: summaryText(this.preflight) });
    if (!this.preflight.likelyQuestions) {
      el.createEl("p", {
        cls: "qt-hint",
        text: "No numbered question starts were spotted. The AI will do the real count on the next step.",
      });
    }
    el.createEl("p", {
      cls: "qt-hint",
      text: "Next, connect AI to turn this file into question notes. Nothing has been written to your vault yet.",
    });
    const row = el.createDiv({ cls: "qt-row" });
    row.createEl("button", { text: "Choose another file", cls: "qt-grow" }).addEventListener("click", () => this.showPreflight());
    const next = row.createEl("button", { text: "Continue to AI setup", cls: "mod-cta qt-grow" });
    next.addEventListener("click", () => this.beginAiSetup());
    this.renderOfflineButton(el);
  }

  showPreflightError(message) {
    const el = this.contentEl;
    el.empty();
    el.createEl("h3", { text: "This file can't be read" });
    el.createDiv({ cls: "qt-error", text: message });
    el.createEl("p", { cls: "qt-hint", text: "Nothing was added to your vault. Try a file with selectable text, or paste questions instead." });
    const row = el.createDiv({ cls: "qt-row" });
    row.createEl("button", { text: "Choose another file", cls: "qt-grow" }).addEventListener("click", () => this.showPreflight());
    row.createEl("button", { text: "Cancel", cls: "qt-grow" }).addEventListener("click", () => this.close());
    this.renderOfflineButton(el);
  }

  beginAiSetup() {
    const files = this.files.length ? this.files.slice() : this.file ? [this.file] : [];
    const source = { file: files.length === 1 ? files[0] : null, files, vaultDoc: files.length ? "" : this.vaultDoc || "", preflight: this.preflight, preflights: this.preflights.slice() };
    const state = importAiState(this.plugin);
    this.close();
    this.plugin.openAiImportHelp(state, {
      preflight: source.preflight,
      onReady: () => this.plugin.openPdfImport(source),
    });
  }

  readPages(src, progress, cap, spec) {
    const pages = spec === undefined ? this.meta.pages : spec;
    return readPagesForSource(src, pages, progress, cap);
  }

  showSetup() {
    const el = this.contentEl;
    el.empty();
    const multiple = this.files.length > 1;
    el.createEl("h3", { text: multiple ? "Import questions from files" : "Import questions from a file" });
    if (this.preflight) el.createEl("p", { cls: "qt-hint", text: summaryText(this.preflight) });

    this.renderSourcePicker(el, (names, count) => {
      if (!this.folderTouched) {
        this.folder = count > 1 ? this.parent : this.autoFolder(documentBaseName(names[0]));
        if (this.folderText) this.folderText.setValue(this.folder);
      }
    });
    if (this.files.length > 1) {
      el.createEl("p", { cls: "qt-hint", text: this.files.length + " files will be imported one after another. Each gets its own subfolder under the folder below." });
      const list = el.createDiv({ cls: "qt-import-file-list" });
      for (const file of this.files) {
        const row = list.createDiv({ cls: "qt-import-file-row" });
        row.createSpan({ cls: "qt-import-file-state is-ready", text: "Queued" });
        row.createDiv({ cls: "qt-import-file-body" }).createDiv({ cls: "qt-import-file-name", text: file.name });
      }
    }

    new Setting(el)
      .setName(multiple ? "Folder for every file" : "Folder for the notes")
      .setDesc(multiple ? "Each file gets a subfolder here. If a subfolder already has files, you'll be asked before questions are added to it." : "It's created if it doesn't exist. If it already has files, you'll be asked before the questions are added to it.")
      .addText((t) => {
        this.folderText = t;
        new FolderSuggest(this.app, t.inputEl);
        t.setPlaceholder("Example: Questions/SAT Practice Test 1").setValue(this.folder).onChange((v) => {
          this.folder = v;
          this.folderTouched = true;
        });
      });
    if (!this.folderTouched) {
      if (multiple) this.folder = this.parent;
      else if (this.file || this.vaultDoc) this.folder = this.autoFolder(documentBaseName(this.file ? this.file.name : this.vaultDoc));
      if (this.folderText) this.folderText.setValue(this.folder);
    }

    const agentOk = this.agentAvailable();
    new Setting(el)
      .setName("Who writes the notes")
      .setDesc(agentOk ? "The OpenCode agent reads the file and writes the note files itself. Direct AI sends the text to your provider and the plugin writes the files after you review them." : "Direct AI sends the file's text to your provider, and the plugin writes the files after you review them. To let the OpenCode agent write the files itself, switch the AI backend to OpenCode in settings (desktop only).")
      .addDropdown((d) => {
        if (agentOk) d.addOption("agent", "OpenCode agent (writes the files itself)");
        d.addOption("api", "Direct AI (you review first)");
        d.setValue(this.method).onChange((v) => (this.method = v));
      });

    new Setting(el)
      .setName("Capture figures and pictures (PDF only)")
      .setDesc("Draws each PDF page, cuts out charts, diagrams and images, saves them in an images folder next to the notes, and shows them in the questions that use them. Other formats are imported as text.")
      .addToggle((t) => t.setValue(this.opts.capture).onChange((v) => (this.opts.capture = v)));
    new Setting(el)
      .setName("Also save a picture of every page")
      .setDesc("A backup for when a figure isn't cut out cleanly. Uses more space.")
      .addToggle((t) => t.setValue(this.opts.pagePics).onChange((v) => (this.opts.pagePics = v)));

    const fields = [
      ["test", "Test", "Example: SAT, AP World History"],
      ["course", "Course", ""],
      ["section", "Section", ""],
      ["domain", "Domain", ""],
      ["unit", "Unit", "Example: 3"],
      ["difficulty", "Difficulty", "easy, medium or hard"],
      ["skill", "Skill (optional)", "Blank lets the file's own labels through"],
    ];
    const hasPropertyOverrides = fields.some(([key]) => str(this.meta[key]).trim());
    const propertyDetails = el.createEl("details", { cls: "qt-import-properties", attr: hasPropertyOverrides ? { open: "" } : {} });
    const propertySummary = propertyDetails.createEl("summary", { cls: "qt-import-properties-summary" });
    propertySummary.createSpan({ cls: "qt-import-properties-title", text: "Properties added to every note (optional)" });
    propertySummary.createSpan({ cls: "qt-import-properties-state", text: "AI fills these automatically; open to override" });
    propertyDetails.createEl("p", { cls: "qt-hint", text: "You do not need to fill these in. By default, the AI reads each property from the file for every question and adds it automatically. To override that, type a value here: it is used for every note even when the file says something different. Leave a box blank to keep the AI's value." });
    for (const [key, label, ph] of fields) new Setting(propertyDetails).setName(label).addText((t) => t.setPlaceholder(ph).setValue(this.meta[key]).onChange((v) => (this.meta[key] = v.trim())));
    new Setting(el).setName("Question id prefix").setDesc("Ids look like PREFIX-Q01. Blank uses the file's name.").addText((t) => t.setValue(this.meta.prefix).onChange((v) => (this.meta.prefix = v.trim())));
    new Setting(el).setName("Pages or slides (optional)").setDesc("Blank means every page or slide. Example: 1-12 or 2,4,6-8. Try a few first to check the result and the cost.").addText((t) => t.setValue(this.meta.pages).onChange((v) => (this.meta.pages = v.trim())));

    el.createEl("p", { cls: "qt-hint", text: "Where the file doesn't show an answer or explanation, the AI writes one and says so at the top of that note, with the model name and today's date. AI answers can be wrong, so check them. The file's text is sent to your AI provider, which may charge for long files. A copy of the original file is saved in the new folder with the notes." });

    const row = el.createDiv({ cls: "qt-row" });
    row.createEl("button", { text: "Cancel", cls: "qt-grow" }).addEventListener("click", () => this.close());
    const start = row.createEl("button", { text: multiple ? "Import " + this.files.length + " files" : "Start import", cls: "mod-cta qt-grow" });
    start.addEventListener("click", () => { if (this.files.length > 1) this.startBatch(); else this.start(); });
  }

  /* ---- one import attempt owns its writes until it finishes ---- */

  beginArtifacts() {
    this.artifacts = { files: new Set(), folders: new Set(), committed: false };
    this.agentBefore = null;
  }

  /** Records only folders that did not exist before this attempt. */
  trackFolderChain(folder) {
    if (!this.artifacts || !folder) return;
    const parts = normalizePath(str(folder)).split("/").filter(Boolean);
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      if (!this.app.vault.getAbstractFileByPath(current)) this.artifacts.folders.add(current);
    }
  }

  trackArtifact(path) {
    if (this.artifacts && path) this.artifacts.files.add(normalizePath(path));
  }

  commitArtifacts() {
    if (!this.artifacts) return;
    this.artifacts.committed = true;
    this.artifacts = null;
    this.agentBefore = null;
  }

  /** Removes every write this attempt made, newest folders first, never touching pre-existing notes. */
  async cleanupArtifacts() {
    const tracked = this.artifacts;
    if (!tracked || tracked.committed) return;
    tracked.committed = true;
    const adapter = this.app.vault && this.app.vault.adapter;
    if (!adapter) {
      this.artifacts = null;
      this.agentBefore = null;
      return;
    }
    const files = new Set(tracked.files);
    // The OpenCode agent writes note files itself, so find the ones added after its baseline.
    if (this.agentBefore && this.target && typeof adapter.list === "function") {
      try {
        const listing = await adapter.list(this.target);
        for (const path of (listing && listing.files) || []) {
          if (/\.md$/i.test(path) && !this.agentBefore.has(path)) files.add(path);
        }
      } catch (e) {
        /* the folder may not have been created */
      }
    }
    if (typeof adapter.remove === "function") {
      for (const path of files) {
        try {
          await adapter.remove(path);
        } catch (e) {
          /* it may have failed before writing, or already be gone */
        }
      }
    }
    if (typeof adapter.rmdir === "function") {
      const folders = [...tracked.folders].sort((a, b) => b.split("/").length - a.split("/").length);
      for (const path of folders) {
        try {
          await adapter.rmdir(path, false);
        } catch (e) {
          /* not empty, or already gone */
        }
      }
    }
    this.artifacts = null;
    this.agentBefore = null;
  }

  async readSource() {
    return readDocumentSource(this.app, { file: this.file, vaultDoc: this.vaultDoc });
  }

  async startBatch() {
    if (this.batchStarted) return;
    if (importAiState(this.plugin) !== "ready") { this.showPreflight(); return; }
    if (!this.files.length) { new Notice("Choose files first."); return; }
    const parent = normalizePath(str(this.folder).trim() || this.parent);
    this.batchParent = parent;
    const used = new Set();
    this.batchJobs = this.files.map((file, i) => {
      const base = documentBaseName(file.name) || "File " + (i + 1);
      let folder = normalizePath(parent + "/" + base);
      for (let n = 2; used.has(folder.toLowerCase()); n++) folder = normalizePath(parent + "/" + base + " (" + n + ")");
      used.add(folder.toLowerCase());
      return { file, folder, preflight: this.preflights[i] || null };
    });
    this.batchMode = this.batchJobs.length > 1;
    this.batchStarted = true;
    this.batchStopped = false;
    this.batchIndex = 0;
    this.batchResults = [];
    this.batchNotes = 0;
    this.finishedBatch = false;
    this.progress = new ImportProgressNotice(this.app, this.batchJobs.length);
    this.prepareBatchJob(0);
    try {
      await this.start();
    } catch (e) {
      if (!this.closed && !this.finishedBatch) this.showError(e && e.message ? e.message : String(e));
    }
  }

  prepareBatchJob(index) {
    const job = this.batchJobs[index];
    if (!job) return false;
    this.batchIndex = index;
    this.file = job.file;
    this.vaultDoc = "";
    this.preflight = job.preflight;
    this.folder = job.folder;
    this.items = [];
    this.warnings = [];
    this.ctx = null;
    this.artifacts = null;
    this.agentBefore = null;
    this.stop = false;
    this.closed = false;
    this.progressLabel = "Importing " + (index + 1) + " of " + this.batchJobs.length + " · " + job.file.name;
    if (this.progress) this.progress.update(this.progressLabel, "Starting...", index / this.batchJobs.length);
    return true;
  }

  recordBatchResult(result, folder) {
    this.batchResults.push({ name: this.file ? this.file.name : "File", folder, made: Number(result.made) || 0, skipped: Array.isArray(result.skipped) ? result.skipped.slice(0, 20) : [], error: "" });
    this.batchNotes += Number(result.made) || 0;
  }

  scheduleNextBatch() {
    if (this.closed || !this.batchStarted || this._nextBatchTimer) return;
    const win = this.hostWindow || (typeof activeWindow !== "undefined" ? activeWindow : null);
    if (!win) return;
    this._nextBatchTimer = win.setTimeout(() => { this._nextBatchTimer = null; this.nextBatchJob(); }, 450);
  }

  nextBatchJob() {
    if (this.closed || !this.batchStarted) return;
    if (this.batchIndex + 1 >= this.batchJobs.length) return this.finishBatch();
    this.prepareBatchJob(this.batchIndex + 1);
    this.start().catch((e) => {
      if (!this.closed && !this.finishedBatch) this.showError(e && e.message ? e.message : String(e));
    });
  }

  finishBatch(reason) {
    if (this.finishedBatch || !this.batchStarted) return;
    this.finishedBatch = true;
    this.batchStarted = false;
    if (this._nextBatchTimer) {
      const win = this.hostWindow || (typeof activeWindow !== "undefined" ? activeWindow : null);
      if (win) win.clearTimeout(this._nextBatchTimer);
      this._nextBatchTimer = null;
    }
    const made = this.batchNotes;
    const files = this.batchResults.filter((row) => row.made > 0).length;
    const failed = this.batchResults.filter((row) => row.error).length;
    const failureText = failed ? " " + failed + " file" + (failed === 1 ? "" : "s") + " failed." : "";
    const summary = made ? "Imported " + made + " question note" + (made === 1 ? "" : "s") + " from " + files + " file" + (files === 1 ? "" : "s") + "." + failureText : "No question notes were imported." + failureText;
    if (this.progress) { this.progress.finish(summary); this.progress = null; }
    const options = { folder: this.batchParent, results: this.batchResults.slice(), expected: made, cancelled: reason === "stopped" || this.batchStopped };
    this.close();
    new ImportCompleteModal(this.app, this.plugin, options).open();
  }

  async start() {
    if (this.batchMode && !this.batchJobs.length) { this.startBatch(); return; }
    if (this.batchMode && !this.progress) {
      this.progress = new ImportProgressNotice(this.app, this.files.length);
      this.progressLabel = "Importing " + (this.batchIndex + 1) + " of " + this.files.length + " · " + (this.file ? this.file.name : "File");
      this.progress.update(this.progressLabel, "Starting...", this.batchIndex / Math.max(1, this.files.length));
    }
    const p = this.plugin;
    const aiState = importAiState(p);
    if (aiState !== "ready") {
      this.showPreflight();
      return;
    }
    if (!this.file && !this.vaultDoc) {
      new Notice("Choose a file first.");
      return;
    }
    const folderPath = normalizePath(str(this.folder).trim());
    if (!folderPath || folderPath === "/") {
      new Notice("Type a name for the new folder.");
      return;
    }
    if (this.folderHasFiles(folderPath)) {
      if (this.confirming) return;
      this.confirming = true;
      let useExisting = false;
      try {
        useExisting = await this.confirmExistingFolder(folderPath);
      } finally {
        this.confirming = false;
      }
      if (!useExisting) {
        if (this.batchMode) this.showError("Skipped " + this.file.name + ": the existing folder was not confirmed.");
        return;
      }
    }
    this.target = folderPath;
    p.settings.importFolder = this.batchMode ? this.batchParent : folderPath.includes("/") ? folderPath.slice(0, folderPath.lastIndexOf("/")) : "";
    p.settings.importDefaults = Object.assign({}, this.meta, { prefix: "", pages: "" });
    p.settings.importOptions = Object.assign({}, this.opts);
    await p.save();

    const el = this.contentEl;
    el.empty();
    el.createEl("h3", { text: this.batchMode ? "Importing " + (this.batchIndex + 1) + " of " + this.batchJobs.length + ": " + this.file.name : "Importing" });
    this.statusEl = el.createDiv({ cls: "qt-hint", text: "Starting..." });
    this.activityEl = el.createDiv({ cls: "qt-tool" });
    this.stopBtn = el.createEl("button", { text: "Stop", cls: "qt-modal-btn" });
    this.stopBtn.addEventListener("click", () => {
      if (this.batchMode) this.batchStopped = true;
      this.stop = true;
      this.stopBtn.disabled = true;
      this.status("Stopping...");
      if (this.sid) p.openCode().abort(this.sid).catch(() => {});
    });
    this.stop = false;
    this.sid = "";
    this.warnings = [];
    this.running = true;
    try {
      const src = await this.readSource();
      if (!src.kind) throw new Error(`This plugin can't read ${src.ext ? `.${src.ext}` : "that kind of"} files.`);
      this.source = src.name;
      // Read and check before creating a folder or copying the source. A
      // scanned handout must leave the vault untouched.
      const precheck = await this.readPages(src, (m) => !this.closed && this.status(m));
      this.warnings.push(...(precheck.warnings || []).slice(0, 5));
      const textCheck = checkDocumentText(precheck.pages, {
        kind: src.kind,
        label: documentLabel(`${src.name}.${src.ext}`),
      });
      if (!textCheck.ok) throw new Error(textCheck.message);

      this.beginArtifacts();
      this.trackFolderChain(this.target);
      const vault = this.app.vault;
      const folder = await ensureFolder(this.app, this.target);
      const prefix = slugId(this.meta.prefix || src.name);
      const imagesDir = `${folder}/images`;
      // Pictures that were already in an existing folder must survive this import.
      this.beforeImages = new Set();
      if (vault.adapter && typeof vault.adapter.list === "function") {
        try {
          const listing = await vault.adapter.list(imagesDir);
          for (const path of (listing && listing.files) || []) this.beforeImages.add(path);
        } catch (e) {
          /* there is no images folder yet */
        }
      }
      // keep a copy of the original file with the notes
      this.status("Copying the file into the folder...");
      const sourcePath = uniquePath(vault, folder, src.name, src.ext, "Source");
      this.trackArtifact(sourcePath);
      await vault.createBinary(sourcePath, src.buf);
      if (this.opts.capture && src.kind !== "pdf") {
        this.warnings.push("Pictures are only captured from PDFs, so this import uses the text of the file.");
      }
      let pages = precheck.pages;
      let figCount = precheck.figCount;
      if (this.opts.capture && src.kind === "pdf") {
        const cap = {
          prefix,
          scale: 2,
          pages: this.opts.pagePics,
          save: async (name, data) => {
            this.trackFolderChain(imagesDir);
            await ensureFolder(this.app, imagesDir);
            const clean = str(name).replace(/^.*\//, "");
            const dot = clean.lastIndexOf(".");
            const base = dot > 0 ? clean.slice(0, dot) : clean;
            const ext = dot > 0 ? clean.slice(dot + 1) : "png";
            const path = uniquePath(vault, imagesDir, base, ext, "figure");
            this.trackArtifact(path);
            await vault.createBinary(path, data);
            return path;
          },
        };
        this.status("Capturing pictures...");
        const withPictures = await readPdfPages(src.buf, this.meta.pages, (m) => !this.closed && this.status(m), cap);
        pages = withPictures.pages;
        figCount = withPictures.figCount;
        this.warnings.push(...(withPictures.warnings || []).slice(0, 5));
      }
      this.ctx = { folder, prefix, sourcePath, imagesDir, sourceName: src.name, kind: src.kind, figCount };
      if (this.method === "agent") await this.runAgent(pages);
      else await this.runApi(pages);
    } catch (e) {
      await this.cleanupArtifacts();
      if (!this.closed) this.showError(e && e.message ? e.message : String(e));
    } finally {
      this.running = false;
      if (this.closed) await this.cleanupArtifacts();
    }
  }

  /* ---- method 1: the OpenCode agent writes the files itself */

  async runAgent(pages) {
    const p = this.plugin;
    const vault = this.app.vault;
    const { folder, prefix, sourcePath, imagesDir, sourceName, kind } = this.ctx;
    const before = new Set(await this.listNotes(folder));
    this.agentBefore = before;
    const textPath = uniquePath(vault, folder, "_import-text", "txt", "import-text");
    this.trackArtifact(textPath);
    await vault.create(textPath, pages.map((pg) => `--- Page ${pg.n} ---\n${pg.text.trim()}`).join("\n\n"));

    this.status("Starting OpenCode...");
    await p.ensureOpenCode((m) => !this.closed && this.status(m));
    const oc = p.openCode();
    await ensureProviders(oc);
    const s = await oc.createSession(`Import ${sourceName}`);
    this.sid = s && s.id;
    if (!this.sid) throw new Error("OpenCode did not return a session id.");
    const ai = p.settings.ai;
    const body = {
      parts: [{ type: "text", text: agentPrompt({ name: sourceName, textPath, docPath: sourcePath, imagesDir, folder, prefix, meta: this.meta, kind }) }],
      system: AGENT_SYSTEM,
    };
    const model = modelFromString(ai.model);
    if (model) body.model = model;
    if (str(ai.agent).trim()) body.agent = ai.agent.trim();

    const mySid = this.sid;
    const timer = activeWindow.setInterval(() => this.pollAgent(mySid, folder), 1500);
    let msgs = null;
    try {
      await oc.send(mySid, body);
    } catch (e) {
      if (!this.stop) throw new Error(friendlyError(e, oc.base()));
    } finally {
      activeWindow.clearInterval(timer);
    }
    try {
      msgs = await oc.messages(mySid);
    } catch (e) {
      /* the model name is only for the label */
    }
    this.status("Checking the notes...");
    await sleep(1500);
    const model2 = str(ai.model).trim() || modelFromMessages(msgs) || "the AI model set up in OpenCode";
    const result = await this.finishAgentNotes(folder, sourceName, {
      model: model2,
      date: localDate(),
      sourcePath,
      sourceKind: kind,
    }, before);
    try {
      await this.app.vault.adapter.remove(textPath);
    } catch (e) {
      /* leave it */
    }
    await this.pruneImages(folder, result);
    result.issues = await this.auditNotes(folder, result.paths);
    if (!this.closed) {
      this.showAgentDone(result, folder);
      this.commitArtifacts();
    }
  }

  /** Removes cut-out pictures that no note uses, so the images folder only holds what's needed. */
  async pruneImages(folder, result) {
    const adapter = this.app.vault.adapter;
    let listing;
    try {
      listing = await adapter.list(`${folder}/images`);
    } catch (e) {
      return;
    }
    const files = (listing && listing.files) || [];
    if (!files.length) return;
    let all = "";
    for (const n of await this.listNotes(folder)) all += await adapter.read(n);
    let kept = 0;
    for (const f of files) {
      if (this.beforeImages && this.beforeImages.has(f)) continue;
      const base = f.replace(/^.*\//, "");
      const isPage = /-p\d+\.png$/i.test(base);
      if ((isPage && this.opts.pagePics) || all.includes(base)) {
        kept++;
        continue;
      }
      try {
        await adapter.remove(f);
      } catch (e) {
        /* leave it */
      }
    }
    result.images = kept;
  }

  async listNotes(folder) {
    const listing = await this.app.vault.adapter.list(folder);
    return (listing.files || []).filter((f) => /\.md$/i.test(f) && !/\/_[^/]*$/.test(f)).sort();
  }

  async pollAgent(sid, folder) {
    if (this.closed) return;
    try {
      const msgs = await this.plugin.openCode().messages(sid);
      const lines = partsToTurns(msgs).flatMap((t) => t.tools).slice(-6);
      const n = (await this.listNotes(folder)).length;
      this.status(`The agent is working... ${n} note${n === 1 ? "" : "s"} written so far.`);
      if (this.activityEl) this.activityEl.setText(lines.join("\n"));
    } catch (e) {
      /* keep waiting */
    }
  }

  async finishAgentNotes(folder, source, stamp, before) {
    const skip = before instanceof Set ? before : new Set();
    const files = (await this.listNotes(folder)).filter((path) => !skip.has(path));
    const meta = Object.assign({}, this.meta, { source });
    const result = { made: 0, ai: 0, noAnswer: 0, skipped: [], images: 0, ids: [], dupes: [], issues: [], paths: [] };
    for (const path of files) {
      const text = await this.app.vault.adapter.read(path);
      const parsed = parseNote(text);
      const base = path.replace(/^.*\//, "").replace(/\.md$/i, "");
      if (!str(parsed.sec.question).trim()) {
        result.skipped.push(`${base}: no "## Question" section`);
        continue;
      }
      const f = this.app.vault.getAbstractFileByPath(path);
      const pre = aiFlags(parsed.fm, parsed.sec);
      let verification = null;
      if (pre.aiAnswer && parsed.sec.choices.length && typeof this.plugin.verifyDraftQuestions === "function") {
        const draft = { question: parsed.sec.question, choices: parsed.sec.choices, answer: str(parsed.fm.answer) };
        await this.plugin.verifyDraftQuestions([draft]);
        verification = draft.verification;
        if (verification && verification.drop) {
          if (f instanceof TFile) await this.app.vault.delete(f);
          else await this.app.vault.adapter.remove(path);
          result.skipped.push(`${base}: answer check failed`);
          continue;
        }
      }
      const out = finalizeNote(text, meta, base, { ...stamp, verification });
      if (f instanceof TFile) await this.app.vault.modify(f, out);
      else await this.app.vault.adapter.write(path, out);
      const fin = parseNote(out);
      const fl = aiFlags(fin.fm, fin.sec);
      if (fl.aiAnswer || fl.aiExp) result.ai++;
      if (!fl.hasAnswer) result.noAnswer++;
      result.made++;
      result.paths.push(path);
      const oid = officialIdOf(fin.fm);
      if (oid) result.ids.push({ path, id: oid });
    }
    // the same official question id as a note you already had (or repeated in this file)
    result.dupes = findDuplicateIds(result.ids, indexOfficialIds(this.plugin.getQuestions(), folder));
    return result;
  }

  /** What looks wrong in the notes of this import: no answer, no choices, a missing figure. */
  async auditNotes(folder, paths) {
    const adapter = this.app.vault.adapter;
    const exists = async (link) => {
      if (this.app.metadataCache.getFirstLinkpathDest(link, `${folder}/x.md`)) return true;
      try {
        return await adapter.exists(normalizePath(link));
      } catch (e) {
        return false;
      }
    };
    const issues = [];
    const list = Array.isArray(paths) ? paths : await this.listNotes(folder);
    for (const path of list) {
      let text;
      try {
        text = await adapter.read(path);
      } catch (e) {
        continue;
      }
      const problems = await noteIssues(text, exists);
      if (problems.length) issues.push({ path, problems });
    }
    return issues;
  }

  showAgentDone(r, folder) {
    if (this.batchMode) {
      this.commitArtifacts();
      this.recordBatchResult(r, folder);
      if (this.batchStopped) return this.finishBatch("stopped");
      if (this.batchIndex + 1 < this.batchJobs.length) {
        const el = this.contentEl;
        el.empty();
        el.createEl("h3", { text: "Imported " + (r.made || 0) + " from " + this.file.name });
        el.createEl("p", { cls: "qt-hint", text: "File " + (this.batchIndex + 1) + " of " + this.batchJobs.length + " finished. Starting the next file..." });
        this.status("Finished " + this.file.name + ". Starting the next file...");
        this.scheduleNextBatch();
        return;
      }
      return this.finishBatch();
    }
    const el = this.contentEl;
    el.empty();
    el.createEl("h3", { text: r.made ? `Created ${r.made} note${r.made === 1 ? "" : "s"}` : "No notes were created" });
    el.createEl("p", { text: `Saved in ${folder}, together with a copy of the original file${r.images ? ` and ${r.images} picture${r.images === 1 ? "" : "s"} cut from it (in the images folder)` : ""}.` });
    if (r.ai) {
      el.createEl("p", {
        cls: "qt-hint",
        text: `${r.ai} ${r.ai === 1 ? "has" : "have"} an answer or explanation written by the AI. ${r.ai === 1 ? "It's" : "They're"} marked at the top of the note with the model and date. Please check ${r.ai === 1 ? "it" : "them"}.`,
      });
    }
    if (r.noAnswer) el.createEl("p", { cls: "qt-hint", text: `${r.noAnswer} ${r.noAnswer === 1 ? "has" : "have"} no answer, so you'll grade ${r.noAnswer === 1 ? "it" : "those"} yourself.` });
    for (const s of r.skipped) el.createDiv({ cls: "qt-error", text: `Skipped ${s}` });
    this.renderDupes(el, r, folder);
    this.renderIssues(el, r, folder);
    if (!r.made && !(r.dupes && r.dupes.length)) {
      el.createEl("p", {
        cls: "qt-hint",
        text: "If the agent was waiting to be allowed to create files, allow file edits for this vault in your OpenCode permissions and try again.",
      });
      el.createEl("button", { text: "Open AI settings" }).addEventListener("click", () => {
        this.close();
        this.plugin.openSettings("mcq-ai");
      });
    }
    this.doneButtons(el, folder, r.made);
  }

  /** Questions whose official id is already in your vault: skipped (review method) or listed so you can remove them (agent method). */
  renderDupes(el, r, folder) {
    const dupes = r.dupes || [];
    if (!dupes.length) return;
    const skipped = dupes.filter((d) => d.skipped);
    const made = dupes.filter((d) => !d.skipped);
    const open = (path) => {
      const f = this.app.vault.getAbstractFileByPath(path);
      if (f instanceof TFile) this.app.workspace.getLeaf("tab").openFile(f);
    };
    if (skipped.length) {
      el.createEl("h4", { text: `Skipped ${skipped.length} already in your vault` });
      el.createDiv({ cls: "qt-hint", text: "These have the same question ID as a note you already have, so no new note was made." });
      for (const d of skipped.slice(0, 20)) {
        const row = el.createDiv({ cls: "qt-issue" });
        row.createSpan({ text: `${d.id} is already in ` });
        row.createEl("a", { text: d.other.replace(/^.*\//, ""), cls: "qt-link" }).addEventListener("click", () => open(d.other));
      }
    }
    if (made.length) {
      el.createEl("h4", { text: `${made.length} repeat${made.length === 1 ? "s" : ""} a question you already have` });
      el.createDiv({ cls: "qt-hint", text: "These new notes have the same question ID as another note. Keep them or move them to the trash." });
      for (const d of made.slice(0, 20)) {
        const row = el.createDiv({ cls: "qt-issue" });
        row.createEl("a", { text: d.path.replace(/^.*\//, ""), cls: "qt-link" }).addEventListener("click", () => open(d.path));
        row.createSpan({ text: ` has the same ID (${d.id}) as ` });
        row.createEl("a", { text: d.other.replace(/^.*\//, ""), cls: "qt-link" }).addEventListener("click", () => open(d.other));
      }
      const rm = el.createEl("button", { text: `Move the ${made.length} repeat${made.length === 1 ? "" : "s"} to the trash` });
      rm.addEventListener("click", async () => {
        rm.disabled = true;
        let gone = 0;
        for (const d of made) {
          const f = this.app.vault.getAbstractFileByPath(d.path);
          if (!(f instanceof TFile)) continue;
          try {
            await this.app.fileManager.trashFile(f);
            gone++;
          } catch (e) {
            /* leave it */
          }
        }
        const goneSet = new Set(made.map((d) => d.path));
        r.made = Math.max(0, r.made - gone);
        r.dupes = dupes.filter((d) => !goneSet.has(d.path));
        r.issues = (r.issues || []).filter((i) => !goneSet.has(i.path));
        new Notice(`Moved ${gone} note${gone === 1 ? "" : "s"} to the trash.`);
        this.showAgentDone(r, folder);
      });
    }
  }

  /** Notes that need a look: no answer, no answer choices, a missing figure. */
  renderIssues(el, r, folder) {
    const issues = r.issues || [];
    if (!issues.length) return;
    el.createEl("h4", { text: `Needs a look (${issues.length} note${issues.length === 1 ? "" : "s"})` });
    const groups = groupIssues(issues);
    for (const [problem, paths] of Object.entries(groups)) {
      el.createDiv({ cls: "qt-label", text: `${problem} (${paths.length})` });
      const list = el.createDiv({ cls: "qt-issue-list" });
      for (const path of paths.slice(0, 30)) {
        const a = list.createEl("a", { text: path.replace(/^.*\//, "").replace(/\.md$/i, ""), cls: "qt-link" });
        a.addEventListener("click", () => {
          const f = this.app.vault.getAbstractFileByPath(path);
          if (f instanceof TFile) this.app.workspace.getLeaf("tab").openFile(f);
        });
      }
      if (paths.length > 30) list.createSpan({ cls: "qt-hint", text: `and ${paths.length - 30} more (see the saved list)` });
    }
    const save = el.createEl("button", { text: "Save this list as a note" });
    save.addEventListener("click", async () => {
      const path = normalizePath(`${folder}/_import-report.md`);
      const md = buildReportMarkdown(folder, issues, (r.dupes || []).filter((d) => !d.skipped), localDate());
      try {
        const old = this.app.vault.getAbstractFileByPath(path);
        let f;
        if (old instanceof TFile) {
          await this.app.vault.modify(old, md);
          f = old;
        } else f = await this.app.vault.create(path, md);
        this.app.workspace.getLeaf("tab").openFile(f);
      } catch (e) {
        new Notice(`Couldn't save the list: ${e && e.message ? e.message : e}`);
      }
    });
  }

  /* ---- method 2: the AI returns the notes and you review them first */

  async runApi(pages) {
    const p = this.plugin;
    const chunks = chunkPages(pages, 9000, 5);
    const keyText = answerKeyText(pages);
    const client = { chat: (system, messages, opts) => p.aiChat(system, messages, { ...(opts || {}), feature: "generation" }) };
    const blocks = [];
    let carry = [];
    let failures = 0;
    for (let i = 0; i < chunks.length && !this.stop && !this.closed; i++) {
      const ch = chunks[i];
      this.status(`Asking the AI to read pages ${ch[0].n}-${ch[ch.length - 1].n} (batch ${i + 1} of ${chunks.length}). ${mergeNotes(blocks).length} questions found so far.`);
      try {
        blocks.push(...(await extractNotesChunk(client, ch, keyText, carry)));
        carry = carryPassages(blocks);
        failures = 0;
      } catch (e) {
        this.warnings.push(`Pages ${ch[0].n}-${ch[ch.length - 1].n}: ${friendlyApiError(e)}`);
        if (++failures >= 2) break;
      }
    }
    if (this.closed) return;
    this.items = mergeNotes(blocks);
    await this.verifyAiAnswers();
    if (this.closed) return;
    if (!this.items.length) await this.cleanupArtifacts();
    this.showReview();
  }

  /** Blind-check answers the AI wrote before the review list is shown. */
  async verifyAiAnswers() {
    if (!this.plugin.settings.ai.enabled || typeof this.plugin.verifyDraftQuestions !== "function") return;
    const candidates = this.items.filter((q) => {
      const f = aiFlags(q.fm, q.sec);
      return f.aiAnswer && q.sec.choices.length > 0;
    });
    if (!candidates.length) return;
    this.status(`Checking ${candidates.length} AI-written answer${candidates.length === 1 ? "" : "s"} without showing the key...`);
    const drafts = candidates.map((q) => ({ question: q.sec.question, choices: q.sec.choices, answer: str(q.fm.answer) }));
    await this.plugin.verifyDraftQuestions(drafts);
    candidates.forEach((q, i) => {
      q.verification = drafts[i].verification;
      if (q.verification && q.verification.drop) q.include = false;
    });
  }

  showError(msg) {
    if (this.batchMode) {
      this.recordBatchResult({ made: 0, skipped: [] }, this.folder);
      this.batchResults[this.batchResults.length - 1].error = msg;
      if (this.progress) this.progress.update(this.progressLabel, "Skipped: " + msg, this.batchIndex / Math.max(1, this.batchJobs.length));
      const el = this.contentEl;
      el.empty();
      el.createEl("h3", { text: "Couldn't import " + this.file.name });
      el.createDiv({ cls: "qt-error", text: msg });
      el.createEl("p", { cls: "qt-hint", text: "The other files will continue." });
      if (this.batchStopped) this.finishBatch("stopped");
      else if (this.batchIndex + 1 < this.batchJobs.length) this.scheduleNextBatch();
      else this.finishBatch();
      return;
    }
    const el = this.contentEl;
    el.empty();
    el.createEl("h3", { text: "Couldn't import" });
    el.createDiv({ cls: "qt-error", text: msg });
    const row = el.createDiv({ cls: "qt-row" });
    row.createEl("button", { text: "Back", cls: "qt-grow" }).addEventListener("click", () => this.showSetup());
    row.createEl("button", { text: "Close", cls: "qt-grow" }).addEventListener("click", () => this.close());
  }

  showReview() {
    const el = this.contentEl;
    el.empty();
    if (this.batchMode && this.progress) this.progress.update(this.progressLabel, "Waiting for your review.", this.batchIndex / Math.max(1, this.batchJobs.length));
    if (this.batchMode) el.createEl("p", { cls: "qt-hint", text: "File " + (this.batchIndex + 1) + " of " + this.batchJobs.length + " · " + this.file.name });
    const items = this.items;
    el.createEl("h3", { text: items.length ? `Found ${items.length} question${items.length === 1 ? "" : "s"}` : "No questions found" });
    for (const w of this.warnings) el.createDiv({ cls: "qt-error", text: w });
    if (!items.length) {
      el.createEl("p", { cls: "qt-hint", text: "Try a smaller page range, or check that the file contains questions with readable text." });
      el.createEl("button", { text: "Back", cls: "qt-modal-btn" }).addEventListener("click", () => this.showSetup());
      if (this.batchMode) {
        this.recordBatchResult({ made: 0, skipped: ["No questions found"] }, this.target);
        if (this.batchStopped) this.finishBatch("stopped");
        else if (this.batchIndex + 1 < this.batchJobs.length) this.scheduleNextBatch();
        else this.finishBatch();
      }
      return;
    }
    el.createEl("p", {
      cls: "qt-hint",
      text: "Check these against the original file. Answers the AI wrote itself are marked, and will be labelled at the top of the note. Untick anything you don't want.",
    });
    const tools = el.createDiv({ cls: "qt-row qt-small-row" });
    const list = el.createDiv({ cls: "qt-imp-list" });
    const create = el.createEl("button", { cls: "mod-cta qt-modal-btn" });
    const checks = [];
    const count = () => {
      const n = items.filter((q) => q.include).length;
      create.setText(`Create ${n} note${n === 1 ? "" : "s"}`);
      create.disabled = n === 0;
    };
    items.forEach((q) => {
      const row = list.createDiv({ cls: "qt-imp-row" });
      const cb = row.createEl("input", { type: "checkbox", attr: { "aria-label": "Include this question" } });
      cb.checked = q.include;
      cb.addEventListener("change", () => {
        q.include = cb.checked;
        count();
      });
      checks.push(cb);
      const body = row.createDiv({ cls: "qt-imp-body" });
      const text = str(q.sec.question).replace(/\s+/g, " ");
      const num = q.fm.number !== undefined && q.fm.number !== null && q.fm.number !== "" ? `${q.fm.number}. ` : "";
      cb.setAttribute("aria-label", `Include ${num}${text.length > 80 ? text.slice(0, 80) + "..." : text}`);
      body.createDiv({ cls: "qt-imp-title", text: `${num}${text.length > 130 ? text.slice(0, 130) + "..." : text}` });
      const f = aiFlags(q.fm, q.sec);
      const tags = [q.sec.choices.length ? `${q.sec.choices.length} choices` : "no answer choices"];
      tags.push(!f.hasAnswer ? "no answer" : f.aiAnswer ? `answer ${str(q.fm.answer)} (written by AI)` : `answer ${str(q.fm.answer)} (from the file)`);
      if (f.aiExp) tags.push("explanation written by AI");
      const v = q.verification;
      if (v) tags.push(v.status === "match" ? "answer checked" : v.status === "mismatch" ? `answer check failed: AI chose ${v.answer}` : "answer check did not finish");
      if (str(q.sec.stimulus).trim()) tags.push("has passage");
      if (/!\[\[/.test(q.text)) tags.push("has picture");
      if (/\[Figure not captured\]/i.test(q.sec.stimulus)) tags.push("figure missing");
      body.createDiv({ cls: "qt-imp-tags", text: tags.join(" · ") });
    });
    const setAll = (v) => {
      items.forEach((q) => (q.include = v));
      checks.forEach((c) => (c.checked = v));
      count();
    };
    tools.createEl("button", { text: "Select all" }).addEventListener("click", () => setAll(true));
    tools.createEl("button", { text: "Select none" }).addEventListener("click", () => setAll(false));
    tools.createEl("button", { text: "Back" }).addEventListener("click", async () => {
      await this.cleanupArtifacts();
      this.showSetup();
    });
    count();
    create.addEventListener("click", () => this.createNotes());
  }

  async createNotes() {
    const el = this.contentEl;
    const chosen = this.items.filter((q) => q.include);
    el.empty();
    el.createEl("h3", { text: "Creating notes" });
    this.statusEl = el.createDiv({ cls: "qt-hint", text: "Working..." });
    this.running = true;
    try {
      const { folder, prefix, sourcePath, kind } = this.ctx;
      const nums = chosen.map((q) => q.fm.number);
      const useNums = nums.every((n) => Number.isFinite(Number(n)) && n !== null && n !== "" && n !== undefined) && new Set(nums.map(Number)).size === nums.length;
      const stimIds = new Map();
      const meta = Object.assign({}, this.meta, { source: this.source });
      const stamp = { model: this.modelLabel(), date: localDate(), sourcePath, sourceKind: kind };
      const result = { made: 0, ai: 0, noAnswer: 0, skipped: [], images: 0, ids: [], dupes: [], issues: [], paths: [] };
      const existingIds = indexOfficialIds(this.plugin.getQuestions(), folder);
      const seenIds = new Map();
      for (let i = 0; i < chosen.length; i++) {
        const q = chosen[i];
        if (q.verification && q.verification.drop) {
          result.skipped.push(`${q.fm.number || i + 1}: answer check failed`);
          continue;
        }
        const oid = officialIdOf(q.fm);
        const other = oid && (existingIds.get(oid) || seenIds.get(oid));
        if (other) {
          result.dupes.push({ path: "", id: oid, other, skipped: true });
          continue;
        }
        const n = useNums ? Number(q.fm.number) : (parseInt(this.meta.start, 10) || 1) + i;
        const qid = `${prefix}-Q${String(n).padStart(2, "0")}`;
        let stimId = "";
        const stim = str(q.sec.stimulus).trim();
        if (stim) {
          const key = stim.toLowerCase().replace(/\s+/g, " ");
          if (!stimIds.has(key)) stimIds.set(key, `${prefix}-S${String(stimIds.size + 1).padStart(2, "0")}`);
          stimId = stimIds.get(key);
        }
        let path = normalizePath(`${folder}/${qid}.md`);
        for (let k = 2; this.app.vault.getAbstractFileByPath(path); k++) path = normalizePath(`${folder}/${qid}-${k}.md`);
        const out = finalizeNote(q.text, meta, qid, { ...stamp, stimId, verification: q.verification });
        this.trackArtifact(path);
        await this.app.vault.create(path, out);
        result.paths.push(path);
        if (oid) seenIds.set(oid, path);
        const fin = parseNote(out);
        const fl = aiFlags(fin.fm, fin.sec);
        if (fl.aiAnswer || fl.aiExp) result.ai++;
        if (!fl.hasAnswer) result.noAnswer++;
        result.made++;
        this.status(`Created ${result.made} of ${chosen.length}...`);
      }
      await this.pruneImages(folder, result);
      result.issues = await this.auditNotes(folder, result.paths);
      if (this.closed) return;
      this.showAgentDone(result, folder);
      this.commitArtifacts();
    } catch (e) {
      await this.cleanupArtifacts();
      if (!this.closed) this.showError(`Some notes may have been created before this stopped. ${e && e.message ? e.message : e}`);
    } finally {
      this.running = false;
      if (this.closed) await this.cleanupArtifacts();
    }
  }

  doneButtons(el, folder, made) {
    const row = el.createDiv({ cls: "qt-row" });
    row.createEl("button", { text: "Close", cls: "qt-grow" }).addEventListener("click", () => this.close());
    if (!folder || !made) {
      row.createEl("button", { text: "Practice now", cls: "mod-cta qt-grow" }).addEventListener("click", () => {
        this.close();
        this.plugin.activateView();
      });
      return;
    }
    const btn = row.createEl("button", { text: `Practice all ${made} note${made === 1 ? "" : "s"} in this folder`, cls: "mod-cta qt-grow" });
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.setText("Opening...");
      await this.plugin.practiceFolder(folder, made);
      this.close();
    });
  }
}

module.exports = {
  PdfImportModal,
  ImportCompleteModal,
  moveNoticeToMain,
};
