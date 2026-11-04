"use strict";
const { Modal, Notice, Setting, TFile } = require("obsidian");
const { readPdfPageText, renderPdfPagesAsPng } = require("./pdf");
const { annotationLink, annotationsMarkdown, hashBytes, parseAnnotationFile, removeAnnotation, sidecarPathFor, upsertAnnotation } = require("./pdf-annotations");
const { INK_COLORS, INK_COLOR_HEX, INK_TOOLS, MARK_STYLES, MAX_INK_POINTS, areaAt, boxAt, clamp, drawInkSegment, drawInkStrokes, drawMarks, eraseStrokesAt, normalizeHighlightArea, normalizeHighlightAreas, normalizeInkStroke, normalizeInkStrokes, normalizeTextBox, normalizeTextBoxes, textInArea } = require("./pdf-ink");
const { renderSidebar, rowPage, selectionBounds, sidebarRows, tagInput } = require("./pdf-annotator-sidebar");
const { pageTextFromItems } = require("./reading-companion");
const { formFields, loadEditorDocument } = require("./pdf-editor");

const TOOL_LABELS = { pen: "Pen", highlighter: "Highlighter", text: "Text box", highlight: "Highlight", underline: "Underline", strike: "Strike-through", box: "Box", select: "Select text", eraser: "Eraser" };
const MARK_TOOLS = ["highlight", "underline", "strike", "box", "select"];
const COLOR_LABELS = { yellow: "Yellow", green: "Green", blue: "Blue", red: "Red", purple: "Purple", gray: "Gray" };
const SIZE_PRESETS = {
  thin: { pen: 0.0018, highlighter: 0.012 },
  medium: { pen: 0.003, highlighter: 0.018 },
  thick: { pen: 0.005, highlighter: 0.028 },
};
const ERASER_RADIUS = 0.012;

function clampPage(value, total) {
  const n = Math.round(Number(value) || 1);
  return Math.max(1, total > 0 ? Math.min(total, n) : n);
}

/** Width and height from a PNG IHDR chunk, so the overlay is sized before the image loads. */
function pngDimensions(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  if (data.length >= 24 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) {
    const width = ((data[16] << 24) | (data[17] << 16) | (data[18] << 8) | data[19]) >>> 0;
    const height = ((data[20] << 24) | (data[21] << 16) | (data[22] << 8) | data[23]) >>> 0;
    if (width > 0 && height > 0) return { width, height };
  }
  return { width: 1000, height: 1400 };
}

/** Maps a PDF widget rectangle into the rendered page's normalized top-left space. */
function formRectOnPage(field) {
  const width = Number(field && field.pageWidth) || 0;
  const height = Number(field && field.pageHeight) || 0;
  const rect = field && field.rect;
  if (!rect || width <= 0 || height <= 0) return null;
  const rotation = ((Math.round(Number(field.rotation) || 0) % 360) + 360) % 360;
  const points = [
    [rect.x, rect.y],
    [rect.x + rect.width, rect.y],
    [rect.x + rect.width, rect.y + rect.height],
    [rect.x, rect.y + rect.height],
  ].map(([x, y]) => {
    if (rotation === 90) return [height - y, x];
    if (rotation === 180) return [width - x, y];
    if (rotation === 270) return [y, width - x];
    return [x, height - y];
  });
  const left = Math.min(...points.map((point) => point[0]));
  const right = Math.max(...points.map((point) => point[0]));
  const top = Math.min(...points.map((point) => point[1]));
  const bottom = Math.max(...points.map((point) => point[1]));
  const displayWidth = rotation === 90 || rotation === 270 ? height : width;
  const displayHeight = rotation === 90 || rotation === 270 ? width : height;
  return {
    x: clamp(left / displayWidth, 0, 1),
    y: clamp(top / displayHeight, 0, 1),
    width: clamp((right - left) / displayWidth, 0, 1),
    height: clamp((bottom - top) / displayHeight, 0, 1),
  };
}

function emptyPageLayer() {
  return {
    strokes: [],
    inkId: "",
    textBoxes: [],
    textId: "",
    highlights: [],
    markIds: { highlight: "", underline: "", strike: "", box: "" },
    markTags: { highlight: [], underline: [], strike: [], box: [] },
    quotes: [],
    pageQuoteIds: [],
    editSeq: 0,
  };
}

class TextBoxPromptModal extends Modal {
  constructor(app, options, onDone) {
    super(app);
    this.options = options || {};
    this.onDone = onDone || (() => {});
    this.textEl = null;
    this.copyStatusEl = null;
  }

  onOpen() {
    this.modalEl.addClass("qt-pdf-ink-prompt");
    const el = this.contentEl;
    el.empty();
    el.createEl("h3", { text: this.options.title || "Text box" });
    el.createEl("p", {
      cls: "setting-item-description",
      text: "This text is saved in the PDF's annotation sidecar at the place you clicked.",
    });
    if (this.options.hint) el.createDiv({ cls: "qt-hint qt-pdf-ink-quote-preview", text: `“${this.options.hint}”` });
    if (this.options.copyText) {
      const copyRow = el.createDiv({ cls: "qt-row qt-pdf-ink-actions" });
      copyRow
        .createEl("button", { text: "Copy selected text", cls: "qt-grow" })
        .addEventListener("click", () => this.copySelectedText());
      this.copyStatusEl = el.createDiv({ cls: "qt-hint" });
    }
    this.textEl = el.createEl("textarea", { cls: "qt-pdf-ink-textarea" });
    this.textEl.rows = 5;
    this.textEl.value = this.options.text || "";
    this.tagEl = null;
    if (Array.isArray(this.options.tags)) {
      el.createDiv({ cls: "qt-hint", text: "Tags (optional, comma separated, up to 6, no hash needed)." });
      this.tagEl = el.createEl("input", { cls: "qt-input", type: "text" });
      this.tagEl.placeholder = "e.g. exam, weak-spot";
      this.tagEl.value = this.options.tags.map((tag) => `#${tag}`).join(" ");
    }
    const row = el.createDiv({ cls: "qt-row qt-pdf-ink-actions" });
    const save = row.createEl("button", { text: "Save", cls: "mod-cta qt-grow" });
    save.addEventListener("click", () => this.commit());
    const cancel = row.createEl("button", { text: "Cancel", cls: "qt-grow" });
    cancel.addEventListener("click", () => this.close());
    this.textEl.focus();
  }

  async copySelectedText() {
    const text = String(this.options.copyText || "");
    if (!text) return false;
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
        throw new Error("Clipboard unavailable");
      }
      await navigator.clipboard.writeText(text);
      if (this.copyStatusEl) this.copyStatusEl.setText(`Copied ${text.length} character${text.length === 1 ? "" : "s"}.`);
      return true;
    } catch (error) {
      if (this.copyStatusEl) this.copyStatusEl.setText("Could not copy the selected text in this view.");
      new Notice("Could not copy the selected text. Select it again and use your system copy shortcut.");
      return false;
    }
  }

  commit() {
    const value = this.textEl ? this.textEl.value : "";
    this.close();
    this.onDone(value, this.tagEl ? this.tagEl.value : "");
  }

  onClose() {
    this.contentEl.empty();
  }
}

