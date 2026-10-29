"use strict";
/*
 * Numeric answer grading for student-produced responses (SPR).
 *
 * The plugin deliberately does not evaluate expressions. It reads the number a
 * student wrote (fraction, decimal, scientific notation or percentage), checks
 * an optional unit, and compares it with the note's answer using an optional
 * absolute, relative or percentage tolerance. Everything here is pure so the
 * same rules run in practice, timed tests and the test suite.
 */

const SUPERSCRIPT = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-", "⁺": "+" };
const SUPERSCRIPT_OUT = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻", "+": "⁺" };

const VULGAR_FRACTIONS = { "½": "1/2", "⅓": "1/3", "⅔": "2/3", "¼": "1/4", "¾": "3/4", "⅕": "1/5", "⅖": "2/5", "⅗": "3/5", "⅘": "4/5", "⅙": "1/6", "⅚": "5/6", "⅛": "1/8", "⅜": "3/8", "⅝": "5/8", "⅞": "7/8" };

const NUMBER_RE = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

/* --------------------------------------------------------------- units */

/*
 * A small table of units students actually type. It is intentionally not a
 * full unit library: each entry gives a dimension and a factor to the SI base
 * unit, so 1 km and 1000 m compare correctly and a length can never be accepted
 * for a mass. Temperature uses offsets and is handled separately.
 */
