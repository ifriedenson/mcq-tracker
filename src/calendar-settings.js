"use strict";
/*
 * Calendar settings live in their own module so the main settings page stays small
 * as the calendar grows. Everything here mutates the plugin's calendar settings and
 * saves immediately, like the rest of the settings page.
 */
const { Notice, Setting } = require("obsidian");
const { str } = require("./util");
const {
  BREAK_ICON_OPTIONS,
  CLASS_CATEGORIES,
  normalizeCourseRegistry,
  normalizeReadingWeeks,
  normalizeTermDate,
} = require("./calendar-model");
const { openExternal, renderSettingsTabs } = require("./settings-ui");

const CALENDAR_TABS = [
  { id: "about", label: "About", icon: "sparkles" },
  { id: "schedules", label: "Schedules & Sync", icon: "calendar-days" },
  { id: "notes", label: "Notes & Templates", icon: "file-text" },
  { id: "courses", label: "Courses", icon: "book-marked" },
  { id: "exclusions", label: "Exclusions", icon: "eye-off" },
  { id: "appearance", label: "Appearance & Colors", icon: "palette" },
  { id: "language", label: "Language & Region", icon: "globe" },
];

const REPO_URL = "https://github.com/ifriedenson/mcq-tracker";
const ISSUES_URL = `${REPO_URL}/issues`;

function renderCalendarSettings(containerEl, plugin, redisplay, activeTab, setTab) {
  const cal = plugin.settings.calendar;
  const current = CALENDAR_TABS.some((tab) => tab.id === activeTab) ? activeTab : "about";
  renderSettingsTabs(
    containerEl,
    CALENDAR_TABS,
    current,
    (id) => (typeof setTab === "function" ? setTab(id) : redisplay()),
    { className: "qt-settings-tabs", tabClass: "qt-settings-tab" }
  );

  const section = containerEl.createDiv({ cls: "qt-settings-section" });
  if (current === "about") return renderAbout(section, plugin);
  if (!cal.enabled && current !== "schedules") {
    section.createEl("p", {
      cls: "setting-item-description",
      text: "The calendar module is off. Turn it on under Schedules & Sync to show it in Obsidian.",
    });
  }
  if (current === "schedules") return renderSchedules(section, plugin, redisplay);
  if (current === "notes") return renderNotes(section, plugin, redisplay);
  if (current === "courses") return renderCourses(section, plugin, redisplay);
  if (current === "exclusions") return renderExclusions(section, plugin);
  if (current === "appearance") return renderAppearance(section, plugin);
  return renderLanguage(section, plugin);
}

function renderAbout(containerEl, plugin) {
  const quick = containerEl.createDiv({ cls: "qt-settings-card" });
  quick.createEl("h3", { text: "Quick Start — How to Begin?" });
  const steps = quick.createEl("ol");
  const step1 = steps.createEl("li");
  step1.createEl("strong", { text: "Add your schedule: " });
  step1.createEl("span", { text: "In the “Schedules & Sync” tab, paste your university iCal/ICS subscription link (for example UOSweb, Moodle, or Google Calendar) or upload a downloaded .ics file." });
  const step2 = steps.createEl("li");
  step2.createEl("strong", { text: "Configure templates and folders: " });
  step2.createEl("span", { text: "In the “Notes & Templates” tab, map subject folders and customize your note template." });
  const step3 = steps.createEl("li");
  step3.createEl("strong", { text: "Open the calendar: " });
  step3.createEl("span", { text: "Click the graduation-cap icon in the ribbon, or run “Calendar: open calendar”, to browse classes and exams, watch the countdown, and create notes in one click." });

  const practice = containerEl.createDiv({ cls: "qt-settings-card" });
  practice.createEl("h3", { text: "How the Calendar Works & Best Practices" });
  const tips = practice.createEl("ul");
  const tip1 = tips.createEl("li");
  tip1.createEl("strong", { text: "Direct integration with your university timetable. " });
  tip1.createEl("span", { text: "The plugin fetches and parses iCalendar feeds (iCal/ICS). It recognizes lectures, labs, classes, rooms, instructors, and counts down to upcoming events." });
  const tip2 = tips.createEl("li");
  tip2.createEl("strong", { text: "Core concept: Folder = Course, File = Class note. " });
  tip2.createEl("span", { text: "Clicking a class card instantly opens the existing note or creates one using your template with YAML frontmatter." });
  const tip3 = tips.createEl("li");
  tip3.createEl("strong", { text: "Best practice: full semester organization. " });
  tip3.createEl("span", { text: "Use dedicated folders per course, smart exclusions for groups or sections you do not attend, and break/free-period indicators with thresholds that fit your day." });

  const version = (plugin.manifest && plugin.manifest.version) || "";
  new Setting(containerEl)
    .setName("About the project")
    .setDesc(`${version ? `Version ${version}. ` : ""}Calendar module adapted from University Schedule and Calendar (MIT, Cesemess).`)
    .addButton((b) =>
      b.setButtonText("GitHub repository").onClick(() => openExternal(REPO_URL))
    )
    .addButton((b) =>
      b.setButtonText("Report bug or suggest feature").onClick(() => openExternal(ISSUES_URL))
    );
  new Setting(containerEl)
    .setName("Open the calendar")
    .setDesc("Browse the current month, classes, exams, and free periods.")
    .addButton((b) => b.setButtonText("Open calendar").onClick(() => plugin.activateCalendar()));
}