/* A canvas overlay on top of a rendered PDF page. */
class PdfInkModal extends Modal {
  constructor(app, plugin, options) {
    super(app);
    this.plugin = plugin;
    this.pdfPath = (options && options.pdfPath) || "";
    this.page = Math.max(1, Math.round(Number(options && options.page) || 1));
    this.total = 0;
    this.tool = "pen";
    this.color = "blue";
    this.size = "medium";
    this.strokes = [];
    this.inkId = "";
    this.textBoxes = [];
    this.textId = "";
    this.highlights = [];
    this.markIds = { highlight: "", underline: "", strike: "", box: "" };
    this.quotes = [];
    this.pageQuoteIds = [];
    this.textItems = [];
    this.highlightStart = null;
    this.highlightDraft = null;
    this.lastPoint = null;
    this.history = [];
    this.currentHash = "";
    this.savedHash = "";
    this.sidecarPath = "";
    this.objectUrl = "";
    this.loadToken = 0;
    this.editSeq = 0;
    this.drawing = null;
    this.erasing = false;
    this.dirty = false;
    this.busy = false;
    this.pageInputEl = null;
    this.pageTotalEl = null;
    this.statusEl = null;
    this.stageEl = null;
    this.sidebarEl = null;
    this.toggleEl = null;
    this.sidebarOpen = true;
    this.sidebarQuery = "";
    this.sidebarType = "";
    this.annotationRows = [];
    this.selectedId = "";
    this.editingNoteId = "";
    this.editingTagsId = "";
    this.markTags = { highlight: [], underline: [], strike: [], box: [] };
    this.pageWrap = null;
    this.canvas = null;
    this.ctx = null;
    this.pageWraps = new Map();
    this.pageCanvases = new Map();
    this.pageContexts = new Map();
    this.pageAnnotations = new Map();
    this.pageTexts = new Map();
    this.histories = new Map();
    this.dirtyPages = new Set();
    this.objectUrls = [];
    this.formFields = [];
    this.formLayers = new Map();
  }

  onOpen() {
    this.modalEl.addClass("qt-pdf-ink-modal");
    const last = this.plugin.pdfLastPage ? this.plugin.pdfLastPage(this.pdfPath) : 0;
    if (last > 0 && this.page === 1) this.page = last;
    try {
      const stored = this.app.loadLocalStorage ? this.app.loadLocalStorage("mcq-pdf-sidebar-open") : null;
      if (stored === false) this.sidebarOpen = false;
    } catch (e) {
      /* ignore storage failures */
    }
    if (this.modalEl && this.modalEl.addEventListener) {
      this.modalEl.addEventListener("keydown", (event) => this.handleKey(event));
    }
    this.render();
    this.loadPage();
  }

  onClose() {
    this.loadToken++;
    if (this.dirty) this.save().catch(() => {});
    for (const url of this.objectUrls.concat(this.objectUrl ? [this.objectUrl] : [])) {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {
        /* ignore */
      }
    }
    this.objectUrls = [];
    this.objectUrl = "";
    this.pageWraps.clear();
    this.pageCanvases.clear();
    this.pageContexts.clear();
    this.contentEl.empty();
  }

  /* ------------------------------------------------------------ page state */

  pageLayer(page) {
    const n = Math.max(1, Math.round(Number(page) || 1));
    if (!this.pageAnnotations.has(n)) this.pageAnnotations.set(n, emptyPageLayer());
    return this.pageAnnotations.get(n);
  }

  storePageAnnotations() {
    const layer = this.pageLayer(this.page);
    layer.strokes = this.strokes;
    layer.inkId = this.inkId;
    layer.textBoxes = this.textBoxes;
    layer.textId = this.textId;
    layer.highlights = this.highlights;
    layer.markIds = this.markIds;
    layer.markTags = this.markTags;
    layer.quotes = this.quotes;
    layer.pageQuoteIds = this.pageQuoteIds;
    layer.editSeq = this.editSeq;
    this.histories.set(this.page, this.history);
    return layer;
  }

  applyPageAnnotations(page) {
    this.page = clampPage(page, this.total || page);
    const layer = this.pageLayer(this.page);
    this.strokes = layer.strokes;
    this.inkId = layer.inkId;
    this.textBoxes = layer.textBoxes;
    this.textId = layer.textId;
    this.highlights = layer.highlights;
    this.markIds = layer.markIds;
    this.markTags = layer.markTags;
    this.quotes = layer.quotes;
    this.pageQuoteIds = layer.pageQuoteIds;
    this.textItems = this.pageTexts.get(this.page) || [];
    this.history = this.histories.get(this.page) || [];
    this.editSeq = Number(layer.editSeq) || 0;
    this.dirty = this.dirtyPages.size > 0;
    this.highlightStart = null;
    this.highlightDraft = null;
    this.drawing = null;
    this.erasing = false;
    if (this.pageInputEl) this.pageInputEl.value = String(this.page);
    if (this.pageTotalEl) this.pageTotalEl.setText(`of ${this.total || "?"}`);
    return layer;
  }

  /** Switch the active page without saving or animating the scroll container. */
  activatePage(page, options) {
    const opts = options || {};
    const target = clampPage(page, this.total || page);
    if (target === Number(this.page) && !opts.force) return this.page;
    this.storePageAnnotations();
    this.applyPageAnnotations(target);
    if (this.plugin.rememberPdfPage) this.plugin.rememberPdfPage(this.pdfPath, this.page);
    this.redrawAll();
    if (!opts.silent) this.setStatus(`Page ${this.page} of ${this.total || "?"}.`);
    return this.page;
  }

  setStatus(text) {
    if (this.statusEl) this.statusEl.setText(text);
  }

