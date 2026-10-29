"use strict";
const { Setting } = require("obsidian");
const { renderSettingsTabs, openExternal } = require("./settings-ui");
const {
  CONSTANTS,
  FORMULAS,
  REFERENCE_SUBJECTS,
  UNIT_CATEGORIES,
  mergeReferenceSettings,
} = require("./reference-data");
const { ELEMENTS } = require("./reference-elements");

const REFERENCE_TABS = [
  { id: "tools", label: "Tools", icon: "book-open" },
  { id: "about", label: "About", icon: "info" },
];

function renderReferenceSettings(containerEl, plugin, redisplay, activeTab, setTab) {
  const current = REFERENCE_TABS.some((tab) => tab.id === activeTab) ? activeTab : "tools";
  renderSettingsTabs(
    containerEl,
    REFERENCE_TABS,
    current,
    (id) => (typeof setTab === "function" ? setTab(id) : redisplay()),
    { className: "qt-settings-tabs", tabClass: "qt-settings-tab" }
  );

  if (current === "about") return renderAbout(containerEl, plugin);
  return renderTools(containerEl, plugin, redisplay);
}

function renderTools(containerEl, plugin, redisplay) {
  const st = plugin.settings;
  if (!st.reference) st.reference = mergeReferenceSettings(null);

  containerEl.createEl("p", {
    cls: "setting-item-description",
    text: "A local formula sheet, constants list, unit converter and AP score estimator. No network request is made while it is open.",
  });

  new Setting(containerEl)
    .setName("Enable Reference")
    .setDesc("Adds the Reference view, its ribbon button and its command. The module is off by default.")
    .addToggle((t) =>
      t.setValue(plugin.referenceEnabled()).onChange(async (v) => {
        st.reference.enabled = v;
        await plugin.save();
        await plugin.onReferenceToggled();
        redisplay();
      })
    );

  new Setting(containerEl)
    .setName("Hide while a timed test is running")
    .setDesc("Keeps the formula sheet out of a timed test so the panel matches a no-reference section. Turn this off only when your test allows reference material.")
    .addToggle((t) =>
      t.setValue(st.reference.hideDuringTests !== false).onChange(async (v) => {
        st.reference.hideDuringTests = v;
        await plugin.save();
      })
    );

  new Setting(containerEl)
    .setName("Default subject")
    .setDesc("Which subject the formula sheet opens on.")
    .addDropdown((d) => {
      for (const subject of REFERENCE_SUBJECTS) d.addOption(subject.id, subject.label);
      d.setValue(st.reference.defaultSubject || "all").onChange(async (v) => {
        st.reference.defaultSubject = REFERENCE_SUBJECTS.some((s) => s.id === v) ? v : "all";
        await plugin.save();
      });
    });

  new Setting(containerEl)
    .setName("Open the reference panel")
    .setDesc("The formula sheet, unit converter and constants are all in one view.")
    .addButton((b) => b.setButtonText("Open Reference").onClick(() => plugin.activateReference()));

  new Setting(containerEl)
    .setName("AP score calculator")
    .setDesc("An unofficial practice estimate for AP Biology, Calculus AB, English Language and U.S. History, with editable cut scores and a reverse what-do-I-need calculation.")
    .addButton((b) => b.setButtonText("Open AP score").onClick(() => plugin.openApScore()));

  new Setting(containerEl)
    .setName("AP resources")
    .setDesc("Official AP Central, AP Students and AP Classroom links for each supported course, including released free-response questions, scoring guidelines, exam format and dates.")
    .addButton((b) => b.setButtonText("Open AP resources").onClick(() => plugin.openApResources()));

  const card = containerEl.createDiv({ cls: "qt-settings-card" });
  card.createEl("h3", { text: "Bundled content" });
  card.createEl("p", {
    cls: "setting-item-description",
    text: `${FORMULAS.length} formulas across ${REFERENCE_SUBJECTS.length - 1} subjects, ${CONSTANTS.length} constants, ${UNIT_CATEGORIES.length} unit categories and all ${ELEMENTS.length} elements.`,
  });
  card.createEl("p", {
    cls: "setting-item-description",
    text: "Formula sheets differ by course and exam year. Check the sheet supplied with your exam; these are study aids, not official College Board material.",
  });
}

function renderAbout(containerEl, plugin) {
  const version = (plugin.manifest && plugin.manifest.version) || "";
  const card = containerEl.createDiv({ cls: "qt-settings-card" });
  card.createEl("h3", { text: "Reference" });
  card.createEl("p", {
    cls: "setting-item-description",
    text: "The Reference module is an offline study aid. It does not call a model, fetch a formula sheet, or read your notes.",
  });
  card.createEl("p", {
    cls: "setting-item-description",
    text: "The formulas and constants are written for this plugin rather than copied from a third-party dataset. Units, constants and formulas were checked against standard definitions; a particular course may round constants or use a different convention.",
  });
  new Setting(containerEl)
    .setName("License")
    .setDesc("MCQ Tracker is MIT licensed. No external Reference dataset or calculator library is bundled.")
    .addButton((b) => b.setButtonText("Third-party notices").onClick(() => openExternal("https://github.com/ifriedenson/mcq-tracker/blob/main/NOTICES.md")));
  if (version) new Setting(containerEl).setName("Version").setDesc(`MCQ Tracker ${version}`);
}

module.exports = {
  REFERENCE_TABS,
  renderReferenceSettings,
};