const UNIT_DEFINITIONS = [
  // length
  ["m", "length", 1, ["meter", "meters", "metre", "metres"]],
  ["km", "length", 1000],
  ["cm", "length", 0.01],
  ["mm", "length", 0.001],
  ["um", "length", 1e-6, ["µm", "micrometer", "micrometers", "micron", "microns"]],
  ["nm", "length", 1e-9, ["nanometer", "nanometers"]],
  ["in", "length", 0.0254, ["inch", "inches"]],
  ["ft", "length", 0.3048, ["foot", "feet"]],
  ["yd", "length", 0.9144, ["yard", "yards"]],
  ["mi", "length", 1609.344, ["mile", "miles"]],
  ["au", "length", 1.495978707e11, ["astronomicalunit"]],
  // mass
  ["kg", "mass", 1, ["kilogram", "kilograms"]],
  ["g", "mass", 0.001, ["gram", "grams"]],
  ["mg", "mass", 1e-6, ["milligram", "milligrams"]],
  ["ug", "mass", 1e-9, ["µg", "microgram", "micrograms"]],
  ["lb", "mass", 0.45359237, ["lbs", "pound", "pounds"]],
  ["oz", "mass", 0.028349523125, ["ounce", "ounces"]],
  ["tonne", "mass", 1000, ["tonnes", "metricton", "metrictons"]],
  // time
  ["s", "time", 1, ["sec", "secs", "second", "seconds"]],
  ["ms", "time", 0.001, ["millisecond", "milliseconds"]],
  ["min", "time", 60, ["mins", "minute", "minutes"]],
  ["h", "time", 3600, ["hr", "hrs", "hour", "hours"]],
  ["day", "time", 86400, ["days"]],
  // volume
  ["l", "volume", 1, ["liter", "liters", "litre", "litres"]],
  ["ml", "volume", 0.001, ["milliliter", "milliliters", "millilitre", "millilitres"]],
  ["cm3", "volume", 0.001, ["cc", "cubiccentimeter", "cubiccentimeters"]],
  ["m3", "volume", 1000, ["cubicmeter", "cubicmeters"]],
  ["gal", "volume", 3.785411784, ["gallon", "gallons"]],
  ["qt", "volume", 0.946352946, ["quart", "quarts"]],
  ["cup", "volume", 0.2365882365, ["cups"]],
  ["floz", "volume", 0.0295735295625, ["fluidounce", "fluidounces"]],
  // energy and work
  ["j", "energy", 1, ["joule", "joules"]],
  ["kj", "energy", 1000, ["kilojoule", "kilojoules"]],
  ["cal", "energy", 4.184, ["calorie", "calories"]],
  ["kcal", "energy", 4184, ["kilocalorie", "kilocalories"]],
  ["ev", "energy", 1.602176634e-19, ["electronvolt", "electronvolts"]],
  // force
  ["n", "force", 1, ["newton", "newtons"]],
  ["kn", "force", 1000, ["kilonewton", "kilonewtons"]],
  ["lbf", "force", 4.4482216152605, ["poundforce"]],
  // pressure
  ["pa", "pressure", 1, ["pascal", "pascals"]],
  ["kpa", "pressure", 1000, ["kilopascal", "kilopascals"]],
  ["mpa", "pressure", 1e6, ["megapascal", "megapascals"]],
  ["atm", "pressure", 101325, ["atmosphere", "atmospheres"]],
  ["mmhg", "pressure", 133.322387415],
  ["torr", "pressure", 133.322368421],
  // power
  ["w", "power", 1, ["watt", "watts"]],
  ["kw", "power", 1000, ["kilowatt", "kilowatts"]],
  ["mw", "power", 0.001, ["milliwatt", "milliwatts"]],
  // electricity and magnetism
  ["v", "voltage", 1, ["volt", "volts"]],
  ["mv", "voltage", 0.001, ["millivolt", "millivolts"]],
  ["a", "current", 1, ["amp", "amps", "ampere", "amperes"]],
  ["ma", "current", 0.001, ["milliamp", "milliamps", "milliampere", "milliamperes"]],
  ["c", "charge", 1, ["coulomb", "coulombs"]],
  ["ohm", "resistance", 1, ["ohms", "ω"]],
  ["kohm", "resistance", 1000, ["kiloohm", "kiloohms"]],
  ["f", "capacitance", 1, ["farad", "farads"]],
  ["t", "magneticfield", 1, ["tesla", "teslas"]],
  ["wb", "magneticflux", 1, ["weber", "webers"]],
  // frequency and amount
  ["hz", "frequency", 1, ["hertz"]],
  ["khz", "frequency", 1000, ["kilohertz"]],
  ["mhz", "frequency", 1e6, ["megahertz"]],
  ["ghz", "frequency", 1e9, ["gigahertz"]],
  ["mol", "amount", 1, ["mole", "moles"]],
  ["mmol", "amount", 0.001, ["millimole", "millimoles"]],
  ["umol", "amount", 1e-6, ["µmol", "micromole", "micromoles"]],
  ["molar", "concentration", 1, ["mol/l", "molperliter", "m"]],
  // speed and acceleration, the common compound units
  ["m/s", "speed", 1, ["meterspersecond", "metrespersecond", "ms-1"]],
  ["km/h", "speed", 1000 / 3600, ["kph", "kilometersperhour", "kilometresperhour"]],
  ["mi/h", "speed", 1609.344 / 3600, ["mph", "milesperhour"]],
  ["ft/s", "speed", 0.3048, ["feetpersecond"]],
  ["m/s2", "acceleration", 1, ["meterspersecondsquared", "metrespersecondsquared"]],
  // angles
  ["rad", "angle", 1, ["radian", "radians"]],
  ["deg", "angle", Math.PI / 180, ["degree", "degrees"]],
];

const UNIT_MAP = new Map();
for (const [id, dimension, factor, aliases] of UNIT_DEFINITIONS) {
  for (const name of [id, ...(aliases || [])]) {
    const key = normalizeUnit(name);
    if (key && !UNIT_MAP.has(key)) UNIT_MAP.set(key, { id, dimension, factor });
  }
}

