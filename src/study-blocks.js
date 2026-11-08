"use strict";
/*
 * Four clean-room note surfaces:
 *   desmos-graph  an embedded graph drawn by the local Reference Graph engine
 *   mindmap       a visual Markdown/Markmind tree with collapsible branches
 *   grill         a self-graded recall session built from one note
 *   deadlines     upcoming assignment notes, ready to open
 *
 * Nothing here copies a community plugin. The graph, tree and question text
 * come from local modules and the note itself; no network or model call is made.
 */
const { buildGraph } = require("./reference-graph");
const { assignmentTasks } = require("./assignments");
const mindmap = require("./mindmap");
const { str } = require("./util");

const DESMOS_COLORS = ["#2f6feb", "#d6336c", "#2b8a3e", "#e8590c", "#6741d9", "#0c8599", "#b8860b", "#495057"];
const DESMOS_DEFAULTS = { xMin: -10, xMax: 10, yMin: -10, yMax: 10, width: 640, height: 360, grid: true };
const MAX_QUESTIONS = 30;

function linesOf(source) {
  return String(source == null ? "" : source).replace(/\r\n?/g, "\n").split("\n");
}

function cleanText(value) {
  return str(value).replace(/\s+/g, " ").trim();
}

function boundedNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function boolValue(value, fallback) {
  const raw = str(value).toLowerCase();
  if (["true", "yes", "on", "1"].includes(raw)) return true;
  if (["false", "no", "off", "0"].includes(raw)) return false;
  return fallback;
}

/* --------------------------------------------------------------- Desmos block */

/** Settings are `key=value` lines before an optional `---`; every other line is an expression. */
function parseDesmosBlock(source) {
  const settings = { ...DESMOS_DEFAULTS };
  const rows = [];
  let inSettings = true;
  for (const line of linesOf(source)) {
    const raw = line.trim();
    if (!raw || raw.startsWith("#") || raw.startsWith("//")) continue;
    if (raw === "---") {
      inSettings = false;
      continue;
    }
    const setting = /^(left|right|bottom|top|xmin|xmax|ymin|ymax|width|height|grid)\s*[:=]\s*(.+)$/i.exec(raw);
    if (inSettings && setting) {
      const key = setting[1].toLowerCase();
      const value = setting[2].trim();
      if (key === "left" || key === "xmin") settings.xMin = boundedNumber(value, settings.xMin);
      else if (key === "right" || key === "xmax") settings.xMax = boundedNumber(value, settings.xMax);
      else if (key === "bottom" || key === "ymin") settings.yMin = boundedNumber(value, settings.yMin);
      else if (key === "top" || key === "ymax") settings.yMax = boundedNumber(value, settings.yMax);
      else if (key === "width") settings.width = Math.max(160, Math.min(1200, Math.round(boundedNumber(value, settings.width))));
      else if (key === "height") settings.height = Math.max(140, Math.min(900, Math.round(boundedNumber(value, settings.height))));
      else if (key === "grid") settings.grid = boolValue(value, settings.grid);
      continue;
    }
    inSettings = false;
    rows.push(parseDesmosRow(raw));
  }
  if (!rows.length) throw new Error("Add at least one expression after the optional settings block.");
  return { settings, rows };
}

/** One expression plus the small `|color:`, `|style:`, `|width:` and `|hidden` controls. */
function parseDesmosRow(raw) {
  const parts = String(raw).split("|");
  const text = normalizeDesmosExpression(parts.shift());
  const options = { color: "", dashed: false, hidden: false, width: 2 };
  for (const part of parts) {
    const item = part.trim();
    const pair = /^([a-z]+)\s*[:=]\s*(.+)$/i.exec(item);
    if (!pair) {
      if (item === "hidden" || item === "hide") options.hidden = true;
      if (item === "dashed" || item === "dotted") options.dashed = true;
      continue;
    }
    const key = pair[1].toLowerCase();
    const value = pair[2].trim();
    if (key === "color") options.color = /^#?[0-9a-f]{3,8}$/i.test(value) ? (value.startsWith("#") ? value : `#${value}`) : value;
    else if (key === "style") options.dashed = value === "dashed" || value === "dotted";
    else if (key === "width") options.width = Math.max(1, Math.min(8, boundedNumber(value, 2)));
    else if (key === "hidden") options.hidden = boolValue(value, true);
  }
  return { text, options };
}

