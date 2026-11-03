"use strict";
/*
 * Adaptive mastery selection.
 *
 * This is deliberately separate from the FSRS due queue. Adaptive practice
 * looks at the learner's whole history, ranks the course/unit/skill/test facets
 * that look weakest, and then picks a different question from the weakest
 * facet. A question is never repeated in the same session, and a question whose
 * last attempt was a miss stays out until its weak facet has improved to 75%
 * with at least five attempts. If the filtered pool has no other eligible
 * question, the least recently attempted item is the last-resort safety valve
 * so a very small pool can still be practised.
 *
 * The module is pure: it reads question frontmatter and history only, makes no
 * network request and never writes a note or schedule.
 */
const { creditOf } = require("./history");
const { str } = require("./util");
const { isStudyable } = require("./study-status");

const PRIOR_ATTEMPTS = 5;
const MASTERY_RELEASE = 0.75;
const MASTERY_MIN_ATTEMPTS = 5;
const MIN_SHARED_PROPERTIES = 2;
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
  let last = null;
  for (const entry of rows) {
    if (!last || entry.when >= last.when) last = entry;
  }
  let lastDay = "";
  for (const entry of rows) {
    const day = dayKey(entry.when);
    if (day > lastDay) lastDay = day;
  }
  if (!lastDay) lastDay = dayKey(fm["date attempted"]);
  const rawScore = fm.last_score;
  const numericScore = rawScore === undefined || str(rawScore).trim() === "" ? null : Number(rawScore);
  const propertyScore = Number.isFinite(numericScore) ? Math.max(0, Math.min(100, numericScore)) : null;
  const lastScore = last && last.score !== null ? last.score : propertyScore;
  const lastResult = last ? last.result : str(fm.result).toLowerCase();
  const lastCredit = last ? creditOf(last) : lastScore !== null ? lastScore / 100 : lastResult === "correct" ? 1 : 0;
  const targetSeconds = Math.max(0, Number(fm.target_seconds) || 0) * attempts;
  return {
    attempts,
    credit,
    seconds,
    targetSeconds,
    skipped: Math.max(0, Math.round(Number(fm.skip_count) || 0)),
    lastDay,
    lastResult,
    lastScore,
    lastCredit,
  };
}

/** A miss is the last result, or a partial score below 60. */
function needsMastery(summary) {
  if (!summary || !summary.attempts) return false;
  if (summary.lastResult === "incorrect") return true;
  return summary.lastScore !== null && summary.lastScore < 60;
}