  pdfFiles() {
    return this.app.vault
      .getFiles()
      .filter((f) => f instanceof TFile && /\.pdf$/i.test(f.path))
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  widthForTool() {
    const preset = SIZE_PRESETS[this.size] || SIZE_PRESETS.medium;
    return this.tool === "highlighter" ? preset.highlighter : preset.pen;
  }

  opacityForTool() {
    return this.tool === "highlighter" ? 0.35 : 0.9;
  }

  render() {
    const el = this.contentEl;
    el.empty();
    el.createEl("h3", { text: "Draw on a PDF" });
    el.createEl("p", {
      cls: "setting-item-description",
      text: "Pen, highlighter, text-box and highlight edits are saved in the PDF's annotation sidecar. They are stored as page coordinates, so they stay in place at any zoom or on another device. Quoted highlights and page notes remain available in Add a PDF annotation.",
    });

    const files = this.pdfFiles();
    if (!files.length) {
      el.createEl("p", { cls: "qt-hint", text: "No PDFs are in this vault yet. Add one, then reopen this window." });
      return;
    }
    if (!this.pdfPath || !files.some((f) => f.path === this.pdfPath)) {
      const active = this.app.workspace.getActiveFile();
      this.pdfPath = active && /\.pdf$/i.test(active.path) ? active.path : files[0].path;
    }

    new Setting(el).setName("PDF").addDropdown((d) => {
      for (const file of files) d.addOption(file.path, file.path);
      d.setValue(this.pdfPath).onChange(async (v) => {
        if (v === this.pdfPath) return;
        if (!(await this.leavePage())) return;
        this.pdfPath = v;
        this.page = 1;
        this.total = 0;
        this.pageAnnotations = new Map();
        this.pageTexts = new Map();
        this.histories = new Map();
        this.dirtyPages = new Set();
        this.dirty = false;
        await this.loadDocument();
      });
    });

    const nav = el.createDiv({ cls: "qt-pdf-ink-nav" });
    const prev = nav.createEl("button", { text: "Previous", cls: "qt-grow" });
    prev.addEventListener("click", () => this.stepPage(-1));
    const pageLabel = nav.createEl("label", { cls: "qt-pdf-ink-page-label", text: "Page" });
    this.pageInputEl = pageLabel.createEl("input", { type: "number", cls: "qt-pdf-ink-page-input" });
    this.pageInputEl.min = "1";
    this.pageInputEl.value = String(this.page);
    this.pageInputEl.addEventListener("change", () => this.goToPage(this.pageInputEl.value));
    this.pageTotalEl = pageLabel.createEl("span", { cls: "qt-pdf-ink-page-total", text: "of ?" });
    const next = nav.createEl("button", { text: "Next", cls: "qt-grow" });
    next.addEventListener("click", () => this.stepPage(1));

    new Setting(el).setName("Tool").addDropdown((d) => {
      for (const tool of [...INK_TOOLS, "underline", "strike", "box", "select", "text", "highlight", "eraser"]) d.addOption(tool, TOOL_LABELS[tool]);
      d.setValue(this.tool).onChange((v) => {
        this.tool = INK_TOOLS.includes(v) || ["underline", "strike", "box", "select", "text", "highlight", "eraser"].includes(v) ? v : "pen";
        if (this.tool === "highlighter" && this.color === "blue") this.color = "yellow";
      });
    });

    new Setting(el).setName("Colour").addDropdown((d) => {
      for (const color of INK_COLORS) d.addOption(color, COLOR_LABELS[color]);
      d.setValue(this.color).onChange((v) => {
        this.color = INK_COLORS.includes(v) ? v : "blue";
      });
    });

    new Setting(el).setName("Thickness").addDropdown((d) => {
      d.addOption("thin", "Thin");
      d.addOption("medium", "Medium");
      d.addOption("thick", "Thick");
      d.setValue(this.size).onChange((v) => {
        this.size = Object.prototype.hasOwnProperty.call(SIZE_PRESETS, v) ? v : "medium";
      });
    });

    const actions = el.createDiv({ cls: "qt-row qt-pdf-ink-actions" });
    const undo = actions.createEl("button", { text: "Undo", cls: "qt-grow" });
    undo.addEventListener("click", () => this.undo());
    const clear = actions.createEl("button", { text: "Clear page", cls: "qt-grow" });
    clear.addEventListener("click", () => this.clear());
    const save = actions.createEl("button", { text: "Save", cls: "qt-grow" });
    save.addEventListener("click", () => this.save());
    const saveClose = actions.createEl("button", { text: "Save & close", cls: "mod-cta qt-grow" });
    saveClose.addEventListener("click", () => this.save({ close: true }));
    const copyLink = actions.createEl("button", { text: "Copy page link", cls: "qt-grow" });
    copyLink.addEventListener("click", () => this.copyPageLink());
    const exportNotes = actions.createEl("button", { text: "Export notes", cls: "qt-grow" });
    exportNotes.addEventListener("click", () => this.exportNotes());
    const askPage = actions.createEl("button", { text: "Ask AI about this page", cls: "qt-grow" });
    askPage.addEventListener("click", () => this.askPage());
    const editPdf = actions.createEl("button", { text: "Edit pages and forms", cls: "qt-grow" });
    editPdf.addEventListener("click", () => this.openEditor());

    this.toggleEl = actions.createEl("button", { text: "Annotations", cls: "qt-grow qt-pdf-ink-annotations-toggle" });
    this.toggleEl.addEventListener("click", () => this.toggleSidebar());

    this.statusEl = el.createDiv({ cls: "qt-hint" });
    const layout = el.createDiv({ cls: "qt-pdf-ink-layout" });
    this.stageEl = layout.createDiv({ cls: "qt-pdf-ink-stage" });
    if (this.stageEl.setAttribute) {
      this.stageEl.setAttribute("aria-label", "Continuous PDF pages");
      this.stageEl.setAttribute("role", "region");
    }
    if (this.stageEl.addEventListener) this.stageEl.addEventListener("scroll", () => this.onStageScroll());
    this.sidebarEl = layout.createDiv({ cls: "qt-pdf-ink-sidebar-host" });
    if (!this.sidebarOpen) this.sidebarEl.addClass("is-collapsed");
    this.renderSidebarPanel();
    if (this.busy) this.setStatus("Loading…");
  }

  async loadPage() {
    return this.loadDocument();
  }

  /** Loads every page once and builds the continuous vertical reader. */
  async loadDocument() {
    if (!this.stageEl) return;
    const token = ++this.loadToken;
    this.busy = true;
    this.setStatus("Rendering all pages…");
    try {
      const file = this.app.vault.getAbstractFileByPath(this.pdfPath);
      if (!file || !(file instanceof TFile)) throw new Error("That PDF is no longer in the vault.");
      const bytes = await this.app.vault.readBinary(file);
      const hash = hashBytes(bytes);
      const rendered = await renderPdfPagesAsPng(bytes, "", (message) => this.setStatus(message), 1.6);
      if (token !== this.loadToken) return;
      if (!rendered.pages.length) throw new Error("That PDF could not be rendered.");
      this.total = Math.max(Number(rendered.total) || 0, rendered.pages.length);
      this.currentHash = hash;
      this.formFields = [];
      try {
        const formDocument = await loadEditorDocument(bytes);
        if (formDocument.ok) this.formFields = formFields(formDocument.doc).fields;
      } catch (e) {
        this.formFields = [];
      }
      this.pageAnnotations = new Map();
      this.pageTexts = new Map();
      this.histories = new Map();
      this.dirtyPages = new Set();
      this.dirty = false;
      await this.loadSidecar();
      if (token !== this.loadToken) return;
      this.showPages(rendered.pages);
      this.page = clampPage(this.page, this.total);
      this.applyPageAnnotations(this.page);
      this.page = clampPage(this.page, this.total);
      if (this.pageInputEl) this.pageInputEl.value = String(this.page);
      if (this.pageTotalEl) this.pageTotalEl.setText(`of ${this.total || "?"}`);
      this.scrollPageIntoView(this.page);
      await this.refreshAnnotations();
      if (token !== this.loadToken) return;
      for (const entry of rendered.pages) {
        try {
          const text = await readPdfPageText(bytes, entry.n);
          this.pageTexts.set(entry.n, text.items || []);
        } catch (e) {
          this.pageTexts.set(entry.n, []);
        }
        if (token !== this.loadToken) return;
      }
      this.applyPageAnnotations(this.page);
      this.redrawAll();
      const warning = this.savedHash && this.savedHash !== hash ? " The PDF changed since its annotations were saved; check that the page still matches." : "";
      this.setStatus(`${this.total} page${this.total === 1 ? "" : "s"} ready. Scroll or jump, then draw and Save.${warning}`);
      if (this.plugin.rememberPdfPage) this.plugin.rememberPdfPage(this.pdfPath, this.page);
    } catch (e) {
      if (token === this.loadToken) this.setStatus(e && e.message ? e.message : String(e));
    } finally {
      if (token === this.loadToken) this.busy = false;
    }
  }

  async loadSidecar() {
    this.sidecarPath = sidecarPathFor(this.pdfPath);
    this.pageAnnotations = new Map();
    for (let n = 1; n <= this.total; n++) this.pageAnnotations.set(n, emptyPageLayer());
    this.savedHash = "";
    const existing = this.app.vault.getAbstractFileByPath(this.sidecarPath);
    if (!existing) {
      this.applyPageAnnotations(this.page);
      return;
    }
    let parsed;
    try {
      parsed = parseAnnotationFile(await this.app.vault.cachedRead(existing));
    } catch (e) {
      this.setStatus(e.message);
      return;
    }
    this.savedHash = parsed.pdfHash || "";
    for (const annotation of parsed.annotations || []) {
      const page = Math.round(Number(annotation.page));
      if (!Number.isInteger(page) || page < 1) continue;
      const layer = this.pageLayer(page);
      if (annotation.type === "pen" && Array.isArray(annotation.strokes) && annotation.strokes.length) {
        layer.inkId = annotation.id;
        layer.strokes = normalizeInkStrokes(annotation.strokes);
      } else if (annotation.type === "text" && Array.isArray(annotation.boxes) && annotation.boxes.length) {
        layer.textId = annotation.id;
        layer.textBoxes = normalizeTextBoxes(annotation.boxes);
      } else if (MARK_STYLES.includes(annotation.type) && Array.isArray(annotation.areas) && annotation.areas.length) {
        layer.markIds[annotation.type] = annotation.id;
        layer.markTags[annotation.type] = Array.isArray(annotation.tags) ? annotation.tags.slice() : [];
        for (const area of normalizeHighlightAreas(annotation.areas)) layer.highlights.push({ ...area, style: annotation.type });
      } else if (annotation.type === "quote") {
        layer.quotes.push(annotation);
        layer.pageQuoteIds.push(annotation.id);
      }
    }
    this.applyPageAnnotations(this.page);
    this.redrawAll();
  }

  /** Builds one wrap, image and overlay canvas for every page in the document. */
  showPages(pages) {
    if (!this.stageEl) return;
    this.stageEl.empty();
    for (const url of this.objectUrls) {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {
        /* ignore */
      }
    }
    this.objectUrls = [];
    this.pageWraps = new Map();
    this.pageCanvases = new Map();
    this.pageContexts = new Map();
    this.formLayers = new Map();
    for (const entry of pages || []) {
      const n = Math.max(1, Math.round(Number(entry.n) || 1));
      const wrap = this.stageEl.createDiv({ cls: "qt-pdf-ink-page-wrap" });
      if (wrap.setAttribute) {
        wrap.setAttribute("data-page", String(n));
        wrap.setAttribute("aria-label", `Page ${n} of ${this.total || pages.length}`);
      }
      this.stageEl.createDiv({ cls: "qt-pdf-ink-page-number", text: `Page ${n}` });
      const image = wrap.createEl("img", { cls: "qt-pdf-ink-page" });
      image.alt = `Page ${n}`;
      let url = "";
      try {
        if (typeof Blob !== "undefined" && typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
          url = URL.createObjectURL(new Blob([entry.png], { type: "image/png" }));
          this.objectUrls.push(url);
          image.src = url;
        }
      } catch (e) {
        url = "";
      }
      const size = pngDimensions(entry.png);
      this.renderFormOverlay(wrap, n);
      const canvas = wrap.createEl("canvas", { cls: "qt-pdf-ink-canvas" });
      canvas.width = size.width;
      canvas.height = size.height;
      const ctx = canvas.getContext ? canvas.getContext("2d") : null;
      this.pageWraps.set(n, wrap);
      this.pageCanvases.set(n, canvas);
      this.pageContexts.set(n, ctx);
      this.bindCanvas(canvas, n);
    }
    this.pageWrap = this.pageWraps.get(this.page) || this.pageWraps.values().next().value || null;
    this.canvas = this.pageCanvases.get(this.page) || this.pageCanvases.values().next().value || null;
    this.ctx = this.pageContexts.get(this.page) || this.pageContexts.values().next().value || null;
    this.redrawAll();
  }

  /** Read-only field boxes sit under the annotation canvas and follow page scrolling. */
  renderFormOverlay(wrap, page) {
    const fields = (this.formFields || []).filter((field) => Number(field.page) === Number(page) - 1);
    if (!fields.length) return null;
    const layer = wrap.createDiv({ cls: "qt-pdf-ink-form-layer" });
    for (const field of fields) {
      const rects = Array.isArray(field.rects) && field.rects.length ? field.rects : [field.rect];
      for (const source of rects) {
        const rect = formRectOnPage({ ...field, rect: source });
        if (!rect) continue;
        const box = layer.createDiv({ cls: "qt-pdf-ink-form-field" });
        box.style.left = `${rect.x * 100}%`;
        box.style.top = `${rect.y * 100}%`;
        box.style.width = `${rect.width * 100}%`;
        box.style.height = `${rect.height * 100}%`;
        box.setAttribute("title", `${field.name}${field.readOnly ? " (read-only)" : ""}`);
        box.createSpan({ text: field.value ? `${field.name}: ${field.value}` : field.name });
      }
    }
    this.formLayers.set(Number(page), layer);
    return layer;
  }

  async showPage(png) {
    this.showPages([{ n: this.page, png }]);
  }

  bindCanvas(canvas, pageNumber) {
    if (!canvas || !canvas.addEventListener) return;
    const page = Math.max(1, Math.round(Number(pageNumber) || this.page));
    const pointAt = (event) => {
      const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { left: 0, top: 0, width: canvas.width, height: canvas.height };
      const width = Number(rect.width) || canvas.width || 1;
      const height = Number(rect.height) || canvas.height || 1;
      return [clamp((Number(event.clientX) - Number(rect.left || 0)) / width, 0, 1), clamp((Number(event.clientY) - Number(rect.top || 0)) / height, 0, 1)];
    };
    const activate = () => {
      if (page !== Number(this.page)) this.activatePage(page, { silent: true });
    };
    canvas.addEventListener("pointerdown", (event) => {
      if (this.busy) return;
      activate();
      if (event.preventDefault) event.preventDefault();
      if (canvas.setPointerCapture && event.pointerId !== undefined) {
        try {
          canvas.setPointerCapture(event.pointerId);
        } catch (e) {
          /* ignore */
        }
      }
      const point = pointAt(event);
      this.lastPoint = point;
      if (this.tool === "text") {
        this.editTextBox(point, boxAt(this.textBoxes, point));
        return;
      }
      if (MARK_TOOLS.includes(this.tool)) {
        this.highlightStart = point;
        this.highlightDraft = normalizeHighlightArea({ x: point[0], y: point[1], width: 0.001, height: 0.001, color: this.color, note: "", style: this.tool === "select" ? "highlight" : this.tool });
        this.redraw();
        return;
      }
      if (this.tool === "eraser") {
        this.pushHistory();
        this.erasing = true;
        this.eraseAt(point);
        return;
      }
      this.pushHistory();
      const stroke = normalizeInkStroke({
        tool: this.tool,
        color: this.color,
        width: this.widthForTool(),
        opacity: this.opacityForTool(),
        points: [point],
      });
      if (!stroke) return;
      this.strokes.push(stroke);
      this.drawing = this.strokes[this.strokes.length - 1];
      this.touch();
      this.redraw();
    });
    canvas.addEventListener("pointermove", (event) => {
      if (this.busy) return;
      if (this.highlightStart) {
        if (event.preventDefault) event.preventDefault();
        const point = pointAt(event);
        this.lastPoint = point;
        const start = this.highlightStart;
        const x = Math.min(start[0], point[0]);
        const y = Math.min(start[1], point[1]);
        this.highlightDraft = normalizeHighlightArea({
          x,
          y,
          width: Math.max(0.001, Math.abs(start[0] - point[0])),
          height: Math.max(0.001, Math.abs(start[1] - point[1])),
          color: this.color,
          note: "",
          style: this.tool === "select" ? "highlight" : this.tool,
        });
        this.redraw();
        return;
      }
      if (this.erasing) {
        if (event.preventDefault) event.preventDefault();
        this.eraseAt(pointAt(event));
        return;
      }
      if (!this.drawing) return;
      if (event.preventDefault) event.preventDefault();
      const point = pointAt(event);
      const points = this.drawing.points;
      const last = points[points.length - 1];
      if (!last || Math.hypot(point[0] - last[0], point[1] - last[1]) < 0.0015) return;
      if (points.length >= MAX_INK_POINTS) return;
      points.push(point);
      drawInkSegment(this.ctx, this.drawing, last, point, this.canvas.width, this.canvas.height);
      this.touch();
    });
    const finish = () => {
      if (this.highlightStart) this.finishHighlight();
      if (this.drawing) {
        this.drawing = null;
        this.redraw();
      }
      this.erasing = false;
    };
    canvas.addEventListener("pointerup", finish);
    canvas.addEventListener("pointercancel", finish);
    canvas.addEventListener("pointerleave", (event) => {
      if (this.drawing && event.buttons === 0) finish();
    });
  }

  eraseAt(point) {
    const hitHighlight = areaAt(this.highlights, point);
    if (hitHighlight) {
      this.highlights = this.highlights.filter((area) => area !== hitHighlight);
      this.touch();
      this.redraw();
      return;
    }
    const hitBox = boxAt(this.textBoxes, point);
    if (hitBox) {
      this.textBoxes = this.textBoxes.filter((box) => box !== hitBox);
      this.touch();
      this.redraw();
      return;
    }
    const next = eraseStrokesAt(this.strokes, point, ERASER_RADIUS);
    if (next.length === this.strokes.length) return;
    this.strokes = next;
    this.touch();
    this.redraw();
  }

  touch() {
    this.editSeq++;
    this.dirtyPages.add(this.page);
    this.dirty = true;
    this.storePageAnnotations();
    this.redrawPage(this.page);
  }

  pageContext(page) {
    const n = Math.round(Number(page) || this.page);
    return {
      canvas: this.pageCanvases.get(n) || (n === Number(this.page) ? this.canvas : null),
      ctx: this.pageContexts.get(n) || (n === Number(this.page) ? this.ctx : null),
    };
  }

  redrawPage(page) {
    const { canvas, ctx } = this.pageContext(page);
    if (!ctx || !canvas) return;
    const width = canvas.width;
    const height = canvas.height;
    const layer = this.pageLayer(page);
    ctx.clearRect(0, 0, width, height);
    drawMarks(ctx, layer.highlights, width, height);
    for (const quote of layer.quotes) drawMarks(ctx, quote.areas, width, height);
    if (Number(page) === Number(this.page) && this.highlightDraft) drawMarks(ctx, [this.highlightDraft], width, height);
    drawInkStrokes(ctx, layer.strokes, width, height, false);
    drawTextBoxes(ctx, layer.textBoxes, width, height);
    const selected = this.annotationRows.find((row) => row.id === this.selectedId);
    if (selected && rowPage(selected) === Number(page)) {
      const bounds = selectionBounds(selected.areas);
      if (bounds) drawSelectionRing(ctx, bounds, width, height);
    }
  }

  redrawAll() {
    if (!this.pageWraps.size) {
      this.redrawPage(this.page);
      return;
    }
    for (const page of this.pageWraps.keys()) this.redrawPage(page);
  }

  redraw() {
    this.storePageAnnotations();
    this.redrawPage(this.page);
  }

  snapshot() {
    return {
      strokes: this.strokes.map((stroke) => ({ ...stroke, points: stroke.points.map((point) => point.slice()) })),
      textBoxes: this.textBoxes.map((box) => ({ ...box })),
      highlights: this.highlights.map((area) => ({ ...area })),
    };
  }

  pushHistory() {
    this.history.push(this.snapshot());
    if (this.history.length > 50) this.history.shift();
    this.histories.set(this.page, this.history);
  }

  undo() {
    const previous = this.history.pop();
    if (!previous) return;
    this.strokes = previous.strokes;
    this.textBoxes = previous.textBoxes;
    this.highlights = previous.highlights;
    this.touch();
    this.redraw();
  }

  clear() {
    if (!this.strokes.length && !this.textBoxes.length && !this.highlights.length) return;
    this.pushHistory();
    this.strokes = [];
    this.textBoxes = [];
    this.highlights = [];
    // Keep inkId/textId/highlightId: saving an empty page must remove the layers.
    this.touch();
    this.redraw();
  }

  finishHighlight() {
    const startPoint = this.highlightStart;
    const endPoint = this.lastPoint || startPoint;
    const selecting = this.tool === "select";
    const style = selecting ? "highlight" : MARK_STYLES.includes(this.tool) ? this.tool : "highlight";
    this.highlightStart = null;
    this.highlightDraft = null;
    if (!startPoint || !endPoint) {
      this.redraw();
      return;
    }
    const width = Math.abs(endPoint[0] - startPoint[0]);
    const height = Math.abs(endPoint[1] - startPoint[1]);
    if (width >= 0.01 && height >= 0.01) {
      const rect = { x: Math.min(startPoint[0], endPoint[0]), y: Math.min(startPoint[1], endPoint[1]), width, height };
      if (selecting) {
        const picked = textInArea(this.textItems, rect);
        if (!picked.quote) {
          this.setStatus("No text under that drag. Use Highlight for a free area, or drag across a line of text.");
          this.redraw();
          return;
        }
        const preview = picked.quote.split("\n").join(" ").slice(0, 160);
        new TextBoxPromptModal(this.app, { title: "Note on this quote", text: "", hint: preview, copyText: picked.quote, tags: [] }, (value, tagsText) => {
          this.saveQuote({ quote: picked.quote, areas: picked.areas, note: value, color: this.color, tags: tagInput(tagsText) });
        }).open();
        this.redraw();
        return;
      }
      const area = normalizeHighlightArea({ ...rect, color: this.color, style, note: "" });
      this.redraw();
      if (!area) return;
      new TextBoxPromptModal(this.app, { title: `${TOOL_LABELS[style] || "Mark"} note`, text: "", tags: this.markTags[style] || [] }, (value, tagsText) => {
        area.note = String(value || "").trim();
        this.markTags[style] = tagInput(tagsText);
        this.pushHistory();
        this.highlights.push(area);
        this.touch();
        this.redraw();
      }).open();
      return;
    }
    const hit = areaAt(this.highlights, endPoint);
    if (hit) this.editHighlightNote(hit);
    else this.setStatus(selecting ? "Drag across text to quote it." : "Drag across an area to mark it.");
    this.redraw();
  }

  /** Quotes are their own annotations, saved as soon as the note is confirmed. */
  async saveQuote(input) {
    try {
      const file = this.app.vault.getAbstractFileByPath(this.pdfPath);
      if (!file || !(file instanceof TFile)) throw new Error("That PDF is no longer in the vault.");
      const bytes = await this.app.vault.readBinary(file);
      const hash = hashBytes(bytes);
      const path = sidecarPathFor(this.pdfPath);
      const existing = this.app.vault.getAbstractFileByPath(path);
      const oldText = existing ? await this.app.vault.cachedRead(existing) : "";
      const result = upsertAnnotation(
        oldText,
        { page: this.page, type: "quote", color: input.color, quote: input.quote, note: input.note, tags: Array.isArray(input.tags) ? input.tags : [], areas: input.areas },
        { pdfPath: this.pdfPath, pdfHash: hash }
      );
      if (existing) await this.app.vault.modify(existing, result.text);
      else await this.app.vault.create(path, result.text);
      this.sidecarPath = path;
      this.savedHash = hash;
      this.quotes = (result.annotations || []).filter((entry) => entry.page === Number(this.page) && entry.type === "quote");
      this.pageQuoteIds = this.quotes.map((entry) => entry.id);
      await this.refreshAnnotations();
      const last = this.quotes[this.quotes.length - 1];
      const link = annotationLink(this.pdfPath, this.page, last ? last.id : "");
      this.setStatus(`Saved a quote${input.note ? " with a note" : ""} on page ${this.page}.${link ? ` Link: ${link}` : ""}`);
      this.touch();
      this.redraw();
      return true;
    } catch (e) {
      this.setStatus(e && e.message ? e.message : String(e));
      return false;
    }
  }

  async copyPageLink() {
    const link = annotationLink(this.pdfPath, this.page, "");
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(link);
      this.setStatus(`Copied ${link}.`);
    } catch (e) {
      this.setStatus(`Could not copy ${link} in this view.`);
    }
  }

