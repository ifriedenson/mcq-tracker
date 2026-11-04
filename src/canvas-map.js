"use strict";
/*
 * Mind-map walking and tree auto-layout for JSON Canvas 1.0 boards.
 *
 * This is the second clean-room slice of the Overpowered Canvas idea (MIT,
 * github.com/kfirgumay2005-hash/Overpowered-Canvas). No source was copied from
 * that project and no dependency was added: the tree is ordinary adjacency
 * arithmetic over the same validated board model as canvas-markdown.js, and the
 * layout is plain geometry. Loop layouts from elkjs are deliberately not used.
 *
 * A board becomes one tree: the only root card when the board has exactly one,
 * otherwise the top-most root card, otherwise (a board that is all loop) the
 * top-most card. Cards the tree cannot reach - a second page, a loose cycle -
 * are placed in their own column so the layout never drops or overlaps a card.
 */
const canvasMarkdown = require("./canvas-markdown");

const H_GAP = 120;
const V_GAP = 40;
const ORPHAN_GAP = 120;
const MAX_DEPTH = 40;
const FALLBACK_WIDTH = 280;
const FALLBACK_HEIGHT = 90;

const DIRECTIONS = ["parent", "child", "next", "prev"];

/** Top-to-bottom, then left-to-right, then by id: one stable board order. */
function boardOrder(a, b) {
  return a.y - b.y || a.x - b.x || a.id.localeCompare(b.id);
}

function nameOf(node) {
  if (!node) return "that card";
  return canvasMarkdown.labelOf(node);
}

/**
 * Resolve roots, parent links, children and a cycle-safe pre-order walk.
 * Every card keeps at most one parent (the first edge that reaches it), so a
 * loop is cut rather than followed; the walk also cuts a repeat or a branch
 * deeper than MAX_DEPTH.
 */
function resolveTree(canvas) {
  if (!canvas || !Array.isArray(canvas.nodes) || !canvas.nodes.length) {
    return { ok: false, reason: "empty", message: "That canvas has no cards." };
  }
  const nodes = canvas.nodes.slice().sort(boardOrder);
  // A group is a frame, not a card: the tree, the walk and the layout leave it where it is.
  const cards = nodes.filter((node) => node.type !== "group");
  if (!cards.length) return { ok: false, reason: "cards", message: "That canvas has no cards to arrange." };
  const byId = new Map(cards.map((node) => [node.id, node]));
  const parentOf = new Map();
  let cut = 0;
  for (const edge of canvas.edges || []) {
    if (!edge) continue;
    if (!byId.has(edge.fromNode) || !byId.has(edge.toNode)) continue;
    if (edge.fromNode === edge.toNode) {
      cut += 1;
      continue;
    }
    if (parentOf.has(edge.toNode)) {
      cut += 1;
      continue;
    }
    parentOf.set(edge.toNode, edge.fromNode);
  }
  const childrenOf = new Map();
  for (const node of cards) {
    const parent = parentOf.get(node.id);
    if (!parent) continue;
    if (!childrenOf.has(parent)) childrenOf.set(parent, []);
    childrenOf.get(parent).push(node);
  }
  const roots = cards.filter((node) => !parentOf.has(node.id));
  const root = roots.length ? roots[0] : cards[0];
  const depth = new Map();
  const order = [];
  const walk = (node, level) => {
    if (!node) return;
    if (depth.has(node.id) || level > MAX_DEPTH) {
      cut += 1;
      return;
    }
    depth.set(node.id, level);
    order.push(node);
    for (const child of childrenOf.get(node.id) || []) walk(child, level + 1);
  };
  walk(root, 0);
  const orphans = cards.filter((node) => !depth.has(node.id));
  const open = order.filter((node) => !(childrenOf.get(node.id) || []).some((child) => depth.get(child.id) === depth.get(node.id) + 1));
  return {
    ok: true,
    tree: { root, roots, nodes, cards, byId, parentOf, childrenOf, depth, order, orphans, open, cut },
    stats: { cards: cards.length, groups: nodes.length - cards.length, roots: roots.length, reachable: order.length, orphans: orphans.length, cut },
  };
}

/**
 * One step of mind-map navigation from a card. `direction` is parent, child,
 * next or prev; a missing neighbour is refused with a message that names the
 * edge of the tree instead of wrapping around.
 */
function neighbour(tree, id, direction) {
  if (!tree || !tree.byId) return { ok: false, reason: "tree", message: "That board has no tree." };
  const card = tree.byId.get(id);
  if (!card) return { ok: false, reason: "card", message: "That card is not on this board." };
  if (!DIRECTIONS.includes(direction)) return { ok: false, reason: "direction", message: `"${direction}" is not a mind-map direction.` };
  if (direction === "parent") {
    const parent = tree.parentOf.get(card.id);
    if (!parent) return { ok: false, reason: "edge", message: `"${nameOf(card)}" is the root of this board.` };
    return { ok: true, id: parent, card: tree.byId.get(parent), direction };
  }
  if (direction === "child") {
    const children = tree.childrenOf.get(card.id) || [];
    if (!children.length) return { ok: false, reason: "edge", message: `"${nameOf(card)}" has no child card.` };
    return { ok: true, id: children[0].id, card: children[0], direction };
  }
  const parent = tree.parentOf.get(card.id);
  const siblings = parent ? tree.childrenOf.get(parent) || [] : tree.roots;
  const index = siblings.findIndex((node) => node.id === card.id);
  if (index < 0) return { ok: false, reason: "card", message: `"${nameOf(card)}" has no sibling card.` };
  const target = direction === "next" ? index + 1 : index - 1;
  if (target < 0 || target >= siblings.length) {
    const message = direction === "next"
      ? `"${nameOf(card)}" is the last card in its branch.`
      : `"${nameOf(card)}" is the first card in its branch.`;
    return { ok: false, reason: "edge", message };
  }
  return { ok: true, id: siblings[target].id, card: siblings[target], direction };
}

