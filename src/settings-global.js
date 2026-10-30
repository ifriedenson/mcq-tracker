"use strict";
/*
 * Global settings: one switch per module, plus the few options that apply to the
 * whole plugin. Each module keeps its own detailed settings on its own page.
 */
const { Notice, Setting } = require("obsidian");
const { openExternal, renderSettingsTabs } = require("./settings-ui");
const { normalizeSupport, supportLinks } = require("./support");
const { SURVEY_ROLES, copySurveySummary } = require("./survey");

const GLOBAL_TABS = [
  { id: "modules", label: "Modules", icon: "toggle-left" },
  { id: "general", label: "General", icon: "sliders-horizontal" },
  { id: "about", label: "About", icon: "info" },
];

function renderGlobalSettings(containerEl, plugin, redisplay, activeTab, setTab) {
  const current = GLOBAL_TABS.some((tab) => tab.id === activeTab) ? activeTab : "modules";
  renderSettingsTabs(
    containerEl,
    GLOBAL_TABS,
    current,
    (id) => (typeof setTab === "function" ? setTab(id) : redisplay()),
    { className: "qt-settings-tabs", tabClass: "qt-settings-tab" }
  );

  const section = containerEl.createDiv({ cls: "qt-settings-section" });
  if (current === "general") return renderGeneral(section, plugin, redisplay);
  if (current === "about") return renderGlobalAbout(section, plugin, redisplay);
  return renderModules(section, plugin, redisplay);
}

function renderModules(containerEl, plugin, redisplay) {
  const st = plugin.settings;
  containerEl.createEl("p", {
    cls: "setting-item-description",
    text: "Turn off the parts of the plugin you don't use. A module that is off keeps its settings and your notes; it just stops showing its views, ribbon button and commands.",
  });

  new Setting(containerEl).setName("Modules").setHeading();

  new Setting(containerEl)
    .setName("MCQ Tracker")
    .setDesc("Practice questions from your notes: filters and presets, weak spots, the error log, timed tests and document import. Off hides the practice view and its other views.")
    .addToggle((t) =>
      t.setValue(plugin.mcqEnabled()).onChange(async (v) => {
        st.mcqEnabled = v;
        await plugin.save();
        await plugin.onMcqToggled();
        redisplay();
      })
    );

  new Setting(containerEl)
    .setName("Cards and vocabulary")
    .setDesc("Flashcards and vocabulary notes with decks, course tags and the same spaced review as your questions. Off by default; its own settings are under Cards.")
    .addToggle((t) =>
      t.setValue(plugin.cardsEnabled()).onChange(async (v) => {
        st.cards.enabled = v;
        await plugin.save();
        await plugin.onCardsToggled();
        redisplay();
      })
    );

  new Setting(containerEl)
    .setName("Calendar")
    .setDesc("A class and exam calendar from .ics schedules, with countdowns, one-click class notes and study time from free periods. Off by default; its own settings are under Calendar.")
    .addToggle((t) =>
      t.setValue(plugin.calendarEnabled()).onChange(async (v) => {
        st.calendar.enabled = v;
        await plugin.save();
        await plugin.onCalendarToggled();
        redisplay();
      })
    );

  new Setting(containerEl)
    .setName("Assignments")
    .setDesc("A gradebook and task list built from assignment notes: weighted course grades, what you need on the final, a credit-weighted GPA and Tasks-compatible due dates. Its settings are under Assignments.")
    .addToggle((t) =>
      t.setValue(plugin.assignmentsEnabled()).onChange(async (v) => {
        st.assignments.enabled = v;
        await plugin.save();
        await plugin.onAssignmentsToggled();
        redisplay();
      })
    );

  new Setting(containerEl)
    .setName("Reference")
    .setDesc("A local formula sheet, constants list and unit converter in its own view. Off by default; its settings are under Reference.")
    .addToggle((t) =>
      t.setValue(plugin.referenceEnabled()).onChange(async (v) => {
        st.reference.enabled = v;
        await plugin.save();
        await plugin.onReferenceToggled();
        redisplay();
      })
    );

  new Setting(containerEl)
    .setName("AI features")
    .setDesc("Ask AI on the result screen, the AI assistant, and document import. Off by default: nothing is sent anywhere until this is on. Choose the provider under MCQ Tracker, AI.")
    .addToggle((t) =>
      t.setValue(!!st.ai.enabled).onChange(async (v) => {
        st.ai.enabled = v;
        await plugin.save();
        plugin.refreshViews();
        redisplay();
      })
    );

  containerEl.createEl("p", {
    cls: "setting-item-description",
    text: "The settings for a module stay on its own page: MCQ Tracker, Cards, Calendar, Assignments and Reference.",
  });
}

