"use strict";
/*
 * In-place editing for rendered Markdown tables.
 *
 * The note stays the source of truth. A rendered table is mapped back to its
 * Markdown block, and every commit rewrites the whole block with padded cells
 * and a valid delimiter row, so pipes and column widths never drift.
 */

const tableFormulas = require("./table-formulas");

const MAX_TABLE_ROWS = 500;
const MAX_TABLE_COLUMNS = 40;
const MIN_COLUMN_WIDTH = 3;
const MAX_CELL_LENGTH = 4000;

/** Structural actions exposed by the table toolbar. */
const TABLE_STRUCTURE_ACTIONS = [
  { id: "row-insert-below", kind: "structure", short: "+ Row", label: "Insert row below" },
  { id: "row-insert-above", kind: "structure", short: "R↑", label: "Insert row above" },
  { id: "row-delete", kind: "structure", short: "− Row", label: "Delete row" },
  { id: "row-move-up", kind: "structure", short: "↑ Row", label: "Move row up" },
  { id: "row-move-down", kind: "structure", short: "↓ Row", label: "Move row down" },
  { id: "column-insert-right", kind: "structure", short: "+ Col", label: "Insert column right" },
  { id: "column-insert-left", kind: "structure", short: "C←", label: "Insert column left" },
  { id: "column-delete", kind: "structure", short: "− Col", label: "Delete column" },
  { id: "column-move-left", kind: "structure", short: "← Col", label: "Move column left" },
  { id: "column-move-right", kind: "structure", short: "→ Col", label: "Move column right" },
];

/** Formatting and column-alignment actions exposed beside the structural ones. */
const TABLE_FORMAT_ACTIONS = [
  { id: "cell-bold", kind: "format", format: "bold", short: "B", label: "Bold cell text" },
  { id: "cell-italic", kind: "format", format: "italic", short: "I", label: "Italic cell text" },
  { id: "cell-code", kind: "format", format: "code", short: "Code", label: "Inline code" },
  { id: "cell-strikethrough", kind: "format", format: "strikethrough", short: "S", label: "Strikethrough cell text" },
  { id: "column-align-left", kind: "align", align: "left", short: "L", label: "Align column left" },
  { id: "column-align-center", kind: "align", align: "center", short: "C", label: "Align column center" },
  { id: "column-align-right", kind: "align", align: "right", short: "R", label: "Align column right" },
  { id: "column-align-default", kind: "align", align: "none", short: "Def", label: "Default column alignment" },
];

const TABLE_SORT_ACTIONS = [
  { id: "table-sort-asc", kind: "sort", direction: "asc", short: "↑", label: "Sort rows ascending by this column" },
  { id: "table-sort-desc", kind: "sort", direction: "desc", short: "↓", label: "Sort rows descending by this column" },
];

const TABLE_FORMULA_ACTIONS = [
  { id: "table-formulas", kind: "formula", short: "Σ", label: "Evaluate table formulas" },
  { id: "table-csv", kind: "export", short: "CSV", label: "Copy table as CSV" },
];

/** CSV/TSV import: adding pasted rows, or replacing the whole body with them. */
const TABLE_IMPORT_ACTIONS = [
  { id: "table-import-append", kind: "import", mode: "append", short: "Paste", label: "Import CSV or TSV below this table" },
  { id: "table-import-replace", kind: "import", mode: "replace", short: "Replace", label: "Replace the table rows with CSV or TSV" },
];

/** Whole-table actions: transpose, the header row, and the size readout. */
const TABLE_DATA_ACTIONS = [
  { id: "table-transpose", kind: "transpose", short: "T↔", label: "Transpose rows and columns" },
  { id: "table-header", kind: "header", short: "H", label: "Toggle the header row" },
  { id: "table-counts", kind: "count", short: "N×M", label: "Show the row and column count" },
];

const TABLE_TOOLBAR_ACTIONS = TABLE_STRUCTURE_ACTIONS.concat(
  TABLE_FORMAT_ACTIONS,
  TABLE_SORT_ACTIONS,
  TABLE_FORMULA_ACTIONS,
  TABLE_IMPORT_ACTIONS,
  TABLE_DATA_ACTIONS
);

function text(value) {
  return value === null || value === undefined ? "" : String(value);
}

/** The module is opt-in: anything except an explicit true keeps it off. */
function normalizeTableEditorSettings(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    enabled: source.enabled === true,
    bindTab: source.bindTab !== false,
    bindEnter: source.bindEnter !== false,
    padCells: source.padCells !== false,
    showRibbon: source.showRibbon !== false,
  };
}

function isDelimiterCell(cell) {
  return /^:?-+:?$/.test(text(cell).trim());
}

function alignmentOf(cell) {
  const value = text(cell).trim();
  const left = value.startsWith(":");
  const right = value.endsWith(":");
  if (left && right) return "center";
  if (left) return "left";
  if (right) return "right";
  return "none";
}

function isEscaped(value, index) {
  let slashes = 0;
  for (let i = index - 1; i >= 0 && value[i] === "\\"; i -= 1) slashes += 1;
  return slashes % 2 === 1;
}

/**
 * Splits one Markdown table row without being fooled by `\|`, code spans or
 * the optional leading/trailing pipe.
 */
function splitTableRow(line) {
  const raw = text(line);
  const indent = (raw.match(/^\s*/) || [""])[0];
  let body = raw.slice(indent.length);
  if (!body.includes("|")) return null;
  const leading = body.startsWith("|");
  if (leading) body = body.slice(1);
  const trailing = body.endsWith("|") && !isEscaped(body, body.length - 1);
  if (trailing) body = body.slice(0, -1);

  const cells = [];
  let cell = "";
  let escaped = false;
  let codeTicks = 0;
  for (let i = 0; i < body.length; i += 1) {
    const character = body[i];
    if (escaped) {
      cell += character;
      escaped = false;
      continue;
    }
    if (character === "\\") {
      cell += character;
      escaped = true;
      continue;
    }
    if (character === "`") {
      let run = 1;
      while (body[i + run] === "`") run += 1;
      if (codeTicks === 0) codeTicks = run;
      else if (codeTicks === run) codeTicks = 0;
      cell += "`".repeat(run);
      i += run - 1;
      continue;
    }
    if (character === "|" && codeTicks === 0) {
      cells.push(cell.trim());
      cell = "";
      continue;
    }
    cell += character;
  }
  cells.push(cell.trim());
  return { indent, leading, trailing, cells };
}

function isDelimiterRow(cells) {
  return Array.isArray(cells) && cells.length > 0 && cells.every(isDelimiterCell);
}

function padRow(row, columns) {
  const result = Array.isArray(row) ? row.slice(0, columns) : [];
  while (result.length < columns) result.push("");
  return result;
}

/** Parses one table starting at a zero-based line index. */
function parseTableBlock(lines, start) {
  if (!Array.isArray(lines) || !Number.isInteger(start) || start < 0 || start + 1 >= lines.length) return null;
  const header = splitTableRow(lines[start]);
  const delimiter = splitTableRow(lines[start + 1]);
  if (!header || !delimiter || !isDelimiterRow(delimiter.cells)) return null;

  const body = [];
  let end = start + 1;
  for (let i = start + 2; i < lines.length; i += 1) {
    const row = splitTableRow(lines[i]);
    if (!row || !row.cells.length) break;
    if (isDelimiterRow(row.cells)) break;
    body.push(row.cells);
    end = i;
  }

  const columns = Math.max(header.cells.length, delimiter.cells.length, ...body.map((row) => row.length));
  if (columns < 1 || columns > MAX_TABLE_COLUMNS || body.length + 1 > MAX_TABLE_ROWS) return null;

  const align = [];
  for (let column = 0; column < columns; column += 1) align.push(alignmentOf(delimiter.cells[column] || "---"));
  const rows = [header.cells, ...body].map((row) => padRow(row, columns));
  return {
    start,
    end,
    indent: (header.indent || delimiter.indent || "").replace(/\t/g, "    "),
    align,
    columns,
    rows,
    header: rows[0].slice(),
    headerCount: 1,
  };
}

