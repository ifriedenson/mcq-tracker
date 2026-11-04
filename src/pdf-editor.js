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
const { PDFDocument, PDFName, PDFArray, PDFDict, PDFHexString, PDFNumber, PDFNull, PDFRef, PDFTextField, PDFCheckBox, PDFRadioGroup, PDFDropdown, PDFOptionList, StandardFonts, degrees, rgb } = require("../vendor/pdf-lib.js");
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
const MAX_LINKS = 500;
const MAX_LINK_URL = 2000;
const MIN_LINK_SIZE = 0.002;
const MAX_LINK_BORDER = 24;
const LINK_DASHES = { solid: [], dashed: [6, 4], dotted: [2, 3] };
const LINK_HIGHLIGHTS = { none: "N", invert: "I", outline: "O", push: "P" };
const LINK_BORDERS = { solid: "S", dashed: "D", beveled: "B", inset: "I", underline: "U" };
const MAX_LINK_DASH = 8;
const MAX_LINK_DASH_VALUE = 100;
const MAX_LINK_DASH_PHASE = 1000;
const MAX_OUTLINE = 200;
const MAX_OUTLINE_TITLE = 120;
const MAX_OUTLINE_DEPTH = 3;
const MIN_BOOKMARK_ZOOM = 10;
const MAX_BOOKMARK_ZOOM = 400;
const TEXT_POSITIONS = ["top-left", "top-center", "top-right", "middle-left", "middle-center", "middle-right", "bottom-left", "bottom-center", "bottom-right"];
const SHAPES = ["rectangle", "ellipse", "line"];
const SHAPE_FILLS = ["none", "yellow", "green", "blue", "red", "purple", "gray"];
const MIN_SHAPE_POINTS = 4;
const MAX_SHAPE_POINTS = 2000;
const PAGE_SIZES = [
  { id: "a4", label: "A4", width: 595.28, height: 841.89 },
  { id: "letter", label: "Letter", width: 612, height: 792 },
  { id: "legal", label: "Legal", width: 612, height: 1008 },
];
const MIN_PAGE_POINTS = 36;
const MAX_PAGE_POINTS = 5000;
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

/** Number of AcroForm fields, or 0 when the document has no readable form. */
function formFieldCount(doc) {
  try {
    return doc.getForm().getFields().length;
  } catch (error) {
    return 0;
  }
}

/* -------------------------------------------------------------- page edits */

function rotatePage(doc, index, by) {
  const check = checkIndex(doc, index);
  if (!check.ok) return check;
  const requested = by === undefined || by === null || by === "" ? 90 : Number(by);
  if (!Number.isFinite(requested) || requested % 90 !== 0) {
    return { ok: false, reason: "rotation", message: "A page rotation has to be a multiple of 90 degrees." };
  }
  const page = doc.getPage(check.index);
  const step = requested === 0 ? 90 : requested;
  const next = normalizedRotation(page.getRotation().angle + step);
  try {
    page.setRotation(degrees(next));
  } catch (error) {
    return { ok: false, reason: "rotate", message: `That page could not be rotated: ${pdfError(error)}` };
  }
  return { ok: true, index: check.index, rotation: next };
}

/**
 * pdf-lib keeps the page array in a cache that `removePage` does not clear, so
 * a later read would still show the deleted page. Dropping the cache makes the
 * page tree - which `getPageCount` already follows - the single source of truth.
 */
function forgetPageCache(doc) {
  try {
    const cache = doc && doc.pageCache;
    if (!cache) return;
    if (typeof cache.invalidate === "function") cache.invalidate();
    else if ("value" in cache) cache.value = undefined;
  } catch (error) {
    /* the page tree stays authoritative even if a future pdf-lib renames the cache */
  }
}

function deletePage(doc, index) {
  const check = checkIndex(doc, index);
  if (!check.ok) return check;
  if (doc.getPageCount() <= 1) return { ok: false, reason: "last-page", message: "A PDF needs at least one page. Add a page before deleting this one." };
  try {
    doc.removePage(check.index);
    forgetPageCache(doc);
  } catch (error) {
    return { ok: false, reason: "delete", message: `That page could not be removed: ${pdfError(error)}` };
  }
  return { ok: true, pageCount: doc.getPageCount() };
}

/**
 * Moves one page to a new position in the final order. The page object is
 * moved, not copied: its form widgets and values stay live and the form's page
 * references follow the page. Copying a page here would create orphan widgets,
 * so the result states explicitly that no flattening happened.
 */
function movePage(doc, from, to) {
  const check = checkIndex(doc, from);
  if (!check.ok) return check;
  const total = doc.getPageCount();
  const liveForm = formFieldCount(doc) > 0;
  const target = Number(to);
  if (!Number.isInteger(target) || target < 0 || target >= total) {
    return { ok: false, reason: "index", message: `Position ${str(to) || "?"} is not in this PDF (1 to ${total}).` };
  }
  if (target === check.index) return { ok: true, moved: false, pageCount: total, flattened: false, liveForm };
  try {
    const page = doc.getPage(check.index);
    doc.removePage(check.index);
    doc.insertPage(target, page);
    forgetPageCache(doc);
  } catch (error) {
    return { ok: false, reason: "move", message: `That page could not be moved: ${pdfError(error)}` };
  }
  return { ok: true, moved: true, pageCount: doc.getPageCount(), flattened: false, liveForm };
}

/** Refs of the widget annotations owned by one terminal form field. */
function fieldWidgetRefs(field) {
  try {
    const kids = field.acroField.Kids();
    if (kids && typeof kids.size === "function" && kids.size()) return kids.asArray();
    const dict = field.acroField.dict;
    if (dict && String(dict.get(PDFName.of("Subtype"))) === "/Widget") return [field.ref];
  } catch (error) {
    /* a malformed field has no usable widgets */
  }
  return [];
}

/** Widget annotations on one page, with the terminal field that owns each. */
function formWidgetsOnPage(doc, page) {
  const form = doc.getForm();
  const byRef = new Map();
  for (const field of form.getFields()) {
    for (const ref of fieldWidgetRefs(field)) byRef.set(String(ref), field);
  }
  const entries = page.node.Annots();
  const widgets = [];
  const unknown = [];
  for (const ref of entries ? entries.asArray() : []) {
    const dict = doc.context.lookup(ref);
    const subtype = dict && String(dict.get(PDFName.of("Subtype")));
    if (byRef.has(String(ref))) widgets.push({ ref, field: byRef.get(String(ref)) });
    else if (subtype === "/Widget") unknown.push(String(ref));
  }
  return { form, widgets, unknown };
}

/** Widget refs on a copied page, in the same order as their original page. */
function pageWidgetRefs(doc, page) {
  const entries = page.node.Annots();
  const refs = [];
  for (const ref of entries ? entries.asArray() : []) {
    const dict = doc.context.lookup(ref);
    if (dict && String(dict.get(PDFName.of("Subtype"))) === "/Widget") refs.push(ref);
  }
  return refs;
}

/** A name for a cloned field, deterministic and unique across the AcroForm. */
function duplicateFieldName(taken, field) {
  const base = (fieldNameBase(field.getName()) || "field").slice(0, Math.max(1, MAX_FIELD_NAME - 4));
  const name = uniqueFieldName(taken, base);
  taken.push(name);
  return name;
}

/** Clone a terminal field and re-parent one copied widget to it. */
function cloneDuplicateField(doc, field, copiedWidgetRef, pageRef, name) {
  const context = doc.context;
  const hasKids = fieldWidgetRefs(field).length > 0;
  const fieldRef = hasKids ? context.register(field.acroField.dict.clone(context)) : copiedWidgetRef;
  const dict = context.lookup(fieldRef);
  dict.set(PDFName.of("T"), PDFHexString.fromText(name));
  try {
    dict.delete(PDFName.of("Parent"));
  } catch (error) {
    /* a top-level field has no parent to remove */
  }
  if (hasKids) {
    const widget = context.lookup(copiedWidgetRef);
    dict.set(PDFName.of("Kids"), context.obj([copiedWidgetRef]));
    widget.set(PDFName.of("Parent"), fieldRef);
    widget.set(PDFName.of("P"), pageRef);
  } else {
    /* A merged field-widget keeps its own dict as the registered field. */
    dict.set(PDFName.of("P"), pageRef);
  }
  return fieldRef;
}

