"use strict";
/*
 * Calendar view, the `uni-schedule` embed and the "add schedule" dialog.
 *
 * The month card, day cells, timeline, event cards and note badges are adapted
 * from University Schedule and Calendar (MIT, Copyright (c) 2026 Cesemess),
 * https://github.com/Cesemess/obsidian-uni-calendar @ 35778e4. The markup and
 * class names follow that plugin so the calendar looks the same; see NOTICES.md.
 */
const { ItemView, Modal, Notice, Setting, setIcon } = require("obsidian");
const { VIEW_TYPE_CALENDAR } = require("./constants");
const { addDays, str } = require("./util");
const { dateKey } = require("./calendar-ics");
const {
  classColor,
  classTypeLabel,
  dayFreeMinutes,
  dayHeading,
  eventsOnDay,
  examCountdown,
  formatDateValue,
  formatTime,
  freeSlots,
  gapLabel,
  monthLabel,
  timelineEntries,
  termWeekInfo,
  termWeekLabel,
  upcomingExams,
  parseClassDetails,
  weekdayLabels,
} = require("./calendar-model");
const { isAttachedToExam, recommendApResource, recommendStudyResource, resourceTitle } = require("./ap-exam-resources");
const { isAttachedToStudySlot } = require("./ap-resource-notes");


function detailsOf(event) {
  if (!event.details) event.details = parseClassDetails(event.summary, event.description, event.location);
  return event.details;
}

/** Applies the user's maximum calendar width to the view or an embed. */
function applyCalendarWidth(el, settings) {
  if (!el || !el.style) return;
  const width = Math.max(0, Math.min(1600, Math.round(Number(settings && settings.calendarMaxWidth) || 0)));
  el.style.maxWidth = width ? `${width}px` : "";
  el.style.marginLeft = width ? "auto" : "";
  el.style.marginRight = width ? "auto" : "";
}

function classesCount(count) {
  if (!count) return "No classes";
  return count === 1 ? "1 class" : `${count} classes`;
}

const BREAK_ICONS = {
  coffee: "coffee",
  food: "utensils",
  pause: "pause",
  hourglass: "hourglass",
  walk: "footprints",
  book: "book-open",
  music: "music",
  sun: "sun",
  moon: "moon",
  spark: "zap",
  battery: "battery-charging",
  clock: "clock",
  leaf: "leaf",
  smile: "smile",
};

function renderBreakIcon(container, icon) {
  const span = container.createSpan({ cls: "uni-timeline-gap-icon" });
  setIcon(span, BREAK_ICONS[icon] || "coffee");
}

/** One free-period marker between two classes, in the configured style. */
function renderGapMarker(timeline, gap, settings, onStudy) {
  const gaps = settings.timelineGaps || {};
  const style = gaps.style || "pill";
  const icon = gaps.icon || "coffee";
  const label = gapLabel(gap.minutes);
  const timeRange = `${formatTime(settings, gap.start)} – ${formatTime(settings, gap.end)}`;

  const activate = (el, title) => {
    el.setAttr("title", title);
    if (!onStudy) return;
    el.setAttr("role", "button");
    el.setAttr("tabindex", "0");
    el.setAttr("aria-label", `Study during the free period, ${timeRange}`);
    el.addEventListener("click", () => onStudy(gap));
    el.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      e.stopPropagation();
      onStudy(gap);
    });
  };

  if (style === "card") {
    const item = timeline.createDiv({ cls: "uni-timeline-item uni-timeline-break-item" });
    activate(item, `Free period: ${timeRange}. Click to study.`);
    const node = item.createDiv({ cls: "uni-timeline-node uni-timeline-break-node" });
    renderBreakIcon(node, icon);
    const card = item.createDiv({ cls: "uni-event-card uni-break-event-card" });
    const header = card.createDiv({ cls: "uni-event-header" });
    header.createSpan({ cls: "uni-event-time", text: timeRange });
    header.createSpan({ cls: "uni-break-card-duration-badge", text: label });
    const titleRow = card.createDiv({ cls: "uni-event-title-row uni-break-event-title-row" });
    titleRow.createSpan({ cls: "uni-event-title uni-break-event-title", text: "Free period / Break" });
    return;
  }

  if (style === "line") {
    const item = timeline.createDiv({ cls: "uni-timeline-item uni-timeline-break-line-item" });
    activate(item, `Free period: ${timeRange}. Click to study.`);
    const node = item.createDiv({ cls: "uni-timeline-node uni-timeline-break-line-node" });
    renderBreakIcon(node, icon);
    const labelRow = item.createDiv({ cls: "uni-timeline-break-line-label" });
    labelRow.createSpan({ cls: "uni-timeline-break-line-text", text: label });
    return;
  }

  const gapRow = timeline.createDiv({ cls: `uni-timeline-gap style-${style === "text" ? "text" : "pill"}` });
  activate(gapRow, `Free period: ${timeRange}. Click to study.`);
  const pill = gapRow.createSpan({ cls: "uni-timeline-gap-pill" });
  renderBreakIcon(pill, icon);
  pill.createSpan({ text: ` ${label}` });
}

