"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();
const mentions = T.chatMentions;

test("mention tokens: parse, dedupe, cap and normalise note and folder paths", () => {
  assert.equal(mentions.normalizePath("./Biology//Cells.md"), "Biology/Cells.md");
  assert.equal(mentions.normalizePath("Biology/"), "Biology/");
  assert.equal(mentions.normalizePath("../Cells.md"), "");
  assert.equal(mentions.normalizePath(""), "");

  const note = mentions.normalizeMention({ path: "Biology/Cells.md" });
  assert.deepEqual(note, { kind: "note", path: "Biology/Cells.md", label: "Biology/Cells.md" });
  assert.equal(mentions.mentionToken(note), "@[[Biology/Cells.md]]");
  assert.equal(mentions.mentionToken({ kind: "folder", path: "Biology" }), "@[[Biology/]]");

  const text = "Compare @[[Biology/Cells.md]] with @[[Biology/Cells.md]] and @[[History/]]";
  const parsed = mentions.parseMentionTokens(text);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].kind, "note");
  assert.equal(parsed[1].kind, "folder");

  const many = Array.from({ length: 12 }, (_, i) => `@[[Note-${i}.md]]`).join(" ");
  assert.equal(mentions.parseMentionTokens(many).length, mentions.MAX_MENTION_TARGETS);
  assert.equal(mentions.MAX_MENTION_TARGETS, 8);
});

test("mention composer: finds the partial @query and inserts or removes one token", () => {
  const query = mentions.mentionQueryAt("Ask about @bio", 14);
  assert.deepEqual(query, { start: 10, end: 14, query: "bio" });
  assert.equal(mentions.mentionQueryAt("mail me@host", 12), null);
  assert.equal(mentions.mentionQueryAt("see @[[Biology/Cells.md]]", 26), null);

  const inserted = mentions.insertMentionToken("Look at @cel", 8, 12, { kind: "note", path: "Biology/Cells.md" });
  assert.equal(inserted, "Look at @[[Biology/Cells.md]]");
  assert.equal(mentions.insertMentionToken("Hi", 2, 2, { kind: "folder", path: "Biology" }), "Hi @[[Biology/]]");
  assert.equal(
    mentions.insertMentionToken(inserted, 0, 0, { kind: "note", path: "Biology/Cells.md" }),
    inserted,
    "a duplicate mention is not inserted twice"
  );
  assert.equal(
    mentions.removeMentionToken("Summarize @[[Biology/Cells.md]] today", { kind: "note", path: "Biology/Cells.md" }),
    "Summarize today"
  );
});

test("mention candidates: rank notes and derived folders, honour the query and the cap", () => {
  const files = ["Biology/Cells.md", "Biology/Genetics.md", "History/Notes.md"];
  const bio = mentions.mentionCandidates(files, [], "bio", 12);
  assert.ok(bio.some((row) => row.kind === "folder" && row.path === "Biology"));
  assert.ok(bio.some((row) => row.kind === "note" && row.path === "Biology/Cells.md"));
  assert.ok(!bio.some((row) => row.path === "History/Notes.md"));

  const cells = mentions.mentionCandidates(files, [], "cells", 12);
  assert.deepEqual(cells.map((row) => row.path), ["Biology/Cells.md"]);
  assert.equal(mentions.mentionCandidates(files, [], "", 2).length, 2);
  assert.ok(mentions.mentionCandidates(files, [], "", 12).length <= mentions.MAX_MENTION_CANDIDATES);
});

test("mention resolution: missing targets are reported, never silently dropped", async () => {
  const result = await mentions.resolveMentions(
    [
      { kind: "note", path: "Biology/Cells.md" },
      { kind: "note", path: "Biology/Gone.md" },
      { kind: "folder", path: "Missing" },
    ],
    {
      readNote: async (path) => {
        if (path !== "Biology/Cells.md") throw new Error("not found");
        return "Cells use ATP.";
      },
      listNotes: async () => {
        throw new Error("not found");
      },
    }
  );
  assert.equal(result.entries.length, 1);
  assert.match(result.block, /Cells use ATP\./);
  assert.equal(result.missing.length, 2);
  assert.equal(result.missing[0].path, "Biology/Gone.md");
  assert.equal(result.missing[1].kind, "folder");
  assert.deepEqual(mentions.emptyMentionResult(), { entries: [], missing: [], warnings: [], chars: 0, block: "" });
});

test("mention resolution: large notes and folders are bounded and reported", async () => {
  const big = "x".repeat(mentions.MAX_MENTION_NOTE_CHARS + 500);
  const result = await mentions.resolveMentions([{ kind: "note", path: "Big.md" }], {
    readNote: async () => big,
  });
  assert.equal(result.entries[0].chars, mentions.MAX_MENTION_NOTE_CHARS);
  assert.equal(result.entries[0].truncated, true);
  assert.ok(result.warnings.some((line) => /truncated/.test(line)));

  let read = 0;
  const files = Array.from({ length: 20 }, (_, i) => `Folder/Note-${i}.md`);
  const folder = await mentions.resolveMentions([{ kind: "folder", path: "Folder" }], {
    readNote: async () => {
      read += 1;
      return "short";
    },
    listNotes: async () => files,
  });
  assert.equal(read, mentions.MAX_FOLDER_NOTES);
  assert.equal(folder.entries.length, mentions.MAX_FOLDER_NOTES);

  let calls = 0;
  const capped = await mentions.resolveMentions(
    Array.from({ length: 4 }, (_, i) => ({ kind: "note", path: `Part-${i}.md` })),
    {
      readNote: async () => {
        calls += 1;
        return "y".repeat(mentions.MAX_MENTION_NOTE_CHARS);
      },
    }
  );
  assert.equal(calls, 2, "two notes fill the total attachment cap and the rest are skipped");
  assert.equal(capped.entries.length, 2);
  assert.equal(capped.chars, mentions.MAX_MENTION_TOTAL_CHARS);
  assert.ok(capped.warnings.some((line) => /character/.test(line)));
});

test("mention resolution: vault helpers read Markdown files and report deleted targets", async () => {
  const files = [{ path: "Biology/Cells.md", text: "Cells use ATP." }];
  const app = {
    vault: {
      getMarkdownFiles: () => files,
      getAbstractFileByPath: (path) => files.find((file) => file.path === path) || null,
      cachedRead: async (file) => file.text,
    },
  };
  const candidates = mentions.mentionCandidatesFromApp(app, "cells", 5);
  assert.equal(candidates[0].path, "Biology/Cells.md");

  const found = await mentions.resolveMentionsFromApp(app, [{ kind: "note", path: "Biology/Cells.md" }]);
  assert.equal(found.entries[0].text, "Cells use ATP.");

  files.length = 0;
  const deleted = await mentions.resolveMentionsFromApp(app, [{ kind: "note", path: "Biology/Cells.md" }]);
  assert.equal(deleted.entries.length, 0);
  assert.match(deleted.missing[0].reason, /not found|no longer/);
});
