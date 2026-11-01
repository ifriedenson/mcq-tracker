"use strict";
/* Settings pages for the four Spaceforge-derived study tools. */
const { Setting } = require("obsidian");
const { LOCAL_EVENT_CATEGORIES } = require("./local-events");
const { normalizeNoteReviewDockSettings } = require("./note-review-dock");
const { normalizeReviewCalendarSettings, workloadLabel } = require("./review-calendar");
const { normalizeStudyStatsSettings } = require("./study-stats");

function heading(containerEl, title, description) {
  containerEl.createEl("h2", { text: title });
  containerEl.createEl("p", { cls: "setting-item-description", text: description });
}

function renderNoteReviewSettings(containerEl, plugin, redisplay) {
  const st = plugin.settings;
  st.noteReviewDock = normalizeNoteReviewDockSettings(st.noteReviewDock);
  heading(
    containerEl,
    "Note review",
    "A grading bar docked under the open note. It reuses the whole-note queue and the same ladder, FSRS or SM-2 scheduler as the review modal; no second schedule is kept."
  );
  new Setting(containerEl)
    .setName("Enable the docked review bar")
    .setDesc("Show Again/Hard/Good/Easy under a due note, with the exact next interval on each button.")
    .addToggle((t) =>
      t.setValue(plugin.noteReviewDockEnabled()).onChange(async (v) => {
        st.noteReviewDock.enabled = v;
        await plugin.save();
        plugin.refreshNoteReviewDock();
        redisplay();
      })
    );
  new Setting(containerEl)
    .setName("Keyboard grading")
    .setDesc("Use 1–4 (or 0–5) to grade, n to skip, p to postpone one day and u to undo. Typing in a field is left alone.")
    .addToggle((t) =>
      t.setValue(st.noteReviewDock.keyboard).onChange(async (v) => {
        st.noteReviewDock.keyboard = v;
        await plugin.save();
        plugin.refreshNoteReviewDock();
      })
    );
  new Setting(containerEl)
    .setName("Requeue missed notes in this session")
    .setDesc("A missed note moves behind the notes still waiting and returns before the run ends. A limit prevents one impossible note from trapping the session.")
    .addToggle((t) =>
      t.setValue(st.noteReviewDock.requeueEnabled !== false).onChange(async (v) => {
        st.noteReviewDock.requeueEnabled = v;
        await plugin.save();
        plugin.refreshNoteReviewDock();
      })
    );
  new Setting(containerEl)
    .setName("Requeue limit")
    .setDesc("How many times one note may return in a single session.")
    .addText((t) => {
      t.inputEl.type = "number";
      t.inputEl.min = "1";
      t.inputEl.max = "25";
      t.setValue(String(st.noteReviewDock.requeueLimit));
      t.onChange(async (v) => {
        st.noteReviewDock = normalizeNoteReviewDockSettings({ ...st.noteReviewDock, requeueLimit: v });
        await plugin.save();
      });
    });
  new Setting(containerEl)
    .setName("Grade layout")
    .setDesc("How the four grading buttons are arranged under the note: one row, a stacked list, or auto by pane width.")
    .addDropdown((d) => {
      d.addOption("auto", "Auto by pane width");
      d.addOption("row", "One row");
      d.addOption("stacked", "Stacked list");
      d.setValue(st.noteReviewDock.gradeLayout).onChange(async (v) => {
        st.noteReviewDock = normalizeNoteReviewDockSettings({ ...st.noteReviewDock, gradeLayout: v });
        await plugin.save();
        plugin.refreshNoteReviewDock();
      });
    });
  new Setting(containerEl)
    .setName("Save a session report")
    .setDesc("When a docked review run ends, offer a Save session report button and add the same action as a command.")
    .addToggle((t) =>
      t.setValue(st.noteReviewDock.reportEnabled === true).onChange(async (v) => {
        st.noteReviewDock = normalizeNoteReviewDockSettings({ ...st.noteReviewDock, reportEnabled: v });
        await plugin.save();
        plugin.refreshNoteReviewDock();
      })
    );
  new Setting(containerEl)
    .setName("Session report folder")
    .setDesc("Vault folder for the report note. Leave empty to write it at the vault root.")
    .addText((t) => {
      t.setPlaceholder("Review reports");
      t.setValue(st.noteReviewDock.reportFolder || "");
      t.onChange(async (v) => {
        st.noteReviewDock = normalizeNoteReviewDockSettings({ ...st.noteReviewDock, reportFolder: v });
        await plugin.save();
      });
    });
  new Setting(containerEl)
    .setName("Lapse checkpoint")
    .setDesc("After this many Again ratings in a row, offer Reset, Rest for a week, Remove from review or Carry on.")
    .addText((t) => {
      t.inputEl.type = "number";
      t.inputEl.min = "1";
      t.inputEl.max = "50";
      t.setValue(String(st.noteReviewDock.lapseThreshold));
      t.onChange(async (v) => {
        st.noteReviewDock = normalizeNoteReviewDockSettings({ ...st.noteReviewDock, lapseThreshold: v });
        await plugin.save();
      });
    });
  const queue = plugin.getNoteQueue({ limit: 0 });
  new Setting(containerEl)
    .setName("Due now")
    .setDesc(`${queue.counts.due} note${queue.counts.due === 1 ? "" : "s"} in the whole-note queue; ${queue.counts.new} new.`)
    .addButton((b) => b.setButtonText("Open next due note").onClick(() => plugin.openNextDueNote()));
  new Setting(containerEl)
    .setName("Whole-note queue settings")
    .setDesc("Note sets, priorities and the review limit stay on the MCQ Tracker page, Review tab.")
    .addButton((b) => b.setButtonText("Open review settings").onClick(() => plugin.openSettings()));
}

