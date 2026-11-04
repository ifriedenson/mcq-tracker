"use strict";
/*
 * Canvas <-> Markdown, a clean-room slice of the Overpowered Canvas idea
 * (MIT, github.com/kfirgumay2005-hash/Overpowered-Canvas). No copied source:
 * this reads and writes plain JSON Canvas 1.0 and keeps every card's text.
 * A "page" is simply a root card, so pages become headings.
 */
const MAX_NODES = 2000;
const MAX_TEXT = 20000;
const NODE_WIDTH = 280;
const NODE_HEIGHT = 90;
const COLUMN = 360;
const ROW_GAP = 40;

function text(value) {
  return typeof value === "string" ? value : "";
}

function parseCanvas(raw) {
  if (typeof raw !== "string" || !raw.trim()) return { ok: false, reason: "empty", message: "That canvas is empty." };
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return { ok: false, reason: "json", message: "That file is not JSON Canvas." };
  }
  if (!data || !Array.isArray(data.nodes)) return { ok: false, reason: "shape", message: "That canvas has no cards list." };
  if (!data.nodes.length) return { ok: false, reason: "empty", message: "That canvas has no cards." };
  if (data.nodes.length > MAX_NODES) return { ok: false, reason: "size", message: `That canvas has more than ${MAX_NODES} cards.` };
  const nodes = [];
  const seen = new Set();
  for (const node of data.nodes) {
    if (!node || typeof node.id !== "string" || !node.id) return { ok: false, reason: "node", message: "A card has no id." };
    if (seen.has(node.id)) return { ok: false, reason: "node", message: `Card ${node.id} appears twice.` };
    if (!["text", "file", "link", "group"].includes(node.type)) return { ok: false, reason: "node", message: `Card ${node.id} has an unknown type.` };
    if (text(node.text).length > MAX_TEXT) return { ok: false, reason: "text", message: `Card ${node.id} is too long.` };
    seen.add(node.id);
    nodes.push({
      id: node.id,
      type: node.type,
      text: text(node.text),
      file: text(node.file),
      url: text(node.url),
      x: Number(node.x) || 0,
      y: Number(node.y) || 0,
      width: Math.max(1, Number(node.width) || NODE_WIDTH),
      height: Math.max(1, Number(node.height) || NODE_HEIGHT),
    });
  }
  const edges = (Array.isArray(data.edges) ? data.edges : [])
    .filter((edge) => edge && typeof edge.fromNode === "string" && typeof edge.toNode === "string" && seen.has(edge.fromNode) && seen.has(edge.toNode))
    .map((edge, index) => ({ id: text(edge.id) || `edge-${index + 1}`, fromNode: edge.fromNode, toNode: edge.toNode, label: text(edge.label) }));
  return { ok: true, canvas: { nodes, edges } };
}

function byPosition(a, b) {
  return a.y - b.y || a.x - b.x || a.id.localeCompare(b.id);
}

function labelOf(node) {
  if (node.type === "file") return node.file ? `![[${node.file}]]` : "(file)";
  if (node.type === "link") return node.url ? `[${node.text || node.url}](${node.url})` : "(link)";
  return node.text.trim().split(/\r?\n/)[0] || "(untitled)";
}

/** Roots become headings (one per page), their branches nested bullets. */
function canvasToOutline(canvas, options) {
  const opts = options || {};
  const level = Math.min(6, Math.max(1, Number(opts.headingLevel) || 1));
  const nodes = canvas.nodes || [];
  if (!nodes.length) return { ok: false, reason: "empty", message: "That canvas has no cards." };
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const parent = new Map();
  for (const edge of canvas.edges || []) {
    if (edge.fromNode !== edge.toNode && !parent.has(edge.toNode)) parent.set(edge.toNode, edge.fromNode);
  }
  const children = new Map();
  for (const node of nodes) {
    const p = parent.get(node.id);
    if (p && byId.has(p)) {
      if (!children.has(p)) children.set(p, []);
      children.get(p).push(node);
    }
  }
  for (const list of children.values()) list.sort(byPosition);
  // A board that is one closed loop has no root; still read it, starting at its first card.
  const roots = nodes.filter((node) => !parent.has(node.id)).sort(byPosition);
  if (!roots.length) roots.push(nodes.slice().sort(byPosition)[0]);
  const lines = [];
  let skipped = 0;
  const walk = (node, depth, heading, path) => {
    if (path.has(node.id)) {
      skipped += 1;
      return;
    }
    if (depth > 30) {
      skipped += 1;
      return;
    }
    path.add(node.id);
    const body = node.type === "text" ? node.text.trim().split(/\r?\n/).filter(Boolean) : [];
    const first = body.length ? body[0] : labelOf(node);
    if (heading) lines.push(`${"#".repeat(level)} ${first}`);
    else lines.push(`${"  ".repeat(depth)}- ${first}`);
    for (const extra of body.slice(1)) lines.push(`${"  ".repeat(heading ? depth : depth + 1)}- ${extra}`);
    for (const child of children.get(node.id) || []) walk(child, heading ? 0 : depth + 1, false, path);
    path.delete(node.id);
  };
  for (const root of roots) walk(root, 0, true, new Set());
  return { ok: true, markdown: lines.join("\n") + "\n", stats: { cards: nodes.length, roots: roots.length, skipped } };
}

