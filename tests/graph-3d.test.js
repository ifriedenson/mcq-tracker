"use strict";
// Explicit and implicit 3D surfaces, camera projection and the Reference 3D tab.
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();

test("3d: explicit surfaces compile and render a deterministic bounded raster", () => {
  const g = T.graph3d;
  const surface = g.compileSurface("z = x^2 + y^2", "explicit");
  assert.equal(surface.mode, "explicit");
  const image = g.renderSurface(surface, { width: 48, height: 32, steps: 40 });
  assert.equal(image.width, 48);
  assert.equal(image.height, 32);
  assert.ok(image.hits > 0);
  assert.equal(image.pixels.length, 48 * 32 * 4);
  assert.match(image.summary, /3D explicit surface/);
  const again = g.renderSurface(surface, { width: 48, height: 32, steps: 40 });
  assert.deepEqual(Buffer.from(image.pixels), Buffer.from(again.pixels));
  assert.throws(() => g.renderSurface(surface, { width: 640, height: 400 }), /too large/i);
  assert.throws(() => g.compileSurface("", "explicit"), /Enter a 3D expression/i);
});

test("3d: bounds, camera, points and projection are finite and bounded", () => {
  const g = T.graph3d;
  assert.deepEqual(g.normalizeBounds({ xMin: 1, xMax: 1 }), g.DEFAULT_BOUNDS);
  const camera = g.normalizeCamera({ yaw: 0, pitch: 0, distance: 10 });
  assert.equal(camera.distance, 10);
  const center = g.projectPoint({ x: 0, y: 0, z: 0 }, camera, 200, 100);
  assert.ok(Math.abs(center.x - 100) < 1e-9);
  assert.ok(Math.abs(center.y - 50) < 1e-9);
  assert.deepEqual(g.parsePoints("1, 2, 3; -1 0 2"), [
    { x: 1, y: 2, z: 3 },
    { x: -1, y: 0, z: 2 },
  ]);
  assert.throws(() => g.parsePoints("1, 2"), /three finite coordinates/i);
});

test("reference view: 3D tab renders a surface, point and camera and persists", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.reference.enabled = true;
  const view = new T.ReferenceView({ app }, plugin);
  view.app = app;
  view.threeDRenderWidth = 80;
  view.threeDRenderHeight = 50;
  const dom = makeDom();
  view.contentEl = dom.root;
  view.tab = "threeD";
  view.render();
  assert.ok(dom.texts().includes("3D"));
  assert.ok(view.threeDBuilt);
  assert.ok(view.threeDBuilt.hits > 0);
  assert.match(dom.texts().join(" "), /3D explicit surface/);

  const surface = view.applyThreeDSurface("z = x + y");
  assert.equal(surface.ok, true);
  assert.equal(view.threeDBuilt.expression, "z = x + y");
  const points = view.applyThreeDPoints("0, 0, 0; 1, 2, 3");
  assert.equal(points.ok, true);
  assert.equal(points.points.length, 2);
  assert.equal(plugin.settings.reference.threeD.points, "0, 0, 0; 1, 2, 3");

  const before = view.threeDCamera.yaw;
  view.orbitThreeD(0.25, 0, 1);
  assert.ok(view.threeDCamera.yaw > before);
  assert.equal(plugin.settings.reference.threeD.surface, "z = x + y");
  assert.equal(plugin.settings.reference.threeD.camera.yaw, view.threeDCamera.yaw);
  const merged = T.referenceData.mergeReferenceSettings({ threeD: { surface: "z = x" } });
  assert.equal(merged.threeD.surface, "z = x");
});

test("reference view: 3D invalid input is reported without replacing the surface", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.reference.enabled = true;
  const view = new T.ReferenceView({ app }, plugin);
  view.app = app;
  view.threeDRenderWidth = 64;
  view.threeDRenderHeight = 40;
  const dom = makeDom();
  view.contentEl = dom.root;
  view.tab = "threeD";
  view.render();
  const before = view.threeDSurface;
  const result = view.applyThreeDSurface("z =");
  assert.equal(result.ok, false);
  assert.equal(view.threeDSurface, before);
  assert.match(result.message, /Expected|incomplete|number/i);
  assert.ok(dom.texts().some((text) => /Expected|incomplete|number/i.test(text)));
});

