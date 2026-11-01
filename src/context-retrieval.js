"use strict";
/*
 * Local passage retrieval for AI prompting. The review's Capability 4 finding
 * says the quiz generator prompt-stuffs note text and has "no retrieval".
 * This module keeps the same local-only privacy model, but ranks passages from
 * the notes the learner already selected and sends the best bounded set.
 */
const { str } = require("./util");

const DEFAULT_PASSAGE_CHARS = 1200;
const DEFAULT_CONTEXT_CHARS = 18000;
const DEFAULT_MAX_NOTES = 12;

const STOPWORDS = new Set(
  "about above after again against all also and any are because been before being below between both but can could did does doing down during each every few for from further had has have having here how into its itself just like made make many may more most much must near need neither never next none nor not now off often once only other our out over own perhaps quite rather same should since some still such than that the their them then there these they this those though through thus too under until upon very want was way were what when where whether which while who will with within without would your".split(
    /\s+/
  )
);

function terms(value) {
  const out = [];
  for (const match of str(value).toLowerCase().matchAll(/[a-z0-9][a-z0-9'-]{1,}/g)) {
    const word = match[0].replace(/^[-']+|[-']+$/g, "");
    if (word && !STOPWORDS.has(word)) out.push(word);
  }
  return [...new Set(out)];
}

/** Drop YAML frontmatter so properties never become prompt content. */
function stripFrontmatter(text) {
  const value = str(text).replace(/\r\n?/g, "\n");
  return /^---\n[\s\S]*?\n---(?:\n|$)/.test(value) ? value.replace(/^---\n[\s\S]*?\n---(?:\n|$)/, "") : value;
}

/** Split one note into bounded passages, carrying the nearest heading. */
function splitPassages(text, maxChars) {
  const limit = Math.max(200, Math.min(4000, Number(maxChars) || DEFAULT_PASSAGE_CHARS));
  const clean = stripFrontmatter(text).trim();
  if (!clean) return [];
  const blocks = clean.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  const out = [];
  let heading = "";
  let buffer = "";
  const flush = () => {
    if (!buffer.trim()) return;
    out.push({ heading, text: buffer.trim() });
    buffer = "";
  };
  for (const block of blocks) {
    const headingOnly = block.match(/^(#{1,6})\s+(.*)$/);
    if (headingOnly) {
      flush();
      heading = headingOnly[2].trim();
      continue;
    }
    const chunks = block.length > limit ? block.match(new RegExp(`[\\s\\S]{1,${Math.max(1, limit - 80)}}`, "g")) || [block] : [block];
    for (const chunk of chunks) {
      if (buffer && buffer.length + chunk.length + 2 > limit) flush();
      buffer += `${buffer ? "\n\n" : ""}${chunk}`;
    }
  }
  flush();
  return out;
}

function passageBlock(passage) {
  const heading = passage.heading && passage.heading.toLowerCase() !== passage.title.toLowerCase() ? `### ${passage.heading}\n` : "";
  return `${`## ${passage.title}\n`}${heading}${passage.text}\n`;
}

/**
 * Rank passages from the selected notes with a small local BM25-style score.
 * `notes` is [{ path, title, text }]. The result is pure and network-free.
 */
function retrievePassages(notes, query, options) {
  const opts = options || {};
  const maxChars = Math.max(1000, Math.min(60000, Number(opts.maxChars) || DEFAULT_CONTEXT_CHARS));
  const maxNotes = Math.max(1, Math.min(50, Number(opts.maxNotes) || DEFAULT_MAX_NOTES));
  const passageChars = Math.max(200, Math.min(4000, Number(opts.passageChars) || DEFAULT_PASSAGE_CHARS));
  const rows = [];
  const allTerms = [];
  const titles = [];
  for (const note of Array.isArray(notes) ? notes : []) {
    const title = str(note && note.title).trim();
    const path = str(note && note.path).trim();
    if (!title && !path) continue;
    if (!titles.includes(title)) titles.push(title);
    for (const passage of splitPassages(note && note.text, passageChars)) {
      const text = `${title}\n${passage.heading}\n${passage.text}`;
      allTerms.push(terms(text));
      rows.push({ path, title, heading: passage.heading, text: passage.text, textTerms: allTerms[allTerms.length - 1] });
    }
  }
  const documentCount = Math.max(1, rows.length);
  const frequency = new Map();
  for (const rowTerms of allTerms) {
    for (const term of new Set(rowTerms)) frequency.set(term, (frequency.get(term) || 0) + 1);
  }
  const averageLength = Math.max(1, allTerms.reduce((sum, rowTerms) => sum + rowTerms.length, 0) / documentCount);
  const wanted = terms(query);
  for (let order = 0; order < rows.length; order++) {
    const row = rows[order];
    let score = 0;
    let matched = 0;
    const counts = new Map();
    for (const term of row.textTerms) counts.set(term, (counts.get(term) || 0) + 1);
    for (const term of wanted) {
      const count = counts.get(term) || 0;
      if (!count) continue;
      matched += 1;
      const df = frequency.get(term) || 0;
      const idf = Math.log(1 + (documentCount - df + 0.5) / (df + 0.5));
      const tf = (count * 2.2) / (count + 1.2 * (0.25 + 0.75 * (row.textTerms.length / averageLength)));
      score += idf * tf;
      if (row.title.toLowerCase().includes(term)) score += 1.4;
      if (row.heading.toLowerCase().includes(term)) score += 0.8;
    }
    score += Math.min(1.2, matched * 0.12);
    row.score = score;
    row.order = order;
  }
  rows.sort((a, b) => b.score - a.score || a.order - b.order);
  const selected = [];
  const seenNotes = new Set();
  const selectedTitles = [];
  let used = 0;
  let skipped = 0;
  for (const row of rows) {
    if (!seenNotes.has(row.path) && seenNotes.size >= maxNotes) {
      skipped += 1;
      continue;
    }
    const block = passageBlock(row);
    if (used + block.length > maxChars) {
      skipped += 1;
      continue;
    }
    selected.push(block);
    seenNotes.add(row.path);
    if (!selectedTitles.includes(row.title)) selectedTitles.push(row.title);
    used += block.length;
  }
  return {
    text: selected.join("\n"),
    titles: selectedTitles,
    count: seenNotes.size,
    chars: used,
    passages: selected.length,
    scannedNotes: titles.length,
    query: str(query).trim(),
    truncated: skipped > 0 || seenNotes.size < titles.length,
  };
}

module.exports = {
  DEFAULT_CONTEXT_CHARS,
  DEFAULT_MAX_NOTES,
  DEFAULT_PASSAGE_CHARS,
  retrievePassages,
  splitPassages,
  stripFrontmatter,
  terms,
};
