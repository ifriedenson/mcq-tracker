"use strict";
/*
 * The PDF editor modal: page operations, form filling and an edited copy.
 *
 * The original PDF is never written. Every save goes through
 * `plugin.savePdfCopy`, which picks a new name beside it, so the source and its
 * `.annotations.md` sidecar stay exactly as they were. All PDF work lives in
 * `src/pdf-editor.js`; this file only renders and dispatches.
 */
const { FuzzySuggestModal, Modal, Notice, TFile } = require("obsidian");
const {
  addBlankPage,
  addFormField,
  addImage,
  addLink,
  addPageNumbers,
  addText,
  addWatermark,
  cropPages,
  deleteFormField,
  deletePage,
  duplicatePage,
  editedPathFor,
  extractPdfPages,
  flattenAnnotations,
  flattenForm,
  formFields,
  formatBookmarkText,
  insertPdfPages,
  loadEditorDocument,
  movePage,
  pageList,
  parseBookmarkText,
  readLinks,
  readOutline,
  removeLinks,
  renameFormField,
  updateLink,
  rotatePage,
  savePdf,
  setDocumentProperties,
  setFieldValue,
  setOutline,
  splitPdf,
  addShape,
  resizePages,
  PAGE_SIZES,
  SHAPE_FILLS,
  SHAPES,
  TEXT_POSITIONS,
} = require("./pdf-editor");
const {
  canRedo: historyCanRedo,
  canUndo: historyCanUndo,
  clearHistory,
  createHistory,
  historySummary,
  nextRedoLabel,
  nextUndoLabel,
  recordEdit,
  redoStep,
  undoStep,
  HISTORY_LIMIT,
} = require("./pdf-editor-history");
const { INK_COLORS } = require("./pdf-ink");
const { renderPdfPagesAsPng } = require("./pdf");

const MAX_THUMBNAILS = 24;
const THUMBNAIL_SCALE = 0.45;
/* One undo step per action; the opened file is always kept as state zero. */
const HISTORY_LIMIT_STEPS = HISTORY_LIMIT;

function str(value) {
  return value === undefined || value === null ? "" : String(value);
}

/* Picks another vault PDF to take pages from. */
class PdfSourcePickerModal extends FuzzySuggestModal {
  constructor(app, options, onPick) {
    super(app);
    this.current = str(options && options.current);
    this.onPick = onPick || (() => {});
    this.setPlaceholder("Choose a PDF to add its pages");
  }

  getItems() {
    return this.app.vault
      .getFiles()
      .filter((file) => /\.pdf$/i.test(file.path || file.name) && file.path !== this.current)
      .sort((a, b) => str(a.path).localeCompare(str(b.path)));
  }

  getItemText(file) {
    return str(file.path);
  }

  onChooseItem(file) {
    this.onPick(file);
  }
}

/* Picks a vault image to place on a page. */
class ImagePickerModal extends FuzzySuggestModal {
  constructor(app, options, onPick) {
    super(app);
    this.onPick = onPick || (() => {});
    this.setPlaceholder("Choose a PNG or JPEG from the vault");
  }

  getItems() {
    return this.app.vault
      .getFiles()
      .filter((file) => /\.(png|jpe?g)$/i.test(file.path || file.name))
      .sort((a, b) => str(a.path).localeCompare(str(b.path)));
  }

  getItemText(file) {
    return str(file.path);
  }

  onChooseItem(file) {
    this.onPick(file);
  }
}

class PdfEditorModal extends Modal {
  constructor(app, plugin, options) {
    super(app);
    this.plugin = plugin;
    this.pdfPath = str(options && options.pdfPath).trim();
    this.bytes = null;
    this.doc = null;
    this.pages = [];
    this.fields = [];
    this.annotations = [];
    this.originOrder = [];
    this.selection = new Set();
    this.thumbnails = new Map();
    this.thumbUrls = [];
    this.thumbToken = 0;
    this.flattenMarks = true;
    this.flattenFields = false;
    this.busy = false;
    this.loading = null;
    this.contentHost = null;
    this.content = {
      text: "",
      size: "12",
      color: "blue",
      font: "helvetica",
      position: "top-left",
      textPage: "all",
      image: null,
      imagePath: "",
      imageWidth: "40",
      imagePage: "all",
      cropTop: "0",
      cropRight: "0",
      cropBottom: "0",
      cropLeft: "0",
      numberFormat: "{n}",
      numberSize: "9",
      watermarkText: "",
      watermarkSize: "72",
      watermarkOpacity: "15",
      watermarkColor: "gray",
      watermarkAngle: "45",
      watermarkPage: "all",
      properties: null,
      splitEvery: "10",
      fieldLabel: "",
      fieldType: "text",
      fieldPage: "0",
      fieldX: "40",
      fieldY: "40",
      fieldWidth: "160",
      fieldHeight: "24",
      fieldValue: "",
      fieldSelect: "",
      fieldOptions: "Small, Medium, Large",
      fieldChecked: false,
      fieldManage: "",
      fieldRename: "",
      shape: "rectangle",
      shapePosition: "middle-center",
      shapeWidth: "240",
      shapeHeight: "120",
      shapeColor: "red",
      shapeFill: "none",
      shapePage: "all",
      pageSize: "A4",
      resizePage: "all",
      insertAt: "1",
      linkTarget: "url",
      linkUrl: "https://",
      linkTo: "1",
      linkX: "10",
      linkY: "10",
      linkWidth: "30",
      linkHeight: "5",
      linkPage: "0",
      linkRemove: "1",
      linkEdit: "1",
      linkAreaLeft: "",
      linkAreaTop: "",
      linkAreaWidth: "",
      linkAreaHeight: "",
      linkPageTo: "",
      linkStyleWidth: "",
      linkStyleDash: "keep",
      linkStyleHighlight: "keep",
      bookmarks: null,
      bookmarkZoom: "",
      bookmarkTop: "",
    };
    this.statusEl = null;
    this.listEl = null;
    this.fieldsEl = null;
    this.actionsEl = null;
    this.history = null;
    this.queue = Promise.resolve();
    this.pendingEdits = 0;
    this.saving = false;
    this.undoButton = null;
    this.redoButton = null;
    this.historyHint = null;
  }

  onOpen() {
    this.modalEl.addClass("qt-pdf-editor-modal");
    this.renderShell();
    if (this.modalEl && typeof this.modalEl.addEventListener === "function") {
      this.modalEl.addEventListener("keydown", (event) => this.handleKey(event));
    }
    this.loading = this.load().catch((error) => this.setStatus(str(error && error.message ? error.message : error)));
  }

  onClose() {
    this.thumbToken += 1;
    for (const url of this.thumbUrls) {
      try {
        URL.revokeObjectURL(url);
      } catch (error) {
        /* ignore */
      }
    }
    this.thumbUrls = [];
    this.thumbnails.clear();
    this.contentEl.empty();
  }

  /* ------------------------------------------------------------ structure */

  renderShell() {
    const el = this.contentEl;
    el.empty();
    el.createEl("h3", { text: "PDF editor" });
    el.createEl("p", {
      cls: "setting-item-description",
      text: "Reorder, rotate, duplicate, delete and merge pages, and fill a PDF form. Saving always writes a new copy; the original PDF and its annotations are never changed.",
    });
    el.createDiv({ cls: "qt-hint qt-pdf-editor-file", text: this.pdfPath || "No PDF chosen" });

    const bar = el.createDiv({ cls: "qt-row qt-pdf-editor-toolbar" });
    const addPages = bar.createEl("button", { text: "Add pages from a PDF…", cls: "qt-grow", attr: { "aria-label": "Add pages from another PDF in the vault" } });
    addPages.addEventListener("click", () => this.pickSource());
    const blank = bar.createEl("button", { text: "Add blank page", cls: "qt-grow", attr: { "aria-label": "Append a blank page" } });
    blank.addEventListener("click", () => this.appendBlank());
    const insertLabel = bar.createEl("label", { cls: "qt-pdf-editor-select" });
    insertLabel.createSpan({ text: "Insert at" });
    const insertPosition = insertLabel.createEl("input", { cls: "qt-pdf-editor-input", type: "number" });
    insertPosition.setAttribute("aria-label", "Insert a blank page at this position");
    insertPosition.min = "1";
    insertPosition.value = str(this.content.insertAt);
    insertPosition.addEventListener("change", () => {
      this.content.insertAt = insertPosition.value;
    });
    const insertBlank = bar.createEl("button", { text: "Insert blank page", cls: "qt-grow", attr: { "aria-label": "Insert a blank page at the chosen position" } });
    insertBlank.addEventListener("click", () => this.insertBlank());
    const extract = bar.createEl("button", { text: "Extract selected", cls: "qt-grow", attr: { "aria-label": "Save the selected pages as a new PDF" } });
    extract.addEventListener("click", () => this.extractSelected());
    const reset = bar.createEl("button", { text: "Reset changes", cls: "qt-grow", attr: { "aria-label": "Discard every change and reload the original PDF" } });
    reset.addEventListener("click", () => this.load());

    const historyRow = el.createDiv({ cls: "qt-row qt-pdf-editor-history" });
    this.undoButton = historyRow.createEl("button", { cls: "qt-grow" });
    this.undoButton.addEventListener("click", () => this.undo());
    this.redoButton = historyRow.createEl("button", { cls: "qt-grow" });
    this.redoButton.addEventListener("click", () => this.redo());
    this.historyHint = historyRow.createDiv({ cls: "qt-hint qt-pdf-editor-history-hint" });

    this.statusEl = el.createDiv({ cls: "qt-hint qt-pdf-editor-status" });
    this.listEl = el.createDiv({ cls: "qt-pdf-editor-pages" });
    this.fieldsEl = el.createDiv({ cls: "qt-pdf-editor-fields" });
    this.contentHost = el.createDiv({ cls: "qt-pdf-editor-content" });
    this.actionsEl = el.createDiv({ cls: "qt-pdf-editor-footer" });
    this.renderHistory();
    this.setStatus("Loading the PDF…");
  }

