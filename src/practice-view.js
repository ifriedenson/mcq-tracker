"use strict";
const { ItemView, Notice, Platform, TFile, setIcon } = require("obsidian");
const { FILTER_FIELDS, MODES, VIEW_TYPE } = require("./constants");
const { loadQuestionData, makeKeyboardClickable, renderMarkdownInto, renderMatchPicker } = require("./view-helpers");
const { fmtClock, fmtDate, str } = require("./util");
const { MODE_PRED, filterOptionCounts, folderLabel, fvals, hasFilters, isDue, pickQuestion } = require("./filters");
const { extractRationale } = require("./notes");
const { gradeAnswerDetailed } = require("./numeric-grading");
const { isExamReady } = require("./view-helpers");
const { formatChoiceSet, normalizeTrueFalse, parseChoiceSet, trueFalseLabels } = require("./answer-types");
const { gradeMatching, parsePicks, shuffleForSeed } = require("./matching");
const { variantSummary, variantValuesText } = require("./parameterized");
const { FolderFilterSuggest, NameModal } = require("./modals");
const { ChatPanel } = require("./chat-panel");
const { API_PRESETS } = require("./api-client");
const { hasSecretStorage, resolveApiKey, storeApiKey } = require("./secret-keys");
const { QUICK_START_URL, aiReady, emptyState } = require("./empty-state");
const { groupIssues } = require("./importer");
const { buildGeneralContext, buildTutorContext } = require("./opencode-client");
const { anyContext, buildStudyContext } = require("./ai-context");
const { readActiveNoteContext } = require("./note-context");
const { QUICK_TIME_OPTIONS, QUICK_COUNT_OPTIONS, buildQuickQueue, createQuickSession, packQuickSession, pauseQuickSession, quickRemainingSeconds, resumeQuickSession, unpackQuickSession } = require("./quick-practice");
const { adaptiveSessionValue, normalizeQuickAdaptive } = require("./adaptive-session");
const { STUDY_SKIN_LABELS, buildMatchPairs, normalizeStudyMode, normalizeStudySkin, resolveStudySkin, shouldRepeatStudyCard, studyAttemptForChoice, studyAttemptForFlip, studyModeLabel, studyProgress, studySeconds, studySkinEnabled } = require("./study-skin");
const { StudyMatchModal } = require("./study-match-modal");
const { practiceKeyboardAction } = require("./practice-keys");
const practiceFullscreen = require("./practice-fullscreen");
const practiceTools = require("./practice-tools");
const calculator = require("./calculator");

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
    this.quickSession = null;
    this.study = null;
    this.matchOrder = [];
    this.hintShown = false;
    this.mobileTab = "question";
    this.mobileResultTab = "review";
    this.keyboardSubmit = null;
    this.keyboardHandler = (event) => this.handlePracticeKey(event);
    // Bluebook-style testing tools. Eliminations and highlights are kept per
    // question for as long as this view is open, like the official app keeps
    // them for the length of a module.
    this.toolsOpen = false;
    this.activeTool = "";
    this.eliminatorMode = false;
    this.eliminatedByPath = new Map();
    this.highlightsByPath = new Map();
    this.answeredPaths = new Set();
    this.visited = [];
    this.zoom = 100;
    this.lineReader = false;
    this.timerHidden = false;
    this.contrast = false;
    this.expandPassage = false;
    this.timerWarned = false;
    this.toolSelection = null;
    this.highlightColor = "yellow";
    this.highlightStyle = "highlight";
    this.calc = { expression: "", result: "", error: "", mode: "basic" };
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
    this._practiceFullscreenClosed = false;
    this.contentEl.addClass("qt-root");
    if (activeDocument && typeof activeDocument.addEventListener === "function") {
      activeDocument.addEventListener("keydown", this.keyboardHandler);
    }
    this.registerInterval(activeWindow.setInterval(() => this.tick(), 500));
    await this.restoreSession();
    // While the first-run screen is up, follow the vault: an import, a fixed note or a deleted one changes what it says.
    // Obsidian indexes new notes a moment after they're written, so wait for the changes to settle.
    let timer = null;
    const refresh = () => {
      if (!this.emptyShown) return;
      activeWindow.clearTimeout(timer);
      timer = activeWindow.setTimeout(() => this.emptyShown && this.render(), 400);
    };
    this.registerEvent(this.app.metadataCache.on("changed", refresh));
    this.registerEvent(this.app.metadataCache.on("deleted", refresh));
    this.render();
  }

  async onClose() {
    this._practiceFullscreenClosed = true;
    this.plugin.syncPracticeFullscreen(this);
    if (activeDocument && typeof activeDocument.removeEventListener === "function") {
      activeDocument.removeEventListener("keydown", this.keyboardHandler);
    }
    await this.flushNotes();
    if (this.quickSession) {
      pauseQuickSession(this.quickSession);
      this.plugin.pauseSession();
      this.plugin.settings.quickSession = packQuickSession(this.quickSession);
      await this.plugin.save();
    }
  }

  /* ---- helpers */

  md(markdown, el, sourcePath) {
    renderMarkdownInto(this.app, markdown, el, sourcePath, this);
  }

  tick() {
    if (!this.timerEl || this.state !== "question") return;
    const countdown = this.quickSession && this.quickSession.kind === "time" ? quickRemainingSeconds(this.quickSession) : null;
    const s = countdown === null ? Math.floor(this.plugin.elapsedMs() / 1000) : this.quickSession.value * 60 - countdown;
    if (countdown !== null && practiceTools.shouldWarnFive(countdown, this.timerWarned)) {
      this.timerWarned = true;
      this.timerHidden = false;
      new Notice("Five minutes remaining in Quick Practice.", 6000);
      // The warning arrives from the interval, not from a click, so redraw next tick.
      if (typeof activeWindow !== "undefined" && activeWindow && typeof activeWindow.setTimeout === "function") {
        activeWindow.setTimeout(() => this.state === "question" && this.render(), 0);
      }
    }
    this.timerEl.setText(fmtClock(s));
    const target = Number(this.current && this.current.fm.target_seconds) || 0;
    this.timerEl.toggleClass("is-over", !!target && s > target);
    if (this.quickSession && this.quickSession.kind === "time" && quickRemainingSeconds(this.quickSession) <= 0) {
      this.finishQuick("Quick Practice time is up.");
    }
  }

  async restoreSession() {
    const savedQuick = unpackQuickSession(this.plugin.settings.quickSession, Date.now());
    if (savedQuick) {
      if (savedQuick.expired) {
        this.plugin.settings.quickSession = null;
        await this.plugin.save();
        new Notice("Your Quick Practice time ran out while Obsidian was closed.", 5000);
      } else {
        const q = this.plugin.getQuestions().find((x) => x.file.path === savedQuick.paths[savedQuick.index]);
        if (q) {
          this.quickSession = savedQuick;
          resumeQuickSession(this.quickSession);
          await this.loadQuestion(q, false);
          this.plugin.startSession(q.file.path);
          new Notice("Picked Quick Practice back up.", 4000);
          return;
        }
        this.plugin.settings.quickSession = null;
        await this.plugin.save();
      }
    }    const s = this.plugin.session;
    if (!s) return;
    const file = this.app.vault.getAbstractFileByPath(s.path);
    const fm = file instanceof TFile ? this.app.metadataCache.getFileCache(file)?.frontmatter : null;
    if (!fm || !fm.question_id) {
      this.plugin.clearSession();
      return;
    }
    await this.loadQuestion({ file, fm }, false, s.variantSeed);
  }

  async loadQuestion(q, fresh, seed) {
    this.current = await loadQuestionData(this.plugin, q, { seed });
    this.sel = "";
    this.conf = 0;
    this.hintShown = false;
    this.toolSelection = null;
    this.timerWarned = false;
    if (!this.visited.some((item) => item.path === q.file.path)) this.visited.push({ path: q.file.path });
    this.matchOrder =
      this.current.mode === "match"
        ? shuffleForSeed(this.current.pairs.map((_pair, i) => i), q.file.path)
        : [];
    this.state = "question";
    if (fresh) {
      this.plugin.startSession(q.file.path, this.current.variant && this.current.variant.ok ? this.current.variant.seed : undefined);
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
    if (this.quickSession) return this.nextQuick();
    await this.flushNotes();
    const st = this.plugin.settings;
    const pool = this.plugin.filtered(this.plugin.getQuestions());
    const pick = pickQuestion(pool, st.mode, fmtDate(new Date()), this.recent, undefined, this.plugin.getQuestions());
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

  startQuickSetup() {
    this.state = "quick-setup";
    this.render();
  }

  /** The optional Quizlet-style skin: same filtered MCQ notes, same scheduler. */
  async startStudySkin(skinOverride, modeOverride) {
    const p = this.plugin;
    const skin = normalizeStudySkin(skinOverride || p.settings.studySkin);
    if (skin === "off") {
      new Notice("Study cards are off. Turn them on under Settings, MCQ Tracker, Practice.");
      return;
    }
    const mode = normalizeStudyMode(modeOverride || p.settings.studyMode);
    if (mode === "match") {
      await this.startStudyMatch();
      return;
    }
    const pool = p.filtered(p.getQuestions());
    const queue = buildQuickQueue(pool, p.settings.mode, fmtDate(new Date()), 20);
    if (!queue.length) {
      new Notice("No questions match your current filters.");
      return;
    }
    if (this.quickSession) {
      this.quickSession = null;
      p.settings.quickSession = null;
      await p.save();
    }
    p.clearSession();
    this.study = {
      skin,
      mode,
      paths: queue.map((q) => q.file.path),
      queue: queue.map((q) => q.file.path),
      results: [],
      repeats: [],
      index: -1,
      card: null,
      currentSkin: skin,
      revealed: false,
      sel: "",
      recorded: false,
      summary: null,
      startedAt: 0,
      recalled: 0,
      reviewed: 0,
    };
    this.state = "study";
    await this.nextStudyCard();
  }

  async nextStudyCard() {
    const st = this.study;
    if (!st) {
      this.state = "idle";
      this.render();
      return;
    }
    const p = this.plugin;
    const queue = Array.isArray(st.queue) ? st.queue : st.paths;
    for (let i = st.index + 1; i < queue.length; i++) {
      const q = p.getQuestions().find((x) => x.file.path === queue[i]);
      if (!q) continue;
      try {
        st.card = await loadQuestionData(p, q);
        st.index = i;
        st.currentSkin = resolveStudySkin(st.skin, st.card);
        st.revealed = false;
        st.sel = "";
        st.recorded = false;
        st.summary = null;
        st.startedAt = Date.now();
        this.render();
        return;
      } catch (e) {
        // The note vanished between building the queue and opening it.
      }
    }
    st.index = queue.length;
    this.state = "study-summary";
    this.render();
  }

  async revealStudyAnswer() {
    const st = this.study;
    if (!st || !st.card || st.revealed) return;
    if (st.currentSkin === "choice" && !st.sel) {
      new Notice("Choose an answer first.");
      return;
    }
    if (st.currentSkin === "choice") await this.recordStudy("choice");
    else {
      st.revealed = true;
      this.render();
    }
  }

  async recordStudy(rating) {
    const st = this.study;
    if (!st || !st.card || st.recorded) return;
    const seconds = studySeconds(st.startedAt, Date.now());
    const attempt =
      rating === "choice"
        ? studyAttemptForChoice(st.sel, st.card.key, seconds, st.card.mode === "self")
        : studyAttemptForFlip(rating === "known", seconds);
    if (st.card.variant && st.card.variant.ok) {
      attempt.variant = variantValuesText(st.card.variant.values);
      attempt.variantSeed = st.card.variant.seed;
    }
    try {
      const summary = await this.plugin.recordAttempt(st.card.file, attempt);
      st.summary = summary;
      st.recorded = true;
      st.revealed = true;
      st.reviewed++;
      if (attempt.correct) st.recalled++;
      if (st.mode === "learn" || st.mode === "test") {
        st.results.push({
          path: st.card.file.path,
          question: str(st.card.sections && st.card.sections.question).replace(/\s+/g, " ").trim(),
          picked: attempt.chosen,
          key: str(st.card.key),
          correct: attempt.correct === true,
        });
      }
      if (shouldRepeatStudyCard(st.mode, attempt.correct, st.repeats.includes(st.card.file.path))) {
        st.repeats.push(st.card.file.path);
        st.queue.push(st.card.file.path);
      }
      if (st.mode === "test") {
        await this.nextStudyCard();
        return;
      }
      this.render();
    } catch (e) {
      new Notice(str(e && e.message) || "Could not save this review.", 6000);
    }
  }

  endStudy() {
    this.study = null;
    this.state = "idle";
    this.render();
  }

  /** Match mode: pair six prompts with their answers in a small modal. */
  async startStudyMatch() {
    const p = this.plugin;
    const pool = p.filtered(p.getQuestions());
    const queue = buildQuickQueue(pool, p.settings.mode, fmtDate(new Date()), 6, p.getQuestions());
    const cards = [];
    for (const q of queue) {
      try {
        cards.push(await loadQuestionData(p, q));
      } catch (e) {
        // The note vanished while the board was built.
      }
    }
    const pairs = buildMatchPairs(cards, 6);
    if (pairs.length < 2) {
      new Notice("Match needs at least two questions with a prompt and an answer key.");
      return;
    }
    new StudyMatchModal(this.app, p, pairs, { onDone: () => this.render() }).open();
  }

  async startQuick(kind, value, options) {
    const p = this.plugin;
    const opts = options || {};
    const pool = Array.isArray(opts.pool) ? opts.pool : p.filtered(p.getQuestions());
    const mode = opts.mode || p.settings.mode;
    const queue = buildQuickQueue(pool, mode, fmtDate(new Date()), kind === "time" ? Math.max(1, pool.length) : value, p.getQuestions());
    if (!queue.length) {
      new Notice(opts.label ? `No questions match ${opts.label}.` : "No questions match your current filters.");
      return;
    }
    if (kind === "count" && queue.length < value) {
      new Notice(`Only ${queue.length} question${queue.length === 1 ? "" : "s"} matched, so Quick Practice will use what is available.`, 5000);
    }
    const session = createQuickSession(queue, { kind, value, mode: { due: "due" }[mode] || mode, label: opts.label });
    this.quickSession = session;
    p.settings.quickSession = packQuickSession(session);
    await p.save();
    await this.loadQuestion(queue[0], true);
    this.render();
  }

  /** Start an exact set of paths, used by the daily quiz instead of a weighted queue. */
  async startDailySession(paths, date) {
    const p = this.plugin;
    const list = Array.isArray(paths) ? paths : [];
    const byPath = new Map(p.getQuestions().map((q) => [q.file.path, q]));
    const queue = list.map((path) => byPath.get(path)).filter(Boolean);
    if (!queue.length) {
      new Notice("Today's daily quiz questions are no longer available.");
      return;
    }
    this.quickSession = null;
    const session = createQuickSession(queue, {
      kind: "count",
      value: queue.length,
      mode: "smart",
      daily: true,
      date,
    });
    this.quickSession = session;
    p.settings.quickSession = packQuickSession(session);
    await p.save();
    await this.loadQuestion(queue[0], true);
    this.render();
  }

  async nextQuick() {
    await this.flushNotes();
    const session = this.quickSession;
    if (!session) return this.next();
    if (session.kind === "time" && quickRemainingSeconds(session) <= 0) return this.finishQuick("Quick Practice time is up.");
    const nextIndex = session.index + 1;
    if (nextIndex >= session.paths.length) {
      return this.finishQuick(session.daily ? "Daily quiz complete." : "Quick Practice complete.", true);
    }
    session.index = nextIndex;
    this.plugin.settings.quickSession = packQuickSession(session);
    await this.plugin.save();
    const q = this.plugin.getQuestions().find((x) => x.file.path === session.paths[nextIndex]);
    if (!q) return this.finishQuick("A question in this session is no longer available.");
    await this.loadQuestion(q, true);
    this.render();
  }

  async setCurrentStudyStatus(status) {
    const p = this.plugin;
    const file = this.current ? this.current.file : this.result && this.result.file;
    if (!file) return;
    if (status === "excluded") {
      const ok = await p.askConfirm(
        "Exclude this item?",
        "It will be skipped by practice, Quick Practice, timed tests and the due queue. The note stays in your vault, and you can restore it from Settings, MCQ Tracker, Review, Manage known and excluded items.",
        "Exclude"
      );
      if (!ok) return;
    }
    try {
      const summary = await p.setStudyStatus(file, status);
      p.notifyStudyStatusChange(summary, file, summary && summary.previous);
      await this.next();
    } catch (e) {
      new Notice(str(e && e.message) || "Could not update this item.", 6000);
    }
  }

  async finishQuick(message, completed) {
    const finished = this.quickSession;
    this.plugin.clearSession();
    this.plugin.settings.quickSession = null;
    await this.plugin.save();
    this.quickSession = null;
    this.state = "idle";
    if (finished && finished.daily && completed && this.plugin.completeDailyQuiz) {
      const state = await this.plugin.completeDailyQuiz(finished.date || fmtDate(new Date()));
      new Notice(`${message} Daily streak: ${state.streak} day${state.streak === 1 ? "" : "s"}.`, 6000);
    } else {
      new Notice(message, 5000);
    }
    this.render();
  }

  pauseQuick() {
    if (!this.quickSession) return;
    pauseQuickSession(this.quickSession);
    this.plugin.pauseSession();
    this.plugin.settings.quickSession = packQuickSession(this.quickSession);
    this.plugin.save();
  }

  /** True only while a question or result is on screen. */
  isPracticeSessionActive() {
    return !this._practiceFullscreenClosed && practiceFullscreen.practiceSessionActive(this.state);
  }

  /** True while this Practice leaf is the active workspace leaf. */
  isPracticeKeyboardActive() {
    const ws = this.app && this.app.workspace;
    const active = ws && ws.activeLeaf;
    return !active || active === this.leaf;
  }

  /** Minimal D2 keyboard path: Space/Enter does the primary action, Esc ends. */
  handlePracticeKey(event) {
    if (!this.isPracticeKeyboardActive()) return "";
    const target = event && event.target;
    const tag = String((target && target.tagName) || "").toLowerCase();
    const editable = tag === "input" || tag === "textarea" || !!(target && target.isContentEditable === true);
    const tool = editable ? "" : practiceTools.practiceToolShortcut(event);
    if (tool) {
      if (event && typeof event.preventDefault === "function") event.preventDefault();
      this.runTool(tool);
      return tool;
    }
    if (target && activeDocument && activeDocument.body && target !== activeDocument.body) {
      const contains = this.contentEl && this.contentEl.contains;
      if (typeof contains === "function" && !contains.call(this.contentEl, target)) return "";
    }
    const study = this.study || {};
    const action = practiceKeyboardAction(event, {
      active: true,
      state: this.state,
      submitReady: !!(this.keyboardSubmit && this.keyboardSubmit.ready && this.keyboardSubmit.ready()),
      revealed: study.revealed === true,
      recorded: study.recorded === true,
    });
    if (!action) return "";
    if (event && typeof event.preventDefault === "function") event.preventDefault();
    if (action === "submit" && this.keyboardSubmit) this.keyboardSubmit();
    else if (action === "reveal") this.revealStudyAnswer();
    else if (action === "next-study") this.nextStudyCard();
    else if (action === "next") this.next();
    else if (action === "end") this.endKeyboardSession();
    return action;
  }

  async endKeyboardSession() {
    if (this.state === "study" || this.state === "study-summary") {
      this.endStudy();
      return;
    }
    await this.flushNotes();
    if (this.state === "result") {
      this.state = "idle";
      this.render();
      return;
    }
    if (this.state !== "question") return;
    if (this.quickSession) {
      await this.finishQuick("Quick Practice ended.");
      return;
    }
    this.plugin.clearSession();
    this.state = "idle";
    this.render();
  }

  async submit() {
    const q = this.current;
    const fm = q.fm;
    let correct;
    let chosen = this.sel;
    let answerCheck = null;
    if (q.mode === "match") {
      answerCheck = gradeMatching(q.pairs, this.sel);
      correct = answerCheck.correct;
    } else if (q.mode === "self") {
      correct = this.sel === "correct";
      chosen = "";
    } else {
      answerCheck = gradeAnswerDetailed({ ...fm, answer: q.key, question_type: q.mode }, this.sel);
      correct = answerCheck ? answerCheck.correct : null;
    }
    const seconds = Math.round(this.plugin.elapsedMs() / 1000);
    const summary = await this.plugin.recordAttempt(q.file, {
      correct,
      chosen,
      conf: this.conf,
      seconds,
      now: new Date(),
      variant: q.variant && q.variant.ok ? variantValuesText(q.variant.values) : "",
      variantSeed: q.variant && q.variant.ok ? q.variant.seed : undefined,
    });
    if (summary && summary.queued) {
      new Notice("Saved offline. This result will be added to the note when the vault is writable.", 7000);
    }
    this.plugin.clearSession();
    this.answeredPaths.add(q.file.path);
    this.tally.n++;
    if (correct) this.tally.correct++;
    this.notesText = q.sections.notes;
    this.notesDirty = false;
    this.mobileResultTab = "review";
    this.result = {
      file: q.file,
      correct,
      chosen,
      key: q.key,
      mode: q.mode,
      seconds,
      variant: q.variant,
      answerCheck,
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
    // Keep the body class aligned with the state machine even when a render is
    // triggered by a refresh, a filter change or an error path.
    this.plugin.syncPracticeFullscreen(this);
    el.empty();
    this.timerEl = null;
    this.keyboardSubmit = null;
    const root = el.createDiv({ cls: "qt-wrap" });
    this.emptyShown = false;
    if (this.plugin.mcqEnabled && !this.plugin.mcqEnabled()) return this.renderModuleOff(root);
    if (this.state === "question") this.renderQuestion(root);
    else if (this.state === "result") this.renderResult(root);
    else if (this.state === "chat") this.renderChat(root);
    else if (this.state === "study") this.renderStudy(root);
    else if (this.state === "study-summary") this.renderStudySummary(root);
    else if (this.state === "quick-setup") this.renderQuickSetup(root);
    else if (this.state === "ai-setup") this.renderAiSetup(root);
    else this.renderIdle(root);
    // two-pane screens scroll inside their panes, not the whole view
    el.toggleClass("qt-no-scroll", root.hasClass("qt-wide"));
    this.tick();
  }

  renderIdle(root) {
    const p = this.plugin;
    const st = p.settings;
    const questions = p.getQuestions();

    const empty = emptyState(this.app, st.questionFolder);
    if (empty) {
      this.renderEmpty(root, empty);
      return;
    }

    const only = str(st.practicePath).trim();
    if (only) {
      const bar = root.createDiv({ cls: "qt-only-note" });
      bar.createSpan({ text: `Practising only ${only.split("/").pop().replace(/\.md$/i, "")}` });
      const open = bar.createEl("button", { text: "Open note", cls: "qt-link" });
      open.addEventListener("click", () => {
        const file = p.app.vault.getAbstractFileByPath(only);
        if (file) p.app.workspace.getLeaf("tab").openFile(file);
      });
      bar.createEl("button", { text: "Practice all notes", cls: "qt-link" }).addEventListener("click", async () => {
        st.practicePath = "";
        await p.save();
        this.render();
      });
    }

    // presets
    const prow = root.createDiv({ cls: "qt-row" });
    const psel = prow.createEl("select", { cls: "qt-select qt-grow", attr: { "aria-label": "Filter preset" } });
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
    const msel = mrow.createEl("select", { cls: "qt-select", attr: { "aria-label": "Pick questions" } });
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
    if (st.mode === "adaptive") {
      root.createDiv({
        cls: "qt-hint",
        text: "Adaptive mastery targets a weak course, unit, skill, test or tag from your history, then picks a different question that shares another property. A missed question returns once its weak area reaches 75% mastery. FSRS due review is unchanged.",
      });
    }

    const start = root.createEl("button", { text: "Start", cls: "mod-cta qt-primary" });
    start.disabled = inMode === 0;
    start.addEventListener("click", () => this.next());

    const tools = root.createDiv({ cls: "qt-row qt-small-row" });
    tools.createEl("button", { text: "Today" }).addEventListener("click", () => p.activateToday());
    tools.createEl("button", { text: "Quick Practice" }).addEventListener("click", () => this.startQuickSetup());
    if (studySkinEnabled(st)) tools.createEl("button", { text: "Study cards" }).addEventListener("click", () => this.startStudySkin());
    tools.createEl("button", { text: "Timed test" }).addEventListener("click", () => p.activateTest());
    tools.createEl("button", { text: "Weak spots & errors" }).addEventListener("click", () => p.activateInsights("weak"));

    if (st.ai.enabled) {
      const ib = root.createEl("button", { text: "Import questions from a file" });
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

  /* ---- the module was turned off in settings */

  renderModuleOff(root) {
    root.addClass("qt-onboard");
    const card = root.createDiv({ cls: "qt-onboard-card" });
    card.createEl("h3", { text: "MCQ Tracker is off" });
    card.createDiv({
      cls: "qt-onboard-text",
      text: "The MCQ Tracker module is turned off, so practice, weak spots and timed tests are hidden. Your notes and settings are fine. Turn it back on under Settings, Global, Modules.",
    });
    card.createEl("button", { text: "Open settings", cls: "mod-cta qt-primary" }).addEventListener("click", () => this.plugin.openSettings());
  }

  /* ---- first run: no usable questions yet */

  renderEmpty(root, empty) {
    this.emptyShown = true;
    root.addClass("qt-onboard");
    const card = root.createDiv({ cls: "qt-onboard-card" });
    card.createEl("h3", { text: "No questions yet" });
    card.createDiv({ cls: "qt-onboard-text", text: "Extract multiple-choice questions from your PDFs, PowerPoints, Word files and more. Each one becomes a note you can practice." });
    card.createEl("button", { text: "Import files", cls: "mod-cta qt-primary" }).addEventListener("click", () => this.startImport());
    card.createEl("a", { text: "Quick-start guide", cls: "qt-onboard-link external-link", href: QUICK_START_URL, attr: { target: "_blank", rel: "noopener" } });
    if (empty.broken.length) this.renderBroken(card, empty.broken);
  }

  renderBroken(card, broken) {
    const n = broken.length;
    const box = card.createDiv({ cls: "qt-onboard-warn" });
    box.createDiv({ text: n === 1 ? "1 note in your vault looks like a question but can't be used yet." : `${n} notes in your vault look like questions but can't be used yet.` });
    const det = box.createEl("details", { cls: "qt-onboard-details" });
    det.createEl("summary", { text: "See what's wrong" });
    const SHOW = 5;
    for (const [problem, paths] of Object.entries(groupIssues(broken))) {
      det.createDiv({ cls: "qt-onboard-problem", text: `${problem} (${paths.length})` });
      for (const path of paths.slice(0, SHOW)) {
        const a = det.createEl("a", { text: path.replace(/^.*\//, "").replace(/\.md$/i, ""), cls: "qt-onboard-note", attr: { title: path } });
        makeKeyboardClickable(
          a,
          () => {
            const f = this.app.vault.getAbstractFileByPath(path);
            if (f instanceof TFile) this.app.workspace.getLeaf("tab").openFile(f);
          },
          { role: "link" }
        );
      }
      if (paths.length > SHOW) det.createDiv({ cls: "qt-hint", text: `and ${paths.length - SHOW} more` });
    }
  }

  /** The Import files button: set up AI first when it isn't, then the usual import window. */
  startImport() {
    if (aiReady(this.plugin)) {
      this.plugin.openPdfImport();
      return;
    }
    this.state = "ai-setup";
    this.render();
  }

  renderAiSetup(root) {
    const p = this.plugin;
    const ai = p.settings.ai;
    const api = ai.api;
    const back = () => {
      this.state = "idle";
      this.render();
    };
    const finish = async () => {
      await p.save();
      this.state = "idle";
      this.render();
      p.openPdfImport();
    };
    root.addClass("qt-onboard");
    const card = root.createDiv({ cls: "qt-onboard-card" });
    card.createEl("h3", { text: "Set up AI to import files" });
    card.createDiv({
      cls: "qt-onboard-text",
      text: "Importing uses an AI model to read your document. The file's text is sent to the provider you choose. Nothing is sent until you start an import.",
    });

    let useApi = true;
    const body = card.createDiv({ cls: "qt-onboard-form" });
    const draw = () => {
      body.empty();
      if (Platform.isDesktopApp) {
        body.createDiv({ cls: "qt-label", text: "How do you want to connect?" });
        const how = body.createEl("select", { cls: "qt-select", attr: { "aria-label": "Connection method" } });
        how.createEl("option", { value: "api", text: "My own API key" });
        how.createEl("option", { value: "opencode", text: "OpenCode (runs on this computer)" });
        how.value = useApi ? "api" : "opencode";
        how.addEventListener("change", () => {
          useApi = how.value === "api";
          draw();
        });
      }
      if (useApi) drawApi();
      else drawOpenCode();
    };
    const drawApi = () => {
      body.createDiv({ cls: "qt-label", text: "Provider" });
      const prov = body.createEl("select", { cls: "qt-select", attr: { "aria-label": "Provider" } });
      for (const [id, pr] of Object.entries(API_PRESETS)) prov.createEl("option", { value: id, text: pr.label });
      prov.value = api.provider;
      prov.addEventListener("change", () => {
        api.provider = prov.value;
        api.baseUrl = "";
        api.model = API_PRESETS[prov.value].defaultModel;
        draw();
      });
      const preset = API_PRESETS[api.provider] || API_PRESETS.custom;
      if (preset.kind === "openai" && !preset.base) {
        body.createDiv({ cls: "qt-label", text: "Base URL" });
        const url = body.createEl("input", { type: "text", cls: "qt-fsearch", attr: { placeholder: "https://.../v1" } });
        url.value = api.baseUrl || "";
        url.addEventListener("input", () => (api.baseUrl = url.value.trim()));
      }
      let keyEl = null;
      const existingKey = resolveApiKey(this.plugin.app, api);
      const secretStorage = hasSecretStorage(this.plugin.app);
      if (!preset.noKey) {
        body.createDiv({ cls: "qt-label", text: "API key" });
        keyEl = body.createEl("input", {
          type: "password",
          cls: "qt-fsearch",
          attr: { placeholder: existingKey ? "Using a saved key — leave blank to keep it" : "Paste your key" },
        });
        body.createDiv({
          cls: "qt-hint",
          text: secretStorage
            ? "Saved in Obsidian's Secret Storage, outside data.json."
            : "Saved as plain text in this plugin's data.json, which syncs with your vault.",
        });
      }
      body.createDiv({ cls: "qt-label", text: "Model" });
      const model = body.createEl("input", { type: "text", cls: "qt-fsearch", attr: { placeholder: "model name" } });
      model.value = api.model || "";
      const go = body.createEl("button", { text: "Save and continue", cls: "mod-cta qt-primary" });
      go.addEventListener("click", async () => {
        const key = keyEl ? str(keyEl.value).trim() : "";
        const name = str(model.value).trim();
        if (keyEl && !key && !existingKey) return new Notice("Paste your API key first.");
        if (!name) return new Notice("Enter the model name your provider lists.");
        if (keyEl && key) storeApiKey(this.plugin.app, api, api.provider, key);
        api.model = name;
        ai.backend = "api";
        ai.enabled = true;
        await finish();
      });
    };
    let openedSettings = false;
    const drawOpenCode = () => {
      body.createDiv({
        cls: "qt-hint",
        text: "OpenCode needs an AI provider and key of its own. Open the plugin settings to connect one (the first time, you'll be asked to confirm a download), then come back here.",
      });
      const open = body.createEl("button", { text: "Open AI settings", cls: openedSettings ? "" : "mod-cta qt-primary" });
      open.addEventListener("click", async () => {
        ai.backend = "opencode";
        ai.autoDeclined = false;
        await p.save();
        p.openSettings();
        openedSettings = true;
        draw();
      });
      if (!openedSettings) return;
      const go = body.createEl("button", { text: "Continue to import", cls: "mod-cta qt-primary" });
      go.addEventListener("click", async () => {
        ai.backend = "opencode";
        ai.enabled = true;
        await finish();
      });
    };
    draw();
    card.createEl("button", { text: "Back" }).addEventListener("click", back);
  }

  renderStudy(root) {
    const st = this.study;
    const card = st && st.card;
    root.addClass("qt-study");
    const bar = root.createDiv({ cls: "qt-study-bar" });
    const meta = bar.createDiv({ cls: "qt-study-meta" });
    meta.createSpan({ cls: "qt-study-mode", text: (st && STUDY_SKIN_LABELS[st.currentSkin]) || "Study cards" });
    if (st && st.mode && st.mode !== "cards") meta.createSpan({ cls: "qt-study-mode", text: studyModeLabel(st.mode) });
    if (st) meta.createSpan({ cls: "qt-study-progress", text: studyProgress(st.index, (st.queue || st.paths).length) });
    const tools = bar.createDiv({ cls: "qt-study-tools" });
    if (card) {
      const open = tools.createEl("button", { text: "Open note", cls: "qt-link" });
      open.addEventListener("click", () => this.app.workspace.getLeaf("tab").openFile(card.file));
    }
    const end = tools.createEl("button", { text: "End", cls: "qt-link" });
    end.addEventListener("click", () => this.endStudy());

    if (!card) {
      root.createDiv({ cls: "qt-hint", text: "This study session has no cards left." });
      return;
    }

    const path = card.file.path;
    const box = root.createDiv({ cls: "qt-study-card" });
    if (card.sections.stimulus) this.md(card.sections.stimulus, box.createDiv({ cls: "qt-study-stimulus" }), path);
    this.md(
      card.sections.question || "*No `## Question` section found in this note.*",
      box.createDiv({ cls: "qt-stem qt-study-question" }),
      path
    );

    if (st.currentSkin === "choice") {
      const choices = card.sections.choices || [];
      const key = str(card.key).toUpperCase();
      const picked = str(st.sel).toUpperCase();
      const list = box.createDiv({ cls: "qt-answers qt-study-choices" });
      for (const c of choices) {
        const isKey = st.revealed && c.letter === key;
        const isMine = st.revealed && c.letter === picked;
        const row = list.createEl("button", { text: c.letter, cls: "qt-choice qt-study-choice" });
        if (isKey) row.addClass("is-key");
        if (isMine && !isKey) row.addClass("is-miss");
        if (isMine) row.addClass("is-mine");
        if (!st.revealed && picked === c.letter) row.addClass("is-selected");
        if (st.revealed) row.disabled = true;
        this.md(c.text, row.createDiv({ cls: "qt-choice-text" }), path);
        if (isKey || isMine) {
          const tag = isKey && isMine ? "Your answer · correct" : isKey ? "Correct answer" : "Your answer";
          row.createSpan({ cls: "qt-tag", text: tag });
        }
        if (!st.revealed) {
          row.addEventListener("click", () => {
            st.sel = c.letter;
            this.render();
          });
        }
      }
      if (!st.revealed) {
        box.createDiv({
          cls: "qt-hint",
          text: st.mode === "test" ? "Choose one, then submit. Answers and scores appear at the end." : "Choose one, then reveal the answer.",
        });
      }
    }

    if (!st.revealed) {
      const actions = box.createDiv({ cls: "qt-row qt-study-actions" });
      const show = actions.createEl("button", {
        text: st.mode === "test" && st.currentSkin === "choice" ? "Submit answer" : "Show answer",
        cls: "mod-cta qt-grow",
      });
      show.addEventListener("click", () => this.revealStudyAnswer());
      const skip = actions.createEl("button", { text: "Skip", cls: "qt-grow" });
      skip.addEventListener("click", () => this.nextStudyCard());
      return;
    }

    const answer = card.sections.answer || (card.key ? `**Correct answer: ${card.key}**` : "");
    const answerBox = box.createDiv({ cls: "qt-study-answer" });
    if (answer) this.md(answer, answerBox.createDiv({ cls: "qt-stem" }), path);
    else answerBox.createDiv({ cls: "qt-hint", text: "This note has no answer key or explanation." });

    if (st.recorded) {
      const summary = st.summary || {};
      const next = summary.nextReview ? ` · next review ${summary.nextReview}` : "";
      box.createDiv({
        cls: "qt-study-recorded",
        text: `${summary.queued ? "Saved offline" : "Recorded"}${next}`,
      });
      const actions = box.createDiv({ cls: "qt-row qt-study-actions" });
      actions.createEl("button", { text: "Next card", cls: "mod-cta qt-grow" }).addEventListener("click", () => this.nextStudyCard());
      return;
    }

    const actions = box.createDiv({ cls: "qt-row qt-study-actions" });
    const again = actions.createEl("button", { text: "Still learning", cls: "qt-grow qt-study-again" });
    again.addEventListener("click", () => this.recordStudy("still"));
    const known = actions.createEl("button", { text: "Known", cls: "mod-cta qt-grow qt-study-known" });
    known.addEventListener("click", () => this.recordStudy("known"));
  }

  renderStudySummary(root) {
    const st = this.study;
    const reviewed = st ? st.reviewed : 0;
    const recalled = st ? st.recalled : 0;
    root.addClass("qt-study");
    const mode = normalizeStudyMode(st && st.mode);
    root.createEl("h3", { text: mode === "test" ? "Test complete" : "Study cards complete" });
    root.createDiv({
      cls: "qt-count",
      text: `${recalled} of ${reviewed} recalled${mode === "test" && reviewed ? ` (${Math.round((recalled / reviewed) * 100)}%)` : ""}`,
    });
    root.createDiv({ cls: "qt-hint", text: "This session used the same review history and scheduler as normal practice." });
    if (mode === "test" && st && st.results.length) {
      const list = root.createDiv({ cls: "qt-study-results" });
      for (const item of st.results) {
        const row = list.createDiv({ cls: "qt-study-result" });
        row.createSpan({ cls: "qt-study-result-mark", text: item.correct ? "Correct" : "Missed" });
        row.createSpan({ cls: "qt-hint", text: item.question });
        row.createDiv({ cls: "qt-hint", text: `Your answer: ${item.picked || "—"} · Correct: ${item.key || "—"}` });
      }
    }
    const actions = root.createDiv({ cls: "qt-row qt-study-actions" });
    actions.createEl("button", { text: "Back to practice", cls: "mod-cta qt-grow" }).addEventListener("click", () => this.endStudy());
    actions.createEl("button", { text: "Study again", cls: "qt-grow" }).addEventListener("click", () => this.startStudySkin(st && st.skin, st && st.mode));
  }

  renderQuickSetup(root) {
    const p = this.plugin;
    const pool = p.filtered(p.getQuestions());
    const today = fmtDate(new Date());
    const mode = p.settings.mode;
    const adaptive = normalizeQuickAdaptive(p.settings.quickAdaptive);
    let useRecommended = adaptive.enabled && adaptive.useRecommended !== false;
    const inMode = pool.filter((q) => (MODE_PRED[mode] || MODE_PRED.smart)(q.fm, today)).length;
    const preferredFor = (kind) => (kind === "time" ? p.settings.quickDefaults.minutes : p.settings.quickDefaults.count);
    const recommendFor = (kind) => adaptiveSessionValue(pool, { kind, base: preferredFor(kind), today, settings: adaptive });
    root.createEl("h3", { text: "Quick Practice" });
    root.createDiv({ cls: "qt-hint", text: "A short, one-handed session using your current filters and pick mode. Your progress is saved if Obsidian closes." });
    root.createDiv({ cls: "qt-count", text: `${inMode} question${inMode === 1 ? "" : "s"} available in ${mode === "smart" ? "Smart mix" : mode}.` });
    root.createDiv({ cls: "qt-label", text: "Session length" });
    const kind = root.createEl("select", { cls: "qt-select", attr: { "aria-label": "Session length" } });
    kind.createEl("option", { value: "time", text: "By time" });
    kind.createEl("option", { value: "count", text: "By question count" });
    kind.value = "time";
    const value = root.createEl("select", { cls: "qt-select", attr: { "aria-label": "Session length value" } });
    const recEl = root.createDiv({ cls: "qt-hint" });
    let rec = recommendFor("time");
    const fill = () => {
      rec = recommendFor(kind.value);
      value.empty();
      const baseOptions = kind.value === "time" ? QUICK_TIME_OPTIONS.slice() : QUICK_COUNT_OPTIONS.slice();
      const options = baseOptions.slice();
      if (adaptive.enabled && useRecommended && !options.includes(rec.value)) options.push(rec.value);
      options.sort((a, b) => a - b);
      options.forEach((n) => value.createEl("option", { value: String(n), text: kind.value === "time" ? `${n} minutes` : `${n} questions` }));
      const preferred = preferredFor(kind.value);
      value.value = String(adaptive.enabled && useRecommended ? rec.value : options.includes(preferred) ? preferred : options[0]);
      value.disabled = adaptive.enabled && useRecommended;
      recEl.setText(
        adaptive.enabled && useRecommended
          ? `Recommended: ${rec.value} ${kind.value === "time" ? "minutes" : "questions"} (${rec.band === "stretch" ? "stretch" : rec.band === "warmup" ? "warm-up" : "steady"}). ${rec.reason || "Using your chosen length."}`
          : adaptive.enabled
            ? "Adaptive length is on, but you chose your own length for this session."
            : "Adaptive length is off. Turn it on under Settings, MCQ Tracker, Practice to size sessions from recent recall."
      );
    };
    fill();
    kind.addEventListener("change", fill);
    if (adaptive.enabled) {
      const adaptiveRow = root.createDiv({ cls: "qt-row qt-small-row" });
      const label = adaptiveRow.createEl("label", { cls: "qt-hint" });
      const check = label.createEl("input", { type: "checkbox" });
      check.checked = useRecommended;
      label.createSpan({ text: " Use the recommended length" });
      check.addEventListener("change", async () => {
        useRecommended = check.checked;
        p.settings.quickAdaptive = { ...adaptive, useRecommended };
        await p.save();
        fill();
      });
    }
    const start = root.createEl("button", { text: "Start Quick Practice", cls: "mod-cta qt-primary" });
    start.disabled = !inMode;
    start.addEventListener("click", async () => {
      const recommendation = recommendFor(kind.value);
      const selected = adaptive.enabled && useRecommended ? recommendation.value : Number(value.value);
      if (!(adaptive.enabled && useRecommended)) {
        if (kind.value === "time") p.settings.quickDefaults.minutes = selected;
        else p.settings.quickDefaults.count = selected;
        await p.save();
      }
      await this.startQuick(kind.value, selected);
    });
    const back = root.createEl("button", { text: "Back" });
    back.addEventListener("click", () => {
      this.state = "idle";
      this.render();
    });
  }

  renderQuestion(root) {
    const p = this.plugin;
    const q = this.current;
    const fm = q.fm;
    const closedBook = p.settings.closedBook === true;
    const paused = !p.isRunning();
    const path = q.file.path;
    const verification = str(fm.verification).toLowerCase();
    const computedCheck = str(fm.verification_method).toLowerCase() === "computed" || str(fm.verified_by).toLowerCase() === "calculation";
    if (q.variant && q.variant.error) {
      const variantBox = root.createDiv({ cls: "qt-verify-banner" });
      variantBox.createSpan({ text: "Variant error. " });
      variantBox.createSpan({ text: `${q.variant.error} This question is self-graded until the formula or variables are fixed.` });
    }
    if (verification === "mismatch" || verification === "error" || verification === "review") {
      const check = root.createDiv({ cls: "qt-verify-banner" });
      check.createSpan({
        text:
          verification === "review"
            ? "Answer checks disagree. "
            : verification === "mismatch"
              ? computedCheck
                ? "Calculation check failed. "
                : "Answer check failed. "
              : computedCheck
                ? "Calculation check did not finish. "
                : "Answer check did not finish. ",
      });
      check.createSpan({
        text:
          verification === "review"
            ? `The AI check and the calculation disagree; this note is marked for review.`
            : verification === "mismatch"
              ? computedCheck
                ? `A calculation gives ${str(fm.verified_answer).trim() || "a different value"}, but this note says ${str(fm.answer).trim() || "no answer"}.`
                : `An independent AI pass chose ${str(fm.verified_answer).trim() || "a different answer"}, but this note says ${str(fm.answer).trim() || "no answer"}.`
              : computedCheck
                ? "This answer has not been checked by calculation."
                : "This answer has not been checked against a second answer.",
      });
    }
    root.addClass("qt-exam");
    root.addClass("qt-wide");
    // Phones get their own question screen: one slim bar, Passage/Question tabs,
    // an answer bar that only appears once a choice is picked, and a More sheet.
    const mobile = Platform.isMobile === true;
    if (mobile) root.addClass("qt-mobile");

    // ---- header: where you are, timer, pause, flag, more
    const bar = root.createDiv({ cls: "qt-bar qt-exam-bar" + (mobile ? " qt-m-bar" : "") });
    const quickLabel = this.quickSession ? str(this.quickSession.label).trim() : "";
    const labelHasCourse = quickLabel && fm.course && quickLabel.toLowerCase().includes(str(fm.course).toLowerCase());
    const meta = [quickLabel, labelHasCourse ? "" : fm.course, fm.unit ? `Unit ${fm.unit}` : "", fm.skill || fm.section, fm.difficulty]
      .filter(Boolean)
      .join(" · ");
    if (mobile) bar.createDiv({ cls: "qt-qnum qt-m-qnum", text: String(this.tally.n + 1) });
    bar.createDiv({ cls: "qt-meta", text: meta });
    const tw = bar.createDiv({ cls: "qt-timer-wrap" });
    this.timerEl = tw.createSpan({ cls: "qt-timer" });
    const timerCountdown = this.quickSession && this.quickSession.kind === "time" ? quickRemainingSeconds(this.quickSession) : null;
    if (!practiceTools.timerVisible(this.timerHidden, timerCountdown === null ? Number.POSITIVE_INFINITY : timerCountdown)) {
      this.timerEl.addClass("is-hidden");
    }
    const pb = tw.createEl("button", { cls: "qt-icon-btn", attr: { "aria-label": paused ? "Resume" : "Pause" } });
    setIcon(pb, paused ? "play" : "pause");
    pb.addEventListener("click", () => {
      if (paused) {
        p.resumeSession();
        if (this.quickSession) resumeQuickSession(this.quickSession);
      } else {
        p.pauseSession();
        if (this.quickSession) pauseQuickSession(this.quickSession);
      }
      if (this.quickSession) {
        p.settings.quickSession = packQuickSession(this.quickSession);
        p.save();
      }
      this.render();
    });
    const tools = bar.createDiv({ cls: "qt-exam-tools" });
    if (!mobile) {
      const menuBtn = tools.createEl("button", { cls: "qt-icon-btn", attr: { "aria-label": "Question menu", title: "Question menu" } });
      setIcon(menuBtn, "list");
      menuBtn.addEventListener("click", () => this.runTool("navigator"));
      const toolsBtn = tools.createEl("button", {
        cls: "qt-icon-btn qt-tools-btn",
        attr: { "aria-label": "Testing tools", title: "Testing tools", "aria-expanded": String(this.toolsOpen) },
      });
      setIcon(toolsBtn, "sliders-horizontal");
      toolsBtn.toggleClass("is-on", this.toolsOpen);
      toolsBtn.addEventListener("click", () => this.toggleToolsOpen());
    }
    if (!closedBook && !mobile) {
      const open = tools.createEl("button", { cls: "qt-icon-btn", attr: { "aria-label": "Open note" } });
      setIcon(open, "file-text");
      open.addEventListener("click", () => this.app.workspace.getLeaf("tab").openFile(q.file));
    }
    const flagged0 = fm.flagged === true;
    const makeFlagButton = (host, compact) => {
      const fb = host.createEl("button", { cls: compact ? "qt-icon-btn qt-m-flag" : "qt-flag" });
      const paintFlag = (on) => {
        fb.empty();
        const ic = fb.createSpan({ cls: "qt-flag-ic" });
        setIcon(ic, on ? "bookmark-check" : "bookmark");
        if (!compact) fb.createSpan({ text: on ? "Flagged" : "Flag for review" });
        fb.toggleClass("is-on", !!on);
        if (compact) fb.setAttr("aria-label", on ? "Flagged" : "Flag for review");
      };
      if (compact) fb.setAttr("aria-label", flagged0 ? "Flagged" : "Flag for review");
      paintFlag(flagged0);
      fb.addEventListener("click", async () => {
        const now = await this.plugin.toggleFlag(q.file);
        q.fm.flagged = now;
        paintFlag(now);
      });
      return fb;
    };
    let moreBtn = null;
    if (mobile) {
      makeFlagButton(tools, true);
      moreBtn = tools.createEl("button", { cls: "qt-icon-btn qt-m-more", attr: { "aria-label": "More actions", "aria-haspopup": "dialog" } });
      setIcon(moreBtn, "more-horizontal");
    }

    this.renderToolsDrawer(root, q);

    // ---- two panes: passage on the left, question + choices on the right
    const hasStim = !!q.sections.stimulus;
    // On a phone the passage becomes a tab so the question gets the whole screen.
    const tabs = mobile && hasStim ? root.createDiv({ cls: "qt-m-tabs", attr: { role: "tablist" } }) : null;
    const split = root.createDiv({ cls: `qt-split${hasStim && !mobile ? "" : " is-single"}${mobile ? " qt-m-split" : ""}` });
    const left = hasStim ? split.createDiv({ cls: `qt-pane qt-pane-left${mobile ? " qt-m-passage" : ""}` }) : null;
    const right = split.createDiv({ cls: `qt-pane qt-pane-right${mobile ? " qt-m-question" : ""}` });
    // The phone question body scrolls on its own so the answer bar can stay put.
    const body = mobile ? right.createDiv({ cls: "qt-m-scroll" }) : right;
    if (this.contrast) split.addClass("qt-tools-contrast");
    if (this.expandPassage && hasStim) split.addClass("qt-passage-expanded");
    if (this.zoom !== 100) split.style.zoom = `${this.zoom}%`;
    if (this.lineReader) this.mountLineReader(split);
    if (left) {
      left.addEventListener("mouseup", () => this.rememberSelection("stimulus"));
      left.addEventListener("keyup", () => this.rememberSelection("stimulus"));
    }
    body.addEventListener("mouseup", () => this.rememberSelection("question"));
    body.addEventListener("keyup", () => this.rememberSelection("question"));
    if (tabs && left) {
      const tabButtons = [];
      const show = (which) => {
        this.mobileTab = which;
        left.toggleClass("is-hidden", which !== "passage");
        right.toggleClass("is-hidden", which !== "question");
        for (const [btn, id] of tabButtons) {
          btn.toggleClass("is-active", id === which);
          btn.setAttr("aria-selected", String(id === which));
        }
      };
      for (const [id, label] of [["passage", "Passage"], ["question", "Question"]]) {
        const btn = tabs.createEl("button", { cls: "qt-m-tab", text: label, attr: { role: "tab" } });
        btn.addEventListener("click", () => show(id));
        tabButtons.push([btn, id]);
      }
      show(this.mobileTab === "passage" ? "passage" : "question");
    }
    if (mobile) {
      // One slim bar instead of three: it slides away while reading down and returns on the way up.
      let lastTop = 0;
      const hideBar = (ev) => {
        const scroller = ev && ev.target;
        const top = scroller && typeof scroller.scrollTop === "number" ? scroller.scrollTop : 0;
        bar.toggleClass("is-hidden", top > 24 && top > lastTop);
        lastTop = top;
      };
      body.addEventListener("scroll", hideBar);
      if (left) left.addEventListener("scroll", hideBar);
    }

    // ---- secondary actions: desktop keeps its footer row, phones put them behind the More sheet
    const doSkip = () => this.next();
    const doDontKnow = async () => {
      if (this.busy) return;
      this.busy = true;
      try {
        const summary = await p.recordSkip(q.file);
        new Notice(summary.nextReview ? `Logged a skip. Next review ${summary.nextReview}.` : "Logged a skip.", 5000);
        await this.next();
      } catch (e) {
        new Notice(str(e && e.message ? e.message : e) || "Could not log this skip.", 6000);
      } finally {
        this.busy = false;
      }
    };
    const doKnown = () => this.setCurrentStudyStatus("known");
    const doBury = () => this.setCurrentStudyStatus("buried");
    const doSuspend = () => this.setCurrentStudyStatus("suspended");
    const doExclude = () => this.setCurrentStudyStatus("excluded");
    const doEnd = () => {
      if (this.quickSession) this.finishQuick("Quick Practice ended.");
      else {
        this.plugin.clearSession();
        this.state = "idle";
        this.render();
      }
    };
    let ctl = null;
    let fc = null;
    let fr = null;
    if (!mobile) {
      ctl = right.createDiv({ cls: "qt-ctl" });
      fc = ctl.createDiv({ cls: "qt-foot-center" });
      fr = ctl.createDiv({ cls: "qt-foot-right" });
      const fl = ctl.createDiv({ cls: "qt-foot-left" });
      const skip = fl.createEl("button", { text: "Skip (don't log)" });
      skip.addEventListener("click", doSkip);
      const dontKnow = fl.createEl("button", { text: "Don't know", cls: "qt-status-btn" });
      dontKnow.setAttr("title", "Log that you don't know this; it is not a wrong answer, but the next review comes sooner.");
      dontKnow.addEventListener("click", doDontKnow);
      const known = fl.createEl("button", { text: `Known ${p.knownDaysForFile(q.file)}d`, cls: "qt-status-btn" });
      known.setAttr("title", "Hide this question for a while, then return it as due.");
      known.addEventListener("click", doKnown);
      const bury = fl.createEl("button", { text: "Bury", cls: "qt-status-btn" });
      bury.setAttr("title", "Hide this question until tomorrow.");
      bury.addEventListener("click", doBury);
      const suspend = fl.createEl("button", { text: "Suspend", cls: "qt-status-btn" });
      suspend.setAttr("title", "Hide this question until you restore it.");
      suspend.addEventListener("click", doSuspend);
      const exclude = fl.createEl("button", { text: "Exclude", cls: "qt-status-btn qt-status-exclude" });
      exclude.setAttr("title", "Keep the note but skip it in every practice queue.");
      exclude.addEventListener("click", doExclude);
      const end = fl.createEl("button", { text: "End" });
      end.addEventListener("click", doEnd);
    } else {
      const backdrop = root.createDiv({ cls: "qt-m-sheet-backdrop" });
      const sheet = root.createDiv({ cls: "qt-m-sheet", attr: { role: "dialog", "aria-label": "Question actions", "aria-modal": "true" } });
      const closeSheet = () => {
        sheet.removeClass("is-open");
        backdrop.removeClass("is-open");
      };
      const add = (label, fn, cls) => {
        const b = sheet.createEl("button", { text: label, cls: cls || "" });
        b.addEventListener("click", async () => {
          closeSheet();
          await fn();
        });
      };
      sheet.createDiv({ cls: "qt-m-sheet-title", text: "Question actions" });
      add("Skip", doSkip);
      add("Don't know", doDontKnow);
      add(`Known ${p.knownDaysForFile(q.file)}d`, doKnown);
      add("Bury", doBury);
      add("Suspend", doSuspend);
      add("Exclude", doExclude, "qt-status-exclude");
      add("Question menu", () => this.runTool("navigator"));
      add("Testing tools", () => this.toggleToolsOpen());
      if (!closedBook) add("Open question note", () => this.app.workspace.getLeaf("tab").openFile(q.file));
      add("End session", doEnd);
      const close = sheet.createEl("button", { text: "Close", cls: "qt-m-sheet-close" });
      close.addEventListener("click", closeSheet);
      backdrop.addEventListener("click", closeSheet);
      moreBtn.addEventListener("click", () => {
        const open = sheet.hasClass("is-open");
        sheet.toggleClass("is-open", !open);
        backdrop.toggleClass("is-open", !open);
      });
    }

    if (paused) {
      body.createDiv({ cls: "qt-paused", text: "Timer paused. Tap play to continue." });
      if (!mobile) {
        right.appendChild(ctl);
        fc.remove();
        fr.remove();
      }
      return;
    }

    if (left) {
      const stimulusEl = left.createDiv({ cls: "qt-stimulus" });
      this.md(q.sections.stimulus, stimulusEl, path);
      this.paintHighlights(stimulusEl, path, "stimulus");
    }

    // question header: number badge + flag (like "Mark for Review"); the phone bar already carries both
    if (!mobile) {
      const qh = body.createDiv({ cls: "qt-qhead" });
      qh.createSpan({ cls: "qt-qnum", text: String(this.tally.n + 1) });
      makeFlagButton(qh, false);
    }

    if (closedBook) {
      body.createDiv({
        cls: "qt-hint qt-closed-book",
        text: "Closed book: the source, answer note and explanation unlock after you submit.",
      });
    }

    const stemEl = body.createDiv({ cls: "qt-stem" });
    this.md(q.sections.question || "*No `## Question` section found in this note.*", stemEl, path);
    this.paintHighlights(stemEl, path, "question");

    const hintText = str(q.sections.hint).trim();
    if (hintText && p.settings.hints === true && !closedBook) {
      const hintRow = body.createDiv({ cls: "qt-hint qt-question-hint" });
      const hintBtn = hintRow.createEl("button", {
        text: this.hintShown ? "Hide hint" : "Show hint",
        cls: "qt-link",
        attr: { "aria-expanded": String(this.hintShown) },
      });
      if (this.hintShown) this.md(hintText, hintRow.createDiv({ cls: "qt-hint-text" }), path);
      hintBtn.addEventListener("click", () => {
        this.hintShown = !this.hintShown;
        this.render();
      });
    }

    const mode = q.mode;
    const answerBar = mobile ? right.createDiv({ cls: "qt-m-answerbar" }) : null;
    const submitHost = mobile ? answerBar : fr;
    let submit = null;
    const ready = () => {
      if (!this.sel) return false;
      if (mode !== "match") return !practiceTools.isEliminated(this.toolLetters(path), this.sel);
      if (parseChoiceSet(this.sel).some((letter) => practiceTools.isEliminated(this.toolLetters(path), letter))) return false;
      const picks = parsePicks(this.sel);
      return picks.length === q.pairs.length && picks.every((pick) => pick >= 0);
    };
    const refresh = () => {
      const armed = ready();
      if (submit) submit.disabled = !(armed && this.conf);
      if (answerBar) answerBar.toggleClass("is-armed", armed);
    };

    // answer input
    const ans = body.createDiv({ cls: "qt-answers" });
    if (mode === "mcq" || mode === "multi") {
      const n = Number(fm.choices) || q.sections.choices.length || 4;
      const letters = "ABCDEFGH".slice(0, n).split("");
      const byLetter = Object.fromEntries(q.sections.choices.map((c) => [c.letter, c.text]));
      const multi = mode === "multi";
      const picked = new Set(parseChoiceSet(this.sel));
      const btns = [];
      const eliminated = this.toolLetters(path);
      for (const L of letters) {
        const b = ans.createEl("button", { cls: "qt-choice" });
        b.createSpan({ cls: "qt-letter", text: L });
        if (byLetter[L]) this.md(byLetter[L], b.createDiv({ cls: "qt-choice-text" }), path);
        if (practiceTools.isEliminated(eliminated, L)) b.addClass("is-eliminated");
        b.addEventListener("click", () => {
          if (this.eliminatorMode) {
            practiceTools.toggleEliminated(eliminated, L);
            if (picked.has(L)) {
              picked.delete(L);
              this.sel = formatChoiceSet([...picked]);
            } else if (this.sel === L) {
              this.sel = "";
            }
            this.render();
            return;
          }
          if (practiceTools.isEliminated(eliminated, L)) {
            new Notice("This option is crossed out. Bring it back to choose it.");
            return;
          }
          if (multi) {
            if (picked.has(L)) picked.delete(L);
            else picked.add(L);
            this.sel = formatChoiceSet([...picked]);
            btns.forEach((x, i) => x.toggleClass("is-selected", picked.has("ABCDEFGH"[i])));
          } else {
            this.sel = L;
            btns.forEach((x) => x.toggleClass("is-selected", x === b));
          }
          refresh();
        });
        if ((multi ? picked.has(L) : this.sel === L) && !practiceTools.isEliminated(eliminated, L)) b.addClass("is-selected");
        b.setAttr("aria-pressed", String(multi ? picked.has(L) : this.sel === L));
        btns.push(b);
      }
      if (multi) ans.createDiv({ cls: "qt-hint", text: "Select all that apply." });
    } else if (mode === "tf") {
      const btns = [];
      for (const option of trueFalseLabels(q.sections.choices)) {
        const b = ans.createEl("button", { cls: "qt-choice qt-choice-tf" });
        b.createSpan({ cls: "qt-choice-text", text: option.label });
        b.addEventListener("click", () => {
          this.sel = option.value;
          btns.forEach((x) => x.toggleClass("is-selected", x === b));
          refresh();
        });
        if (this.sel === option.value) b.addClass("is-selected");
        btns.push(b);
      }
    } else if (mode === "spr") {
      const fill = /fill|cloze|blank/i.test(str(fm.question_type));
      const input = ans.createEl("input", {
        type: "text",
        cls: "qt-spr",
        attr: { placeholder: fill ? "Type the missing word or phrase" : "Your answer" },
      });
      input.value = this.sel;
      input.addEventListener("input", () => {
        this.sel = input.value.trim();
        refresh();
      });
    } else if (mode === "match") {
      renderMatchPicker({
        container: ans,
        pairs: q.pairs,
        order: this.matchOrder,
        picks: parsePicks(this.sel),
        renderLeft: (text, el) => this.md(text, el, path),
        hint: "Match every item, then submit.",
        onChange: (index, value) => {
          const width = q.pairs.length;
          const next = parsePicks(this.sel);
          for (let i = 0; i < width; i++) if (!Number.isInteger(next[i])) next[i] = -1;
          next[index] = value;
          this.sel = JSON.stringify(next.slice(0, width));
          refresh();
        },
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

    if (!mobile) right.appendChild(ctl); // keep the controls below the choices
    // confidence: desktop keeps it under the choices; the phone bar reveals it with an answer
    const confHost = mobile ? answerBar : fc;
    confHost.createSpan({ cls: "qt-foot-label", text: mobile ? "How sure?" : "How sure are you?" });
    const crow = confHost.createDiv({ cls: "qt-conf-row" });
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

    submit = submitHost.createEl("button", { text: "Submit", cls: "mod-cta qt-submit" });
    refresh();
    const submitFromKeyboard = () => {
      if (!submit || submit.disabled) return false;
      submit.disabled = true;
      this.submit();
      return true;
    };
    submitFromKeyboard.ready = () => !!submit && !submit.disabled;
    this.keyboardSubmit = submitFromKeyboard;
    submit.addEventListener("click", () => {
      submit.disabled = true;
      this.submit();
    });
  }

  /* ---- Bluebook-style testing tools */

  toggleToolsOpen() {
    this.toolsOpen = !this.toolsOpen;
    if (!this.toolsOpen) this.activeTool = "";
    this.render();
  }

  /** Runs one tool from a button or a keyboard shortcut. */
  runTool(id) {
    if (this.state !== "question") return;
    const action = String(id || "");
    if (!action) return;
    if (action === "zoom-in") {
      this.zoom = practiceTools.zoomIn(this.zoom);
      this.render();
      return;
    }
    if (action === "zoom-out") {
      this.zoom = practiceTools.zoomOut(this.zoom);
      this.render();
      return;
    }
    if (action === "zoom-reset") {
      this.zoom = 100;
      this.render();
      return;
    }
    if (action === "review") {
      const file = this.current ? this.current.file : null;
      if (!file) return;
      this.plugin.toggleFlag(file).then((now) => {
        if (this.current) this.current.fm.flagged = now;
        this.render();
      });
      return;
    }
    if (action === "timer") this.timerHidden = !this.timerHidden;
    else if (action === "line-reader" || action === "lineReader") this.lineReader = !this.lineReader;
    else if (action === "contrast") this.contrast = !this.contrast;
    else if (action === "expand") {
      this.expandPassage = !this.expandPassage;
      if (this.expandPassage && Platform.isMobile === true) this.mobileTab = "passage";
    } else if (action === "eliminator") {
      this.eliminatorMode = !this.eliminatorMode;
      this.activeTool = this.eliminatorMode ? "eliminator" : "";
    } else if (practiceTools.TOOL_IDS.includes(action)) {
      this.toolsOpen = true;
      this.activeTool = this.activeTool === action ? "" : action;
    } else {
      return;
    }
    this.render();
  }

  toolActive(id, q) {
    if (id === "timer") return this.timerHidden;
    if (id === "eliminator") return this.eliminatorMode;
    if (id === "lineReader") return this.lineReader;
    if (id === "contrast") return this.contrast;
    if (id === "expand") return this.expandPassage;
    if (id === "review") return !!(q && q.fm && q.fm.flagged === true);
    if (id === "zoom") return this.zoom !== 100;
    return this.activeTool === id;
  }

  toolLetters(path) {
    if (!this.eliminatedByPath.has(path)) this.eliminatedByPath.set(path, new Set());
    return this.eliminatedByPath.get(path);
  }

  toolHighlights(path) {
    if (!this.highlightsByPath.has(path)) this.highlightsByPath.set(path, []);
    return this.highlightsByPath.get(path);
  }

  renderToolsDrawer(root, q) {
    if (!this.toolsOpen) return;
    const drawer = root.createDiv({ cls: "qt-tools-drawer" });
    const head = drawer.createDiv({ cls: "qt-tools-head" });
    head.createEl("h4", { text: "Testing tools" });
    const close = head.createEl("button", { text: "Close", cls: "qt-link" });
    close.addEventListener("click", () => {
      this.toolsOpen = false;
      this.activeTool = "";
      this.render();
    });
    const grid = drawer.createDiv({ cls: "qt-tools-grid" });
    for (const tool of practiceTools.BLUEBOOK_TOOLS) {
      const active = this.toolActive(tool.id, q);
      const button = grid.createEl("button", {
        cls: `qt-tool-btn${active ? " is-on" : ""}`,
        attr: { "aria-pressed": String(!!active), title: tool.description },
      });
      const icon = button.createSpan({ cls: "qt-tool-ic" });
      setIcon(icon, tool.icon);
      const label = tool.id === "timer" && this.timerHidden ? "Show timer" : tool.label;
      button.createSpan({ cls: "qt-tool-label", text: label });
      if (tool.id === "expand" && !(q && q.sections.stimulus)) button.disabled = true;
      button.addEventListener("click", () => this.runTool(tool.id));
    }
    if (this.activeTool) this.renderToolPanel(drawer.createDiv({ cls: "qt-tools-panel" }), q);
  }

  renderToolPanel(panel, q) {
    const path = q.file.path;
    if (this.activeTool === "eliminator") return this.renderEliminatorPanel(panel, path);
    if (this.activeTool === "highlights") return this.renderHighlightsPanel(panel, path);
    if (this.activeTool === "calculator") return this.renderCalculatorPanel(panel);
    if (this.activeTool === "reference") return this.renderReferencePanel(panel);
    if (this.activeTool === "navigator") return this.renderNavigatorPanel(panel);
    if (this.activeTool === "zoom") return this.renderZoomPanel(panel);
    if (this.activeTool === "help") return this.renderHelpPanel(panel);
    panel.createDiv({ cls: "qt-tool-hint", text: "Pick a tool above. Mark for review also sits beside the question number." });
  }

  renderEliminatorPanel(panel, path) {
    const eliminated = practiceTools.eliminatedLetters(this.toolLetters(path));
    panel.createDiv({
      cls: "qt-tool-hint",
      text: eliminated.length
        ? `Crossed out: ${eliminated.join(", ")}. Click a crossed-out choice to bring it back.`
        : "Click a choice to cross it out. Click it again to bring it back.",
    });
    if (!eliminated.length) return;
    const row = panel.createDiv({ cls: "qt-row qt-small-row" });
    const clear = row.createEl("button", { text: `Bring back ${eliminated.length} crossed out` });
    clear.addEventListener("click", () => {
      practiceTools.clearEliminated(this.toolLetters(path));
      this.render();
    });
  }

  renderCalculatorPanel(panel) {
    const calc = this.calc;
    const modeRow = panel.createDiv({ cls: "qt-row qt-small-row" });
    for (const mode of calculator.CALCULATOR_MODES) {
      const button = modeRow.createEl("button", {
        text: mode === "basic" ? "Basic" : "Scientific",
        cls: `qt-calc-mode${calc.mode === mode ? " is-selected" : ""}`,
      });
      button.setAttr("aria-pressed", String(calc.mode === mode));
      button.addEventListener("click", () => {
        calc.mode = mode;
        this.render();
      });
    }
    const input = panel.createEl("input", {
      type: "text",
      cls: "qt-calc-input",
      attr: { placeholder: "2 + 2", "aria-label": "Calculator expression" },
    });
    input.value = calc.expression;
    input.addEventListener("input", () => {
      calc.expression = input.value;
    });
    const evaluate = () => {
      const result = calculator.evaluateCalculator(calc.expression);
      calc.result = result.ok ? result.text : "";
      calc.error = result.ok ? "" : result.error;
      this.render();
    };
    input.addEventListener("keydown", (event) => {
      if (event && event.key === "Enter") evaluate();
    });
    panel.createDiv({ cls: calc.error ? "qt-calc-error" : "qt-calc-result", text: calc.error || calc.result || "0" });
    const keys =
      calc.mode === "scientific" ? calculator.SCIENTIFIC_KEYS.concat(calculator.BASIC_KEYS) : calculator.BASIC_KEYS;
    const pad = panel.createDiv({ cls: "qt-calc-keys" });
    for (const row of keys) {
      for (const token of row) {
        const key = pad.createEl("button", {
          text: token,
          cls: `qt-calc-key${token === "=" ? " mod-cta" : ""}`,
          attr: { "aria-label": token === "=" ? "Evaluate" : token },
        });
        key.addEventListener("click", () => {
          if (token === "=") {
            evaluate();
            return;
          }
          calc.expression = calculator.appendCalculatorToken(calc.expression, token);
          if (token === "C" || token === "⌫") {
            calc.result = "";
            calc.error = "";
          }
          input.value = calc.expression;
        });
      }
    }
  }

  renderZoomPanel(panel) {
    const row = panel.createDiv({ cls: "qt-row qt-small-row" });
    const out = row.createEl("button", { text: "−", attr: { "aria-label": "Zoom out" } });
    out.disabled = this.zoom <= practiceTools.ZOOM_MIN;
    out.addEventListener("click", () => this.runTool("zoom-out"));
    row.createSpan({ cls: "qt-zoom-label", text: practiceTools.zoomLabel(this.zoom) });
    const inn = row.createEl("button", { text: "+", attr: { "aria-label": "Zoom in" } });
    inn.disabled = this.zoom >= practiceTools.ZOOM_MAX;
    inn.addEventListener("click", () => this.runTool("zoom-in"));
    const reset = panel.createEl("button", { text: "Reset to 100%" });
    reset.disabled = this.zoom === 100;
    reset.addEventListener("click", () => this.runTool("zoom-reset"));
    panel.createDiv({
      cls: "qt-tool-hint",
      text: "Zoom applies to the passage and question panes. Ctrl/⌘ with Plus, Minus or 0 does the same.",
    });
  }

  renderReferencePanel(panel) {
    panel.createDiv({
      cls: "qt-tool-hint",
      text: "Standard SAT math reference formulas, available offline. The Reference module has longer sheets.",
    });
    for (const group of practiceTools.SAT_REFERENCE_SHEET) {
      const box = panel.createDiv({ cls: "qt-ref-group" });
      box.createEl("h5", { text: group.group });
      for (const item of group.items) {
        const row = box.createDiv({ cls: "qt-ref-row" });
        row.createSpan({ cls: "qt-ref-name", text: item.name });
        row.createSpan({ cls: "qt-ref-formula", text: item.formula });
      }
    }
  }

  renderHighlightsPanel(panel, path) {
    panel.createDiv({
      cls: "qt-tool-hint",
      text:
        this.toolSelection && this.toolSelection.quote
          ? `Selected: “${this.toolSelection.quote.slice(0, 80)}${this.toolSelection.quote.length > 80 ? "…" : ""}”`
          : "Select text in the passage or question, then highlight it here.",
    });
    const colors = panel.createDiv({ cls: "qt-hl-colors" });
    for (const color of practiceTools.HIGHLIGHT_COLORS) {
      const swatch = colors.createEl("button", {
        cls: `qt-hl-swatch${this.highlightColor === color.id ? " is-selected" : ""}`,
        attr: { "aria-label": `${color.label} highlight`, title: color.label },
      });
      swatch.style.background = color.value;
      swatch.addEventListener("click", () => {
        this.highlightColor = color.id;
        this.render();
      });
    }
    const styles = panel.createDiv({ cls: "qt-row qt-small-row" });
    for (const style of practiceTools.HIGHLIGHT_STYLES) {
      const button = styles.createEl("button", {
        text: style === "underline" ? "Underline" : "Highlight",
        cls: this.highlightStyle === style ? "is-selected" : "",
      });
      button.setAttr("aria-pressed", String(this.highlightStyle === style));
      button.addEventListener("click", () => {
        this.highlightStyle = style;
        this.render();
      });
    }
    const add = panel.createEl("button", { text: "Highlight selection", cls: "mod-cta" });
    add.disabled = !(this.toolSelection && this.toolSelection.quote);
    add.addEventListener("click", () => this.addHighlightFromSelection());
    const list = this.toolHighlights(path);
    if (!list.length) {
      panel.createDiv({ cls: "qt-tool-hint", text: "No highlights for this question yet." });
      return;
    }
    const rows = panel.createDiv({ cls: "qt-hl-list" });
    for (const highlight of list) {
      const row = rows.createDiv({ cls: "qt-hl-row" });
      const quote = row.createDiv({
        cls: `qt-hl-quote qt-hl-${highlight.color}${highlight.style === "underline" ? " is-underline" : ""}`,
      });
      quote.createSpan({ text: highlight.quote });
      const note = row.createEl("input", { type: "text", cls: "qt-hl-note", attr: { placeholder: "Note", "aria-label": "Highlight note" } });
      note.value = highlight.note || "";
      note.addEventListener("input", () => practiceTools.updateHighlight(list, highlight.id, { note: note.value }));
      const remove = row.createEl("button", { text: "Remove", cls: "qt-link" });
      remove.addEventListener("click", () => {
        practiceTools.removeHighlight(list, highlight.id);
        this.render();
      });
    }
  }

  renderNavigatorPanel(panel) {
    const items = this.navigatorItems();
    const summary = practiceTools.navigatorSummary(items);
    panel.createDiv({
      cls: "qt-nav-summary",
      text: `${summary.answered} answered · ${summary.flagged} flagged · ${summary.skipped} skipped · ${summary.total} in this session`,
    });
    const list = panel.createDiv({ cls: "qt-nav-rows" });
    for (const row of practiceTools.navigatorRows(items)) {
      const button = list.createEl("button", {
        cls: `qt-nav-btn is-${row.status}${row.flagged ? " is-flagged" : ""}`,
        text: String(row.number),
        attr: { "aria-label": `${row.label}, ${row.status}${row.flagged ? ", flagged" : ""}` },
      });
      button.addEventListener("click", () => this.goToQuestion(row.path));
    }
    panel.createDiv({
      cls: "qt-tool-hint",
      text: this.quickSession ? "Questions come from this Quick Practice session." : "Questions you have opened in this practice session.",
    });
  }

  renderHelpPanel(panel) {
    panel.createDiv({
      cls: "qt-tool-hint",
      text: "These tools work offline and are modelled on the Bluebook app. They are not the official test application.",
    });
    for (const line of practiceTools.PRACTICE_TOOL_DIRECTIONS) panel.createDiv({ cls: "qt-tool-row", text: line });
    panel.createEl("h5", { text: "Keyboard shortcuts" });
    const table = panel.createDiv({ cls: "qt-shortcuts" });
    for (const row of practiceTools.TOOL_SHORTCUTS) {
      const line = table.createDiv({ cls: "qt-shortcut-row" });
      line.createSpan({ cls: "qt-shortcut-keys", text: row.keys });
      line.createSpan({ text: row.label });
    }
  }

  navigatorItems() {
    const p = this.plugin;
    const currentPath = this.current ? this.current.file.path : "";
    const flaggedOf = (path) => {
      const question = p.getQuestions().find((item) => item.file.path === path);
      return !!(question && question.fm && question.fm.flagged === true);
    };
    const paths = this.quickSession ? this.quickSession.paths.slice() : this.visited.map((item) => item.path);
    return paths.map((path, index) => ({
      path,
      number: index + 1,
      answered: this.answeredPaths.has(path),
      flagged: flaggedOf(path),
      current: path === currentPath,
    }));
  }

  async goToQuestion(path) {
    if (!path) return;
    const question = this.plugin.getQuestions().find((item) => item.file.path === path);
    if (!question) {
      new Notice("That question is no longer available.");
      return;
    }
    if (this.quickSession) {
      const at = this.quickSession.paths.indexOf(path);
      if (at >= 0) {
        this.quickSession.index = at;
        this.plugin.settings.quickSession = packQuickSession(this.quickSession);
        await this.plugin.save();
      }
    }
    await this.loadQuestion(question, false);
    this.toolsOpen = false;
    this.render();
  }

  rememberSelection(section) {
    const selection = this.readSelection();
    if (selection && selection.quote) {
      selection.section = section === "stimulus" ? "stimulus" : "question";
      this.toolSelection = selection;
    }
  }

  readSelection() {
    if (typeof activeDocument === "undefined" || !activeDocument || typeof activeDocument.getSelection !== "function") return null;
    const selection = activeDocument.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return null;
    const quote = str(selection.toString()).replace(/\s+/g, " ").trim();
    if (quote.length < 2) return null;
    return { quote };
  }

  addHighlightFromSelection() {
    const selection = this.toolSelection;
    if (!selection || !selection.quote) {
      new Notice("Select text in the passage or question first.");
      return;
    }
    const path = this.current ? this.current.file.path : "";
    if (!path) return;
    practiceTools.addHighlight(this.toolHighlights(path), {
      quote: selection.quote,
      color: this.highlightColor,
      style: this.highlightStyle,
      section: selection.section,
    });
    this.render();
  }

  /** Wraps the stored quotes in <mark> inside one rendered section. */
  paintHighlights(container, path, section) {
    const list = practiceTools.highlightsForSection(this.toolHighlights(path), section);
    if (!list.length || !container) return 0;
    if (typeof container.childNodes !== "object" || container.childNodes === null) return 0;
    const doc = container.ownerDocument;
    if (!doc || typeof doc.createTreeWalker !== "function" || typeof doc.createTextNode !== "function" || typeof doc.createElement !== "function") {
      return 0;
    }
    const walker = doc.createTreeWalker(container, 4);
    const nodes = [];
    let node = walker.nextNode();
    while (node) {
      nodes.push(node);
      node = walker.nextNode();
    }
    let painted = 0;
    for (const textNode of nodes) {
      const text = String(textNode.nodeValue || "");
      if (!text) continue;
      const ranges = practiceTools.findQuoteRanges(text, list.map((item) => item.quote));
      if (!ranges.length) continue;
      const fragment = doc.createDocumentFragment();
      let at = 0;
      for (const range of ranges) {
        if (range.index > at) fragment.appendChild(doc.createTextNode(text.slice(at, range.index)));
        const entry = list.find((item) => item.quote === range.quote) || list[0];
        const mark = doc.createElement("mark");
        mark.className = `qt-hl qt-hl-${entry.color}${entry.style === "underline" ? " is-underline" : ""}`;
        mark.setAttribute("data-highlight", entry.id);
        mark.textContent = text.slice(range.index, range.index + range.length);
        fragment.appendChild(mark);
        at = range.index + range.length;
        painted++;
      }
      if (at < text.length) fragment.appendChild(doc.createTextNode(text.slice(at)));
      if (textNode.parentNode) textNode.parentNode.replaceChild(fragment, textNode);
    }
    return painted;
  }

  mountLineReader(split) {
    const band = split.createDiv({ cls: "qt-line-reader", attr: { "aria-hidden": "true" } });
    const place = (event) => {
      const y = Number(event && event.clientY);
      if (!Number.isFinite(y)) return;
      band.style.top = `${Math.max(0, y - 32)}px`;
    };
    split.addEventListener("pointermove", place);
    split.addEventListener("mousemove", place);
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
        text: "Direct API chat has no file access. Tutor mode answers from this question; Agent mode can propose new questions, cards and one safe body-section edit, and you review every action before it is written.",
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
      getRole: () => p.settings.ai.tutorRole,
      setRole: (id) => {
        p.settings.ai.tutorRole = id;
        p.save();
      },
      buildContext: (mode, currentNote) =>
        [buildGeneralContext(this.app, mode, p.settings.ai.tutorRole, buildStudyContext(p, p.settings.ai.context)), currentNote]
          .filter(Boolean)
          .join("\n\n"),
      readNoteContext: () => readActiveNoteContext(this.app),
      quick: [
        ...(anyContext(p.settings.ai.context)
          ? [
              {
                label: "What should I study now?",
                detail: "A short, specific plan built from what is due and what you want to finish.",
                prompt: "Using the study context, tell me what to study next and why. Be specific and brief.",
              },
              {
                label: "Plan my week",
                detail: "A practical week of study around due work and your next exam.",
                prompt: "Using the study context, plan my next week of study around my due work and next exam. Keep it practical and short.",
              },
              {
                label: "Turn mistakes into a study guide",
                detail: "Your weakest skills and mistake patterns, turned into concrete next steps.",
                prompt: "Using the study context, turn my weakest skills and mistake patterns into a short study guide with concrete next steps.",
              },
            ]
          : []),
        ...(p.backend() === "api"
          ? []
          : [
              { label: "Notes missing answers", prompt: "List the question notes whose answer property is empty or missing." },
              { label: "Weakest skills", prompt: "Look at my question notes' attempts and correct_count and tell me which skills I am weakest at." },
              { label: "Create a question note", prompt: "I will paste a question with its choices, answer and rationale. Create a correctly formatted question note for it in the vault." },
            ]),
      ],
    });
  }

  renderResult(root) {
    const p = this.plugin;
    const r = this.result;
    const s = r.summary;
    const path = r.file.path;

    // A phone gets its own review screen. Tablets keep the shared split they
    // already used; Platform.isPhone is false there, and older API builds that
    // do not expose it fall back to the phone branch.
    if (Platform.isMobile === true && Platform.isPhone !== false) {
      this.renderMobileResult(root);
      return;
    }

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
    if (r.mode === "match" && r.answerCheck) bits.push(`You matched ${r.answerCheck.right} of ${r.answerCheck.total}`);
    else if (!r.correct && r.chosen) bits.push(`You chose ${r.chosen}${r.key ? `, answer ${r.key}` : ""}`);
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
    const known = acts.createEl("button", { text: `Known ${p.knownDaysForFile(r.file)}d` });
    known.addEventListener("click", () => this.setCurrentStudyStatus("known"));
    const exclude = acts.createEl("button", { text: "Exclude" });
    exclude.addEventListener("click", () => this.setCurrentStudyStatus("excluded"));
    const topNext = acts.createEl("button", { text: "Next question", cls: "mod-cta" });
    if (this.quickSession) topNext.setText("Next quick question");
    topNext.addEventListener("click", () => this.next());

    this.renderResultBody(root, { done: true });
  }

  renderResultBody(root, options) {
    const p = this.plugin;
    const r = this.result;
    const s = r.summary;
    const path = r.file.path;
    const opts = options || {};

    if (p.settings.examReady === true && isExamReady(s.streak, p.settings.examReadyPasses)) {
      const ready = root.createDiv({
        cls: "qt-exam-ready",
        text: `Exam ready · ${s.streak} correct in a row`,
      });
      ready.setAttr("role", "status");
    }
    root.createDiv({
      cls: "qt-count",
      text: `Streak ${s.streak} · ${s.correctCount}/${s.attempts} correct overall · next review ${s.nextReview}`,
    });
    if (r.summary && r.summary.queued) {
      root.createDiv({ cls: "qt-hint", text: "Saved offline. This result will be added to the note when the vault is writable." });
    }
    if (r.summary && r.summary.examCap) {
      const cap = r.summary.examCap;
      root.createDiv({
        cls: "qt-hint",
        text: `Next review moved to ${cap.date} to stay ahead of ${cap.name} on ${cap.examDate}.`,
      });
    }
    if (r.summary && r.summary.leech) {
      const leech = r.summary.leech;
      root.createDiv({
        cls: "qt-hint qt-leech",
        text: leech.suspended
          ? `Leech: ${leech.lapses} misses in a row. This question is suspended; restore it under Settings, Practice, Hidden study items.`
          : `Leech: ${leech.lapses} misses in a row. It stays in rotation and clears after a correct answer.`,
      });
    }
    if (r.summary && (r.summary.needsFixing || r.summary.needsFixingFlagged)) {
      const days = (r.summary.needsFixing && r.summary.needsFixing.missDays) || r.summary.needsFixingMissDays || Number(r.fm.needs_fixing_miss_days) || 0;
      const box = root.createDiv({ cls: "qt-hint qt-needs-fixing" });
      box.createSpan({
        text: `Needs fixing: missed on ${days || "several"} different day${days === 1 ? "" : "s"}.`,
      });
      const fix = box.createEl("button", { text: "Mark fixed", cls: "qt-link" });
      fix.addEventListener("click", async () => {
        const cleared = await p.markQuestionFixed(r.file);
        if (!cleared) return;
        delete r.fm.needs_fixing;
        delete r.fm.needs_fixing_since;
        delete r.fm.needs_fixing_miss_days;
        r.summary.needsFixing = null;
        r.summary.needsFixingFlagged = false;
        this.render();
      });
    }

    // ---- where this question came from (and a quick way back on a miss)
    const source = p.sourceInfo ? p.sourceInfo(r.fm, path) : null;
    if (source && source.has) {
      const sourceRow = root.createDiv({ cls: "qt-source" });
      sourceRow.createSpan({ cls: "qt-source-label", text: "Source" });
      sourceRow.createSpan({ cls: "qt-source-name", text: source.detail });
      if (!r.correct) {
        const reread = sourceRow.createEl("button", { text: "Reread this", cls: "qt-link" });
        reread.setAttr("aria-label", `Reread the source${source.page ? ` at page ${source.page}` : ""}`);
        reread.addEventListener("click", () => p.openSource(r.fm, path));
      }
    }

    // ---- review: the question and choices again, with your pick and the key marked
    const rv = root.createDiv({ cls: "qt-review" });
    if (r.variant && r.variant.ok && Object.keys(r.variant.values || {}).length) {
      rv.createDiv({ cls: "qt-hint qt-variant", text: `Variant: ${variantSummary(r.variant.values)}` });
    }
    this.md(r.sections.question || "", rv.createDiv({ cls: "qt-stem" }), path);
    const rc = rv.createDiv({ cls: "qt-answers" });
    if (r.mode === "match" && r.answerCheck) {
      const list = rv.createDiv({ cls: "qt-match-review" });
      for (const row of r.answerCheck.rows) {
        const line = list.createDiv({ cls: `qt-match-review-row ${row.correct ? "is-right" : "is-wrong"}` });
        this.md(row.left, line.createDiv({ cls: "qt-match-left" }), path);
        line.createDiv({ cls: "qt-match-review-answer", text: `Correct: ${row.right}` });
        if (!row.correct) line.createDiv({ cls: "qt-match-review-mine", text: `You: ${row.picked || "(blank)"}` });
      }
    }
    const keySet = new Set(parseChoiceSet(r.key));
    const mineSet = new Set(parseChoiceSet(r.chosen));
    const tfKey = r.mode === "tf" ? normalizeTrueFalse(r.key, r.sections.choices) : "";
    const tfMine = r.mode === "tf" ? normalizeTrueFalse(r.chosen, r.sections.choices) : "";
    if (r.sections.choices.length) {
      for (const c of r.sections.choices) {
        let isKey = false;
        let isMine = false;
        if (r.mode === "tf") {
          const word = normalizeTrueFalse(c.text, r.sections.choices);
          isKey = !!word && word === tfKey;
          isMine = !!word && word === tfMine;
        } else if (r.mode === "mcq" || r.mode === "multi") {
          isKey = keySet.has(c.letter);
          isMine = mineSet.has(c.letter);
        }
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
    if (r.mode === "multi") {
      const keyText = formatChoiceSet(parseChoiceSet(r.key)) || r.key;
      const mineText = formatChoiceSet(parseChoiceSet(r.chosen)) || r.chosen || "(blank)";
      rv.createDiv({ cls: "qt-hint", text: `Correct answers: ${keyText} · Your answer: ${mineText}` });
    }
    if (r.mode === "tf" && !r.sections.choices.length) {
      rv.createDiv({ cls: "qt-hint", text: `Your answer: ${r.chosen || "(blank)"} · Correct answer: ${tfKey || r.key}` });
    }
    if (r.mode === "spr") {
      rv.createDiv({ cls: "qt-hint", text: `Your answer: ${r.chosen || "(blank)"} · Correct answer: ${r.key || "(not stored)"}` });
      if (r.answerCheck && r.answerCheck.interpreted) {
        rv.createDiv({ cls: "qt-hint qt-numeric-check", text: r.answerCheck.interpreted });
        if (r.answerCheck.reason) rv.createDiv({ cls: "qt-hint qt-numeric-check", text: r.answerCheck.reason });
      }
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
          const queued = r.summary && r.summary.queued;
          const saved = queued ? await p.setPendingAttemptError(r.file.path, r.summary.attemptId, next) : false;
          if (!saved) await p.setErrorType(r.file, next);
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
      getRole: () => p.settings.ai.tutorRole,
      setRole: (id) => {
        p.settings.ai.tutorRole = id;
        p.save();
      },
      buildContext: (mode) => buildTutorContext(r, this.notesText, p.settings.confidenceLabels, mode, p.settings.ai.tutorRole),
      quick: [
        r.correct
          ? {
              label: "Why is the answer right?",
              detail: "A walkthrough of the correct answer and why each other choice is wrong.",
              prompt: "Explain why the correct answer is right and why the other choices are wrong.",
            }
          : {
              label: "Why did I miss this?",
              detail: "What likely went wrong, and how to get it right next time.",
              prompt: "I got this wrong. Explain what I likely misunderstood and how to get it right next time.",
            },
        {
          label: "Explain simply",
          detail: "The question and its solution in plain language.",
          prompt: "Explain this question and its solution in simple terms.",
        },
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

    // ---- done (desktop; phones put it in the review action bar)
    if (opts.done !== false) {
      const done = root.createEl("button", { text: "Done (back to filters)", cls: "qt-done" });
      done.addEventListener("click", async () => {
        await this.flushNotes();
        this.state = "idle";
        this.render();
      });
    }
  }

  /** The post-answer review on a phone: its own bar, Review | Passage tabs,
   * one scroller and a safe-area action bar instead of the desktop split. */
  renderMobileResult(root) {
    const p = this.plugin;
    const r = this.result;
    const path = r.file.path;
    const hasStim = !!r.sections.stimulus;
    const status = r.correct === true ? "Correct" : r.correct === false ? "Incorrect" : "Review";
    const statusClass = r.correct === true ? "is-correct" : r.correct === false ? "is-wrong" : "is-review";

    root.addClass("qt-wide");
    root.addClass("qt-exam");
    root.addClass("qt-mobile");

    // ---- review header: result, context, flag and More
    const bar = root.createDiv({ cls: "qt-bar qt-exam-bar qt-m-bar qt-m-review-bar" });
    bar.createDiv({ cls: `qt-m-review-status ${statusClass}`, text: status });
    const meta = [r.fm.course, r.fm.unit ? `Unit ${r.fm.unit}` : "", r.fm.skill || r.fm.section, r.fm.difficulty, fmtClock(r.seconds)]
      .filter(Boolean)
      .join(" · ");
    bar.createDiv({ cls: "qt-meta", text: meta || r.file.basename });
    const tools = bar.createDiv({ cls: "qt-exam-tools" });
    const flagBtn = tools.createEl("button", { cls: "qt-icon-btn qt-m-flag", attr: { "aria-label": r.flagged ? "Unflag this question" : "Flag this question" } });
    const paintFlag = () => {
      flagBtn.empty();
      setIcon(flagBtn, r.flagged ? "bookmark-check" : "bookmark");
      flagBtn.toggleClass("is-on", !!r.flagged);
      flagBtn.setAttr("aria-label", r.flagged ? "Unflag this question" : "Flag this question");
    };
    paintFlag();
    flagBtn.addEventListener("click", async () => {
      r.flagged = await p.toggleFlag(r.file);
      paintFlag();
    });
    const moreBtn = tools.createEl("button", {
      cls: "qt-icon-btn qt-m-more",
      attr: { "aria-label": "More actions", "aria-haspopup": "dialog" },
    });
    setIcon(moreBtn, "more-horizontal");

    // ---- Review | Passage tabs, with the review as the only scroller
    const tabs = hasStim ? root.createDiv({ cls: "qt-m-tabs", attr: { role: "tablist" } }) : null;
    const split = root.createDiv({ cls: `qt-split${hasStim ? "" : " is-single"} qt-m-split` });
    const left = hasStim ? split.createDiv({ cls: "qt-pane qt-pane-left qt-m-passage" }) : null;
    const right = split.createDiv({ cls: "qt-pane qt-pane-right qt-m-question" });
    const body = right.createDiv({ cls: "qt-m-scroll qt-m-review-scroll" });
    if (tabs && left) {
      const tabButtons = [];
      const show = (which) => {
        this.mobileResultTab = which;
        left.toggleClass("is-hidden", which !== "passage");
        right.toggleClass("is-hidden", which !== "review");
        for (const [btn, id] of tabButtons) {
          btn.toggleClass("is-active", id === which);
          btn.setAttr("aria-selected", String(id === which));
        }
      };
      for (const [id, label] of [["review", "Review"], ["passage", "Passage"]]) {
        const btn = tabs.createEl("button", { cls: "qt-m-tab", text: label, attr: { role: "tab" } });
        btn.addEventListener("click", () => show(id));
        tabButtons.push([btn, id]);
      }
      show(this.mobileResultTab === "passage" ? "passage" : "review");
    }
    if (left) this.md(r.sections.stimulus, left.createDiv({ cls: "qt-stimulus" }), path);

    let lastTop = 0;
    body.addEventListener("scroll", (ev) => {
      const scroller = ev && ev.target;
      const top = scroller && typeof scroller.scrollTop === "number" ? scroller.scrollTop : 0;
      bar.toggleClass("is-hidden", top > 24 && top > lastTop);
      lastTop = top;
    });

    // ---- review actions live in the bottom bar and the More sheet
    const doDone = async () => {
      await this.flushNotes();
      this.state = "idle";
      this.render();
    };
    const backdrop = root.createDiv({ cls: "qt-m-sheet-backdrop" });
    const sheet = root.createDiv({ cls: "qt-m-sheet", attr: { role: "dialog", "aria-label": "Review actions", "aria-modal": "true" } });
    const closeSheet = () => {
      sheet.removeClass("is-open");
      backdrop.removeClass("is-open");
    };
    const add = (label, fn, cls) => {
      const b = sheet.createEl("button", { text: label, cls: cls || "" });
      b.addEventListener("click", async () => {
        closeSheet();
        await fn();
      });
    };
    sheet.createDiv({ cls: "qt-m-sheet-title", text: "Review actions" });
    add("Open question note", () => this.app.workspace.getLeaf("tab").openFile(r.file));
    add(`Known ${p.knownDaysForFile(r.file)}d`, () => this.setCurrentStudyStatus("known"));
    add("Exclude", () => this.setCurrentStudyStatus("excluded"), "qt-status-exclude");
    const close = sheet.createEl("button", { text: "Close", cls: "qt-m-sheet-close" });
    close.addEventListener("click", closeSheet);
    backdrop.addEventListener("click", closeSheet);
    moreBtn.addEventListener("click", () => {
      const open = sheet.hasClass("is-open");
      sheet.toggleClass("is-open", !open);
      backdrop.toggleClass("is-open", !open);
    });

    const actionBar = right.createDiv({ cls: "qt-m-reviewbar" });
    const doneBtn = actionBar.createEl("button", { text: "Done", cls: "qt-m-review-done" });
    doneBtn.addEventListener("click", doDone);
    const nextBtn = actionBar.createEl("button", {
      text: this.quickSession ? "Next quick question" : "Next question",
      cls: "mod-cta qt-m-review-next",
    });
    nextBtn.addEventListener("click", () => this.next());

    this.renderResultBody(body, { done: false });
  }
}

module.exports = {
  PracticeView,
};
