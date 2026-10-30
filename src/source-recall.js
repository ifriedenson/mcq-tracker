"use strict";
/*
 * Source-anchored recalls extend ordinary card notes. A recall stores the
 * selected source passage and a short surrounding context, so it can be
 * reviewed beside the place it came from and reopened with that passage
 * selected. This module holds only the text/heading helpers; scheduling,
 * attempts and review UI stay on the existing card paths.
 */
const { str } = require("./util");

const MAX_QUOTE_CHARS = 1200;
const MAX_CONTEXT_CHARS = 1800;
const CONTEXT_PAD = 220;

function normalizeNewlines(value) {
  return str(value).replace(/\r\n?/g, "\n");
}

function normalizeText(value) {
  return normalizeNewlines(value).trim();
}

function cleanHeading(value) {
  return str(value).replace(/^#+\s*/, "").replace(/\s+#+\s*$/, "").trim();
}

function escapeRegExp(value) {
  return str(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function positionAt(text, offset) {
  const before = text.slice(0, offset);
  const line = (before.match(/\n/g) || []).length;
  const last = before.lastIndexOf("\n");
  return { line, ch: offset - (last + 1) };
}

/**
 * Find a selected passage in source text. Exact matches win; when the source
 * wraps or re-indents the same words, a whitespace-flexible match is used.
 * Offsets stay relative to the original text so an editor can select them.
 */
function findQuoteRange(text, quote) {
  const source = normalizeNewlines(text);
  const needle = normalizeNewlines(quote).trim();
  if (!source || !needle) return null;
  let start = source.indexOf(needle);
  let end = start + needle.length;
  if (start < 0) {
    const words = needle.split(/\s+/).filter(Boolean).map(escapeRegExp);
    if (!words.length) return null;
    const match = new RegExp(words.join("\\s+")).exec(source);
    if (!match) return null;
    start = match.index;
    end = start + match[0].length;
  }
  return {
    start,
    end,
    from: positionAt(source, start),
    to: positionAt(source, end),
  };
}

/** The nearest preceding Markdown heading for a zero-based editor line. */
function headingAtLine(cache, line) {
  const target = Number(line);
  if (!Number.isFinite(target)) return "";
  let heading = "";
  for (const item of (cache && Array.isArray(cache.headings) ? cache.headings : [])) {
    const start = item && item.position && item.position.start;
    const at = start && Number(start.line);
    if (!Number.isFinite(at)) continue;
    if (at <= target) heading = cleanHeading(item.heading);
    else break;
  }
  return heading;
}

function cleanQuote(value) {
  const quote = normalizeText(value);
  if (quote.length <= MAX_QUOTE_CHARS) return quote;
  return `${quote.slice(0, MAX_QUOTE_CHARS).trimEnd()}…`;
}

function excerptAround(source, range) {
  let start = Math.max(0, range.start - CONTEXT_PAD);
  let end = Math.min(source.length, range.end + CONTEXT_PAD);
  while (start > 0 && !/\s/.test(source[start - 1])) start--;
  while (end < source.length && !/\s/.test(source[end])) end++;
  let text = source.slice(start, end).trim();
  if (start > 0) text = `…${text}`;
  if (end < source.length) text = `${text}…`;
  if (text.length <= MAX_CONTEXT_CHARS) return text;
  return `${text.slice(0, MAX_CONTEXT_CHARS).trimEnd()}…`;
}

/** The stored source fields for a selection, plus the range used for highlighting. */
function buildSourceRecall(input) {
  const data = input || {};
  const quote = cleanQuote(data.selection);
  const heading = headingAtLine(data.cache, data.line);
  if (!quote) return { quote: "", context: "", heading, range: null };
  const source = normalizeNewlines(data.text);
  const range = findQuoteRange(source, quote);
  const context = range ? excerptAround(source, range) : quote;
  return { quote, context, heading, range };
}

/** Split a stored context so the selected passage can be rendered as a mark. */
function splitSourceContext(context, quote) {
  const source = normalizeNewlines(context);
  const needle = normalizeNewlines(quote).trim();
  if (!source) return { before: "", match: "", after: "" };
  if (!needle) return { before: source, match: "", after: "" };
  const range = findQuoteRange(source, needle);
  if (!range) return { before: source, match: "", after: "" };
  return {
    before: source.slice(0, range.start),
    match: source.slice(range.start, range.end),
    after: source.slice(range.end),
  };
}

module.exports = {
  CONTEXT_PAD,
  MAX_CONTEXT_CHARS,
  MAX_QUOTE_CHARS,
  buildSourceRecall,
  cleanQuote,
  findQuoteRange,
  headingAtLine,
  splitSourceContext,
};
