"use strict";
/*
 * Inline task chips for Markdown task lines: in reading view a trailing
 * `📅 2026-11-01`, `⏰ 15:00`, `⏫` or `🔁 every week` reads as a small chip
 * instead of raw emoji syntax. Clicking the date chip opens a date picker and
 * clicking priority steps it; the edit rewrites only that token in the source
 * line. Nothing here touches the vault; the plugin supplies the line edits.
 */
const { str } = require("./util");

const TOKEN_PATTERNS = [
  { field: "due", re: /📅\s*(\d{4}-\d{2}-\d{2})/u },
  { field: "time", re: /⏰\s*([01]?\d:[0-5]\d)/u },
  { field: "start", re: /⏳\s*(\d{4}-\d{2}-\d{2})/u },
  { field: "scheduled", re: /🛫\s*(\d{4}-\d{2}-\d{2})/u },
  { field: "repeat", re: /🔁\s*every\s+(day|weekday|week)/u },
  { field: "priority", re: /⏫/u },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Every schedule token in line order, with its exact text and offset. */
function findTokens(text) {
  const source = str(text);
  const out = [];
  for (const pattern of TOKEN_PATTERNS) {
    const re = new RegExp(pattern.re.source, pattern.re.flags.includes("g") ? pattern.re.flags : `${pattern.re.flags}g`);
    let hit = null;
    while ((hit = re.exec(source)) !== null) {
      out.push({ field: pattern.field, token: hit[0], value: hit[1] === undefined ? "" : hit[1], index: hit.index });
      if (hit[0] === "") break;
    }
  }
  out.sort((a, b) => a.index - b.index);
  return out;
}

function validDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str(value))) return "";
  const [year, month, day] = str(value).split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  if (Number.isNaN(date.getTime()) || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return "";
  return str(value);
}

/** "2026-11-19" -> "Nov 19"; anything else is shown as-is. */
function formatChipDate(value) {
  const key = validDay(value);
  if (!key) return str(value);
  const [year, month, day] = key.split("-").map(Number);
  const now = new Date();
  const sameYear = year === now.getFullYear();
  return `${MONTHS[month - 1]} ${day}${sameYear ? "" : `, ${year}`}`;
}

function repeatLabel(value) {
  if (value === "day") return "daily";
  if (value === "weekday") return "weekdays";
  if (value === "week") return "weekly";
  return str(value);
}

/** A task line split into display title and chip tokens. */
function parseTaskLine(text) {
  const source = str(text);
  const tokens = findTokens(source);
  let title = source;
  for (const token of tokens) title = title.replace(token.token, " ");
  title = title.replace(/\s{2,}/g, " ").trim();
  const first = (field) => tokens.find((token) => token.field === field) || null;
  return {
    title,
    tokens,
    due: first("due") ? first("due").value : "",
    time: first("time") ? first("time").value : "",
    start: first("start") ? first("start").value : "",
    scheduled: first("scheduled") ? first("scheduled").value : "",
    repeat: first("repeat") ? first("repeat").value : "",
    priority: tokens.some((token) => token.field === "priority") ? "high" : "",
  };
}

function chipLabel(field, value) {
  if (field === "due") return `Due ${formatChipDate(value)}`;
  if (field === "time") return str(value);
  if (field === "start") return `Starts ${formatChipDate(value)}`;
  if (field === "scheduled") return `Scheduled ${formatChipDate(value)}`;
  if (field === "repeat") return `Repeats ${repeatLabel(value)}`;
  if (field === "priority") return "High priority";
  return str(value);
}

/**
 * Rewrite one chip token in the source line and leave everything else alone.
 * Unknown fields and unusable values return the line unchanged.
 */
function applyChipEdit(text, edit) {
  const source = str(text);
  const change = edit && typeof edit === "object" ? edit : {};
  if (change.field === "due") {
    const day = validDay(change.value);
    if (!day) return source;
    if (/📅\s*\d{4}-\d{2}-\d{2}/u.test(source)) return source.replace(/📅\s*\d{4}-\d{2}-\d{2}/u, `📅 ${day}`);
    return `${source.trimEnd()} 📅 ${day}`;
  }
  if (change.field === "priority") {
    if (change.value === "high") {
      if (/⏫/u.test(source)) return source;
      return `${source.trimEnd()} ⏫`;
    }
    if (change.value === "") return source.replace(/\s*⏫/u, "").replace(/\s{2,}/g, " ").trimEnd();
    return source;
  }
  return source;
}

