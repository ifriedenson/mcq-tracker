"use strict";
/*
 * Adaptive mastery selection.
 *
 * This is deliberately separate from the FSRS due queue. Adaptive practice
 * looks at the learner's whole history, ranks the course/unit/skill/test facets
 * that look weakest, and then picks a different question from the weakest
 * facet. A question is never repeated in the same session or for seven days
 * after an attempt, so the learner gets a new surface for the same idea rather
 * than the exact item again.
 *
 * The module is pure: it reads question frontmatter and history only, makes no
 * network request and never writes a note or schedule.
 */
const { creditOf } = require("./history");
const { addDays, fmtDate, str } = require("./util");
const { isStudyable } = require("./study-status");

const ADAPTIVE_COOLDOWN_DAYS = 7;
const PRIOR_ATTEMPTS = 5;
const TARGET_FACETS = [
  ["skill", 1.15],
  ["unit", 1.05],
  ["topic", 0.95],
  ["subtopic", 0.9],
  ["test", 0.8],
  ["exam", 0.8],
  ["course", 0.7],
  ["section", 0.6],
  ["tags", 0.45],
];
const CONTEXT_FACETS = [
  ["source_note", 0.3],
  ["difficulty", 0.25],
  ["question_type", 0.2],
];
const TARGET_WEIGHT = new Map(TARGET_FACETS);

function clean(value) {
  return str(value).trim().toLowerCase().replace(/\s+/g, " ").slice(0, 160);
}

function dayKey(value) {
  const day = str(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : "";
}

function dateFromDay(day) {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date);
}

function daysBetween(from, to) {
  if (!from || !to) return null;
  return Math.round((dateFromDay(to).getTime() - dateFromDay(from).getTime()) / 86400000);
}

function historyRows(history) {
  return (Array.isArray(history) ? history : []).map((line) => {
    const parts = str(line).split("|");
    const rawScore = parts[8];
    const score = rawScore === undefined || str(rawScore).trim() === "" ? null : Number(rawScore);
    return {
      when: parts[0] || "",
      result: parts[1] || "",
      seconds: Number(parts[2]) || 0,
      score: Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : null,
    };
  });
}

function valuesFor(fm, key) {
  if (!fm) return [];
  let value;
  if (key === "question_type") value = fm.question_type || fm.item_type;
  else value = fm[key];
  if (value === undefined || value === null || value === "") return [];
  return (Array.isArray(value) ? value : [value]).map(clean).filter(Boolean);
}