function renderGlobalAbout(containerEl, plugin, redisplay) {
  new Setting(containerEl).setName("Getting started").setHeading();
  containerEl.createEl("p", {
    cls: "setting-item-description",
    text: "The welcome guide explains the main workflows, lets you choose a starting set of modules, and can be reopened at any time.",
  });
  new Setting(containerEl)
    .setName("Welcome guide")
    .setDesc("Open the guided setup and how-to again. It never blocks startup and stores its progress only on this device.")
    .addButton((b) => b.setButtonText("Open welcome guide").onClick(() => plugin.openWelcome()));
  new Setting(containerEl)
    .setName("Quick start and documentation")
    .setDesc("The README covers question-note formats, imports, cards, the calendar and reference tools.")
    .addButton((b) => b.setButtonText("Open README").onClick(() => openExternal("https://github.com/ifriedenson/mcq-tracker#readme")));

  new Setting(containerEl).setName("Feedback and support").setHeading();
  containerEl.createEl("p", {
    cls: "setting-item-description",
    text: "Optional external links. Nothing opens or is submitted automatically, and the plugin never counts clicks. Leave a field blank to hide that link.",
  });
  const st = plugin.settings;
  const support = normalizeSupport(st.support);
  new Setting(containerEl)
    .setName("Show feedback and donation links")
    .setDesc("Show optional links in the welcome guide. The plugin stays MIT and fully usable either way.")
    .addToggle((t) =>
      t.setValue(support.showLinks).onChange(async (v) => {
        st.support = normalizeSupport({ ...normalizeSupport(st.support), showLinks: v });
        await plugin.save();
        if (redisplay) redisplay();
      })
    );
  new Setting(containerEl)
    .setName("Feedback link")
    .setDesc("Opens when the user chooses Send feedback. Defaults to the plugin's GitHub issue page.")
    .addText((t) =>
      t
        .setPlaceholder("https://…")
        .setValue(support.feedbackUrl)
        .onChange(async (v) => {
          st.support = normalizeSupport({ ...normalizeSupport(st.support), feedbackUrl: v });
          await plugin.save();
        })
    );
  new Setting(containerEl)
    .setName("Donation link")
    .setDesc("Optional funding page, for example GitHub Sponsors or Ko-fi. Blank hides the donation button.")
    .addText((t) =>
      t
        .setPlaceholder("Leave blank to hide")
        .setValue(support.donationUrl)
        .onChange(async (v) => {
          st.support = normalizeSupport({ ...normalizeSupport(st.support), donationUrl: v });
          await plugin.save();
        })
    );
  const links = supportLinks(st.support);
  if (links.feedback || links.donation) {
    const row = new Setting(containerEl).setName("Preview links");
    if (links.feedback) row.addButton((b) => b.setButtonText("Open feedback").onClick(() => openExternal(links.feedback)));
    if (links.donation) row.addButton((b) => b.setButtonText("Open donation page").onClick(() => openExternal(links.donation)));
  }
  new Setting(containerEl).setName("Feedback survey").setHeading();
  containerEl.createEl("p", {
    cls: "setting-item-description",
    text: "Optional and local-only. Answers stay in this form until you copy them; nothing is sent, saved or counted automatically.",
  });
  const survey = { rating: 5, role: SURVEY_ROLES[0], likes: "", improve: "", quote: false };
  new Setting(containerEl)
    .setName("How is MCQ Tracker working for you?")
    .addDropdown((d) => {
      for (const n of [1, 2, 3, 4, 5]) d.addOption(String(n), `${n} / 5`);
      d.setValue("5").onChange((v) => (survey.rating = Number(v)));
    });
  new Setting(containerEl)
    .setName("What do you use it for?")
    .addDropdown((d) => {
      for (const role of SURVEY_ROLES) d.addOption(role, role);
      d.setValue(SURVEY_ROLES[0]).onChange((v) => (survey.role = v));
    });
  new Setting(containerEl)
    .setName("What works well?")
    .setDesc("Optional. A sentence or two is plenty.")
    .addTextArea((t) => t.setPlaceholder("Optional").onChange((v) => (survey.likes = v)));
  new Setting(containerEl)
    .setName("What should improve?")
    .setDesc("Optional. Specific workflows or missing formats are the most useful.")
    .addTextArea((t) => t.setPlaceholder("Optional").onChange((v) => (survey.improve = v)));
  new Setting(containerEl)
    .setName("May I quote this feedback?")
    .setDesc("Leave off to keep the feedback anonymous.")
    .addToggle((t) => t.setValue(false).onChange((v) => (survey.quote = v)));
  new Setting(containerEl)
    .setName("Copy the feedback")
    .setDesc("Copies a Markdown summary. Paste it into the feedback link above or any message you choose.")
    .addButton((b) =>
      b.setButtonText("Copy feedback").onClick(async () => {
        try {
          await copySurveySummary(survey);
          new Notice("Feedback copied. Paste it wherever you like.", 5000);
        } catch (e) {
          new Notice(String((e && e.message) || "Could not copy the feedback."), 7000);
        }
      })
    );

  const version = (plugin.manifest && plugin.manifest.version) || "";
  new Setting(containerEl).setName("Version").setDesc(version ? `MCQ Tracker ${version}` : "MCQ Tracker");
}

