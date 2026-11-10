"use strict";
/*
 * Local readability gate for the document-to-question import. It only looks at
 * the text layer, so a scanned file fails before AI setup and before any vault
 * write. This module is pure: no Obsidian API and no network.
 */

const OCR_HINT =
  "Run it through text recognition (OCR) first, for example by opening it in Google Drive or Adobe, then try again.";

/** A rough count of numbered question starts; the AI still does the real extraction. */
function likelyQuestionCount(pages) {
  let count = 0;
  for (const page of Array.isArray(pages) ? pages : []) {
    const lines = String((page && page.text) || "").split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      if (/^[A-Z][.)]\s+\S/.test(line)) continue; // an answer choice, not a question
      if (/^(?:question\s*)?\d{1,3}\s*[.):-]\s+\S/i.test(line)) count++;
      else if (/^question\s+\d{1,3}\b/i.test(line)) count++;
      else if (/^Q\s*\d{1,3}\s*[.):-]/i.test(line)) count++;
    }
  }
  return count;
}

function unreadableMessage(kind, label) {
  if (kind === "pdf") {
    return `This PDF has almost no readable text, so it is probably scanned images. Scanned PDFs aren't supported yet. ${OCR_HINT}`;
  }
  return `This ${label || "document"} file has almost no readable text. If it is a scanned document, ${OCR_HINT}`;
}

/**
 * The same text test the importer already used, moved ahead of every write.
 * `pages` is the shape returned by readPdfPages/readDocumentPages.
 */
function checkDocumentText(pages, options) {
  const opts = options || {};
  const list = (Array.isArray(pages) ? pages : []).filter((page) => page && typeof page.text === "string");
  const pageCount = list.length;
  const chars = list.reduce((sum, page) => sum + page.text.trim().length, 0);
  const likelyQuestions = likelyQuestionCount(list);
  const minChars = 40 * Math.max(1, pageCount);
  if (!pageCount || chars < minChars) {
    return {
      ok: false,
      pages: pageCount,
      chars,
      likelyQuestions,
      message: unreadableMessage(opts.kind, opts.label),
    };
  }
  return { ok: true, pages: pageCount, chars, likelyQuestions, message: "" };
}

/** One sentence for the preflight result and the post-setup hint. */
function summaryText(check) {
  const pages = check && check.pages ? check.pages : 0;
  const chars = check && check.chars ? check.chars : 0;
  const likely = check && check.likelyQuestions ? check.likelyQuestions : 0;
  const pageText = `${pages} page${pages === 1 ? "" : "s"}`;
  const charText = `${chars.toLocaleString()} character${chars === 1 ? "" : "s"}`;
  if (likely > 0) {
    return `Read ${pageText} (${charText}). About ${likely} question start${likely === 1 ? "" : "s"} spotted.`;
  }
  return `Read ${pageText} (${charText}). No numbered question starts spotted yet.`;
}

module.exports = {
  checkDocumentText,
  likelyQuestionCount,
  summaryText,
  unreadableMessage,
};
