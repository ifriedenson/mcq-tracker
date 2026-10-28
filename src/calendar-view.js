"use strict";
/*
 * Calendar view, the `uni-schedule` embed and the "add schedule" dialog.
 *
 * The month grid, day timeline, live countdown and per-class note button are adapted
 * from University Schedule and Calendar (MIT, Copyright (c) 2026 Cesemess),
 * https://github.com/Cesemess/obsidian-uni-calendar @ 35778e4. The rendering was
 * rewritten against this plugin's `qt-` styles and item view conventions; see NOTICES.md.
 */
const { ItemView, Modal, Notice, Setting } = require("obsidian");
const { VIEW_TYPE_CALENDAR } = require("./constants");
const { addDays, str } = require("./util");
const { dateKey } = require("./calendar-ics");
const {
  classColor,
  classTypeLabel,
  eventsOnDay,
  examCountdown,
  formatDateValue,
  formatTime,
  humanizeDuration,
  monthGrid,
  monthLabel,
  nextClassStatus,
  parseClassDetails,
  upcomingExams,
  weekdayLabels,
} = require("./calendar-model");

function detailsOf(event) {
  if (!event.details) event.details = parseClassDetails(event.summary, event.description, event.location);
  return event.details;
}

/** Status line content: the running class or the next one, with a live countdown. */
function statusText(plugin, now) {
  const settings = plugin.calendarSettings();
  const status = nextClassStatus(plugin.calendarEvents(), now || new Date());
  if (status.state === "none") return { text: "No upcoming classes.", live: false };
  const details = detailsOf(status.event);
  const time = status.event.allDay ? "all day" : formatTime(settings, status.event.dtstart);
  if (status.state === "ongoing") {
    return {
      text: `${status.event.summary} is in progress · ${humanizeDuration(status.endsInMs)} left (until ${formatTime(settings, status.event.dtend)})`,
      live: true,
      event: status.event,
      details,
    };
  }
  const ifExam = details.isExam ? ` · ${examCountdown(status.event, now || new Date())}` : "";
  return { text: `Next: ${status.event.summary} · ${humanizeDuration(status.startsInMs)} (${time})${ifExam}`, live: false, event: status.event, details };
}

function eventRow(plugin, container, event, settings) {
  const details = detailsOf(event);
  const row = container.createDiv({ cls: "qt-cal-event" });
  if (details.isExam) row.addClass("is-exam");
  const time = row.createDiv({ cls: "qt-cal-event-time" });
  time.createDiv({ text: event.allDay ? "All day" : formatTime(settings, event.dtstart) });
  if (!event.allDay && event.dtend) time.createDiv({ cls: "qt-cal-event-end", text: formatTime(settings, event.dtend) });
  const bar = row.createDiv({ cls: "qt-cal-event-bar" });
  bar.style.background = classColor(settings, details, event.summary);
  const body = row.createDiv({ cls: "qt-cal-event-body" });
  const titleRow = body.createDiv({ cls: "qt-cal-event-title-row" });
  titleRow.createSpan({ cls: "qt-cal-event-title", text: str(event.summary) || "Class" });
  if (details.isExam) titleRow.createSpan({ cls: "qt-cal-badge", text: `Exam · ${examCountdown(event, new Date())}` });
  const meta = [details.room, details.lecturer, classTypeLabel(settings, details.category)].filter(Boolean).join(" · ");
  if (meta) body.createDiv({ cls: "qt-cal-event-meta", text: meta });
  const actions = body.createDiv({ cls: "qt-cal-event-actions" });
  const noteBtn = actions.createEl("button", { cls: "qt-cal-note-btn", text: "Open note" });
  noteBtn.addEventListener("click", () => {
    plugin.openClassNote(event, event.dateKey).catch((e) => new Notice(str(e && e.message) || "Could not create the note."));
  });
  return row;
}