function renderSchedules(containerEl, plugin, redisplay) {
  const cal = plugin.settings.calendar;
  new Setting(containerEl).setName("Module").setHeading();
  new Setting(containerEl)
    .setName("Enable the calendar module")
    .setDesc("Adds a class and exam calendar: import an .ics schedule, open a note for a class in one click, see exam countdowns, and embed a day's classes in a note. Off by default.")
    .addToggle((t) =>
      t.setValue(!!cal.enabled).onChange(async (v) => {
        cal.enabled = v;
        await plugin.save();
        await plugin.onCalendarToggled();
        redisplay();
      })
    );

  new Setting(containerEl)
    .setName("Sync URL feeds on startup")
    .setDesc("Refresh subscribed feeds when Obsidian starts. Manual Sync still works either way.")
    .addToggle((t) =>
      t.setValue(!!cal.autoSync).onChange(async (v) => {
        cal.autoSync = v;
        await plugin.save();
      })
    );

  new Setting(containerEl).setName("Schedules").setHeading();
  if (!cal.sources.length) {
    containerEl.createEl("p", { cls: "setting-item-description", text: "No schedules yet. Add an .ics file from your vault, or a public feed URL." });
  }
  for (const src of cal.sources) {
    new Setting(containerEl)
      .setName(src.name)
      .setDesc(`${src.type === "url" ? src.url : src.path}${src.lastSync ? ` · last synced ${new Date(src.lastSync).toLocaleDateString()}` : ""}`)
      .addToggle((t) =>
        t.setValue(!src.hidden).onChange(async (v) => {
          src.hidden = !v;
          plugin.invalidateCalendar();
          await plugin.save();
          plugin.refreshCalendarViews();
        })
      )
      .addButton((b) =>
        b.setButtonText("Sync").onClick(async () => {
          try {
            await plugin.syncCalendarSource(src.id);
            new Notice("Schedule updated.");
          } catch (e) {
            new Notice(str(e.message));
          }
          redisplay();
        })
      )
      .addButton((b) =>
        b.setButtonText("Remove").setWarning().onClick(async () => {
          await plugin.removeCalendarSource(src.id);
          redisplay();
        })
      );
  }
  new Setting(containerEl)
    .setName("Add a schedule")
    .setDesc("Import an .ics file from the vault, or paste a public calendar feed. Google share links are converted to their .ics address.")
    .addButton((b) => b.setButtonText("Add").onClick(() => plugin.openCalendarImport()));

  new Setting(containerEl).setName("Term calendar").setHeading();
  containerEl.createEl("p", {
    cls: "setting-item-description",
    text: "Optional. Week 1 starts on the semester start date. Classes outside the semester are hidden, and reading weeks are labelled but skipped by next-class actions. Exams are never hidden.",
  });
  const saveTerm = async () => {
    plugin.invalidateCalendar();
    await plugin.save();
    plugin.refreshCalendarViews();
  };
  new Setting(containerEl)
    .setName("Semester start")
    .setDesc("The first day of teaching. Leave empty to keep term week numbers, semester limits and reading weeks off.")
    .addText((t) => {
      t.inputEl.type = "date";
      t.setValue(cal.semesterStart || "").onChange(async (v) => {
        const start = normalizeTermDate(v);
        if (start && cal.semesterEnd && cal.semesterEnd < start) {
          cal.semesterStart = "";
          cal.semesterEnd = "";
          new Notice("Semester end must be on or after the start.");
          await saveTerm();
          redisplay();
          return;
        }
        cal.semesterStart = start;
        await saveTerm();
      });
    });
  new Setting(containerEl)
    .setName("Semester end")
    .setDesc("Optional last teaching day. Classes after it are not drawn; exams still are.")
    .addText((t) => {
      t.inputEl.type = "date";
      t.setValue(cal.semesterEnd || "").onChange(async (v) => {
        const end = normalizeTermDate(v);
        if (end && cal.semesterStart && end < cal.semesterStart) {
          cal.semesterEnd = "";
          new Notice("Semester end must be on or after the start.");
          await saveTerm();
          redisplay();
          return;
        }
        cal.semesterEnd = end;
        await saveTerm();
      });
    });
  new Setting(containerEl)
    .setName("Reading weeks")
    .setDesc("One date or inclusive range per line, with an optional label: 2026-10-19 ~ 2026-10-23 Reading week. These classes stay visible but are struck through and skipped by next-class actions.")
    .addTextArea((t) => {
      t.inputEl.rows = 4;
      t.setPlaceholder("2026-10-19 ~ 2026-10-23 Reading week");
      t.setValue(cal.readingWeeks.map((r) => `${r.start}${r.end !== r.start ? ` ~ ${r.end}` : ""}${r.label ? ` ${r.label}` : ""}`).join("\n"));
      t.onChange(async (v) => {
        cal.readingWeeks = normalizeReadingWeeks(v);
        await saveTerm();
      });
    });

  new Setting(containerEl).setName("Actions").setHeading();
  new Setting(containerEl)
    .setName("Export the visible schedule")
    .setDesc("Writes schedule-export.ics to the vault root, with hidden sources, excluded subjects and reading-week classes left out.")
    .addButton((b) => b.setButtonText("Export .ics").onClick(() => plugin.exportCalendarIcs()));
}