  setStatus(message) {
    if (this.statusEl) this.statusEl.setText(str(message));
  }

  setBusy(value) {
    this.busy = Boolean(value);
    if (this.modalEl) this.modalEl.toggleClass("is-busy", this.busy);
  }

  /* --------------------------------------------------------------- history */

  /** Everything that belongs to a document state beside its bytes. */
  captureState() {
    return {
      originOrder: this.originOrder.slice(),
      annotations: this.annotations.slice(),
      flattenMarks: this.flattenMarks,
      flattenFields: this.flattenFields,
    };
  }

  applyState(state) {
    const source = state && typeof state === "object" ? state : {};
    this.originOrder = Array.isArray(source.originOrder) && source.originOrder.length
      ? source.originOrder.slice()
      : this.doc
        ? pageList(this.doc).map((page) => page.number)
        : [];
    this.annotations = Array.isArray(source.annotations) ? source.annotations.slice() : [];
    if (source.flattenMarks !== undefined) this.flattenMarks = Boolean(source.flattenMarks);
    if (source.flattenFields !== undefined) this.flattenFields = Boolean(source.flattenFields);
    this.selection = new Set();
  }

  canUndo() {
    return Boolean(this.history) && historyCanUndo(this.history);
  }

  canRedo() {
    return Boolean(this.history) && historyCanRedo(this.history);
  }

  /** Availability and the action's own name, so the buttons never lie. */
  renderHistory() {
    const undoLabel = this.history ? nextUndoLabel(this.history) : "";
    const redoLabel = this.history ? nextRedoLabel(this.history) : "";
    if (this.undoButton) {
      this.undoButton.setText(undoLabel ? `Undo ${undoLabel}` : "Undo");
      this.undoButton.disabled = !undoLabel;
      this.undoButton.setAttribute("aria-label", undoLabel ? `Undo ${undoLabel}` : "Nothing to undo");
      this.undoButton.setAttribute("title", undoLabel ? `Undo ${undoLabel} (Ctrl/Cmd+Z)` : "Nothing to undo");
    }
    if (this.redoButton) {
      this.redoButton.setText(redoLabel ? `Redo ${redoLabel}` : "Redo");
      this.redoButton.disabled = !redoLabel;
      this.redoButton.setAttribute("aria-label", redoLabel ? `Redo ${redoLabel}` : "Nothing to redo");
      this.redoButton.setAttribute("title", redoLabel ? `Redo ${redoLabel} (Shift+Ctrl/Cmd+Z)` : "Nothing to redo");
    }
    if (this.historyHint) {
      this.historyHint.setText(this.history ? `${historySummary(this.history)} Ctrl/Cmd+Z undoes, Shift+Ctrl/Cmd+Z redoes.` : "");
    }
  }

  /** Queues document work and counts it, so Save can wait for what it accepted. */
  enqueueTask(task) {
    this.pendingEdits += 1;
    const run = this.queue.then(async () => {
      try {
        return await task();
      } finally {
        this.pendingEdits = Math.max(0, this.pendingEdits - 1);
      }
    });
    this.queue = run.then(() => undefined, () => undefined);
    return run;
  }

  /**
   * Runs one document mutation and records the whole document as the next undo
   * step. Mutations are serialized because the bytes have to be captured after
   * an edit and before the next one starts.
   */
  runMutation(label, task, after) {
    return this.enqueueTask(async () => {
      if (this.saving) {
        this.setStatus("The copy is being written; wait for it to finish.");
        return { ok: false, reason: "saving", message: "The copy is being written." };
      }
      let result;
      try {
        result = await task();
      } catch (error) {
        const message = str(error && error.message ? error.message : error);
        this.setStatus(message);
        return { ok: false, reason: "error", message };
      }
      if (!result || result.ok === false) {
        this.setStatus(result && result.message ? result.message : "That change could not be applied.");
        return result || { ok: false, reason: "refused", message: "That change could not be applied." };
      }
      const saved = await savePdf(this.doc);
      if (!saved.ok) {
        await this.restoreCurrentState();
        this.setStatus(saved.message);
        return saved;
      }
      this.bytes = saved.bytes;
      this.history = recordEdit(this.history, label, saved.bytes, this.captureState());
      if (after) await after(result);
      this.renderHistory();
      return result;
    });
  }

  /** Puts the live document back on the last recorded bytes after a failed save. */
  async restoreCurrentState() {
    if (!this.history || !this.history.states.length) return;
    const entry = this.history.states[this.history.cursor];
    const bytes = entry && entry.bytes ? entry.bytes : this.bytes;
    const loaded = await loadEditorDocument(bytes);
    if (!loaded.ok) return;
    this.bytes = bytes;
    this.doc = loaded.doc;
    this.pages = pageList(this.doc);
    this.fields = formFields(this.doc).fields;
    this.applyState(entry ? entry.state : null);
  }

  undo() {
    return this.enqueueHistory("undo");
  }

  redo() {
    return this.enqueueHistory("redo");
  }

  enqueueHistory(direction) {
    return this.enqueueTask(() => this.stepHistory(direction));
  }

  /** Restores a stored state's bytes; nothing is replayed from UI fields. */
  async stepHistory(direction) {
    if (this.saving) {
      this.setStatus("The copy is being written; wait for it to finish.");
      return { ok: false, reason: "saving" };
    }
    const step = direction === "redo" ? redoStep(this.history) : undoStep(this.history);
    if (!step.ok) {
      this.setStatus(step.message);
      return step;
    }
    const entry = step.entry;
    const loaded = entry.bytes ? await loadEditorDocument(entry.bytes) : { ok: false, message: "That step has no saved bytes." };
    if (!loaded.ok) {
      this.setStatus(loaded.message);
      return loaded;
    }
    this.history = step.history;
    this.bytes = entry.bytes;
    this.doc = loaded.doc;
    this.pages = pageList(this.doc);
    this.fields = formFields(this.doc).fields;
    this.applyState(entry.state);
    this.renderPages();
    this.renderFields();
    this.renderContent();
    this.renderFooter();
    this.renderHistory();
    this.setStatus(`${direction === "undo" ? "Undid" : "Redid"} ${step.label}. Nothing is written until you save a copy.`);
    await this.refreshPreviews();
    return { ok: true, label: step.label };
  }

  /** Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z and Ctrl/Cmd+Y inside the window. */
  handleKey(event) {
    if (!event || !(event.metaKey || event.ctrlKey) || event.altKey) return undefined;
    const key = str(event.key).toLowerCase();
    if (key !== "z" && key !== "y") return undefined;
    if (typeof event.preventDefault === "function") event.preventDefault();
    return key === "y" || event.shiftKey ? this.redo() : this.undo();
  }

  /* --------------------------------------------------------------- loading */

  async load() {
    if (!this.pdfPath) {
      this.setStatus("Open a PDF first, then run the editor again.");
      return;
    }
    const token = ++this.thumbToken;
    this.setBusy(true);
    this.setStatus("Reading the PDF…");
    try {
      const file = this.app.vault.getAbstractFileByPath(this.pdfPath);
      if (!file || !(file instanceof TFile)) throw new Error("That PDF is no longer in the vault.");
      const bytes = await this.app.vault.readBinary(file);
      const loaded = await loadEditorDocument(bytes);
      if (token !== this.thumbToken) return;
      if (!loaded.ok) {
        this.setStatus(loaded.message);
        this.setBusy(false);
        return;
      }
      this.bytes = bytes;
      this.doc = loaded.doc;
      this.pages = pageList(this.doc);
      this.originOrder = this.pages.map((page) => page.number);
      this.selection = new Set();
      this.fields = formFields(this.doc).fields;
      this.annotations = await this.readAnnotations();
      this.saving = false;
      this.history = createHistory(bytes, this.captureState(), { limit: HISTORY_LIMIT_STEPS });
      this.renderPages();
      this.renderFields();
      this.renderContent();
      this.renderFooter();
      this.renderHistory();
      this.setStatus(`${this.pages.length} page${this.pages.length === 1 ? "" : "s"}${this.fields.length ? `, ${this.fields.length} form field${this.fields.length === 1 ? "" : "s"}` : ""}. Changes stay in this window until you save a copy.`);
      this.loadThumbnails(token);
    } catch (error) {
      if (token === this.thumbToken) this.setStatus(str(error && error.message ? error.message : error));
    } finally {
      if (token === this.thumbToken) this.setBusy(false);
    }
  }

