"use strict";
/*
 * Query groups for JSON Canvas 1.0 boards.
 *
 * This is the sixth clean-room slice of the Overpowered Canvas idea (MIT,
 * github.com/kfirgumay2005-hash/Overpowered-Canvas). No source was copied and no
 * dependency was added: a query is a few string and token comparisons over the
 * model canvas-markdown.js validates.
 *
 * A group frame declares a query in its own label: the label starts with
 * `query:` (case-insensitive) and what follows is the query text. Any other
 * label is not a query and is left completely alone. The supported grammar is
 * deliberately small and is the subset a bare JSON Canvas file can express:
 *
 *   bare words   case-insensitive substring over the card's text, its name and
 *                its file path or address; every word has to match (AND)
 *   #tag         the card's text carries that whole tag, not a longer one
 *   type:text    keep only cards of that type (text, file, link or group)
 *
 * Anything else - `key:value`, `-word`, quotes, pipes, parentheses - makes the
 * whole query reported as unsupported rather than silently half-read. Query
 * text is capped, terms are capped, members are capped, and every drop is
 * counted.
 *
 * Applying writes one thing only: each query frame's x, y, width and height,
 * fitted with fixed padding around the bounding box of the cards its query
 * matches. Cards are never moved, edges are never touched, and a card that sits
 * inside the fitted frame without matching is reported as a stray, never
 * absorbed or removed.
 */
const canvasMarkdown = require("./canvas-markdown");
const canvasMap = require("./canvas-map");
const canvasAutoLink = require("./canvas-auto-link");

const PREFIX = /^query\s*:/i;
const TYPE_VALUES = ["text", "file", "link", "group"];
const MAX_QUERIES = 24;
const MAX_QUERY_TEXT = 200;
const MAX_TERMS = 12;
const MAX_MEMBERS = 120;
const MAX_STRAYS = 12;
const MAX_FRAME_SPAN = 20000;
const PAD = 16;
const MAX_LABEL = 80;
const FALLBACK_WIDTH = 280;
const FALLBACK_HEIGHT = 90;
const TAG = /#([\p{L}\p{N}/_-]+)/gu;

function text(value) {
  return typeof value === "string" ? value : "";
}

function squeeze(value) {
  return text(value).replace(/\s+/g, " ").trim();
}

function clip(value, limit) {
  const clean = squeeze(value);
  return clean.length > limit ? clean.slice(0, limit - 1) + "…" : clean;
}

function widthOf(node) {
  return Math.max(1, Math.round(Number(node && node.width) || FALLBACK_WIDTH));
}

function heightOf(node) {
  return Math.max(1, Math.round(Number(node && node.height) || FALLBACK_HEIGHT));
}

function centreOf(node) {
  return { x: Number(node.x) + widthOf(node) / 2, y: Number(node.y) + heightOf(node) / 2 };
}

function contains(frame, point) {
  return point.x >= Number(frame.x) && point.x <= Number(frame.x) + widthOf(frame)
    && point.y >= Number(frame.y) && point.y <= Number(frame.y) + heightOf(frame);
}

/** The name a card is known by, using the same rule the auto-link slice documents. */
function nameOf(node) {
  return squeeze(canvasAutoLink.titleOf(node) || text(node && node.file) || text(node && node.url) || (node && node.id));
}

function labelOf(node) {
  return clip(nameOf(node), MAX_LABEL) || "card";
}

function tagsOf(node) {
  const found = [];
  for (const match of text(node && node.text).matchAll(TAG)) found.push(match[1].toLowerCase());
  return found;
}

/**
 * Read a frame label as a query. A label that does not start with `query:` is
 * not a query at all; a `query:` label with unusable terms is a query that is
 * reported instead of resolved.
 */
