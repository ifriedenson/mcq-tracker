"use strict";
/*
 * PDF editing: page operations, AcroForm filling and annotation flattening.
 *
 * The heavy lifting is done by the vendored pdf-lib build in vendor/pdf-lib.js
 * (MIT, pdf-lib 1.17.1, see NOTICES.md). This module holds the bounded and
 * validated operations, and it has no Obsidian API, so the whole path runs
 * under `node --test` with real PDFs.
 *
 * The source PDF is never modified: every write goes to a new copy.
 */
const { PDFDocument, PDFTextField, PDFCheckBox, PDFRadioGroup, PDFDropdown, PDFOptionList, StandardFonts, degrees, rgb } = require("../vendor/pdf-lib.js");
const { INK_COLOR_HEX, MARK_STYLES, clamp, normalizeHighlightAreas, normalizeInkStrokes, normalizeTextBoxes } = require("./pdf-ink");

const MAX_BYTES = 80 * 1024 * 1024;
const MAX_PAGES = 2000;
const MAX_INSERT_PAGES = 500;
const MAX_FORM_FIELDS = 500;
const MIN_FIELD_SIZE = 8;
const MAX_FIELD_OPTIONS = 50;
const MAX_FIELD_LABEL = 80;
const MAX_FIELD_NAME = 60;
const FORM_FIELD_TYPES = ["text", "checkbox", "dropdown", "radio"];
const MAX_TEXT_LINES = 40;
const MAX_FIELD_TEXT = 2000;
const MAX_FLATTEN_ITEMS = 20000;
const DEFAULT_PAGE = [595.28, 841.89];
const ROTATIONS = [0, 90, 180, 270];
const MAX_CONTENT_TEXT = 5000;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MIN_CONTENT_SIZE = 5;
const MAX_CONTENT_SIZE = 96;
const MIN_CROP_POINTS = 36;
const MAX_PROPERTY_TEXT = 200;
const MAX_KEYWORDS = 20;
const MAX_WATERMARK_TEXT = 200;
const WATERMARK_ANGLES = [0, 30, 45, 60, 90, 180, 270];
const MAX_SPLIT_PARTS = 100;
const TEXT_POSITIONS = ["top-left", "top-center", "top-right", "middle-left", "middle-center", "middle-right", "bottom-left", "bottom-center", "bottom-right"];
const TEXT_FONTS = { helvetica: StandardFonts.Helvetica, times: StandardFonts.TimesRoman, courier: StandardFonts.Courier };

function str(value) {
  return value === undefined || value === null ? "" : String(value);
}

function round(value, places) {
  const scale = Math.pow(10, places || 0);
  return Math.round(value * scale) / scale;
}

function toBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  return null;
}

/** A short, readable reason for a pdf-lib failure, never a stack trace. */
function pdfError(error) {
  const raw = str(error && error.message ? error.message : error).replace(/\s+/g, " ").trim();
  if (!raw) return "The PDF engine reported an unknown problem.";
  return raw.length > 200 ? `${raw.slice(0, 197)}...` : raw;
}

function hexToRgb(hex) {
  const clean = str(hex).replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(clean)) return rgb(0.95, 0.79, 0.3);
  return rgb(parseInt(clean.slice(0, 2), 16) / 255, parseInt(clean.slice(2, 4), 16) / 255, parseInt(clean.slice(4, 6), 16) / 255);
}

/** PDF text is WinAnsi; anything outside it becomes a safe stand-in. */
function winAnsiText(value) {
  return str(value)
    .replace(/[\u2018\u2019\u201a\u201b]/g, "'")
    .replace(/[\u201c\u201d\u201e\u201f]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00a0/g, " ")
    .replace(/[^\t\n\x20-\x7e\xa0-\xff]/g, "?");
}

function normalizedRotation(value) {
  const n = Math.round(Number(value) || 0);
  const wrapped = ((n % 360) + 360) % 360;
  return ROTATIONS.includes(wrapped) ? wrapped : 0;
}

function displaySize(width, height, rotation) {
  return rotation === 90 || rotation === 270 ? { width: height, height: width } : { width, height };
}

/**
 * One point from the displayed (rotated) page, normalized 0..1 with y down,
 * to the page's own bottom-left origin coordinates.
 */
function displayPoint(point, width, height, rotation) {
  const nx = clamp(Number(point && point[0]) || 0, 0, 1);
  const ny = clamp(Number(point && point[1]) || 0, 0, 1);
  if (rotation === 90) return { x: ny * width, y: nx * height };
  if (rotation === 180) return { x: (1 - nx) * width, y: (1 - ny) * height };
  if (rotation === 270) return { x: (1 - ny) * width, y: (1 - nx) * height };
  return { x: nx * width, y: (1 - ny) * height };
}

