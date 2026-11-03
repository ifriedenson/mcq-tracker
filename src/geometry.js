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

function addMidpoint(model, a, b, label) {
  requirePoint(model, a, "The first midpoint point");
  requirePoint(model, b, "The second midpoint point");
  if (a === b) throw new Error("A midpoint needs two different points.");
  return addObject(model, { type: "midpoint", points: [a, b], label: String(label || "").trim() });
}

function addIntersection(model, first, second, label) {
  if (!intersectionPoints(model, first, second).length) throw new Error("These objects do not intersect.");
  return addObject(model, { type: "intersection", sources: [first, second], label: String(label || "").trim() });
}

function directionOf(model, lineId) {
  const line = lineOf(model, lineId);
  const dx = line.b.x - line.a.x;
  const dy = line.b.y - line.a.y;
  const length = Math.hypot(dx, dy);
  if (!(length > 0)) throw new Error("A constructed line needs two different points.");
  return { x: dx / length, y: dy / length };
}

function addParallel(model, pointId, lineId, label) {
  requirePoint(model, pointId, "The parallel point");
  const point = pointOf(model, pointId);
  const direction = directionOf(model, lineId);
  return addObject(model, { type: "parallel", points: [pointId], line: lineId, direction, label: String(label || "").trim() });
}

function addPerpendicular(model, pointId, lineId, label) {
  requirePoint(model, pointId, "The perpendicular point");
  const direction = directionOf(model, lineId);
  return addObject(model, { type: "perpendicular", points: [pointId], line: lineId, direction: { x: -direction.y, y: direction.x }, label: String(label || "").trim() });
}

function addPerpendicularBisector(model, a, b, label) {
  requirePoint(model, a, "The first bisector point");
  requirePoint(model, b, "The second bisector point");
  const first = pointOf(model, a);
  const second = pointOf(model, b);
  const center = midpoint(first, second);
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  const length = Math.hypot(dx, dy);
  if (!(length > 0)) throw new Error("A perpendicular bisector needs two different points.");
  return addObject(model, { type: "perpendicularBisector", points: [a, b], through: center, direction: { x: -dy / length, y: dx / length }, label: String(label || "").trim() });
}

function addAngleBisector(model, vertex, a, b, label) {
  requirePoint(model, vertex, "The angle vertex");
  requirePoint(model, a, "The first angle point");
  requirePoint(model, b, "The second angle point");
  const v = pointOf(model, vertex);
  const first = pointOf(model, a);
  const second = pointOf(model, b);
  const firstLength = distance(v, first);
  const secondLength = distance(v, second);
  if (!(firstLength > 0) || !(secondLength > 0)) throw new Error("An angle bisector needs two points away from the vertex.");
  const direction = { x: (first.x - v.x) / firstLength + (second.x - v.x) / secondLength, y: (first.y - v.y) / firstLength + (second.y - v.y) / secondLength };
  const length = Math.hypot(direction.x, direction.y);
  if (!(length > 1e-10)) throw new Error("The angle is straight; its bisector is not unique.");
  return addObject(model, { type: "angleBisector", points: [vertex, a, b], through: v, direction: { x: direction.x / length, y: direction.y / length }, label: String(label || "").trim() });
}

function transformPoint(point, kind, params) {
  const p = params || {};
  if (kind === "translate") return { x: point.x + Number(p.dx || 0), y: point.y + Number(p.dy || 0) };
  if (kind === "rotate") {
    const angle = (Number(p.degrees || 0) * Math.PI) / 180;
    return { x: point.x * Math.cos(angle) - point.y * Math.sin(angle), y: point.x * Math.sin(angle) + point.y * Math.cos(angle) };
  }
  if (kind === "reflectX") return { x: point.x, y: -point.y };
  if (kind === "reflectY") return { x: -point.x, y: point.y };
  if (kind === "dilate") {
    const factor = Number(p.factor);
    if (!Number.isFinite(factor) || factor === 0) throw new Error("A dilation needs a non-zero finite factor.");
    return { x: point.x * factor, y: point.y * factor };
  }
  throw new Error(`Unknown transformation ${kind}.`);
}

function addTransform(model, source, kind, params, label) {
  if (!objectById(model, source)) throw new Error("Choose an existing object to transform.");
  if (!["translate", "rotate", "reflectX", "reflectY", "dilate"].includes(kind)) throw new Error("Choose a translation, rotation, reflection or dilation.");
  const p = {};
  if (kind === "translate") { p.dx = finite((params || {}).dx, "Translation x"); p.dy = finite((params || {}).dy, "Translation y"); }
  if (kind === "rotate") p.degrees = finite((params || {}).degrees, "Rotation angle");
  if (kind === "dilate") { p.factor = finite((params || {}).factor, "Dilation factor"); if (p.factor === 0) throw new Error("A dilation cannot use a factor of 0."); }
  // Resolve once so an invalid source shape is rejected before it is stored.
  const resolved = resolveObject(model, objectById(model, source));
  if (!resolved) throw new Error("That source object cannot be transformed.");
  return addObject(model, { type: "transform", source, kind, params: p, label: String(label || "").trim() });
}

