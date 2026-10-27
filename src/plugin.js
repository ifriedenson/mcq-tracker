"use strict";
const { Notice, Platform, Plugin, TFolder } = require("obsidian");
const { OpenCodeManager } = require("./opencode-manager");
const { DEFAULT_SETTINGS, FILTER_FIELDS, FOLDER_AUTO_MAX, VIEW_TYPE } = require("./constants");
const { PracticeView } = require("./practice-view");
const { InsightsView, VIEW_TYPE_INSIGHTS } = require("./insights-view");
const { TestView, VIEW_TYPE_TEST } = require("./exam-view");
const { ConfirmModal, FindQuestionModal, QuestionFolderModal } = require("./modals");
const { cloneFilters, fvals, hasFilters, matchSets, renameFolderInSettings } = require("./filters");
const { QuestionTrackerSettingTab } = require("./settings-tab");
const { OpenCodeClient } = require("./opencode-client");
const { sleep } = require("./util");
const { PdfImportModal } = require("./import-modal");
const { applyAttempt, fillDefaults, replaceMyNotes, setLastErrorType } = require("./notes");

class QuestionTrackerPlugin extends Plugin {
  async onload() {
    await this.loadSettings();

    // The timer is kept per device (not in the synced settings). One that was running when the
    // app closed becomes paused, counting only up to the last heartbeat (time away isn't counted).
    this.session = this.readSession();
    const s = this.session;
    if (s && s.runningSince) {
      s.elapsedMs += Math.max(0, (s.lastBeat || s.runningSince) - s.runningSince);
      s.runningSince = null;
      this.writeSession();
    }

    this.manager = new OpenCodeManager(this);
    this.app.workspace.onLayoutReady(() => {
      const ai = this.settings.ai;
      if (Platform.isDesktopApp && ai.enabled && ai.managed && ai.preStart && this.backend() === "opencode") {
        this.manager.ensure(() => {}).catch(() => {}); // quiet: errors show when you actually use the chat
      }
    });
    this.registerDomEvent(window, "beforeunload", () => this.manager.stop());
    this.registerView(VIEW_TYPE, (leaf) => new PracticeView(leaf, this));
    this.registerView(VIEW_TYPE_INSIGHTS, (leaf) => new InsightsView(leaf, this));
    this.registerView(VIEW_TYPE_TEST, (leaf) => new TestView(leaf, this));
    this.addRibbonIcon("graduation-cap", "Open practice view", () => this.activateView());

    this.addCommand({ id: "open-practice-view", name: "Open practice view", callback: () => this.activateView() });
    this.addCommand({ id: "import-pdf", name: "Import questions from a PDF", callback: () => this.openPdfImport() });
    this.addCommand({
      id: "practice-folder",
      name: "Practice a folder...",
      callback: () => new QuestionFolderModal(this.app, this, (f) => this.practiceFolder(f)).open(),
    });
    this.addCommand({
      id: "practice-current-folder",
      name: "Practice the folder of this note",
      checkCallback: (checking) => {
        const f = this.app.workspace.getActiveFile();
        const dir = f && f.parent ? f.parent.path : "";
        if (!dir || !this.folderHasQuestions(dir)) return false;
        if (!checking) this.practiceFolder(dir);
        return true;
      },
    });
    this.addCommand({ id: "timed-test", name: "Start a timed test", callback: () => this.activateTest() });
    this.addCommand({ id: "weak-spots", name: "Show weak spots", callback: () => this.activateInsights("weak") });
    this.addCommand({ id: "error-log", name: "Show error log", callback: () => this.activateInsights("errors") });
    this.addCommand({ id: "find-question", name: "Find a question by ID", callback: () => new FindQuestionModal(this.app, this).open() });
    this.addCommand({
      id: "rename-source-id",
      name: "Rename old source_question_id properties to official_question_id",
      callback: () => this.migrateOfficialIds(),
    });

    // right-click a folder in the file explorer
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (!(file instanceof TFolder) || !this.folderHasQuestions(file.path)) return;
        menu.addItem((item) =>
          item
            .setTitle("Practice this folder")
            .setIcon("graduation-cap")
            .onClick(() => this.practiceFolder(file.path))
        );
      })
    );
    // keep saved filters and presets pointing at a folder that was renamed or moved
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        if (!(file instanceof TFolder)) return;
        if (renameFolderInSettings(this.settings, oldPath, file.path)) {
          this.save();
          this.refreshViews();
        }
      })
    );
    this.addCommand({
      id: "open-ai-assistant",
      name: "Open AI assistant (OpenCode)",
      callback: async () => {
        const view = await this.activateView();
        if (view && view.render) {
          view.state = "chat";
          view.render();
        }
      },
    });
    this.addCommand({
      id: "next-question",
      name: "Next question (from current filters)",
      callback: async () => {
        const view = await this.activateView();
        if (view && view.next) await view.next();
      },
    });
    this.addCommand({
      id: "toggle-flag",
      name: "Toggle flag on this question",
      checkCallback: (checking) => {
        const f = this.app.workspace.getActiveFile();
        const fm = f && this.app.metadataCache.getFileCache(f)?.frontmatter;
        if (!fm || !fm.question_id) return false;
        if (!checking) this.toggleFlag(f).then((v) => new Notice(v ? "Flagged" : "Unflagged"));
        return true;
      },
    });
    this.addCommand({
      id: "add-fields-this-note",
      name: "Add missing tracking properties to this note",
      checkCallback: (checking) => {
        const f = this.app.workspace.getActiveFile();
        if (!f) return false;
        if (!checking) this.addMissingFields([f]);
        return true;
      },
    });
    this.addCommand({
      id: "add-fields-all",
      name: "Add missing tracking properties to all question notes",
      callback: () => this.addMissingFields(this.getQuestions().map((q) => q.file)),
    });

    this.addSettingTab(new QuestionTrackerSettingTab(this.app, this));

    this.registerInterval(
      activeWindow.setInterval(() => {
        const ses = this.session;
        if (ses && ses.runningSince) {
          ses.lastBeat = Date.now();
          this.writeSession();
        }
      }, 10000)
    );

    this.registerDomEvent(activeDocument, "visibilitychange", () => {
      if (activeDocument.hidden && Platform.isMobile && this.settings.autoPauseOnMobile && this.isRunning()) {
        this.pauseSession();
        this.refreshViews();
      }
    });
  }

  /* ---- settings */

  async loadSettings() {
    const saved = (await this.loadData()) || {};
    this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);
    delete this.settings.session; // older versions stored the timer here; it is per-device now
    this.settings.filters = cloneFilters(saved.filters);
    this.settings.moreSets = Array.isArray(saved.moreSets) ? saved.moreSets.map(cloneFilters) : [];
    this.settings.presets = (Array.isArray(saved.presets) ? saved.presets : []).map((pr) =>
      Object.assign({}, pr, { filters: cloneFilters(pr.filters), moreSets: Array.isArray(pr.moreSets) ? pr.moreSets.map(cloneFilters) : [] })
    );
    this.settings.ai = Object.assign({}, DEFAULT_SETTINGS.ai, saved.ai || {});
    const sa = (saved.ai && saved.ai.api) || {};
    this.settings.ai.api = Object.assign({}, DEFAULT_SETTINGS.ai.api, sa, { keys: Object.assign({}, sa.keys) });
    // 0.2.0 saved settings had no `managed` flag: move those users to the automatic setup.
    if (saved.explanationDefault === undefined && saved.showRationale === false) this.settings.explanationDefault = "hide";
    delete this.settings.showRationale;
    if (!["show", "wrong", "hide"].includes(this.settings.explanationDefault)) this.settings.explanationDefault = "wrong";
    this.settings.testDefaults = Object.assign({}, DEFAULT_SETTINGS.testDefaults, saved.testDefaults || {});
    if (!["auto", "buttons", "search"].includes(this.settings.folderFilterStyle)) this.settings.folderFilterStyle = "auto";
    for (const k of ["intervals", "errorTypes", "confidenceLabels"]) {
      if (!Array.isArray(this.settings[k]) || !this.settings[k].length) this.settings[k] = DEFAULT_SETTINGS[k].slice();
    }
  }

  save() {
    return this.saveData(this.settings);
  }

  /** Phones always use the direct API (OpenCode can't run there); desktop follows the setting. */
  backend() {
    return Platform.isMobile || this.settings.ai.backend === "api" ? "api" : "opencode";
  }

  /** Connection details: the managed local server if running, otherwise the manual settings. */
  conn() {
    const ai = this.settings.ai;
    if (ai.managed && this.manager.conn) return this.manager.conn;
    return { url: ai.url, username: ai.username, password: ai.password };
  }

  openCode() {
    return new OpenCodeClient(this.conn());
  }

  vaultPath() {
    try {
      return (this.app.vault.adapter && this.app.vault.adapter.basePath) || "";
    } catch (e) {
      return "";
    }
  }

  askConfirm(title, body, okText) {
    return new Promise((resolve) => new ConfirmModal(this.app, title, body, okText, resolve).open());
  }

  async ensureOpenCode(progress) {
    const note = new Notice("Setting up OpenCode...", 0);
    const say = (m) => {
      note.setMessage(m);
      if (progress) progress(m);
    };
    try {
      await this.manager.ensure(say);
    } finally {
      note.hide();
    }
  }

  /** Whether the folder filter shows a search box (true) or one button per folder (false). */
  folderSearchOn(nFolders) {
    const style = this.settings.folderFilterStyle;
    return style === "search" || (style === "auto" && nFolders > FOLDER_AUTO_MAX);
  }

  folderHasQuestions(path) {
    const pre = path + "/";
    return this.getQuestions().some((q) => q.file.path.startsWith(pre));
  }

  /** Opens the practice view with these filters and starts the first question. */
  async practiceWith(filters, mode) {
    const st = this.settings;
    st.filters = cloneFilters(filters);
    st.moreSets = [];
    st.activePreset = "";
    if (mode) st.mode = mode;
    await this.save();
    const view = await this.activateView();
    if (!view) return;
    view.filtersOpen = true;
    if (view.next) await view.next();
    else this.refreshViews();
  }

  /** Practice every note in a folder and its sub folders. `expected` waits for freshly written notes to be indexed. */
  async practiceFolder(folder, expected) {
    const inFolder = () => this.getQuestions().filter((q) => q.file.path.startsWith(folder + "/")).length;
    for (let i = 0; expected && i < 20 && inFolder() < expected; i++) await sleep(250);
    if (!inFolder()) {
      new Notice("No question notes in that folder yet.");
      return;
    }
    await this.practiceWith({ folder: [folder] }, "smart"); // smart mix: every note is eligible, new ones come first
  }

  async activateInsights(tab) {
    const ws = this.app.workspace;
    let leaf = ws.getLeavesOfType(VIEW_TYPE_INSIGHTS)[0];
    if (!leaf) {
      leaf = ws.getLeaf(Platform.isMobile ? true : "tab");
      await leaf.setViewState({ type: VIEW_TYPE_INSIGHTS, active: true });
    }
    if (leaf.loadIfDeferred) await leaf.loadIfDeferred();
    await ws.revealLeaf(leaf);
    if (leaf.view && leaf.view.render) {
      if (tab) leaf.view.tab = tab;
      leaf.view.render();
    }
  }

  async activateTest() {
    const ws = this.app.workspace;
    let leaf = ws.getLeavesOfType(VIEW_TYPE_TEST)[0];
    if (!leaf) {
      leaf = ws.getLeaf(Platform.isMobile ? true : "tab");
      await leaf.setViewState({ type: VIEW_TYPE_TEST, active: true });
    }
    if (leaf.loadIfDeferred) await leaf.loadIfDeferred();
    await ws.revealLeaf(leaf);
  }

  /** One-time: notes imported before the rename have source_question_id. */
  async migrateOfficialIds() {
    let n = 0;
    for (const q of this.getQuestions()) {
      if (!q.fm.source_question_id) continue;
      await this.app.fileManager.processFrontMatter(q.file, (fm) => {
        if (!fm.source_question_id) return;
        if (!fm.official_question_id) fm.official_question_id = fm.source_question_id;
        delete fm.source_question_id;
        n++;
      });
    }
    new Notice(n ? `Renamed the property on ${n} note${n === 1 ? "" : "s"}.` : "No notes use source_question_id.");
  }

  openPdfImport() {
    if (!this.settings.ai.enabled) {
      new Notice("Turn on AI features in the plugin settings to import from a PDF.");
      return;
    }
    new PdfImportModal(this.app, this).open();
  }

  onunload() {
    if (this.manager) this.manager.stop();
  }

  /* ---- views */

  async activateView() {
    const ws = this.app.workspace;
    let leaf = ws.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = ws.getLeaf(Platform.isMobile ? true : "tab");
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    if (leaf.loadIfDeferred) await leaf.loadIfDeferred();
    await ws.revealLeaf(leaf);
    return leaf.view;
  }

  refreshViews() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      if (leaf.view && leaf.view.render) leaf.view.render();
    }
  }

  /* ---- questions */

  getQuestions() {
    const folder = this.settings.questionFolder.trim().replace(/^\/+|\/+$/g, "");
    const out = [];
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (folder && file.path !== folder && !file.path.startsWith(folder + "/")) continue;
      const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
      if (fm && fm.question_id !== undefined && fm.question_id !== null && fm.question_id !== "") {
        out.push({ file, fm });
      }
    }
    return out;
  }

  filtered(questions) {
    return questions.filter((q) => matchSets(q.fm, [this.settings.filters, ...(this.settings.moreSets || [])], q.file.path));
  }

  /* ---- presets */

  applyPreset(id) {
    const st = this.settings;
    if (!id) {
      st.activePreset = "";
    } else {
      const pr = st.presets.find((x) => x.id === id);
      if (pr) {
        st.filters = cloneFilters(pr.filters);
        st.moreSets = (pr.moreSets || []).map(cloneFilters);
        st.mode = pr.mode || "smart";
        st.activePreset = id;
      }
    }
    this.save();
  }

  savePreset(name) {
    const st = this.settings;
    const id = "p" + Date.now().toString(36);
    st.presets.push({ id, name, filters: cloneFilters(st.filters), moreSets: (st.moreSets || []).map(cloneFilters), mode: st.mode });
    st.activePreset = id;
    this.save();
  }

  updatePreset() {
    const st = this.settings;
    const pr = st.presets.find((x) => x.id === st.activePreset);
    if (!pr) return;
    pr.filters = cloneFilters(st.filters);
    pr.moreSets = (st.moreSets || []).map(cloneFilters);
    pr.mode = st.mode;
    this.save();
  }

  deletePreset() {
    const st = this.settings;
    st.presets = st.presets.filter((x) => x.id !== st.activePreset);
    st.activePreset = "";
    this.save();
  }

  isModified() {
    const st = this.settings;
    const pr = st.presets.find((x) => x.id === st.activePreset);
    if (!pr) return false;
    const norm1 = (o) => JSON.stringify(FILTER_FIELDS.map(([k]) => [k, fvals(o, k).sort()]).filter((x) => x[1].length));
    const norm = (main, more) => JSON.stringify([main, ...(more || [])].filter(hasFilters).map(norm1).sort());
    return norm(pr.filters, pr.moreSets) !== norm(st.filters, st.moreSets) || (pr.mode || "smart") !== st.mode;
  }

  /* ---- timer (survives reloads) */

  sessionKey() {
    return "question-tracker-session";
  }
  readSession() {
    try {
      const s = this.app.loadLocalStorage(this.sessionKey());
      return s && typeof s.path === "string" && typeof s.elapsedMs === "number" ? s : null;
    } catch (e) {
      return null;
    }
  }
  writeSession() {
    try {
      this.app.saveLocalStorage(this.sessionKey(), this.session || null);
    } catch (e) {
      /* storage unavailable: the timer still works, it just won't survive a reload */
    }
  }
  startSession(path) {
    this.session = { path, elapsedMs: 0, runningSince: Date.now(), lastBeat: Date.now() };
    this.writeSession();
  }
  isRunning() {
    const s = this.session;
    return !!(s && s.runningSince);
  }
  elapsedMs() {
    const s = this.session;
    if (!s) return 0;
    return s.elapsedMs + (s.runningSince ? Date.now() - s.runningSince : 0);
  }
  pauseSession() {
    const s = this.session;
    if (!s || !s.runningSince) return;
    s.elapsedMs += Date.now() - s.runningSince;
    s.runningSince = null;
    this.writeSession();
  }
  resumeSession() {
    const s = this.session;
    if (!s || s.runningSince) return;
    s.runningSince = Date.now();
    s.lastBeat = Date.now();
    this.writeSession();
  }
  clearSession() {
    this.session = null;
    this.writeSession();
  }

  /* ---- writing to notes */

  async recordAttempt(file, a) {
    let summary;
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      summary = applyAttempt(fm, a, this.settings.intervals);
    });
    return summary;
  }

  async setErrorType(file, type) {
    await this.app.fileManager.processFrontMatter(file, (fm) => setLastErrorType(fm, type));
  }

  async toggleFlag(file) {
    let now = false;
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      fm.flagged = fm.flagged !== true;
      now = fm.flagged;
    });
    return now;
  }

  async saveMyNotes(file, text) {
    await this.app.vault.process(file, (data) => replaceMyNotes(data, text));
  }

  async addMissingFields(files) {
    let touched = 0;
    for (const f of files) {
      let n = 0;
      await this.app.fileManager.processFrontMatter(f, (fm) => {
        n = fillDefaults(fm);
      });
      if (n) touched++;
    }
    new Notice(`Added missing properties to ${touched} note${touched === 1 ? "" : "s"}.`);
  }
}

module.exports = {
  QuestionTrackerPlugin,
};