  async exportNotes() {
    if (!this.plugin.exportPdfAnnotations) {
      this.setStatus("Export is unavailable in this version.");
      return;
    }
    try {
      const path = await this.plugin.exportPdfAnnotations(this.pdfPath);
      this.setStatus(path ? `Wrote ${path}.` : "No annotations to export yet.");
    } catch (e) {
      this.setStatus(e && e.message ? e.message : String(e));
    }
  }

  editHighlightNote(existing) {
    new TextBoxPromptModal(
      this.app,
      { title: "Edit highlight note", text: existing.note || "" },
      (value) => {
        this.pushHistory();
        existing.note = String(value || "").trim();
        this.touch();
        this.redraw();
      }
    ).open();
  }

  editTextBox(point, existing) {
    new TextBoxPromptModal(
      this.app,
      { title: existing ? "Edit text box" : "Add text box", text: existing ? existing.text : "" },
      (value) => {
        const text = String(value || "").trim();
        if (existing) {
          const index = this.textBoxes.indexOf(existing);
          if (index < 0) return;
          this.pushHistory();
          if (!text) this.textBoxes.splice(index, 1);
          else existing.text = text;
          this.touch();
          this.redraw();
          return;
        }
        if (!text) return;
        const box = normalizeTextBox({ text, x: point[0], y: point[1], width: 0.36, height: 0.12, size: 0.016, color: this.color });
        if (!box) return;
        this.pushHistory();
        this.textBoxes.push(box);
        this.touch();
        this.redraw();
      }
    ).open();
  }

