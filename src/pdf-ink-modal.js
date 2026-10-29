"use strict";
const { Modal, Notice, Setting, TFile } = require("obsidian");
const { renderPdfPagesAsPng } = require("./pdf");
const { hashBytes, parseAnnotationFile, removeAnnotation, sidecarPathFor, upsertAnnotation } = require("./pdf-annotations");
const { INK_COLORS, INK_COLOR_HEX, INK_TOOLS, MAX_INK_POINTS, areaAt, boxAt, clamp, drawInkSegment, drawInkStrokes, eraseStrokesAt, normalizeHighlightArea, normalizeHighlightAreas, normalizeInkStroke, normalizeInkStrokes, normalizeTextBox, normalizeTextBoxes } = require("./pdf-ink");

const TOOL_LABELS = { pen: "Pen", highlighter: "Highlighter", text: "Text box", highlight: "Highlight", eraser: "Eraser" };
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

class TextBoxPromptModal extends Modal {
  constructor(app, options, onDone) {
    super(app);
    this.options = options || {};
    this.onDone = onDone || (() => {});
    this.textEl = null;
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
    this.textEl = el.createEl("textarea", { cls: "qt-pdf-ink-textarea" });
    this.textEl.rows = 5;
    this.textEl.value = this.options.text || "";
    const row = el.createDiv({ cls: "qt-row qt-pdf-ink-actions" });
    const save = row.createEl("button", { text: "Save", cls: "mod-cta qt-grow" });
    save.addEventListener("click", () => this.commit());
    const cancel = row.createEl("button", { text: "Cancel", cls: "qt-grow" });
    cancel.addEventListener("click", () => this.close());
    this.textEl.focus();
  }

  commit() {
    const value = this.textEl ? this.textEl.value : "";
    this.close();
    this.onDone(value);
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
    this.highlightId = "";
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
    this.pageWrap = null;
    this.canvas = null;
    this.ctx = null;
  }

  onOpen() {
    this.modalEl.addClass("qt-pdf-ink-modal");
    this.render();
    this.loadPage();
  }

