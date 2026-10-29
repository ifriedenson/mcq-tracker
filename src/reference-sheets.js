"use strict";
/*
 * One-screen reference sheets for the Reference module: the unit circle, trig
 * identities, the standard RNA codon table and a small Punnett square. The
 * data is written for this plugin from standard mathematics and biology; no
 * third-party dataset is bundled. Everything is local and works offline.
 */
const { str } = require("./util");

/* --------------------------------------------------------------- unit circle */

const UNIT_CIRCLE = [
  { degrees: 0, radians: "0", sin: "0", cos: "1", tan: "0" },
  { degrees: 30, radians: "π/6", sin: "1/2", cos: "√3/2", tan: "√3/3" },
  { degrees: 45, radians: "π/4", sin: "√2/2", cos: "√2/2", tan: "1" },
  { degrees: 60, radians: "π/3", sin: "√3/2", cos: "1/2", tan: "√3" },
  { degrees: 90, radians: "π/2", sin: "1", cos: "0", tan: "undefined" },
  { degrees: 120, radians: "2π/3", sin: "√3/2", cos: "−1/2", tan: "−√3" },
  { degrees: 135, radians: "3π/4", sin: "√2/2", cos: "−√2/2", tan: "−1" },
  { degrees: 150, radians: "5π/6", sin: "1/2", cos: "−√3/2", tan: "−√3/3" },
  { degrees: 180, radians: "π", sin: "0", cos: "−1", tan: "0" },
  { degrees: 210, radians: "7π/6", sin: "−1/2", cos: "−√3/2", tan: "√3/3" },
  { degrees: 225, radians: "5π/4", sin: "−√2/2", cos: "−√2/2", tan: "1" },
  { degrees: 240, radians: "4π/3", sin: "−√3/2", cos: "−1/2", tan: "√3" },
  { degrees: 270, radians: "3π/2", sin: "−1", cos: "0", tan: "undefined" },
  { degrees: 300, radians: "5π/3", sin: "−√3/2", cos: "1/2", tan: "−√3" },
  { degrees: 315, radians: "7π/4", sin: "−√2/2", cos: "√2/2", tan: "−1" },
  { degrees: 330, radians: "11π/6", sin: "−1/2", cos: "√3/2", tan: "−√3/3" },
];

/* ----------------------------------------------------------- trig identities */

const TRIG_IDENTITIES = [
  {
    group: "Pythagorean",
    items: [
      { name: "Pythagorean identity", formula: "sin²θ + cos²θ = 1" },
      { name: "With tangent", formula: "1 + tan²θ = sec²θ" },
      { name: "With cotangent", formula: "1 + cot²θ = csc²θ" },
    ],
  },
  {
    group: "Reciprocal and quotient",
    items: [
      { name: "Secant", formula: "sec θ = 1 / cos θ" },
      { name: "Cosecant", formula: "csc θ = 1 / sin θ" },
      { name: "Cotangent", formula: "cot θ = 1 / tan θ = cos θ / sin θ" },
      { name: "Tangent", formula: "tan θ = sin θ / cos θ" },
    ],
  },
  {
    group: "Sum and difference",
    items: [
      { name: "Sine of a sum", formula: "sin(α + β) = sin α cos β + cos α sin β" },
      { name: "Sine of a difference", formula: "sin(α − β) = sin α cos β − cos α sin β" },
      { name: "Cosine of a sum", formula: "cos(α + β) = cos α cos β − sin α sin β" },
      { name: "Cosine of a difference", formula: "cos(α − β) = cos α cos β + sin α sin β" },
      { name: "Tangent of a sum", formula: "tan(α + β) = (tan α + tan β) / (1 − tan α tan β)" },
    ],
  },
  {
    group: "Double angle",
    items: [
      { name: "Sine", formula: "sin 2θ = 2 sin θ cos θ" },
      { name: "Cosine", formula: "cos 2θ = cos²θ − sin²θ = 1 − 2 sin²θ = 2 cos²θ − 1" },
      { name: "Tangent", formula: "tan 2θ = 2 tan θ / (1 − tan²θ)" },
    ],
  },
  {
    group: "Triangle rules",
    items: [
      { name: "Law of sines", formula: "a / sin A = b / sin B = c / sin C" },
      { name: "Law of cosines", formula: "c² = a² + b² − 2ab cos C" },
      { name: "Area of a triangle", formula: "Area = ½ ab sin C" },
    ],
  },
];

/* ------------------------------------------------------------ codon table */