  /** Rebuilds the sidebar from the sidecar. The sidecar stays the only source of truth. */
  async refreshAnnotations() {
    let rows = [];
    try {
      const data = await this.plugin.pdfAnnotationRows(this.pdfPath);
      rows = data && Array.isArray(data.rows) ? data.rows : [];
    } catch (e) {
      rows = [];
    }
    this.annotationRows = rows;
    for (const row of rows) {
      if (row.page === Number(this.page) && MARK_STYLES.includes(row.type)) this.markTags[row.type] = Array.isArray(row.tags) ? row.tags.slice() : [];
    }
    if (this.selectedId && !rows.some((row) => row.id === this.selectedId)) this.selectedId = "";
    this.renderSidebarPanel();
    this.redraw();
    return rows;
  }

  /** Send the current page's text layer to the Study agent. */
  async askPage() {
    const quote = pageTextFromItems(this.textItems);
    if (!quote) {
      this.setStatus("That page has no selectable text. Use a quote annotation or OCR first.");
      new Notice("That page has no selectable text to ask about. Use a quote annotation or OCR first.");
      return false;
    }
    const sent = await this.plugin.askPdfPassage(this.pdfPath, { page: this.page, type: "page", quote, note: "", tags: [], id: "" });
    this.setStatus(sent ? `Asked the Study agent about page ${this.page}.` : "The page question was not sent.");
    return sent;
  }

