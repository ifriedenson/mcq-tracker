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

test("geometry: dependent constructions resolve and update from their sources", () => {
  const g = T.geometry;
  const model = g.createModel();
  const a = g.addPoint(model, 0, 0, "A");
  const b = g.addPoint(model, 4, 0, "B");
  const c = g.addPoint(model, 0, 3, "C");
  const midpoint = g.addMidpoint(model, a.id, b.id);
  assert.deepEqual(g.pointOf(model, midpoint.id), { x: 2, y: 0 });
  const ab = g.addLine(model, a.id, b.id);
  const ac = g.addLine(model, a.id, c.id);
  const crossing = g.addIntersection(model, ab.id, ac.id);
  const crossingPoint = g.pointOf(model, crossing.id);
  assert.ok(Math.abs(crossingPoint.x) < 1e-9 && Math.abs(crossingPoint.y) < 1e-9);
  const parallel = g.addParallel(model, c.id, ab.id);
  const parallelResolved = g.resolveObject(model, parallel);
  assert.equal(parallelResolved.b.y, 3);
  const perpendicular = g.addPerpendicular(model, c.id, ab.id);
  const perpendicularResolved = g.resolveObject(model, perpendicular);
  assert.equal(perpendicularResolved.b.x, 0);
  const bisector = g.addPerpendicularBisector(model, a.id, b.id);
  assert.deepEqual(g.resolveObject(model, bisector).a, { x: 2, y: 0 });
  const angle = g.addAngleBisector(model, a.id, b.id, c.id);
  const angleResolved = g.resolveObject(model, angle);
  assert.ok(angleResolved.b.x > 0 && angleResolved.b.y > 0);
  const circle = g.addCircumcircle(model, a.id, b.id, c.id);
  const circleResolved = g.resolveObject(model, circle);
  assert.ok(Math.abs(circleResolved.center.x - 2) < 1e-9);
  assert.ok(Math.abs(circleResolved.center.y - 1.5) < 1e-9);
  assert.ok(Math.abs(circleResolved.radius - 2.5) < 1e-9);
  assert.throws(() => g.addCircumcircle(model, a.id, b.id, g.addPoint(model, 8, 0, "D").id), /collinear/i);
});

test("reference view: construction controls create a midpoint", async () => {
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
  const a = view.addGeometryPoint(0, 0).point;
  const b = view.addGeometryPoint(4, 0).point;
  const result = view.addGeometryObject("midpoint", a.id, b.id, "", b.id, "", "");
  assert.equal(result.ok, true);
  assert.equal(result.object.type, "midpoint");
  assert.deepEqual(T.geometry.pointOf(view.geometryModel, result.object.id), { x: 2, y: 0 });
});

test("geometry: transformations resolve from their source and are removable", () => {
  const g = T.geometry;
  const model = g.createModel();
  const point = g.addPoint(model, 2, 3, "P");
  const translated = g.addTransform(model, point.id, "translate", { dx: 1, dy: -1 });
  assert.deepEqual(g.pointOf(model, translated.id), { x: 3, y: 2 });
  const rotated = g.addTransform(model, point.id, "rotate", { degrees: 90 });
  const rotatedPoint = g.pointOf(model, rotated.id);
  assert.ok(Math.abs(rotatedPoint.x + 3) < 1e-9 && Math.abs(rotatedPoint.y - 2) < 1e-9);
  assert.deepEqual(g.pointOf(model, g.addTransform(model, point.id, "reflectX", {}).id), { x: 2, y: -3 });
  assert.deepEqual(g.pointOf(model, g.addTransform(model, point.id, "reflectY", {}).id), { x: -2, y: 3 });
  assert.deepEqual(g.pointOf(model, g.addTransform(model, point.id, "dilate", { factor: 2 }).id), { x: 4, y: 6 });
  const segment = g.addSegment(model, point.id, g.addPoint(model, 4, 3, "Q").id);
  const moved = g.addTransform(model, segment.id, "translate", { dx: 1, dy: 1 });
  assert.deepEqual(g.resolveObject(model, moved).a, { x: 3, y: 4 });
  assert.throws(() => g.addTransform(model, point.id, "translate", { dx: "x", dy: 0 }), /finite/i);
  const removed = g.removeObject(model, point.id);
  assert.equal(removed.ok, true);
  assert.equal(g.objectById(model, translated.id), null);
});

test("reference view: transformation controls create a translated point", async () => {
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
  const point = view.addGeometryPoint(2, 3).point;
  const result = view.addGeometryTransform(point.id, "translate", 1, -1, 0, 2);
  assert.equal(result.ok, true);
  assert.equal(result.object.type, "transform");
  assert.deepEqual(T.geometry.pointOf(view.geometryModel, result.object.id), { x: 3, y: 2 });
});
