"use strict";
/*
 * Local document classification. This reads extracted text only: no AI call,
 * no OCR, and no writes. The result is a suggestion with evidence; callers
 * must show it and let the user override the type before routing the document.
 */
const { str } = require("./util");

const DOCUMENT_TYPES = ["mcq", "frq", "cards", "notes", "mixed"];
const DOCUMENT_TYPE_LABELS = {
  mcq: "Multiple choice",
  frq: "Free response",
  cards: "Flashcards or vocabulary",
  notes: "Course notes",
  mixed: "Mixed packet",
};

function count(text, re) {
  return (str(text).match(re) || []).length;
}

function pageSignals(text) {
  const source = str(text).replace(/\r\n?/g, "\n");
  const lines = source
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const numbered = lines.filter((line) => /^(?:\d{1,3}|Q\d+|[A-Z]\d+)[).:]\s+\S/.test(line));
  const questionLines = numbered.filter((line) => line.length >= 20 || /\?\s*$/.test(line)).length;
  const choiceLines = lines.filter((line) => /^(?:[-*]\s*)?[A-H][).:]\s+\S/.test(line)).length;
  const cardLines = lines.filter((line) => /^[^:]{1,80}\s*[:—–-]\s*[^:]{1,120}$/.test(line)).length;
  return {
    chars: source.trim().length,
    lines: lines.length,
    numberedLines: numbered.length,
    questionLines,
    choiceLines,
    cardLines,
    headings: lines.filter((line) => /^#{1,4}\s+\S/.test(line)).length,
    answerKey: /(?:^|\n)\s*(?:answer key|correct answers?|answers?)\s*[:：]/i.test(source),
    frqSignals: count(source, /\b(?:free[- ]response|free response questions?|FRQ|scoring guidelines?|scoring rubric|rubric|show your work|points? possible)\b/gi),
    questionId: /(?:^|\n)\s*question[_ ]id\s*[:：]/i.test(source),
  };
}

function classifyText(text) {
  const s = pageSignals(text);
  const mcqStrong = s.choiceLines >= 4 && (s.questionLines >= 2 || s.answerKey || s.questionId);
  const frqStrong = s.frqSignals >= 2 || /\bfree[- ]response\b/i.test(str(text));
  const cardStrong = s.cardLines >= 5 && s.choiceLines < 3 && s.questionLines < 3 && s.chars <= 6000;
  const reasons = [];
  if (s.choiceLines) reasons.push(`${s.choiceLines} answer-choice line${s.choiceLines === 1 ? "" : "s"}`);
  if (s.questionLines) reasons.push(`${s.questionLines} numbered question${s.questionLines === 1 ? "" : "s"}`);
  if (s.answerKey) reasons.push("an answer key");
  if (s.questionId) reasons.push("Question ID labels");
  if (s.frqSignals) reasons.push(`${s.frqSignals} free-response or rubric signal${s.frqSignals === 1 ? "" : "s"}`);
  if (s.cardLines) reasons.push(`${s.cardLines} term/definition line${s.cardLines === 1 ? "" : "s"}`);
  if (s.headings) reasons.push(`${s.headings} heading${s.headings === 1 ? "" : "s"}`);

  let kind = "notes";
  let confidence = s.chars < 80 ? "low" : "medium";
  if (mcqStrong && frqStrong) {
    kind = "mixed";
    confidence = "high";
    reasons.unshift("both answer choices and free-response language");
  } else if (mcqStrong) {
    kind = "mcq";
    confidence = s.choiceLines >= 8 && s.questionLines >= 3 ? "high" : "medium";
  } else if (frqStrong && s.choiceLines < 3) {
    kind = "frq";
    confidence = s.frqSignals >= 3 ? "high" : "medium";
  } else if (cardStrong) {
    kind = "cards";
    confidence = s.cardLines >= 8 ? "high" : "medium";
  } else if (s.chars >= 800 && (s.headings || s.lines >= 8)) {
    reasons.push("long-form text without strong question markers");
    confidence = "medium";
  } else {
    reasons.push("no strong question or card markers");
  }
  return {
    kind,
    label: DOCUMENT_TYPE_LABELS[kind],
    confidence,
    reasons: reasons.slice(0, 5),
    counts: {
      chars: s.chars,
      lines: s.lines,
      questions: s.questionLines,
      choices: s.choiceLines,
      cardLines: s.cardLines,
      frqSignals: s.frqSignals,
    },
  };
}

/**
 * Classify every page independently, then combine the page labels. A packet
 * with a clear MCQ section and a clear FRQ section is reported as mixed even
 * when the combined text would look like only one of them.
 */
function classifyDocument(pages) {
  const list = (Array.isArray(pages) ? pages : []).filter((page) => page && str(page.text).trim());
  const pageResults = list.map((page, index) => {
    const result = classifyText(page.text);
    return { n: page.n || index + 1, kind: result.kind, confidence: result.confidence, chars: result.counts.chars };
  });
  const combined = classifyText(list.map((page) => str(page.text)).join("\n\n"));
  const strong = new Set(pageResults.filter((page) => page.kind !== "notes").map((page) => page.kind));
  let kind = combined.kind;
  if (strong.has("mcq") && strong.has("frq")) kind = "mixed";
  else if (strong.size === 1) kind = [...strong][0];
  const pagesWithType = pageResults.filter((page) => page.kind !== "notes").length;
  const confidence =
    kind === "mixed" || (kind !== "notes" && pagesWithType >= 2)
      ? "high"
      : combined.confidence;
  return {
    kind,
    label: DOCUMENT_TYPE_LABELS[kind],
    confidence,
    reasons: combined.reasons,
    counts: {
      pages: list.length,
      chars: combined.counts.chars,
      questions: combined.counts.questions,
      choices: combined.counts.choices,
      cardLines: combined.counts.cardLines,
      frqSignals: combined.counts.frqSignals,
    },
    pageResults,
  };
}

module.exports = {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  pageSignals,
  classifyText,
  classifyDocument,
};