  /** Send one quote or note from the sidebar to the Study agent. */
  async askAnnotation(id) {
    const row = this.annotationRows.find((entry) => entry.id === id);
    if (!row) return false;
    const sent = await this.plugin.askPdfPassage(this.pdfPath, row);
    this.setStatus(sent ? `Asked the Study agent about page ${rowPage(row)}.` : "The passage question was not sent.");
    return sent;
  }

  renderSidebarPanel() {
    if (!this.sidebarEl) return;
    if (this.toggleEl && this.toggleEl.setText) this.toggleEl.setText(`Annotations (${this.annotationRows.length})`);
    if (!this.sidebarOpen) {
      this.sidebarEl.empty();
      return;
    }
    const types = [...new Set(this.annotationRows.map((row) => row.type).filter(Boolean))].sort();
    const model = {
      rows: sidebarRows(this.annotationRows, { query: this.sidebarQuery, type: this.sidebarType, selectedId: this.selectedId }),
      total: this.annotationRows.length,
      query: this.sidebarQuery,
      type: this.sidebarType,
      types,
      editingNoteId: this.editingNoteId,
      editingTagsId: this.editingTagsId,
    };
    renderSidebar(this.sidebarEl, model, {
      onQuery: (value) => {
        this.sidebarQuery = String(value || "");
        this.renderSidebarPanel();
      },
      onType: (value) => {
        this.sidebarType = String(value || "");
        this.renderSidebarPanel();
      },
      onSelect: (id) => this.selectAnnotation(id),
      onToggle: (open) => this.toggleSidebar(open),
      onEditNote: (id) => {
        this.editingNoteId = id;
        this.editingTagsId = "";
        this.renderSidebarPanel();
      },
      onSaveNote: (id, text) => this.saveSidebarNote(id, text),
      onEditTags: (id) => {
        this.editingTagsId = id;
        this.editingNoteId = "";
        this.renderSidebarPanel();
      },
      onSaveTags: (id, text) => this.saveSidebarTags(id, text),
      onAsk: (id) => this.askAnnotation(id),
      onCancelEdit: () => {
        this.editingNoteId = "";
        this.editingTagsId = "";
        this.renderSidebarPanel();
      },
      onDelete: (id) => this.deleteSidebarAnnotation(id),
    });
  }

