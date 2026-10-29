"use strict";
/*
 * Pen and highlighter strokes for PDF pages.
 *
 * Points are stored normalized to the page (0..1), so the same sidecar works
 * at any render scale. Widths are also fractions of the page width. This module
 * has no Obsidian dependency and no PDF dependency; the modal supplies the
 * canvas and the sidecar writer.
 */

const INK_COLORS = ["yellow", "green", "blue", "red", "purple", "gray"];
const INK_TOOLS = ["pen", "highlighter"];
const MAX_INK_POINTS = 4000;
const MAX_INK_STROKES = 200;
const INK_COLOR_HEX = {
  yellow: "#f2c94c",
  green: "#6fcf97",
  blue: "#56a9f2",
  red: "#eb5757",
  purple: "#bb6bd9",
  gray: "#828282",
};

function str(value) {
  return value === undefined || value === null ? "" : String(value);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, places) {
  const scale = Math.pow(10, places || 0);
  return Math.round(value * scale) / scale;
}

function normalizePoint(value) {
  const x = Array.isArray(value) ? value[0] : value && value.x;
  const y = Array.isArray(value) ? value[1] : value && value.y;
  const nx = Number(x);
  const ny = Number(y);
  if (!Number.isFinite(nx) || !Number.isFinite(ny)) return null;
  return [round(clamp(nx, 0, 1), 4), round(clamp(ny, 0, 1), 4)];
}

/** One stroke in the durable sidecar format. Invalid/empty strokes are dropped. */
function normalizeInkStroke(input) {
  const src = input && typeof input === "object" ? input : {};
  const tool = INK_TOOLS.includes(str(src.tool)) ? str(src.tool) : "pen";
  const points = [];
  for (const raw of Array.isArray(src.points) ? src.points : []) {
    const point = normalizePoint(raw);
    if (point) points.push(point);
    if (points.length >= MAX_INK_POINTS) break;
  }
  if (!points.length) return null;
  const defaultWidth = tool === "highlighter" ? 0.018 : 0.003;
  const defaultOpacity = tool === "highlighter" ? 0.35 : 0.9;
  const width = clamp(Number(src.width) || defaultWidth, 0.0005, 0.08);
  const opacity = clamp(Number(src.opacity) || defaultOpacity, 0.05, 1);
  const color = INK_COLORS.includes(str(src.color)) ? str(src.color) : tool === "highlighter" ? "yellow" : "blue";
  return {
    tool,
    color,
    width: round(width, 4),
    opacity: round(opacity, 2),
    points,
  };
}

function normalizeInkStrokes(list) {
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const stroke = normalizeInkStroke(raw);
    if (stroke) out.push(stroke);
    if (out.length >= MAX_INK_STROKES) break;
  }
  return out;
}

/** Distance from a point to a line segment, all in normalized page coordinates. */
function pointToSegmentDistance(point, a, b) {
  const px = point[0];
  const py = point[1];
  const ax = a[0];
  const ay = a[1];
  const bx = b[0];
  const by = b[1];
  const dx = bx - ax;
  const dy = by - ay;
  const length = dx * dx + dy * dy;
  let t = 0;
  if (length > 0) t = clamp(((px - ax) * dx + (py - ay) * dy) / length, 0, 1);
  const x = ax + t * dx;
  const y = ay + t * dy;
  return Math.hypot(px - x, py - y);
}

function hitStroke(stroke, point, tolerance) {
  const points = stroke && Array.isArray(stroke.points) ? stroke.points : [];
  if (!points.length) return false;
  const reach = Math.max(Number(tolerance) || 0, Number(stroke.width) / 2 || 0);
  if (points.length === 1) return Math.hypot(point[0] - points[0][0], point[1] - points[0][1]) <= reach;
  for (let i = 1; i < points.length; i++) {
    if (pointToSegmentDistance(point, points[i - 1], points[i]) <= reach) return true;
  }
  return false;
}

/** Removes every stroke touched by the eraser at `point`. */
function eraseStrokesAt(strokes, point, tolerance) {
  return (Array.isArray(strokes) ? strokes : []).filter((stroke) => !hitStroke(stroke, point, tolerance));
}

function colorFor(stroke) {
  return INK_COLOR_HEX[stroke && stroke.color] || INK_COLOR_HEX.yellow;
}

function lineWidthFor(stroke, canvasWidth) {
  return Math.max(1, Number(canvasWidth) * (Number(stroke && stroke.width) || 0.003));
}

function drawInkStrokes(ctx, strokes, width, height) {
  if (!ctx) return;
  ctx.clearRect(0, 0, width, height);
  for (const stroke of Array.isArray(strokes) ? strokes : []) {
    const points = stroke && Array.isArray(stroke.points) ? stroke.points : [];
    if (!points.length) continue;
    ctx.save();
    ctx.globalAlpha = clamp(Number(stroke.opacity) || 0.9, 0.05, 1);
    ctx.strokeStyle = colorFor(stroke);
    ctx.fillStyle = colorFor(stroke);
    ctx.lineWidth = lineWidthFor(stroke, width);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (points.length === 1) {
      ctx.beginPath();
      ctx.arc(points[0][0] * width, points[0][1] * height, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(points[0][0] * width, points[0][1] * height);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0] * width, points[i][1] * height);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/** Draws only the newest segment while the pointer is down, then a full redraw caps it. */
function drawInkSegment(ctx, stroke, from, to, width, height) {
  if (!ctx || !stroke || !from || !to) return;
  ctx.save();
  ctx.globalAlpha = clamp(Number(stroke.opacity) || 0.9, 0.05, 1);
  ctx.strokeStyle = colorFor(stroke);
  ctx.lineWidth = lineWidthFor(stroke, width);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(from[0] * width, from[1] * height);
  ctx.lineTo(to[0] * width, to[1] * height);
  ctx.stroke();
  ctx.restore();
}

module.exports = {
  INK_COLORS,
  INK_COLOR_HEX,
  INK_TOOLS,
  MAX_INK_POINTS,
  MAX_INK_STROKES,
  drawInkSegment,
  drawInkStrokes,
  eraseStrokesAt,
  hitStroke,
  normalizeInkStroke,
  normalizeInkStrokes,
  normalizePoint,
  pointToSegmentDistance,
  clamp,
};
