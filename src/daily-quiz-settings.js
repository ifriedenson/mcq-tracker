"use strict";
const { Setting } = require("obsidian");
const { localDate } = require("./util");
const { dailyDone, dailyStreak, foldersText, normalizeDailyQuiz } = require("./daily-quiz");
const { adaptiveDailyCount, normalizeQuickAdaptive } = require("./adaptive-session");
const { normalizeSimpleQuiz, simpleQuizDaySummary } = require("./simple-quiz");
const { normalizeSimpleNoteQuiz } = require("./simple-note-quiz");

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

  const adaptive = normalizeQuickAdaptive(st.quickAdaptive);
  const plan = adaptiveDailyCount(plugin.getQuestions ? plugin.getQuestions() : [], daily, { today, settings: adaptive });
  new Setting(containerEl)
    .setName("Adapt the daily count")
    .setDesc(
      adaptive.enabled
        ? `Today's set would use ${plan.value} question${plan.value === 1 ? "" : "s"} (${plan.band}). ${plan.reason || "The configured maximum still applies."}`
        : "Use the same recent-recall signal as Quick Practice to warm up or stretch the daily set. Off by default."
    )
    .addToggle((toggle) =>
      toggle.setValue(adaptive.enabled).onChange(async (value) => {
        st.quickAdaptive = { ...adaptive, enabled: value };
        await plugin.save();
        plugin.refreshViews();
        redisplay();
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

  new Setting(containerEl).setName("Simple quiz blocks").setHeading();
  const simple = normalizeSimpleQuiz(st.simpleQuiz);
  const simpleToday = simpleQuizDaySummary(simple, today);
  containerEl.createEl("p", {
    cls: "setting-item-description",
    text: "Add a quiz block to a note to review cards loaded from quizjson blocks, a quizjs block or a JSON card list. quiztoday and quizcharts show its local streak and counts. This is separate from the question scheduler and the daily quiz.",
  });
  new Setting(containerEl)
    .setName("Allow JavaScript card blocks")
    .setDesc("Off by default. quizjs blocks run trusted JavaScript from the note with fc.addCard() and fc.commit(). JavaScript is not sandboxed, so only enable it for notes you trust.")
    .addToggle((toggle) =>
      toggle.setValue(simple.enableJavaScript).onChange(async (value) => {
        st.simpleQuiz = { ...normalizeSimpleQuiz(st.simpleQuiz), enableJavaScript: value };
        await plugin.save();
        redisplay();
      })
    );
  new Setting(containerEl)
    .setName("Simple quiz stats")
    .setDesc(`${simpleToday.streak} day streak · best ${simple.best} · ${simpleToday.cards} cards and ${simpleToday.quizzes} quizzes today.`)
    .addButton((button) =>
      button.setButtonText("Reset stats").onClick(async () => {
        const next = normalizeSimpleQuiz(st.simpleQuiz);
        st.simpleQuiz = { ...next, stats: { days: {}, streak: 0, best: 0, lastCompleted: "" } };
        await plugin.save();
        redisplay();
      })
    );

  new Setting(containerEl).setName("Simple note quiz").setHeading();
  const noteQuiz = normalizeSimpleNoteQuiz(st.simpleNoteQuiz);
  containerEl.createEl("p", {
    cls: "setting-item-description",
    text: "Run Simple note quiz: start on this note. Lines ending with your question marker become questions; the lines below them become answers. Known and missed marks stay in the note and do not change the question scheduler.",
  });
  new Setting(containerEl)
    .setName("Question marker")
    .setDesc("A non-empty line ending with this text becomes a question. Default: ?")
    .addText((text) =>
      text.setValue(noteQuiz.questionMark).onChange(async (value) => {
        const requested = String(value || "").trim();
        if (!requested) return;
        st.simpleNoteQuiz = { ...normalizeSimpleNoteQuiz(st.simpleNoteQuiz), questionMark: requested.slice(0, 16) };
        await plugin.save();
      })
    );
  new Setting(containerEl)
    .setName("Answer separator")
    .setDesc("Blank line ends an answer, or start the next question with an unindented bullet.")
    .addDropdown((dropdown) =>
      dropdown
        .addOption("blank", "Blank line")
        .addOption("bullet", "Next unindented bullet")
        .setValue(noteQuiz.separator)
        .onChange(async (value) => {
          st.simpleNoteQuiz = { ...normalizeSimpleNoteQuiz(st.simpleNoteQuiz), separator: value };
          await plugin.save();
        })
    );
  new Setting(containerEl)
    .setName("Shuffle note questions")
    .setDesc("Shuffle the questions chosen for each Simple note quiz session.")
    .addToggle((toggle) =>
      toggle.setValue(noteQuiz.shuffle).onChange(async (value) => {
        st.simpleNoteQuiz = { ...normalizeSimpleNoteQuiz(st.simpleNoteQuiz), shuffle: value };
        await plugin.save();
      })
    );
}

module.exports = {
  renderDailySettings,
};