const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const BULLET = /^(\s*)[-*+]\s+(.+?)\s*$/;

/** A heading/bullet outline becomes cards with the same parent/child shape. */
function outlineToCanvas(markdown) {
  const source = text(markdown);
  if (!source.trim()) return { ok: false, reason: "empty", message: "That note has no outline." };
  const nodes = [];
  const edges = [];
  const stack = [];
  let headingDepth = -1;
  for (const line of source.split(/\r?\n/)) {
    const heading = line.match(HEADING);
    const bullet = heading ? null : line.match(BULLET);
    if (!heading && !bullet) continue;
    const label = (heading ? heading[2] : bullet[2]).trim();
    if (!label) continue;
    let depth;
    let isHeading = false;
    if (heading) {
      depth = heading[1].length - 1;
      headingDepth = depth;
      isHeading = true;
    } else {
      const indent = Math.floor(bullet[1].replace(/\t/g, "  ").length / 2);
      depth = headingDepth >= 0 ? headingDepth + 1 + indent : indent;
    }
    while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop();
    const node = { id: `card-${nodes.length + 1}`, type: "text", text: label, x: 0, y: 0, width: NODE_WIDTH, height: NODE_HEIGHT };
    nodes.push(node);
    const parent = stack[stack.length - 1];
    if (parent) edges.push({ id: `edge-${edges.length + 1}`, fromNode: parent.node.id, toNode: node.id });
    if (!isHeading) stack.push({ depth, node });
    else {
      stack.length = 0;
      stack.push({ depth, node });
    }
    if (nodes.length > MAX_NODES) return { ok: false, reason: "size", message: `That outline has more than ${MAX_NODES} lines.` };
  }
  if (!nodes.length) return { ok: false, reason: "empty", message: "That note has no headings or bullets." };
  const kids = new Map();
  for (const edge of edges) {
    if (!kids.has(edge.fromNode)) kids.set(edge.fromNode, []);
    kids.get(edge.fromNode).push(nodes.find((node) => node.id === edge.toNode));
  }
  let cursor = 0;
  const place = (node, depth) => {
    node.x = depth * COLUMN;
    const children = kids.get(node.id) || [];
    if (!children.length) {
      node.y = cursor;
      cursor += NODE_HEIGHT + ROW_GAP;
      return node.y;
    }
    const ys = children.map((child) => place(child, depth + 1));
    node.y = (ys[0] + ys[ys.length - 1]) / 2;
    return node.y;
  };
  for (const node of nodes.filter((item) => !edges.some((edge) => edge.toNode === item.id))) place(node, 0);
  return { ok: true, canvas: { nodes, edges } };
}

function serializeCanvas(canvas) {
  const nodes = (canvas.nodes || []).map((node) => ({
    id: node.id,
    type: node.type,
    text: text(node.text),
    x: Math.round(node.x),
    y: Math.round(node.y),
    width: Math.round(node.width),
    height: Math.round(node.height),
  }));
  const edges = (canvas.edges || []).map((edge) => ({ id: edge.id, fromNode: edge.fromNode, toNode: edge.toNode }));
  return JSON.stringify({ nodes, edges }, null, "\t") + "\n";
}

module.exports = { parseCanvas, canvasToOutline, outlineToCanvas, serializeCanvas, labelOf, MAX_NODES };
