"use strict";
const { ItemView, Notice, TFile, setIcon } = require("obsidian");
const { FILTER_FIELDS, MODES, VIEW_TYPE } = require("./constants");
const { loadQuestionData, renderMarkdownInto } = require("./view-helpers");
const { fmtClock, fmtDate, str } = require("./util");
const { MODE_PRED, filterOptionCounts, folderLabel, fvals, hasFilters, isDue, pickQuestion } = require("./filters");
const { extractRationale, gradeAnswer } = require("./notes");
const { FolderFilterSuggest, NameModal } = require("./modals");
const { ChatPanel } = require("./chat-panel");
const { buildGeneralContext, buildTutorContext } = require("./opencode-client");

class PracticeView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.state = "idle"; // idle | question | result
    this.current = null; // { file, fm, sections }
    this.result = null;
    this.sel = "";
    this.conf = 0;
    this.tally = { n: 0, correct: 0 };
    this.recent = [];
    this.notesText = "";
    this.notesDirty = false;
    this.filtersOpen = !plugin.settings.activePreset;
    this.generalHistory = [];
    this.timerEl = null;
  }

  getViewType() {
    return VIEW_TYPE;
  }
  getDisplayText() {
    return "Practice";
  }
  getIcon() {
    return "graduation-cap";
  }

  async onOpen() {
    this.contentEl.addClass("qt-root");
    this.registerInterval(activeWindow.setInterval(() => this.tick(), 500));
    await this.restoreSession();
    this.render();
  }

  async onClose() {
    await this.flushNotes();
  }

  /* ---- helpers */

  md(markdown, el, sourcePath) {
    renderMarkdownInto(this.app, markdown, el, sourcePath, this);
  }

  tick() {
    if (!this.timerEl || this.state !== "question") return;
    const s = Math.floor(this.plugin.elapsedMs() / 1000);
    this.timerEl.setText(fmtClock(s));
    const target = Number(this.current && this.current.fm.target_seconds) || 0;
    this.timerEl.toggleClass("is-over", !!target && s > target);
  }

  async restoreSession() {
    const s = this.plugin.session;
    if (!s) return;
    const file = this.app.vault.getAbstractFileByPath(s.path);
    const fm = file instanceof TFile ? this.app.metadataCache.getFileCache(file)?.frontmatter : null;
    if (!fm || !fm.question_id) {
      this.plugin.clearSession();
      return;
    }
    await this.loadQuestion({ file, fm }, false);
  }

  async loadQuestion(q, fresh) {
    this.current = await loadQuestionData(this.plugin, q);
    this.sel = "";
    this.conf = 0;
    this.state = "question";
    if (fresh) {
      this.plugin.startSession(q.file.path);
      this.recent.push(q.file.path);
      if (this.recent.length > 5) this.recent.shift();
    }
  }

  async flushNotes() {
    if (this.notesDirty && this.result) {
      this.notesDirty = false;
      await this.plugin.saveMyNotes(this.result.file, this.notesText);
    }
  }

  async next() {
    await this.flushNotes();
    const st = this.plugin.settings;
    const pool = this.plugin.filtered(this.plugin.getQuestions());
    const pick = pickQuestion(pool, st.mode, fmtDate(new Date()), this.recent);
    if (!pick) {
      new Notice("No questions match these filters.");
      this.plugin.clearSession();
      this.state = "idle";
      this.render();
      return;
    }
    await this.loadQuestion(pick, true);
    this.render();
  }

  async submit() {
    const q = this.current;
    const fm = q.fm;
    let correct;
    let chosen = this.sel;
    if (q.mode === "self") {
      correct = this.sel === "correct";
      chosen = "";
    } else {
      correct = gradeAnswer({ answer: q.key, question_type: q.mode }, this.sel);
    }
    const seconds = Math.round(this.plugin.elapsedMs() / 1000);
    const summary = await this.plugin.recordAttempt(q.file, {
      correct,
      chosen,
      conf: this.conf,
      seconds,
      now: new Date(),
    });
    this.plugin.clearSession();
    this.tally.n++;
    if (correct) this.tally.correct++;
    this.notesText = q.sections.notes;
    this.notesDirty = false;
    this.result = {
      file: q.file,
      correct,
      chosen,
      key: q.key,
      mode: q.mode,
      seconds,
      summary,
      errorType: "",
      flagged: fm.flagged === true,
      sections: q.sections,
      fm: q.fm,
      conf: this.conf,
      aiSession: "",
      aiHistory: [],
    };
    this.state = "result";
    this.render();
  }

  /* ---- rendering */

  render() {
    const el = this.contentEl;
    el.empty();
    this.timerEl = null;
    const root = el.createDiv({ cls: "qt-wrap" });
    if (this.state === "question") this.renderQuestion(root);
    else if (this.state === "result") this.renderResult(root);
    else if (this.state === "chat") this.renderChat(root);
    else this.renderIdle(root);
    // two-pane screens scroll inside their panes, not the whole view
    el.toggleClass("qt-no-scroll", root.hasClass("qt-wide"));
    this.tick();
  }

  renderIdle(root) {
    const p = this.plugin;
    const st = p.settings;
    const questions = p.getQuestions();

    if (!questions.length) {
      root.createDiv({
        cls: "qt-empty",
        text:
          "No question notes found. A note counts as a question when it has a question_id property" +
          (st.questionFolder ? ` and lives in "${st.questionFolder}".` : "."),
      });
      return;
    }

    // presets
    const prow = root.createDiv({ cls: "qt-row" });
    const psel = prow.createEl("select", { cls: "qt-select qt-grow" });
    psel.createEl("option", { value: "", text: "- Custom -" });
    for (const pr of st.presets) psel.createEl("option", { value: pr.id, text: pr.name });
    psel.value = st.activePreset || "";
    psel.addEventListener("change", () => {
      p.applyPreset(psel.value);
      this.render();
    });

    const brow = root.createDiv({ cls: "qt-row qt-small-row" });
    const saveAs = brow.createEl("button", { text: "Save as preset" });
    saveAs.addEventListener("click", () =>
      new NameModal(this.app, "Preset name", "", (name) => {
        p.savePreset(name);
        this.render();
      }).open()
    );
    const upd = brow.createEl("button", { text: "Update" });
    upd.disabled = !st.activePreset;
    upd.addEventListener("click", () => {
      p.updatePreset();
      this.render();
    });
    const del = brow.createEl("button", { text: "Delete" });
    del.disabled = !st.activePreset;
    del.addEventListener("click", () => {
      p.deletePreset();
      this.render();
    });
    if (st.activePreset && p.isModified()) root.createDiv({ cls: "qt-hint", text: "Preset has unsaved changes." });

    // filters: tap several values in a field (OR); add another set to OR whole sets together
    st.moreSets = st.moreSets || [];
    const sets = [st.filters, ...st.moreSets];
    const nActive = sets.filter(hasFilters).length;
    const det = root.createEl("details", { cls: "qt-filters" });
    det.open = this.filtersOpen;
    det.addEventListener("toggle", () => (this.filtersOpen = det.open));
    det.createEl("summary", {
      text: `Filters${nActive ? ` (${nActive} ${nActive === 1 ? "set" : "sets, any of them"} active)` : ""}`,
    });
    det.createDiv({
      cls: "qt-hint",
      text: "Tap several values to allow any of them. Different fields must all match. Add another set to combine separate groups.",
    });
    sets.forEach((set, idx) => {
      if (idx > 0) det.createDiv({ cls: "qt-or", text: "OR" });
      const box = det.createDiv({ cls: "qt-fset" });
      if (sets.length > 1) {
        const head = box.createDiv({ cls: "qt-fset-head" });
        head.createSpan({ text: `Set ${idx + 1}` });
        const rm = head.createEl("button", { text: "Remove set", cls: "qt-link" });
        rm.addEventListener("click", () => {
          if (idx === 0) {
            st.filters = st.moreSets.length ? st.moreSets.shift() : {};
          } else {
            st.moreSets.splice(idx - 1, 1);
          }
          p.save();
          this.render();
        });
      }
      for (const [key, label] of FILTER_FIELDS) {
        const chosen = fvals(set, key);
        const counts = filterOptionCounts(questions, set, key);
        const countOf = new Map(counts.map((c) => [c.value, c.count]));
        const opts = counts.map((c) => c.value);
        for (const c of chosen) if (!opts.includes(c)) opts.push(c);
        if (!opts.length) continue;
        const asSearch = key === "folder" && p.folderSearchOn(opts.length);
        const shown = (o) => (key === "folder" ? folderLabel(o, st.questionFolder) : o);
        const toggle = (o) => {
          const cur = fvals(set, key);
          const i = cur.indexOf(o);
          if (i >= 0) cur.splice(i, 1);
          else cur.push(o);
          if (cur.length) set[key] = cur;
          else delete set[key];
          p.save();
          this.render();
        };
        const row = box.createDiv({ cls: "qt-field" });
        const lh = row.createDiv({ cls: "qt-field-head" });
        lh.createEl("label", { text: chosen.length ? `${label} (${chosen.length})` : label });
        if (key === "folder") {
          const sw = lh.createEl("button", { text: asSearch ? "Show buttons" : "Search", cls: "qt-link" });
          sw.addEventListener("click", () => {
            st.folderFilterStyle = asSearch ? "buttons" : "search";
            p.save();
            this.render();
          });
        }
        if (chosen.length) {
          const clr = lh.createEl("button", { text: "Clear", cls: "qt-link" });
          clr.addEventListener("click", () => {
            delete set[key];
            p.save();
            this.render();
          });
        }
        if (asSearch) {
          const box2 = row.createEl("input", { type: "text", cls: "qt-fsearch", attr: { placeholder: "Search folders..." } });
          new FolderFilterSuggest(this.app, box2, () => counts.filter((c) => !chosen.includes(c.value)), (v) => toggle(v), st.questionFolder);
        }
        const chips = row.createDiv({ cls: "qt-fchips" });
        for (const o of asSearch ? chosen : opts) {
          const n = countOf.get(o) || 0;
          const c = chips.createEl("button", { cls: "qt-fchip" });
          c.createSpan({ text: shown(o) });
          c.createSpan({ cls: "qt-fcount", text: String(n) });
          if (asSearch) c.createSpan({ cls: "qt-fx", text: "×" });
          if (key === "folder") c.setAttr("title", o);
          if (chosen.includes(o)) c.addClass("is-selected");
          if (!n && chosen.includes(o)) {
            c.addClass("is-empty");
            c.setAttr("title", "No notes match this any more (was the folder renamed or emptied?)");
          }
          c.addEventListener("click", () => toggle(o));
        }
      }
    });
    const addSet = det.createEl("button", { text: "+ Add another set (OR)", cls: "qt-add-set" });
    addSet.addEventListener("click", () => {
      st.moreSets.push({});
      p.save();
      this.render();
    });

    // mode
    const mrow = root.createDiv({ cls: "qt-field" });
    mrow.createEl("label", { text: "Pick questions" });
    const msel = mrow.createEl("select", { cls: "qt-select" });
    for (const [v, t] of MODES) msel.createEl("option", { value: v, text: t });
    msel.value = st.mode;
    msel.addEventListener("change", () => {
      st.mode = msel.value;
      p.save();
      this.render();
    });

    // counts
    const pool = p.filtered(questions);
    const today = fmtDate(new Date());
    const inMode = pool.filter((q) => (MODE_PRED[st.mode] || MODE_PRED.smart)(q.fm, today)).length;
    const dueN = pool.filter((q) => isDue(q.fm, today)).length;
    const newN = pool.filter((q) => !Number(q.fm.attempts)).length;
    root.createDiv({
      cls: "qt-count",
      text: `${pool.length} match · ${dueN} due · ${newN} new · ${inMode} in this mode`,
    });

    const start = root.createEl("button", { text: "Start", cls: "mod-cta qt-primary" });
    start.disabled = inMode === 0;
    start.addEventListener("click", () => this.next());

    const tools = root.createDiv({ cls: "qt-row qt-small-row" });
    tools.createEl("button", { text: "Timed test" }).addEventListener("click", () => p.activateTest());
    tools.createEl("button", { text: "Weak spots & errors" }).addEventListener("click", () => p.activateInsights("weak"));

    if (st.ai.enabled) {
      const ib = root.createEl("button", { text: "Import questions from PDF" });
      ib.addEventListener("click", () => p.openPdfImport());
      const ab = root.createEl("button", { text: "AI assistant" });
      ab.addEventListener("click", () => {
        this.state = "chat";
        this.render();
      });
    }

    if (this.tally.n) {
      root.createDiv({ cls: "qt-hint", text: `This session: ${this.tally.correct}/${this.tally.n} correct` });
    }
  }

  renderQuestion(root) {
    const p = this.plugin;
    const q = this.current;
    const fm = q.fm;
    const paused = !p.isRunning();
    const path = q.file.path;
    root.addClass("qt-exam");
    root.addClass("qt-wide");

    // ---- header: where you are, timer, pause
    const bar = root.createDiv({ cls: "qt-bar qt-exam-bar" });
    const meta = [fm.course, fm.unit ? `Unit ${fm.unit}` : "", fm.skill || fm.section, fm.difficulty]
      .filter(Boolean)
      .join(" · ");
    bar.createDiv({ cls: "qt-meta", text: meta });
    const tw = bar.createDiv({ cls: "qt-timer-wrap" });
    this.timerEl = tw.createSpan({ cls: "qt-timer" });
    const pb = tw.createEl("button", { cls: "qt-icon-btn", attr: { "aria-label": paused ? "Resume" : "Pause" } });
    setIcon(pb, paused ? "play" : "pause");
    pb.addEventListener("click", () => {
      if (paused) p.resumeSession();
      else p.pauseSession();
      this.render();
    });
    const tools = bar.createDiv({ cls: "qt-exam-tools" });
    const open = tools.createEl("button", { cls: "qt-icon-btn", attr: { "aria-label": "Open note" } });
    setIcon(open, "file-text");
    open.addEventListener("click", () => this.app.workspace.getLeaf("tab").openFile(q.file));

    // ---- two panes: passage on the left, question + choices on the right
    const hasStim = !!q.sections.stimulus;
    const split = root.createDiv({ cls: `qt-split${hasStim ? "" : " is-single"}` });
    const left = hasStim ? split.createDiv({ cls: "qt-pane qt-pane-left" }) : null;
    const right = split.createDiv({ cls: "qt-pane qt-pane-right" });

    // ---- controls live at the bottom of the right pane: confidence, submit, skip/end
    const ctl = right.createDiv({ cls: "qt-ctl" });
    const fc = ctl.createDiv({ cls: "qt-foot-center" });
    const fr = ctl.createDiv({ cls: "qt-foot-right" });
    const fl = ctl.createDiv({ cls: "qt-foot-left" });
    const skip = fl.createEl("button", { text: "Skip (don't log)" });
    skip.addEventListener("click", () => this.next());
    const end = fl.createEl("button", { text: "End" });
    end.addEventListener("click", () => {
      this.plugin.clearSession();
      this.state = "idle";
      this.render();
    });

    if (paused) {
      right.createDiv({ cls: "qt-paused", text: "Timer paused. Tap play to continue." });
      right.appendChild(ctl);
      fc.remove();
      fr.remove();
      return;
    }

    if (left) this.md(q.sections.stimulus, left.createDiv({ cls: "qt-stimulus" }), path);

    // question header: number badge + flag (like "Mark for Review")
    const qh = right.createDiv({ cls: "qt-qhead" });
    qh.createSpan({ cls: "qt-qnum", text: String(this.tally.n + 1) });
    const flagged0 = fm.flagged === true;
    const fb = qh.createEl("button", { cls: "qt-flag" });
    const paintFlag = (on) => {
      fb.empty();
      const ic = fb.createSpan({ cls: "qt-flag-ic" });
      setIcon(ic, on ? "bookmark-check" : "bookmark");
      fb.createSpan({ text: on ? "Flagged" : "Flag for review" });
      fb.toggleClass("is-on", !!on);
    };
    paintFlag(flagged0);
    fb.addEventListener("click", async () => {
      const now = await this.plugin.toggleFlag(q.file);
      q.fm.flagged = now;
      paintFlag(now);
    });

    this.md(q.sections.question || "*No `## Question` section found in this note.*", right.createDiv({ cls: "qt-stem" }), path);

    const mode = q.mode;
    const submit = fr.createEl("button", { text: "Submit", cls: "mod-cta qt-submit" });
    const refresh = () => {
      submit.disabled = !(this.sel && this.conf);
    };

    // answer input
    const ans = right.createDiv({ cls: "qt-answers" });
    if (mode === "mcq") {
      const n = Number(fm.choices) || q.sections.choices.length || 4;
      const letters = "ABCDEFGH".slice(0, n).split("");
      const byLetter = Object.fromEntries(q.sections.choices.map((c) => [c.letter, c.text]));
      const btns = [];
      for (const L of letters) {
        const b = ans.createEl("button", { cls: "qt-choice" });
        b.createSpan({ cls: "qt-letter", text: L });
        if (byLetter[L]) this.md(byLetter[L], b.createDiv({ cls: "qt-choice-text" }), path);
        b.addEventListener("click", () => {
          this.sel = L;
          btns.forEach((x) => x.toggleClass("is-selected", x === b));
          refresh();
        });
        if (this.sel === L) b.addClass("is-selected");
        btns.push(b);
      }
    } else if (mode === "spr") {
      const input = ans.createEl("input", { type: "text", cls: "qt-spr", attr: { placeholder: "Your answer" } });
      input.value = this.sel;
      input.addEventListener("input", () => {
        this.sel = input.value.trim();
        refresh();
      });
    } else {
      // No usable key: still show the choices (read-only) and let you self-grade.
      if (q.sections.choices.length) {
        const list = ans.createDiv({ cls: "qt-readonly-choices" });
        for (const c of q.sections.choices) {
          const line = list.createDiv({ cls: "qt-choice qt-choice-static" });
          line.createSpan({ cls: "qt-letter", text: c.letter });
          this.md(c.text, line.createDiv({ cls: "qt-choice-text" }), path);
        }
      }
      ans.createDiv({ cls: "qt-hint", text: "No answer key found in this note. Grade yourself after you've worked it out." });
      const row = ans.createDiv({ cls: "qt-row" });
      const btns = [];
      for (const [v, t] of [["correct", "I got it right"], ["incorrect", "I got it wrong"]]) {
        const b = row.createEl("button", { text: t, cls: "qt-choice qt-grow" });
        b.addEventListener("click", () => {
          this.sel = v;
          btns.forEach((x) => x.toggleClass("is-selected", x === b));
          refresh();
        });
        btns.push(b);
      }
    }

    right.appendChild(ctl); // keep the controls below the choices
    // confidence
    fc.createSpan({ cls: "qt-foot-label", text: "How sure are you?" });
    const crow = fc.createDiv({ cls: "qt-conf-row" });
    const cbtns = [];
    p.settings.confidenceLabels.slice(0, 3).forEach((label, i) => {
      const b = crow.createEl("button", { text: label, cls: "qt-conf" });
      if (this.conf === i + 1) b.addClass("is-selected");
      b.addEventListener("click", () => {
        this.conf = i + 1;
        cbtns.forEach((x) => x.toggleClass("is-selected", x === b));
        refresh();
      });
      cbtns.push(b);
    });

    refresh();
    submit.addEventListener("click", () => {
      submit.disabled = true;
      this.submit();
    });
  }

  renderChat(root) {
    const p = this.plugin;
    const top = root.createDiv({ cls: "qt-row qt-small-row" });
    const back = top.createEl("button", { text: "Back" });
    back.addEventListener("click", () => {
      this.state = "idle";
      this.render();
    });
    root.createEl("h4", { text: "AI assistant" });
    if (p.backend() === "api") {
      root.createDiv({
        cls: "qt-hint",
        text: "Direct API chat can't see or edit your files. For creating notes or searching your vault, use OpenCode on your computer.",
      });
    }
    new ChatPanel(this, root.createDiv(), {
      title: "MCQ Tracker assistant",
      sourcePath: "",
      getSessionId: () => p.settings.ai.sessionId,
      setSessionId: (id) => {
        p.settings.ai.sessionId = id;
        p.save();
      },
      getApiHistory: () => this.generalHistory,
      buildContext: (mode) => buildGeneralContext(this.app, mode),
      quick: p.backend() === "api" ? [] : [
        { label: "Notes missing answers", prompt: "List the question notes whose answer property is empty or missing." },
        { label: "Weakest skills", prompt: "Look at my question notes' attempts and correct_count and tell me which skills I am weakest at." },
        { label: "Create a question note", prompt: "I will paste a question with its choices, answer and rationale. Create a correctly formatted question note for it in the vault." },
      ],
    });
  }

  renderResult(root) {
    const p = this.plugin;
    const r = this.result;
    const s = r.summary;
    const path = r.file.path;

    if (r.sections.stimulus) {
      root.addClass("qt-wide");
      root.addClass("qt-exam");
      const split = root.createDiv({ cls: "qt-split" });
      const lp = split.createDiv({ cls: "qt-pane qt-pane-left" });
      this.md(r.sections.stimulus, lp.createDiv({ cls: "qt-stimulus" }), path);
      root = split.createDiv({ cls: "qt-pane qt-pane-right" });
    }

    const banner = root.createDiv({ cls: `qt-banner qt-resbar ${r.correct ? "is-correct" : "is-wrong"}` });
    const bl = banner.createDiv({ cls: "qt-res-left" });
    bl.createDiv({ cls: "qt-banner-title", text: r.correct ? "Correct" : "Incorrect" });
    const bits = [];
    if (!r.correct && r.chosen) bits.push(`You chose ${r.chosen}${r.key ? `, answer ${r.key}` : ""}`);
    bits.push(fmtClock(r.seconds) + (s.target ? ` (target ${fmtClock(s.target)})` : ""));
    bl.createDiv({ cls: "qt-banner-sub", text: bits.join(" · ") });

    const acts = banner.createDiv({ cls: "qt-res-actions" });
    const openBtn = acts.createEl("button", { text: "Open note" });
    openBtn.addEventListener("click", () => this.app.workspace.getLeaf("tab").openFile(r.file));
    const flagBtn = acts.createEl("button", { cls: "qt-icon-btn qt-res-flag" });
    const paintFlag = () => {
      flagBtn.empty();
      setIcon(flagBtn, r.flagged ? "bookmark-check" : "bookmark");
      flagBtn.setAttr("aria-label", r.flagged ? "Unflag this question" : "Flag this question");
      flagBtn.setAttr("title", r.flagged ? "Unflag this question" : "Flag this question");
      flagBtn.toggleClass("is-on", !!r.flagged);
    };
    paintFlag();
    flagBtn.addEventListener("click", async () => {
      r.flagged = await p.toggleFlag(r.file);
      paintFlag();
    });
    const topNext = acts.createEl("button", { text: "Next question", cls: "mod-cta" });
    topNext.addEventListener("click", () => this.next());

    root.createDiv({
      cls: "qt-count",
      text: `Streak ${s.streak} · ${s.correctCount}/${s.attempts} correct overall · next review ${s.nextReview}`,
    });

    // ---- review: the question and choices again, with your pick and the key marked
    const rv = root.createDiv({ cls: "qt-review" });
    this.md(r.sections.question || "", rv.createDiv({ cls: "qt-stem" }), path);
    const rc = rv.createDiv({ cls: "qt-answers" });
    const chosenL = str(r.chosen).toUpperCase();
    const keyL = str(r.key).toUpperCase();
    if (r.sections.choices.length) {
      for (const c of r.sections.choices) {
        const isKey = r.mode === "mcq" && c.letter === keyL;
        const isMine = r.mode === "mcq" && c.letter === chosenL;
        const row = rc.createDiv({ cls: "qt-choice qt-choice-static" });
        if (isKey) row.addClass("is-key");
        if (isMine && !isKey) row.addClass("is-miss");
        if (isMine) row.addClass("is-mine");
        row.createSpan({ cls: "qt-letter", text: c.letter });
        this.md(c.text, row.createDiv({ cls: "qt-choice-text" }), path);
        const tag = isKey && isMine ? "Your answer · correct" : isKey ? "Correct answer" : isMine ? "Your answer" : "";
        if (tag) row.createSpan({ cls: "qt-tag", text: tag });
      }
    }
    if (r.mode === "spr") {
      rv.createDiv({ cls: "qt-hint", text: `Your answer: ${r.chosen || "(blank)"} · Correct answer: ${r.key || "(not stored)"}` });
    } else if (r.mode === "self" && r.key) {
      rv.createDiv({ cls: "qt-hint", text: `Correct answer: ${r.key}` });
    }

    // ---- why did you miss it (misses only)
    if (!r.correct) {
      root.createDiv({ cls: "qt-label", text: "Why did you miss it?" });
      const chips = root.createDiv({ cls: "qt-chips" });
      const cb = [];
      for (const t of p.settings.errorTypes) {
        const c = chips.createEl("button", { text: t, cls: "qt-chip" });
        if (r.errorType === t) c.addClass("is-selected");
        c.addEventListener("click", async () => {
          const next = r.errorType === t ? "" : t;
          r.errorType = next;
          cb.forEach((x) => x.toggleClass("is-selected", x === c && !!next));
          await p.setErrorType(r.file, next);
        });
        cb.push(c);
      }
    }

    // ---- notes: a big box right under the choices
    root.createDiv({ cls: "qt-label", text: "Notes" });
    const ta = root.createEl("textarea", {
      cls: "qt-notes qt-notes-big",
      attr: { rows: "9", placeholder: "Why you missed it, the rule to remember, anything to review later..." },
    });
    ta.value = this.notesText;
    ta.addEventListener("input", () => {
      this.notesText = ta.value;
      this.notesDirty = true;
    });
    ta.addEventListener("blur", () => this.flushNotes());

    // ---- two buttons on one line: explanation / ask AI
    const pair = root.createDiv({ cls: "qt-row qt-pair" });
    const rat = extractRationale(r.sections.answer);
    const dflt = p.settings.explanationDefault;
    let expOpen = !!rat && (dflt === "show" || (dflt === "wrong" && !r.correct));
    let aiOpen = false;
    const eb = pair.createEl("button", { cls: "qt-grow qt-exp-btn" });
    const ab = pair.createEl("button", { cls: "qt-grow qt-exp-btn" });

    const ex = root.createDiv({ cls: "qt-explanation" });
    if (rat) this.md(rat, ex.createDiv({ cls: "qt-stem" }), path);
    else ex.createDiv({ cls: "qt-hint", text: "This note has no explanation." });

    const aiWrap = root.createDiv({ cls: "qt-ai" });
    new ChatPanel(this, aiWrap.createDiv(), {
      title: `Review: ${r.file.basename}`,
      sourcePath: path,
      getSessionId: () => r.aiSession,
      setSessionId: (id) => (r.aiSession = id),
      getApiHistory: () => r.aiHistory,
      buildContext: (mode) => buildTutorContext(r, this.notesText, p.settings.confidenceLabels, mode),
      quick: [
        r.correct
          ? { label: "Why is the answer right?", prompt: "Explain why the correct answer is right and why the other choices are wrong." }
          : { label: "Why did I miss this?", prompt: "I got this wrong. Explain what I likely misunderstood and how to get it right next time." },
        { label: "Explain simply", prompt: "Explain this question and its solution in simple terms." },
        { label: "Similar question", prompt: "Write one new, original practice question testing the same skill, with four choices. Do not give the answer yet." },
        { label: "Quiz me", prompt: "Ask me one short question to check I understand the concept behind this question." },
        { label: "One-line rule", prompt: "Give me a single sentence rule of thumb I can remember for this kind of question." },
      ],
      onSaveNote: (text) => {
        this.notesText = (this.notesText ? this.notesText + "\n\n" : "") + text;
        ta.value = this.notesText;
        this.notesDirty = true;
        this.flushNotes();
        new Notice("Added to Notes");
      },
    });

    const paint = () => {
      ex.toggleClass("qt-hidden", !expOpen);
      aiWrap.toggleClass("qt-hidden", !aiOpen);
      eb.setText(expOpen ? "Hide explanation" : "Show explanation");
      ab.setText(aiOpen ? "Hide AI" : "Ask AI");
      eb.toggleClass("is-selected", expOpen);
      ab.toggleClass("is-selected", aiOpen);
    };
    eb.addEventListener("click", () => {
      expOpen = !expOpen;
      paint();
    });
    ab.addEventListener("click", () => {
      aiOpen = !aiOpen;
      paint();
    });
    paint();

    // ---- done (Next lives in the top bar)
    const done = root.createEl("button", { text: "Done (back to filters)", cls: "qt-done" });
    done.addEventListener("click", async () => {
      await this.flushNotes();
      this.state = "idle";
      this.render();
    });
  }
}

module.exports = {
  PracticeView,
};