function widthOf(node) {
  return Math.max(1, Number(node && node.width) || FALLBACK_WIDTH);
}

function heightOf(node) {
  return Math.max(1, Number(node && node.height) || FALLBACK_HEIGHT);
}

/**
 * Deterministic left-to-right tree layout. Columns are spaced by the widest
 * card in each level; a leaf occupies the next free row, and a parent sits at
 * the middle of its children. Cards that share a column are then pushed apart
 * so nothing overlaps, and unreachable cards get a column of their own to the
 * right. The result depends only on the tree, the card sizes and the board
 * order, so laying out an already laid-out board changes nothing.
 */
function layoutTree(canvas) {
  const resolved = resolveTree(canvas);
  if (!resolved.ok) return resolved;
  const tree = resolved.tree;
  const childrenInTree = (node) => (tree.childrenOf.get(node.id) || []).filter((child) => tree.depth.get(child.id) === tree.depth.get(node.id) + 1);
  let deepest = 0;
  for (const level of tree.depth.values()) if (level > deepest) deepest = level;
  const columnX = new Map();
  let cursorX = 0;
  for (let level = 0; level <= deepest; level += 1) {
    let widest = 0;
    for (const node of tree.order) {
      if (tree.depth.get(node.id) === level) widest = Math.max(widest, widthOf(node));
    }
    columnX.set(level, Math.round(cursorX));
    cursorX += widest + H_GAP;
  }
  const position = new Map();
  let cursorY = 0;
  const place = (node) => {
    const children = childrenInTree(node);
    let y;
    if (!children.length) {
      y = cursorY;
      cursorY += heightOf(node) + V_GAP;
    } else {
      const placed = children.map(place);
      y = (placed[0] + placed[placed.length - 1]) / 2;
    }
    y = Math.round(y);
    position.set(node.id, { x: columnX.get(tree.depth.get(node.id)), y });
    return y;
  };
  place(tree.root);

  const columns = new Map();
  for (const node of tree.order) {
    const level = tree.depth.get(node.id);
    if (!columns.has(level)) columns.set(level, []);
    const spot = position.get(node.id);
    columns.get(level).push({ node, x: spot.x, y: spot.y });
  }
  for (const level of [...columns.keys()].sort((a, b) => a - b)) {
    const column = columns.get(level).sort((a, b) => a.y - b.y || a.node.id.localeCompare(b.node.id));
    let floor = null;
    for (const item of column) {
      if (floor !== null && item.y < floor) item.y = floor;
      position.set(item.node.id, { x: item.x, y: item.y });
      floor = item.y + heightOf(item.node) + V_GAP;
    }
  }

  let right = 0;
  for (const node of tree.order) right = Math.max(right, position.get(node.id).x + widthOf(node));
  const orphanX = Math.round(right + ORPHAN_GAP);
  let orphanY = position.get(tree.root.id).y;
  for (const node of tree.orphans) {
    position.set(node.id, { x: orphanX, y: Math.round(orphanY) });
    orphanY += heightOf(node) + V_GAP;
  }

  const placements = tree.order.concat(tree.orphans).map((node) => ({ id: node.id, x: position.get(node.id).x, y: position.get(node.id).y }));
  return {
    ok: true,
    rootId: tree.root.id,
    placements,
    position,
    stats: { cards: tree.cards.length, groups: tree.nodes.length - tree.cards.length, roots: tree.roots.length, placed: tree.order.length, orphans: tree.orphans.length, cut: tree.cut, depth: deepest },
  };
}

/**
 * Lay out a whole board file. Only each card's x and y change: card size,
 * colour, group membership, edges and every other field survive untouched.
 * `changed` is false when the board already sits where the layout wants it.
 */
function layoutCanvas(raw) {
  const parsed = canvasMarkdown.parseCanvas(raw);
  if (!parsed.ok) return parsed;
  const laid = layoutTree(parsed.canvas);
  if (!laid.ok) return laid;
  let data;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    return { ok: false, reason: "json", message: "That file is not JSON Canvas." };
  }
  let changed = false;
  const nodes = (Array.isArray(data.nodes) ? data.nodes : []).map((node) => {
    const spot = node && laid.position.get(node.id);
    if (!spot) return node;
    if (Math.round(Number(node.x) || 0) !== spot.x || Math.round(Number(node.y) || 0) !== spot.y) changed = true;
    return Object.assign({}, node, { x: spot.x, y: spot.y });
  });
  const text = JSON.stringify(Object.assign({}, data, { nodes }), null, "\t") + "\n";
  return { ok: true, text, changed, rootId: laid.rootId, stats: laid.stats };
}

module.exports = { resolveTree, neighbour, layoutTree, layoutCanvas, boardOrder, DIRECTIONS, MAX_DEPTH };
