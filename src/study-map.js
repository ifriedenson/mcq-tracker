"use strict";
/*
 * A local study map: outline a note (or an inline outline) as a mind-map tree
 * and pull out the key terms and a one-line summary. Spaceforge's visualize
 * workspace is the reference idea; this implementation is original, offline
 * and read-only. It never edits the source note.
 *
 *   ```study-map
 *   Source: Biology/Cell respiration.md
 *   Depth: 3
 *   Terms: 8
 *   ```
 *
 *   ```study-map
 *   Title: Osmosis
 *   # Osmosis
 *   ## Definition
 *   - Water crosses a membrane
 *   ```
 */
const { str } = require("./util");

const MAX_LINES = 400;
const MAX_SOURCE = 20000;
const MAX_DEPTH = 6;

const STOPWORDS = new Set(
  "about above after again against also although among and another any are because been before being below between both but came can could did does doing down during each either enough even ever every few for from further had has have having here hers him his how however into its itself just like made make many may might more most much must near need neither never next none nor not now off often once only other our ours out over own perhaps quite rather same should since some still such than that the their theirs them then there these they this those though through thus too toward under until upon very want was way were what when where whether which while who whom whose why will with within without would yet you your".split(
    /\s+/
  )
);

function normalizeStudyMapSettings(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const terms = Number(source.terms);
  const depth = Number(source.depth);
  return {
    enabled: !(value === false || source.enabled === false),
    terms: Number.isFinite(terms) ? Math.max(3, Math.min(20, Math.round(terms))) : 8,
    depth: Number.isFinite(depth) ? Math.max(1, Math.min(MAX_DEPTH, Math.round(depth))) : 4,
  };
}

function parseStudyMapSource(source) {
  const out = { path: "", title: "", depth: 0, terms: 0, lines: [], issues: [] };
  for (const raw of str(source).replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.replace(/\s+$/, "");
    const match = line.match(/^\s*(Source|File|Path|Title|Depth|Terms)\s*:\s*(.*)$/i);
    if (!match) {
      out.lines.push(line);
      continue;
    }
    const key = match[1].toLowerCase();
    const value = match[2].trim();
    if (key === "source" || key === "file" || key === "path") out.path = value;
    else if (key === "title") out.title = value;
    else if (key === "depth") out.depth = Math.max(0, Math.min(MAX_DEPTH, Math.round(Number(value) || 0)));
    else if (key === "terms") out.terms = Math.max(0, Math.min(20, Math.round(Number(value) || 0)));
  }
  return out;
}