/** Daily timeline reused by the sidebar view and the code block. */
function renderDayTimeline(plugin, container, key, options) {
  const opts = options || {};
  const settings = plugin.calendarSettings();
  const events = eventsOnDay(plugin.calendarEvents(), key);
  if (!events.length) {
    container.createDiv({ cls: "qt-cal-empty", text: opts.emptyText || "No classes on this day." });
    return;
  }
  const list = container.createDiv({ cls: "qt-cal-timeline" });
  for (const event of events) eventRow(plugin, list, event, settings);
}

/** Reads `date: today|tomorrow|YYYY-MM-DD` from a `uni-schedule` block. */
function parseScheduleBlock(source, now) {
  const at = now || new Date();
  let key = dateKey(at);
  for (const line of str(source).split(/\r?\n/)) {
    const m = /^\s*date\s*:\s*(\S+)/i.exec(line);
    if (!m) continue;
    const value = m[1].toLowerCase();
    if (value === "today" || value === "dzisiaj") key = dateKey(at);
    else if (value === "tomorrow" || value === "jutro") key = dateKey(addDays(at, 1));
    else if (/^\d{4}-\d{2}-\d{2}$/.test(value)) key = value;
  }
  return { dateKey: key };
}

function dayLabel(key, settings) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return key;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return `${names[d.getDay()]}, ${formatDateValue(settings.dateFormat, key)}`;
}

/* ------------------------------------------------------------------- view */