/**
 * The original calendar shows only the weeks the month needs, not a fixed six.
 * This mirrors its leading/trailing day maths while leaving `monthGrid` alone.
 */
function compactMonthCells(year, month, firstDayOfWeek, now) {
  const first = new Date(year, month, 1);
  const start = firstDayOfWeek === "sunday" ? first.getDay() : (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const todayKey = dateKey(now || new Date());
  const cells = [];
  const push = (date, inMonth) => {
    const key = dateKey(date);
    cells.push({ key, day: date.getDate(), inMonth, isToday: key === todayKey });
  };
  for (let i = start; i > 0; i--) push(new Date(year, month - 1, daysInPrev - i + 1), false);
  for (let day = 1; day <= daysInMonth; day++) push(new Date(year, month, day), true);
  const remaining = cells.length % 7 === 0 ? 0 : 7 - (cells.length % 7);
  for (let day = 1; day <= remaining; day++) push(new Date(year, month + 1, day), false);
  return cells;
}

function noteExists(plugin, event, key) {
  try {
    return !!plugin.findCalendarNote(event, key);
  } catch (e) {
    return false;
  }
}

/** Free periods with the subject of the next class, used by the study-slot chooser. */
function studySlotsFor(events) {
  const timed = (events || [])
    .filter((ev) => !ev.allDay && ev.dtstart && ev.dtend)
    .sort((a, b) => a.dtstart - b.dtstart);
  return freeSlots(events).map((slot) => ({
    start: slot.start,
    end: slot.end,
    minutes: slot.minutes,
    subject: (timed.find((ev) => ev.dtstart >= slot.end) || {}).summary || "",
  }));
}

/** One event card, with the original plugin's header, meta line and note badge. */
function renderEventCard(plugin, timeline, event, key, options) {
  const opts = options || {};
  const settings = plugin.calendarSettings();
  const details = detailsOf(event);
  const color = classColor(settings, details, event.summary);

  const item = timeline.createDiv({ cls: "uni-timeline-item" });
  const node = item.createDiv({ cls: "uni-timeline-node" });
  node.style.backgroundColor = color;

  const card = item.createDiv({ cls: "uni-event-card" });
  card.style.setProperty("--event-color", color);
  if (event.termReadingWeek) card.addClass("is-reading-week");
  card.setAttr("role", "button");
  card.setAttr("tabindex", "0");

  const now = new Date();
  const ongoing =
    key === dateKey(now) && !event.allDay && event.dtstart && event.dtend && now >= event.dtstart && now < event.dtend;
  if (ongoing) card.addClass("is-ongoing");

  const header = card.createDiv({ cls: "uni-event-header" });
  const time = event.allDay
    ? "All day"
    : event.dtend
      ? `${formatTime(settings, event.dtstart)} – ${formatTime(settings, event.dtend)}`
      : formatTime(settings, event.dtstart);
  header.createDiv({ cls: "uni-event-time", text: time });

  if (ongoing) {
    const countdown = header.createDiv({ cls: "uni-event-countdown" });
    setIcon(countdown, "clock");
    const text = countdown.createSpan({ text: `${Math.max(1, Math.round((event.dtend - now) / 60000))} min left` });
    if (opts.liveNodes) opts.liveNodes.push({ node: text, event });
  }

  if (event.termReadingWeek) {
    const readingLabel = str(event.termReadingLabel).trim();
    header.createDiv({
      cls: "uni-event-term-badge",
      text: readingLabel && readingLabel.toLowerCase() !== "reading week" ? `Reading week · ${readingLabel}` : "Reading week",
    });
  }
  header.createDiv({ cls: "uni-event-type-badge", text: classTypeLabel(settings, details.category) });
  card.createDiv({ cls: "uni-event-title", text: str(event.summary) || "Class" });

  const meta = card.createDiv({ cls: "uni-event-meta" });
  if (details.room) {
    const room = meta.createSpan({ cls: "uni-event-meta-item" });
    setIcon(room, "map-pin");
    room.createSpan({ text: details.room });
  }
  if (details.lecturer) {
    const lecturer = meta.createSpan({ cls: "uni-event-meta-item" });
    setIcon(lecturer, "user");
    lecturer.createSpan({ text: details.lecturer });
  }

  const status = card.createDiv({ cls: "uni-note-status" });
  const left = status.createDiv({ cls: "uni-note-status-left" });
  status.createDiv({ cls: "uni-note-status-right" });

  const foreign = !!event.sourcePath;
  const exists = foreign || noteExists(plugin, event, key);
  const badge = left.createDiv({ cls: `uni-note-status-badge is-clickable ${exists ? "has-note" : "missing-note"}` });
  badge.setAttr("title", foreign ? "Open event note" : exists ? "Open note" : "Click to create note");
  setIcon(badge, exists ? "file-text" : "plus");
  badge.createSpan({ text: foreign ? "Event note" : exists ? "Note exists" : "Missing note" });

  const label = str(event.summary) || "this class";
  card.setAttr("aria-label", `${foreign ? "Open event note for" : exists ? "Open note for" : "Create note for"} ${label}${event.termReadingWeek ? ", reading week class" : ""}`);

  const open = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (e && e.preventDefault) e.preventDefault();
    plugin
      .openClassNote(event, key)
      .then(() => plugin.refreshCalendarViews())
      .catch((err) => new Notice(str(err && err.message) || "Could not open the note."));
  };
  const onKey = (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    open(e);
  };
  badge.addEventListener("click", open);
  card.addEventListener("click", open);
  card.addEventListener("keydown", (e) => {
    if (e.target && e.target !== card) return;
    onKey(e);
  });
  return card;
}

