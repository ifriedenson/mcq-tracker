"use strict";
/*
 * Classify a text document locally, show the evidence, and route the same file
 * into the existing course-notes or question importer after the user confirms.
 * This modal never writes notes itself.
 */
const { Modal, Setting, TFile } = require("obsidian");
const { DOCUMENT_EXTENSIONS, documentBaseName, documentKind, documentLabel, extensionOf, readDocumentPages } = require("./documents");
const { readPdfPages } = require("./pdf");
const { DOCUMENT_TYPE_LABELS, DOCUMENT_TYPES, classifyDocument } = require("./document-classify");
const { str } = require("./util");

class DocumentReviewModal extends Modal {
  constructor(app, plugin, options) {
    super(app);
    this.plugin = plugin;
    this.file = (options && options.file) || null;
    this.vaultDoc = (options && options.vaultDoc) || "";
    this.source = null;
    this.pages = [];
    this.result = null;
    this.choice = "auto";
  }

  onOpen() {
    this.modalEl.addClass("qt-import-modal");
    this.renderSetup();
  }

  renderSetup() {
    const el = this.contentEl;
    el.empty();
    el.createEl("h3", { text: "Review a document" });
    el.createEl("p", {
      cls: "setting-item-description",
      text: "Reads the document's text locally, suggests whether it is multiple choice, free response, flashcards or course notes, and shows why. Nothing is sent anywhere and nothing is written until you choose an importer.",
    });
    const docs = this.app.vault.getFiles().filter((f) => documentKind(f.path || f.name));
    const picked = new Setting(el).setName("File").setDesc(this.file ? this.file.name : this.vaultDoc || "No file chosen");
    const input = createEl("input", { type: "file", attr: { accept: DOCUMENT_EXTENSIONS.map((e) => `.${e}`).join(",") } });
    input.hidden = true;
    input.addEventListener("change", () => {
      this.file = input.files && input.files[0] ? input.files[0] : null;
      if (this.file) {
        this.vaultDoc = "";
        picked.setDesc(this.file.name);
      }
    });
    picked.addButton((b) => b.setButtonText("Choose file...").onClick(() => input.click()));
    if (docs.length) {
      new Setting(el).setName("...or a file in your vault").addDropdown((d) => {
        d.addOption("", "Choose...");
        for (const f of docs) d.addOption(f.path, f.path);
        d.setValue(this.vaultDoc).onChange((v) => {
          this.vaultDoc = v;
          if (v) {
            this.file = null;
            picked.setDesc(v);
          }
        });
      });
    }
    el.createEl("p", {
      cls: "qt-hint",
      text: "Image-only scans need OCR before this step. If the PDF has no text layer, this will stop and say so instead of guessing.",
    });
    const row = el.createDiv({ cls: "qt-row" });
    row.createEl("button", { text: "Cancel", cls: "qt-grow" }).addEventListener("click", () => this.close());
    row.createEl("button", { text: "Analyze", cls: "mod-cta qt-grow" }).addEventListener("click", () => this.analyze());
  }

  async readSource() {
    if (this.file) {
      const name = this.file.name;
      return {
        buf: await this.file.arrayBuffer(),
        name: documentBaseName(name),
        ext: extensionOf(name),
        kind: documentKind(name),
        device: true,
        path: "",
        file: this.file,
      };
    }
    if (this.vaultDoc) {
      const file = this.app.vault.getAbstractFileByPath(this.vaultDoc);
      if (!(file instanceof TFile)) throw new Error("I couldn't find that file in your vault.");
      return {
        buf: await this.app.vault.readBinary(file),
        name: file.basename,
        ext: extensionOf(file.path),
        kind: documentKind(file.path),
        device: false,
        path: file.path,
        file: null,
      };
    }
    throw new Error("Choose a file first.");
  }

  async analyze() {
    const el = this.contentEl;
    el.empty();
    el.createEl("h3", { text: "Reading the document..." });
    const status = el.createDiv({ cls: "qt-hint", text: "Starting..." });
    try {
      const src = await this.readSource();
      if (!src.kind) throw new Error(`This plugin can't read .${src.ext || "that"} files.`);
      status.setText(`Reading ${documentLabel(`${src.name}.${src.ext}`)}...`);
      const read = src.kind === "pdf"
        ? await readPdfPages(src.buf, "", (message) => status.setText(message))
        : await readDocumentPages(src.buf, `${src.name}.${src.ext}`, "", (message) => status.setText(message));
      const pages = (read.pages || []).filter((page) => str(page.text).trim());
      if (!pages.length) throw new Error("No readable text was found. Scanned pages need OCR first; this review will not guess from images.");
      this.source = src;
      this.pages = pages;
      this.result = classifyDocument(pages);
      this.choice = "auto";
      this.renderResult();
    } catch (e) {
      el.empty();
      el.createEl("h3", { text: "This document was not classified" });
      el.createEl("p", { cls: "qt-error", text: str(e && e.message) || "The document could not be read." });
      const row = el.createDiv({ cls: "qt-row" });
      row.createEl("button", { text: "Back", cls: "qt-grow" }).addEventListener("click", () => this.renderSetup());
      row.createEl("button", { text: "Close", cls: "qt-grow" }).addEventListener("click", () => this.close());
    }
  }

