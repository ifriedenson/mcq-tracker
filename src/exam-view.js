"use strict";
const { ItemView, Notice, setIcon } = require("obsidian");
const { fmtClock, fmtDate, str } = require("./util");
const { fmtPct, suggestMinutes } = require("./stats");
const { MODES } = require("./constants");
const { pickQuestion } = require("./filters");
const { loadQuestionData, renderMarkdownInto } = require("./view-helpers");
const { extractRationale, gradeAnswer } = require("./notes");

/* ------------------------------------------------------- timed test */

const VIEW_TYPE_TEST = "question-tracker-test";

class TestView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.phase = "setup"; // setup | loading | test | saving | review
    this.items = [];
    this.idx = 0;
    this.deadline = 0;
    this.shownAt = 0;
    this.timerEl = null;
    this.navBtns = [];
    this.result = null;
    this.filter = "all";
    this.open = new Set();
    this.minTouched = false;
  }
  getViewType() {
    return VIEW_TYPE_TEST;
  }
  getDisplayText() {
    return "Timed test";
  }
  getIcon() {
    return "timer";
  }
  async onOpen() {
    this.contentEl.addClass("qt-root");
    this.registerInterval(activeWindow.setInterval(() => this.tick(), 500));
    this.render();
  }

  tick() {
    if (this.phase !== "test") return;
    const left = Math.max(0, Math.round((this.deadline - Date.now()) / 1000));
    if (this.timerEl) {
      this.timerEl.setText(fmtClock(left));
      this.timerEl.toggleClass("is-over", left <= 300);
    }
    if (left <= 0) this.finish(true);
  }

  render() {
    const el = this.contentEl;
    el.empty();
    this.timerEl = null;
    const root = el.createDiv({ cls: "qt-wrap" });
    if (this.phase === "test") this.renderTest(root);
    else if (this.phase === "review") this.renderReview(root);
    else if (this.phase === "setup") this.renderSetup(root);
    else root.createDiv({ cls: "qt-hint", text: this.phase === "saving" ? "Saving your results..." : "Getting your questions ready..." });
    el.toggleClass("qt-no-scroll", root.hasClass("qt-wide"));
    this.tick();
  }

  /* ---- setup */

  renderSetup(root) {
    const p = this.plugin;
    const st = p.settings;
    const d = st.testDefaults;
    root.createEl("h3", { text: "Timed test" });
    const pool = p.filtered(p.getQuestions());
    root.createDiv({
      cls: "qt-count",
      text: `${pool.length} question${pool.length === 1 ? "" : "s"} match your current filters. Change them in the practice view first if you want a different set.`,
    });
    root.createDiv({
      cls: "qt-hint",
      text: "Explanations stay hidden until you finish. You can move between questions and change answers. Questions you answer are logged like normal attempts; ones you leave blank are not.",
    });

    root.createDiv({ cls: "qt-label", text: "Number of questions" });
    const nIn = root.createEl("input", { type: "number", cls: "qt-spr", attr: { min: "1", max: "200" } });
    nIn.value = String(d.count);
    root.createDiv({ cls: "qt-label", text: "Minutes" });
    const mIn = root.createEl("input", { type: "number", cls: "qt-spr", attr: { min: "1", max: "300" } });
    mIn.value = String(d.minutes);
    mIn.addEventListener("input", () => (this.minTouched = true));
    nIn.addEventListener("change", () => {
      if (!this.minTouched) mIn.value = String(suggestMinutes(Math.max(1, parseInt(nIn.value, 10) || 1)));
    });
    root.createDiv({ cls: "qt-label", text: "Pick questions" });
    const sel = root.createEl("select", { cls: "qt-select" });
    for (const [v, t] of MODES) sel.createEl("option", { value: v, text: t });
    sel.value = st.mode;

    const go = root.createEl("button", { text: "Start the test", cls: "mod-cta qt-primary" });
    go.disabled = !pool.length;
    go.addEventListener("click", () => {
      const n = Math.min(200, Math.max(1, parseInt(nIn.value, 10) || 1));
      const minutes = Math.min(300, Math.max(1, parseInt(mIn.value, 10) || 1));
      st.testDefaults = { count: n, minutes };
      p.save();
      this.begin(n, minutes, sel.value);
    });
  }

  async begin(n, minutes, mode) {
    const p = this.plugin;
    this.phase = "loading";
    this.render();
    const rest = p.filtered(p.getQuestions());
    const today = fmtDate(new Date());
    const items = [];
    let noKey = 0;
    while (items.length < n && rest.length) {
      const pick = pickQuestion(rest, mode, today, []);
      if (!pick) break;
      rest.splice(rest.indexOf(pick), 1);
      const data = await loadQuestionData(p, pick);
      if (data.mode === "self") {
        noKey++; // no answer key: it can't be graded in a timed test
        continue;
      }
      items.push({ ...data, sel: "", seconds: 0, flagged: false });
    }
    if (!items.length) {
      new Notice("No questions with an answer key matched. Check your filters and the mode.");
      this.phase = "setup";
      this.render();
      return;
    }
    if (noKey) new Notice(`${noKey} question${noKey === 1 ? " was" : "s were"} left out because ${noKey === 1 ? "it has" : "they have"} no answer key.`, 6000);
    this.items = items;
    this.idx = 0;
    this.open = new Set();
    this.filter = "all";
    this.allowedSeconds = minutes * 60;
    this.startedAt = Date.now();
    this.deadline = this.startedAt + this.allowedSeconds * 1000;
    this.shownAt = Date.now();
    this.phase = "test";
    this.render();
  }

  /* ---- taking the test */

  leave() {
    const it = this.items[this.idx];
    if (it && this.shownAt) it.seconds += (Date.now() - this.shownAt) / 1000;
    this.shownAt = Date.now();
  }

  go(i) {
    if (i < 0 || i >= this.items.length || i === this.idx) return;
    this.leave();
    this.idx = i;
    this.render();
  }

  paintNav() {
    this.navBtns.forEach((b, i) => {
      b.toggleClass("is-current", i === this.idx);
      b.toggleClass("is-answered", !!str(this.items[i].sel).trim());
      b.toggleClass("is-flagged", !!this.items[i].flagged);
    });
  }

  renderTest(root) {
    const p = this.plugin;
    const it = this.items[this.idx];
    const path = it.file.path;
    root.addClass("qt-exam");
    root.addClass("qt-wide");

    const bar = root.createDiv({ cls: "qt-bar qt-exam-bar" });
    bar.createDiv({ cls: "qt-meta", text: `Question ${this.idx + 1} of ${this.items.length}` });
    this.timerEl = bar.createDiv({ cls: "qt-timer-wrap" }).createSpan({ cls: "qt-timer" });
    const fin = bar.createDiv({ cls: "qt-exam-tools" }).createEl("button", { text: "Finish test" });
    fin.addEventListener("click", () => this.tryFinish());

    const hasStim = !!it.sections.stimulus;
    const split = root.createDiv({ cls: `qt-split${hasStim ? "" : " is-single"}` });
    const left = hasStim ? split.createDiv({ cls: "qt-pane qt-pane-left" }) : null;
    const right = split.createDiv({ cls: "qt-pane qt-pane-right" });
    if (left) renderMarkdownInto(this.app, it.sections.stimulus, left.createDiv({ cls: "qt-stimulus" }), path, this);

    const qh = right.createDiv({ cls: "qt-qhead" });
    qh.createSpan({ cls: "qt-qnum", text: String(this.idx + 1) });
    const fb = qh.createEl("button", { cls: "qt-flag" });
    const paintFlag = () => {
      fb.empty();
      setIcon(fb.createSpan({ cls: "qt-flag-ic" }), it.flagged ? "bookmark-check" : "bookmark");
      fb.createSpan({ text: it.flagged ? "Marked for review" : "Mark for review" });
      fb.toggleClass("is-on", !!it.flagged);
    };
    paintFlag();
    fb.addEventListener("click", () => {
      it.flagged = !it.flagged;
      paintFlag();
      this.paintNav();
    });

    renderMarkdownInto(this.app, it.sections.question || "*No `## Question` section found in this note.*", right.createDiv({ cls: "qt-stem" }), path, this);

    const ans = right.createDiv({ cls: "qt-answers" });
    if (it.mode === "mcq") {
      const n = Number(it.fm.choices) || it.sections.choices.length || 4;
      const byLetter = Object.fromEntries(it.sections.choices.map((c) => [c.letter, c.text]));
      const btns = [];
      for (const L of "ABCDEFGH".slice(0, n).split("")) {
        const b = ans.createEl("button", { cls: "qt-choice" });
        b.createSpan({ cls: "qt-letter", text: L });
        if (byLetter[L]) renderMarkdownInto(this.app, byLetter[L], b.createDiv({ cls: "qt-choice-text" }), path, this);
        if (it.sel === L) b.addClass("is-selected");
        b.addEventListener("click", () => {
          it.sel = it.sel === L ? "" : L; // tap again to clear
          btns.forEach((x, i) => x.toggleClass("is-selected", "ABCDEFGH"[i] === it.sel));
          this.paintNav();
        });
        btns.push(b);
      }
    } else {
      const input = ans.createEl("input", { type: "text", cls: "qt-spr", attr: { placeholder: "Your answer" } });
      input.value = it.sel;
      input.addEventListener("input", () => {
        it.sel = input.value.trim();
        this.paintNav();
      });
    }

    const nav = right.createDiv({ cls: "qt-tnav" });
    this.navBtns = this.items.map((_x, i) => {
      const b = nav.createEl("button", { text: String(i + 1), cls: "qt-tnav-btn" });
      b.addEventListener("click", () => this.go(i));
      return b;
    });
    this.paintNav();
    const row = right.createDiv({ cls: "qt-row" });
    const prev = row.createEl("button", { text: "Previous", cls: "qt-grow" });
    prev.disabled = this.idx === 0;
    prev.addEventListener("click", () => this.go(this.idx - 1));
    const last = this.idx === this.items.length - 1;
    const next = row.createEl("button", { text: last ? "Finish test" : "Next", cls: `qt-grow ${last ? "mod-cta" : ""}` });
    next.addEventListener("click", () => (last ? this.tryFinish() : this.go(this.idx + 1)));
  }

  async tryFinish() {
    const blank = this.items.filter((it) => !str(it.sel).trim()).length;
    if (blank) {
      const ok = await this.plugin.askConfirm(
        "Finish the test?",
        `${blank} question${blank === 1 ? " has" : "s have"} no answer. Blank questions count as wrong in your score and are not logged as attempts.`,
        "Finish"
      );
      if (!ok) return;
    }
    await this.finish(false);
  }

  async finish(timeUp) {
    if (this.phase !== "test") return;
    this.leave();
    this.phase = "saving";
    this.render();
    const now = new Date();
    let correct = 0;
    let answered = 0;
    for (const it of this.items) {
      it.answered = !!str(it.sel).trim();
      it.correct = it.answered ? gradeAnswer({ answer: it.key, question_type: it.mode }, it.sel) : null;
      if (!it.answered) continue;
      answered++;
      if (it.correct) correct++;
      try {
        await this.plugin.recordAttempt(it.file, { correct: !!it.correct, chosen: it.sel, conf: 0, seconds: Math.round(it.seconds), now });
      } catch (e) {
        new Notice(`Couldn't save the result for ${it.file.basename}.`);
      }
    }
    this.result = {
      correct,
      answered,
      total: this.items.length,
      usedSeconds: Math.min(this.allowedSeconds, Math.round((Date.now() - this.startedAt) / 1000)),
      allowed: this.allowedSeconds,
      timeUp: !!timeUp,
    };
    this.phase = "review";
    this.render();
  }

  /* ---- review */

  renderReview(root) {
    const p = this.plugin;
    const r = this.result;
    root.createEl("h3", { text: r.timeUp ? "Time's up" : "Test finished" });
    const pct = r.total ? r.correct / r.total : 0;
    const card = root.createDiv({ cls: `qt-banner ${pct >= 0.7 ? "is-correct" : "is-wrong"}` });
    card.createDiv({ cls: "qt-banner-title", text: `${r.correct} of ${r.total} correct (${fmtPct(pct)})` });
    card.createDiv({
      cls: "qt-banner-sub",
      text: `Answered ${r.answered} · ${fmtClock(r.usedSeconds)} used of ${fmtClock(r.allowed)}`,
    });

    // by skill
    const bySkill = new Map();
    for (const it of this.items) {
      const k = str(it.fm.skill).trim();
      if (!k) continue;
      const e = bySkill.get(k) || { right: 0, n: 0 };
      e.n++;
      if (it.correct) e.right++;
      bySkill.set(k, e);
    }
    if (bySkill.size > 1) {
      root.createDiv({ cls: "qt-label", text: "By skill" });
      const chips = root.createDiv({ cls: "qt-chips" });
      for (const [k, e] of [...bySkill.entries()].sort((a, b) => a[1].right / a[1].n - b[1].right / b[1].n)) {
        chips.createSpan({ cls: "qt-chip", text: `${k}: ${e.right}/${e.n}` });
      }
    }

    const acts = root.createDiv({ cls: "qt-row" });
    const again = acts.createEl("button", { text: "New test", cls: "qt-grow" });
    again.addEventListener("click", () => {
      this.phase = "setup";
      this.render();
    });
    const back = acts.createEl("button", { text: "Back to practice", cls: "qt-grow" });
    back.addEventListener("click", () => p.activateView());

    const fl = root.createDiv({ cls: "qt-chips" });
    const filters = [["all", "All"], ["missed", "Missed"], ["flagged", "Marked"], ["blank", "Blank"]];
    for (const [id, label] of filters) {
      const c = fl.createEl("button", { text: label, cls: "qt-chip" });
      if (this.filter === id) c.addClass("is-selected");
      c.addEventListener("click", () => {
        this.filter = id;
        this.render();
      });
    }
    const keep = (it) =>
      this.filter === "all" ||
      (this.filter === "missed" && it.answered && !it.correct) ||
      (this.filter === "flagged" && it.flagged) ||
      (this.filter === "blank" && !it.answered);
    this.items.forEach((it, i) => {
      if (!keep(it)) return;
      const box = root.createDiv({ cls: "qt-ins-group" });
      const head = box.createDiv({ cls: "qt-trow" });
      const mark = !it.answered ? "-" : it.correct ? "✓" : "✗";
      head.createSpan({ cls: `qt-tmark ${!it.answered ? "is-blank" : it.correct ? "is-right" : "is-wrong"}`, text: mark });
      const info = head.createDiv({ cls: "qt-ins-main" });
      info.createDiv({ cls: "qt-ins-name", text: `${i + 1}. ${it.fm.skill || it.file.basename}` });
      const bits = [
        it.answered ? `You: ${it.sel}` : "No answer",
        it.key ? `Answer: ${it.key}` : "",
        fmtClock(Math.round(it.seconds)),
        it.flagged ? "marked" : "",
      ].filter(Boolean);
      info.createDiv({ cls: "qt-hint", text: bits.join(" · ") });
      const tg = head.createEl("button", { text: this.open.has(i) ? "Hide" : "Review" });
      tg.addEventListener("click", () => {
        if (this.open.has(i)) this.open.delete(i);
        else this.open.add(i);
        this.render();
      });
      if (this.open.has(i)) this.renderDetail(box, it);
    });
  }

  renderDetail(box, it) {
    const p = this.plugin;
    const path = it.file.path;
    const d = box.createDiv({ cls: "qt-detail" });
    if (it.sections.stimulus) renderMarkdownInto(this.app, it.sections.stimulus, d.createDiv({ cls: "qt-stimulus" }), path, this);
    renderMarkdownInto(this.app, it.sections.question || "", d.createDiv({ cls: "qt-stem" }), path, this);
    const rc = d.createDiv({ cls: "qt-answers" });
    const mine = str(it.sel).toUpperCase();
    const keyL = str(it.key).toUpperCase();
    for (const c of it.sections.choices) {
      const isKey = it.mode === "mcq" && c.letter === keyL;
      const isMine = it.mode === "mcq" && c.letter === mine;
      const row = rc.createDiv({ cls: "qt-choice qt-choice-static" });
      if (isKey) row.addClass("is-key");
      if (isMine && !isKey) row.addClass("is-miss");
      if (isMine) row.addClass("is-mine");
      row.createSpan({ cls: "qt-letter", text: c.letter });
      renderMarkdownInto(this.app, c.text, row.createDiv({ cls: "qt-choice-text" }), path, this);
    }
    if (it.mode === "spr") d.createDiv({ cls: "qt-hint", text: `Your answer: ${it.sel || "(blank)"} · Correct answer: ${it.key}` });
    const rat = extractRationale(it.sections.answer);
    d.createDiv({ cls: "qt-label", text: "Explanation" });
    if (rat) renderMarkdownInto(this.app, rat, d.createDiv({ cls: "qt-explanation is-open" }), path, this);
    else d.createDiv({ cls: "qt-hint", text: "This note has no explanation." });

    if (it.answered && !it.correct) {
      d.createDiv({ cls: "qt-label", text: "Why did you miss it?" });
      const chips = d.createDiv({ cls: "qt-chips" });
      const cb = [];
      for (const t of p.settings.errorTypes) {
        const c = chips.createEl("button", { text: t, cls: "qt-chip" });
        if (it.errorType === t) c.addClass("is-selected");
        c.addEventListener("click", async () => {
          it.errorType = it.errorType === t ? "" : t;
          cb.forEach((x) => x.toggleClass("is-selected", x === c && !!it.errorType));
          await p.setErrorType(it.file, it.errorType);
        });
        cb.push(c);
      }
    }
    const row = d.createDiv({ cls: "qt-row" });
    row.createEl("button", { text: "Open note", cls: "qt-grow" }).addEventListener("click", () => this.app.workspace.getLeaf("tab").openFile(it.file));
  }
}

module.exports = {
  VIEW_TYPE_TEST,
  TestView,
};
