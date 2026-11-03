"use strict";
/*
 * Bounded 2D vector field for the Reference panel.
 *
 * P(x,y) and Q(x,y) compile through the project's restricted graph parser. The
 * sampler, quiver geometry and RK4 streamlines are pure and capped; painting is
 * a plain canvas adapter with no WebGL, network request or third-party code.
 */
const { compileScoped } = require("./reference-graph");

const DEFAULTS = {
  xMin: -6,
  xMax: 6,
  yMin: -6,
  yMax: 6,
  density: 13,
  scale: 0.8,
  normalize: true,
  streamlines: true,
  streamlineLength: 70,
  color: "#5b8def",
};
const MAX_GRID = 25;
const MAX_STREAMLINE_SEEDS = 16;
const MAX_STREAMLINE_STEPS = 160;
const COLORS = ["#5b8def", "#e5534b", "#2ea043", "#d29922", "#a371f7", "#39c5cf"];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value).toLowerCase() : DEFAULTS.color;
}

function normalizeSettings(settings) {
  const source = settings || {};
  const xMin = finite(source.xMin, DEFAULTS.xMin);
  const xMax = finite(source.xMax, DEFAULTS.xMax);
  const yMin = finite(source.yMin, DEFAULTS.yMin);
  const yMax = finite(source.yMax, DEFAULTS.yMax);
  const spanOk = xMax > xMin && yMax > yMin;
  return {
    xMin: spanOk ? xMin : DEFAULTS.xMin,
    xMax: spanOk ? xMax : DEFAULTS.xMax,
    yMin: spanOk ? yMin : DEFAULTS.yMin,
    yMax: spanOk ? yMax : DEFAULTS.yMax,
    density: clamp(Math.round(finite(source.density, DEFAULTS.density)), 3, MAX_GRID),
    scale: clamp(finite(source.scale, DEFAULTS.scale), 0.1, 3),
    normalize: source.normalize !== false,
    streamlines: source.streamlines !== false,
    streamlineLength: clamp(Math.round(finite(source.streamlineLength, DEFAULTS.streamlineLength)), 12, MAX_STREAMLINE_STEPS),
    color: normalizeColor(source.color),
  };
}

/** Compile `P(x,y), Q(x,y)` into one bounded vector evaluator. */
function compileField(pText, qText) {
  const pSource = String(pText === undefined || pText === null ? "" : pText).trim();
  const qSource = String(qText === undefined || qText === null ? "" : qText).trim();
  if (!pSource || !qSource) throw new Error("A vector field needs both P(x, y) and Q(x, y).");
  const p = compileScoped(pSource, ["x", "y"], {});
  const q = compileScoped(qSource, ["x", "y"], {});
  return {
    text: `P = ${pSource}, Q = ${qSource}`,
    pText: pSource,
    qText: qSource,
    fn(x, y) {
      const value = { x: p({ x, y }), y: q({ x, y }) };
      return { x: Number.isFinite(value.x) ? value.x : NaN, y: Number.isFinite(value.y) ? value.y : NaN };
    },
  };
}

function sampleField(field, settings) {
  const opts = normalizeSettings(settings);
  const vectors = [];
  let max = 0;
  let min = Infinity;
  for (let row = 0; row < opts.density; row++) {
    const y = opts.yMin + ((row + 0.5) / opts.density) * (opts.yMax - opts.yMin);
    for (let column = 0; column < opts.density; column++) {
      const x = opts.xMin + ((column + 0.5) / opts.density) * (opts.xMax - opts.xMin);
      const vector = field.fn(x, y);
      if (!Number.isFinite(vector.x) || !Number.isFinite(vector.y)) continue;
      const magnitude = Math.hypot(vector.x, vector.y);
      if (!Number.isFinite(magnitude)) continue;
      min = Math.min(min, magnitude);
      max = Math.max(max, magnitude);
      vectors.push({ x, y, vx: vector.x, vy: vector.y, magnitude });
    }
  }
  return {
    vectors,
    maxMagnitude: max || 1,
    minMagnitude: Number.isFinite(min) ? min : 0,
    settings: opts,
  };
}

function arrowLength(vector, maxMagnitude, settings) {
  const opts = normalizeSettings(settings);
  const cell = Math.min((opts.xMax - opts.xMin) / opts.density, (opts.yMax - opts.yMin) / opts.density);
  const magnitude = opts.normalize ? 1 : vector.magnitude / (maxMagnitude || 1);
  return Math.max(cell * 0.08, cell * opts.scale * Math.min(magnitude, 1.5));
}

function quiverArrows(sample, settings) {
  const opts = normalizeSettings((sample && sample.settings) || settings);
  const arrows = [];
  for (const vector of (sample && sample.vectors) || []) {
    const length = arrowLength(vector, sample.maxMagnitude, opts);
    const magnitude = vector.magnitude || 1;
    const dx = (vector.vx / magnitude) * length;
    const dy = (vector.vy / magnitude) * length;
    arrows.push({
      x: vector.x,
      y: vector.y,
      endX: vector.x + dx,
      endY: vector.y + dy,
      magnitude: vector.magnitude,
    });
  }
  return arrows;
}

function inside(x, y, settings) {
  return x >= settings.xMin && x <= settings.xMax && y >= settings.yMin && y <= settings.yMax;
}

