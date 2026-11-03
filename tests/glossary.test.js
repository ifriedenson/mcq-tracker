"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");
const { T, Plugin: QT } = load();

const G = T.glossary;

const NOTE = [
  "---",
  "term: not a glossary line",
  "---",
  "# Vocabulary",
  "Osmosis: movement of water across a membrane",
  "- ATP: energy currency of the cell",
  "| Term | Meaning |",
  "| --- | --- |",
  "| Enzyme | A protein that speeds up a reaction |",
  "Note:",
  "Read https://example.com: not a term",
  "```",
  "Fake: inside a fence is skipped",
  "```",
  "",
].join("\n");

test("glossary: reads definition lines and table rows, skipping fences and frontmatter", () => {
  const rows = G.glossaryLines(NOTE);
  assert.deepEqual(rows.map((row) => [row.line, row.term]), [
    [5, "Osmosis"],
    [6, "ATP"],
    [9, "Enzyme"],
  ]);
  assert.equal(rows[0].definition, "movement of water across a membrane");
  assert.equal(rows.some((row) => row.term === "Fake"), false, "fenced examples are not definitions");
  assert.equal(G.glossaryLines("- [ ] Osmosis: a checkbox is not a definition").length, 0);
  assert.equal(G.glossaryLines("**Bold term**: a definition").length, 1, "emphasis is stripped");
  assert.equal(G.glossaryLines("Term:").length, 0, "a bare label is not a definition");
});

test("glossary: dedupes, filters by folder and reports what it read", () => {
  const entries = [
    { path: "Biology/cells.md", text: NOTE },
    { path: "Biology/more.md", text: "Osmosis: the same term again\nPhotosynthesis: light into sugar\n" },
    { path: "Other/notes.txt", text: "Osmosis: not markdown" },
    { path: "Chem/reactions.md", text: "Catalyst: speeds a reaction\n" },
  ];
  const all = G.collectGlossary(entries, {});
  assert.deepEqual(all.entries.map((row) => row.term), ["ATP", "Catalyst", "Enzyme", "Osmosis", "Photosynthesis"]);
  assert.equal(all.stats.terms, 5);
  assert.equal(all.stats.files, 3);
  assert.equal(all.stats.duplicates, 1);
  assert.equal(all.entries.find((row) => row.term === "Osmosis").path, "Biology/cells.md", "the first definition wins");

  const folder = G.collectGlossary(entries, { folder: "/Chem/" });
  assert.deepEqual(folder.files, ["Chem/reactions.md"]);
  assert.deepEqual(folder.entries.map((row) => row.term), ["Catalyst"]);

  const limited = G.collectGlossary(entries, { limit: 2 });
  assert.equal(limited.entries.length, 2);
  assert.equal(limited.truncated, true);
  assert.equal(limited.stats.shown, 2);
  assert.deepEqual(G.normalizeGlossaryOptions({ limit: 9999, folder: "/Biology/" }), { folder: "Biology", limit: G.MAX_LIMIT });
  assert.equal(G.normalizeGlossaryOptions({}).limit, G.DEFAULT_LIMIT);
});

test("glossary: lookup ranks an exact term, then a prefix, then a match inside", () => {
  const entries = [
    { term: "Osmosis", definition: "water across a membrane" },
    { term: "Osmotic pressure", definition: "pressure from water movement" },
    { term: "Diffusion", definition: "osmosis without a membrane" },
  ];
  assert.deepEqual(G.lookupGlossary(entries, "osmo").map((row) => row.term), ["Osmosis", "Osmotic pressure", "Diffusion"]);
  assert.deepEqual(G.lookupGlossary(entries, "osmotic pressure").map((row) => row.term), ["Osmotic pressure"]);
  assert.equal(G.lookupGlossary(entries, "").length, 3);
  assert.equal(G.lookupGlossary(entries, "nothing").length, 0);
  assert.equal(G.lookupGlossary(null, "osmo").length, 0);
});

test("glossary: the plugin scans read-only and the Vocabulary tab looks a term up", async () => {
  const app = makeApp([]);
  app.vault.getMarkdownFiles = () => [{ path: "Biology/cells.md", text: NOTE }];
  app.vault.cachedRead = async (file) => file.text;
  let writes = 0;
  app.vault.create = async () => {
    writes += 1;
    return { path: "unexpected.md" };
  };
  app.vault.modify = async () => {
    writes += 1;
  };
  const plugin = new QT(app);
  await plugin.onload();
  const data = await plugin.scanGlossary();
  assert.deepEqual(data.entries.map((row) => row.term), ["ATP", "Enzyme", "Osmosis"]);
  assert.equal(writes, 0);

  const dom = makeDom();
  const view = new T.StudyWorkspaceView({ app }, plugin);
  view.contentEl = dom.root;
  view.tab = "vocabulary";
  view.glossaryData = data;
  view.render();
  const texts = dom.texts();
  assert.ok(texts.some((text) => text.includes("Glossary from your notes")));
  assert.ok(texts.includes("Osmosis"));
  assert.ok(texts.some((text) => text.includes("Biology/cells.md:5")));
  assert.ok(texts.includes("Open note"));
  assert.equal(writes, 0);
});