/** The original `renderScheduleTimeline`: section header, empty state, timeline. */
function renderDaySection(plugin, container, key, options) {
  const opts = options || {};
  const settings = plugin.calendarSettings();
  const events = eventsOnDay(opts.events || plugin.calendarEvents(opts.now), key);
  const term = termWeekInfo(settings, key);
  const termLabel = termWeekLabel(term);
  const section = container.createDiv({ cls: "uni-schedule-section" });
  const header = section.createDiv({ cls: "uni-schedule-header" });
  if (opts.title !== false) {
    const title = header.createDiv({ cls: "uni-schedule-date-title" });
    title.createSpan({ text: dayHeading(key) });
    if (termLabel) title.createSpan({ cls: `uni-term-badge${term && !term.inTerm ? " is-out-of-term" : ""}`, text: termLabel });
  }
  const badges = header.createDiv({ cls: "uni-schedule-badges" });
  if (opts.title === false && termLabel) badges.createDiv({ cls: "uni-term-badge", text: termLabel });
  badges.createDiv({ cls: "uni-schedule-badge-count", text: classesCount(events.length) });
  const freeMinutes = dayFreeMinutes(events);
  const slots = studySlotsFor(events);
  if (freeMinutes > 0) {
    const free = badges.createEl("button", { cls: "uni-schedule-badge-free", text: `${gapLabel(freeMinutes)} free` });
    free.setAttr("type", "button");
    free.setAttr("title", "Free time between the first and last class. Click to study.");
    free.addEventListener("click", () => plugin.openStudySlot(slots));
  }

  if (!events.length) {
    const empty = section.createDiv({ cls: "uni-empty-schedule" });
    empty.createDiv({ cls: "uni-empty-schedule-icon", text: "🎓" });
    empty.createDiv({
      cls: "uni-empty-schedule-title uni-empty-schedule-text",
      text: opts.emptyTitle || (term && term.readingWeek ? term.readingLabel || "Reading week" : "No classes scheduled for this day."),
    });
    empty.createDiv({
      cls: "uni-empty-schedule-subtext",
      text: term && term.readingWeek ? "No classes this week. Use the break to review." : "Enjoy your free time or review your notes!",
    });
    return section;
  }

  const timeline = section.createDiv({ cls: "uni-timeline" });
  for (const entry of timelineEntries(events, settings)) {
    if (entry.kind === "gap") {
      renderGapMarker(timeline, entry, settings, (gap) =>
        plugin.openStudySlot([
          { start: gap.start, end: gap.end, minutes: gap.minutes, subject: (gap.nextEvent && gap.nextEvent.summary) || "" },
        ])
      );
    } else {
      renderEventCard(plugin, timeline, entry.event, key, { liveNodes: opts.liveNodes });
    }
  }
  return section;
}

