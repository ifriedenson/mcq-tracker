"use strict";
/*
 * CBT-style exam practice. A block is one exam; answers, flags and attempts
 * live in plugin data, never in the note. The navigator, sidecar history and
 * adaptive review are local; nothing is sent to a provider and the card
 * scheduler is untouched.
 *
 *   ```cbt-exam
 *   Exam: Biology midterm
 *   Time: 30
 *   ---
 *   Q: Which organelle produces most ATP?
 *   Topic: Cells
 *   A. Mitochondrion
 *   B. Nucleus
 *   Answer: A
 *   Why: Oxidative phosphorylation happens in the inner membrane.
 *   ---
 *   Q: What does a catalyst do?
 *   A. Raises activation energy
 *   B. Lowers activation energy
 *   Answer: B
 *   ```
 */
const { hashString, str } = require("./util");

const MAX_QUESTIONS = 300;
const MAX_HISTORY_KEYS = 200;
const MAX_ATTEMPTS = 20;
const MAX_TITLE = 200;

function clean(value) {
  return str(value).replace(/\s+/g, " ").trim();
}

function normalizeCbtExamSettings(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const history = {};
  const rawHistory = source.history && typeof source.history === "object" && !Array.isArray(source.history) ? source.history : {};
  for (const [rawKey, rawAttempts] of Object.entries(rawHistory).slice(0, MAX_HISTORY_KEYS)) {
    const key = str(rawKey).trim().slice(0, 400);
    if (!key || !Array.isArray(rawAttempts)) continue;
    const attempts = [];
    for (const raw of rawAttempts.slice(0, MAX_ATTEMPTS)) {
      if (!raw || typeof raw !== "object") continue;
      const total = Math.max(0, Math.round(Number(raw.total) || 0));
      if (!total) continue;
      const score = Math.max(0, Math.min(total, Math.round(Number(raw.score) || 0)));
      const missed = (Array.isArray(raw.missed) ? raw.missed : []).map((id) => str(id).trim().slice(0, 160)).filter(Boolean).slice(0, 200);
      const topics = {};
      const rawTopics = raw.topics && typeof raw.topics === "object" && !Array.isArray(raw.topics) ? raw.topics : {};
      for (const [topic, counts] of Object.entries(rawTopics).slice(0, 50)) {
        const name = str(topic).trim().slice(0, 120);
        if (!name || !counts || typeof counts !== "object") continue;
        const topicTotal = Math.max(0, Math.round(Number(counts.total) || 0));
        if (!topicTotal) continue;
        topics[name] = { correct: Math.max(0, Math.min(topicTotal, Math.round(Number(counts.correct) || 0))), total: topicTotal };
      }
      attempts.push({
        at: Math.max(0, Math.round(Number(raw.at) || 0)),
        score,
        total,
        percentage: Math.max(0, Math.min(100, Math.round(Number(raw.percentage) || Math.round((score / total) * 100)))),
        missed,
        topics,
        durationMs: Math.max(0, Math.round(Number(raw.durationMs) || 0)),
      });
    }
    if (attempts.length) history[key] = attempts;
  }
  return { enabled: !(value === false || (value && typeof value === "object" && value.enabled === false)), history };
}

function parseChoiceLine(line) {
  const match = clean(line).match(/^([A-H])\s*[.):]\s*(.*)$/i);
  if (!match) return null;
  return { letter: match[1].toUpperCase(), text: match[2].trim() };
}

