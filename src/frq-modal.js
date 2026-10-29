"use strict";
const { Modal, Notice } = require("obsidian");
const { renderMarkdownInto } = require("./view-helpers");
const { FRQ_COURSES, courseById, compareFrqPasses, parseRubric, presetFor, presetsForCourse, rubricCategoryLabel, scoreAttempt } = require("./frq");
const { str } = require("./util");

function presetText(courseId, kind) {
  const preset = presetFor(courseId, kind);
  return preset.criteria.map((criterion) => `- [${criterion.points}] ${criterion.label}: ${criterion.description}`).join("\n");
}

function noteLabel(note) {
  return `${note.course} — ${note.title}`;
}

/*
 * One FRQ at a time. The modal only ever grades the note the learner picked,
 * and the AI button sends the answer only when it is pressed. Self-grading is
 * always available and needs no provider.
 */
class FrqGraderModal extends Modal {
  constructor(app, plugin, options) {
    super(app);
    this.plugin = plugin;
    this.options = options || {};
    this.notes = [];
    this.note = null;
    this.initialAnswer = str(this.options.answer);
    this.answer = this.initialAnswer;
    this.answerLoaded = false;
    this.scores = {};
    this.aiResult = null;
    this.aiScores = {};
    this.secondResult = null;
    this.comparison = null;
    this.result = null;
    this.attempts = [];
    this.message = "";
    this.loading = true;
    this.grading = false;
    this.secondGrading = false;
    this.saving = false;
    this.resultEl = null;
  }

  onOpen() {
    this.contentEl.empty();
    this.draw();
    this.load().catch((error) => {
      this.loading = false;
      this.message = str(error && error.message ? error.message : error);
      this.draw();
    });
  }

  async load() {
    this.loading = true;
    this.notes = await this.plugin.getFrqNotes();
    const wanted = this.options.path || (this.note && this.note.path);
    this.note = this.notes.find((note) => note.path === wanted) || this.notes[0] || null;
    this.loading = false;
    this.answer = this.answerLoaded ? "" : this.initialAnswer;
    this.answerLoaded = true;
    this.scores = {};
    this.aiResult = null;
    this.aiScores = {};
    this.secondResult = null;
    this.comparison = null;
    this.result = this.note ? this.computeResult() : null;
    this.draw();
    if (this.note) await this.loadAttempts();
  }

  async loadAttempts() {
    if (!this.note) return;
    try {
      this.attempts = await this.plugin.getFrqAttempts(this.note.path);
      this.draw();
    } catch (e) {
      /* history is a convenience, not a requirement */
    }
  }

  selectNote(path) {
    const next = this.notes.find((note) => note.path === path);
    if (!next) return;
    this.note = next;
    this.answer = "";
    this.scores = {};
    this.aiResult = null;
    this.aiScores = {};
    this.secondResult = null;
    this.comparison = null;
    this.attempts = [];
    this.message = "";
    this.result = this.computeResult();
    this.draw();
    this.loadAttempts();
  }

  computeResult() {
    if (!this.note) return null;
    const ai = this.aiResult;
    let gradedBy = ai ? "ai" : "self";
    if (ai && Object.keys(this.scores).some((id) => Number(this.scores[id]) !== Number(ai.scores[id]))) gradedBy = "ai-edited";
    const result = scoreAttempt({
      rubric: this.note.rubric,
      scores: this.scores,
      evidence: ai ? ai.evidence : {},
      comments: ai ? ai.comments : {},
      criterionConfidence: ai ? ai.confidence : null,
      confidence: ai ? ai.lowestConfidence : null,
      overall: ai ? ai.overall : "",
      gradedBy,
    });
    if (this.comparison) {
      result.comparison = this.comparison;
      result.needsReview = result.needsReview || !this.comparison.agrees;
    }
    result.secondPass = !!this.secondResult;
    return result;
  }

  updateResult() {
    this.result = this.computeResult();
    if (this.resultEl) this.renderResult(this.resultEl, this.result);
  }