/** Key terms are repeated, non-stopword words; a capitalised use scores higher. */
function extractKeyTerms(text, limit) {
  const body = str(text)
    .replace(/^---\n[\s\S]*?\n---\n/, " ")
    .replace(/```[\s\S]*?```/g, " ");
  const counts = new Map();
  for (const match of body.matchAll(/([A-Za-z][A-Za-z'-]{2,})/g)) {
    const word = match[1];
    const key = word.toLowerCase();
    if (STOPWORDS.has(key) || key.length < 4) continue;
    const entry = counts.get(key) || { word: key, count: 0, capitalised: 0 };
    entry.count += 1;
    if (/^[A-Z]/.test(word)) entry.capitalised += 1;
    counts.set(key, entry);
  }
  const scored = [...counts.values()]
    .map((entry) => ({ term: entry.word, count: entry.count, score: entry.count + entry.capitalised * 0.5 }))
    .filter((entry) => entry.count >= 2)
    .sort((a, b) => b.score - a.score || a.term.localeCompare(b.term));
  const wanted = Math.max(1, Math.min(20, Math.round(Number(limit) || 8)));
  return scored.slice(0, wanted);
}

function makeNode(depth, text) {
  return { depth, text: str(text).trim().slice(0, 200), children: [] };
}

function buildOutline(text, options) {
  const opts = options && typeof options === "object" ? options : {};
  const maxDepth = Math.max(1, Math.min(MAX_DEPTH, Math.round(Number(opts.depth) || 4)));
  const roots = [];
  const stack = [];
  const issues = [];
  let headingDepth = 0;
  let seen = 0;
  for (const raw of str(text).replace(/\r\n?/g, "\n").split("\n")) {
    if (seen >= MAX_LINES) {
      issues.push(`Only the first ${MAX_LINES} lines are mapped.`);
      break;
    }
    const line = raw.replace(/\s+$/, "");
    if (!line.trim() || /^\s*```/.test(line)) continue;
    seen += 1;
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    const bullet = line.match(/^(\s*)[-*+]\s+(.+)$/);
    let node = null;
    if (heading) {
      headingDepth = Math.min(maxDepth, heading[1].length);
      node = makeNode(headingDepth, heading[2]);
    } else if (bullet) {
      const indent = Math.floor(bullet[1].replace(/\t/g, "  ").length / 2);
      node = makeNode(Math.min(maxDepth, headingDepth + 1 + indent), bullet[2]);
    }
    if (!node) continue; // prose stays out of the tree; it still feeds the key terms
    while (stack.length && stack[stack.length - 1].depth >= node.depth) stack.pop();
    if (stack.length) stack[stack.length - 1].children.push(node);
    else roots.push(node);
    stack.push(node);
  }
  if (!roots.length) {
    // No headings or bullets: fall back to the first meaningful lines so a short note still maps.
    for (const raw of str(text).split("\n")) {
      const line = raw.trim();
      if (!line || /^\s*```/.test(line) || /^---/.test(line)) continue;
      const node = makeNode(1, line);
      roots.push(node);
      if (roots.length >= 20) break;
    }
    if (roots.length) issues.push("No headings or bullets found; mapping the first lines instead.");
    else issues.push("Add headings or bullet points to build a study map.");
  }
  return { nodes: roots, issues };
}

function countNodes(nodes) {
  let total = 0;
  for (const node of nodes || []) total += 1 + countNodes(node.children);
  return total;
}

function buildStudyMap(text, options) {
  const opts = options && typeof options === "object" ? options : {};
  const settings = normalizeStudyMapSettings(opts);
  const depth = opts.depth || settings.depth;
  const terms = opts.terms || settings.terms;
  const body = str(text).slice(0, MAX_SOURCE);
  const outline = buildOutline(body, { depth });
  const keyTerms = extractKeyTerms(body, terms);
  const summaryParts = [];
  const sections = outline.nodes.length;
  summaryParts.push(`${sections} section${sections === 1 ? "" : "s"}`);
  summaryParts.push(`${countNodes(outline.nodes)} node${countNodes(outline.nodes) === 1 ? "" : "s"}`);
  if (keyTerms.length) summaryParts.push(`focus: ${keyTerms.slice(0, 3).map((term) => term.term).join(", ")}`);
  return {
    title: str(opts.title).trim() || "Study map",
    nodes: outline.nodes,
    nodeCount: countNodes(outline.nodes),
    terms: keyTerms,
    summary: summaryParts.join(" · "),
    issues: outline.issues,
  };
}

function renderNodes(parent, nodes) {
  for (const node of nodes) {
    const row = parent.createDiv({ cls: `qt-study-map-node qt-study-map-depth-${Math.min(6, node.depth)}` });
    row.createSpan({ cls: "qt-study-map-bullet", text: "•" });
    row.createSpan({ cls: "qt-study-map-text", text: node.text });
    if (node.children && node.children.length) renderNodes(row.createDiv({ cls: "qt-study-map-children" }), node.children);
  }
}

/**
 * Render a `study-map` block. When `Source:` is set the note is read through
 * the vault; otherwise the block's own outline is used. Read-only either way.
 */
async function renderStudyMapBlock(plugin, source, el) {
  if (plugin && typeof plugin.studyMapEnabled === "function" && !plugin.studyMapEnabled()) {
    el.createDiv({ cls: "qt-study-map-issue", text: "Study map is off. Turn it on in Settings, Global, Modules." });
    return null;
  }
  const parsed = parseStudyMapSource(source);
  let text = parsed.lines.join("\n").trim();
  let sourcePath = "";
  if (parsed.path) {
    sourcePath = parsed.path;
    const file = plugin && plugin.app && typeof plugin.app.vault.getAbstractFileByPath === "function"
      ? plugin.app.vault.getAbstractFileByPath(parsed.path)
      : null;
    if (!file) {
      el.createDiv({ cls: "qt-study-map-issue", text: `Source note not found: ${parsed.path}` });
      return null;
    }
    try {
      text = str(await plugin.app.vault.cachedRead(file));
    } catch (e) {
      el.createDiv({ cls: "qt-study-map-issue", text: `Could not read ${parsed.path}: ${str(e && e.message ? e.message : e)}` });
      return null;
    }
  }
  if (!text) {
    el.createDiv({ cls: "qt-study-map-issue", text: "Add a Source: note path or an inline outline with headings or bullets." });
    return null;
  }
  const map = buildStudyMap(text, { title: parsed.title || (parsed.path ? parsed.path.replace(/^.*\//, "").replace(/\.md$/i, "") : "Study map"), depth: parsed.depth, terms: parsed.terms });
  const box = el.createDiv({ cls: "qt-study-map" });
  box.createDiv({ cls: "qt-study-map-title", text: map.title });
  box.createDiv({ cls: "qt-study-map-meta", text: map.summary });
  for (const issue of map.issues.slice(0, 4)) box.createDiv({ cls: "qt-study-map-issue", text: issue });
  if (map.terms.length) {
    const terms = box.createDiv({ cls: "qt-study-map-terms" });
    for (const term of map.terms) terms.createSpan({ cls: "qt-study-map-term", text: `${term.term} (${term.count})` });
  }
  renderNodes(box.createDiv({ cls: "qt-study-map-tree" }), map.nodes);
  if (sourcePath) {
    const row = box.createDiv({ cls: "qt-row" });
    row.createEl("button", { text: "Open source" }).addEventListener("click", () => {
      if (plugin && typeof plugin.openStudyFlowSource === "function") plugin.openStudyFlowSource(sourcePath);
    });
  }
  return map;
}

module.exports = {
  buildOutline,
  buildStudyMap,
  extractKeyTerms,
  normalizeStudyMapSettings,
  parseStudyMapSource,
  renderStudyMapBlock,
};
