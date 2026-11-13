"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { load } = require("./helpers/load");

const { T } = load();
const { parseQuickAdd, quickAddNote, quickAddTitle } = T.quickAdd;

const dir = path.join(__dirname, "..", "samples", "starter-pack");
const read = (name) => fs.readFileSync(path.join(dir, name), "utf8");

/* The paste window calls parseQuickAdd on exactly this text, so these tests drive the real path. */
const PACKS = [
  {
    file: "ap-world-history.txt",
    course: "AP World History: Modern",
    types: { mcq: 11, multi: 1, spr: 0 },
    keys: ["B", "A", "B", "B", "B", "B", "A", "B", "B", "A", "B", "A, C"],
  },
  {
    file: "sat-math.txt",
    course: "SAT",
    types: { mcq: 6, multi: 0, spr: 4 },
    keys: ["B", "B", "30", "46", "A", "7.5", "B", "45", "D", "B"],
  },
];

const parsed = Object.fromEntries(PACKS.map((pack) => [pack.file, parseQuickAdd(read(pack.file))]));

for (const pack of PACKS) {
  test(`the ${pack.file} pack parses through the quick-add importer with no issues`, () => {
    const result = parsed[pack.file];
    assert.deepEqual(result.issues, [], "every block in the shipped pack must be importable as written");
    assert.equal(result.items.length, pack.keys.length);
  });

  test(`the ${pack.file} pack keeps its formats, course and answer keys`, () => {
    const items = parsed[pack.file].items;
    const types = items.reduce((acc, item) => {
      acc[item.questionType] = (acc[item.questionType] || 0) + 1;
      return acc;
    }, {});
    for (const [type, count] of Object.entries(pack.types)) {
      if (count) assert.equal(types[type], count, `${type} count in ${pack.file}`);
      else assert.equal(types[type], undefined, `${pack.file} ships no ${type} items`);
    }
    assert.deepEqual(items.map((item) => item.answer), pack.keys, "the checked keys are unchanged");
    for (const item of items) {
      assert.equal(item.course, pack.course, `every question carries the course ${pack.course}`);
      assert.ok(item.skill, `skill is set: ${item.question}`);
      assert.ok(["easy", "medium", "hard"].includes(item.difficulty), `difficulty is set: ${item.question}`);
      assert.ok(item.explanation.length > 60, `the explanation lets a student check the key: ${item.question}`);
      if (item.choices.length) {
        for (const letter of item.answer.split(", ")) {
          const at = "ABCDEFGH".indexOf(letter);
          assert.ok(at >= 0 && at < item.choices.length, `answer letters are in range: ${item.question}`);
        }
      }
    }
  });

  test(`every ${pack.file} question becomes a note the plugin's own validator accepts`, async () => {
    for (const [index, item] of parsed[pack.file].items.entries()) {
      const text = quickAddNote(item, `STARTER-${String(index + 1).padStart(3, "0")}`);
      assert.match(text, /^---\n[\s\S]*?question_id: STARTER-\d{3}/);
      assert.match(text, /## Question\n\n\S/);
      assert.match(text, /## Answer\n\n> \[!answer\]- Reveal answer/);
      assert.ok(quickAddTitle(item.question).length > 0);
      const issues = await T.noteIssues(text, async () => true);
      assert.deepEqual(issues, [], `the note reads as a finished question: ${item.question}`);
    }
  });

  test(`the ${pack.file} pack is original and contains no duplicated question`, () => {
    const text = read(pack.file);
    const questions = parsed[pack.file].items.map((item) => item.question.toLowerCase().replace(/\s+/g, " "));
    assert.equal(new Set(questions).size, questions.length, "no duplicated question text");
    // The header names those sources to disclaim them; only the questions and explanations must not.
    const body = text.slice(text.search(/^Q: /m));
    assert.equal(body.length > 0, true, "the pack carries pasted blocks");
    assert.equal(/question bank|ap classroom|practice test|college board/i.test(body), false, "no question-bank source is named in the content itself");
  });
}

test("the AP pack uses the course name the plugin's AP resources already know", () => {
  const resources = fs.readFileSync(path.join(__dirname, "..", "src", "ap-resources.js"), "utf8");
  assert.ok(resources.includes('"AP World History: Modern"'), "the pack's course string matches src/ap-resources.js");
});

test("the two packs together cover every format the importer produces", () => {
  const all = [...PACKS.flatMap((pack) => parsed[pack.file].items)];
  const types = new Set(all.map((item) => item.questionType));
  assert.deepEqual([...types].sort(), ["mcq", "multi", "spr"]);
});

test("the format template documents the syntax the importer actually accepts", () => {
  const template = read("template.txt");
  const guide = template.split(/\n-{3,}\n/)[0].split("\n").filter((line) => !/^Q:/.test(line)).join("\n");
  assert.match(guide, /Ctrl\/Cmd\+P/);
  assert.match(guide, /A, C/);
  const samples = parseQuickAdd(template);
  assert.deepEqual(samples.issues, [], "the template's own examples import cleanly");
  assert.equal(samples.items.length, 3, "the template shows one MCQ, one short answer and one select-all");
});
