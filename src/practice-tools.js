"use strict";
/*
 * Bluebook-style testing tools for the Practice view.
 *
 * This module is pure data and state: it holds the official tool list used by
 * the drawer, the SAT math reference sheet, the highlight model, the option
 * eliminator, the question menu summary, zoom levels and the keyboard map.
 * Nothing here touches the DOM, so every rule can be tested directly.
 *
 * The tool list mirrors the tools College Board documents for Bluebook:
 * testing timer, calculator, reference sheet, highlights and notes, mark for
 * review, line reader, option eliminator, question menu, zoom and colour
 * contrast, plus the expanded passage view. This plugin draws its own versions;
 * no College Board or Desmos code, data or artwork is bundled.
 */

const { str } = require("./util");

/* ---------------------------------------------------------------- catalogue */

const BLUEBOOK_TOOLS = [
  {
    id: "timer",
    label: "Hide timer",
    short: "Timer",
    description: "Hide the timer while you work. It comes back with a five-minute warning.",
    icon: "timer",
  },
  {
    id: "eliminator",
    label: "Option eliminator",
    short: "Cross out",
    description: "Cross out choices you think are wrong, and undo them if you change your mind.",
    icon: "strikethrough",
  },
  {
    id: "highlights",
    label: "Highlights & notes",
    short: "Highlight",
    description: "Highlight a selection, keep a note and see every highlight for this question.",
    icon: "highlighter",
  },
  {
    id: "lineReader",
    label: "Line reader",
    short: "Line reader",
    description: "Shadow everything except the band under the pointer while you read.",
    icon: "scan-line",
  },
  {
    id: "calculator",
    label: "Calculator",
    short: "Calculator",
    description: "A local basic or scientific calculator. It works offline and sends nothing.",
    icon: "calculator",
  },
  {
    id: "reference",
    label: "Reference sheet",
    short: "Reference",
    description: "The standard SAT math reference formulas.",
    icon: "book-open",
  },
  {
    id: "review",
    label: "Mark for review",
    short: "Flag",
    description: "Flag this question so the question menu can bring you back.",
    icon: "bookmark",
  },
  {
    id: "navigator",
    label: "Question menu",
    short: "Questions",
    description: "See answered, skipped and flagged questions, then jump to any of them.",
    icon: "list",
  },
  {
    id: "zoom",
    label: "Zoom",
    short: "Zoom",
    description: "Zoom the question in or out, or reset it to 100%.",
    icon: "zoom-in",
  },
  {
    id: "contrast",
    label: "Color contrast",
    short: "Contrast",
    description: "Switch the question to a high-contrast black-on-white surface.",
    icon: "contrast",
  },
  {
    id: "expand",
    label: "Expand passage",
    short: "Expand",
    description: "Give the passage the whole pane while you read.",
    icon: "maximize-2",
  },
  {
    id: "help",
    label: "Directions & help",
    short: "Help",
    description: "How the tools work, with the keyboard shortcuts.",
    icon: "help-circle",
  },
];

const TOOL_IDS = BLUEBOOK_TOOLS.map((tool) => tool.id).concat(["shortcuts", "assistive", "break"]);

/* --------------------------------------------------------------- shortcuts */

/** Keycaps as they read in the help panel; `practiceToolShortcut` matches them. */
const TOOL_SHORTCUTS = [
  { keys: "F1", action: "help", label: "Open or close directions and help" },
  { keys: "Ctrl/⌘ + Alt + C", action: "calculator", label: "Open or close the calculator" },
  { keys: "Ctrl/⌘ + Alt + R", action: "reference", label: "Open or close the reference sheet" },
  { keys: "Ctrl/⌘ + Alt + G", action: "navigator", label: "Open or close the question menu" },
  { keys: "Ctrl/⌘ + Alt + Shift + D", action: "help", label: "Open or close directions" },
  { keys: "Ctrl/⌘ + Alt + T", action: "timer", label: "Hide or show the timer" },
  { keys: "Ctrl/⌘ + Alt + V", action: "review", label: "Mark this question for review" },
  { keys: "Ctrl/⌘ + Alt + O", action: "eliminator", label: "Turn the option eliminator on or off" },
  { keys: "Ctrl/⌘ + L", action: "line-reader", label: "Turn the line reader on or off" },
  { keys: "Ctrl/⌘ + H", action: "highlights", label: "Open or close highlights and notes" },
  { keys: "Ctrl/⌘ + Plus", action: "zoom-in", label: "Zoom in" },
  { keys: "Ctrl/⌘ + Minus", action: "zoom-out", label: "Zoom out" },
  { keys: "Ctrl/⌘ + 0", action: "zoom-reset", label: "Zoom back to 100%" },
];