// Temperature is not a simple factor: it needs a conversion to kelvin.
const TEMPERATURE_UNITS = {
  k: { id: "k", dimension: "temperature", toBase: (v) => v, fromBase: (v) => v, aliases: ["kelvin"] },
  degc: { id: "degc", dimension: "temperature", toBase: (v) => v + 273.15, fromBase: (v) => v - 273.15, aliases: ["celsius", "centigrade"] },
  degf: { id: "degf", dimension: "temperature", toBase: (v) => ((v - 32) * 5) / 9 + 273.15, fromBase: (v) => ((v - 273.15) * 9) / 5 + 32, aliases: ["fahrenheit"] },
};
for (const [id, def] of Object.entries(TEMPERATURE_UNITS)) {
  for (const name of [id, ...def.aliases]) {
    const key = normalizeUnit(name);
    if (key && !UNIT_MAP.has(key)) UNIT_MAP.set(key, def);
  }
}

function superscriptToCaret(text) {
  return String(text).replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]+/g, (run) => `^${[...run].map((ch) => SUPERSCRIPT[ch] || ch).join("")}`);
}

function normalizeUnit(raw) {
  let u = String(raw === undefined || raw === null ? "" : raw).trim();
  if (!u) return "";
  // A bare capital M means molarity, not metres.
  if (u === "M") return "molar";
  u = superscriptToCaret(u)
    .replace(/[−–—]/g, "-")
    .replace(/[·⋅✕✖×]/g, "*")
    .replace(/[µμ]/g, "u")
    .replace(/°/g, "deg")
    .replace(/\bdegrees?\b/gi, "")
    .replace(/\s+/g, "")
    .replace(/\*/g, "")
    .replace(/\^/g, "")
    .toLowerCase();
  // "deg c" becomes "degc" above; "degree celsius" loses "degree" and keeps celsius.
  u = u.replace(/^deg(?:rees?)?/, "deg");
  return u;
}

function unitInfo(raw) {
  const key = normalizeUnit(raw);
  return key ? UNIT_MAP.get(key) || null : null;
}

/** The canonical short id for a unit, or the normalised text when it is unknown. */
function canonicalUnit(raw) {
  const key = normalizeUnit(raw);
  if (!key) return "";
  const info = UNIT_MAP.get(key);
  return info && info.id ? info.id : key;
}

/**
 * Converts a value between two units. Returns { ok, value } or { ok:false, reason }.
 * Unknown units are reported instead of being silently treated as compatible.
 */
function convertValue(value, fromUnit, toUnit) {
  const from = unitInfo(fromUnit);
  const to = unitInfo(toUnit);
  if (!from) return { ok: false, reason: "unknown", unit: fromUnit };
  if (!to) return { ok: false, reason: "unknown", unit: toUnit };
  if (from.dimension !== to.dimension) return { ok: false, reason: "dimension", from: from.id, to: to.id };
  const base = from.toBase ? from.toBase(value) : value * from.factor;
  const out = to.fromBase ? to.fromBase(base) : base / to.factor;
  if (!Number.isFinite(out)) return { ok: false, reason: "number" };
  return { ok: true, value: out };
}

/* ----------------------------------------------------------- number text */