function renderNotes(containerEl, plugin, redisplay) {
  const cal = plugin.settings.calendar;
  new Setting(containerEl).setName("Class notes").setHeading();
  new Setting(containerEl)
    .setName("Note folder")
    .setDesc("Where class notes go when no subject folder matches. Leave empty for the vault root.")
    .addText((t) =>
      t.setPlaceholder("e.g. University").setValue(cal.noteFolder).onChange(async (v) => {
        cal.noteFolder = v.trim();
        await plugin.save();
      })
    );
  new Setting(containerEl)
    .setName("Note name format")
    .setDesc("Variables: {date}, {subject}, {time}, {time_start}, {time_end}, {room}, {lecturer}, {type}.")
    .addText((t) =>
      t.setValue(cal.noteNameFormat).onChange(async (v) => {
        cal.noteNameFormat = v;
        await plugin.save();
      })
    );
  new Setting(containerEl)
    .setName("Note template")
    .setDesc("Used for new class notes. {course} is the cleaned subject name, so questions filed in the same folder can be tagged with it.")
    .addTextArea((t) => {
      t.inputEl.rows = 10;
      t.setValue(cal.noteTemplate).onChange(async (v) => {
        cal.noteTemplate = v;
        await plugin.save();
      });
    });

  new Setting(containerEl)
    .setName("Subject folders")
    .setDesc("Filled in when you create a class note: a subject always maps to the folder where its notes live.")
    .setHeading();
  const mappings = Object.entries(cal.subjectFolders);
  if (!mappings.length) {
    containerEl.createEl("p", { cls: "setting-item-description", text: "No mappings yet. Create a note for a class and its folder is remembered here." });
  }
  for (const [subject, folder] of mappings) {
    new Setting(containerEl)
      .setName(subject)
      .addText((t) =>
        t.setValue(folder).onChange(async (v) => {
          cal.subjectFolders[subject] = v.trim();
          await plugin.save();
        })
      )
      .addButton((b) =>
        b.setButtonText("Remove").onClick(async () => {
          delete cal.subjectFolders[subject];
          await plugin.save();
          redisplay();
        })
      );
  }

  new Setting(containerEl).setName("Actions").setHeading();
  new Setting(containerEl)
    .setName("Create or open the note for the next class")
    .setDesc("Uses the note template above and the subject's folder.")
    .addButton((b) => b.setButtonText("Open note").onClick(() => plugin.openNextClassNote()));
}

