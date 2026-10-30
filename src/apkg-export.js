"use strict";
/*
 * Anki .apkg export.
 *
 * Produces the legacy `collection.anki2` package Anki imports: a SQLite
 * database with col, notes, cards, revlog and graves tables, plus an empty
 * media map. Basic, reversed, cloze and multiple-choice cards map onto three
 * note types. Images and audio stay in the vault; the caller warns about them.
 */
const { hashString, str } = require("./util");
const { buildSqlite } = require("./sqlite-write");
const { zipStore } = require("./zip-write");

const MODEL_BASIC = 1001;
const MODEL_CLOZE = 1002;
const MODEL_REVERSED = 1003;

const COL_SQL = "CREATE TABLE col (id integer primary key, crt integer, mod integer, scm integer, ver integer, dty integer, usn integer, ls integer, conf text, models text, decks text, dconf text, tags text)";
const NOTES_SQL = "CREATE TABLE notes (id integer primary key, guid text, mid integer, mod integer, usn integer, tags text, flds text, sfld integer, csum integer, flags integer, data text)";
const CARDS_SQL = "CREATE TABLE cards (id integer primary key, nid integer, did integer, ord integer, mod integer, usn integer, type integer, queue integer, due integer, ivl integer, factor integer, reps integer, lapses integer, left integer, odue integer, odid integer, flags integer, data text)";
const REVLOG_SQL = "CREATE TABLE revlog (id integer primary key, cid integer, usn integer, ease integer, ivl integer, lastIvl integer, factor integer, time integer, type integer)";
const GRAVES_SQL = "CREATE TABLE graves (usn integer, oid integer, type integer)";

const LATEX_PRE = "\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n";
const LATEX_POST = "\\end{document}";

function modelFields(names) {
  return names.map((name, ord) => ({
    name,
    ord,
    font: "Liberation Sans",
    media: [],
    rtl: false,
    size: 20,
    sticky: false,
  }));
}

function model(id, name, type, fieldNames, templates, now) {
  return {
    id: String(id),
    name,
    type,
    mod: now,
    usn: -1,
    did: 1,
    sortf: 0,
    flds: modelFields(fieldNames),
    tmpls: templates.map((template, ord) => ({
      name: template.name,
      qfmt: template.qfmt,
      afmt: template.afmt,
      ord,
      bafmt: "",
      bqfmt: "",
      bfont: "",
      bsize: 0,
      did: null,
    })),
    css: "",
    latexPre: LATEX_PRE,
    latexPost: LATEX_POST,
    latexsvg: false,
    req: templates.map((_template, ord) => [ord, "all", [0]]),
    tags: [],
    vers: [],
  };
}

function modelsFor(now) {
  const basic = model(MODEL_BASIC, "Basic", 0, ["Front", "Back"], [
    { name: "Card 1", qfmt: "{{Front}}", afmt: "{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}" },
  ], now);
  const cloze = model(MODEL_CLOZE, "Cloze", 1, ["Text", "Back Extra"], [
    { name: "Cloze", qfmt: "{{cloze:Text}}", afmt: "{{cloze:Text}}<br>\n{{Back Extra}}" },
  ], now);
  const reversed = model(MODEL_REVERSED, "Basic (and reversed card)", 0, ["Front", "Back"], [
    { name: "Card 1", qfmt: "{{Front}}", afmt: "{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}" },
    { name: "Card 2", qfmt: "{{Back}}", afmt: "{{FrontSide}}\n\n<hr id=answer>\n\n{{Front}}" },
  ], now);
  return { [String(MODEL_BASIC)]: basic, [String(MODEL_CLOZE)]: cloze, [String(MODEL_REVERSED)]: reversed };
}

function deckJson(id, name, now) {
  return {
    collapsed: false,
    conf: 1,
    desc: "",
    dyn: 0,
    extendNew: id === 1 ? 10 : 0,
    extendRev: 50,
    id,
    lrnToday: [0, 0],
    mod: now,
    name,
    newToday: [0, 0],
    revToday: [0, 0],
    timeToday: [0, 0],
    usn: -1,
  };
}

function defaultDeckConfig() {
  return {
    "1": {
      autoplay: true,
      id: 1,
      lapse: { delays: [10], leechAction: 0, leechFails: 8, minInt: 1, mult: 0 },
      maxTaken: 60,
      mod: 0,
      name: "Default",
      new: { bury: true, delays: [1, 10], initialFactor: 2500, ints: [1, 4, 7], order: 1, perDay: 20, separate: true },
      replayq: true,
      rev: { bury: true, ease4: 1.3, fuzz: 0.05, ivlFct: 1, maxIvl: 36500, minSpace: 1, perDay: 100 },
      timer: 0,
      usn: 0,
    },
  };
}

function collectionConf() {
  return {
    activeDecks: [1],
    addToCur: true,
    collapseTime: 1200,
    curDeck: 1,
    curModel: String(MODEL_BASIC),
    dueCounts: true,
    estTimes: true,
    newBury: true,
    newSpread: 0,
    nextPos: 1,
    sortBackwards: false,
    sortType: "noteFld",
    timeLim: 0,
  };
}