function renderEmptyState(container, title, description, buttonText, onClick) {
  const empty = container.createDiv({ cls: "uni-empty-schedule" });
  empty.createDiv({ cls: "uni-empty-schedule-icon", text: "📅" });
  empty.createDiv({ cls: "uni-empty-schedule-title", text: title });
  empty.createDiv({ cls: "uni-empty-schedule-desc", text: description });
  if (buttonText && onClick) {
    const button = empty.createEl("button", { cls: "uni-keyword-btn uni-action-btn uni-empty-add-btn", text: buttonText });
    button.addEventListener("click", onClick);
  }
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

/* ------------------------------------------------------------------- view */

class CalendarView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.cursor = new Date();
    this.mode = "month"; // month | day | upcoming
    this.selectedKey = dateKey(new Date());
    this.liveNodes = [];
    this.liveSignature = "";
    this.range = null;
    this._focusKey = "";
  }

  getViewType() {
    return VIEW_TYPE_CALENDAR;
  }
  getDisplayText() {
    return "Schedule & Calendar";
  }
  getIcon() {
    return "graduation-cap";
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
    // Keep a running class countdown honest without rebuilding the whole view.
    this.registerInterval(activeWindow.setInterval(() => this.refreshLive(), 30000));
    this.render();
  }

  async onClose() {}

  render() {
    const el = this.contentEl;
    const top = el.scrollTop || 0;
    this.liveNodes = [];
    el.empty();
    el.addClass("uni-calendar-container");
    applyCalendarWidth(el, this.plugin.calendarSettings());

    if (!this.plugin.calendarEnabled()) {
      renderEmptyState(
        el,
        "Calendar is off",
        "Turn on the calendar module in Settings, Calendar, to import a class schedule.",
        "Open settings",
        () => this.plugin.openSettings()
      );
      el.scrollTop = top;
      return;
    }

    if (!this.plugin.calendarSources().some((source) => !source.hidden)) {
      const card = el.createDiv({ cls: "uni-month-card" });
      this.renderMonthHeader(card, monthLabel(this.cursor.getFullYear(), this.cursor.getMonth()), "month");
      renderEmptyState(
        el,
        "No university schedule added yet",
        "Add an .ics file to your vault, or a public calendar feed, to see your classes and exams here.",
        "Add a schedule",
        () => this.plugin.openCalendarImport()
      );
      el.scrollTop = top;
      return;
    }

    // The cache window follows the month being viewed, not just today. Upcoming is
    // always relative to today and therefore uses the current window.
    const range = this.mode === "upcoming" ? new Date() : this.cursor;
    this.range = range;
    const events = this.plugin.calendarEvents(range);
    this.renderModes(el);
    if (this.mode === "month") {
      this.renderMonthCard(el, events);
      renderDaySection(this.plugin, el, this.selectedKey, { title: true, events, now: range, liveNodes: this.liveNodes });
      // Exams are always "from today", even while browsing another month.
      this.renderExamPanel(el, this.plugin.calendarEvents());
    } else if (this.mode === "day") {
      const card = el.createDiv({ cls: "uni-month-card" });
      this.renderMonthHeader(card, dayHeading(this.selectedKey), "day");
      renderDaySection(this.plugin, el, this.selectedKey, { title: false, events, now: range, liveNodes: this.liveNodes });
      this.renderExamPanel(el, this.plugin.calendarEvents());
    } else {
      const card = el.createDiv({ cls: "uni-month-card" });
      this.renderMonthHeader(card, "Upcoming", "upcoming");
      this.renderUpcoming(el, events);
      this.renderExamPanel(el, this.plugin.calendarEvents());
    }
    this.liveSignature = this.ongoingSignature(events);
    if (this._focusKey) {
      const key = this._focusKey;
      this._focusKey = "";
      this.focusDay(key);
    }
    el.scrollTop = top;
  }

  renderModes(container) {
    const modes = container.createDiv({ cls: "uni-calendar-modes" });
    for (const [id, label] of [["month", "Month"], ["day", "Day"], ["upcoming", "Upcoming"]]) {
      const button = modes.createEl("button", { cls: "uni-filter-btn", text: label });
      if (this.mode === id) button.addClass("is-active");
      button.addEventListener("click", () => {
        this.mode = id;
        this.render();
      });
    }
  }

  renderMonthCard(container, events) {
    const settings = this.plugin.calendarSettings();
    const card = container.createDiv({ cls: "uni-month-card" });
    this.renderMonthHeader(card, monthLabel(this.cursor.getFullYear(), this.cursor.getMonth()), "month");

    const weekdays = card.createDiv({ cls: "uni-weekdays-row" });
    for (const label of weekdayLabels(settings.firstDayOfWeek)) {
      weekdays.createDiv({ text: str(label).slice(0, 2) });
    }

    const grid = card.createDiv({ cls: "uni-days-grid" });
    grid.setAttr("role", "grid");
    grid.setAttr("aria-label", monthLabel(this.cursor.getFullYear(), this.cursor.getMonth()));
    const cells = compactMonthCells(this.cursor.getFullYear(), this.cursor.getMonth(), settings.firstDayOfWeek);
    for (const [index, cell] of cells.entries()) {
      const day = grid.createDiv({ cls: "uni-day-cell" });
      const term = termWeekInfo(settings, cell.key);
      if (!cell.inMonth) day.addClass("is-other-month");
      if (cell.isToday) day.addClass("is-today");
      if (cell.key === this.selectedKey) day.addClass("is-selected");
      if (term && term.readingWeek) day.addClass("is-reading-week");
      day.setAttr("data-date", cell.key);
      day.setAttr("role", "gridcell");
      day.setAttr("tabindex", "0");
      day.setAttr("aria-selected", cell.key === this.selectedKey ? "true" : "false");
      day.createSpan({ text: String(cell.day) });
      if (term && term.inTerm && index % 7 === 0) {
        const week = day.createSpan({ cls: "uni-day-week", text: `W${term.week}` });
        week.setAttr("aria-hidden", "true");
      }
      if (term) day.setAttr("title", termWeekLabel(term));

      const dayEvents = eventsOnDay(events, cell.key);
      const termText = term ? `, ${termWeekLabel(term)}` : "";
      day.setAttr("aria-label", `${dayHeading(cell.key)}${termText}${dayEvents.length ? `, ${classesCount(dayEvents.length)}` : ""}`);
      if (dayEvents.length) {
        const dots = day.createDiv({ cls: "uni-event-dots-container" });
        for (const event of dayEvents.slice(0, 3)) {
          const dot = dots.createDiv({ cls: "uni-event-dot" });
          dot.style.backgroundColor = classColor(settings, detailsOf(event), event.summary);
        }
      }

      day.addEventListener("click", () => this.selectDay(cell));
      day.addEventListener("keydown", (e) => this.onDayKey(e, cell));
    }
  }

  /** Arrow keys move the selected day; Enter/Space opens that day's schedule. */
  onDayKey(event, cell) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      this.selectDay(cell, true);
      return;
    }
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
    if (!delta) return;
    event.preventDefault();
    const target = new Date(`${cell.key}T12:00:00`);
    if (Number.isNaN(target.getTime())) return;
    target.setDate(target.getDate() + delta);
    const key = dateKey(target);
    this.selectDay(
      { key, inMonth: target.getFullYear() === this.cursor.getFullYear() && target.getMonth() === this.cursor.getMonth() },
      true
    );
  }

  focusDay(key) {
    const node = this.contentEl.querySelector && this.contentEl.querySelector(`[data-date="${key}"]`);
    if (node && node.focus) node.focus();
  }

  /** Re-render only when a class starts or ends; otherwise just update the countdown text. */
  refreshLive() {
    if (this.selectedKey !== dateKey(new Date())) return;
    const now = new Date();
    const events = this.plugin.calendarEvents(this.range || this.cursor);
    if (this.ongoingSignature(events) !== this.liveSignature) {
      this.render();
      return;
    }
    for (const live of this.liveNodes) {
      if (!live.node || !live.event || !live.event.dtend) continue;
      live.node.setText(`${Math.max(1, Math.round((live.event.dtend - now) / 60000))} min left`);
    }
  }

  ongoingSignature(events) {
    const now = new Date();
    return (events || [])
      .filter((ev) => ev.dateKey === this.selectedKey && !ev.allDay && ev.dtstart && ev.dtend && now >= ev.dtstart && now < ev.dtend)
      .map((ev) => `${ev.uid || ev.summary}|${ev.dtstart.getTime()}`)
      .join("|");
  }

  /** Restored from the pre-UI-port view: the next exams and their countdowns. */
  renderExamPanel(container, events) {
    const exams = upcomingExams(events, new Date(), 5);
    if (!exams.length) return;
    const settings = this.plugin.calendarSettings();
    const panel = container.createDiv({ cls: "uni-exam-panel" });
    panel.createDiv({ cls: "uni-exam-panel-title", text: "Upcoming exams" });
    for (const exam of exams) {
      const item = panel.createDiv({ cls: "uni-exam-item" });
      const row = item.createEl("button", { cls: "uni-exam-row" });
      const name = str(exam.summary) || "Exam";
      row.setAttr("aria-label", `Open note for ${name}`);
      row.createDiv({ cls: "uni-exam-name", text: name });
      row.createDiv({
        cls: "uni-exam-when",
        text: `${formatDateValue(settings.dateFormat, exam.dateKey)} · ${examCountdown(exam, new Date())}`,
      });
      row.addEventListener("click", () => {
        this.plugin
          .openClassNote(exam, exam.dateKey)
          .then(() => this.plugin.refreshCalendarViews())
          .catch((err) => new Notice(str(err && err.message) || "Could not open the note."));
      });
      const resource = this.attachedResource(exam);
      if (!resource) continue;
      const resourceRow = item.createDiv({ cls: "uni-exam-resource" });
      resourceRow.createSpan({ cls: "uni-exam-resource-name", text: `Attached: ${resourceTitle(resource)}` });
      const open = resourceRow.createEl("button", { cls: "uni-exam-resource-open", text: "Open" });
      open.setAttr("aria-label", `Open the resource attached to ${name}`);
      open.addEventListener("click", () => this.openResource(resource));
      const add = resourceRow.createEl("button", { cls: "uni-exam-resource-open", text: "Add to note" });
      add.setAttr("aria-label", `Add the attached resource to the class note for ${name}`);
      add.addEventListener("click", () =>
        this.plugin
          .addApResourceToClassNote(exam, exam.dateKey, resource)
          .catch((err) => new Notice(str(err && err.message) || "Could not add the resource to the note.")),
      );
    }
  }

  /** Only an explicitly bound resource appears beside its exam; generic matches stay on Today. */
  attachedResource(exam) {
    const p = this.plugin;
    if (!p.referenceEnabled || !p.referenceEnabled() || !p.getApResourceNotes) return null;
    const picked = recommendApResource(exam, p.getApResourceNotes());
    return picked && isAttachedToExam(picked, exam) ? picked : null;
  }

  openResource(entry) {
    if (!this.app || !entry) return;
    const file = this.app.vault.getAbstractFileByPath(entry.path);
    if (file) {
      this.app.workspace.getLeaf("tab").openFile(file);
      return;
    }
    if (this.app.workspace.openLinkText) this.app.workspace.openLinkText(entry.path, "", false);
  }

  renderMonthHeader(card, title, mode) {
    const header = card.createDiv({ cls: "uni-month-header" });
    header.createDiv({ cls: "uni-month-title", text: title });
    const controls = header.createDiv({ cls: "uni-header-controls" });

    if (mode === "month") {
      this.headerButton(controls, "chevron-left", "Previous month", () => this.shiftMonth(-1));
      this.todayButton(controls);
      this.headerButton(controls, "chevron-right", "Next month", () => this.shiftMonth(1));
    } else if (mode === "day") {
      this.headerButton(controls, "chevron-left", "Previous day", () => this.shiftDay(-1));
      this.todayButton(controls);
      this.headerButton(controls, "chevron-right", "Next day", () => this.shiftDay(1));
    } else {
      this.todayButton(controls);
    }

    this.breakButton(controls);
    this.headerButton(controls, "refresh-cw", "Refresh schedule", (button) => this.sync(button), "uni-sync-btn");
    this.headerButton(controls, "settings", "Calendar settings", () => this.plugin.openSettings(), "uni-settings-btn");
    return header;
  }

  headerButton(controls, icon, label, onClick, extraClass) {
    const button = controls.createEl("button", { cls: `uni-nav-btn ${extraClass || ""}`.trim() });
    button.setAttr("aria-label", label);
    button.setAttr("title", label);
    setIcon(button, icon);
    button.addEventListener("click", () => onClick(button));
    return button;
  }

  todayButton(controls) {
    const button = controls.createEl("button", { cls: "uni-nav-btn uni-today-btn", text: "Today" });
    button.setAttr("title", "Today");
    button.addEventListener("click", () => this.goToday());
    return button;
  }

  /** Quick on/off for the break markers, without opening settings. */
  breakButton(controls) {
    const gaps = (this.plugin.settings.calendar && this.plugin.settings.calendar.timelineGaps) || {};
    const enabled = gaps.enabled === true;
    const label = enabled ? "Hide breaks between classes" : "Show breaks between classes";
    const button = controls.createEl("button", { cls: `uni-nav-btn${enabled ? " is-active" : ""}` });
    button.setAttr("aria-label", label);
    button.setAttr("title", label);
    button.setAttr("aria-pressed", enabled ? "true" : "false");
    setIcon(button, BREAK_ICONS[gaps.icon] || "coffee");
    button.addEventListener("click", async () => {
      await this.toggleBreaks();
    });
    return button;
  }

  async toggleBreaks() {
    const calendar = this.plugin.settings.calendar || (this.plugin.settings.calendar = {});
    if (!calendar.timelineGaps) calendar.timelineGaps = {};
    calendar.timelineGaps.enabled = !calendar.timelineGaps.enabled;
    await this.plugin.save();
    this.render();
    this.plugin.refreshCalendarViews();
  }

  async sync(button) {
    if (button) button.addClass("is-syncing");
    try {
      for (const source of this.plugin.calendarSources()) {
        if (!source.hidden) await this.plugin.syncCalendarSource(source.id);
      }
      this.plugin.invalidateCalendar();
      new Notice("Schedule updated.");
      this.render();
    } catch (e) {
      new Notice(str(e && e.message) || "Could not refresh the schedule.");
    } finally {
      if (button) button.removeClass("is-syncing");
    }
  }

  selectDay(cell, focus) {
    this.selectedKey = cell.key;
    if (!cell.inMonth) {
      this.cursor = new Date(Number(cell.key.slice(0, 4)), Number(cell.key.slice(5, 7)) - 1, 1);
    }
    this._focusKey = focus ? cell.key : "";
    // Stay in the month view: the date's schedule is redrawn beneath the grid.
    const top = this.contentEl.scrollTop || 0;
    this.render();
    this.contentEl.scrollTop = top;
  }

  renderUpcoming(container, events) {
    const now = new Date();
    const source = events || this.plugin.calendarEvents(now);
    let shown = 0;
    for (let i = 0; i < 14; i++) {
      const key = dateKey(addDays(now, i));
      if (!eventsOnDay(source, key).length) continue;
      shown++;
      renderDaySection(this.plugin, container, key, { title: true, events: source, now, liveNodes: this.liveNodes });
    }
    if (!shown) renderEmptyState(container, "Nothing scheduled", "No classes in the next two weeks.", "", null);
  }

  goToday() {
    const now = new Date();
    this.cursor = new Date(now.getFullYear(), now.getMonth(), 1);
    this.selectedKey = dateKey(now);
    this.render();
  }

  shiftMonth(delta) {
    this.cursor = new Date(this.cursor.getFullYear(), this.cursor.getMonth() + delta, 1);
    const today = new Date();
    this.selectedKey =
      this.cursor.getFullYear() === today.getFullYear() && this.cursor.getMonth() === today.getMonth()
        ? dateKey(today)
        : dateKey(this.cursor);
    this.render();
  }

  shiftDay(delta) {
    const current = new Date(`${this.selectedKey}T12:00:00`);
    const base = Number.isNaN(current.getTime()) ? new Date() : current;
    const next = addDays(base, delta);
    this.selectedKey = dateKey(next);
    this.cursor = new Date(next.getFullYear(), next.getMonth(), 1);
    this.render();
  }
}

