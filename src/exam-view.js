"use strict";
const { ItemView, Notice, setIcon } = require("obsidian");
const { fmtClock, fmtDate, str } = require("./util");
const { fmtPct, packTestSession, sliceQuestionRange, unpackTestSession } = require("./stats");
const { MODES } = require("./constants");
const { pickQuestion } = require("./filters");
const { loadQuestionData, renderMarkdownInto } = require("./view-helpers");
const { extractRationale } = require("./notes");
const { gradeAnswerDetailed } = require("./numeric-grading");
const { variantSummary, variantValuesText } = require("./parameterized");
const { NameModal } = require("./modals");
const { buildSections, normalizeSections } = require("./exam-sections");

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
    // NOTE: never call this `open`. Obsidian's View class has its own open() that the workspace calls
    // to load the tab; shadowing it leaves the tab blank (onOpen never runs).
    this.expanded = new Set();
    this.minTouched = false;
    this.sections = [];
    this.sectionIdx = 0;
    this.sectionsDraft = null;
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
    try {
      await this.restore();
    } catch (e) {
      console.error("MCQ Tracker: couldn't restore the saved timed test", e);
      this.items = [];
      this.phase = "setup";
      this.plugin.settings.testSession = null; // a broken saved test must not block the view
      try {
        await this.plugin.save();
      } catch (e2) {
        /* ignore */
      }
    }
    this.render();
  }

  async onClose() {
    if (this.phase === "test") await this.persist();
  }

  /** Saves the test in progress (or clears it) so closing Obsidian doesn't lose it. */
  async persist() {
    const st = this.plugin.settings;
    if (this.phase === "test") {
      this.leave();
      st.testSession = packTestSession(this.items, { idx: this.idx, startedAt: this.startedAt, deadline: this.deadline, allowedSeconds: this.allowedSeconds, sections: this.sections, sectionIdx: this.sectionIdx });
    } else st.testSession = null;
    await this.plugin.save();
  }

  /** Picks up a test that was in progress when Obsidian closed. If its time ran out meanwhile, it is marked now. */
  async restore() {
    const st = this.plugin.settings;
    if (!st.testSession || this.phase !== "setup") return;
    const plan = unpackTestSession(st.testSession, Date.now());
    if (!plan) {
      st.testSession = null;
      await this.plugin.save();
      return;
    }
    const byPath = new Map(this.plugin.getQuestions().map((q) => [q.file.path, q]));
    const items = [];
    for (const row of plan.items) {
      const q = byPath.get(row.path);
      if (!q) continue; // the note was deleted or moved
      const data = await loadQuestionData(this.plugin, q, { seed: row.seed });
      items.push({ ...data, sel: row.sel, seconds: row.seconds, flagged: row.flagged, conf: row.conf || 0 });
    }
    if (!items.length) {
      st.testSession = null;
      await this.plugin.save();
      return;
    }
    this.items = items;
    const fallbackMinutes = Math.max(1, Math.round(plan.allowedSeconds / 60));
    const specs = plan.sections.length ? plan.sections : [{ name: "Section 1", count: items.length, minutes: fallbackMinutes }];
    this.sections = buildSections(items, specs, plan.startedAt);
    plan.sections.forEach((saved, i) => {
      if (this.sections[i] && saved.endAt > 0) this.sections[i].endAt = saved.endAt;
    });
    if (!plan.sections.length && this.sections.length) this.sections[this.sections.length - 1].endAt = plan.deadline;
    this.sectionIdx = Math.min(plan.sectionIdx || 0, Math.max(0, this.sections.length - 1));
    this.idx = Math.min(plan.idx, items.length - 1);
    const restoredSection = this.sections[this.sectionIdx];
    if (restoredSection && (this.idx < restoredSection.start || this.idx >= restoredSection.end)) this.idx = restoredSection.start;
    this.startedAt = plan.startedAt;
    this.deadline = plan.deadline;
    this.allowedSeconds = plan.allowedSeconds;
    this.shownAt = Date.now();
    this.expanded = new Set();
    this.filter = "all";
    this.phase = "test";
    if (plan.expired) {
      new Notice("Your test's time ran out while Obsidian was closed. Here are your results.", 6000);
      await this.finish(true);
    } else new Notice("Picked your timed test back up.", 4000);
  }

  tick() {
    if (this.phase !== "test") return;
    if (Date.now() >= this.deadline) {
      this.finish(true);
      return;
    }
    const section = this.sections[this.sectionIdx];
    const endAt = section ? section.endAt : this.deadline;
    const left = Math.max(0, Math.round((endAt - Date.now()) / 1000));
    if (this.timerEl) {
      const label = this.sections.length > 1 ? `${fmtClock(left)} · ${this.sectionIdx + 1}/${this.sections.length}` : fmtClock(left);
      this.timerEl.setText(label);
      this.timerEl.toggleClass("is-over", left <= 300);
    }
    if (left <= 0) this.advanceSection(false);
  }

  /** Move to the next module at its boundary, or start it early from the Next button. */
  advanceSection(manual) {
    if (this.phase !== "test" || !this.sections.length) return;
    const now = Date.now();
    const current = this.sections[this.sectionIdx];
    if (manual && current && now < current.endAt) {
      const remaining = current.endAt - now;
      for (let i = this.sectionIdx + 1; i < this.sections.length; i++) this.sections[i].endAt += remaining;
      this.deadline += remaining;
      this.allowedSeconds = Math.max(1, Math.round((this.deadline - this.startedAt) / 1000));
    }
    let next = manual ? this.sectionIdx + 1 : this.sectionIdx;
    while (next < this.sections.length && now >= this.sections[next].endAt) next++;
    if (next >= this.sections.length) {
      this.finish(true);
      return;
    }
    if (next === this.sectionIdx) return;
    this.sectionIdx = next;
    this.idx = this.sections[next].start;
    this.shownAt = now;
    this.deadline = this.sections[this.sections.length - 1].endAt;
    this.allowedSeconds = Math.max(1, Math.round((this.deadline - this.startedAt) / 1000));
    this.persist();
    this.render();
  }

  render() {
    const el = this.contentEl;
    el.empty();
    this.timerEl = null;
    const root = el.createDiv({ cls: "qt-wrap" });
    if (this.plugin.mcqEnabled && !this.plugin.mcqEnabled()) {
      root.createDiv({ cls: "qt-hint", text: "The MCQ Tracker module is off. Turn it on in Settings, Global." });
      return;
    }
    try {
      if (this.phase === "test") this.renderTest(root);
      else if (this.phase === "review") this.renderReview(root);
      else if (this.phase === "setup") this.renderSetup(root);
      else root.createDiv({ cls: "qt-hint", text: this.phase === "saving" ? "Saving your results..." : "Getting your questions ready..." });
    } catch (e) {
      // Never leave a blank tab: show what went wrong and a way back to the start screen.
      console.error("MCQ Tracker: the timed test view failed to draw", e);
      root.empty();
      root.removeClass("qt-wide");
      root.createEl("h3", { text: "Timed test" });
      root.createDiv({ cls: "qt-hint", text: `Something went wrong drawing this screen: ${e && e.message ? e.message : e}` });
      const reset = root.createEl("button", { text: "Start over", cls: "mod-cta qt-primary" });
      reset.addEventListener("click", async () => {
        this.items = [];
        this.phase = "setup";
        this.plugin.settings.testSession = null;
        await this.plugin.save();
        this.render();
      });
    }
    el.toggleClass("qt-no-scroll", root.hasClass("qt-wide"));
    this.tick();
  }

  /* ---- setup */

  renderSetup(root) {
    const p = this.plugin;
    const st = p.settings;
    const d = st.testDefaults;
    root.createEl("h3", { text: "Timed test" });
    const all = p.filtered(p.getQuestions());
    const pool = sliceQuestionRange(all, d.from, d.to);
    root.createDiv({
      cls: "qt-count",
      text: `${pool.length} question${pool.length === 1 ? "" : "s"} in this range${pool.length !== all.length ? ` (of ${all.length})` : ""}. Change the filters in the practice view first if you want a different set.`,
    });
    root.createDiv({
      cls: "qt-hint",
      text: "Explanations stay hidden until you finish. You can move between questions and change answers. Questions you answer are logged like normal attempts; ones you leave blank are not.",
    });

    if (!Array.isArray(this.sectionsDraft) || !this.sectionsDraft.length) {
      this.sectionsDraft = [{ name: "Section 1", count: d.count, minutes: d.minutes }];
    }
    const draft = this.sectionsDraft;
    root.createDiv({ cls: "qt-label", text: "Sections" });
    root.createDiv({ cls: "qt-hint", text: "Each section has its own timer. Questions are picked once for the whole test, then split in this order." });
    const sectionRows = root.createDiv({ cls: "qt-sections" });
    const totalLine = root.createDiv({ cls: "qt-hint" });
    const refreshTotal = () => {
      const n = draft.reduce((sum, s) => sum + Math.max(1, parseInt(s.count, 10) || 1), 0);
      const mins = draft.reduce((sum, s) => sum + Math.max(1, parseInt(s.minutes, 10) || 1), 0);
      totalLine.setText(`Total: ${n} question${n === 1 ? "" : "s"} · ${mins} minute${mins === 1 ? "" : "s"}`);
    };
    const paintSections = () => {
      sectionRows.empty();
      draft.forEach((section, i) => {
        const row = sectionRows.createDiv({ cls: "qt-row qt-section-row" });
        const name = row.createEl("input", { type: "text", cls: "qt-fsearch", attr: { placeholder: `Section ${i + 1}` } });
        name.value = section.name || `Section ${i + 1}`;
        name.addEventListener("input", () => (section.name = name.value));
        const count = row.createEl("input", { type: "number", cls: "qt-spr", attr: { min: "1", max: "200" } });
        count.value = String(section.count || 1);
        count.addEventListener("input", () => {
          section.count = Math.max(1, parseInt(count.value, 10) || 1);
          refreshTotal();
        });
        const mins = row.createEl("input", { type: "number", cls: "qt-spr", attr: { min: "1", max: "300" } });
        mins.value = String(section.minutes || 1);
        mins.addEventListener("input", () => {
          section.minutes = Math.max(1, parseInt(mins.value, 10) || 1);
          refreshTotal();
        });
        const del = row.createEl("button", { text: "Remove" });
        del.disabled = draft.length === 1;
        del.addEventListener("click", () => {
          if (draft.length === 1) return;
          draft.splice(i, 1);
          this.render();
        });
      });
      refreshTotal();
    };
    paintSections();
    const addSection = root.createEl("button", { text: "Add section" });
    addSection.addEventListener("click", () => {
      draft.push({ name: `Section ${draft.length + 1}`, count: 10, minutes: 12 });
      this.render();
    });

    root.createDiv({ cls: "qt-label", text: "Question range (optional)" });
    const rangeRow = root.createDiv({ cls: "qt-row qt-range" });
    const fromIn = rangeRow.createEl("input", { type: "number", cls: "qt-spr", attr: { min: "1", placeholder: "From" } });
    fromIn.value = String(d.from || 1);
    const toIn = rangeRow.createEl("input", { type: "number", cls: "qt-spr", attr: { min: "1", placeholder: "To (last)" } });
    toIn.value = d.to ? String(d.to) : "";
    root.createDiv({ cls: "qt-hint", text: "Use a range for Bluebook-style section practice, for example 1 to 20. Leave To empty to use the last question." });
    root.createDiv({ cls: "qt-label", text: "Pick questions" });
    const sel = root.createEl("select", { cls: "qt-select" });
    for (const [v, t] of MODES) sel.createEl("option", { value: v, text: t });
    sel.value = st.mode;

    if (st.testBlueprints.length) {
      root.createDiv({ cls: "qt-label", text: "Saved blueprint" });
      const bpSel = root.createEl("select", { cls: "qt-select" });
      bpSel.createEl("option", { value: "", text: "Choose a blueprint" });
      st.testBlueprints.forEach((bp, i) => bpSel.createEl("option", { value: String(i), text: `${bp.name} (${bp.count} questions · ${bp.minutes} min)` }));
      bpSel.addEventListener("change", () => {
        const bp = st.testBlueprints[Number(bpSel.value)];
        if (!bp) return;
        this.sectionsDraft = bp.sections.map((section) => ({ ...section }));
        fromIn.value = String(bp.from);
        toIn.value = bp.to ? String(bp.to) : "";
        sel.value = bp.mode;
        this.render();
      });
    }
    const bpRow = root.createDiv({ cls: "qt-row" });
    const saveBp = bpRow.createEl("button", { text: "Save blueprint", cls: "qt-grow" });
    saveBp.addEventListener("click", () => {
      new NameModal(this.app, "Save test blueprint", "", async (name) => {
        const sections = draft.map((section, i) => ({
          name: str(section.name).trim() || `Section ${i + 1}`,
          count: Math.max(1, parseInt(section.count, 10) || 1),
          minutes: Math.max(1, parseInt(section.minutes, 10) || 1),
        }));
        const from = Math.max(1, parseInt(fromIn.value, 10) || 1);
        const to = Math.max(0, parseInt(toIn.value, 10) || 0);
        const recipe = {
          name,
          count: sections.reduce((sum, section) => sum + section.count, 0),
          minutes: sections.reduce((sum, section) => sum + section.minutes, 0),
          from,
          to,
          mode: sel.value,
          sections,
        };
        st.testBlueprints = st.testBlueprints.filter((bp) => bp.name.toLowerCase() !== name.toLowerCase());
        st.testBlueprints = [...st.testBlueprints, recipe].slice(-20);
        await p.save();
        this.render();
      }).open();
    });

    const go = root.createEl("button", { text: "Start the test", cls: "mod-cta qt-primary" });
    go.disabled = !pool.length;
    go.addEventListener("click", () => {
      const sections = draft.map((section, i) => ({
        name: str(section.name).trim() || `Section ${i + 1}`,
        count: Math.max(1, parseInt(section.count, 10) || 1),
        minutes: Math.max(1, parseInt(section.minutes, 10) || 1),
      }));
      const n = Math.min(200, sections.reduce((sum, section) => sum + section.count, 0));
      const minutes = Math.min(300, sections.reduce((sum, section) => sum + section.minutes, 0));
      const from = Math.max(1, parseInt(fromIn.value, 10) || 1);
      const to = Math.max(0, parseInt(toIn.value, 10) || 0);
      st.testDefaults = { count: n, minutes, from, to };
      p.save();
      this.begin(n, minutes, sel.value, { from, to }, sections);
    });
  }

  async begin(n, minutes, mode, range, sectionSpecs) {
    const p = this.plugin;
    this.phase = "loading";
    this.render();
    const all = p.filtered(p.getQuestions());
    const rest = sliceQuestionRange(all, range && range.from, range && range.to);
    const today = fmtDate(new Date());
    const specs = normalizeSections(sectionSpecs || (range && range.sections), n, minutes);
    const items = [];
    let noKey = 0;
    let variantErrors = 0;
    while (items.length < n && rest.length) {
      const pick = pickQuestion(rest, mode, today, []);
      if (!pick) break;
      rest.splice(rest.indexOf(pick), 1);
      const data = await loadQuestionData(p, pick);
      if (data.variant && data.variant.error) {
        variantErrors++;
        continue;
      }
      if (data.mode === "self") {
        noKey++; // no answer key: it can't be graded in a timed test
        continue;
      }
      items.push({ ...data, sel: "", seconds: 0, flagged: false, conf: 0 });
    }
    if (!items.length) {
      new Notice(
        variantErrors
          ? `${variantErrors} parameterized question${variantErrors === 1 ? " was" : "s were"} left out because its variant could not be built.`
          : "No questions with an answer key matched. Check your filters and the mode."
      );
      this.phase = "setup";
      this.sections = [];
      this.render();
      return;
    }
    if (noKey) new Notice(`${noKey} question${noKey === 1 ? " was" : "s were"} left out because ${noKey === 1 ? "it has" : "they have"} no answer key.`, 6000);
    if (variantErrors) new Notice(`${variantErrors} parameterized question${variantErrors === 1 ? " was" : "s were"} left out because its variant could not be built.`, 7000);
    this.items = items;
    this.startedAt = Date.now();
    this.sections = buildSections(items, specs, this.startedAt);
    this.sectionIdx = 0;
    this.idx = this.sections.length ? this.sections[0].start : 0;
    this.expanded = new Set();
    this.filter = "all";
    this.deadline = this.sections.length ? this.sections[this.sections.length - 1].endAt : this.startedAt + minutes * 60000;
    this.allowedSeconds = Math.max(1, Math.round((this.deadline - this.startedAt) / 1000));
    this.shownAt = Date.now();
    this.phase = "test";
    this.render();
    await this.persist();
  }

  /* ---- taking the test */

  leave() {
    const it = this.items[this.idx];
    if (it && this.shownAt) it.seconds += (Date.now() - this.shownAt) / 1000;
    this.shownAt = Date.now();
  }

  go(i) {
    const section = this.sections[this.sectionIdx];
    if (i < 0 || i >= this.items.length || i === this.idx) return;
    if (section && (i < section.start || i >= section.end)) return;
    this.leave();
    this.idx = i;
    this.persist();
    this.render();
  }

  paintNav() {
    this.navBtns.forEach(({ btn, i }) => {
      btn.toggleClass("is-current", i === this.idx);
      btn.toggleClass("is-answered", !!str(this.items[i].sel).trim());
      btn.toggleClass("is-flagged", !!this.items[i].flagged);
    });
  }

  renderTest(root) {
    const p = this.plugin;
    const it = this.items[this.idx];
    const path = it.file.path;
    root.addClass("qt-exam");
    root.addClass("qt-wide");

    const section = this.sections[this.sectionIdx];
    const bar = root.createDiv({ cls: "qt-bar qt-exam-bar" });
    const metaText = section && this.sections.length > 1
      ? `${section.name} · Question ${this.idx - section.start + 1} of ${section.count}`
      : `Question ${this.idx + 1} of ${this.items.length}`;
    bar.createDiv({ cls: "qt-meta", text: metaText });
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
      this.persist();
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
          this.persist();
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
      input.addEventListener("change", () => this.persist());
    }

    const confRow = right.createDiv({ cls: "qt-conf" });
    confRow.createDiv({ cls: "qt-label", text: "How sure are you?" });
    const confChips = confRow.createDiv({ cls: "qt-chips" });
    const confBtns = [];
    const confLabels = (p.settings.confidenceLabels || ["Guessing", "Unsure", "Confident"]).slice(0, 3);
    confLabels.forEach((label, index) => {
      const value = index + 1;
      const btn = confChips.createEl("button", { text: label, cls: "qt-chip" });
      if (Number(it.conf) === value) btn.addClass("is-selected");
      btn.addEventListener("click", () => {
        it.conf = Number(it.conf) === value ? 0 : value;
        confBtns.forEach(({ btn: b, value: v }) => b.toggleClass("is-selected", Number(it.conf) === v));
        this.persist();
      });
      confBtns.push({ btn, value });
    });

    const nav = right.createDiv({ cls: "qt-tnav" });
    const navStart = section ? section.start : 0;
    const navEnd = section ? section.end : this.items.length;
    this.navBtns = [];
    for (let i = navStart; i < navEnd; i++) {
      const b = nav.createEl("button", { text: String(i + 1), cls: "qt-tnav-btn" });
      b.addEventListener("click", () => this.go(i));
      this.navBtns.push({ btn: b, i });
    }
    this.paintNav();
    const row = right.createDiv({ cls: "qt-row" });
    const prev = row.createEl("button", { text: "Previous", cls: "qt-grow" });
    prev.disabled = this.idx === navStart;
    prev.addEventListener("click", () => this.go(this.idx - 1));
    const last = this.idx === navEnd - 1;
    const moreSections = this.sectionIdx < this.sections.length - 1;
    const nextLabel = last ? (moreSections ? "Next section" : "Finish test") : "Next";
    const next = row.createEl("button", { text: nextLabel, cls: `qt-grow ${last && !moreSections ? "mod-cta" : ""}` });
    next.addEventListener("click", () => {
      if (!last) return this.go(this.idx + 1);
      if (moreSections) return this.advanceSection(true);
      this.tryFinish();
    });
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
    const p = this.plugin;
    this.leave();
    this.phase = "saving";
    this.render();
    const now = new Date();
    const confLabels = (p.settings.confidenceLabels || ["Guessing", "Unsure", "Confident"]).slice(0, 3);
    const confidenceLevels = confLabels.map((label, index) => ({ value: index + 1, label, total: 0, correct: 0 }));
    let rated = 0;
    let correct = 0;
    let answered = 0;
    for (const it of this.items) {
      it.answered = !!str(it.sel).trim();
      it.answerCheck = it.answered ? gradeAnswerDetailed({ ...it.fm, answer: it.key, question_type: it.mode }, it.sel) : null;
      it.correct = it.answerCheck ? it.answerCheck.correct : null;
      it.conf = Math.max(0, Math.min(3, Number(it.conf) || 0));
      if (!it.answered) continue;
      answered++;
      if (it.correct) correct++;
      const level = confidenceLevels[it.conf - 1];
      if (level) {
        level.total++;
        if (it.correct) level.correct++;
        rated++;
      }
      try {
        await this.plugin.recordAttempt(it.file, {
          correct: !!it.correct,
          chosen: it.sel,
          conf: it.conf,
          seconds: Math.round(it.seconds),
          now,
          variant: it.variant && it.variant.ok ? variantValuesText(it.variant.values) : "",
          variantSeed: it.variant && it.variant.ok ? it.variant.seed : undefined,
        });
      } catch (e) {
        new Notice(`Couldn't save the result for ${it.file.basename}.`);
      }
    }
    const sections = this.sections.map((section) => {
      const slice = this.items.slice(section.start, section.end);
      return {
        name: section.name,
        total: slice.length,
        answered: slice.filter((it) => it.answered).length,
        correct: slice.filter((it) => it.answered && it.correct).length,
        seconds: Math.round(slice.reduce((sum, it) => sum + (Number(it.seconds) || 0), 0)),
      };
    });
    const usedSeconds = Math.min(this.allowedSeconds, Math.round((Date.now() - this.startedAt) / 1000));
    this.result = {
      correct,
      answered,
      total: this.items.length,
      usedSeconds,
      allowed: this.allowedSeconds,
      timeUp: !!timeUp,
      sections,
      avgSeconds: answered ? Math.round(usedSeconds / answered) : 0,
      confidence: { levels: confidenceLevels, rated, answered },
    };
    this.phase = "review";
    await this.persist(); // clears the saved test
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

    if (r.confidence && r.confidence.rated) {
      root.createDiv({ cls: "qt-label", text: "Confidence calibration" });
      const confChips = root.createDiv({ cls: "qt-chips" });
      for (const level of r.confidence.levels) {
        if (!level.total) continue;
        confChips.createSpan({
          cls: "qt-chip",
          text: `${level.label}: ${level.correct}/${level.total} correct`,
        });
      }
      root.createDiv({
        cls: "qt-hint",
        text: `Rated ${r.confidence.rated} of ${r.answered} answered · average ${fmtClock(r.avgSeconds)} per answered question`,
      });
    }

    if (r.sections && r.sections.length > 1) {
      root.createDiv({ cls: "qt-label", text: "By section" });
      const sectionChips = root.createDiv({ cls: "qt-chips" });
      for (const section of r.sections) {
        sectionChips.createSpan({
          cls: "qt-chip",
          text: `${section.name}: ${section.correct}/${section.total} · ${fmtClock(section.seconds)}`,
        });
      }
    }

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
        it.answered && it.conf ? `Confidence: ${p.settings.confidenceLabels[it.conf - 1] || it.conf}` : "",
        it.flagged ? "marked" : "",
      ].filter(Boolean);
      info.createDiv({ cls: "qt-hint", text: bits.join(" · ") });
      const tg = head.createEl("button", { text: this.expanded.has(i) ? "Hide" : "Review" });
      tg.addEventListener("click", () => {
        if (this.expanded.has(i)) this.expanded.delete(i);
        else this.expanded.add(i);
        this.render();
      });
      if (this.expanded.has(i)) this.renderDetail(box, it);
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
    if (it.mode === "spr") {
      d.createDiv({ cls: "qt-hint", text: `Your answer: ${it.sel || "(blank)"} · Correct answer: ${it.key}` });
      if (it.variant && it.variant.ok && Object.keys(it.variant.values || {}).length) {
        d.createDiv({ cls: "qt-hint qt-variant", text: `Variant: ${variantSummary(it.variant.values)}` });
      }
      if (it.answerCheck && it.answerCheck.interpreted) {
        d.createDiv({ cls: "qt-hint qt-numeric-check", text: it.answerCheck.interpreted });
        if (it.answerCheck.reason) d.createDiv({ cls: "qt-hint qt-numeric-check", text: it.answerCheck.reason });
      }
    }
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
