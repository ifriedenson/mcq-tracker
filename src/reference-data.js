"use strict";
/*
 * The Reference module's bundled content.
 *
 * This file is deliberately data-only (plus small pure helpers) so the sheet can
 * be searched and tested without Obsidian. Everything here is written for this
 * plugin; no third-party dataset, formula-sheet PDF or calculator code is bundled.
 * Formulas are study aids, not a substitute for the formula sheet supplied with a
 * particular exam. See NOTICES.md.
 */

const DEFAULT_REFERENCE_SETTINGS = {
  enabled: false, // optional module; nothing is added to the workspace until this is on
  hideDuringTests: true, // a timed test should not have a reference panel beside it
  hideCalculatorDuringTests: true, // even when the panel is allowed, a no-calculator section hides the calculator
  calculator: true, // the local calculator tab is available when Reference is on
  defaultSubject: "all", // "all" | math | physics | chemistry | biology
};

const REFERENCE_SUBJECTS = [
  { id: "all", label: "All" },
  { id: "math", label: "Math" },
  { id: "physics", label: "Physics" },
  { id: "chemistry", label: "Chemistry" },
  { id: "biology", label: "Biology" },
];

const FORMULAS = [
  // ---------------------------------------------------------------- math
  {
    id: "quadratic",
    subject: "math",
    name: "Quadratic formula",
    formula: "x = (-b +/- sqrt(b^2 - 4ac)) / 2a",
    note: "For ax^2 + bx + c = 0, with a != 0.",
  },
  {
    id: "slope",
    subject: "math",
    name: "Slope",
    formula: "m = (y2 - y1) / (x2 - x1)",
    note: "Rise over run for the line through two points.",
  },
  {
    id: "distance",
    subject: "math",
    name: "Distance between points",
    formula: "d = sqrt((x2 - x1)^2 + (y2 - y1)^2)",
    note: "The length of the segment joining two points.",
  },
  {
    id: "midpoint",
    subject: "math",
    name: "Midpoint",
    formula: "M = ((x1 + x2) / 2, (y1 + y2) / 2)",
    note: "The point halfway between two points.",
  },
  {
    id: "circle-area",
    subject: "math",
    name: "Area of a circle",
    formula: "A = pi r^2",
    note: "r is the radius.",
  },
  {
    id: "circle-circumference",
    subject: "math",
    name: "Circumference of a circle",
    formula: "C = 2 pi r",
    note: "r is the radius; C = pi d for diameter d.",
  },
  {
    id: "pythagorean",
    subject: "math",
    name: "Pythagorean theorem",
    formula: "a^2 + b^2 = c^2",
    note: "For a right triangle, c is the hypotenuse.",
  },
  {
    id: "arithmetic-sequence",
    subject: "math",
    name: "Arithmetic sequence",
    formula: "a_n = a_1 + (n - 1)d",
    note: "d is the common difference.",
  },
  {
    id: "geometric-sequence",
    subject: "math",
    name: "Geometric sequence",
    formula: "a_n = a_1 r^(n - 1)",
    note: "r is the common ratio.",
  },
  {
    id: "compound-interest",
    subject: "math",
    name: "Compound interest",
    formula: "A = P(1 + r/n)^(nt)",
    note: "P principal, r annual rate as a decimal, n compounds per year.",
  },
  {
    id: "exponential-growth",
    subject: "math",
    name: "Exponential growth or decay",
    formula: "y = a(1 + r)^t",
    note: "r is the growth rate; use a negative r for decay.",
  },
  {
    id: "log-product",
    subject: "math",
    name: "Logarithm product rule",
    formula: "log_b(xy) = log_b(x) + log_b(y)",
    note: "Also log_b(x/y) = log_b(x) - log_b(y).",
  },
  {
    id: "change-of-base",
    subject: "math",
    name: "Change of base",
    formula: "log_b(x) = ln(x) / ln(b)",
    note: "Useful when a calculator only has ln or log base 10.",
  },
  {
    id: "probability-complement",
    subject: "math",
    name: "Complement rule",
    formula: "P(A') = 1 - P(A)",
    note: "The probability that A does not happen.",
  },
  {
    id: "conditional-probability",
    subject: "math",
    name: "Conditional probability",
    formula: "P(A | B) = P(A and B) / P(B)",
    note: "Requires P(B) > 0.",
  },
  {
    id: "binomial-probability",
    subject: "math",
    name: "Binomial probability",
    formula: "P(X = k) = C(n, k) p^k (1 - p)^(n - k)",
    note: "C(n, k) is the number of ways to choose k successes from n trials.",
  },
  {
    id: "standard-deviation",
    subject: "math",
    name: "Standard deviation of a sample",
    formula: "s = sqrt(sum((x - mean)^2) / (n - 1))",
    note: "Use n in the denominator for a population standard deviation.",
  },
  {
    id: "z-score",
    subject: "math",
    name: "z-score",
    formula: "z = (x - mean) / standard deviation",
    note: "How many standard deviations a value lies from the mean.",
  },

  // ------------------------------------------------------------- physics
  {
    id: "velocity-time",
    subject: "physics",
    name: "Velocity with constant acceleration",
    formula: "v = v0 + at",
    note: "v0 is the initial velocity.",
  },
  {
    id: "displacement-time",
    subject: "physics",
    name: "Displacement with constant acceleration",
    formula: "dx = v0 t + (1/2) a t^2",
    note: "dx is the change in position.",
  },
  {
    id: "velocity-squared",
    subject: "physics",
    name: "Velocity and displacement",
    formula: "v^2 = v0^2 + 2 a dx",
    note: "Useful when time is not known.",
  },
  {
    id: "newtons-second-law",
    subject: "physics",
    name: "Newton's second law",
    formula: "F_net = m a",
    note: "Force is in newtons when mass is in kg and acceleration in m/s^2.",
  },
  {
    id: "weight",
    subject: "physics",
    name: "Weight",
    formula: "W = m g",
    note: "Near Earth, g is about 9.8 m/s^2.",
  },
  {
    id: "work",
    subject: "physics",
    name: "Work",
    formula: "W = F d cos(theta)",
    note: "Only the force component along the displacement does work.",
  },
  {
    id: "power",
    subject: "physics",
    name: "Power",
    formula: "P = W / t",
    note: "The rate at which work is done.",
  },
  {
    id: "kinetic-energy",
    subject: "physics",
    name: "Kinetic energy",
    formula: "K = (1/2) m v^2",
    note: "Energy of motion, in joules.",
  },
  {
    id: "gravitational-potential-energy",
    subject: "physics",
    name: "Gravitational potential energy",
    formula: "U = m g h",
    note: "h is the height above the reference level.",
  },
  {
    id: "momentum",
    subject: "physics",
    name: "Momentum",
    formula: "p = m v",
    note: "A vector with the same direction as velocity.",
  },
  {
    id: "impulse",
    subject: "physics",
    name: "Impulse",
    formula: "J = F dt = dp",
    note: "Impulse equals the change in momentum.",
  },
  {
    id: "ohms-law",
    subject: "physics",
    name: "Ohm's law",
    formula: "V = I R",
    note: "V in volts, I in amperes, R in ohms.",
  },
  {
    id: "electrical-power",
    subject: "physics",
    name: "Electrical power",
    formula: "P = I V = V^2 / R",
    note: "The second form uses Ohm's law to replace I.",
  },
  {
    id: "wave-speed",
    subject: "physics",
    name: "Wave speed",
    formula: "v = f lambda",
    note: "f is frequency and lambda is wavelength.",
  },
  {
    id: "period-frequency",
    subject: "physics",
    name: "Period and frequency",
    formula: "T = 1 / f",
    note: "Period is seconds per cycle; frequency is cycles per second.",
  },
  {
    id: "lens-equation",
    subject: "physics",
    name: "Thin lens equation",
    formula: "1/f = 1/do + 1/di",
    note: "do is object distance and di is image distance.",
  },
  {
    id: "heat-energy",
    subject: "physics",
    name: "Heat energy",
    formula: "q = m c dT",
    note: "c is specific heat capacity and dT is the temperature change.",
  },

  // ----------------------------------------------------------- chemistry
  {
    id: "moles-from-mass",
    subject: "chemistry",
    name: "Moles from mass",
    formula: "n = m / M",
    note: "m is mass in grams and M is molar mass in g/mol.",
  },
  {
    id: "molarity",
    subject: "chemistry",
    name: "Molarity",
    formula: "M = n / V",
    note: "n is moles of solute and V is litres of solution.",
  },
  {
    id: "dilution",
    subject: "chemistry",
    name: "Dilution",
    formula: "M1 V1 = M2 V2",
    note: "Moles of solute stay the same when a solution is diluted.",
  },
  {
    id: "ideal-gas-law",
    subject: "chemistry",
    name: "Ideal gas law",
    formula: "P V = n R T",
    note: "Use R = 8.314 J/(mol K) or 0.08206 L atm/(mol K); T is kelvin.",
  },
  {
    id: "percent-yield",
    subject: "chemistry",
    name: "Percent yield",
    formula: "% yield = (actual / theoretical) x 100",
    note: "Both masses must be in the same unit.",
  },
  {
    id: "percent-composition",
    subject: "chemistry",
    name: "Percent composition",
    formula: "% element = (mass of element / molar mass) x 100",
    note: "The mass of the element is taken from one mole of the compound.",
  },
  {
    id: "density",
    subject: "chemistry",
    name: "Density",
    formula: "d = m / V",
    note: "Common units are g/mL or g/cm^3 for liquids and solids.",
  },
  {
    id: "ph",
    subject: "chemistry",
    name: "pH",
    formula: "pH = -log[H+]",
    note: "At 25 C, pH + pOH = 14.",
  },
  {
    id: "henderson-hasselbalch",
    subject: "chemistry",
    name: "Henderson-Hasselbalch",
    formula: "pH = pKa + log([A-] / [HA])",
    note: "For a buffer made from a weak acid and its conjugate base.",
  },
  {
    id: "coulomb-law",
    subject: "chemistry",
    name: "Coulomb's law",
    formula: "E = k q1 q2 / r",
    note: "k is Coulomb's constant; r is the distance between charges.",
  },

  // ------------------------------------------------------------ biology
  {
    id: "hardy-weinberg",
    subject: "biology",
    name: "Hardy-Weinberg equilibrium",
    formula: "p^2 + 2pq + q^2 = 1",
    note: "p + q = 1; p^2 and q^2 are homozygote frequencies.",
  },
  {
    id: "magnification",
    subject: "biology",
    name: "Magnification",
    formula: "magnification = image size / actual size",
    note: "Keep image and actual size in the same unit.",
  },
  {
    id: "surface-area-volume",
    subject: "biology",
    name: "Surface area to volume ratio",
    formula: "ratio = surface area / volume",
    note: "Smaller cells generally have a larger ratio.",
  },
  {
    id: "maple-aneurysm",
    subject: "biology",
    name: "Cardiac output",
    formula: "CO = heart rate x stroke volume",
    note: "Heart rate in beats per minute and stroke volume in litres per beat.",
  },
  {
    id: "water-potential",
    subject: "biology",
    name: "Water potential",
    formula: "psi = psi_s + psi_p",
    note: "psi_s is solute potential and psi_p is pressure potential.",
  },
];

