"use strict";
/*
 * Background-image calibration for the Reference graph.
 *
 * A state names one vault image and two calibration points. Each point pairs an
 * image fraction (0–1 across and down) with graph coordinates, so the image can be
 * placed, mirrored or flipped by axis-aligned scaling. This module only does that
 * arithmetic: no DOM, Obsidian, network or image decoding lives here, and an
 * unusable calibration is always a `{ok:false, reason, message}` refusal.
 */

const IMAGE_LIMITS = {
  minOpacity: 0,
  maxOpacity: 1,
  defaultOpacity: 0.45,
};

function textValue(value) {
  return value === null || value === undefined ? "" : String(value);
}

function finiteNumber(value, fallback) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : Number.NaN;
}

function normalizeOpacity(value) {
  const number = finiteNumber(value, IMAGE_LIMITS.defaultOpacity);
  if (!Number.isFinite(number)) return IMAGE_LIMITS.defaultOpacity;
  return Math.min(IMAGE_LIMITS.maxOpacity, Math.max(IMAGE_LIMITS.minOpacity, number));
}

function normalizePoint(value, defaults) {
  const source = value && typeof value === "object" ? value : {};
  return {
    imageX: finiteNumber(source.imageX, defaults.imageX),
    imageY: finiteNumber(source.imageY, defaults.imageY),
    graphX: finiteNumber(source.graphX, defaults.graphX),
    graphY: finiteNumber(source.graphY, defaults.graphY),
  };
}

/** A canonical state; a missing or old setting becomes the default uncalibrated state. */
function normalizeImageState(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    path: textValue(source.path).trim(),
    pointA: normalizePoint(source.pointA, { imageX: 0, imageY: 0, graphX: -10, graphY: 10 }),
    pointB: normalizePoint(source.pointB, { imageX: 1, imageY: 1, graphX: 10, graphY: -10 }),
    opacity: normalizeOpacity(source.opacity),
  };
}

function refusal(message) {
  return { ok: false, reason: "calibration", message };
}

/**
 * Axis-aligned placement from the two calibration points. The image's graph
 * origin is extrapolated from point A, so any two non-degenerate points work.
 */
function imagePlacement(state) {
  const value = normalizeImageState(state);
  const points = [["1", value.pointA], ["2", value.pointB]];
  for (const [label, point] of points) {
    for (const key of ["imageX", "imageY", "graphX", "graphY"]) {
      if (!Number.isFinite(point[key])) return refusal(`Image point ${label} needs four numbers.`);
    }
    for (const key of ["imageX", "imageY"]) {
      if (point[key] < 0 || point[key] > 1) return refusal(`Image point ${label} must sit between 0 and 1 across and down.`);
    }
  }
  const acrossImage = value.pointB.imageX - value.pointA.imageX;
  const acrossGraph = value.pointB.graphX - value.pointA.graphX;
  const downImage = value.pointB.imageY - value.pointA.imageY;
  const downGraph = value.pointB.graphY - value.pointA.graphY;
  if (Math.abs(acrossImage) < 1e-9) return refusal("The two calibration points must differ in their image across positions.");
  if (Math.abs(downImage) < 1e-9) return refusal("The two calibration points must differ in their image down positions.");
  const scaleX = acrossGraph / acrossImage;
  const scaleY = downGraph / downImage;
  if (!Number.isFinite(scaleX) || !Number.isFinite(scaleY)) return refusal("The calibration points do not define a usable image scale.");
  const x0 = value.pointA.graphX - value.pointA.imageX * scaleX;
  const y0 = value.pointA.graphY - value.pointA.imageY * scaleY;
  return {
    ok: true,
    x0,
    y0,
    x1: x0 + scaleX,
    y1: y0 + scaleY,
    scaleX,
    scaleY,
  };
}

/** The destination rectangle in canvas pixels for a graph window and canvas size. */
function imageRectPixels(state, view, width, height) {
  const placement = imagePlacement(state);
  if (!placement.ok) return placement;
  const xMin = Number(view && view.xMin);
  const xMax = Number(view && view.xMax);
  const yMin = Number(view && view.yMin);
  const yMax = Number(view && view.yMax);
  const w = Number(width);
  const h = Number(height);
  if (![xMin, xMax, yMin, yMax, w, h].every(Number.isFinite) || !(xMax > xMin) || !(yMax > yMin) || !(w > 0) || !(h > 0)) {
    return refusal("The graph window cannot place the background image.");
  }
  const px = (x) => ((x - xMin) / (xMax - xMin)) * w;
  const py = (y) => h - ((y - yMin) / (yMax - yMin)) * h;
  const left = Math.min(px(placement.x0), px(placement.x1));
  const right = Math.max(px(placement.x0), px(placement.x1));
  const top = Math.min(py(placement.y0), py(placement.y1));
  const bottom = Math.max(py(placement.y0), py(placement.y1));
  return { ok: true, left, top, width: right - left, height: bottom - top };
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "\u2014";
  return String(Number(number.toPrecision(6)));
}

/** A short state sentence for live regions and the accessible summary. */
function imageSummary(state) {
  const value = normalizeImageState(state);
  if (!value.path) return "";
  const placement = imagePlacement(value);
  if (!placement.ok) return `Background image ${value.path} needs calibration: ${placement.message}`;
  const point = (entry) => `(${formatNumber(entry.graphX)}, ${formatNumber(entry.graphY)})`;
  return `Background image ${value.path} calibrated with image point 1 at graph ${point(value.pointA)} and image point 2 at graph ${point(value.pointB)}.`;
}

module.exports = {
  IMAGE_LIMITS,
  normalizeImageState,
  normalizeOpacity,
  imagePlacement,
  imageRectPixels,
  imageSummary,
};
