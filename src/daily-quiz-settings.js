"use strict";
const { Setting } = require("obsidian");
const { localDate } = require("./util");
const { dailyDone, dailyStreak, foldersText, normalizeDailyQuiz } = require("./daily-quiz");

function renderDailySettings(containerEl, plugin, redisplay) {
  const st = plugin.settings;
  const daily = normalizeDailyQuiz(st.dailyQuiz);
  const today = localDate();
  const streak = dailyStreak(daily, today);
  const done = dailyDone(daily, today);

  new Setting(containerEl).setName("Daily quiz").setHeading();
  containerEl.createEl("p", {
    cls: "setting-item-description",
    text: "A small set of questions chosen once per day from the folders you pick. It is opt-in, stays local, and sends no notifications. Reviews use your normal scheduler and history.",
  });

  new Setting(containerEl)
    .setName("Enable the daily quiz")
    .setDesc("Adds a Daily quiz command, a card on Today, and a start button here.")
    .addToggle((toggle) =>
      toggle.setValue(daily.enabled).onChange(async (value) => {
        st.dailyQuiz = { ...normalizeDailyQuiz(st.dailyQuiz), enabled: value };
        await plugin.save();
        plugin.refreshViews();
        redisplay();
      })
    );

  new Setting(containerEl)
    .setName("Questions per day")
    .setDesc("Between 1 and 50. If fewer questions match, the quiz uses what is available.")
    .addText((text) =>
      text
        .setValue(String(daily.count))
        .setPlaceholder("5")
        .onChange(async (value) => {
          const count = parseInt(value, 10);
          if (!Number.isFinite(count) || count < 1) return;
          st.dailyQuiz = { ...normalizeDailyQuiz(st.dailyQuiz), count: Math.min(50, count) };
          await plugin.save();
          plugin.refreshViews();
        })
    );

  new Setting(containerEl)
    .setName("Folders")
    .setDesc("One folder path per line. Leave empty to draw from every question note. Subfolders are included.")
    .addTextArea((area) =>
      area
        .setValue(foldersText(daily.folders))
        .setPlaceholder("Questions/SAT\nQuestions/AP Biology")
        .onChange(async (value) => {
          st.dailyQuiz = { ...normalizeDailyQuiz(st.dailyQuiz), folders: value };
          await plugin.save();
          plugin.refreshViews();
        })
    );

  new Setting(containerEl)
    .setName("Current streak")
    .setDesc(`${streak} day${streak === 1 ? "" : "s"} · best ${daily.best} · ${done ? "today is complete" : "today is not complete yet"}`)
    .addButton((button) => button.setButtonText("Start today's quiz").setCta().onClick(() => plugin.startDailyQuiz()))
    .addExtraButton((button) =>
      button
        .setIcon("reset")
        .setTooltip("Reset the daily streak")
        .onClick(async () => {
          st.dailyQuiz = { ...normalizeDailyQuiz(st.dailyQuiz), streak: 0, best: 0, lastCompleted: "" };
          await plugin.save();
          plugin.refreshViews();
          redisplay();
        })
    );

  containerEl.createEl("p", {
    cls: "setting-item-description",
    text: "The streak counts days on which you finish the whole daily set. It is separate from study-time and question streaks.",
  });
}

module.exports = {
  renderDailySettings,
};
