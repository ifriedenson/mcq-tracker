"use strict";
// Complex graph domain coloring: pure rasterization and the Graph tab mode.
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();

test("complex graph: colors finite values and leaves invalid samples transparent", () => {
  const g = T.graphComplex;
  const c = T.complex;
  assert.equal(g.colorForValue(c.make(1, 0))[3], 255);
  assert.equal(g.colorForValue(c.make(0, 1))[3], 255);
  assert.deepEqual(g.colorForValue(c.make(NaN, 0)), [0, 0, 0, 0]);
  const positive = g.colorForValue(c.make(1, 0));
  assert.ok(positive[0] > positive[1], "positive real values are red-dominant");
  assert.throws(() => g.renderDomain("", { width: 20, height: 10 }), /Enter a complex/i);
  assert.throws(() => g.renderDomain("z", { width: 20, height: 10, xMin: 1, xMax: 1 }), /increasing/i);
});

test("complex graph: renders a deterministic RGBA raster", () => {
  const g = T.graphComplex;
  const image = g.renderDomain("z^2", { width: 32, height: 16, xMin: -2, xMax: 2, yMin: -2, yMax: 2 });
  assert.equal(image.width, 32);
  assert.equal(image.height, 16);
  assert.equal(image.pixels.length, 32 * 16 * 4);
  assert.ok(image.finite > 0);
  assert.match(image.summary, /Complex domain coloring/);
  const again = g.renderDomain("z^2", { width: 32, height: 16, xMin: -2, xMax: 2, yMin: -2, yMax: 2 });
  assert.deepEqual(Buffer.from(image.pixels), Buffer.from(again.pixels));
  assert.throws(() => g.renderDomain("z^2", { width: 640, height: 400, xMin: -2, xMax: 2, yMin: -2, yMax: 2 }), /too large/i);
});

test("reference view: complex graph mode paints a domain image and persists", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.reference.enabled = true;
  const view = new T.ReferenceView({ app }, plugin);
  view.app = app;
  view.graphRows = [{ text: "z^2", hidden: false }];
  view.graphComplex = true;
  view.graphRowErrorEls = [];
  const dom = makeDom();
  view.contentEl = dom.root;
  view.tab = "graph";
  view.render();
  assert.ok(dom.texts().includes("complex"));
  let painted = 0;
  const ctx = new Proxy(
    {
      createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }),
      putImageData: () => { painted += 1; },
    },
    { get(target, key) { return key in target ? target[key] : () => {}; } }
  );
  view.drawComplexGraph(ctx, 40, 20, 1);
  assert.equal(painted, 1);
  assert.equal(view.graphBuilt.complex, true);
  assert.equal(view.graphBuilt.complexImage.width, 40);
  assert.match(view.graphBuilt.rows[0].detail, /Complex domain coloring/);
  view.persistGraphState();
  assert.equal(plugin.settings.reference.graph.complex, true);

  view.graphRows = [{ text: "z^", hidden: false }];
  view.graphRowErrorEls = [];
  view.drawComplexGraph(ctx, 40, 20, 1);
  assert.match(view.graphBuilt.rows[0].error, /Expected|incomplete|number/i);
  assert.equal(view.graphBuilt.complexImage, null);
});