function addCircumcircle(model, a, b, c, label) {
  requirePoint(model, a, "The first circle point");
  requirePoint(model, b, "The second circle point");
  requirePoint(model, c, "The third circle point");
  const first = pointOf(model, a);
  const second = pointOf(model, b);
  const third = pointOf(model, c);
  const determinant = 2 * (first.x * (second.y - third.y) + second.x * (third.y - first.y) + third.x * (first.y - second.y));
  if (Math.abs(determinant) < 1e-10) throw new Error("Those three points are collinear; there is no circle through them.");
  const firstSq = first.x * first.x + first.y * first.y;
  const secondSq = second.x * second.x + second.y * second.y;
  const thirdSq = third.x * third.x + third.y * third.y;
  const center = {
    x: (firstSq * (second.y - third.y) + secondSq * (third.y - first.y) + thirdSq * (first.y - second.y)) / determinant,
    y: (firstSq * (third.x - second.x) + secondSq * (first.x - third.x) + thirdSq * (second.x - first.x)) / determinant,
  };
  return addObject(model, { type: "circumcircle", points: [a, b, c], center, radius: distance(center, first), label: String(label || "").trim() });
}

function lineOf(model, id) {
  const object = objectById(model, id);
  if (!object || !["segment", "line", "ray"].includes(object.type)) throw new Error(`${id || "The object"} must be a line, ray or segment.`);
  return { a: pointOf(model, object.points[0]), b: pointOf(model, object.points[1]) };
}

function intersectLines(first, second) {
  const denominator = (first.a.x - first.b.x) * (second.a.y - second.b.y) - (first.a.y - first.b.y) * (second.a.x - second.b.x);
  if (Math.abs(denominator) < 1e-10) return [];
  const a = first.a.x * first.b.y - first.a.y * first.b.x;
  const b = second.a.x * second.b.y - second.a.y * second.b.x;
  const x = (a * (second.a.x - second.b.x) - (first.a.x - first.b.x) * b) / denominator;
  const y = (a * (second.a.y - second.b.y) - (first.a.y - first.b.y) * b) / denominator;
  return [{ x, y }];
}

function intersectLineCircle(line, circle) {
  const dx = line.b.x - line.a.x;
  const dy = line.b.y - line.a.y;
  const fx = line.a.x - circle.center.x;
  const fy = line.a.y - circle.center.y;
  const a = dx * dx + dy * dy;
  if (!(a > 0)) return [];
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - circle.radius * circle.radius;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < -1e-10) return [];
  const root = Math.sqrt(Math.max(0, discriminant));
  const values = Math.abs(root) < 1e-10 ? [-b / (2 * a)] : [(-b - root) / (2 * a), (-b + root) / (2 * a)];
  return values.map((t) => ({ x: line.a.x + t * dx, y: line.a.y + t * dy }));
}

function intersectCircles(first, second) {
  const dx = second.center.x - first.center.x;
  const dy = second.center.y - first.center.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1e-10 || distance > first.radius + second.radius + 1e-10 || distance < Math.abs(first.radius - second.radius) - 1e-10) return [];
  const along = (first.radius * first.radius - second.radius * second.radius + distance * distance) / (2 * distance);
  const height = Math.sqrt(Math.max(0, first.radius * first.radius - along * along));
  const base = { x: first.center.x + (along * dx) / distance, y: first.center.y + (along * dy) / distance };
  if (height < 1e-10) return [base];
  return [
    { x: base.x - (height * dy) / distance, y: base.y + (height * dx) / distance },
    { x: base.x + (height * dy) / distance, y: base.y - (height * dx) / distance },
  ];
}

function intersectionPoints(model, firstId, secondId) {
  const first = resolveObject(model, objectById(model, firstId));
  const second = resolveObject(model, objectById(model, secondId));
  if (!first || !second) return [];
  if ((first.type === "line" || first.type === "ray" || first.type === "segment") && (second.type === "line" || second.type === "ray" || second.type === "segment")) return intersectLines(first, second);
  if ((first.type === "line" || first.type === "ray" || first.type === "segment") && second.type === "circle") return intersectLineCircle(first, second);
  if (first.type === "circle" && (second.type === "line" || second.type === "ray" || second.type === "segment")) return intersectLineCircle(second, first);
  if (first.type === "circle" && second.type === "circle") return intersectCircles(first, second);
  return [];
}

