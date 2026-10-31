"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T } = load();
const V = T.vaultSearch;

const DOCS = [
  { path: "Biology/respiration.md", text: "# Respiration\n\nOxidative phosphorylation produces most ATP in the inner mitochondrial membrane. The electron transport chain builds a proton gradient." },
  { path: "Biology/osmosis.md", text: "# Osmosis\n\nWater crosses a semipermeable membrane from low to high solute concentration." },
  { path: "Chemistry/redox.md", text: "# Redox\n\nElectron transfer changes oxidation states; phosphorylation is not covered here." },
];

test("vault search: the block header parses and a bare line becomes the query", () => {
  const parsed = V.parseVaultSearchSource("Query: oxidative phosphorylation\nFolder: Biology\nLimit: 3\nHeadings: on");
  assert.equal(parsed.query, "oxidative phosphorylation");
  assert.equal(parsed.folder, "Biology");
  assert.equal(parsed.limit, 3);
  assert.equal(parsed.headingsOnly, true);

  const bare = V.parseVaultSearchSource("oxidative phosphorylation");
  assert.equal(bare.query, "oxidative phosphorylation");

  const empty = V.parseVaultSearchSource("Folder: Biology");
  assert.match(empty.issues.join(" "), /Query:/);
});

test("vault search: tokens drop stopwords and ranking prefers the best match", () => {
  assert.deepEqual(V.tokenize("The membrane and the gradient"), ["membrane", "gradient"]);
  const found = V.searchDocs(DOCS, "oxidative phosphorylation", { limit: 2 });
  assert.equal(found.results.length, 2);
  assert.equal(found.results[0].path, "Biology/respiration.md");
  assert.equal(found.scanned, 3);
  assert.ok(found.results[0].score > found.results[1].score);
});

test("vault search: folder filter and limit apply before ranking results are returned", () => {
  const onlyChemistry = V.searchDocs(DOCS, "phosphorylation", { folder: "Chemistry" });
  assert.deepEqual(onlyChemistry.results.map((result) => result.path), ["Chemistry/redox.md"]);

  const limited = V.searchDocs(DOCS, "membrane gradient electron", { limit: 1 });
  assert.equal(limited.results.length, 1);
  assert.equal(limited.results[0].path, "Biology/respiration.md");

  const none = V.searchDocs(DOCS, "quantum chromodynamics");
  assert.equal(none.results.length, 0);
  assert.match(none.issues.join(" "), /No note matched/);
});

test("vault search: snippets carry the matched term and an ellipsis when trimmed", () => {
  const long = `${"filler ".repeat(60)}oxidative phosphorylation happens here. ${"tail ".repeat(20)}`;
  const snippet = V.makeSnippet(long, ["oxidative"]);
  assert.match(snippet, /oxidative phosphorylation/);
  assert.match(snippet, /…/);
  assert.ok(snippet.length < 300);
});

test("vault search: the block renders cited results from the vault and the switch gates it", async () => {
  const app = makeApp([
    { path: "Biology/respiration.md", text: DOCS[0].text },
    { path: "Biology/osmosis.md", text: DOCS[1].text },
  ]);
  const plugin = { app, vaultSearchEnabled: () => true, settings: { vaultSearch: { enabled: true, limit: 5 } } };
  const dom = makeDom();
  await V.renderVaultSearchBlock(plugin, "Query: oxidative phosphorylation\nFolder: Biology", dom.root);
  const texts = dom.texts().join("\n");
  assert.match(texts, /\[\[Biology\/respiration\.md\]\]/);
  assert.match(texts, /proton gradient/);
  assert.match(texts, /local index, no network/);

  const off = makeDom();
  await V.renderVaultSearchBlock({ app, vaultSearchEnabled: () => false }, "Query: x", off.root);
  assert.match(off.texts().join(" "), /Vault search is off/);
});