function renderCourses(containerEl, plugin, redisplay) {
  const cal = plugin.settings.calendar;
  new Setting(containerEl).setName("Course registry").setHeading();
  containerEl.createEl("p", {
    cls: "setting-item-description",
    text: "One row per course. A matching class uses the folder for new notes and the course color on the calendar. Credits are used by Assignments when that course has no explicit assignment credit setting.",
  });

  if (!cal.courses.length) {
    containerEl.createEl("p", { cls: "setting-item-description", text: "No courses yet. Add one below, or let a class note create its subject folder mapping first." });
  }

  for (const course of cal.courses) {
    const card = containerEl.createDiv({ cls: "qt-settings-card qt-course-row" });
    const heading = new Setting(card)
      .setName(course.name || course.code)
      .setDesc([course.code, course.semester, course.instructor].filter(Boolean).join(" · ") || "Course details");
    heading.addButton((b) =>
      b.setButtonText("Remove").setWarning().onClick(async () => {
        cal.courses = cal.courses.filter((row) => row.id !== course.id);
        await plugin.save();
        plugin.invalidateCalendar();
        plugin.refreshCalendarViews();
        redisplay();
      })
    );

    new Setting(card)
      .setName("Name and code")
      .setDesc("The name matches a class subject; the code also matches titles such as CHEM 101 - Lecture.")
      .addText((t) =>
        t.setPlaceholder("Course name").setValue(course.name).onChange(async (v) => {
          course.name = v.trim();
          await plugin.save();
        })
      )
      .addText((t) =>
        t.setPlaceholder("Code").setValue(course.code).onChange(async (v) => {
          course.code = v.trim();
          await plugin.save();
        })
      );

    new Setting(card)
      .setName("Folder")
      .setDesc("New class notes for this course go here. Leave blank to use the normal subject matching.")
      .addText((t) =>
        t.setPlaceholder("e.g. University/CHEM 101").setValue(course.folder).onChange(async (v) => {
          course.folder = v.trim().replace(/^\/+|\/+$/g, "");
          await plugin.save();
        })
      );

    new Setting(card)
      .setName("Total topics")
      .setDesc("How many topics the course covers. The study plan counts a topic as mastered only when every question in that skill is fully mastered. 0 hides the coverage figure.")
      .addText((t) => {
        t.inputEl.type = "number";
        t.inputEl.min = "0";
        t.inputEl.max = "500";
        t.setPlaceholder("0");
        t.setValue(String(course.totalTopics || 0)).onChange(async (v) => {
          const n = Math.round(Number(v));
          course.totalTopics = Number.isFinite(n) ? Math.max(0, Math.min(500, n)) : 0;
          await plugin.save();
          plugin.refreshViews();
        });
      });

    new Setting(card)
      .setName("Semester and instructor")
      .setDesc("Readable metadata for the course; it does not change scheduling.")
      .addText((t) =>
        t.setPlaceholder("Semester").setValue(course.semester).onChange(async (v) => {
          course.semester = v.trim();
          await plugin.save();
        })
      )
      .addText((t) =>
        t.setPlaceholder("Instructor").setValue(course.instructor).onChange(async (v) => {
          course.instructor = v.trim();
          await plugin.save();
        })
      );

    new Setting(card)
      .setName("Credit weight and color")
      .setDesc("Credits feed the credit-weighted GPA when Assignments has no explicit credit setting for this course.")
      .addText((t) => {
        t.inputEl.type = "number";
        t.inputEl.min = "0";
        t.inputEl.max = "30";
        t.setPlaceholder("credits");
        t.setValue(String(course.credits)).onChange(async (v) => {
          const n = Math.round(Number(v));
          course.credits = Number.isFinite(n) ? Math.max(0, Math.min(30, n)) : 3;
          await plugin.save();
          plugin.refreshViews();
        });
      })
      .addColorPicker((c) =>
        c.setValue(course.color || "#3b82f6").onChange(async (v) => {
          course.color = v;
          await plugin.save();
          plugin.invalidateCalendar();
          plugin.refreshCalendarViews();
        })
      )
      .addButton((b) =>
        b.setButtonText("Clear color").onClick(async () => {
          course.color = "";
          await plugin.save();
          plugin.invalidateCalendar();
          plugin.refreshCalendarViews();
          redisplay();
        })
      );
  }

  new Setting(containerEl)
    .setName("Add a course")
    .setDesc("The name is required. A code is optional but makes matching timetable titles easier.")
    .addText((t) => t.setPlaceholder("Course name").setValue(cal._newCourseName || "").onChange((v) => (cal._newCourseName = v)))
    .addText((t) => t.setPlaceholder("Code").setValue(cal._newCourseCode || "").onChange((v) => (cal._newCourseCode = v)))
    .addButton((b) =>
      b.setButtonText("Add").onClick(async () => {
        const name = str(cal._newCourseName).trim();
        const code = str(cal._newCourseCode).trim();
        if (!name && !code) return;
        const folder = cal.subjectFolders[name] || cal.subjectFolders[code] || "";
        cal.courses = normalizeCourseRegistry([...cal.courses, { name, code, folder, credits: 3 }]);
        cal._newCourseName = "";
        cal._newCourseCode = "";
        await plugin.save();
        plugin.invalidateCalendar();
        plugin.refreshCalendarViews();
        redisplay();
      })
    );
}