  renderResult() {
    const el = this.contentEl;
    const result = this.result;
    const source = this.source;
    const kind = this.choice === "auto" ? result.kind : this.choice;
    const label = DOCUMENT_TYPE_LABELS[kind] || result.label;
    el.empty();
    el.createEl("h3", { text: source.name });
    const badge = el.createDiv({ cls: "qt-doc-badge" });
    badge.createSpan({ cls: `qt-doc-kind qt-doc-kind-${kind}`, text: label });
    badge.createSpan({ cls: "qt-hint", text: `${result.confidence} confidence · ${this.choice === "auto" ? "auto-detected" : "chosen by you"}` });
    el.createEl("p", {
      text: `${result.counts.pages} page${result.counts.pages === 1 ? "" : "s"} · ${result.counts.chars.toLocaleString()} characters · ${result.counts.choices} choice lines · ${result.counts.questions} numbered questions`,
    });
    if (result.reasons.length) {
      el.createEl("p", { cls: "qt-hint", text: "Why:" });
      const list = el.createEl("ul", { cls: "qt-doc-reasons" });
      for (const reason of result.reasons) list.createEl("li", { text: reason });
    }
    if (result.pageResults && result.pageResults.length > 1) {
      const table = el.createEl("table", { cls: "qt-doc-pages" });
      const head = table.createEl("tr");
      head.createEl("th", { text: "Page" });
      head.createEl("th", { text: "Looks like" });
      for (const page of result.pageResults) {
        const row = table.createEl("tr");
        row.createEl("td", { text: String(page.n) });
        row.createEl("td", { text: DOCUMENT_TYPE_LABELS[page.kind] || page.kind });
      }
    }

    new Setting(el)
      .setName("Use this type")
      .setDesc("Auto-detect is shown first, but the final choice is yours.")
      .addDropdown((d) => {
        d.addOption("auto", `Auto-detect (${result.label})`);
        for (const type of DOCUMENT_TYPES) d.addOption(type, DOCUMENT_TYPE_LABELS[type]);
        d.setValue(this.choice).onChange((value) => {
          this.choice = value;
          this.renderResult();
        });
      });

    const aiReady = this.plugin.settings.ai.enabled;
    const canImportQuestions = !this.plugin.moduleOff("mcq") && aiReady;
    if (kind === "mcq" || kind === "mixed") {
      if (!aiReady) {
        el.createEl("p", { cls: "qt-hint", text: "Question import needs AI features turned on. You can still make course notes from this file." });
      } else if (this.plugin.moduleOff("mcq")) {
        el.createEl("p", { cls: "qt-hint", text: "MCQ Tracker is off. Turn it on under Settings, Global, Modules to import questions." });
      }
    }
    if (kind === "frq") {
      el.createEl("p", { cls: "qt-hint", text: "FRQ question notes are still planned. For now this can become a course note with the prompt and rubric text." });
    }
    if (kind === "cards") {
      el.createEl("p", { cls: "qt-hint", text: "Direct card extraction from a document is not wired yet. Make a course note, then use Cards: extract cards from this note." });
    }

    const actions = el.createDiv({ cls: "qt-row qt-doc-actions" });
    actions.createEl("button", { text: "Back", cls: "qt-grow" }).addEventListener("click", () => this.renderSetup());
    if (kind === "mcq" || kind === "mixed") {
      const q = actions.createEl("button", { text: "Import questions", cls: "qt-grow" });
      q.disabled = !canImportQuestions;
      q.addEventListener("click", () => this.route("questions"));
    }
    const notes = actions.createEl("button", { text: "Import course notes", cls: "mod-cta qt-grow" });
    notes.addEventListener("click", () => this.route("notes"));
  }

  route(kind) {
    const source = this.source;
    if (!source) return;
    const options = {
      file: source.device ? source.file : null,
      vaultDoc: source.device ? "" : source.path,
      title: source.name,
    };
    this.close();
    if (kind === "questions") this.plugin.openPdfImport(options);
    else this.plugin.openCourseNotesImport(null, options);
  }

  onClose() {
    this.contentEl.empty();
  }
}

module.exports = { DocumentReviewModal };