  onClose() {
    this.loadToken++;
    if (this.dirty) this.save().catch(() => {});
    if (this.objectUrl) {
      try {
        URL.revokeObjectURL(this.objectUrl);
      } catch (e) {
        /* ignore */
      }
      this.objectUrl = "";
    }
    this.contentEl.empty();
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
        await this.loadPage();
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
      for (const tool of [...INK_TOOLS, "text", "highlight", "eraser"]) d.addOption(tool, TOOL_LABELS[tool]);
      d.setValue(this.tool).onChange((v) => {
        this.tool = INK_TOOLS.includes(v) || v === "text" || v === "highlight" || v === "eraser" ? v : "pen";
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

    this.statusEl = el.createDiv({ cls: "qt-hint" });
    this.stageEl = el.createDiv({ cls: "qt-pdf-ink-stage" });
    if (this.busy) this.setStatus("Loading…");
  }

  async loadPage() {
    if (!this.stageEl) return;
    const token = ++this.loadToken;
    this.busy = true;
    this.setStatus("Rendering page…");
    try {
      const file = this.app.vault.getAbstractFileByPath(this.pdfPath);
      if (!file || !(file instanceof TFile)) throw new Error("That PDF is no longer in the vault.");
      const bytes = await this.app.vault.readBinary(file);
      const hash = hashBytes(bytes);
      const rendered = await renderPdfPagesAsPng(bytes, String(this.page), (message) => this.setStatus(message), 1.6);
      if (token !== this.loadToken) return;
      if (!rendered.pages.length) throw new Error("That page could not be rendered.");
      this.total = Math.max(0, Number(rendered.total) || 0);
      this.currentHash = hash;
      this.history = [];
      await this.loadSidecar();
      if (token !== this.loadToken) return;
      await this.showPage(rendered.pages[0].png);
      if (token !== this.loadToken) return;
      this.dirty = false;
      this.pageInputEl.value = String(this.page);
      this.pageTotalEl.setText(`of ${this.total || "?"}`);
      const warning = this.savedHash && this.savedHash !== hash ? " The PDF changed since its annotations were saved; check that the page still matches." : "";
      this.setStatus(`Page ${this.page} ready. Draw, then Save.${warning}`);
    } catch (e) {
      if (token === this.loadToken) this.setStatus(e && e.message ? e.message : String(e));
    } finally {
      if (token === this.loadToken) this.busy = false;
    }
  }

  async loadSidecar() {
    this.sidecarPath = sidecarPathFor(this.pdfPath);
    this.strokes = [];
    this.inkId = "";
    this.textBoxes = [];
    this.textId = "";
    this.highlights = [];
    this.highlightId = "";
    this.savedHash = "";
    const existing = this.app.vault.getAbstractFileByPath(this.sidecarPath);
    if (!existing) return;
    let parsed;
    try {
      parsed = parseAnnotationFile(await this.app.vault.cachedRead(existing));
    } catch (e) {
      this.setStatus(e.message);
      return;
    }
    this.savedHash = parsed.pdfHash || "";
    const ink = (parsed.annotations || []).find((a) => a.page === Number(this.page) && a.type === "pen" && Array.isArray(a.strokes) && a.strokes.length);
    if (ink) {
      this.inkId = ink.id;
      this.strokes = normalizeInkStrokes(ink.strokes);
    }
    const textLayer = (parsed.annotations || []).find((a) => a.page === Number(this.page) && a.type === "text" && Array.isArray(a.boxes) && a.boxes.length);
    if (textLayer) {
      this.textId = textLayer.id;
      this.textBoxes = normalizeTextBoxes(textLayer.boxes);
    }
    const highlightLayer = (parsed.annotations || []).find((a) => a.page === Number(this.page) && a.type === "highlight" && Array.isArray(a.areas) && a.areas.length);
    if (highlightLayer) {
      this.highlightId = highlightLayer.id;
      this.highlights = normalizeHighlightAreas(highlightLayer.areas);
    }
  }

  async showPage(png) {
    if (!this.stageEl) return;
    this.stageEl.empty();
    if (this.objectUrl) {
      try {
        URL.revokeObjectURL(this.objectUrl);
      } catch (e) {
        /* ignore */
      }
    }
    const blob = new Blob([png], { type: "image/png" });
    this.objectUrl = URL.createObjectURL(blob);
    this.pageWrap = this.stageEl.createDiv({ cls: "qt-pdf-ink-page-wrap" });
    const image = this.pageWrap.createEl("img", { cls: "qt-pdf-ink-page" });
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("The rendered page could not be shown."));
      image.src = this.objectUrl;
    });
    const canvas = this.pageWrap.createEl("canvas", { cls: "qt-pdf-ink-canvas" });
    canvas.width = Math.max(1, Math.round(image.naturalWidth || image.width || 1000));
    canvas.height = Math.max(1, Math.round(image.naturalHeight || image.height || 1400));
    this.canvas = canvas;
    this.ctx = canvas.getContext ? canvas.getContext("2d") : null;
    this.bindCanvas();
    this.redraw();
  }

  bindCanvas() {
    const canvas = this.canvas;
    if (!canvas || !canvas.addEventListener) return;
    const pointAt = (event) => {
      const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { left: 0, top: 0, width: canvas.width, height: canvas.height };
      const width = Number(rect.width) || canvas.width || 1;
      const height = Number(rect.height) || canvas.height || 1;
      return [clamp((Number(event.clientX) - Number(rect.left || 0)) / width, 0, 1), clamp((Number(event.clientY) - Number(rect.top || 0)) / height, 0, 1)];
    };
    canvas.addEventListener("pointerdown", (event) => {
      if (this.busy) return;
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
      if (this.tool === "highlight") {
        this.highlightStart = point;
        this.highlightDraft = normalizeHighlightArea({ x: point[0], y: point[1], width: 0.001, height: 0.001, color: this.color, note: "" });
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
    this.dirty = true;
  }

  redraw() {
    if (!this.ctx || !this.canvas) return;
    const width = this.canvas.width;
    const height = this.canvas.height;
    this.ctx.clearRect(0, 0, width, height);
    drawHighlightAreas(this.ctx, this.highlights, width, height);
    if (this.highlightDraft) drawHighlightAreas(this.ctx, [this.highlightDraft], width, height);
    drawInkStrokes(this.ctx, this.strokes, width, height, false);
    drawTextBoxes(this.ctx, this.textBoxes, width, height);
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
    const start = this.highlightStart;
    const end = this.lastPoint || start;
    this.highlightStart = null;
    this.highlightDraft = null;
    if (!start || !end) {
      this.redraw();
      return;
    }
    const width = Math.abs(end[0] - start[0]);
    const height = Math.abs(end[1] - start[1]);
    if (width >= 0.01 && height >= 0.01) {
      const area = normalizeHighlightArea({
        x: Math.min(start[0], end[0]),
        y: Math.min(start[1], end[1]),
        width,
        height,
        color: this.color,
        note: "",
      });
      this.redraw();
      if (!area) return;
      new TextBoxPromptModal(
        this.app,
        { title: "Highlight note", text: "" },
        (value) => {
          area.note = String(value || "").trim();
          this.pushHistory();
          this.highlights.push(area);
          this.touch();
          this.redraw();
        }
      ).open();
      return;
    }
    const hit = areaAt(this.highlights, end);
    if (hit) this.editHighlightNote(hit);
    else this.setStatus("Drag across an area to highlight it.");
    this.redraw();
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

  async goToPage(value) {
    const target = clampPage(value, this.total);
    if (target === this.page) {
      if (this.pageInputEl) this.pageInputEl.value = String(this.page);
      return;
    }
    if (!(await this.leavePage())) return;
    this.page = target;
    await this.loadPage();
  }

  async stepPage(delta) {
    if (!this.total) return;
    await this.goToPage(this.page + delta);
  }

  async leavePage() {
    if (!this.dirty) return true;
    const saved = await this.save();
    return saved === true;
  }

  async save(options) {
    const opts = options || {};
    if (this.busy) return false;
    const seq = this.editSeq;
    const page = this.page;
    const strokes = normalizeInkStrokes(this.strokes);
    const boxes = normalizeTextBoxes(this.textBoxes);
    const areas = normalizeHighlightAreas(this.highlights);
    if (!strokes.length && !this.inkId && !boxes.length && !this.textId && !areas.length && !this.highlightId) {
      this.setStatus("Draw something, add a text box or highlight an area first.");
      return false;
    }
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
      let inkId = this.inkId;
      let textId = this.textId;
      let highlightId = this.highlightId;
      if (strokes.length) {
        const result = upsertAnnotation(nextText, { id: inkId || undefined, page, type: "pen", color: this.color, strokes }, meta);
        nextText = result.text;
        const savedInk = (result.annotations || []).find((a) => a.page === page && a.type === "pen" && Array.isArray(a.strokes) && a.strokes.length);
        inkId = savedInk ? savedInk.id : "";
      } else if (inkId) {
        nextText = removeAnnotation(nextText, inkId, meta).text;
        inkId = "";
      }
      if (boxes.length) {
        const result = upsertAnnotation(nextText, { id: textId || undefined, page, type: "text", color: this.color, boxes }, meta);
        nextText = result.text;
        const savedText = (result.annotations || []).find((a) => a.page === page && a.type === "text" && Array.isArray(a.boxes) && a.boxes.length);
        textId = savedText ? savedText.id : "";
      } else if (textId) {
        nextText = removeAnnotation(nextText, textId, meta).text;
        textId = "";
      }
      if (areas.length) {
        const result = upsertAnnotation(nextText, { id: highlightId || undefined, page, type: "highlight", color: this.color, areas }, meta);
        nextText = result.text;
        const savedHighlights = (result.annotations || []).find((a) => a.page === page && a.type === "highlight" && Array.isArray(a.areas) && a.areas.length);
        highlightId = savedHighlights ? savedHighlights.id : "";
      } else if (highlightId) {
        nextText = removeAnnotation(nextText, highlightId, meta).text;
        highlightId = "";
      }
      if (existing) await this.app.vault.modify(existing, nextText);
      else await this.app.vault.create(path, nextText);
      this.sidecarPath = path;
      this.savedHash = hash;
      this.inkId = inkId;
      this.textId = textId;
      this.highlightId = highlightId;
      this.dirty = this.editSeq !== seq;
      const bits = [];
      if (strokes.length) bits.push(`${strokes.length} stroke${strokes.length === 1 ? "" : "s"}`);
      if (boxes.length) bits.push(`${boxes.length} text box${boxes.length === 1 ? "" : "es"}`);
      if (areas.length) bits.push(`${areas.length} highlight${areas.length === 1 ? "" : "s"}`);
      this.setStatus(bits.length ? `Saved ${bits.join(" and ")} on page ${page}.` : `Removed the overlay from page ${page}.`);
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