function normalizeText(text) {
  let t = String(text === undefined || text === null ? "" : text).trim();
  if (!t) return "";
  // Accept a value copied out of a LaTeX/markdown answer box.
  t = t.replace(/^\$+|\$+$/g, "").replace(/^\\\((.*)\\\)$/, "$1").replace(/^\\\[(.*)\\\]$/, "$1");
  t = superscriptToCaret(t)
    .replace(/[−–—]/g, "-")
    .replace(/[×✕✖⋅·]/g, "*")
    .replace(/\\times/g, "*")
    .replace(/\\cdot/g, "*")
    .replace(/[µμ]/g, "u")
    .replace(/\u00a0|\u202f|\u2009/g, " ")
    .replace(/[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g, (ch) => VULGAR_FRACTIONS[ch] || ch)
    .replace(/\s+/g, " ")
    .trim();
  // Thousands separators, but only in groups of three.
  t = t.replace(/(\d),(?=\d{3}(?:\D|$))/g, "$1");
  // 3.2 × 10^-3, 3.2 * 10^{-3} and 3.2 x 10^-3 are all scientific notation.
  t = t.replace(/([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*(?:\*|x)\s*10\s*\^?\s*\{?\s*([+-]?\d+)\s*\}?/gi, "$1e$2");
  return t;
}

/** Counts significant figures in a written number. Fractions return null (exact). */
function countSigFigs(literal) {
  let s = String(literal || "").trim().replace(/^[+-]/, "");
  if (!s || !/\d/.test(s)) return null;
  if (/[eE]/.test(s)) s = s.split(/[eE]/)[0];
  s = s.replace(/\.$/, "");
  if (s.includes(".")) {
    const digits = s.replace(".", "").replace(/^0+/, "");
    return digits.length || 1;
  }
  const trimmed = s.replace(/^0+/, "").replace(/0+$/, "");
  // A bare 0 has one significant figure; 1000 written without a decimal point
  // is ambiguous, so count its non-zero part as the conservative reading.
  return trimmed.length || 1;
}

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Reads one number from text. Returns null when the text is not a number.
 * The result keeps the written form so the review can show how it was read.
 */
function parseQuantity(raw) {
  let text = normalizeText(raw);
  if (!text) return null;
  let percent = false;
  if (/%\s*$/.test(text) || /\bpercent\s*$/i.test(text)) {
    percent = true;
    text = text.replace(/%\s*$/, "").replace(/\bpercent\s*$/i, "").trim();
  }

  let value = null;
  let fraction = false;
  let sigFigs = null;
  let rest = "";
  let written = text;

  // Mixed number: 1 1/2
  let m = text.match(/^([+-]?\d+)\s+(\d+)\s*\/\s*(\d+)\s*(.*)$/);
  if (m) {
    const whole = Number(m[1]);
    const top = Number(m[2]);
    const bottom = Number(m[3]);
    if (!bottom) return null;
    const sign = whole < 0 || /^-/.test(m[1]) ? -1 : 1;
    value = whole + (sign * top) / bottom;
    fraction = true;
    written = `${m[1]} ${m[2]}/${m[3]}`;
    rest = m[4].trim();
  } else {
    // Simple fraction: 3/4, -3/4, 3.5/7
    m = text.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)\s*\/\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)\s*(.*)$/);
    if (m) {
      const top = Number(m[1]);
      const bottom = Number(m[2]);
      if (!bottom) return null;
      value = top / bottom;
      fraction = true;
      written = `${m[1]}/${m[2]}`;
      rest = m[3].trim();
    } else {
      // Decimal or scientific notation, with an optional trailing unit.
      m = text.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)\s*(.*)$/);
      if (!m) return null;
      value = Number(m[1]);
      written = m[1];
      rest = m[2].trim();
      sigFigs = countSigFigs(m[1]);
    }
  }

  if (!finite(value)) return null;
  if (rest && /^[\d.]/.test(rest)) return null; // "12 34" is not a unit
  if (rest && !unitInfo(rest) && /[\d^+*/]/.test(rest)) return null; // "2^3" is an expression, not a unit
  if (percent) value /= 100;
  const unit = rest ? canonicalUnit(rest) : "";
  return {
    value,
    unit,
    percent,
    fraction,
    sigFigs,
    written,
    numericText: fraction ? text.split(/\s+/)[0] : text,
    inputValue: percent ? value * 100 : value,
  };
}

/* ------------------------------------------------------------- tolerance */

function normalizeToleranceType(raw) {
  const t = String(raw || "").trim().toLowerCase();
  if (/percent|%/.test(t)) return "percent";
  if (/rel/.test(t)) return "relative";
  if (/abs/.test(t)) return "absolute";
  return "absolute";
}