const CONSTANTS = [
  { id: "speed-of-light", symbol: "c", name: "Speed of light in vacuum", value: "2.998 x 10^8", unit: "m/s" },
  { id: "gravity", symbol: "g", name: "Standard gravity", value: "9.807", unit: "m/s^2" },
  { id: "gravitational-constant", symbol: "G", name: "Gravitational constant", value: "6.674 x 10^-11", unit: "N m^2/kg^2" },
  { id: "planck", symbol: "h", name: "Planck constant", value: "6.626 x 10^-34", unit: "J s" },
  { id: "avogadro", symbol: "N_A", name: "Avogadro constant", value: "6.022 x 10^23", unit: "1/mol" },
  { id: "gas-constant", symbol: "R", name: "Ideal gas constant", value: "8.314", unit: "J/(mol K)" },
  { id: "gas-constant-atm", symbol: "R", name: "Ideal gas constant (L atm)", value: "0.08206", unit: "L atm/(mol K)" },
  { id: "boltzmann", symbol: "k_B", name: "Boltzmann constant", value: "1.381 x 10^-23", unit: "J/K" },
  { id: "electron-charge", symbol: "e", name: "Elementary charge", value: "1.602 x 10^-19", unit: "C" },
  { id: "electron-mass", symbol: "m_e", name: "Electron mass", value: "9.109 x 10^-31", unit: "kg" },
  { id: "proton-mass", symbol: "m_p", name: "Proton mass", value: "1.673 x 10^-27", unit: "kg" },
  { id: "standard-atmosphere", symbol: "atm", name: "Standard atmosphere", value: "101325", unit: "Pa" },
  { id: "celsius-zero", symbol: "0 C", name: "Celsius zero in kelvin", value: "273.15", unit: "K" },
  { id: "earth-mass", symbol: "M_E", name: "Earth mass", value: "5.972 x 10^24", unit: "kg" },
  { id: "earth-radius", symbol: "R_E", name: "Earth mean radius", value: "6.371 x 10^6", unit: "m" },
];

