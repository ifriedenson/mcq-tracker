"use strict";
/*
 * Complex domain coloring for the Reference graph.
 *
 * `compileComplex` comes from src/complex.js. This module only samples a
 * rectangular window, maps each finite value's argument to hue and magnitude
 * to lightness, and returns a deterministic RGBA buffer. There is no DOM,
 * Obsidian, network or third-party code here.
 */
const complex = require("./complex");

const MAX_PIXELS = 160000;

function hslToRgb(hue, saturation, lightness) {
  const h = ((hue % 1) + 1) % 1;
  const s = Math.min(1, Math.max(0, saturation));
  const l = Math.min(1, Math.max(0, lightness));
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const sector = h * 6;
  const x = chroma * (1 - Math.abs((sector % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (sector < 1) [r, g, b] = [chroma, x, 0];
  else if (sector < 2) [r, g, b] = [x, chroma, 0];
  else if (sector < 3) [r, g, b] = [0, chroma, x];
  else if (sector < 4) [r, g, b] = [0, x, chroma];
  else if (sector < 5) [r, g, b] = [x, 0, chroma];
  else [r, g, b] = [chroma, 0, x];
  const m = l - chroma / 2;
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255), 255];
}

/** One complex value as an RGBA pixel. Non-finite values are transparent. */
function colorForValue(value) {
  const z = complex.from(value);
  if (!complex.finite(z) || !Number.isFinite(complex.abs(z))) return [0, 0, 0, 0];
  const hue = complex.arg(z) / (Math.PI * 2);
  const magnitude = complex.abs(z);
  const lightness = 0.48 + 0.30 * Math.tanh(Math.log1p(magnitude) / 3);
  return hslToRgb(hue, 0.72, lightness);
}

function formatWindow(options) {
  return `x from ${options.xMin} to ${options.xMax}, y from ${options.yMin} to ${options.yMax}`;
}

/**
 * Render `f(z)` over the window. The returned pixels are row-major RGBA and
 * can be copied into a canvas ImageData by the view.
 */
function renderDomain(expression, options) {
  const opts = options || {};
  const text = String(expression || "").trim();
  if (!text) throw new Error("Enter a complex expression in z.");
  const xMin = Number(opts.xMin);
  const xMax = Number(opts.xMax);
  const yMin = Number(opts.yMin);
  const yMax = Number(opts.yMax);
  if (![xMin, xMax, yMin, yMax].every(Number.isFinite) || !(xMax > xMin) || !(yMax > yMin)) {
    throw new Error("The complex graph window must have finite, increasing bounds.");
  }
  const width = Math.max(16, Math.min(640, Math.round(Number(opts.width) || 320)));
  const height = Math.max(16, Math.min(400, Math.round(Number(opts.height) || 160)));
  if (width * height > MAX_PIXELS) throw new Error(`That complex image is too large; the limit is ${MAX_PIXELS} pixels.`);
  const fn = complex.compileComplex(text, { variables: ["z", "x", "y"] });
  const pixels = new Uint8ClampedArray(width * height * 4);
  const xSpan = xMax - xMin;
  const ySpan = yMax - yMin;
  let finite = 0;
  for (let row = 0; row < height; row++) {
    const imaginary = yMax - ((row + 0.5) / height) * ySpan;
    for (let column = 0; column < width; column++) {
      const real = xMin + ((column + 0.5) / width) * xSpan;
      let value;
      try {
        value = fn({ z: complex.make(real, imaginary), x: complex.make(real, 0), y: complex.make(imaginary, 0) });
      } catch (e) {
        value = complex.make(NaN, NaN);
      }
      const color = colorForValue(value);
      if (color[3]) finite++;
      const offset = (row * width + column) * 4;
      pixels[offset] = color[0];
      pixels[offset + 1] = color[1];
      pixels[offset + 2] = color[2];
      pixels[offset + 3] = color[3];
    }
  }
  return {
    width,
    height,
    pixels,
    expression: text,
    finite,
    summary: `Complex domain coloring of ${text} over ${formatWindow(opts)} with ${width} by ${height} samples; hue is argument and lightness is magnitude.`,
  };
}

module.exports = { MAX_PIXELS, colorForValue, hslToRgb, renderDomain };