function toleranceFor(expected, fm) {
  const raw = Number(fm && fm.tolerance);
  const amount = Number.isFinite(raw) && raw > 0 ? raw : 0;
  const type = normalizeToleranceType(fm && (fm.tolerance_type || fm.toleranceType));
  if (!amount) return { delta: 0, type: "exact", amount: 0 };
  if (type === "relative") return { delta: Math.abs(expected) * amount, type, amount };
  if (type === "percent") return { delta: (Math.abs(expected) * amount) / 100, type, amount };
  return { delta: amount, type: "absolute", amount };
}

function toleranceLabel(tol) {
  if (tol.type === "exact") return "exact";
  if (tol.type === "percent") return `${formatNumber(tol.amount)}%`;
  if (tol.type === "relative") return `${formatNumber(tol.amount * 100)}% relative`;
  return `±${formatNumber(tol.amount)}`;
}

/* ----------------------------------------------------------------- units */

function applyDefaultUnit(quantity, defaultUnit) {
  const target = defaultUnit ? canonicalUnit(defaultUnit) : "";
  if (!target) return { ...quantity, unitError: "" };
  if (!quantity.unit) return { ...quantity, unit: target, unitError: "" };
  if (quantity.unit === target) return { ...quantity, unitError: "" };
  const converted = convertValue(quantity.value, quantity.unit, target);
  if (!converted.ok) return { ...quantity, unitError: converted.reason, unit: quantity.unit };
  return { ...quantity, value: converted.value, unit: target, unitError: "" };
}

/* --------------------------------------------------------------- ranges */

function parseRange(raw) {
  const text = normalizeText(raw);
  if (!text) return null;
  let m = text.match(/^\s*([\[(])\s*(.*?)\s*,\s*(.*?)\s*([\])])\s*(.*)$/);
  let loText = "";
  let hiText = "";
  let outerUnit = "";
  let inclusiveLo = true;
  let inclusiveHi = true;
  if (m) {
    inclusiveLo = m[1] === "[";
    inclusiveHi = m[4] === "]";
    loText = m[2];
    hiText = m[3];
    outerUnit = m[5].trim();
  } else {
    m = text.match(/^\s*(.*?)\s*\.\.\s*(.*?)\s*$/);
    if (!m) m = text.match(/^\s*(.*?)\s+\bto\b\s+(.*?)\s*$/i);
    if (!m) return null;
    loText = m[1];
    hiText = m[2];
  }
  const a = parseQuantity(loText);
  const b = parseQuantity(hiText);
  if (!a || !b) return null;
  let lo = a;
  let hi = b;
  // A unit after the range applies to both ends; otherwise a unit on either
  // end applies to both.
  if (outerUnit) {
    const target = canonicalUnit(outerUnit);
    for (const q of [lo, hi]) {
      if (!q.unit) q.unit = target;
    }
  }
  if (!lo.unit && hi.unit) lo = { ...lo, unit: hi.unit };
  if (lo.unit && !hi.unit) hi = { ...hi, unit: lo.unit };
  if (lo.unit && hi.unit && normalizeUnit(lo.unit) !== normalizeUnit(hi.unit)) {
    const converted = convertValue(hi.value, hi.unit, lo.unit);
    if (!converted.ok) return { kind: "range", invalid: converted.reason, raw: text };
    hi = { ...hi, value: converted.value, unit: lo.unit };
  }
  const loValue = Math.min(lo.value, hi.value);
  const hiValue = Math.max(lo.value, hi.value);
  return {
    kind: "range",
    lo: loValue,
    hi: hiValue,
    unit: lo.unit || hi.unit || "",
    inclusiveLo,
    inclusiveHi,
    raw: text,
    sigFigs: null,
  };
}

/* ---------------------------------------------------------- answer specs */

function splitAlternatives(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap((v) => splitAlternatives(v));
  return String(value)
    .split("|")
    .flatMap((part) => String(part).split(/\n+/))
    .map((part) => part.trim())
    .filter(Boolean);
}