  /** Sidecar annotations for this PDF, so a copy can carry its mark-up. */
  async readAnnotations() {
    if (!this.plugin || typeof this.plugin.pdfAnnotationRows !== "function") return [];
    try {
      const data = await this.plugin.pdfAnnotationRows(this.pdfPath);
      return (data && Array.isArray(data.rows) ? data.rows : []).filter(Boolean);
    } catch (error) {
      return [];
    }
  }

  async loadThumbnails(token) {
    const limit = Math.min(this.pages.length, MAX_THUMBNAILS);
    if (!limit || !this.bytes) return;
    try {
      const rendered = await renderPdfPagesAsPng(this.bytes, `1-${limit}`, null, THUMBNAIL_SCALE);
      if (token !== this.thumbToken) return;
      for (const page of rendered.pages || []) {
        if (this.thumbnails.has(page.n)) continue;
        const url = URL.createObjectURL(new Blob([page.png], { type: "image/png" }));
        this.thumbnails.set(page.n, url);
        this.thumbUrls.push(url);
      }
      this.renderPages();
    } catch (error) {
      /* page previews are optional; the page cards work without them */
    }
  }

  /* ---------------------------------------------------------------- pages */

  renderPages() {
    const list = this.listEl;
    if (!list) return;
    list.empty();
    this.pages = pageList(this.doc);
    const total = this.pages.length;
    for (let index = 0; index < total; index++) {
      const page = this.pages[index];
      const card = list.createDiv({ cls: "qt-pdf-editor-page" });
      if (this.selection.has(index)) card.addClass("is-selected");

      const thumb = card.createDiv({ cls: "qt-pdf-editor-thumb" });
      const original = this.originOrder[index];
      const url = original ? this.thumbnails.get(original) : "";
      if (url) {
        const image = thumb.createEl("img", { cls: "qt-pdf-editor-image" });
        image.src = url;
        image.alt = `Preview of page ${page.number}`;
        if (page.rotation) image.style.transform = `rotate(${page.rotation}deg)`;
      } else {
        thumb.createDiv({ cls: "qt-pdf-editor-placeholder", text: String(page.number) });
      }

      const meta = card.createDiv({ cls: "qt-pdf-editor-meta" });
      meta.createDiv({ cls: "qt-pdf-editor-title", text: `Page ${page.number}` });
      meta.createDiv({
        cls: "qt-hint",
        text: `${Math.round(page.width)} × ${Math.round(page.height)} pt${page.rotation ? ` · ${page.rotation}°` : ""}`,
      });

      const row = card.createDiv({ cls: "qt-row qt-pdf-editor-actions" });
      this.pageButton(row, "⟲", `Rotate page ${page.number} counter-clockwise`, () => this.rotate(index, -90));
      this.pageButton(row, "⟳", `Rotate page ${page.number} clockwise`, () => this.rotate(index, 90));
      this.pageButton(row, "↑", `Move page ${page.number} earlier`, () => this.reorder(index, index - 1), index === 0);
      this.pageButton(row, "↓", `Move page ${page.number} later`, () => this.reorder(index, index + 1), index === total - 1);
      this.pageButton(row, "Duplicate", `Duplicate page ${page.number}`, () => this.duplicate(index));
      this.pageButton(row, "Delete", `Delete page ${page.number}`, () => this.remove(index), total === 1);

      const select = row.createEl("label", { cls: "qt-pdf-editor-select" });
      const box = select.createEl("input", { type: "checkbox" });
      box.checked = this.selection.has(index);
      box.setAttribute("aria-label", `Select page ${page.number} for extraction`);
      box.addEventListener("change", () => {
        if (box.checked) this.selection.add(index);
        else this.selection.delete(index);
        card.toggleClass("is-selected", box.checked);
      });
      select.createSpan({ text: "Select" });
    }
  }

  pageButton(row, text, label, onClick, disabled) {
    const button = row.createEl("button", { text, cls: "qt-pdf-editor-page-action", attr: { "aria-label": label } });
    button.disabled = Boolean(disabled || this.busy);
    button.addEventListener("click", () => onClick());
    return button;
  }

  rotate(index, by) {
    return this.runMutation(`rotate page ${index + 1}`, () => rotatePage(this.doc, index, by), () => {
      this.renderPages();
      this.renderFooter();
      this.setStatus(`Rotated page ${index + 1}. Nothing is written until you save a copy.`);
    });
  }

  reorder(from, to) {
    if (!Number.isInteger(to) || to < 0 || to >= this.originOrder.length) {
      const message = `Position ${str(to) || "?"} is not in this PDF.`;
      this.setStatus(message);
      return Promise.resolve({ ok: false, reason: "index", message });
    }
    return this.runMutation("move a page", () => {
      const result = movePage(this.doc, from, to);
      if (result.ok) {
        const [moved] = this.originOrder.splice(from, 1);
        this.originOrder.splice(to, 0, moved);
        this.selection = new Set();
      }
      return result;
    }, (result) => {
      this.syncFields();
      this.renderPages();
      this.renderFooter();
      const formNote = result.liveForm ? " The live form stays fillable and its values move with the page." : "";
      this.setStatus(`Moved page ${from + 1} to position ${to + 1}.${formNote} Nothing is written until you save a copy.`);
    });
  }

  duplicate(index) {
    return this.runMutation(`duplicate page ${index + 1}`, async () => {
      const result = await duplicatePage(this.doc, index);
      if (result.ok) {
        this.originOrder.splice(index + 1, 0, 0);
        this.selection = new Set();
      }
      return result;
    }, (result) => {
      this.syncFields();
      this.renderPages();
      this.renderFooter();
      const formNote = result.fields
        ? " Its live fields were copied with unique names; the source form stays untouched."
        : result.liveForm
          ? " The live form stays fillable."
          : "";
      this.setStatus(`Page ${index + 1} was duplicated.${formNote} Nothing is written until you save a copy.`);
    });
  }

  remove(index) {
    return this.runMutation(`delete page ${index + 1}`, () => {
      const result = deletePage(this.doc, index);
      if (result.ok) {
        this.originOrder.splice(index, 1);
        this.selection = new Set();
      }
      return result;
    }, () => {
      this.syncFields();
      this.renderPages();
      this.renderFooter();
      this.setStatus(`Deleted page ${index + 1}. Nothing is written until you save a copy.`);
    });
  }

  appendBlank() {
    return this.runMutation("add a blank page", () => {
      const result = addBlankPage(this.doc, this.originOrder.length);
      if (result.ok) this.originOrder.push(0);
      return result;
    }, () => {
      this.syncFields();
      this.renderPages();
      this.renderFooter();
      this.setStatus("A blank page was added at the end. Nothing is written until you save a copy.");
    });
  }

  /** A blank page between two pages: the page map and the selection move with it. */
  insertBlank() {
    /* the field reads as a position (1 is before the first page) */
    const position = Math.round(Number(this.content.insertAt));
    return this.runMutation("insert a blank page", () => {
      if (!Number.isInteger(position) || position < 1) {
        return { ok: false, reason: "index", message: "Type a position from 1 to one past the last page." };
      }
      const result = addBlankPage(this.doc, position - 1);
      if (result.ok) {
        this.originOrder.splice(result.index, 0, 0);
        this.selection = new Set();
      }
      return result;
    }, (result) => {
      this.syncFields();
      this.renderPages();
      this.renderFooter();
      this.setStatus(`Inserted a blank page at position ${result.index + 1}. Nothing is written until you save a copy.`);
    });
  }

  /** A reorder or delete changes which page each form field sits on. */
  syncFields() {
    try {
      this.fields = formFields(this.doc).fields;
    } catch (error) {
      /* a removed page can leave the form unreadable for a moment; keep the last read */
    }
    this.renderFields();
  }

  pickSource() {
    new PdfSourcePickerModal(this.app, { current: this.pdfPath }, (file) => this.appendFrom(file)).open();
  }

  async appendFrom(file) {
    if (!file) return { ok: false, reason: "file" };
    let bytes;
    try {
      bytes = await this.app.vault.readBinary(file);
    } catch (error) {
      this.setStatus(str(error && error.message ? error.message : error));
      return { ok: false, reason: "read" };
    }
    return this.runMutation(`add pages from ${file.path}`, async () => {
      const result = await insertPdfPages(this.doc, bytes, this.originOrder.length);
      if (result.ok) for (let i = 0; i < result.added; i++) this.originOrder.push(0);
      return result;
    }, (result) => {
      this.syncFields();
      this.renderPages();
      this.renderFooter();
      const formNote = result.fields ? ` (${result.fields} live form field${result.fields === 1 ? "" : "s"} copied)` : "";
      this.setStatus(`Added ${result.added} page${result.added === 1 ? "" : "s"}${formNote} from ${file.path}.`);
    });
  }