const UNIT_CATEGORIES = [
  {
    id: "length",
    label: "Length",
    units: [
      { id: "mm", label: "millimetres (mm)", factor: 0.001 },
      { id: "cm", label: "centimetres (cm)", factor: 0.01 },
      { id: "m", label: "metres (m)", factor: 1 },
      { id: "km", label: "kilometres (km)", factor: 1000 },
      { id: "in", label: "inches (in)", factor: 0.0254 },
      { id: "ft", label: "feet (ft)", factor: 0.3048 },
      { id: "yd", label: "yards (yd)", factor: 0.9144 },
      { id: "mi", label: "miles (mi)", factor: 1609.344 },
    ],
  },
  {
    id: "mass",
    label: "Mass",
    units: [
      { id: "mg", label: "milligrams (mg)", factor: 0.000001 },
      { id: "g", label: "grams (g)", factor: 0.001 },
      { id: "kg", label: "kilograms (kg)", factor: 1 },
      { id: "oz", label: "ounces (oz)", factor: 0.028349523125 },
      { id: "lb", label: "pounds (lb)", factor: 0.45359237 },
      { id: "t", label: "metric tonnes (t)", factor: 1000 },
    ],
  },
  {
    id: "volume",
    label: "Volume",
    units: [
      { id: "ml", label: "millilitres (mL)", factor: 0.001 },
      { id: "l", label: "litres (L)", factor: 1 },
      { id: "m3", label: "cubic metres (m^3)", factor: 1000 },
      { id: "tsp", label: "teaspoons (US)", factor: 0.00492892159375 },
      { id: "tbsp", label: "tablespoons (US)", factor: 0.01478676478125 },
      { id: "floz", label: "fluid ounces (US)", factor: 0.0295735295625 },
      { id: "cup", label: "cups (US)", factor: 0.2365882365 },
      { id: "pt", label: "pints (US)", factor: 0.473176473 },
      { id: "qt", label: "quarts (US)", factor: 0.946352946 },
      { id: "gal", label: "gallons (US)", factor: 3.785411784 },
    ],
  },
  {
    id: "temperature",
    label: "Temperature",
    units: [
      { id: "c", label: "Celsius (C)" },
      { id: "f", label: "Fahrenheit (F)" },
      { id: "k", label: "kelvin (K)" },
    ],
  },
  {
    id: "time",
    label: "Time",
    units: [
      { id: "ms", label: "milliseconds (ms)", factor: 0.001 },
      { id: "s", label: "seconds (s)", factor: 1 },
      { id: "min", label: "minutes (min)", factor: 60 },
      { id: "h", label: "hours (h)", factor: 3600 },
      { id: "day", label: "days", factor: 86400 },
    ],
  },
  {
    id: "speed",
    label: "Speed",
    units: [
      { id: "mps", label: "metres/second (m/s)", factor: 1 },
      { id: "kmh", label: "kilometres/hour (km/h)", factor: 0.2777777777777778 },
      { id: "mph", label: "miles/hour (mph)", factor: 0.44704 },
      { id: "knot", label: "knots", factor: 0.5144444444444445 },
    ],
  },
  {
    id: "energy",
    label: "Energy",
    units: [
      { id: "j", label: "joules (J)", factor: 1 },
      { id: "kj", label: "kilojoules (kJ)", factor: 1000 },
      { id: "cal", label: "calories (cal)", factor: 4.184 },
      { id: "kcal", label: "kilocalories (kcal)", factor: 4184 },
      { id: "wh", label: "watt-hours (Wh)", factor: 3600 },
      { id: "kwh", label: "kilowatt-hours (kWh)", factor: 3600000 },
    ],
  },
  {
    id: "pressure",
    label: "Pressure",
    units: [
      { id: "pa", label: "pascals (Pa)", factor: 1 },
      { id: "kpa", label: "kilopascals (kPa)", factor: 1000 },
      { id: "bar", label: "bar", factor: 100000 },
      { id: "atm", label: "atmospheres (atm)", factor: 101325 },
      { id: "psi", label: "pounds/square inch (psi)", factor: 6894.757293168 },
      { id: "torr", label: "torr", factor: 133.322368421 },
    ],
  },
  {
    id: "angle",
    label: "Angle",
    units: [
      { id: "deg", label: "degrees", factor: 1 },
      { id: "rad", label: "radians", factor: 57.29577951308232 },
      { id: "grad", label: "gradians", factor: 0.9 },
      { id: "turn", label: "turns", factor: 360 },
    ],
  },
  {
    id: "data",
    label: "Digital data",
    units: [
      { id: "b", label: "bytes (B)", factor: 1 },
      { id: "kb", label: "kilobytes (KB, 1000 B)", factor: 1000 },
      { id: "kib", label: "kibibytes (KiB, 1024 B)", factor: 1024 },
      { id: "mb", label: "megabytes (MB, 10^6 B)", factor: 1000000 },
      { id: "mib", label: "mebibytes (MiB, 2^20 B)", factor: 1048576 },
      { id: "gb", label: "gigabytes (GB, 10^9 B)", factor: 1000000000 },
      { id: "gib", label: "gibibytes (GiB, 2^30 B)", factor: 1073741824 },
    ],
  },
];