/** The identity and context facets a question belongs to. Duplicate values are removed. */
function facetsOf(question) {
  const fm = (question && question.fm) || {};
  const out = [];
  const seen = new Set();
  for (const [kind] of TARGET_FACETS.concat(CONTEXT_FACETS)) {
    for (const value of valuesFor(fm, kind)) {
      const key = `${kind}:${value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ kind, value });
    }
  }
  return out;
}

/** History plus the note counters, with a fallback for trimmed history. */
function summaryOf(question) {
  const fm = (question && question.fm) || {};
  const rows = historyRows(fm.history).filter(
    (entry) => entry.result === "correct" || entry.result === "incorrect" || entry.score !== null
  );
  const counterAttempts = Math.max(0, Number(fm.attempts) || 0);
  const counterCorrect = Math.min(counterAttempts, Math.max(0, Number(fm.correct_count) || 0));
  const historyCorrect = rows.filter((entry) => entry.result === "correct").length;
  const attempts = Math.max(counterAttempts, rows.length);
  const extraAttempts = Math.max(0, attempts - rows.length);
  const extraCorrect = Math.max(0, Math.min(extraAttempts, counterCorrect - historyCorrect));
  let credit = rows.reduce((sum, entry) => sum + creditOf(entry), 0) + extraCorrect;
  let seconds = rows.reduce((sum, entry) => sum + Math.max(0, Number(entry.seconds) || 0), 0);
  if (!rows.length) credit = counterCorrect;
  let lastDay = "";
  for (const entry of rows) {
    const day = dayKey(entry.when);
    if (day > lastDay) lastDay = day;
  }
  if (!lastDay) lastDay = dayKey(fm["date attempted"]);
  const targetSeconds = Math.max(0, Number(fm.target_seconds) || 0) * attempts;
  return {
    attempts,
    credit,
    seconds,
    targetSeconds,
    skipped: Math.max(0, Math.round(Number(fm.skip_count) || 0)),
    lastDay,
  };
}

function aggregate(questions) {
  const map = new Map();
  for (const question of Array.isArray(questions) ? questions : []) {
    if (!question || !question.fm) continue;
    const summary = summaryOf(question);
    for (const facet of facetsOf(question)) {
      const key = `${facet.kind}:${facet.value}`;
      let row = map.get(key);
      if (!row) {
        map.set(key, (row = {
          kind: facet.kind,
          value: facet.value,
          questions: 0,
          attempted: 0,
          attempts: 0,
          credit: 0,
          seconds: 0,
          targetSeconds: 0,
          skipped: 0,
          lastDay: "",
        }));
      }
      row.questions++;
      if (summary.attempts) row.attempted++;
      row.attempts += summary.attempts;
      row.credit += summary.credit;
      row.seconds += summary.seconds;
      row.targetSeconds += summary.targetSeconds;
      row.skipped += summary.skipped;
      if (summary.lastDay > row.lastDay) row.lastDay = summary.lastDay;
    }
  }
  return map;
}

/**
 * Rank scoped facets by weakness. A facet with little scoped evidence borrows
 * its prior from the same facet across the whole vault, so one miss in a
 * one-question unit does not dominate a ten-question skill.
 */
function rankFacets(questions, allQuestions) {
  const scoped = aggregate(questions);
  const global = aggregate(Array.isArray(allQuestions) && allQuestions.length ? allQuestions : questions);
  const rows = [];
  for (const [key, row] of scoped) {
    const weight = TARGET_WEIGHT.get(row.kind);
    if (!weight) continue;
    const priorRow = global.get(key);
    const prior = priorRow && priorRow.attempts ? priorRow.credit / priorRow.attempts : 0.5;
    const effective = (row.credit + prior * PRIOR_ATTEMPTS) / (row.attempts + PRIOR_ATTEMPTS);
    const evidence = row.attempts / (row.attempts + PRIOR_ATTEMPTS);
    const pace = row.targetSeconds ? row.seconds / row.targetSeconds : null;
    const totalMarks = row.attempts + row.skipped;
    const skipRate = totalMarks ? row.skipped / totalMarks : 0;
    const priority =
      (1 - effective) *
      (0.55 + 0.45 * evidence) *
      weight *
      (pace !== null && pace > 1.15 ? 1.08 : 1) *
      (1 + Math.min(0.25, skipRate * 0.25)) *
      (row.attempts ? 1 : 1.08);
    rows.push({
      ...row,
      globalAttempts: priorRow ? priorRow.attempts : 0,
      prior,
      effective,
      evidence,
      pace,
      skipRate,
      priority,
    });
  }
  rows.sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    if (a.attempts !== b.attempts) return b.attempts - a.attempts;
    if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
    return a.value.localeCompare(b.value, undefined, { numeric: true });
  });
  return rows;
}

function cooldownCutoff(today) {
  const day = dayKey(today);
  return day ? fmtDate(addDays(dateFromDay(day), -ADAPTIVE_COOLDOWN_DAYS)) : "";
}

/** A question is eligible when it is studyable and outside the exact-repeat window. */
function eligible(question, today, recent) {
  if (!question || !question.fm || !isStudyable(question.fm, today)) return false;
  const path = question.file && question.file.path;
  if (path && (recent || []).includes(path)) return false;
  const cutoff = cooldownCutoff(today);
  if (!cutoff) return true;
  const last = summaryOf(question).lastDay;
  return !last || daysBetween(last, dayKey(today)) >= ADAPTIVE_COOLDOWN_DAYS;
}

function hasFacet(question, facet) {
  return facetsOf(question).some((item) => item.kind === facet.kind && item.value === facet.value);
}

function sharedFacetCount(question, facet) {
  const values = new Set(facetsOf(question).map((item) => `${item.kind}:${item.value}`));
  return TARGET_FACETS.concat(CONTEXT_FACETS).filter(([kind]) => values.has(`${kind}:${facet.value}`)).length;
}

function difficultyRank(value) {
  const rank = { easy: 0, medium: 1, hard: 2 }[clean(value)];
  return rank === undefined ? 1 : rank;
}

function candidateWeight(question, facet, today) {
  const summary = summaryOf(question);
  const desired = facet.effective < 0.6 ? 0 : facet.effective < 0.85 ? 1 : 2;
  const distance = Math.abs(difficultyRank(question.fm && question.fm.difficulty) - desired);
  const difficulty = distance === 0 ? 1.2 : distance === 1 ? 1 : 0.75;
  const gap = summary.lastDay ? daysBetween(summary.lastDay, dayKey(today)) : null;
  const novelty = summary.attempts ? 1 + Math.min(1, Math.max(0, gap || 0) / 30) : 1.4;
  const due = question.fm && dayKey(question.fm.next_review) && dayKey(question.fm.next_review) <= dayKey(today) ? 1.15 : 1;
  const shared = 1 + 0.25 * Math.min(4, sharedFacetCount(question, facet) - 1);
  return shared * difficulty * novelty * due;
}

function weightedPick(items, weightFor, rnd) {
  const random = typeof rnd === "function" ? rnd : Math.random;
  const weights = items.map((item) => Math.max(0.0001, Number(weightFor(item)) || 0));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let mark = random() * total;
  for (let i = 0; i < items.length; i++) {
    mark -= weights[i];
    if (mark <= 0) return items[i];
  }
  return items[items.length - 1];
}

/**
 * Pick the next adaptive question. `pool` is the selected subgroup; `all` is
 * the whole question set used only for the prior. Returns `{ question, reason }`
 * or null when every question in the subgroup is already in the cooldown.
 */
function pickAdaptiveQuestion(pool, all, today, recent, rnd) {
  const available = (Array.isArray(pool) ? pool : []).filter(
    (question) => question && question.fm && isStudyable(question.fm, today)
  );
  if (!available.length) return null;
  const global = Array.isArray(all) && all.length ? all : available;
  const ranked = rankFacets(available, global);
  for (const facet of ranked.slice(0, 4)) {
    const candidates = available.filter((question) => eligible(question, today, recent) && hasFacet(question, facet));
    if (!candidates.length) continue;
    const question = weightedPick(candidates, (item) => candidateWeight(item, facet, today), rnd);
    return {
      question,
      reason: {
        kind: facet.kind,
        value: facet.value,
        accuracy: facet.effective,
        attempts: facet.attempts,
      },
    };
  }
  const fallback = available.filter((question) => eligible(question, today, recent));
  if (!fallback.length) return null;
  return {
    question: weightedPick(fallback, (question) => (summaryOf(question).attempts ? 1 : 1.5), rnd),
    reason: null,
  };
}

module.exports = {
  ADAPTIVE_COOLDOWN_DAYS,
  PRIOR_ATTEMPTS,
  TARGET_FACETS,
  aggregate,
  facetsOf,
  pickAdaptiveQuestion,
  rankFacets,
  summaryOf,
};
