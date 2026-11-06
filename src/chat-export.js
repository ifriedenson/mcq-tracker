"use strict";
/*
 * Plain Markdown export for one saved conversation. The caller writes the text
 * through the ordinary Vault adapter; this module never opens a file, uploads
 * anything or creates a share link. Key-like text is redacted for the same
 * reason it is redacted in diagnostics.
 */
const { str } = require("./util");
const chatMemory = require("./chat-memory");

const MAX_TITLE = 120;

function exportFileName(title, now) {
  const stampValue = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  const date = new Date(stampValue);
  const pad = (value) => String(value).padStart(2, "0");
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const clean = str(title)
    .replace(/[\\/:*?"<>|#^[\]]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60)
    .replace(/^\.+|\.+$/g, "");
  return `${clean || "Conversation"} ${stamp}.md`;
}

/** Metadata header plus one heading per turn. Returns "" when there is nothing to export. */
function exportMarkdown(record) {
  const value = record && typeof record === "object" ? record : {};
  const messages = (Array.isArray(value.messages) ? value.messages : []).filter(
    (message) => message && (message.role === "user" || message.role === "assistant") && str(message.content).trim()
  );
  if (!messages.length) return "";
  const title = str(value.title).replace(/\s+/g, " ").trim().slice(0, MAX_TITLE) || "Study agent conversation";
  const exportedAt = new Date(Number(value.exportedAt) || Date.now());
  const lines = ["---", `title: ${JSON.stringify(title)}`, `exported: ${exportedAt.toISOString()}`];
  if (str(value.model).trim()) lines.push(`model: ${JSON.stringify(str(value.model).trim().slice(0, 200))}`);
  if (str(value.project).trim()) lines.push(`project: ${JSON.stringify(str(value.project).trim().slice(0, 60))}`);
  lines.push("exported_from: mcq-tracker", "---", "", `# ${title}`, "");
  for (const message of messages) {
    lines.push(`## ${message.role === "user" ? "You" : "Study agent"}`, "", chatMemory.redactSecrets(str(message.content)).trim(), "");
  }
  return lines.join("\n");
}

module.exports = {
  MAX_TITLE,
  exportFileName,
  exportMarkdown,
};
