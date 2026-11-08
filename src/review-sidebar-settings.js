"use strict";
const { Setting } = require("obsidian");
const { normalizeReviewSidebarSettings } = require("./review-sidebar-model");
const { workloadLabel } = require("./review-calendar");

function renderReviewSidebarSettings(containerEl, plugin, redisplay) {
  const st = plugin.settings;
  st.reviewSidebar = normalizeReviewSidebarSettings(st.reviewSidebar);
  containerEl.createEl("h2", { text: "Review schedule sidebar" });
  containerEl.createEl("p", {
    cls: "setting-item-description",
    text: "A persistent sidebar with due whole notes, estimates, a manual time target, day filters and the Pomodoro timer. It reads the same queue and next_review properties as the dock and calendar; no second schedule is stored.",
  });
  new Setting(containerEl)
    .setName("Enable the review sidebar")
    .setDesc("Adds the Review schedule view, ribbon button and Open review sidebar command.")
    .addToggle((toggle) =>
      toggle.setValue(plugin.reviewSidebarEnabled()).onChange(async (value) => {
        st.reviewSidebar = normalizeReviewSidebarSettings({ ...st.reviewSidebar, enabled: value });
        await plugin.save();
        plugin.refreshRibbon();
        if (!value) plugin.detachModuleLeaves([require("./constants").VIEW_TYPE_REVIEW_SIDEBAR]);
        plugin.refreshViews();
        redisplay();
      })
    );
  new Setting(containerEl)
    .setName("Default sort")
    .setDesc("The order used when the sidebar opens.")
    .addDropdown((dropdown) => {
      dropdown.addOption("due", "Due date");
      dropdown.addOption("title", "Title");
      dropdown.addOption("time", "Longest first");
      dropdown.addOption("priority", "Priority");
      dropdown.setValue(st.reviewSidebar.sort).onChange(async (value) => {
        st.reviewSidebar = normalizeReviewSidebarSettings({ ...st.reviewSidebar, sort: value });
        await plugin.save();
        plugin.refreshViews();
      });
    });
  new Setting(containerEl)
    .setName("Upcoming window")
    .setDesc("How many days ahead the list shows. The full review calendar always keeps its own 400-day forecast.")
    .addText((text) => {
      text.inputEl.type = "number";
      text.inputEl.min = "1";
      text.inputEl.max = "90";
      text.setValue(String(st.reviewSidebar.upcomingDays));
      text.onChange(async (value) => {
        st.reviewSidebar = normalizeReviewSidebarSettings({ ...st.reviewSidebar, upcomingDays: value });
        await plugin.save();
        plugin.refreshViews();
      });
    });
  new Setting(containerEl)
    .setName("Show time estimates")
    .setDesc("Use the recorded average review time, falling back to the review calendar's per-note estimate.")
    .addToggle((toggle) =>
      toggle.setValue(st.reviewSidebar.showEstimates).onChange(async (value) => {
        st.reviewSidebar = normalizeReviewSidebarSettings({ ...st.reviewSidebar, showEstimates: value });
        await plugin.save();
        plugin.refreshViews();
      })
    );
  new Setting(containerEl)
    .setName("Manual time override")
    .setDesc("Add extra time to the estimate (a Buffer) or replace it with a target. This changes only the displayed target, never a due date.")
    .addText((hours) => {
      hours.inputEl.type = "number";
      hours.inputEl.min = "0";
      hours.inputEl.max = "24";
      hours.setPlaceholder("hours");
      hours.setValue(String(st.reviewSidebar.overrideHours));
      hours.onChange(async (value) => {
        st.reviewSidebar = normalizeReviewSidebarSettings({ ...st.reviewSidebar, overrideHours: value });
        await plugin.save();
        plugin.refreshViews();
      });
    })
    .addText((minutes) => {
      minutes.inputEl.type = "number";
      minutes.inputEl.min = "0";
      minutes.inputEl.max = "59";
      minutes.setPlaceholder("minutes");
      minutes.setValue(String(st.reviewSidebar.overrideMinutes));
      minutes.onChange(async (value) => {
        st.reviewSidebar = normalizeReviewSidebarSettings({ ...st.reviewSidebar, overrideMinutes: value });
        await plugin.save();
        plugin.refreshViews();
      });
    })
    .addDropdown((dropdown) => {
      dropdown.addOption("add", "Add");
      dropdown.addOption("replace", "Replace");
      dropdown.setValue(st.reviewSidebar.overrideMode).onChange(async (value) => {
        st.reviewSidebar = normalizeReviewSidebarSettings({ ...st.reviewSidebar, overrideMode: value });
        await plugin.save();
        plugin.refreshViews();
      });
    });
  new Setting(containerEl)
    .setName("Show Pomodoro in the sidebar")
    .setDesc("Keep the current phase and countdown next to the due list. The timer state stays in plugin data.")
    .addToggle((toggle) =>
      toggle.setValue(st.reviewSidebar.showPomodoro).onChange(async (value) => {
        st.reviewSidebar = normalizeReviewSidebarSettings({ ...st.reviewSidebar, showPomodoro: value });
        await plugin.save();
        plugin.refreshViews();
      })
    );
  const queue = plugin.getNoteQueue({ limit: 0 });
  new Setting(containerEl)
    .setName("Due now")
    .setDesc(`${queue.counts.due} note${queue.counts.due === 1 ? "" : "s"} · ${workloadLabel(plugin.reviewCalendarSnapshot({ days: 7 }).next7.minutes)} in the next 7 days.`)
    .addButton((button) => button.setButtonText("Open review sidebar").onClick(() => plugin.activateReviewSidebar()))
    .addButton((button) => button.setButtonText("Open review calendar").onClick(() => plugin.activateReviewCalendar()));
  containerEl.createEl("p", {
    cls: "setting-item-description",
    text: "Next review note and Previous review note are commands, so you can assign your own hotkeys in Obsidian → Hotkeys.",
  });
}

module.exports = { renderReviewSidebarSettings };
