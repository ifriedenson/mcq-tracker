"use strict";
/*
 * Cards and vocabulary: the note model, deck/course resolution and queue.
 *
 * A card is an ordinary Markdown note. Review state is written to the same
 * tracking properties as questions, so one scheduler (the ladder or FSRS)
 * handles both and no separate database is needed.
 */
const { str } = require("./util");
const { isDue } = require("./filters");
const { isStudyable } = require("./study-status");
const { ANSWER_MODES, GRADING_STRICTNESS, normalizeAnswerMode, normalizeStrictness, parseVariants } = require("./card-grading");

const CARD_TYPES = ["basic", "reversed", "cloze", "image-occlusion"];
const CARD_TYPE_LABELS = {
  basic: "Basic",
  reversed: "Reversed",
  cloze: "Cloze",
  "image-occlusion": "Image occlusion",
};
const CARD_GRADES = ["again", "hard", "good", "easy"];
const CARD_ITEM_TYPES = ["card", "flashcard", "vocab", "vocabulary"];

const GRADE_INFO = {
  again: { label: "Again", correct: false, conf: 0, rating: 1 },
  hard: { label: "Hard", correct: true, conf: 1, rating: 2 },
  good: { label: "Good", correct: true, conf: 2, rating: 3 },
  easy: { label: "Easy", correct: true, conf: 3, rating: 4 },
};

const normalizeFolder = (p) => str(p).trim().replace(/^\/+|\/+$/g, "");
const lower = (v) => str(v).trim().toLowerCase();

