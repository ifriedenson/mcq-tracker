"use strict";
/*
 * Render a `quizport` fenced block. The player is intentionally local and
 * read-only: it grades in memory and never records attempts, history, streak or
 * scheduler state. A block can hold JSON directly or a `file:` path plus
 * `shuffle: true`; the file path resolves like a note link.
 */
const { TFile } = require("obsidian");
const { str } = require("./util");
const { LETTERS, parseQuizPortBlock, parseQuizPortData, quizPortResult, scoreQuizPortAnswer, shuffleQuizPortQuestions } = require("./quizport");

/** Resolve a QuizPort `file:` against the vault and the containing note's folder. */
function resolveQuizPortFile(plugin, path, sourcePath) {
  const target = str(path).trim().replace(/^\/+/, "");
  if (!target) return null;
  const dir = str(sourcePath).includes("/") ? str(sourcePath).replace(/\/[^/]*$/, "") : "";
  const candidates = [target, dir ? `${dir}/${target}` : ""];
  if (!/\.json$/i.test(target)) candidates.push(`${target}.json`, dir ? `${dir}/${target}.json` : "");
  for (const candidate of candidates) {
    if (!candidate) continue;
    const file = plugin.app.vault.getAbstractFileByPath(candidate);
    if (file instanceof TFile) return file;
  }
  return null;
}

async function renderQuizPortBlock(plugin, source, el, ctx) {
  let meta = parseQuizPortBlock(source);
  let questions = meta.questions;
  const issues = meta.issues.slice();
  if (meta.file) {
    const file = resolveQuizPortFile(plugin, meta.file, ctx && ctx.sourcePath);
    if (!file) {
      issues.push(`QuizPort file "${meta.file}" was not found in the vault.`);
    } else {
      try {
        const loaded = parseQuizPortData(JSON.parse(await plugin.app.vault.cachedRead(file)));
        meta = { ...meta, ...loaded, file: meta.file, shuffle: meta.shuffle || loaded.shuffle };
        questions = loaded.questions;
        issues.push(...loaded.issues);
      } catch (e) {
        issues.push("That QuizPort file is not valid JSON.");
      }
    }
  }
  const box = el.createDiv({ cls: "qt-quiz-block qt-quizport" });
  if (meta.title) box.createDiv({ cls: "qt-quiz-title", text: meta.title });
  const badges = [meta.category, meta.difficulty, meta.author].filter(Boolean);
  if (badges.length) box.createDiv({ cls: "qt-quiz-meta", text: badges.join(" · ") });
  if (meta.description) box.createDiv({ cls: "qt-quiz-description", text: meta.description });
  for (const issue of issues.slice(0, 8)) box.createDiv({ cls: "qt-quiz-issue", text: issue });
  if (!questions.length) return;
  if (meta.shuffle) {
    questions = shuffleQuizPortQuestions(questions, `${meta.file || ""}|${source}|${ctx && ctx.sourcePath ? ctx.sourcePath : ""}|${Date.now()}`);
  }
  const summary = box.createDiv({ cls: "qt-quiz-summary" });
  const stage = box.createDiv({ cls: "qt-quizport-stage" });
  let active = questions.slice();
  let records = [];
  let index = 0;
  const paintSummary = () => {
    const result = quizPortResult(active, records);
    if (!result.answered) {
      summary.setText(`${active.length} question${active.length === 1 ? "" : "s"} · choose an answer`);
      return;
    }
    summary.setText(`Score: ${result.percent}% · ${result.answered}/${result.total} answered`);
  };
  const restart = () => {
    active = questions.slice();
    records = [];
    index = 0;
    paintSummary();
    renderQuestion();
  };
  const finish = () => {
    stage.empty();
    const result = quizPortResult(active, records);
    stage.createDiv({
      cls: result.percent >= 80 ? "qt-quiz-score is-pass" : result.percent >= 60 ? "qt-quiz-score is-imprecise" : "qt-quiz-score is-fail",
      text: `${result.correct}/${result.total} correct · ${result.percent}%`,
    });
    if (result.missed.length) {
      const missed = stage.createDiv({ cls: "qt-quizport-missed" });
      missed.createDiv({ cls: "qt-quizport-missed-title", text: `Missed ${result.missed.length} question${result.missed.length === 1 ? "" : "s"}` });
      for (const at of result.missed) missed.createDiv({ cls: "qt-quizport-missed-item", text: `${at + 1}. ${active[at].prompt}` });
      stage.createEl("button", { cls: "qt-quiz-submit", text: `Retry ${result.missed.length} missed` }).addEventListener("click", () => {
        active = result.missed.map((at) => active[at]);
        records = [];
        index = 0;
        paintSummary();
        renderQuestion();
      });
    }
    stage.createEl("button", { cls: "qt-quiz-submit", text: "Restart quiz" }).addEventListener("click", restart);
  };
  const renderQuestion = () => {
    stage.empty();
    if (index >= active.length) {
      finish();
      return;
    }
    const question = active[index];
    stage.createDiv({ cls: "qt-quiz-question", text: `${index + 1}. ${question.prompt}` });
    if (question.hint) {
      const hint = stage.createEl("button", { cls: "qt-quiz-submit qt-quizport-hint", text: "Show hint" });
      hint.addEventListener("click", () => {
        hint.disabled = true;
        hint.setText("Hint");
        stage.createDiv({ cls: "qt-hint", text: question.hint });
      });
    }
    const choices = stage.createDiv({ cls: "qt-quiz-choices" });
    const picked = new Set();
    let locked = false;
    let submit = null;
    const grade = (selection) => {
      if (locked) return;
      locked = true;
      const result = scoreQuizPortAnswer(question, selection);
      records[index] = result;
      buttons.forEach((button, at) => {
        button.toggleClass("is-correct", question.answers.includes(at));
        button.toggleClass("is-wrong", selection.includes(at) && !question.answers.includes(at));
        button.toggleClass("is-picked", selection.includes(at));
      });
      if (submit) submit.disabled = true;
      paintSummary();
      stage.createDiv({
        cls: result.correct ? "qt-quiz-result is-correct" : "qt-quiz-result is-wrong",
        text: result.correct ? "Correct" : "Not quite",
      });
      if (question.explanation) stage.createDiv({ cls: "qt-quiz-explanation", text: question.explanation });
      stage.createEl("button", { cls: "qt-quiz-submit", text: index === active.length - 1 ? "See results" : "Next question" }).addEventListener("click", () => {
        index++;
        renderQuestion();
      });
    };
    const buttons = question.choices.map((choice, at) => {
      const button = choices.createEl("button", { cls: "qt-quiz-choice", text: `${LETTERS[at]}. ${choice.text}` });
      button.addEventListener("click", () => {
        if (locked) return;
        if (!question.multi) {
          grade([at]);
          return;
        }
        if (picked.has(at)) picked.delete(at);
        else picked.add(at);
        button.toggleClass("is-picked", picked.has(at));
        if (submit) submit.disabled = picked.size === 0;
      });
      return button;
    });
    if (question.multi) {
      submit = stage.createEl("button", { cls: "qt-quiz-submit", text: "Submit answer" });
      submit.disabled = true;
      submit.addEventListener("click", () => {
        if (picked.size) grade([...picked]);
      });
    }
  };
  paintSummary();
  renderQuestion();
}

module.exports = { renderQuizPortBlock, resolveQuizPortFile };
