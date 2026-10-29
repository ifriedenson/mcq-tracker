"use strict";
const { Notice, Platform, PluginSettingTab, Setting } = require("obsidian");
const { FILTER_FIELDS, FOLDER_AUTO_MAX } = require("./constants");
const { API_PRESETS, ApiClient, friendlyApiError } = require("./api-client");
const { str } = require("./util");
const { OPENCODE_REPO, PROVIDERS } = require("./opencode-manager");
const { friendlyError } = require("./opencode-client");
const { fvals, hasFilters } = require("./filters");
const { NameModal } = require("./modals");
const { renderCalendarSettings } = require("./calendar-settings");
const { CARDS_TABS, renderCardsSettings } = require("./cards-settings");
const { renderDailySettings } = require("./daily-quiz-settings");
const { GLOBAL_TABS, renderGlobalSettings } = require("./settings-global");
const { openExternal, renderSettingsTabs } = require("./settings-ui");
const { STUDY_SKIN_LABELS, normalizeStudySkin } = require("./study-skin");
const { TUTOR_COMMANDS, TUTOR_ROLES, normalizeTutorRole } = require("./tutor-presets");

const SETTINGS_MODULES = [
  { id: "global", label: "Global", icon: "settings" },
  { id: "mcq", label: "MCQ Tracker", icon: "list-checks" },
  { id: "cards", label: "Cards", icon: "layers" },
  { id: "calendar", label: "Calendar", icon: "graduation-cap" },
];

const MCQ_TABS = [
  { id: "practice", label: "Practice", icon: "play" },
  { id: "review", label: "Review", icon: "repeat" },
  { id: "daily", label: "Daily quiz", icon: "sun" },
  { id: "ai", label: "AI", icon: "sparkles" },
  { id: "about", label: "About", icon: "info" },
];

/* --------------------------------------------------------------- settings */

class QuestionTrackerSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.activeModule = "global";
    this.activeGlobalTab = "modules";
    this.activeMcqTab = "practice";
    this.activeCardsTab = "decks";
    this.activeCalendarTab = "about";
  }

  display() {
    const rootEl = this.containerEl;
    const st = this.plugin.settings;
    rootEl.empty();

    this.renderModuleNav(rootEl);
    const containerEl = rootEl.createDiv({ cls: "qt-settings-body" });

    if (this.activeModule === "global") {
      renderGlobalSettings(
        containerEl,
        this.plugin,
        () => this.display(),
        this.activeGlobalTab,
        (id) => {
          this.activeGlobalTab = id;
          this.display();
        }
      );
      return;
    }

    if (this.activeModule === "cards") {
      renderCardsSettings(
        containerEl,
        this.plugin,
        () => this.display(),
        this.activeCardsTab,
        (id) => {
          this.activeCardsTab = id;
          this.display();
        }
      );
      return;
    }

    if (this.activeModule === "calendar") {
      renderCalendarSettings(
        containerEl,
        this.plugin,
        () => this.display(),
        this.activeCalendarTab,
        (id) => {
          this.activeCalendarTab = id;
          this.display();
        }
      );
      return;
    }

    this.renderMcqTabs(containerEl);
    if (!this.plugin.mcqEnabled()) {
      containerEl.createEl("p", {
        cls: "setting-item-description",
        text: "The MCQ Tracker module is off. Turn it on under Global, Modules.",
      });
    }
    if (this.activeMcqTab === "about") {
      this.renderAbout(containerEl);
      return;
    }

    if (this.activeMcqTab === "daily") {
      renderDailySettings(containerEl, this.plugin, () => this.display());
      return;
    }

    if (this.activeMcqTab === "practice") {

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
    }

    if (this.activeMcqTab === "review") {
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
      .setName("Known snooze (days)")
      .setDesc("How long the Known button hides a question or card before it returns as due. You can still use the note property for a different period.")
      .addText((t) =>
        t.setValue(String(st.knownDays || 14)).onChange(async (v) => {
          const n = parseInt(v, 10);
          if (n > 0) {
            st.knownDays = n;
            await this.plugin.save();
            this.plugin.refreshViews();
          }
        })
      );

    new Setting(containerEl)
      .setName("Known and excluded items")
      .setDesc("Review and restore questions or cards that are hidden from practice.")
      .addButton((b) => b.setButtonText("Manage").onClick(() => this.plugin.openStudyStatusManager()));

    new Setting(containerEl)
      .setName("Scheduler")
      .setDesc(
        "Simple ladder uses fixed intervals. FSRS schedules each question from an estimated memory state and your target recall. " +
          "FSRS is optional and off by default; switching it on never rewrites an existing next review date until that question is next reviewed."
      )
      .addDropdown((d) =>
        d
          .addOptions({ ladder: "Simple ladder (default)", fsrs: "FSRS (memory model)" })
          .setValue(st.scheduler)
          .onChange(async (v) => {
            if (v === "fsrs" && st.scheduler !== "fsrs") {
              const ok = await this.plugin.askConfirm(
                "Use FSRS scheduling?",
                "FSRS is an optional memory-model scheduler. The first time a question is reviewed, its saved history is replayed to build an FSRS state. Existing next review dates are not changed until that review.\n\nSwitching back to the simple ladder is lossless: FSRS state is kept in the note and the ladder resumes from your streak.",
                "Use FSRS"
              );
              if (!ok) {
                this.display();
                return;
              }
            }
            st.scheduler = v;
            await this.plugin.save();
            this.display();
            this.plugin.refreshViews();
          })
      );

    if (st.scheduler === "fsrs") {
      new Setting(containerEl)
        .setName("Desired retention")
        .setDesc("The recall probability FSRS aims for. Higher retention means more reviews and shorter intervals. The default is 90%.")
        .addDropdown((d) =>
          d
            .addOptions({ "0.85": "85%", "0.9": "90%", "0.95": "95%" })
            .setValue(String(st.fsrsRetention))
            .onChange(async (v) => {
              st.fsrsRetention = Number(v) || 0.9;
              await this.plugin.save();
              this.plugin.refreshViews();
            })
        );
      containerEl.createEl("p", {
        cls: "setting-item-description",
        text: "FSRS uses the MIT-licensed ts-fsrs 5.4.1 scheduler. State is stored in the note's srs property; history remains the source of truth.",
      });
    }

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
    }

    if (this.activeMcqTab === "practice") {
    new Setting(containerEl)
      .setName("Study cards skin")
      .setDesc("An optional Quizlet-style view over the same question notes. Off by default. Flip cards show the question first; choice cards let you pick a choice and then reveal the answer. Reviews use the normal scheduler and history.")
      .addDropdown((d) => {
        for (const [id, label] of Object.entries(STUDY_SKIN_LABELS)) d.addOption(id, label);
        d.setValue(normalizeStudySkin(st.studySkin))
          .onChange(async (v) => {
            st.studySkin = normalizeStudySkin(v);
            await this.plugin.save();
            this.plugin.refreshViews();
          });
      });

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
    }

    if (this.activeMcqTab === "ai") {
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
    new Setting(containerEl)
      .setName("Tutor role")
      .setDesc("The default voice for Ask AI and the assistant chat. You can also change it in a chat.")
      .addDropdown((d) => {
        for (const role of TUTOR_ROLES) d.addOption(role.id, role.label);
        d.setValue(normalizeTutorRole(ai.tutorRole)).onChange(async (v) => {
          ai.tutorRole = normalizeTutorRole(v);
          await this.plugin.save();
        });
      });
    containerEl.createEl("p", {
      cls: "setting-item-description",
      text: `Tutor commands: ${TUTOR_COMMANDS.map((c) => `/${c.id}`).join(", ")}. Type one at the start of a chat message to steer the next reply.`,
    });
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
    }

    if (this.activeMcqTab === "practice") {
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

  renderModuleNav(rootEl) {
    renderSettingsTabs(
      rootEl,
      SETTINGS_MODULES,
      this.activeModule,
      (id) => {
        this.activeModule = id;
        this.display();
      },
      { className: "qt-settings-modules", tabClass: "qt-settings-module" }
    );
  }

  renderMcqTabs(containerEl) {
    renderSettingsTabs(
      containerEl,
      MCQ_TABS,
      this.activeMcqTab,
      (id) => {
        this.activeMcqTab = id;
        this.display();
      },
      { className: "qt-settings-tabs", tabClass: "qt-settings-tab" }
    );
  }

  renderAbout(containerEl) {
    const version = (this.plugin.manifest && this.plugin.manifest.version) || "";
    const card = containerEl.createDiv({ cls: "qt-settings-card" });
    card.createEl("h3", { text: "MCQ Tracker" });
    card.createEl("p", {
      cls: "setting-item-description",
      text: "Serve practice questions from your notes, grade answers, and track time, confidence and spaced review in note properties.",
    });
    new Setting(containerEl)
      .setName("Practice view")
      .setDesc("Open the practice view to start a session, choose filters, or continue where you left off.")
      .addButton((b) => b.setButtonText("Open practice").onClick(() => this.plugin.activateView()));
    new Setting(containerEl)
      .setName("About the project")
      .setDesc(version ? `Version ${version}.` : "Source code and issue tracker.")
      .addButton((b) => b.setButtonText("GitHub repository").onClick(() => openExternal("https://github.com/ifriedenson/mcq-tracker")))
      .addButton((b) => b.setButtonText("Report bug").onClick(() => openExternal("https://github.com/ifriedenson/mcq-tracker/issues")));
  }
}

module.exports = {
  CARDS_TABS,
  GLOBAL_TABS,
  MCQ_TABS,
  QuestionTrackerSettingTab,
  SETTINGS_MODULES,
};
