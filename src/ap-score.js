"use strict";
/*
 * Unofficial AP practice-score estimator.
 *
 * Every profile uses the published section weights and point values for the
 * 2027 exam. Cut scores are deliberately a user-editable practice default:
 * College Board does not ship one official curve, and cut scores vary by year
 * and form. This module only does arithmetic and never contacts a network.
 */

const DEFAULT_CUTOFFS = { 5: 75, 4: 62, 3: 50, 2: 38 };

const AP_PROFILES = [
  {
    id: "ap-biology",
    name: "AP Biology",
    year: "2027",
    source: "https://apcentral.collegeboard.org/courses/ap-biology/exam",
    sections: [
      { id: "mcq", label: "Multiple choice", weight: 0.5, max: 60 },
      {
        id: "frq",
        label: "Free response",
        weight: 0.5,
        parts: [
          { id: "long1", label: "Long question 1", max: 9 },
          { id: "long2", label: "Long question 2", max: 9 },
          { id: "short1", label: "Short question 1", max: 4 },
          { id: "short2", label: "Short question 2", max: 4 },
          { id: "short3", label: "Short question 3", max: 4 },
          { id: "short4", label: "Short question 4", max: 4 },
        ],
      },
    ],
  },
  {
    id: "ap-calculus-ab",
    name: "AP Calculus AB",
    year: "2027",
    source: "https://apcentral.collegeboard.org/courses/ap-calculus-ab/exam",
    sections: [
      { id: "mcq", label: "Multiple choice", weight: 0.5, max: 42 },
      {
        id: "frq",
        label: "Free response",
        weight: 0.5,
        parts: [1, 2, 3, 4, 5, 6].map((n) => ({ id: `frq${n}`, label: `Question ${n}`, max: 9 })),
      },
    ],
  },
  {
    id: "ap-english-language",
    name: "AP English Language and Composition",
    year: "2027",
    source: "https://apcentral.collegeboard.org/courses/ap-english-language-and-composition/exam",
    sections: [
      { id: "mcq", label: "Multiple choice", weight: 0.45, max: 45 },
      {
        id: "frq",
        label: "Free response",
        weight: 0.55,
        parts: [
          { id: "synthesis", label: "Synthesis essay", max: 6 },
          { id: "rhetorical", label: "Rhetorical analysis", max: 6 },
          { id: "argument", label: "Argument essay", max: 6 },
        ],
      },
    ],
  },
  {
    id: "ap-us-history",
    name: "AP United States History",
    year: "2027",
    source: "https://apcentral.collegeboard.org/courses/ap-united-states-history/exam",
    sections: [
      { id: "mcq", label: "Multiple choice", weight: 0.4, max: 55 },
      {
        id: "saq",
        label: "Short answer",
        weight: 0.2,
        parts: [
          { id: "saq1", label: "Short answer 1", max: 3 },
          { id: "saq2", label: "Short answer 2", max: 3 },
          { id: "saq3", label: "Short answer 3", max: 3 },
        ],
      },
      { id: "dbq", label: "Document-based question", weight: 0.25, max: 7 },
      { id: "leq", label: "Long essay", weight: 0.15, max: 6 },
    ],
  },
];

const SECTION_ID = { mcq: "mcq" };

function partsOf(section) {
  return section.parts && section.parts.length
    ? section.parts
    : [{ id: "score", label: section.label, max: section.max }];
}

function sectionMax(section) {
  return partsOf(section).reduce((sum, part) => sum + Number(part.max || 0), 0);
}

function normalizeCutoffs(value) {
  const src = value && typeof value === "object" ? value : {};
  const out = {};
  for (const score of [5, 4, 3, 2]) {
    const n = Number(src[score]);
    out[score] = Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : DEFAULT_CUTOFFS[score];
  }
  // A reversed curve is a typo, not a meaningful estimate. Fall back rather
  // than silently producing an impossible scoreband.
  if (!(out[5] > out[4] && out[4] > out[3] && out[3] > out[2])) return { ...DEFAULT_CUTOFFS };
  return out;
}

