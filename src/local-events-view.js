"use strict";
/* Local event calendar: CRUD, categories, colour tabs and recurrence. */
const { ItemView, Modal, Notice, Platform } = require("obsidian");
const { VIEW_TYPE_LOCAL_EVENTS } = require("./constants");
const { LOCAL_EVENT_CATEGORIES, addDaysKey, eventsInRange, eventsOnDate, monthCells, todayKey } = require("./local-events");
const { str } = require("./util");
const { makeKeyboardClickable } = require("./view-helpers");

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEK_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function eventMeta(event) {
  const time = event.startTime ? `${event.startTime}${event.endTime ? `–${event.endTime}` : ""} · ` : "";
  const location = event.location ? ` · ${event.location}` : "";
  const repeat = event.repeat !== "none" ? ` · repeats ${event.repeat}` : "";
  const until = event.repeatUntil ? ` until ${event.repeatUntil}` : "";
  return `${time}${event.category}${location}${repeat}${until}`;
}

function dayLabel(key) {
  const date = new Date(`${key}T12:00:00`);
  if (isNaN(date.getTime())) return key;
  return `${DAY_NAMES[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

function startOfWeek(key, weekStartsOn) {
  const date = new Date(`${key}T12:00:00`);
  if (isNaN(date.getTime())) return key;
  const offset = weekStartsOn === "sunday" ? date.getDay() : (date.getDay() + 6) % 7;
  return addDaysKey(key, -offset);
}

class LocalEventModal extends Modal {
  constructor(app, plugin, event) {
    super(app);
    this.plugin = plugin;
    this.event = event || null;
    this.result = null;
  }

  onOpen() {
    const el = this.contentEl;
    el.empty();
    el.createEl("h2", { text: this.event ? "Edit event" : "New event" });
    const form = el.createDiv({ cls: "qt-local-event-form" });
    const field = (label, type, value, placeholder) => {
      const row = form.createDiv({ cls: "qt-study-field" });
      row.createEl("label", { text: label });
      const input = row.createEl("input", { cls: "qt-input", attr: { "aria-label": label } });
      input.type = type || "text";
      input.value = value || "";
      if (placeholder) input.placeholder = placeholder;
      return input;
    };
    const current = this.event || {};
    const title = field("Title", "text", current.title, "Study group");
    const date = field("Date", "date", current.date || todayKey(new Date()));
    const start = field("Start time", "time", current.startTime);
    const end = field("End time", "time", current.endTime);
    const location = field("Location", "text", current.location, "Library room 2");
    const categoryRow = form.createDiv({ cls: "qt-study-field" });
    categoryRow.createEl("label", { text: "Category" });
    const category = categoryRow.createEl("select", { cls: "dropdown", attr: { "aria-label": "Category" } });
    for (const item of LOCAL_EVENT_CATEGORIES) category.createEl("option", { value: item.id, text: item.label });
    category.value = current.category || this.plugin.settings.localEvents.defaultCategory || "study";
    const colorRow = form.createDiv({ cls: "qt-study-field" });
    colorRow.createEl("label", { text: "Colour" });
    const color = colorRow.createEl("input", { cls: "qt-input", attr: { "aria-label": "Colour" } });
    color.type = "color";
    color.value = current.color || "#4f9d69";
    const repeatRow = form.createDiv({ cls: "qt-study-field" });
    repeatRow.createEl("label", { text: "Repeat" });
    const repeat = repeatRow.createEl("select", { cls: "dropdown", attr: { "aria-label": "Repeat" } });
    for (const [value, label] of [["none", "Does not repeat"], ["daily", "Daily"], ["weekly", "Weekly"], ["monthly", "Monthly"], ["yearly", "Yearly"]]) {
      repeat.createEl("option", { value, text: label });
    }
    repeat.value = current.repeat || "none";
    const every = field("Repeat every", "number", String(current.repeatEvery || 1));
    every.min = "1";
    every.max = "365";
    const until = field("Repeat until", "date", current.repeatUntil);
    const notesRow = form.createDiv({ cls: "qt-study-field qt-study-field-wide" });
    notesRow.createEl("label", { text: "Description" });
    const notes = notesRow.createEl("textarea", { cls: "qt-study-bulk", attr: { "aria-label": "Description" } });
    notes.rows = 3;
    notes.value = current.notes || "";
    const actions = el.createDiv({ cls: "qt-row qt-study-actions" });
    actions.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
    actions.createEl("button", { text: "Save", cls: "mod-cta" }).addEventListener("click", async () => {
      const value = {
        id: current.id,
        title: title.value,
        date: date.value,
        startTime: start.value,
        endTime: end.value,
        location: location.value,
        category: category.value,
        color: color.value,
        repeat: repeat.value,
        repeatEvery: every.value,
        repeatUntil: until.value,
        notes: notes.value,
      };
      try {
        await this.plugin.saveLocalEvent(value);
        this.close();
      } catch (e) {
        new Notice(str(e && e.message ? e.message : e) || "Could not save the event.");
      }
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

class LocalEventsView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.cursor = new Date();
    this.filter = "all";
    this.selected = "";
  }

  getViewType() {
    return VIEW_TYPE_LOCAL_EVENTS;
  }

  getDisplayText() {
    return "Local events";
  }

  getIcon() {
    return "calendar-plus";
  }

  async onOpen() {
    this.contentEl.addClass("qt-root");
    this.selected = todayKey(new Date());
    this.render();
  }

  async onClose() {}

  isMobileAgenda() {
    return Platform.isMobile === true && Platform.isPhone !== false;
  }

  selectDay(key) {
    this.selected = key;
    const date = new Date(`${key}T12:00:00`);
    if (!isNaN(date.getTime())) this.cursor = new Date(date.getFullYear(), date.getMonth(), 1);
    this.render();
  }

  shiftDay(delta) {
    this.selectDay(addDaysKey(this.selected, delta));
  }

  render() {
    const el = this.contentEl;
    el.empty();
    const root = el.createDiv({ cls: "qt-wrap qt-local-events qt-screen" });
    if (!this.plugin.localEventsEnabled()) {
      const card = root.createDiv({ cls: "qt-onboard-card" });
      card.createEl("h3", { text: "Local events is off" });
      card.createDiv({ cls: "qt-onboard-text", text: "Turn it on in Settings → Local events." });
      card.createEl("button", { text: "Open settings", cls: "mod-cta qt-primary" }).addEventListener("click", () => this.plugin.openSettings());
      return;
    }
    const settings = this.plugin.settings.localEvents;
    const head = root.createDiv({ cls: "qt-local-events-head qt-screen-head" });
    head.createEl("h2", { text: "Local events" });
    head.createDiv({ cls: "qt-hint", text: "Stored in plugin data and separate from imported .ics feeds and Full Calendar notes. Recurrence is expanded locally." });
    const mobile = this.isMobileAgenda();
    const actions = root.createDiv({ cls: `qt-row qt-local-events-actions${mobile ? " qt-day-agenda-actions" : " qt-toolbar"}` });
    actions.createEl("button", { text: "New event", cls: "mod-cta" }).addEventListener("click", () => this.openNew());
    if (mobile) {
      actions.createEl("button", { text: "Today" }).addEventListener("click", () => this.goToday());
    } else {
      actions.createEl("button", { text: "Previous month" }).addEventListener("click", () => this.shiftMonth(-1));
      actions.createEl("button", { text: "Today" }).addEventListener("click", () => this.goToday());
      actions.createEl("button", { text: "Next month" }).addEventListener("click", () => this.shiftMonth(1));
    }

    const tabs = root.createDiv({ cls: "qt-local-events-tabs" });
    for (const [id, label] of [["all", "All"], ...LOCAL_EVENT_CATEGORIES.map((item) => [item.id, item.label])]) {
      const button = tabs.createEl("button", { cls: "qt-local-events-tab", text: label });
      if (this.filter === id) button.addClass("is-active");
      button.addEventListener("click", () => {
        this.filter = id;
        this.render();
      });
    }

    const events = (settings.events || []).filter((event) => this.filter === "all" || event.category === this.filter);
    if (mobile) {
      this.renderMobileAgenda(root, settings, events);
      return;
    }
    const first = new Date(this.cursor.getFullYear(), this.cursor.getMonth(), 1);
    const last = new Date(this.cursor.getFullYear(), this.cursor.getMonth() + 1, 0);
    const rows = eventsInRange(events, this.key(first), this.key(last));
    const byDay = new Map();
    for (const row of rows) {
      if (!byDay.has(row.key)) byDay.set(row.key, []);
      byDay.get(row.key).push(row.event);
    }

    const card = root.createDiv({ cls: "qt-study-card" });
    card.createEl("h3", { text: `${MONTHS[this.cursor.getMonth()]} ${this.cursor.getFullYear()}` });
    const grid = card.createDiv({ cls: "qt-local-events-grid" });
    const weekStartsOn = settings.weekStartsOn === "sunday" ? "sunday" : "monday";
    const labels = weekStartsOn === "sunday" ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    for (const label of labels) grid.createDiv({ cls: "qt-local-events-weekday", text: label });
    for (const cell of monthCells(this.cursor.getFullYear(), this.cursor.getMonth(), weekStartsOn, new Date())) {
      const day = grid.createDiv({ cls: "qt-local-events-cell" });
      if (!cell.inMonth) day.addClass("is-other-month");
      if (cell.isToday) day.addClass("is-today");
      if (cell.key === this.selected) day.addClass("is-selected");
      day.createDiv({ cls: "qt-local-events-day", text: String(cell.day) });
      const dayEvents = byDay.get(cell.key) || [];
      for (const event of dayEvents.slice(0, 3)) {
        const tab = day.createDiv({ cls: "qt-local-events-tab-item", text: event.title });
        if (tab.style) tab.style.backgroundColor = event.color;
        makeKeyboardClickable(
          tab,
          (ev) => {
            if (ev && ev.stopPropagation) ev.stopPropagation();
            this.openEdit(event.id);
          },
          { label: event.title || "Event" }
        );
      }
      makeKeyboardClickable(
        day,
        () => {
          this.selected = cell.key;
          this.render();
        },
        { label: dayLabel(cell.key) }
      );
    }

    const listCard = root.createDiv({ cls: "qt-study-card" });
    listCard.createEl("h3", { text: this.selected });
    const selectedEvents = (byDay.get(this.selected) || []).slice();
    if (!selectedEvents.length) {
      listCard.createDiv({ cls: "qt-study-empty", text: "No events on this day." });
      return;
    }
    const list = listCard.createDiv({ cls: "qt-study-list" });
    for (const event of selectedEvents) {
      const row = list.createDiv({ cls: "qt-study-row" });
      const main = row.createDiv({ cls: "qt-study-row-main" });
      const title = main.createDiv({ cls: "qt-study-row-title", text: event.title });
      if (title.style) title.style.color = event.color;
      main.createDiv({ cls: "qt-study-row-meta", text: eventMeta(event) });
      if (event.notes) main.createDiv({ cls: "qt-study-row-meta", text: event.notes });
      const buttons = row.createDiv({ cls: "qt-study-row-actions" });
      buttons.createEl("button", { text: "Edit" }).addEventListener("click", () => this.openEdit(event.id));
      buttons.createEl("button", { text: "Delete", cls: "qt-danger" }).addEventListener("click", async () => {
        await this.plugin.deleteLocalEvent(event.id);
        this.render();
      });
    }
  }

  renderMobileAgenda(root, settings, events) {
    root.addClass("qt-day-agenda-phone");
    const weekStart = startOfWeek(this.selected, settings.weekStartsOn);
    const weekEnd = addDaysKey(weekStart, 6);
    const counts = new Map();
    for (const row of eventsInRange(events, weekStart, weekEnd)) counts.set(row.key, (counts.get(row.key) || 0) + 1);
    const selectedEvents = eventsOnDate(events, this.selected);
    const agenda = root.createDiv({ cls: "qt-day-agenda qt-local-events-agenda" });
    const nav = agenda.createDiv({ cls: "qt-day-agenda-nav" });
    nav.createEl("button", { cls: "qt-day-agenda-step", text: "Prev", attr: { "aria-label": "Previous day" } }).addEventListener("click", () => this.shiftDay(-1));
    const title = nav.createDiv({ cls: "qt-day-agenda-title" });
    title.createDiv({ cls: "qt-day-agenda-date", text: dayLabel(this.selected) });
    title.createDiv({
      cls: "qt-day-agenda-sub",
      text: selectedEvents.length ? `${selectedEvents.length} event${selectedEvents.length === 1 ? "" : "s"}` : "No events",
    });
    nav.createEl("button", { cls: "qt-day-agenda-step", text: "Next", attr: { "aria-label": "Next day" } }).addEventListener("click", () => this.shiftDay(1));

    const labels = settings.weekStartsOn === "sunday" ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] : WEEK_LABELS;
    const week = agenda.createDiv({ cls: "qt-day-agenda-week" });
    for (let index = 0; index < 7; index++) {
      const key = addDaysKey(weekStart, index);
      const cell = week.createDiv({ cls: "qt-day-agenda-day" });
      if (key === todayKey(new Date())) cell.addClass("is-today");
      if (key === this.selected) cell.addClass("is-selected");
      cell.setAttr("aria-label", dayLabel(key));
      cell.createDiv({ cls: "qt-day-agenda-day-label", text: labels[index] });
      cell.createDiv({ cls: "qt-day-agenda-day-number", text: String(Number(key.slice(8))) });
      const total = counts.get(key) || 0;
      cell.createDiv({ cls: "qt-day-agenda-day-count", text: total ? String(total) : "·" });
      makeKeyboardClickable(cell, () => this.selectDay(key));
    }

    const listCard = agenda.createDiv({ cls: "qt-study-card qt-day-agenda-list" });
    if (!selectedEvents.length) listCard.addClass("is-empty");
    listCard.createEl("h3", { text: "Events this day" });
    if (!selectedEvents.length) {
      listCard.createDiv({ cls: "qt-study-empty", text: "No events on this day." });
      return;
    }
    const list = listCard.createDiv({ cls: "qt-study-list" });
    for (const event of selectedEvents) {
      const row = list.createDiv({ cls: "qt-study-row qt-day-agenda-row qt-day-agenda-event" });
      if (row.style) row.style.borderLeftColor = event.color;
      row.createDiv({
        cls: "qt-day-agenda-time",
        text: event.startTime ? `${event.startTime}${event.endTime ? `–${event.endTime}` : ""}` : "All day",
      });
      const main = row.createDiv({ cls: "qt-study-row-main" });
      const eventTitle = main.createDiv({ cls: "qt-study-row-title", text: event.title });
      if (eventTitle.style) eventTitle.style.color = event.color;
      main.createDiv({ cls: "qt-study-row-meta", text: eventMeta(event) });
      if (event.notes) main.createDiv({ cls: "qt-study-row-meta", text: event.notes });
      const buttons = row.createDiv({ cls: "qt-study-row-actions" });
      buttons.createEl("button", { text: "Edit" }).addEventListener("click", () => this.openEdit(event.id));
      buttons.createEl("button", { text: "Delete", cls: "qt-danger" }).addEventListener("click", async () => {
        await this.plugin.deleteLocalEvent(event.id);
        this.render();
      });
    }
  }

  key(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  openNew() {
    new LocalEventModal(this.plugin.app, this.plugin, null).open();
  }

  openEdit(id) {
    const event = (this.plugin.settings.localEvents.events || []).find((item) => item.id === id);
    if (event) new LocalEventModal(this.plugin.app, this.plugin, event).open();
  }

  shiftMonth(delta) {
    this.cursor = new Date(this.cursor.getFullYear(), this.cursor.getMonth() + delta, 1);
    this.render();
  }

  goToday() {
    const now = new Date();
    this.cursor = new Date(now.getFullYear(), now.getMonth(), 1);
    this.selected = todayKey(now);
    this.render();
  }
}

module.exports = {
  LocalEventModal,
  LocalEventsView,
};