function codeFence(line) {
  const match = text(line).match(/^\s*(`{3,}|~{3,})/);
  return match ? match[1][0] : "";
}

/** Every table outside fenced code and YAML frontmatter. */
function parseTables(markdown) {
  const lines = text(markdown).split(/\r?\n/);
  const tables = [];
  let fence = "";
  let i = 0;
  if (lines[0] && lines[0].trim() === "---") {
    for (i = 1; i < lines.length; i += 1) {
      if (lines[i].trim() === "---") {
        i += 1;
        break;
      }
    }
  }
  for (; i < lines.length; i += 1) {
    const marker = codeFence(lines[i]);
    if (marker) {
      if (!fence) fence = marker;
      else if (fence === marker) fence = "";
      continue;
    }
    if (fence) continue;
    const table = parseTableBlock(lines, i);
    if (!table) continue;
    tables.push(table);
    i = table.end;
  }
  return tables;
}

function displayWidth(value) {
  return Array.from(text(value)).length;
}

function pad(value, width, align) {
  const missing = Math.max(0, width - displayWidth(value));
  if (align === "right") return " ".repeat(missing) + value;
  if (align === "center") {
    const left = Math.floor(missing / 2);
    return " ".repeat(left) + value + " ".repeat(missing - left);
  }
  return value + " ".repeat(missing);
}

function delimiterCell(align, width) {
  if (align === "left") return ":" + "-".repeat(width - 1);
  if (align === "right") return "-".repeat(width - 1) + ":";
  if (align === "center") return ":" + "-".repeat(width - 2) + ":";
  return "-".repeat(width);
}

/** Renders a whole block: all rows are padded to the same column width unless `pad` is false. */
function renderTable(table, options) {
  const padCells = !(options && options.pad === false);
  const columns = Math.max(1, table.columns || table.align.length || 0);
  const rows = (table.rows || []).map((row) => padRow(row, columns));
  const widths = [];
  for (let column = 0; column < columns; column += 1) {
    const alignment = table.align[column];
    // A centered delimiter needs two colons plus at least three hyphens; a
    // left/right delimiter needs one colon plus three hyphens.
    let width = alignment === "center" ? MIN_COLUMN_WIDTH + 2 : alignment === "left" || alignment === "right" ? MIN_COLUMN_WIDTH + 1 : MIN_COLUMN_WIDTH;
    for (const row of rows) width = Math.max(width, displayWidth(row[column]));
    widths.push(width);
  }
  const delimiterWidth = (alignment) => (alignment === "center" ? MIN_COLUMN_WIDTH + 2 : alignment === "left" || alignment === "right" ? MIN_COLUMN_WIDTH + 1 : MIN_COLUMN_WIDTH);
  const indent = text(table.indent).replace(/\t/g, "    ");
  const lines = [];
  rows.forEach((row, index) => {
    const cells = row.map((cell, column) => (padCells ? pad(text(cell), widths[column], table.align[column]) : text(cell)));
    lines.push(indent + "| " + cells.join(" | ") + " |");
    if (index === (table.headerCount || 1) - 1) {
      const delimiter = table.align.map((align, column) => delimiterCell(align, padCells ? widths[column] : delimiterWidth(align)));
      lines.push(indent + "| " + delimiter.join(" | ") + " |");
    }
  });
  return lines;
}

/**
 * Inserts, deletes or moves one row or column. The header row stays the first
 * row, and every structural change keeps the table rectangular and aligned.
 */
function structureTable(table, action, row, column) {
  if (!table || !Array.isArray(table.rows) || !Array.isArray(table.align)) {
    return { ok: false, reason: "table", message: "The table is no longer available." };
  }
  const columns = Math.max(1, table.columns || table.align.length || 0);
  const rowCount = table.rows.length;
  const rows = table.rows.map((cells) => padRow(cells, columns));
  const align = table.align.slice(0, columns);
  while (align.length < columns) align.push("none");
  const hasRow = Number.isInteger(row) && row >= 0 && row < rowCount;
  const hasColumn = Number.isInteger(column) && column >= 0 && column < columns;

  if (action === "row-insert-below") {
    if (!hasRow) return { ok: false, reason: "row", message: "That table row is no longer available." };
    if (rowCount >= MAX_TABLE_ROWS) return { ok: false, reason: "limit", message: `A table cannot have more than ${MAX_TABLE_ROWS} rows.` };
    rows.splice(row + 1, 0, new Array(columns).fill(""));
  } else if (action === "row-delete") {
    if (!hasRow) return { ok: false, reason: "row", message: "That table row is no longer available." };
    if (row === 0) return { ok: false, reason: "header", message: "The header row cannot be deleted." };
    rows.splice(row, 1);
  } else if (action === "row-move-up" || action === "row-move-down") {
    if (!hasRow) return { ok: false, reason: "row", message: "That table row is no longer available." };
    if (row === 0) return { ok: false, reason: "header", message: "The header row cannot be moved." };
    const target = row + (action === "row-move-up" ? -1 : 1);
    if (target < 1 || target >= rowCount) return { ok: false, reason: "boundary", message: `That row is already ${action === "row-move-up" ? "first" : "last"}.` };
    const [moved] = rows.splice(row, 1);
    rows.splice(target, 0, moved);
  } else if (action === "column-insert-right") {
    if (!hasColumn) return { ok: false, reason: "column", message: "That table column is no longer available." };
    if (columns >= MAX_TABLE_COLUMNS) return { ok: false, reason: "limit", message: `A table cannot have more than ${MAX_TABLE_COLUMNS} columns.` };
    for (const cells of rows) cells.splice(column + 1, 0, "");
    align.splice(column + 1, 0, "none");
  } else if (action === "column-delete") {
    if (!hasColumn) return { ok: false, reason: "column", message: "That table column is no longer available." };
    if (columns <= 1) return { ok: false, reason: "limit", message: "A table needs at least one column." };
    for (const cells of rows) cells.splice(column, 1);
    align.splice(column, 1);
  } else if (action === "column-move-left" || action === "column-move-right") {
    if (!hasColumn) return { ok: false, reason: "column", message: "That table column is no longer available." };
    const target = column + (action === "column-move-left" ? -1 : 1);
    if (target < 0 || target >= columns) return { ok: false, reason: "boundary", message: `That column is already ${action === "column-move-left" ? "leftmost" : "rightmost"}.` };
    for (const cells of rows) {
      const [moved] = cells.splice(column, 1);
      cells.splice(target, 0, moved);
    }
    const [movedAlign] = align.splice(column, 1);
    align.splice(target, 0, movedAlign);
  } else if (action === "row-insert-above") {
    if (!hasRow) return { ok: false, reason: "row", message: "That table row is no longer available." };
    if (rowCount >= MAX_TABLE_ROWS) return { ok: false, reason: "limit", message: `A table cannot have more than ${MAX_TABLE_ROWS} rows.` };
    rows.splice(row, 0, new Array(columns).fill(""));
  } else if (action === "column-insert-left") {
    if (!hasColumn) return { ok: false, reason: "column", message: "That table column is no longer available." };
    if (columns >= MAX_TABLE_COLUMNS) return { ok: false, reason: "limit", message: `A table cannot have more than ${MAX_TABLE_COLUMNS} columns.` };
    for (const cells of rows) cells.splice(column, 0, "");
    align.splice(column, 0, "none");
  } else {
    return { ok: false, reason: "action", message: "Unknown table action." };
  }

  const nextRows = rows.map((cells) => padRow(cells, align.length));
  return {
    ok: true,
    table: { ...table, columns: align.length, align, rows: nextRows, header: nextRows[0].slice() },
  };
}

/** Creates the compact controls beside a table; hidden until hover or focus. */
function createTableToolbar(tableEl, run) {
  const doc = tableEl && (tableEl.ownerDocument || (typeof document !== "undefined" ? document : null));
  if (!doc || typeof doc.createElement !== "function") return null;
  const toolbar = doc.createElement("div");
  toolbar.className = "qt-table-toolbar";
  toolbar.setAttribute("role", "toolbar");
  toolbar.setAttribute("aria-label", "Table controls");
  toolbar.setAttribute("contenteditable", "false");

  for (const action of TABLE_TOOLBAR_ACTIONS) {
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "qt-table-toolbar-button";
    button.setAttribute("data-qt-table-action", action.id);
    button.setAttribute("aria-label", action.label);
    button.setAttribute("title", action.label);
    button.textContent = action.short;
    if (typeof button.addEventListener === "function") {
      button.addEventListener("pointerdown", (event) => {
        // Keep the active cell focused so its pending text is committed with the action.
        if (event && event.preventDefault) event.preventDefault();
      });
      button.addEventListener("click", (event) => {
        if (event && event.preventDefault) event.preventDefault();
        run(action);
      });
    }
    toolbar.appendChild(button);
  }

  if (typeof tableEl.insertAdjacentElement === "function") tableEl.insertAdjacentElement("afterend", toolbar);
  else if (tableEl.parentNode && typeof tableEl.parentNode.insertBefore === "function") tableEl.parentNode.insertBefore(toolbar, tableEl.nextSibling);
  else return null;
  return toolbar;
}

const CELL_FORMATS = {
  bold: { marker: "**", character: "*" },
  italic: { marker: "*", character: "*" },
  code: { marker: "`", character: "`" },
  strikethrough: { marker: "~~", character: "~" },
};

function markerRun(value, character, fromEnd) {
  let count = 0;
  if (fromEnd) {
    for (let i = value.length - 1; i >= 0 && value[i] === character; i -= 1) count += 1;
  } else {
    for (let i = 0; i < value.length && value[i] === character; i += 1) count += 1;
  }
  return count;
}

/**
 * Toggles one whole-cell format without losing the source text. Star markers are
 * treated as layers so bold+italic (`***text***`) can be toggled back cleanly.
 */
function toggleCellFormat(value, format) {
  const base = text(value).trim();
  if (!base.replace(/[*_~`]/g, "").trim()) {
    return { ok: false, reason: "empty", message: "That cell has no text to format." };
  }
  const spec = CELL_FORMATS[format];
  if (!spec) return { ok: false, reason: "format", message: "Unknown table cell format." };
  const leading = markerRun(base, spec.character, false);
  const trailing = markerRun(base, spec.character, true);
  if (leading !== trailing) {
    return { ok: false, reason: "markers", message: "This cell has unmatched emphasis markers; edit it in source mode." };
  }

  let next = "";
  if (format === "bold") {
    next = leading >= 2 ? base.slice(2, -2) : `**${base}**`;
  } else if (format === "italic") {
    if (leading === 1 || leading === 3) next = base.slice(1, -1);
    else if (leading === 0 || leading === 2) next = `*${base}*`;
    else return { ok: false, reason: "markers", message: "This cell has complex emphasis; edit it in source mode." };
  } else if (format === "code") {
    if (leading === 1) next = base.slice(1, -1);
    else if (leading === 0) next = `\`${base}\``;
    else return { ok: false, reason: "markers", message: "This cell uses a multi-backtick code span; edit it in source mode." };
  } else if (format === "strikethrough") {
    if (leading >= 2) next = base.slice(2, -2);
    else if (leading === 0) next = `~~${base}~~`;
    else return { ok: false, reason: "markers", message: "This cell has unmatched emphasis markers; edit it in source mode." };
  }
  return { ok: true, value: next, changed: next !== base };
}