function unitCategory(id) {
  return UNIT_CATEGORIES.find((category) => category.id === id) || null;
}

function unitIn(category, id) {
  return category ? category.units.find((u) => u.id === id) || null : null;
}

function unitLabel(categoryId, unitId) {
  const category = unitCategory(categoryId);
  const unit = unitIn(category, unitId);
  return unit ? unit.label : "";
}

function defaultUnits(categoryId) {
  const category = unitCategory(categoryId);
  if (!category) return [null, null];
  return [category.units[0].id, (category.units[1] || category.units[0]).id];
}

function temperatureToKelvin(value, unit) {
  if (unit === "c") return value + 273.15;
  if (unit === "f") return (value - 32) * (5 / 9) + 273.15;
  if (unit === "k") return value;
  return null;
}

function temperatureFromKelvin(value, unit) {
  if (unit === "c") return value - 273.15;
  if (unit === "f") return (value - 273.15) * (9 / 5) + 32;
  if (unit === "k") return value;
  return null;
}

/**
 * Converts a value between two units in one category.
 * Returns null for an unknown category/unit or a non-finite result.
 */
function convertUnit(value, categoryId, fromId, toId) {
  const category = unitCategory(categoryId);
  const from = unitIn(category, fromId);
  const to = unitIn(category, toId);
  const n = Number(value);
  if (!category || !from || !to || !Number.isFinite(n)) return null;
  if (category.id === "temperature") {
    const kelvin = temperatureToKelvin(n, from.id);
    if (kelvin === null) return null;
    const out = temperatureFromKelvin(kelvin, to.id);
    return Number.isFinite(out) ? out : null;
  }
  const out = (n * from.factor) / to.factor;
  return Number.isFinite(out) ? out : null;
}

