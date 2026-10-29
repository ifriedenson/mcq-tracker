"use strict";
const { Modal, Notice, Setting, TFile } = require("obsidian");
const { renderPdfPagesAsPng } = require("./pdf");
const { hashBytes, parseAnnotationFile, removeAnnotation, sidecarPathFor, upsertAnnotation } = require("./pdf-annotations");
const { INK_COLORS, INK_TOOLS, MAX_INK_POINTS, clamp, drawInkSegment, drawInkStrokes, eraseStrokesAt, normalizeInkStroke, normalizeInkStrokes } = require("./pdf-ink");

const TOOL_LABELS = { pen: "Pen", highlighter: "Highlighter", eraser: "Eraser" };
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
      text: "Pen and highlighter strokes are saved in the PDF's annotation sidecar. They are stored as page coordinates, so they stay in place at any zoom or on another device. Text boxes and quoted highlights remain available in Add a PDF annotation.",
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
      for (const tool of [...INK_TOOLS, "eraser"]) d.addOption(tool, TOOL_LABELS[tool]);
      d.setValue(this.tool).onChange((v) => {
        this.tool = INK_TOOLS.includes(v) || v === "eraser" ? v : "pen";
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
    if (!ink) return;
    this.inkId = ink.id;
    this.strokes = normalizeInkStrokes(ink.strokes);
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
      if (this.tool === "eraser") {
        this.erasing = true;
        this.eraseAt(point);
        return;
      }
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
    drawInkStrokes(this.ctx, this.strokes, this.canvas.width, this.canvas.height);
  }

  undo() {
    if (!this.strokes.length) return;
    this.strokes.pop();
    this.touch();
    this.redraw();
  }

  clear() {
    if (!this.strokes.length) return;
    this.strokes = [];
    // Keep inkId: saving an empty page must remove the existing annotation.
    this.touch();
    this.redraw();
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
    if (!this.strokes.length && !this.inkId) {
      this.setStatus("Draw something first.");
      return false;
    }
    this.busy = true;
    this.setStatus("Saving…");
    const seq = this.editSeq;
    const page = this.page;
    const strokes = normalizeInkStrokes(this.strokes);
    try {
      const file = this.app.vault.getAbstractFileByPath(this.pdfPath);
      if (!file || !(file instanceof TFile)) throw new Error("That PDF is no longer in the vault.");
      const bytes = await this.app.vault.readBinary(file);
      const hash = hashBytes(bytes);
      const path = sidecarPathFor(this.pdfPath);
      const existing = this.app.vault.getAbstractFileByPath(path);
      const oldText = existing ? await this.app.vault.cachedRead(existing) : "";
      let result;
      if (strokes.length) {
        result = upsertAnnotation(
          oldText,
          {
            id: this.inkId || undefined,
            page,
            type: "pen",
            color: this.color,
            strokes,
          },
          { pdfPath: this.pdfPath, pdfHash: hash }
        );
      } else if (this.inkId) {
        result = removeAnnotation(oldText, this.inkId, { pdfPath: this.pdfPath, pdfHash: hash });
      } else {
        this.setStatus("Draw something first.");
        return false;
      }
      if (existing) await this.app.vault.modify(existing, result.text);
      else await this.app.vault.create(path, result.text);
      this.sidecarPath = path;
      this.savedHash = hash;
      const ink = (result.annotations || []).find((a) => a.page === page && a.type === "pen" && Array.isArray(a.strokes) && a.strokes.length);
      this.inkId = ink ? ink.id : "";
      this.dirty = this.editSeq !== seq;
      this.setStatus(strokes.length ? `Saved ${strokes.length} stroke${strokes.length === 1 ? "" : "s"} on page ${page}.` : `Removed the ink from page ${page}.`);
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

module.exports = { PdfInkModal };
