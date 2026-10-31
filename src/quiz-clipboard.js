"use strict";
/*
 * Import the `note-quiz` Markdown that Note Quiz Engine (and AI tools following
 * its prompt) produces, and turn it into Quick add text. Nothing here touches
 * the vault or the clipboard: the command reads the clipboard in plugin.js,
 * and the existing Quick add dialog still previews before writing.
 *
 *   ```note-quiz
 *   quiz:
 *   type: choice
 *   question: "Which command shows memory?"
 *   options:
 *   - "df"
 *   - "free"
 *   answer: 2
 *   explanation: "free shows memory and swap."
 *   ```
 */
const { str } = require("./util");

const LETTERS = "ABCDEFGH";

function unquote(value) {
  const text = str(value).trim();
  if (/^".*"$/.test(text)) {
    try {
      return JSON.parse(text);
    } catch (e) {
      return text.slice(1, -1).replace(/\\"/g, '"');
    }
  }
  if (/^'.*'$/.test(text)) return text.slice(1, -1).replace(/''/g, "'");
  return text;
}

/** A deliberately small YAML reader for the fields Note Quiz Engine emits. */
function parseNoteQuizFields(source) {
  const out = { options: [], answers: [] };
  const lines = str(source).replace(/\r\n?/g, "\n").split("\n");
  let list = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#")) continue;
    if (/^quiz\s*:\s*$/i.test(line)) continue;
    const item = line.match(/^-\s+(.*)$/);
    if (item && list) {
      out[list].push(unquote(item[1]));
      continue;
    }
    const field = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!field) continue;
    const key = field[1].toLowerCase();
    const value = field[2].trim();
    if (key === "options" || key === "answers") {
      list = key;
      if (value) out[key].push(unquote(value));
      continue;
    }
    list = "";
    if (/^[|>][-+]?$/.test(value)) {
      const block = [];
      while (i + 1 < lines.length) {
        const next = lines[i + 1];
        if (!next.trim()) {
          block.push("");
          i++;
          continue;
        }
        if (!/^\s{2,}/.test(next)) break;
        block.push(next.replace(/^\s{2,}/, ""));
        i++;
      }
      out[key] = value.startsWith(">") ? block.join(" ").trim() : block.join("\n").trim();
      continue;
    }
    out[key] = unquote(value);
  }
  return out;
}

function cleanText(value) {
  return str(value).replace(/[ \t]+$/gm, "").trim();
}

function choiceLetter(answer, options) {
  const raw = str(answer).trim();
  if (/^\d+$/.test(raw)) {
    const at = Number(raw) - 1;
    return at >= 0 && at < options.length ? LETTERS[at] : "";
  }
  if (/^[A-Ha-h]$/.test(raw)) {
    const at = LETTERS.indexOf(raw.toUpperCase());
    return at >= 0 && at < options.length ? raw.toUpperCase() : "";
  }
  const at = options.findIndex((option) => option.trim().toLowerCase() === raw.toLowerCase());
  return at >= 0 ? LETTERS[at] : "";
}

function typeOf(value) {
  const text = str(value).trim().toLowerCase();
  if (/choice|mcq|multiple|選択/.test(text)) return "choice";
  if (/text|short|spr|written|記述/.test(text)) return "text";
  return "";
}

/**
 * Parse every fenced `note-quiz` block. Invalid blocks stay out of the text
 * and are reported by block number so the preview can explain them.
 */
function noteQuizToQuickAdd(text) {
  const source = str(text).replace(/\r\n?/g, "\n");
  const blocks = [];
  const fence = /^[ \t]*```+[ \t]*note-quiz\b[^\n]*\n([\s\S]*?)^[ \t]*```+[ \t]*$/gm;
  let match = fence.exec(source);
  while (match) {
    blocks.push(match[1]);
    match = fence.exec(source);
  }
  if (!blocks.length) {
    return {
      text: "",
      found: 0,
      valid: 0,
      issues: [
        {
          index: 0,
          message:
            "No note-quiz blocks were found on the clipboard. Copy the Markdown your AI generated, including the ```note-quiz fences, then try again.",
        },
      ],
      format: "note-quiz",
    };
  }

  const issues = [];
  const chunks = [];
  blocks.forEach((block, index) => {
    const data = parseNoteQuizFields(block);
    const question = cleanText(data.question);
    const explanation = cleanText(data.explanation);
    const type = typeOf(data.type);
    if (!question) {
      issues.push({ index, message: `Block ${index + 1} has no question. Add question: "…".` });
      return;
    }
    if (!type) {
      issues.push({ index, message: `Block ${index + 1} has an unsupported type "${str(data.type)}". Use choice or text.` });
      return;
    }

    const lines = [`Q: ${question}`];
    if (type === "choice") {
      const options = (data.options || []).map(cleanText).filter(Boolean);
      if (options.length < 2) {
        issues.push({ index, message: `Block ${index + 1} needs at least two options.` });
        return;
      }
      const key = choiceLetter(data.answer, options);
      if (!key) {
        issues.push({ index, message: `Block ${index + 1} has no answer that matches one of its options.` });
        return;
      }
      options.forEach((option, at) => lines.push(`${LETTERS[at]}. ${option}`));
      lines.push(`Answer: ${key}`);
    } else {
      const answers = [];
      for (const value of [...(data.answers || []), data.answer]) {
        const answer = cleanText(value);
        if (answer && !answers.some((seen) => seen.toLowerCase() === answer.toLowerCase())) answers.push(answer);
      }
      if (!answers.length) {
        issues.push({ index, message: `Block ${index + 1} has no answers. Add answers: or answer:.` });
        return;
      }
      lines.push(`Answer: ${answers[0]}`);
      if (answers.length > 1) lines.push(`Accepted: ${answers.slice(1).join(" | ")}`);
    }
    if (explanation) lines.push(`Why: ${explanation}`);
    chunks.push(lines.join("\n"));
  });

  return {
    text: chunks.join("\n\n---\n\n"),
    found: blocks.length,
    valid: chunks.length,
    issues,
    format: "note-quiz",
  };
}

module.exports = { noteQuizToQuickAdd, parseNoteQuizFields };