/** Modifier-free keys that belong to the question itself, never to a tool. */
function practiceToolShortcut(event) {
  if (!event) return "";
  const key = String(event.key || "").toLowerCase();
  const mod = event.ctrlKey === true || event.metaKey === true;
  const alt = event.altKey === true;
  const shift = event.shiftKey === true;
  if (key === "f1") return "help";
  if (mod && !alt && (key === "+" || key === "=")) return "zoom-in";
  if (mod && !alt && key === "-") return "zoom-out";
  if (mod && !alt && key === "0") return "zoom-reset";
  if (mod && alt) {
    if (shift && key === "d") return "help";
    if (shift) return "";
    if (key === "c") return "calculator";
    if (key === "r") return "reference";
    if (key === "g") return "navigator";
    if (key === "t") return "timer";
    if (key === "v") return "review";
    if (key === "o") return "eliminator";
    return "";
  }
  if (mod && !shift && key === "h") return "highlights";
  if (mod && !shift && key === "l") return "line-reader";
  return "";
}

/* --------------------------------------------------------------------- zoom */

const ZOOM_LEVELS = [50, 75, 90, 100, 110, 125, 150, 200];
const ZOOM_MIN = 50;
const ZOOM_MAX = 200;

function normalizeZoom(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 100;
  const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(n)));
  let best = ZOOM_LEVELS[0];
  for (const level of ZOOM_LEVELS) {
    if (Math.abs(level - clamped) < Math.abs(best - clamped)) best = level;
  }
  return best;
}

function zoomIn(value) {
  const current = normalizeZoom(value);
  return ZOOM_LEVELS.find((level) => level > current) || current;
}

function zoomOut(value) {
  const current = normalizeZoom(value);
  const lower = ZOOM_LEVELS.filter((level) => level < current);
  return lower.length ? lower[lower.length - 1] : current;
}

function zoomLabel(value) {
  return `${normalizeZoom(value)}%`;
}

/* ------------------------------------------------------------------- timer */

const TIMER_WARNING_SECONDS = 300;

/** True once, when a countdown first reaches the five-minute mark. */
function shouldWarnFive(secondsLeft, warned, totalSeconds) {
  const left = Number(secondsLeft);
  // A session that is only five minutes long starts at this warning and needs no "five minutes left" line.
  if (totalSeconds !== undefined) {
    const total = Number(totalSeconds);
    if (!Number.isFinite(total) || total <= TIMER_WARNING_SECONDS) return false;
  }
  return warned !== true && Number.isFinite(left) && left > 0 && left <= TIMER_WARNING_SECONDS;
}

/** A hidden timer stays hidden until the five-minute mark, then comes back. */
function timerVisible(hidden, secondsLeft) {
  if (hidden !== true) return true;
  const left = Number(secondsLeft);
  return Number.isFinite(left) && left <= TIMER_WARNING_SECONDS;
}

/* ----------------------------------------------------- option eliminator */

function isEliminated(letters, letter) {
  const key = str(letter).trim().toUpperCase();
  if (!key) return false;
  return !!(letters && typeof letters.has === "function" && letters.has(key));
}

/** Adds or removes a crossed-out letter. Returns true when it is now crossed out. */
function toggleEliminated(letters, letter) {
  const key = str(letter).trim().toUpperCase();
  if (!letters || typeof letters.add !== "function" || !key) return false;
  if (letters.has(key)) {
    letters.delete(key);
    return false;
  }
  letters.add(key);
  return true;
}

function clearEliminated(letters) {
  const size = letters && typeof letters.size === "number" ? letters.size : 0;
  if (letters && typeof letters.clear === "function") letters.clear();
  return size;
}

function eliminatedLetters(letters) {
  if (!letters || typeof letters.forEach !== "function") return [];
  const out = [];
  letters.forEach((letter) => out.push(letter));
  return out.sort();
}

/* --------------------------------------------------------------- highlights */

const HIGHLIGHT_COLORS = [
  { id: "yellow", label: "Yellow", value: "#f6df6b" },
  { id: "green", label: "Green", value: "#8fe3a6" },
  { id: "blue", label: "Blue", value: "#9fd2ff" },
  { id: "pink", label: "Pink", value: "#f7b2cf" },
];

const HIGHLIGHT_STYLES = ["highlight", "underline"];

