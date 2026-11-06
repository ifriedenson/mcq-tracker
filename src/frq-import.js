"use strict";
/*
 * Turns the text layer of a free-response PDF into candidate items. This module
 * is pure: it never reads a file, calls a model or writes a note. The preview
 * modal is the only place a candidate becomes a note.
 */
const { parseRubric } = require("./frq");
const { str } = require("./util");

const MAX_PROMPT_CHARS = 20000;
const MAX_RUBRIC_CHARS = 12000;
const MAX_ITEMS = 60;

const RUBRIC_HEADING = /^(?:#{1,6}\s*)?(?:scoring\s+(?:guidelines?|rubric|notes)|scoring|rubric|grading\s+(?:guidelines?|rubric)|answer\s+key|points?\s+(?:possible|available))\b/i;
const QUESTION_LABEL = /^(?:#{1,6}\s*)?(?:question\s+|free[- ]response(?:\s+question)?\s*|frq\s*(?:#|no\.?)?\s*)(\d{1,2})\b/i;
const NUMBERED_LABEL = /^(\d{1,2})\s*[.)]\s+\S/;

function lineText(value) {
  if (typeof value === "string") return value;
  if (value && typeof value.text === "string") return value.text;
  if (value && typeof value.s === "string") return value.s;
  return "";
}

function pageEntries(pages) {
  const entries = [];
  for (const page of Array.isArray(pages) ? pages : []) {
    const number = Math.max(0, Math.round(Number(page && page.n) || 0)) || entries.length + 1;
    const source = Array.isArray(page && page.lines) && page.lines.length ? page.lines : str(page && page.text).split(/\r?\n/);
    for (const raw of source) {
      const text = lineText(raw).replace(/\r/g, "").trim();
      if (!text) continue;
      if (/^(?:go on to the next page|end of (?:the )?(?:exam|test)|©|copyright\b)/i.test(text)) continue;
      entries.push({ text, page: number });
    }
  }
  return entries;
}

function isQuestionStart(text) {
  if (RUBRIC_HEADING.test(text)) return false;
  return QUESTION_LABEL.test(text) || NUMBERED_LABEL.test(text);
}

function questionNumber(text) {
  const labeled = QUESTION_LABEL.exec(text);
  if (labeled) return Number(labeled[1]);
  const numbered = NUMBERED_LABEL.exec(text);
  return numbered ? Number(numbered[1]) : 0;
}

function stripQuestionLabel(text) {
  return str(text)
    .replace(/^#{1,6}\s*/, "")
    .replace(/^(?:question\s+|free[- ]response(?:\s+question)?\s*|frq\s*(?:#|no\.?)?\s*)\d{1,2}\s*[.:)-]?\s*/i, "")
    .replace(/^\d{1,2}\s*[.)]\s*/, "")
    .trim();
}

function looksLikeRubricLine(text) {
  if (RUBRIC_HEADING.test(text)) return true;
  if (/^\s*[-*]\s*\[\s*\d+(?:\.\d+)?\s*\]/.test(text)) return true;
  if (/^\s*\(\s*\d+(?:\.\d+)?\s*\)\s+\S/.test(text)) return true;
  if (/^\s*\d+(?:\.\d+)?\s*(?:points?|pts)\b/i.test(text)) return true;
  if (/\(\s*\d+(?:\.\d+)?\s*points?\s*\)/i.test(text)) return true;
  if (/^\|\s*(?:criterion|criteria)\s*\|/i.test(text)) return true;
  return false;
}

function cleanPrompt(lines) {
  const out = [];
  for (const line of lines) {
    const text = str(line).trim();
    if (!text) continue;
    if (/^(?:go on to the next page|end of (?:the )?(?:exam|test))\b/i.test(text)) continue;
    out.push(text);
  }
  return out.join("\n").trim().slice(0, MAX_PROMPT_CHARS);
}

function cleanRubric(lines) {
  return lines.join("\n").trim().slice(0, MAX_RUBRIC_CHARS);
}

/**
 * Split one document's pages into candidates. A question starts at a numbered
 * FRQ label; its rubric starts at a scoring/rubric heading or, when no heading
 * exists, at the first recognizable criterion line.
 *
 * Returns { items, warnings }. Every item has prompt, rubricText, criteria,
 * page/pages and a `valid` flag; invalid items are not silently repaired with a
 * preset rubric.
 */
function splitFrqItems(pages) {
  const entries = pageEntries(pages);
  const warnings = [];
  if (!entries.length) return { items: [], warnings: ["No text layer was found in that PDF."] };

  const starts = [];
  entries.forEach((entry, index) => {
    if (isQuestionStart(entry.text)) starts.push(index);
  });
  if (!starts.length) starts.push(0);
  if (starts.length > MAX_ITEMS) warnings.push(`Only the first ${MAX_ITEMS} candidate items were kept.`);

  const items = [];
  for (let index = 0; index < Math.min(starts.length, MAX_ITEMS); index++) {
    const start = starts[index];
    const end = index + 1 < starts.length ? starts[index + 1] : entries.length;
    const chunk = entries.slice(start, end);
    if (!chunk.length) continue;

    let rubricAt = chunk.findIndex((entry) => RUBRIC_HEADING.test(entry.text));
    if (rubricAt < 0) {
      const fallback = chunk.findIndex((entry) => looksLikeRubricLine(entry.text));
      rubricAt = fallback > 0 ? fallback : -1;
    }

    const rubricHeading = rubricAt >= 0 && RUBRIC_HEADING.test(chunk[rubricAt].text);
    const promptLines = rubricAt > 0 ? chunk.slice(0, rubricAt) : rubricAt === 0 ? [] : chunk;
    const rubricLines = rubricAt >= 0 ? chunk.slice(rubricAt + (rubricHeading ? 1 : 0)) : [];
    const number = questionNumber(chunk[0].text);
    const firstPromptLine = promptLines.find((entry) => stripQuestionLabel(entry.text));
    const fallbackTitle = firstPromptLine
      ? stripQuestionLabel(firstPromptLine.text).split(/\n/)[0].replace(/\s+/g, " ").slice(0, 60)
      : "";
    const prompt = cleanPrompt(promptLines.map((entry) => stripQuestionLabel(entry.text)));
    const rubricText = cleanRubric(rubricLines.map((entry) => entry.text));
    const parsed = parseRubric(rubricText);
    const itemWarnings = parsed.warnings.slice();
    if (!prompt) itemWarnings.push("No prompt text was found for this item.");
    if (!rubricText) itemWarnings.push("No rubric text was found for this item.");
    else if (!parsed.criteria.length) itemWarnings.push("The rubric text did not contain recognizable criteria.");
    const itemPages = [...new Set(chunk.map((entry) => entry.page))];
    const title = number ? `Question ${number}` : fallbackTitle || `Imported FRQ ${items.length + 1}`;

    items.push({
      id: `frq-import-${items.length + 1}`,
      title,
      prompt,
      rubricText,
      criteria: parsed.criteria,
      warnings: [...new Set(itemWarnings)],
      valid: Boolean(prompt && parsed.criteria.length),
      page: chunk[0].page,
      pages: itemPages,
    });
  }

  if (!items.length) warnings.push("No free-response prompts were found in that PDF.");
  return { items, warnings };
}

module.exports = {
  MAX_ITEMS,
  MAX_PROMPT_CHARS,
  MAX_RUBRIC_CHARS,
  splitFrqItems,
};