/** A normalized rectangle (y down) as a PDF rectangle, correct for any /Rotate. */
function displayRect(area, width, height, rotation) {
  const left = clamp(Number(area && area.x) || 0, 0, 1);
  const top = clamp(Number(area && area.y) || 0, 0, 1);
  const w = Math.max(0.0005, Math.min(Number(area && area.width) || 0.001, 1 - left));
  const h = Math.max(0.0005, Math.min(Number(area && area.height) || 0.001, 1 - top));
  const a = displayPoint([left, top], width, height, rotation);
  const b = displayPoint([left + w, top + h], width, height, rotation);
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

/** Baseline and downward unit vectors in page space for a rotated page. */
function textAxes(rotation) {
  if (rotation === 90) return { advance: { x: 0, y: 1 }, down: { x: -1, y: 0 } };
  if (rotation === 180) return { advance: { x: -1, y: 0 }, down: { x: 0, y: 1 } };
  if (rotation === 270) return { advance: { x: 0, y: -1 }, down: { x: 1, y: 0 } };
  return { advance: { x: 1, y: 0 }, down: { x: 0, y: -1 } };
}

/** Greedy wrap in page units, so a text box never runs past its own width. */
function wrapLines(text, font, size, maxWidth) {
  const lines = [];
  for (const paragraph of winAnsiText(text).split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (!line || font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
      else {
        lines.push(line);
        line = word;
      }
      if (lines.length >= MAX_TEXT_LINES) break;
    }
    if (lines.length >= MAX_TEXT_LINES) break;
    lines.push(line);
  }
  return lines.slice(0, MAX_TEXT_LINES);
}

/* ----------------------------------------------------------------- loading */

/** Opens PDF bytes for editing. Returns `{ok:false}` with a readable reason. */
async function loadEditorDocument(bytes) {
  const data = toBytes(bytes);
  if (!data || data.length < 8) return { ok: false, reason: "empty", message: "That file is empty." };
  if (data.length > MAX_BYTES) return { ok: false, reason: "size", message: `That PDF is larger than ${Math.round(MAX_BYTES / (1024 * 1024))} MB.` };
  let doc;
  try {
    doc = await PDFDocument.load(data, { updateMetadata: false });
  } catch (error) {
    const encrypted = str(error && error.name) === "EncryptedPDFError" || /encrypt/i.test(str(error && error.message));
    return {
      ok: false,
      reason: encrypted ? "encrypted" : "parse",
      message: encrypted ? "That PDF is encrypted, so it cannot be edited here. Remove its password first." : `That PDF could not be opened: ${pdfError(error)}`,
    };
  }
  let count;
  try {
    count = doc.getPageCount();
  } catch (error) {
    return { ok: false, reason: "parse", message: `That PDF could not be opened: its page tree is missing or damaged.` };
  }
  if (!count) return { ok: false, reason: "pages", message: "That PDF has no pages." };
  if (count > MAX_PAGES) return { ok: false, reason: "pages", message: `That PDF has more than ${MAX_PAGES} pages.` };
  return { ok: true, doc, pageCount: count };
}

function pageList(doc) {
  return doc.getPages().map((page, index) => {
    const size = page.getSize();
    return {
      index,
      number: index + 1,
      width: round(size.width, 1),
      height: round(size.height, 1),
      rotation: normalizedRotation(page.getRotation().angle),
    };
  });
}

function checkIndex(doc, index) {
  const total = doc.getPageCount();
  const n = Math.round(Number(index));
  if (!Number.isFinite(n) || n < 0 || n >= total) return { ok: false, reason: "index", message: `Page ${Number(index) + 1} is not in this PDF.` };
  return { ok: true, index: n };
}

/* -------------------------------------------------------------- page edits */

function rotatePage(doc, index, by) {
  const check = checkIndex(doc, index);
  if (!check.ok) return check;
  const page = doc.getPage(check.index);
  const step = Number(by) === 0 ? 90 : Number(by);
  const next = normalizedRotation(page.getRotation().angle + (Number.isFinite(step) ? step : 90));
  try {
    page.setRotation(degrees(next));
  } catch (error) {
    return { ok: false, reason: "rotate", message: `That page could not be rotated: ${pdfError(error)}` };
  }
  return { ok: true, index: check.index, rotation: next };
}

function deletePage(doc, index) {
  const check = checkIndex(doc, index);
  if (!check.ok) return check;
  if (doc.getPageCount() <= 1) return { ok: false, reason: "last-page", message: "A PDF needs at least one page. Add a page before deleting this one." };
  try {
    doc.removePage(check.index);
  } catch (error) {
    return { ok: false, reason: "delete", message: `That page could not be removed: ${pdfError(error)}` };
  }
  return { ok: true, pageCount: doc.getPageCount() };
}

/** Moves one page to a new position in the final order. */
function movePage(doc, from, to) {
  const check = checkIndex(doc, from);
  if (!check.ok) return check;
  const total = doc.getPageCount();
  const target = Math.max(0, Math.min(total - 1, Math.round(Number(to))));
  if (!Number.isFinite(target) || target === check.index) return { ok: true, moved: false, pageCount: total };
  try {
    const page = doc.getPage(check.index);
    doc.removePage(check.index);
    doc.insertPage(target, page);
  } catch (error) {
    return { ok: false, reason: "move", message: `That page could not be moved: ${pdfError(error)}` };
  }
  return { ok: true, moved: true, pageCount: doc.getPageCount() };
}

function duplicatePage(doc, index) {
  const check = checkIndex(doc, index);
  if (!check.ok) return Promise.resolve(check);
  if (doc.getPageCount() >= MAX_PAGES) return Promise.resolve({ ok: false, reason: "pages", message: `A document cannot exceed ${MAX_PAGES} pages here.` });
  return duplicatePageAsync(doc, check.index);
}

async function duplicatePageAsync(doc, index) {
  try {
    const [copy] = await doc.copyPages(doc, [index]);
    doc.insertPage(index + 1, copy);
  } catch (error) {
    return { ok: false, reason: "duplicate", message: `That page could not be duplicated: ${pdfError(error)}` };
  }
  return { ok: true, pageCount: doc.getPageCount() };
}

function addBlankPage(doc, index, size) {
  if (doc.getPageCount() >= MAX_PAGES) return { ok: false, reason: "pages", message: `A document cannot exceed ${MAX_PAGES} pages here.` };
  const total = doc.getPageCount();
  const at = Math.max(0, Math.min(total, Math.round(Number(index))));
  const width = clamp(Number(size && size.width) || DEFAULT_PAGE[0], 72, 14400);
  const height = clamp(Number(size && size.height) || DEFAULT_PAGE[1], 72, 14400);
  try {
    doc.insertPage(at, [round(width, 2), round(height, 2)]);
  } catch (error) {
    return { ok: false, reason: "add", message: `A blank page could not be added: ${pdfError(error)}` };
  }
  return { ok: true, pageCount: doc.getPageCount(), index: at };
}

/** Appends every page of another PDF at `at`, keeping the other file untouched. */
async function insertPdfPages(doc, bytes, at) {
  const loaded = await loadEditorDocument(bytes);
  if (!loaded.ok) return loaded;
  const source = loaded.doc;
  const added = source.getPageCount();
  if (added > MAX_INSERT_PAGES) return { ok: false, reason: "pages", message: `That PDF has more than ${MAX_INSERT_PAGES} pages.` };
  if (doc.getPageCount() + added > MAX_PAGES) return { ok: false, reason: "pages", message: `A document cannot exceed ${MAX_PAGES} pages here.` };
  const total = doc.getPageCount();
  const position = Math.max(0, Math.min(total, Math.round(Number(at))));
  try {
    const copies = await doc.copyPages(source, source.getPageIndices());
    copies.forEach((page, offset) => doc.insertPage(position + offset, page));
  } catch (error) {
    return { ok: false, reason: "insert", message: `Those pages could not be added: ${pdfError(error)}` };
  }
  return { ok: true, added, pageCount: doc.getPageCount(), index: position };
}

/* -------------------------------------------------------------- form fields */

function fieldKind(field) {
  if (field instanceof PDFTextField) return "text";
  if (field instanceof PDFCheckBox) return "checkbox";
  if (field instanceof PDFRadioGroup) return "radio";
  if (field instanceof PDFDropdown) return "dropdown";
  if (field instanceof PDFOptionList) return "optionlist";
  return "other";
}

function fieldPageIndex(doc, field) {
  try {
    const pages = doc.getPages();
    for (const widget of field.acroField.getWidgets()) {
      const ref = widget.P();
      if (!ref) continue;
      const index = pages.findIndex((page) => page.ref === ref);
      if (index >= 0) return index;
    }
  } catch (error) {
    /* a widget without a page reference simply has no page */
  }
  return -1;
}

function fieldValue(field) {
  const kind = fieldKind(field);
  try {
    if (kind === "text") return str(field.getText());
    if (kind === "checkbox") return Boolean(field.isChecked());
    if (kind === "radio") return str(field.getSelected());
    if (kind === "dropdown") return str((field.getSelected() || [])[0]);
    if (kind === "optionlist") return (field.getSelected() || []).join(", ");
  } catch (error) {
    return "";
  }
  return "";
}

function fieldOptions(field) {
  try {
    return (field.getOptions ? field.getOptions() : []).map((option) => str(option));
  } catch (error) {
    return [];
  }
}

/**
 * Every fillable field, in document order, capped. Unsupported field types are
 * reported as `other` and never edited, so nothing is guessed.
 */
function formFields(doc) {
  let fields;
  try {
    fields = doc.getForm().getFields();
  } catch (error) {
    return { ok: true, fields: [], total: 0, message: "This PDF has no form fields." };
  }
  const rows = [];
  for (const field of fields) {
    if (rows.length >= MAX_FORM_FIELDS) break;
    const kind = fieldKind(field);
    rows.push({
      name: str(field.getName()),
      kind,
      value: fieldValue(field),
      options: kind === "dropdown" || kind === "optionlist" || kind === "radio" ? fieldOptions(field) : [],
      readOnly: (() => {
        try {
          return Boolean(field.isReadOnly());
        } catch (error) {
          return false;
        }
      })(),
      page: fieldPageIndex(doc, field),
    });
  }
  return { ok: true, fields: rows, total: fields.length };
}

function findField(doc, name) {
  try {
    return doc.getForm().getField(str(name)) || null;
  } catch (error) {
    return null;
  }
}

function truthy(value) {
  const text = str(value).trim().toLowerCase();
  return value === true || text === "true" || text === "on" || text === "yes" || text === "1" || text === "checked";
}

/** Writes one field value; every refusal names the field and the reason. */
function setFieldValue(doc, name, value) {
  const field = findField(doc, name);
  if (!field) return { ok: false, reason: "missing", message: `There is no form field named “${str(name)}”.` };
  try {
    if (field.isReadOnly()) return { ok: false, reason: "readonly", message: `“${str(name)}” is read-only in this PDF.` };
  } catch (error) {
    /* a field without a read-only flag stays editable */
  }
  const kind = fieldKind(field);
  try {
    if (kind === "text") {
      const raw = winAnsiText(value).slice(0, MAX_FIELD_TEXT);
      let multiline = false;
      try {
        multiline = Boolean(field.isMultiline());
      } catch (error) {
        multiline = false;
      }
      field.setText(multiline ? raw : raw.replace(/[\r\n]+/g, " "));
    } else if (kind === "checkbox") {
      if (truthy(value)) field.check();
      else field.uncheck();
    } else if (kind === "radio" || kind === "dropdown") {
      const option = str(value);
      if (!option) return { ok: false, reason: "value", message: `Choose a value for “${str(name)}”.` };
      const allowed = fieldOptions(field);
      if (allowed.length && !allowed.includes(option)) {
        return { ok: false, reason: "option", message: `“${option}” is not one of the choices for “${str(name)}”.` };
      }
      field.select(option);
    } else if (kind === "optionlist") {
      const list = (Array.isArray(value) ? value : str(value).split(",")).map((item) => str(item).trim()).filter(Boolean);
      if (!list.length) return { ok: false, reason: "value", message: `Choose a value for “${str(name)}”.` };
      const allowed = fieldOptions(field);
      const unknown = allowed.length ? list.filter((item) => !allowed.includes(item)) : [];
      if (unknown.length) return { ok: false, reason: "option", message: `“${unknown[0]}” is not one of the choices for “${str(name)}”.` };
      field.select(list);
    } else {
      return { ok: false, reason: "unsupported", message: `“${str(name)}” is a field type this editor cannot fill.` };
    }
  } catch (error) {
    return { ok: false, reason: "field", message: `“${str(name)}” could not be saved: ${pdfError(error)}` };
  }
  return { ok: true, name: str(name), value: fieldValue(field) };
}

/* ------------------------------------------------------------ new fields */

/** A field name derived from the label: letters, digits, dashes and underscores. */
function fieldNameBase(label) {
  const base = str(label)
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, MAX_FIELD_NAME);
  return base || "new_field";
}