function normalizeDecks(list) {
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(list) ? list : []) {
    if (!raw || typeof raw !== "object") continue;
    const name = str(raw.name).trim();
    if (!name) continue;
    const key = lower(name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name,
      folder: normalizeFolder(raw.folder),
      course: str(raw.course).trim(),
      answerMode: normalizeAnswerMode(raw.answerMode || raw.answer_mode, ""),
      gradingStrictness: normalizeStrictness(raw.gradingStrictness || raw.grading_strictness, ""),
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

/** Merges saved card settings into defaults without dropping new fields or user data. */
function mergeCardSettings(saved, defaults) {
  const base = Object.assign(
    {
      enabled: false,
      newCardFolder: "Cards",
      defaultDeck: "General",
      reviewLimit: 20,
      order: "due",
      answerMode: "flip",
      gradingStrictness: "standard",
      aiGrading: false,
      decks: [],
      csvMappings: {},
    },
    defaults || {}
  );
  const src = saved && typeof saved === "object" ? saved : {};
  const out = Object.assign({}, base, src);
  out.enabled = src.enabled === true;
  out.newCardFolder = normalizeFolder(src.newCardFolder === undefined ? base.newCardFolder : src.newCardFolder);
  out.defaultDeck = str(src.defaultDeck === undefined ? base.defaultDeck : src.defaultDeck).trim();
  out.reviewLimit = Math.min(100, Math.max(1, Math.round(Number(src.reviewLimit) || base.reviewLimit || 20)));
  out.order = src.order === "all" ? "all" : "due";
  out.answerMode = normalizeAnswerMode(src.answerMode === undefined ? base.answerMode : src.answerMode, "flip");
  out.gradingStrictness = normalizeStrictness(src.gradingStrictness === undefined ? base.gradingStrictness : src.gradingStrictness, "standard");
  out.aiGrading = src.aiGrading === true;
  out.decks = normalizeDecks(src.decks === undefined ? base.decks : src.decks);
  out.csvMappings = src.csvMappings && typeof src.csvMappings === "object" && !Array.isArray(src.csvMappings) ? { ...src.csvMappings } : {};
  return out;
}

function isCardNote(fm) {
  if (!fm) return false;
  const type = lower(fm.item_type || fm.type || fm.note_type);
  if (CARD_ITEM_TYPES.includes(type)) return true;
  // A card_id is enough, unless the note is also a question.
  return !!(str(fm.card_id).trim() && !str(fm.question_id).trim());
}

function cardKind(fm) {
  const type = lower(fm && (fm.item_type || fm.type || fm.note_type));
  return type === "vocab" || type === "vocabulary" ? "vocab" : "card";
}

function deckConfig(settings, name) {
  const key = lower(name);
  return ((settings && settings.cards && settings.cards.decks) || []).find((d) => lower(d.name) === key) || null;
}

/** Effective deck: explicit property, then the deck whose folder contains the note, then the configured default. */
function deckOf(fm, settings, path) {
  const explicit = str(fm && fm.deck).trim();
  if (explicit) return explicit;
  const cards = (settings && settings.cards) || {};
  const p = normalizeFolder(path);
  let best = null;
  for (const deck of cards.decks || []) {
    const folder = normalizeFolder(deck.folder);
    if (!folder || (p !== folder && !p.startsWith(folder + "/"))) continue;
    if (!best || folder.length > best.folder.length) best = { name: deck.name, folder };
  }
  if (best) return best.name;
  const root = normalizeFolder(cards.newCardFolder);
  if (root && p.startsWith(root + "/")) {
    const rest = p.slice(root.length + 1);
    const first = rest.includes("/") ? rest.slice(0, rest.indexOf("/")) : "";
    if (first) return first;
  }
  return str(cards.defaultDeck).trim() || "Unsorted";
}

/** Longest matching folder mapping wins, so a course subfolder can override its parent. */
function courseForFolder(settings, path) {
  const p = normalizeFolder(path);
  let best = null;
  const consider = (folder, course) => {
    const f = normalizeFolder(folder);
    const c = str(course).trim();
    if (!f || !c || (p !== f && !p.startsWith(f + "/"))) return;
    if (!best || f.length > best.folder.length) best = { folder: f, course: c };
  };
  for (const deck of ((settings && settings.cards && settings.cards.decks) || [])) consider(deck.folder, deck.course);
  const subjectFolders = (settings && settings.calendar && settings.calendar.subjectFolders) || {};
  for (const [course, folder] of Object.entries(subjectFolders)) consider(folder, course);
  return best ? best.course : "";
}

/** Effective course tag: the note's own value, then its deck, then the folder mapping. */
function courseOf(fm, settings, path, deckName) {
  const own = str(fm && fm.course).trim();
  if (own) return own;
  const deck = deckConfig(settings, deckName || deckOf(fm, settings, path));
  if (deck && deck.course) return deck.course;
  return courseForFolder(settings, path);
}

/** Card setting, then deck setting, then the global card default. */
function effectiveAnswerMode(fm, settings, deckName) {
  const own = normalizeAnswerMode(fm && (fm.answer_mode || fm.answerMode), "");
  if (own) return own;
  const deck = deckConfig(settings, deckName);
  if (deck && deck.answerMode) return deck.answerMode;
  return normalizeAnswerMode(settings && settings.cards && settings.cards.answerMode, "flip");
}

/** Card setting, then deck setting, then the global strictness. */
function effectiveGradingStrictness(fm, settings, deckName) {
  const own = normalizeStrictness(fm && (fm.grading_strictness || fm.gradingStrictness), "");
  if (own) return own;
  const deck = deckConfig(settings, deckName);
  if (deck && deck.gradingStrictness) return deck.gradingStrictness;
  return normalizeStrictness(settings && settings.cards && settings.cards.gradingStrictness, "standard");
}

/** Fill in the effective deck, course and answer settings so views and filters agree. */
function resolveCard(file, fm, settings) {
  const deck = deckOf(fm, settings, file.path);
  const occluded = lower(fm && fm.card_type) === "image-occlusion";
  return {
    file,
    fm,
    deck,
    course: courseOf(fm, settings, file.path, deck),
    kind: cardKind(fm),
    // A visual mask is a reveal card; typing a label would miss the point.
    answerMode: occluded ? "flip" : effectiveAnswerMode(fm, settings, deck),
    gradingStrictness: effectiveGradingStrictness(fm, settings, deck),
  };
}

function headingsOf(text) {
  const out = {};
  let current = null;
  for (const line of str(text).replace(/\r\n/g, "\n").split("\n")) {
    const m = line.match(/^#{1,3}\s+(.+?)\s*#*\s*$/);
    if (m) {
      current = m[1].toLowerCase().replace(/[*_`]/g, "").trim();
      if (!out[current]) out[current] = [];
      continue;
    }
    if (current) out[current].push(line);
  }
  return out;
}

function firstSection(headings, names) {
  for (const name of names) {
    const body = (headings[name] || []).join("\n").trim();
    if (body) return body;
  }
  return "";
}

function cleanBody(text) {
  return str(text).replace(/^---\n[\s\S]*?\n---\n?/, "").trim();
}

const CLOZE_RE = /==([^=\n]+)==|\{\{c?\d*::([\s\S]*?)\}\}/g;

/** A vault image path or Markdown embed both become the bare link target. */
function cleanImageLink(value) {
  let text = str(value).trim();
  const wiki = /^!?\[\[([^\]|]+)(?:\|[^\]]*)?\]\]$/.exec(text);
  if (wiki) text = wiki[1];
  else {
    const md = /^!\[[^\]]*\]\(([^)]+)\)$/.exec(text);
    if (md) text = md[1];
  }
  return text.trim().replace(/^<|>$/g, "");
}

function firstImage(text) {
  const wiki = /!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/.exec(str(text));
  if (wiki) return wiki[1].trim();
  const md = /!\[[^\]]*\]\(([^)]+)\)/.exec(str(text));
  return md ? md[1].trim() : "";
}

function percent(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, n));
}

/** Mask coordinates are percentages of the image, so they survive resizing. */
function normalizeMask(value) {
  const src = value && typeof value === "object" ? value : {};
  const x = Math.min(99, percent(src.x === undefined ? src.mask_x : src.x, 0));
  const y = Math.min(99, percent(src.y === undefined ? src.mask_y : src.y, 0));
  const w = Math.max(1, Math.min(percent(src.w === undefined ? src.mask_w : src.w, 100), 100 - x));
  const h = Math.max(1, Math.min(percent(src.h === undefined ? src.mask_h : src.h, 100), 100 - y));
  return { x, y, w, h, label: str(src.label === undefined ? src.mask_label : src.label).trim() };
}

/** One mask per line: x, y, width, height, label (all coordinates are percentages). */
function parseMaskRows(text) {
  const out = [];
  for (const line of str(text).replace(/\r\n/g, "\n").split("\n")) {
    const parts = line.split(",").map((part) => part.trim());
    if (parts.length < 5 || !parts.slice(0, 4).every((part) => part !== "" && Number.isFinite(Number(part)))) continue;
    const label = parts.slice(4).join(",").trim();
    if (!label) continue;
    out.push(normalizeMask({ x: Number(parts[0]), y: Number(parts[1]), w: Number(parts[2]), h: Number(parts[3]), label }));
  }
  return out;
}

/** The visible prompt and the hidden deletions of a cloze card. */
function parseCloze(text) {
  const answers = [];
  const prompt = str(text).replace(CLOZE_RE, (_m, a, b) => {
    answers.push(str(a || b).trim());
    return "[…]";
  });
  return { prompt: prompt.trim(), answers };
}

/**
 * Reads the note's Markdown. Basic cards use Front/Back, vocab uses
 * Term/Definition, and reversed cards swap the two at review time.
 */
function parseCardBody(text, fm) {
  const h = headingsOf(cleanBody(text));
  const kind = cardKind(fm);
  if (kind === "vocab") {
    const term = firstSection(h, ["term", "word", "front", "prompt"]) || str(fm.term || fm.word || fm.front).trim();
    const definition =
      firstSection(h, ["definition", "meaning", "back", "answer"]) || str(fm.definition || fm.meaning || fm.back).trim();
    return {
      kind,
      cardType: "basic",
      front: term,
      back: definition,
      prompt: term,
      answer: definition,
      example: firstSection(h, ["example", "example sentence", "usage"]) || str(fm.example).trim(),
      partOfSpeech: firstSection(h, ["part of speech", "pos"]) || str(fm.part_of_speech || fm.pos).trim(),
      language: str(fm.language || fm.lang).trim(),
      notes: firstSection(h, ["notes"]),
      acceptedVariants: parseVariants(fm && (fm.accepted_variants || fm.answer_variants)),
    };
  }

  let cardType = lower(fm && (fm.card_type || fm.card_type_name)) || "basic";
  if (!CARD_TYPES.includes(cardType)) cardType = "basic";
  let front = firstSection(h, ["front", "prompt", "question", "term"]) || str(fm.front || fm.prompt).trim();
  let back = firstSection(h, ["back", "answer", "definition", "explanation"]) || str(fm.back || fm.answer).trim();

  if (cardType === "image-occlusion") {
    const body = cleanBody(text);
    const image = cleanImageLink(fm.image || fm.image_path || fm.diagram || firstImage(body) || firstSection(h, ["image", "diagram"]));
    const label = str(fm.mask_label || fm.back || fm.answer).trim() || back || "Hidden label";
    const prompt = front || str(fm.prompt || fm.occlusion_prompt).trim() || "What is hidden in the highlighted area?";
    const mask = normalizeMask({
      x: fm.mask_x,
      y: fm.mask_y,
      w: fm.mask_w,
      h: fm.mask_h,
      label: fm.mask_label || label,
    });
    return {
      kind,
      cardType,
      front: prompt,
      back: label,
      prompt,
      answer: label,
      image,
      mask,
      occlusionLabel: label,
      example: "",
      partOfSpeech: "",
      language: "",
      notes: firstSection(h, ["notes"]),
      acceptedVariants: [],
    };
  }

  if (cardType === "cloze") {
    const source = front || back || firstSection(h, ["text"]);
    const parsed = parseCloze(source);
    front = parsed.prompt;
    back = parsed.answers.join(" · ");
  } else if (cardType === "reversed") {
    const t = front;
    front = back;
    back = t;
  }

  return {
    kind,
    cardType,
    front,
    back,
    prompt: front,
    answer: back,
    example: firstSection(h, ["example"]),
    partOfSpeech: "",
    language: "",
    notes: firstSection(h, ["notes"]),
    acceptedVariants: parseVariants(fm && (fm.accepted_variants || fm.answer_variants)),
  };
}

function slugify(text, fallback) {
  const s = str(text)
    .replace(/[*_`#>[\]()]/g, "")
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60)
    .replace(/[. ]+$/g, "");
  return s || fallback || "Card";
}

function newCardId(now) {
  const at = now instanceof Date && !isNaN(now.getTime()) ? now.getTime() : Date.now();
  return `c-${at.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

const yamlString = (v) => JSON.stringify(str(v));

/** Builds a self-contained card note with tracking defaults and no hidden plugin state. */
function cardNote(input, now) {
  const data = input || {};
  const kind = data.kind === "vocab" ? "vocab" : "card";
  const deck = str(data.deck).trim() || "Unsorted";
  const course = str(data.course).trim();
  const cardType = kind === "vocab" ? "basic" : CARD_TYPES.includes(lower(data.cardType)) ? lower(data.cardType) : "basic";
  const occluded = kind !== "vocab" && cardType === "image-occlusion";
  const mask = occluded ? normalizeMask(data.mask || data) : null;
  const image = occluded ? cleanImageLink(data.image || data.image_path) : "";
  const front = str(occluded ? data.front || data.prompt || "What is hidden in the highlighted area?" : data.front).trim();
  const back = str(occluded ? data.back || data.label || (mask && mask.label) : data.back).trim();
  const title = slugify(str(data.title).trim() || (occluded ? back : front), kind === "vocab" ? "Vocabulary" : "Card");
  const lines = [
    "---",
    `card_id: ${yamlString(data.id || newCardId(now))}`,
    `item_type: ${kind === "vocab" ? "vocab" : "card"}`,
    `deck: ${yamlString(deck)}`,
  ];
  if (course) lines.push(`course: ${yamlString(course)}`);
  if (data.importSource) lines.push(`import_source: ${yamlString(data.importSource)}`);
  if (data.importFormat) lines.push(`import_format: ${yamlString(data.importFormat)}`);
  if (data.importedOn) lines.push(`imported_on: ${yamlString(data.importedOn)}`);
  if (data.importBatch) lines.push(`import_batch: ${yamlString(data.importBatch)}`);
  if (data.importSourceUrl) lines.push(`import_source_url: ${yamlString(data.importSourceUrl)}`);
  if (data.importKey) lines.push(`import_key: ${yamlString(data.importKey)}`);
  if (data.sourcePdf) lines.push(`source_pdf: ${yamlString(data.sourcePdf)}`);
  if (data.sourceNote) lines.push(`source_note: ${yamlString(data.sourceNote)}`);
  if (data.sourcePage) lines.push(`source_page: ${yamlString(data.sourcePage)}`);
  if (data.sourceHeading) lines.push(`source_heading: ${yamlString(data.sourceHeading)}`);
  if (data.sourceLink) lines.push(`source_link: ${yamlString(data.sourceLink)}`);
  if (data.aiGenerated) lines.push(`ai_generated: ${yamlString(data.aiGenerated)}`);
  if (data.aiModel) lines.push(`ai_model: ${yamlString(data.aiModel)}`);
  if (data.questionSet) lines.push(`question_set: ${yamlString(data.questionSet)}`);
  const choices = Array.isArray(data.choices) ? data.choices : [];
  for (let i = 0; i < choices.length; i++) {
    if (str(choices[i]).trim()) lines.push(`choice_${i + 1}: ${yamlString(str(choices[i]).trim())}`);
  }
  const correct = Array.isArray(data.correctChoices) ? data.correctChoices.join(",") : str(data.correctChoices).trim();
  if (correct) lines.push(`correct_choices: ${yamlString(correct)}`);
  if (Number(data.timeLimit) > 0) lines.push(`time_limit: ${Math.round(Number(data.timeLimit))}`);
  const answerMode = normalizeAnswerMode(data.answerMode, "");
  if (answerMode) lines.push(`answer_mode: ${yamlString(answerMode)}`);
  const gradingStrictness = normalizeStrictness(data.gradingStrictness, "");
  if (gradingStrictness) lines.push(`grading_strictness: ${yamlString(gradingStrictness)}`);
  const variants = parseVariants(data.acceptedVariants);
  if (variants.length) {
    lines.push("accepted_variants:");
    for (const variant of variants) lines.push(`  - ${yamlString(variant)}`);
  }
  if (kind === "vocab") {
    if (data.partOfSpeech) lines.push(`part_of_speech: ${yamlString(data.partOfSpeech)}`);
    if (data.language) lines.push(`language: ${yamlString(data.language)}`);
  } else if (cardType !== "basic") {
    lines.push(`card_type: ${cardType}`);
  }
  if (occluded) {
    if (image) lines.push(`image: ${yamlString(image)}`);
    if (mask) {
      lines.push(`mask_x: ${mask.x}`, `mask_y: ${mask.y}`, `mask_w: ${mask.w}`, `mask_h: ${mask.h}`);
      if (mask.label) lines.push(`mask_label: ${yamlString(mask.label)}`);
    }
  }
  if (Array.isArray(data.tags) && data.tags.length) {
    lines.push("tags:");
    for (const tag of data.tags) if (str(tag).trim()) lines.push(`  - ${yamlString(String(tag).trim())}`);
  }
  lines.push(
    'attempts: 0',
    'correct_count: 0',
    'streak: 0',
    'next_review: ""',
    'history: []',
    '---',
    '',
  );
  if (kind === "vocab") {
    lines.push("## Term", "", front, "", "## Definition", "", back);
    if (data.example) lines.push("", "## Example", "", str(data.example).trim());
    if (data.notes) lines.push("", "## Notes", "", str(data.notes).trim());
  } else {
    lines.push("## Front", "", front, "", "## Back", "", back);
    if (occluded && image) lines.push("", "## Image", "", `![[${image}]]`);
    if (data.example && !occluded) lines.push("", "## Example", "", str(data.example).trim());
    if (data.notes) lines.push("", "## Notes", "", str(data.notes).trim());
  }
  return { text: lines.join("\n") + "\n", title, deck, course, kind, cardType };
}

/** What a score button writes. The explicit rating lets FSRS use all four grades. */
function cardAttempt(grade, seconds) {
  const key = CARD_GRADES.includes(lower(grade)) ? lower(grade) : "good";
  const info = GRADE_INFO[key];
  return {
    correct: info.correct,
    conf: info.conf,
    rating: info.rating,
    grade: key,
    chosen: info.label,
    seconds: Math.max(0, Math.round(Number(seconds) || 0)),
  };
}

/** Due work first, then unseen cards. "all" keeps every card in the pool. */
function cardQueue(cards, options) {
  const opts = options || {};
  const today = opts.today || "";
  const deck = lower(opts.deck);
  const course = lower(opts.course);
  let pool = (cards || []).filter((c) => {
    if (deck && deck !== "all" && lower(c.deck) !== deck) return false;
    if (course && course !== "all" && lower(c.course) !== course) return false;
    if (!isStudyable(c.fm, today)) return false;
    return opts.order === "all" || isDue(c.fm, today) || !Number(c.fm.attempts);
  });
  const rank = (c) => (isDue(c.fm, today) ? 0 : !Number(c.fm.attempts) ? 1 : 2);
  pool = pool.slice().sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r) return r;
    if (rank(a) === 0) return str(a.fm.next_review).localeCompare(str(b.fm.next_review));
    return str(a.fm.card_id).localeCompare(str(b.fm.card_id)) || a.file.path.localeCompare(b.file.path);
  });
  const limit = Math.max(1, Math.min(100, Math.round(Number(opts.limit) || 20)));
  return pool.slice(0, limit);
}

function cardStats(cards, today) {
  const list = Array.isArray(cards) ? cards : [];
  return {
    total: list.length,
    due: list.filter((c) => isStudyable(c.fm, today) && isDue(c.fm, today)).length,
    fresh: list.filter((c) => isStudyable(c.fm, today) && !Number(c.fm.attempts)).length,
  };
}

/** Configured decks plus decks discovered in notes, with per-deck counts. */
function deckSummary(cards, settings, today) {
  const map = new Map();
  const ensure = (name) => {
    const key = lower(name);
    if (!map.has(key)) {
      const cfg = deckConfig(settings, name);
      map.set(key, {
        name: cfg ? cfg.name : name,
        folder: cfg ? cfg.folder : "",
        course: cfg ? cfg.course : "",
        total: 0,
        due: 0,
        fresh: 0,
      });
    }
    return map.get(key);
  };
  for (const deck of ((settings && settings.cards && settings.cards.decks) || [])) ensure(deck.name);
  for (const card of Array.isArray(cards) ? cards : []) {
    const row = ensure(card.deck || "Unsorted");
    row.total++;
    if (!isStudyable(card.fm, today)) continue;
    if (isDue(card.fm, today)) row.due++;
    if (!Number(card.fm.attempts)) row.fresh++;
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

function courseOptions(cards) {
  const set = new Set();
  for (const card of Array.isArray(cards) ? cards : []) if (card.course) set.add(card.course);
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

module.exports = {
  CARD_TYPES,
  CARD_TYPE_LABELS,
  CARD_GRADES,
  ANSWER_MODES,
  GRADING_STRICTNESS,
  GRADE_INFO,
  normalizeFolder,
  normalizeDecks,
  mergeCardSettings,
  isCardNote,
  cardKind,
  deckConfig,
  deckOf,
  courseForFolder,
  courseOf,
  effectiveAnswerMode,
  effectiveGradingStrictness,
  resolveCard,
  parseCloze,
  parseCardBody,
  parseMaskRows,
  cleanImageLink,
  firstImage,
  normalizeMask,
  slugify,
  newCardId,
  cardNote,
  cardAttempt,
  cardQueue,
  cardStats,
  deckSummary,
  courseOptions,
};
