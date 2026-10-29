"use strict";
/*
 * Read-only study context for the assistant.
 *
 * These toggles are deliberately aggregate: counts, accuracy and the next exam.
 * Note bodies, question text, answers and personal notes are never included
 * here. A chat only receives this text when the learner has enabled the
 * matching toggle and AI features; nothing is built or sent otherwise.
 */
const { isDue } = require("./filters");
const { examCountdown, upcomingExams } = require("./calendar-model");
const { localDate, str } = require("./util");

const DEFAULT_AI_CONTEXT = { stats: false, due: false, exams: false };
const CONTEXT_KEYS = ["stats", "due", "exams"];

function normalizeAiContext(value) {
  const saved = value && typeof value === "object" ? value : {};
  const out = {};
  for (const key of CONTEXT_KEYS) out[key] = saved[key] === true;
  return out;
}

function anyContext(value) {
  const context = normalizeAiContext(value);
  return CONTEXT_KEYS.some((key) => context[key]);
}

function percent(correct, attempts) {
  if (!attempts) return "0%";
  return `${Math.round((correct / attempts) * 100)}%`;
}

function questionList(plugin) {
  try {
    return plugin && typeof plugin.getQuestions === "function" ? plugin.getQuestions() : [];
  } catch (e) {
    return [];
  }
}

function cardList(plugin) {
  try {
    return plugin && typeof plugin.getCards === "function" ? plugin.getCards() : [];
  } catch (e) {
    return [];
  }
}

function weakestSkill(questions) {
  const groups = new Map();
  for (const question of questions) {
    const fm = (question && question.fm) || {};
    const skill = str(fm.skill).trim();
    const attempts = Number(fm.attempts) || 0;
    if (!skill || attempts < 3) continue;
    const group = groups.get(skill) || { attempts: 0, correct: 0 };
    group.attempts += attempts;
    group.correct += Number(fm.correct_count) || 0;
    groups.set(skill, group);
  }
  let weakest = null;
  for (const [skill, group] of groups) {
    const accuracy = group.correct / group.attempts;
    if (!weakest || accuracy < weakest.accuracy) weakest = { skill, ...group, accuracy };
  }
  return weakest;
}

function buildStudyContext(plugin, options, now) {
  const context = normalizeAiContext(options);
  if (!anyContext(context)) return "";
  const today = localDate();
  const questions = questionList(plugin);
  const lines = ["READ-ONLY STUDY CONTEXT (aggregate vault properties only; no note text is included)."];

  if (context.stats) {
    let attempts = 0;
    let correct = 0;
    let attempted = 0;
    for (const question of questions) {
      const fm = (question && question.fm) || {};
      const n = Number(fm.attempts) || 0;
      if (!n) continue;
      attempted++;
      attempts += n;
      correct += Number(fm.correct_count) || 0;
    }
    lines.push(
      `Practice: ${questions.length} question${questions.length === 1 ? "" : "s"}; ${attempted} attempted; ` +
        `${attempts} attempt${attempts === 1 ? "" : "s"}; accuracy ${percent(correct, attempts)}.`,
    );
    const weakest = weakestSkill(questions);
    if (weakest) {
      lines.push(
        `Weakest skill with at least 3 attempts: ${weakest.skill} (${percent(weakest.correct, weakest.attempts)}, ` +
          `${weakest.attempts} attempt${weakest.attempts === 1 ? "" : "s"}).`,
      );
    }
  }

  if (context.due) {
    const due = questions.filter((question) => isDue((question && question.fm) || {}, today)).length;
    const unseen = questions.filter((question) => !Number(((question && question.fm) || {}).attempts)).length;
    const cards = cardList(plugin);
    const dueCards = cards.filter((card) => {
      const fm = (card && card.fm) || {};
      return Number(fm.attempts) > 0 && str(fm.next_review).slice(0, 10) && str(fm.next_review).slice(0, 10) <= today;
    }).length;
    const newCards = cards.filter((card) => !Number(((card && card.fm) || {}).attempts)).length;
    lines.push(
      `Due today: ${due} question${due === 1 ? "" : "s"} (${unseen} unseen), ` +
        `${dueCards} card${dueCards === 1 ? "" : "s"} due (${newCards} new).`,
    );
  }

  if (context.exams) {
    const events = typeof plugin.calendarEvents === "function" ? plugin.calendarEvents() : [];
    const exam = upcomingExams(events || [], now || new Date(), 1)[0];
    if (exam) {
      lines.push(
        `Next exam: ${str(exam.summary) || "Exam"} on ${exam.dateKey || "an unscheduled date"} ` +
          `(${examCountdown(exam, now || new Date())}).`,
      );
    } else {
      lines.push("No upcoming exam is currently loaded in the calendar.");
    }
  }

  lines.push("Use this context only when it helps; do not claim access to any note text.");
  return lines.join("\n");
}

module.exports = {
  CONTEXT_KEYS,
  DEFAULT_AI_CONTEXT,
  anyContext,
  buildStudyContext,
  normalizeAiContext,
};
