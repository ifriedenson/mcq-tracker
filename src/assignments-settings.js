"use strict";
const { Setting } = require("obsidian");
const { renderSettingsTabs, openExternal } = require("./settings-ui");
const { str } = require("./util");
const { ASSIGNMENT_CATEGORIES, courseConfig } = require("./assignments");

const ASSIGNMENTS_TABS = [
  { id: "grading", label: "Grading", icon: "percent" },
  { id: "courses", label: "Courses", icon: "school" },
  { id: "about", label: "About", icon: "info" },
];

function renderAssignmentsSettings(containerEl, plugin, redisplay, activeTab, setTab) {
  const current = ASSIGNMENTS_TABS.some((t) => t.id === activeTab) ? activeTab : "grading";
  renderSettingsTabs(
    containerEl,
    ASSIGNMENTS_TABS,
    current,
    (id) => (typeof setTab === "function" ? setTab(id) : redisplay()),
    { className: "qt-settings-tabs", tabClass: "qt-settings-tab" }
  );
  const section = containerEl.createDiv({ cls: "qt-settings-section" });
  if (!plugin.assignmentsEnabled()) {
    section.createEl("p", {
      cls: "setting-item-description",
      text: "The Assignments module is off. Turn it on under Global, Modules; its notes and settings are kept.",
    });
  }
  if (current === "courses") return renderCourses(section, plugin, redisplay);
  if (current === "about") return renderAssignmentsAbout(section, plugin);
  renderGrading(section, plugin, redisplay);
}

function numberSetting(containerEl, name, desc, value, opts, onSave) {
  new Setting(containerEl)
    .setName(name)
    .setDesc(desc)
    .addText((t) => {
      t.inputEl.type = "number";
      if (opts && opts.min !== undefined) t.inputEl.min = String(opts.min);
      if (opts && opts.max !== undefined) t.inputEl.max = String(opts.max);
      t.setValue(String(value)).onChange((raw) => {
        const n = Number(raw);
        if (!Number.isFinite(n)) return;
        onSave(Math.max(opts && opts.min !== undefined ? opts.min : -Infinity, Math.min(opts && opts.max !== undefined ? opts.max : Infinity, n)));
      });
    });
}

function renderGrading(containerEl, plugin, redisplay) {
  const st = plugin.settings.assignments;

  containerEl.createEl("p", {
    cls: "setting-item-description",
    text: "Assignments are ordinary notes. The grade is calculated locally from scores, category weights and course targets; nothing is uploaded.",
  });

  new Setting(containerEl).setName("Assignments and grades").setHeading();

  new Setting(containerEl)
    .setName("Enable Assignments")
    .setDesc("Adds the gradebook and task view, its ribbon button and commands.")
    .addToggle((t) =>
      t.setValue(plugin.assignmentsEnabled()).onChange(async (v) => {
        st.enabled = v;
        await plugin.save();
        await plugin.onAssignmentsToggled();
        redisplay();
      })
    );

  new Setting(containerEl)
    .setName("Assignments folder")
    .setDesc("New assignment notes go here unless you choose another folder. Existing assignment notes are found anywhere in the vault.")
    .addText((t) =>
      t.setPlaceholder("Assignments").setValue(st.folder).onChange(async (v) => {
        st.folder = str(v).trim().replace(/^\/+|\/+$/g, "") || "Assignments";
        await plugin.save();
      })
    );

  numberSetting(
    containerEl,
    "Default target grade",
    "The course grade you are aiming for. A course can override it on the Courses tab.",
    st.targetGrade,
    { min: 0, max: 100 },
    async (n) => {
      st.targetGrade = n;
      await plugin.save();
      plugin.refreshViews();
    }
  );

  numberSetting(
    containerEl,
    "Default final weight",
    "How much the final is worth, as a percentage of the course. Used for the “what do I need on the final” calculation.",
    st.finalWeight,
    { min: 0, max: 100 },
    async (n) => {
      st.finalWeight = n;
      await plugin.save();
      plugin.refreshViews();
    }
  );

  new Setting(containerEl).setName("Category weights").setHeading();
  containerEl.createEl("p", {
    cls: "setting-item-description",
    text: "Categories are weighted across the course. Inside a category, each assignment's own weight orders it; a missing assignment counts as zero and ungraded work is left out until it has a score.",
  });
  for (const category of st.categories) {
    numberSetting(
      containerEl,
      category.label,
      `Percentage of the course grade. The ${ASSIGNMENT_CATEGORIES.find((c) => c.id === category.id)?.label || category.label} category is currently set by this value.`,
      category.weight,
      { min: 0, max: 100 },
      async (n) => {
        category.weight = n;
        await plugin.save();
        plugin.refreshViews();
      }
    );
  }

  new Setting(containerEl)
    .setName("Add an assignment")
    .setDesc("Create a note in the assignments folder with a Tasks-compatible due date.")
    .addButton((b) => b.setButtonText("Add assignment").onClick(() => plugin.openNewAssignment()));
  new Setting(containerEl)
    .setName("Open the gradebook")
    .setDesc("Courses, weighted grades, the GPA and the task list.")
    .addButton((b) => b.setButtonText("Open Assignments").onClick(() => plugin.activateAssignments()));
}

