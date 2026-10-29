"use strict";
const { Notice, Platform, Plugin, TFile, TFolder, requestUrl } = require("obsidian");
const { OpenCodeManager } = require("./opencode-manager");
const { DEFAULT_SETTINGS, FILTER_FIELDS, FOLDER_AUTO_MAX, VIEW_TYPE, VIEW_TYPE_TODAY, VIEW_TYPE_CALENDAR } = require("./constants");
const { PracticeView } = require("./practice-view");
const { InsightsView, VIEW_TYPE_INSIGHTS } = require("./insights-view");
const { TestView, VIEW_TYPE_TEST } = require("./exam-view");
const { TodayView } = require("./today-view");
const { ConfirmModal, FindQuestionModal, QuestionFolderModal } = require("./modals");
const { cloneFilters, fvals, hasFilters, isDue, matchSets, renameFolderInSettings } = require("./filters");
const { QuestionTrackerSettingTab } = require("./settings-tab");
const { OpenCodeClient } = require("./opencode-client");
const { sleep, hashString, localDate } = require("./util");
const { PdfImportModal } = require("./import-modal");
const { applyAttempt, fillDefaults, replaceMyNotes, setLastErrorType } = require("./notes");
const { CalendarImportModal, CalendarView, StudySlotModal, applyCalendarWidth, parseScheduleBlock, renderDaySection } = require("./calendar-view");
const { cleanSubjectTitle, mergeCalendarSettings, nextClassStatus, subjectKey, visibleEvents } = require("./calendar-model");
const { dateKey, deriveSourceLabel, expandIcs, exportIcs, icsLooksValid, normalizeCalendarUrl, parseIcs } = require("./calendar-ics");
const { classNoteIndex, findClassNote, openOrCreateClassNote, vaultFolders } = require("./calendar-notes");
const { cloneFrontmatter, enqueuePending, newAttemptId, packPendingAttempts, removePending, unpackAttempt, unpackPendingAttempts, updatePendingError } = require("./offline");

