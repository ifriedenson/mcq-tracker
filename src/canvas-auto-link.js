"use strict";
/*
 * Automatic links between JSON Canvas 1.0 nodes.
 *
 * This is the fourth clean-room slice of the Overpowered Canvas idea (MIT,
 * github.com/kfirgumay2005-hash/Overpowered-Canvas). No source was copied and no
 * dependency was added: matching is plain string and token comparison over the
 * model canvas-markdown.js validates.
 *
 * Two documented ways match:
 *   1. A wikilink in a node's text - `[[Target]]`, `[[Target|alias]]`,
 *      `[[folder/Target#heading]]` or the embed form `![[Target]]` - matches the
 *      node whose title, basename-with-extension, path, path-without-extension or
 *      URL equals that target, case- and whitespace-insensitively.
 *   2. A title mention: another node's title of at least three characters that
 *      contains a letter appears in the source text as a whole phrase, compared
 *      token by token so "ATP" never matches inside "ATPase".
 *
 * A title shared by two or more nodes is ambiguous and never guessed at. A link
 * to itself, an edge that already exists, a wikilink to nothing on the board and
 * anything beyond the named work limits are reported, not written.
 */
const canvasMarkdown = require("./canvas-markdown");

const MIN_TITLE = 3;
const MAX_LABEL = 60;
const MAX_TITLE_CANDIDATES = 300;
const MAX_SOURCE_TEXT = 4000;
const MAX_MENTION_SCAN = 120000;
const MAX_PROPOSALS = 400;
const LETTER = /[\p{L}]/u;
const TOKEN_SPLIT = /[^\p{L}\p{N}]+/u;

function text(value) {
  return typeof value === "string" ? value : "";
}

function normalize(value) {
  return text(value).replace(/\s+/g, " ").trim().toLowerCase();
}

function firstLine(value) {
  const line = text(value).split(/\r?\n/).map((part) => part.trim()).find(Boolean);
  return line || "";
}

function baseName(path) {
  const clean = text(path).split("#")[0].split("|")[0].trim();
  const last = clean.split("/").pop() || "";
  return last.replace(/\.[A-Za-z0-9]{1,8}$/, "");
}

function shortLabel(value) {
  const clean = text(value).replace(/\s+/g, " ").trim();
  if (!clean) return "card";
  return clean.length > MAX_LABEL ? clean.slice(0, MAX_LABEL - 1) + "…" : clean;
}

/**
 * The name a node is known by. A text card is its first non-empty line, a file
 * card is its basename without the extension, a link card is its label or else
 * the first line of its text or else its address, and a group frame has none.
 */
function titleOf(node) {
  if (!node) return "";
  if (node.type === "group") return "";
  if (node.type === "file") return baseName(node.file).trim();
  if (node.type === "link") return (text(node.label).trim() || firstLine(node.text) || text(node.url)).trim();
  return firstLine(node.text);
}

/** Every name a node answers to, so a wikilink can reach it by path or by title. */
function keysOf(node) {
  const keys = [];
  const title = normalize(titleOf(node));
  if (title) keys.push(title);
  if (node && node.type === "file") {
    const path = text(node.file).split("#")[0].split("|")[0].trim();
    if (path) {
      keys.push(normalize(path));
      const bare = path.replace(/\.[A-Za-z0-9]{1,8}$/, "");
      if (bare && bare !== path) keys.push(normalize(bare));
      const base = baseName(path);
      if (base) keys.push(normalize(base));
    }
  }
  if (node && node.type === "link") {
    const url = normalize(node.url);
    if (url) keys.push(url);
  }
  return [...new Set(keys.filter(Boolean))];
}

function tokensOf(value) {
  return normalize(value).split(TOKEN_SPLIT).filter(Boolean);
}

function containsSequence(tokens, wanted) {
  if (!wanted.length || wanted.length > tokens.length) return false;
  for (let start = 0; start <= tokens.length - wanted.length; start += 1) {
    let hit = true;
    for (let offset = 0; offset < wanted.length; offset += 1) {
      if (tokens[start + offset] !== wanted[offset]) {
        hit = false;
        break;
      }
    }
    if (hit) return true;
  }
  return false;
}

