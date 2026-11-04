"use strict";
/*
 * Offline WordNet lookup. The plugin does not ship or download the lexical
 * database: the reader imports the four standard WordNet `data.*` files from
 * the user's own copy, keeps the parsed index in memory and never changes a
 * note. This is the full local-data implementation the owner chose over a
 * bundled subset. No provider, network request or package dependency is used.
 */
const { str } = require("./util");

const DATA_FILES = ["data.noun", "data.verb", "data.adj", "data.adv"];
const DEFAULT_FOLDER = "WordNet";
const MAX_FOLDER = 400;
const MAX_WORD = 120;
const MAX_GLOSS = 700;
const MAX_RELATIONS = 24;
const MAX_RESULTS = 40;
const MAX_FILE_CHARS = 64 * 1024 * 1024;
const MAX_TOTAL_CHARS = 128 * 1024 * 1024;

const POS_LABELS = { n: "Noun", v: "Verb", a: "Adjective", r: "Adverb" };
const POS_ORDER = { n: 0, v: 1, a: 2, r: 3 };

/* Pointer symbols used by the WordNet data files. An unknown symbol is shown
   as-is rather than hidden, so a new database version cannot silently lose a
   relationship. */
const RELATION_LABELS = {
  "!": "Antonym",
  "@": "Hypernym",
  "@i": "Instance hypernym",
  "~": "Hyponym",
  "~i": "Instance hyponym",
  "#m": "Member holonym",
  "#s": "Substance holonym",
  "#p": "Part holonym",
  "%m": "Member meronym",
  "%s": "Substance meronym",
  "%p": "Part meronym",
  "=": "Attribute",
  "+": "Derivationally related",
  ";c": "Domain topic",
  ";r": "Domain region",
  ";u": "Domain usage",
  "-c": "Domain topic",
  "-r": "Domain region",
  "-u": "Domain usage",
  "*": "Entailment",
  ">": "Cause",
  "^": "Also see",
  "$": "Verb group",
  "&": "Similar to",
  "<": "Participle",
  "\\": "Pertainym",
};

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeFolder(value) {
  const folder = str(value)
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .slice(0, MAX_FOLDER);
  return folder || DEFAULT_FOLDER;
}

/** The four files are the complete WordNet database; the folder is vault-relative. */
function normalizeWordNetSettings(value) {
  const source = asObject(value);
  return {
    enabled: source.enabled === true,
    folder: normalizeFolder(source.folder),
  };
}

function normalizePos(value) {
  const pos = str(value).trim().toLowerCase();
  if (pos === "n" || pos === "v" || pos === "r") return pos;
  if (pos === "a" || pos === "s") return "a";
  return "";
}