function ensureCourse(plugin, name) {
  const st = plugin.settings.assignments;
  let cfg = courseConfig(st, name);
  if (!cfg) {
    cfg = { name, credits: 3, target: null, finalWeight: null };
    st.courses.push(cfg);
  }
  return cfg;
}

function renderCourses(containerEl, plugin, redisplay) {
  const st = plugin.settings.assignments;
  const names = [];
  const seen = new Set();
  const add = (name) => {
    const clean = str(name).trim();
    if (!clean || seen.has(clean.toLowerCase())) return;
    seen.add(clean.toLowerCase());
    names.push(clean);
  };
  for (const cfg of st.courses) add(cfg.name);
  for (const a of plugin.getAssignments()) add(a.course);

  containerEl.createEl("p", {
    cls: "setting-item-description",
    text: "Credits make the GPA credit-weighted. A target and final weight here override the defaults for that course. A blank target or final weight uses the Grading tab value.",
  });

  if (!names.length) {
    containerEl.createEl("p", { cls: "setting-item-description", text: "No courses yet. Add one below, or create an assignment with a course name." });
  }

  for (const name of names) {
    const cfg = courseConfig(st, name);
    const row = cfg || { name, credits: 3, target: null, finalWeight: null };
    new Setting(containerEl)
      .setName(name)
      .setDesc("Credits, target grade and final weight for this course.")
      .addText((t) => {
        t.inputEl.type = "number";
        t.inputEl.min = "0";
        t.inputEl.max = "30";
        t.setPlaceholder("credits");
        t.setValue(String(row.credits)).onChange(async (v) => {
          const c = ensureCourse(plugin, name);
          c.credits = Math.max(0, Math.min(30, Number(v) || 0));
          await plugin.save();
          plugin.refreshViews();
        });
      })
      .addText((t) => {
        t.inputEl.type = "number";
        t.inputEl.min = "0";
        t.inputEl.max = "100";
        t.setPlaceholder("target %");
        t.setValue(row.target === null ? "" : String(row.target)).onChange(async (v) => {
          const c = ensureCourse(plugin, name);
          c.target = str(v).trim() === "" ? null : Math.max(0, Math.min(100, Number(v) || 0));
          await plugin.save();
          plugin.refreshViews();
        });
      })
      .addText((t) => {
        t.inputEl.type = "number";
        t.inputEl.min = "0";
        t.inputEl.max = "100";
        t.setPlaceholder("final %");
        t.setValue(row.finalWeight === null ? "" : String(row.finalWeight)).onChange(async (v) => {
          const c = ensureCourse(plugin, name);
          c.finalWeight = str(v).trim() === "" ? null : Math.max(0, Math.min(100, Number(v) || 0));
          await plugin.save();
          plugin.refreshViews();
        });
      });
  }

  new Setting(containerEl)
    .setName("Add a course")
    .setDesc("Then set its credits and target. Course names match the assignment's course property, ignoring case.")
    .addText((t) => t.setPlaceholder("e.g. CHEM 101").setValue(plugin.settings.assignments._newCourse || "").onChange((v) => (plugin.settings.assignments._newCourse = v)))
    .addButton((b) =>
      b.setButtonText("Add").onClick(async () => {
        const name = str(plugin.settings.assignments._newCourse).trim();
        if (!name) return;
        ensureCourse(plugin, name);
        plugin.settings.assignments._newCourse = "";
        await plugin.save();
        redisplay();
        plugin.refreshViews();
      })
    );
}

function renderAssignmentsAbout(containerEl, plugin) {
  new Setting(containerEl).setName("How grades are calculated").setHeading();
  const card = containerEl.createDiv({ cls: "qt-settings-card" });
  card.createEl("p", {
    cls: "setting-item-description",
    text: "Within a category, graded assignments are averaged using their weight. Categories are then averaged using the category weights on the Grading tab. Missing work counts as zero; submitted but ungraded work is left out. A course with no grades yet shows no grade instead of zero.",
  });
  card.createEl("p", {
    cls: "setting-item-description",
    text: "The final calculation assumes your current grade carries through the rest of the non-final work. It is an estimate, not a promise from your school's gradebook.",
  });
  new Setting(containerEl)
    .setName("Assignments are Tasks-compatible")
    .setDesc("Each new assignment includes a checkbox line with its due date (📅) so Tasks, Dataview and similar plugins can query it.")
    .addButton((b) => b.setButtonText("Open the assignment note format").onClick(() => openExternal("https://github.com/ifriedenson/mcq-tracker#assignments-tasks-and-grades")));
  new Setting(containerEl)
    .setName("Local only")
    .setDesc("No third-party gradebook, analytics service or network request is used. The calculation runs in the plugin.")
    .addButton((b) => b.setButtonText("Open Assignments").onClick(() => plugin.activateAssignments()));
}

module.exports = {
  ASSIGNMENTS_TABS,
  renderAssignmentsSettings,
};
