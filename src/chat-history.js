"use strict";
/*
 * Bounded chat history for the Direct API backend, plus a Markdown export.
 *
 * The API backend keeps its own message array (OpenCode keeps sessions on the
 * server). Storing that array in plugin settings lets the study agent survive a
 * reload without growing without limit, and the same module writes the note the
 * "Save chat" button creates. Pure: no Obsidian API.
 */
const { str } = require("./util");

const MAX_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 8000;

/** Keep only usable user/assistant turns, newest first cut to the cap. */
function normalizeChatHistory(value) {
  const rows = (Array.isArray(value) ? value : [])
    .map((message) => ({
      role: message && message.role === "user" ? "user" : "assistant",
      content: str(message && message.content).trim().slice(0, MAX_MESSAGE_CHARS),
    }))
    .filter((message) => message.content);
  const capped = rows.slice(-MAX_MESSAGES);
  while (capped.length && capped[0].role === "assistant") capped.shift();
  return capped;
}

/** A transcript as a plain Markdown note; "" when there is nothing to save. */
function chatMarkdown(turns, options) {
  const opts = options || {};
  const rows = [];
  for (const turn of Array.isArray(turns) ? turns : []) {
    const texts = (turn && Array.isArray(turn.texts) ? turn.texts : []).map((text) => str(text)).filter((text) => text.trim());
    const tools = (turn && Array.isArray(turn.tools) ? turn.tools : []).map((tool) => str(tool)).filter(Boolean);
    if (!texts.length && !tools.length) continue;
    rows.push({ role: turn.role === "user" ? "user" : "assistant", text: texts.join("\n\n").trim(), tools });
  }
  if (!rows.length) return "";
  const title = str(opts.title).trim() || "Study agent chat";
  const when = opts.date instanceof Date ? opts.date : new Date();
  const out = [`# ${title}`, "", `_${when.toISOString().slice(0, 10)}_`, ""];
  for (const row of rows) {
    out.push(row.role === "user" ? "## You" : "## Assistant", "", row.text, "");
    if (row.tools.length) out.push(...row.tools.map((tool) => `- _${tool}_`), "");
  }
  return `${out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}

/** A Windows-safe note name with local time, for the saved chat folder. */
function chatFileName(date) {
  const when = date instanceof Date ? date : new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `Study agent chat ${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())} ${pad(when.getHours())}${pad(when.getMinutes())}.md`;
}

module.exports = {
  MAX_MESSAGE_CHARS,
  MAX_MESSAGES,
  chatFileName,
  chatMarkdown,
  normalizeChatHistory,
};