  toggleSidebar(open) {
    this.sidebarOpen = typeof open === "boolean" ? open : !this.sidebarOpen;
    try {
      if (this.app.saveLocalStorage) this.app.saveLocalStorage("mcq-pdf-sidebar-open", this.sidebarOpen);
    } catch (e) {
      /* ignore storage failures */
    }
    if (this.sidebarEl) {
      if (this.sidebarOpen) this.sidebarEl.removeClass("is-collapsed");
      else this.sidebarEl.addClass("is-collapsed");
    }
    this.renderSidebarPanel();
    this.setStatus(this.sidebarOpen ? "Annotation sidebar shown." : "Annotation sidebar hidden.");
  }

  /** Handles the A shortcut, but never while the reader is typing in a field. */
  handleKey(event) {
    if (!event || event.ctrlKey || event.metaKey || event.altKey) return false;
    const target = event.target || {};
    const tag = target.tagName ? String(target.tagName).toLowerCase() : "";
    if (tag === "input" || tag === "textarea" || tag === "select") return false;
    if (event.key !== "a" && event.key !== "A") return false;
    if (event.preventDefault) event.preventDefault();
    this.toggleSidebar();
    return true;
  }

  /** Jumps to the row's page (if needed) and rings the exact mark. */
  async selectAnnotation(id) {
    const row = this.annotationRows.find((entry) => entry.id === id);
    if (!row) return;
    this.selectedId = row.id;
    this.renderSidebarPanel();
    if (rowPage(row) !== Number(this.page)) await this.goToPage(rowPage(row));
    else this.redraw();
    this.setStatus(`Selected the ${row.type} on page ${row.page}.`);
  }

  async saveSidebarNote(id, text) {
    const updated = await this.plugin.updatePdfAnnotationNote(this.pdfPath, id, text);
    this.editingNoteId = "";
    await this.refreshAnnotations();
    this.setStatus(updated ? `Saved the note on page ${updated.page}.` : "That annotation is no longer in the sidecar.");
  }

  async saveSidebarTags(id, text) {
    const updated = await this.plugin.updatePdfAnnotationTags(this.pdfPath, id, tagInput(text));
    this.editingTagsId = "";
    await this.refreshAnnotations();
    this.setStatus(updated ? `Saved tags on page ${updated.page}.` : "That annotation is no longer in the sidecar.");
  }

  /** Deletes without leaving the page: the page index is never part of the write. */
  async deleteSidebarAnnotation(id) {
    if (this.dirty && !(await this.save())) return;
    const before = this.annotationRows.length;
    const left = await this.plugin.deletePdfAnnotation(this.pdfPath, id);
    if (this.selectedId === id) this.selectedId = "";
    if (this.editingNoteId === id) this.editingNoteId = "";
    if (this.editingTagsId === id) this.editingTagsId = "";
    await this.loadSidecar();
    await this.refreshAnnotations();
    this.setStatus(left === before ? "Nothing was deleted." : `Deleted the annotation; ${left} left in this PDF.`);
  }

  /** A jump is an explicit scroll; the indicator is updated immediately. */
  async goToPage(value, options) {
    const opts = options || {};
    const target = clampPage(value, this.total || value);
    if (target !== Number(this.page)) this.activatePage(target, { silent: true, force: true });
    if (this.pageInputEl) this.pageInputEl.value = String(target);
    if (opts.scroll !== false) this.scrollPageIntoView(target);
    if (!opts.silent) this.setStatus(`Page ${target} of ${this.total || "?"}.`);
    if (this.plugin.rememberPdfPage) this.plugin.rememberPdfPage(this.pdfPath, target);
    return target;
  }

  async stepPage(delta) {
    if (!this.total) return;
    await this.goToPage(this.page + delta);
  }

  /** The page whose top is closest to the reading line, not merely the first visible row. */
  pageAtScroll(topValue) {
    if (!this.stageEl || !this.pageWraps.size) return this.page;
    const top = Number.isFinite(Number(topValue)) ? Number(topValue) : Number(this.stageEl.scrollTop) || 0;
    const viewport = Number(this.stageEl.clientHeight) || 0;
    const probe = top + Math.max(1, Math.min(240, viewport * 0.35));
    let target = 1;
    for (const [n, wrap] of this.pageWraps) {
      const offset = Number(wrap.offsetTop) || 0;
      if (offset <= probe) target = Math.max(target, n);
    }
    return target;
  }

  /** Scroll drives the current-page field; no status line is rewritten on every frame. */
  onStageScroll(topValue) {
    const target = this.pageAtScroll(topValue);
    if (target !== Number(this.page)) this.activatePage(target, { silent: true });
    return target;
  }

  scrollPageIntoView(page) {
    if (!this.stageEl) return false;
    const wrap = this.pageWraps.get(clampPage(page, this.total || page));
    if (!wrap) return false;
    const top = Math.max(0, Number(wrap.offsetTop) || 0);
    try {
      if (typeof this.stageEl.scrollTo === "function") this.stageEl.scrollTo({ top, behavior: "auto" });
      else this.stageEl.scrollTop = top;
    } catch (e) {
      try {
        this.stageEl.scrollTop = top;
      } catch (ignore) {
        return false;
      }
    }
    return true;
  }

  async leavePage() {
    if (!this.dirty) return true;
    const saved = await this.save();
    return saved === true;
  }

  async openEditor() {
    if (!this.plugin || typeof this.plugin.openPdfEditor !== "function") return;
    const pdfPath = this.pdfPath;
    if (this.dirty) {
      try {
        await this.save();
      } catch (error) {
        /* the save path already reports refusals in the status line */
      }
    }
    this.close();
    this.plugin.openPdfEditor(pdfPath);
  }

