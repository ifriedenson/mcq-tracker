"use strict";
const { Notice, Platform, PluginSettingTab, Setting } = require("obsidian");
const { FILTER_FIELDS, FOLDER_AUTO_MAX } = require("./constants");
const { API_PRESETS, ApiClient, friendlyApiError } = require("./api-client");
const { str } = require("./util");
const { OPENCODE_REPO, PROVIDERS } = require("./opencode-manager");
const { friendlyError } = require("./opencode-client");
const { fvals, hasFilters } = require("./filters");
const { NameModal } = require("./modals");
const { CLASS_CATEGORIES } = require("./calendar-model");

/* --------------------------------------------------------------- settings */

class QuestionTrackerSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    const st = this.plugin.settings;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Question folder")
      .setDesc("Only notes in this folder count as questions. Leave empty to scan the whole vault.")
      .addText((t) =>
        t.setPlaceholder("e.g. Questions").setValue(st.questionFolder).onChange(async (v) => {
          st.questionFolder = v;
          await this.plugin.save();
        })
      );

    new Setting(containerEl)
      .setName("Folder filter")
      .setDesc(`How the Folder filter is shown in the practice view. Auto uses buttons for up to ${FOLDER_AUTO_MAX} folders and a search box for more.`)
      .addDropdown((d) =>
        d
          .addOptions({ auto: "Auto", buttons: "Buttons", search: "Search box" })
          .setValue(st.folderFilterStyle)
          .onChange(async (v) => {
            st.folderFilterStyle = v;
            await this.plugin.save();
            this.plugin.refreshViews();
          })
      );

    new Setting(containerEl)
      .setName("Review intervals (days)")
      .setDesc("Days until review after 1st, 2nd, 3rd... correct answer in a row. A miss always returns in 1 day.")
      .addText((t) =>
        t.setValue(st.intervals.join(", ")).onChange(async (v) => {
          const nums = v.split(",").map((x) => parseInt(x.trim(), 10)).filter((n) => n > 0);
          if (nums.length) {
            st.intervals = nums;
            await this.plugin.save();
          }
        })
      );

    new Setting(containerEl)
      .setName("Error types")
      .setDesc("Comma-separated. Shown after a wrong answer.")
      .addText((t) =>
        t.setValue(st.errorTypes.join(", ")).onChange(async (v) => {
          const list = v.split(",").map((x) => x.trim()).filter(Boolean);
          if (list.length) {
            st.errorTypes = list;
            await this.plugin.save();
          }
        })
      );

    new Setting(containerEl)
      .setName("Confidence labels")
      .setDesc("Three comma-separated labels, lowest to highest.")
      .addText((t) =>
        t.setValue(st.confidenceLabels.join(", ")).onChange(async (v) => {
          const list = v.split(",").map((x) => x.trim()).filter(Boolean);
          if (list.length === 3) {
            st.confidenceLabels = list;
            await this.plugin.save();
          }
        })
      );

    new Setting(containerEl)
      .setName("Explanation after answering")
      .setDesc("Whether the explanation starts open or closed on the result screen. You can always show or hide it with the button.")
      .addDropdown((d) =>
        d
          .addOption("wrong", "Show only when I miss it")
          .addOption("show", "Always show")
          .addOption("hide", "Always hide")
          .setValue(st.explanationDefault)
          .onChange(async (v) => {
            st.explanationDefault = v;
            await this.plugin.save();
          })
      );

    new Setting(containerEl)
      .setName("Pause timer when the app is backgrounded (mobile)")
      .setDesc("Stops the clock if you switch apps or lock your phone.")
      .addToggle((t) =>
        t.setValue(st.autoPauseOnMobile).onChange(async (v) => {
          st.autoPauseOnMobile = v;
          await this.plugin.save();
        })
      );

    new Setting(containerEl).setName("OpenCode (AI)").setHeading();
    const ai = st.ai;
    new Setting(containerEl)
      .setName("Enable AI features")
      .setDesc("Adds 'Ask AI' to the result screen and an AI assistant chat.")
      .addToggle((t) =>
        t.setValue(ai.enabled).onChange(async (v) => {
          ai.enabled = v;
          await this.plugin.save();
          this.plugin.refreshViews();
        })
      );
    if (Platform.isDesktopApp) {
      new Setting(containerEl)
        .setName("AI backend")
        .setDesc("OpenCode can edit your notes and runs on this computer. Direct API is a plain chat that also works on your phone (your phone always uses it).")
        .addDropdown((d) =>
          d
            .addOption("opencode", "OpenCode (this computer)")
            .addOption("api", "Direct API")
            .setValue(ai.backend)
            .onChange(async (v) => {
              ai.backend = v;
              await this.plugin.save();
              this.plugin.refreshViews();
              this.display();
            })
        );
    }

    const renderApi = () => {
      const api = ai.api;
      new Setting(containerEl)
        .setName("Provider")
        .addDropdown((d) => {
          for (const [id, pr] of Object.entries(API_PRESETS)) d.addOption(id, pr.label);
          d.setValue(api.provider).onChange(async (v) => {
            api.provider = v;
            api.baseUrl = "";
            api.model = API_PRESETS[v].defaultModel;
            await this.plugin.save();
            this.display();
          });
        });
      const preset = API_PRESETS[api.provider] || API_PRESETS.custom;
      if (preset.kind === "openai") {
        new Setting(containerEl)
          .setName("Base URL")
          .setDesc("Leave empty to use the provider's standard address.")
          .addText((t) =>
            t.setPlaceholder(preset.base || "https://.../v1").setValue(api.baseUrl).onChange(async (v) => {
              api.baseUrl = v.trim();
              await this.plugin.save();
            })
          );
      }
      if (!preset.noKey) {
        new Setting(containerEl)
          .setName("API key")
          .setDesc("Stored as plain text in this plugin's data.json, which syncs with your vault, so the same key works on your phone. Anyone with access to the vault can read it.")
          .addText((t) => {
            t.inputEl.type = "password";
            t.setValue((api.keys || {})[api.provider] || "").onChange(async (v) => {
              api.keys = api.keys || {};
              api.keys[api.provider] = v.trim();
              await this.plugin.save();
            });
          });
      }
      new Setting(containerEl)
        .setName("Model")
        .setDesc("The model name exactly as your provider lists it.")
        .addText((t) =>
          t.setPlaceholder("model name").setValue(api.model).onChange(async (v) => {
            api.model = v.trim();
            await this.plugin.save();
          })
        );
      new Setting(containerEl).setName("Test").addButton((b) =>
        b.setButtonText("Test").onClick(async () => {
          try {
            const r = await new ApiClient(ai).chat("You are a connection test.", [{ role: "user", content: "Reply with the single word OK." }]);
            new Notice(`Connected. Reply: ${r.trim().slice(0, 60)}`, 6000);
          } catch (e) {
            new Notice(friendlyApiError(e), 10000);
          }
        })
      );
    };

    const renderOpenCode = () => {
    new Setting(containerEl)
      .setName("Set up and run OpenCode for me")
      .setDesc(
        "Desktop only. The plugin runs OpenCode in the background (reachable only from this computer) when you use the AI chat, and stops it when Obsidian closes. " +
          "The first time you use it, the plugin sets OpenCode up for you (you'll be asked to confirm the download). Turn off to connect to a server you run yourself."
      )
      .addToggle((t) =>
        t.setValue(ai.managed).onChange(async (v) => {
          ai.managed = v;
          await this.plugin.save();
          this.display();
        })
      );

    if (ai.managed) {
      new Setting(containerEl)
        .setName("Start OpenCode when Obsidian opens")
        .setDesc("Starts it quietly in the background so your first AI message doesn't wait. It stops when Obsidian closes. Off by default.")
        .addToggle((t) =>
          t.setValue(!!ai.preStart).onChange(async (v) => {
            ai.preStart = v;
            await this.plugin.save();
          })
        );
      const mgr = this.plugin.manager;
      const status = new Setting(containerEl).setName("Status").setDesc("");
      // Built only from saved settings, so drawing this page never touches the disk or starts a program.
      const statusText = () => {
        if (mgr.isRunning()) return `Running on ${mgr.conn.url}${ai.installedVersion ? ` (v${ai.installedVersion})` : ""}.`;
        if (mgr.setupBusy) return mgr.setupMsg || "Setting up OpenCode...";
        if (mgr.setupError) return `Setup didn't finish: ${mgr.setupError} Press Download and install to try again.`;
        if (ai.autoDeclined && !ai.managedBinary && !ai.binaryPath && !mgr.foundPath) {
          return "Not set up. You said no to the automatic download, so it won't ask again. Press Download and install whenever you want it.";
        }
        if (ai.managedBinary || ai.binaryPath || mgr.foundPath) {
          return `Ready${ai.installedVersion ? ` (v${ai.installedVersion})` : ""}. It starts when you use the AI chat.`;
        }
        return "Not set up yet.";
      };
      const showStatus = () => status.setDesc(statusText());
      showStatus();
      status.addButton((b) =>
        b.setButtonText("Check again").onClick(() => {
          status.setDesc("Checking...");
          mgr
            .describe()
            .then((d) => status.setDesc(d))
            .catch((e) => status.setDesc(str(e.message)));
        })
      );
      const guarded = (fn) => async () => {
        if (mgr.setupBusy) return new Notice("OpenCode is already being set up. Please wait.");
        if (ai.autoDeclined) {
          ai.autoDeclined = false;
          await this.plugin.save();
        }
        const note = new Notice("Working...", 0);
        try {
          await fn((m) => note.setMessage(m));
        } catch (e) {
          new Notice(str(e.message), 10000);
        } finally {
          note.hide();
          this.display();
        }
      };
      // First time OpenCode is turned on: set it up automatically, after the page has drawn.
      if (!mgr.setupRun && !ai.managedBinary && !ai.binaryPath && !ai.autoDeclined && Platform.isDesktopApp) {
        activeWindow.setTimeout(() => {
          if (!containerEl.isConnected || mgr.setupRun) return;
          mgr.setupMsg = "";
          const run = mgr.autoSetup((m) => {
            mgr.setupMsg = m;
            if (containerEl.isConnected) showStatus();
          });
          showStatus();
          run.then(() => {
            if (containerEl.isConnected) this.display();
          });
        }, 300);
      }
      status
        .addButton((b) =>
          b.setButtonText("Download and install").onClick(
            guarded(async (say) => {
              mgr.stop();
              const r = await mgr.install(say);
              new Notice(`Installed OpenCode v${r.version} (checksum verified).`, 8000);
            })
          )
        )
        .addButton((b) =>
          b.setButtonText(mgr.isRunning() ? "Stop" : "Start").onClick(
            guarded(async (say) => {
              if (mgr.isRunning()) mgr.stop();
              else await this.plugin.manager.ensure(say);
            })
          )
        );
      containerEl.createEl("p", {
        cls: "setting-item-description",
        text: `Download slow or stuck? You can skip it: download the Windows zip yourself from github.com/${OPENCODE_REPO}/releases (your browser is usually faster), unzip it, and enter the path to opencode.exe under "OpenCode program" below. Or use the Direct API backend, which needs no download at all.`,
      });

      let providerId = PROVIDERS[0][0];
      let apiKey = "";
      new Setting(containerEl)
        .setName("Connect an AI provider")
        .setDesc(
          "Paste an API key and it is saved into OpenCode's own auth.json (merged with anything already there), not into your vault. " +
            "Already connected through OpenCode itself? You can skip this."
        )
        .addDropdown((d) => {
          for (const [id, label] of PROVIDERS) d.addOption(id, label);
          d.setValue(providerId).onChange((v) => (providerId = v));
        })
        .addText((t) => {
          t.inputEl.type = "password";
          t.setPlaceholder("API key").onChange((v) => (apiKey = v));
        })
        .addButton((b) =>
          b.setButtonText("Save key").onClick(() => {
            if (!apiKey.trim()) return new Notice("Paste a key first.");
            try {
              const file = mgr.saveProviderKey(providerId, apiKey);
              new Notice(`Saved to ${file}. OpenCode restarts the next time you use the AI chat.`, 8000);
              apiKey = "";
              this.display();
            } catch (e) {
              new Notice(str(e.message), 10000);
            }
          })
        );

      new Setting(containerEl)
        .setName("OpenCode program (optional)")
        .setDesc("Full path to an opencode program you installed yourself. Leave empty to use the downloaded one or the one on your PATH.")
        .addText((t) =>
          t.setValue(ai.binaryPath).onChange(async (v) => {
            ai.binaryPath = v.trim();
            await this.plugin.save();
          })
        );
    } else {
      new Setting(containerEl)
        .setName("Server URL")
        .setDesc("For a server you start yourself with `opencode serve`. Default is http://127.0.0.1:4096")
        .addText((t) =>
          t.setValue(ai.url).onChange(async (v) => {
            ai.url = v.trim();
            await this.plugin.save();
          })
        );
      new Setting(containerEl)
        .setName("Username")
        .setDesc("Only used if you set OPENCODE_SERVER_PASSWORD. Defaults to opencode.")
        .addText((t) =>
          t.setValue(ai.username).onChange(async (v) => {
            ai.username = v.trim() || "opencode";
            await this.plugin.save();
          })
        );
      new Setting(containerEl)
        .setName("Password")
        .setDesc("Stored as plain text in this plugin's data.json, which syncs with your vault.")
        .addText((t) => {
          t.inputEl.type = "password";
          t.setValue(ai.password).onChange(async (v) => {
            ai.password = v;
            await this.plugin.save();
          });
        });
    }

    new Setting(containerEl)
      .setName("Model (optional)")
      .setDesc("Format provider/model, for example anthropic/claude-sonnet-4-5. Leave empty to use OpenCode's default.")
      .addText((t) =>
        t.setValue(ai.model).onChange(async (v) => {
          ai.model = v.trim();
          await this.plugin.save();
        })
      );
    new Setting(containerEl)
      .setName("Agent (optional)")
      .setDesc("An OpenCode agent name. Leave empty for the default. Use Test connection to see the names available.")
      .addText((t) =>
        t.setValue(ai.agent).onChange(async (v) => {
          ai.agent = v.trim();
          await this.plugin.save();
        })
      );
    new Setting(containerEl).setName("Test connection").addButton((b) =>
      b.setButtonText("Test").onClick(async () => {
        if (ai.managed && !this.plugin.manager.isRunning()) {
          return new Notice("OpenCode isn't running yet. It starts when you use the AI chat, or press Start above.", 8000);
        }
        const oc = this.plugin.openCode();
        try {
          const h = await oc.health();
          let names = "";
          try {
            const agents = await oc.agents();
            names = Array.isArray(agents) ? agents.map((a) => a.name || a.id).filter(Boolean).join(", ") : "";
          } catch (e) {
            /* agents list is optional */
          }
          new Notice(`Connected to OpenCode${h && h.version ? " " + h.version : ""}.${names ? " Agents: " + names : ""}`, 8000);
        } catch (e) {
          new Notice(friendlyError(e, oc.base()), 8000);
        }
      })
    );

    };

    if (this.plugin.backend() === "api") renderApi();
    else renderOpenCode();

    new Setting(containerEl).setName("Calendar").setHeading();
    const cal = st.calendar;
    new Setting(containerEl)
      .setName("Enable the calendar module")
      .setDesc("Adds a class and exam calendar: import an .ics schedule, open a note for a class in one click, see exam countdowns, and embed a day's classes in a note. Off by default.")
      .addToggle((t) =>
        t.setValue(!!cal.enabled).onChange(async (v) => {
          cal.enabled = v;
          await this.plugin.save();
          await this.plugin.onCalendarToggled();
          this.display();
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
              this.plugin.invalidateCalendar();
              await this.plugin.save();
              this.plugin.refreshCalendarViews();
            })
          )
          .addButton((b) =>
            b.setButtonText("Sync").onClick(async () => {
              try {
                await this.plugin.syncCalendarSource(src.id);
                new Notice("Schedule updated.");
              } catch (e) {
                new Notice(str(e.message));
              }
              this.display();
            })
          )
          .addButton((b) =>
            b.setButtonText("Remove").setWarning().onClick(async () => {
              await this.plugin.removeCalendarSource(src.id);
              this.display();
            })
          );
      }
      new Setting(containerEl)
        .setName("Add a schedule")
        .setDesc("Import an .ics file from the vault, or paste a public calendar feed. Google share links are converted to their .ics address.")
        .addButton((b) => b.setButtonText("Add").onClick(() => this.plugin.openCalendarImport()));

      new Setting(containerEl).setName("Class notes").setHeading();
      new Setting(containerEl)
        .setName("Note folder")
        .setDesc("Where class notes go when no subject folder matches. Leave empty for the vault root.")
        .addText((t) =>
          t.setPlaceholder("e.g. University").setValue(cal.noteFolder).onChange(async (v) => {
            cal.noteFolder = v.trim();
            await this.plugin.save();
          })
        );
      new Setting(containerEl)
        .setName("Note name format")
        .setDesc("Variables: {date}, {subject}, {time}, {time_start}, {time_end}, {room}, {lecturer}, {type}.")
        .addText((t) =>
          t.setValue(cal.noteNameFormat).onChange(async (v) => {
            cal.noteNameFormat = v;
            await this.plugin.save();
          })
        );
      new Setting(containerEl)
        .setName("Note template")
        .setDesc("Used for new class notes. {course} is the cleaned subject name, so questions filed in the same folder can be tagged with it.")
        .addTextArea((t) => {
          t.inputEl.rows = 10;
          t.setValue(cal.noteTemplate).onChange(async (v) => {
            cal.noteTemplate = v;
            await this.plugin.save();
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
              await this.plugin.save();
            })
          )
          .addButton((b) =>
            b.setButtonText("Remove").onClick(async () => {
              delete cal.subjectFolders[subject];
              await this.plugin.save();
              this.display();
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
            this.plugin.invalidateCalendar();
            await this.plugin.save();
            this.plugin.refreshCalendarViews();
          })
        );
      new Setting(containerEl)
        .setName("Excluded keywords")
        .setDesc("Comma-separated. Any event whose title, room or description contains one of these is hidden.")
        .addText((t) =>
          t.setValue(cal.excludedKeywords.join(", ")).onChange(async (v) => {
            cal.excludedKeywords = v.split(",").map((x) => x.trim()).filter(Boolean);
            this.plugin.invalidateCalendar();
            await this.plugin.save();
            this.plugin.refreshCalendarViews();
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
              await this.plugin.save();
              this.plugin.refreshCalendarViews();
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
              await this.plugin.save();
              this.plugin.refreshCalendarViews();
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
              await this.plugin.save();
              this.plugin.refreshCalendarViews();
            })
        );

      new Setting(containerEl).setName("Class colors").setHeading();
      for (const category of CLASS_CATEGORIES) {
        new Setting(containerEl).setName(category.label).addColorPicker((c) =>
          c.setValue(cal.classColors[category.id] || category.color).onChange(async (v) => {
            cal.classColors[category.id] = v;
            await this.plugin.save();
            this.plugin.refreshCalendarViews();
          })
        );
      }

      new Setting(containerEl).setName("Actions").setHeading();
      new Setting(containerEl)
        .setName("Create or open the note for the next class")
        .setDesc("Uses the note template above and the subject's folder.")
        .addButton((b) => b.setButtonText("Open note").onClick(() => this.plugin.openNextClassNote()));
      new Setting(containerEl)
        .setName("Export the visible schedule")
        .setDesc("Writes schedule-export.ics to the vault root, with hidden sources and excluded subjects left out.")
        .addButton((b) => b.setButtonText("Export .ics").onClick(() => this.plugin.exportCalendarIcs()));
    }

    new Setting(containerEl).setName("Presets").setHeading();
    if (!st.presets.length) {
      containerEl.createEl("p", {
        text: "No presets yet. Set filters in the practice view and tap 'Save as preset'.",
        cls: "setting-item-description",
      });
    }
    for (const pr of st.presets) {
      const desc =
        [pr.filters, ...(pr.moreSets || [])]
          .filter(hasFilters)
          .map((f) =>
            FILTER_FIELDS.map(([k]) => (fvals(f, k).length ? `${k}: ${fvals(f, k).join(" or ")}` : ""))
              .filter(Boolean)
              .join(", ")
          )
          .join("  |OR|  ") || "no filters";
      new Setting(containerEl)
        .setName(pr.name)
        .setDesc(`${desc} · ${pr.mode}`)
        .addButton((b) =>
          b.setButtonText("Rename").onClick(() =>
            new NameModal(this.app, "Rename preset", pr.name, async (name) => {
              pr.name = name;
              await this.plugin.save();
              this.display();
              this.plugin.refreshViews();
            }).open()
          )
        )
        .addButton((b) =>
          b.setButtonText("Delete").setWarning().onClick(async () => {
            st.presets = st.presets.filter((x) => x.id !== pr.id);
            if (st.activePreset === pr.id) st.activePreset = "";
            await this.plugin.save();
            this.display();
            this.plugin.refreshViews();
          })
        );
    }
  }
}

module.exports = {
  QuestionTrackerSettingTab,
};