function defaultUnitOf(fm) {
  // `unit` is already the course/unit classification. Numeric questions use
  // `units` (or `answer_unit`) so the two meanings never collide.
  const raw = fm && (fm.answer_unit !== undefined ? fm.answer_unit : fm.units);
  if (Array.isArray(raw)) return String(raw[0] || "").trim();
  return String(raw === undefined || raw === null ? "" : raw).trim();
}

/**
 * Turns the note's answer into a list of accepted numeric alternatives and
 * plain-text alternatives. `answer`, `accepted_answers` and `accepted_variants`
 * are all read; each may be a string separated by `|` or a YAML list.
 */
function parseAnswerSpec(fm) {
  const defaultUnit = defaultUnitOf(fm);
  const raw = splitAlternatives(fm && fm.answer).concat(
    splitAlternatives(fm && fm.accepted_answers),
    splitAlternatives(fm && fm.accepted_variants)
  );
  const alternatives = [];
  for (const item of raw) {
    const range = parseRange(item);
    if (range) {
      if (range.kind === "range" && range.invalid) {
        alternatives.push(range);
        continue;
      }
      alternatives.push({ ...range, unit: range.unit || (defaultUnit ? canonicalUnit(defaultUnit) : "") });
      continue;
    }
    const quantity = parseQuantity(item);
    if (quantity) alternatives.push({ kind: "number", ...applyDefaultUnit(quantity, defaultUnit) });
    else alternatives.push({ kind: "text", text: item });
  }
  return alternatives;
}

/* -------------------------------------------------------------- display */

function trimNumber(value) {
  if (!finite(value)) return String(value);
  if (Object.is(value, -0)) return "0";
  const s = Number(value.toPrecision(12)).toString();
  return s;
}

function formatNumber(value) {
  if (!finite(value)) return String(value);
  if (value === 0) return "0";
  const abs = Math.abs(value);
  if (abs >= 1e6 || abs < 1e-4) {
    const exponent = Math.floor(Math.log10(abs));
    const mantissa = value / Math.pow(10, exponent);
    return `${trimNumber(mantissa)} × 10${toSuperscript(exponent)}`;
  }
  return trimNumber(value);
}

function toSuperscript(text) {
  return [...String(text)].map((ch) => SUPERSCRIPT_OUT[ch] || ch).join("");
}

const UNIT_LABELS = { degc: "°C", degf: "°F", k: "K", "m/s2": "m/s²", cm3: "cm³", m3: "m³", molar: "M" };

function displayUnit(unit) {
  if (!unit) return "";
  return UNIT_LABELS[unit] || unit;
}

function unitSuffix(unit) {
  return unit ? ` ${displayUnit(unit)}` : "";
}

function describeQuantity(quantity) {
  if (!quantity) return "";
  if (quantity.percent) return `${formatNumber(quantity.inputValue)}% (${formatNumber(quantity.value)})${unitSuffix(quantity.unit)}`;
  if (quantity.fraction) return `${quantity.written} = ${formatNumber(quantity.value)}${unitSuffix(quantity.unit)}`;
  return `${formatNumber(quantity.value)}${unitSuffix(quantity.unit)}`;
}

function describeAlternative(alt) {
  if (!alt) return "";
  if (alt.kind === "text") return `“${alt.text}”`;
  if (alt.kind === "range") {
    const left = alt.inclusiveLo ? "[" : "(";
    const right = alt.inclusiveHi ? "]" : ")";
    return `${left}${formatNumber(alt.lo)}, ${formatNumber(alt.hi)}${right}${unitSuffix(alt.unit)}`;
  }
  const unit = alt.unitError ? ` ${alt.unit}` : unitSuffix(alt.unit);
  return `${formatNumber(alt.value)}${unit}`;
}

/* ------------------------------------------------------- sig-fig checks */

