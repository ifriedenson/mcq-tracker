"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

const { releaseCommandPaletteShortcut, stealsCommandPalette } = require("../src/hotkey-cleanup");

test("only an exact Ctrl/Cmd+P binding conflicts with the command palette", () => {
  assert.equal(stealsCommandPalette({ modifiers: ["Mod"], key: "P" }), true);
  assert.equal(stealsCommandPalette({ modifiers: ["Ctrl"], key: "p" }), true);
  assert.equal(stealsCommandPalette({ modifiers: ["Meta"], key: "P" }), true);
  assert.equal(stealsCommandPalette({ modifiers: ["Cmd"], key: "P" }), true);
  assert.equal(stealsCommandPalette({ modifiers: ["Ctrl", "Shift"], key: "P" }), false);
  assert.equal(stealsCommandPalette({ modifiers: ["Mod", "Alt"], key: "P" }), false);
  assert.equal(stealsCommandPalette({ modifiers: ["Mod"], key: "O" }), false);
  assert.equal(stealsCommandPalette({ modifiers: [], key: "P" }), false);
  assert.equal(stealsCommandPalette(null), false);
});

test("the cards command loses Ctrl+P and keeps its other bindings", () => {
  let saved = null;
  const app = {
    hotkeyManager: {
      getHotkeys(id) {
        assert.equal(id, "mcq-tracker:open-cards");
        return [
          { modifiers: ["Mod"], key: "P" },
          { modifiers: ["Mod"], key: "O" },
          { modifiers: ["Ctrl"], key: "p" },
          { modifiers: ["Ctrl", "Shift"], key: "P" },
        ];
      },
      setHotkeys(id, hotkeys) {
        saved = { id, hotkeys };
      },
    },
  };
  assert.equal(releaseCommandPaletteShortcut(app, "mcq-tracker:open-cards"), true);
  assert.deepEqual(saved, {
    id: "mcq-tracker:open-cards",
    hotkeys: [
      { modifiers: ["Mod"], key: "O" },
      { modifiers: ["Ctrl", "Shift"], key: "P" },
    ],
  });
});

test("the removeHotkeys API is preferred when available", () => {
  const removed = [];
  const app = {
    hotkeyManager: {
      getHotkeys: () => [{ modifiers: ["Mod"], key: "P" }],
      removeHotkeys(id, hotkeys) {
        removed.push({ id, hotkeys });
      },
      setHotkeys() {
        assert.fail("setHotkeys should not run when removeHotkeys succeeds");
      },
    },
  };
  assert.equal(releaseCommandPaletteShortcut(app, "mcq-tracker:open-cards"), true);
  assert.deepEqual(removed, [
    { id: "mcq-tracker:open-cards", hotkeys: [{ modifiers: ["Mod"], key: "P" }] },
  ]);
});

test("a missing hotkey manager and unrelated bindings are quiet no-ops", () => {
  assert.equal(releaseCommandPaletteShortcut({}, "mcq-tracker:open-cards"), false);
  assert.equal(releaseCommandPaletteShortcut(null, "mcq-tracker:open-cards"), false);
  assert.equal(
    releaseCommandPaletteShortcut(
      { hotkeyManager: { getHotkeys: () => [{ modifiers: ["Mod"], key: "O" }] } },
      "mcq-tracker:open-cards"
    ),
    false
  );
  assert.equal(
    releaseCommandPaletteShortcut({ hotkeyManager: { getHotkeys: () => null } }, "mcq-tracker:open-cards"),
    false
  );
});
