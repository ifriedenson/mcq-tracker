"use strict";
/*
 * One consistent view for the independent local study modules. Each tab is
 * shown only when its own Global → Modules switch is on; the modules share
 * visual language, not a single data model.
 */
const { ItemView, Notice } = require("obsidian");
const { VIEW_TYPE_STUDY_TOOLS } = require("./constants");
const { localDate, str } = require("./util");
const { cornellTemplate } = require("./cornell");
const {
  examGoalFromPlan,
  formatStudyMinutes,
  goalPercent,
  goalSummary,
  nextLecture,
  normalizeStudyToolsSettings,
  openGoals,
  parseLectureLines,
} = require("./study-tools");

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "goals", label: "Goals", module: "studyGoals" },
  { id: "lectures", label: "Lectures", module: "lectureLog" },
  { id: "cornell", label: "Cornell notes", module: "cornellNotes" },
];

class StudyToolsView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.tab = "overview";
    this.message = "";
    this.issues = [];
  }

  getViewType() {
    return VIEW_TYPE_STUDY_TOOLS;
  }

  getDisplayText() {
    return "Study Tools";
  }

  getIcon() {
    return "notebook-pen";
  }

  async onOpen() {
    this.contentEl.addClass("qt-root");
    this.contentEl.addClass("qt-study-tools");
    this.render();
  }

  settings() {
    return normalizeStudyToolsSettings(this.plugin.settings);
  }

  enabledTabs() {
    const data = this.settings();
    return TABS.filter((tab) => !tab.module || data[tab.module].enabled);
  }

  setTab(tab) {
    this.tab = TABS.some((entry) => entry.id === tab) ? tab : "overview";
    if (!this.enabledTabs().some((entry) => entry.id === this.tab)) this.tab = "overview";
    this.render();
  }

  saveMessage(text) {
    this.message = str(text);
  }

  async refresh() {
    this.render();
  }

  render() {
    const root = this.contentEl;
    root.empty();
    const wrap = root.createDiv({ cls: "qt-wrap qt-study-tools-wrap" });
    if (!this.plugin.studyToolsEnabled()) {
      this.renderOff(wrap);
      return;
    }
    const tabs = this.enabledTabs();
    if (!tabs.some((tab) => tab.id === this.tab)) this.tab = tabs[0] ? tabs[0].id : "overview";
    const header = wrap.createDiv({ cls: "qt-study-header" });
    const title = header.createDiv({ cls: "qt-study-heading" });
    title.createEl("h2", { text: "Study Tools" });
    title.createDiv({ cls: "qt-hint", text: "Local study workflows that do not belong in Practice, Cards, Calendar or Assignments." });
    const nav = wrap.createDiv({ cls: "qt-study-tabs" });
    for (const tab of tabs) {
      const button = nav.createEl("button", { cls: "qt-study-tab", text: tab.label });
      if (tab.id === this.tab) button.addClass("is-active");
      button.setAttr("aria-pressed", tab.id === this.tab ? "true" : "false");
      button.addEventListener("click", () => this.setTab(tab.id));
    }
    if (this.message) wrap.createDiv({ cls: "qt-study-message", text: this.message });
    if (this.tab === "overview") this.renderOverview(wrap);
    else if (this.tab === "goals") this.renderGoals(wrap);
    else if (this.tab === "lectures") this.renderLectures(wrap);
    else if (this.tab === "cornell") this.renderCornell(wrap);
  }

  renderOff(root) {
    const card = root.createDiv({ cls: "qt-onboard-card" });
    card.createEl("h3", { text: "Study Tools are off" });
    card.createDiv({
      cls: "qt-onboard-text",
      text: "Cornell notes, the lecture log and study goals each have their own switch under Settings, Global, Modules. Your notes and saved data are untouched while they are off.",
    });
    card.createEl("button", { text: "Open settings", cls: "mod-cta qt-primary" }).addEventListener("click", () => this.plugin.openSettings());
  }

  renderOverview(root) {
    const data = this.settings();
    const goals = data.studyGoals.goals;
    const lectures = data.lectureLog.lectures;
    const summary = goalSummary(goals);
    const next = nextLecture(lectures, localDate());
    const stats = root.createDiv({ cls: "qt-study-stats" });
    const stat = (value, label) => {
      const card = stats.createDiv({ cls: "qt-study-stat" });
      card.createDiv({ cls: "qt-study-stat-value", text: String(value) });
      card.createDiv({ cls: "qt-study-stat-label", text: label });
    };
    if (data.studyGoals.enabled) stat(summary.open, "open goals");
    if (data.lectureLog.enabled) stat(lectures.length, "lectures logged");
    if (data.cornellNotes.enabled) stat("Note", "Cornell blocks");
    if (!data.studyGoals.enabled && !data.lectureLog.enabled && !data.cornellNotes.enabled) {
      root.createDiv({ cls: "qt-study-empty", text: "Turn on at least one study tool in Settings." });
      return;
    }

    const grid = root.createDiv({ cls: "qt-study-grid" });
    if (data.studyGoals.enabled) {
      const card = grid.createDiv({ cls: "qt-study-card" });
      card.createEl("h3", { text: "Study goals" });
      if (summary.next) {
        const row = card.createDiv({ cls: "qt-study-next" });
        row.createDiv({ cls: "qt-study-next-title", text: summary.next.title });
        row.createDiv({
          cls: "qt-study-next-meta",
          text: `${summary.next.course ? `${summary.next.course} · ` : ""}${formatStudyMinutes(summary.next.minutes)} of ${formatStudyMinutes(summary.next.targetMinutes)}${summary.next.due ? ` · due ${summary.next.due}` : ""}`,
        });
        const bar = card.createDiv({ cls: "qt-study-bar" });
        bar.createDiv({ cls: "qt-study-bar-fill" }).style.width = `${goalPercent(summary.next)}%`;
      } else {
        card.createDiv({ cls: "qt-study-empty", text: "No open goals yet. Set one to keep a small, concrete target in view." });
      }
      card.createEl("button", { text: summary.next ? "Open goals" : "Set a goal", cls: "qt-link" }).addEventListener("click", () => this.setTab("goals"));
    }
    if (data.lectureLog.enabled) {
      const card = grid.createDiv({ cls: "qt-study-card" });
      card.createEl("h3", { text: "Next lecture" });
      if (next) {
        card.createDiv({ cls: "qt-study-next-title", text: next.title });
        card.createDiv({ cls: "qt-study-next-meta", text: `${next.course} · ${next.date}${next.topics ? ` · ${next.topics}` : ""}` });
      } else {
        card.createDiv({ cls: "qt-study-empty", text: "No upcoming lecture is logged. Add one after class or paste a whole timetable line." });
      }
      card.createEl("button", { text: "Open lecture log", cls: "qt-link" }).addEventListener("click", () => this.setTab("lectures"));
    }
    if (data.cornellNotes.enabled) {
      const card = grid.createDiv({ cls: "qt-study-card" });
      card.createEl("h3", { text: "Cornell notes" });
      card.createDiv({ cls: "qt-study-next-meta", text: "Create a cue-first note, then use Recall mode in the block to hide the notes until you answer each cue." });
      card.createEl("button", { text: "Create Cornell note", cls: "qt-link" }).addEventListener("click", () => this.setTab("cornell"));
    }
  }

  renderField(form, label, type, placeholder, value) {
    const field = form.createDiv({ cls: "qt-study-field" });
    field.createEl("label", { text: label });
    const input = field.createEl("input", { cls: "qt-input" });
    input.type = type || "text";
    if (placeholder) input.placeholder = placeholder;
    if (value) input.value = value;
    return input;
  }

  renderGoals(root) {
    const data = this.settings();
    const card = root.createDiv({ cls: "qt-study-card" });
    card.createEl("h3", { text: "Add a study goal" });
    const form = card.createDiv({ cls: "qt-study-form" });
    const title = this.renderField(form, "Goal", "text", "Finish the biology unit 3 practice set");
    const course = this.renderField(form, "Course", "text", "Biology");
    const target = this.renderField(form, "Target minutes", "number", "60", "60");
    const due = this.renderField(form, "Due date", "date", "", "");
    const actions = card.createDiv({ cls: "qt-row qt-study-actions" });
    actions.createEl("button", { text: "Add goal", cls: "mod-cta" }).addEventListener("click", async () => {
      const goal = await this.plugin.addStudyGoal({
        title: title.value,
        course: course.value,
        targetMinutes: target.value,
        due: due.value,
      });
      if (!goal) {
        this.saveMessage("Add a goal name first.");
        this.render();
        return;
      }
      this.saveMessage("Goal added.");
      this.render();
    });
    if (typeof this.plugin.studyPlan === "function" && this.plugin.studyPlan()) {
      actions.createEl("button", { text: "Use next exam" }).addEventListener("click", async () => {
        const goal = examGoalFromPlan(this.plugin.studyPlan(), localDate());
        if (!goal) return;
        await this.plugin.addStudyGoal(goal);
        this.saveMessage("Exam goal added.");
        this.render();
      });
    }

    const goals = data.studyGoals.goals;
    const summary = goalSummary(goals);
    const listCard = root.createDiv({ cls: "qt-study-card" });
    listCard.createEl("h3", { text: "Goals" });
    if (!goals.length) {
      listCard.createDiv({ cls: "qt-study-empty", text: "No goals yet. A goal can be one focused study block." });
      return;
    }
    listCard.createDiv({
      cls: "qt-study-next-meta",
      text: `${summary.open} open · ${summary.done} done · ${formatStudyMinutes(summary.minutes)} of ${formatStudyMinutes(summary.target)} logged`,
    });
    const list = listCard.createDiv({ cls: "qt-study-list" });
    for (const goal of goals.slice().sort((a, b) => Number(a.done) - Number(b.done) || (a.due || "9999").localeCompare(b.due || "9999"))) {
      const row = list.createDiv({ cls: "qt-study-row" });
      const main = row.createDiv({ cls: "qt-study-row-main" });
      main.createDiv({ cls: "qt-study-row-title", text: goal.title });
      main.createDiv({
        cls: "qt-study-row-meta",
        text: `${goal.course ? `${goal.course} · ` : ""}${formatStudyMinutes(goal.minutes)} / ${formatStudyMinutes(goal.targetMinutes)}${goal.due ? ` · due ${goal.due}` : ""}`,
      });
      const bar = main.createDiv({ cls: "qt-study-bar" });
      bar.createDiv({ cls: "qt-study-bar-fill" }).style.width = `${goalPercent(goal)}%`;
      const buttons = row.createDiv({ cls: "qt-study-row-actions" });
      if (!goal.done) {
        buttons.createEl("button", { text: "+15m" }).addEventListener("click", async () => {
          await this.plugin.addStudyGoalProgress(goal.id, 15);
          this.render();
        });
        buttons.createEl("button", { text: "+30m" }).addEventListener("click", async () => {
          await this.plugin.addStudyGoalProgress(goal.id, 30);
          this.render();
        });
        buttons.createEl("button", { text: "Done" }).addEventListener("click", async () => {
          await this.plugin.updateStudyGoal(goal.id, { done: true });
          this.render();
        });
      } else {
        buttons.createEl("button", { text: "Reopen" }).addEventListener("click", async () => {
          await this.plugin.updateStudyGoal(goal.id, { done: false, minutes: Math.min(goal.minutes, goal.targetMinutes - 1) });
          this.render();
        });
      }
      buttons.createEl("button", { text: "Delete", cls: "qt-danger" }).addEventListener("click", async () => {
        await this.plugin.removeStudyGoal(goal.id);
        this.render();
      });
    }
  }

  renderLectures(root) {
    const data = this.settings();
    const addCard = root.createDiv({ cls: "qt-study-card" });
    addCard.createEl("h3", { text: "Log a lecture" });
    const form = addCard.createDiv({ cls: "qt-study-form" });
    const course = this.renderField(form, "Course", "text", "Biology");
    const date = this.renderField(form, "Date", "date", "", localDate());
    const title = this.renderField(form, "Lecture", "text", "Cellular respiration");
    const topics = this.renderField(form, "Topics", "text", "glycolysis, Krebs cycle");
    const actions = addCard.createDiv({ cls: "qt-row qt-study-actions" });
    actions.createEl("button", { text: "Add lecture", cls: "mod-cta" }).addEventListener("click", async () => {
      const lecture = await this.plugin.addStudyLecture({
        course: course.value,
        date: date.value,
        title: title.value,
        topics: topics.value,
      });
      if (!lecture) {
        this.saveMessage("Add a course, a real date and a lecture title.");
        this.render();
        return;
      }
      this.saveMessage("Lecture added.");
      this.render();
    });

    const bulkCard = root.createDiv({ cls: "qt-study-card" });
    bulkCard.createEl("h3", { text: "Bulk add" });
    bulkCard.createDiv({ cls: "qt-hint", text: "One lecture per line: Course | YYYY-MM-DD | Lecture title | Optional topics" });
    const textarea = bulkCard.createEl("textarea", { cls: "qt-study-bulk" });
    textarea.placeholder = "Biology | 2026-11-02 | Cellular respiration | glycolysis, Krebs cycle";
    textarea.rows = 4;
    const bulkActions = bulkCard.createDiv({ cls: "qt-row qt-study-actions" });
    bulkActions.createEl("button", { text: "Add pasted lectures" }).addEventListener("click", async () => {
      const parsed = parseLectureLines(textarea.value);
      if (!parsed.lectures.length) {
        this.issues = parsed.issues;
        this.saveMessage("No lectures were added.");
        this.render();
        return;
      }
      const added = await this.plugin.addStudyLectures(parsed.lectures);
      this.issues = parsed.issues;
      this.saveMessage(`Added ${added} lecture${added === 1 ? "" : "s"}.`);
      this.render();
    });
    if (this.issues.length) {
      const issues = bulkCard.createDiv({ cls: "qt-study-issues" });
      for (const issue of this.issues.slice(0, 8)) issues.createDiv({ cls: "qt-study-issue", text: issue });
    }

    const listCard = root.createDiv({ cls: "qt-study-card" });
    listCard.createEl("h3", { text: "Lecture log" });
    const lectures = data.lectureLog.lectures.slice().sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
    if (!lectures.length) {
      listCard.createDiv({ cls: "qt-study-empty", text: "No lectures logged yet." });
      return;
    }
    const list = listCard.createDiv({ cls: "qt-study-list" });
    for (const lecture of lectures) {
      const row = list.createDiv({ cls: "qt-study-row" });
      const main = row.createDiv({ cls: "qt-study-row-main" });
      main.createDiv({ cls: "qt-study-row-title", text: lecture.title });
      main.createDiv({
        cls: "qt-study-row-meta",
        text: `${lecture.course} · ${lecture.date}${lecture.topics ? ` · ${lecture.topics}` : ""}`,
      });
      row.createEl("button", { text: "Delete", cls: "qt-danger" }).addEventListener("click", async () => {
        await this.plugin.removeStudyLecture(lecture.id);
        this.render();
      });
    }
  }

  renderCornell(root) {
    const card = root.createDiv({ cls: "qt-study-card" });
    card.createEl("h3", { text: "Create a Cornell note" });
    const form = card.createDiv({ cls: "qt-study-form" });
    const title = this.renderField(form, "Title", "text", "Cellular respiration");
    const course = this.renderField(form, "Course", "text", "Biology");
    const actions = card.createDiv({ cls: "qt-row qt-study-actions" });
    actions.createEl("button", { text: "Create note", cls: "mod-cta" }).addEventListener("click", async () => {
      if (!str(title.value).trim()) {
        this.saveMessage("Add a title first.");
        this.render();
        return;
      }
      try {
        const file = await this.plugin.createCornellNote({ title: title.value, course: course.value });
        this.saveMessage(`Created ${file.path}.`);
        this.render();
      } catch (e) {
        new Notice(`Could not create the Cornell note: ${str(e && e.message ? e.message : e)}`);
      }
    });

    const guide = root.createDiv({ cls: "qt-study-card" });
    guide.createEl("h3", { text: "Block format" });
    guide.createDiv({ cls: "qt-hint", text: "Write a fenced cornell-note block in any note. Use one Cue: and Note: pair for each idea, then a Summary:." });
    const pre = guide.createEl("pre", { cls: "qt-study-template" });
    pre.setText(cornellTemplate("Cellular respiration", "Biology"));
  }
}

module.exports = { StudyToolsView };
