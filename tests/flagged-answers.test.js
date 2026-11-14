"use strict";
/*
 * The flagged-answers surface: every note the checker disagreed with, with
 * the stored answer, the checker's answer and votes, model and date. Open,
 * re-check, accept or drop — plus re-checking everything at once. The
 * frontmatter vocabulary never changes.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");
const { makeApp, makeDom, NOTE_TEXT } = require("./helpers/fake");

const { T, Plugin: QT } = load();

function note(id, answer, extraFm) {
  return {
    path: `Questions/${id}.md`,
    text: NOTE_TEXT(id, answer),
    fm: { question_id: id, answer, ...(extraFm || {}) },
  };
}

const FLAGGED = (answer) => ({
  verified: false,
  verification: "mismatch",
  verified_by: "M1 + M2",
  verified_on: "2026-01-01",
  verified_answer: answer,
  needs_review: true,
});
const VERIFIED = { verified: true, verification: "match", verified_by: "M", verified_on: "2026-01-01", verified_answer: "B" };

async function setup(files) {
  const app = makeApp(files);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "api";
  plugin.aiComplete = async () => '{"answer":"B"}';
  return { app, plugin };
}

/** All visible text under a fake-DOM root. */
function texts(el) {
  const out = [];
  const walk = (node) => {
    const own = node.__own;
    if (!own) return;
    if (typeof own.meta.text === "string" && own.meta.text) out.push(own.meta.text);
    for (const child of own.children || []) walk({ __own: child });
  };
  walk(el);
  return out;
}

/** Fire every click handler on buttons whose text contains the label. */
function click(el, label) {
  let fired = 0;
  const walk = (node) => {
    const own = node.__own;
    if (!own) return;
    if (typeof own.meta.text === "string" && own.meta.text.includes(label)) {
      for (const h of own.handlers || []) {
        if (h.ev === "click") {
          h.fn();
          fired++;
        }
      }
    }
    for (const child of own.children || []) walk({ __own: child });
  };
  walk(el);
  return fired;
}

async function openSurface(plugin, app) {
  const modal = new T.FlaggedAnswersModal(app, plugin);
  const dom = makeDom();
  modal.contentEl = dom.root;
  modal.modalEl = dom.root;
  modal.open();
  await modal.ready;
  return { modal, dom };
}

test("flagged answers: the palette command opens the surface", async () => {
  const { app, plugin } = await setup([note("Q01", "B", FLAGGED("A"))]);
  const command = plugin.commands.find((c) => c.id === "flagged-answers");
  assert.ok(command, "Show flagged answers is on the palette");
  const before = obsidian.modals.length;
  command.callback();
  const modal = obsidian.modals[obsidian.modals.length - 1];
  assert.ok(modal instanceof T.FlaggedAnswersModal, "the command opens the flagged surface");
  assert.equal(obsidian.modals.length, before + 1);
  modal.close();
  void app;
});

test("flagged answers: mismatches are listed with both answers and the voters", async () => {
  const { plugin } = await setup([
    note("Q01", "B", FLAGGED("A")),
    note("Q02", "B", VERIFIED),
    note("Q03", "B"),
  ]);
  const flagged = await plugin.flaggedAnswers();
  assert.equal(flagged.length, 1);
  assert.equal(flagged[0].path, "Questions/Q01.md");
  assert.match(flagged[0].question, /What is Q01/);
  assert.equal(flagged[0].stored, "B");
  assert.equal(flagged[0].answer, "A");
  assert.match(flagged[0].voters, /M1/);
  assert.equal(flagged[0].model, "M1 + M2");
});

test("flagged answers: the surface renders rows and accepts a stored answer", async () => {
  const { app, plugin } = await setup([note("Q01", "B", FLAGGED("A")), note("Q02", "C", FLAGGED("D"))]);
  const { modal, dom } = await openSurface(plugin, app);
  assert.ok(texts(dom.root).join(" ").includes("Q01"), "both flagged notes render");
  assert.equal(click(dom.root, "Accept stored"), 2, "each row has an accept button");
  await modal.ready;
  const file = app.vault.getAbstractFileByPath("Questions/Q01.md");
  assert.equal(file.fm.verified, true, "the stored answer stands");
  assert.equal(file.fm.verification, "match");
  assert.ok(!file.fm.needs_review, "the flag is cleared");
  assert.ok(!/Answer check failed/.test(file.text), "the banner is gone");
  assert.equal((await plugin.flaggedAnswers()).length, 1, "one disagreement is left");
  modal.close();
});

test("flagged answers: dropping moves the note to the trash", async () => {
  const { app, plugin } = await setup([note("Q01", "B", FLAGGED("A"))]);
  const { modal, dom } = await openSurface(plugin, app);
  assert.equal(click(dom.root, "Drop"), 1);
  await modal.ready;
  assert.deepEqual(app.trashed, ["Questions/Q01.md"]);
  assert.equal((await plugin.flaggedAnswers()).length, 0);
  modal.close();
});

test("flagged answers: re-checking asks the checker again and reports", async () => {
  const { app, plugin } = await setup([note("Q01", "B", FLAGGED("A"))]);
  const { modal, dom } = await openSurface(plugin, app);
  assert.equal(click(dom.root, "Re-check all"), 1);
  await modal.ready;
  const file = app.vault.getAbstractFileByPath("Questions/Q01.md");
  assert.equal(file.fm.verification, "match", "the checker now agrees with the note");
  assert.equal((await plugin.flaggedAnswers()).length, 0, "nothing is flagged any more");
  assert.match(texts(dom.root).join(" "), /nothing is flagged/i, "the empty surface says so");
  modal.close();
});