class QuestionTrackerPlugin extends Plugin {
  async onload() {
    await this.loadSettings();
    this._calendarNoteIndex = null;
    this._calendarFolders = null;
    this._calendarCache = null;
    // Calendar notes are resolved by their durable UID/date properties, so any
    // create/delete/rename (or frontmatter edit) invalidates the shared index.
    const invalidateNotes = () => this.invalidateCalendarNotes();
    this.registerEvent(this.app.vault.on("create", invalidateNotes));
    this.registerEvent(this.app.vault.on("delete", invalidateNotes));
    this.registerEvent(this.app.vault.on("rename", invalidateNotes));
    this.registerEvent(this.app.metadataCache.on("changed", invalidateNotes));

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
      if (this.settings.openPracticeOnStartUp && this.mcqEnabled()) this.activateView().catch(() => {});
      this.flushPendingAttempts().then((r) => {
        if (r.sent) new Notice(`Saved ${r.sent} practice result${r.sent === 1 ? "" : "s"} that were waiting offline.`, 5000);
      }).catch(() => {});
    });
    this.registerDomEvent(window, "beforeunload", () => this.manager.stop());
    this.registerView(VIEW_TYPE, (leaf) => new PracticeView(leaf, this));
    this.registerView(VIEW_TYPE_TODAY, (leaf) => new TodayView(leaf, this));
    this.registerView(VIEW_TYPE_INSIGHTS, (leaf) => new InsightsView(leaf, this));
    this.registerView(VIEW_TYPE_TEST, (leaf) => new TestView(leaf, this));
    this.registerView(VIEW_TYPE_CALENDAR, (leaf) => new CalendarView(leaf, this));
    this.ribbonButtons = {};
    this.ribbonAdded = {};
    this.refreshRibbon();

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
    this.addCommand({ id: "open-today", name: "Open Today", callback: () => this.activateToday() });
    this.addCommand({ id: "quick-practice", name: "Quick Practice", callback: () => this.activateQuickPractice() });
    this.addCommand({
      id: "retry-pending-attempts",
      name: "Retry saving offline practice results",
      callback: async () => {
        const r = await this.flushPendingAttempts();
        if (r.remaining) new Notice(`${r.remaining} result${r.remaining === 1 ? "" : "s"} still waiting for the vault to be writable.`, 6000);
        else if (r.sent) new Notice(`Saved ${r.sent} offline result${r.sent === 1 ? "" : "s"}.`, 5000);
        else new Notice("No offline practice results are waiting.");
      },
    });
    this.addCommand({ id: "open-calendar", name: "Open calendar", callback: () => this.activateCalendar() });
    this.addCommand({ id: "calendar-add-schedule", name: "Calendar: add an .ics schedule", callback: () => this.openCalendarImport() });
    this.addCommand({
      id: "calendar-note-next-class",
      name: "Calendar: create or open the note for the next class",
      callback: () => this.openNextClassNote(),
    });
    this.addCommand({ id: "calendar-export", name: "Calendar: export the visible schedule to .ics", callback: () => this.exportCalendarIcs() });

    // Embeds: `uni-schedule` and `uni-calendar` are the block names existing University
    // Schedule and Calendar notes use, so those keep working. If that plugin is enabled
    // it owns those names, and our own `mcq-schedule` block is always available.
    const renderBlock = (source, el) => this.renderScheduleBlock(source, el);
    if (!this.otherCalendarPluginActive()) {
      this.registerMarkdownCodeBlockProcessor("uni-schedule", renderBlock);
      this.registerMarkdownCodeBlockProcessor("uni-calendar", renderBlock);
    }
    this.registerMarkdownCodeBlockProcessor("mcq-schedule", renderBlock);
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

    // A vault can be temporarily unwritable (sync lock, removable drive, mobile
    // storage). Retry the local outbox periodically and as soon as we are online.
    this.registerInterval(activeWindow.setInterval(() => this.flushPendingAttempts().catch(() => {}), 60000));
    this.registerDomEvent(window, "online", () => this.flushPendingAttempts().catch(() => {}));

    this.registerDomEvent(activeDocument, "visibilitychange", () => {
      if (activeDocument.hidden && Platform.isMobile && this.settings.autoPauseOnMobile && this.isRunning()) {
        this.pauseSession();
        for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
          if (leaf.view && leaf.view.pauseQuick) leaf.view.pauseQuick();
        }
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
    this.settings.quickDefaults = Object.assign({}, DEFAULT_SETTINGS.quickDefaults, saved.quickDefaults || {});
    this.settings.quickSession = saved.quickSession && typeof saved.quickSession === "object" ? saved.quickSession : null;
    this.settings.calendar = mergeCalendarSettings(saved.calendar);
    // module switches and plugin-wide flags are always plain booleans
    this.settings.mcqEnabled = this.settings.mcqEnabled !== false;
    this.settings.showRibbonIcons = this.settings.showRibbonIcons !== false;
    this.settings.openPracticeOnStartUp = this.settings.openPracticeOnStartUp === true;
    if (!["auto", "buttons", "search"].includes(this.settings.folderFilterStyle)) this.settings.folderFilterStyle = "auto";
    if (!["ladder", "fsrs"].includes(this.settings.scheduler)) this.settings.scheduler = "ladder";
    const retention = Number(this.settings.fsrsRetention);
    this.settings.fsrsRetention = Number.isFinite(retention) ? Math.min(0.95, Math.max(0.85, retention)) : 0.9;
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
    if (this.moduleOff("mcq")) return;
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
    if (this.moduleOff("mcq")) return;
    const ws = this.app.workspace;
    let leaf = ws.getLeavesOfType(VIEW_TYPE_TEST)[0];
    if (!leaf) {
      leaf = ws.getLeaf(Platform.isMobile ? true : "tab");
      await leaf.setViewState({ type: VIEW_TYPE_TEST, active: true });
    }
    if (leaf.loadIfDeferred) await leaf.loadIfDeferred();
    await ws.revealLeaf(leaf);
  }

  async activateQuickPractice() {
    const view = await this.activateView();
    if (view && view.startQuickSetup) view.startQuickSetup();
    return view;
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

  /** Opens this plugin's page in Obsidian's settings (the settings window has no public API, so this is best effort). */
  openSettings() {
    const setting = this.app.setting;
    if (setting && setting.open) {
      setting.open();
      if (setting.openTabById) setting.openTabById(this.manifest.id);
    } else {
      new Notice("Open Settings, then MCQ Tracker, to continue.");
    }
  }

  openPdfImport() {
    if (this.moduleOff("mcq")) return;
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
    if (this.moduleOff("mcq")) return null;
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

  async activateToday() {
    if (this.moduleOff("mcq")) return null;
    const ws = this.app.workspace;
    let leaf = ws.getLeavesOfType(VIEW_TYPE_TODAY)[0];
    if (!leaf) {
      leaf = ws.getLeaf(Platform.isMobile ? true : "tab");
      await leaf.setViewState({ type: VIEW_TYPE_TODAY, active: true });
    }
    if (leaf.loadIfDeferred) await leaf.loadIfDeferred();
    await ws.revealLeaf(leaf);
    if (leaf.view && leaf.view.render) leaf.view.render();
    return leaf.view;
  }

  refreshViews() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      if (leaf.view && leaf.view.render) leaf.view.render();
    }
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_TODAY)) {
      if (leaf.view && leaf.view.render) leaf.view.render();
    }
  }

  /** Re-draws only the practice views that are showing the first-run screen (an import just finished). */
  refreshEmptyViews() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      if (leaf.view && leaf.view.emptyShown && leaf.view.render) leaf.view.render();
    }
  }

  /* ---- calendar (off by default) */

  calendarEnabled() {
    return !!(this.settings.calendar && this.settings.calendar.enabled);
  }

  calendarSettings() {
    return this.settings.calendar;
  }

  calendarSources() {
    return (this.settings.calendar.sources || []).slice();
  }

  /** University Schedule and Calendar owns the `uni-schedule` block when it is enabled. */
  otherCalendarPluginActive() {
    try {
      const plugins = this.app.plugins;
      if (!plugins) return false;
      if (plugins.enabledPlugins && typeof plugins.enabledPlugins.has === "function") return plugins.enabledPlugins.has("university-calendar");
      return !!(plugins.plugins && plugins.plugins["university-calendar"]);
    } catch (e) {
      return false;
    }
  }

  /* ---- modules and the ribbon */

  /** The MCQ Tracker module (practice, weak spots, timed tests, import) is on unless it was turned off. */
  mcqEnabled() {
    return this.settings.mcqEnabled !== false;
  }

  /** Adds one module's ribbon button, once, if ribbon buttons are on. */
  addModuleRibbon(id, icon, title, onClick) {
    if (!this.ribbonAdded) this.ribbonAdded = {};
    if (!this.ribbonButtons) this.ribbonButtons = {};
    if (this.ribbonAdded[id] || !this.settings.showRibbonIcons) return;
    this.ribbonAdded[id] = true;
    this.ribbonButtons[id] = this.addRibbonIcon(icon, title, onClick) || null;
  }

  removeModuleRibbon(id) {
    const el = this.ribbonButtons && this.ribbonButtons[id];
    if (el && typeof el.remove === "function") el.remove();
    if (this.ribbonButtons) delete this.ribbonButtons[id];
    if (this.ribbonAdded) delete this.ribbonAdded[id];
  }

  /** Shows exactly the ribbon buttons the modules that are on call for. */
  refreshRibbon() {
    if (this.mcqEnabled()) {
      this.addModuleRibbon("today", "sun", "Open today", () => this.activateToday());
      this.addModuleRibbon("mcq", "graduation-cap", "Open practice view", () => this.activateView());
    } else {
      this.removeModuleRibbon("today");
      this.removeModuleRibbon("mcq");
    }
    if (this.calendarEnabled()) this.addModuleRibbon("calendar", "calendar-days", "Open calendar", () => this.activateCalendar());
    else this.removeModuleRibbon("calendar");
  }

  setupCalendarRibbon() {
    this.refreshRibbon();
  }

  /** Says a module is off and points at settings. True when it is off, so callers can stop. */
  moduleOff(id) {
    if (id === "calendar" ? this.calendarEnabled() : this.mcqEnabled()) return false;
    new Notice(
      id === "calendar"
        ? "The calendar module is off. Turn it on in Settings, Global."
        : "The MCQ Tracker module is off. Turn it on in Settings, Global."
    );
    this.openSettings();
    return true;
  }

  /** Closes a module's open tabs when it is turned off (restored tabs would be stale). */
  detachModuleLeaves(types) {
    const ws = this.app.workspace;
    if (typeof ws.detachLeavesOfType !== "function") return;
    for (const type of types) ws.detachLeavesOfType(type);
  }

  async onMcqToggled() {
    this.refreshRibbon();
    if (!this.mcqEnabled()) {
      this.detachModuleLeaves([VIEW_TYPE, VIEW_TYPE_TODAY, VIEW_TYPE_INSIGHTS, VIEW_TYPE_TEST]);
      this.pauseSession();
      return;
    }
    this.refreshViews();
  }

  async onCalendarToggled() {
    this.invalidateCalendar();
    this.refreshRibbon();
    if (!this.calendarEnabled()) {
      this.detachModuleLeaves([VIEW_TYPE_CALENDAR]);
      return;
    }
    await this.refreshCalendarFileSources();
    this.refreshCalendarViews();
  }

  onGlobalSettingsChanged() {
    this.refreshRibbon();
    this.refreshViews();
  }

  /** One month back, six months forward: enough for a semester and a month grid. */
  calendarWindow(now) {
    const at = now || new Date();
    return { start: new Date(at.getFullYear(), at.getMonth() - 1, 1), end: new Date(at.getFullYear(), at.getMonth() + 6, 0, 23, 59, 59) };
  }

  invalidateCalendar() {
    this._calendarCache = null;
  }

  /** Cached index of class notes by `calendar_uid|calendar_date`. */
  calendarNoteIndex() {
    if (!this._calendarNoteIndex) this._calendarNoteIndex = classNoteIndex(this.app);
    return this._calendarNoteIndex;
  }

  /** Cached folder list for resolving class-note paths without scanning on every card. */
  calendarFolders() {
    if (!this._calendarFolders) this._calendarFolders = vaultFolders(this.app);
    return this._calendarFolders;
  }

  invalidateCalendarNotes() {
    this._calendarNoteIndex = null;
    this._calendarFolders = null;
  }

  /** Finds the existing note for a class occurrence, if there is one. */
  findCalendarNote(event, key) {
    return findClassNote(
      this.app,
      this.calendarSettings(),
      event,
      key || event.dateKey,
      this.calendarNoteIndex(),
      this.calendarFolders()
    );
  }

  /** Parses every shown source. Cached by a content hash so any edit invalidates it. */
  calendarEvents(now) {
    const range = this.calendarWindow(now);
    const sources = this.calendarSources().filter((s) => !s.hidden && s.content);
    const signature = `${dateKey(range.start)}|${dateKey(range.end)}|${sources.map((s) => `${s.id}:${hashString(s.content)}`).join("|")}`;
    if (this._calendarCache && this._calendarCache.signature === signature) return this._calendarCache.events;
    const all = [];
    const errors = [];
    for (const source of sources) {
      try {
        const expanded = expandIcs(parseIcs(source.content), range.start, range.end);
        for (const event of expanded) all.push(Object.assign(event, { sourceId: source.id, sourceName: source.name }));
      } catch (e) {
        errors.push(`${source.name}: ${e.message}`);
      }
    }
    const events = visibleEvents(this.calendarSettings(), all);
    this._calendarCache = { signature, events };
    this._calendarErrors = errors;
    return events;
  }

  /** Re-reads .ics files from the vault so edits and re-downloads show up. */
  async refreshCalendarFileSources() {
    let changed = false;
    for (const source of this.settings.calendar.sources || []) {
      if (source.type !== "file" || !source.path) continue;
      const file = this.app.vault.getAbstractFileByPath(source.path);
      if (!file) continue;
      try {
        const text = await this.app.vault.cachedRead(file);
        if (text !== source.content) {
          source.content = text;
          changed = true;
        }
      } catch (e) {
        /* keep the cached copy */
      }
    }
    if (changed) {
      this.invalidateCalendar();
      await this.save();
    }
    return changed;
  }

  async addCalendarFileSource(path) {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!file) throw new Error("That file is not in the vault.");
    const text = await this.app.vault.cachedRead(file);
    if (!icsLooksValid(text)) throw new Error("That file is not an iCalendar (.ics) file.");
    const cal = this.settings.calendar;
    const name = file.name || file.basename || path;
    const existing = cal.sources.find((s) => s.type === "file" && s.path === path);
    if (existing) {
      existing.content = text;
      existing.lastSync = Date.now();
    } else {
      cal.sources.push({ id: `f${Date.now().toString(36)}`, name, type: "file", path, url: "", content: text, hidden: false, lastSync: Date.now() });
    }
    this.invalidateCalendar();
    await this.save();
    this.refreshCalendarViews();
    new Notice(`Added ${name}.`);
  }

  async addCalendarUrlSource(rawUrl) {
    const url = normalizeCalendarUrl(rawUrl);
    if (!/^https?:\/\//i.test(url)) throw new Error("Enter an https:// or webcal:// calendar link.");
    const response = await requestUrl({ url, method: "GET" });
    const text = response && response.text;
    if (!icsLooksValid(text)) throw new Error("That address did not return an iCalendar feed.");
    const cal = this.settings.calendar;
    const name = deriveSourceLabel(url, text);
    const existing = cal.sources.find((s) => s.type === "url" && s.url === url);
    if (existing) {
      existing.content = text;
      existing.name = name;
      existing.lastSync = Date.now();
    } else {
      cal.sources.push({ id: `u${Date.now().toString(36)}`, name, type: "url", path: "", url, content: text, hidden: false, lastSync: Date.now() });
    }
    this.invalidateCalendar();
    await this.save();
    this.refreshCalendarViews();
    new Notice(`Added ${name}.`);
  }

  async syncCalendarSource(id) {
    const source = (this.settings.calendar.sources || []).find((s) => s.id === id);
    if (!source) return;
    if (source.type === "file") {
      await this.refreshCalendarFileSources();
      this.refreshCalendarViews();
      return;
    }
    const response = await requestUrl({ url: source.url, method: "GET" });
    if (!icsLooksValid(response && response.text)) throw new Error("That calendar did not return an iCalendar feed.");
    source.content = response.text;
    source.lastSync = Date.now();
    this.invalidateCalendar();
    await this.save();
    this.refreshCalendarViews();
  }

  async removeCalendarSource(id) {
    this.settings.calendar.sources = (this.settings.calendar.sources || []).filter((s) => s.id !== id);
    this.invalidateCalendar();
    await this.save();
    this.refreshCalendarViews();
  }

  refreshCalendarViews() {
    this.invalidateCalendar();
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR)) {
      if (leaf.view && leaf.view.render) leaf.view.render();
    }
  }

  async activateCalendar() {
    if (this.moduleOff("calendar")) return null;
    const ws = this.app.workspace;
    let leaf = ws.getLeavesOfType(VIEW_TYPE_CALENDAR)[0];
    if (!leaf) {
      leaf = ws.getLeaf(Platform.isMobile ? true : "tab");
      await leaf.setViewState({ type: VIEW_TYPE_CALENDAR, active: true });
    }
    if (leaf.loadIfDeferred) await leaf.loadIfDeferred();
    await ws.revealLeaf(leaf);
    if (leaf.view && leaf.view.render) leaf.view.render();
    return leaf.view;
  }

  openCalendarImport() {
    if (this.moduleOff("calendar")) return;
    new CalendarImportModal(this.app, this, () => this.refreshCalendarViews()).open();
  }

  /** `uni-schedule` / `mcq-schedule` block: the classes of one day. */
  renderScheduleBlock(source, el) {
    el.empty();
    if (!this.calendarEnabled()) {
      const empty = el.createDiv({ cls: "uni-empty-schedule" });
      empty.createDiv({ cls: "uni-empty-schedule-desc", text: "Calendar is off. Turn it on in Settings, Global." });
      return;
    }
    const { dateKey: key } = parseScheduleBlock(source, new Date());
    const box = el.createDiv({ cls: "uni-schedule-embed" });
    applyCalendarWidth(box, this.calendarSettings());
    renderDaySection(this, box, key);
  }

  async openNextClassNote() {
    if (this.moduleOff("calendar")) return;
    const status = nextClassStatus(this.calendarEvents(), new Date());
    if (!status.event) {
      new Notice("No class found in the calendar.");
      return;
    }
    await this.openClassNote(status.event, status.event.dateKey);
  }

  async openClassNote(event, key) {
    const result = await openOrCreateClassNote(
      this.app,
      this.calendarSettings(),
      event,
      key || event.dateKey,
      this.calendarNoteIndex(),
      this.calendarFolders()
    );
    this.invalidateCalendarNotes();
    const folder = result.path.includes("/") ? result.path.slice(0, result.path.lastIndexOf("/")) : "";
    if (folder && event.summary && this.settings.calendar.subjectFolders[event.summary] !== folder) {
      this.settings.calendar.subjectFolders[event.summary] = folder;
      await this.save();
    }
    if (result.created) new Notice(`Created ${result.path}.`);
    return result;
  }

  /** A free period from the calendar becomes a one-tap Quick Practice session. */
  openStudySlot(slots) {
    if (this.moduleOff("calendar")) return;
    const list = (Array.isArray(slots) ? slots : []).filter((slot) => slot && slot.minutes > 0);
    if (!list.length) {
      new Notice("There is no free period long enough for a study session.");
      return;
    }
    new StudySlotModal(this.app, this, list).open();
  }

  /** Pool for the study-slot chooser; filters are applied without changing saved settings. */
  quickPracticePool(filter, course) {
    const questions = this.getQuestions();
    if (filter === "due") return questions.filter((q) => isDue(q.fm, localDate()));
    if (filter === "course" && course) {
      const key = subjectKey(cleanSubjectTitle(course));
      return questions.filter((q) => {
        const values = [q.fm.course, q.fm.test].map((v) => subjectKey(cleanSubjectTitle(v)));
        return values.includes(key);
      });
    }
    return this.filtered(questions);
  }

  async startQuickPractice(options) {
    const opts = options || {};
    const view = await this.activateView();
    if (!view || !view.startQuick) {
      new Notice("Could not open the practice view.");
      return null;
    }
    const minutes = Math.max(1, Math.round(Number(opts.minutes) || 5));
    await view.startQuick("time", minutes, { pool: opts.pool, mode: opts.mode, label: opts.label });
    return view;
  }

  async exportCalendarIcs() {
    if (this.moduleOff("calendar")) return;
    const events = this.calendarEvents();
    if (!events.length) {
      new Notice("There are no visible classes or exams to export.");
      return;
    }
    const target = "schedule-export.ics";
    const text = exportIcs(events, { calendarName: "MCQ Tracker calendar", now: new Date() });
    const existing = this.app.vault.getAbstractFileByPath(target);
    if (existing instanceof TFile) await this.app.vault.modify(existing, text);
    else await this.app.vault.create(target, text);
    new Notice(`Exported ${events.length} events to ${target}.`);
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

  pendingKey() {
    return "question-tracker-pending-attempts";
  }

  readPendingAttempts() {
    if (Array.isArray(this._pendingAttempts)) return this._pendingAttempts;
    let list = [];
    try {
      list = unpackPendingAttempts(this.app.loadLocalStorage(this.pendingKey()));
    } catch (e) {
      list = [];
    }
    this._pendingAttempts = list;
    return list;
  }

  writePendingAttempts(list) {
    this._pendingAttempts = Array.isArray(list) ? list : [];
    try {
      this.app.saveLocalStorage(this.pendingKey(), packPendingAttempts(this._pendingAttempts));
    } catch (e) {
      // Keep the in-memory queue for this session even if device storage is unavailable.
    }
  }

  async recordAttempt(file, a) {
    const attempt = { ...a, attemptId: a.attemptId || newAttemptId(a.now) };
    const opts = { scheduler: this.settings.scheduler, fsrsRetention: this.settings.fsrsRetention, attemptId: attempt.attemptId };

    // Build the result the UI should show before touching the note. If the write
    // fails, this summary is still correct and the attempt can be replayed later.
    let preview;
    try {
      const cached = this.app.metadataCache.getFileCache(file);
      const copy = cloneFrontmatter(cached && cached.frontmatter);
      preview = applyAttempt(copy, attempt, this.settings.intervals, opts);
    } catch (e) {
      preview = null;
    }

    let summary;
    try {
      await this.app.fileManager.processFrontMatter(file, (fm) => {
        summary = applyAttempt(fm, attempt, this.settings.intervals, opts);
      });
    } catch (e) {
      if (!preview) throw e;
      const list = enqueuePending(this.readPendingAttempts(), file.path, attempt);
      this.writePendingAttempts(list);
      new Notice("Saved offline. This result will be added to the note when the vault is writable.", 7000);
      return { ...preview, queued: true, pending: list.length, attemptId: attempt.attemptId };
    }

    if (summary && summary.fsrsError) {
      new Notice("FSRS couldn't schedule this question, so the simple ladder was used.");
    }
    return { ...summary, queued: false, attemptId: attempt.attemptId };
  }

  /** Attach an error tag to a queued attempt, or return false if it has already been written. */
  async setPendingAttemptError(path, attemptId, type) {
    const list = this.readPendingAttempts();
    const next = updatePendingError(list, path, attemptId, type);
    if (!next) return false;
    this.writePendingAttempts(next);
    return true;
  }

  /** Replay the local outbox. The attempt id makes a retry safe if the first write partially succeeded. */
  flushPendingAttempts() {
    if (this._pendingFlush) return this._pendingFlush;
    this._pendingFlush = (async () => {
      let list = this.readPendingAttempts().slice();
      let sent = 0;
      for (const entry of list.slice()) {
        const file = this.app.vault.getAbstractFileByPath(entry.path);
        if (!(file instanceof TFile)) {
          list = removePending(list, entry.id);
          continue;
        }
        try {
          await this.app.fileManager.processFrontMatter(file, (fm) => {
            if (fm.last_attempt_id === entry.id) {
              if (entry.errorType) setLastErrorType(fm, entry.errorType);
              return;
            }
            applyAttempt(fm, unpackAttempt(entry.attempt), this.settings.intervals, {
              scheduler: this.settings.scheduler,
              fsrsRetention: this.settings.fsrsRetention,
              attemptId: entry.id,
            });
            if (entry.errorType) setLastErrorType(fm, entry.errorType);
          });
          list = removePending(list, entry.id);
          sent++;
        } catch (e) {
          break; // still offline: keep this and the rest for the next retry
        }
      }
      this.writePendingAttempts(list);
      return { sent, remaining: list.length };
    })().finally(() => {
      this._pendingFlush = null;
    });
    return this._pendingFlush;
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