function parseCbtExamBlock(source) {
  const text = str(source).replace(/\r\n?/g, "\n");
  const sections = [];
  let lines = [];
  for (const line of text.split("\n")) {
    if (/^---+$/.test(line.trim())) {
      if (lines.some((entry) => entry.trim())) sections.push(lines);
      lines = [];
    } else {
      lines.push(line);
    }
  }
  if (lines.some((entry) => entry.trim())) sections.push(lines);

  let title = "";
  let minutes = 0;
  const questions = [];
  for (const section of sections) {
    let prompt = "";
    let answer = "";
    let why = "";
    let topic = "";
    let last = "";
    let isHeader = false;
    const choices = [];
    for (const raw of section) {
      const line = raw.trim();
      if (!line) continue;
      const titleLine = line.match(/^(?:exam|title)\s*[:=]\s*(.*)$/i);
      if (titleLine && !prompt && !choices.length) {
        title = clean(titleLine[1]).slice(0, MAX_TITLE);
        isHeader = true;
        continue;
      }
      const timeLine = line.match(/^(?:time|minutes|duration)\s*[:=]\s*(\d+)/i);
      if (timeLine && !prompt && !choices.length) {
        minutes = Math.max(0, Math.min(600, Number(timeLine[1]) || 0));
        isHeader = true;
        continue;
      }
      const questionLine = line.match(/^(?:q|question|stem)\s*\d*\s*[:=]\s*(.*)$/i);
      if (questionLine) {
        prompt = questionLine[1].trim();
        last = "prompt";
        continue;
      }
      const topicLine = line.match(/^topic\s*[:=]\s*(.*)$/i);
      if (topicLine) {
        topic = clean(topicLine[1]).slice(0, 120);
        last = "";
        continue;
      }
      const answerLine = line.match(/^(?:answer|key)\s*[:=]\s*(.*)$/i);
      if (answerLine) {
        answer = clean(answerLine[1]).toUpperCase().match(/^[A-H]/)?.[0] || "";
        last = "answer";
        continue;
      }
      const whyLine = line.match(/^(?:why|explanation|rationale)\s*[:=]\s*(.*)$/i);
      if (whyLine) {
        why = whyLine[1].trim();
        last = "why";
        continue;
      }
      const choice = parseChoiceLine(line);
      if (choice) {
        choices.push(choice);
        last = "";
        continue;
      }
      if (last === "prompt") prompt = `${prompt} ${line}`.trim();
      else if (last === "why") why = `${why} ${line}`.trim();
    }
    if (isHeader && !prompt && !choices.length) continue;
    if (!prompt && !choices.length) continue;
    const normalizedChoices = choices.filter((choice) => clean(choice.text));
    const issues = [];
    if (!clean(prompt)) issues.push("Add a Q: line with the question.");
    if (normalizedChoices.length < 2) issues.push("Add at least two lettered choices.");
    if (!answer || !normalizedChoices.some((choice) => choice.letter === answer)) {
      issues.push("Add an Answer: letter that matches a listed choice.");
      if (answer) answer = "";
    }
    questions.push({
      id: `q${questions.length + 1}-${hashString(clean(prompt)).slice(0, 8)}`,
      prompt: clean(prompt),
      choices: normalizedChoices,
      answer,
      why: clean(why),
      topic: topic || "General",
      valid: issues.length === 0,
      issues,
    });
    if (questions.length >= MAX_QUESTIONS) break;
  }

  const blockIssues = questions.length ? [] : ["Add at least one question separated by ---."];
  return {
    title: title || "CBT exam",
    minutes,
    questions,
    issues: blockIssues.concat(questions.flatMap((question, index) => question.issues.map((issue) => `Question ${index + 1}: ${issue}`))),
  };
}

function gradeCbtQuestion(question, picked) {
  const q = question || {};
  const letter = clean(picked).toUpperCase().match(/^[A-H]/)?.[0] || "";
  return { correct: !!q.answer && letter === q.answer, key: q.answer || "", picked: letter, type: "mcq" };
}

function summarizeCbtAttempt(exam, answers, options) {
  const opts = options || {};
  const questions = (exam && Array.isArray(exam.questions) ? exam.questions : []).filter((question) => question.valid);
  const byId = answers && typeof answers === "object" ? answers : {};
  const topics = {};
  const missed = [];
  let score = 0;
  for (const question of questions) {
    const graded = gradeCbtQuestion(question, byId[question.id]);
    const topic = question.topic || "General";
    if (!topics[topic]) topics[topic] = { correct: 0, total: 0 };
    topics[topic].total += 1;
    if (graded.correct) {
      score += 1;
      topics[topic].correct += 1;
    } else {
      missed.push(question.id);
    }
  }
  const total = questions.length;
  return {
    at: Math.max(0, Math.round(Number(opts.now) || Date.now())),
    score,
    total,
    percentage: total ? Math.round((score / total) * 100) : 0,
    missed,
    topics,
    durationMs: Math.max(0, Math.round(Number(opts.durationMs) || 0)),
  };
}