/** Clone one field already copied into this document's context. */
function cloneMergedField(doc, copiedWidgetRef, pageRef, name) {
  const context = doc.context;
  const widget = context.lookup(copiedWidgetRef);
  const parentRef = widget.get(PDFName.of("Parent"));
  if (!parentRef) {
    /* A merged field-widget is already the registered field object. */
    widget.set(PDFName.of("T"), PDFHexString.fromText(name));
    widget.set(PDFName.of("P"), pageRef);
    return copiedWidgetRef;
  }
  const parent = context.lookup(parentRef);
  if (!parent || typeof parent.clone !== "function") throw new Error("the copied field's parent is not a field dictionary");
  const fieldRef = context.register(parent.clone(context));
  const dict = context.lookup(fieldRef);
  dict.set(PDFName.of("T"), PDFHexString.fromText(name));
  try {
    dict.delete(PDFName.of("Parent"));
  } catch (error) {
    /* a top-level field has no parent to remove */
  }
  dict.set(PDFName.of("Kids"), context.obj([copiedWidgetRef]));
  widget.set(PDFName.of("Parent"), fieldRef);
  widget.set(PDFName.of("P"), pageRef);
  return fieldRef;
}

/**
 * Duplicates one page and keeps a form page genuinely fillable. Every widget
 * on the copied page gets a cloned terminal field, a unique name and a fresh
 * /Parent, so its value and appearance are independent of the source. A page
 * with an unsupported field is refused as a whole; extraction, split and merge
 * keep their separate flatten-on-copy policy.
 */
async function duplicatePage(doc, index) {
  const check = checkIndex(doc, index);
  if (!check.ok) return check;
  if (doc.getPageCount() >= MAX_PAGES) return { ok: false, reason: "pages", message: `A document cannot exceed ${MAX_PAGES} pages here.` };

  let found;
  try {
    const form = doc.getForm();
    if (typeof form.hasXFA === "function" && form.hasXFA()) {
      return { ok: false, reason: "form", message: "Duplicate-page cannot safely duplicate an XFA form. Flatten it first." };
    }
    found = formWidgetsOnPage(doc, doc.getPage(check.index));
  } catch (error) {
    return { ok: false, reason: "form", message: `Duplicate-page could not read this form safely: ${pdfError(error)}` };
  }
  if (found.unknown.length) {
    return { ok: false, reason: "form", message: "Duplicate-page cannot safely duplicate a widget annotation that is not registered in this PDF's AcroForm. Flatten it first." };
  }
  const unsupported = found.widgets.find((entry) => fieldKind(entry.field) === "other");
  if (unsupported) {
    const label = str(unsupported.field.getName()) || "unnamed";
    return { ok: false, reason: "form", message: `Duplicate-page cannot safely duplicate the “${label}” button, signature or unsupported field. Flatten it first, or duplicate a page without it.` };
  }

  let copy;
  try {
    [copy] = await doc.copyPages(doc, [check.index]);
  } catch (error) {
    return { ok: false, reason: "duplicate", message: `That page could not be duplicated: ${pdfError(error)}` };
  }
  const copiedWidgets = pageWidgetRefs(doc, copy);
  if (copiedWidgets.length !== found.widgets.length) {
    return { ok: false, reason: "form", message: "Duplicate-page could not match the copied widgets to their form fields. Flatten the form first." };
  }

  const taken = found.form.getFields().map((field) => field.getName()).filter(Boolean);
  const newFields = [];
  let inserted = false;
  try {
    for (let offset = 0; offset < found.widgets.length; offset++) {
      const entry = found.widgets[offset];
      const name = duplicateFieldName(taken, entry.field);
      newFields.push(cloneDuplicateField(doc, entry.field, copiedWidgets[offset], copy.ref, name));
    }
    doc.insertPage(check.index + 1, copy);
    inserted = true;
    for (const ref of newFields) found.form.acroForm.addField(ref);
    forgetPageCache(doc);
  } catch (error) {
    if (inserted) {
      try {
        doc.removePage(check.index + 1);
        forgetPageCache(doc);
      } catch (removeError) {
        /* the page tree is already damaged; report the clone failure below */
      }
    }
    for (const ref of newFields) {
      try {
        found.form.acroForm.removeField(ref);
      } catch (removeError) {
        /* a field that was never registered needs no cleanup */
      }
    }
    return { ok: false, reason: "form", message: `Duplicate-page could not copy this form safely: ${pdfError(error)}` };
  }

  return { ok: true, pageCount: doc.getPageCount(), flattened: false, liveForm: formFieldCount(doc) > 0, fields: newFields.length };
}

function addBlankPage(doc, index, size) {
  if (doc.getPageCount() >= MAX_PAGES) return { ok: false, reason: "pages", message: `A document cannot exceed ${MAX_PAGES} pages here.` };
  const total = doc.getPageCount();
  const given = !(index === undefined || index === null || index === "");
  const at = given ? Number(index) : total;
  if (!Number.isInteger(at) || at < 0 || at > total) {
    return { ok: false, reason: "index", message: `A blank page cannot go at position ${str(index) || "?"} in a ${total}-page PDF.` };
  }
  const width = clamp(Number(size && size.width) || DEFAULT_PAGE[0], 72, 14400);
  const height = clamp(Number(size && size.height) || DEFAULT_PAGE[1], 72, 14400);
  try {
    doc.insertPage(at, [round(width, 2), round(height, 2)]);
    forgetPageCache(doc);
  } catch (error) {
    return { ok: false, reason: "add", message: `A blank page could not be added: ${pdfError(error)}` };
  }
  return { ok: true, pageCount: doc.getPageCount(), index: at };
}

/**
 * Appends every page of another PDF at `at`, keeping the other file untouched.
 * Form pages are copied live: each copied widget's field is cloned into the
 * target context with a unique name and registered in the target AcroForm. A
 * source page with a button, signature, XFA or otherwise unsupported field
 * refuses the whole merge before any page or field is inserted. Extraction and
 * splitting keep their separate flatten-on-copy path.
 */