  async extractSelected() {
    if (this.busy) return;
    const indexes = [...this.selection].sort((a, b) => a - b);
    const result = await extractPdfPages(this.doc, indexes);
    if (!result.ok) {
      this.setStatus(result.message);
      return;
    }
    const written = await this.writeCopy(result.bytes, "extract");
    if (written) {
      const formNote = result.flattened ? " (form values baked into the pages)" : "";
      this.setStatus(`Saved ${result.pages} page${result.pages === 1 ? "" : "s"}${formNote} to ${written}.`);
    }
  }

  /* ---------------------------------------------------------------- forms */

  renderFields() {
    const host = this.fieldsEl;
    if (!host) return;
    host.empty();
    if (!this.fields.length) {
      host.createDiv({ cls: "qt-hint", text: "This PDF has no fillable form fields. Scanned pages and XFA forms are not supported." });
      return;
    }
    host.createEl("h4", { text: "Form fields" });
    host.createEl("p", { cls: "qt-hint", text: "Values are written into the copy you save. Nothing is sent anywhere." });
    for (const field of this.fields) {
      const row = host.createDiv({ cls: "qt-pdf-editor-field" });
      const label = row.createEl("label", { cls: "qt-pdf-editor-field-label" });
      label.createSpan({ cls: "qt-pdf-editor-field-name", text: field.name || "(unnamed field)" });
      if (field.page >= 0) label.createSpan({ cls: "qt-hint", text: `page ${field.page + 1}` });
      if (field.kind === "checkbox") {
        const box = row.createEl("input", { type: "checkbox" });
        box.checked = Boolean(field.value);
        box.disabled = field.readOnly;
        box.setAttribute("aria-label", field.name);
        box.addEventListener("change", () => this.applyField(field.name, box.checked));
        continue;
      }
      if (field.kind === "radio" || field.kind === "dropdown") {
        const select = row.createEl("select", { cls: "dropdown" });
        select.setAttribute("aria-label", field.name);
        select.disabled = field.readOnly;
        select.createEl("option", { text: "Choose…", attr: { value: "" } });
        for (const option of field.options) select.createEl("option", { text: option, attr: { value: option } });
        select.value = str(field.value);
        select.addEventListener("change", () => this.applyField(field.name, select.value));
        continue;
      }
      if (field.kind === "optionlist") {
        const select = row.createEl("select", { cls: "dropdown" });
        select.setAttribute("aria-label", field.name);
        select.multiple = true;
        select.disabled = field.readOnly;
        const chosen = str(field.value).split(",").map((item) => item.trim());
        for (const option of field.options) {
          const node = select.createEl("option", { text: option, attr: { value: option } });
          node.selected = chosen.includes(option);
        }
        select.addEventListener("change", () => {
          const values = [...(select.selectedOptions || [])].map((option) => option.value);
          this.applyField(field.name, values);
        });
        continue;
      }
      if (field.kind === "text") {
        const input = row.createEl("input", { cls: "qt-input", type: "text" });
        input.value = str(field.value);
        input.disabled = field.readOnly;
        input.setAttribute("aria-label", field.name);
        input.addEventListener("change", () => this.applyField(field.name, input.value));
        continue;
      }
      row.createDiv({ cls: "qt-hint", text: "This field type cannot be filled here." });
    }
  }

  applyField(name, value) {
    const run = this.runMutation(`the ${name} field`, () => {
      const result = setFieldValue(this.doc, name, value);
      if (result.ok) {
        const field = this.fields.find((item) => item.name === name);
        if (field) field.value = result.value;
      }
      return result;
    }, () => {
      this.setStatus(`“${name}” is set for the copy you save.`);
    });
    return run.then((result) => {
      if (result && result.ok === false) this.renderFields();
      return result;
    });
  }

  /* -------------------------------------------------------------- content */