/** Enough evidence and enough accuracy to let an exact missed item return. */
function masteryReady(facet) {
  return !!facet && facet.attempts >= MASTERY_MIN_ATTEMPTS && facet.effective >= MASTERY_RELEASE;
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

/** A question is eligible when it is studyable, outside this session, and its miss has been mastered. */
function eligible(question, today, recent, facet) {
  if (!question || !question.fm || !isStudyable(question.fm, today)) return false;
  const path = question.file && question.file.path;
  if (path && (recent || []).includes(path)) return false;
  const summary = summaryOf(question);
  if (!needsMastery(summary)) return true;
  return masteryReady(facet);
}

function hasFacet(question, facet) {
  return facetsOf(question).some((item) => item.kind === facet.kind && item.value === facet.value);
}

function facetKeySet(question) {
  return new Set(facetsOf(question).map((item) => `${item.kind}:${item.value}`));
}

/** How many identity/context properties two questions share. */
function sharedPropertyCount(a, b) {
  if (!a || !b) return 0;
  const other = facetKeySet(b);
  let count = 0;
  for (const key of facetKeySet(a)) if (other.has(key)) count++;
  return count;
}

function isSimilar(question, anchor) {
  return !!anchor && sharedPropertyCount(question, anchor) >= MIN_SHARED_PROPERTIES;
}

/** The most recent question in a facet, preferring the current session's question. */
function anchorFor(questions, facet, recent) {
  const matching = (Array.isArray(questions) ? questions : []).filter((question) => hasFacet(question, facet));
  if (!matching.length) return null;
  const recentPaths = (Array.isArray(recent) ? recent : []).filter(Boolean);
  for (let i = recentPaths.length - 1; i >= 0; i--) {
    const found = matching.find((question) => question.file && question.file.path === recentPaths[i]);
    if (found) return found;
  }
  let best = null;
  let bestDay = "";
  for (const question of matching) {
    const summary = summaryOf(question);
    if (!summary.lastDay) continue;
    if (!best || summary.lastDay >= bestDay) {
      best = question;
      bestDay = summary.lastDay;
    }
  }
  return best || matching[0];
}

function difficultyRank(value) {
  const rank = { easy: 0, medium: 1, hard: 2 }[clean(value)];
  return rank === undefined ? 1 : rank;
}

function candidateWeight(question, facet, today, anchor) {
  const summary = summaryOf(question);
  const desired = facet.effective < 0.6 ? 0 : facet.effective < 0.85 ? 1 : 2;
  const distance = Math.abs(difficultyRank(question.fm && question.fm.difficulty) - desired);
  const difficulty = distance === 0 ? 1.2 : distance === 1 ? 1 : 0.75;
  const gap = summary.lastDay ? daysBetween(summary.lastDay, dayKey(today)) : null;
  const novelty = summary.attempts ? 1 + Math.min(1, Math.max(0, gap || 0) / 30) : 1.4;
  const due = question.fm && dayKey(question.fm.next_review) && dayKey(question.fm.next_review) <= dayKey(today) ? 1.15 : 1;
  const shared = 1 + 0.25 * Math.min(4, Math.max(0, sharedPropertyCount(question, anchor) - 1));
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
  const top = ranked.slice(0, 4);

  const choose = (facet, candidates, anchor, reason) => {
    if (!candidates.length) return null;
    return {
      question: weightedPick(candidates, (item) => candidateWeight(item, facet, today, anchor), rnd),
      reason: {
        kind: facet.kind,
        value: facet.value,
        accuracy: facet.effective,
        attempts: facet.attempts,
        ...(reason || {}),
      },
    };
  };

  // First pass: the replacement shares the weak facet plus another property with
  // the most recent question in that facet.
  for (const facet of top) {
    const anchor = anchorFor(available, facet, recent);
    const candidates = available.filter(
      (question) =>
        question !== anchor &&
        eligible(question, today, recent, facet) &&
        hasFacet(question, facet) &&
        isSimilar(question, anchor)
    );
    const picked = choose(facet, candidates, anchor);
    if (picked) return picked;
  }

  // Second pass: a same-area question is still better than no practice when the
  // pool has no second-property match.
  for (const facet of top) {
    const anchor = anchorFor(available, facet, recent);
    const candidates = available.filter(
      (question) => question !== anchor && eligible(question, today, recent, facet) && hasFacet(question, facet)
    );
    const picked = choose(facet, candidates, anchor, { similarity: "same-area" });
    if (picked) return picked;
  }

  // Any eligible question, even one outside the currently weakest facets.
  const fallback = available.filter((question) => eligible(question, today, recent, null));
  if (fallback.length) {
    return {
      question: weightedPick(fallback, (question) => (summaryOf(question).attempts ? 1 : 1.5), rnd),
      reason: { kind: null, value: "", accuracy: null, attempts: 0, similarity: "any" },
    };
  }

  // Last resort: every remaining item was missed and its area is still weak.
  // Return the least recently attempted item rather than an empty session.
  const recentPaths = new Set((Array.isArray(recent) ? recent : []).filter(Boolean));
  const leftovers = available
    .filter((question) => !(question.file && recentPaths.has(question.file.path)))
    .sort((a, b) => {
      const dayA = summaryOf(a).lastDay || "";
      const dayB = summaryOf(b).lastDay || "";
      if (dayA !== dayB) return dayA.localeCompare(dayB);
      const pathA = (a.file && a.file.path) || "";
      const pathB = (b.file && b.file.path) || "";
      return pathA.localeCompare(pathB);
    });
  if (!leftovers.length) return null;
  return {
    question: leftovers[0],
    reason: { kind: null, value: "", accuracy: null, attempts: 0, exhausted: true },
  };
}

module.exports = {
  MASTERY_MIN_ATTEMPTS,
  MASTERY_RELEASE,
  MIN_SHARED_PROPERTIES,
  PRIOR_ATTEMPTS,
  TARGET_FACETS,
  aggregate,
  anchorFor,
  facetsOf,
  isSimilar,
  masteryReady,
  needsMastery,
  pickAdaptiveQuestion,
  rankFacets,
  sharedPropertyCount,
  summaryOf,
};