function choiceRow(record) {
  const fm = (record && record.fm) || {};
  const raw = [];
  for (let n = 1; n <= 8; n++) {
    const value = str(fm[`choice_${n}`]).trim();
    if (value) raw.push(value);
  }
  if (!raw.length && Array.isArray(fm.choices)) {
    for (const value of fm.choices) if (str(value).trim()) raw.push(str(value).trim());
  }
  if (!raw.length) return null;
  const indexes = str(fm.correct_choices)
    .split(/[,\s]+/)
    .map((part) => Number(part))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= raw.length);
  return { choices: raw, correct: indexes.length ? [...new Set(indexes)] : [1] };
}

function withChoices(front, back, quiz) {
  if (!quiz) return { front, back };
  const letters = quiz.choices.map((choice, index) => `${String.fromCharCode(65 + index)}. ${choice}`);
  const answer = quiz.correct.map((index) => `${String.fromCharCode(64 + index)}. ${quiz.choices[index - 1]}`).join("\n");
  return { front: `${front}\n\n${letters.join("\n")}`, back: `${answer}${back ? `\n\n${back}` : ""}` };
}

function tagsOf(record) {
  const fm = (record && record.fm) || {};
  const source = Array.isArray(fm.tags) ? fm.tags : str(fm.tags).split(/[,;]+/);
  const tags = source.map((tag) => str(tag).trim()).filter(Boolean);
  return tags.length ? ` ${[...new Set(tags)].join(" ")} ` : "";
}

/** Builds the SQLite collection and wraps it in a stored ZIP. */
function buildApkg(records, options) {
  const opts = options || {};
  const now = opts.now instanceof Date ? opts.now : new Date();
  const nowMs = now.getTime();
  const nowSec = Math.floor(nowMs / 1000);
  const list = Array.isArray(records) ? records : [];
  const deckNames = [...new Set(list.map((record) => str(record.fm && record.fm.deck).trim() || "Default"))];
  if (!deckNames.includes("Default")) deckNames.unshift("Default");
  const deckIds = new Map();
  deckNames.forEach((name, index) => deckIds.set(name, index + 1));
  const decks = {};
  for (const [name, id] of deckIds) decks[String(id)] = deckJson(id, name, nowSec);
  const notes = [];
  const cards = [];
  let due = 1;
  let noteIndex = 0;
  for (const record of list) {
    const fm = (record && record.fm) || {};
    const body = (record && record.body) || {};
    const cardType = str(body.cardType || fm.card_type).trim().toLowerCase();
    const rawFront = str(body.rawFront || body.front || fm.front || fm.prompt).trim();
    if (!rawFront) continue;
    const rawBack = str(body.back || fm.back || fm.answer).trim();
    const quiz = choiceRow(record);
    const sides = withChoices(rawFront, rawBack, quiz);
    const deck = str(fm.deck).trim() || "Default";
    const deckId = deckIds.get(deck) || 1;
    const tags = tagsOf(record);
    const noteId = nowMs + noteIndex * 10;
    const cloze = cardType === "cloze";
    const reversed = cardType === "reversed";
    const mid = cloze ? MODEL_CLOZE : reversed ? MODEL_REVERSED : MODEL_BASIC;
    const fields = cloze ? [str(body.rawFront || rawFront), rawBack] : [sides.front, sides.back];
    notes.push([noteId, `mcq-${hashString([record.file && record.file.path, fields[0], fields[1], deck].join("|"))}-${noteIndex}`, mid, nowSec, 0, tags, fields.join("\u001f"), fields[0], 0, 0, ""]);
    const orders = reversed ? [0, 1] : [0];
    for (const ord of orders) {
      cards.push([noteId + ord + 1, noteId, deckId, ord, nowSec, 0, 0, 0, due++, 0, 0, 0, 0, 0, 0, 0, 0, ""]);
    }
    noteIndex++;
  }
  if (!notes.length) throw new Error("No cards with front text can be exported to Anki.");
  const col = [
    1,
    nowSec,
    nowMs,
    nowMs,
    11,
    0,
    0,
    0,
    JSON.stringify(collectionConf()),
    JSON.stringify(modelsFor(nowSec)),
    JSON.stringify(decks),
    JSON.stringify(defaultDeckConfig()),
    "{}",
  ];
  const collection = buildSqlite([
    { name: "col", sql: COL_SQL, rows: [col] },
    { name: "notes", sql: NOTES_SQL, rows: notes },
    { name: "cards", sql: CARDS_SQL, rows: cards },
    { name: "revlog", sql: REVLOG_SQL, rows: [] },
    { name: "graves", sql: GRAVES_SQL, rows: [], rowidAlias: false },
  ]);
  return zipStore([
    { name: "collection.anki2", data: collection },
    { name: "media", data: "{}" },
  ]);
}

function apkgMediaWarning(records) {
  const found = (Array.isArray(records) ? records : []).filter((record) => {
    const text = `${str(record.body && record.body.front)}\n${str(record.body && record.body.back)}`;
    return /!\[\[|!\[[^\]]*\]\(/.test(text);
  });
  if (!found.length) return "";
  return `${found.length} card${found.length === 1 ? "" : "s"} reference images or audio. The .apkg export is text only; add those files in Anki if you need them.`;
}

function apkgExportHint() {
  return "Anki package: save the .apkg and open it with File → Import in Anki. Basic, reversed, cloze and multiple-choice cards are written as normal notes; images and audio are not bundled. Anki will schedule the imported cards as new.";
}

module.exports = {
  buildApkg,
  apkgMediaWarning,
  apkgExportHint,
  MODEL_BASIC,
  MODEL_CLOZE,
  MODEL_REVERSED,
};
