"use strict";
/*
 * Kanban columns for JSON Canvas 1.0 boards.
 *
 * This is the third clean-room slice of the Overpowered Canvas idea (MIT,
 * github.com/kfirgumay2005-hash/Overpowered-Canvas). No source was copied and no
 * dependency was added: columns are read from the board's own geometry, which is
 * all plain arithmetic on the model canvas-markdown.js already validates.
 *
 * Columns come from group frames when the board has them, ordered by left edge
 * then top edge then id. A board without frames is read the other documented way:
 * cards are sorted by left edge and every card within COLUMN_SNAP pixels of the
 * column's left edge joins it, so columns are the board's vertical stacks. Edges
 * are never followed, so a loop or a dangling edge cannot affect the result.
 *
 * A card belongs to the frame that contains its centre. A card whose centre is
 * outside every frame is reported as unassigned instead of being guessed at.
 */
const canvasMarkdown = require("./canvas-markdown");
const canvasMap = require("./canvas-map");

const COLUMN_GAP = 80;
const CARD_GAP = 24;
const TOP = 0;
const PAD = 16;
const MIN_COLUMN_WIDTH = 300;
const MIN_COLUMN_HEIGHT = 120;
const UNASSIGNED_GAP = 120;
const COLUMN_SNAP = 80;
const FALLBACK_WIDTH = 280;
const FALLBACK_HEIGHT = 90;
const MAX_LABEL = 60;

function widthOf(node) {
  return Math.max(1, Math.round(Number(node && node.width) || FALLBACK_WIDTH));
}

function heightOf(node) {
  return Math.max(1, Math.round(Number(node && node.height) || FALLBACK_HEIGHT));
}

function centreOf(node) {
  return { x: node.x + widthOf(node) / 2, y: node.y + heightOf(node) / 2 };
}

function shortLabel(node) {
  const label = canvasMarkdown.labelOf(node).replace(/\s+/g, " ").trim();
  return label.length > MAX_LABEL ? label.slice(0, MAX_LABEL - 1) + "…" : label;
}

function contains(column, point) {
  return point.x >= column.x && point.x <= column.x + column.width && point.y >= column.y && point.y <= column.y + column.height;
}

function byLeftEdge(a, b) {
  return a.x - b.x || a.y - b.y || a.id.localeCompare(b.id);
}

/**
 * Read the board's columns, their cards in vertical order, and the cards that
 * belong to no column. A group frame is a column, not a card.
 */
function deriveColumns(canvas) {
  if (!canvas || !Array.isArray(canvas.nodes) || !canvas.nodes.length) {
    return { ok: false, reason: "empty", message: "That canvas is empty." };
  }
  const cards = canvas.nodes.filter((node) => node.type !== "group");
  if (!cards.length) return { ok: false, reason: "cards", message: "That canvas has no cards to arrange." };
  const frames = canvas.nodes.filter((node) => node.type === "group").sort(byLeftEdge);
  const columns = [];
  const unassigned = [];
  let mode = "positions";
  if (frames.length) {
    mode = "frames";
    frames.forEach((frame, index) => {
      columns.push({
        id: frame.id,
        title: (frame.label || "").trim() || "Column " + (index + 1),
        x: frame.x,
        y: frame.y,
        width: widthOf(frame),
        height: heightOf(frame),
        frame,
        cards: [],
      });
    });
    for (const card of cards) {
      const point = centreOf(card);
      const hit = columns.find((column) => contains(column, point));
      if (hit) hit.cards.push(card);
      else unassigned.push(card);
    }
  } else {
    const ordered = cards.slice().sort((a, b) => a.x - b.x || canvasMap.boardOrder(a, b));
    for (const card of ordered) {
      const last = columns[columns.length - 1];
      if (last && card.x - last.anchor <= COLUMN_SNAP) last.cards.push(card);
      else columns.push({ id: "column-" + (columns.length + 1), title: "Column " + (columns.length + 1), anchor: card.x, cards: [card] });
    }
    for (const column of columns) {
      column.x = Math.min(...column.cards.map((card) => card.x));
      column.y = Math.min(...column.cards.map((card) => card.y));
      column.width = Math.max(...column.cards.map((card) => card.x + widthOf(card))) - column.x;
      column.height = Math.max(...column.cards.map((card) => card.y + heightOf(card))) - column.y;
      delete column.anchor;
    }
  }
  for (const column of columns) column.cards.sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
  const assigned = columns.reduce((sum, column) => sum + column.cards.length, 0);
  return {
    ok: true,
    mode,
    columns,
    unassigned: unassigned.sort((a, b) => canvasMap.boardOrder(a, b)),
    stats: { cards: cards.length, columns: columns.length, assigned, unassigned: unassigned.length, groups: frames.length },
  };
}

