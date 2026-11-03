"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");
const { T, Plugin: QT } = load();

const V = T.vaultTaskIndex;

const NOTE = [
  "# Chapter 3",
  "- [ ] read chapter 3",
  "  - [x] take notes #biology",
  "* [ ] practice problems",
  "```",
  "- [ ] inside a fence is not a task",
  "```",
  "1. [ ] numbered item",
  "- [x] done thing",
  "",
].join("\n");

test("vault task index: reads checkbox lines and skips fenced code", () => {
  const result = V.collectVaultTasks([{ path: "Notes/bio.md", text: NOTE }, { path: "Notes/other.txt", text: "- [ ] no" }], {});
  assert.equal(result.rows.length, 5);
  assert.deepEqual(result.rows.map((row) => row.done), [false, true, false, false, true]);
  assert.equal(result.rows[0].line, 2);
  assert.equal(result.rows[0].path, "Notes/bio.md");
  assert.deepEqual(result.rows[1].tags, ["biology"]);
  assert.equal(result.stats.files, 1);
  assert.equal(result.stats.open, 3);
  assert.equal(result.stats.done, 2);
  assert.equal(result.rows.some((row) => row.text.includes("inside a fence")), false);
  assert.equal(V.checkboxLines("- [ ]  ").length, 0, "an empty label is not a task");
  assert.deepEqual(V.tagsIn("plain #one and `#code` then #two/three"), ["one", "two/three"]);
});

test("vault task index: options limit, filter by folder and open state", () => {
  const entries = [
    { path: "Notes/bio.md", text: NOTE },
    { path: "Projects/plan.md", text: "- [ ] ship the draft\n" },
  ];
  const openOnly = V.collectVaultTasks(entries, { openOnly: true });
  assert.equal(openOnly.rows.length, 4);
  assert.equal(openOnly.rows.every((row) => row.done === false), true);
  const folder = V.collectVaultTasks(entries, { folder: "/Projects/" });
  assert.deepEqual(folder.files, ["Projects/plan.md"]);
  assert.equal(folder.rows.length, 1);
  const limited = V.collectVaultTasks(entries, { limit: 2 });
  assert.equal(limited.rows.length, 2);
  assert.equal(limited.truncated, true);
  assert.deepEqual(V.normalizeVaultTaskIndexOptions({ limit: 9999, folder: "/Notes/" }), { openOnly: false, folder: "Notes", limit: V.MAX_LIMIT });
  assert.equal(V.normalizeVaultTaskIndexOptions({}).limit, V.DEFAULT_LIMIT);
});

test("vault task index: the filter matches text, tag and note path", () => {
  const rows = V.collectVaultTasks([{ path: "Notes/bio.md", text: NOTE }], {}).rows;
  assert.equal(V.filterVaultTasks(rows, "chapter").length, 1);
  assert.equal(V.filterVaultTasks(rows, "#biology").length, 1);
  assert.equal(V.filterVaultTasks(rows, "bio.md").length, 5);
  assert.equal(V.filterVaultTasks(rows, "").length, 5);
  assert.equal(V.filterVaultTasks(rows, "nothing here").length, 0);
});

test("vault task index: the plugin scans read-only and the Tasks tab lists it", async () => {
  const app = makeApp([]);
  app.vault.getMarkdownFiles = () => [{ path: "Notes/bio.md", text: NOTE }];
  app.vault.cachedRead = async (file) => file.text;
  let writes = 0;
  app.vault.create = async () => {
    writes += 1;
    return { path: "unexpected.md" };
  };
  const plugin = new QT(app);
  await plugin.onload();
  const result = await plugin.scanVaultTasks({ openOnly: true });
  assert.equal(result.rows.length, 3);
  assert.equal(writes, 0);

  const view = new T.StudyWorkspaceView({ app }, plugin);
  const dom = makeDom();
  view.contentEl = dom.root;
  view.tab = "tasks";
  view.vaultTaskData = result;
  view.render();
  const texts = dom.texts();
  assert.ok(texts.some((text) => text.includes("Vault checklist")));
  assert.ok(texts.some((text) => text.includes("read chapter 3")));
  assert.ok(texts.some((text) => text === "Open note"));
  assert.equal(writes, 0);
});