  renderContent() {
    const host = this.contentHost;
    if (!host) return;
    host.empty();
    host.createEl("h4", { text: "Add content" });
    host.createEl("p", {
      cls: "qt-hint",
      text: "Typed text, images, page numbers and cropping are written into the copy when you save. The previews catch up after the next change.",
    });

    const textRow = host.createDiv({ cls: "qt-pdf-editor-row" });
    const textArea = textRow.createEl("textarea", { cls: "qt-pdf-editor-input" });
    textArea.setAttribute("aria-label", "Text to add");
    textArea.rows = 2;
    textArea.value = this.content.text;
    textArea.addEventListener("change", () => {
      this.content.text = textArea.value;
    });
    this.contentInput(textRow, "Size", "number", "Font size", this.content.size, (value) => {
      this.content.size = value;
    });
    this.contentSelect(textRow, "Colour", "Text colour", INK_COLORS, this.content.color, (value) => {
      this.content.color = value;
    });
    this.contentSelect(textRow, "Font", "Font", ["helvetica", "times", "courier"], this.content.font, (value) => {
      this.content.font = value;
    });
    this.contentSelect(textRow, "Position", "Text position", TEXT_POSITIONS, this.content.position, (value) => {
      this.content.position = value;
    });
    this.pageSelect(textRow, "Text page", "textPage");
    const addTextButton = textRow.createEl("button", { text: "Add text", cls: "qt-grow" });
    addTextButton.addEventListener("click", () => this.addTextContent());

    const imageRow = host.createDiv({ cls: "qt-pdf-editor-row" });
    const chooseImage = imageRow.createEl("button", { text: "Add image…", cls: "qt-grow" });
    chooseImage.addEventListener("click", () => this.pickImage());
    imageRow.createSpan({ cls: "qt-hint qt-pdf-editor-image-name", text: this.content.imagePath || "No image chosen" });
    this.contentInput(imageRow, "Width %", "number", "Image width percent", this.content.imageWidth, (value) => {
      this.content.imageWidth = value;
    });
    this.pageSelect(imageRow, "Image page", "imagePage");
    const placeImage = imageRow.createEl("button", { text: "Place image", cls: "qt-grow" });
    placeImage.addEventListener("click", () => this.placeImageContent());

    const cropRow = host.createDiv({ cls: "qt-pdf-editor-row" });
    for (const side of ["top", "right", "bottom", "left"]) {
      const key = `crop${side[0].toUpperCase()}${side.slice(1)}`;
      this.contentInput(cropRow, `Crop ${side}`, "number", `Crop margin ${side}`, this.content[key], (value) => {
        this.content[key] = value;
      });
    }
    const cropButton = cropRow.createEl("button", { text: "Crop all pages", cls: "qt-grow" });
    cropButton.addEventListener("click", () => this.cropContent());

    const numberRow = host.createDiv({ cls: "qt-pdf-editor-row" });
    this.contentInput(numberRow, "Format", "text", "Page number format", this.content.numberFormat, (value) => {
      this.content.numberFormat = value;
    });
    this.contentInput(numberRow, "Size", "number", "Page number size", this.content.numberSize, (value) => {
      this.content.numberSize = value;
    });
    const numberButton = numberRow.createEl("button", { text: "Add page numbers", cls: "qt-grow" });
    numberButton.addEventListener("click", () => this.numberContent());

    const shapeRow = host.createDiv({ cls: "qt-row qt-pdf-editor-row" });
    this.contentSelect(shapeRow, "Shape", "Shape to add", SHAPES, this.content.shape, (value) => {
      this.content.shape = value;
    });
    this.contentSelect(shapeRow, "Position", "Shape position", TEXT_POSITIONS, this.content.shapePosition, (value) => {
      this.content.shapePosition = value;
    });
    this.contentInput(shapeRow, "Width pt", "number", "Shape width", this.content.shapeWidth, (value) => {
      this.content.shapeWidth = value;
    });
    this.contentInput(shapeRow, "Height pt", "number", "Shape height", this.content.shapeHeight, (value) => {
      this.content.shapeHeight = value;
    });
    this.contentSelect(shapeRow, "Colour", "Shape colour", INK_COLORS, this.content.shapeColor, (value) => {
      this.content.shapeColor = value;
    });
    this.contentSelect(shapeRow, "Fill", "Shape fill", SHAPE_FILLS, this.content.shapeFill, (value) => {
      this.content.shapeFill = value;
    });
    this.pageSelect(shapeRow, "Shape page", "shapePage");
    const shapeButton = shapeRow.createEl("button", { text: "Add shape", cls: "qt-grow" });
    shapeButton.addEventListener("click", () => this.shapeContent());

    const paperRow = host.createDiv({ cls: "qt-row qt-pdf-editor-row" });
    this.contentSelect(paperRow, "Paper", "Page size", PAGE_SIZES.map((entry) => entry.label), this.content.pageSize, (value) => {
      this.content.pageSize = value;
    });
    this.pageSelect(paperRow, "Resize page", "resizePage");
    const paperButton = paperRow.createEl("button", { text: "Resize pages", cls: "qt-grow" });
    paperButton.addEventListener("click", () => this.resizeContent());

    host.createEl("h4", { text: "Links" });
    const linkRow = host.createDiv({ cls: "qt-row qt-pdf-editor-row" });
    const linkUrl = linkRow.createEl("input", { cls: "qt-pdf-editor-input", type: "text" });
    linkUrl.setAttribute("aria-label", "Link address");
    linkUrl.placeholder = "https://example.com";
    linkUrl.value = this.content.linkUrl;
    linkUrl.addEventListener("change", () => {
      this.content.linkUrl = linkUrl.value;
    });
    this.contentSelect(linkRow, "Kind", "Link kind", ["url", "page"], this.content.linkTarget, (value) => {
      this.content.linkTarget = value;
    });
    this.contentInput(linkRow, "Jump to", "number", "Page the link jumps to", this.content.linkTo, (value) => {
      this.content.linkTo = value;
    });
    linkRow.createSpan({ cls: "qt-hint", text: this.linksSummary() });

    const linkBox = host.createDiv({ cls: "qt-row qt-pdf-editor-row" });
    for (const [key, label] of [["linkX", "Left %"], ["linkY", "Top %"], ["linkWidth", "Width %"], ["linkHeight", "Height %"]]) {
      this.contentInput(linkBox, label, "number", `Link ${label.toLowerCase()}`, this.content[key], (value) => {
        this.content[key] = value;
      });
    }
    this.pageSelect(linkBox, "Link page", "linkPage");
    const linkButton = linkBox.createEl("button", { text: "Add link", cls: "qt-grow" });
    linkButton.addEventListener("click", () => this.linkContent());

    const removeRow = host.createDiv({ cls: "qt-row qt-pdf-editor-row" });
    this.contentInput(removeRow, "Remove", "number", "Number of the link to remove", this.content.linkRemove, (value) => {
      this.content.linkRemove = value;
    });
    const removeButton = removeRow.createEl("button", { text: "Remove link", cls: "qt-grow" });
    removeButton.addEventListener("click", () => this.removeLinksContent(false));
    const removeAllButton = removeRow.createEl("button", { text: "Remove all links", cls: "qt-grow" });
    removeAllButton.addEventListener("click", () => this.removeLinksContent(true));

    const changeRow = host.createDiv({ cls: "qt-row qt-pdf-editor-row" });
    this.contentInput(changeRow, "Change", "number", "Number of the link to change", this.content.linkEdit, (value) => {
      this.content.linkEdit = value;
    });
    const changeButton = changeRow.createEl("button", { text: "Change link", cls: "qt-grow" });
    changeButton.addEventListener("click", () => this.changeLinkContent());
    changeRow.createSpan({ cls: "qt-hint", text: "Keeps the area; uses the kind, address and jump above." });

    const linkAreaRow = host.createDiv({ cls: "qt-row qt-pdf-editor-row" });
    for (const [key, label] of [["linkAreaLeft", "Area left %"], ["linkAreaTop", "Area top %"], ["linkAreaWidth", "Area width %"], ["linkAreaHeight", "Area height %"]]) {
      this.contentInput(linkAreaRow, label, "number", `New link ${label.toLowerCase()}`, this.content[key], (value) => {
        this.content[key] = value;
      });
    }
    const moveButton = linkAreaRow.createEl("button", { text: "Move link", cls: "qt-grow" });
    moveButton.addEventListener("click", () => this.moveLinkContent());
    linkAreaRow.createSpan({ cls: "qt-hint", text: "All four move the box and keep the address." });

    const linkPageRow = host.createDiv({ cls: "qt-row qt-pdf-editor-row" });
    this.contentInput(linkPageRow, "To page", "number", "Page to move the link to", this.content.linkPageTo, (value) => {
      this.content.linkPageTo = value;
    });
    const pageMoveButton = linkPageRow.createEl("button", { text: "Move to page", cls: "qt-grow" });
    pageMoveButton.addEventListener("click", () => this.moveLinkToPageContent());
    linkPageRow.createSpan({ cls: "qt-hint", text: "Moves the link at Change to that page; all four Area % set its box there." });

    const styleRow = host.createDiv({ cls: "qt-row qt-pdf-editor-row" });
    this.contentInput(styleRow, "Width pt", "number", "Link border width", this.content.linkStyleWidth, (value) => {
      this.content.linkStyleWidth = value;
    });
    this.contentSelect(styleRow, "Border", "Link border dash", ["keep", "solid", "dashed", "dotted"], this.content.linkStyleDash, (value) => {
      this.content.linkStyleDash = value;
    });
    this.contentSelect(styleRow, "Highlight", "Link highlight", ["keep", "none", "invert", "outline", "push"], this.content.linkStyleHighlight, (value) => {
      this.content.linkStyleHighlight = value;
    });
    const styleButton = styleRow.createEl("button", { text: "Style link", cls: "qt-grow" });
    styleButton.addEventListener("click", () => this.styleLinkContent());
    styleRow.createSpan({ cls: "qt-hint", text: this.linkStyleHint() });

    host.createEl("h4", { text: "Bookmarks" });
    const bookmarkRow = host.createDiv({ cls: "qt-pdf-editor-row" });
    const bookmarkArea = bookmarkRow.createEl("textarea", { cls: "qt-pdf-editor-input" });
    bookmarkArea.setAttribute("aria-label", "Bookmarks, one per line as Title | page");
    bookmarkArea.rows = 4;
    if (this.content.bookmarks === null) this.content.bookmarks = formatBookmarkText(readOutline(this.doc).entries);
    bookmarkArea.value = this.content.bookmarks;
    bookmarkArea.addEventListener("change", () => {
      this.content.bookmarks = bookmarkArea.value;
    });
    bookmarkRow.createSpan({ cls: "qt-hint", text: "One per line as Title | page; indent two spaces to nest." });
    const bookmarkViewRow = host.createDiv({ cls: "qt-row qt-pdf-editor-row" });
    this.contentInput(bookmarkViewRow, "Zoom %", "number", "Bookmark zoom percent, empty for the whole page", this.content.bookmarkZoom, (value) => {
      this.content.bookmarkZoom = value;
    });
    this.contentInput(bookmarkViewRow, "Position %", "number", "How far down the page each bookmark starts", this.content.bookmarkTop, (value) => {
      this.content.bookmarkTop = value;
    });
    bookmarkViewRow.createSpan({ cls: "qt-hint", text: "Empty zoom means the whole page." });
    const bookmarkButton = bookmarkViewRow.createEl("button", { text: "Save bookmarks", cls: "qt-grow" });
    bookmarkButton.addEventListener("click", () => this.bookmarksContent());

    host.createEl("h4", { text: "Watermark and document" });
    const watermarkRow = host.createDiv({ cls: "qt-row qt-pdf-editor-row" });
    const watermarkText = watermarkRow.createEl("input", { cls: "qt-pdf-editor-input", type: "text" });
    watermarkText.setAttribute("aria-label", "Watermark text");
    watermarkText.placeholder = "DRAFT";
    watermarkText.value = this.content.watermarkText;
    watermarkText.addEventListener("change", () => {
      this.content.watermarkText = watermarkText.value;
    });
    this.contentInput(watermarkRow, "Size", "number", "Watermark size", this.content.watermarkSize, (value) => {
      this.content.watermarkSize = value;
    });
    this.contentInput(watermarkRow, "Opacity %", "number", "Watermark opacity percent", this.content.watermarkOpacity, (value) => {
      this.content.watermarkOpacity = value;
    });
    this.contentSelect(watermarkRow, "Colour", "Watermark colour", INK_COLORS, this.content.watermarkColor, (value) => {
      this.content.watermarkColor = value;
    });
    this.contentSelect(watermarkRow, "Angle", "Watermark angle", ["0", "30", "45", "60", "90"], this.content.watermarkAngle, (value) => {
      this.content.watermarkAngle = value;
    });
    this.pageSelect(watermarkRow, "Watermark page", "watermarkPage");
    const watermarkButton = watermarkRow.createEl("button", { text: "Add watermark", cls: "qt-grow" });
    watermarkButton.addEventListener("click", () => this.watermarkContent());

    this.content.properties = this.readProperties();
    const propertyRow = host.createDiv({ cls: "qt-row qt-pdf-editor-row" });
    for (const [key, label] of [["title", "Title"], ["author", "Author"], ["subject", "Subject"], ["keywords", "Keywords"]]) {
      const field = this.contentInput(propertyRow, label, "text", `Document ${key}`, this.content.properties[key], (value) => {
        this.content.properties[key] = value;
      });
      if (key === "keywords") field.placeholder = "comma separated";
    }
    const propertyButton = propertyRow.createEl("button", { text: "Save properties", cls: "qt-grow" });
    propertyButton.addEventListener("click", () => this.propertiesContent());

    const splitRow = host.createDiv({ cls: "qt-row qt-pdf-editor-row" });
    this.contentInput(splitRow, "Pages per file", "number", "Pages per split file", this.content.splitEvery, (value) => {
      this.content.splitEvery = value;
    });
    const splitButton = splitRow.createEl("button", { text: "Split every N pages", cls: "qt-grow" });
    splitButton.addEventListener("click", () => this.splitContent());

    this.fieldHost = host.createDiv({ cls: "qt-pdf-editor-newfield" });
    this.renderFieldForm();

    if (this.annotations.length) {
      const markRow = host.createDiv({ cls: "qt-row qt-pdf-editor-row" });
      const burn = markRow.createEl("button", { text: "Burn annotations into the pages", cls: "qt-grow" });
      burn.setAttribute("aria-label", "Burn annotations into the pages");
      burn.addEventListener("click", () => this.burnContent());
      markRow.createSpan({
        cls: "qt-hint",
        text: `${this.annotations.length} annotation${this.annotations.length === 1 ? "" : "s"} can be drawn now, and undone like any other edit.`,
      });
    }
  }