function describe(derived) {
  const head = derived.columns.length + (derived.columns.length === 1 ? " column" : " columns")
    + ", " + derived.stats.cards + (derived.stats.cards === 1 ? " card" : " cards");
  const names = derived.columns.map((column) => column.title + " (" + column.cards.length + ")");
  const tail = derived.unassigned.length
    ? "; " + derived.unassigned.length + (derived.unassigned.length === 1 ? " card is" : " cards are") + " unassigned"
    : "";
  return head + ": " + names.join(", ") + tail + ".";
}

/** The readable structure: every column with its cards, then the unassigned cards. */
function kanbanReport(raw) {
  const parsed = canvasMarkdown.parseCanvas(raw);
  if (!parsed.ok) return parsed;
  const derived = deriveColumns(parsed.canvas);
  if (!derived.ok) return derived;
  const rows = derived.columns.map((column) => ({
    id: column.id,
    title: column.title,
    x: column.x,
    y: column.y,
    cards: column.cards.map((card) => ({ id: card.id, label: shortLabel(card), x: card.x, y: card.y })),
  }));
  const loose = derived.unassigned.map((card) => ({ id: card.id, label: shortLabel(card), x: card.x, y: card.y }));
  return { ok: true, mode: derived.mode, columns: rows, unassigned: loose, summary: describe(derived), stats: derived.stats };
}

/**
 * Re-stack the board's columns: every column starts at the same top, columns sit
 * COLUMN_GAP apart, cards stack in their in-column order with CARD_GAP between
 * them, a column is as wide as its widest card, and a group frame is moved and
 * sized to fit its column. Cards outside every column are parked to the right,
 * clear of the frames. Card sizes, edges and unknown fields are untouched, and a
 * board that is already stacked comes back with `changed: false`.
 */
function restackColumns(raw) {
  const parsed = canvasMarkdown.parseCanvas(raw);
  if (!parsed.ok) return parsed;
  const derived = deriveColumns(parsed.canvas);
  if (!derived.ok) return derived;
  let data;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    return { ok: false, reason: "json", message: "That file is not JSON Canvas." };
  }

  const target = new Map();
  let cursorX = 0;
  let right = 0;
  for (const column of derived.columns) {
    const width = Math.max(MIN_COLUMN_WIDTH, ...column.cards.map((card) => widthOf(card)));
    let cursorY = TOP;
    for (const card of column.cards) {
      target.set(card.id, { x: cursorX, y: cursorY });
      cursorY += heightOf(card) + CARD_GAP;
    }
    const stackHeight = Math.max(MIN_COLUMN_HEIGHT, cursorY - CARD_GAP - TOP);
    if (column.frame) {
      target.set(column.frame.id, { x: cursorX - PAD, y: TOP - PAD, width: width + PAD * 2, height: stackHeight + PAD * 2 });
    }
    right = cursorX + width;
    cursorX = right + COLUMN_GAP;
  }
  const parkX = derived.columns.length ? right + UNASSIGNED_GAP : 0;
  let parkY = TOP;
  for (const card of derived.unassigned) {
    target.set(card.id, { x: parkX, y: parkY });
    parkY += heightOf(card) + CARD_GAP;
  }

  let changed = false;
  const nodes = (Array.isArray(data.nodes) ? data.nodes : []).map((node) => {
    const spot = node && target.get(node.id);
    if (!spot) return node;
    const next = Object.assign({}, node);
    if (Math.round(Number(node.x) || 0) !== spot.x || Math.round(Number(node.y) || 0) !== spot.y) changed = true;
    next.x = spot.x;
    next.y = spot.y;
    if (spot.width !== undefined) {
      if (Math.round(Number(node.width) || 0) !== spot.width) changed = true;
      next.width = spot.width;
    }
    if (spot.height !== undefined) {
      if (Math.round(Number(node.height) || 0) !== spot.height) changed = true;
      next.height = spot.height;
    }
    return next;
  });
  const text = JSON.stringify(Object.assign({}, data, { nodes }), null, "\t") + "\n";
  return { ok: true, text, changed, mode: derived.mode, summary: describe(derived), stats: derived.stats };
}

module.exports = {
  deriveColumns,
  kanbanReport,
  restackColumns,
  describe,
  COLUMN_GAP,
  CARD_GAP,
  TOP,
  PAD,
  MIN_COLUMN_WIDTH,
  MIN_COLUMN_HEIGHT,
  UNASSIGNED_GAP,
  COLUMN_SNAP,
};