function renderGeneral(containerEl, plugin, redisplay) {
  const st = plugin.settings;

  new Setting(containerEl).setName("Interface").setHeading();

  new Setting(containerEl)
    .setName("Show ribbon icons")
    .setDesc("The plugin's buttons in the left ribbon, one for each module that is on.")
    .addToggle((t) =>
      t.setValue(st.showRibbonIcons !== false).onChange(async (v) => {
        st.showRibbonIcons = v;
        await plugin.save();
        plugin.onGlobalSettingsChanged();
        redisplay();
      })
    );

  new Setting(containerEl)
    .setName("Daily study goal")
    .setDesc("Minutes of focus and manually logged study per day. Used by the Today focus card and its streak.")
    .addText((t) => {
      t.inputEl.type = "number";
      t.setValue(String(st.studyLog.dailyGoalMinutes));
      t.onChange(async (v) => {
        const n = Math.round(Number(v));
        st.studyLog.dailyGoalMinutes = Number.isFinite(n) ? Math.max(5, Math.min(480, n)) : 60;
        await plugin.save();
        plugin.refreshViews();
      });
    });

  const reminder = st.reminder || { enabled: false, hour: 9 };
  new Setting(containerEl)
    .setName("Daily study reminder")
    .setDesc("A quiet in-app nudge on Today and in the status bar, at most once a day. It never uses an operating-system notification, sends nothing, and is off by default.")
    .addToggle((t) =>
      t.setValue(reminder.enabled === true).onChange(async (v) => {
        st.reminder = { ...reminder, enabled: v };
        await plugin.save();
        plugin.refreshReminder();
        redisplay();
      })
    )
    .addText((t) => {
      t.inputEl.type = "number";
      t.inputEl.min = "0";
      t.inputEl.max = "23";
      t.setValue(String(reminder.hour === undefined ? 9 : reminder.hour));
      t.onChange(async (v) => {
        const hour = Math.round(Number(v));
        if (Number.isFinite(hour)) {
          st.reminder = { ...reminder, hour: Math.max(0, Math.min(23, hour)) };
          await plugin.save();
          plugin.refreshReminder();
        }
      });
    })
    .addButton((b) => b.setButtonText("Dismiss today").onClick(() => plugin.dismissTodayReminder()));

  new Setting(containerEl)
    .setName("Open the practice view when Obsidian starts")
    .setDesc("Opens the practice view as soon as the workspace is ready, so you can start with one tap. Needs the MCQ Tracker module.")
    .addToggle((t) =>
      t.setValue(st.openPracticeOnStartUp === true).onChange(async (v) => {
        st.openPracticeOnStartUp = v;
        await plugin.save();
      })
    );

  const version = (plugin.manifest && plugin.manifest.version) || "";
  new Setting(containerEl)
    .setName("Version")
    .setDesc(version ? `MCQ Tracker ${version}` : "MCQ Tracker")
    .addButton((b) => b.setButtonText("Open practice").onClick(() => plugin.activateView()));
}

module.exports = {
  GLOBAL_TABS,
  renderGeneral,
  renderGlobalSettings,
  renderModules,
};