  /** The small form builder: one new fillable field, placed in PDF points. */
  renderFieldForm() {
    const host = this.fieldHost;
    if (!host) return;
    host.empty();
    host.createEl("h4", { text: "New form field" });
    host.createEl("p", {
      cls: "qt-hint",
      text: "Adds a fillable field to the copy. Position and size are PDF points measured from the page's bottom-left corner; the form stays fillable and is never flattened.",
    });
    const row = host.createDiv({ cls: "qt-row qt-pdf-editor-row" });
    this.contentInput(row, "Label", "text", "New field label", this.content.fieldLabel, (value) => {
      this.content.fieldLabel = value;
    });
    this.contentSelect(row, "Type", "New field type", ["text", "checkbox", "dropdown", "radio"], this.content.fieldType || "text", (value) => {
      this.content.fieldType = value;
      this.renderFieldForm();
    });
    const pages = this.doc ? this.doc.getPageCount() : 0;
    if (pages) {
      const names = [];
      for (let index = 1; index <= pages; index++) names.push(`Page ${index}`);
      const current = `Page ${Math.min(pages, Math.max(1, Number(this.content.fieldPage || 0) + 1))}`;
      this.contentSelect(row, "Page", "New field page", names, current, (value) => {
        const match = /^Page (\d+)$/.exec(str(value));
        this.content.fieldPage = String(match ? Number(match[1]) - 1 : 0);
      });
    }
    this.contentInput(row, "X", "number", "New field x", this.content.fieldX, (value) => {
      this.content.fieldX = value;
    });
    this.contentInput(row, "Y", "number", "New field y", this.content.fieldY, (value) => {
      this.content.fieldY = value;
    });
    this.contentInput(row, "Width", "number", "New field width", this.content.fieldWidth, (value) => {
      this.content.fieldWidth = value;
    });
    this.contentInput(row, "Height", "number", "New field height", this.content.fieldHeight, (value) => {
      this.content.fieldHeight = value;
    });

    const type = this.content.fieldType || "text";
    const detail = host.createDiv({ cls: "qt-row qt-pdf-editor-row" });
    if (type === "text") {
      this.contentInput(detail, "Default text", "text", "New field default text", this.content.fieldValue, (value) => {
        this.content.fieldValue = value;
      });
    } else if (type === "checkbox") {
      const wrap = detail.createEl("label", { cls: "qt-pdf-editor-field-group" });
      const box = wrap.createEl("input", { type: "checkbox" });
      box.checked = Boolean(this.content.fieldChecked);
      box.setAttribute("aria-label", "New field starts checked");
      box.addEventListener("change", () => {
        this.content.fieldChecked = Boolean(box.checked);
      });
      wrap.createSpan({ text: "Starts checked" });
    } else {
      const options = this.contentInput(detail, "Options", "text", "New field options", this.content.fieldOptions, (value) => {
        this.content.fieldOptions = value;
      });
      options.placeholder = "comma separated";
      this.contentInput(detail, "Initial choice", "text", "New field initial choice", this.content.fieldSelect, (value) => {
        this.content.fieldSelect = value;
      });
    }
    const button = host.createEl("button", { text: "Add field", cls: "qt-grow" });
    button.setAttribute("aria-label", "Add a form field to the copy");
    button.addEventListener("click", () => this.addFieldContent());

    host.createEl("h4", { text: "Change a form field" });
    host.createEl("p", {
      cls: "qt-hint",
      text: "Rename or remove a flat field. Its value and widget stay where they are, so nothing moves on the page.",
    });
    const manageRow = host.createDiv({ cls: "qt-row qt-pdf-editor-row" });
    this.contentInput(manageRow, "Field", "text", "Existing field name", this.content.fieldManage, (value) => {
      this.content.fieldManage = value;
    });
    this.contentInput(manageRow, "New name", "text", "New field name", this.content.fieldRename, (value) => {
      this.content.fieldRename = value;
    });
    const renameButton = manageRow.createEl("button", { text: "Rename field", cls: "qt-grow" });
    renameButton.addEventListener("click", () => this.renameField());
    const deleteButton = manageRow.createEl("button", { text: "Delete field", cls: "qt-grow" });
    deleteButton.addEventListener("click", () => this.deleteField());
  }

  renameField() {
    return this.runMutation("rename a form field", () => renameFormField(this.doc, this.content.fieldManage, this.content.fieldRename), (result) => {
      this.fields = formFields(this.doc).fields;
      this.content.fieldManage = result.to;
      this.content.fieldRename = "";
      this.renderFields();
      this.renderContent();
      this.renderFooter();
      this.setStatus(`Renamed “${result.from}” to “${result.to}”. Nothing is written until you save a copy.`);
    });
  }

  deleteField() {
    return this.runMutation("delete a form field", () => deleteFormField(this.doc, this.content.fieldManage), (result) => {
      this.fields = formFields(this.doc).fields;
      this.content.fieldManage = "";
      this.renderFields();
      this.renderContent();
      this.renderFooter();
      this.setStatus(`Deleted “${result.name}” and ${result.widgets} widget${result.widgets === 1 ? "" : "s"}. Nothing is written until you save a copy.`);
    });
  }

  /** One undo step; nothing reaches the vault before Save. */
  addFieldContent() {
    const options = str(this.content.fieldOptions)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    return this.runMutation("add a form field", async () => {
      const result = await addFormField(this.doc, {
        label: this.content.fieldLabel,
        type: this.content.fieldType || "text",
        page: Number(this.content.fieldPage || 0),
        x: Number(this.content.fieldX),
        y: Number(this.content.fieldY),
        width: Number(this.content.fieldWidth),
        height: Number(this.content.fieldHeight),
        value: str(this.content.fieldValue),
        select: str(this.content.fieldSelect),
        checked: this.content.fieldChecked === true,
        options,
      });
      if (result.ok) this.fields = formFields(this.doc).fields;
      return result;
    }, (result) => {
      this.renderFields();
      this.setStatus(`Added the form field “${result.name}” on page ${result.page + 1}. Nothing is written until you save a copy.`);
    });
  }

  /** A labelled field in the content section; the label sits above its input. */
  contentInput(row, label, type, ariaLabel, value, onChange) {
    const wrap = row.createEl("label", { cls: "qt-pdf-editor-field-group" });
    wrap.createSpan({ text: label });
    const input = wrap.createEl("input", { cls: "qt-pdf-editor-input", type });
    input.setAttribute("aria-label", ariaLabel);
    input.value = str(value);
    input.addEventListener("change", () => onChange(input.value));
    return input;
  }

  contentSelect(row, label, ariaLabel, options, value, onChange) {
    const wrap = row.createEl("label", { cls: "qt-pdf-editor-field-group" });
    wrap.createSpan({ text: label });
    const select = wrap.createEl("select", { cls: "dropdown" });
    select.setAttribute("aria-label", ariaLabel);
    for (const option of options) select.createEl("option", { text: option, attr: { value: option } });
    select.value = str(value);
    select.addEventListener("change", () => onChange(select.value));
    return select;
  }

  /** "All pages" plus every page, so content can go on one page or all of them. */
  pageSelect(row, ariaLabel, key) {
    const wrap = row.createEl("label", { cls: "qt-pdf-editor-field-group" });
    wrap.createSpan({ text: "Page" });
    const select = wrap.createEl("select", { cls: "dropdown" });
    select.setAttribute("aria-label", ariaLabel);
    select.createEl("option", { text: "All pages", attr: { value: "all" } });
    this.pages.forEach((page) => select.createEl("option", { text: `Page ${page.number}`, attr: { value: String(page.index) } }));
    select.value = str(this.content[key]);
    select.addEventListener("change", () => {
      this.content[key] = select.value;
    });
    return select;
  }

  /** One content edit: the mutation, its history step, then the previews. */
  runContentEdit(label, task, message) {
    return this.runMutation(label, task, async (result) => {
      this.renderPages();
      this.setStatus(message(result));
      await this.refreshPreviews();
    });
  }

  /** Re-renders the page previews from the edited document, so crop and text show. */
  async refreshPreviews() {
    if (!this.doc || !this.pages.length || this.pages.length > MAX_THUMBNAILS) return;
    const token = ++this.thumbToken;
    try {
      const saved = await savePdf(this.doc);
      if (!saved.ok || token !== this.thumbToken) return;
      const rendered = await renderPdfPagesAsPng(saved.bytes, `1-${this.pages.length}`, null, THUMBNAIL_SCALE);
      if (token !== this.thumbToken) return;
      for (const page of rendered.pages || []) {
        const key = this.originOrder[page.n - 1];
        if (!key) continue;
        const previous = this.thumbnails.get(key);
        if (previous) {
          try {
            URL.revokeObjectURL(previous);
          } catch (error) {
            /* ignore */
          }
        }
        const url = URL.createObjectURL(new Blob([page.png], { type: "image/png" }));
        this.thumbnails.set(key, url);
        this.thumbUrls.push(url);
      }
      this.renderPages();
    } catch (error) {
      /* previews are optional; the edit itself already succeeded */
    }
  }

