"use strict";
/*
 * Math and chemistry rendering helpers.
 *
 * Obsidian renders standard MathJax everywhere we pass Markdown to
 * MarkdownRenderer. mhchem is not part of the default MathJax build, so
 * \ce{...} can show up as raw text unless the user has Extended MathJax.
 * This module rewrites only simple, unambiguous chemistry notation into
 * ordinary MathJax. Anything more complex is left exactly as written, so an
 * mhchem installation still handles it and we never guess at a formula.
 */

const MATH_SAMPLES = [
  { label: "Fraction", markdown: "$\\frac{3}{4}x^2 - \\frac{1}{2}$" },
  { label: "Matrix", markdown: "$$\\begin{bmatrix}1 & 2\\\\3 & 4\\end{bmatrix}$$" },
  { label: "Integral", markdown: "$\\int_0^1 x^2\\,dx = \\frac{1}{3}$" },
  { label: "Chemical formula", markdown: "$\\ce{Ca(OH)2}$" },
  { label: "Chemical equation", markdown: "$\\ce{2H2 + O2 -> 2H2O}$" },
];

const ARROWS = {
  "->": "\\rightarrow",
  "-->": "\\longrightarrow",
  "<-": "\\leftarrow",
  "<--": "\\longleftarrow",
  "<->": "\\leftrightarrow",
  "<=>": "\\rightleftharpoons",
};

const ARROW_RE = /\s*(<=>|<->|<--|-->|->|<-)\s*/;

function parseFormula(text, start) {
  let out = "";
  let i = start;
  while (i < text.length) {
    const c = text[i];
    if (c === ")") return { out, i };
    if (c === "(") {
      const inner = parseFormula(text, i + 1);
      if (!inner || text[inner.i] !== ")" || !inner.out) return null;
      i = inner.i + 1;
      let digits = "";
      while (i < text.length && /\d/.test(text[i])) digits += text[i++];
      out += `(${inner.out})${digits ? `_{${digits}}` : ""}`;
      continue;
    }
    if (!/[A-Z]/.test(c)) return null;
    let symbol = c;
    i++;
    if (i < text.length && /[a-z]/.test(text[i])) symbol += text[i++];
    let digits = "";
    while (i < text.length && /\d/.test(text[i])) digits += text[i++];
    out += symbol + (digits ? `_{${digits}}` : "");
  }
  return { out, i };
}

/** One species: optional coefficient, a simple formula, optional charge and state. */
function convertSpecies(raw) {
  let text = String(raw || "").trim();
  if (!text) return null;
  let coefficient = "";
  const cm = text.match(/^(\d+(?:\.\d+)?)\s*(?=[A-Z(])/);
  if (cm) {
    coefficient = cm[1];
    text = text.slice(cm[0].length);
  }
  let state = "";
  const sm = text.match(/\((s|l|g|aq)\)$/i);
  if (sm) {
    state = sm[1].toLowerCase();
    text = text.slice(0, -sm[0].length);
  }
  let charge = "";
  const ch = text.match(/\^(\d*[+-])$/);
  if (ch) {
    charge = ch[1];
    text = text.slice(0, -ch[0].length);
  } else if (/[+-]$/.test(text)) {
    charge = text.slice(-1);
    text = text.slice(0, -1);
  }
  if (!text) return null;
  const parsed = parseFormula(text, 0);
  if (!parsed || parsed.i !== text.length || !parsed.out) return null;
  return `${coefficient}\\mathrm{${parsed.out}}${charge ? `^{${charge}}` : ""}${state ? `\\,(\\mathrm{${state}})` : ""}`;
}

/** One side of a reaction: species joined by a real plus sign (spaces required). */
function convertSide(side) {
  const terms = String(side || "").trim().split(/\s+\+\s+/);
  const converted = terms.map(convertSpecies);
  if (converted.some((term) => !term)) return null;
  return converted.join(" + ");
}

/** Convert one \ce{} body, or null when it uses anything beyond the safe subset. */
function convertCeBody(body) {
  const text = String(body || "").trim();
  if (!text) return null;
  if (/[\\{}$#*[\]|]/.test(text)) return null;
  const parts = text.split(ARROW_RE);
  if (parts.length === 1) return convertSide(parts[0]);
  let out = "";
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) {
      const arrow = ARROWS[parts[i]];
      if (!arrow) return null;
      out += ` ${arrow} `;
    } else {
      const side = convertSide(parts[i]);
      if (!side) return null;
      out += side;
    }
  }
  return out.trim();
}

function findClosingBrace(text, start) {
  let depth = 1;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "\\") {
      i++;
      continue;
    }
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Replace simple \ce{} commands inside one math span. Complex ones stay untouched. */
function convertCeInMath(math) {
  let out = "";
  let i = 0;
  while (i < math.length) {
    const start = math.indexOf("\\ce{", i);
    if (start < 0) {
      out += math.slice(i);
      break;
    }
    out += math.slice(i, start);
    const end = findClosingBrace(math, start + 4);
    if (end < 0) {
      out += math.slice(start);
      break;
    }
    const body = math.slice(start + 4, end);
    const converted = convertCeBody(body);
    out += converted === null ? math.slice(start, end + 1) : converted;
    i = end + 1;
  }
  return out;
}

function convertMathSpan(math) {
  return math.includes("\\ce{") ? convertCeInMath(math) : math;
}

/** Find $...$, $$...$$, \(...\) and \[...\] runs and convert only their contents. */
function convertMarkdownMath(markdown) {
  const text = String(markdown || "");
  let out = "";
  let i = 0;
  while (i < text.length) {
    if (text.startsWith("$$", i)) {
      const end = text.indexOf("$$", i + 2);
      if (end < 0) return out + text.slice(i);
      out += "$$" + convertMathSpan(text.slice(i + 2, end)) + "$$";
      i = end + 2;
      continue;
    }
    if (text.startsWith("\\[", i)) {
      const end = text.indexOf("\\]", i + 2);
      if (end < 0) return out + text.slice(i);
      out += "\\[" + convertMathSpan(text.slice(i + 2, end)) + "\\]";
      i = end + 2;
      continue;
    }
    if (text.startsWith("\\(", i)) {
      const end = text.indexOf("\\)", i + 2);
      if (end < 0) return out + text.slice(i);
      out += "\\(" + convertMathSpan(text.slice(i + 2, end)) + "\\)";
      i = end + 2;
      continue;
    }
    if (text[i] === "$" && text[i - 1] !== "\\") {
      let end = i + 1;
      while (end < text.length && (text[end] !== "$" || text[end - 1] === "\\")) end++;
      if (end >= text.length) return out + text.slice(i);
      out += "$" + convertMathSpan(text.slice(i + 1, end)) + "$";
      i = end + 1;
      continue;
    }
    out += text[i++];
  }
  return out;
}

/**
 * Render-time preparation. Fenced code, inline code and escaped dollar signs
 * are left alone. The note itself is never modified.
 */
function prepareMathMarkdown(markdown) {
  const text = String(markdown || "");
  if (!text.includes("\\ce{")) return text;
  const parts = text.split(/(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/);
  return parts.map((part, i) => (i % 2 === 1 ? part : convertMarkdownMath(part))).join("");
}

module.exports = {
  MATH_SAMPLES,
  ARROWS,
  parseFormula,
  convertSpecies,
  convertSide,
  convertCeBody,
  convertCeInMath,
  convertMarkdownMath,
  prepareMathMarkdown,
};
