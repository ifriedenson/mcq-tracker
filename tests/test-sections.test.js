"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();
const S = T.testSections;

test("sections keep the requested totals and split into sequential bounds", () => {
  const items = Array.from({ length: 6 }, (_v, i) => ({ path: `Q/${i}.md` }));
  const sections = S.buildSections(
    items,
    [
      { name: "Reading", count: 2, minutes: 4 },
      { name: "Writing", count: 4, minutes: 8 },
    ],
    1000000
  );
  assert.deepEqual(sections.map((x) => [x.name, x.count, x.start, x.end]), [
    ["Reading", 2, 0, 2],
    ["Writing", 4, 2, 6],
  ]);
  assert.deepEqual(sections.map((x) => x.endAt), [1240000, 1720000]);
  assert.deepEqual(items.map((x) => x.section), [0, 0, 1, 1, 1, 1]);
  assert.equal(S.sectionAt(sections, 4), 1);
});

test("a short pool shrinks later sections but keeps their names", () => {
  const items = Array.from({ length: 3 }, (_v, i) => ({ path: `Q/${i}.md` }));
  const sections = S.buildSections(
    items,
    [
      { name: "One", count: 2, minutes: 5 },
      { name: "Two", count: 2, minutes: 5 },
    ],
    0
  );
  assert.deepEqual(sections.map((x) => [x.name, x.count]), [["One", 2], ["Two", 1]]);
  assert.equal(items[2].section, 1);
});

test("totals are fitted when the section recipe does not add up", () => {
  const list = S.normalizeSections(
    [
      { name: "A", count: 9, minutes: 2 },
      { name: "B", count: 9, minutes: 2 },
    ],
    10,
    15
  );
  assert.equal(list.reduce((n, s) => n + s.count, 0), 10);
  assert.equal(list.reduce((n, s) => n + s.minutes, 0), 15);
  assert.ok(list.every((s) => s.count >= 1 && s.minutes >= 1));
});

test("a section can never have zero questions or zero minutes", () => {
  const list = S.normalizeSections([{ name: "", count: 0, minutes: 0 }], 1, 1);
  assert.deepEqual(list, [{ name: "Section 1", count: 1, minutes: 1 }]);
});

test("blueprints are cleaned and rebuilt from saved settings", () => {
  const bp = S.normalizeBlueprint({
    name: "  Reading/Writing  ",
    count: 6,
    minutes: 10,
    from: 0,
    to: -2,
    mode: "wrong",
    sections: [
      { name: "Reading", count: 3, minutes: 4 },
      { name: "Writing", count: 3, minutes: 6 },
    ],
  });
  assert.equal(bp.name, "Reading/Writing");
  assert.equal(bp.from, 1);
  assert.equal(bp.to, 0);
  assert.equal(bp.mode, "wrong");
  assert.equal(bp.sections.length, 2);
  assert.equal(bp.shuffleChoices, false);
  assert.equal(bp.passScore, 0);
  assert.equal(S.normalizeBlueprint({ name: "" }), null);
  const gated = S.normalizeBlueprint({ name: "Gate", count: 4, minutes: 20, shuffleChoices: true, passScore: 105 });
  assert.equal(gated.shuffleChoices, true);
  assert.equal(gated.passScore, 100);
  assert.equal(S.normalizeBlueprint({ name: "No gate", passScore: -3 }).passScore, 0);
});

test("blueprints keep an FRQ count", () => {
  const bp = S.normalizeBlueprint({ name: "Mixed", count: 4, minutes: 20, frq: 1, sections: [{ name: "One", count: 4, minutes: 20 }] });
  assert.equal(bp.frq, 1);
  const none = S.normalizeBlueprint({ name: "Objective", count: 4, minutes: 20, frq: 99 });
  assert.equal(none.frq, 20);
});
