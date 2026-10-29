"use strict";
/*
 * Photo-to-PDF paper scanning. Images are normalized to JPEG locally, ordered
 * and cropped in the dialog, and written into one PDF with a small
 * dependency-free writer. There is no OCR here: the resulting PDF can go
 * through the existing course notes or question importer, or a separate
 * text-recognition tool.
 */
const { Modal, Setting, TFile, normalizePath } = require("obsidian");
const { FolderSuggest } = require("./modals");
const { ensureFolder, localDate, str } = require("./util");

const DEFAULT_SCAN_FOLDER = "Paper scans";
const FULL_CROP = { x: 0, y: 0, w: 1, h: 1 };

function utf8(text) {
  return new TextEncoder().encode(str(text));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function concat(chunks) {
  const total = chunks.reduce((n, chunk) => n + chunk.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

/** Width and height from the first JPEG start-of-frame marker. */
function jpegSize(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) throw new Error("That file is not a JPEG image.");
  let i = 2;
  while (i + 3 < b.length) {
    while (i < b.length && b[i] === 0xff) i++;
    const marker = b[i++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (i + 1 >= b.length) break;
    const length = (b[i] << 8) | b[i + 1];
    if (length < 2) break;
    const sof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (sof && i + 6 < b.length) {
      return { height: (b[i + 3] << 8) | b[i + 4], width: (b[i + 5] << 8) | b[i + 6] };
    }
    i += length;
  }
  throw new Error("I couldn't read the JPEG dimensions.");
}

/** Keep a crop rectangle inside the image and give it a usable minimum size. */
function normalizeCrop(rect) {
  const r = rect || {};
  const x = clamp(r.x, 0, 0.99);
  const y = clamp(r.y, 0, 0.99);
  const w = clamp(r.w === undefined ? 1 : r.w, 0.01, 1 - x);
  const h = clamp(r.h === undefined ? 1 : r.h, 0.01, 1 - y);
  return { x, y, w, h };
}

function normalizeRotation(value) {
  const n = Math.round(Number(value) || 0);
  return ((n % 360) + 360) % 360;
}

/**
 * Work out the crop rectangle, rotation, output size and scale for one photo.
 * Crop fractions always refer to the unrotated source, so rotating a page does
 * not move its crop box.
 */
function scanGeometry(width, height, crop, rotation, maxSize) {
  const sourceWidth = Math.max(1, Math.round(Number(width) || 1));
  const sourceHeight = Math.max(1, Math.round(Number(height) || 1));
  const c = normalizeCrop(crop);
  const r = normalizeRotation(rotation);
  const cropWidth = Math.max(1, Math.round(c.w * sourceWidth));
  const cropHeight = Math.max(1, Math.round(c.h * sourceHeight));
  const x = Math.min(sourceWidth - cropWidth, Math.max(0, Math.round(c.x * sourceWidth)));
  const y = Math.min(sourceHeight - cropHeight, Math.max(0, Math.round(c.y * sourceHeight)));
  const rotated = r === 90 || r === 270;
  const rawWidth = rotated ? cropHeight : cropWidth;
  const rawHeight = rotated ? cropWidth : cropHeight;
  const limit = Math.max(1, Number(maxSize) || 2400);
  const scale = Math.min(1, limit / Math.max(rawWidth, rawHeight));
  return {
    sourceX: x,
    sourceY: y,
    sourceWidth: cropWidth,
    sourceHeight: cropHeight,
    width: Math.max(1, Math.round(rawWidth * scale)),
    height: Math.max(1, Math.round(rawHeight * scale)),
    scale,
    rotation: r,
  };
}

/**
 * Minimal PDF 1.4 writer for JPEG pages. Each image becomes one page at its
 * pixel dimensions. No external PDF library or copied code is used.
 */
function buildPdfFromJpegs(images) {
  const list = (Array.isArray(images) ? images : []).filter((image) => image && image.bytes && image.bytes.length);
  if (!list.length) throw new Error("Add at least one photo first.");
  for (const image of list) {
    if (!image.width || !image.height) throw new Error("An image is missing its width or height.");
  }
  const chunks = [];
  let offset = 0;
  const offsets = [0];
  const add = (data) => {
    const part = typeof data === "string" ? utf8(data) : data;
    chunks.push(part);
    offset += part.length;
  };
  const object = (number, body, stream) => {
    offsets[number] = offset;
    add(`${number} 0 obj\n${body}\n`);
    if (stream) {
      add("stream\n");
      add(stream);
      add("\nendstream\n");
    }
    add("endobj\n");
  };

  const pageNumbers = list.map((_image, index) => 3 + index * 3);
  const kids = pageNumbers.map((number) => `${number} 0 R`).join(" ");
  const maxObject = 2 + list.length * 3;

  add("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(2, `<< /Type /Pages /Kids [${kids}] /Count ${list.length} >>`);
  list.forEach((image, index) => {
    const page = pageNumbers[index];
    const imageObject = page + 1;
    const contentObject = page + 2;
    const width = Math.max(1, Math.round(Number(image.width)));
    const height = Math.max(1, Math.round(Number(image.height)));
    object(
      page,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 ${imageObject} 0 R >> >> /Contents ${contentObject} 0 R >>`
    );
    object(
      imageObject,
      `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>`,
      image.bytes
    );
    const content = `q\n${width} 0 0 ${height} 0 0 cm\n/Im0 Do\nQ`;
    object(contentObject, `<< /Length ${utf8(content).length} >>`, utf8(content));
  });

  const xref = offset;
  add(`xref\n0 ${maxObject + 1}\n0000000000 65535 f \n`);
  for (let number = 1; number <= maxObject; number++) {
    add(`${String(offsets[number] || 0).padStart(10, "0")} 00000 n \n`);
  }
  add(`trailer\n<< /Size ${maxObject + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return concat(chunks);
}

function uniquePath(vault, folder, name, extension) {
  const safe = str(name).replace(/[\\/:*?"<>|]/g, "-").trim() || "Scan";
  let path = normalizePath(`${folder}/${safe}.${extension || "pdf"}`);
  let n = 2;
  while (vault.getAbstractFileByPath(path)) {
    path = normalizePath(`${folder}/${safe} ${n}.${extension || "pdf"}`);
    n++;
  }
  return path;
}

async function loadSource(file) {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return { source: bitmap, width: bitmap.width, height: bitmap.height };
  }
  const url = URL.createObjectURL(file);
  const image = document.createElement("img");
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error("That photo could not be opened."));
    image.src = url;
  });
  const loaded = { source: image, width: image.naturalWidth || image.width, height: image.naturalHeight || image.height };
  URL.revokeObjectURL(url);
  return loaded;
}

async function fileToJpeg(file, maxSize, transform) {
  const { source, width, height } = await loadSource(file);
  const geometry = scanGeometry(width, height, transform && transform.crop, transform && transform.rotation, Math.max(600, Number(maxSize) || 2400));
  const canvas = document.createElement("canvas");
  canvas.width = geometry.width;
  canvas.height = geometry.height;
  const context = canvas.getContext("2d");
  const drawWidth = geometry.sourceWidth * geometry.scale;
  const drawHeight = geometry.sourceHeight * geometry.scale;
  context.save();
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((geometry.rotation * Math.PI) / 180);
  context.drawImage(
    source,
    geometry.sourceX,
    geometry.sourceY,
    geometry.sourceWidth,
    geometry.sourceHeight,
    -drawWidth / 2,
    -drawHeight / 2,
    drawWidth,
    drawHeight
  );
  context.restore();
  if (source && typeof source.close === "function") source.close();
  const blob = await new Promise((resolve, reject) => {
    if (!canvas.toBlob) return reject(new Error("This device cannot convert photos to JPEG."));
    canvas.toBlob((value) => (value ? resolve(value) : reject(new Error("The photo could not be converted."))), "image/jpeg", 0.9);
  });
  return { bytes: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height };
}

class PaperScannerModal extends Modal {
  constructor(app, plugin, onDone) {
    super(app);
    this.plugin = plugin;
    this.onDone = onDone || (() => {});
    this.images = [];
    this.folder = DEFAULT_SCAN_FOLDER;
    this.title = `Scan ${localDate()}`;
    this.cropIndex = null;
    this.cropDraft = null;
  }

  onOpen() {
    this.modalEl.addClass("qt-import-modal");
    this.render();
  }

  addFiles(files) {
    let added = 0;
    for (const file of Array.from(files || [])) {
      if (!file || !/^image\//i.test(file.type || "")) continue;
      this.images.push({ file, url: URL.createObjectURL(file), rotation: 0, crop: null });
      added++;
    }
    if (added) this.render();
  }

  render() {
    const el = this.contentEl;
    el.empty();
    el.createEl("h3", { text: "Paper scanner" });
    el.createEl("p", {
      cls: "setting-item-description",
      text: "Choose or take photos of a worksheet or textbook page, rotate and crop each page, and save one PDF in the vault. The PDF can then go through course notes or a document importer. This phase does not OCR the images.",
    });
    const input = createEl("input", { type: "file", attr: { accept: "image/*", multiple: "true" } });
    input.hidden = true;
    input.addEventListener("change", () => this.addFiles(input.files));
    const row = el.createDiv({ cls: "qt-row" });
    row.createEl("button", { text: "Choose photos", cls: "qt-grow" }).addEventListener("click", () => input.click());
    const camera = createEl("input", { type: "file", attr: { accept: "image/*", capture: "environment" } });
    camera.hidden = true;
    camera.addEventListener("change", () => this.addFiles(camera.files));
    row.createEl("button", { text: "Take photo", cls: "qt-grow" }).addEventListener("click", () => camera.click());

    if (!this.images.length) {
      el.createEl("p", { cls: "qt-hint", text: "No photos yet." });
    } else {
      const list = el.createDiv({ cls: "qt-scan-list" });
      this.images.forEach((item, index) => {
        const card = list.createDiv({ cls: "qt-scan-item" });
        const image = card.createEl("img", { cls: "qt-scan-thumb" });
        image.src = item.url;
        image.alt = item.file.name || `Photo ${index + 1}`;
        if (item.rotation) image.style.transform = `rotate(${item.rotation}deg)`;
        const meta = card.createDiv({ cls: "qt-scan-item-body" });
        const details = [`${index + 1}. ${item.file.name || "Photo"}`];
        if (item.rotation) details.push(`${item.rotation}°`);
        if (item.crop) details.push("cropped");
        meta.createSpan({ cls: "qt-scan-name", text: details.join(" · ") });
        const controls = meta.createDiv({ cls: "qt-row qt-scan-controls" });
        controls.createEl("button", { text: "Rotate" }).addEventListener("click", () => this.rotate(index));
        controls.createEl("button", { text: "Crop" }).addEventListener("click", () => this.openCrop(index));
        controls.createEl("button", { text: "Up" }).addEventListener("click", () => this.move(index, -1));
        controls.createEl("button", { text: "Down" }).addEventListener("click", () => this.move(index, 1));
        controls.createEl("button", { text: "Remove" }).addEventListener("click", () => this.remove(index));
      });
    }

    if (this.cropIndex !== null) this.renderCropEditor(el);

    new Setting(el)
      .setName("Save PDF in")
      .setDesc("The folder is created if it does not exist.")
      .addText((t) => {
        new FolderSuggest(this.app, t.inputEl);
        t.setPlaceholder(DEFAULT_SCAN_FOLDER).setValue(this.folder).onChange((v) => (this.folder = v));
      });
    new Setting(el)
      .setName("File name")
      .setDesc("A date is already included in the default name.")
      .addText((t) => t.setValue(this.title).onChange((v) => (this.title = v)));

    const actions = el.createDiv({ cls: "qt-row" });
    actions.createEl("button", { text: "Cancel", cls: "qt-grow" }).addEventListener("click", () => this.close());
    const create = actions.createEl("button", { text: "Create PDF", cls: "mod-cta qt-grow" });
    create.disabled = !this.images.length;
    create.addEventListener("click", () => this.createPdf());
  }

  renderCropEditor(el) {
    const item = this.images[this.cropIndex];
    if (!item) {
      this.cropIndex = null;
      return;
    }
    if (!this.cropDraft) this.cropDraft = normalizeCrop(item.crop || FULL_CROP);
    const card = el.createDiv({ cls: "qt-scan-crop" });
    card.createEl("h4", { text: `Crop photo ${this.cropIndex + 1}` });
    card.createEl("p", { cls: "qt-hint", text: "Drag a rectangle over the page. Crop is applied before rotation." });
    const wrap = card.createDiv({ cls: "qt-scan-crop-wrap" });
    const image = wrap.createEl("img", { cls: "qt-scan-crop-img" });
    image.src = item.url;
    const box = wrap.createDiv({ cls: "qt-scan-crop-box" });
    const draw = () => this.positionCrop(box, this.cropDraft);
    draw();
    let start = null;
    const point = (event) => {
      const rect = wrap.getBoundingClientRect();
      return {
        x: clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1),
        y: clamp((event.clientY - rect.top) / Math.max(1, rect.height), 0, 1),
      };
    };
    wrap.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      start = point(event);
      this.cropDraft = { x: start.x, y: start.y, w: 0.01, h: 0.01 };
      if (wrap.setPointerCapture) wrap.setPointerCapture(event.pointerId);
      draw();
    });
    wrap.addEventListener("pointermove", (event) => {
      if (!start) return;
      const now = point(event);
      this.cropDraft = normalizeCrop({
        x: Math.min(start.x, now.x),
        y: Math.min(start.y, now.y),
        w: Math.abs(now.x - start.x),
        h: Math.abs(now.y - start.y),
      });
      draw();
    });
    wrap.addEventListener("pointerup", () => (start = null));
    wrap.addEventListener("pointercancel", () => (start = null));

    const controls = card.createDiv({ cls: "qt-row qt-scan-controls" });
    controls.createEl("button", { text: "Apply crop", cls: "mod-cta" }).addEventListener("click", () => {
      item.crop = normalizeCrop(this.cropDraft);
      this.cropIndex = null;
      this.cropDraft = null;
      this.render();
    });
    controls.createEl("button", { text: "Reset crop" }).addEventListener("click", () => {
      item.crop = null;
      this.cropDraft = normalizeCrop(FULL_CROP);
      this.render();
    });
    controls.createEl("button", { text: "Cancel" }).addEventListener("click", () => {
      this.cropIndex = null;
      this.cropDraft = null;
      this.render();
    });
  }

  positionCrop(box, rect) {
    const crop = normalizeCrop(rect);
    box.style.left = `${crop.x * 100}%`;
    box.style.top = `${crop.y * 100}%`;
    box.style.width = `${crop.w * 100}%`;
    box.style.height = `${crop.h * 100}%`;
  }

  rotate(index) {
    const item = this.images[index];
    if (!item) return;
    item.rotation = normalizeRotation(item.rotation + 90);
    this.render();
  }

  openCrop(index) {
    if (!this.images[index]) return;
    this.cropIndex = index;
    this.cropDraft = null;
    this.render();
  }

  move(index, delta) {
    const to = index + delta;
    if (to < 0 || to >= this.images.length) return;
    const [item] = this.images.splice(index, 1);
    this.images.splice(to, 0, item);
    if (this.cropIndex === index) this.cropIndex = to;
    else if (this.cropIndex === to) this.cropIndex = index;
    this.render();
  }

  remove(index) {
    const [item] = this.images.splice(index, 1);
    if (item) URL.revokeObjectURL(item.url);
    if (this.cropIndex === index) {
      this.cropIndex = null;
      this.cropDraft = null;
    } else if (this.cropIndex !== null && this.cropIndex > index) {
      this.cropIndex--;
    }
    this.render();
  }

  async createPdf() {
    const el = this.contentEl;
    const folder = normalizePath(str(this.folder).trim() || DEFAULT_SCAN_FOLDER);
    el.empty();
    el.createEl("h3", { text: "Building the PDF..." });
    const status = el.createDiv({ cls: "qt-hint", text: "Converting photos..." });
    try {
      const images = [];
      for (let i = 0; i < this.images.length; i++) {
        status.setText(`Converting photo ${i + 1} of ${this.images.length}...`);
        const item = this.images[i];
        images.push(await fileToJpeg(item.file, 2400, { crop: item.crop, rotation: item.rotation }));
      }
      const pdf = buildPdfFromJpegs(images);
      await ensureFolder(this.app, folder);
      const path = uniquePath(this.app.vault, folder, this.title, "pdf");
      await this.app.vault.createBinary(path, pdf);
      this.plugin.refreshViews();
      this.showDone(el, path, images.length);
      if (this.onDone) this.onDone({ path, pages: images.length });
    } catch (e) {
      el.empty();
      el.createEl("h3", { text: "The PDF was not created" });
      el.createEl("p", { cls: "qt-error", text: str(e && e.message) || "The photos could not be converted." });
      const row = el.createDiv({ cls: "qt-row" });
      row.createEl("button", { text: "Back", cls: "qt-grow" }).addEventListener("click", () => this.render());
    }
  }

  showDone(el, path, pages) {
    el.empty();
    el.createEl("h3", { text: "PDF created" });
    el.createEl("p", { text: `Saved ${pages} page${pages === 1 ? "" : "s"} in ${path}.` });
    el.createEl("p", { cls: "qt-hint", text: "Run Import course notes from a lecture or chapter, or the question importer, and choose this PDF from the vault when you want to use it." });
    const row = el.createDiv({ cls: "qt-row" });
    row.createEl("button", { text: "Close", cls: "qt-grow" }).addEventListener("click", () => this.close());
    row.createEl("button", { text: "Open PDF", cls: "mod-cta qt-grow" }).addEventListener("click", () => {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (file instanceof TFile) this.app.workspace.getLeaf("tab").openFile(file);
      this.close();
    });
  }

  onClose() {
    for (const item of this.images) URL.revokeObjectURL(item.url);
    this.contentEl.empty();
  }
}

module.exports = {
  DEFAULT_SCAN_FOLDER,
  FULL_CROP,
  jpegSize,
  normalizeCrop,
  normalizeRotation,
  scanGeometry,
  buildPdfFromJpegs,
  uniquePath,
  fileToJpeg,
  PaperScannerModal,
};
