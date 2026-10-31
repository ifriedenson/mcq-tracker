"use strict";
/*
 * Local vault search with citations, adapting the semantic-search idea from
 * Gemini Helper and LLM Hub without any model or network call. A block ranks
 * Markdown notes with BM25-style term scoring, shows a snippet and links back
 * to the source note, so an AI answer or a study answer always has a citation
 * the reader can open.
 *
 *   ```vault-search
 *   Query: oxidative phosphorylation
 *   Folder: Biology
 *   Limit: 5
 *   ```
 */
const { str } = require("./util");

const MAX_FILE_CHARS = 200000;
const MAX_SCAN_FILES = 400;
const DEFAULT_LIMIT = 5;
const SNIPPET_WIDTH = 220;

const STOPWORDS = new Set(
  "about above after again against all also and any are because been before being below between both but can could did does doing down during each every few for from further had has have having here how into its itself just like made make many may more most much must near need neither never next none nor not now off often once only other our out over own perhaps quite rather same should since some still such than that the their them then there these they this those though through thus too under until upon very want was way were what when where whether which while who will with within without would your".split(
    /\s+/
  )
);

function normalizeVaultSearchSettings(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const limit = Number(source.limit);
  return {
    enabled: !(value === false || source.enabled === false),
    limit: Number.isFinite(limit) ? Math.max(1, Math.min(20, Math.round(limit))) : DEFAULT_LIMIT,
  };
}

function parseVaultSearchSource(source) {
  const out = { query: "", folder: "", limit: 0, headingsOnly: false, issues: [] };
  const rest = [];
  for (const raw of str(source).replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const match = line.match(/^(Query|Search|Folder|Path|Limit|Headings)\s*:\s*(.*)$/i);
    if (!match) {
      rest.push(line);
      continue;
    }
    const key = match[1].toLowerCase();
    const value = match[2].trim();
    if (key === "query" || key === "search") out.query = value;
    else if (key === "folder" || key === "path") out.folder = value;
    else if (key === "limit") out.limit = Math.max(0, Math.min(20, Math.round(Number(value) || 0)));
    else if (key === "headings") out.headingsOnly = /^(on|true|yes)$/i.test(value);
  }
  if (!out.query && rest.length) out.query = rest.join(" ").trim();
  if (!out.query) out.issues.push("Add a Query: line, for example Query: oxidative phosphorylation.");
  return out;
}