  draw() {
    const root = this.contentEl;
    root.empty();
    root.createEl("h2", { text: "AP free-response practice" });
    root.createDiv({
      cls: "qt-hint",
      text: "Grade one of your own FRQs against your own rubric. Self-grading is local. AI grading sends only this prompt, rubric and answer, and only when you press the button.",
    });

    if (this.loading) {
      root.createDiv({ cls: "qt-hint", text: "Reading your FRQ notes…" });
      return;
    }

    const top = root.createDiv({ cls: "qt-row qt-frq-toolbar" });
    const select = top.createEl("select", { cls: "dropdown", attr: { "aria-label": "FRQ note" } });
    for (const note of this.notes) select.createEl("option", { text: noteLabel(note), value: note.path });
    if (this.note) select.value = this.note.path;
    select.addEventListener("change", () => this.selectNote(select.value));
    top.createEl("button", { text: "New FRQ note", cls: "qt-link" }).addEventListener("click", () => this.plugin.openNewFrqNote(() => this.load()));

    if (!this.notes.length) {
      const empty = root.createDiv({ cls: "qt-settings-card" });
      empty.createEl("h3", { text: "No FRQ notes yet" });
      empty.createDiv({
        cls: "qt-hint",
        text: "Create a note from your own prompt and rubric. The plugin does not bundle AP questions or rubrics. You can also add type: ap_frq and a ## Rubric section to an existing note.",
      });
      empty.createEl("button", { text: "New FRQ note", cls: "mod-cta qt-primary" }).addEventListener("click", () => this.plugin.openNewFrqNote(() => this.load()));
      return;
    }

    const note = this.note;
    if (!note) return;
    root.createEl("h3", { text: note.title });
    root.createDiv({ cls: "qt-hint", text: `${note.course} · ${note.maxPoints} rubric point${note.maxPoints === 1 ? "" : "s"} · graded from your note` });
    for (const warning of note.warnings || []) root.createDiv({ cls: "qt-hint qt-frq-warning", text: warning });

    const promptEl = root.createDiv({ cls: "qt-frq-prompt" });
    renderMarkdownInto(this.app, note.prompt || "_This note has no ## Question section._", promptEl, note.path, this);
    if (note.stimulus) {
      root.createEl("h4", { text: "Stimulus" });
      const stimulusEl = root.createDiv({ cls: "qt-frq-stimulus" });
      renderMarkdownInto(this.app, note.stimulus, stimulusEl, note.path, this);
    }

    root.createEl("h4", { text: "Your answer" });
    const area = root.createEl("textarea", {
      cls: "qt-frq-answer",
      attr: { placeholder: "Type your free-response answer. OS voice dictation works here on desktop and mobile.", rows: "10" },
    });
    area.value = this.answer;
    area.addEventListener("input", () => {
      this.answer = area.value;
      this.paintMathPreview();
    });
    const preview = root.createEl("details", { cls: "qt-frq-math-preview" });
    preview.open = /\$|\\ce\{/.test(this.answer);
    preview.createEl("summary", { text: "Math preview" });
    this.previewEl = preview.createDiv({ cls: "qt-frq-math-preview-body" });
    this.paintMathPreview();
    root.createDiv({
      cls: "qt-hint",
      text: "Math preview updates as you type: use $...$, $$...$$ or \\ce{...}. Photo-of-handwriting grading is not part of this release; type the answer or dictate it with your operating system.",
    });

    root.createEl("h4", { text: "Rubric" });
    root.createDiv({
      cls: "qt-hint",
      text: "Edit the rubric in the note itself. Each row is one criterion; the number in brackets is its maximum.",
    });
    const table = root.createDiv({ cls: "qt-frq-rubric" });
    for (const criterion of note.rubric) {
      const row = table.createDiv({ cls: "qt-frq-criterion" });
      const text = row.createDiv({ cls: "qt-frq-criterion-text" });
      text.createEl("strong", { text: criterion.label });
      if (criterion.category && criterion.category !== "other") {
        text.createSpan({ cls: "qt-frq-category", text: rubricCategoryLabel(criterion.category) });
      }
      text.createDiv({ cls: "qt-hint", text: criterion.description || "No description." });
      const score = row.createEl("input", {
        type: "number",
        cls: "qt-frq-score",
        attr: { min: "0", max: String(criterion.points), step: "0.5", "aria-label": `${criterion.label} points` },
      });
      const saved = this.scores[criterion.id];
      score.value = saved === undefined || saved === "" ? "0" : String(saved);
      score.addEventListener("input", () => {
        this.scores[criterion.id] = score.value;
        this.updateResult();
      });
      row.createSpan({ cls: "qt-frq-max", text: `/ ${criterion.points}` });
    }

    const actions = root.createDiv({ cls: "qt-row qt-frq-actions" });
    actions.createEl("button", { text: "Self-grade", cls: "qt-grow" }).addEventListener("click", () => {
      this.aiResult = null;
      this.aiScores = {};
      this.secondResult = null;
      this.comparison = null;
      this.message = "Self-grading. Change any score, then save the attempt.";
      this.result = this.computeResult();
      this.draw();
    });
    const ai = actions.createEl("button", {
      text: this.grading ? "Grading…" : "AI grade",
      cls: "qt-grow",
      attr: { title: "Sends this prompt, rubric and answer to your configured AI provider." },
    });
    ai.disabled = this.grading;
    ai.addEventListener("click", () => this.runAi());
    if (this.aiResult) {
      const second = actions.createEl("button", {
        text: this.secondGrading ? "Second pass…" : "Second pass",
        cls: "qt-grow",
        attr: { title: "Run an independent grading pass and flag every criterion the two passes score differently." },
      });
      second.disabled = this.secondGrading || this.grading;
      second.addEventListener("click", () => this.runSecondPass());
    }
    const save = actions.createEl("button", { text: this.saving ? "Saving…" : "Save attempt", cls: "mod-cta qt-grow" });
    save.disabled = this.saving || this.grading;
    save.addEventListener("click", () => this.save());

    const noteActions = root.createDiv({ cls: "qt-row qt-frq-note-actions" });
    noteActions.createEl("button", { text: "Open prompt note", cls: "qt-link" }).addEventListener("click", () => {
      const file = this.app.vault.getAbstractFileByPath(note.path);
      if (file) this.app.workspace.getLeaf("tab").openFile(file);
      else new Notice("That FRQ note is no longer in the vault.");
    });
    noteActions.createEl("button", { text: "Start over", cls: "qt-link" }).addEventListener("click", () => {
      this.answer = "";
      this.scores = {};
      this.aiResult = null;
      this.aiScores = {};
      this.secondResult = null;
      this.comparison = null;
      this.message = "";
      this.result = this.computeResult();
      this.draw();
    });

    if (this.message) root.createDiv({ cls: "qt-hint qt-frq-message", text: this.message });

    this.resultEl = root.createDiv({ cls: "qt-frq-result" });
    this.renderResult(this.resultEl, this.result);

    const history = root.createDiv({ cls: "qt-frq-history" });
    history.createEl("h4", { text: "Recent attempts" });
    history.createDiv({ cls: "qt-hint", text: "Each saved attempt is its own note under AP FRQ attempts, so the prompt note stays yours to edit." });
    if (!this.attempts.length) history.createDiv({ cls: "qt-hint", text: "No saved attempts for this prompt yet." });
    for (const entry of this.attempts.slice(0, 5)) {
      const row = history.createDiv({ cls: "qt-frq-attempt" });
      row.createSpan({ cls: "qt-frq-attempt-score", text: `${entry.earned}/${entry.max} (${entry.percent}%)` });
      row.createSpan({ cls: "qt-hint", text: `${entry.takenOn || "undated"} · ${entry.gradedBy || "self"}` });
      if (entry.missed && entry.missed.length) row.createSpan({ cls: "qt-hint", text: `Missed: ${entry.missed.join(", ")}` });
    }
  }

  paintMathPreview() {
    if (!this.previewEl) return;
    this.previewEl.empty();
    if (!str(this.answer).trim()) {
      this.previewEl.createDiv({ cls: "qt-hint", text: "Type $...$ or \\ce{...} to preview math here." });
      return;
    }
    renderMarkdownInto(this.app, this.answer, this.previewEl, this.note && this.note.path, this);
  }

  renderResult(el, result) {
    if (!el) return;
    el.empty();
    if (!result) return;
    const head = el.createDiv({ cls: "qt-frq-result-head" });
    head.createEl("strong", { text: `${result.earned} / ${result.max} (${result.percent}%)` });
    head.createSpan({ cls: "qt-hint", text: `Practice band: ${result.rating || "not scored"} · ${result.gradedBy}` });
    if (result.needsReview) {
      el.createDiv({
        cls: "qt-hint qt-frq-warning",
        text: "Review flagged: the AI draft has a low-confidence criterion or awarded a point without a quote. Check every line before saving.",
      });
    }
    const list = el.createDiv({ cls: "qt-frq-result-list" });
    for (const criterion of result.criteria) {
      const row = list.createDiv({ cls: "qt-frq-result-row" });
      const label = criterion.category && criterion.category !== "other"
        ? `${criterion.label} · ${rubricCategoryLabel(criterion.category)}`
        : criterion.label;
      row.createSpan({ cls: "qt-frq-result-label", text: label });
      row.createSpan({ cls: "qt-frq-result-points", text: `${criterion.awarded} / ${criterion.max}` });
      if (criterion.evidence) row.createDiv({ cls: "qt-hint", text: `“${criterion.evidence}”` });
      if (criterion.comment) row.createDiv({ cls: "qt-hint", text: criterion.comment });
    }
    if (result.comparison) {
      const box = el.createDiv({ cls: "qt-frq-comparison" });
      box.createEl("strong", {
        text: result.comparison.agrees
          ? "Two AI passes agree"
          : `Two AI passes disagree on ${result.comparison.disagreements.length} criteria`,
      });
      box.createDiv({
        cls: "qt-hint",
        text: `Pass 1 ${result.comparison.firstTotal}/${result.comparison.max} · pass 2 ${result.comparison.secondTotal}/${result.comparison.max}. Choose the score you trust before saving.`,
      });
      for (const item of result.comparison.disagreements) {
        box.createDiv({ cls: "qt-hint", text: `${item.label}: ${item.first === null ? "—" : item.first} / ${item.max} first, ${item.second === null ? "—" : item.second} / ${item.max} second.` });
      }
    }
    if (result.overall) el.createDiv({ cls: "qt-hint", text: result.overall });
    if (result.missed.length) el.createDiv({ cls: "qt-hint", text: `Missed: ${result.missedLabels.join(", ")}` });
  }

  async runAi() {
    if (!this.note || this.grading) return;
    if (!str(this.answer).trim()) {
      this.message = "Write an answer before asking for AI feedback.";
      this.draw();
      return;
    }
    this.grading = true;
    this.message = "";
    this.draw();
    try {
      const out = await this.plugin.gradeFrqWithAi(this.note, this.answer);
      this.aiResult = out;
      this.aiScores = { ...out.scores };
      this.scores = { ...out.scores };
      this.secondResult = null;
      this.comparison = null;
      this.result = this.computeResult();
      this.message = "AI draft ready. A human decides: check the quotes, change any score, then save the attempt.";
    } catch (error) {
      this.message = str(error && error.message ? error.message : error);
    }
    this.grading = false;
    this.draw();
  }

  /** A second independent pass; disagreement is shown, never averaged away. */
  async runSecondPass() {
    if (!this.note || !this.aiResult || this.secondGrading) return;
    if (!str(this.answer).trim()) {
      this.message = "Write an answer before asking for a second pass.";
      this.draw();
      return;
    }
    this.secondGrading = true;
    this.message = "";
    this.draw();
    try {
      const out = await this.plugin.gradeFrqWithAi(this.note, this.answer);
      this.secondResult = out;
      this.comparison = compareFrqPasses(this.aiResult, out, this.note.rubric);
      this.result = this.computeResult();
      this.message = this.comparison && this.comparison.agrees
        ? `Second pass agrees with the first (${this.comparison.secondTotal}/${this.comparison.max}).`
        : `Second pass disagrees on ${this.comparison ? this.comparison.disagreements.length : 0} criteria. Resolve the scores before saving.`;
    } catch (error) {
      this.message = str(error && error.message ? error.message : error);
    }
    this.secondGrading = false;
    this.draw();
  }

  async save() {
    if (!this.note || this.saving) return;
    if (!str(this.answer).trim()) {
      this.message = "Write an answer before saving an attempt.";
      this.draw();
      return;
    }
    this.result = this.computeResult();
    if (!this.result || !this.result.max) {
      this.message = "Add a rubric with at least one point before saving.";
      this.draw();
      return;
    }
    this.saving = true;
    this.message = "";
    this.draw();
    try {
      const saved = await this.plugin.saveFrqAttempt(this.note, {
        ...this.result,
        answer: this.answer,
        model: this.aiResult ? this.plugin.aiModelLabel("frqGrading") : "",
        secondPass: !!this.secondResult,
        disagreed: this.comparison ? this.comparison.disagreements.map((item) => item.label) : [],
      });
      this.message = `Saved ${saved.path}`;
      this.attempts = await this.plugin.getFrqAttempts(this.note.path);
    } catch (error) {
      this.message = str(error && error.message ? error.message : error);
    }
    this.saving = false;
    this.draw();
  }

  onClose() {
    this.contentEl.empty();
  }
}

/* -------------------------------------------------------------- new note */

class NewFrqNoteModal extends Modal {
  constructor(app, plugin, onDone) {
    super(app);
    this.plugin = plugin;
    this.onDone = typeof onDone === "function" ? onDone : null;
    this.courseId = FRQ_COURSES[0].id;
    this.kind = presetsForCourse(this.courseId)[0].id;
    this.rubricSource = "user";
    this.saving = false;
    this.error = "";
    this.errorEl = null;
  }

