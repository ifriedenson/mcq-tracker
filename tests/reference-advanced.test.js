"use strict";
// Curves/LOD, audio trace, vector fields, 3D print output and the JSXGraph adapter.
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();

test("3d curves: compile, sample, LOD and colour are bounded", () => {
  const g = T.graph3d;
  const curve = g.compileCurve("(cos(t), sin(t), t / 3)");
  assert.equal(curve.mode, "curve");
  assert.equal(curve.fn(0).x, 1);
  assert.equal(curve.fn(0).z, 0);
  const sampled = g.sampleCurve(curve, { tMin: 0, tMax: Math.PI * 2, samples: 8 });
  assert.equal(sampled.points.length, 9);
  assert.ok(Math.abs(sampled.points[0].x - 1) < 1e-9);
  assert.ok(Math.abs(sampled.points[8].x - 1) < 1e-9);
  assert.equal(g.normalizeLod("HIGH"), "high");
  assert.equal(g.lodSettings("draft").steps, 36);
  assert.equal(g.normalizeCurveColor("#ABCDEF"), "#abcdef");
  assert.throws(() => g.compileCurve("(t, t)"), /three comma-separated/i);
  assert.throws(() => g.sampleCurve(curve, { tMin: 2, tMax: 1 }), /start below its end/i);
  const calls = [];
  const ctx = { beginPath() {}, moveTo() {}, lineTo() { calls.push("line"); }, stroke() {} };
  const overlay = g.drawCurveOverlay(ctx, [{ curve, tMin: 0, tMax: 1, color: "#ff0000" }], g.DEFAULT_CAMERA, 100, 80, { samples: 20 });
  assert.equal(overlay.curves, 1);
  assert.ok(calls.length > 0);
});

test("3d print sheets require a canvas image and an expression", () => {
  const p = T.graph3dExport;
  const empty = p.printDocument({ dataUrl: "", expressions: ["z = x"] });
  assert.equal(empty.ok, false);
  assert.equal(empty.reason, "canvas");
  const noExpression = p.printDocument({ dataUrl: "data:image/png;base64,AAAA", expressions: [] });
  assert.equal(noExpression.ok, false);
  assert.equal(noExpression.reason, "empty");
  const doc = p.printDocument({ dataUrl: "data:image/png;base64,AAAA", expressions: ["(cos(t), sin(t), t)"], title: "3D <test>" });
  assert.equal(doc.ok, true);
  assert.match(doc.html, /3D &lt;test&gt;/);
  assert.match(doc.html, /\(cos\(t\), sin\(t\), t\)/);
  assert.match(doc.html, /@page/);
});

test("audio trace maps points to a bounded schedule and supports a fake Web Audio context", () => {
  const a = T.audioTrace;
  const trace = a.buildAudioTrace({ points: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 2, z: 4 }] });
  assert.equal(trace.ok, true);
  assert.equal(trace.events.length, 2);
  assert.ok(trace.events[1].frequency > trace.events[0].frequency);
  assert.ok(trace.duration > 0);
  assert.equal(a.buildAudioTrace({}).reason, "empty");
  const started = [];
  const stopped = [];
  const context = {
    currentTime: 1,
    destination: {},
    createOscillator() {
      return { frequency: { setValueAtTime() {} }, connect() {}, start(t) { started.push(t); }, stop(t) { stopped.push(t); } };
    },
    createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; },
    createStereoPanner() { return { pan: { setValueAtTime() {} }, connect() {} }; },
  };
  const played = a.playAudioTrace(context, trace);
  assert.equal(played.ok, true);
  assert.equal(played.events, 2);
  assert.equal(started.length, 2);
  played.stop();
  assert.ok(stopped.length >= 2, "scheduled stop times and the explicit stop are both recorded");
  assert.equal(a.playAudioTrace(null, trace).reason, "audio");
});