function tokenize(text) {
  const tokens = [];
  for (const match of str(text).toLowerCase().matchAll(/[a-z0-9][a-z0-9'-]{1,}/g)) {
    const word = match[0].replace(/^[-']+|[-']+$/g, "");
    if (!word || STOPWORDS.has(word)) continue;
    tokens.push(word);
  }
  return tokens;
}

function uniqueTerms(query) {
  return [...new Set(tokenize(query))];
}

function scoreDocument(doc, terms, stats) {
  const text = str(doc.text);
  const lower = text.toLowerCase();
  const length = Math.max(1, tokenize(text).length);
  let score = 0;
  let matched = 0;
  for (const term of terms) {
    const count = lower.split(term).length - 1;
    if (!count) continue;
    matched += 1;
    const df = stats.frequency.get(term) || 0;
    const idf = Math.log(1 + (stats.documents - df + 0.5) / (df + 0.5));
    const tf = (count * 2.2) / (count + 1.2 * (0.25 + 0.75 * (length / stats.averageLength)));
    score += idf * tf;
  }
  const phrase = str(doc.phrase || "").toLowerCase();
  if (phrase && phrase.length > 2 && lower.includes(phrase)) score += 1.6;
  score += Math.min(1.5, matched * 0.15);
  return { score, matched };
}

function makeSnippet(text, terms) {
  const clean = str(text).replace(/\r\n?/g, "\n");
  const paragraphs = clean
    .split(/\n{2,}/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter((part) => part && !part.startsWith("---"));
  let best = { text: "", hits: -1 };
  for (const paragraph of paragraphs) {
    const lower = paragraph.toLowerCase();
    const hits = terms.filter((term) => lower.includes(term)).length;
    if (hits > best.hits) best = { text: paragraph, hits };
    if (hits === terms.length && terms.length) break;
  }
  if (!best.text) {
    const line = clean.split("\n").map((part) => part.trim()).find((part) => part && !part.startsWith("---"));
    if (!line) return "";
    best = { text: line.replace(/\s+/g, " "), hits: 0 };
  }
  if (best.text.length <= SNIPPET_WIDTH) return best.text;
  const lower = best.text.toLowerCase();
  let at = -1;
  for (const term of terms) {
    const index = lower.indexOf(term);
    if (index >= 0 && (at < 0 || index < at)) at = index;
  }
  const start = Math.max(0, (at < 0 ? 0 : at) - 60);
  const end = Math.min(best.text.length, start + SNIPPET_WIDTH);
  return `${start > 0 ? "…" : ""}${best.text.slice(start, end).trim()}${end < best.text.length ? "…" : ""}`;
}

/**
 * Rank documents for a query. `docs` is `[{ path, text }]`; ranking is local
 * and deterministic, and every result carries the snippet used as a citation.
 */
function searchDocs(docs, query, options) {
  const opts = options && typeof options === "object" ? options : {};
  const terms = uniqueTerms(query);
  const folder = str(opts.folder).trim().replace(/^\/+|\/+$/g, "").toLowerCase();
  const limit = Math.max(1, Math.min(20, Math.round(Number(opts.limit) || DEFAULT_LIMIT)));
  const list = (Array.isArray(docs) ? docs : []).filter((doc) => {
    if (!doc || !str(doc.path)) return false;
    if (!folder) return true;
    return str(doc.path).toLowerCase().startsWith(folder + "/");
  });
  if (!terms.length) {
    return { results: [], query: str(query), terms, issues: ["Add a query with at least one meaningful word."], scanned: list.length };
  }
  const frequency = new Map();
  let totalLength = 0;
  for (const doc of list) {
    const words = tokenize(doc.text);
    totalLength += words.length;
    for (const word of new Set(words)) frequency.set(word, (frequency.get(word) || 0) + 1);
  }
  const stats = { frequency, documents: Math.max(1, list.length), averageLength: Math.max(1, totalLength / Math.max(1, list.length)) };
  const scored = [];
  for (const doc of list) {
    const result = scoreDocument({ text: doc.text, phrase: query }, terms, stats);
    if (result.score <= 0) continue;
    scored.push({
      path: str(doc.path),
      score: Math.round(result.score * 1000) / 1000,
      matched: result.matched,
      snippet: makeSnippet(doc.text, terms),
    });
  }
  scored.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  const issues = [];
  if (!scored.length) issues.push("No note matched. Try fewer or more specific words.");
  return { results: scored.slice(0, limit), query: str(query), terms, issues, scanned: list.length };
}

async function collectVaultDocs(plugin, options) {
  const opts = options && typeof options === "object" ? options : {};
  const files = plugin && plugin.app && typeof plugin.app.vault.getMarkdownFiles === "function"
    ? plugin.app.vault.getMarkdownFiles()
    : [];
  const folder = str(opts.folder).trim().replace(/^\/+|\/+$/g, "").toLowerCase();
  const docs = [];
  for (const file of files) {
    if (docs.length >= (opts.maxFiles || MAX_SCAN_FILES)) break;
    const path = str(file && file.path);
    if (!path || (folder && !path.toLowerCase().startsWith(folder + "/"))) continue;
    try {
      const text = str(await plugin.app.vault.cachedRead(file)).slice(0, MAX_FILE_CHARS);
      docs.push({ path, text });
    } catch (e) {
      // unreadable notes are skipped rather than failing the whole search
    }
  }
  return docs;
}

async function renderVaultSearchBlock(plugin, source, el) {
  if (plugin && typeof plugin.vaultSearchEnabled === "function" && !plugin.vaultSearchEnabled()) {
    el.createDiv({ cls: "qt-vault-search-issue", text: "Vault search is off. Turn it on in Settings, Global, Modules." });
    return null;
  }
  const parsed = parseVaultSearchSource(source);
  const box = el.createDiv({ cls: "qt-vault-search" });
  box.createDiv({ cls: "qt-vault-search-title", text: parsed.query ? `Cited lookup · ${parsed.query}` : "Cited lookup" });
  for (const issue of parsed.issues.slice(0, 4)) box.createDiv({ cls: "qt-vault-search-issue", text: issue });
  if (!parsed.query) return parsed;
  const docs = await collectVaultDocs(plugin, { folder: parsed.folder });
  const found = searchDocs(docs, parsed.query, { folder: parsed.folder, limit: parsed.limit || normalizeVaultSearchSettings(plugin && plugin.settings && plugin.settings.vaultSearch).limit });
  box.createDiv({
    cls: "qt-vault-search-meta",
    text: `${found.results.length} result${found.results.length === 1 ? "" : "s"} · scanned ${found.scanned} note${found.scanned === 1 ? "" : "s"} · local index, no network`,
  });
  for (const issue of found.issues.slice(0, 4)) box.createDiv({ cls: "qt-vault-search-issue", text: issue });
  const list = box.createDiv({ cls: "qt-vault-search-list" });
  for (const result of found.results) {
    const row = list.createDiv({ cls: "qt-vault-search-row" });
    const head = row.createDiv({ cls: "qt-vault-search-head" });
    head.createSpan({ cls: "qt-vault-search-path", text: `[[${result.path}]]` });
    head.createSpan({ cls: "qt-vault-search-score", text: result.score.toFixed(2) });
    row.createDiv({ cls: "qt-vault-search-snippet", text: result.snippet });
    row.createEl("button", { text: "Open note" }).addEventListener("click", () => {
      if (plugin && typeof plugin.openStudyFlowSource === "function") plugin.openStudyFlowSource(result.path);
    });
  }
  return found;
}

module.exports = {
  DEFAULT_LIMIT,
  collectVaultDocs,
  makeSnippet,
  normalizeVaultSearchSettings,
  parseVaultSearchSource,
  renderVaultSearchBlock,
  searchDocs,
  tokenize,
};