const AMINO_ACID_NAMES = {
  A: "Alanine",
  R: "Arginine",
  N: "Asparagine",
  D: "Aspartic acid",
  C: "Cysteine",
  Q: "Glutamine",
  E: "Glutamic acid",
  G: "Glycine",
  H: "Histidine",
  I: "Isoleucine",
  L: "Leucine",
  K: "Lysine",
  M: "Methionine",
  F: "Phenylalanine",
  P: "Proline",
  S: "Serine",
  T: "Threonine",
  W: "Tryptophan",
  Y: "Tyrosine",
  V: "Valine",
  "*": "Stop",
};

const CODON_CODES = {
  UUU: "F", UUC: "F", UUA: "L", UUG: "L",
  UCU: "S", UCC: "S", UCA: "S", UCG: "S",
  UAU: "Y", UAC: "Y", UAA: "*", UAG: "*",
  UGU: "C", UGC: "C", UGA: "*", UGG: "W",
  CUU: "L", CUC: "L", CUA: "L", CUG: "L",
  CCU: "P", CCC: "P", CCA: "P", CCG: "P",
  CAU: "H", CAC: "H", CAA: "Q", CAG: "Q",
  CGU: "R", CGC: "R", CGA: "R", CGG: "R",
  AUU: "I", AUC: "I", AUA: "I", AUG: "M",
  ACU: "T", ACC: "T", ACA: "T", ACG: "T",
  AAU: "N", AAC: "N", AAA: "K", AAG: "K",
  AGU: "S", AGC: "S", AGA: "R", AGG: "R",
  GUU: "V", GUC: "V", GUA: "V", GUG: "V",
  GCU: "A", GCC: "A", GCA: "A", GCG: "A",
  GAU: "D", GAC: "D", GAA: "E", GAG: "E",
  GGU: "G", GGC: "G", GGA: "G", GGG: "G",
};

const CODON_BASES = ["U", "C", "A", "G"];

const CODON_TABLE = CODON_BASES.flatMap((first) =>
  CODON_BASES.flatMap((second) =>
    CODON_BASES.map((third) => {
      const codon = `${first}${second}${third}`;
      const code = CODON_CODES[codon];
      return { codon, code, aminoAcid: AMINO_ACID_NAMES[code], stop: code === "*" };
    })
  )
);

/** Accepts RNA or DNA spelling, any case. */
function codonEntry(codon) {
  const text = str(codon).trim().toUpperCase().replace(/T/g, "U");
  return CODON_TABLE.find((row) => row.codon === text) || null;
}

function searchCodons(query) {
  const q = str(query).trim().toLowerCase();
  if (!q) return CODON_TABLE.slice();
  return CODON_TABLE.filter(
    (row) =>
      row.codon.toLowerCase().includes(q) ||
      row.aminoAcid.toLowerCase().includes(q) ||
      row.code.toLowerCase() === q
  );
}

function aminoAcidNames() {
  const names = [];
  for (const row of CODON_TABLE) if (!names.includes(row.aminoAcid)) names.push(row.aminoAcid);
  return names;
}

/* ------------------------------------------------------------ Punnett square */

const PUNNETT_GENOTYPES = ["AA", "Aa", "aa"];

function normalizeGenotype(value) {
  const text = str(value).trim();
  if (PUNNETT_GENOTYPES.includes(text)) return text;
  // AA, Aa and aa differ only by case, so count the dominant alleles instead
  // of comparing lowercased strings.
  const letters = text.replace(/[^Aa]/g, "");
  if (letters.length !== 2) return "Aa";
  const dominant = (letters.match(/A/g) || []).length;
  return dominant === 2 ? "AA" : dominant === 1 ? "Aa" : "aa";
}

/**
 * A two-parent, one-gene cross. Cells are ordered by the first parent's
 * alleles, so Aa × Aa reads AA, Aa, Aa, aa.
 */
function punnettSquare(parentA, parentB) {
  const a = normalizeGenotype(parentA);
  const b = normalizeGenotype(parentB);
  const cells = [];
  for (const left of [a[0], a[1]]) {
    for (const right of [b[0], b[1]]) {
      cells.push([left, right].sort().join(""));
    }
  }
  const counts = { AA: 0, Aa: 0, aa: 0 };
  for (const cell of cells) counts[cell] = (counts[cell] || 0) + 1;
  const total = cells.length;
  return {
    parentA: a,
    parentB: b,
    cells,
    counts,
    total,
    ratio: `${counts.AA}:${counts.Aa}:${counts.aa}`,
    dominant: counts.AA + counts.Aa,
    recessive: counts.aa,
  };
}

module.exports = {
  UNIT_CIRCLE,
  TRIG_IDENTITIES,
  CODON_TABLE,
  PUNNETT_GENOTYPES,
  aminoAcidNames,
  codonEntry,
  searchCodons,
  normalizeGenotype,
  punnettSquare,
};