function isElement(node) {
  return !!node && node.nodeType === 1;
}

function tagOf(node) {
  return isElement(node) ? String(node.tagName || "").toUpperCase() : "";
}

function textNodesUnder(root) {
  const out = [];
  const walk = (node) => {
    if (!node) return;
    if (node.nodeType === 3) {
      out.push(node);
      return;
    }
    if (isElement(node) && /^(UL|OL)$/i.test(tagOf(node))) return;
    const children = node.childNodes || [];
    for (const child of children) walk(child);
  };
  walk(root);
  return out;
}

/**
 * Replace a trailing token run inside one task line with chip buttons.
 * Operates on standard DOM only (real reading view or a test double); returns
 * true when the line gained chips. Clicks call back with the chip's field.
 */
function decorateTaskLine(li, actions) {
  if (!li || !actions) return false;
  const nodes = textNodesUnder(li);
  if (!nodes.length) return false;
  const joined = nodes.map((node) => str(node.textContent)).join("");
  const tokens = findTokens(joined);
  if (!tokens.length) return false;
  // Chips only when the token run reaches the end of the line's text.
  const first = tokens[0];
  const tail = joined.slice(first.index);
  const covered = tail.replace(/\s+/g, " ").trim();
  const tokenText = tokens.map((token) => token.token).join(" ").replace(/\s+/g, " ").trim();
  if (covered !== tokenText) return false;
  const headText = joined.slice(0, first.index);
  const last = nodes[nodes.length - 1];
  const doc = (li.ownerDocument || (typeof document !== "undefined" ? document : null));
  if (!doc || typeof doc.createElement !== "function") return false;
  // Trim the trailing run off the last text node; earlier text stays.
  let kept = headText.length;
  for (const node of nodes) {
    const text = str(node.textContent);
    if (kept <= 0) {
      node.textContent = "";
    } else if (text.length <= kept) {
      kept -= text.length;
    } else {
      node.textContent = text.slice(0, kept);
      kept = 0;
    }
  }
  const parent = last.parentNode;
  if (!parent || typeof parent.insertBefore !== "function") return false;
  const next = last.nextSibling || null;
  for (const token of tokens) {
    const chip = doc.createElement("button");
    chip.setAttribute("type", "button");
    chip.setAttribute("class", `qt-task-chip is-${token.field}`);
    chip.setAttribute("title", token.field === "due" ? "Pick a date" : token.field === "priority" ? "Step priority" : chipLabel(token.field, token.value));
    chip.setAttribute("aria-label", token.field === "due" ? `Change due date, currently ${token.value}` : token.field === "priority" ? "Step priority" : chipLabel(token.field, token.value));
    chip.textContent = chipLabel(token.field, token.value);
    if (token.field === "due" && typeof actions.onDate === "function") {
      chip.addEventListener("click", () => actions.onDate());
    } else if (token.field === "priority" && typeof actions.onPriority === "function") {
      chip.addEventListener("click", () => actions.onPriority());
    } else {
      chip.setAttribute("aria-disabled", "true");
    }
    parent.insertBefore(chip, next);
  }
  return true;
}

/**
 * Decorate every task line under a rendered list. `listEl` holds the `<li>`
 * rows; `startLine` is the 0-based source line of the first row so clicks map
 * back to the note. Returns the row count visited, so callers stride across
 * several lists without drifting.
 */
function decorateTaskList(listEl, actions) {
  if (!listEl || !actions) return 0;
  const host = /^(UL|OL)$/i.test(tagOf(listEl)) ? listEl : null;
  const rows = host ? Array.from(host.children || []).filter((node) => tagOf(node) === "LI") : [];
  rows.forEach((li, index) => {
    const line = Number(actions.startLine) + index + 1;
    decorateTaskLine(li, {
      onDate: () => actions.onDate && actions.onDate(line),
      onPriority: () => actions.onPriority && actions.onPriority(line),
    });
  });
  return rows.length;
}

module.exports = {
  applyChipEdit,
  chipLabel,
  decorateTaskLine,
  decorateTaskList,
  findTokens,
  formatChipDate,
  parseTaskLine,
  repeatLabel,
};