function estimateScore(composite, cutoffs) {
  const c = normalizeCutoffs(cutoffs);
  if (composite >= c[5]) return 5;
  if (composite >= c[4]) return 4;
  if (composite >= c[3]) return 3;
  if (composite >= c[2]) return 2;
  return 1;
}

function entered(value, part) {
  if (!value || typeof value !== "object") return null;
  const raw = value[part.id];
  if (raw === "" || raw === null || raw === undefined) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(Number(part.max) || 0, n));
}

/** Calculate the weighted section percentages and, when complete, an estimate. */
function calculateApScore(profile, scores, cutoffs) {
  const p = profile && profile.sections ? profile : null;
  if (!p) return null;
  const c = normalizeCutoffs(cutoffs);
  const sections = p.sections.map((section) => {
    const parts = partsOf(section);
    const values = parts.map((part) => entered(scores && scores[section.id], part));
    const complete = values.every((v) => v !== null);
    const earned = values.reduce((sum, v) => sum + (v || 0), 0);
    const max = sectionMax(section);
    return {
      id: section.id,
      label: section.label,
      weight: section.weight,
      complete,
      earned: complete ? earned : null,
      max,
      percent: complete && max ? (earned / max) * 100 : null,
      parts: parts.map((part, index) => ({
        id: part.id,
        label: part.label,
        max: Number(part.max) || 0,
        earned: values[index],
      })),
    };
  });
  const complete = sections.every((section) => section.complete);
  let composite = null;
  if (complete) {
    composite = sections.reduce((sum, section) => sum + (Number(section.percent) || 0) * Number(section.weight || 0), 0);
  }
  const estimated = complete ? estimateScore(composite, c) : null;
  return {
    profile: p,
    cutoffs: c,
    sections,
    complete,
    composite: complete ? Math.round(composite * 10) / 10 : null,
    estimated,
    range: complete ? [estimateScore(composite - 4, c), estimateScore(composite + 4, c)] : null,
  };
}

/** What one section would need to reach a target, holding the other sections fixed. */
function requiredForTarget(profile, scores, target, cutoffs) {
  const p = profile && profile.sections ? profile : null;
  const score = Number(target);
  if (!p || ![2, 3, 4, 5].includes(score)) return null;
  const c = normalizeCutoffs(cutoffs);
  const targetCut = c[score];
  const values = p.sections.map((section) => {
    const parts = partsOf(section);
    const enteredValues = parts.map((part) => entered(scores && scores[section.id], part));
    return {
      section,
      complete: enteredValues.every((v) => v !== null),
      percent: enteredValues.every((v) => v !== null)
        ? (enteredValues.reduce((sum, v) => sum + v, 0) / sectionMax(section)) * 100
        : null,
    };
  });
  const requirements = [];
  for (const item of values) {
    const others = values.filter((v) => v.section.id !== item.section.id);
    if (!others.every((v) => v.complete)) {
      requirements.push({
        sectionId: item.section.id,
        label: item.section.label,
        possible: null,
        reason: "Enter the other sections first.",
      });
      continue;
    }
    const subtotal = others.reduce((sum, v) => sum + v.percent * Number(v.section.weight || 0), 0);
    const weight = Number(item.section.weight || 0);
    const neededPercent = weight ? (targetCut - subtotal) / weight : null;
    const max = sectionMax(item.section);
    const neededPoints = neededPercent === null ? null : (neededPercent / 100) * max;
    requirements.push({
      sectionId: item.section.id,
      label: item.section.label,
      neededPercent: neededPercent === null ? null : Math.round(neededPercent * 10) / 10,
      neededPoints: neededPoints === null ? null : Math.round(neededPoints * 10) / 10,
      max,
      possible: neededPercent !== null && neededPercent <= 100 && neededPercent >= 0,
      alreadyEnough: neededPercent !== null && neededPercent < 0,
    });
  }
  return { target: score, cutoff: targetCut, requirements };
}

function profileById(id) {
  return AP_PROFILES.find((profile) => profile.id === id) || AP_PROFILES[0];
}

module.exports = {
  AP_PROFILES,
  DEFAULT_CUTOFFS,
  SECTION_ID,
  calculateApScore,
  estimateScore,
  normalizeCutoffs,
  partsOf,
  profileById,
  requiredForTarget,
  sectionMax,
};
