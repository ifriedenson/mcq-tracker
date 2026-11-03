"use strict";
/*
 * Insert a study-agent reply into the note the learner is editing.
 *
 * This only runs from an explicit button press. It never creates a note, never
 * changes frontmatter and never runs automatically after a model reply. When an
 * editor is available the reply goes in at the cursor (or replaces the current
 * selection). Otherwise the reply is appended to the active Markdown file.
 */
const { str } = require("./util");

function appendReply(current, reply) {
  const body = str(current);
  const text = str(reply).trim();
  if (!text) return body;
  const lead = !body.trim() ? "" : body.endsWith("\n\n") ? "" : body.endsWith("\n") ? "\n" : "\n\n";
  return `${body}${lead}${text}\n`;
}

async function insertReplyIntoNote(app, text) {
  const reply = str(text).trim();
  if (!reply) throw new Error("There is no reply to insert.");

  const workspace = app && app.workspace;
  const file =
    workspace && typeof workspace.getActiveFile === "function" ? workspace.getActiveFile() : null;
  if (!file || !str(file.path)) throw new Error("Open a note first, then insert the reply.");
  if (!/\.md$/i.test(str(file.path))) throw new Error("The active file is not a Markdown note.");

  const active = workspace.activeEditor;
  if (active && active.file && active.file.path === file.path && active.editor) {
    const editor = active.editor;
    if (typeof editor.replaceSelection === "function") {
      editor.replaceSelection(reply);
      return { path: file.path, mode: "cursor", chars: reply.length };
    }
    if (typeof editor.replaceRange === "function" && typeof editor.getCursor === "function") {
      editor.replaceRange(reply, editor.getCursor("from"), editor.getCursor("to"));
      return { path: file.path, mode: "cursor", chars: reply.length };
    }
  }

  const vault = app.vault;
  if (!vault || typeof vault.read !== "function" || typeof vault.modify !== "function") {
    throw new Error("Open the note in the editor so the reply can be inserted.");
  }
  const current = await vault.read(file);
  await vault.modify(file, appendReply(current, reply));
  return { path: file.path, mode: "append", chars: reply.length };
}

module.exports = { appendReply, insertReplyIntoNote };