function checkSigFigs(quantity, fm) {
  const required = Number(fm && fm.sig_figs);
  if (!Number.isFinite(required) || required <= 0) return null;
  if (quantity.sigFigs === null || quantity.sigFigs === undefined) return null;
  const mode = String((fm && (fm.sig_figs_mode || fm.sigFigsMode)) || "at_least").trim().toLowerCase();
  const exact = /exact|require|equal/.test(mode);
  if (exact && quantity.sigFigs !== required) {
    return { ok: false, reason: `Use exactly ${required} significant figure${required === 1 ? "" : "s"}; “${quantity.written}” has ${quantity.sigFigs}.` };
  }
  if (!exact && quantity.sigFigs < required) {
    return { ok: false, reason: `Use at least ${required} significant figure${required === 1 ? "" : "s"}; “${quantity.written}” has ${quantity.sigFigs}.` };
  }
  return { ok: true };
}

/* -------------------------------------------------------------- grading */

function closeEnough(value, expected, tolerance) {
  const delta = tolerance.delta || 0;
  const slack = Math.max(1, Math.abs(value), Math.abs(expected)) * 1e-12;
  return Math.abs(value - expected) <= delta + slack;
}

function rangeContains(value, range, tolerance) {
  const delta = tolerance.delta || 0;
  const slack = Math.max(1, Math.abs(value), Math.abs(range.lo), Math.abs(range.hi)) * 1e-12;
  const low = range.inclusiveLo ? range.lo - delta - slack : range.lo + slack;
  const high = range.inclusiveHi ? range.hi + delta + slack : range.hi - slack;
  return value >= low && value <= high;
}

/**
 * Grades a student-produced numeric answer.
 * Returns null when the note has no answer key, otherwise a result object with
 * `correct`, `interpreted` and `reason` so every view can explain the decision.
 */
