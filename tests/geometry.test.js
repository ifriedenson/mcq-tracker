"use strict";
// Geometry primitives and the Reference Geometry tab.
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();

function modelWithSegment() {
  const g = T.geometry;
  const model = g.createModel();
  const a = g.addPoint(model, 0, 0, "A");
  const b = g.addPoint(model, 3, 4, "B");
  const segment = g.addSegment(model, a.id, b.id, "AB");
  return { g, model, a, b, segment };
}

test("geometry: points, segments, measurements and slopes", () => {
  const { g, model, segment } = modelWithSegment();
  const measures = g.measure(model, segment);
  assert.ok(measures.some((text) => text.includes("length 5")));
  assert.ok(measures.some((text) => text.includes("slope 1.3333333")));
  assert.ok(measures.some((text) => text.includes("midpoint (1.5, 2)")));
  assert.match(g.describe(model, segment), /segment AB/);
  assert.equal(g.slope({ x: 0, y: 0 }, { x: 0, y: 2 }), null);
});

test("geometry: circles and polygons report radius, perimeter and area", () => {
  const { g, model, a, b } = modelWithSegment();
  const circle = g.addCircle(model, a.id, b.id, "C");
  const circleMeasures = g.measure(model, circle);
  assert.ok(circleMeasures.some((text) => text.includes("radius 5")));
  assert.ok(circleMeasures.some((text) => text.includes("area 78.539816")));
  const c = g.addPoint(model, 3, 0, "C");
  const polygon = g.addPolygon(model, [a.id, b.id, c.id], "T");
  const polygonMeasures = g.measure(model, polygon);
  assert.ok(polygonMeasures.some((text) => text.includes("vertices 3")));
  assert.ok(polygonMeasures.some((text) => text.includes("perimeter 12")));
  assert.ok(polygonMeasures.some((text) => text.includes("area 6")));
});

test("geometry: invalid primitives and dependent removal are safe", () => {
  const { g, model, a, b, segment } = modelWithSegment();
  assert.throws(() => g.addSegment(model, a.id, a.id), /different points/i);
  assert.throws(() => g.addPolygon(model, [a.id, b.id]), /three points/i);
  assert.throws(() => g.addPoint(model, "nope", 0), /finite/i);
  const removed = g.removeObject(model, a.id);
  assert.equal(removed.ok, true);
  assert.equal(g.objectById(model, segment.id), null, "the segment that used the point is removed");
  assert.equal(g.objectById(model, b.id).type, "point");
});

test("geometry: stored state normalizes and keeps valid objects", () => {
  const { g, model } = modelWithSegment();
  const restored = g.normalizeModel(JSON.parse(JSON.stringify(model)));
  assert.equal(restored.objects.length, 3);
  assert.equal(restored.objects.filter((object) => object.type === "point").length, 2);
  const broken = g.normalizeModel({ objects: [{ id: "p1", type: "point", x: 1, y: 2 }, { id: "bad", type: "triangle" }] });
  assert.equal(broken.objects.length, 1);
});

test("reference view: geometry points and objects render and persist", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.reference.enabled = true;
  const view = new T.ReferenceView({ app }, plugin);
  view.app = app;
  const dom = makeDom();
  view.contentEl = dom.root;
  view.tab = "geometry";
  view.render();
  assert.ok(dom.texts().includes("Geometry"));
  const first = view.addGeometryPoint(0, 0);
  const second = view.addGeometryPoint(3, 4);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(view.geometryModel.objects.filter((object) => object.type === "point").length, 2);
  const segment = view.addGeometryObject("segment", first.point.id, second.point.id, "");
  assert.equal(segment.ok, true);
  assert.ok(plugin.settings.reference.geometry.objects.some((object) => object.type === "segment"));
  const removed = view.removeGeometryObject(first.point.id);
  assert.equal(removed.ok, true);
  assert.equal(view.geometryModel.objects.length, 1, "the dependent segment is removed too");
});