  addTextContent() {
    return this.runContentEdit("add text", () => addText(this.doc, {
      text: this.content.text,
      size: Number(this.content.size) || 12,
      color: this.content.color,
      font: this.content.font,
      position: this.content.position,
      pages: this.content.textPage === "all" ? "all" : Number(this.content.textPage),
    }), (value) => `Added ${value.drawn} line${value.drawn === 1 ? "" : "s"} of text to ${value.pages} page${value.pages === 1 ? "" : "s"}.`);
  }

  pickImage() {
    new ImagePickerModal(this.app, {}, (file) => {
      this.content.image = file;
      this.content.imagePath = file.path;
      this.renderContent();
    }).open();
  }

  placeImageContent() {
    const image = this.content.image;
    if (!image) {
      this.setStatus("Choose an image with Add image… first.");
      return Promise.resolve({ ok: false, reason: "empty" });
    }
    return this.runContentEdit("place an image", async () => {
      const bytes = await this.app.vault.readBinary(image);
      return addImage(this.doc, {
        bytes,
        width: (Number(this.content.imageWidth) || 40) / 100,
        position: this.content.position,
        pages: this.content.imagePage === "all" ? "all" : Number(this.content.imagePage),
      });
    }, (value) => `Placed the image on ${value.pages} page${value.pages === 1 ? "" : "s"}.`);
  }

  cropContent() {
    return this.runContentEdit("crop pages", () => cropPages(
      this.doc,
      {
        top: Number(this.content.cropTop) || 0,
        right: Number(this.content.cropRight) || 0,
        bottom: Number(this.content.cropBottom) || 0,
        left: Number(this.content.cropLeft) || 0,
      },
      { pages: "all" },
    ), (value) => `Cropped ${value.pages} page${value.pages === 1 ? "" : "s"}.`);
  }

  numberContent() {
    return this.runContentEdit("add page numbers", () => addPageNumbers(this.doc, {
      format: this.content.numberFormat,
      size: Number(this.content.numberSize) || 9,
      pages: "all",
    }), (value) => `Numbered ${value.pages} page${value.pages === 1 ? "" : "s"}.`);
  }

  shapeContent() {
    return this.runContentEdit("add a shape", () => addShape(this.doc, {
      shape: this.content.shape,
      position: this.content.shapePosition,
      width: Number(this.content.shapeWidth),
      height: Number(this.content.shapeHeight),
      color: this.content.shapeColor,
      fill: this.content.shapeFill,
      pages: this.content.shapePage === "all" ? "all" : Number(this.content.shapePage),
    }), (value) => `Drew a ${value.shape} on ${value.pages} page${value.pages === 1 ? "" : "s"}.`);
  }

  resizeContent() {
    const preset = PAGE_SIZES.find((entry) => entry.label === this.content.pageSize) || PAGE_SIZES[0];
    return this.runContentEdit("set the page size", () => resizePages(this.doc, {
      size: preset.id,
      pages: this.content.resizePage === "all" ? "all" : Number(this.content.resizePage),
    }), (value) => `Resized ${value.resized} page${value.resized === 1 ? "" : "s"} to ${Math.round(value.width)} by ${Math.round(value.height)} points${value.skipped ? `, ${value.skipped} already that size` : ""}.`);
  }

  linkContent() {
    return this.runMutation("add a link", () => addLink(this.doc, {
      target: this.content.linkTarget,
      url: this.content.linkUrl,
      to: Number(this.content.linkTo),
      area: {
        x: (Number(this.content.linkX) || 0) / 100,
        y: (Number(this.content.linkY) || 0) / 100,
        width: (Number(this.content.linkWidth) || 0) / 100,
        height: (Number(this.content.linkHeight) || 0) / 100,
      },
      pages: this.content.linkPage === "all" ? "all" : Number(this.content.linkPage),
    }), (result) => {
      this.renderContent();
      this.setStatus(result.target === "url"
        ? `Linked ${result.pages} page${result.pages === 1 ? "" : "s"} to ${result.url}. Nothing is written until you save a copy.`
        : `Linked ${result.pages} page${result.pages === 1 ? "" : "s"} to page ${result.to}. Nothing is written until you save a copy.`);
    });
  }

  bookmarksContent() {
    const parsed = parseBookmarkText(this.content.bookmarks);
    if (!parsed.ok) {
      this.setStatus(parsed.message);
      return Promise.resolve(parsed);
    }
    const view = { zoom: this.content.bookmarkZoom, top: this.content.bookmarkTop };
    return this.runMutation("set the bookmarks", () => setOutline(this.doc, parsed.entries, view), (result) => {
      this.content.bookmarks = formatBookmarkText(parsed.entries);
      this.renderContent();
      const at = result.view
        ? ` at ${result.view.zoom ? `${result.view.zoom}% zoom` : "the viewer's zoom"}${result.view.top ? `, ${result.view.top}% down the page` : ""}`
        : " at a whole page";
      this.setStatus(result.written
        ? `Wrote ${result.written} bookmark${result.written === 1 ? "" : "s"} in ${result.depth} level${result.depth === 1 ? "" : "s"}${at}. Nothing is written until you save a copy.`
        : "The bookmarks are cleared for the copy you save. Nothing is written until you save a copy.");
    });
  }

  /** Replaces one link's rectangle in place, keeping its address. */
  moveLinkContent() {
    const fields = [this.content.linkAreaLeft, this.content.linkAreaTop, this.content.linkAreaWidth, this.content.linkAreaHeight]
      .map((value) => String(value ?? "").trim());
    return this.runMutation("move a link", () => updateLink(this.doc, {
      index: Number(this.content.linkEdit),
      area: {
        x: fields[0] === "" ? NaN : Number(fields[0]) / 100,
        y: fields[1] === "" ? NaN : Number(fields[1]) / 100,
        width: fields[2] === "" ? NaN : Number(fields[2]) / 100,
        height: fields[3] === "" ? NaN : Number(fields[3]) / 100,
      },
    }), (result) => {
      this.renderContent();
      this.setStatus(`Link ${result.index} on page ${result.page} now sits ${fields[2]}% wide and ${fields[3]}% tall at ${fields[0]}% across and ${fields[1]}% down, with its address unchanged. Nothing is written until you save a copy.`);
    });
  }

  /** Restyles one numbered link in place, as an ordinary undoable edit. */
  styleLinkContent() {
    const widthText = String(this.content.linkStyleWidth ?? "").trim();
    const style = {};
    if (widthText !== "") style.width = Number(widthText);
    if (this.content.linkStyleDash !== "keep" && this.content.linkStyleDash !== "") style.dash = String(this.content.linkStyleDash);
    if (this.content.linkStyleHighlight !== "keep" && this.content.linkStyleHighlight !== "") style.highlight = String(this.content.linkStyleHighlight);
    return this.runMutation("style a link", () => updateLink(this.doc, { index: Number(this.content.linkEdit), style }), (result) => {
      this.renderContent();
      const border = result.style.width > 0 ? `a ${result.style.width}-point ${result.style.dash} border` : "no border";
      const highlight = result.style.highlight === "none" ? "no highlight" : `the ${result.style.highlight} highlight`;
      this.setStatus(`Link ${result.index} on page ${result.page} now has ${border} and ${highlight}. Nothing is written until you save a copy.`);
    });
  }

  /** The current styling of the link at the Change number, read back from the file. */
  linkStyleHint() {
    if (!this.doc) return "Border width, dash and highlight for the link at Change.";
    const found = readLinks(this.doc);
    if (!found.ok || !found.total) return "No links yet.";
    const index = Math.round(Number(this.content.linkEdit));
    if (!Number.isFinite(index) || index < 1 || index > found.links.length) return `${found.total} link${found.total === 1 ? "" : "s"}; pick one by number.`;
    const style = found.links[index - 1].style;
    const border = style.width > 0 ? `${style.width}pt ${style.dash} border` : "no border";
    const highlight = style.highlight === "none" ? "no highlight" : `${style.highlight} highlight`;
    return `Link ${index}: ${border}, ${highlight}. Keep leaves a choice as it is.`;
  }

  /** Moves the same annotation to another page, with an optional new box there. */
  moveLinkToPageContent() {
    const fields = [this.content.linkAreaLeft, this.content.linkAreaTop, this.content.linkAreaWidth, this.content.linkAreaHeight]
      .map((value) => String(value ?? "").trim());
    const filled = fields.filter((value) => value !== "").length;
    const area = filled === 0
      ? undefined
      : {
        x: fields[0] === "" ? NaN : Number(fields[0]) / 100,
        y: fields[1] === "" ? NaN : Number(fields[1]) / 100,
        width: fields[2] === "" ? NaN : Number(fields[2]) / 100,
        height: fields[3] === "" ? NaN : Number(fields[3]) / 100,
      };
    const pageField = String(this.content.linkPageTo ?? "").trim();
    return this.runMutation("move a link to another page", () => updateLink(this.doc, {
      index: Number(this.content.linkEdit),
      page: pageField === "" ? NaN : Number(pageField),
      area,
    }), (result) => {
      this.renderContent();
      this.setStatus(`Link ${result.index} now sits on page ${result.page}, was page ${result.fromPage}, with its address unchanged. Nothing is written until you save a copy.`);
    });
  }