function renderReviewCalendarSettings(containerEl, plugin, redisplay) {
  const st = plugin.settings;
  st.reviewCalendar = normalizeReviewCalendarSettings(st.reviewCalendar);
  heading(
    containerEl,
    "Review calendar",
    "A due-date calendar and next-7-day workload estimate for whole notes and cards. It reads next_review; imported .ics classes and exam-aware question scheduling are not involved."
  );
  new Setting(containerEl)
    .setName("Enable Review calendar")
    .setDesc("Adds its view, ribbon button and commands.")
    .addToggle((t) =>
      t.setValue(plugin.reviewCalendarEnabled()).onChange(async (v) => {
        st.reviewCalendar.enabled = v;
        await plugin.save();
        await plugin.onReviewCalendarToggled();
        redisplay();
      })
    );
  new Setting(containerEl)
    .setName("Minutes per note review")
    .setDesc("Fallback estimate for notes with no recorded review time. Recorded average times are used when available.")
    .addText((t) => {
      t.inputEl.type = "number";
      t.inputEl.min = "0.25";
      t.inputEl.max = "60";
      t.inputEl.step = "0.25";
      t.setValue(String(st.reviewCalendar.noteMinutes));
      t.onChange(async (v) => {
        st.reviewCalendar = normalizeReviewCalendarSettings({ ...st.reviewCalendar, noteMinutes: v });
        await plugin.save();
      });
    });
  new Setting(containerEl)
    .setName("Minutes per card review")
    .setDesc("Fallback estimate for cards with no recorded review time.")
    .addText((t) => {
      t.inputEl.type = "number";
      t.inputEl.min = "0.25";
      t.inputEl.max = "60";
      t.inputEl.step = "0.25";
      t.setValue(String(st.reviewCalendar.cardMinutes));
      t.onChange(async (v) => {
        st.reviewCalendar = normalizeReviewCalendarSettings({ ...st.reviewCalendar, cardMinutes: v });
        await plugin.save();
      });
    });
  new Setting(containerEl)
    .setName("Include cards")
    .setDesc("Show card due dates beside whole-note due dates.")
    .addToggle((t) =>
      t.setValue(st.reviewCalendar.showCards !== false).onChange(async (v) => {
        st.reviewCalendar.showCards = v;
        await plugin.save();
        plugin.refreshViews();
      })
    );
  new Setting(containerEl)
    .setName("Detect a folder's main note")
    .setDesc("When adding a folder, offer the note with the most outgoing links as its main note.")
    .addToggle((t) =>
      t.setValue(st.reviewCalendar.detectMainNote !== false).onChange(async (v) => {
        st.reviewCalendar.detectMainNote = v;
        await plugin.save();
      })
    );
  const forecast = plugin.reviewCalendarSnapshot({ days: 7 });
  new Setting(containerEl)
    .setName("Next 7 days")
    .setDesc(`${forecast.next7.total} review${forecast.next7.total === 1 ? "" : "s"} · ${workloadLabel(forecast.next7.minutes)} estimated.`)
    .addButton((b) => b.setButtonText("Open review calendar").onClick(() => plugin.activateReviewCalendar()))
    .addButton((b) => b.setButtonText("Add this note").onClick(() => plugin.addActiveNoteToReview()))
    .addButton((b) => b.setButtonText("Add this folder").onClick(() => plugin.addActiveFolderToReview()));
}

