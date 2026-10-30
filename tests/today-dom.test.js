"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();

const NOTES = [{ path: "Questions/a.md", fm: { answer: "B" } }];

/** Read the named container-query blocks with a brace-aware scan. */
function containerBlocks(css) {
  const blocks = [];
  const opener = /@container qt-today \((min|max)-width:\s*([\d.]+)px\)\s*\{/g;
  let match;
  while ((match = opener.exec(css))) {
    let depth = 1;
    let at = opener.lastIndex;
    while (at < css.length && depth > 0) {
      if (css[at] === "{") depth++;
      else if (css[at] === "}") depth--;
      at++;
    }
    blocks.push({ mode: match[1], width: Number(match[2]), body: css.slice(opener.lastIndex, at - 1) });
    opener.lastIndex = at;
  }
  return blocks;
}

/**
 * Resolve the matching container rules in source order and derive the visible
 * widget columns. This mirrors the narrow part of CSS cascade the layout uses.
 */
function columnsAt(css, width) {
  let columns = 12;
  let span = 4;
  let single = false;
  for (const block of containerBlocks(css)) {
    if (block.mode === "min" && width < block.width) continue;
    if (block.mode === "max" && width > block.width) continue;
    const grid = block.body.match(/\.qt-today-grid\s*\{([^}]*)\}/);
    if (grid) {
      const value = (grid[1].match(/grid-template-columns:\s*([^;]+);/) || [])[1] || "";
      const repeat = value.match(/repeat\((\d+)/);
      columns = repeat ? Number(repeat[1]) : 1;
      single = !repeat;
    }
    const panel = block.body.match(/\.qt-today-panel(?:[^{]*)\{([^}]*)\}/);
    if (panel) {
      const value = (panel[1].match(/grid-column:\s*span\s+(\d+)/) || [])[1];
      if (value) span = Number(value);
      else if (/grid-column:\s*1\b/.test(panel[1])) single = true;
    }
  }
  return single ? 1 : Math.floor(columns / span);
}

async function mountedToday() {
  const app = makeApp(NOTES);
  const plugin = new QT(app);
  await plugin.onload();
  const dom = makeDom();
  const view = new T.TodayView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  await view.onOpen();
  return { app, plugin, dom, view };
}

test("today: the mounted view fills the pane and uses pane-width container columns", async () => {
  const { dom } = await mountedToday();

  assert.ok(dom.root.hasClass("qt-root"), "the Today content element keeps the shared root class");
  assert.ok(dom.root.hasClass("qt-root-today"), "the Today content element is the container root");

  const grid = dom.all.find((el) => el.meta && String(el.meta.cls || "").split(/\s+/).includes("qt-today-grid"));
  assert.ok(grid, "the mounted view renders the widget grid");
  assert.equal(grid.parent && grid.parent.classes.has("qt-today"), true, "the grid is inside the Today wrapper");
  assert.equal(
    grid.parent && grid.parent.parent && grid.parent.parent.classes.has("qt-root-today"),
    true,
    "the container root is an ancestor of the grid"
  );
  assert.notEqual(grid, dom.root.__own, "the container is not the queried element itself");

  const css = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");
  const root = (css.match(/\.qt-root\.qt-root-today \{[^}]*\}/) || [])[0] || "";
  assert.match(root, /container-name:\s*qt-today/);
  assert.match(root, /container-type:\s*inline-size/);
  assert.match(root, /max-width:\s*none/);
  assert.match(root, /width:\s*100%/);

  const blocks = containerBlocks(css);
  assert.equal(blocks.length, 4, "four container-query blocks are shipped");
  for (const block of blocks) {
    assert.ok(!/\.qt-root/.test(block.body), "container rules target descendants, not the container root");
  }

  assert.equal(columnsAt(css, 1500), 4);
  assert.equal(columnsAt(css, 1200), 3);
  assert.equal(columnsAt(css, 800), 2);
  assert.equal(columnsAt(css, 600), 1);

  assert.ok(css.includes("@supports not (container-type: inline-size)"), "window media rules are only a guarded fallback");
});
