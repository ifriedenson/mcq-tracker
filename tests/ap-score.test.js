"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const ap = T.apScore;

function biologyScores() {
  return {
    mcq: { score: 50 },
    frq: { long1: 8, long2: 7, short1: 4, short2: 3, short3: 3, short4: 3 },
  };
}

test("AP score: 2027 profiles use the official section weights and point totals", () => {
  assert.equal(ap.AP_PROFILES.length, 8);
  const biology = ap.profileById("ap-biology");
  assert.equal(biology.sections.find((section) => section.id === "mcq").weight, 0.5);
  assert.equal(ap.sectionMax(biology.sections.find((section) => section.id === "frq")), 34);
  const calculus = ap.profileById("ap-calculus-ab");
  assert.equal(calculus.sections[0].max, 42);
  assert.equal(ap.sectionMax(calculus.sections[1]), 54);
  const language = ap.profileById("ap-english-language");
  assert.equal(language.sections[0].weight, 0.45);
  assert.equal(language.sections[1].weight, 0.55);
  const history = ap.profileById("ap-us-history");
  assert.equal(history.sections.reduce((sum, section) => sum + section.weight, 0), 1);

  // FRQ pilot courses added in 1.97.0.
  const world = ap.profileById("ap-world-history");
  assert.equal(world.sections.find((section) => section.id === "saq").weight, 0.2);
  assert.equal(ap.sectionMax(world.sections.find((section) => section.id === "dbq")), 7);
  assert.equal(ap.sectionMax(world.sections.find((section) => section.id === "leq")), 6);
  const chemistry = ap.profileById("ap-chemistry");
  assert.equal(chemistry.sections[0].max, 60);
  assert.equal(ap.sectionMax(chemistry.sections[1]), 46);
  const bc = ap.profileById("ap-calculus-bc");
  assert.equal(bc.sections[0].max, 42);
  assert.equal(ap.sectionMax(bc.sections[1]), 54);
  const statistics = ap.profileById("ap-statistics");
  assert.equal(statistics.sections[0].max, 42);
  assert.equal(ap.sectionMax(statistics.sections[1]), 40);
});

test("AP score: a complete Biology estimate uses weighted section percentages", () => {
  const result = ap.calculateApScore(ap.profileById("ap-biology"), biologyScores(), ap.DEFAULT_CUTOFFS);
  assert.equal(result.complete, true);
  assert.equal(result.composite, 82.8);
  assert.equal(result.estimated, 5);
  assert.deepEqual(result.range, [5, 5]);
  assert.equal(result.sections.find((section) => section.id === "frq").earned, 28);
  assert.equal(result.sections.find((section) => section.id === "frq").max, 34);
  assert.deepEqual(result.sections.find((section) => section.id === "frq").parts.map((part) => part.earned), [8, 7, 4, 3, 3, 3]);
});

test("AP score: missing sections stay incomplete instead of pretending zero", () => {
  const result = ap.calculateApScore(ap.profileById("ap-biology"), { mcq: { score: 50 } }, ap.DEFAULT_CUTOFFS);
  assert.equal(result.complete, false);
  assert.equal(result.composite, null);
  assert.equal(result.estimated, null);
  assert.equal(result.range, null);
  assert.equal(result.sections.find((section) => section.id === "frq").complete, false);
});

test("AP score: cut scores are bounded, validated and editable", () => {
  assert.deepEqual(ap.normalizeCutoffs({ 5: 90, 4: 80, 3: 70, 2: 60 }), { 5: 90, 4: 80, 3: 70, 2: 60 });
  assert.deepEqual(ap.normalizeCutoffs({ 5: 50, 4: 80, 3: 20, 2: 10 }), ap.DEFAULT_CUTOFFS);
  assert.deepEqual(ap.normalizeCutoffs({ 5: 120, 4: 62, 3: 50, 2: 38 }), { 5: 100, 4: 62, 3: 50, 2: 38 });
  assert.equal(ap.estimateScore(75, { 5: 75, 4: 62, 3: 50, 2: 38 }), 5);
  assert.equal(ap.estimateScore(74.9, { 5: 75, 4: 62, 3: 50, 2: 38 }), 4);
});

test("AP score: reverse planning says what the other section needs", () => {
  const profile = ap.profileById("ap-calculus-ab");
  const result = ap.requiredForTarget(profile, { mcq: { score: 30 } }, "4", ap.DEFAULT_CUTOFFS);
  const frq = result.requirements.find((item) => item.sectionId === "frq");
  assert.equal(result.cutoff, 62);
  assert.equal(frq.possible, true);
  assert.equal(frq.neededPercent, 52.6);
  assert.equal(frq.neededPoints, 28.4);
  assert.equal(frq.max, 54);
  const impossible = ap.requiredForTarget(profile, { mcq: { score: 0 } }, "5", { 5: 95, 4: 80, 3: 65, 2: 50 });
  assert.equal(impossible.requirements.find((item) => item.sectionId === "frq").possible, false);
});

test("AP score: the Reference tab renders the calculator and keeps partial estimates honest", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.reference.enabled = true;
  const view = new T.ReferenceView({ app }, plugin);
  view.app = app;
  const dom = makeDom();
  view.contentEl = dom.root;
  view.tab = "ap";
  view.render();
  assert.ok(dom.texts().includes("AP score"));
  assert.ok(dom.texts().includes("AP Biology"));
  assert.ok(dom.texts().includes("Practice cut scores"));
  assert.ok(dom.texts().includes("Incomplete estimate"));
  assert.ok(plugin.commands.some((command) => command.id === "open-ap-score"));
  assert.equal(typeof plugin.openApScore, "function");
});