  setError(message) {
    this.error = str(message);
    if (this.errorEl) this.errorEl.setText(this.error);
  }

  onOpen() {
    this.draw();
  }

  draw() {
    const root = this.contentEl;
    root.empty();
    root.createEl("h2", { text: "New AP free-response note" });
    root.createDiv({
      cls: "qt-hint",
      text: "Paste a prompt you are allowed to use and your own rubric. Presets are editable starting points written for this plugin, not official College Board rubrics.",
    });

    const courseRow = root.createDiv({ cls: "qt-row" });
    courseRow.createEl("label", { text: "Course" });
    const course = courseRow.createEl("select", { cls: "dropdown" });
    for (const item of FRQ_COURSES) course.createEl("option", { text: item.name, value: item.id });
    course.value = this.courseId;

    const kindRow = root.createDiv({ cls: "qt-row" });
    kindRow.createEl("label", { text: "Question type" });
    const kind = kindRow.createEl("select", { cls: "dropdown" });
    const fillKinds = () => {
      kind.empty();
      for (const preset of presetsForCourse(this.courseId)) kind.createEl("option", { text: preset.label, value: preset.id });
      kind.value = this.kind;
    };
    fillKinds();

    root.createEl("label", { text: "Title" });
    const title = root.createEl("input", { type: "text", cls: "qt-modal-input", attr: { placeholder: "For example: Unit 4 DBQ practice" } });

    root.createEl("label", { text: "Prompt" });
    const prompt = root.createEl("textarea", { cls: "qt-frq-answer", attr: { rows: "6", placeholder: "Paste the free-response question." } });

    root.createEl("label", { text: "Stimulus or documents (optional)" });
    const stimulus = root.createEl("textarea", { cls: "qt-frq-answer", attr: { rows: "4", placeholder: "Paste any shared passage, data or document set." } });

    root.createEl("label", { text: "Rubric" });
    const rubric = root.createEl("textarea", { cls: "qt-frq-answer", attr: { rows: "8" } });
    rubric.value = presetText(this.courseId, this.kind);
    root.createDiv({ cls: "qt-hint", text: "One criterion per line: - [points] Name: what earns the point. A Markdown table with a points column also works." });

    const sourceRow = root.createDiv({ cls: "qt-row" });
    sourceRow.createEl("label", { text: "Rubric source" });
    const source = sourceRow.createEl("select", { cls: "dropdown" });
    source.createEl("option", { text: "My own rubric", value: "user" });
    source.createEl("option", { text: "Official or teacher-supplied rubric (pasted)", value: "official" });
    source.value = this.rubricSource;
    source.addEventListener("change", () => {
      this.rubricSource = source.value;
    });

    root.createEl("label", { text: "Sample answer (optional)" });
    const sample = root.createEl("textarea", { cls: "qt-frq-answer", attr: { rows: "4", placeholder: "Your own model answer, or leave blank." } });

    const refreshPreset = () => {
      rubric.value = presetText(this.courseId, this.kind);
    };
    course.addEventListener("change", () => {
      this.courseId = course.value;
      this.kind = presetsForCourse(this.courseId)[0].id;
      this.saving = false;
      fillKinds();
      refreshPreset();
    });
    kind.addEventListener("change", () => {
      this.kind = kind.value;
      refreshPreset();
    });

    this.errorEl = root.createDiv({ cls: "qt-hint qt-frq-warning", text: this.error });

    const actions = root.createDiv({ cls: "qt-row" });
    actions.createEl("button", { text: "Cancel", cls: "qt-grow" }).addEventListener("click", () => this.close());
    const create = actions.createEl("button", { text: this.saving ? "Creating…" : "Create note", cls: "mod-cta qt-grow" });
    create.disabled = this.saving;
    create.addEventListener("click", async () => {
      if (this.saving) return;
      const parsed = parseRubric(rubric.value);
      const criteria = parsed.criteria.length ? parsed.criteria : presetFor(this.courseId, this.kind).criteria;
      if (!str(title.value).trim()) {
        this.setError("Add a title.");
        return;
      }
      if (!str(prompt.value).trim()) {
        this.setError("Paste the prompt.");
        return;
      }
      this.saving = true;
      try {
        const created = await this.plugin.createFrqNote({
          courseId: this.courseId,
          kind: this.kind,
          title: title.value,
          prompt: prompt.value,
          stimulus: stimulus.value,
          rubric: criteria,
          rubricSource: this.rubricSource,
          sampleAnswer: sample.value,
        });
        new Notice(`Created ${created.path}`);
        this.close();
        if (this.onDone) this.onDone(created);
      } catch (error) {
        this.saving = false;
        create.disabled = false;
        create.setText("Create note");
        this.setError(str(error && error.message ? error.message : error));
      }
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

module.exports = {
  FrqGraderModal,
  NewFrqNoteModal,
};