function renderExclusions(containerEl, plugin) {
  const cal = plugin.settings.calendar;
  new Setting(containerEl).setName("Visibility").setHeading();
  new Setting(containerEl)
    .setName("Excluded subjects")
    .setDesc("Comma-separated. These never appear on the calendar, in countdowns, or in exports.")
    .addText((t) =>
      t.setValue(cal.excludedSubjects.join(", ")).onChange(async (v) => {
        cal.excludedSubjects = v.split(",").map((x) => x.trim()).filter(Boolean);
        plugin.invalidateCalendar();
        await plugin.save();
        plugin.refreshCalendarViews();
      })
    );
  new Setting(containerEl)
    .setName("Excluded keywords")
    .setDesc("Comma-separated. Any event whose title, room or description contains one of these is hidden.")
    .addText((t) =>
      t.setValue(cal.excludedKeywords.join(", ")).onChange(async (v) => {
        cal.excludedKeywords = v.split(",").map((x) => x.trim()).filter(Boolean);
        plugin.invalidateCalendar();
        await plugin.save();
        plugin.refreshCalendarViews();
      })
    );
}

function renderAppearance(containerEl, plugin) {
  const cal = plugin.settings.calendar;

  new Setting(containerEl).setName("Calendar size").setHeading();
  new Setting(containerEl)
    .setName("Maximum calendar width")
    .setDesc("0 fills the pane. Set a value such as 720 to keep the calendar centered at a comfortable width. Applies to the calendar view and embedded schedules.")
    .addText((t) => {
      t.inputEl.type = "number";
      t.inputEl.min = "0";
      t.inputEl.max = "1600";
      t.inputEl.step = "10";
      t.setValue(String(cal.calendarMaxWidth || 0)).onChange(async (v) => {
        const n = Math.round(Number(v));
        cal.calendarMaxWidth = Number.isFinite(n) ? Math.max(0, Math.min(1600, n)) : 0;
        await plugin.save();
        plugin.refreshCalendarViews();
      });
    });

  new Setting(containerEl).setName("Breaks between classes").setHeading();
  if (!cal.timelineGaps) cal.timelineGaps = {};
  const gaps = cal.timelineGaps;
  let gapDetails = null;
  new Setting(containerEl)
    .setName("Show breaks between classes")
    .setDesc("Marks free periods between consecutive classes on the day timeline. Off by default.")
    .addToggle((t) =>
      t.setValue(!!gaps.enabled).onChange(async (v) => {
        gaps.enabled = v;
        if (gapDetails) gapDetails.style.display = v ? "" : "none";
        await plugin.save();
        plugin.refreshCalendarViews();
      })
    );
  gapDetails = containerEl.createDiv();
  gapDetails.style.display = gaps.enabled ? "" : "none";
  new Setting(gapDetails)
    .setName("Break style")
    .addDropdown((d) =>
      d
        .addOptions({ pill: "Pill badge", line: "Dashed line", card: "Timeline card", text: "Plain text" })
        .setValue(gaps.style || "pill")
        .onChange(async (v) => {
          gaps.style = v;
          await plugin.save();
          plugin.refreshCalendarViews();
        })
    );
  new Setting(gapDetails)
    .setName("Break icon")
    .addDropdown((d) =>
      d
        .addOptions(Object.fromEntries(BREAK_ICON_OPTIONS))
        .setValue(gaps.icon || "coffee")
        .onChange(async (v) => {
          gaps.icon = v;
          await plugin.save();
          plugin.refreshCalendarViews();
        })
    );
  new Setting(gapDetails)
    .setName("Minimum break length (minutes)")
    .setDesc("Free periods shorter than this are not shown.")
    .addText((t) => {
      t.inputEl.type = "number";
      t.inputEl.min = "1";
      t.inputEl.step = "5";
      t.setValue(String(gaps.minMinutes || 15)).onChange(async (v) => {
        const n = parseInt(v, 10);
        gaps.minMinutes = Number.isFinite(n) && n >= 1 ? n : 15;
        await plugin.save();
        plugin.refreshCalendarViews();
      });
    });
  new Setting(gapDetails)
    .setName("Maximum break length (minutes)")
    .setDesc("0 means no upper limit.")
    .addText((t) => {
      t.inputEl.type = "number";
      t.inputEl.min = "0";
      t.inputEl.step = "5";
      t.setValue(gaps.maxMinutes ? String(gaps.maxMinutes) : "").onChange(async (v) => {
        const n = parseInt(v, 10);
        gaps.maxMinutes = Number.isFinite(n) && n >= 0 ? n : 0;
        await plugin.save();
        plugin.refreshCalendarViews();
      });
    });

  new Setting(containerEl).setName("Study from free time").setHeading();
  new Setting(containerEl)
    .setName("Keep free before the next class (minutes)")
    .setDesc("When you start Quick Practice from a free period, stop this many minutes before the next class. 0 turns the buffer off.")
    .addText((t) => {
      t.inputEl.type = "number";
      t.inputEl.min = "0";
      t.inputEl.max = "60";
      t.inputEl.step = "5";
      t.setValue(String(cal.studySlotBufferMinutes)).onChange(async (v) => {
        const n = parseInt(v, 10);
        cal.studySlotBufferMinutes = Number.isFinite(n) && n >= 0 && n <= 60 ? n : 5;
        await plugin.save();
      });
    });

  new Setting(containerEl).setName("Class colors").setHeading();
  for (const category of CLASS_CATEGORIES) {
    new Setting(containerEl).setName(category.label).addColorPicker((c) =>
      c.setValue(cal.classColors[category.id] || category.color).onChange(async (v) => {
        cal.classColors[category.id] = v;
        await plugin.save();
        plugin.refreshCalendarViews();
      })
    );
  }
}

