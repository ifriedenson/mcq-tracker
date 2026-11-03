"use strict";
/*
 * Local Euclidean geometry model for the Reference Geometry tab.
 *
 * Objects are plain records with stable ids. Points resolve to coordinates;
 * segments, lines, rays, circles and polygons refer to point ids. The module has
 * no DOM, Obsidian, storage or network dependency, and it never evaluates code.
 */

const MAX_OBJECTS = 200;

function finite(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} must be a finite number.`);
  return number;
}

function createModel() {
  return { objects: [], nextId: 1 };
}

function objectById(model, id) {
  return model && Array.isArray(model.objects) ? model.objects.find((object) => object && object.id === id) || null : null;
}

function nextId(model, prefix) {
  let candidate;
  do {
    candidate = `${prefix}${model.nextId++}`;
  } while (objectById(model, candidate));
  return candidate;
}

function addObject(model, object) {
  if (!model || !Array.isArray(model.objects)) throw new Error("The geometry model is not available.");
  if (model.objects.length >= MAX_OBJECTS) throw new Error(`A geometry drawing can have at most ${MAX_OBJECTS} objects.`);
  if (!object || typeof object !== "object") throw new Error("Add a geometry object first.");
  const copy = Object.assign({}, object);
  if (!copy.id) copy.id = nextId(model, copy.type === "point" ? "p" : "g");
  if (objectById(model, copy.id)) throw new Error(`The geometry object id ${copy.id} is already used.`);
  model.objects.push(copy);
  return copy;
}

function addPoint(model, x, y, label) {
  return addObject(model, {
    type: "point",
    x: finite(x, "Point x"),
    y: finite(y, "Point y"),
    label: String(label || "").trim(),
  });
}

function requirePoint(model, id, label) {
  const object = objectById(model, id);
  if (!object || object.type !== "point") throw new Error(`${label || "The object"} must be an existing point.`);
  return object;
}

function addSegment(model, a, b, label) {
  requirePoint(model, a, "The first endpoint");
  requirePoint(model, b, "The second endpoint");
  if (a === b) throw new Error("A segment needs two different points.");
  return addObject(model, { type: "segment", points: [a, b], label: String(label || "").trim() });
}

function addLine(model, a, b, label) {
  requirePoint(model, a, "The first line point");
  requirePoint(model, b, "The second line point");
  if (a === b) throw new Error("A line needs two different points.");
  return addObject(model, { type: "line", points: [a, b], label: String(label || "").trim() });
}

function addRay(model, origin, through, label) {
  requirePoint(model, origin, "The ray origin");
  requirePoint(model, through, "The ray direction point");
  if (origin === through) throw new Error("A ray needs a different direction point.");
  return addObject(model, { type: "ray", points: [origin, through], label: String(label || "").trim() });
}

function addCircle(model, center, through, label) {
  requirePoint(model, center, "The circle centre");
  requirePoint(model, through, "The circle radius point");
  const c = pointOf(model, center);
  const p = pointOf(model, through);
  if (c.x === p.x && c.y === p.y) throw new Error("A circle needs a radius point away from its centre.");
  return addObject(model, { type: "circle", points: [center, through], label: String(label || "").trim() });
}

function addPolygon(model, pointIds, label) {
  const ids = Array.isArray(pointIds) ? pointIds.map(String) : [];
  if (ids.length < 3) throw new Error("A polygon needs at least three points.");
  if (new Set(ids).size !== ids.length) throw new Error("A polygon cannot repeat a point.");
  for (const id of ids) requirePoint(model, id, "Every polygon vertex");
  return addObject(model, { type: "polygon", points: ids, label: String(label || "").trim() });
}

/** Resolve any point-like object. Constructions added later extend this switch. */
function pointOf(model, id) {
  const object = objectById(model, id);
  if (!object) throw new Error(`The point ${id} does not exist.`);
  if (object.type === "point") return { x: object.x, y: object.y };
  throw new Error(`${object.type} is not a point.`);
}

function resolveObject(model, object) {
  if (!object) return null;
  if (object.type === "point") return { type: "point", id: object.id, point: { x: object.x, y: object.y }, label: object.label };
  if (object.type === "segment" || object.type === "line" || object.type === "ray") {
    const a = pointOf(model, object.points[0]);
    const b = pointOf(model, object.points[1]);
    return { type: object.type, id: object.id, a, b, label: object.label };
  }
  if (object.type === "circle") {
    const center = pointOf(model, object.points[0]);
    const through = pointOf(model, object.points[1]);
    return {
      type: "circle",
      id: object.id,
      center,
      through,
      radius: Math.hypot(through.x - center.x, through.y - center.y),
      label: object.label,
    };
  }
  if (object.type === "polygon") {
    const points = object.points.map((id) => pointOf(model, id));
    return { type: "polygon", id: object.id, points, label: object.label };
  }
  return { type: object.type, id: object.id, label: object.label };
}

function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function slope(a, b) {
  if (a.x === b.x) return null;
  return (b.y - a.y) / (b.x - a.x);
}

function polygonArea(points) {
  let sum = 0;
  for (let index = 0; index < points.length; index++) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

function polygonPerimeter(points) {
  let total = 0;
  for (let index = 0; index < points.length; index++) {
    total += distance(points[index], points[(index + 1) % points.length]);
  }
  return total;
}

function angleAt(a, vertex, c) {
  const first = Math.atan2(a.y - vertex.y, a.x - vertex.x);
  const second = Math.atan2(c.y - vertex.y, c.x - vertex.x);
  let degrees = ((second - first) * 180) / Math.PI;
  while (degrees < 0) degrees += 360;
  while (degrees > 180) degrees = 360 - degrees;
  return degrees;
}

function formatNumber(value) {
  if (value === null || value === undefined) return "undefined";
  const number = Number(value);
  if (!Number.isFinite(number)) return "undefined";
  const rounded = Number(number.toPrecision(8));
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

function measure(model, object) {
  const resolved = resolveObject(model, object);
  if (!resolved) return [];
  if (resolved.type === "point") return [`x ${formatNumber(resolved.point.x)}`, `y ${formatNumber(resolved.point.y)}`];
  if (resolved.type === "segment") {
    return [
      `length ${formatNumber(distance(resolved.a, resolved.b))}`,
      `slope ${formatNumber(slope(resolved.a, resolved.b))}`,
      `midpoint (${formatNumber(midpoint(resolved.a, resolved.b).x)}, ${formatNumber(midpoint(resolved.a, resolved.b).y)})`,
    ];
  }
  if (resolved.type === "line" || resolved.type === "ray") return [`slope ${formatNumber(slope(resolved.a, resolved.b))}`];
  if (resolved.type === "circle") {
    return [
      `radius ${formatNumber(resolved.radius)}`,
      `circumference ${formatNumber(2 * Math.PI * resolved.radius)}`,
      `area ${formatNumber(Math.PI * resolved.radius * resolved.radius)}`,
    ];
  }
  if (resolved.type === "polygon") {
    return [
      `vertices ${resolved.points.length}`,
      `perimeter ${formatNumber(polygonPerimeter(resolved.points))}`,
      `area ${formatNumber(polygonArea(resolved.points))}`,
    ];
  }
  return [];
}

function describe(model, object) {
  const resolved = resolveObject(model, object);
  if (!resolved) return "Nothing to draw.";
  const name = object.label ? `${object.type} ${object.label}` : object.type;
  const measures = measure(model, object);
  return `${name}${measures.length ? `: ${measures.join(", ")}` : ""}.`;
}

function removeObject(model, id) {
  const target = objectById(model, id);
  if (!target) return { ok: false, reason: "missing" };
  const removed = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const object of model.objects) {
      if (removed.has(object.id)) continue;
      if (Array.isArray(object.points) && object.points.some((pointId) => removed.has(pointId))) {
        removed.add(object.id);
        changed = true;
      }
    }
  }
  model.objects = model.objects.filter((object) => !removed.has(object.id));
  return { ok: true, removed: removed.size };
}

function summary(model) {
  const objects = model && Array.isArray(model.objects) ? model.objects : [];
  if (!objects.length) return "The geometry drawing is empty.";
  const counts = {};
  for (const object of objects) counts[object.type] = (counts[object.type] || 0) + 1;
  const parts = Object.keys(counts).sort().map((type) => `${counts[type]} ${type}${counts[type] === 1 ? "" : "s"}`);
  return `Geometry drawing with ${objects.length} object${objects.length === 1 ? "" : "s"}: ${parts.join(", ")}.`;
}

function clone(model) {
  return JSON.parse(JSON.stringify(model));
}

function normalizeModel(value) {
  const source = value && typeof value === "object" && Array.isArray(value.objects) ? value : null;
  const model = createModel();
  if (!source) return model;
  for (const raw of source.objects.slice(0, MAX_OBJECTS)) {
    if (!raw || typeof raw !== "object") continue;
    try {
      if (raw.type === "point") {
        addObject(model, { id: String(raw.id || ""), type: "point", x: finite(raw.x, "Point x"), y: finite(raw.y, "Point y"), label: String(raw.label || "") });
      } else if (raw.type === "segment" || raw.type === "line" || raw.type === "ray") {
        addObject(model, { id: String(raw.id || ""), type: raw.type, points: (raw.points || []).map(String), label: String(raw.label || "") });
      } else if (raw.type === "circle") {
        addObject(model, { id: String(raw.id || ""), type: "circle", points: (raw.points || []).map(String), label: String(raw.label || "") });
      } else if (raw.type === "polygon") {
        addObject(model, { id: String(raw.id || ""), type: "polygon", points: (raw.points || []).map(String), label: String(raw.label || "") });
      }
    } catch (e) {
      // Skip a damaged stored object; the rest of the drawing still loads.
    }
  }
  model.nextId = Math.max(model.objects.length + 1, Number(source.nextId) || 1);
  return model;
}

const GEOMETRY_COLORS = ["#5b8def", "#e5534b", "#2ea043", "#d29922", "#a371f7", "#39c5cf"];

/** Paint a geometry model into any 2D context; the view owns the canvas. */
function paintGeometry(ctx, model, view, width, height) {
  const v = view || { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };
  const px = (x) => ((x - v.xMin) / (v.xMax - v.xMin)) * width;
  const py = (y) => height - ((y - v.yMin) / (v.yMax - v.yMin)) * height;
  ctx.strokeStyle = "rgba(127, 127, 127, 0.18)";
  ctx.lineWidth = 1;
  for (let x = Math.ceil(v.xMin); x <= v.xMax; x++) {
    ctx.beginPath();
    ctx.moveTo(px(x), 0);
    ctx.lineTo(px(x), height);
    ctx.stroke();
  }
  for (let y = Math.ceil(v.yMin); y <= v.yMax; y++) {
    ctx.beginPath();
    ctx.moveTo(0, py(y));
    ctx.lineTo(width, py(y));
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(127, 127, 127, 0.55)";
  ctx.beginPath();
  if (v.yMin <= 0 && v.yMax >= 0) { ctx.moveTo(0, py(0)); ctx.lineTo(width, py(0)); }
  if (v.xMin <= 0 && v.xMax >= 0) { ctx.moveTo(px(0), 0); ctx.lineTo(px(0), height); }
  ctx.stroke();
  (model && Array.isArray(model.objects) ? model.objects : []).forEach((object, index) => {
    const resolved = resolveObject(model, object);
    if (!resolved) return;
    const color = GEOMETRY_COLORS[index % GEOMETRY_COLORS.length];
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    const dot = (point, label) => {
      ctx.beginPath();
      ctx.arc(px(point.x), py(point.y), 4, 0, Math.PI * 2);
      ctx.fill();
      if (label) { ctx.font = "12px sans-serif"; ctx.fillText(label, px(point.x) + 6, py(point.y) - 6); }
    };
    if (resolved.type === "point") dot(resolved.point, object.label || object.id);
    else if (resolved.type === "segment") {
      ctx.beginPath(); ctx.moveTo(px(resolved.a.x), py(resolved.a.y)); ctx.lineTo(px(resolved.b.x), py(resolved.b.y)); ctx.stroke();
      dot(resolved.a, ""); dot(resolved.b, "");
    } else if (resolved.type === "line" || resolved.type === "ray") {
      const dx = resolved.b.x - resolved.a.x;
      const dy = resolved.b.y - resolved.a.y;
      const length = Math.hypot(dx, dy) || 1;
      const start = resolved.type === "ray" ? resolved.a : { x: resolved.a.x - (dx / length) * 1000, y: resolved.a.y - (dy / length) * 1000 };
      const end = { x: resolved.a.x + (dx / length) * 1000, y: resolved.a.y + (dy / length) * 1000 };
      ctx.beginPath(); ctx.moveTo(px(start.x), py(start.y)); ctx.lineTo(px(end.x), py(end.y)); ctx.stroke();
      dot(resolved.a, ""); dot(resolved.b, "");
    } else if (resolved.type === "circle") {
      const rx = Math.abs(px(resolved.center.x + resolved.radius) - px(resolved.center.x));
      const ry = Math.abs(py(resolved.center.y) - py(resolved.center.y + resolved.radius));
      ctx.beginPath();
      if (typeof ctx.ellipse === "function") ctx.ellipse(px(resolved.center.x), py(resolved.center.y), rx, ry, 0, 0, Math.PI * 2);
      else ctx.arc(px(resolved.center.x), py(resolved.center.y), rx, 0, Math.PI * 2);
      ctx.stroke();
      dot(resolved.center, object.label || object.id);
    } else if (resolved.type === "polygon") {
      ctx.beginPath();
      resolved.points.forEach((point, pointIndex) => {
        if (pointIndex === 0) ctx.moveTo(px(point.x), py(point.y));
        else ctx.lineTo(px(point.x), py(point.y));
      });
      ctx.closePath();
      ctx.fillStyle = `${color}33`;
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.stroke();
      resolved.points.forEach((point) => dot(point, ""));
    }
  });
}

module.exports = {
  MAX_OBJECTS,
  addCircle,
  addLine,
  addObject,
  addPoint,
  addPolygon,
  addRay,
  addSegment,
  angleAt,
  clone,
  createModel,
  describe,
  distance,
  formatNumber,
  measure,
  midpoint,
  normalizeModel,
  objectById,
  pointOf,
  polygonArea,
  polygonPerimeter,
  paintGeometry,
  removeObject,
  resolveObject,
  slope,
  summary,
};