/* ----------------------------------------------------------- study slots */

class StudySlotModal extends Modal {
  constructor(app, plugin, slots) {
    super(app);
    this.plugin = plugin;
    this.slots = slots || [];
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { cls: "uni-modal-title", text: "Study in your free time" });
    const settings = this.plugin.calendarSettings();
    const buffer = Math.max(0, Math.min(60, Math.round(Number(settings.studySlotBufferMinutes) || 0)));
    const slots = this.slots
      .map((slot) => ({ ...slot, usable: slot.minutes - buffer }))
      .filter((slot) => slot.usable >= 5);

    if (!slots.length) {
      contentEl.createEl("p", {
        cls: "setting-item-description",
        text: `No free period has at least 5 minutes after the ${buffer}-minute buffer before the next class.`,
      });
      contentEl.createEl("button", { text: "Close" }).addEventListener("click", () => this.close());
      return;
    }

    contentEl.createEl("p", {
      cls: "setting-item-description",
      text: `Short sessions use your current question filters. ${buffer} minute${buffer === 1 ? "" : "s"} before the next class stay free.`,
    });
    const body = contentEl.createDiv({ cls: "uni-study-slot" });
    let slot = slots[0];

    const draw = () => {
      body.empty();
      if (slots.length > 1) {
        body.createDiv({ cls: "uni-study-slot-label", text: "Free period" });
        const pick = body.createEl("select", { cls: "dropdown" });
        slots.forEach((candidate, index) => {
          pick.createEl("option", {
            value: String(index),
            text: `${formatTime(settings, candidate.start)} – ${formatTime(settings, candidate.end)} · ${gapLabel(candidate.usable)} usable`,
          });
        });
        pick.value = String(slots.indexOf(slot));
        pick.addEventListener("change", () => {
          slot = slots[Number(pick.value)] || slots[0];
          draw();
        });
      } else {
        body.createDiv({
          cls: "uni-study-slot-window",
          text: `${formatTime(settings, slot.start)} – ${formatTime(settings, slot.end)} · ${gapLabel(slot.usable)} usable`,
        });
      }

      body.createDiv({ cls: "uni-study-slot-label", text: "Session length" });
      const durations = [5, 10, 20].filter((minutes) => minutes <= slot.usable);
      if (!durations.length) {
        body.createDiv({ cls: "uni-study-slot-empty", text: "This free period is too short for a 5-minute session after the buffer." });
        return;
      }
      const quickDefaults = this.plugin.settings.quickDefaults || { minutes: 5 };
      let minutes = durations.includes(quickDefaults.minutes) ? quickDefaults.minutes : durations[0];
      const durationRow = body.createDiv({ cls: "uni-study-slot-durations" });
      const buttons = [];
      for (const value of durations) {
        const button = durationRow.createEl("button", { text: `${value} min`, cls: value === minutes ? "is-selected" : "" });
        button.addEventListener("click", () => {
          minutes = value;
          for (const b of buttons) b.toggleClass("is-selected", b === button);
          start.setText(`Start ${minutes} minutes`);
        });
        buttons.push(button);
      }

      body.createDiv({ cls: "uni-study-slot-label", text: "Questions" });
      const choices = [
        { id: "current", label: "My current filters" },
        { id: "due", label: "Due for review" },
      ];
      if (slot.subject) choices.push({ id: "course", label: `Next class: ${slot.subject}` });
      let filter = "current";
      const select = body.createEl("select", { cls: "dropdown" });
      for (const choice of choices) {
        const count = this.plugin.quickPracticePool(choice.id, slot.subject).length;
        select.createEl("option", { value: choice.id, text: `${choice.label} (${count})` });
      }
      select.value = filter;

      this.renderStudyResource(body, slot, draw);

      let pool = this.plugin.quickPracticePool(filter, slot.subject);
      const hint = body.createDiv({ cls: "uni-study-slot-count", text: `${pool.length} question${pool.length === 1 ? "" : "s"} available` });
      const start = body.createEl("button", { text: `Start ${minutes} minutes`, cls: "mod-cta" });
      const refresh = () => {
        pool = this.plugin.quickPracticePool(filter, slot.subject);
        hint.setText(`${pool.length} question${pool.length === 1 ? "" : "s"} available`);
        start.disabled = !pool.length;
      };
      select.addEventListener("change", () => {
        filter = select.value;
        refresh();
      });
      start.disabled = !pool.length;
      start.addEventListener("click", async () => {
        if (!pool.length) {
          new Notice("No questions match this filter.");
          return;
        }
        this.close();
        await this.plugin.startQuickPractice({
          minutes,
          pool,
          mode: filter === "due" ? "due" : undefined,
          label: filter === "course" ? slot.subject : filter === "due" ? "due review" : "your filters",
        });
      });
      const cancel = body.createEl("button", { text: "Cancel" });
      cancel.addEventListener("click", () => this.close());
    };

