"use strict";
/*
 * Global settings: one switch per module, plus the few options that apply to the
 * whole plugin. Each module keeps its own detailed settings on its own page.
 */
const { Setting } = require("obsidian");
const { openExternal, renderSettingsTabs } = require("./settings-ui");

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
  if (current === "about") return renderGlobalAbout(section, plugin);
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
    text: "The settings for a module stay on its own page: MCQ Tracker, Cards, Calendar and Reference.",
  });
}

function renderGlobalAbout(containerEl, plugin) {
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