/** Resolve any point-like object, including dependent constructions. */
function pointOf(model, id, seen) {
  const object = objectById(model, id);
  if (!object) throw new Error(`The point ${id} does not exist.`);
  const trail = seen || new Set();
  if (trail.has(id)) throw new Error("A geometry construction cannot depend on itself.");
  trail.add(id);
  if (object.type === "point") return { x: object.x, y: object.y };
  if (object.type === "midpoint") {
    const a = pointOf(model, object.points[0], trail);
    const b = pointOf(model, object.points[1], trail);
    return midpoint(a, b);
  }
  if (object.type === "intersection") {
    const hits = intersectionPoints(model, object.sources[0], object.sources[1]);
    if (!hits.length) throw new Error("These objects do not intersect.");
    return hits[0];
  }
  if (object.type === "transform") {
    const resolved = resolveObject(model, object);
    if (resolved && resolved.type === "point") return resolved.point;
  }
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
  if (object.type === "midpoint" || object.type === "intersection") {
    try {
      return { type: "point", id: object.id, point: pointOf(model, object.id), label: object.label };
    } catch (e) {
      return null;
    }
  }
  if (object.type === "circumcircle") {
    return { type: "circle", id: object.id, center: object.center, radius: object.radius, label: object.label };
  }
  if (object.type === "parallel" || object.type === "perpendicular") {
    const through = pointOf(model, object.points[0]);
    return { type: "line", id: object.id, a: through, b: { x: through.x + object.direction.x, y: through.y + object.direction.y }, label: object.label };
  }
  if (object.type === "perpendicularBisector" || object.type === "angleBisector") {
    return { type: "line", id: object.id, a: object.through, b: { x: object.through.x + object.direction.x, y: object.through.y + object.direction.y }, label: object.label };
  }
  if (object.type === "transform") {
    const source = resolveObject(model, objectById(model, object.source));
    if (!source) return null;
    if (source.type === "point") return { type: "point", id: object.id, point: transformPoint(source.point, object.kind, object.params), label: object.label };
    if (source.type === "segment" || source.type === "line" || source.type === "ray") {
      return { type: source.type, id: object.id, a: transformPoint(source.a, object.kind, object.params), b: transformPoint(source.b, object.kind, object.params), label: object.label };
    }
    if (source.type === "circle") {
      const center = transformPoint(source.center, object.kind, object.params);
      const through = transformPoint(source.through, object.kind, object.params);
      return { type: "circle", id: object.id, center, through, radius: Math.hypot(through.x - center.x, through.y - center.y), label: object.label };
    }
    if (source.type === "polygon") return { type: "polygon", id: object.id, points: source.points.map((point) => transformPoint(point, object.kind, object.params)), label: object.label };
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
      const refs = Array.isArray(object.points) ? object.points.slice() : [];
      if (object.line) refs.push(object.line);
      if (object.source) refs.push(object.source);
      if (Array.isArray(object.sources)) refs.push(...object.sources);
      if (refs.some((pointId) => removed.has(pointId))) {
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
      } else if (raw.type === "midpoint" || raw.type === "perpendicularBisector" || raw.type === "angleBisector" || raw.type === "circumcircle") {
        addObject(model, { id: String(raw.id || ""), type: raw.type, points: (raw.points || []).map(String), through: raw.through, direction: raw.direction, center: raw.center, radius: raw.radius, label: String(raw.label || "") });
      } else if (raw.type === "intersection") {
        addObject(model, { id: String(raw.id || ""), type: "intersection", sources: (raw.sources || []).map(String), label: String(raw.label || "") });
      } else if (raw.type === "parallel" || raw.type === "perpendicular") {
        addObject(model, { id: String(raw.id || ""), type: raw.type, points: (raw.points || []).map(String), line: String(raw.line || ""), direction: raw.direction, label: String(raw.label || "") });
      } else if (raw.type === "transform") {
        addObject(model, { id: String(raw.id || ""), type: "transform", source: String(raw.source || ""), kind: String(raw.kind || ""), params: raw.params, label: String(raw.label || "") });
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
  addAngleBisector,
  addCircle,
  addCircumcircle,
  addIntersection,
  addMidpoint,
  addParallel,
  addPerpendicular,
  addPerpendicularBisector,
  addLine,
  addObject,
  addPoint,
  addPolygon,
  addRay,
  addSegment,
  addTransform,
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
  transformPoint,
};