test("3d: implicit surfaces compile, evaluate and render inside the bounded box", () => {
  const g = T.graph3d;
  const surface = g.compileSurface("x^2 + y^2 + z^2 = 9", "implicit");
  assert.equal(surface.mode, "implicit");
  assert.equal(surface.text, "x^2 + y^2 + z^2 = 9");
  assert.ok(Math.abs(surface.fn({ x: 3, y: 0, z: 0 })) < 1e-12);
  assert.ok(Math.abs(surface.fn({ x: 0, y: 0, z: 0 }) + 9) < 1e-12);
  const image = g.renderSurface(surface, { width: 48, height: 32, steps: 40 });
  assert.ok(image.hits > 0);
  assert.equal(image.pixels.length, 48 * 32 * 4);
  assert.match(image.summary, /3D implicit surface/);
  const again = g.renderSurface(surface, { width: 48, height: 32, steps: 40 });
  assert.deepEqual(Buffer.from(image.pixels), Buffer.from(again.pixels));
  const empty = g.renderSurface(surface, {
    width: 48,
    height: 32,
    steps: 40,
    bounds: { xMin: -0.5, xMax: 0.5, yMin: -0.5, yMax: 0.5, zMin: -0.5, zMax: 0.5 },
  });
  assert.equal(empty.hits, 0);
  assert.ok(empty.pixels.every((value) => value === 0));
});

test("3d: implicit errors name the missing equals sign and broken expression", () => {
  const g = T.graph3d;
  assert.throws(() => g.compileSurface("x^2 + y^2 + z^2", "implicit"), /one equals sign/i);
  assert.throws(() => g.compileSurface("x^2 + y^2 + z^2 =", "implicit"), /incomplete/i);
  assert.throws(() => g.compileSurface("x^2 = y^2 = z^2", "implicit"), /one equals sign/i);
});

test("reference view: 3D implicit mode renders, persists and keeps explicit mode", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.reference.enabled = true;
  const view = new T.ReferenceView({ app }, plugin);
  view.app = app;
  view.threeDRenderWidth = 80;
  view.threeDRenderHeight = 50;
  const dom = makeDom();
  view.contentEl = dom.root;
  view.tab = "threeD";
  view.render();
  assert.equal(view.threeDMode, "explicit");
  assert.equal(view.threeDBuilt.mode, "explicit");

  const switched = view.switchThreeDMode("implicit");
  assert.equal(switched.ok, true);
  assert.equal(view.threeDMode, "implicit");
  assert.ok(view.threeDBuilt);
  assert.equal(view.threeDBuilt.mode, "implicit");
  assert.match(dom.texts().join(" "), /3D implicit surface/);
  assert.ok(dom.texts().includes("F(x, y, z) = 0"));

  const applied = view.applyThreeDSurface("x^2 + y^2 + z^2 = 9");
  assert.equal(applied.ok, true);
  assert.equal(view.threeDBuilt.mode, "implicit");
  assert.equal(view.threeDBuilt.expression, "x^2 + y^2 + z^2 = 9");
  assert.equal(plugin.settings.reference.threeD.mode, "implicit");
  assert.equal(plugin.settings.reference.threeD.surface, "x^2 + y^2 + z^2 = 9");

  view.orbitThreeD(0.2, 0, 1);
  assert.equal(plugin.settings.reference.threeD.mode, "implicit");
  const explicit = view.switchThreeDMode("explicit");
  assert.equal(explicit.ok, true);
  assert.equal(view.threeDMode, "explicit");
  assert.equal(view.threeDBuilt.mode, "explicit");
  assert.equal(plugin.settings.reference.threeD.mode, "explicit");
});

test("reference view: malformed implicit input keeps the last valid implicit surface", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.reference.enabled = true;
  const view = new T.ReferenceView({ app }, plugin);
  view.app = app;
  view.threeDRenderWidth = 64;
  view.threeDRenderHeight = 40;
  view.threeDMode = "implicit";
  view.threeDSurface = "x^2 + y^2 + z^2 = 9";
  const dom = makeDom();
  view.contentEl = dom.root;
  view.tab = "threeD";
  view.render();
  const before = view.threeDBuilt;
  const surfaceBefore = view.threeDSurface;
  const result = view.applyThreeDSurface("x^2 + y^2 + z^2");
  assert.equal(result.ok, false);
  assert.equal(view.threeDSurface, surfaceBefore);
  assert.equal(view.threeDBuilt, before);
  assert.match(result.message, /one equals sign/i);
  assert.ok(dom.texts().some((text) => /one equals sign/i.test(text)));
});