  /** Retargets one numbered link in place, as an ordinary undoable edit. */
  changeLinkContent() {
    return this.runMutation("change a link", () => updateLink(this.doc, {
      index: Number(this.content.linkEdit),
      target: this.content.linkTarget,
      url: this.content.linkUrl,
      to: Number(this.content.linkTo),
    }), (result) => {
      this.renderContent();
      this.setStatus(result.target === "url"
        ? `Link ${result.index} on page ${result.page} now opens ${result.url}. Nothing is written until you save a copy.`
        : `Link ${result.index} on page ${result.page} now jumps to page ${result.to}. Nothing is written until you save a copy.`);
    });
  }

  /** Removes one numbered link, or all of them, as an ordinary undoable edit. */
  removeLinksContent(all) {
    return this.runMutation("remove a link", () => removeLinks(this.doc, all ? { all: true } : { index: Number(this.content.linkRemove) }), (result) => {
      this.renderContent();
      this.setStatus(`Removed ${result.removed} link${result.removed === 1 ? "" : "s"} on page${result.pages.length === 1 ? "" : "s"} ${result.pages.join(", ")}; ${result.left} left. Nothing is written until you save a copy.`);
    });
  }

  /** A short read-only line about the links the document already carries. */
  linksSummary() {
    if (!this.doc) return "No links yet.";
    const found = readLinks(this.doc);
    if (!found.ok || !found.total) return "No links yet.";
    const shown = found.links.slice(0, 3).map((row) => (row.target === "url" ? `p${row.page} → ${row.url}` : `p${row.page} → page ${row.to}`));
    return `${found.total} link${found.total === 1 ? "" : "s"}: ${shown.join(", ")}${found.total > 3 ? " …" : ""}`;
  }

  /** The annotation tool as an ordinary edit: draw the sidecar marks now, undoably. */
  burnContent() {
    if (!this.annotations.length) {
      this.setStatus("This PDF has no annotations to draw into the pages.");
      return Promise.resolve({ ok: false, reason: "empty" });
    }
    const annotations = this.annotations.slice();
    const pageMap = this.originOrder.slice();
    return this.runMutation("burn annotations", async () => {
      const burned = await flattenAnnotations(this.doc, annotations, { pageMap });
      if (burned.ok) {
        this.annotations = [];
        this.flattenMarks = false;
      }
      return burned;
    }, (burned) => {
      this.renderContent();
      this.renderFooter();
      this.setStatus(`Burned ${burned.drawn} annotation item${burned.drawn === 1 ? "" : "s"} into ${burned.pages} page${burned.pages === 1 ? "" : "s"}. Nothing is written until you save a copy.`);
    });
  }

  /** The document's current properties, for the form and the status line. */
  readProperties() {
    const doc = this.doc;
    const read = (fn) => {
      if (!doc || typeof fn !== "function") return "";
      try {
        return str(fn());
      } catch (error) {
        return "";
      }
    };
    return {
      title: read(() => doc.getTitle()),
      author: read(() => doc.getAuthor()),
      subject: read(() => doc.getSubject()),
      keywords: read(() => doc.getKeywords()),
    };
  }

  propertiesContent() {
    const properties = this.content.properties || {};
    return this.runMutation("set the document properties", () => setDocumentProperties(this.doc, {
      title: properties.title,
      author: properties.author,
      subject: properties.subject,
      keywords: properties.keywords,
    }), () => {
      this.setStatus("The document properties are set for the copy you save. Nothing is written until you save a copy.");
    });
  }

  watermarkContent() {
    return this.runContentEdit("add a watermark", () => addWatermark(this.doc, {
      text: this.content.watermarkText,
      size: Number(this.content.watermarkSize) || 72,
      opacity: (Number(this.content.watermarkOpacity) || 15) / 100,
      color: this.content.watermarkColor,
      angle: Number(this.content.watermarkAngle) || 0,
      pages: this.content.watermarkPage === "all" ? "all" : Number(this.content.watermarkPage),
    }), (value) => `Added the watermark to ${value.pages} page${value.pages === 1 ? "" : "s"}.`);
  }

  /** Splits into separate files beside the original; the edited document is untouched. */
  async splitContent() {
    if (this.busy || this.saving) return;
    this.setBusy(true);
    try {
      while (this.pendingEdits > 0) await this.queue;
      const result = await splitPdf(this.doc, Number(this.content.splitEvery));
      if (!result.ok) {
        this.setStatus(result.message);
        return;
      }
      const paths = [];
      for (let index = 0; index < result.parts.length; index++) {
        const path = await this.writeCopy(result.parts[index].bytes, `split ${index + 1}`);
        if (path) paths.push(path);
      }
      this.setStatus(paths.length
        ? `Wrote ${paths.length} file${paths.length === 1 ? "" : "s"}: ${paths.join(", ")}. The original PDF is unchanged.`
        : "The split files could not be written.");
    } catch (error) {
      this.setStatus(str(error && error.message ? error.message : error));
    } finally {
      this.setBusy(false);
    }
  }

  /* ---------------------------------------------------------------- save */

  renderFooter() {
    const host = this.actionsEl;
    if (!host) return;
    host.empty();
    if (this.annotations.length) {
      const label = host.createEl("label", { cls: "qt-pdf-editor-option" });
      const box = label.createEl("input", { type: "checkbox" });
      box.checked = this.flattenMarks;
      box.addEventListener("change", () => {
        this.flattenMarks = box.checked;
      });
      label.createSpan({ text: `Burn ${this.annotations.length} annotation${this.annotations.length === 1 ? "" : "s"} into the copy` });
    }
    if (this.fields.length) {
      const label = host.createEl("label", { cls: "qt-pdf-editor-option" });
      const box = label.createEl("input", { type: "checkbox" });
      box.checked = this.flattenFields;
      box.addEventListener("change", () => {
        this.flattenFields = box.checked;
      });
      label.createSpan({ text: "Flatten the form so the values cannot be edited" });
    }
    const row = host.createDiv({ cls: "qt-row qt-pdf-editor-actions" });
    const save = row.createEl("button", { text: "Save a copy", cls: "mod-cta qt-grow" });
    save.addEventListener("click", () => this.saveCopy());
    const cancel = row.createEl("button", { text: "Cancel", cls: "qt-grow" });
    cancel.addEventListener("click", () => this.close());
    host.createDiv({ cls: "qt-hint", text: "The copy is written beside the original with a new name." });
  }

  /** Writes bytes to a new file, never over an existing one. */
  async writeCopy(bytes, label) {
    if (this.plugin && typeof this.plugin.savePdfCopy === "function") {
      const written = await this.plugin.savePdfCopy(this.pdfPath, bytes, label);
      return str(written && written.path ? written.path : written);
    }
    const path = editedPathFor(this.pdfPath, (candidate) => Boolean(this.app.vault.getAbstractFileByPath(candidate)), label);
    await this.app.vault.createBinary(path, bytes);
    return path;
  }

  async saveCopy() {
    if (this.saving) return;
    this.setBusy(true);
    this.setStatus("Writing the copy…");
    try {
      // finish and snapshot every edit that was accepted before this save began
      while (this.pendingEdits > 0) await this.queue;
      this.saving = true;
      if (this.flattenMarks && this.annotations.length) {
        const burned = await flattenAnnotations(this.doc, this.annotations, { pageMap: this.originOrder });
        if (!burned.ok) {
          this.setStatus(burned.message);
          return;
        }
        this.flattenMarks = false;
        this.annotations = [];
        this.setStatus(`Burned ${burned.drawn} annotation item${burned.drawn === 1 ? "" : "s"} into ${burned.pages} page${burned.pages === 1 ? "" : "s"}.`);
      }
      if (this.flattenFields && this.fields.length) {
        const flattened = await flattenForm(this.doc);
        if (!flattened.ok) {
          this.setStatus(flattened.message);
          return;
        }
        this.flattenFields = false;
        this.fields = [];
      }
      const saved = await savePdf(this.doc);
      if (!saved.ok) {
        this.setStatus(saved.message);
        return;
      }
      const path = await this.writeCopy(saved.bytes, "edited");
      if (!path) {
        this.setStatus("The copy could not be written.");
        return;
      }
      this.bytes = saved.bytes;
      this.history = clearHistory(this.history, saved.bytes, this.captureState(), "Saved copy");
      this.renderHistory();
      new Notice(`Saved ${path}.`);
      this.close();
      const file = this.app.vault.getAbstractFileByPath(path);
      if (file && this.app.workspace && this.app.workspace.getLeaf) {
        await this.app.workspace.getLeaf("tab").openFile(file);
      }
    } catch (error) {
      this.setStatus(str(error && error.message ? error.message : error));
    } finally {
      this.saving = false;
      this.setBusy(false);
    }
  }
}

module.exports = { ImagePickerModal, PdfEditorModal, PdfSourcePickerModal };
