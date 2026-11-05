"use strict";
/*
 * Markmind-compatible mind maps.
 *
 * Markmind keeps a board in an ordinary note: frontmatter with
 * `mindmap-plugin: basic` and a nested Markdown list. This module reads that
 * file, edits the tree (add, rename, remove, move) and writes it back in the
 * same shape, so a board stays readable and editable outside the plugin. No
 * private format, no binary payload and no Obsidian API live here.
 */
const { str } = require("./util");

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const LIST_LINE = /^([ \t]*)(?:[-*+]|\d+[.)])\s+(.*)$/;
const PLUGIN_KEY = "mindmap-plugin";

function splitNote(text) {
  const source = String(text == null ? "" : text).replace(/\r\n?/g, "\n");
  const match = FRONTMATTER.exec(source);
  if (!match) return { frontmatter: "", body: source };
  return { frontmatter: match[1], body: source.slice(match[0].length) };
}

/** True when the note's frontmatter marks it as a Markmind board. */
function isMarkmind(text) {
  const frontmatter = splitNote(text).frontmatter;
  return new RegExp(`^\\s*${PLUGIN_KEY}\\s*:\\s*\\S`, "im").test(frontmatter);
}

/** Read a note into `{ frontmatter, root: { text, children } }`. */
function parseMarkmind(text) {
  const { frontmatter, body } = splitNote(text);
  const heading = /^#\s+(.+)$/m.exec(body);
  const root = { text: heading ? heading[1].trim() : "Mind map", children: [] };
  const stack = [{ node: root, indent: -1 }];
  for (const line of body.split("\n")) {
    if (/^\s*#/.test(line)) continue;
    const match = LIST_LINE.exec(line);
    if (!match) continue;
    const indent = match[1].replace(/\t/g, "  ").length;
    const node = { text: match[2].trim(), children: [] };
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    stack[stack.length - 1].node.children.push(node);
    stack.push({ node, indent });
  }
  return { frontmatter, root };
}

function renderNodes(node, depth, lines) {
  for (const child of node.children) {
    lines.push(`${"  ".repeat(depth)}- ${child.text}`);
    renderNodes(child, depth + 1, lines);
  }
}

/** Write a tree back as a Markmind note. */
function markmindMarkdown(root) {
  const tree = root && typeof root === "object" ? root : { text: "Mind map", children: [] };
  const lines = ["---", `${PLUGIN_KEY}: basic`, "---", ""];
  if (str(tree.text).trim()) lines.push(`# ${str(tree.text).trim()}`, "");
  renderNodes(tree, 0, lines);
  lines.push("");
  return lines.join("\n");
}

function clone(node) {
  return { text: str(node && node.text), children: (node && Array.isArray(node.children) ? node.children : []).map(clone) };
}

function findWithParent(node, text, parent) {
  const target = str(text).trim().toLowerCase();
  if (!target) return null;
  if (str(node.text).trim().toLowerCase() === target) return { node, parent };
  for (const child of node.children) {
    const hit = findWithParent(child, target, node);
    if (hit) return hit;
  }
  return null;
}

function contains(ancestor, node) {
  if (ancestor === node) return true;
  return ancestor.children.some((child) => contains(child, node));
}

function flattenMindmap(root) {
  const rows = [];
  const visit = (node, depth) => {
    rows.push({ depth, text: node.text });
    for (const child of node.children) visit(child, depth + 1);
  };
  if (root) visit(root, 0);
  return rows;
}

function addChild(root, parentText, text) {
  const label = str(text).trim();
  if (!label) return { ok: false, reason: "text", message: "A node needs text." };
  const tree = clone(root);
  const parent = str(parentText).trim() ? findWithParent(tree, parentText, null) : { node: tree, parent: null };
  if (!parent) return { ok: false, reason: "parent", message: `There is no node named “${str(parentText).trim()}”.` };
  parent.node.children.push({ text: label, children: [] });
  return { ok: true, tree };
}

function renameNode(root, from, to) {
  const label = str(to).trim();
  if (!label) return { ok: false, reason: "text", message: "A node needs text." };
  const tree = clone(root);
  const hit = findWithParent(tree, from, null);
  if (!hit) return { ok: false, reason: "node", message: `There is no node named “${str(from).trim()}”.` };
  hit.node.text = label;
  return { ok: true, tree };
}

function removeNode(root, text) {
  const tree = clone(root);
  const hit = findWithParent(tree, text, null);
  if (!hit) return { ok: false, reason: "node", message: `There is no node named “${str(text).trim()}”.` };
  if (!hit.parent) return { ok: false, reason: "root", message: "The central node cannot be removed." };
  hit.parent.children = hit.parent.children.filter((child) => child !== hit.node);
  return { ok: true, tree };
}

function moveNode(root, text, parentText) {
  const tree = clone(root);
  const hit = findWithParent(tree, text, null);
  if (!hit) return { ok: false, reason: "node", message: `There is no node named “${str(text).trim()}”.` };
  if (!hit.parent) return { ok: false, reason: "root", message: "The central node cannot be moved." };
  const target = findWithParent(tree, parentText, null);
  if (!target) return { ok: false, reason: "parent", message: `There is no node named “${str(parentText).trim()}”.` };
  if (contains(hit.node, target.node)) return { ok: false, reason: "cycle", message: "A node cannot move inside itself." };
  hit.parent.children = hit.parent.children.filter((child) => child !== hit.node);
  target.node.children.push(hit.node);
  return { ok: true, tree };
}

module.exports = {
  PLUGIN_KEY,
  addChild,
  flattenMindmap,
  isMarkmind,
  markmindMarkdown,
  moveNode,
  parseMarkmind,
  removeNode,
  renameNode,
  splitNote,
};