/** A compact display value without floating-point noise. */
function formatReferenceNumber(value, digits) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  if (n === 0) return "0";
  const places = Math.max(1, Math.min(12, Number(digits) || 6));
  const abs = Math.abs(n);
  if (abs >= 1000000000 || abs < 0.0001) return n.toExponential(Math.min(places, 8)).replace(/\+/, "");
  const rounded = Number(n.toPrecision(places));
  return String(rounded);
}

function normalizeText(value) {
  return String(value === undefined || value === null ? "" : value)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Formulas in a subject (or all subjects) matching a free-text query. */
function searchFormulas(query, subject) {
  const q = normalizeText(query);
  const wanted = normalizeText(subject);
  return FORMULAS.filter((item) => {
    if (wanted && wanted !== "all" && normalizeText(item.subject) !== wanted) return false;
    if (!q) return true;
    return [item.name, item.formula, item.note, item.subject, item.id].some((part) => normalizeText(part).includes(q));
  });
}

/** Constants matching a free-text query. */
function searchConstants(query) {
  const q = normalizeText(query);
  if (!q) return CONSTANTS.slice();
  return CONSTANTS.filter((item) =>
    [item.symbol, item.name, item.value, item.unit].some((part) => normalizeText(part).includes(q))
  );
}

function mergeReferenceSettings(saved) {
  const src = saved && typeof saved === "object" ? saved : {};
  const subject = String(src.defaultSubject || "all");
  return {
    enabled: src.enabled === true,
    hideDuringTests: src.hideDuringTests !== false,
    hideCalculatorDuringTests: src.hideCalculatorDuringTests !== false,
    calculator: src.calculator !== false,
    defaultSubject: REFERENCE_SUBJECTS.some((s) => s.id === subject) ? subject : "all",
  };
}

module.exports = {
  CONSTANTS,
  DEFAULT_REFERENCE_SETTINGS,
  FORMULAS,
  REFERENCE_SUBJECTS,
  UNIT_CATEGORIES,
  convertUnit,
  defaultUnits,
  formatReferenceNumber,
  mergeReferenceSettings,
  searchConstants,
  searchFormulas,
  unitCategory,
  unitLabel,
};