/** `name`, then `name_2`, `name_3` … so an existing field is never reused. */
function uniqueFieldName(taken, base) {
  const used = new Set(taken.map((item) => str(item).toLowerCase()));
  if (!used.has(base.toLowerCase())) return base;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}_${n}`;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
  return `${base}_${Date.now()}`;
}

/** Trimmed, unique, bounded choices; duplicated choices are refused, not merged. */
function fieldOptionList(value) {
  const raw = (Array.isArray(value) ? value : str(value).split(","))
    .map((item) => winAnsiText(str(item)).trim())
    .filter(Boolean);
  const seen = new Set();
  const options = [];
  const duplicates = [];
  for (const option of raw) {
    const key = option.toLowerCase();
    if (seen.has(key)) {
      duplicates.push(option);
      continue;
    }
    seen.add(key);
    options.push(option);
  }
  return { options: options.slice(0, MAX_FIELD_OPTIONS), duplicates, total: options.length };
}

/**
 * Adds one fillable AcroForm field to the working copy: a text field, a checkbox,
 * a dropdown or a radio group. Appearance streams are generated on save, the form
 * is never flattened, and existing field values are left alone. Every request that
 * cannot become a usable field is refused with a message instead of a broken field:
 * an unknown type, no label or name, a missing page, a box outside the page or
 * smaller than `MIN_FIELD_SIZE`, an empty or duplicated option list, a choice that
 * is not in the list, and an explicitly requested name that already exists. A name
 * derived from the label is suffixed instead, so nothing is silently overwritten.
 */
async function addFormField(doc, input) {
  const options = input && typeof input === "object" ? input : {};
  const type = str(options.type).trim().toLowerCase();
  if (!FORM_FIELD_TYPES.includes(type)) {
    return { ok: false, reason: "type", message: "A new field must be a text field, a checkbox, a dropdown or a radio group." };
  }
  const label = winAnsiText(str(options.label)).trim().slice(0, MAX_FIELD_LABEL);
  const explicit = winAnsiText(str(options.name)).trim().slice(0, MAX_FIELD_NAME);
  if (!label && !explicit) return { ok: false, reason: "name", message: "A new field needs a label or a name." };

  const pages = doc.getPages();
  const index = Math.round(Number(options.page));
  if (!Number.isFinite(index) || index < 0 || index >= pages.length) {
    return { ok: false, reason: "page", message: `Page ${str(options.page)} does not exist in this PDF.` };
  }
  const page = pages[index];
  const visible = page.getCropBox();
  const x = Number(options.x);
  const y = Number(options.y);
  const width = Number(options.width);
  const height = Number(options.height);
  if (![x, y, width, height].every(Number.isFinite)) {
    return { ok: false, reason: "rect", message: "A new field needs a position and a size in points." };
  }
  if (width < MIN_FIELD_SIZE || height < MIN_FIELD_SIZE) {
    return { ok: false, reason: "size", message: `A new field must be at least ${MIN_FIELD_SIZE} by ${MIN_FIELD_SIZE} points.` };
  }
  if (x < visible.x || y < visible.y || x + width > visible.x + visible.width || y + height > visible.y + visible.height) {
    return {
      ok: false,
      reason: "rect",
      message: `A ${round(width, 1)} by ${round(height, 1)} field at ${round(x, 1)}, ${round(y, 1)} does not fit on page ${index + 1}, whose visible area is ${round(visible.width, 1)} by ${round(visible.height, 1)} points starting at ${round(visible.x, 1)}, ${round(visible.y, 1)}.`,
    };
  }

  let taken = [];
  try {
    taken = doc.getForm().getFields().map((field) => str(field.getName()));
  } catch (error) {
    taken = [];
  }
  let name = "";
  if (explicit) {
    if (taken.some((item) => item.toLowerCase() === explicit.toLowerCase())) {
      return { ok: false, reason: "duplicate", message: `This PDF already has a field named “${explicit}”. Choose another name.` };
    }
    name = explicit;
  } else {
    name = uniqueFieldName(taken, fieldNameBase(label));
  }

  let choices = [];
  if (type === "dropdown" || type === "radio") {
    const parsed = fieldOptionList(options.options);
    if (!parsed.total) return { ok: false, reason: "options", message: "A dropdown or radio group needs at least one choice." };
    if (parsed.duplicates.length) {
      return { ok: false, reason: "options", message: `“${parsed.duplicates[0]}” is listed twice. Every choice must be different.` };
    }
    if (parsed.total > MAX_FIELD_OPTIONS) {
      return { ok: false, reason: "options", message: `A field can hold at most ${MAX_FIELD_OPTIONS} choices.` };
    }
    choices = parsed.options;
  }
  const chosen = str(options.select).trim();
  if (chosen && (type === "dropdown" || type === "radio") && !choices.includes(chosen)) {
    return { ok: false, reason: "option", message: `“${chosen}” is not one of the choices for this field.` };
  }

  const rect = { x, y, width, height };
  const radioRowHeight = type === "radio" ? height / choices.length : 0;
  if (type === "radio" && radioRowHeight < MIN_FIELD_SIZE) {
    return {
      ok: false,
      reason: "size",
      message: `${choices.length} choices need a box at least ${choices.length * MIN_FIELD_SIZE} points tall, so each ring stays usable.`,
    };
  }
  let stored = rect;
  let storedAll = [];
  try {
    const form = doc.getForm();
    let field;
    if (type === "text") {
      field = form.createTextField(name);
      field.addToPage(page, rect);
      const text = winAnsiText(str(options.value)).slice(0, MAX_FIELD_TEXT);
      if (text) field.setText(text);
    } else if (type === "checkbox") {
      field = form.createCheckBox(name);
      field.addToPage(page, rect);
      if (truthy(options.checked)) field.check();
    } else if (type === "dropdown") {
      field = form.createDropdown(name);
      field.addOptions(choices);
      field.addToPage(page, rect);
      if (chosen) field.select(chosen);
    } else {
      /* A radio group takes its choices from its widgets: one ring per option. */
      field = form.createRadioGroup(name);
      choices.forEach((option, row) => {
        field.addOptionToPage(option, page, {
          x: rect.x,
          y: rect.y + rect.height - (row + 1) * radioRowHeight + 1,
          width: rect.width,
          height: Math.max(MIN_FIELD_SIZE - 2, radioRowHeight - 2),
        });
      });
      if (chosen) field.select(chosen);
    }
    const widgets = field.acroField.getWidgets();
    if (widgets.length) {
      storedAll = widgets.map((widget) => widget.getRectangle());
      stored = storedAll[0];
    }
    const edge = page.getCropBox();
    const oversized = storedAll.some(
      (box) =>
        box.x < edge.x - 0.01 ||
        box.y < edge.y - 0.01 ||
        box.x + box.width > edge.x + edge.width + 0.01 ||
        box.y + box.height > edge.y + edge.height + 0.01,
    );
    if (oversized) {
      if (typeof form.removeField === "function") form.removeField(field);
      return {
        ok: false,
        reason: "rect",
        message: "That box leaves no room for the field's one-point border inside the visible page. Leave a point of margin on every side.",
      };
    }
    try {
      const font = await doc.embedFont(StandardFonts.Helvetica);
      form.updateFieldAppearances(font);
    } catch (error) {
      /* the save path rebuilds the appearances again */
    }
  } catch (error) {
    return { ok: false, reason: "field", message: `The form field could not be added: ${pdfError(error)}` };
  }

  return {
    ok: true,
    name,
    requested: explicit,
    type,
    page: index,
    box: rect,
    rect: stored,
    rects: storedAll,
    options: choices,
    value: type === "text" ? winAnsiText(str(options.value)).slice(0, MAX_FIELD_TEXT) : chosen,
    checked: type === "checkbox" ? truthy(options.checked) : false,
    fields: formFields(doc).total,
  };
}

/** Bakes the current field values into the page content and drops the fields. */
async function flattenForm(doc) {
  let form;
  try {
    form = doc.getForm();
  } catch (error) {
    return { ok: false, reason: "form", message: "This PDF has no form fields to flatten." };
  }
  const unsupported = form.getFields().filter((field) => fieldKind(field) === "other");
  if (unsupported.length) return { ok: false, reason: "unsupported", message: "This form has signature or button fields, which cannot be flattened safely." };
  try {
    const font = await doc.embedFont(StandardFonts.Helvetica);
    form.updateFieldAppearances(font);
  } catch (error) {
    /* an appearance that cannot be rebuilt keeps the field's stored appearance */
  }
  /*
   * `form.flatten()` bakes the appearances and drops the fields, but leaves each
   * widget annotation on its page with its /Parent gone. Collect the widget
   * references first, flatten, then take exactly those entries out of /Annots so a
   * flattened copy carries no dead annotation a viewer could draw twice.
   */
  const widgetRefs = new Set();
  const remember = (value) => {
    if (value !== undefined && value !== null) widgetRefs.add(String(value));
  };
  try {
    for (const field of form.getFields()) {
      remember(field.ref);
      for (const widget of field.acroField.getWidgets()) remember(widget.ref);
      const kids = field.acroField.Kids ? field.acroField.Kids() : null;
      if (kids && typeof kids.size === "function") {
        for (let index = 0; index < kids.size(); index++) remember(kids.get(index));
      }
    }
  } catch (error) {
    /* a form without widgets needs no cleanup */
  }
  try {
    form.flatten();
  } catch (error) {
    return { ok: false, reason: "flatten", message: `The form could not be flattened: ${pdfError(error)}` };
  }
  try {
    for (const page of doc.getPages()) {
      const annots = page.node.Annots();
      if (!annots) continue;
      for (let index = annots.size() - 1; index >= 0; index--) {
        const entry = annots.get(index);
        const isRef = entry && typeof entry.objectNumber === "number";
        if (!isRef) continue;
        /* the field's widget, or a reference flattening left dangling */
        if (widgetRefs.has(String(entry)) || !doc.context.lookup(entry)) annots.remove(index);
      }
    }
  } catch (error) {
    /* a page without an annotation array needs no cleanup */
  }
  return { ok: true, fields: 0 };
}

/* ------------------------------------------------------------- annotations */

function colorFor(value, fallback) {
  const key = str(value);
  const hex = INK_COLOR_HEX[key] || (/^#[0-9a-f]{6}$/i.test(key) ? key : "");
  return hexToRgb(hex || INK_COLOR_HEX[fallback] || INK_COLOR_HEX.yellow);
}

function colorForArea(area, annotation) {
  return colorFor((area && area.color) || (annotation && annotation.color) || "yellow", "yellow");
}

function drawMark(page, area, style, width, height, rotation, annotation) {
  const rect = displayRect(area, width, height, rotation);
  const color = colorForArea(area, annotation);
  if (rect.width < 0.3 || rect.height < 0.3) return false;
  try {
    if (style === "highlight") {
      page.drawRectangle({ ...rect, color, opacity: 0.3, borderColor: color, borderWidth: 0.6, borderOpacity: 0.9 });
    } else if (style === "box") {
      page.drawRectangle({ ...rect, borderColor: color, borderWidth: Math.max(1, rect.height * 0.06), borderOpacity: 1 });
    } else {
      const thickness = Math.max(0.8, rect.height * (style === "strike" ? 0.08 : 0.1));
      const y = style === "strike" ? rect.y + rect.height / 2 : rect.y + thickness / 2;
      page.drawLine({ start: { x: rect.x, y }, end: { x: rect.x + rect.width, y }, thickness, color, opacity: 0.95 });
    }
  } catch (error) {
    return false;
  }
  return true;
}

function drawInk(page, strokes, width, height, rotation) {
  let drawn = 0;
  for (const stroke of strokes) {
    const color = hexToRgb(INK_COLOR_HEX[stroke.color] || INK_COLOR_HEX.blue);
    const thickness = Math.max(0.5, (Number(stroke.width) || 0.003) * (rotation === 90 || rotation === 270 ? height : width));
    const points = stroke.points.map((point) => displayPoint(point, width, height, rotation));
    if (!points.length) continue;
    try {
      if (points.length === 1) {
        page.drawCircle({ x: points[0].x, y: points[0].y, size: thickness, color, opacity: stroke.opacity });
        drawn += 1;
        continue;
      }
      for (let i = 1; i < points.length; i++) {
        page.drawLine({ start: points[i - 1], end: points[i], thickness, color, opacity: stroke.opacity });
        drawn += 1;
      }
    } catch (error) {
      return drawn;
    }
  }
  return drawn;
}

function drawTextBox(page, box, font, width, height, rotation) {
  const size = rotation === 90 || rotation === 270 ? (Number(box.size) || 0.016) * width : (Number(box.size) || 0.016) * height;
  const fontSize = clamp(size, 4, 72);
  const display = displaySize(width, height, rotation);
  const maxWidth = Math.max(8, (Number(box.width) || 0.36) * display.width - 4);
  const lines = wrapLines(box.text, font, fontSize, maxWidth);
  if (!lines.length) return 0;
  const corner = displayPoint([Number(box.x) || 0, Number(box.y) || 0], width, height, rotation);
  const axes = textAxes(rotation);
  const lead = fontSize * 1.2;
  const color = colorFor(box.color, "blue");
  let drawn = 0;
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i]) continue;
    const offset = fontSize + i * lead;
    try {
      page.drawText(lines[i], {
        x: corner.x + axes.down.x * offset,
        y: corner.y + axes.down.y * offset,
        size: fontSize,
        font,
        color,
        rotate: degrees(rotation),
      });
      drawn += 1;
    } catch (error) {
      return drawn;
    }
  }
  return drawn;
}

/**
 * Draws the sidecar's annotations into the page content, so a copy keeps its
 * marks in any viewer. `options.pageMap` is the document's page index to the
 * original 1-based page number, so deleted or moved pages still line up.
 */
async function flattenAnnotations(doc, annotations, options) {
  const opts = options && typeof options === "object" ? options : {};
  const pageMap = Array.isArray(opts.pageMap) ? opts.pageMap : null;
  const list = Array.isArray(annotations) ? annotations.filter(Boolean) : [];
  if (!list.length) return { ok: true, drawn: 0, skipped: 0, pages: 0 };
  let font;
  try {
    font = await doc.embedFont(StandardFonts.Helvetica);
  } catch (error) {
    return { ok: false, reason: "font", message: `Annotation text needs a font that could not be embedded: ${pdfError(error)}` };
  }
  const total = doc.getPageCount();
  const targetsFor = (page) => {
    const out = [];
    for (let index = 0; index < total; index++) {
      const original = pageMap ? pageMap[index] : index + 1;
      if (original === page) out.push(index);
    }
    return out;
  };
  let drawn = 0;
  let skipped = 0;
  const touched = new Set();
  for (const annotation of list) {
    const page = Math.round(Number(annotation.page) || 0);
    if (page < 1) {
      skipped += 1;
      continue;
    }
    const targets = targetsFor(page);
    if (!targets.length) {
      skipped += 1;
      continue;
    }
    const areas = normalizeHighlightAreas(annotation.areas);
    const strokes = normalizeInkStrokes(annotation.strokes);
    const boxes = normalizeTextBoxes(annotation.boxes);
    for (const index of targets) {
      const target = doc.getPage(index);
      const size = target.getSize();
      const rotation = normalizedRotation(target.getRotation().angle);
      touched.add(index);
      for (const area of areas) {
        if (drawn >= MAX_FLATTEN_ITEMS) break;
        const style = MARK_STYLES.includes(area.style) ? area.style : MARK_STYLES.includes(annotation.type) ? annotation.type : "highlight";
        if (drawMark(target, area, style, size.width, size.height, rotation, annotation)) drawn += 1;
        else skipped += 1;
      }
      if (strokes.length) {
        const count = drawInk(target, strokes, size.width, size.height, rotation);
        drawn += count;
        if (!count) skipped += 1;
      }
      for (const box of boxes) {
        const count = drawTextBox(target, box, font, size.width, size.height, rotation);
        drawn += count;
        if (!count) skipped += 1;
      }
    }
  }
  return { ok: true, drawn, skipped, pages: touched.size };
}

/* ------------------------------------------------------------ page content */

/**
 * Which page indexes an operation touches: `"all"`, one index, or a list.
 * Out-of-range and duplicate indexes are dropped, and an empty result refuses.
 */
function resolvePages(doc, options) {
  const total = doc.getPageCount();
  const raw = options && options.pages !== undefined ? options.pages : options && options.page;
  let list;
  if (raw === undefined || raw === null || raw === "" || raw === "all") list = Array.from({ length: total }, (_, index) => index);
  else if (Array.isArray(raw)) list = raw.map((value) => Math.round(Number(value)));
  else list = [Math.round(Number(raw))];
  const unique = [...new Set(list)].filter((value) => Number.isFinite(value) && value >= 0 && value < total).sort((a, b) => a - b);
  if (!unique.length) return { ok: false, reason: "index", message: `Page ${str(raw) || "?"} is not in this PDF.` };
  return { ok: true, pages: unique };
}

/** Top-left corner of a block inside the displayed page, in points. */
function anchorFor(position, blockWidth, blockHeight, displayWidth, displayHeight, margin) {
  const [vertical, horizontal] = str(position || "top-left").split("-");
  const pad = Math.max(18, Number(margin) || 18);
  const x = horizontal === "center" ? (displayWidth - blockWidth) / 2 : horizontal === "right" ? displayWidth - blockWidth - pad : pad;
  const y = vertical === "center" ? (displayHeight - blockHeight) / 2 : vertical === "bottom" ? displayHeight - blockHeight - pad : pad;
  return {
    x: Math.max(0, Math.min(Math.max(0, displayWidth - blockWidth), x)),
    y: Math.max(0, Math.min(Math.max(0, displayHeight - blockHeight), y)),
  };
}

/** Draws one wrapped text block at a normalized top-left anchor. */
function drawTextBlock(page, text, options) {
  const size = page.getSize();
  const rotation = normalizedRotation(page.getRotation().angle);
  const display = displaySize(size.width, size.height, rotation);
  const box = {
    text,
    x: clamp(Number(options.x) || 0, 0, 0.99),
    y: clamp(Number(options.y) || 0, 0, 0.99),
    width: clamp(Number(options.width) || 0.84, 0.05, 1),
    size: clamp(Number(options.size) || 12, MIN_CONTENT_SIZE, MAX_CONTENT_SIZE) / display.height,
    color: options.color,
  };
  return { drawn: drawTextBox(page, box, options.font, size.width, size.height, rotation), width: display.width, height: display.height };
}

/** Typed text on one page or every page, written into the page content. */
async function addText(doc, options) {
  const opts = options && typeof options === "object" ? options : {};
  const text = winAnsiText(opts.text).replace(/\r\n?/g, "\n").trim().slice(0, MAX_CONTENT_TEXT);
  if (!text) return { ok: false, reason: "empty", message: "Type the text to add first." };
  const targets = resolvePages(doc, opts);
  if (!targets.ok) return targets;
  let font;
  try {
    font = await doc.embedFont(TEXT_FONTS[str(opts.font)] || StandardFonts.Helvetica);
  } catch (error) {
    return { ok: false, reason: "font", message: `That font could not be embedded: ${pdfError(error)}` };
  }
  const size = clamp(Number(opts.size) || 12, MIN_CONTENT_SIZE, MAX_CONTENT_SIZE);
  const position = TEXT_POSITIONS.includes(str(opts.position)) ? str(opts.position) : "top-left";
  const width = clamp(Number(opts.width) || 0.84, 0.1, 1);
  let drawn = 0;
  for (const index of targets.pages) {
    const page = doc.getPage(index);
    const pageSize = page.getSize();
    const rotation = normalizedRotation(page.getRotation().angle);
    const display = displaySize(pageSize.width, pageSize.height, rotation);
    const lines = wrapLines(text, font, size, display.width * width - 4);
    const widest = Math.max(...lines.map((line) => font.widthOfTextAtSize(line, size)), 1);
    const anchor = anchorFor(position, Math.min(widest, display.width * width), size, display.width, display.height, size);
    const result = drawTextBlock(page, text, {
      x: anchor.x / display.width,
      y: anchor.y / display.height,
      width,
      size,
      color: opts.color || "blue",
      font,
    });
    drawn += result.drawn;
  }
  return { ok: true, drawn, pages: targets.pages.length };
}

/** `{n}` / `{total}` page numbers, usually in a footer. */
async function addPageNumbers(doc, options) {
  const opts = options && typeof options === "object" ? options : {};
  const format = str(opts.format).trim() || "{n}";
  const targets = resolvePages(doc, { pages: opts.pages === undefined ? "all" : opts.pages });
  if (!targets.ok) return targets;
  let font;
  try {
    font = await doc.embedFont(StandardFonts.Helvetica);
  } catch (error) {
    return { ok: false, reason: "font", message: `Page numbers need a font that could not be embedded: ${pdfError(error)}` };
  }
  const total = doc.getPageCount();
  const start = Math.round(Number(opts.start) || 1);
  const size = clamp(Number(opts.size) || 9, MIN_CONTENT_SIZE, MAX_CONTENT_SIZE);
  const position = TEXT_POSITIONS.includes(str(opts.position)) ? str(opts.position) : "bottom-center";
  let drawn = 0;
  targets.pages.forEach((index, order) => {
    const text = winAnsiText(format)
      .replace(/\{n\}/g, String(start + order))
      .replace(/\{total\}/g, String(total));
    if (!text) return;
    const page = doc.getPage(index);
    const pageSize = page.getSize();
    const rotation = normalizedRotation(page.getRotation().angle);
    const display = displaySize(pageSize.width, pageSize.height, rotation);
    const widest = font.widthOfTextAtSize(text, size);
    const anchor = anchorFor(position, widest, size, display.width, display.height, size * 2);
    drawn += drawTextBlock(page, text, {
      x: anchor.x / display.width,
      y: anchor.y / display.height,
      width: 0.9,
      size,
      color: opts.color || "gray",
      font,
    }).drawn;
  });
  return { ok: true, drawn, pages: targets.pages.length };
}

/**
 * Trims the visible area with the crop box, leaving the page itself intact.
 * The margins are PDF points measured from the media box.
 */
function cropPages(doc, margins, options) {
  const source = margins && typeof margins === "object" ? margins : {};
  const left = clamp(Number(source.left) || 0, 0, 5000);
  const right = clamp(Number(source.right) || 0, 0, 5000);
  const top = clamp(Number(source.top) || 0, 0, 5000);
  const bottom = clamp(Number(source.bottom) || 0, 0, 5000);
  if (!left && !right && !top && !bottom) {
    return { ok: false, reason: "empty", message: "Enter at least one crop margin." };
  }
  const targets = resolvePages(doc, options);
  if (!targets.ok) return targets;
  for (const index of targets.pages) {
    const box = doc.getPage(index).getMediaBox();
    const width = box.width - left - right;
    const height = box.height - top - bottom;
    if (!(width >= MIN_CROP_POINTS) || !(height >= MIN_CROP_POINTS)) {
      return { ok: false, reason: "size", message: `A crop has to leave at least ${MIN_CROP_POINTS} by ${MIN_CROP_POINTS} points of page.` };
    }
  }
  let cropped = 0;
  for (const index of targets.pages) {
    const page = doc.getPage(index);
    const box = page.getMediaBox();
    try {
      page.setCropBox(box.x + left, box.y + bottom, box.width - left - right, box.height - top - bottom);
      cropped += 1;
    } catch (error) {
      return { ok: false, reason: "crop", message: `That page could not be cropped: ${pdfError(error)}` };
    }
  }
  return { ok: true, pages: cropped };
}

/** Places a PNG or JPEG on pages that are not rotated. */
async function addImage(doc, options) {
  const opts = options && typeof options === "object" ? options : {};
  const data = toBytes(opts.bytes);
  if (!data || !data.length) return { ok: false, reason: "empty", message: "Choose an image first." };
  if (data.length > MAX_IMAGE_BYTES) return { ok: false, reason: "size", message: "That image is larger than 20 MB." };
  const targets = resolvePages(doc, opts);
  if (!targets.ok) return targets;
  for (const index of targets.pages) {
    if (normalizedRotation(doc.getPage(index).getRotation().angle)) {
      return { ok: false, reason: "rotation", message: "Images cannot be placed on a rotated page. Rotate it back first." };
    }
  }
  let image;
  try {
    if (data[0] === 0x89 && data[1] === 0x50) image = await doc.embedPng(data);
    else if (data[0] === 0xff && data[1] === 0xd8) image = await doc.embedJpg(data);
    else return { ok: false, reason: "format", message: "Use a PNG or a JPEG image." };
  } catch (error) {
    return { ok: false, reason: "image", message: `That image could not be read: ${pdfError(error)}` };
  }
  const widthFraction = clamp(Number(opts.width) || 0.4, 0.02, 1);
  const position = TEXT_POSITIONS.includes(str(opts.position)) ? str(opts.position) : "top-left";
  const opacity = clamp(Number(opts.opacity) || 1, 0.05, 1);
  let drawn = 0;
  for (const index of targets.pages) {
    const page = doc.getPage(index);
    const size = page.getSize();
    const width = size.width * widthFraction;
    const height = Number(opts.height) > 0 ? size.height * clamp(Number(opts.height), 0.02, 1) : width * (image.height / image.width);
    const anchor = anchorFor(position, width, height, size.width, size.height, 24);
    const y = Math.max(0, Math.min(size.height - height, size.height - anchor.y - height));
    try {
      page.drawImage(image, { x: anchor.x, y, width, height, opacity });
      drawn += 1;
    } catch (error) {
      return { ok: false, reason: "image", message: `That image could not be placed: ${pdfError(error)}` };
    }
  }
  return { ok: true, drawn, pages: targets.pages.length };
}

/** Title, author, subject and keywords, written into the copy's info dictionary. */
function setDocumentProperties(doc, props) {
  const source = props && typeof props === "object" ? props : {};
  if (!["title", "author", "subject", "keywords"].some((key) => source[key] !== undefined)) {
    return { ok: false, reason: "empty", message: "There is nothing to change in the document properties." };
  }
  const text = (value) => winAnsiText(value).replace(/\s+/g, " ").trim().slice(0, MAX_PROPERTY_TEXT);
  const keywords = (Array.isArray(source.keywords) ? source.keywords : str(source.keywords).split(","))
    .map(text)
    .filter(Boolean)
    .slice(0, MAX_KEYWORDS);
  try {
    doc.setTitle(text(source.title));
    doc.setAuthor(text(source.author));
    doc.setSubject(text(source.subject));
    doc.setKeywords(keywords);
  } catch (error) {
    return { ok: false, reason: "properties", message: `The document properties could not be written: ${pdfError(error)}` };
  }
  return { ok: true, title: text(source.title), author: text(source.author), subject: text(source.subject), keywords };
}

/** The axis-aligned bounds of text drawn at an angle, and where its origin sits. */
function rotatedBounds(width, height, angle) {
  const radians = (angle * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const xs = [0, width * cos, -height * sin, width * cos - height * sin];
  const ys = [0, width * sin, height * cos, width * sin + height * cos];
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { width: Math.max(maxX - minX, 1), height: Math.max(maxY - minY, 1), offsetX: -minX, offsetY: -minY };
}

/**
 * One line of faint text across the page, fitted so it never runs off it.
 * Rotated pages are refused: the angle is measured against the page, not the view.
 */
async function addWatermark(doc, options) {
  const opts = options && typeof options === "object" ? options : {};
  const text = winAnsiText(opts.text).replace(/\s+/g, " ").trim().slice(0, MAX_WATERMARK_TEXT);
  if (!text) return { ok: false, reason: "empty", message: "Type the watermark text first." };
  const targets = resolvePages(doc, opts);
  if (!targets.ok) return targets;
  for (const index of targets.pages) {
    if (normalizedRotation(doc.getPage(index).getRotation().angle)) {
      return { ok: false, reason: "rotation", message: "A watermark needs an unrotated page. Rotate it back first." };
    }
  }
  let font;
  try {
    font = await doc.embedFont(TEXT_FONTS[str(opts.font)] || StandardFonts.Helvetica);
  } catch (error) {
    return { ok: false, reason: "font", message: `That font could not be embedded: ${pdfError(error)}` };
  }
  const angle = WATERMARK_ANGLES.includes(Math.round(Number(opts.angle))) ? Math.round(Number(opts.angle)) : 45;
  const opacity = clamp(Number(opts.opacity) || 0.15, 0.02, 1);
  const color = colorFor(opts.color || "#808080", "gray");
  const position = TEXT_POSITIONS.includes(str(opts.position)) ? str(opts.position) : "middle-center";
  const limit = clamp(Number(opts.width) || 0.9, 0.1, 1);
  let drawn = 0;
  let smallest = Number(opts.size) || 60;
  for (const index of targets.pages) {
    const page = doc.getPage(index);
    const box = page.getSize();
    let size = clamp(Number(opts.size) || 60, 6, 200);
    const room = box.width * limit;
    const measured = font.widthOfTextAtSize(text, size);
    if (measured > room) size = Math.max(6, (size * room) / measured);
    smallest = Math.min(smallest, size);
    const bounds = rotatedBounds(font.widthOfTextAtSize(text, size), font.heightAtSize(size), angle);
    const anchor = anchorFor(position, bounds.width, bounds.height, box.width, box.height, 24);
    try {
      page.drawText(text, {
        x: anchor.x + bounds.offsetX,
        y: box.height - anchor.y - bounds.height + bounds.offsetY,
        size,
        font,
        color,
        opacity,
        rotate: degrees(angle),
      });
      drawn += 1;
    } catch (error) {
      return { ok: false, reason: "watermark", message: `The watermark could not be drawn: ${pdfError(error)}` };
    }
  }
  return { ok: true, drawn, pages: targets.pages.length, size: round(smallest, 2) };
}

/** Every `every` pages into its own PDF, so one long document becomes parts. */
async function splitPdf(doc, every) {
  const total = doc.getPageCount();
  const size = Math.round(Number(every));
  if (!Number.isFinite(size) || size < 1) return { ok: false, reason: "size", message: "Split needs a whole number of pages per file." };
  if (total < 2) return { ok: false, reason: "pages", message: "A single-page PDF cannot be split." };
  if (Math.ceil(total / size) > MAX_SPLIT_PARTS) {
    return { ok: false, reason: "parts", message: `That would write more than ${MAX_SPLIT_PARTS} files. Use more pages per file.` };
  }
  /*
   * A page copy carries a field's widget but not the AcroForm, so the parts
   * would open with no fields and the filled values would be gone. Flatten a
   * serialised copy first and split that: the values stay on the page and the
   * document being edited keeps its live form.
   */
  let source = doc;
  let flattened = false;
  let fieldCount = 0;
  try {
    fieldCount = doc.getForm().getFields().length;
  } catch (error) {
    fieldCount = 0;
  }
  if (fieldCount) {
    try {
      const serialized = await doc.save({ useObjectStreams: true, addDefaultPage: false });
      const copy = await PDFDocument.load(serialized);
      const baked = await flattenForm(copy);
      if (!baked.ok) {
        return { ok: false, reason: "form", message: `The form could not be flattened for the split: ${baked.message}` };
      }
      source = copy;
      flattened = true;
    } catch (error) {
      return { ok: false, reason: "form", message: `The form could not be prepared for the split: ${pdfError(error)}` };
    }
  }
  const parts = [];
  for (let start = 0; start < total; start += size) {
    const indexes = [];
    for (let index = start; index < Math.min(start + size, total); index++) indexes.push(index);
    const part = await extractPdfPages(source, indexes);
    if (!part.ok) return part;
    parts.push({ bytes: part.bytes, indexes, pages: indexes.length });
  }
  return { ok: true, parts, files: parts.length, pages: total, flattened };
}

/* ----------------------------------------------------------------- writing */

async function savePdf(doc) {
  try {
    const bytes = await doc.save({ useObjectStreams: true, addDefaultPage: false });
    return { ok: true, bytes };
  } catch (error) {
    return { ok: false, reason: "save", message: `The edited PDF could not be written: ${pdfError(error)}` };
  }
}

/** `report (edited).pdf`, then `report (edited 2).pdf`, never an existing path. */
function editedPathFor(originalPath, exists, label) {
  const clean = str(originalPath).replace(/\\/g, "/").replace(/^\/+/, "").trim();
  const folder = clean.replace(/[^/]*$/, "");
  const base = clean.replace(/^.*\//, "").replace(/\.pdf$/i, "").replace(/[\\/:*?"<>|]/g, "").trim() || "document";
  const tag = str(label).replace(/[\\/:*?"<>|()]/g, "").trim() || "edited";
  const taken = typeof exists === "function" ? exists : () => false;
  let path = `${folder}${base} (${tag}).pdf`;
  for (let n = 2; taken(path) && n < 100; n++) path = `${folder}${base} (${tag} ${n}).pdf`;
  return path;
}

/** A new PDF holding only the selected pages, in the order given. */
async function extractPdfPages(doc, indexes) {
  const total = doc.getPageCount();
  const picked = (Array.isArray(indexes) ? indexes : [])
    .map((value) => Math.round(Number(value)))
    .filter((value) => Number.isFinite(value) && value >= 0 && value < total);
  const unique = [...new Set(picked)].sort((a, b) => a - b);
  if (!unique.length) return { ok: false, reason: "empty", message: "Select at least one page to extract." };
  try {
    const out = await PDFDocument.create();
    const copies = await out.copyPages(doc, unique);
    copies.forEach((page) => out.addPage(page));
    const bytes = await out.save({ useObjectStreams: true, addDefaultPage: false });
    return { ok: true, bytes, pages: unique.length, indexes: unique };
  } catch (error) {
    return { ok: false, reason: "extract", message: `Those pages could not be extracted: ${pdfError(error)}` };
  }
}

module.exports = {
  DEFAULT_PAGE,
  MAX_BYTES,
  FORM_FIELD_TYPES,
  MAX_FIELD_LABEL,
  MAX_FIELD_NAME,
  MAX_FIELD_OPTIONS,
  MAX_FORM_FIELDS,
  MAX_PAGES,
  ROTATIONS,
  TEXT_POSITIONS,
  TEXT_FONTS,
  WATERMARK_ANGLES,
  addBlankPage,
  addFormField,
  addImage,
  addPageNumbers,
  addText,
  addWatermark,
  cropPages,
  deletePage,
  displayPoint,
  displayRect,
  duplicatePage,
  anchorFor,
  editedPathFor,
  extractPdfPages,
  flattenAnnotations,
  flattenForm,
  formFields,
  insertPdfPages,
  loadEditorDocument,
  movePage,
  pageList,
  pdfError,
  rotatePage,
  savePdf,
  setDocumentProperties,
  setFieldValue,
  splitPdf,
  textAxes,
  winAnsiText,
};
