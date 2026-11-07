"use strict";
/*
 * The reader's annotation sidebar: pure row shaping, selection geometry and a
 * DOM renderer that takes plain handlers. The modal owns the state and the
 * sidecar writes; this module only decides what a row says and how it looks.
 */
const { filterAnnotations, normalizeTags } = require("./pdf-annotations");

const MAX_ROWS = 500;

function str(value) {
  return value === undefined || value === null ? "" : String(value);
}

/** Tags typed into one field, comma or hash separated and bounded like the sidecar guard. */
function tagInput(text) {
  return normalizeTags(
    str(text)
      .replace(/#/g, ",")
      .split(/[,;\n]+/)
      .map((part) => part.trim())
      .filter(Boolean)
  );
}

function tagText(tags) {
  return (Array.isArray(tags) ? tags : []).map((tag) => `#${tag}`).join(" ");
}

/**
 * Rows for the sidebar, filtered with the same semantics as the index tab.
 * `options` is `{ query, type, selectedId }`; rows keep sidecar order by page.
 */
function sidebarRows(rows, options) {
  const opts = options && typeof options === "object" ? options : {};
  const source = Array.isArray(rows) ? rows : [];
  const filtered = filterAnnotations(source, { query: opts.query, type: opts.type });
  return filtered
    .slice(0, MAX_ROWS)
    .map((row) => ({
      id: str(row.id),
      page: Math.max(1, Math.round(Number(row.page) || 1)),
      type: str(row.type) || "note",
      color: str(row.color) || "yellow",
      note: str(row.note).trim(),
      quote: str(row.quote).trim(),
      canAsk: Boolean(str(row.quote).trim() || str(row.note).trim()),
      tags: Array.isArray(row.tags) ? row.tags.slice() : [],
      tagText: tagText(row.tags),
      label: `${str(row.type) || "note"} · page ${Math.max(1, Math.round(Number(row.page) || 1))}`,
      selected: str(row.id) === str(opts.selectedId) && str(opts.selectedId) !== "",
    }))
    .sort((a, b) => a.page - b.page);
}

/** The union of an annotation's areas, padded a little, for the selection ring. */
function selectionBounds(areas) {
  const list = (Array.isArray(areas) ? areas : []).filter(
    (area) => area && Number.isFinite(Number(area.x)) && Number.isFinite(Number(area.y)) && Number(area.width) > 0 && Number(area.height) > 0
  );
  if (!list.length) return null;
  const x0 = Math.min(...list.map((area) => Number(area.x)));
  const y0 = Math.min(...list.map((area) => Number(area.y)));
  const x1 = Math.max(...list.map((area) => Number(area.x) + Number(area.width)));
  const y1 = Math.max(...list.map((area) => Number(area.y) + Number(area.height)));
  const pad = 0.006;
  const left = Math.max(0, x0 - pad);
  const top = Math.max(0, y0 - pad);
  const right = Math.min(1, x1 + pad);
  const bottom = Math.min(1, y1 + pad);
  return { x: left, y: top, width: Math.max(0.001, right - left), height: Math.max(0.001, bottom - top) };
}

function rowPage(row) {
  return Math.max(1, Math.round(Number(row && row.page) || 1));
}

/** The row to select after deleting `deletedId`, so a delete never jumps the page. */
function nextSelectedId(rows, deletedId) {
  return (Array.isArray(rows) ? rows : []).filter((row) => row && row.id !== deletedId)[0]?.id || "";
}

/**
 * Renders the sidebar into `container`. Handlers: onSelect(id), onQuery(text),
 * onType(type), onToggle, onEditNote(id), onSaveNote(id, text), onEditTags(id),
 * onSaveTags(id, text), onCancelEdit, onAsk(id), onDelete(id).
 */
function renderSidebar(container, model, handlers) {
  const el = container;
  const h = handlers || {};
  const data = model && typeof model === "object" ? model : { rows: [], total: 0, types: [] };
  el.empty();
  const wrap = el.createDiv({ cls: "qt-pdf-sidebar" });
  const head = wrap.createDiv({ cls: "qt-pdf-sidebar-head" });
  head.createEl("h4", { text: "Annotations" });
  head.createSpan({ cls: "qt-pdf-sidebar-count", text: `${data.rows.length} of ${data.total || 0}` });
  head
    .createEl("button", { text: "Hide sidebar", cls: "qt-pdf-sidebar-hide" })
    .addEventListener("click", () => h.onToggle && h.onToggle(false));

  const filters = wrap.createDiv({ cls: "qt-pdf-sidebar-filters" });
  const search = filters.createEl("input", { cls: "qt-input", type: "search" });
  search.setAttribute("aria-label", "Search annotations");
  search.placeholder = "Search notes, quotes and tags";
  search.value = str(data.query);
  search.addEventListener("input", () => h.onQuery && h.onQuery(search.value));
  const select = filters.createEl("select", { cls: "dropdown", attr: { "aria-label": "Filter annotations by type" } });
  select.createEl("option", { value: "", text: "All types" });
  for (const type of Array.isArray(data.types) ? data.types : []) select.createEl("option", { value: type, text: type });
  select.value = str(data.type);
  select.addEventListener("change", () => h.onType && h.onType(select.value));

  const shortcut = wrap.createDiv({ cls: "qt-pdf-sidebar-shortcut", text: "Press A to toggle this sidebar." });
  shortcut.setAttr("aria-hidden", "true");

  if (!data.rows.length) {
    wrap.createDiv({
      cls: "qt-pdf-sidebar-empty",
      text: data.total ? "No annotation matches that filter." : "No annotations yet. Mark the page or select text to start.",
    });
    return wrap;
  }

  const list = wrap.createDiv({ cls: "qt-pdf-sidebar-list" });
  for (const row of data.rows) {
    const item = list.createDiv({
      cls: `qt-pdf-sidebar-row${row.selected ? " is-selected" : ""}`,
      attr: { "data-annotation-id": row.id, "data-page": String(row.page) },
    });
    const jump = (event) => {
      if (event && event.stopPropagation) event.stopPropagation();
      if (h.onSelect) h.onSelect(row.id);
    };
    const top = item.createDiv({ cls: "qt-pdf-sidebar-row-top" });
    const jumpTarget = top.createSpan({
      cls: "qt-pdf-sidebar-type",
      text: row.label,
      attr: { role: "button", tabindex: "0", "aria-label": `Open ${row.label} annotation` },
    });
    jumpTarget.addEventListener("click", jump);
    jumpTarget.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.preventDefault) event.preventDefault();
      jump(event);
    });
    top.createSpan({ cls: "qt-pdf-sidebar-color", text: row.color }).addEventListener("click", jump);
    top.addEventListener("click", jump);
    item.addEventListener("click", jump);
    if (row.quote) item.createDiv({ cls: "qt-pdf-sidebar-quote", text: row.quote.slice(0, 140) }).addEventListener("click", jump);
    if (row.note) item.createDiv({ cls: "qt-pdf-sidebar-note", text: row.note }).addEventListener("click", jump);
    if (row.tags.length) {
      const tags = item.createDiv({ cls: "qt-row qt-pdf-tags" });
      for (const tag of row.tags) tags.createSpan({ cls: "qt-pdf-tag", text: `#${tag}` });
    }
    const actions = item.createDiv({ cls: "qt-pdf-sidebar-actions" });
    const action = (label, cls, handler) =>
      actions.createEl("button", { text: label, cls }).addEventListener("click", (event) => {
        if (event && event.stopPropagation) event.stopPropagation();
        if (handler) handler(row.id);
      });
    action("Edit note", "", h.onEditNote);
    action("Edit tags", "", h.onEditTags);
    if (row.canAsk) action("Ask AI", "qt-pdf-sidebar-ask", h.onAsk);
    action("Delete", "qt-danger", h.onDelete);

    if (data.editingNoteId === row.id) {
      const editor = item.createDiv({ cls: "qt-pdf-sidebar-editor" });
      const area = editor.createEl("textarea", { cls: "qt-pdf-ink-textarea" });
      area.setAttribute("aria-label", "Annotation note");
      area.value = row.note;
      const buttons = editor.createDiv({ cls: "qt-row qt-pdf-sidebar-actions" });
      buttons
        .createEl("button", { text: "Save note", cls: "mod-cta" })
        .addEventListener("click", (event) => {
          if (event && event.stopPropagation) event.stopPropagation();
          if (h.onSaveNote) h.onSaveNote(row.id, area.value);
        });
      buttons.createEl("button", { text: "Cancel" }).addEventListener("click", (event) => {
        if (event && event.stopPropagation) event.stopPropagation();
        if (h.onCancelEdit) h.onCancelEdit();
      });
    }
    if (data.editingTagsId === row.id) {
      const editor = item.createDiv({ cls: "qt-pdf-sidebar-editor" });
      const input = editor.createEl("input", { cls: "qt-input", type: "text" });
      input.setAttribute("aria-label", "Annotation tags");
      input.value = row.tags.map((tag) => `#${tag}`).join(" ");
      editor.createDiv({ cls: "qt-hint", text: "Up to 6 tags, comma separated, no hash needed." });
      const buttons = editor.createDiv({ cls: "qt-row qt-pdf-sidebar-actions" });
      buttons
        .createEl("button", { text: "Save tags", cls: "mod-cta" })
        .addEventListener("click", (event) => {
          if (event && event.stopPropagation) event.stopPropagation();
          if (h.onSaveTags) h.onSaveTags(row.id, input.value);
        });
      buttons.createEl("button", { text: "Cancel" }).addEventListener("click", (event) => {
        if (event && event.stopPropagation) event.stopPropagation();
        if (h.onCancelEdit) h.onCancelEdit();
      });
    }
  }
  return wrap;
}

module.exports = { MAX_ROWS, nextSelectedId, renderSidebar, rowPage, selectionBounds, sidebarRows, tagInput, tagText };
