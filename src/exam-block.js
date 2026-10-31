"use strict";
/*
 * Exam Plugin-compatible `exam` blocks. The block is one question written with
 * XML-like tags:
 *
 *   <num>1</num>
 *   <source>2022 practice</source>
 *   <stem>The company aims to ___ its share.</stem>
 *   <options>
 *   A. increase
 *   B. decrease
 *   </options>
 *   <answer>A</answer>
 *   <analysis>increase means to make larger.</analysis>
 *
 * Parsing is local and never throws; malformed blocks return issues so the
 * renderer can explain the format in place.
 */
const { str } = require("./util");

const LETTERS = "ABCDEFGH";

function decodeEntities(value) {
  return str(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&#0*38;|&amp;/gi, "&");
}

function tagText(source, name) {
  const match = str(source).match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return match ? decodeEntities(match[1]).trim() : "";
}

function cleanLine(value) {
  return str(value).replace(/[ \t]+$/g, "").trim();
}

function parseOptions(text) {
  const options = [];
  for (const raw of str(text).replace(/\r\n?/g, "\n").split("\n")) {
    const line = cleanLine(raw);
    if (!line) continue;
    const match = line.match(/^(?:[-*+]\s*)?([A-H])\s*(?:[.)、:：]|\s)\s*(.+)$/i);
    if (match) {
      options.push({ letter: match[1].toUpperCase(), text: match[2].trim() });
      continue;
    }
    if (options.length) options[options.length - 1].text += ` ${line}`;
  }
  return options;
}

function normalizeNumber(value) {
  const text = cleanLine(value);
  if (!text) return "";
  if (!/^\d+$/.test(text)) return text;
  return String(Number(text)).padStart(2, "0");
}

function parseAnswer(value, options) {
  const raw = cleanLine(value).replace(/[，、/]/g, ",").toUpperCase();
  if (!raw) return { answers: [], issue: "Add the key inside <answer>…</answer>, for example <answer>B</answer>." };
  if (!/^[A-H](?:\s*[, ]\s*[A-H])*$/.test(raw)) {
    return { answers: [], issue: "The <answer> must contain option letters, for example B or A,C." };
  }
  const wanted = [...new Set(raw.match(/[A-H]/g) || [])];
  const available = new Set(options.map((option) => option.letter));
  const missing = wanted.filter((letter) => !available.has(letter));
  if (missing.length) {
    return { answers: [], issue: `Answer ${missing.join(", ")} is not one of the options.` };
  }
  const order = new Map(options.map((option, index) => [option.letter, index]));
  const answers = wanted.slice().sort((a, b) => order.get(a) - order.get(b));
  return { answers, issue: "" };
}

/** Parse one `exam` block into a question, options and a key. */
function parseExamBlock(source) {
  const text = str(source).replace(/\r\n?/g, "\n");
  const stem = tagText(text, "stem");
  const sourceLabel = cleanLine(tagText(text, "source"));
  const num = normalizeNumber(tagText(text, "num"));
  const analysis = tagText(text, "analysis");
  const options = parseOptions(tagText(text, "options"));
  const issues = [];
  if (!stem) issues.push("Add the question inside <stem>…</stem>.");
  if (options.length < 2) {
    issues.push('Add at least two options inside <options>…</options>, one per line as "A. …".');
  }
  if (new Set(options.map((option) => option.letter)).size !== options.length) {
    issues.push("Each option needs its own letter.");
  }
  const answer = parseAnswer(tagText(text, "answer"), options);
  if (answer.issue) issues.push(answer.issue);
  return {
    num,
    source: sourceLabel,
    stem,
    options,
    answers: answer.answers,
    analysis,
    valid: issues.length === 0,
    issues,
  };
}

module.exports = { LETTERS, parseExamBlock };
