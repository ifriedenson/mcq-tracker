"use strict";
/*
 * Passage retrieval for the study agent.
 *
 * The study agent used to send one matching line per note, so a long lecture
 * could only ever contribute one sentence to an answer. This module ranks
 * passages instead: a heading starts a passage, blank lines end one, and a
 * passage is capped in lines and characters. Ranking prefers term coverage over
 * raw repetition, then a phrase match, then a heading or path match.
 *
 * It is deliberately separate from `vault-search.js` (the `vault-search` block's
 * BM25 note index): the block ranks whole notes for reading, this ranks passages
 * with line numbers so an answer can cite `[[note#L12]]` and show the passage.
 * Pure: no Obsidian API, no network, no writes.
 */
const { str } = require("./util");

const MAX_TERMS = 8;
const MAX_PASSAGE_LINES = 6;
const MAX_PASSAGE_CHARS = 700;
const MAX_FILES = 400;
const MAX_FILE_CHARS = 200000;
const MAX_HITS_PER_FILE = 2;
const MAX_EXCERPT_CHARS = 5000;

const STOPWORDS = new Set(
  "the and for with that this from are was were have has had not but you your can will would should about into than then they them their there these those what when where which while who how why all any some our out over under also just like more most much very may might must its".split(
    " "
  )
);

/** Search words: lowercase, unique, more than two characters, no stopwords, at most eight. */
function terms(query) {
  return [...new Set(str(query).toLowerCase().split(/[^\p{L}\p{N}_-]+/u).filter((word) => word.length > 2 && !STOPWORDS.has(word)))].slice(
    0,
    MAX_TERMS
  );
}

function stripFrontmatter(text) {
  return str(text)
    .replace(/\r\n/g, "\n")
    .replace(/^---\n[\s\S]*?\n---\n?/, "");
}

/**
 * Split Markdown into passages. Each heading is its own passage (so a query can
 * match the heading) and also labels the lines that follow it until the next
 * heading. Frontmatter never becomes searchable text.
 */
function passages(text) {
  const lines = stripFrontmatter(text).split("\n");
  const out = [];
  let heading = "";
  let buffer = [];
  let start = 0;
  const flush = () => {
    if (!buffer.length) return;
    const body = buffer.map((line) => line.trim()).filter(Boolean);
    if (body.length) {
      let joined = body.join("\n");
      if (joined.length > MAX_PASSAGE_CHARS) joined = `${joined.slice(0, MAX_PASSAGE_CHARS).trimEnd()}…`;
      out.push({ lineNumber: start, endLine: start + buffer.length - 1, heading, text: joined });
    }
    buffer = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (/^#{1,6}\s+\S/.test(trimmed)) {
      flush();
      heading = trimmed.replace(/^#{1,6}\s+/, "").replace(/\s+#+\s*$/, "").trim();
      start = i + 1;
      buffer = [trimmed];
      continue;
    }
    if (!trimmed) {
      flush();
      start = i + 2;
      continue;
    }
    if (!buffer.length) start = i + 1;
    buffer.push(trimmed);
    if (buffer.length >= MAX_PASSAGE_LINES) {
      flush();
      start = i + 2;
    }
  }
  flush();
  return out;
}

/** How often a word appears, capped so one repeated word cannot dominate. */
function occurrences(text, word) {
  let count = 0;
  let from = 0;
  while (count < 4) {
    const at = text.indexOf(word, from);
    if (at < 0) break;
    count += 1;
    from = at + word.length;
  }
  return count;
}

function scorePassage(passage, words, path, phrase) {
  const text = passage.text.toLowerCase();
  const lowerPath = str(path).toLowerCase();
  const heading = str(passage.heading).toLowerCase();
  let coverage = 0;
  let hits = 0;
  for (const word of words) {
    if (text.includes(word)) coverage += 1;
    hits += occurrences(text, word);
  }
  if (!coverage) return 0;
  let score = coverage * 10 + Math.min(hits, 8);
  if (phrase && phrase.length > 3 && text.includes(phrase)) score += 8;
  for (const word of words) {
    if (lowerPath.includes(word)) score += 3;
    if (heading.includes(word)) score += 2;
  }
  return score;
}

/** Rank the passages of one note; at most `perFile` hits come back. */
function rankDocument(path, text, query, options) {
  const opts = options || {};
  const words = terms(query);
  if (!words.length) return [];
  const phrase = str(query).trim().toLowerCase().replace(/\s+/g, " ");
  const hits = [];
  for (const passage of passages(text)) {
    const score = scorePassage(passage, words, path, phrase);
    if (!score) continue;
    hits.push({
      path,
      lineNumber: passage.lineNumber,
      endLine: passage.endLine,
      line: passage.text.split("\n")[0].slice(0, 300),
      snippet: passage.text,
      heading: passage.heading,
      score,
    });
  }
  hits.sort((a, b) => b.score - a.score || a.lineNumber - b.lineNumber);
  return hits.slice(0, Math.max(1, Math.min(5, Number(opts.perFile) || MAX_HITS_PER_FILE)));
}

/** Rank passages across already-read documents. The caller does the reading. */
function searchText(documents, query, options) {
  const opts = options || {};
  const limit = Math.max(1, Math.min(20, Number(opts.limit) || 8));
  const all = [];
  for (const doc of Array.isArray(documents) ? documents : []) {
    if (!doc || !str(doc.path)) continue;
    const text = str(doc.text);
    if (!text || text.length > MAX_FILE_CHARS) continue;
    all.push(...rankDocument(doc.path, text, query, opts));
  }
  all.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path) || a.lineNumber - b.lineNumber);
  const seen = new Set();
  const out = [];
  for (const hit of all) {
    const key = `${hit.path}#${hit.lineNumber}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hit);
    if (out.length >= limit) break;
  }
  return out;
}

/** The system-prompt block: one citation and its passage per hit, within a budget. */
function excerptBlock(hits, budget) {
  const cap = Math.max(200, Number(budget) || MAX_EXCERPT_CHARS);
  const blocks = [];
  let used = 0;
  for (const hit of Array.isArray(hits) ? hits : []) {
    if (!hit || !str(hit.path)) continue;
    const range = Number(hit.endLine) > Number(hit.lineNumber) ? ` (lines ${hit.lineNumber}-${hit.endLine})` : "";
    const cite = `- [[${hit.path}#L${hit.lineNumber}|${hit.path}]]${range}`;
    const source = str(hit.snippet || hit.line).trim();
    if (!source) continue;
    const body = source
      .split("\n")
      .slice(0, MAX_PASSAGE_LINES)
      .map((line) => `  > ${line}`)
      .join("\n");
    const block = `${cite}\n${body}`;
    if (used + block.length > cap) break;
    blocks.push(block);
    used += block.length + 1;
  }
  return blocks.join("\n");
}

module.exports = {
  MAX_EXCERPT_CHARS,
  MAX_FILES,
  MAX_FILE_CHARS,
  MAX_HITS_PER_FILE,
  MAX_PASSAGE_CHARS,
  MAX_PASSAGE_LINES,
  MAX_TERMS,
  excerptBlock,
  passages,
  rankDocument,
  scorePassage,
  searchText,
  stripFrontmatter,
  terms,
};
