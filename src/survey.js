"use strict";
/*
 * Optional in-plugin feedback survey.
 *
 * The form only builds a Markdown summary and copies it to the clipboard. It
 * makes no network request, writes no vault file and stores nothing unless the
 * user copies the text themselves.
 */
const { localDate, str } = require("./util");

const SURVEY_ROLES = [
  "Exam prep (AP, SAT, ACT)",
  "College coursework",
  "Language learning",
  "Professional certification",
  "Something else",
];

function normalizeSurvey(input) {
  const src = input && typeof input === "object" ? input : {};
  const rating = Math.round(Number(src.rating));
  return {
    rating: Number.isFinite(rating) ? Math.max(1, Math.min(5, rating)) : 0,
    role: str(src.role).trim(),
    likes: str(src.likes).trim(),
    improve: str(src.improve).trim(),
    quote: src.quote === true,
    date: str(src.date).trim() || localDate(),
  };
}

/** A short Markdown summary the learner can paste into any feedback channel. */
function buildSurveySummary(input) {
  const survey = normalizeSurvey(input);
  const lines = ["# MCQ Tracker feedback", "", `Date: ${survey.date}`, `Rating: ${survey.rating ? `${survey.rating}/5` : "not answered"}`];
  if (survey.role) lines.push(`Used for: ${survey.role}`);
  if (survey.likes) lines.push("", "## What works well", "", survey.likes);
  if (survey.improve) lines.push("", "## What should improve", "", survey.improve);
  if (survey.quote) lines.push("", "You may quote this feedback.");
  lines.push("", "_Shared from the optional in-plugin survey. No network request was made._");
  return lines.join("\n") + "\n";
}

/** Copies the summary; the caller shows the result and never sends it. */
async function copySurveySummary(input) {
  const text = buildSurveySummary(input);
  if (typeof navigator === "undefined" || !navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
    throw new Error("This build cannot write to the clipboard. Copy the text from the form instead.");
  }
  await navigator.clipboard.writeText(text);
  return text;
}

module.exports = {
  SURVEY_ROLES,
  normalizeSurvey,
  buildSurveySummary,
  copySurveySummary,
};