function renderLanguage(containerEl, plugin) {
  const cal = plugin.settings.calendar;
  new Setting(containerEl).setName("Language & Region").setHeading();
  new Setting(containerEl)
    .setName("First day of the week")
    .addDropdown((d) =>
      d
        .addOptions({ monday: "Monday", sunday: "Sunday" })
        .setValue(cal.firstDayOfWeek)
        .onChange(async (v) => {
          cal.firstDayOfWeek = v;
          await plugin.save();
          plugin.refreshCalendarViews();
        })
    );
  new Setting(containerEl)
    .setName("Time format")
    .addDropdown((d) =>
      d
        .addOptions({ "24h": "24-hour", "12h": "12-hour" })
        .setValue(cal.timeFormat)
        .onChange(async (v) => {
          cal.timeFormat = v;
          await plugin.save();
          plugin.refreshCalendarViews();
        })
    );
  new Setting(containerEl)
    .setName("Date format")
    .addDropdown((d) =>
      d
        .addOptions({ "YYYY-MM-DD": "2026-10-05", "DD.MM.YYYY": "05.10.2026", "DD/MM/YYYY": "05/10/2026", "MM/DD/YYYY": "10/05/2026" })
        .setValue(cal.dateFormat)
        .onChange(async (v) => {
          cal.dateFormat = v;
          await plugin.save();
          plugin.refreshCalendarViews();
        })
    );
}

module.exports = { CALENDAR_TABS, renderCalendarSettings };