    draw();
  }

  /** One saved resource for this block: attached first, then a course match. */
  renderStudyResource(body, slot, redraw) {
    const p = this.plugin;
    if (!p.referenceEnabled || !p.referenceEnabled() || !p.getApResourceNotes) return;
    const entries = p.getApResourceNotes();
    const resource = recommendStudyResource(slot, entries);
    if (!resource) return;
    const attached = isAttachedToStudySlot(resource, slot);
    body.createDiv({ cls: "uni-study-slot-label", text: "Resource" });
    const row = body.createDiv({ cls: "uni-study-slot-resource" });
    row.createDiv({
      cls: "uni-study-slot-resource-name",
      text: `${attached ? "Attached" : "Suggested"}: ${resourceTitle(resource)}${resource.stale ? " (stale)" : ""}`,
    });
    if (!attached) {
      row.createEl("button", { text: "Attach to this block", cls: "qt-link" }).addEventListener("click", async () => {
        if (p.attachApResourceToStudySlot) await p.attachApResourceToStudySlot(resource.path, slot);
        redraw();
      });
    } else {
      row.createEl("button", { text: "Detach", cls: "qt-link" }).addEventListener("click", async () => {
        if (p.detachApResourceFromStudySlot) await p.detachApResourceFromStudySlot(resource.path);
        redraw();
      });
    }
    row.createEl("button", { text: "Open", cls: "qt-link" }).addEventListener("click", () => {
      const app = this.plugin.app;
      const file = app.vault.getAbstractFileByPath(resource.path);
      if (file) app.workspace.getLeaf("tab").openFile(file);
    });
  }

  onClose() {
    this.contentEl.empty();
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
    contentEl.createEl("h2", { cls: "uni-modal-title", text: "Add a schedule" });
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
  StudySlotModal,
  applyCalendarWidth,
  parseScheduleBlock,
  renderDaySection,
};
