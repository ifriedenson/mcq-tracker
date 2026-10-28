"use strict";
/*
 * Calendar settings live in their own module so the main settings page stays small
 * as the calendar grows. Everything here mutates the plugin's calendar settings and
 * saves immediately, like the rest of the settings page.
 */
const { Notice, Setting } = require("obsidian");
const { str } = require("./util");
const { BREAK_ICON_OPTIONS, CLASS_CATEGORIES } = require("./calendar-model");

function renderCalendarSettings(containerEl, plugin, redisplay) {
    new Setting(containerEl).setName("Calendar").setHeading();
    const cal = plugin.settings.calendar;
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

    if (cal.enabled) {
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
      if (!mappings.length) containerEl.createEl("p", { cls: "setting-item-description", text: "No mappings yet. Create a note for a class and its folder is remembered here." });
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

      new Setting(containerEl).setName("Display").setHeading();
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

      new Setting(containerEl).setName("Actions").setHeading();
      new Setting(containerEl)
        .setName("Create or open the note for the next class")
        .setDesc("Uses the note template above and the subject's folder.")
        .addButton((b) => b.setButtonText("Open note").onClick(() => plugin.openNextClassNote()));
      new Setting(containerEl)
        .setName("Export the visible schedule")
        .setDesc("Writes schedule-export.ics to the vault root, with hidden sources and excluded subjects left out.")
        .addButton((b) => b.setButtonText("Export .ics").onClick(() => plugin.exportCalendarIcs()));
    }

}

module.exports = { renderCalendarSettings };
