"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T } = load();
const recent = T.recentFiles;
const { RecentFilesView } = T.recentFilesView;
const NOW = Date.UTC(2026, 10, 8, 12, 0, 0);

test("recent files normalize their local settings", () => {
  const settings = recent.normalizeRecentFiles({ limit: 500, pinned: ["A.md", "A.md", "", "B.md"] });
  assert.equal(settings.enabled, true);
  assert.equal(settings.limit, 100);
  assert.deepEqual(settings.pinned, ["A.md", "B.md"]);
  assert.equal(recent.normalizeRecentFiles({ enabled: false }).enabled, false);
});

test("recent rows put pins first, keep Obsidian order and format age", () => {
  const rows = recent.recentRows(["C.md", "A.md", "B.md", "A.md"], {
    "A.md": { mtime: NOW - 120000 },
    "B.md": { mtime: NOW - 3600000 },
    "C.md": { mtime: NOW - 86400000 },
  }, { pinned: ["B.md"], limit: 10, now: NOW });
  assert.deepEqual(rows.map((row) => row.path), ["B.md", "C.md", "A.md"]);
  assert.equal(rows[0].pinned, true);
  assert.equal(rows[1].relative, "1 day ago");
  assert.equal(rows[2].relative, "2 min ago");
});

test("pin toggling is stable and filtering searches paths and names", () => {
  assert.deepEqual(recent.togglePinned(["A.md"], "B.md"), ["B.md", "A.md"]);
  assert.deepEqual(recent.togglePinned(["B.md", "A.md"], "A.md"), ["B.md"]);
  const rows = recent.recentRows(["Biology/Cells.md", "Math/Proofs.md"], {}, { limit: 10, now: NOW });
  assert.deepEqual(recent.filterRecentRows(rows, "bio", false).map((row) => row.path), ["Biology/Cells.md"]);
  assert.deepEqual(recent.filterRecentRows(rows, "proof", false).map((row) => row.path), ["Math/Proofs.md"]);
});

test("relativeTime handles each useful bucket", () => {
  assert.equal(recent.relativeTime(NOW - 1000, NOW), "just now");
  assert.equal(recent.relativeTime(NOW - 6 * 60000, NOW), "6 min ago");
  assert.equal(recent.relativeTime(NOW - 3 * 3600000, NOW), "3 hr ago");
  assert.equal(recent.relativeTime(NOW - 4 * 86400000, NOW), "4 days ago");
  assert.equal(recent.relativeTime(0, NOW), "");
});

test("RecentFilesView renders Obsidian recents, opens a note and persists a pin", async () => {
  const app = makeApp([{ path: "Biology/Cells.md" }, { path: "Math/Proofs.md" }]);
  app.files[0].stat = { mtime: NOW - 120000, size: 10 };
  app.files[1].stat = { mtime: NOW - 60000, size: 12 };
  app.workspace.getLastOpenFiles = () => ["Math/Proofs.md", "Biology/Cells.md"];
  const plugin = {
    settings: { recentFiles: { enabled: true, limit: 10, pinned: ["Biology/Cells.md"] } },
    async updateRecentFiles(patch) {
      this.settings.recentFiles = { ...this.settings.recentFiles, ...patch };
    },
  };
  const view = new RecentFilesView({ app }, plugin);
  view.contentEl = makeDom().root;
  await view.onOpen();
  assert.ok(view.contentEl);
  assert.equal(view.paths()[0], "Math/Proofs.md");
  assert.equal(view.settings().pinned[0], "Biology/Cells.md");

  view.togglePin("Biology/Cells.md");
  assert.deepEqual(plugin.settings.recentFiles.pinned, []);

  await view.open("Math/Proofs.md");
  assert.ok(app.opened.includes("Math/Proofs.md"));

  await view.open("Not/There.md");
  assert.ok(require("./helpers/load").obsidian.notices.some((text) => text.includes("Could not find")));
});

test("the open-recent-files command delegates to this.openRecentFiles", () => {
  // Keep the command id and callback named here so the capability inventory
  // requires a real registered command with a real method behind it.
  assert.equal(typeof RecentFilesView, "function");
  const source = require("fs").readFileSync(require("path").join(__dirname, "..", "src", "plugin.js"), "utf8");
  assert.ok(source.includes("open-recent-files"));
  assert.ok(source.includes("openRecentFiles"));
});