function renderStudyStatsSettings(containerEl, plugin, redisplay) {
  const st = plugin.settings;
  st.studyStats = normalizeStudyStatsSettings(st.studyStats);
  heading(
    containerEl,
    "Study statistics",
    "An Anki-style, read-only dashboard: true retention by card maturity, memory-now, interval/ease/stability/difficulty distributions, weekday rhythm, day detail and leeches."
  );
  new Setting(containerEl)
    .setName("Enable Study statistics")
    .setDesc("Adds its view, ribbon button and command.")
    .addToggle((t) =>
      t.setValue(plugin.studyStatsEnabled()).onChange(async (v) => {
        st.studyStats.enabled = v;
        await plugin.save();
        await plugin.onStudyStatsToggled();
        redisplay();
      })
    );
  new Setting(containerEl)
    .setName("Leech list threshold")
    .setDesc("Show an item after this many lapses. It is only a report; no item is suspended here.")
    .addText((t) => {
      t.inputEl.type = "number";
      t.inputEl.min = "1";
      t.inputEl.max = "50";
      t.setValue(String(st.studyStats.leechThreshold));
      t.onChange(async (v) => {
        st.studyStats = normalizeStudyStatsSettings({ ...st.studyStats, leechThreshold: v });
        await plugin.save();
        plugin.refreshViews();
      });
    });
  new Setting(containerEl)
    .setName("Track two-day durable recall")
    .setDesc("A correct review counts as durable only after a correct recall on two distinct calendar days. A miss starts the run again; the review history itself is unchanged.")
    .addToggle((t) =>
      t.setValue(st.studyStats.durableRecall !== false).onChange(async (v) => {
        st.studyStats.durableRecall = v;
        await plugin.save();
        plugin.refreshViews();
      })
    );
  new Setting(containerEl)
    .setName("Durable recall days")
    .setDesc("Distinct days required before an item is reported as durable (2–10).")
    .addText((t) => {
      t.inputEl.type = "number";
      t.inputEl.min = "2";
      t.inputEl.max = "10";
      t.setValue(String(st.studyStats.durableDays || 2));
      t.onChange(async (v) => {
        st.studyStats = normalizeStudyStatsSettings({ ...st.studyStats, durableDays: v });
        await plugin.save();
        plugin.refreshViews();
      });
    });
  new Setting(containerEl)
    .setName("Heatmap weeks")
    .setDesc("How many weeks of permanent per-day counters to show.")
    .addText((t) => {
      t.inputEl.type = "number";
      t.inputEl.min = "4";
      t.inputEl.max = "52";
      t.setValue(String(st.studyStats.heatmapWeeks || 12));
      t.onChange(async (v) => {
        st.studyStats = normalizeStudyStatsSettings({ ...st.studyStats, heatmapWeeks: v });
        await plugin.save();
        plugin.refreshViews();
      });
    });
  new Setting(containerEl)
    .setName("Open the dashboard")
    .setDesc("The dashboard is independent of the accuracy-by-skill charts on the Insights page.")
    .addButton((b) => b.setButtonText("Open Study statistics").onClick(() => plugin.activateStudyStats()));
}

function renderLocalEventsSettings(containerEl, plugin, redisplay) {
  const st = plugin.settings;
  heading(
    containerEl,
    "Local events",
    "Your own calendar events, stored in plugin data. They are separate from imported .ics feeds and read-only Full Calendar notes; recurrence is expanded locally and no network request is made."
  );
  new Setting(containerEl)
    .setName("Enable Local events")
    .setDesc("Adds its view, ribbon button and commands.")
    .addToggle((t) =>
      t.setValue(plugin.localEventsEnabled()).onChange(async (v) => {
        st.localEvents.enabled = v;
        await plugin.save();
        await plugin.onLocalEventsToggled();
        redisplay();
      })
    );
  new Setting(containerEl)
    .setName("Default category")
    .setDesc("The category selected for a new event.")
    .addDropdown((d) => {
      for (const category of LOCAL_EVENT_CATEGORIES) d.addOption(category.id, category.label);
      d.setValue(st.localEvents.defaultCategory || "study").onChange(async (v) => {
        st.localEvents.defaultCategory = v;
        await plugin.save();
      });
    });
  new Setting(containerEl)
    .setName("Week starts on")
    .setDesc("Used by the month grid.")
    .addDropdown((d) => {
      d.addOption("monday", "Monday");
      d.addOption("sunday", "Sunday");
      d.setValue(st.localEvents.weekStartsOn || "monday").onChange(async (v) => {
        st.localEvents.weekStartsOn = v;
        await plugin.save();
        plugin.refreshViews();
      });
    });
  new Setting(containerEl)
    .setName("Events")
    .setDesc(`${(st.localEvents.events || []).length} local event${(st.localEvents.events || []).length === 1 ? "" : "s"}.`)
    .addButton((b) => b.setButtonText("Open events").onClick(() => plugin.activateLocalEvents()))
    .addButton((b) => b.setButtonText("New event").onClick(() => plugin.openNewLocalEvent()));
}

module.exports = {
  renderLocalEventsSettings,
  renderNoteReviewSettings,
  renderReviewCalendarSettings,
  renderStudyStatsSettings,
};