function normalizeHighlightColor(value) {
  const id = str(value).trim().toLowerCase();
  return HIGHLIGHT_COLORS.some((color) => color.id === id) ? id : "yellow";
}

function normalizeHighlightStyle(value) {
  const id = str(value).trim().toLowerCase();
  return HIGHLIGHT_STYLES.includes(id) ? id : "highlight";
}

function nextHighlightId(list) {
  let max = 0;
  for (const item of Array.isArray(list) ? list : []) {
    const n = Number(String(item && item.id ? item.id : "").replace(/^hl-/, ""));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `hl-${max + 1}`;
}

/** Adds a highlight, or updates the one already covering the same text. */
function addHighlight(list, entry) {
  if (!Array.isArray(list)) return null;
  const source = entry || {};
  const quote = str(source.quote).replace(/\s+/g, " ").trim();
  if (!quote) return null;
  const section = source.section === "stimulus" ? "stimulus" : "question";
  const existing = list.find((item) => item.quote === quote && item.section === section);
  if (existing) {
    if (source.color) existing.color = normalizeHighlightColor(source.color);
    if (source.style) existing.style = normalizeHighlightStyle(source.style);
    if (typeof source.note === "string") existing.note = source.note;
    return existing;
  }
  const highlight = {
    id: nextHighlightId(list),
    quote,
    color: normalizeHighlightColor(source.color),
    style: normalizeHighlightStyle(source.style),
    note: typeof source.note === "string" ? source.note : "",
    section,
  };
  list.push(highlight);
  return highlight;
}

function updateHighlight(list, id, patch) {
  const target = Array.isArray(list) ? list.find((item) => item.id === id) : null;
  if (!target) return false;
  const next = patch || {};
  if (typeof next.note === "string") target.note = next.note;
  if (next.color) target.color = normalizeHighlightColor(next.color);
  if (next.style) target.style = normalizeHighlightStyle(next.style);
  return true;
}

function removeHighlight(list, id) {
  if (!Array.isArray(list)) return 0;
  const at = list.findIndex((item) => item.id === id);
  if (at < 0) return 0;
  list.splice(at, 1);
  return 1;
}

function highlightsForSection(list, section) {
  const name = section === "stimulus" ? "stimulus" : "question";
  return (Array.isArray(list) ? list : []).filter((item) => item.section === name);
}

/**
 * Short probe strings for one stored quote. Selections can run across several
 * rendered text nodes, so a highlight falls back to the first few words that
 * do sit inside one node.
 */
function quoteProbes(quote) {
  const full = str(quote).replace(/\s+/g, " ").trim();
  if (!full) return [];
  const out = [full];
  if (full.length > 40) out.push(full.slice(0, 40).trim());
  if (full.length > 24) out.push(full.slice(0, 24).trim());
  return out.filter((text, index) => text.length >= 4 && out.indexOf(text) === index);
}

/**
 * Non-overlapping matches for a set of quotes in one text string. Longer
 * matches win when two quotes start at the same place.
 */
function findQuoteRanges(text, quotes) {
  const hay = str(text);
  if (!hay) return [];
  const found = [];
  for (const quote of Array.isArray(quotes) ? quotes : []) {
    const probes = quoteProbes(quote);
    for (const probe of probes) {
      let from = 0;
      let at = hay.indexOf(probe, from);
      if (at < 0) continue;
      while (at >= 0) {
        found.push({ quote, match: probe, index: at, length: probe.length });
        from = at + 1;
        at = hay.indexOf(probe, from);
      }
      break;
    }
  }
  found.sort((a, b) => a.index - b.index || b.length - a.length);
  const picked = [];
  let end = -1;
  for (const range of found) {
    if (range.index < end) continue;
    picked.push(range);
    end = range.index + range.length;
  }
  return picked;
}

/* ------------------------------------------------------------ question menu */

function navigatorRows(items) {
  return (Array.isArray(items) ? items : []).map((item, index) => {
    const number = Number(item && item.number) || index + 1;
    const answered = item && item.answered === true;
    const flagged = item && item.flagged === true;
    const current = item && item.current === true;
    const status = answered ? "answered" : current ? "current" : "skipped";
    return {
      path: str(item && item.path),
      number,
      answered,
      flagged,
      current,
      status,
      label: `Question ${number}`,
    };
  });
}

function navigatorSummary(items) {
  const list = Array.isArray(items) ? items : [];
  let answered = 0;
  let flagged = 0;
  let skipped = 0;
  for (const item of list) {
    if (item && item.answered === true) answered++;
    else if (!(item && item.current === true)) skipped++;
    if (item && item.flagged === true) flagged++;
  }
  return { total: list.length, answered, flagged, skipped };
}

/* ---------------------------------------------------------- reference sheet */

/*
 * The standard formulas listed on the SAT math reference sheet, grouped the
 * way students look them up. Written for this plugin from standard mathematics.
 */
const SAT_REFERENCE_SHEET = [
  {
    group: "Area and circumference",
    items: [
      { name: "Area of a circle", formula: "A = πr²" },
      { name: "Circumference of a circle", formula: "C = 2πr" },
      { name: "Area of a rectangle", formula: "A = ℓw" },
      { name: "Area of a triangle", formula: "A = ½bh" },
      { name: "Area of a trapezoid", formula: "A = ½(b₁ + b₂)h" },
      { name: "Arc length", formula: "s = (θ/360) · 2πr" },
      { name: "Area of a sector", formula: "A = (θ/360) · πr²" },
    ],
  },
  {
    group: "Volume",
    items: [
      { name: "Rectangular solid", formula: "V = ℓwh" },
      { name: "Cylinder", formula: "V = πr²h" },
      { name: "Sphere", formula: "V = (4/3)πr³" },
      { name: "Cone", formula: "V = (1/3)πr²h" },
      { name: "Pyramid", formula: "V = (1/3)Bh" },
    ],
  },
  {
    group: "Right triangles",
    items: [
      { name: "Pythagorean theorem", formula: "a² + b² = c²" },
      { name: "45°–45°–90° sides", formula: "x, x, x√2" },
      { name: "30°–60°–90° sides", formula: "x, x√3, 2x" },
    ],
  },
  {
    group: "Angles",
    items: [
      { name: "Angles in a triangle", formula: "180°" },
      { name: "Angles in a circle", formula: "360° = 2π radians" },
      { name: "Degrees to radians", formula: "radians = degrees · π/180" },
    ],
  },
  {
    group: "Quadratics",
    items: [
      { name: "Quadratic formula", formula: "x = (−b ± √(b² − 4ac)) / 2a" },
      { name: "Discriminant", formula: "b² − 4ac" },
      { name: "Vertex x-value", formula: "x = −b / 2a" },
    ],
  },
  {
    group: "Exponents and growth",
    items: [
      { name: "Product rule", formula: "xᵃ · xᵇ = xᵃ⁺ᵇ" },
      { name: "Power rule", formula: "(xᵃ)ᵇ = xᵃᵇ" },
      { name: "Exponential growth", formula: "y = a(1 + r)ᵗ" },
      { name: "Exponential decay", formula: "y = a(1 − r)ᵗ" },
    ],
  },
  {
    group: "Statistics",
    items: [
      { name: "Mean", formula: "sum of values ÷ number of values" },
      { name: "Probability", formula: "favorable outcomes ÷ total outcomes" },
      { name: "Rate", formula: "distance = rate · time" },
    ],
  },
];

/* --------------------------------------------------------------- directions */

const PRACTICE_TOOL_DIRECTIONS = [
  "Mark a question with the bookmark when you want to come back to it. The question menu lists every flagged and skipped question in this session.",
  "The option eliminator crosses out wrong choices. Click a crossed-out choice again to bring it back, and clear them all from the tool panel.",
  "Highlights & notes keeps the text you select, a colour and your note for this question. It is stored in this practice session only.",
  "The line reader shadows the passage except for the band under your pointer. The timer can be hidden, and it returns five minutes before a Quick Practice session ends.",
  "The calculator and reference sheet are local: no network request, no account and no College Board code.",
];

module.exports = {
  BLUEBOOK_TOOLS,
  TOOL_IDS,
  TOOL_SHORTCUTS,
  PRACTICE_TOOL_DIRECTIONS,
  HIGHLIGHT_COLORS,
  HIGHLIGHT_STYLES,
  SAT_REFERENCE_SHEET,
  TIMER_WARNING_SECONDS,
  ZOOM_LEVELS,
  ZOOM_MAX,
  ZOOM_MIN,
  addHighlight,
  clearEliminated,
  eliminatedLetters,
  findQuoteRanges,
  highlightsForSection,
  isEliminated,
  navigatorRows,
  navigatorSummary,
  nextHighlightId,
  normalizeHighlightColor,
  normalizeHighlightStyle,
  normalizeZoom,
  practiceToolShortcut,
  quoteProbes,
  removeHighlight,
  shouldWarnFive,
  timerVisible,
  toggleEliminated,
  updateHighlight,
  zoomIn,
  zoomLabel,
  zoomOut,
};