class CalendarView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.cursor = new Date();
    this.mode = "month"; // month | day | upcoming
    this.selectedKey = dateKey(new Date());
    this.statusEl = null;
  }

  getViewType() {
    return VIEW_TYPE_CALENDAR;
  }
  getDisplayText() {
    return "Calendar";
  }
  getIcon() {
    return "calendar-days";
  }

  async onOpen() {
    this.contentEl.addClass("qt-root");
    // Re-read only when a schedule file itself changes, not on every note edit.
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (!file || !/\.ics$/i.test(file.path || "")) return;
        this.plugin.refreshCalendarFileSources().then(() => this.render());
      })
    );
    this.registerInterval(
      activeWindow.setInterval(() => {
        if (this.statusEl && this.statusEl.isConnected) this.renderStatus();
      }, 30000)
    );
    this.render();
  }

  async onClose() {}

  renderStatus() {
    if (!this.statusEl) return;
    this.statusEl.empty();
    const plugin = this.plugin;
    if (!plugin.calendarEnabled()) return;
    const info = statusText(plugin);
    const line = this.statusEl.createDiv({ cls: info.live ? "qt-cal-status is-live" : "qt-cal-status", text: info.text });
    if (info.live) line.addClass("is-live");
  }

  render() {
    const el = this.contentEl;
    el.empty();
    const plugin = this.plugin;
    const root = el.createDiv({ cls: "qt-wrap qt-cal" });
    const head = root.createDiv({ cls: "qt-cal-head" });
    head.createDiv({ cls: "qt-cal-heading", text: "Calendar" });
    const actions = head.createDiv({ cls: "qt-cal-head-actions" });
    const addBtn = actions.createEl("button", { cls: "qt-cal-add", text: "Add schedule" });
    addBtn.addEventListener("click", () => plugin.openCalendarImport());
    if (!plugin.calendarEnabled()) {
      root.createDiv({ cls: "qt-cal-empty", text: "The calendar module is off. Turn it on in Settings, Calendar, to import a class schedule." });
      const onBtn = root.createEl("button", { cls: "mod-cta", text: "Open settings" });
      onBtn.addEventListener("click", () => plugin.openSettings());
      return;
    }
    this.statusEl = root.createDiv({ cls: "qt-cal-status-line" });
    this.renderStatus();

    if (!plugin.calendarSources().some((s) => !s.hidden)) {
      const empty = root.createDiv({ cls: "qt-cal-empty-state" });
      empty.createDiv({ cls: "qt-cal-empty", text: "No schedule yet. Add an .ics file to your vault, or a public calendar feed, to see your classes and exams here." });
      const btn = empty.createEl("button", { cls: "mod-cta", text: "Add a schedule" });
      btn.addEventListener("click", () => plugin.openCalendarImport());
      return;
    }

    const modes = root.createDiv({ cls: "qt-row qt-cal-modes" });
    for (const [id, label] of [["month", "Month"], ["day", "Day"], ["upcoming", "Upcoming"]]) {
      const b = modes.createEl("button", { text: label });
      if (this.mode === id) b.addClass("mod-cta");
      b.addEventListener("click", () => {
        this.mode = id;
        this.render();
      });
    }

    if (this.mode === "month") this.renderMonth(root);
    else if (this.mode === "day") this.renderDay(root);
    else this.renderUpcoming(root);
  }

  renderMonth(root) {
    const plugin = this.plugin;
    const settings = plugin.calendarSettings();
    const events = plugin.calendarEvents();
    const nav = root.createDiv({ cls: "qt-cal-nav" });
    const prev = nav.createEl("button", { text: "‹" });
    prev.addEventListener("click", () => this.shiftMonth(-1));
    nav.createDiv({ cls: "qt-cal-month", text: monthLabel(this.cursor.getFullYear(), this.cursor.getMonth()) });
    const next = nav.createEl("button", { text: "›" });
    next.addEventListener("click", () => this.shiftMonth(1));
    const todayBtn = nav.createEl("button", { cls: "qt-cal-today", text: "Today" });
    todayBtn.addEventListener("click", () => {
      this.cursor = new Date();
      this.selectedKey = dateKey(new Date());
      this.render();
    });

    const grid = root.createDiv({ cls: "qt-cal-grid" });
    for (const label of weekdayLabels(settings.firstDayOfWeek)) grid.createDiv({ cls: "qt-cal-wd", text: label });
    for (const cell of monthGrid(this.cursor.getFullYear(), this.cursor.getMonth(), settings.firstDayOfWeek)) {
      const btn = grid.createEl("button", { cls: "qt-cal-cell" });
      if (!cell.inMonth) btn.addClass("is-outside");
      if (cell.isToday) btn.addClass("is-today");
      if (cell.key === this.selectedKey) btn.addClass("is-selected");
      btn.createDiv({ cls: "qt-cal-daynum", text: String(cell.day) });
      const dayEvents = eventsOnDay(events, cell.key);
      const dots = btn.createDiv({ cls: "qt-cal-dots" });
      for (const ev of dayEvents.slice(0, 3)) {
        const details = detailsOf(ev);
        const dot = dots.createDiv({ cls: "qt-cal-dot" });
        dot.style.background = classColor(settings, details, ev.summary);
        if (details.isExam) dot.addClass("is-exam");
      }
      if (dayEvents.length > 3) dots.createDiv({ cls: "qt-cal-more", text: `+${dayEvents.length - 3}` });
      btn.addEventListener("click", () => {
        this.selectedKey = cell.key;
        this.mode = "day";
        this.render();
      });
    }

    root.createDiv({ cls: "qt-cal-section-title", text: dayLabel(this.selectedKey, settings) });
    renderDayTimeline(this.plugin, root, this.selectedKey);
    this.renderExams(root);
  }

  renderDay(root) {
    const settings = this.plugin.calendarSettings();
    const nav = root.createDiv({ cls: "qt-cal-nav" });
    const prev = nav.createEl("button", { text: "‹" });
    prev.addEventListener("click", () => this.shiftDay(-1));
    nav.createDiv({ cls: "qt-cal-month", text: dayLabel(this.selectedKey, settings) });
    const next = nav.createEl("button", { text: "›" });
    next.addEventListener("click", () => this.shiftDay(1));
    const todayBtn = nav.createEl("button", { cls: "qt-cal-today", text: "Today" });
    todayBtn.addEventListener("click", () => {
      this.selectedKey = dateKey(new Date());
      this.render();
    });
    renderDayTimeline(this.plugin, root, this.selectedKey);
    this.renderExams(root);
  }

  renderUpcoming(root) {
    const plugin = this.plugin;
    const settings = plugin.calendarSettings();
    const events = plugin.calendarEvents();
    const now = new Date();
    let shown = 0;
    for (let i = 0; i < 14; i++) {
      const key = dateKey(addDays(now, i));
      const dayEvents = eventsOnDay(events, key);
      if (!dayEvents.length) continue;
      shown++;
      root.createDiv({ cls: "qt-cal-section-title", text: dayLabel(key, settings) });
      const list = root.createDiv({ cls: "qt-cal-timeline" });
      for (const event of dayEvents) eventRow(plugin, list, event, settings);
    }
    if (!shown) root.createDiv({ cls: "qt-cal-empty", text: "Nothing scheduled in the next two weeks." });
    this.renderExams(root);
  }

  renderExams(root) {
    const exams = upcomingExams(this.plugin.calendarEvents(), new Date(), 5);
    if (!exams.length) return;
    const box = root.createDiv({ cls: "qt-cal-exams" });
    box.createDiv({ cls: "qt-cal-section-title", text: "Upcoming exams" });
    for (const exam of exams) {
      const row = box.createDiv({ cls: "qt-cal-exam" });
      row.createDiv({ cls: "qt-cal-exam-name", text: str(exam.summary) || "Exam" });
      row.createDiv({ cls: "qt-cal-exam-when", text: `${formatDateValue(this.plugin.calendarSettings().dateFormat, exam.dateKey)} · ${examCountdown(exam, new Date())}` });
    }
  }

  shiftMonth(delta) {
    this.cursor = new Date(this.cursor.getFullYear(), this.cursor.getMonth() + delta, 1);
    this.render();
  }

  shiftDay(delta) {
    const d = new Date(`${this.selectedKey}T12:00:00`);
    const base = Number.isNaN(d.getTime()) ? new Date() : d;
    this.selectedKey = dateKey(addDays(base, delta));
    this.render();
  }
}