function uniqueBy(list, keyOf) {
  const seen = new Set();
  const out = [];
  for (const entry of list) {
    const key = keyOf(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  return out;
}

function summarize(result) {
  const total = result.proposals.length;
  const wikilinks = result.proposals.filter((proposal) => proposal.via === "wikilink").length;
  const mentions = total - wikilinks;
  const bits = [];
  bits.push(total
    ? total + (total === 1 ? " link" : " links") + " proposed (" + wikilinks + " wikilink" + (wikilinks === 1 ? "" : "s") + ", " + mentions + " mention" + (mentions === 1 ? "" : "s") + ")"
    : "No new links");
  if (result.skipped.existing.length) bits.push(result.skipped.existing.length + " already linked");
  if (result.skipped.ambiguous.length) bits.push(result.skipped.ambiguous.length + " ambiguous");
  if (result.skipped.self.length) bits.push(result.skipped.self.length + " self");
  if (result.skipped.unresolved.length) bits.push(result.skipped.unresolved.length + " unresolved");
  if (result.stats.limits) bits.push("work limits reached");
  return bits.join("; ") + ".";
}

/** Propose the missing edges for one validated board. Nothing is written here. */
function proposeLinks(canvas) {
  if (!canvas || !Array.isArray(canvas.nodes) || !canvas.nodes.length) {
    return { ok: false, reason: "empty", message: "That canvas has no cards." };
  }
  const nodes = canvas.nodes.slice().sort((a, b) => a.id.localeCompare(b.id));
  const byKey = new Map();
  const byTitle = new Map();
  const add = (map, key, node) => {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(node);
  };
  for (const node of nodes) {
    if (node.type === "group") continue;
    for (const key of keysOf(node)) add(byKey, key, node);
    const title = normalize(titleOf(node));
    if (title.length >= MIN_TITLE && LETTER.test(title)) add(byTitle, title, node);
  }
  const titleKeys = [...byTitle.keys()].sort().slice(0, MAX_TITLE_CANDIDATES);
  const titleTokens = new Map(titleKeys.map((key) => [key, tokensOf(key)]));
  const limits = { titles: [...byTitle.keys()].length > titleKeys.length, scan: false, proposals: false };

  const existing = new Set();
  for (const edge of canvas.edges || []) if (edge) existing.add(edge.fromNode + "\u0000" + edge.toNode);

  const proposals = [];
  const claimed = new Set();
  const skipped = { existing: [], self: [], ambiguous: [], unresolved: [] };

  const claim = (source, candidates, via, title) => {
    if (!candidates || !candidates.length) {
      if (via === "wikilink") skipped.unresolved.push({ from: source.id, title, via });
      return;
    }
    // A mention of the card's own title is not a link to write or to report;
    // only a wikilink can point at the card that carries it.
    const pool = via === "mention" ? candidates.filter((node) => node.id !== source.id) : candidates;
    if (!pool.length) return;
    if (pool.length > 1) {
      skipped.ambiguous.push({ from: source.id, title, via, candidates: pool.map((node) => node.id).sort() });
      return;
    }
    const target = pool[0];
    if (target.id === source.id) {
      skipped.self.push({ from: source.id, title, via });
      return;
    }
    if (existing.has(source.id + "\u0000" + target.id)) {
      skipped.existing.push({ from: source.id, to: target.id });
      return;
    }
    const key = source.id + "\u0000" + target.id;
    if (claimed.has(key)) return;
    claimed.add(key);
    proposals.push({
      from: source.id,
      to: target.id,
      via,
      title,
      reason: via === "wikilink" ? "the text links [[" + title + "]]" : 'the text names "' + title + '"',
    });
  };

  let scanned = 0;
  for (const source of nodes) {
    if (source.type === "group") continue;
    const body = text(source.text) || text(source.label);
    const linkPattern = /!?\[\[([^\]\n]{1,300})\]\]/g;
    let match;
    while ((match = linkPattern.exec(body))) {
      const raw = match[1].trim();
      const target = raw.split("|")[0].split("#")[0].trim();
      if (!target) continue;
      let key = normalize(target);
      let candidates = byKey.get(key);
      if (!candidates) {
        const bare = normalize(target.replace(/\.[A-Za-z0-9]{1,8}$/, ""));
        if (bare && bare !== key) {
          key = bare;
          candidates = byKey.get(bare);
        }
      }
      claim(source, candidates, "wikilink", key);
    }
    if (!body.trim()) continue;
    if (scanned >= MAX_MENTION_SCAN) {
      limits.scan = true;
      continue;
    }
    const slice = body.slice(0, MAX_SOURCE_TEXT);
    scanned += slice.length;
    const tokens = tokensOf(slice);
    if (!tokens.length) continue;
    const tokenSet = new Set(tokens);
    for (const key of titleKeys) {
      const wanted = titleTokens.get(key);
      if (!wanted.length || !tokenSet.has(wanted[0])) continue;
      if (!containsSequence(tokens, wanted)) continue;
      claim(source, byTitle.get(key), "mention", key);
    }
  }

  proposals.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
  if (proposals.length > MAX_PROPOSALS) {
    limits.proposals = true;
    proposals.length = MAX_PROPOSALS;
  }
  const clean = {
    proposals,
    skipped: {
      existing: uniqueBy(skipped.existing, (entry) => entry.from + "\u0000" + entry.to),
      // One row per refused name per card: a wikilink and a mention of the same
      // ambiguous or self-referring name are the same refusal, reported once.
      self: uniqueBy(skipped.self, (entry) => entry.from + "\u0000" + entry.title),
      ambiguous: uniqueBy(skipped.ambiguous, (entry) => entry.from + "\u0000" + entry.title),
      unresolved: uniqueBy(skipped.unresolved, (entry) => entry.from + "\u0000" + entry.title),
    },
    stats: {
      nodes: nodes.length,
      wikilinks: proposals.filter((proposal) => proposal.via === "wikilink").length,
      mentions: proposals.filter((proposal) => proposal.via === "mention").length,
      ambiguous: 0,
      self: 0,
      existing: 0,
      unresolved: 0,
      limits: limits.titles || limits.scan || limits.proposals,
    },
  };
  clean.stats.ambiguous = clean.skipped.ambiguous.length;
  clean.stats.self = clean.skipped.self.length;
  clean.stats.existing = clean.skipped.existing.length;
  clean.stats.unresolved = clean.skipped.unresolved.length;
  clean.summary = summarize(clean);
  return { ok: true, ...clean };
}

/** Readable rows for the report window, with names instead of ids. */
function linkReport(raw) {
  const parsed = canvasMarkdown.parseCanvas(raw);
  if (!parsed.ok) return parsed;
  const result = proposeLinks(parsed.canvas);
  if (!result.ok) return result;
  const byId = new Map(parsed.canvas.nodes.map((node) => [node.id, node]));
  const labelOf = (id) => {
    const node = byId.get(id);
    return shortLabel(titleOf(node) || (node && (node.file || node.url)) || id);
  };
  return {
    ok: true,
    proposals: result.proposals.map((proposal) => ({
      from: proposal.from,
      fromLabel: labelOf(proposal.from),
      to: proposal.to,
      toLabel: labelOf(proposal.to),
      via: proposal.via,
      reason: proposal.reason,
    })),
    skipped: {
      existing: result.skipped.existing.map((entry) => ({ fromLabel: labelOf(entry.from), toLabel: labelOf(entry.to) })),
      self: result.skipped.self.map((entry) => ({ fromLabel: labelOf(entry.from), title: entry.title, via: entry.via })),
      ambiguous: result.skipped.ambiguous.map((entry) => ({
        fromLabel: labelOf(entry.from),
        title: entry.title,
        via: entry.via,
        candidates: entry.candidates.map((id) => labelOf(id)),
      })),
      unresolved: result.skipped.unresolved.map((entry) => ({ fromLabel: labelOf(entry.from), title: entry.title, via: entry.via })),
    },
    stats: result.stats,
    summary: result.summary,
  };
}

/**
 * Add every proposed edge to the board. Only `edges` grows: node positions,
 * sizes, text, colours and unknown fields are copied through untouched, and an
 * already complete board comes back with `changed: false`.
 */
function applyLinks(raw) {
  const parsed = canvasMarkdown.parseCanvas(raw);
  if (!parsed.ok) return parsed;
  const result = proposeLinks(parsed.canvas);
  if (!result.ok) return result;
  if (!result.proposals.length) {
    return { ok: true, text: raw, changed: false, applied: [], stats: result.stats, summary: result.summary };
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    return { ok: false, reason: "json", message: "That file is not JSON Canvas." };
  }
  const edges = Array.isArray(data.edges) ? data.edges.slice() : [];
  const used = new Set(edges.map((edge) => edge && edge.id));
  const applied = [];
  let index = 0;
  for (const proposal of result.proposals) {
    index += 1;
    let id = "auto-link-" + index;
    while (used.has(id)) {
      index += 1;
      id = "auto-link-" + index;
    }
    used.add(id);
    edges.push({ id, fromNode: proposal.from, toNode: proposal.to });
    applied.push(Object.assign({ id }, proposal));
  }
  const text = JSON.stringify(Object.assign({}, data, { edges }), null, "\t") + "\n";
  return { ok: true, text, changed: true, applied, stats: result.stats, summary: result.summary };
}

module.exports = {
  titleOf,
  keysOf,
  normalize,
  tokensOf,
  proposeLinks,
  linkReport,
  applyLinks,
  MIN_TITLE,
  MAX_TITLE_CANDIDATES,
  MAX_SOURCE_TEXT,
  MAX_MENTION_SCAN,
  MAX_PROPOSALS,
};