  async save(options) {
    const opts = options || {};
    if (this.busy) return false;
    if (this.dirty && !this.dirtyPages.has(Number(this.page))) this.dirtyPages.add(Number(this.page));
    this.storePageAnnotations();
    const pages = [...this.dirtyPages].map(Number).sort((a, b) => a - b);
    if (!pages.length) {
      this.setStatus("Draw something, add a text box or highlight an area first.");
      return false;
    }
    const sequences = new Map(pages.map((page) => [page, Number(this.pageLayer(page).editSeq) || 0]));
    this.busy = true;
    this.setStatus("Saving…");
    try {
      const file = this.app.vault.getAbstractFileByPath(this.pdfPath);
      if (!file || !(file instanceof TFile)) throw new Error("That PDF is no longer in the vault.");
      const bytes = await this.app.vault.readBinary(file);
      const hash = hashBytes(bytes);
      const path = sidecarPathFor(this.pdfPath);
      const existing = this.app.vault.getAbstractFileByPath(path);
      const oldText = existing ? await this.app.vault.cachedRead(existing) : "";
      const meta = { pdfPath: this.pdfPath, pdfHash: hash };
      let nextText = oldText;
      const counts = { strokes: 0, boxes: 0, marks: 0, pages: [] };
      for (const page of pages) {
        const layer = this.pageLayer(page);
        const strokes = normalizeInkStrokes(layer.strokes || []);
        const boxes = normalizeTextBoxes(layer.textBoxes || []);
        const areas = normalizeHighlightAreas(layer.highlights || []);
        const hasMarkIds = MARK_STYLES.some((style) => Boolean(layer.markIds[style]));
        if (!strokes.length && !layer.inkId && !boxes.length && !layer.textId && !areas.length && !hasMarkIds) {
          layer.dirty = false;
          if ((Number(layer.editSeq) || 0) === sequences.get(page)) this.dirtyPages.delete(page);
          continue;
        }
        if (strokes.length) {
          const result = upsertAnnotation(nextText, { id: layer.inkId || undefined, page, type: "pen", color: this.color, strokes }, meta);
          nextText = result.text;
          const savedInk = (result.annotations || []).find((a) => a.page === page && a.type === "pen" && Array.isArray(a.strokes) && a.strokes.length);
          layer.inkId = savedInk ? savedInk.id : "";
        } else if (layer.inkId) {
          nextText = removeAnnotation(nextText, layer.inkId, meta).text;
          layer.inkId = "";
        }
        if (boxes.length) {
          const result = upsertAnnotation(nextText, { id: layer.textId || undefined, page, type: "text", color: this.color, boxes }, meta);
          nextText = result.text;
          const savedText = (result.annotations || []).find((a) => a.page === page && a.type === "text" && Array.isArray(a.boxes) && a.boxes.length);
          layer.textId = savedText ? savedText.id : "";
        } else if (layer.textId) {
          nextText = removeAnnotation(nextText, layer.textId, meta).text;
          layer.textId = "";
        }
        for (const style of MARK_STYLES) {
          const styleAreas = areas.filter((area) => (area.style || "highlight") === style);
          if (styleAreas.length) {
            const result = upsertAnnotation(nextText, { id: layer.markIds[style] || undefined, page, type: style, color: this.color, tags: layer.markTags[style] || [], areas: styleAreas }, meta);
            nextText = result.text;
            const savedMark = (result.annotations || []).find((a) => a.page === page && a.type === style && Array.isArray(a.areas) && a.areas.length);
            layer.markIds[style] = savedMark ? savedMark.id : "";
          } else if (layer.markIds[style]) {
            nextText = removeAnnotation(nextText, layer.markIds[style], meta).text;
            layer.markIds[style] = "";
          }
        }
        layer.strokes = strokes;
        layer.textBoxes = boxes;
        layer.highlights = areas;
        layer.dirty = false;
        counts.strokes += strokes.length;
        counts.boxes += boxes.length;
        counts.marks += areas.length;
        counts.pages.push(page);
      }
      if (!counts.pages.length) {
        this.dirtyPages.clear();
        this.dirty = false;
        this.setStatus("Draw something, add a text box or highlight an area first.");
        return false;
      }
      if (nextText !== oldText) {
        if (existing) await this.app.vault.modify(existing, nextText);
        else await this.app.vault.create(path, nextText);
      }
      this.sidecarPath = path;
      this.savedHash = hash;
      for (const page of pages) {
        const layer = this.pageLayer(page);
        if ((Number(layer.editSeq) || 0) === sequences.get(page)) this.dirtyPages.delete(page);
        layer.dirty = this.dirtyPages.has(page);
      }
      this.dirty = this.dirtyPages.size > 0;
      this.applyPageAnnotations(this.page);
      const bits = [];
      if (counts.strokes) bits.push(`${counts.strokes} stroke${counts.strokes === 1 ? "" : "s"}`);
      if (counts.boxes) bits.push(`${counts.boxes} text box${counts.boxes === 1 ? "" : "es"}`);
      if (counts.marks) bits.push(`${counts.marks} mark${counts.marks === 1 ? "" : "s"}`);
      const pageText = counts.pages.length === 1
        ? `page ${counts.pages[0]}`
        : `pages ${counts.pages.slice(0, -1).join(", ")} and ${counts.pages[counts.pages.length - 1]}`;
      this.setStatus(bits.length ? `Saved ${bits.join(" and ")} on ${pageText}.` : `Removed the overlay from ${pageText}.`);
      if (opts.close && !this.dirty) this.close();
      return true;
    } catch (e) {
      this.setStatus(e && e.message ? e.message : String(e));
      return false;
    } finally {
      this.busy = false;
    }
  }
}

function wrapTextLines(ctx, text, maxWidth) {
  const lines = [];
  for (const paragraph of String(text || "").split("\n")) {
    if (!paragraph) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(test).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    lines.push(line);
  }
  return lines;
}

function drawTextBoxes(ctx, boxes, width, height) {
  if (!ctx) return;
  for (const box of Array.isArray(boxes) ? boxes : []) {
    const x = box.x * width;
    const y = box.y * height;
    const boxWidth = Math.max(4, box.width * width);
    const boxHeight = Math.max(4, box.height * height);
    const fontSize = Math.max(9, box.size * width);
    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fillRect(x, y, boxWidth, boxHeight);
    ctx.strokeStyle = INK_COLOR_HEX[box.color] || INK_COLOR_HEX.blue;
    ctx.lineWidth = Math.max(1, width * 0.0015);
    ctx.strokeRect(x, y, boxWidth, boxHeight);
    ctx.beginPath();
    ctx.rect(x + 3, y + 3, Math.max(1, boxWidth - 6), Math.max(1, boxHeight - 6));
    ctx.clip();
    ctx.fillStyle = "#1f1f1f";
    ctx.font = `${fontSize}px Arial, sans-serif`;
    ctx.textBaseline = "top";
    const lines = wrapTextLines(ctx, box.text, Math.max(8, boxWidth - 8));
    const lineHeight = fontSize * 1.3;
    for (let i = 0; i < lines.length && i * lineHeight < boxHeight - 6; i++) {
      ctx.fillText(lines[i], x + 4, y + 4 + i * lineHeight);
    }
    ctx.restore();
  }
}

function drawSelectionRing(ctx, bounds, width, height) {
  if (!ctx || !bounds) return;
  ctx.save();
  ctx.strokeStyle = "#7c5cff";
  ctx.lineWidth = Math.max(2, (width || 1000) * 0.0035);
  if (typeof ctx.setLineDash === "function") ctx.setLineDash([7, 5]);
  ctx.strokeRect(bounds.x * width, bounds.y * height, bounds.width * width, bounds.height * height);
  if (typeof ctx.setLineDash === "function") ctx.setLineDash([]);
  ctx.restore();
}

function drawHighlightAreas(ctx, areas, width, height) {
  if (!ctx) return;
  for (const area of Array.isArray(areas) ? areas : []) {
    const x = area.x * width;
    const y = area.y * height;
    const areaWidth = Math.max(1, area.width * width);
    const areaHeight = Math.max(1, area.height * height);
    const color = INK_COLOR_HEX[area.color] || INK_COLOR_HEX.yellow;
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, areaWidth, areaHeight);
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, areaWidth, areaHeight);
    if (area.note) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + areaWidth - 6, y + 6, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

module.exports = { PdfInkModal, TextBoxPromptModal };