test("vector fields: sample, scale arrows, integrate streamlines and paint", () => {
  const v = T.vectorField;
  const field = v.compileField("-y", "x");
  assert.deepEqual(field.fn(2, 3), { x: -3, y: 2 });
  assert.throws(() => v.compileField("", "x"), /both P\(x, y\) and Q\(x, y\)/i);
  const settings = v.normalizeSettings({ density: 5, xMin: -2, xMax: 2, yMin: -2, yMax: 2, normalize: false });
  const sample = v.sampleField(field, settings);
  assert.equal(sample.vectors.length, 25);
  assert.ok(sample.maxMagnitude > 0);
  assert.equal(v.quiverArrows(sample, settings).length, 25);
  const stream = v.buildStreamlines(field, settings);
  assert.ok(stream.lines.length > 0);
  assert.match(v.fieldSummary(sample, settings), /25 sampled vectors/);
  const ctx = { clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, fill() {}, closePath() {}, setLineDash() {} };
  const painted = v.paintVectorField(ctx, field, settings, 320, 240);
  assert.ok(painted.arrows > 0);
  assert.ok(painted.streamlines > 0);
});

test("reference view: curves, LOD, audio state, vector persistence and JSXGraph scenes work", async () => {
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
  const curve = view.applyThreeDCurve("(cos(t), sin(t), t / 3)", 0, Math.PI * 2, "#ABCDEF");
  assert.equal(curve.ok, true);
  assert.equal(view.threeDCurves.length, 1);
  assert.equal(view.threeDBuilt.curves, 1);
  assert.equal(plugin.settings.reference.threeD.curves.length, 1);
  view.setThreeDLod("high");
  assert.equal(view.threeDLod, "high");
  assert.equal(plugin.settings.reference.threeD.lod, "high");
  assert.equal(view.threeDBuilt.lod, "high");
  assert.equal(view.removeThreeDCurve(0).ok, true);
  assert.equal(view.threeDCurves.length, 0);

  view.tab = "fields";
  view.render();
  assert.ok(view.vectorFieldCanvas);
  const field = view.applyVectorField("-y", "x", { density: 5, color: "#ff0000" });
  assert.equal(field.ok, true);
  assert.equal(view.vectorFieldBuilt.sample.vectors.length, 25);
  assert.equal(plugin.settings.reference.vectorField.p, "-y");
  assert.equal(plugin.settings.reference.vectorField.q, "x");
  assert.equal(plugin.settings.reference.vectorField.density, 5);
  assert.equal(view.setVectorFieldOption("normalize", false).ok, true);
  assert.equal(view.vectorFieldSettings.normalize, false);
  const merged = T.referenceData.mergeReferenceSettings({ vectorField: { p: "x", density: 9 } });
  assert.equal(merged.vectorField.density, 9);

  assert.equal(T.jsxgraphAdapter.available(), true);
  assert.equal(T.jsxgraphAdapter.runtime().version, "1.14.2");
  const scene = T.jsxgraphAdapter.geometryScene(T.geometry.createModel(), { xMin: -2, xMax: 2, yMin: -2, yMax: 2 });
  assert.equal(scene.kind, "geometry");
  assert.equal(scene.elements.length, 0);
  const model = T.geometry.createModel();
  const a = T.geometry.addPoint(model, 0, 0, "A");
  const b = T.geometry.addPoint(model, 2, 0, "B");
  T.geometry.addSegment(model, a.id, b.id);
  const drawing = T.jsxgraphAdapter.geometryScene(model, { xMin: -2, xMax: 2, yMin: -2, yMax: 2 });
  assert.equal(drawing.elements.length, 3);
  const created = [];
  const result = T.jsxgraphAdapter.createBoard({
    JSXGraph: { initBoard: () => ({ create: (...args) => { created.push(args); return args; } }) },
  }, {}, drawing);
  assert.equal(result.ok, true);
  assert.equal(created.length, 3);

  const fieldScene = T.jsxgraphAdapter.vectorScene(T.vectorField.compileField("-y", "x"), { density: 3 });
  assert.equal(fieldScene.kind, "field");
  assert.ok(fieldScene.elements.length > 0);
});
