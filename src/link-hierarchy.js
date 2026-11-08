"use strict";
/*
 * Folder review hierarchy, adapted from Spaceforge's MIT-licensed
 * LinkAnalyzer (utils/link-analyzer.ts).
 *
 * The folder's own note is the root when one exists. Otherwise the note with
 * the most regular outgoing links is the focal point. Links are followed
 * depth-first in the order they appear in the note. A link to a note in a
 * subfolder brings in that note and its links, not every sibling in its folder.
 */

const { str } = require("./util");

function cleanFolder(value) {
  return str(value).trim().replace(/^\/+|\/+$/g, "");
}

function baseName(path) {
  const file = str(path).split("/").pop() || "";
  return file.replace(/\.md$/i, "");
}

function parentFolder(path) {
  const value = str(path);
  const index = value.lastIndexOf("/");
  return index < 0 ? "" : value.slice(0, index);
}

function inFolder(path, folder) {
  if (!folder) return true;
  return path === folder || path.startsWith(`${folder}/`);
}

function linkTarget(link) {
  if (typeof link === "string") return { path: str(link), embed: false };
  if (!link || typeof link !== "object") return null;
  return {
    path: str(link.path || link.target || link.to),
    embed: link.embed === true || link.isEmbed === true || link.type === "embed",
  };
}

function normalizeNodes(notes, folder) {
  const nodes = new Map();
  for (const note of Array.isArray(notes) ? notes : []) {
    const path = str(note && note.path).trim();
    if (!path || !/\.md$/i.test(path)) continue;
    if (!inFolder(path, folder)) continue;
    const links = [];
    const seen = new Set();
    for (const raw of Array.isArray(note.links) ? note.links : []) {
      const target = linkTarget(raw);
      if (!target || !target.path || target.path === path || seen.has(target.path)) continue;
      if (!inFolder(target.path, folder)) continue;
      if (!nodes.has(target.path)) {
        // A link can arrive before its node in a caller's unsorted list.
        nodes.set(target.path, { path: target.path, links: [] });
      }
      seen.add(target.path);
      links.push(target);
    }
    const existing = nodes.get(path) || { path, links: [] };
    nodes.set(path, { path, links });
  }
  // Drop links to files outside the analysed set.
  for (const node of nodes.values()) {
    node.links = node.links.filter((link) => nodes.has(link.path));
  }
  return nodes;
}

function chooseRoot(nodes, folder) {
  const folderName = baseName(folder).toLowerCase();
  const values = [...nodes.values()];
  if (!values.length) return "";
  if (folderName) {
    const exact = values.find((node) => parentFolder(node.path) === folder && baseName(node.path).toLowerCase() === folderName);
    if (exact) return exact.path;
    const nested = values.find((node) => baseName(node.path).toLowerCase() === folderName);
    if (nested) return nested.path;
  }
  const ranked = values
    .slice()
    .sort((a, b) => {
      const regularA = a.links.filter((link) => !link.embed).length;
      const regularB = b.links.filter((link) => !link.embed).length;
      if (regularA !== regularB) return regularB - regularA;
      if (a.links.length !== b.links.length) return b.links.length - a.links.length;
      return a.path.localeCompare(b.path);
    });
  return ranked[0] && ranked[0].path ? ranked[0].path : "";
}

/**
 * Build the root and pre-order traversal. `notes` entries are
 * `{ path, links: [string | { path, embed }] }`.
 */
function buildFolderHierarchy(notes, folder, options) {
  const opts = options && typeof options === "object" ? options : {};
  const rootFolder = cleanFolder(folder);
  const nodes = normalizeNodes(notes, rootFolder);
  const root = chooseRoot(nodes, rootFolder);
  const order = [];
  const visited = new Set();
  const walk = (path) => {
    if (!path || visited.has(path) || !nodes.has(path)) return;
    visited.add(path);
    order.push(path);
    const node = nodes.get(path);
    // Regular links are the review spine; embeds are a fallback only when a
    // note has no regular links at all.
    const regular = node.links.filter((link) => !link.embed).map((link) => link.path);
    const links = regular.length ? regular : node.links.map((link) => link.path);
    for (const next of links) walk(next);
  };
  walk(root);
  if (opts.includeUnlinked === true) {
    for (const path of [...nodes.keys()].sort((a, b) => a.localeCompare(b))) walk(path);
  }
  return {
    folder: rootFolder,
    root,
    order,
    nodes: Object.fromEntries(nodes),
  };
}

module.exports = {
  baseName,
  buildFolderHierarchy,
  chooseRoot,
  cleanFolder,
  inFolder,
  normalizeNodes,
  parentFolder,
};