function hasColumn(table, column) {
  return Number.isInteger(column) && column >= 0 && column < table.columns;
}

/** Toggles bold/italic/code/strikethrough on one source cell. */
function formatTableCell(table, row, column, format) {
  if (!table || !Array.isArray(table.rows) || !Array.isArray(table.align)) {
    return { ok: false, reason: "table", message: "The table is no longer available." };
  }
  if (!Number.isInteger(row) || row < 0 || row >= table.rows.length) {
    return { ok: false, reason: "row", message: "That table row is no longer available." };
  }
  if (!hasColumn(table, column)) {
    return { ok: false, reason: "column", message: "That table column is no longer available." };
  }
  const source = table.rows[row][column] || "";
  const toggled = toggleCellFormat(source, format);
  if (!toggled.ok) return toggled;
  const rows = table.rows.map((cells) => cells.slice());
  rows[row][column] = escapeCell(toggled.value);
  return { ok: true, changed: rows[row][column] !== source, table: { ...table, rows, header: rows[0].slice() } };
}

/** Sets one column's delimiter alignment: left, center, right or default. */
function alignTableColumn(table, column, alignment) {
  if (!table || !Array.isArray(table.align)) {
    return { ok: false, reason: "table", message: "The table is no longer available." };
  }
  if (!hasColumn(table, column)) {
    return { ok: false, reason: "column", message: "That table column is no longer available." };
  }
  if (!["left", "center", "right", "none"].includes(alignment)) {
    return { ok: false, reason: "alignment", message: "Choose left, center, right or default alignment." };
  }
  const align = table.align.slice();
  const changed = align[column] !== alignment;
  align[column] = alignment;
  return { ok: true, changed, table: { ...table, align } };
}

function sortableNumber(value) {
  const raw = text(value).trim();
  if (!raw) return null;
  const commaGrouped = /^[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?(?:[eE][+-]?\d+)?$/.test(raw);
  const plain = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw);
  if (!commaGrouped && !plain) return null;
  const number = Number(raw.replace(/,/g, ""));
  return Number.isFinite(number) ? number : null;
}

/**
 * Stable body-row sort. The header stays at row 0; numeric-looking cells compare
 * by value, other cells as text, blanks stay last, and ties keep source order.
 */
const MERGE_LEFT = "^";
const MERGE_UP = "\"";

/** A cell is a merge marker only when it holds exactly the marker. */
function mergeMarker(value) {
  const cell = text(value).trim();
  if (cell === MERGE_LEFT) return MERGE_LEFT;
  if (cell === MERGE_UP) return MERGE_UP;
  return "";
}

/**
 * Reads a table's merge markers: `^` joins a cell to the run on its left
 * (colspan) and `"` joins it to the cell above (rowspan). Returns the spans to
 * draw and the markers to hide, or a refusal when a marker has nothing to join.
 * The markers stay in the source, so formatting, sorting and every write path
 * round-trip the merged layout unchanged.
 */
function tableMerges(table) {
  if (!table || !Array.isArray(table.rows) || !table.rows.length) {
    return { ok: false, reason: "table", message: "The table is no longer available." };
  }
  const rows = table.rows;
  const owner = rows.map(() => []);
  const spans = [];
  const hidden = [];
  for (let row = 0; row < rows.length; row += 1) {
    const rowCells = Array.isArray(rows[row]) ? rows[row] : [];
    for (let column = 0; column < rowCells.length; column += 1) {
      const marker = mergeMarker(rowCells[column]);
      if (!marker) {
        const span = { row, column, colspan: 1, rowspan: 1 };
        spans.push(span);
        owner[row][column] = span;
        continue;
      }
      if (marker === MERGE_LEFT) {
        if (column === 0) {
          return { ok: false, reason: "merge", message: "A cell can only merge left when a cell sits to its left." };
        }
        const left = owner[row][column - 1];
        if (!left) {
          return { ok: false, reason: "merge", message: "A merged cell needs a plain cell to its left." };
        }
        left.colspan += 1;
        owner[row][column] = left;
        hidden.push({ row, column });
        continue;
      }
      const above = row > 0 ? owner[row - 1][column] : null;
      if (!above) {
        return { ok: false, reason: "merge", message: "A cell can only merge up when a cell sits above it." };
      }
      above.rowspan += 1;
      owner[row][column] = above;
      hidden.push({ row, column });
    }
  }
  return { ok: true, spans, hidden };
}

function sortTable(table, column, direction) {
  if (!table || !Array.isArray(table.rows) || !Array.isArray(table.align)) {
    return { ok: false, reason: "table", message: "The table is no longer available." };
  }
  if (!["asc", "desc"].includes(direction)) {
    return { ok: false, reason: "direction", message: "Choose ascending or descending sort order." };
  }
  if (!hasColumn(table, column)) {
    return { ok: false, reason: "column", message: "That table column is no longer available." };
  }
  if (table.rows.length < 2) {
    return { ok: false, reason: "no-rows", message: "A table needs at least one body row to sort." };
  }
  const body = table.rows.slice(1).map((cells, index) => ({ cells, index, value: cells[column] || "" }));
  if (!body.some((entry) => text(entry.value).trim() !== "")) {
    return { ok: false, reason: "empty", message: "This column has no values to sort." };
  }
  body.sort((a, b) => {
    const aBlank = text(a.value).trim() === "";
    const bBlank = text(b.value).trim() === "";
    if (aBlank !== bBlank) {
      // Upstream treats an empty cell as the smallest value, so blanks lead an
      // ascending sort and trail a descending one. Equal values keep source order.
      const blankFirst = aBlank ? -1 : 1;
      return direction === "asc" ? blankFirst : -blankFirst;
    }
    if (aBlank) return a.index - b.index;
    const aNumber = sortableNumber(a.value);
    const bNumber = sortableNumber(b.value);
    let result = 0;
    if (aNumber !== null && bNumber !== null) result = aNumber - bNumber;
    else if (aNumber !== null) result = -1;
    else if (bNumber !== null) result = 1;
    else result = text(a.value).trim().localeCompare(text(b.value).trim(), undefined, { sensitivity: "base" });
    if (result !== 0) result = direction === "asc" ? result : -result;
    return result !== 0 ? result : a.index - b.index;
  });
  const rows = [table.rows[0].slice(), ...body.map((entry) => entry.cells.slice())];
  const changed = rows.some((row, rowIndex) => row.some((value, columnIndex) => value !== table.rows[rowIndex][columnIndex]));
  return { ok: true, changed, table: { ...table, rows, header: rows[0].slice() } };
}

/**
 * Splits pasted CSV or TSV into raw rows. Quoted fields keep pipes, commas,
 * tabs and line breaks; `""` inside a quoted field is one quote. The delimiter
 * is a tab when the first line has one, otherwise a comma. A trailing newline
 * does not add an empty row, and an unclosed quote or an empty paste refuses.
 */
function parseDelimitedTable(input) {
  const source = text(input).replace(/^\uFEFF/, "");
  if (!source.trim()) return { ok: false, reason: "empty", message: "Paste CSV or TSV rows to import." };
  const firstLine = source.split(/\r?\n/, 1)[0];
  const separator = firstLine.includes("\t") ? "\t" : ",";
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  let closed = false;
  for (let i = 0; i < source.length; i += 1) {
    const character = source[i];
    if (quoted) {
      if (character === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
          closed = true;
        }
      } else {
        cell += character;
      }
      continue;
    }
    if (character === '"' && cell === "") {
      quoted = true;
      closed = false;
      continue;
    }
    if (character === separator && !closed) {
      row.push(cell);
      cell = "";
      continue;
    }
    if (character === "\r") continue;
    if (character === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      closed = false;
      continue;
    }
    closed = false;
    cell += character;
  }
  if (quoted) return { ok: false, reason: "quote", message: "A quoted field in the pasted data is not closed." };
  row.push(cell);
  rows.push(row);
  if (/[\r\n]$/.test(source) && rows.length > 1) rows.pop();
  while (rows.length > 1 && rows[rows.length - 1].every((value) => text(value).trim() === "")) rows.pop();

  if (rows.length > MAX_TABLE_ROWS) {
    return { ok: false, reason: "limit", message: `A table cannot have more than ${MAX_TABLE_ROWS} rows.` };
  }
  for (const cells of rows) {
    if (cells.length > MAX_TABLE_COLUMNS) {
      return { ok: false, reason: "limit", message: `A table cannot have more than ${MAX_TABLE_COLUMNS} columns.` };
    }
    for (const value of cells) {
      if (text(value).length > MAX_CELL_LENGTH) {
        return { ok: false, reason: "limit", message: `A table cell cannot be longer than ${MAX_CELL_LENGTH} characters.` };
      }
    }
  }
  return { ok: true, delimiter: separator === "\t" ? "tsv" : "csv", rows };
}