async function insertPdfPages(doc, bytes, at) {
  const loaded = await loadEditorDocument(bytes);
  if (!loaded.ok) return loaded;
  const source = loaded.doc;
  const added = source.getPageCount();
  if (added > MAX_INSERT_PAGES) return { ok: false, reason: "pages", message: `That PDF has more than ${MAX_INSERT_PAGES} pages.` };
  if (doc.getPageCount() + added > MAX_PAGES) return { ok: false, reason: "pages", message: `A document cannot exceed ${MAX_PAGES} pages here.` };
  const total = doc.getPageCount();
  const position = Math.max(0, Math.min(total, Math.round(Number(at))));

  let sourceForm;
  let pages = [];
  let form;
  try {
    sourceForm = source.getForm();
    if (typeof sourceForm.hasXFA === "function" && sourceForm.hasXFA()) {
      return { ok: false, reason: "form", message: "Add-pages cannot safely merge an XFA form. Flatten it first." };
    }
    for (let index = 0; index < added; index++) {
      const found = formWidgetsOnPage(source, source.getPage(index));
      if (found.unknown.length) {
        return { ok: false, reason: "form", message: "Add-pages cannot safely merge a widget annotation that is not registered in this PDF's AcroForm. Flatten it first." };
      }
      const unsupported = found.widgets.find((entry) => fieldKind(entry.field) === "other");
      if (unsupported) {
        const label = str(unsupported.field.getName()) || "unnamed";
        return { ok: false, reason: "form", message: `Add-pages cannot safely merge the “${label}” button, signature or unsupported field. Flatten it first, or add a PDF without it.` };
      }
      pages.push(found);
    }
    form = doc.getForm();
    if (typeof form.hasXFA === "function" && form.hasXFA()) {
      return { ok: false, reason: "form", message: "Add-pages cannot safely merge live fields into an XFA target. Flatten it first." };
    }
  } catch (error) {
    return { ok: false, reason: "form", message: `Add-pages could not read a form safely: ${pdfError(error)}` };
  }

  let copies;
  try {
    copies = await doc.copyPages(source, source.getPageIndices());
  } catch (error) {
    return { ok: false, reason: "insert", message: `Those pages could not be added: ${pdfError(error)}` };
  }
  if (copies.length !== pages.length) {
    return { ok: false, reason: "form", message: "Add-pages could not match the copied pages to their form fields. Flatten the form first." };
  }

  const pairs = [];
  for (let offset = 0; offset < copies.length; offset++) {
    const copiedWidgets = pageWidgetRefs(doc, copies[offset]);
    if (copiedWidgets.length !== pages[offset].widgets.length) {
      return { ok: false, reason: "form", message: "Add-pages could not match the copied widgets to their form fields. Flatten the form first." };
    }
    for (let index = 0; index < copiedWidgets.length; index++) {
      const sourceField = pages[offset].widgets[index].field;
      const copiedWidget = doc.context.lookup(copiedWidgets[index]);
      if (fieldWidgetRefs(sourceField).length && !copiedWidget.get(PDFName.of("Parent"))) {
        return { ok: false, reason: "form", message: "Add-pages could not pair a copied widget with its field. Flatten the form first." };
      }
      pairs.push({ field: sourceField, widget: copiedWidgets[index], page: copies[offset].ref });
    }
  }

  const taken = form.getFields().map((field) => field.getName()).filter(Boolean);
  const newFields = [];
  let inserted = 0;
  try {
    for (const pair of pairs) {
      const name = duplicateFieldName(taken, pair.field);
      newFields.push(cloneMergedField(doc, pair.widget, pair.page, name));
    }
    copies.forEach((page, offset) => doc.insertPage(position + offset, page));
    inserted = copies.length;
    for (const ref of newFields) form.acroForm.addField(ref);
    forgetPageCache(doc);
  } catch (error) {
    for (let offset = 0; offset < inserted; offset++) {
      try {
        doc.removePage(position);
        forgetPageCache(doc);
      } catch (removeError) {
        /* the page tree is already damaged; report the clone failure below */
      }
    }
    for (const ref of newFields) {
      try {
        form.acroForm.removeField(ref);
      } catch (removeError) {
        /* a field that was never registered needs no cleanup */
      }
    }
    return { ok: false, reason: "form", message: `Add-pages could not copy this form safely: ${pdfError(error)}` };
  }

  return { ok: true, added, pageCount: doc.getPageCount(), index: position, flattened: false, liveForm: formFieldCount(doc) > 0, fields: newFields.length };
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
    const page = fieldPageIndex(doc, field);
    let pageSize = null;
    let rotation = 0;
    let rects = [];
    try {
      if (page >= 0) {
        const pageObject = doc.getPage(page);
        pageSize = pageObject.getSize();
        rotation = normalizedRotation(pageObject.getRotation().angle);
      }
      rects = field.acroField.getWidgets()
        .map((widget) => widget.getRectangle())
        .filter((rect) => rect && rect.width > 0 && rect.height > 0)
        .map((rect) => ({ x: rect.x, y: rect.y, width: rect.width, height: rect.height }));
    } catch (error) {
      rects = [];
    }
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
      page,
      rects,
      rect: rects[0] || null,
      pageWidth: pageSize ? pageSize.width : 0,
      pageHeight: pageSize ? pageSize.height : 0,
      rotation,
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

/** Removes one field and its widget annotations; the rest of the form stays live. */
function deleteFormField(doc, name) {
  const key = str(name).trim();
  if (!key) return { ok: false, reason: "empty", message: "Choose the field to delete." };
  const field = findField(doc, key);
  if (!field) return { ok: false, reason: "missing", message: `There is no form field named “${key}”.` };
  const kind = fieldKind(field);
  if (kind === "other") {
    return { ok: false, reason: "unsupported", message: `“${key}” is not a text, checkbox, radio or dropdown field, so it is not removed here.` };
  }
  const refs = new Set(fieldWidgetRefs(field).map(String));
  let widgets = 0;
  try {
    for (const page of doc.getPages()) {
      const annots = page.node.Annots();
      if (!annots) continue;
      for (let index = annots.size() - 1; index >= 0; index--) {
        if (!refs.has(String(annots.get(index)))) continue;
        annots.remove(index);
        widgets += 1;
      }
    }
  } catch (error) {
    return { ok: false, reason: "widgets", message: `“${key}” could not be taken off its page: ${pdfError(error)}` };
  }
  try {
    doc.getForm().removeField(field);
  } catch (error) {
    return { ok: false, reason: "form", message: `“${key}” could not be removed from the form: ${pdfError(error)}` };
  }
  return { ok: true, name: key, kind, widgets, fields: formFieldCount(doc) };
}

/**
 * Renames one flat field name. The value, the widget rectangle and the
 * appearance stay where they are, so the renamed field is still fillable.
 */
function renameFormField(doc, name, next) {
  const from = str(name).trim();
  if (!from) return { ok: false, reason: "empty", message: "Choose the field to rename." };
  const field = findField(doc, from);
  if (!field) return { ok: false, reason: "missing", message: `There is no form field named “${from}”.` };
  const to = winAnsiText(next).replace(/\s+/g, " ").trim().slice(0, MAX_FIELD_NAME);
  if (!to) return { ok: false, reason: "name", message: "Type the new field name." };
  if (to === from) return { ok: false, reason: "name", message: `“${from}” already has that name.` };
  let taken = [];
  try {
    taken = doc.getForm().getFields().map((item) => str(item.getName()));
  } catch (error) {
    taken = [];
  }
  if (taken.includes(to)) return { ok: false, reason: "duplicate", message: `A field named “${to}” already exists.` };
  const kind = fieldKind(field);
  if (kind === "other") {
    return { ok: false, reason: "unsupported", message: `“${from}” is not a text, checkbox, radio or dropdown field, so it is not renamed here.` };
  }
  try {
    field.acroField.dict.set(PDFName.of("T"), PDFHexString.fromText(to));
  } catch (error) {
    return { ok: false, reason: "name", message: `“${from}” could not be renamed: ${pdfError(error)}` };
  }
  return { ok: true, from, to, kind };
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

/**
 * A rectangle, ellipse or horizontal rule drawn into the page content.
 * The box comes from a text anchor and is measured in PDF points, so the same
 * placement applies to every page it targets. A line is a rule across the
 * box's width, centred in its height. Rotated pages are refused for the same
 * reason images are: the points are measured against the page, not the view.
 */
function addShape(doc, options) {
  const opts = options && typeof options === "object" ? options : {};
  const shape = str(opts.shape);
  if (!SHAPES.includes(shape)) {
    return { ok: false, reason: "shape", message: "Choose a rectangle, an ellipse or a line." };
  }
  const width = Number(opts.width);
  const height = Number(opts.height);
  if (!(width >= MIN_SHAPE_POINTS) || !(height >= MIN_SHAPE_POINTS)) {
    return { ok: false, reason: "size", message: `A shape has to be at least ${MIN_SHAPE_POINTS} by ${MIN_SHAPE_POINTS} points.` };
  }
  if (!(width <= MAX_SHAPE_POINTS) || !(height <= MAX_SHAPE_POINTS)) {
    return { ok: false, reason: "size", message: `A shape cannot be larger than ${MAX_SHAPE_POINTS} points a side.` };
  }
  const targets = resolvePages(doc, opts);
  if (!targets.ok) return targets;
  for (const index of targets.pages) {
    const page = doc.getPage(index);
    if (normalizedRotation(page.getRotation().angle)) {
      return { ok: false, reason: "rotation", message: "A shape needs an unrotated page. Rotate it back first." };
    }
    const size = page.getSize();
    if (width > size.width || height > size.height) {
      return {
        ok: false,
        reason: "size",
        message: `A ${Math.round(width)} by ${Math.round(height)} point shape does not fit on the ${Math.round(size.width)} by ${Math.round(size.height)} point page.`,
      };
    }
  }
  const borderWidth = clamp(Number(opts.borderWidth) || 1.5, 0.5, 24);
  const opacity = clamp(Number(opts.opacity) || 1, 0.05, 1);
  const fillOpacity = clamp(Number(opts.fillOpacity) || 0.18, 0.02, 1);
  const color = colorFor(opts.color || "red", "red");
  const fill = str(opts.fill);
  const fillColor = SHAPE_FILLS.includes(fill) && fill !== "none" ? colorFor(fill, "yellow") : null;
  const chosen = TEXT_POSITIONS.includes(str(opts.position)) ? str(opts.position) : "middle-center";
  /* anchorFor calls the vertical middle "center"; the position list calls it "middle". */
  const position = chosen.replace(/^middle-/, "center-");
  let drawn = 0;
  for (const index of targets.pages) {
    const page = doc.getPage(index);
    const size = page.getSize();
    const anchor = anchorFor(position, width, height, size.width, size.height, 36);
    const x = anchor.x;
    const y = Math.max(0, size.height - anchor.y - height);
    try {
      if (shape === "rectangle") {
        page.drawRectangle({
          x,
          y,
          width,
          height,
          borderColor: color,
          borderWidth,
          borderOpacity: opacity,
          ...(fillColor ? { color: fillColor, opacity: fillOpacity } : {}),
        });
      } else if (shape === "ellipse") {
        page.drawEllipse({
          x: x + width / 2,
          y: y + height / 2,
          xScale: width / 2,
          yScale: height / 2,
          borderColor: color,
          borderWidth,
          borderOpacity: opacity,
          ...(fillColor ? { color: fillColor, opacity: fillOpacity } : {}),
        });
      } else {
        page.drawLine({
          start: { x, y: y + height / 2 },
          end: { x: x + width, y: y + height / 2 },
          thickness: borderWidth,
          color,
          opacity,
        });
      }
      drawn += 1;
    } catch (error) {
      return { ok: false, reason: "shape", message: `That shape could not be drawn: ${pdfError(error)}` };
    }
  }
  return { ok: true, shape, drawn, pages: targets.pages.length, width, height };
}

/**
 * Scales pages to a standard paper size and sets the page box to it.
 * The content keeps its bottom-left corner, so a page whose ratio differs
 * leaves the spare room at the top and right rather than clipping it.
 * Rotated pages and PDFs with form fields are refused: a widget's rectangle
 * would no longer line up with the content it was placed against.
 */
function resizePages(doc, options) {
  const opts = options && typeof options === "object" ? options : {};
  const preset = PAGE_SIZES.find((entry) => entry.id === str(opts.size));
  const width = preset ? preset.width : Number(opts.width);
  const height = preset ? preset.height : Number(opts.height);
  if (!(width >= MIN_PAGE_POINTS) || !(height >= MIN_PAGE_POINTS)) {
    return { ok: false, reason: "size", message: `A page has to be at least ${MIN_PAGE_POINTS} by ${MIN_PAGE_POINTS} points.` };
  }
  if (width > MAX_PAGE_POINTS || height > MAX_PAGE_POINTS) {
    return { ok: false, reason: "size", message: `A page cannot be larger than ${MAX_PAGE_POINTS} points a side.` };
  }
  const targets = resolvePages(doc, opts);
  if (!targets.ok) return targets;
  for (const index of targets.pages) {
    if (normalizedRotation(doc.getPage(index).getRotation().angle)) {
      return { ok: false, reason: "rotation", message: "A page has to be unrotated before it can be resized. Rotate it back first." };
    }
  }
  try {
    if (doc.getForm().getFields().length) {
      return { ok: false, reason: "form", message: "A PDF with form fields cannot be resized. Flatten the form first." };
    }
  } catch (error) {
    /* a PDF without a form has nothing to protect */
  }
  let resized = 0;
  let skipped = 0;
  const scales = [];
  for (const index of targets.pages) {
    const page = doc.getPage(index);
    const size = page.getSize();
    if (Math.abs(size.width - width) < 0.5 && Math.abs(size.height - height) < 0.5) {
      skipped += 1;
      continue;
    }
    const scale = Math.min(width / size.width, height / size.height);
    if (!(scale > 0) || !Number.isFinite(scale)) {
      return { ok: false, reason: "size", message: "That page could not be measured, so it was not resized." };
    }
    const scalesForPage = { page: index, scale };
    try {
      page.scale(scale, scale);
      page.setSize(width, height);
      page.setCropBox(0, 0, width, height);
    } catch (error) {
      return { ok: false, reason: "resize", message: `That page could not be resized: ${pdfError(error)}` };
    }
    scales.push(scalesForPage);
    resized += 1;
  }
  return { ok: true, resized, skipped, pages: targets.pages.length, width, height, scales, size: preset ? preset.id : "custom" };
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
  const prepared = await prepareForPageCopy(doc, "split");
  if (!prepared.ok) return prepared;
  const source = prepared.source;
  const flattened = prepared.flattened;
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

/* ------------------------------------------------------------------- links */

/** Text from a PDF string or hex string, or "" when it is neither. */
function pdfText(value) {
  if (!value) return "";
  try {
    if (typeof value.decodeText === "function") return str(value.decodeText());
  } catch (error) {
    /* an unreadable string is simply empty */
  }
  return "";
}

/** A PDF name without its leading slash, so "/Link" reads as "Link". */
function pdfNameValue(value) {
  if (!value) return "";
  const raw = typeof value.toString === "function" ? value.toString() : str(value);
  return raw.replace(/^\//, "");
}

function numberAt(array, index) {
  const value = array && typeof array.get === "function" ? array.get(index) : undefined;
  if (!value) return 0;
  if (typeof value.asNumber === "function") return value.asNumber();
  return Number(value) || 0;
}

/** A page-space rectangle back in normalized, display-oriented coordinates. */
function displayArea(rect, size, rotation) {
  if (!rect) return { x: 0, y: 0, width: 0, height: 0 };
  const left = numberAt(rect, 0);
  const bottom = numberAt(rect, 1);
  const right = numberAt(rect, 2);
  const top = numberAt(rect, 3);
  const width = size.width || 1;
  const height = size.height || 1;
  const toDisplay = (x, y) => {
    const u = x / width;
    const v = y / height;
    if (rotation === 90) return [v, u];
    if (rotation === 180) return [1 - u, 1 - v];
    if (rotation === 270) return [1 - v, 1 - u];
    return [u, 1 - v];
  };
  const [ax, ay] = toDisplay(Math.min(left, right), Math.min(bottom, top));
  const [bx, by] = toDisplay(Math.max(left, right), Math.max(bottom, top));
  return {
    x: round(Math.min(ax, bx), 3),
    y: round(Math.min(ay, by), 3),
    width: round(Math.abs(bx - ax), 3),
    height: round(Math.abs(by - ay), 3),
  };
}

/** The 1-based page a destination points at, or 0 when it points nowhere. */
function destinationPage(value, pages, context) {
  let target = value;
  if (target instanceof PDFRef && context) target = context.lookup(target);
  let array = null;
  if (target instanceof PDFArray) array = target;
  else if (target instanceof PDFDict) array = target.lookupMaybe(PDFName.of("D"), PDFArray);
  if (!array || !array.size()) return 0;
  const first = array.get(0);
  if (!(first instanceof PDFRef)) return 0;
  const index = pages.findIndex((page) => page.ref === first);
  return index >= 0 ? index + 1 : 0;
}

/**
 * The page and, for a /XYZ destination, the zoom and position it names. `zoom`
 * is a percentage (0 means the viewer keeps its own zoom) and `top` is how far
 * down the page the view starts, in percent from the top.
 */
function destinationView(value, pages, context) {
  let target = value;
  if (target instanceof PDFRef && context) target = context.lookup(target);
  let array = null;
  if (target instanceof PDFArray) array = target;
  else if (target instanceof PDFDict) array = target.lookupMaybe(PDFName.of("D"), PDFArray);
  if (!array || !array.size()) return null;
  const first = array.get(0);
  if (!(first instanceof PDFRef)) return null;
  const index = pages.findIndex((page) => page.ref === first);
  if (index < 0) return null;
  const view = { page: index + 1 };
  if (array.size() < 2 || pdfNameValue(array.get(1)) !== "XYZ") return view;
  const height = pages[index].getHeight();
  const rawNumber = (position) => {
    const raw = position < array.size() ? array.get(position) : null;
    return raw && typeof raw.asNumber === "function" ? raw.asNumber() : null;
  };
  const zoom = rawNumber(4);
  const top = rawNumber(3);
  view.zoom = zoom && zoom > 0 ? Math.round(zoom * 1000) / 10 : 0;
  view.top = top === null || !Number.isFinite(top) || !(height > 0) ? 0 : Math.round((1 - clamp(top / height, 0, 1)) * 1000) / 10;
  return view;
}

/** The name a named destination points at, or "" for a page jump. */
function destinationName(value, context) {
  let target = value;
  if (target instanceof PDFRef && context) target = context.lookup(target);
  if (!target) return "";
  if (target instanceof PDFName) return pdfNameValue(target);
  return pdfText(target);
}

/** The file a /Launch or /GoToR action opens, from a string or a file specification. */
function linkFileSpec(value, context) {
  let spec = value;
  if (spec instanceof PDFRef && context) spec = context.lookup(spec);
  if (!spec) return "";
  if (spec instanceof PDFDict) return pdfText(spec.get(PDFName.of("UF"))) || pdfText(spec.get(PDFName.of("F")));
  return pdfText(spec);
}

/** The 1-based page a remote go-to names in the other file, or 0 when it names none. */
function remotePage(value, context) {
  let target = value;
  if (target instanceof PDFRef && context) target = context.lookup(target);
  if (!(target instanceof PDFArray) || !target.size()) return 0;
  const first = target.get(0);
  const number = first && typeof first.asNumber === "function" ? first.asNumber() : NaN;
  return Number.isFinite(number) && number >= 1 ? Math.round(number) : 0;
}

/**
 * What a link annotation does: an address, a page in this file, a launch, a
 * remote go-to, a named destination, an action this editor does not rewrite,
 * or nothing at all. `file` and `name` carry the target a launch, a remote
 * go-to or a named destination names, so those links can be read and changed
 * instead of reporting an empty address.
 */
function linkAction(dict, pages, context) {
  const row = { kind: "none", url: "", to: 0, file: "", name: "" };
  const action = dict.lookupMaybe(PDFName.of("A"), PDFDict);
  if (action) {
    const kind = pdfNameValue(action.get(PDFName.of("S")));
    if (kind === "URI") {
      row.kind = "url";
      row.url = pdfText(action.lookup(PDFName.of("URI")));
      return row;
    }
    if (kind === "GoTo") {
      const destination = action.get(PDFName.of("D"));
      row.to = destinationPage(destination, pages, context);
      row.name = row.to ? "" : destinationName(destination, context);
      row.kind = row.to ? "page" : row.name ? "named" : "other";
      return row;
    }
    if (kind === "Launch") {
      row.kind = "launch";
      row.file = linkFileSpec(action.get(PDFName.of("F")), context);
      return row;
    }
    if (kind === "GoToR") {
      const destination = action.get(PDFName.of("D"));
      row.kind = "remote";
      row.file = linkFileSpec(action.get(PDFName.of("F")), context);
      row.to = remotePage(destination, context);
      row.name = row.to ? "" : destinationName(destination, context);
      return row;
    }
    row.kind = "other";
    row.name = kind;
    return row;
  }
  const direct = dict.get(PDFName.of("Dest"));
  if (direct) {
    row.to = destinationPage(direct, pages, context);
    row.name = row.to ? "" : destinationName(direct, context);
    row.kind = row.to ? "page" : row.name ? "named" : "other";
  }
  return row;
}

/**
 * A link annotation over a normalized area: an http(s) address or a jump to
 * another page of the same file. Nothing is drawn into the page content, and
 * the rectangle follows the page's own /Rotate.
 */
function addLink(doc, options) {
  const opts = options && typeof options === "object" ? options : {};
  const target = str(opts.target) === "page" ? "page" : "url";
  const url = winAnsiText(opts.url).trim();
  const to = Math.round(Number(opts.to));
  if (target === "url") {
    if (!url) return { ok: false, reason: "empty", message: "Type the address the link should open." };
    if (url.length > MAX_LINK_URL) return { ok: false, reason: "url", message: `A link address cannot be longer than ${MAX_LINK_URL} characters.` };
    if (!/^https?:\/\/\S+$/i.test(url)) return { ok: false, reason: "scheme", message: "A link opens an http or https address only." };
  } else if (!Number.isFinite(to) || to < 1 || to > doc.getPageCount()) {
    return { ok: false, reason: "page", message: `Page ${str(opts.to) || "?"} is not in this PDF.` };
  }
  const area = opts.area && typeof opts.area === "object" ? opts.area : {};
  const box = {
    x: Number(area.x),
    y: Number(area.y),
    width: Number(area.width),
    height: Number(area.height),
  };
  if (![box.x, box.y, box.width, box.height].every((value) => Number.isFinite(value))) {
    return { ok: false, reason: "area", message: "A link needs a left, a top, a width and a height." };
  }
  if (!(box.width > 0) || !(box.height > 0)) {
    return { ok: false, reason: "area", message: "A link needs a width and a height." };
  }
  if (box.width < MIN_LINK_SIZE || box.height < MIN_LINK_SIZE) {
    return { ok: false, reason: "area", message: "A link area is too small to click. Make it at least 0.2% of the page each way." };
  }
  if (box.x < 0 || box.y < 0 || box.x + box.width > 1.0001 || box.y + box.height > 1.0001) {
    return { ok: false, reason: "area", message: "A link has to stay inside the page." };
  }
  const targets = resolvePages(doc, opts);
  if (!targets.ok) return targets;
  let added = 0;
  for (const index of targets.pages) {
    const page = doc.getPage(index);
    const size = page.getSize();
    const rect = displayRect(box, size.width, size.height, normalizedRotation(page.getRotation().angle));
    try {
      const annot = doc.context.obj({
        Type: "Annot",
        Subtype: "Link",
        Rect: [rect.x, rect.y, rect.x + rect.width, rect.y + rect.height],
        Border: [0, 0, 0],
        F: 4,
      });
      if (target === "url") {
        const action = doc.context.obj({ Type: "Action", S: "URI" });
        action.set(PDFName.of("URI"), PDFHexString.fromText(url));
        annot.set(PDFName.of("A"), action);
      } else {
        annot.set(PDFName.of("Dest"), doc.context.obj([doc.getPage(to - 1).ref, PDFName.of("Fit")]));
      }
      page.node.addAnnot(doc.context.register(annot));
      added += 1;
    } catch (error) {
      return { ok: false, reason: "link", message: `That link could not be added: ${pdfError(error)}` };
    }
  }
  return { ok: true, target, url: target === "url" ? url : "", to: target === "page" ? to : 0, pages: added };
}

/** Every link annotation with the page and annotation slot it sits in. */
function linkEntries(doc) {
  const entries = [];
  doc.getPages().forEach((page, pageIndex) => {
    let annots = null;
    try {
      annots = page.node.Annots();
    } catch (error) {
      annots = null;
    }
    if (!annots || typeof annots.asArray !== "function") return;
    annots.asArray().forEach((ref, annotIndex) => {
      const dict = doc.context.lookup(ref, PDFDict);
      if (dict && pdfNameValue(dict.get(PDFName.of("Subtype"))) === "Link") entries.push({ pageIndex, annotIndex, ref });
    });
  });
  return entries;
}

function linkDashName(values) {
  if (!values.length) return "solid";
  const key = values.join(",");
  if (key === LINK_DASHES.dashed.join(",")) return "dashed";
  if (key === LINK_DASHES.dotted.join(",")) return "dotted";
  return "custom";
}

/** The raw /BS /S name a link already carries, or "" when it has none. */
function linkBorderName(dict) {
  const bs = dict.lookupMaybe(PDFName.of("BS"), PDFDict);
  return bs ? pdfNameValue(bs.get(PDFName.of("S"))) : "";
}

/** A /BS /S name as the word the editor shows. */
function borderStyleName(raw) {
  return raw === "D" ? "dashed" : raw === "B" ? "beveled" : raw === "I" ? "inset" : raw === "U" ? "underline" : raw === "" || raw === "S" ? "solid" : "other";
}

/** The visible styling of one link: border width in points, dash and highlight mode. */
function linkStyle(dict) {
  const bs = dict.lookupMaybe(PDFName.of("BS"), PDFDict);
  const border = dict.lookupMaybe(PDFName.of("Border"), PDFArray);
  let width = 0;
  if (bs) {
    const value = bs.get(PDFName.of("W"));
    if (value && typeof value.asNumber === "function") width = value.asNumber();
  } else if (border && border.size() > 2) {
    width = numberAt(border, 2);
  }
  let dash = "solid";
  let pattern = [];
  let phase = null;
  if (bs) {
    const raw = bs.get(PDFName.of("D"));
    if (raw && typeof raw.asArray === "function") {
      /* the editor writes a phase as [phase [lengths]]; plain lengths stay plain */
      const entries = raw.asArray();
      const nested = entries.length === 2 && entries[1] && typeof entries[1].asArray === "function";
      if (nested) {
        const measured = entries[0] && typeof entries[0].asNumber === "function" ? entries[0].asNumber() : NaN;
        if (Number.isFinite(measured) && measured >= 0) phase = measured;
      }
      pattern = (nested ? entries[1].asArray() : entries).map((entry) => (entry && typeof entry.asNumber === "function" ? entry.asNumber() : 0));
      dash = linkDashName(pattern);
    }
  }
  const borderName = borderStyleName(linkBorderName(dict));
  const name = pdfNameValue(dict.get(PDFName.of("H")));
  const highlight = name === "I" ? "invert" : name === "O" ? "outline" : name === "P" ? "push" : name === "" || name === "N" ? "none" : "other";
  const style = { width, border: borderName, dash, highlight, pattern };
  if (phase !== null) style.phase = phase;
  return style;
}

/**
 * Removes links: one by its number in `readLinks`, or every link at once.
 * Only the annotation is dropped; the page content is never touched.
 */
function removeLinks(doc, options) {
  const opts = options && typeof options === "object" ? options : {};
  const entries = linkEntries(doc);
  if (!entries.length) return { ok: false, reason: "empty", message: "This PDF has no links to remove." };
  const total = entries.length;
  let picked;
  if (opts.all === true || str(opts.all) === "all") {
    if (total > MAX_LINKS) return { ok: false, reason: "size", message: `This PDF has more than ${MAX_LINKS} links; remove them one at a time.` };
    picked = entries;
  } else {
    const index = Math.round(Number(opts.index));
    if (!Number.isFinite(index) || index < 1 || index > total) {
      return { ok: false, reason: "index", message: `Link ${str(opts.index) || "?"} is not in this PDF (1 to ${total}).` };
    }
    picked = [entries[index - 1]];
  }
  const byPage = new Map();
  for (const entry of picked) {
    const list = byPage.get(entry.pageIndex) || [];
    list.push(entry);
    byPage.set(entry.pageIndex, list);
  }
  let removed = 0;
  for (const [pageIndex, list] of byPage) {
    const annots = doc.getPage(pageIndex).node.Annots();
    for (const entry of list.slice().sort((a, b) => b.annotIndex - a.annotIndex)) {
      annots.remove(entry.annotIndex);
      removed += 1;
    }
  }
  return { ok: true, removed, left: total - removed, pages: [...byPage.keys()].map((index) => index + 1).sort((a, b) => a - b) };
}

/**
 * Changes one existing link in place: a new rectangle, a new address or page
 * jump, and optionally a new page for the annotation itself. The border, flags
 * and annotation identity are kept, so the same annotation moves instead of
 * being deleted and re-added somewhere else.
 */
function updateLink(doc, options) {
  const opts = options && typeof options === "object" ? options : {};
  const entries = linkEntries(doc);
  if (!entries.length) return { ok: false, reason: "empty", message: "This PDF has no links to change." };
  const index = Math.round(Number(opts.index));
  if (!Number.isFinite(index) || index < 1 || index > entries.length) {
    return { ok: false, reason: "index", message: `Link ${str(opts.index) || "?"} is not in this PDF (1 to ${entries.length}).` };
  }
  const entry = entries[index - 1];
  const dict = doc.context.lookup(entry.ref, PDFDict);
  if (!dict) return { ok: false, reason: "link", message: "That link could not be read back from this PDF." };
  const pages = doc.getPages();
  const previous = linkAction(dict, pages, doc.context);
  const fromPage = entry.pageIndex + 1;
  const relocate = opts.page !== undefined && opts.page !== null && str(opts.page) !== "";
  let pageNumber = fromPage;
  let page = doc.getPage(entry.pageIndex);
  if (relocate) {
    const requested = Number(opts.page);
    if (!Number.isFinite(requested) || Math.round(requested) !== requested) {
      return { ok: false, reason: "page", message: `Page ${str(opts.page) || "?"} is not in this PDF.` };
    }
    if (requested < 1 || requested > doc.getPageCount()) {
      return { ok: false, reason: "page", message: `Page ${requested} is not in this PDF (1 to ${doc.getPageCount()}).` };
    }
    if (requested === fromPage) {
      return { ok: false, reason: "samepage", message: `Link ${index} is already on page ${fromPage}. Pick a different page to move it to.` };
    }
    pageNumber = requested;
    page = doc.getPage(pageNumber - 1);
  }
  /* the target page owns the geometry: its own size and /Rotate place the box */
  const size = page.getSize();
  const rotation = normalizedRotation(page.getRotation().angle);
  let rect = null;
  if (opts.area !== undefined && opts.area !== null) {
    const area = typeof opts.area === "object" ? opts.area : {};
    const box = { x: Number(area.x), y: Number(area.y), width: Number(area.width), height: Number(area.height) };
    if (![box.x, box.y, box.width, box.height].every((value) => Number.isFinite(value))) {
      return { ok: false, reason: "area", message: "A link area needs a left, a top, a width and a height." };
    }
    if (!(box.width > 0) || !(box.height > 0)) {
      return { ok: false, reason: "area", message: "A link needs a width and a height." };
    }
    if (box.width < MIN_LINK_SIZE || box.height < MIN_LINK_SIZE) {
      return { ok: false, reason: "area", message: "A link area is too small to click. Make it at least 0.2% of the page each way." };
    }
    if (box.x < 0 || box.y < 0 || box.x + box.width > 1.0001 || box.y + box.height > 1.0001) {
      return { ok: false, reason: "area", message: "A link has to stay inside the page." };
    }
    const placed = displayRect(box, size.width, size.height, rotation);
    if (placed.x < -0.01 || placed.y < -0.01 || placed.x + placed.width > size.width + 0.01 || placed.y + placed.height > size.height + 0.01) {
      return { ok: false, reason: "area", message: "A link has to stay inside the page." };
    }
    rect = [placed.x, placed.y, placed.x + placed.width, placed.y + placed.height];
  }
  if (relocate && !rect) {
    /* no new box asked for: keep the link's visible place on its new page */
    const source = doc.getPage(entry.pageIndex);
    const current = displayArea(dict.lookupMaybe(PDFName.of("Rect"), PDFArray), source.getSize(), normalizedRotation(source.getRotation().angle));
    if (!(current.width > 0) || !(current.height > 0)) {
      return { ok: false, reason: "area", message: "That link has no clickable area to carry to another page." };
    }
    const placed = displayRect(current, size.width, size.height, rotation);
    rect = [placed.x, placed.y, placed.x + placed.width, placed.y + placed.height];
  }
  const wantsStyle = opts.style !== undefined && opts.style !== null;
  let style = null;
  let styleGiven = null;
  let stylePattern = [];
  let stylePhase = null;
  let styleName = "";
  if (wantsStyle) {
    const source = opts.style && typeof opts.style === "object" ? opts.style : null;
    if (!source) return { ok: false, reason: "style", message: "A link style needs a width, a border, a dash or a highlight mode." };
    const given = {};
    if (source.width !== undefined && source.width !== null) {
      const width = Number(source.width);
      if (!Number.isFinite(width) || width <= 0 || width > MAX_LINK_BORDER) {
        return { ok: false, reason: "style", message: `A link border needs a width above 0 and at most ${MAX_LINK_BORDER} points.` };
      }
      given.width = width;
    }
    if (source.border !== undefined && source.border !== null) {
      const border = str(source.border);
      if (!Object.prototype.hasOwnProperty.call(LINK_BORDERS, border)) {
        return { ok: false, reason: "style", message: "A link border style has to be solid, dashed, beveled, inset or underline." };
      }
      given.border = border;
    }
    if (source.dash !== undefined && source.dash !== null) {
      const dash = str(source.dash);
      if (dash !== "custom" && !Object.prototype.hasOwnProperty.call(LINK_DASHES, dash)) {
        return { ok: false, reason: "style", message: "A link dash has to be solid, dashed, dotted or custom." };
      }
      given.dash = dash;
    }
    if (source.pattern !== undefined && source.pattern !== null) {
      const raw = Array.isArray(source.pattern)
        ? source.pattern
        : typeof source.pattern === "string" ? str(source.pattern).trim().split(/[\s,]+/).filter(Boolean) : null;
      if (!raw || !raw.length || raw.length > MAX_LINK_DASH) {
        return { ok: false, reason: "style", message: `A custom dash needs 1 to ${MAX_LINK_DASH} lengths.` };
      }
      const values = raw.map((value) => Number(value));
      if (!values.every((value) => Number.isFinite(value) && value > 0 && value <= MAX_LINK_DASH_VALUE)) {
        return { ok: false, reason: "style", message: `A custom dash length has to be above 0 and at most ${MAX_LINK_DASH_VALUE}.` };
      }
      given.pattern = values;
    }
    if (source.phase !== undefined) {
      if (source.phase === null || (typeof source.phase !== "number" && str(source.phase) === "")) {
        given.phase = null;
      } else if (typeof source.phase !== "number" && typeof source.phase !== "string") {
        return { ok: false, reason: "style", message: `A dash phase has to be a single number from 0 to ${MAX_LINK_DASH_PHASE}.` };
      } else {
        const phase = Number(str(source.phase));
        if (!Number.isFinite(phase) || phase < 0 || phase > MAX_LINK_DASH_PHASE) {
          return { ok: false, reason: "style", message: `A dash phase has to be a single number from 0 to ${MAX_LINK_DASH_PHASE}.` };
        }
        given.phase = phase;
      }
    }
    if (source.highlight !== undefined && source.highlight !== null) {
      const highlight = str(source.highlight);
      if (!Object.prototype.hasOwnProperty.call(LINK_HIGHLIGHTS, highlight)) {
        return { ok: false, reason: "style", message: "A link highlight has to be none, invert, outline or push." };
      }
      given.highlight = highlight;
    }
    if (!Object.keys(given).length) {
      return { ok: false, reason: "empty", message: "Give the link a border width, a border style, a dash or a highlight mode." };
    }
    const current = linkStyle(dict);
    const currentName = linkBorderName(dict);
    const wantedDash = given.dash !== undefined ? given.dash : null;
    const wantedBorder = given.border !== undefined ? given.border : null;
    if (given.pattern && wantedDash !== "custom") {
      return { ok: false, reason: "style", message: "A dash pattern only applies to a custom dash." };
    }
    let pattern;
    if (wantedDash === "custom") pattern = given.pattern !== undefined ? given.pattern : current.pattern;
    else if (wantedDash) pattern = LINK_DASHES[wantedDash] || [];
    else if (wantedBorder === "dashed" && !current.pattern.length) pattern = LINK_DASHES.dashed;
    else pattern = given.pattern !== undefined ? given.pattern : current.pattern;
    if (wantedDash === "custom" && !pattern.length) {
      return { ok: false, reason: "style", message: `A custom dash needs a pattern of 1 to ${MAX_LINK_DASH} lengths above 0.` };
    }
    let phase = current.phase !== undefined ? current.phase : null;
    if (given.phase !== undefined) phase = given.phase;
    if (given.phase !== undefined && given.phase !== null) {
      if (wantedDash && wantedDash !== "custom") {
        return { ok: false, reason: "style", message: "A dash phase only applies to a custom dash." };
      }
      if (!pattern.length || linkDashName(pattern) !== "custom") {
        return { ok: false, reason: "style", message: "A dash phase needs a custom dash with its lengths." };
      }
    }
    /* a dash that is no longer custom has no lengths left to phase */
    if (!pattern.length || linkDashName(pattern) !== "custom") phase = null;
    let writeName;
    if (wantedBorder) writeName = LINK_BORDERS[wantedBorder];
    else if (wantedDash) writeName = wantedDash === "dashed" ? "D" : wantedDash === "custom" ? currentName || "S" : "S";
    else writeName = currentName || (pattern.length ? "D" : "S");
    stylePattern = pattern;
    stylePhase = phase;
    styleName = writeName;
    styleGiven = given;
    style = {
      width: given.width !== undefined ? given.width : current.width,
      border: borderStyleName(writeName),
      dash: linkDashName(pattern),
      highlight: given.highlight !== undefined ? given.highlight : current.highlight,
      pattern,
    };
    if (phase !== null) style.phase = phase;
  }
  const retarget = opts.target !== undefined || opts.url !== undefined || opts.to !== undefined;
  if (!rect && !retarget && !style) return { ok: false, reason: "empty", message: "Give the link a new area, a new address or a new style." };
  if (retarget && previous.kind === "other") {
    return {
      ok: false,
      reason: "kind",
      message: previous.name
        ? `This link runs a /${previous.name} action this editor does not rewrite; remove it and add a new link instead.`
        : "This link runs an action this editor does not rewrite; remove it and add a new link instead.",
    };
  }
  const target = str(opts.target) === "page" ? "page" : "url";
  const url = winAnsiText(opts.url).trim();
  const to = Math.round(Number(opts.to));
  let replacement = null;
  if (retarget) {
    if (target === "url") {
      if (!url) return { ok: false, reason: "empty", message: "Type the address the link should open." };
      if (url.length > MAX_LINK_URL) return { ok: false, reason: "url", message: `A link address cannot be longer than ${MAX_LINK_URL} characters.` };
      if (!/^https?:\/\/\S+$/i.test(url)) return { ok: false, reason: "scheme", message: "A link opens an http or https address only." };
    } else if (!Number.isFinite(to) || to < 1 || to > doc.getPageCount()) {
      return { ok: false, reason: "page", message: `Page ${str(opts.to) || "?"} is not in this PDF.` };
    }
    try {
      if (target === "url") {
        const action = doc.context.obj({ Type: "Action", S: "URI" });
        action.set(PDFName.of("URI"), PDFHexString.fromText(url));
        replacement = { key: PDFName.of("A"), value: action };
      } else {
        replacement = { key: PDFName.of("Dest"), value: doc.context.obj([doc.getPage(to - 1).ref, PDFName.of("Fit")]) };
      }
    } catch (error) {
      return { ok: false, reason: "link", message: `That link could not be changed: ${pdfError(error)}` };
    }
  }
  try {
    if (rect) dict.set(PDFName.of("Rect"), doc.context.obj(rect));
    if (replacement) {
      dict.delete(PDFName.of("A"));
      dict.delete(PDFName.of("Dest"));
      dict.set(replacement.key, replacement.value);
    }
    if (styleGiven) {
      if (styleGiven.width !== undefined || styleGiven.dash !== undefined || styleGiven.border !== undefined || styleGiven.pattern !== undefined || styleGiven.phase !== undefined) {
        const dashArray = stylePattern;
        /* a phase is written as [phase [lengths]]; plain lengths stay a flat array */
        const dashPart = dashArray.length && stylePhase !== null ? [stylePhase, dashArray] : dashArray;
        dict.set(PDFName.of("Border"), doc.context.obj([0, 0, style.width].concat(dashPart)));
        const border = { W: style.width, S: PDFName.of(styleName || (dashArray.length ? "D" : "S")) };
        if (dashArray.length) border.D = dashPart;
        dict.set(PDFName.of("BS"), doc.context.obj(border));
      }
      if (styleGiven.highlight !== undefined) dict.set(PDFName.of("H"), PDFName.of(LINK_HIGHLIGHTS[style.highlight]));
    }
    if (relocate) {
      /* one annotation: take the same reference out of the old /Annots and add it to the new one */
      const source = doc.getPage(entry.pageIndex).node.Annots();
      const list = source.asArray();
      let at = list.indexOf(entry.ref);
      if (at < 0) at = list.findIndex((ref) => String(ref) === String(entry.ref));
      if (at >= 0) source.remove(at);
      page.node.addAnnot(entry.ref);
      if (dict.get(PDFName.of("P"))) dict.set(PDFName.of("P"), page.ref);
    }
  } catch (error) {
    return { ok: false, reason: "link", message: `That link could not be changed: ${pdfError(error)}` };
  }
  return {
    ok: true,
    index,
    page: pageNumber,
    fromPage,
    moved: Boolean(rect),
    relocated: Boolean(relocate),
    styled: Boolean(style),
    style: style || null,
    target: retarget ? target : "",
    fromKind: retarget ? previous.kind : "",
    url: retarget && target === "url" ? url : "",
    to: retarget && target === "page" ? to : 0,
  };
}

/** Every link annotation in the file, in page order, capped. */
function readLinks(doc) {
  const pages = doc.getPages();
  const links = [];
  let total = 0;
  pages.forEach((page, index) => {
    let annots = null;
    try {
      annots = page.node.Annots();
    } catch (error) {
      annots = null;
    }
    if (!annots || typeof annots.asArray !== "function") return;
    const size = page.getSize();
    const rotation = normalizedRotation(page.getRotation().angle);
    for (const ref of annots.asArray()) {
      const dict = doc.context.lookup(ref, PDFDict);
      if (!dict) continue;
      if (pdfNameValue(dict.lookup(PDFName.of("Subtype"))) !== "Link") continue;
      total += 1;
      if (links.length >= MAX_LINKS) continue;
      const action = linkAction(dict, pages, doc.context);
      links.push({
        page: index + 1,
        target: action.kind,
        url: action.url,
        to: action.to,
        file: action.file,
        name: action.name,
        area: displayArea(dict.lookupMaybe(PDFName.of("Rect"), PDFArray), size, rotation),
        style: linkStyle(dict),
      });
    }
  });
  return { ok: true, links, total };
}

/* ---------------------------------------------------------------- bookmarks */

/** The document outline as a flat list: title, 1-based page and nesting level. */
function readOutline(doc) {
  const root = doc.catalog.lookupMaybe(PDFName.of("Outlines"), PDFDict);
  const pages = doc.getPages();
  const entries = [];
  let total = 0;
  const visit = (parent, level) => {
    let item = parent.lookupMaybe(PDFName.of("First"), PDFDict);
    let guard = 0;
    while (item && guard <= MAX_OUTLINE) {
      guard += 1;
      total += 1;
      if (entries.length < MAX_OUTLINE) {
        const row = { title: pdfText(item.get(PDFName.of("Title"))), page: 0, level };
        const action = item.lookupMaybe(PDFName.of("A"), PDFDict);
        const view = (action && destinationView(action.get(PDFName.of("D")), pages, doc.context))
          || destinationView(item.get(PDFName.of("Dest")), pages, doc.context);
        if (view) {
          row.page = view.page;
          if (view.zoom !== undefined) row.zoom = view.zoom;
          if (view.top !== undefined) row.top = view.top;
        }
        entries.push(row);
      }
      if (level + 1 < MAX_OUTLINE_DEPTH) visit(item, level + 1);
      item = item.lookupMaybe(PDFName.of("Next"), PDFDict);
    }
  };
  if (root) visit(root, 0);
  return { ok: true, entries, total, truncated: total > entries.length };
}

/**
 * Replaces the document outline with a nested list of bookmarks. Each entry
 * points at a whole page with /Fit, or, when `options.zoom` or `options.top`
 * is given, at that zoom and position on the page with /XYZ. The root,
 * parents, siblings and counts are all written as indirect objects, because
 * the tree is cyclic.
 */
function setOutline(doc, entries, options) {
  if (!Array.isArray(entries)) return { ok: false, reason: "shape", message: "Bookmarks need a list of entries." };
  if (entries.length > MAX_OUTLINE) return { ok: false, reason: "size", message: `Keep the bookmarks to ${MAX_OUTLINE} entries.` };
  const opts = options && typeof options === "object" ? options : {};
  const zoomText = str(opts.zoom).trim();
  const topText = str(opts.top).trim();
  let view = null;
  if (zoomText || topText) {
    const zoom = zoomText ? Number(zoomText) : 0;
    const top = topText ? Number(topText) : 0;
    if (zoomText && (!Number.isFinite(zoom) || zoom < MIN_BOOKMARK_ZOOM || zoom > MAX_BOOKMARK_ZOOM)) {
      return { ok: false, reason: "zoom", message: `Bookmark zoom has to be between ${MIN_BOOKMARK_ZOOM}% and ${MAX_BOOKMARK_ZOOM}%.` };
    }
    if (topText && (!Number.isFinite(top) || top < 0 || top > 100)) {
      return { ok: false, reason: "top", message: "A bookmark starts between 0% and 100% down the page." };
    }
    view = { zoom: zoomText ? zoom : 0, top: topText ? top : 0 };
  }
  const total = doc.getPageCount();
  const rows = [];
  for (let index = 0; index < entries.length; index++) {
    const raw = entries[index] && typeof entries[index] === "object" ? entries[index] : {};
    const title = winAnsiText(raw.title).replace(/\s+/g, " ").trim();
    if (!title) return { ok: false, reason: "title", message: `Bookmark ${index + 1} needs a title.` };
    if (title.length > MAX_OUTLINE_TITLE) return { ok: false, reason: "title", message: `Bookmark ${index + 1} has a title longer than ${MAX_OUTLINE_TITLE} characters.` };
    const page = Math.round(Number(raw.page));
    if (!Number.isFinite(page) || page < 1 || page > total) {
      return { ok: false, reason: "page", message: `Bookmark ${index + 1} points at page ${str(raw.page) || "?"}, which is not in this PDF.` };
    }
    const level = Math.round(Number(raw.level) || 0);
    if (level < 0 || level > MAX_OUTLINE_DEPTH - 1) {
      return { ok: false, reason: "level", message: `Bookmark ${index + 1} is nested too deeply; use at most ${MAX_OUTLINE_DEPTH} levels.` };
    }
    if (!index && level) return { ok: false, reason: "level", message: "The first bookmark has to be a top-level one." };
    if (index && level > rows[index - 1].level + 1) {
      return { ok: false, reason: "level", message: `Bookmark ${index + 1} is nested under nothing; move it one level up.` };
    }
    rows.push({ title, page, level });
  }
  doc.catalog.delete(PDFName.of("Outlines"));
  if (!rows.length) return { ok: true, written: 0, depth: 0, entries: [], view };
  const context = doc.context;
  const root = context.obj({ Type: "Outlines" });
  const rootRef = context.register(root);
  doc.catalog.set(PDFName.of("Outlines"), rootRef);
  const items = rows.map((row) => {
    const page = doc.getPage(row.page - 1);
    const dict = context.obj({ Title: PDFHexString.fromText(row.title) });
    dict.set(PDFName.of("Dest"), context.obj(view ? bookmarkDestination(page, view) : [page.ref, PDFName.of("Fit")]));
    return { title: row.title, page: row.page, level: row.level, dict, ref: context.register(dict) };
  });
  const stack = [];
  items.forEach((item, index) => {
    while (stack.length > item.level) stack.pop();
    item.parentIndex = item.level === 0 ? -1 : stack[item.level - 1];
    stack[item.level] = index;
  });
  const childIndexes = (parentIndex) => items.map((item, index) => (item.parentIndex === parentIndex ? index : -1)).filter((index) => index >= 0);
  const descendants = (index) => childIndexes(index).reduce((sum, child) => sum + 1 + descendants(child), 0);
  const linkChildren = (parentRef, parentDict, parentIndex) => {
    const kids = childIndexes(parentIndex);
    if (!kids.length) return;
    parentDict.set(PDFName.of("First"), items[kids[0]].ref);
    parentDict.set(PDFName.of("Last"), items[kids[kids.length - 1]].ref);
    kids.forEach((index, order) => {
      const item = items[index];
      item.dict.set(PDFName.of("Parent"), parentRef);
      if (order > 0) item.dict.set(PDFName.of("Prev"), items[kids[order - 1]].ref);
      if (order < kids.length - 1) item.dict.set(PDFName.of("Next"), items[kids[order + 1]].ref);
      const below = descendants(index);
      if (below) item.dict.set(PDFName.of("Count"), PDFNumber.of(below));
      linkChildren(item.ref, item.dict, index);
    });
  };
  linkChildren(rootRef, root, -1);
  root.set(PDFName.of("Count"), PDFNumber.of(items.length));
  const depth = rows.reduce((max, row) => Math.max(max, row.level + 1), 0);
  return { ok: true, written: items.length, depth, entries: rows.map((row) => ({ title: row.title, page: row.page, level: row.level })), view };
}

/** A /XYZ destination: the page, its left edge, how far down to start and the zoom. */
function bookmarkDestination(page, view) {
  const height = page.getHeight();
  const top = round(height * (1 - clamp(view.top, 0, 100) / 100), 2);
  const zoom = view.zoom > 0 ? PDFNumber.of(view.zoom / 100) : PDFNull;
  return [page.ref, PDFName.of("XYZ"), PDFNumber.of(0), PDFNumber.of(top), zoom];
}

/** `Title | page` lines, two spaces of indent per level. */
function parseBookmarkText(text) {
  const lines = str(text).split(/\r?\n/);
  const entries = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (!line.trim()) continue;
    if (entries.length >= MAX_OUTLINE) return { ok: false, reason: "size", message: `Keep the bookmarks to ${MAX_OUTLINE} lines.` };
    const indent = line.match(/^[ \t]*/)[0].replace(/\t/g, "  ").length;
    const body = line.trim();
    const split = body.lastIndexOf("|");
    if (split < 0) return { ok: false, reason: "format", message: `Bookmark line ${index + 1} needs a page, like "Introduction | 1".` };
    const title = body.slice(0, split).trim();
    const page = Number(body.slice(split + 1).trim());
    if (!title) return { ok: false, reason: "title", message: `Bookmark line ${index + 1} needs a title before the |.` };
    if (!Number.isFinite(page) || !Number.isInteger(page)) {
      return { ok: false, reason: "format", message: `Bookmark line ${index + 1} needs a whole page number after the |.` };
    }
    entries.push({ title, page, level: Math.floor(indent / 2) });
  }
  const depth = entries.reduce((max, entry) => Math.max(max, entry.level + 1), 0);
  return { ok: true, entries, depth };
}

/** The textarea's text for a list of bookmarks, so it round-trips. */
function formatBookmarkText(entries) {
  return (Array.isArray(entries) ? entries : [])
    .map((entry) => `${"  ".repeat(clamp(Math.round(Number(entry.level) || 0), 0, MAX_OUTLINE_DEPTH - 1))}${str(entry.title)} | ${Math.round(Number(entry.page) || 1)}`)
    .join("\n");
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

/**
 * A copied page keeps a field's widget but not the AcroForm. Flatten a
 * serialised copy before extracting pages, so filled values stay visible and
 * the document being edited keeps its live form.
 */
async function prepareForPageCopy(doc, action) {
  if (!formFieldCount(doc)) return { ok: true, source: doc, flattened: false };
  try {
    const serialized = await doc.save({ useObjectStreams: true, addDefaultPage: false });
    const copy = await PDFDocument.load(serialized);
    const baked = await flattenForm(copy);
    if (!baked.ok) {
      return { ok: false, reason: "form", message: `The form could not be flattened for the ${action}: ${baked.message}` };
    }
    return { ok: true, source: copy, flattened: true };
  } catch (error) {
    return { ok: false, reason: "form", message: `The form could not be prepared for the ${action}: ${pdfError(error)}` };
  }
}

/** A new PDF holding only the selected pages, in the order given. */
async function extractPdfPages(doc, indexes) {
  const total = doc.getPageCount();
  const picked = (Array.isArray(indexes) ? indexes : [])
    .map((value) => Math.round(Number(value)))
    .filter((value) => Number.isFinite(value) && value >= 0 && value < total);
  const unique = [...new Set(picked)].sort((a, b) => a - b);
  if (!unique.length) return { ok: false, reason: "empty", message: "Select at least one page to extract." };
  const prepared = await prepareForPageCopy(doc, "extract");
  if (!prepared.ok) return prepared;
  try {
    const out = await PDFDocument.create();
    const copies = await out.copyPages(prepared.source, unique);
    copies.forEach((page) => out.addPage(page));
    const bytes = await out.save({ useObjectStreams: true, addDefaultPage: false });
    return { ok: true, bytes, pages: unique.length, indexes: unique, flattened: prepared.flattened };
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
  PAGE_SIZES,
  ROTATIONS,
  SHAPE_FILLS,
  SHAPES,
  TEXT_POSITIONS,
  TEXT_FONTS,
  WATERMARK_ANGLES,
  addBlankPage,
  addFormField,
  addImage,
  addLink,
  addPageNumbers,
  addShape,
  addText,
  addWatermark,
  cropPages,
  deleteFormField,
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
  formatBookmarkText,
  parseBookmarkText,
  pdfError,
  readLinks,
  readOutline,
  removeLinks,
  renameFormField,
  updateLink,
  setOutline,
  resizePages,
  rotatePage,
  savePdf,
  setDocumentProperties,
  setFieldValue,
  splitPdf,
  textAxes,
  winAnsiText,
};