function parseQuery(label) {
  const raw = text(label).trim();
  if (!PREFIX.test(raw)) return { isQuery: false, text: "", terms: [], unsupported: [], dropped: 0, truncated: false };
  const body = raw.replace(PREFIX, "").trim();
  const truncated = body.length > MAX_QUERY_TEXT;
  const tokens = body.slice(0, MAX_QUERY_TEXT).split(/\s+/).filter(Boolean);
  const terms = [];
  const unsupported = [];
  let dropped = 0;
  for (const token of tokens) {
    if (terms.length >= MAX_TERMS) {
      dropped += 1;
      continue;
    }
    if (token.length > 1 && token.startsWith("#")) {
      terms.push({ kind: "tag", value: token.slice(1).toLowerCase() });
      continue;
    }
    if (/^type:/i.test(token)) {
      const value = token.slice(token.indexOf(":") + 1).toLowerCase();
      if (TYPE_VALUES.includes(value)) terms.push({ kind: "type", value });
      else unsupported.push(token);
      continue;
    }
    if (/^[-+"]/.test(token) || token.includes(":") || /["'|()]/.test(token)) {
      unsupported.push(token);
      continue;
    }
    terms.push({ kind: "text", value: token.toLowerCase() });
  }
  return { isQuery: true, text: body.slice(0, MAX_QUERY_TEXT), terms, unsupported, dropped, truncated };
}

/** One card against one parsed query: every term has to hold. */
function matchesQuery(node, parsed) {
  if (!node || !parsed || !parsed.terms || !parsed.terms.length) return false;
  const haystack = [text(node.text), nameOf(node), text(node.file), text(node.url)].join(" ").toLowerCase();
  const tags = tagsOf(node);
  for (const term of parsed.terms) {
    if (term.kind === "type") {
      if (node.type !== term.value) return false;
      continue;
    }
    if (term.kind === "tag") {
      if (!tags.includes(term.value)) return false;
      continue;
    }
    if (!haystack.includes(term.value)) return false;
  }
  return true;
}

function summarise(resolved) {
  const stats = resolved.stats;
  const bits = [stats.queries + (stats.queries === 1 ? " query group" : " query groups")];
  if (stats.matched) bits.push(stats.matched + (stats.matched === 1 ? " card matched" : " cards matched"));
  else bits.push("no card matched");
  if (stats.strays) bits.push(stats.strays + (stats.strays === 1 ? " card sits inside a group" : " cards sit inside a group") + " without matching and stays put");
  if (stats.unsupported) bits.push(stats.unsupported + " with unsupported syntax");
  if (stats.unfitted) bits.push(stats.unfitted + " not fitted");
  if (stats.groupsSkipped) bits.push(stats.groupsSkipped + " beyond the " + MAX_QUERIES + "-query limit");
  if (stats.membersDropped) bits.push(stats.membersDropped + " beyond the " + MAX_MEMBERS + "-member limit");
  if (stats.termsDropped) bits.push(stats.termsDropped + " term" + (stats.termsDropped === 1 ? "" : "s") + " beyond the " + MAX_TERMS + "-term limit");
  if (stats.textTruncated) bits.push(stats.textTruncated + " query text cut at " + MAX_QUERY_TEXT + " characters");
  return bits.join("; ") + ".";
}

/** Resolve every query group on one validated board. Nothing is written here. */
function resolveQueries(canvas) {
  if (!canvas || !Array.isArray(canvas.nodes) || !canvas.nodes.length) {
    return { ok: false, reason: "empty", message: "That canvas has no cards." };
  }
  const nodes = canvas.nodes.slice();
  const frames = nodes.filter((node) => node.type === "group").sort(canvasMap.boardOrder);
  const queryFrames = frames.filter((frame) => parseQuery(frame.label).isQuery);
  if (!queryFrames.length) {
    return { ok: false, reason: "queries", message: 'That board has no query group. Label a frame "query: …" first.' };
  }
  const queryIds = new Set(queryFrames.map((frame) => frame.id));
  const stats = {
    queries: 0, matched: 0, fitted: 0, unfitted: 0, unsupported: 0, strays: 0,
    membersDropped: 0, groupsSkipped: 0, termsDropped: 0, textTruncated: 0, limits: false,
  };
  const groups = [];
  for (const frame of queryFrames) {
    stats.queries += 1;
    if (groups.length >= MAX_QUERIES) {
      stats.groupsSkipped += 1;
      continue;
    }
    const parsed = parseQuery(frame.label);
    if (parsed.truncated) stats.textTruncated += 1;
    stats.termsDropped += parsed.dropped || 0;
    const group = {
      id: frame.id,
      label: clip(squeeze(frame.label), MAX_LABEL),
      query: parsed.text,
      terms: parsed.terms.map((term) => term.kind + ":" + term.value),
      members: [],
      memberIds: [],
      dropped: 0,
      strays: [],
      strayCount: 0,
      fit: null,
      reason: "",
      message: "",
    };
    if (parsed.unsupported.length) {
      group.reason = "syntax";
      group.message = "Unsupported query term: " + parsed.unsupported.join(", ") + ".";
      stats.unsupported += 1;
      groups.push(group);
      continue;
    }
    if (!parsed.terms.length) {
      group.reason = "terms";
      group.message = "That query names nothing to look for.";
      stats.unsupported += 1;
      groups.push(group);
      continue;
    }
    const wantsGroups = parsed.terms.some((term) => term.kind === "type" && term.value === "group");
    const candidates = nodes.filter((node) => node.id !== frame.id
      && !(node.type === "group" && queryIds.has(node.id))
      && (wantsGroups ? true : node.type !== "group"));
    const matched = candidates.filter((node) => matchesQuery(node, parsed)).sort(canvasMap.boardOrder);
    const members = matched.slice(0, MAX_MEMBERS);
    group.members = members.map((node) => ({ id: node.id, label: labelOf(node), type: node.type }));
    group.memberIds = members.map((node) => node.id);
    group.dropped = matched.length - members.length;
    stats.membersDropped += group.dropped;
    stats.matched += members.length;
    const memberIds = new Set(group.memberIds);
    const inside = nodes.filter((node) => node.id !== frame.id
      && !queryIds.has(node.id)
      && !memberIds.has(node.id)
      && contains(frame, centreOf(node)));
    group.strays = inside.slice(0, MAX_STRAYS).map((node) => ({ id: node.id, label: labelOf(node) }));
    group.strayCount = inside.length;
    stats.strays += inside.length;
    if (!members.length) {
      group.reason = "empty";
      group.message = "No card on this board matches that query.";
      stats.unfitted += 1;
      groups.push(group);
      continue;
    }
    const left = Math.min(...members.map((node) => Number(node.x)));
    const top = Math.min(...members.map((node) => Number(node.y)));
    const right = Math.max(...members.map((node) => Number(node.x) + widthOf(node)));
    const bottom = Math.max(...members.map((node) => Number(node.y) + heightOf(node)));
    if (right - left > MAX_FRAME_SPAN || bottom - top > MAX_FRAME_SPAN) {
      group.reason = "span";
      group.message = "Those matches are more than " + MAX_FRAME_SPAN + " px apart, so the frame was not fitted.";
      stats.unfitted += 1;
      groups.push(group);
      continue;
    }
    group.fit = {
      x: Math.round(left - PAD),
      y: Math.round(top - PAD),
      width: Math.round(right - left + PAD * 2),
      height: Math.round(bottom - top + PAD * 2),
    };
    stats.fitted += 1;
    groups.push(group);
  }
  stats.limits = stats.groupsSkipped > 0 || stats.membersDropped > 0 || stats.termsDropped > 0 || stats.textTruncated > 0;
  const resolved = { groups, stats };
  resolved.summary = summarise(resolved);
  return Object.assign({ ok: true }, resolved);
}

/** Readable rows for the report window: each query, its matches and its refusals. */
function queryReport(raw) {
  const parsed = canvasMarkdown.parseCanvas(raw);
  if (!parsed.ok) return parsed;
  const resolved = resolveQueries(parsed.canvas);
  if (!resolved.ok) return resolved;
  return {
    ok: true,
    groups: resolved.groups.map((group) => ({
      id: group.id,
      label: group.label,
      query: group.query,
      terms: group.terms,
      members: group.members.map((member) => member.label),
      dropped: group.dropped,
      strays: group.strays.map((stray) => stray.label),
      strayCount: group.strayCount,
      fit: group.fit,
      reason: group.reason,
      message: group.message,
    })),
    stats: resolved.stats,
    summary: resolved.summary,
  };
}

/**
 * Fit every query frame around its matches. Only a group's geometry changes:
 * every card keeps its position, size, text and unknown fields, no edge is
 * touched and no card is added or removed. A board already fitted comes back
 * with `changed: false` and its original text.
 */
function applyQueries(raw) {
  const parsed = canvasMarkdown.parseCanvas(raw);
  if (!parsed.ok) return parsed;
  const resolved = resolveQueries(parsed.canvas);
  if (!resolved.ok) return resolved;
  let data;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    return { ok: false, reason: "json", message: "That file is not JSON Canvas." };
  }
  const fits = new Map();
  for (const group of resolved.groups) if (group.fit) fits.set(group.id, group.fit);
  if (!fits.size) {
    return {
      ok: false,
      reason: "fit",
      message: "No query group on that board could be fitted.",
      groups: resolved.groups,
      stats: resolved.stats,
      summary: resolved.summary,
    };
  }
  let changed = false;
  const applied = [];
  const nodes = (Array.isArray(data.nodes) ? data.nodes : []).map((node) => {
    const fit = node && fits.get(node.id);
    if (!fit) return node;
    const next = Object.assign({}, node);
    if (Math.round(Number(node.x) || 0) !== fit.x
      || Math.round(Number(node.y) || 0) !== fit.y
      || Math.round(Number(node.width) || 0) !== fit.width
      || Math.round(Number(node.height) || 0) !== fit.height) {
      changed = true;
      applied.push({ id: node.id, x: fit.x, y: fit.y, width: fit.width, height: fit.height });
    }
    next.x = fit.x;
    next.y = fit.y;
    next.width = fit.width;
    next.height = fit.height;
    return next;
  });
  if (!changed) {
    return { ok: true, changed: false, text: raw, applied: [], groups: resolved.groups, stats: resolved.stats, summary: resolved.summary };
  }
  const text = JSON.stringify(Object.assign({}, data, { nodes }), null, "\t") + "\n";
  return { ok: true, changed: true, text, applied, groups: resolved.groups, stats: resolved.stats, summary: resolved.summary };
}

module.exports = {
  parseQuery,
  matchesQuery,
  resolveQueries,
  queryReport,
  applyQueries,
  MAX_QUERIES,
  MAX_QUERY_TEXT,
  MAX_TERMS,
  MAX_MEMBERS,
  MAX_STRAYS,
  MAX_FRAME_SPAN,
  PAD,
};