function rk4(field, x, y, step) {
  const k1 = field.fn(x, y);
  const k2 = field.fn(x + k1.x * step * 0.5, y + k1.y * step * 0.5);
  const k3 = field.fn(x + k2.x * step * 0.5, y + k2.y * step * 0.5);
  const k4 = field.fn(x + k3.x * step, y + k3.y * step);
  const dx = (k1.x + 2 * k2.x + 2 * k3.x + k4.x) / 6;
  const dy = (k1.y + 2 * k2.y + 2 * k3.y + k4.y) / 6;
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  return { x: x + dx * step, y: y + dy * step };
}

function buildStreamlines(field, settings) {
  const opts = normalizeSettings(settings);
  const sample = sampleField(field, opts);
  const seeds = sample.vectors
    .filter((_vector, index) => index % Math.max(1, Math.ceil(sample.vectors.length / MAX_STREAMLINE_SEEDS)) === 0)
    .slice(0, MAX_STREAMLINE_SEEDS);
  const step = Math.min((opts.xMax - opts.xMin) / opts.density, (opts.yMax - opts.yMin) / opts.density) * 0.45;
  const lines = [];
  for (const seed of seeds) {
    const forward = [{ x: seed.x, y: seed.y }];
    let current = { x: seed.x, y: seed.y };
    for (let index = 0; index < opts.streamlineLength; index++) {
      const next = rk4(field, current.x, current.y, step);
      if (!next || !inside(next.x, next.y, opts)) break;
      forward.push(next);
      current = next;
    }
    const backward = [];
    current = { x: seed.x, y: seed.y };
    for (let index = 0; index < opts.streamlineLength; index++) {
      const next = rk4(field, current.x, current.y, -step);
      if (!next || !inside(next.x, next.y, opts)) break;
      backward.unshift(next);
      current = next;
    }
    const points = backward.concat(forward);
    if (points.length > 1) lines.push(points);
  }
  return { lines, seeds: seeds.length, settings: opts, sample };
}

function fieldSummary(sample, settings) {
  const opts = normalizeSettings((sample && sample.settings) || settings);
  const count = sample && Array.isArray(sample.vectors) ? sample.vectors.length : 0;
  if (!count) return "The vector field has no finite samples in this window.";
  return `Vector field with ${count} sampled vectors from (${opts.xMin}, ${opts.yMin}) to (${opts.xMax}, ${opts.yMax}); magnitude runs from ${sample.minMagnitude.toPrecision(3)} to ${sample.maxMagnitude.toPrecision(3)}.`;
}

function paintVectorField(ctx, field, settings, width, height) {
  if (!ctx) return null;
  const opts = normalizeSettings(settings);
  const sample = sampleField(field, opts);
  const px = (x) => ((x - opts.xMin) / (opts.xMax - opts.xMin)) * width;
  const py = (y) => height - ((y - opts.yMin) / (opts.yMax - opts.yMin)) * height;
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = "rgba(127,127,127,0.18)";
  ctx.lineWidth = 1;
  for (let index = 0; index <= opts.density; index++) {
    const x = opts.xMin + (index / opts.density) * (opts.xMax - opts.xMin);
    const y = opts.yMin + (index / opts.density) * (opts.yMax - opts.yMin);
    ctx.beginPath(); ctx.moveTo(px(x), 0); ctx.lineTo(px(x), height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, py(y)); ctx.lineTo(width, py(y)); ctx.stroke();
  }
  ctx.strokeStyle = "rgba(127,127,127,0.55)";
  ctx.beginPath();
  if (opts.yMin <= 0 && opts.yMax >= 0) { ctx.moveTo(0, py(0)); ctx.lineTo(width, py(0)); }
  if (opts.xMin <= 0 && opts.xMax >= 0) { ctx.moveTo(px(0), 0); ctx.lineTo(px(0), height); }
  ctx.stroke();

  const stream = buildStreamlines(field, opts);
  if (opts.streamlines) {
    ctx.strokeStyle = opts.color;
    ctx.lineWidth = 1.3;
    if (typeof ctx.setLineDash === "function") ctx.setLineDash([3, 3]);
    for (const line of stream.lines) {
      ctx.beginPath();
      line.forEach((point, index) => {
        if (index === 0) ctx.moveTo(px(point.x), py(point.y));
        else ctx.lineTo(px(point.x), py(point.y));
      });
      ctx.stroke();
    }
    if (typeof ctx.setLineDash === "function") ctx.setLineDash([]);
  }

  const arrows = quiverArrows(sample, opts);
  const head = Math.max(3, Math.min(7, width / 90));
  for (const arrow of arrows) {
    const x1 = px(arrow.x);
    const y1 = py(arrow.y);
    const x2 = px(arrow.endX);
    const y2 = py(arrow.endY);
    const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.strokeStyle = opts.color;
    ctx.fillStyle = opts.color;
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(angle - 0.45), y2 - head * Math.sin(angle - 0.45));
    ctx.lineTo(x2 - head * Math.cos(angle + 0.45), y2 - head * Math.sin(angle + 0.45));
    ctx.closePath(); ctx.fill();
  }
  return { sample, arrows: arrows.length, streamlines: stream.lines.length, summary: fieldSummary(sample, opts) };
}

module.exports = {
  COLORS,
  DEFAULTS,
  MAX_GRID,
  MAX_STREAMLINE_SEEDS,
  MAX_STREAMLINE_STEPS,
  arrowLength,
  buildStreamlines,
  compileField,
  fieldSummary,
  normalizeColor,
  normalizeSettings,
  paintVectorField,
  quiverArrows,
  sampleField,
};