/** Translate the common Desmos LaTeX forms into the local graph parser's syntax. */
function normalizeDesmosExpression(value) {
  return String(value == null ? "" : value)
    .replace(/\\(?:left|right|,|;|!|quad|qquad)/g, " ")
    .replace(/\\operatorname\s*\{([^{}]+)\}/g, "$1")
    .replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, "(($1)/($2))")
    .replace(/\\sqrt\s*\{([^{}]+)\}/g, "sqrt($1)")
    .replace(/\\pi\b/g, "pi")
    .replace(/\\theta\b/g, "theta")
    .replace(/\\le\b/g, "<=")
    .replace(/\\ge\b/g, ">=")
    .replace(/\\ne\b/g, "!=")
    .replace(/\\(sin|cos|tan|sec|csc|cot|arcsin|arccos|arctan|sinh|cosh|tanh|log|ln|exp|max|min|abs)\b/g, "$1")
    .replace(/\\cdot\b|\\times\b/g, "*")
    .replace(/[{}]/g, (brace) => (brace === "{" ? "(" : ")"))
    .replace(/\\[a-zA-Z]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Build one graph, keeping the settings and per-row controls beside the parsed rows. */
function buildDesmosGraph(block) {
  const input = block || { settings: DESMOS_DEFAULTS, rows: [] };
  const settings = input.settings || DESMOS_DEFAULTS;
  const graph = buildGraph({
    rows: input.rows.map((row) => ({ text: row.options && row.options.hidden ? "" : row.text })),
    xMin: settings.xMin,
    xMax: settings.xMax,
    yMin: settings.yMin,
    yMax: settings.yMax,
    samples: 420,
    resolution: { x: 140, y: 90 },
    regionResolution: { x: 70, y: 54 },
  });
  graph.rows.forEach((row, index) => {
    const source = input.rows[index] || { options: {} };
    row.options = source.options || {};
    row.color = row.options.color || DESMOS_COLORS[index % DESMOS_COLORS.length];
    row.sourceText = source.text || "";
  });
  return graph;
}

function svgNumber(value) {
  return Number.isFinite(Number(value)) ? String(Math.round(Number(value) * 100) / 100) : "0";
}

function svgElement(parent, tag, attrs) {
  let node;
  if (typeof parent.createSvg === "function" && parent.createSvg.length > 0) node = parent.createSvg(tag);
  else if (typeof parent.createEl === "function") node = parent.createEl(tag);
  else if (typeof parent.ownerDocument !== "undefined" && parent.ownerDocument && parent.ownerDocument.createElementNS) {
    node = parent.ownerDocument.createElementNS("http://www.w3.org/2000/svg", tag);
    parent.appendChild(node);
  } else {
    node = parent;
  }
  for (const [name, value] of Object.entries(attrs || {})) {
    if (value === undefined || value === null) continue;
    if (typeof node.setAttribute === "function") node.setAttribute(name, String(value));
    else if (name === "text") node.textContent = String(value);
  }
  return node;
}

function niceStep(range, target) {
  const raw = Math.abs(range) / Math.max(1, target);
  if (!(raw > 0) || !Number.isFinite(raw)) return 1;
  const power = Math.pow(10, Math.floor(Math.log10(raw)));
  const normal = raw / power;
  const step = normal <= 1 ? 1 : normal <= 2 ? 2 : normal <= 5 ? 5 : 10;
  return step * power;
}

function drawGrid(svg, graph, width, height) {
  const px = (x) => ((x - graph.xMin) / (graph.xMax - graph.xMin)) * width;
  const py = (y) => height - ((y - graph.yMin) / (graph.yMax - graph.yMin)) * height;
  const stepX = niceStep(graph.xMax - graph.xMin, 8);
  const stepY = niceStep(graph.yMax - graph.yMin, 6);
  for (let x = Math.ceil(graph.xMin / stepX) * stepX; x <= graph.xMax; x += stepX) {
    const sx = px(x);
    svgElement(svg, "line", { x1: sx, y1: 0, x2: sx, y2: height, class: "qt-desmos-grid-line" });
  }
  for (let y = Math.ceil(graph.yMin / stepY) * stepY; y <= graph.yMax; y += stepY) {
    const sy = py(y);
    svgElement(svg, "line", { x1: 0, y1: sy, x2: width, y2: sy, class: "qt-desmos-grid-line" });
  }
  if (graph.yMin < 0 && graph.yMax > 0) svgElement(svg, "line", { x1: 0, y1: py(0), x2: width, y2: py(0), class: "qt-desmos-axis" });
  if (graph.xMin < 0 && graph.xMax > 0) svgElement(svg, "line", { x1: px(0), y1: 0, x2: px(0), y2: height, class: "qt-desmos-axis" });
}

function pointsPath(points, px, py, width, height) {
  let path = "";
  let drawing = false;
  let lastX = null;
  let lastY = null;
  for (const point of points || []) {
    if (!point || point.y === null) {
      drawing = false;
      lastX = null;
      lastY = null;
      continue;
    }
    const x = px(point.x);
    const y = py(point.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      drawing = false;
      continue;
    }
    const jump = drawing && ((lastX !== null && Math.abs(x - lastX) > width * 0.8) || (lastY !== null && Math.abs(y - lastY) > height * 0.8));
    path += `${drawing && !jump ? "L" : "M"}${svgNumber(x)} ${svgNumber(y)}`;
    drawing = true;
    lastX = x;
    lastY = y;
  }
  return path;
}

function drawGraph(svg, graph, width, height) {
  const px = (x) => ((x - graph.xMin) / (graph.xMax - graph.xMin)) * width;
  const py = (y) => height - ((y - graph.yMin) / (graph.yMax - graph.yMin)) * height;
  for (const row of graph.rows) {
    if (!row.options || row.options.hidden) continue;
    const color = row.color || DESMOS_COLORS[row.index % DESMOS_COLORS.length];
    if (row.region) {
      const region = row.region;
      const cellWidth = Math.abs(px(region.x0 + region.dx) - px(region.x0)) + 0.5;
      const cellHeight = Math.abs(py(region.y0 + region.dy) - py(region.y0)) + 0.5;
      for (let j = 0; j < region.rows; j++) {
        for (let i = 0; i < region.cols; i++) {
          if (!region.cells[j * region.cols + i]) continue;
          svgElement(svg, "rect", {
            x: px(region.x0 + region.dx * i),
            y: py(region.y0 + region.dy * (j + 1)),
            width: cellWidth,
            height: cellHeight,
            fill: color,
            opacity: "0.16",
          });
        }
      }
    }
    if (row.polygon && row.polygon.length >= 3) {
      const points = row.polygon.map((point) => `${svgNumber(px(point.x))},${svgNumber(py(point.y))}`);
      svgElement(svg, "polygon", { points: points.join(" "), fill: color, opacity: "0.18" });
    }
    if (row.points && row.points.length) {
      const path = pointsPath(row.points, px, py, width, height);
      if (path) {
        svgElement(svg, "path", {
          d: path,
          fill: "none",
          stroke: color,
          "stroke-width": row.options.width || 2,
          "stroke-dasharray": row.options.dashed ? "6 4" : undefined,
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        });
      }
    }
    if (row.segments && row.segments.length) {
      let path = "";
      for (const segment of row.segments) {
        path += `M${svgNumber(px(segment.x1))} ${svgNumber(py(segment.y1))}L${svgNumber(px(segment.x2))} ${svgNumber(py(segment.y2))}`;
      }
      svgElement(svg, "path", {
        d: path,
        fill: "none",
        stroke: color,
        "stroke-width": row.options.width || 2,
        "stroke-dasharray": row.options.dashed || row.strict ? "6 4" : undefined,
        "stroke-linecap": "round",
      });
    }
    for (const marker of row.markers || []) {
      svgElement(svg, "circle", { cx: px(marker.x), cy: py(marker.y), r: 4, fill: color });
    }
  }
}

function hasDrawingContent(graph) {
  return graph.rows.some((row) => {
    if (!row || (row.options && row.options.hidden) || row.error) return false;
    return (
      (row.points && row.points.some((point) => point.y !== null)) ||
      (row.segments && row.segments.length > 0) ||
      (row.region && row.region.cells && row.region.cells.some(Boolean)) ||
      (row.markers && row.markers.length > 0) ||
      (row.polygon && row.polygon.length >= 3)
    );
  });
}

function renderDesmosBlock(source, el) {
  el.empty();
  const shell = el.createDiv({ cls: "qt-desmos" });
  let block;
  try {
    block = parseDesmosBlock(source);
  } catch (error) {
    shell.createDiv({ cls: "qt-desmos-error", text: error && error.message ? error.message : "That graph block is not valid." });
    return { ok: false, error: block };
  }
  let graph;
  try {
    graph = buildDesmosGraph(block);
  } catch (error) {
    shell.createDiv({ cls: "qt-desmos-error", text: error && error.message ? error.message : "That graph could not be drawn." });
    return { ok: false, error: graph };
  }
  if (!hasDrawingContent(graph)) {
    const message = graph.rows.map((row) => row.error).filter(Boolean)[0] || "Nothing to draw. Add a complete expression, point, curve or inequality.";
    shell.createDiv({ cls: "qt-desmos-error", text: message });
    return { ok: false, block, graph };
  }
  const width = block.settings.width;
  const height = block.settings.height;
  const svg = svgElement(shell, "svg", {
    viewBox: `0 0 ${width} ${height}`,
    width: "100%",
    height: String(height),
    role: "img",
    "aria-label": "Embedded graph",
    class: "qt-desmos-svg",
  });
  if (block.settings.grid) drawGrid(svg, graph, width, height);
  drawGraph(svg, graph, width, height);

  const legend = shell.createDiv({ cls: "qt-desmos-legend" });
  for (const row of graph.rows) {
    const item = legend.createDiv({ cls: "qt-desmos-legend-row" });
    item.createSpan({ cls: "qt-desmos-swatch", attr: { style: `background:${row.color}` } });
    item.createSpan({ cls: "qt-desmos-expression", text: row.sourceText || row.text });
    if (row.options && row.options.hidden) item.createSpan({ cls: "qt-desmos-note", text: "hidden" });
    if (row.error) item.createSpan({ cls: "qt-desmos-row-error", text: row.error });
  }
  if (graph.dataError) shell.createDiv({ cls: "qt-desmos-error", text: graph.dataError });
  shell.createDiv({
    cls: "qt-desmos-note",
    text: "Drawn locally with the Reference Graph engine. Settings: left, right, bottom, top, width, height, grid. Row controls: color, style, width, hidden.",
  });
  return { ok: true, block, graph };
}

/* --------------------------------------------------------------- Mind map block */

function parseMindmapBlock(source) {
  const settings = { source: "", title: "", layout: "right" };
  const body = [];
  let inSettings = true;
  for (const line of linesOf(source)) {
    const raw = line.trim();
    if (inSettings && raw === "---") {
      inSettings = false;
      continue;
    }
    const setting = inSettings ? /^(source|note|title|layout)\s*[:=]\s*(.*)$/i.exec(raw) : null;
    if (setting) {
      const key = setting[1].toLowerCase();
      if (key === "source" || key === "note") settings.source = setting[2].trim();
      else if (key === "title") settings.title = setting[2].trim();
      else if (key === "layout") settings.layout = setting[2].trim().toLowerCase() === "down" ? "down" : "right";
      continue;
    }
    if (inSettings && !raw) continue;
    inSettings = false;
    body.push(line);
  }
  return { settings, body: body.join("\n").trim() };
}

function mindmapTree(text, options) {
  const opts = options || {};
  const source = String(text == null ? "" : text);
  let root;
  if (mindmap.isMarkmind(source)) root = mindmap.parseMarkmind(source).root;
  else root = mindmap.mindmapFromMarkdown(source);
  if (opts.title && root && !root.children.length) root.text = opts.title;
  return root;
}

function renderMindmapNode(parent, node, depth) {
  const item = parent.createEl("li", { cls: `qt-mindmap-node is-depth-${Math.min(depth, 6)}` });
  const head = item.createDiv({ cls: "qt-mindmap-head" });
  if (node.children && node.children.length) {
    const toggle = head.createEl("button", {
      cls: "qt-mindmap-toggle",
      text: "−",
      attr: { type: "button", "aria-label": "Collapse branch" },
    });
    const list = item.createEl("ul", { cls: "qt-mindmap-children" });
    toggle.addEventListener("click", () => {
      list.toggleClass("is-collapsed", !list.hasClass("is-collapsed"));
      toggle.setText(list.hasClass("is-collapsed") ? "+" : "−");
    });
    renderMindmapNodes(list, node.children, depth + 1);
  }
  head.createSpan({ cls: "qt-mindmap-label", text: node.text || "Untitled" });
  return item;
}

function renderMindmapNodes(parent, nodes, depth) {
  for (const node of nodes || []) renderMindmapNode(parent, node, depth);
}

async function readMindmapSource(plugin, source, ctx) {
  const target = cleanText(source);
  if (!target) return "";
  const app = plugin && plugin.app;
  if (!app) throw new Error("The vault is unavailable.");
  let file = null;
  if (app.metadataCache && typeof app.metadataCache.getFirstLinkpathDest === "function") {
    file = app.metadataCache.getFirstLinkpathDest(target, ctx && ctx.sourcePath ? ctx.sourcePath : "");
  }
  if (!file && app.vault && typeof app.vault.getAbstractFileByPath === "function") {
    file = app.vault.getAbstractFileByPath(target.endsWith(".md") ? target : `${target}.md`);
  }
  if (!file) throw new Error(`Could not find ${target}. Use a vault path or a [[link]].`);
  return app.vault.cachedRead ? app.vault.cachedRead(file) : app.vault.read(file);
}

async function renderMindmapBlock(plugin, source, el, ctx) {
  el.empty();
  const shell = el.createDiv({ cls: "qt-mindmap" });
  const block = parseMindmapBlock(source);
  let text = block.body;
  if (block.settings.source) {
    try {
      text = await readMindmapSource(plugin, block.settings.source.replace(/^\[\[|\]\]$/g, ""), ctx);
    } catch (error) {
      shell.createDiv({ cls: "qt-mindmap-error", text: error && error.message ? error.message : "Could not read that map note." });
      return { ok: false };
    }
  }
  if (!text) {
    shell.createDiv({ cls: "qt-mindmap-error", text: "Add Markdown headings or a list, or set Source to a Markmind or Markdown note." });
    return { ok: false };
  }
  const root = mindmapTree(text, { title: block.settings.title });
  const header = shell.createDiv({ cls: "qt-mindmap-header" });
  header.createEl("strong", { text: root.text || block.settings.title || "Mind map" });
  if (block.settings.source) header.createSpan({ cls: "qt-mindmap-note", text: block.settings.source });
  const tree = shell.createEl("ul", { cls: `qt-mindmap-tree is-${block.settings.layout}` });
  renderMindmapNode(tree, root, 0);
  shell.createDiv({ cls: "qt-mindmap-note", text: "Visual tree from Markdown. Use the +/− buttons to fold branches; the note stays the source of truth." });
  return { ok: true, root };
}

/* --------------------------------------------------------------- Grill block */

function parseGrillBlock(source) {
  const settings = { source: "", count: 8, title: "" };
  const body = [];
  let inSettings = true;
  for (const line of linesOf(source)) {
    const raw = line.trim();
    if (inSettings && raw === "---") {
      inSettings = false;
      continue;
    }
    const setting = inSettings ? /^(source|note|count|title)\s*[:=]\s*(.*)$/i.exec(raw) : null;
    if (setting) {
      const key = setting[1].toLowerCase();
      if (key === "source" || key === "note") settings.source = setting[2].trim();
      else if (key === "count") settings.count = Math.max(1, Math.min(MAX_QUESTIONS, Math.round(boundedNumber(setting[2], settings.count))));
      else if (key === "title") settings.title = setting[2].trim();
      continue;
    }
    if (inSettings && !raw) continue;
    inSettings = false;
    body.push(line);
  }
  return { settings, body: body.join("\n").trim() };
}

function plainSentence(value, limit) {
  const text = str(value)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return stop > limit * 0.5 ? cut.slice(0, stop + 1) : `${cut.trim()}…`;
}

function stripFrontmatter(text) {
  const source = String(text == null ? "" : text).replace(/\r\n?/g, "\n");
  return source.replace(/^---\n[\s\S]*?\n---\n?/, "");
}

/** Build deterministic questions from headings, definition lines and bold terms. */
function grillQuestions(text, options) {
  const opts = options || {};
  const count = Math.max(1, Math.min(MAX_QUESTIONS, Math.round(boundedNumber(opts.count, 8))));
  const source = stripFrontmatter(text);
  const lines = source.split("\n");
  const rows = [];
  let heading = "";
  let headingBody = [];
  const flushHeading = () => {
    if (!heading) return;
    const generic = /^(notes?|summary|introduction|overview|contents|references|sources|key terms|vocabulary)$/i.test(heading);
    const answer = plainSentence(headingBody.join(" "), 340);
    if (!generic && answer.length >= 20) rows.push({ question: `Explain “${heading}”.`, answer, kind: "heading" });
    heading = "";
    headingBody = [];
  };
  for (const line of lines) {
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (match) {
      flushHeading();
      heading = match[2].trim();
      continue;
    }
    if (heading) headingBody.push(line);
  }
  flushHeading();

  for (const line of lines) {
    if (/^\s*(?:[-*+]|\d+[.)])\s+/.test(line) || /^#{1,6}\s/.test(line)) {
      const definition = /^\s*(?:[-*+]|\d+[.)])?\s*(?:\*\*|__)?([^:\n*_]{2,80})(?:\*\*|__)?\s*:\s+(.{8,400})$/.exec(line);
      if (definition) {
        const term = cleanText(definition[1]);
        const answer = plainSentence(definition[2], 340);
        if (term && answer.length >= 8 && !/^https?$/i.test(term)) rows.push({ question: `Define “${term}”.`, answer, kind: "definition" });
      }
    }
  }

  if (rows.length < count) {
    for (const match of source.matchAll(/\*\*([^*\n]{2,80})\*\*/g)) {
      const term = cleanText(match[1]);
      if (!term || /^\d+$/.test(term)) continue;
      const start = Math.max(0, match.index - 160);
      const context = plainSentence(source.slice(start, match.index + term.length + 280), 300);
      if (context.length >= 20) rows.push({ question: `What is “${term}” in this note?`, answer: context, kind: "term" });
    }
  }

  const seen = new Set();
  const unique = [];
  for (const row of rows) {
    const key = `${row.question}\n${row.answer}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }
  const shuffled = unique.slice(0, count);
  if (!shuffled.length) {
    const fallback = plainSentence(source, 360);
    if (fallback.length >= 20) shuffled.push({ question: "Summarize this note.", answer: fallback, kind: "summary" });
  }
  return shuffled;
}

async function renderGrillBlock(plugin, source, el, ctx) {
  el.empty();
  const shell = el.createDiv({ cls: "qt-grill" });
  const block = parseGrillBlock(source);
  let text = block.body;
  if (block.settings.source) {
    try {
      text = await readMindmapSource(plugin, block.settings.source.replace(/^\[\[|\]\]$/g, ""), ctx);
    } catch (error) {
      shell.createDiv({ cls: "qt-grill-error", text: error && error.message ? error.message : "Could not read that note." });
      return { ok: false };
    }
  }
  const questions = grillQuestions(text, { count: block.settings.count });
  if (!questions.length) {
    shell.createDiv({ cls: "qt-grill-error", text: "Could not find headings, definitions or bold terms to ask about. Add some structure to the note." });
    return { ok: false };
  }
  const title = shell.createDiv({ cls: "qt-grill-title", text: block.settings.title || "Grill session" });
  const progress = shell.createDiv({ cls: "qt-grill-progress" });
  const card = shell.createDiv({ cls: "qt-grill-card" });
  let index = 0;
  let revealed = false;
  let known = 0;
  let missed = 0;
  let answered = false;

  const draw = () => {
    card.empty();
    if (index >= questions.length) {
      progress.setText(`${known} knew · ${missed} to review · ${questions.length} asked`);
      card.createDiv({ cls: "qt-grill-done", text: `Session complete — ${known} of ${questions.length} recalled.` });
      card.createDiv({ cls: "qt-grill-note", text: "Nothing was written or sent. Run the block again for a fresh self-graded session." });
      card.createEl("button", { cls: "mod-cta", text: "Start again" }).addEventListener("click", () => {
        index = 0;
        known = 0;
        missed = 0;
        revealed = false;
        answered = false;
        draw();
      });
      return;
    }
    const q = questions[index];
    progress.setText(`Question ${index + 1} of ${questions.length}`);
    card.createDiv({ cls: "qt-grill-question", text: q.question });
    card.createDiv({ cls: "qt-grill-kind", text: q.kind === "definition" ? "Definition" : q.kind === "heading" ? "Explain" : q.kind === "term" ? "Key term" : "Recall" });
    if (!revealed) {
      card.createEl("button", { cls: "mod-cta qt-grill-reveal", text: "Show answer" }).addEventListener("click", () => {
        revealed = true;
        draw();
      });
      return;
    }
    card.createDiv({ cls: "qt-grill-answer", text: q.answer });
    if (answered) {
      card.createEl("button", { cls: "mod-cta", text: "Next question" }).addEventListener("click", () => {
        index++;
        revealed = false;
        answered = false;
        draw();
      });
      return;
    }
    const actions = card.createDiv({ cls: "qt-grill-actions" });
    actions.createEl("button", { cls: "mod-cta", text: "I knew it" }).addEventListener("click", () => {
      known++;
      answered = true;
      draw();
    });
    actions.createEl("button", { text: "Review again" }).addEventListener("click", () => {
      missed++;
      answered = true;
      draw();
    });
  };
  draw();
  return { ok: true, questions };
}

/* --------------------------------------------------------------- Deadlines block */

function parseDeadlineBlock(source) {
  const settings = { days: 14, course: "", limit: 12 };
  for (const line of linesOf(source)) {
    const raw = line.trim();
    if (!raw || raw === "---") continue;
    const match = /^(days|course|limit)\s*[:=]\s*(.+)$/i.exec(raw);
    if (!match) continue;
    const key = match[1].toLowerCase();
    if (key === "days") settings.days = Math.max(0, Math.min(365, Math.round(boundedNumber(match[2], settings.days))));
    else if (key === "limit") settings.limit = Math.max(1, Math.min(50, Math.round(boundedNumber(match[2], settings.limit))));
    else if (key === "course") settings.course = match[2].trim();
  }
  return settings;
}

function deadlineRows(assignments, options, today) {
  const opts = options || {};
  const rows = assignmentTasks(assignments || [], { today, days: opts.days === undefined ? 14 : opts.days });
  const course = cleanText(opts.course).toLowerCase();
  return rows
    .filter((row) => !course || cleanText(row.assignment.course).toLowerCase() === course || cleanText(row.assignment.courseName).toLowerCase() === course)
    .slice(0, opts.limit === undefined ? 12 : opts.limit)
    .map((row) => ({
      id: row.assignment.id,
      title: row.assignment.title,
      course: row.assignment.course || row.assignment.courseName || "",
      due: row.assignment.due,
      label: row.state.label,
      state: row.state.id,
      file: row.assignment.file,
    }));
}

function renderDeadlinesBlock(plugin, source, el, today) {
  el.empty();
  const settings = parseDeadlineBlock(source);
  const shell = el.createDiv({ cls: "qt-deadlines" });
  const assignments = plugin && typeof plugin.getAssignments === "function" ? plugin.getAssignments() : [];
  const rows = deadlineRows(assignments, settings, today);
  const head = shell.createDiv({ cls: "qt-deadlines-head" });
  head.createEl("strong", { text: "Upcoming deadlines" });
  head.createSpan({ cls: "qt-deadlines-note", text: `next ${settings.days} day${settings.days === 1 ? "" : "s"}` });
  if (!rows.length) {
    shell.createDiv({ cls: "qt-deadlines-empty", text: "No open assignments with a due date in this window. Add an assignment note with `assignment: true` and a due date." });
    return { ok: true, rows: [] };
  }
  const list = shell.createDiv({ cls: "qt-deadlines-list" });
  for (const row of rows) {
    const item = list.createDiv({ cls: `qt-deadlines-row is-${row.state}` });
    const main = item.createEl("button", { cls: "qt-deadlines-main", text: row.title });
    main.addEventListener("click", () => {
      const file = row.file;
      if (!file) return;
      const leaf = plugin.app.workspace.getLeaf("tab");
      if (leaf && leaf.openFile) leaf.openFile(file);
    });
    const meta = item.createDiv({ cls: "qt-deadlines-meta" });
    if (row.course) meta.createSpan({ cls: "qt-deadlines-course", text: row.course });
    meta.createSpan({ cls: "qt-deadlines-due", text: `${row.due} · ${row.label}` });
  }
  return { ok: true, rows };
}

module.exports = {
  DESMOS_DEFAULTS,
  parseDesmosBlock,
  normalizeDesmosExpression,
  buildDesmosGraph,
  renderDesmosBlock,
  parseMindmapBlock,
  mindmapTree,
  renderMindmapBlock,
  parseGrillBlock,
  grillQuestions,
  renderGrillBlock,
  parseDeadlineBlock,
  deadlineRows,
  renderDeadlinesBlock,
};