/** WordNet stores multi-word entries with underscores. */
function normalizeWord(value) {
  return str(value)
    .replace(/\uFEFF/g, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .slice(0, MAX_WORD);
}

function cleanGloss(value) {
  return str(value).replace(/\s+/g, " ").trim().slice(0, MAX_GLOSS);
}

/**
 * Parse one synset line from a WordNet `data.*` file. License/header lines do
 * not start with an offset digit and are rejected. The gloss follows the first
 * `|`; pointer tokens are retained so related senses can be resolved after all
 * four files have been read.
 */
function parseWordNetLine(line) {
  const text = str(line).replace(/^\uFEFF/, "");
  if (!/^\d/.test(text)) return null;
  const bar = text.indexOf("|");
  if (bar < 0) return null;
  const header = text.slice(0, bar).trim();
  const tokens = header.split(/\s+/).filter(Boolean);
  if (tokens.length < 5) return null;
  const offset = Number(tokens[0]);
  const lexFilenum = Number(tokens[1]);
  const pos = normalizePos(tokens[2]);
  const wordCount = parseInt(tokens[3], 16);
  if (!Number.isInteger(offset) || offset < 0 || !pos || !Number.isInteger(wordCount) || wordCount < 1) return null;
  const words = [];
  let at = 4;
  for (let index = 0; index < wordCount && at < tokens.length; index++, at += 2) {
    const word = normalizeWord(tokens[at]);
    if (word && !words.includes(word)) words.push(word);
  }
  if (!words.length) return null;
  const pointerCount = parseInt(tokens[at], 10);
  at += 1;
  const pointers = [];
  if (Number.isInteger(pointerCount) && pointerCount > 0) {
    for (let index = 0; index < pointerCount && at + 3 < tokens.length; index++, at += 4) {
      const symbol = tokens[at];
      const target = Number(tokens[at + 1]);
      const targetPos = normalizePos(tokens[at + 2]);
      if (symbol && Number.isInteger(target) && target >= 0 && targetPos) {
        pointers.push({ symbol, target, targetPos });
      }
    }
  }
  return {
    offset,
    lexFilenum: Number.isInteger(lexFilenum) ? lexFilenum : 0,
    pos,
    words,
    gloss: cleanGloss(text.slice(bar + 1)),
    pointers,
  };
}

function suffixPos(name) {
  const match = /^data\.(noun|verb|adj|adv)$/i.exec(str(name).trim());
  if (!match) return "";
  return { noun: "n", verb: "v", adj: "a", adv: "r" }[match[1].toLowerCase()];
}

function fileEntries(input) {
  if (Array.isArray(input)) {
    return input.map((file) => {
      const source = asObject(file);
      return { name: str(source.name).trim().toLowerCase(), text: str(source.text) };
    });
  }
  const source = asObject(input);
  return DATA_FILES.filter((name) => typeof source[name] === "string").map((name) => ({ name, text: source[name] }));
}

/**
 * Build one index from the four data files. Synsets are stored once by
 * `pos:offset`; each word maps to lightweight refs, so a full database does not
 * duplicate every gloss per synonym. Relations are resolved in a second pass.
 */
function buildWordNetIndex(input) {
  const files = fileEntries(input);
  const entries = new Map();
  const synsets = new Map();
  const fileNames = [];
  const seenFiles = new Set();
  let skipped = 0;
  let characters = 0;

  for (const file of files) {
    if (!file.text) continue;
    if (characters + file.text.length > MAX_TOTAL_CHARS) {
      return { ok: false, reason: "too_large", message: `The WordNet files are larger than the ${Math.round(MAX_TOTAL_CHARS / 1048576)} MB import limit.` };
    }
    characters += file.text.length;
    if (file.text.length > MAX_FILE_CHARS) {
      return { ok: false, reason: "too_large", message: `${file.name} is larger than the ${Math.round(MAX_FILE_CHARS / 1048576)} MB per-file limit.` };
    }
    if (file.name && !seenFiles.has(file.name)) {
      seenFiles.add(file.name);
      fileNames.push(file.name);
    }
    const posHint = suffixPos(file.name);
    for (const line of file.text.replace(/\r\n?/g, "\n").split("\n")) {
      const synset = parseWordNetLine(line);
      if (!synset) {
        if (line.includes("|")) skipped += 1;
        continue;
      }
      if (!synset.pos && posHint) synset.pos = posHint;
      if (!synset.pos) {
        skipped += 1;
        continue;
      }
      const key = `${synset.pos}:${synset.offset}`;
      if (synsets.has(key)) {
        skipped += 1;
        continue;
      }
      const stored = { ...synset, key, relations: [] };
      synsets.set(key, stored);
      for (const word of synset.words) {
        let refs = entries.get(word);
        if (!refs) {
          refs = [];
          entries.set(word, refs);
        }
        if (!refs.some((ref) => ref.pos === stored.pos && ref.offset === stored.offset)) {
          refs.push({ pos: stored.pos, offset: stored.offset });
        }
      }
    }
  }

  if (!synsets.size) {
    return {
      ok: false,
      reason: "empty",
      message: "No WordNet synsets were found. Add data.noun, data.verb, data.adj and data.adv from a WordNet 3.x database.",
    };
  }

  let relationCount = 0;
  for (const synset of synsets.values()) {
    const seen = new Set();
    for (const pointer of synset.pointers) {
      const target = synsets.get(`${pointer.targetPos}:${pointer.target}`);
      if (!target || target.key === synset.key) continue;
      const label = RELATION_LABELS[pointer.symbol] || pointer.symbol;
      const signature = `${label}|${target.words.join("|")}`;
      if (seen.has(signature)) continue;
      seen.add(signature);
      synset.relations.push({
        symbol: pointer.symbol,
        label,
        words: target.words.slice(0, 12),
        gloss: target.gloss,
      });
      relationCount += 1;
      if (synset.relations.length >= MAX_RELATIONS) break;
    }
    delete synset.pointers;
  }

  const wordList = [...entries.keys()].sort();
  const senseCount = [...entries.values()].reduce((sum, refs) => sum + refs.length, 0);
  return {
    ok: true,
    entries,
    synsets,
    wordList,
    stats: {
      files: fileNames.length,
      words: entries.size,
      synsets: synsets.size,
      senses: senseCount,
      relations: relationCount,
      skipped,
      characters,
    },
  };
}

function lowerBound(list, needle) {
  let low = 0;
  let high = list.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (list[mid] < needle) low = mid + 1;
    else high = mid;
  }
  return low;
}