/** True while the first row carries no text, so the table is a placeholder. */
function headerRowState(table) {
  if (!table || !Array.isArray(table.rows) || !table.rows.length) return "off";
  return table.rows[0].every((cell) => text(cell).trim() === "") ? "off" : "on";
}

/** Row, body-row and column counts plus the header state, for the toolbar readout. */
function tableCounts(table) {
  if (!table || !Array.isArray(table.rows)) return { ok: false, reason: "table", message: "The table is no longer available." };
  const columns = Math.max(1, table.columns || (Array.isArray(table.align) ? table.align.length : 0) || 1);
  const rows = table.rows.length;
  const bodyRows = Math.max(0, rows - 1);
  const header = headerRowState(table);
  return {
    ok: true,
    rows,
    bodyRows,
    columns,
    header,
    label: `${columns} ${columns === 1 ? "column" : "columns"}, ${bodyRows} body ${bodyRows === 1 ? "row" : "rows"}, header row ${header}`,
  };
}

/**
 * Turns pasted CSV/TSV into table rows through `escapeCell`, so a comma or a
 * tab never splits a cell and a pipe never starts a column. `replace` swaps the
 * body rows, `append` adds below them. A placeholder table with a blank header
 * and no body takes the pasted shape: its first row becomes the header.
 */
function importTableData(table, input, options) {
  if (!table || !Array.isArray(table.rows) || !Array.isArray(table.align)) {
    return { ok: false, reason: "table", message: "The table is no longer available." };
  }
  const mode = text(options && options.mode) || "replace";
  if (mode !== "append" && mode !== "replace") {
    return { ok: false, reason: "mode", message: "Choose whether to add the pasted rows or replace the table with them." };
  }
  const parsed = parseDelimitedTable(input);
  if (!parsed.ok) return parsed;

  const columns = Math.max(1, table.columns || table.align.length || 1);
  const rows = table.rows.map((cells) => padRow(cells, columns));
  const placeholder = headerRowState(table) === "off" && rows.length <= 1;
  const imported = parsed.rows.map((cells) => cells.map((value) => escapeCell(value)));

  if (placeholder) {
    const width = Math.max(...imported.map((cells) => cells.length));
    if (width > MAX_TABLE_COLUMNS) {
      return { ok: false, reason: "limit", message: `A table cannot have more than ${MAX_TABLE_COLUMNS} columns.` };
    }
    const nextRows = imported.map((cells) => padRow(cells, width));
    if (nextRows.length > MAX_TABLE_ROWS) {
      return { ok: false, reason: "limit", message: `A table cannot have more than ${MAX_TABLE_ROWS} rows.` };
    }
    const align = nextRows[0].map(() => "none");
    const next = { ...table, columns: width, align, rows: nextRows, header: nextRows[0].slice() };
    return { ok: true, changed: true, table: next, imported: nextRows.length, delimiter: parsed.delimiter };
  }

  const widest = imported.reduce((max, cells) => Math.max(max, cells.length), 0);
  if (widest > columns) {
    return {
      ok: false,
      reason: "columns",
      message: `This table has ${columns} ${columns === 1 ? "column" : "columns"}, but the pasted data has ${widest}.`,
    };
  }
  const body = imported.map((cells) => padRow(cells, columns));
  const nextRows = mode === "replace" ? [rows[0].slice(), ...body] : [...rows, ...body];
  if (nextRows.length > MAX_TABLE_ROWS) {
    return { ok: false, reason: "limit", message: `A table cannot have more than ${MAX_TABLE_ROWS} rows.` };
  }
  const next = { ...table, columns, align: table.align.slice(0, columns), rows: nextRows, header: nextRows[0].slice() };
  while (next.align.length < columns) next.align.push("none");
  return { ok: true, changed: !sameRows(table.rows, nextRows, columns), table: next, imported: body.length, delimiter: parsed.delimiter };
}

function sameRows(a, b, columns) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (let row = 0; row < a.length; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (text((a[row] || [])[column]) !== text((b[row] || [])[column])) return false;
    }
  }
  return true;
}

/**
 * Swaps rows and columns. The first column becomes the new header and every
 * other column becomes one body row. Alignment belongs to the old columns, so
 * the transposed table starts with default alignment on every column.
 */
function transposeTable(table) {
  if (!table || !Array.isArray(table.rows) || !Array.isArray(table.align)) {
    return { ok: false, reason: "table", message: "The table is no longer available." };
  }
  const columns = Math.max(1, table.columns || table.align.length || 1);
  const rows = table.rows.map((cells) => padRow(cells, columns));
  if (rows.length < 2) return { ok: false, reason: "no-rows", message: "A table needs at least one body row to transpose." };
  if (rows.length > MAX_TABLE_COLUMNS) {
    return { ok: false, reason: "limit", message: `A transposed table would have ${rows.length} columns, but a table cannot have more than ${MAX_TABLE_COLUMNS}.` };
  }
  if (columns > MAX_TABLE_ROWS) {
    return { ok: false, reason: "limit", message: `A transposed table would have ${columns} rows, but a table cannot have more than ${MAX_TABLE_ROWS}.` };
  }
  const nextRows = [rows.map((cells) => cells[0])];
  for (let column = 1; column < columns; column += 1) nextRows.push(rows.map((cells) => cells[column]));
  const align = nextRows[0].map(() => "none");
  return {
    ok: true,
    changed: !sameRows(table.rows, nextRows, rows.length),
    table: { ...table, columns: rows.length, align, rows: nextRows, header: nextRows[0].slice() },
  };
}

/**
 * Moves the first row between the header and the body. GFM always renders row 0
 * as the header, so "off" installs a blank header row and pushes the old header
 * into the body (nothing is lost), and "on" promotes the first body row back.
 * One toggle is undone by the next, and a table with no body row cannot gain a
 * header because there is no row to promote.
 */
function toggleHeaderRow(table) {
  if (!table || !Array.isArray(table.rows) || !Array.isArray(table.align)) {
    return { ok: false, reason: "table", message: "The table is no longer available." };
  }
  const columns = Math.max(1, table.columns || table.align.length || 1);
  const rows = table.rows.map((cells) => padRow(cells, columns));
  if (headerRowState(table) === "off") {
    if (rows.length < 2) return { ok: false, reason: "no-rows", message: "This table has no body row to use as its header." };
    const nextRows = rows.slice(1);
    const align = table.align.slice(0, columns);
    while (align.length < columns) align.push("none");
    return {
      ok: true,
      changed: true,
      header: "on",
      table: { ...table, columns, align, rows: nextRows, header: nextRows[0].slice() },
    };
  }
  if (rows.length >= MAX_TABLE_ROWS) {
    return { ok: false, reason: "limit", message: `A table cannot have more than ${MAX_TABLE_ROWS} rows.` };
  }
  const align = table.align.slice(0, columns);
  while (align.length < columns) align.push("none");
  const nextRows = [new Array(columns).fill(""), ...rows];
  return {
    ok: true,
    changed: true,
    header: "off",
    table: { ...table, columns, align, rows: nextRows, header: nextRows[0].slice() },
  };
}

