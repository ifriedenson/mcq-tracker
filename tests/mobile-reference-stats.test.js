"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const css = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");

const hasClass = (own, cls) => !!(own.classes && own.classes.has(cls));
const cellsWithLabels = (row) =>
  row.children.filter((child) => child.meta && child.meta.attrs && child.meta.attrs["data-label"]);

test("reference: the periodic table sits inside a horizontal scroll region", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.reference.enabled = true;
  const view = new T.ReferenceView({ app }, plugin);
  const dom = makeDom();
  view.contentEl = dom.root;
  view.tab = "elements";
  view.render();

  const wrap = dom.all.find((own) => hasClass(own, "qt-ref-periodic-wrap"));
  const grid = dom.all.find((own) => hasClass(own, "qt-ref-periodic"));
  assert.ok(wrap, "the periodic table needs a scroll wrapper");
  assert.ok(grid, "the periodic grid still renders");
  assert.equal(grid.parent, wrap, "the grid should be the wrapper's child");
  const attrs = wrap.meta.attrs || wrap.meta.attr || {};
  assert.equal(attrs.role, "region");
  assert.match(attrs["aria-label"], /scroll horizontally/i);
  assert.ok(dom.all.some((own) => hasClass(own, "qt-ref-element")), "element cells still render");
});

test("reference: narrow panes use a swipe rail and readable periodic cells", () => {
  assert.match(css, /\.qt-ref-periodic-wrap \{[^}]*overflow-x: auto/s);
  assert.match(
    css,
    /@container qt-screen \(max-width: 460px\) \{[\s\S]*?\.qt-screen \.qt-ref-tabs \{[^}]*display: flex;[^}]*flex-wrap: nowrap;[^}]*overflow-x: auto;/s
  );
  assert.match(
    css,
    /\.qt-screen \.qt-ref-tabs\.qt-small-row > button\.qt-ref-tab \{[^}]*flex: 0 0 auto;[^}]*white-space: nowrap;/s,
    "tab buttons must outrank the generic 100% flex-basis rule"
  );
  assert.match(
    css,
    /@container qt-screen \(max-width: 460px\) \{[\s\S]*?\.qt-screen \.qt-ref-periodic \{[^}]*minmax\(38px, 1fr\)[^}]*min-width: max-content;/s
  );
  assert.match(
    css,
    /@container qt-screen \(max-width: 460px\) \{[\s\S]*?\.qt-screen \.qt-ap-controls \{[^}]*flex-direction: column;/s
  );
});

test("study statistics: every table cell carries the label used by the phone layout", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  const view = new T.StudyStatsView({ app }, plugin);
  const data = plugin.studyStatsSnapshot();

  for (const row of Object.values(data.retention.byMaturity)) {
    row.attempts = 12;
    row.retention = 0.72;
  }
  data.retention.all.attempts = 48;
  data.retention.all.retention = 0.72;
  data.decks = [
    { deck: "Sample deck", cards: 8, reviews: 48, retention: 0.75, averageInterval: 14.4 },
    { deck: "Second deck", cards: 4, reviews: 12, retention: 0.5, averageInterval: null },
  ];

  const dom = makeDom();
  view.renderDecks(dom.root, data);
  view.renderRetention(dom.root, data);

  const tables = dom.all.filter((own) => hasClass(own, "qt-study-stats-table"));
  assert.equal(tables.length, 2);
  for (const table of tables) {
    assert.ok(table.children.some((row) => hasClass(row, "is-head")), "desktop header remains in the DOM");
    const bodyRows = table.children.filter((row) => !hasClass(row, "is-head"));
    assert.ok(bodyRows.length);
    for (const row of bodyRows) {
      const cells = cellsWithLabels(row);
      assert.ok(cells.length >= 3, "each data row exposes a label for every value");
    }
  }

  const labels = new Set(
    dom.all.flatMap((own) => (own.meta.attrs && own.meta.attrs["data-label"] ? [own.meta.attrs["data-label"]] : []))
  );
  for (const label of ["Deck", "Cards", "Reviews", "Retention", "Avg interval", "Maturity"]) {
    assert.ok(labels.has(label), `missing data label: ${label}`);
  }
});

test("study statistics: the phone card rows replace the clipped desktop table", () => {
  assert.match(css, /\.qt-screen \.qt-study-stats-row \{[^}]*min-width: 360px/s, "desktop table contract changed");
  assert.match(
    css,
    /@container qt-screen \(max-width: 460px\) \{[\s\S]*?\.qt-screen \.qt-study-stats-row\.is-head \{[^}]*display: none;/s
  );
  assert.match(
    css,
    /@container qt-screen \(max-width: 460px\) \{[\s\S]*?\.qt-screen \.qt-study-stats-row \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);[^}]*min-width: 0;/s
  );
  assert.match(css, /content: attr\(data-label\);/);
});
