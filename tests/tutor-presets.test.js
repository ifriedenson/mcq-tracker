"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();
const tutor = T.tutorPresets;

test("tutor roles: three stable presets and an unknown value falls back to private", () => {
  assert.deepEqual(tutor.TUTOR_ROLES.map((role) => role.id), ["private", "socratic", "language"]);
  assert.equal(tutor.normalizeTutorRole("SOCRATIC"), "socratic");
  assert.equal(tutor.normalizeTutorRole(" language "), "language");
  assert.equal(tutor.normalizeTutorRole("wizard"), "private");
  assert.equal(tutor.tutorRole("missing").id, "private");
  for (const role of tutor.TUTOR_ROLES) {
    assert.ok(role.label.length > 0, role.id);
    assert.ok(role.description.length > 0, role.id);
    assert.ok(role.prompt.length > 60, role.id);
  }
});

test("tutor commands: all seven commands parse, and unknown slash commands do not", () => {
  const ids = ["guide", "quiz", "confuse", "gap", "predict", "feynman", "mock"];
  assert.deepEqual(tutor.TUTOR_COMMANDS.map((command) => command.id), ids);
  for (const id of ids) {
    const parsed = tutor.parseTutorCommand(`/${id}`);
    assert.equal(parsed.id, id);
    assert.equal(parsed.command, `/${id}`);
    assert.ok(parsed.prompt.length > 20, id);
  }
  const withText = tutor.parseTutorCommand("/quiz fractions and decimals");
  assert.equal(withText.id, "quiz");
  assert.equal(withText.rest, "fractions and decimals");
  assert.equal(tutor.parseTutorCommand("/unknown"), null);
  assert.equal(tutor.parseTutorCommand("not a command"), null);
  assert.match(tutor.commandReference(), /\/feynman/);
});

test("AI context: the selected tutor role reaches the review and general system prompts", () => {
  const review = T.buildTutorContext(
    {
      fm: {},
      sections: { question: "What is 2 + 2?", choices: [], answer: "" },
      chosen: "B",
      correct: false,
      key: "A",
      seconds: 4,
      conf: 1,
    },
    "",
    ["Guessing", "Unsure", "Confident"],
    "tutor",
    "socratic"
  );
  assert.match(review, /Socratic tutor/);
  assert.match(review, /\/mock/);
  assert.match(review, /practice question/);

  const general = T.buildGeneralContext({ vault: { adapter: {} } }, "tutor", "language");
  assert.match(general, /friendly language partner/i);
  assert.match(general, /\/guide/);
});
