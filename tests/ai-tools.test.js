"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const tools = T.aiTools;

test("ai tools: only allow-listed actions parse from fenced blocks", () => {
  const reply = [
    "Here is a question.",
    "```mcqtool",
    JSON.stringify({ tool: "create_question", question: "What is 2 + 2?", choices: ["3", "4", "5", "6"], answer: "B", explanation: "Two and two make four.", skill: "Arithmetic", difficulty: "easy" }),
    "```",
    "```mcqtool",
    JSON.stringify({ tool: "create_card", front: "Mitochondria", back: "Produces ATP", deck: "Biology" }),
    "```",
    "```mcqtool",
    JSON.stringify({ tool: "delete_note", path: "Questions/x.md" }),
    "```",
  ].join("\n");
  const parsed = tools.parseToolProposals(reply);
  assert.equal(parsed.proposals.length, 2);
  assert.equal(parsed.proposals[0].tool, "create_question");
  assert.equal(parsed.proposals[0].answer, "B");
  assert.equal(parsed.proposals[1].tool, "create_card");
  assert.equal(parsed.errors.length, 1);
  assert.match(parsed.errors[0], /Unknown tool/);
});

test("ai tools: answer text resolves to its choice letter and unsafe actions are rejected", () => {
  const parsed = tools.normalizeProposal({ tool: "create_question", question: "Which gas do plants take in?", choices: ["Oxygen", "Carbon dioxide"], answer: "Carbon dioxide" });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.proposal.answer, "B");
  assert.equal(tools.normalizeProposal({ tool: "update_section", path: "Notes/x.md", heading: "Frontmatter", content: "x" }).ok, false);
  assert.equal(tools.normalizeProposal({ tool: "create_card", front: "Only a front" }).ok, false);
});

test("ai tools: replaceSection changes one body section and leaves the rest alone", () => {
  const text = "---\nquestion_id: q1\n---\n\n## Question\nOld?\n\n## My Notes\nOld note\n\n## Answer\n> **Correct Answer: A**\n";
  const next = tools.replaceSection(text, "My Notes", "A new note.");
  assert.match(next, /## My Notes\n\nA new note\./);
  assert.match(next, /## Question\nOld\?/);
  assert.match(next, /## Answer\n> \*\*Correct Answer: A\*\*/);
  assert.equal(next.includes("Old note"), false);
  assert.throws(() => tools.replaceSection(text, "Frontmatter", "x"), /not allowed/);
});

test("plugin: Direct AI proposals apply only the checked allow-listed action", async () => {
  const app = makeApp([{ path: "Questions/q1.md", fm: { answer: "A", next_review: "2026-12-01" } }]);
  const plugin = new QT(app);
  await plugin.onload();
  const result = await plugin.applyByokToolProposals([
    { tool: "update_section", path: "Questions/q1.md", heading: "My Notes", content: "Remember the units." },
  ]);
  assert.equal(result.updated, 1);
  assert.equal(result.created, 0);
  assert.match(app.files[0].text, /Remember the units\./);
});

test("plugin: a Direct AI question proposal writes a normal practice note", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  const result = await plugin.applyByokToolProposals([
    { tool: "create_question", question: "What is the capital of France?", choices: ["Paris", "Rome"], answer: "A", explanation: "Paris is the capital.", course: "Geography", difficulty: "easy" },
  ]);
  assert.equal(result.created, 1);
  assert.equal(app.created.length, 1);
  assert.match(app.created[0].path, /^Questions\//);
  assert.match(app.created[0].text, /question_id:/);
  assert.match(app.created[0].text, /Correct Answer: A/);
});
