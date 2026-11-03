"use strict";
/*
 * Bounded 3D surface renderer for the Reference panel.
 *
 * Explicit and implicit surfaces share one screen-space ray marcher: the
 * surface is the zero set of F(x,y,z), rays are clipped to a finite box, and a
 * sign change is refined by bisection. There is no WebGL, mesh library or
 * third-party code. The renderer is deliberately low-resolution and capped so
 * a difficult surface cannot lock the editor.
 */
const { compileScoped } = require("./reference-graph");

const MAX_PIXELS = 80000;
const DEFAULT_BOUNDS = { xMin: -5, xMax: 5, yMin: -5, yMax: 5, zMin: -5, zMax: 5 };
const DEFAULT_CAMERA = { yaw: -0.7, pitch: 0.42, distance: 14 };

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeVector(vector) {
  const length = Math.hypot(vector.x, vector.y, vector.z) || 1;
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function normalizeBounds(bounds) {
  const source = bounds || {};
  const value = {
    xMin: Number(source.xMin),
    xMax: Number(source.xMax),
    yMin: Number(source.yMin),
    yMax: Number(source.yMax),
    zMin: Number(source.zMin),
    zMax: Number(source.zMax),
  };
  if (!Object.values(value).every(Number.isFinite) || !(value.xMax > value.xMin) || !(value.yMax > value.yMin) || !(value.zMax > value.zMin)) return Object.assign({}, DEFAULT_BOUNDS);
  return value;
}

function normalizeCamera(camera) {
  const source = camera || {};
  const yaw = Number(source.yaw);
  const pitch = Number(source.pitch);
  const distance = Number(source.distance);
  return {
    yaw: Number.isFinite(yaw) ? yaw : DEFAULT_CAMERA.yaw,
    pitch: Number.isFinite(pitch) ? clamp(pitch, -1.45, 1.45) : DEFAULT_CAMERA.pitch,
    distance: Number.isFinite(distance) ? clamp(distance, 2, 100) : DEFAULT_CAMERA.distance,
  };
}

/** Compile `z = f(x,y)` or an implicit `F(x,y,z) = 0` into one residual function. */
function compileSurface(text, mode) {
  const source = String(text || "").trim();
  if (!source) throw new Error("Enter a 3D expression.");
  if (mode === "implicit") {
    const parts = source.split("=");
    if (parts.length !== 2) throw new Error("An implicit 3D surface needs one equals sign, like x^2 + y^2 + z^2 = 9.");
    const left = compileScoped(parts[0].trim(), ["x", "y", "z"], {});
    const right = compileScoped(parts[1].trim(), ["x", "y", "z"], {});
    return { mode: "implicit", text: source, fn: (point) => left(point) - right(point) };
  }
  const explicit = source.replace(/^\s*z\s*=\s*/i, "");
  const surface = compileScoped(explicit, ["x", "y"], {});
  return { mode: "explicit", text: source, fn: (point) => point.z - surface(point) };
}

function cameraPosition(camera) {
  const c = normalizeCamera(camera);
  const horizontal = Math.cos(c.pitch) * c.distance;
  return {
    x: horizontal * Math.cos(c.yaw),
    y: horizontal * Math.sin(c.yaw),
    z: Math.sin(c.pitch) * c.distance,
  };
}

function cameraBasis(camera) {
  const c = normalizeCamera(camera);
  const eye = cameraPosition(c);
  const forward = normalizeVector({ x: -eye.x, y: -eye.y, z: -eye.z });
  const right = normalizeVector({ x: -forward.y, y: forward.x, z: 0 });
  const up = normalizeVector({
    x: right.y * forward.z - right.z * forward.y,
    y: right.z * forward.x - right.x * forward.z,
    z: right.x * forward.y - right.y * forward.x,
  });
  return { eye, forward, right, up };
}

/** Ray-box intersection. Returns null when the ray misses the bounded volume. */
function rayBox(origin, direction, bounds) {
  let near = 0.001;
  let far = 1000;
  for (const axis of ["x", "y", "z"]) {
    const min = bounds[`${axis}Min`];
    const max = bounds[`${axis}Max`];
    const value = origin[axis];
    const delta = direction[axis];
    if (Math.abs(delta) < 1e-12) {
      if (value < min || value > max) return null;
      continue;
    }
    let t1 = (min - value) / delta;
    let t2 = (max - value) / delta;
    if (t1 > t2) [t1, t2] = [t2, t1];
    near = Math.max(near, t1);
    far = Math.min(far, t2);
    if (near > far) return null;
  }
  return { near, far };
}

function pointAt(origin, direction, t) {
  return { x: origin.x + direction.x * t, y: origin.y + direction.y * t, z: origin.z + direction.z * t };
}

function normalAt(fn, point) {
  const eps = 0.002;
  const dx = fn({ x: point.x + eps, y: point.y, z: point.z }) - fn({ x: point.x - eps, y: point.y, z: point.z });
  const dy = fn({ x: point.x, y: point.y + eps, z: point.z }) - fn({ x: point.x, y: point.y - eps, z: point.z });
  const dz = fn({ x: point.x, y: point.y, z: point.z + eps }) - fn({ x: point.x, y: point.y, z: point.z - eps });
  return normalizeVector({ x: dx, y: dy, z: dz });
}

function shade(fn, point, bounds) {
  const normal = normalAt(fn, point);
  const light = normalizeVector({ x: 0.45, y: -0.7, z: 0.65 });
  const brightness = clamp(0.34 + 0.66 * Math.abs(dot(normal, light)), 0.2, 1);
  const span = bounds.zMax - bounds.zMin || 1;
  const height = clamp((point.z - bounds.zMin) / span, 0, 1);
  return [
    Math.round((70 + 80 * height) * brightness),
    Math.round((120 + 70 * height) * brightness),
    Math.round((190 + 50 * height) * brightness),
    255,
  ];
}

/**
 * Render one surface. `resolution` is capped; each ray marches at most
 * `steps` samples and refines the first sign change with eight bisections.
 */
function renderSurface(surface, options) {
  const opts = options || {};
  const width = clamp(Math.round(Number(opts.width) || 240), 32, 640);
  const height = clamp(Math.round(Number(opts.height) || 150), 24, 420);
  if (width * height > MAX_PIXELS) throw new Error(`That 3D image is too large; the limit is ${MAX_PIXELS} pixels.`);
  const bounds = normalizeBounds(opts.bounds);
  const camera = normalizeCamera(opts.camera);
  const basis = cameraBasis(camera);
  const aspect = width / height;
  const fov = 0.9;
  const steps = clamp(Math.round(Number(opts.steps) || 72), 24, 160);
  const pixels = new Uint8ClampedArray(width * height * 4);
  let hits = 0;
  for (let row = 0; row < height; row++) {
    const ndcY = 1 - ((row + 0.5) / height) * 2;
    for (let column = 0; column < width; column++) {
      const ndcX = ((column + 0.5) / width) * 2 - 1;
      const direction = normalizeVector({
        x: basis.forward.x + basis.right.x * ndcX * aspect * fov + basis.up.x * ndcY * fov,
        y: basis.forward.y + basis.right.y * ndcX * aspect * fov + basis.up.y * ndcY * fov,
        z: basis.forward.z + basis.right.z * ndcX * aspect * fov + basis.up.z * ndcY * fov,
      });
      const box = rayBox(basis.eye, direction, bounds);
      if (!box) continue;
      let previousT = box.near;
      let previous = surface.fn(pointAt(basis.eye, direction, previousT));
      let hit = null;
      for (let step = 1; step <= steps; step++) {
        const t = box.near + ((box.far - box.near) * step) / steps;
        const value = surface.fn(pointAt(basis.eye, direction, t));
        if (Number.isFinite(previous) && Number.isFinite(value) && (previous === 0 || previous * value < 0)) {
          let low = previousT;
          let high = t;
          let lowValue = previous;
          for (let refine = 0; refine < 8; refine++) {
            const middle = (low + high) / 2;
            const middleValue = surface.fn(pointAt(basis.eye, direction, middle));
            if (lowValue * middleValue <= 0) high = middle;
            else { low = middle; lowValue = middleValue; }
          }
          hit = pointAt(basis.eye, direction, (low + high) / 2);
          break;
        }
        previousT = t;
        previous = value;
      }
      if (!hit) continue;
      const color = shade(surface.fn, hit, bounds);
      const offset = (row * width + column) * 4;
      pixels[offset] = color[0];
      pixels[offset + 1] = color[1];
      pixels[offset + 2] = color[2];
      pixels[offset + 3] = color[3];
      hits++;
    }
  }
  return {
    width,
    height,
    pixels,
    hits,
    mode: surface.mode,
    expression: surface.text,
    summary: `3D ${surface.mode} surface ${surface.text} with ${hits} visible samples at ${width} by ${height}.`,
  };
}

function projectPoint(point, camera, width, height) {
  const basis = cameraBasis(camera);
  const dx = point.x - basis.eye.x;
  const dy = point.y - basis.eye.y;
  const dz = point.z - basis.eye.z;
  const depth = dx * basis.forward.x + dy * basis.forward.y + dz * basis.forward.z;
  if (!(depth > 0)) return null;
  const aspect = width / height;
  const ndcX = (dx * basis.right.x + dy * basis.right.y + dz * basis.right.z) / (depth * aspect * 0.9);
  const ndcY = (dx * basis.up.x + dy * basis.up.y + dz * basis.up.z) / (depth * 0.9);
  return { x: ((ndcX + 1) / 2) * width, y: ((1 - ndcY) / 2) * height, depth };
}

function parsePoints(text) {
  const source = String(text || "").trim();
  if (!source) return [];
  return source.split(/[;\n]+/).map((entry) => entry.trim()).filter(Boolean).map((entry) => {
    const parts = entry.split(/[,\s]+/).map(Number);
    if (parts.length !== 3 || parts.some((value) => !Number.isFinite(value))) throw new Error(`Point "${entry}" needs three finite coordinates.`);
    return { x: parts[0], y: parts[1], z: parts[2] };
  });
}

const LOD_LEVELS = {
  draft: { label: "Draft", steps: 36, samples: 60 },
  balanced: { label: "Balanced", steps: 64, samples: 160 },
  high: { label: "High", steps: 120, samples: 300 },
};
const MAX_CURVES = 8;
const MAX_CURVE_SAMPLES = 400;

function normalizeLod(value) {
  const key = String(value || "").toLowerCase();
  return Object.prototype.hasOwnProperty.call(LOD_LEVELS, key) ? key : "balanced";
}

function lodSettings(value) {
  return Object.assign({ name: normalizeLod(value) }, LOD_LEVELS[normalizeLod(value)]);
}

function normalizeCurveColor(value, fallback) {
  const source = String(value || "");
  return /^#[0-9a-f]{6}$/i.test(source) ? source.toLowerCase() : fallback || "#ffd166";
}

function splitTopLevel(text) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < text.length; index++) {
    const ch = text[index];
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    else if (ch === "," && depth === 0) {
      parts.push(text.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((part) => part.trim());
}

/** Compile `(x(t), y(t), z(t))`, accepting optional x/y/z labels. */
function compileCurve(text) {
  const source = String(text || "").trim();
  if (!source) throw new Error("Enter a 3D curve, like (cos(t), sin(t), t / 3).");
  let body = source;
  if (body.startsWith("(") && body.endsWith(")")) body = body.slice(1, -1);
  const parts = splitTopLevel(body);
  if (parts.length !== 3) throw new Error("A 3D curve needs three comma-separated expressions in t, like (cos(t), sin(t), t / 3).");
  const labels = ["x", "y", "z"];
  const compiled = parts.map((part, index) => {
    const cleaned = part.replace(new RegExp(`^${labels[index]}\\s*=\\s*`, "i"), "").trim();
    if (!cleaned) throw new Error(`The ${labels[index]} component of the 3D curve is empty.`);
    return compileScoped(cleaned, ["t", "theta"], {});
  });
  return {
    mode: "curve",
    text: source,
    fn(t) {
      const env = { t, theta: t };
      return { x: compiled[0](env), y: compiled[1](env), z: compiled[2](env) };
    },
  };
}

function sampleCurve(curve, options) {
  const opts = options || {};
  const samples = clamp(Math.round(Number(opts.samples) || 160), 8, MAX_CURVE_SAMPLES);
  const tMin = Number(opts.tMin);
  const tMax = Number(opts.tMax);
  if (!Number.isFinite(tMin) || !Number.isFinite(tMax) || !(tMax > tMin)) throw new Error("A 3D curve needs a finite start below its end.");
  const points = [];
  for (let index = 0; index <= samples; index++) {
    const t = tMin + ((tMax - tMin) * index) / samples;
    let point;
    try { point = curve.fn(t); } catch (e) { point = null; }
    if (point && [point.x, point.y, point.z].every(Number.isFinite)) points.push({ x: point.x, y: point.y, z: point.z, t });
    else points.push(null);
  }
  return { text: curve.text, tMin, tMax, samples, points };
}

function drawCurveOverlay(ctx, curves, camera, width, height, options) {
  if (!ctx) return { curves: 0, samples: 0 };
  const opts = options || {};
  let drawn = 0;
  let samples = 0;
  for (const entry of Array.isArray(curves) ? curves : []) {
    const curve = entry && (entry.curve || entry);
    if (!curve || typeof curve.fn !== "function") continue;
    const result = sampleCurve(curve, {
      tMin: entry.tMin === undefined ? opts.tMin : entry.tMin,
      tMax: entry.tMax === undefined ? opts.tMax : entry.tMax,
      samples: entry.samples || opts.samples || 160,
    });
    samples += result.points.length;
    ctx.strokeStyle = normalizeCurveColor(entry.color, opts.color);
    ctx.lineWidth = clamp(Number(entry.width) || 2, 1, 6);
    if (typeof ctx.setLineDash === "function") ctx.setLineDash([]);
    ctx.beginPath();
    let open = false;
    for (const point of result.points) {
      const projected = point ? projectPoint(point, camera, width, height) : null;
      if (!projected) { open = false; continue; }
      if (!open) { ctx.moveTo(projected.x, projected.y); open = true; }
      else ctx.lineTo(projected.x, projected.y);
    }
    ctx.stroke();
    drawn++;
  }
  return { curves: drawn, samples };
}

function drawPointsOverlay(ctx, points, camera, width, height) {
  if (!ctx || !Array.isArray(points)) return 0;
  let drawn = 0;
  for (let index = 0; index < points.length; index++) {
    const projected = projectPoint(points[index], camera, width, height);
    if (!projected) continue;
    ctx.beginPath();
    ctx.arc(projected.x, projected.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#ffd166";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#1f2937";
    ctx.stroke();
    if (typeof ctx.fillText === "function") {
      ctx.font = "12px sans-serif";
      ctx.fillStyle = "#f8fafc";
      ctx.fillText(`P${index + 1}`, projected.x + 6, projected.y - 6);
    }
    drawn++;
  }
  return drawn;
}

function curveSummary(curves, options) {
  const count = Array.isArray(curves) ? curves.length : 0;
  const lod = lodSettings((options || {}).lod);
  return `${count} 3D curve${count === 1 ? "" : "s"} at ${lod.label.toLowerCase()} detail.`;
}

module.exports = {
  DEFAULT_BOUNDS,
  DEFAULT_CAMERA,
  LOD_LEVELS,
  MAX_CURVES,
  MAX_CURVE_SAMPLES,
  MAX_PIXELS,
  cameraBasis,
  cameraPosition,
  compileCurve,
  compileSurface,
  curveSummary,
  drawCurveOverlay,
  drawPointsOverlay,
  lodSettings,
  normalizeCurveColor,
  normalizeLod,
  sampleCurve,
  normalizeBounds,
  normalizeCamera,
  parsePoints,
  projectPoint,
  rayBox,
  renderSurface,
};
