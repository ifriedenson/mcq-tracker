"use strict";
/*
 * JSXGraph presentation adapter for the Reference Geometry and Vector field
 * tabs. The vendored runtime is loaded lazily from vendor/jsxgraph-core.js and
 * is the unmodified MIT build plus the safe feature-detection patch recorded in
 * NOTICES.md. This module only translates local geometry/vector records into
 * plain board elements, so it can be tested without a browser.
 */
const geometry = require("./geometry");
const vectorField = require("./vector-field");

let cachedRuntime = null;

function runtime() {
  if (cachedRuntime) return cachedRuntime;
  try {
    cachedRuntime = require("../vendor/jsxgraph-core");
  } catch (e) {
    cachedRuntime = null;
  }
  return cachedRuntime;
}

function available() {
  return !!runtime();
}

function colorFor(index) {
  const colors = ["#5b8def", "#e5534b", "#2ea043", "#d29922", "#a371f7", "#39c5cf"];
  return colors[index % colors.length];
}

function geometryScene(model, view) {
  const bounds = view || { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };
  const elements = [];
  const objects = model && Array.isArray(model.objects) ? model.objects : [];
  objects.forEach((object, index) => {
    const resolved = geometry.resolveObject(model, object);
    if (!resolved) return;
    const color = colorFor(index);
    if (resolved.type === "point") {
      elements.push({ type: "point", args: [resolved.point.x, resolved.point.y], options: { name: object.label || object.id, fixed: true, size: 3, strokeColor: color, fillColor: color } });
    } else if (resolved.type === "segment" || resolved.type === "line" || resolved.type === "ray") {
      elements.push({ type: resolved.type, args: [[resolved.a.x, resolved.a.y], [resolved.b.x, resolved.b.y]], options: { strokeColor: color, fixed: true, highlight: false } });
    } else if (resolved.type === "circle") {
      elements.push({ type: "circle", args: [[resolved.center.x, resolved.center.y], resolved.radius], options: { strokeColor: color, fixed: true, highlight: false } });
    } else if (resolved.type === "polygon") {
      elements.push({ type: "polygon", args: resolved.points.map((point) => [point.x, point.y]), options: { strokeColor: color, fillColor: color, fillOpacity: 0.15, fixed: true, highlight: false } });
    }
  });
  return { kind: "geometry", boundingbox: [bounds.xMin, bounds.yMax, bounds.xMax, bounds.yMin], elements, summary: geometry.summary(model) };
}

function vectorScene(field, settings) {
  const opts = vectorField.normalizeSettings(settings);
  const sample = vectorField.sampleField(field, opts);
  const arrows = vectorField.quiverArrows(sample, opts);
  const elements = arrows.map((arrow) => ({
    type: "vector",
    args: [[arrow.x, arrow.y], [arrow.endX, arrow.endY]],
    options: { strokeColor: opts.color, fillColor: opts.color, fixed: true, highlight: false, lastArrow: { type: 2, size: 4 } },
  }));
  if (opts.streamlines) {
    const stream = vectorField.buildStreamlines(field, opts);
    for (const line of stream.lines) {
      elements.push({ type: "curve", args: [line.map((point) => point.x), line.map((point) => point.y)], options: { strokeColor: opts.color, strokeWidth: 1, dash: 2, fixed: true, highlight: false } });
    }
  }
  return { kind: "field", boundingbox: [opts.xMin, opts.yMax, opts.xMax, opts.yMin], elements, summary: vectorField.fieldSummary(sample, opts) };
}

function createBoard(JXG, container, scene, options) {
  const api = JXG && JXG.JSXGraph ? JXG : null;
  if (!api || typeof api.JSXGraph.initBoard !== "function") return { ok: false, reason: "runtime", message: "JSXGraph is not available in this environment." };
  if (!container) return { ok: false, reason: "container", message: "The JSXGraph board needs a container." };
  const board = api.JSXGraph.initBoard(container, Object.assign({
    boundingbox: scene.boundingbox,
    axis: true,
    showNavigation: false,
    showCopyright: false,
    keepaspectratio: true,
  }, options || {}));
  const created = [];
  for (const element of scene.elements || []) {
    try {
      created.push(board.create(element.type, element.args, element.options));
    } catch (e) {
      // One unsupported element should not discard the rest of the drawing.
    }
  }
  return { ok: true, board, created, summary: scene.summary };
}

function openGeometryBoard(model, view, container, options) {
  const scene = geometryScene(model, view);
  return createBoard(runtime(), container, scene, options);
}

function openVectorBoard(field, settings, container, options) {
  const scene = vectorScene(field, settings);
  return createBoard(runtime(), container, scene, options);
}

module.exports = {
  available,
  createBoard,
  geometryScene,
  openGeometryBoard,
  openVectorBoard,
  runtime,
  vectorScene,
};
