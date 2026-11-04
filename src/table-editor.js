"use strict";
/*
 * In-place editing for rendered Markdown tables.
 *
 * The note stays the source of truth. A rendered table is mapped back to its
 * Markdown block, and every commit rewrites the whole block with padded cells
 * and a valid delimiter row, so pipes and column widths never drift.
 */

const MAX_TABLE_ROWS = 500;
const MAX_TABLE_COLUMNS = 40;
const MIN_COLUMN_WIDTH = 3;
const MAX_CELL_LENGTH = 4000;

function text(value) {
  return value === null || value === undefined ? "" : String(value);
}

/** The module is opt-in: anything except an explicit true keeps it off. */
function normalizeTableEditorSettings(value) {
  const source = value && typeof value === "object" ? value : {};
  return { enabled: source.enabled === true };
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

/** Renders a whole block: all rows are padded to the same column width. */
function renderTable(table) {
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
  const indent = text(table.indent).replace(/\t/g, "    ");
  const lines = [];
  rows.forEach((row, index) => {
    const cells = row.map((cell, column) => pad(text(cell), widths[column], table.align[column]));
    lines.push(indent + "| " + cells.join(" | ") + " |");
    if (index === (table.headerCount || 1) - 1) {
      const delimiter = table.align.map((align, column) => delimiterCell(align, widths[column]));
      lines.push(indent + "| " + delimiter.join(" | ") + " |");
    }
  });
  return lines;
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

/**
 * Edits one cell in the full note text. Returns the replacement for the block
 * and the complete updated note, both with the note's original line endings.
 */
function updateTableText(markdown, startLine, row, column, value, expected) {
  const source = text(markdown);
  const eol = source.includes("\r\n") ? "\r\n" : "\n";
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
  const rendered = renderTable(next).join(eol);
  const fullLines = lines.slice(0, table.start).concat(rendered.split(eol), lines.slice(table.end + 1));
  return {
    ok: true,
    changed,
    table: next,
    startLine: table.start,
    endLine: table.end,
    replacement: rendered,
    text: fullLines.join(eol),
  };
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
  const onError = typeof opts.onError === "function" ? opts.onError : null;
  const rows = tableRows(tableEl);
  if (!rows.length || rows.length !== table.rows.length) return null;

  addClass(tableEl, "qt-table-editor");
  setAttribute(tableEl, "data-qt-table-editor", "on");
  const cells = [];
  let decorating = true;

  const fail = (message) => {
    if (message && onError) onError(message);
  };

  const save = (cell, row, column) => {
    if (!commit || !cell) return;
    const value = text(cell.textContent);
    if (value === cell.__qtTableOriginal) return;
    cell.__qtTableOriginal = value;
    let pending;
    try {
      pending = commit(row, column, value);
    } catch (error) {
      fail(error && error.message ? error.message : "The table cell could not be saved.");
      return;
    }
    Promise.resolve(pending)
      .then((result) => {
        if (result && result.ok === false) {
          cell.textContent = cell.__qtTableLastGood || "";
          cell.__qtTableOriginal = cell.textContent;
          fail(result.message || "The table cell could not be saved.");
        } else if (result && result.ok) {
          cell.__qtTableLastGood = text(cell.textContent);
        }
      })
      .catch((error) => fail(error && error.message ? error.message : "The table cell could not be saved."));
  };

  const focusCell = (row, column) => {
    const target = cells[row] && cells[row][column];
    if (!target) return false;
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

  decorating = false;
  return { cells, rows: table.rows.length, columns: table.columns, focusCell };
}

module.exports = {
  MAX_CELL_LENGTH,
  MAX_TABLE_COLUMNS,
  MAX_TABLE_ROWS,
  decorateTable,
  escapeCell,
  findTable,
  navigateCell,
  normalizeTableEditorSettings,
  parseTableBlock,
  parseTables,
  renderTable,
  renderedHeader,
  splitTableRow,
  updateTableText,
};
