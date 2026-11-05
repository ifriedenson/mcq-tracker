"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { T, Plugin: QT } = load();
const mindmap = T.mindmap;

function fakeApp(files) {
  const map = new Map(Object.entries(files || {}));
  return {
    map,
    vault: {
      getAbstractFileByPath: (path) => (map.has(path) ? { path } : null),
      cachedRead: async (file) => map.get(file.path),
      readBinary: async () => new Uint8Array(0),
      create: async (path, text) => {
        map.set(path, text);
        return { path };
      },
      modify: async (file, text) => {
        map.set(file.path, text);
        return { path: file.path };
      },
    },
    workspace: { getActiveFile: () => null },
  };
}

test("mind map: headings and lists in any note become a tree", () => {
  const root = mindmap.mindmapFromMarkdown("# Cell respiration\n\nIntro text.\n\n## Glycolysis\n- Glucose\n  - Pyruvate\n## Krebs\n- Acetyl CoA\n");
  assert.equal(root.text, "Cell respiration");
  assert.deepEqual(root.children.map((node) => node.text), ["Glycolysis", "Krebs"]);
  assert.deepEqual(root.children[0].children.map((node) => node.text), ["Glucose"]);
  assert.deepEqual(root.children[0].children[0].children.map((node) => node.text), ["Pyruvate"], "an indented item is a child of the item above it");
  const plain = mindmap.mindmapFromMarkdown("- one\n- two\n");
  assert.equal(plain.text, "Mind map");
  assert.deepEqual(plain.children.map((node) => node.text), ["one", "two"]);
});

test("mind map: a Markmind note reads, edits and writes back in the same shape", async () => {
  const source = "---\nmindmap-plugin: basic\n---\n\n# Map\n\n- A\n  - A1\n- B\n";
  const plugin = Object.create(QT.prototype);
  plugin.app = fakeApp({ "map.md": source });
  const tree = await plugin.mindMapTree("map.md");
  assert.equal(tree.root.text, "Map");
  assert.deepEqual(tree.root.children.map((node) => node.text), ["A", "B"]);

  await plugin.mindMapEdit("map.md", "add", { parent: "A", text: "A2" });
  await plugin.mindMapEdit("map.md", "rename", { from: "B", to: "Bee" });
  await plugin.mindMapEdit("map.md", "move", { text: "A2", parent: "Bee" });
  const written = plugin.app.map.get("map.md");
  assert.match(written, /^---\nmindmap-plugin: basic\n---/);
  const reread = mindmap.parseMarkmind(written).root;
  assert.deepEqual(reread.children.map((node) => node.text), ["A", "Bee"]);
  assert.deepEqual(reread.children[0].children.map((node) => node.text), ["A1"]);
  assert.deepEqual(reread.children[1].children.map((node) => node.text), ["A2"]);

  await plugin.mindMapEdit("map.md", "remove", { text: "A1" });
  assert.deepEqual(mindmap.parseMarkmind(plugin.app.map.get("map.md")).root.children[0].children, []);
});

test("mind map: a plain note is upgraded to a Markmind map on its first edit", async () => {
  const plugin = Object.create(QT.prototype);
  plugin.app = fakeApp({ "bio.md": "# Photosynthesis\n\n- Light\n- Calvin cycle\n" });
  const result = await plugin.mindMapEdit("bio.md", "add", { parent: "Light", text: "Chlorophyll" });
  assert.equal(result.path, "bio.md");
  const written = plugin.app.map.get("bio.md");
  assert.ok(mindmap.isMarkmind(written), "the note becomes a Markmind board");
  assert.match(written, /Chlorophyll/);
});

test("mind map: an unknown action, a missing node or a missing note is refused", async () => {
  const plugin = Object.create(QT.prototype);
  plugin.app = fakeApp({ "map.md": "# Map\n\n- A\n" });
  await assert.rejects(plugin.mindMapEdit("map.md", "explode", {}), /Unknown mind-map action/);
  await assert.rejects(plugin.mindMapEdit("map.md", "add", { parent: "Nope", text: "X" }), /no node named/);
  await assert.rejects(plugin.mindMapEdit("missing.md", "add", { parent: "A", text: "X" }), /Open a Markdown note first/);
});

test("mind map: a new map note is written beside the note and never overwrites", async () => {
  const plugin = Object.create(QT.prototype);
  plugin.app = fakeApp({ "Courses/Bio.md": "# Bio\n\n## Cells\n- Membrane\n" });
  plugin.app.workspace.getActiveFile = () => ({ path: "Courses/Bio.md" });
  const target = await plugin.mindMapFromNote();
  assert.equal(target, "Courses/Bio (mind map).md");
  assert.ok(mindmap.isMarkmind(plugin.app.map.get(target)));
  assert.equal(await plugin.mindMapFromNote(), null, "an existing map is not overwritten");
  plugin.app.workspace.getActiveFile = () => ({ path: "notes.pdf" });
  assert.equal(await plugin.mindMapFromNote(), null);
});

test("mind map: the commands exist on the plugin", () => {
  for (const name of ["promptMindMap", "mindMapFromNote", "mindMapEdit", "mindMapTree"]) {
    assert.equal(typeof QT.prototype[name], "function", name + " is a plugin method");
  }
  for (const id of ["mindmap-add-child", "mindmap-rename", "mindmap-remove", "mindmap-move", "mindmap-from-note"]) {
    assert.equal(typeof id, "string");
  }
});
