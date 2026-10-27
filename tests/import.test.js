"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, q } = require("./helpers/load");
const { T } = load();

const NOTE = (fm, extra) => `---
question_id: PDF-Q01
${fm}
question_type: mcq
choices: 4
answer: D
answer_source: pdf
explanation_source: pdf
---

## Question
Despite being cheap, ______ they are made.

## Answer Choices
- A. one
- B. two
- C. three
- D. four

## Answer
> [!answer]- Reveal answer
> **Correct Answer: D**
>
> Choice D is the best answer.

## My Notes
${extra || ""}`;
const STAMP = { model: "m", date: "2026-10-26" };

test("finalizeNote keeps the PDF's own id separate from the plugin's question_id", () => {
  const out = T.finalizeNote(NOTE("official_question_id: 37e5c794\nnumber: 1"), {}, "PREFIX-Q05", STAMP);
  const { fm } = T.parseNote(out);
  assert.equal(fm.question_id, "PREFIX-Q05");
  assert.equal(fm.official_question_id, "37e5c794");
});

test("older property names for the id are saved as official_question_id", () => {
  for (const key of ["source_question_id", "pdf_question_id", "original_id"]) {
    const { fm } = T.parseNote(T.finalizeNote(NOTE(`${key}: abc123`), {}, "X-Q01", STAMP));
    assert.equal(fm.official_question_id, "abc123", key);
    assert.equal(fm[key], undefined, key);
  }
});

test("test, section, domain and skill come from the PDF; difficulty is lower-cased", () => {
  const fmText = "test: SAT\nsection: Reading and Writing\ndomain: Standard English Conventions\nskill: Form, Structure, and Sense\ndifficulty: Hard";
  const { fm } = T.parseNote(T.finalizeNote(NOTE(fmText), {}, "X-Q01", STAMP));
  assert.equal(fm.test, "SAT");
  assert.equal(fm.section, "Reading and Writing");
  assert.equal(fm.domain, "Standard English Conventions");
  assert.equal(fm.skill, "Form, Structure, and Sense");
  assert.equal(fm.difficulty, "hard");
});

test("values typed in the import window win over the PDF", () => {
  const { fm } = T.parseNote(T.finalizeNote(NOTE("test: SAT\ndifficulty: Hard"), { test: "AP", difficulty: "easy" }, "X-Q01", STAMP));
  assert.equal(fm.test, "AP");
  assert.equal(fm.difficulty, "easy");
});

test("extra labelled values are kept, but tracking fields and lists are not", () => {
  const { fm } = T.parseNote(T.finalizeNote(NOTE("score_band: 6\nattempts: 99\nstreak: 7\nlong_list: [a, b]"), {}, "X-Q01", STAMP));
  assert.equal(fm.score_band, 6);
  assert.equal(fm.attempts, 0);
  assert.equal(fm.streak, 0);
  assert.equal(fm.long_list, undefined);
});

test("officialIdOf reads the new and the old names", () => {
  assert.equal(T.officialIdOf({ official_question_id: " a1 " }), "a1");
  assert.equal(T.officialIdOf({ source_question_id: "b2" }), "b2");
  assert.equal(T.officialIdOf({}), "");
  assert.equal(T.officialIdOf(null), "");
});

test("indexOfficialIds ignores a folder; findDuplicateIds spots repeats in the vault and within an import", () => {
  const vault = [
    q("Bank/old/Q1.md", { official_question_id: "aaa" }),
    q("Bank/new/Q1.md", { official_question_id: "bbb" }),
    q("Bank/old/Q2.md", {}),
  ];
  const idx = T.indexOfficialIds(vault, "Bank/new");
  assert.deepEqual([...idx.keys()], ["aaa"]);
  const dupes = T.findDuplicateIds(
    [
      { path: "Bank/new/Q1.md", id: "bbb" },
      { path: "Bank/new/Q2.md", id: "aaa" },
      { path: "Bank/new/Q3.md", id: "bbb" },
      { path: "Bank/new/Q4.md", id: "" },
    ],
    idx
  );
  assert.deepEqual(dupes, [
    { path: "Bank/new/Q2.md", id: "aaa", other: "Bank/old/Q1.md" },
    { path: "Bank/new/Q3.md", id: "bbb", other: "Bank/new/Q1.md" },
  ]);
});

test("noteIssues flags a missing answer, missing choices and a missing figure", async () => {
  const exists = async (link) => link === "Bank/images/ok.png";
  const good = NOTE("");
  assert.deepEqual(await T.noteIssues(good, exists), []);

  const noAnswer = good.replace("answer: D\n", "");
  assert.ok((await T.noteIssues(noAnswer, exists)).includes("No answer"));

  const noChoices = good.replace(/## Answer Choices[\s\S]*?(?=## Answer\n)/, "");
  assert.ok((await T.noteIssues(noChoices, exists)).includes("No answer choices"));

  // a fill-in question with a numeric answer and no choices is fine
  const spr = noChoices.replace("answer: D", "answer: 12").replace("question_type: mcq", "question_type: spr");
  assert.ok(!(await T.noteIssues(spr, exists)).includes("No answer choices"));

  const withFig = good.replace("## Answer Choices", "![[Bank/images/ok.png]]\n\n## Answer Choices");
  assert.deepEqual(await T.noteIssues(withFig, exists), []);
  const brokenFig = good.replace("## Answer Choices", "![[Bank/images/gone.png]]\n\n## Answer Choices");
  assert.ok((await T.noteIssues(brokenFig, exists)).includes("Missing figure"));
  const marker = good.replace("## Answer Choices", "[Figure not captured]\n\n## Answer Choices");
  assert.ok((await T.noteIssues(marker, exists)).includes("Missing figure"));
});

test("the saved import report lists each problem with links", () => {
  const issues = [
    { path: "Bank/new/Q1.md", problems: ["No answer"] },
    { path: "Bank/new/Q2.md", problems: ["No answer", "Missing figure"] },
  ];
  assert.deepEqual(T.groupIssues(issues), { "No answer": ["Bank/new/Q1.md", "Bank/new/Q2.md"], "Missing figure": ["Bank/new/Q2.md"] });
  const md = T.buildReportMarkdown("Bank/new", issues, [{ path: "Bank/new/Q3.md", id: "zzz", other: "Bank/old/Q9.md" }], "2026-10-26");
  assert.match(md, /^# Import report/);
  assert.match(md, /## No answer \(2\)/);
  assert.match(md, /\[\[Bank\/new\/Q2\|Q2\]\]/);
  assert.match(md, /## Missing figure \(1\)/);
  assert.match(md, /Same question ID as another note \(1\)/);
  assert.match(T.buildReportMarkdown("F", [], [], "d"), /Nothing needs a look/);
});
