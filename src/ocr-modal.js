"use strict";
/*
 * Optional vision OCR for a scanned PDF. Pages are rendered to PNG locally and
 * sent only after the user ticks the disclosure and presses the action. The
 * returned text is editable and saved as an ordinary Markdown note, never as a
 * hidden cache or a replacement for the original PDF.
 */
const { Modal, Platform, Setting, TFile, normalizePath } = require("obsidian");
const { FolderSuggest } = require("./modals");
const { ensureFolder, localDate, str } = require("./util");
const { renderPdfPagesAsPng } = require("./pdf");
const { OCR_SYSTEM, buildOcrNote, cleanOcrText, ocrPrompt } = require("./ocr");
const { localOcrLabel, normalizeLocalOcr, ocrPagesWithLocalCommand } = require("./local-ocr");

function bytesToBase64(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  if (typeof btoa === "function") return btoa(binary);
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  throw new Error("This device cannot encode page images for the vision model.");
}

function uniquePath(vault, folder, name) {
  const safe = str(name).replace(/[\\/:*?"<>|]/g, "-").trim() || "OCR";
  let path = normalizePath(`${folder}/${safe}.md`);
  let n = 2;
  while (vault.getAbstractFileByPath(path)) {
    path = normalizePath(`${folder}/${safe} ${n}.md`);
    n++;
  }
  return path;
}

class OcrModal extends Modal {
  constructor(app, plugin, onDone) {
    super(app);
    this.plugin = plugin;
    this.onDone = onDone || (() => {});
    this.file = null;
    this.vaultDoc = "";
    this.pages = "";
    this.consent = false;
    this.folder = "OCR";
    this.title = `OCR ${localDate()}`;
    this.source = null;
    this.results = null;
    this.method = "ai";
    this.engineLabel = "";
  }

  onOpen() {
    this.modalEl.addClass("qt-import-modal");
    this.renderSetup();
  }

  canRun() {
    if (this.method === "local") return Platform.isDesktopApp && !!normalizeLocalOcr(this.plugin.settings.localOcr).command;
    return !!this.plugin.settings.ai.enabled && this.plugin.backend() === "api";
  }

  renderSetup() {
    const el = this.contentEl;
    el.empty();
    el.createEl("h3", { text: "OCR a scanned PDF with AI vision" });
    el.createEl("p", {
      cls: "setting-item-description",
      text: this.method === "local"
        ? "Renders the selected PDF pages locally and runs your installed OCR command on each page. No OCR engine is bundled and nothing is uploaded."
        : "Renders the selected PDF pages locally, sends each page image to your Direct AI provider, and returns editable text. This is opt-in and uses your provider key and credit. No OCR engine is bundled with the plugin.",
    });
    el.createEl("p", {
      cls: "qt-hint",
      text: this.method === "local"
        ? "The command runs on this computer. Temporary page files are deleted after the run. You are responsible for the command you install and its licence."
        : "Page images can contain names, handwriting or other personal information. Only the pages you choose are sent, and only after you confirm below. Nothing is uploaded automatically.",
    });
    new Setting(el)
      .setName("How to read")
      .setDesc("AI vision works on desktop and mobile. A local command is desktop-only.")
      .addDropdown((d) => {
        d.addOption("ai", "AI vision (BYOK)");
        if (Platform.isDesktopApp) d.addOption("local", "My installed OCR command (desktop)");
        d.setValue(this.method).onChange((v) => {
          this.method = v;
          this.renderSetup();
        });
      });
    const docs = this.app.vault.getFiles().filter((f) => /\.pdf$/i.test(f.path || f.name));
    const picked = new Setting(el).setName("PDF").setDesc(this.file ? this.file.name : this.vaultDoc || "No file chosen");
    const input = createEl("input", { type: "file", attr: { accept: ".pdf,application/pdf" } });
    input.hidden = true;
    input.addEventListener("change", () => {
      this.file = input.files && input.files[0] ? input.files[0] : null;
      if (this.file) {
        this.vaultDoc = "";
        picked.setDesc(this.file.name);
      }
    });
    picked.addButton((b) => b.setButtonText("Choose PDF...").onClick(() => input.click()));
    if (docs.length) {
      new Setting(el).setName("...or a PDF in your vault").addDropdown((d) => {
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
    new Setting(el)
      .setName("Pages")
      .setDesc("Blank means every page. Example: 1-3 or 2,4.")
      .addText((t) => t.setPlaceholder("All").setValue(this.pages).onChange((v) => (this.pages = v)));
    new Setting(el)
      .setName("Save the OCR note in")
      .setDesc("The folder is created if it does not exist.")
      .addText((t) => {
        new FolderSuggest(this.app, t.inputEl);
        t.setValue(this.folder).onChange((v) => (this.folder = v));
      });
    new Setting(el)
      .setName("Note title")
      .setDesc("The date is already included in the default.")
      .addText((t) => t.setValue(this.title).onChange((v) => (this.title = v)));
    if (this.method === "ai") {
      new Setting(el)
        .setName("I understand page images are sent to my AI provider")
        .setDesc(this.canRun() ? `Provider: ${this.plugin.aiModelLabel()}.` : "Turn on AI features and use Direct AI to enable this.")
        .addToggle((t) =>
          t.setValue(this.consent).onChange((v) => {
            this.consent = v;
            this.renderSetup();
          })
        );
    } else {
      el.createEl("p", { cls: "qt-hint", text: this.canRun() ? "Your installed command will run locally; nothing leaves this computer." : "Add a local OCR command under Settings, Global, General." });
    }
    const row = el.createDiv({ cls: "qt-row" });
    row.createEl("button", { text: "Cancel", cls: "qt-grow" }).addEventListener("click", () => this.close());
    const run = row.createEl("button", { text: "Read pages", cls: "mod-cta qt-grow" });
    run.disabled = this.method === "ai" ? !this.consent || !this.canRun() : !this.canRun();
    run.addEventListener("click", () => this.start());
    if (!this.canRun()) {
      el.createEl("p", {
        cls: "qt-hint",
        text: this.method === "local"
          ? "Local OCR needs a command in Settings, Global, General and is available on desktop only."
          : "Vision OCR requires AI features on and the Direct AI backend. OpenCode cannot receive page images through this plugin.",
      });
    }
  }

  async readSource() {
    if (this.file) {
      const name = this.file.name;
      if (!/\.pdf$/i.test(name)) throw new Error("Choose a PDF first.");
      return { buf: await this.file.arrayBuffer(), name: name.replace(/\.pdf$/i, ""), path: "", device: true, file: this.file };
    }
    if (this.vaultDoc) {
      const file = this.app.vault.getAbstractFileByPath(this.vaultDoc);
      if (!(file instanceof TFile)) throw new Error("I couldn't find that PDF in your vault.");
      return { buf: await this.app.vault.readBinary(file), name: file.basename, path: file.path, device: false, file: null };
    }
    throw new Error("Choose a PDF first.");
  }

  async start() {
    if (this.method === "ai" && !this.consent) {
      this.renderError("Tick the disclosure first.");
      return;
    }
    if (!this.canRun()) {
      this.renderError(this.method === "local" ? "Add a local OCR command in Settings, Global, General first." : "Turn on AI features and choose Direct AI before using vision OCR.");
      return;
    }
    const el = this.contentEl;
    el.empty();
    el.createEl("h3", { text: "Reading the pages..." });
    const status = el.createDiv({ cls: "qt-hint", text: "Starting..." });
    try {
      const src = await this.readSource();
      const rendered = await renderPdfPagesAsPng(src.buf, this.pages, (message) => status.setText(message), 1.5);
      if (!rendered.pages.length) throw new Error("No pages were selected.");
      const results = [];
      if (this.method === "local") {
        const config = normalizeLocalOcr(this.plugin.settings.localOcr);
        this.engineLabel = `local OCR (${localOcrLabel(config.command)})`;
        status.setText(`Reading ${rendered.pages.length} page${rendered.pages.length === 1 ? "" : "s"} with ${localOcrLabel(config.command)}...`);
        results.push(...(await ocrPagesWithLocalCommand(config.command, rendered.pages, { timeoutSeconds: config.timeoutSeconds })));
      } else {
        this.engineLabel = this.plugin.aiModelLabel();
        for (let i = 0; i < rendered.pages.length; i++) {
          const page = rendered.pages[i];
          status.setText(`Reading page ${page.n} (${i + 1} of ${rendered.pages.length}) with ${this.engineLabel}...`);
          const reply = await this.plugin.aiVision(OCR_SYSTEM, ocrPrompt(page.n), [{ data: bytesToBase64(page.png), mime: "image/png" }], { maxTokens: 1800 });
          results.push({ n: page.n, text: cleanOcrText(reply) });
        }
      }
      this.source = src;
      this.results = results;
      this.renderResults();
    } catch (e) {
      this.renderError(str(e && e.message) || "The pages could not be read.");
    }
  }

  renderResults() {
    const el = this.contentEl;
    el.empty();
    el.createEl("h3", { text: "Review the OCR text" });
    el.createEl("p", {
      cls: "setting-item-description",
      text: "Edit anything that was misread. The saved note records the source PDF, method and date, and keeps the text as ordinary Markdown.",
    });
    this.results.forEach((page, index) => {
      el.createEl("h4", { text: `Page ${page.n}` });
      const area = el.createEl("textarea", { cls: "qt-ocr-text" });
      area.value = page.text;
      area.rows = Math.max(6, Math.min(18, page.text.split("\n").length + 2));
      area.addEventListener("input", () => (this.results[index].text = area.value));
    });
    const row = el.createDiv({ cls: "qt-row qt-doc-actions" });
    row.createEl("button", { text: "Back", cls: "qt-grow" }).addEventListener("click", () => this.renderSetup());
    row.createEl("button", { text: "Save OCR note", cls: "mod-cta qt-grow" }).addEventListener("click", () => this.save());
  }

  async save() {
    const pages = (this.results || []).filter((page) => str(page.text).trim());
    if (!pages.length) {
      this.renderError("There is no OCR text to save.");
      return;
    }
    const el = this.contentEl;
    el.empty();
    el.createEl("h3", { text: "Saving the OCR note..." });
    try {
      const folder = normalizePath(str(this.folder).trim() || "OCR");
      await ensureFolder(this.app, folder);
      const note = buildOcrNote(pages, {
        title: this.title,
        sourcePath: this.source && this.source.path,
        sourceName: this.source && this.source.name,
        model: this.engineLabel || (this.method === "local" ? "local OCR" : this.plugin.aiModelLabel()),
        sourceKind: this.method === "local" ? "local-command" : "ai-vision",
        date: localDate(),
      });
      const path = uniquePath(this.app.vault, folder, note.title);
      await this.app.vault.create(path, note.text);
      this.plugin.refreshViews();
      this.showDone(path, pages.length);
      if (this.onDone) this.onDone({ path, pages: pages.length });
    } catch (e) {
      this.renderError(str(e && e.message) || "The OCR note could not be saved.");
    }
  }

  renderError(message) {
    const el = this.contentEl;
    el.empty();
    el.createEl("h3", { text: "Vision OCR did not finish" });
    el.createEl("p", { cls: "qt-error", text: message });
    const row = el.createDiv({ cls: "qt-row" });
    row.createEl("button", { text: "Back", cls: "qt-grow" }).addEventListener("click", () => this.renderSetup());
    row.createEl("button", { text: "Close", cls: "qt-grow" }).addEventListener("click", () => this.close());
  }

  showDone(path, pages) {
    const el = this.contentEl;
    el.empty();
    el.createEl("h3", { text: "OCR note created" });
    el.createEl("p", { text: `Saved ${pages} page${pages === 1 ? "" : "s"} in ${path}.` });
    el.createEl("p", { cls: "qt-hint", text: "You can now review or import the OCR note with the normal document review and course-notes flows." });
    const row = el.createDiv({ cls: "qt-row" });
    row.createEl("button", { text: "Close", cls: "qt-grow" }).addEventListener("click", () => this.close());
    row.createEl("button", { text: "Open note", cls: "mod-cta qt-grow" }).addEventListener("click", () => {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (file instanceof TFile) this.app.workspace.getLeaf("tab").openFile(file);
      this.close();
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

module.exports = { bytesToBase64, uniquePath, OcrModal };