/* -------------------------------------------------------------- add dialog */

class CalendarImportModal extends Modal {
  constructor(app, plugin, onDone) {
    super(app);
    this.plugin = plugin;
    this.onDone = onDone || (() => {});
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createDiv({ cls: "qt-cal-heading", text: "Add a schedule" });
    contentEl.createEl("p", {
      cls: "setting-item-description",
      text: "Import a .ics file that is already in your vault, or paste a public calendar feed. For a Google Calendar, use Settings, Integrate calendar, Secret address in iCal format (private), or the public calendar address.",
    });

    const vault = this.app.vault;
    const icsFiles = (typeof vault.getFiles === "function" ? vault.getFiles() : []).filter((f) => /\.ics$/i.test(f.path || f.name || ""));
    let pick = icsFiles.length ? icsFiles[0].path : "";
    const fileSetting = new Setting(contentEl).setName("Schedule file").setDesc(icsFiles.length ? "Choose an .ics file from your vault." : "No .ics files in the vault yet. Drop one into any folder first.");
    if (icsFiles.length) {
      fileSetting.addDropdown((d) => {
        for (const f of icsFiles) d.addOption(f.path, f.path);
        d.setValue(pick).onChange((v) => (pick = v));
      });
    }
    fileSetting.addButton((b) =>
      b.setButtonText("Add file").onClick(async () => {
        if (!pick) return new Notice("Add an .ics file to your vault first.");
        try {
          await this.plugin.addCalendarFileSource(pick);
          this.close();
          this.onDone();
        } catch (e) {
          new Notice(str(e && e.message) || "Could not read that file.");
        }
      })
    );

    let url = "";
    new Setting(contentEl)
      .setName("Calendar feed URL")
      .setDesc("A public https:// or webcal:// link that returns an .ics file. Google share links are converted for you.")
      .addText((t) => t.setPlaceholder("https://.../basic.ics").onChange((v) => (url = v)))
      .addButton((b) =>
        b.setButtonText("Add feed").onClick(async () => {
          if (!url.trim()) return new Notice("Paste a calendar URL first.");
          try {
            await this.plugin.addCalendarUrlSource(url);
            this.close();
            this.onDone();
          } catch (e) {
            new Notice(str(e && e.message) || "Could not download that calendar.");
          }
        })
      );
  }

  onClose() {
    this.contentEl.empty();
  }
}

module.exports = {
  VIEW_TYPE_CALENDAR,
  CalendarView,
  CalendarImportModal,
  parseScheduleBlock,
  renderDayTimeline,
  statusText,
};