/** True when a line is a TBLFM comment attached to the table above it. */
function isFormulaLine(line) {
  return /^\s*(?:<!--\s*TBLFM:|#\+TBLFM:)/i.test(text(line));
}

/** The table whose lines, or attached TBLFM comments, cover a zero-based line. */
function tableAtLine(markdown, line) {
  if (!Number.isInteger(line) || line < 0) return null;
  const source = text(markdown);
  const lines = source.split(/\r?\n/);
  for (const table of parseTables(source)) {
    if (line >= table.start && line <= table.end) return table;
    for (let i = table.end + 1; i < lines.length && i <= table.end + 4; i += 1) {
      if (!isFormulaLine(lines[i])) break;
      if (i === line) return table;
    }
  }
  return null;
}

/** Trims one raw cell span and keeps where its text starts. */
function cellSpan(raw, from, to) {
  let start = from;
  let end = to;
  while (start < end && /\s/.test(raw[start])) start += 1;
  while (end > start && /\s/.test(raw[end - 1])) end -= 1;
  return { start, end, text: raw.slice(start, end) };
}

/** Character offsets of every cell on one row, without the outer pipes. */
function rowCellSpans(line) {
  const raw = text(line);
  const indent = (raw.match(/^\s*/) || [""])[0].length;
  const spans = [];
  let index = indent;
  if (raw[index] === "|") index += 1;
  let start = index;
  let escaped = false;
  let ticks = 0;
  for (; index < raw.length; index += 1) {
    const character = raw[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (character === "`") {
      let run = 1;
      while (raw[index + run] === "`") run += 1;
      if (!ticks) ticks = run;
      else if (ticks === run) ticks = 0;
      index += run - 1;
      continue;
    }
    if (character === "|" && ticks === 0) {
      spans.push(cellSpan(raw, start, index));
      start = index + 1;
      if (index === raw.length - 1) return spans;
    }
  }
  if (start <= raw.length) spans.push(cellSpan(raw, start, raw.length));
  return spans;
}

/** Line number of a zero-based row: the header sits at the top, then the delimiter. */
function tableRowLine(table, row) {
  return row === 0 ? table.start : table.start + row + 1;
}

/** Zero-based row index for a line inside the table, or -1. */
function tableRowIndex(table, line) {
  if (!table || !Number.isInteger(line)) return -1;
  if (line === table.start) return 0;
  const row = line - table.start - 1;
  return row >= 1 && row < table.rows.length ? row : -1;
}

/** Row and column under a line/character pair inside the table. */
function cellAtLine(markdown, line, ch) {
  const source = text(markdown);
  const table = tableAtLine(source, line);
  if (!table) return null;
  const row = tableRowIndex(table, line);
  if (row < 0) return null;
  const spans = rowCellSpans(source.split(/\r?\n/)[line]);
  let column = 0;
  for (let i = 0; i < spans.length && i < table.columns; i += 1) {
    if (Number.isInteger(ch) && ch >= spans[i].start) column = i;
  }
  return { table, row, column, spans };
}

/** Next cell's line and character, wrapping to the next row and then a new row. */
function nextCellTarget(markdown, line, ch) {
  const source = text(markdown);
  const at = cellAtLine(source, line, ch);
  if (!at) return { ok: false, reason: "not-table", message: "The cursor is not in a table." };
  const lines = source.split(/\r?\n/);
  if (at.column + 1 < at.table.columns) {
    const next = rowCellSpans(lines[line])[at.column + 1];
    return { ok: true, line, ch: next ? next.start : text(lines[line]).length };
  }
  // Upstream's next cell adds a column when Tab runs past the last header
  // cell, which is how headings are typed in.
  if (at.row === 0) return { ok: true, addColumn: true, table: at.table, row: 0, column: at.table.columns, line, ch };
  const row = at.row + 1;
  if (row < at.table.rows.length) {
    const targetLine = tableRowLine(at.table, row);
    const spans = rowCellSpans(lines[targetLine]);
    return { ok: true, line: targetLine, ch: spans[0] ? spans[0].start : 0 };
  }
  return { ok: true, append: true, table: at.table, row: at.row, column: at.column, line, ch };
}

/** Previous cell's line and character, wrapping back to the previous row. */
function previousCellTarget(markdown, line, ch) {
  const source = text(markdown);
  const at = cellAtLine(source, line, ch);
  if (!at) return { ok: false, reason: "not-table", message: "The cursor is not in a table." };
  const lines = source.split(/\r?\n/);
  if (at.column > 0) {
    const previous = rowCellSpans(lines[line])[at.column - 1];
    return { ok: true, line, ch: previous ? previous.start : 0 };
  }
  if (at.row > 0) {
    const targetLine = tableRowLine(at.table, at.row - 1);
    const spans = rowCellSpans(lines[targetLine]);
    const last = spans[Math.min(spans.length, at.table.columns) - 1];
    return { ok: true, line: targetLine, ch: last ? last.start : 0 };
  }
  return { ok: false, reason: "boundary", message: "The cursor is already in the first cell." };
}

/** Same column on the next row, asking for a new row at the end of the table. */
function nextRowTarget(markdown, line, ch) {
  const source = text(markdown);
  const at = cellAtLine(source, line, ch);
  if (!at) return { ok: false, reason: "not-table", message: "The cursor is not in a table." };
  const lines = source.split(/\r?\n/);
  const row = at.row + 1;
  if (row < at.table.rows.length) {
    const targetLine = tableRowLine(at.table, row);
    const spans = rowCellSpans(lines[targetLine]);
    const target = spans[Math.min(at.column, Math.max(0, spans.length - 1))];
    return { ok: true, line: targetLine, ch: target ? target.start : 0 };
  }
  return { ok: true, append: true, table: at.table, row: at.row, column: at.column, line, ch };
}

/** Same column on the previous row. */
function previousRowTarget(markdown, line, ch) {
  const source = text(markdown);
  const at = cellAtLine(source, line, ch);
  if (!at) return { ok: false, reason: "not-table", message: "The cursor is not in a table." };
  if (at.row <= 0) return { ok: false, reason: "boundary", message: "The cursor is already in the first row." };
  const lines = source.split(/\r?\n/);
  const targetLine = tableRowLine(at.table, at.row - 1);
  const spans = rowCellSpans(lines[targetLine]);
  const target = spans[Math.min(at.column, Math.max(0, spans.length - 1))];
  return { ok: true, line: targetLine, ch: target ? target.start : 0 };
}

/** The line just after the table (and its TBLFM comments), adding one if needed. */
function escapeTableTarget(markdown, line) {
  const source = text(markdown);
  const table = tableAtLine(source, line);
  if (!table) return { ok: false, reason: "not-table", message: "The cursor is not in a table." };
  const lines = source.split(/\r?\n/);
  let end = table.end;
  while (end + 1 < lines.length && isFormulaLine(lines[end + 1])) end += 1;
  const target = end + 1;
  if (target >= lines.length) return { ok: true, line: target, ch: 0, insert: true };
  if (!text(lines[target]).trim()) return { ok: true, line: target, ch: 0, insert: false };
  return { ok: true, line: target, ch: 0, insert: true };
}

/** Adds one blank body row and returns where it sits. */
function appendTableRow(markdown, line) {
  const source = text(markdown);
  const table = tableAtLine(source, line);
  if (!table) return { ok: false, reason: "not-table", message: "The cursor is not in a table." };
  const change = structureTable(table, "row-insert-below", table.rows.length - 1, 0);
  if (!change.ok) return change;
  const update = tableBlockUpdate(source, table, change.table);
  return { ...update, changed: true, rowLine: table.end + 1, column: 0 };
}

/** True for a line that starts with a table pipe, as upstream reads a table. */
function isTableRowLine(line) {
  return /^\s*\|/.test(text(line));
}

/**
 * A table being written but not finished: one or more pipe lines with no
 * delimiter row. Upstream treats this as a table and completes it on Tab,
 * which is how a bare `|` grows into a table.
 */
function tableDraftAtLine(markdown, line) {
  if (!Number.isInteger(line) || line < 0) return null;
  const lines = text(markdown).split(/\r?\n/);
  if (line >= lines.length || !isTableRowLine(lines[line])) return null;
  let start = line;
  while (start > 0 && isTableRowLine(lines[start - 1])) start -= 1;
  let end = line;
  while (end + 1 < lines.length && isTableRowLine(lines[end + 1])) end += 1;
  const rows = [];
  for (let i = start; i <= end; i += 1) {
    const parsed = splitTableRow(lines[i]);
    if (!parsed || !parsed.cells.length) return null;
    // A delimiter inside the run means this is a finished (or malformed) table.
    if (isDelimiterRow(parsed.cells)) return null;
    rows.push(parsed.cells);
  }
  if (parseTableBlock(lines, start)) return null;
  const columns = Math.max(1, ...rows.map((row) => row.length));
  if (columns > MAX_TABLE_COLUMNS || rows.length + 1 > MAX_TABLE_ROWS) return null;
  return {
    start,
    end,
    indent: ((splitTableRow(lines[start]) || {}).indent || "").replace(/\t/g, "    "),
    columns,
    rows: rows.map((row) => padRow(row, columns)),
    header: padRow(rows[0], columns),
  };
}

/**
 * Turns a draft into a table: header, delimiter row, and one more empty header
 * cell when a heading was already typed.
 */
function startTable(markdown, line, options) {
  const source = text(markdown);
  const draft = tableDraftAtLine(source, line);
  if (!draft) return { ok: false, reason: "not-draft", message: "There is no table starting on this line." };
  const table = {
    start: draft.start,
    end: draft.end,
    indent: draft.indent,
    align: new Array(draft.columns).fill("none"),
    columns: draft.columns,
    rows: draft.rows,
    header: draft.header,
    headerCount: 1,
  };
  const typed = draft.header.some((cell) => text(cell).trim() !== "");
  const addColumn = typed && !(options && options.addColumn === false);
  const change = addColumn ? structureTable(table, "column-insert-right", 0, draft.columns - 1) : { ok: true, table };
  if (!change.ok) return change;
  const update = tableBlockUpdate(source, table, change.table, options);
  const eol = source.includes("\r\n") ? "\r\n" : "\n";
  const spans = rowCellSpans(update.replacement.split(eol)[0]);
  const column = addColumn ? change.table.columns - 1 : 0;
  const target = spans[column] || spans[0];
  return { ...update, changed: true, rowLine: draft.start, column, ch: target ? target.start : 0 };
}

/** Adds one empty column at the right edge and puts the cursor in its header cell. */
function addTableColumn(markdown, line, options) {
  const source = text(markdown);
  const table = tableAtLine(source, line);
  if (!table) return { ok: false, reason: "not-table", message: "The cursor is not in a table." };
  const change = structureTable(table, "column-insert-right", 0, table.columns - 1);
  if (!change.ok) return change;
  const update = tableBlockUpdate(source, table, change.table, options);
  const eol = source.includes("\r\n") ? "\r\n" : "\n";
  const spans = rowCellSpans(update.replacement.split(eol)[0]);
  const target = spans[table.columns];
  return { ...update, changed: true, rowLine: table.start, column: table.columns, ch: target ? target.start : 0 };
}

/** Re-renders the table under the cursor with padded, aligned cells. */
function formatTableAt(markdown, line, options) {
  const source = text(markdown);
  const table = tableAtLine(source, line);
  if (!table) return { ok: false, reason: "not-table", message: "The cursor is not in a table." };
  const update = tableBlockUpdate(source, table, table, options);
  const original = source.split(/\r?\n/).slice(table.start, table.end + 1).join("\n");
  return { ...update, changed: update.replacement !== original, table };
}

/** Re-renders every table in the note, from the bottom so line numbers stay valid. */
function formatAllTables(markdown, options) {
  const source = text(markdown);
  const tables = parseTables(source);
  if (!tables.length) return { ok: false, reason: "none", message: "This note has no tables to format." };
  let next = source;
  for (let index = tables.length - 1; index >= 0; index -= 1) {
    next = tableBlockUpdate(next, tables[index], tables[index], options).text;
  }
  return { ok: true, text: next, changed: next !== source, tables: tables.length };
}

/** CSV for one parsed table, optionally leaving the header row out. */
function tableCsvFromTable(table, options) {
  if (!table || !Array.isArray(table.rows) || !table.rows.length) {
    return { ok: false, reason: "table", message: "The table is no longer available." };
  }
  const includeHeader = !(options && options.header === false);
  const delimiter = options && options.delimiter === "\t" ? "\t" : ",";
  const rows = includeHeader ? table.rows : table.rows.slice(1);
  const csv = rows.map((row) => row.map((cell) => tableFormulas.csvCell(cell, delimiter)).join(delimiter)).join("\n") + "\n";
  return { ok: true, csv, header: includeHeader, delimiter };
}

/** Escapes a committed cell so a typed pipe becomes data, not a new column. */
function escapeCell(value) {
  let cell = text(value).replace(/\r\n?/g, "\n").replace(/\n+/g, " ").trim().slice(0, MAX_CELL_LENGTH);
  let escaped = "";
  for (let i = 0; i < cell.length; i += 1) {
    if (cell[i] === "|" && !isEscaped(cell, i)) escaped += "\\";
    escaped += cell[i];
  }
  return escaped;
}

function normalizedCell(value) {
  return text(value)
    .replace(/<[^>]*>/g, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_~`]/g, "")
    .replace(/\\\|/g, "|")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function renderedHeader(tableEl) {
  if (!tableEl) return [];
  let cells = [];
  if (tableEl.tHead && tableEl.tHead.rows && tableEl.tHead.rows[0]) {
    cells = Array.from(tableEl.tHead.rows[0].cells || []);
  } else if (tableEl.rows && tableEl.rows[0]) {
    cells = Array.from(tableEl.rows[0].cells || []).filter((cell) => /^TH$/i.test(cell.tagName || ""));
  } else if (typeof tableEl.querySelectorAll === "function") {
    cells = Array.from(tableEl.querySelectorAll("thead th"));
  }
  return cells.map((cell) => text(cell.textContent).trim());
}

/** Matches a rendered header against the parsed source tables without guessing wildly. */
function findTable(tables, headerTexts, preferredIndex) {
  const list = Array.isArray(tables) ? tables : [];
  if (!list.length) return null;
  const wanted = (Array.isArray(headerTexts) ? headerTexts : []).map(normalizedCell);
  let best = null;
  let bestScore = -1;
  for (let index = 0; index < list.length; index += 1) {
    const table = list[index];
    let score = 0;
    for (let column = 0; column < Math.min(wanted.length, table.header.length); column += 1) {
      if (wanted[column] && wanted[column] === normalizedCell(table.header[column])) score += 2;
    }
    if (wanted.length === table.header.length) score += 1;
    if (score > bestScore) {
      best = table;
      bestScore = score;
    } else if (score === bestScore && preferredIndex === index) {
      best = table;
    }
  }
  if (bestScore <= 0 && Number.isInteger(preferredIndex) && list[preferredIndex]) return list[preferredIndex];
  return best;
}

function sameHeader(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((cell, index) => normalizedCell(cell) === normalizedCell(b[index]));
}

function tableForUpdate(lines, startLine, expected) {
  const direct = parseTableBlock(lines, startLine);
  if (direct && (!expected || sameHeader(direct.header, expected.header))) return direct;
  const tables = parseTables(lines.join("\n"));
  if (!tables.length) return null;
  const byHeader = expected && expected.header ? findTable(tables, expected.header, 0) : null;
  if (byHeader) return byHeader;
  if (expected && Array.isArray(expected.rows) && expected.rows[0]) {
    const header = expected.rows[0];
    const match = findTable(tables, header, 0);
    if (match) return match;
  }
  if (tables.length === 1 && (!expected || tables[0].columns === expected.columns)) return tables[0];
  return null;
}

/** Replaces one source table block and preserves the note's line endings. */
function tableBlockUpdate(source, table, nextTable, options) {
  const eol = source.includes("\r\n") ? "\r\n" : "\n";
  const lines = source.split(/\r?\n/);
  const rendered = renderTable(nextTable, options).join(eol);
  const fullLines = lines.slice(0, table.start).concat(rendered.split(eol), lines.slice(table.end + 1));
  return {
    ok: true,
    table: nextTable,
    startLine: table.start,
    endLine: table.end,
    replacement: rendered,
    text: fullLines.join(eol),
  };
}

/** Edits one cell in the full note text. */
function updateTableText(markdown, startLine, row, column, value, expected) {
  const source = text(markdown);
  const lines = source.split(/\r?\n/);
  const table = tableForUpdate(lines, Number.isInteger(startLine) ? startLine : -1, expected);
  if (!table) return { ok: false, reason: "not-found", message: "This table could not be matched to the note." };
  if (!Number.isInteger(row) || row < 0 || row >= table.rows.length) {
    return { ok: false, reason: "row", message: "That table row is no longer available." };
  }
  if (!Number.isInteger(column) || column < 0 || column >= table.columns) {
    return { ok: false, reason: "column", message: "That table column is no longer available." };
  }

  const nextRows = table.rows.map((cells) => cells.slice());
  const nextValue = escapeCell(value);
  const changed = nextRows[row][column] !== nextValue;
  nextRows[row][column] = nextValue;
  const next = { ...table, rows: nextRows, header: nextRows[0].slice() };
  return { ...tableBlockUpdate(source, table, next), changed };
}

/** Applies one row/column insertion, deletion or move to a source table. */
function updateTableStructure(markdown, startLine, expected, action, row, column) {
  const source = text(markdown);
  const lines = source.split(/\r?\n/);
  const table = tableForUpdate(lines, Number.isInteger(startLine) ? startLine : -1, expected);
  if (!table) return { ok: false, reason: "not-found", message: "This table could not be matched to the note." };
  const change = structureTable(table, action, row, column);
  if (!change.ok) return change;
  return { ...tableBlockUpdate(source, table, change.table), changed: true };
}

/** Applies one cell format to a source table. */
function updateTableFormat(markdown, startLine, expected, row, column, format) {
  const source = text(markdown);
  const lines = source.split(/\r?\n/);
  const table = tableForUpdate(lines, Number.isInteger(startLine) ? startLine : -1, expected);
  if (!table) return { ok: false, reason: "not-found", message: "This table could not be matched to the note." };
  const change = formatTableCell(table, row, column, format);
  if (!change.ok) return change;
  return { ...tableBlockUpdate(source, table, change.table), changed: change.changed };
}

/** Applies one column alignment to a source table. */
function updateTableAlignment(markdown, startLine, expected, column, alignment) {
  const source = text(markdown);
  const lines = source.split(/\r?\n/);
  const table = tableForUpdate(lines, Number.isInteger(startLine) ? startLine : -1, expected);
  if (!table) return { ok: false, reason: "not-found", message: "This table could not be matched to the note." };
  const change = alignTableColumn(table, column, alignment);
  if (!change.ok) return change;
  return { ...tableBlockUpdate(source, table, change.table), changed: change.changed };
}

/** Sorts body rows by one column while leaving the header and following text alone. */
function updateTableSort(markdown, startLine, expected, column, direction) {
  const source = text(markdown);
  const lines = source.split(/\r?\n/);
  const table = tableForUpdate(lines, Number.isInteger(startLine) ? startLine : -1, expected);
  if (!table) return { ok: false, reason: "not-found", message: "This table could not be matched to the note." };
  const change = sortTable(table, column, direction);
  if (!change.ok) return change;
  return { ...tableBlockUpdate(source, table, change.table), changed: change.changed };
}

/** Evaluates the contiguous TBLFM comments that immediately follow one table. */
function updateTableFormulas(markdown, startLine, expected) {
  const source = text(markdown);
  const lines = source.split(/\r?\n/);
  const table = tableForUpdate(lines, Number.isInteger(startLine) ? startLine : -1, expected);
  if (!table) return { ok: false, reason: "not-found", message: "This table could not be matched to the note." };
  const parsed = tableFormulas.parseTableFormulas(lines, table);
  if (!parsed.ok) return parsed;
  const applied = tableFormulas.applyTableFormulas(table, parsed.formulas, escapeCell);
  if (!applied.ok) return applied;
  return { ...tableBlockUpdate(source, table, applied.table), changed: applied.changed };
}

/** Imports pasted CSV/TSV into a source table through the shared write path. */
function updateTableCsvImport(markdown, startLine, expected, input, mode) {
  const source = text(markdown);
  const lines = source.split(/\r?\n/);
  const table = tableForUpdate(lines, Number.isInteger(startLine) ? startLine : -1, expected);
  if (!table) return { ok: false, reason: "not-found", message: "This table could not be matched to the note." };
  const change = importTableData(table, input, { mode });
  if (!change.ok) return change;
  return {
    ...tableBlockUpdate(source, table, change.table),
    changed: change.changed,
    imported: change.imported,
    delimiter: change.delimiter,
  };
}

/** Transposes a source table through the shared write path. */
function updateTableTranspose(markdown, startLine, expected) {
  const source = text(markdown);
  const lines = source.split(/\r?\n/);
  const table = tableForUpdate(lines, Number.isInteger(startLine) ? startLine : -1, expected);
  if (!table) return { ok: false, reason: "not-found", message: "This table could not be matched to the note." };
  const change = transposeTable(table);
  if (!change.ok) return change;
  return { ...tableBlockUpdate(source, table, change.table), changed: change.changed };
}

/** Toggles the header row of a source table through the shared write path. */
function updateTableHeader(markdown, startLine, expected) {
  const source = text(markdown);
  const lines = source.split(/\r?\n/);
  const table = tableForUpdate(lines, Number.isInteger(startLine) ? startLine : -1, expected);
  if (!table) return { ok: false, reason: "not-found", message: "This table could not be matched to the note." };
  const change = toggleHeaderRow(table);
  if (!change.ok) return change;
  return { ...tableBlockUpdate(source, table, change.table), changed: change.changed, header: change.header };
}

/** Serializes the current source table, without its TBLFM comments, as CSV. */
function tableCsvAt(markdown, startLine, expected, options) {
  const source = text(markdown);
  const lines = source.split(/\r?\n/);
  const table = tableForUpdate(lines, Number.isInteger(startLine) ? startLine : -1, expected);
  if (!table) return { ok: false, reason: "not-found", message: "This table could not be matched to the note." };
  const csv = tableCsvFromTable(table, options);
  if (!csv.ok) return csv;
  return { ok: true, csv: csv.csv, header: csv.header, table };
}

/**
 * Where a key should move inside the table. Tab/Shift+Tab and Enter/Shift+Enter
 * stay inside the table; Alt+Arrow keys move one cell. A boundary is reported
 * instead of wrapping so focus cannot jump into unrelated content.
 */
function navigateCell(row, column, rowCount, columnCount, key, shift, alt) {
  if (!Number.isInteger(row) || !Number.isInteger(column) || row < 0 || column < 0) {
    return { ok: false, reason: "bounds" };
  }
  if (!Number.isInteger(rowCount) || !Number.isInteger(columnCount) || row >= rowCount || column >= columnCount) {
    return { ok: false, reason: "bounds" };
  }
  const backward = shift === true;
  let targetRow = row;
  let targetColumn = column;
  if (key === "Tab") {
    const flat = row * columnCount + column + (backward ? -1 : 1);
    if (flat < 0 || flat >= rowCount * columnCount) return { ok: false, reason: "boundary", row, column };
    targetRow = Math.floor(flat / columnCount);
    targetColumn = flat % columnCount;
  } else if (key === "Enter") {
    targetRow = row + (backward ? -1 : 1);
    if (targetRow < 0 || targetRow >= rowCount) return { ok: false, reason: "boundary", row, column };
  } else if (key === "ArrowLeft" || key === "ArrowRight" || key === "ArrowUp" || key === "ArrowDown") {
    if (alt !== true) return { ok: false, reason: "ignored" };
    if (key === "ArrowLeft") targetColumn -= 1;
    else if (key === "ArrowRight") targetColumn += 1;
    else if (key === "ArrowUp") targetRow -= 1;
    else targetRow += 1;
    if (targetRow < 0 || targetColumn < 0 || targetRow >= rowCount || targetColumn >= columnCount) {
      return { ok: false, reason: "boundary", row, column };
    }
  } else {
    return { ok: false, reason: "ignored" };
  }
  return { ok: true, row: targetRow, column: targetColumn, kind: key };
}

function addClass(el, name) {
  if (!el) return;
  if (typeof el.addClass === "function") el.addClass(name);
  else if (el.classList && typeof el.classList.add === "function") el.classList.add(name);
}

function setAttribute(el, name, value) {
  if (!el) return;
  if (typeof el.setAttribute === "function") el.setAttribute(name, String(value));
}

function placeCaretAtEnd(cell) {
  const doc = cell && (cell.ownerDocument || (typeof document !== "undefined" ? document : null));
  if (!doc) return;
  try {
    const range = doc.createRange();
    range.selectNodeContents(cell);
    range.collapse(false);
    const view = doc.defaultView || (typeof window !== "undefined" ? window : null);
    const selection = view && typeof view.getSelection === "function" ? view.getSelection() : null;
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(range);
  } catch (e) {
    // Focus still works without a selection range in a restricted webview.
  }
}

function tableRows(tableEl) {
  if (!tableEl) return [];
  if (tableEl.rows) return Array.from(tableEl.rows);
  if (typeof tableEl.querySelectorAll === "function") return Array.from(tableEl.querySelectorAll("tr"));
  return [];
}

function rowCells(row) {
  if (!row) return [];
  if (row.cells) return Array.from(row.cells);
  if (typeof row.querySelectorAll === "function") return Array.from(row.querySelectorAll("th, td"));
  return [];
}

/**
 * Makes the rendered cells editable and wires commit/navigation. No parallel
 * editor is created: values go through the supplied commit callback, which
 * writes the note's Markdown through the plugin's normal editor path.
 */
function decorateTable(tableEl, options) {
  const opts = options || {};
  const table = opts.table;
  if (!tableEl || !table || !Array.isArray(table.rows)) return null;
  const commit = typeof opts.commit === "function" ? opts.commit : null;
  const structure = typeof opts.structure === "function" ? opts.structure : null;
  const format = typeof opts.format === "function" ? opts.format : null;
  const align = typeof opts.align === "function" ? opts.align : null;
  const sort = typeof opts.sort === "function" ? opts.sort : null;
  const formula = typeof opts.formula === "function" ? opts.formula : null;
  const exportCsv = typeof opts.exportCsv === "function" ? opts.exportCsv : null;
  const importData = typeof opts.importData === "function" ? opts.importData : null;
  const transpose = typeof opts.transpose === "function" ? opts.transpose : null;
  const toggleHeader = typeof opts.toggleHeader === "function" ? opts.toggleHeader : null;
  const counts = typeof opts.counts === "function" ? opts.counts : null;
  const onError = typeof opts.onError === "function" ? opts.onError : null;
  const bindTab = opts.bindTab !== false;
  const bindEnter = opts.bindEnter !== false;
  const rows = tableRows(tableEl);
  if (!rows.length || rows.length !== table.rows.length) return null;
  if (tableEl.getAttribute && tableEl.getAttribute("data-qt-table-editor") === "on") return null;

  addClass(tableEl, "qt-table-editor");
  setAttribute(tableEl, "data-qt-table-editor", "on");
  const cells = [];
  let decorating = true;

  const fail = (message) => {
    if (message && onError) onError(message);
  };

  let active = null;
  const save = (cell, row, column) => {
    if (!commit || !cell) return Promise.resolve({ ok: true, changed: false });
    const value = text(cell.textContent);
    if (value === cell.__qtTableOriginal) return Promise.resolve({ ok: true, changed: false });
    cell.__qtTableOriginal = value;
    let pending;
    try {
      pending = commit(row, column, value);
    } catch (error) {
      fail(error && error.message ? error.message : "The table cell could not be saved.");
      return Promise.resolve({ ok: false, reason: "commit" });
    }
    return Promise.resolve(pending)
      .then((result) => {
        if (result && result.ok === false) {
          cell.textContent = cell.__qtTableLastGood || "";
          cell.__qtTableOriginal = cell.textContent;
          fail(result.message || "The table cell could not be saved.");
          return result;
        }
        if (result && result.ok) cell.__qtTableLastGood = text(cell.textContent);
        return result || { ok: true };
      })
      .catch((error) => {
        fail(error && error.message ? error.message : "The table cell could not be saved.");
        return { ok: false, reason: "commit" };
      });
  };

  const commitActive = () => (active ? save(active.cell, active.row, active.column) : Promise.resolve({ ok: true }));

  const runStructure = (action) => {
    if (!structure) return;
    const at = active || { row: table.rows.length > 1 ? 1 : 0, column: 0 };
    return Promise.resolve(commitActive())
      .then((saved) => {
        if (saved && saved.ok === false) return null;
        return structure(action, at.row, at.column);
      })
      .then((result) => {
        if (result && result.ok === false) fail(result.message || "The table could not be changed.");
      })
      .catch((error) => fail(error && error.message ? error.message : "The table could not be changed."));
  };

  const runFormat = (value) => {
    if (!format) return;
    if (!active) {
      fail("Select a table cell before formatting its text.");
      return Promise.resolve();
    }
    const at = active;
    return Promise.resolve(commitActive())
      .then((saved) => {
        if (saved && saved.ok === false) return null;
        return format(value, at.row, at.column);
      })
      .then((result) => {
        if (result && result.ok === false) fail(result.message || "The table cell could not be formatted.");
      })
      .catch((error) => fail(error && error.message ? error.message : "The table cell could not be formatted."));
  };

  const runAlign = (value) => {
    if (!align) return;
    if (!active) {
      fail("Select a table cell before choosing its column alignment.");
      return Promise.resolve();
    }
    const at = active;
    return Promise.resolve(commitActive())
      .then((saved) => {
        if (saved && saved.ok === false) return null;
        return align(value, at.column);
      })
      .then((result) => {
        if (result && result.ok === false) fail(result.message || "The column alignment could not be changed.");
      })
      .catch((error) => fail(error && error.message ? error.message : "The column alignment could not be changed."));
  };

  const runSort = (direction) => {
    if (!sort) return;
    if (!active) {
      fail("Select a table cell in the column you want to sort.");
      return Promise.resolve();
    }
    const at = active;
    return Promise.resolve(commitActive())
      .then((saved) => {
        if (saved && saved.ok === false) return null;
        return sort(direction, at.column);
      })
      .then((result) => {
        if (result && result.ok === false) fail(result.message || "The table could not be sorted.");
      })
      .catch((error) => fail(error && error.message ? error.message : "The table could not be sorted."));
  };

  const runFormula = () => {
    if (!formula) return;
    return Promise.resolve(commitActive())
      .then((saved) => {
        if (saved && saved.ok === false) return null;
        return formula();
      })
      .then((result) => {
        if (result && result.ok === false) fail(result.message || "The table formulas could not be evaluated.");
      })
      .catch((error) => fail(error && error.message ? error.message : "The table formulas could not be evaluated."));
  };

  const runExport = () => {
    if (!exportCsv) return;
    return Promise.resolve(commitActive())
      .then((saved) => {
        if (saved && saved.ok === false) return null;
        return exportCsv();
      })
      .then((result) => {
        if (result && result.ok === false) fail(result.message || "The table could not be copied as CSV.");
      })
      .catch((error) => fail(error && error.message ? error.message : "The table could not be copied as CSV."));
  };

  const runImport = (mode) => {
    if (!importData) return;
    return Promise.resolve(commitActive())
      .then((saved) => {
        if (saved && saved.ok === false) return null;
        return importData(mode);
      })
      .then((result) => {
        if (result && result.ok === false) fail(result.message || "The pasted rows could not be imported.");
      })
      .catch((error) => fail(error && error.message ? error.message : "The pasted rows could not be imported."));
  };

  const runTranspose = () => {
    if (!transpose) return;
    return Promise.resolve(commitActive())
      .then((saved) => {
        if (saved && saved.ok === false) return null;
        return transpose();
      })
      .then((result) => {
        if (result && result.ok === false) fail(result.message || "The table could not be transposed.");
      })
      .catch((error) => fail(error && error.message ? error.message : "The table could not be transposed."));
  };

  const runHeader = () => {
    if (!toggleHeader) return;
    return Promise.resolve(commitActive())
      .then((saved) => {
        if (saved && saved.ok === false) return null;
        return toggleHeader();
      })
      .then((result) => {
        if (result && result.ok === false) fail(result.message || "The header row could not be changed.");
      })
      .catch((error) => fail(error && error.message ? error.message : "The header row could not be changed."));
  };

  const runCounts = () => {
    if (!counts) return;
    return Promise.resolve()
      .then(() => counts())
      .then((result) => {
        if (result && result.ok === false) fail(result.message || "The table size is unavailable.");
      })
      .catch((error) => fail(error && error.message ? error.message : "The table size is unavailable."));
  };

  const runAction = (action) => {
    if (!action) return;
    if (action.kind === "structure") return runStructure(action.id);
    if (action.kind === "format") return runFormat(action.format);
    if (action.kind === "align") return runAlign(action.align);
    if (action.kind === "sort") return runSort(action.direction);
    if (action.kind === "formula") return runFormula();
    if (action.kind === "export") return runExport();
    if (action.kind === "import") return runImport(action.mode);
    if (action.kind === "transpose") return runTranspose();
    if (action.kind === "header") return runHeader();
    if (action.kind === "count") return runCounts();
  };

  const focusCell = (row, column) => {
    const target = cells[row] && cells[row][column];
    if (!target || target.__qtTableHidden) return false;
    if (typeof target.focus === "function") target.focus();
    placeCaretAtEnd(target);
    return true;
  };

  rows.forEach((domRow, row) => {
    const domCells = rowCells(domRow);
    cells[row] = [];
    domCells.forEach((cell, column) => {
      if (!decorating || !cell || column >= table.columns) return;
      cells[row][column] = cell;
      cell.__qtTableOriginal = text(cell.textContent);
      cell.__qtTableLastGood = cell.__qtTableOriginal;
      setAttribute(cell, "contenteditable", "true");
      setAttribute(cell, "data-qt-table-cell", `${row}:${column}`);
      addClass(cell, "qt-table-cell-editable");
      if (typeof cell.addEventListener !== "function") return;

      cell.addEventListener("focus", () => {
        active = { row, column, cell };
        cell.__qtTableOriginal = text(cell.textContent);
      });
      cell.addEventListener("blur", () => save(cell, row, column));
      cell.addEventListener("paste", (event) => {
        const data = event && event.clipboardData && typeof event.clipboardData.getData === "function"
          ? event.clipboardData.getData("text/plain")
          : "";
        if (data === null || data === undefined) return;
        if (event.preventDefault) event.preventDefault();
        const clean = text(data).replace(/\r?\n/g, " ").slice(0, MAX_CELL_LENGTH);
        const doc = cell.ownerDocument;
        if (doc && typeof doc.execCommand === "function") doc.execCommand("insertText", false, clean);
        else cell.textContent = text(cell.textContent) + clean;
      });
      cell.addEventListener("keydown", (event) => {
        if (!event || event.isComposing) return;
        if (!bindTab && event.key === "Tab") return;
        if (!bindEnter && (event.key === "Enter" || event.key === "Shift+Enter")) return;
        if (event.key === "Escape") {
          if (event.preventDefault) event.preventDefault();
          cell.textContent = cell.__qtTableOriginal || "";
          if (typeof cell.blur === "function") cell.blur();
          return;
        }
        const move = navigateCell(row, column, table.rows.length, table.columns, event.key, event.shiftKey, event.altKey);
        if (!move.ok) {
          if (move.reason === "boundary") {
            save(cell, row, column);
            // Tab/Shift+Tab at the edge leaves the table through the browser's
            // natural tab order, so a following table can receive focus. Enter
            // and Alt+Arrow stay put instead of inserting a newline or scrolling.
            if (event.key !== "Tab" && event.preventDefault) event.preventDefault();
          }
          return;
        }
        if (event.preventDefault) event.preventDefault();
        save(cell, row, column);
        focusCell(move.row, move.column);
      });
    });
  });

  const merges = tableMerges(table);
  if (merges.ok) {
    for (const span of merges.spans) {
      if (span.colspan === 1 && span.rowspan === 1) continue;
      const root = cells[span.row] && cells[span.row][span.column];
      if (!root) continue;
      setAttribute(root, "colspan", span.colspan);
      setAttribute(root, "rowspan", span.rowspan);
      addClass(root, "qt-table-merged");
    }
    for (const spot of merges.hidden) {
      const mergedAway = cells[spot.row] && cells[spot.row][spot.column];
      if (!mergedAway) continue;
      mergedAway.__qtTableHidden = true;
      setAttribute(mergedAway, "contenteditable", "false");
      setAttribute(mergedAway, "data-qt-table-merged", "on");
      addClass(mergedAway, "qt-table-merge-hidden");
    }
  }

  decorating = false;
  const toolbar = structure || format || align || sort || formula || exportCsv || importData || transpose || toggleHeader || counts
    ? createTableToolbar(tableEl, runAction)
    : null;
  return { cells, rows: table.rows.length, columns: table.columns, focusCell, toolbar };
}

module.exports = {
  MAX_CELL_LENGTH,
  MAX_TABLE_COLUMNS,
  MAX_TABLE_ROWS,
  TABLE_DATA_ACTIONS,
  TABLE_FORMAT_ACTIONS,
  TABLE_FORMULA_ACTIONS,
  TABLE_IMPORT_ACTIONS,
  TABLE_SORT_ACTIONS,
  TABLE_STRUCTURE_ACTIONS,
  TABLE_TOOLBAR_ACTIONS,
  addTableColumn,
  alignTableColumn,
  appendTableRow,
  cellAtLine,
  decorateTable,
  escapeCell,
  escapeTableTarget,
  findTable,
  formatAllTables,
  formatTableAt,
  headerRowState,
  importTableData,
  navigateCell,
  nextCellTarget,
  nextRowTarget,
  normalizeTableEditorSettings,
  parseDelimitedTable,
  parseTableBlock,
  parseTables,
  previousCellTarget,
  previousRowTarget,
  renderTable,
  rowCellSpans,
  renderedHeader,
  formatTableCell,
  splitTableRow,
  startTable,
  sortTable,
  structureTable,
  tableAtLine,
  tableDraftAtLine,
  tableMerges,
  tableCounts,
  tableCsvFromTable,
  tableRowIndex,
  tableRowLine,
  toggleCellFormat,
  toggleHeaderRow,
  transposeTable,
  updateTableAlignment,
  updateTableCsvImport,
  updateTableFormat,
  updateTableFormulas,
  updateTableHeader,
  updateTableSort,
  updateTableStructure,
  updateTableTranspose,
  tableCsvAt,
  updateTableText,
};
