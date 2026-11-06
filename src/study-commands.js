"use strict";
/*
 * Reusable study commands, stored in the plugin's AI settings.
 *
 * A command is a name and a prompt. The prompt can ask for the selected text
 * with `{}` or `{selection}`, the active note with `{note}`, and its path with
 * `{path}`. Context is supplied only when the chat's own context switches
 * allow it; a command is never a second, hidden way to read the vault.
 */
const { str } = require("./util");

const MAX_STUDY_COMMANDS = 40;
const MAX_COMMAND_NAME = 48;
const MAX_COMMAND_PROMPT = 2000;

const STARTER_STUDY_COMMANDS = [
  {
    name: "Explain simply",
    prompt: "Explain {} in plain language. Give one concrete example, then ask me one short check question.",
  },
  {
    name: "Quiz me",
    prompt: "Write three short questions about {}. Do not reveal the answers until I ask for them.",
  },
  {
    name: "Make cards",
    prompt: "Turn {} into five flashcards. For each, write Front and Back on its own line. Keep the wording concise.",
  },
  {
    name: "Find gaps",
    prompt: "Read {}. Name the two ideas a learner is most likely to confuse, then give one check question for each.",
  },
];

function slug(value) {
  return str(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function normalizeStudyCommand(raw) {
  const item = raw && typeof raw === "object" ? raw : {};
  const name = str(item.name).replace(/\s+/g, " ").trim().slice(0, MAX_COMMAND_NAME);
  const prompt = str(item.prompt).trim().slice(0, MAX_COMMAND_PROMPT);
  if (!name || !prompt) return null;
  return {
    id: slug(item.id || name) || "command",
    name,
    prompt,
  };
}

function normalizeStudyCommands(value) {
  const out = [];
  const ids = new Set();
  const names = new Set();
  for (const raw of Array.isArray(value) ? value : []) {
    const command = normalizeStudyCommand(raw);
    if (!command || names.has(command.name.toLowerCase())) continue;
    let id = command.id;
    let suffix = 2;
    while (ids.has(id)) {
      id = `${command.id}-${suffix}`;
      suffix += 1;
    }
    ids.add(id);
    names.add(command.name.toLowerCase());
    out.push({ ...command, id });
    if (out.length >= MAX_STUDY_COMMANDS) break;
  }
  return out;
}

function studyCommandById(value, id) {
  const wanted = str(id).trim().toLowerCase();
  if (!wanted) return null;
  return normalizeStudyCommands(value).find((command) => command.id === wanted) || null;
}

function studyCommandsText(value) {
  return normalizeStudyCommands(value)
    .map((command) => `${command.name} | ${command.prompt}`)
    .join("\n");
}

/** One command per line: `Name | Prompt`. The first pipe is the separator. */
function parseStudyCommandsText(text) {
  const rows = [];
  for (const line of str(text).split(/\r?\n/)) {
    const raw = line.trim();
    if (!raw) continue;
    const at = raw.indexOf("|");
    if (at < 0) continue;
    rows.push({ name: raw.slice(0, at), prompt: raw.slice(at + 1) });
  }
  return normalizeStudyCommands(rows);
}

function commandUsesContext(command) {
  return /\{\}|\{selection\}|\{note\}|\{activeNote\}|\{path\}/i.test(str(command && command.prompt));
}

/**
 * Expand one command. Unknown tokens are left alone on purpose: a prompt may
 * contain ordinary braces, and silently eating them would change its meaning.
 */
function applyStudyCommand(command, context) {
  const cmd = normalizeStudyCommand(command);
  if (!cmd) return "";
  const ctx = context && typeof context === "object" ? context : {};
  const note = str(ctx.note || ctx.text);
  const selection = str(ctx.selection);
  const fallback = selection || note;
  const expanded = cmd.prompt
    .replace(/\{\}/g, fallback)
    .replace(/\{selection\}/gi, selection)
    .replace(/\{(?:activeNote|note)\}/gi, note)
    .replace(/\{path\}/gi, str(ctx.path));
  const extra = str(ctx.extra).trim();
  return [expanded.trim(), extra].filter(Boolean).join("\n\n");
}

/** Parse `/command-name optional extra instruction` without executing anything. */
function parseStudyCommand(text, commands) {
  const raw = str(text).trim();
  const match = /^\/([a-z0-9][a-z0-9-]*)\b(?:\s+([\s\S]*))?$/i.exec(raw);
  if (!match) return null;
  const command = studyCommandById(commands, match[1]);
  if (!command) return null;
  return {
    command,
    prompt: `/${command.id}`,
    name: command.name,
    rest: str(match[2]).trim(),
  };
}

module.exports = {
  MAX_STUDY_COMMANDS,
  MAX_COMMAND_NAME,
  MAX_COMMAND_PROMPT,
  STARTER_STUDY_COMMANDS,
  normalizeStudyCommand,
  normalizeStudyCommands,
  studyCommandById,
  studyCommandsText,
  parseStudyCommandsText,
  commandUsesContext,
  applyStudyCommand,
  parseStudyCommand,
};