function gradeNumeric(fm, chosen) {
  const alternatives = parseAnswerSpec(fm);
  if (!alternatives.length) return null;
  const raw = String(chosen === undefined || chosen === null ? "" : chosen).trim();
  const text = raw.toLowerCase().replace(/\s+/g, "");
  const textMatch = alternatives.find((alt) => alt.kind === "text" && alt.text.toLowerCase().replace(/\s+/g, "") === text);
  if (textMatch) {
    return {
      correct: true,
      mode: "spr",
      interpreted: `“${raw}”`,
      reason: "Exact text match.",
      alternatives,
    };
  }
  if (!raw) {
    return {
      correct: false,
      mode: "spr",
      interpreted: "No answer entered.",
      reason: "Enter a number to be graded.",
      alternatives,
    };
  }

  const quantity = parseQuantity(raw);
  const numeric = alternatives.filter((alt) => alt.kind !== "text");
  if (!numeric.length) {
    return {
      correct: false,
      mode: "spr",
      interpreted: describeQuantity(quantity) || `“${raw}”`,
      reason: "The stored answer is text, not a number.",
      alternatives,
    };
  }
  if (!quantity) {
    return {
      correct: false,
      mode: "spr",
      interpreted: `Could not read “${raw}” as a number.`,
      reason: "Use a decimal, fraction, scientific notation or percentage, such as 0.75, 3/4 or 7.5 × 10⁻¹.",
      alternatives,
    };
  }

  const sig = checkSigFigs(quantity, fm);
  if (sig && !sig.ok) {
    return {
      correct: false,
      mode: "spr",
      interpreted: describeQuantity(quantity),
      reason: sig.reason,
      alternatives,
    };
  }

  let firstUnitProblem = "";
  let closest = "";
  for (const alt of numeric) {
    if (alt.invalid) {
      firstUnitProblem = firstUnitProblem || `The stored range uses incompatible units.`;
      continue;
    }
    if (alt.unitError) {
      firstUnitProblem = firstUnitProblem || `The stored answer uses an unknown or incompatible unit (${alt.unit}).`;
      continue;
    }
    let converted = quantity.value;
    let convertedUnit = quantity.unit;
    if (alt.unit) {
      if (quantity.unit) {
        const conversion = convertValue(quantity.value, quantity.unit, alt.unit);
        if (!conversion.ok) {
          firstUnitProblem =
            conversion.reason === "dimension"
              ? `Unit ${quantity.unit} is not compatible with ${alt.unit}.`
              : `Unit ${quantity.unit || "?"} is not recognized.`;
          closest = closest || `${describeQuantity(quantity)} cannot be compared with ${describeAlternative(alt)}.`;
          continue;
        }
        converted = conversion.value;
        convertedUnit = alt.unit;
      } else {
        converted = quantity.value;
        convertedUnit = alt.unit;
      }
    }

    if (alt.kind === "range") {
      const tolerance = toleranceFor(alt.lo, fm);
      if (rangeContains(converted, alt, tolerance)) {
        return {
          correct: true,
          mode: "spr",
          interpreted: describeQuantity({ ...quantity, value: converted, unit: convertedUnit }),
          reason: `Inside the accepted range ${describeAlternative(alt)}.`,
          alternatives,
          value: converted,
          unit: convertedUnit,
        };
      }
      closest = closest || `${formatNumber(converted)}${unitSuffix(convertedUnit)} is outside ${describeAlternative(alt)}.`;
      continue;
    }

    const tolerance = toleranceFor(alt.value, fm);
    if (closeEnough(converted, alt.value, tolerance)) {
      const convertedText =
        quantity.unit && alt.unit && normalizeUnit(quantity.unit) !== normalizeUnit(alt.unit)
          ? ` (${formatNumber(converted)}${unitSuffix(alt.unit)})`
          : "";
      return {
        correct: true,
        mode: "spr",
        interpreted: `Read as ${describeQuantity(quantity)}${convertedText}`,
        reason:
          tolerance.type === "exact"
            ? `Exact match for ${describeAlternative(alt)}.`
            : `Within the ${toleranceLabel(tolerance)} tolerance of ${describeAlternative(alt)}.`,
        alternatives,
        value: converted,
        unit: convertedUnit,
      };
    }
    closest = closest || `${formatNumber(converted)}${unitSuffix(convertedUnit)} is not ${describeAlternative(alt)}.`;
  }

  return {
    correct: false,
    mode: "spr",
    interpreted: describeQuantity(quantity),
    reason: firstUnitProblem || closest || `The answer does not match the stored answer.`,
    alternatives,
  };
}

/**
 * The single entry point views use. Multiple-choice stays a letter comparison;
 * SPR first tries the numeric rules and falls back to exact text for word
 * answers such as "mitochondria".
 */
function gradeAnswerDetailed(fm, chosen) {
  const key = String((fm && fm.answer) === undefined || (fm && fm.answer) === null ? "" : fm.answer).trim();
  if (!key) return null;
  const type = String((fm && fm.question_type) || "mcq").toLowerCase();
  if (/spr|student.?produced|grid.?in|numeric|short.?answer|fill/.test(type)) {
    return gradeNumeric(fm, chosen);
  }
  return {
    correct: String(chosen === undefined || chosen === null ? "" : chosen).toUpperCase() === key.toUpperCase(),
    mode: "mcq",
    interpreted: String(chosen === undefined || chosen === null ? "" : chosen),
    reason: "",
  };
}

module.exports = {
  SUPERSCRIPT,
  normalizeText,
  normalizeUnit,
  canonicalUnit,
  displayUnit,
  unitInfo,
  convertValue,
  parseQuantity,
  parseRange,
  parseAnswerSpec,
  countSigFigs,
  normalizeToleranceType,
  toleranceFor,
  formatNumber,
  describeQuantity,
  describeAlternative,
  gradeNumeric,
  gradeAnswerDetailed,
};