/** Exact word first, then words sharing the typed prefix. */
function searchWords(index, query, limit) {
  const max = Math.max(1, Math.min(MAX_RESULTS, Math.round(Number(limit) || 8)));
  const word = normalizeWord(query);
  if (!index || !index.ok || !word) return [];
  const out = [];
  if (index.entries.has(word)) out.push(word);
  for (let at = lowerBound(index.wordList, word); at < index.wordList.length && out.length < max; at++) {
    const candidate = index.wordList[at];
    if (!candidate.startsWith(word)) break;
    if (!out.includes(candidate)) out.push(candidate);
  }
  return out;
}

function resolveSense(index, ref) {
  const synset = index.synsets.get(`${ref.pos}:${ref.offset}`);
  if (!synset) return null;
  return {
    pos: synset.pos,
    posLabel: POS_LABELS[synset.pos] || synset.pos,
    gloss: synset.gloss,
    synonyms: synset.words.slice(),
    relations: synset.relations.map((relation) => ({
      label: relation.label,
      words: relation.words.slice(),
      gloss: relation.gloss,
    })),
  };
}

/**
 * Return every sense of the exact word, or a short list of prefix suggestions
 * when the word is not in the imported database.
 */
function lookupWord(index, query, limit) {
  if (!index || !index.ok) {
    return { ok: false, reason: "not_loaded", message: "Import or load a WordNet database first." };
  }
  const word = normalizeWord(query);
  if (!word) return { ok: false, reason: "query", message: "Type a word to look up." };
  const refs = index.entries.get(word);
  if (!refs || !refs.length) {
    return {
      ok: false,
      reason: "missing",
      word,
      suggestions: searchWords(index, word, 8),
      message: `No WordNet entry for "${word}".`,
    };
  }
  const max = Math.max(1, Math.min(MAX_RESULTS, Math.round(Number(limit) || 20)));
  const senses = refs
    .slice(0, max)
    .map((ref) => resolveSense(index, ref))
    .filter(Boolean)
    .sort((a, b) => (POS_ORDER[a.pos] - POS_ORDER[b.pos]) || a.gloss.localeCompare(b.gloss));
  return { ok: true, word, senses, suggestions: [] };
}

function filePath(folder, name) {
  const clean = normalizeFolder(folder);
  return clean === "/" ? name : `${clean}/${name}`;
}

module.exports = {
  DATA_FILES,
  DEFAULT_FOLDER,
  MAX_FILE_CHARS,
  MAX_GLOSS,
  MAX_RELATIONS,
  MAX_RESULTS,
  MAX_TOTAL_CHARS,
  POS_LABELS,
  RELATION_LABELS,
  buildWordNetIndex,
  filePath,
  lookupWord,
  normalizeFolder,
  normalizePos,
  normalizeWord,
  normalizeWordNetSettings,
  parseWordNetLine,
  searchWords,
};