/** Missed questions first, then the rest in exam order. */
function adaptiveCbtOrder(exam, missed) {
  const questions = (exam && Array.isArray(exam.questions) ? exam.questions : []).filter((question) => question.valid);
  const missedSet = new Set(Array.isArray(missed) ? missed : []);
  return questions
    .map((question, index) => ({ id: question.id, index }))
    .sort((a, b) => {
      const am = missedSet.has(a.id) ? 0 : 1;
      const bm = missedSet.has(b.id) ? 0 : 1;
      if (am !== bm) return am - bm;
      return a.index - b.index;
    })
    .map((entry) => entry.id);
}

function attemptLabel(attempt) {
  if (!attempt || !attempt.total) return "";
  return `${attempt.score}/${attempt.total} · ${attempt.percentage}%`;
}

function renderCbtExamBlock(plugin, source, el, ctx) {
  const exam = parseCbtExamBlock(source);
  const key = `${str(ctx && ctx.sourcePath).trim() || "note"}::${exam.title}`;
  const history = (plugin && plugin.settings && plugin.settings.cbtExam && plugin.settings.cbtExam.history) || {};
  const prior = Array.isArray(history[key]) ? history[key].slice() : [];
  let answers = {};
  let flags = new Set();
  let current = 0;
  let order = exam.questions.filter((question) => question.valid).map((question) => question.id);
  let submitted = null;
  let adaptive = false;
  let startedAt = Date.now();

  const box = el.createDiv({ cls: "qt-cbt-exam" });
  const draw = () => {
    box.empty();
    box.createDiv({ cls: "qt-cbt-exam-title", text: `CBT Exam · ${exam.title}` });
    box.createDiv({
      cls: "qt-cbt-exam-meta",
      text: `${exam.questions.length} question${exam.questions.length === 1 ? "" : "s"}${exam.minutes ? ` · suggested ${exam.minutes} min` : ""} · local · no note changes`,
    });
    for (const issue of exam.issues.slice(0, 8)) box.createDiv({ cls: "qt-cbt-exam-issue", text: issue });
    const questions = order.map((id) => exam.questions.find((question) => question.id === id)).filter(Boolean);
    if (!questions.length) return;

    const nav = box.createDiv({ cls: "qt-cbt-exam-nav" });
    nav.createDiv({ cls: "qt-cbt-exam-nav-label", text: "Question navigator" });
    const grid = nav.createDiv({ cls: "qt-cbt-exam-grid" });
    for (const [position, question] of questions.entries()) {
      const original = exam.questions.indexOf(question) + 1;
      const button = grid.createEl("button", {
        cls: "qt-cbt-exam-cell",
        text: String(original),
        attr: { "aria-label": `Question ${original}` },
      });
      button.toggleClass("is-answered", Object.prototype.hasOwnProperty.call(answers, question.id));
      button.toggleClass("is-flagged", flags.has(question.id));
      button.toggleClass("is-current", position === current);
      button.addEventListener("click", () => {
        current = position;
        draw();
      });
    }
    nav.createDiv({
      cls: "qt-cbt-exam-counts",
      text: `${Object.keys(answers).length} answered · ${flags.size} flagged${adaptive ? " · adaptive review" : ""}`,
    });

    const question = questions[Math.min(current, questions.length - 1)];
    const card = box.createDiv({ cls: "qt-cbt-exam-question" });
    card.createDiv({ cls: "qt-cbt-exam-topic", text: `${current + 1} of ${questions.length} · ${question.topic}` });
    card.createDiv({ cls: "qt-cbt-exam-prompt", text: question.prompt });
    const choices = card.createDiv({ cls: "qt-cbt-exam-choices" });
    for (const choice of question.choices) {
      const button = choices.createEl("button", {
        cls: "qt-cbt-exam-choice",
        text: `${choice.letter}. ${choice.text}`,
      });
      button.toggleClass("is-picked", answers[question.id] === choice.letter);
      button.addEventListener("click", () => {
        if (submitted) return;
        answers[question.id] = choice.letter;
        draw();
      });
    }

    const controls = box.createDiv({ cls: "qt-cbt-exam-controls" });
    const previous = controls.createEl("button", { text: "Previous" });
    previous.disabled = current === 0;
    previous.addEventListener("click", () => {
      current = Math.max(0, current - 1);
      draw();
    });
    const flag = controls.createEl("button", { text: flags.has(question.id) ? "Unflag" : "Flag for review" });
    flag.addEventListener("click", () => {
      if (flags.has(question.id)) flags.delete(question.id);
      else flags.add(question.id);
      draw();
    });
    const next = controls.createEl("button", { text: "Next" });
    next.disabled = current >= questions.length - 1;
    next.addEventListener("click", () => {
      current = Math.min(questions.length - 1, current + 1);
      draw();
    });

    if (!submitted) {
      const submit = controls.createEl("button", { cls: "qt-cbt-exam-submit", text: "Submit exam" });
      submit.addEventListener("click", () => {
        submitted = summarizeCbtAttempt(exam, answers, { now: Date.now(), durationMs: Date.now() - startedAt });
        if (plugin && plugin.settings && plugin.settings.cbtExam) {
          const store = plugin.settings.cbtExam.history || {};
          const list = Array.isArray(store[key]) ? store[key].slice() : [];
          list.push(submitted);
          store[key] = list.slice(-MAX_ATTEMPTS);
          plugin.settings.cbtExam.history = store;
          prior.length = 0;
          prior.push(...store[key]);
          Promise.resolve(plugin.save()).catch(() => {});
        }
        current = 0;
        draw();
      });
    } else {
      const result = box.createDiv({ cls: "qt-cbt-exam-result" });
      result.createDiv({ cls: "qt-cbt-exam-score", text: `${submitted.score} / ${submitted.total} · ${submitted.percentage}%` });
      const topicLine = Object.entries(submitted.topics)
        .map(([topic, counts]) => `${topic} ${counts.correct}/${counts.total}`)
        .join(" · ");
      if (topicLine) result.createDiv({ cls: "qt-cbt-exam-topics", text: topicLine });
      if (submitted.missed.length) {
        const missed = submitted.missed
          .map((id) => exam.questions.findIndex((entry) => entry.id === id) + 1)
          .filter((index) => index > 0);
        result.createDiv({ cls: "qt-cbt-exam-missed", text: `Missed: ${missed.join(", ")}` });
        const adaptiveButton = result.createEl("button", { cls: "qt-cbt-exam-adaptive", text: "Adaptive review (missed first)" });
        adaptiveButton.addEventListener("click", () => {
          order = adaptiveCbtOrder(exam, submitted.missed);
          adaptive = true;
          answers = {};
          flags = new Set();
          submitted = null;
          current = 0;
          startedAt = Date.now();
          draw();
        });
      }
    }

    const historyCard = box.createDiv({ cls: "qt-cbt-exam-history" });
    historyCard.createDiv({ cls: "qt-cbt-exam-history-label", text: "History on this device" });
    const attempts = prior.slice(-5).reverse();
    if (!attempts.length) historyCard.createDiv({ cls: "qt-cbt-exam-history-empty", text: "No submitted attempts for this exam yet." });
    for (const attempt of attempts) {
      const when = attempt.at ? new Date(attempt.at).toLocaleString() : "Unknown time";
      historyCard.createDiv({ cls: "qt-cbt-exam-history-row", text: `${when} · ${attemptLabel(attempt)}` });
    }
  };
  draw();
  return exam;
}

module.exports = {
  adaptiveCbtOrder,
  attemptLabel,
  gradeCbtQuestion,
  normalizeCbtExamSettings,
  parseCbtExamBlock,
  renderCbtExamBlock,
  summarizeCbtAttempt,
};
