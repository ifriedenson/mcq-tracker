"use strict";
const { Notice, Platform, PluginSettingTab, SecretComponent, Setting } = require("obsidian");
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
const { normalizeQuickAdaptive } = require("./adaptive-session");
const { formatNoteSets, normalizeNoteReview, parseNoteSets } = require("./note-review");
const { normalizeExamReadyPasses } = require("./view-helpers");
const { normalizeSpacedEverything } = require("./spaced-everything");
const { formatCourseDays, parseCourseDays } = require("./study-status");
const { GLOBAL_TABS, renderGlobalSettings } = require("./settings-global");
const { REFERENCE_TABS, renderReferenceSettings } = require("./reference-settings");
const { ASSIGNMENTS_TABS, renderAssignmentsSettings } = require("./assignments-settings");
const { openExternal, renderSettingsTabs } = require("./settings-ui");
const { STUDY_MODE_LABELS, STUDY_SKIN_LABELS, normalizeStudyMode, normalizeStudySkin } = require("./study-skin");
const { TUTOR_COMMANDS, TUTOR_ROLES, normalizeTutorRole } = require("./tutor-presets");
const { normalizeAiContext } = require("./ai-context");
const { AI_FEATURES, CAPABILITY_LABELS } = require("./ai-service");
const { normalizeVerificationMode } = require("./answer-verification");
const { hasSecretStorage, readSecretValue, storeSecretValue, OPENCODE_PASSWORD_SECRET } = require("./secret-keys");

const SETTINGS_MODULES = [
  { id: "global", label: "Global", icon: "settings" },
  { id: "mcq", label: "MCQ Tracker", icon: "list-checks" },
  { id: "cards", label: "Cards", icon: "layers" },
  { id: "calendar", label: "Calendar", icon: "graduation-cap" },
  { id: "assignments", label: "Assignments", icon: "clipboard-list" },
  { id: "reference", label: "Reference", icon: "book-open" },
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
    this.activeAssignmentsTab = "grading";
    this.activeReferenceTab = "tools";
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

    if (this.activeModule === "assignments") {
      renderAssignmentsSettings(
        containerEl,
        this.plugin,
        () => this.display(),
        this.activeAssignmentsTab,
        (id) => {
          this.activeAssignmentsTab = id;
          this.display();
        }
      );
      return;
    }

    if (this.activeModule === "reference") {
      renderReferenceSettings(
        containerEl,
        this.plugin,
        () => this.display(),
        this.activeReferenceTab,
        (id) => {
          this.activeReferenceTab = id;
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
      .setName("Per-course Known snooze")
      .setDesc("Course=days pairs such as BIO 101=7, CHEM 201=21. A matching course overrides the global snooze; unmatched items use the value above.")
      .addText((t) =>
        t
          .setPlaceholder("BIO 101=7, CHEM 201=21")
          .setValue(formatCourseDays(st.knownDaysByCourse))
          .onChange(async (v) => {
            st.knownDaysByCourse = parseCourseDays(v);
            await this.plugin.save();
            this.plugin.refreshViews();
          })
      );

    new Setting(containerEl)
      .setName("Leech threshold")
      .setDesc("Consecutive misses that mark a question as a leech. 0 turns leech handling off; a correct answer clears the mark.")
      .addText((t) =>
        t.setValue(String(st.leechThreshold || 0)).onChange(async (v) => {
          const n = parseInt(v, 10);
          if (Number.isFinite(n) && n >= 0) {
            st.leechThreshold = Math.min(50, n);
            await this.plugin.save();
          }
        })
      );

    new Setting(containerEl)
      .setName("When an item becomes a leech")
      .setDesc("Flag keeps it in practice with a visible mark. Suspend also hides it until you restore it under Hidden study items.")
      .addDropdown((d) =>
        d
          .addOptions({ flag: "Flag only", suspend: "Flag and suspend" })
          .setValue(st.leechAction === "suspend" ? "suspend" : "flag")
          .onChange(async (v) => {
            st.leechAction = v === "suspend" ? "suspend" : "flag";
            await this.plugin.save();
            this.plugin.refreshViews();
          })
      );

    new Setting(containerEl)
      .setName("Needs-fixing flag")
      .setDesc(
        "After misses on five different days, mark a question for repair and show a Mark fixed action. Off by default. Mark fixed clears the flag without deleting attempts or history."
      )
      .addToggle((t) =>
        t.setValue(st.needsFixing === true).onChange(async (v) => {
          st.needsFixing = v === true;
          await this.plugin.save();
          this.plugin.refreshViews();
        })
      );

    new Setting(containerEl)
      .setName("Hidden study items")
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
    const adaptive = normalizeQuickAdaptive(st.quickAdaptive);
    new Setting(containerEl)
      .setName("Adaptive session length")
      .setDesc("Quick Practice and the daily quiz can warm up or stretch a little based on recent accuracy, pace and logged skips. Off by default; the recommendation is always shown and can be overridden for a session.")
      .addToggle((t) =>
        t.setValue(adaptive.enabled).onChange(async (v) => {
          st.quickAdaptive = { ...adaptive, enabled: v };
          await this.plugin.save();
          this.plugin.refreshViews();
          this.display();
        })
      );

    new Setting(containerEl)
      .setName("Adaptive hard caps")
      .setDesc("Minutes: minimum and maximum. Questions: minimum and maximum. The planner never goes outside these values.")
      .addText((t) => {
        t.inputEl.type = "number";
        t.setValue(String(adaptive.minMinutes)).onChange(async (v) => {
          st.quickAdaptive = normalizeQuickAdaptive({ ...adaptive, minMinutes: v });
          await this.plugin.save();
        });
      })
      .addText((t) => {
        t.inputEl.type = "number";
        t.setValue(String(adaptive.maxMinutes)).onChange(async (v) => {
          st.quickAdaptive = normalizeQuickAdaptive({ ...adaptive, maxMinutes: v });
          await this.plugin.save();
        });
      })
      .addText((t) => {
        t.inputEl.type = "number";
        t.setValue(String(adaptive.minCount)).onChange(async (v) => {
          st.quickAdaptive = normalizeQuickAdaptive({ ...adaptive, minCount: v });
          await this.plugin.save();
        });
      })
      .addText((t) => {
        t.inputEl.type = "number";
        t.setValue(String(adaptive.maxCount)).onChange(async (v) => {
          st.quickAdaptive = normalizeQuickAdaptive({ ...adaptive, maxCount: v });
          await this.plugin.save();
        });
      });

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
      .setName("Study cards mode")
      .setDesc("Flashcards keeps the flip or choice review. Learn repeats a missed card once in the same session. Test hides the answer until the end, then lists every item with your answer and the key. Match pairs up to six prompts with their answers; a correct match records one review and a wrong tap records nothing.")
      .addDropdown((d) => {
        for (const [id, label] of Object.entries(STUDY_MODE_LABELS)) d.addOption(id, label);
        d.setValue(normalizeStudyMode(st.studyMode))
          .onChange(async (v) => {
            st.studyMode = normalizeStudyMode(v);
            await this.plugin.save();
          });
      });

    new Setting(containerEl).setName("Whole-note review").setHeading();
    const noteReview = normalizeNoteReview(st.noteReview);
    new Setting(containerEl)
      .setName("Enable whole-note review")
      .setDesc("Adds a Review notes command and a due count in the status bar. Notes are scheduled by the same ladder or FSRS as questions and cards; question and card notes are excluded.")
      .addToggle((t) =>
        t.setValue(noteReview.enabled).onChange(async (v) => {
          st.noteReview = normalizeNoteReview({ ...noteReview, enabled: v });
          await this.plugin.save();
          this.plugin.refreshNoteReviewStatus();
        })
      );
    new Setting(containerEl)
      .setName("Note sets")
      .setDesc("One set per line: Name | folders | tags | priority. Folders include subfolders; blank folders or tags mean any. With no sets, only notes marked note_review: true are reviewed.")
      .addTextArea((t) => {
        t.setValue(formatNoteSets(noteReview.sets)).setPlaceholder("Class notes | Notes, Lectures | review | high");
        t.inputEl.rows = 4;
        t.onChange(async (v) => {
          st.noteReview = normalizeNoteReview({ ...noteReview, sets: parseNoteSets(v) });
          await this.plugin.save();
          this.plugin.refreshNoteReviewStatus();
        });
      });

    new Setting(containerEl).setName("Spaced Everything").setHeading();
    const spaced = normalizeSpacedEverything(st.spacedEverything);
    containerEl.createEl("p", {
      cls: "setting-item-description",
      text: "An optional SuperMemo 2 whole-note queue. Use Spaced Everything: log review outcome for this note to onboard and rate the open note, or review due notes. Notes store se-interval, se-ease and se-last-reviewed; question and card tracking is never changed. Capture thought templates support {{date}}, {{time}}, {{unixtime}} and {{thought}}.",
    });
    new Setting(containerEl)
      .setName("Enable Spaced Everything")
      .setDesc("Adds Spaced Everything: review due notes, log review outcome and capture thought.")
      .addToggle((t) =>
        t.setValue(spaced.enabled).onChange(async (v) => {
          st.spacedEverything = normalizeSpacedEverything({ ...spaced, enabled: v });
          await this.plugin.save();
          this.plugin.refreshNoteReviewStatus();
        })
      );
    new Setting(containerEl)
      .setName("Default interval")
      .setDesc("Days before a newly onboarded note comes back for its first review.")
      .addText((t) =>
        t.setValue(String(spaced.defaultInterval)).onChange(async (v) => {
          const n = Number(v);
          if (!Number.isFinite(n)) return;
          st.spacedEverything = normalizeSpacedEverything({ ...spaced, defaultInterval: n });
          await this.plugin.save();
        })
      );
    new Setting(containerEl)
      .setName("Default ease")
      .setDesc("Starting ease factor for the SM-2 interval calculation. Minimum 1.3.")
      .addText((t) =>
        t.setValue(String(spaced.defaultEase)).onChange(async (v) => {
          const n = Number(v);
          if (!Number.isFinite(n)) return;
          st.spacedEverything = normalizeSpacedEverything({ ...spaced, defaultEase: n });
          await this.plugin.save();
        })
      );
    new Setting(containerEl)
      .setName("Capture folder")
      .setDesc("Vault-relative folder for captured thoughts. Leave empty for the vault root.")
      .addText((t) =>
        t.setValue(spaced.captureFolder).setPlaceholder("Inbox").onChange(async (v) => {
          st.spacedEverything = normalizeSpacedEverything({ ...spaced, captureFolder: v });
          await this.plugin.save();
        })
      );
    new Setting(containerEl)
      .setName("Capture title template")
      .setDesc("Supports {{date}}, {{time}} and {{unixtime}}.")
      .addText((t) =>
        t.setValue(spaced.titleTemplate).onChange(async (v) => {
          st.spacedEverything = normalizeSpacedEverything({ ...spaced, titleTemplate: v });
          await this.plugin.save();
        })
      );
    new Setting(containerEl)
      .setName("Capture note template")
      .setDesc("Body for a captured thought. {{thought}} is required; if missing, the thought is appended.")
      .addTextArea((t) => {
        t.setValue(spaced.noteTemplate).setPlaceholder("## Captured thought\n{{thought}}");
        t.inputEl.rows = 4;
        t.onChange(async (v) => {
          st.spacedEverything = normalizeSpacedEverything({ ...spaced, noteTemplate: v });
          await this.plugin.save();
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
      .setName("Closed-book practice")
      .setDesc(
        "Hide the Open note shortcut until you submit, so the answer cannot be peeked at during practice. Explanations and source links already appear only on the result screen. Off by default; attempts, history, streak and scheduling are unchanged."
      )
      .addToggle((t) =>
        t.setValue(st.closedBook === true).onChange(async (v) => {
          st.closedBook = v === true;
          await this.plugin.save();
          this.plugin.refreshViews();
        })
      );

    new Setting(containerEl)
      .setName("Exam-ready badge")
      .setDesc(
        "After a question is answered, show Exam ready once it has N correct answers in a row. This reads the existing streak and changes no attempt, history, review date, Auto Anki, Text2Anki or Spaced Repetition output. Off by default."
      )
      .addToggle((t) =>
        t.setValue(st.examReady === true).onChange(async (v) => {
          st.examReady = v === true;
          await this.plugin.save();
          this.plugin.refreshViews();
        })
      );

    new Setting(containerEl)
      .setName("Mastered passes")
      .setDesc("Consecutive correct answers needed for the Exam-ready badge. The default is 2; values are kept between 1 and 10.")
      .addText((t) => {
        t.inputEl.type = "number";
        t.setValue(String(st.examReadyPasses)).onChange(async (v) => {
          if (String(v).trim() === "") return;
          st.examReadyPasses = normalizeExamReadyPasses(v);
          await this.plugin.save();
          this.plugin.refreshViews();
        });
      });

    new Setting(containerEl)
      .setName("Per-question hints")
      .setDesc(
        "Show a Show hint button before you answer when a question has a hint property or a ## Hint section. Off by default, so existing notes look the same. Hints never change attempts, history, streak or scheduling; closed-book practice keeps them hidden."
      )
      .addToggle((t) =>
        t.setValue(st.hints === true).onChange(async (v) => {
          st.hints = v === true;
          await this.plugin.save();
          this.plugin.refreshViews();
        })
      );

    new Setting(containerEl)
      .setName("Export inline quiz results")
      .setDesc(
        "After every question in an mcq-quiz block with an id: line is answered, write score, totalPoints, percentage and passed under the note's quizResults property. Off by default. This is the only inline-quiz write to the note and never changes attempts, history, streak or scheduling."
      )
      .addToggle((t) =>
        t.setValue(st.inlineQuizResults === true).onChange(async (v) => {
          st.inlineQuizResults = v === true;
          await this.plugin.save();
          this.plugin.refreshViews();
        })
      );

    new Setting(containerEl)
      .setName("Inline reorder questions")
      .setDesc(
        "Enable Type: reorder in mcq-quiz blocks. Items use A./B./C. lines, Answer: lists every letter once in the correct order, and ▲/▼ buttons move them. Off by default; other quiz blocks are unchanged."
      )
      .addToggle((t) =>
        t.setValue(st.inlineQuizReorder === true).onChange(async (v) => {
          st.inlineQuizReorder = v === true;
          await this.plugin.save();
          this.plugin.refreshViews();
        })
      );

    new Setting(containerEl)
      .setName("Inline numeric questions")
      .setDesc(
        "Enable Type: numeric in mcq-quiz blocks. Answer is a number, Tolerance is the allowed ± margin, and optional Min/Max bound the input. Off by default; other quiz blocks are unchanged."
      )
      .addToggle((t) =>
        t.setValue(st.inlineQuizNumeric === true).onChange(async (v) => {
          st.inlineQuizNumeric = v === true;
          await this.plugin.save();
          this.plugin.refreshViews();
        })
      );

    new Setting(containerEl)
      .setName("Shared-option quiz questions")
      .setDesc(
        "Use one A./B./C. option set for several mcq-quiz questions. Put the options before the first Q: line and give each question its own Answer. Off by default; blocks with per-question choices are unchanged."
      )
      .addToggle((t) =>
        t.setValue(st.inlineQuizSharedChoice === true).onChange(async (v) => {
          st.inlineQuizSharedChoice = v === true;
          await this.plugin.save();
          this.plugin.refreshViews();
        })
      );

    new Setting(containerEl)
      .setName("Exam block mode")
      .setDesc("Choose Study to show the correct options and analysis immediately, or Answer to hide the key until the reader clicks a choice (multi-select needs Submit). The exam block is an fenced exam code block using num, source, stem, options, answer and analysis tags.")
      .addDropdown((d) =>
        d
          .addOptions({ study: "Study (show answers)", answer: "Answer (grade clicks)" })
          .setValue(st.examBlockMode === "answer" ? "answer" : "study")
          .onChange(async (v) => {
            st.examBlockMode = v === "answer" ? "answer" : "study";
            await this.plugin.save();
            this.plugin.refreshViews();
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
    new Setting(containerEl)
      .setName("Check AI-written answers")
      .setDesc("AI-written multiple-choice answers are checked by a second independent call. Numeric answers with a calculation or answer formula are checked locally by arithmetic. Flag a disagreement for review, or drop a mismatched multiple-choice item.")
      .addDropdown((d) =>
        d
          .addOption("mark", "Flag mismatches for review")
          .addOption("drop", "Drop mismatched items")
          .setValue(normalizeVerificationMode(ai.verification))
          .onChange(async (v) => {
            ai.verification = normalizeVerificationMode(v);
            await this.plugin.save();
          })
      );
    new Setting(containerEl).setName("Study context (read-only)").setHeading();
    containerEl.createEl("p", {
      cls: "setting-item-description",
      text: "Optional aggregate context for the AI assistant: counts, accuracy, weakest skill and the next exam. No note text, question text or answers are included. Everything is off by default, and nothing is sent unless AI features are on and you send a message.",
    });
    const aiContext = normalizeAiContext(ai.context);
    const contextOptions = [
      { key: "stats", name: "Practice statistics", desc: "Question and attempt counts, accuracy and the weakest skill with at least three attempts." },
      { key: "due", name: "Due work", desc: "Due and unseen question counts, plus due and new card counts." },
      { key: "exams", name: "Next exam", desc: "The next upcoming calendar exam, its date and countdown." },
    ];
    for (const item of contextOptions) {
      new Setting(containerEl)
        .setName(item.name)
        .setDesc(item.desc)
        .addToggle((t) =>
          t.setValue(aiContext[item.key] === true).onChange(async (v) => {
            ai.context = normalizeAiContext(ai.context);
            ai.context[item.key] = v;
            await this.plugin.save();
            this.plugin.refreshViews();
          })
        );
    }
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
        const keySetting = new Setting(containerEl).setName("API key");
        if (hasSecretStorage(this.app) && typeof SecretComponent === "function") {
          const current = (api.secrets || {})[api.provider] || "";
          keySetting
            .setDesc(
              "Stored in Obsidian's Secret Storage, outside data.json. Secret Storage may be per device, so select or create a secret on each device you use."
            )
            .addComponent((el) => {
              const comp = new SecretComponent(this.app, el);
              comp.setValue(current).onChange(async (value) => {
                api.secrets = api.secrets || {};
                api.secrets[api.provider] = str(value).trim();
                await this.plugin.save();
              });
            });
        } else {
          keySetting
            .setDesc(
              "Secret Storage is not available in this Obsidian version, so the key is stored as plain text in data.json and syncs with your vault. Anyone with access to the vault can read it."
            )
            .addText((t) => {
              t.inputEl.type = "password";
              t.setValue((api.keys || {})[api.provider] || "").onChange(async (v) => {
                api.keys = api.keys || {};
                api.keys[api.provider] = v.trim();
                await this.plugin.save();
              });
            });
        }
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
      const secretStorage = hasSecretStorage(this.app);
      const savedPassword = secretStorage && ai.passwordSecret ? readSecretValue(this.app, ai.passwordSecret) : str(ai.password);
      new Setting(containerEl)
        .setName("Password")
        .setDesc(
          secretStorage
            ? "Stored in Obsidian's Secret Storage, outside data.json. Secret Storage may be per device."
            : "Secret Storage is not available in this Obsidian version. The password stays in memory for this session unless you explicitly allow saving it below."
        )
        .addText((t) => {
          t.inputEl.type = "password";
          t.setValue(savedPassword || this.plugin.sessionOpenCodePassword || "").onChange(async (v) => {
            this.plugin.sessionOpenCodePassword = v;
            if (secretStorage) {
              if (v) {
                if (storeSecretValue(this.app, OPENCODE_PASSWORD_SECRET, v)) {
                  ai.passwordSecret = OPENCODE_PASSWORD_SECRET;
                  ai.password = "";
                } else {
                  ai.password = v;
                }
              } else {
                ai.passwordSecret = "";
                ai.password = "";
              }
            } else {
              ai.password = ai.rememberPassword === true ? v : "";
            }
            await this.plugin.save();
          });
        });
      if (!secretStorage) {
        new Setting(containerEl)
          .setName("Remember OpenCode password")
          .setDesc("Off by default. When on, the password is saved as plain text in data.json and syncs with the vault. Leave it off to enter the password again after restarting Obsidian.")
          .addToggle((t) =>
            t.setValue(ai.rememberPassword === true).onChange(async (v) => {
              ai.rememberPassword = v;
              ai.password = v ? this.plugin.sessionOpenCodePassword || "" : "";
              await this.plugin.save();
            })
          );
      }
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
    new Setting(containerEl)
      .setName("Review agent edits before applying")
      .setDesc(
        "Agent mode only. The plugin pauses edits to your question, card and deck notes plus the current note, shows a diff, and writes only the files you approve. Closing the review discards the agent's changes. This review does not cover other files or shell commands. On by default."
      )
      .addToggle((t) =>
        t.setValue(ai.reviewAgentEdits !== false).onChange(async (v) => {
          ai.reviewAgentEdits = v;
          await this.plugin.save();
        })
      );
    new Setting(containerEl)
      .setName("Allow shell commands in Agent mode")
      .setDesc("Off by default. When on, OpenCode may run shell commands on this computer in Agent mode. The Markdown edit review does not approve or undo those commands. Leave it off unless you deliberately need them.")
      .addToggle((t) =>
        t.setValue(ai.agentShell === true).onChange(async (v) => {
          ai.agentShell = v;
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

    new Setting(containerEl).setName("Models and request limits").setHeading();
    const backend = this.plugin.backend();
    const caps = this.plugin.aiCapabilities();
    const capText = Object.entries(CAPABILITY_LABELS)
      .map(([key, label]) => `${label}: ${caps[key] ? "yes" : "no"}`)
      .join(" · ");
    containerEl.createEl("p", {
      cls: "setting-item-description",
      text: `This device uses ${backend === "opencode" ? "OpenCode" : "Direct AI"}. ${capText}. Features that need a capability this backend does not have say so instead of failing silently.`,
    });
    const budget = this.plugin.aiBudget();
    const countText = `${budget.used} request${budget.used === 1 ? "" : "s"} today (~${budget.tokens.toLocaleString()} tokens, estimated)`;
    containerEl.createEl("p", {
      cls: "setting-item-description",
      text: `${countText}. ${budget.cap ? `${Math.max(0, budget.cap - budget.used)} left under the daily cap.` : "No daily cap is set."} Counts are kept on this device only.`,
    });
    ai.features = ai.features && typeof ai.features === "object" ? ai.features : {};
    for (const feature of AI_FEATURES) {
      const saved = ai.features[feature.id] && typeof ai.features[feature.id] === "object" ? ai.features[feature.id] : (ai.features[feature.id] = { model: "" });
      const support = this.plugin.aiCapabilities();
      const unsupported = !!(feature.requires && !support[feature.requires]);
      new Setting(containerEl)
        .setName(`${feature.label} model`)
        .setDesc(
          unsupported
            ? `${feature.label} needs ${CAPABILITY_LABELS[feature.requires] || feature.requires}, which this backend cannot receive. Use Direct AI for this feature.`
            : `Leave empty to use the shared model (${this.plugin.aiModelFor(feature.id) || "provider default"}). Sends: ${feature.sends}`
        )
        .addText((t) => {
          t.setPlaceholder(this.plugin.aiModelFor(feature.id) || "provider default")
            .setValue(saved.model || "")
            .setDisabled(unsupported)
            .onChange(async (v) => {
              saved.model = str(v).trim().slice(0, 200);
              await this.plugin.save();
            });
        });
    }
    const limitRow = (name, desc, key, min, max, fallback) => {
      new Setting(containerEl)
        .setName(name)
        .setDesc(desc)
        .addText((t) => {
          t.inputEl.type = "number";
          t.setValue(String(ai.limits[key]))
            .onChange(async (v) => {
              const n = Math.round(Number(v));
              ai.limits[key] = Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
              await this.plugin.save();
            });
        });
    };
    limitRow(
      "Reply token cap",
      "The most one reply may use. Features that ask for more are capped here. Default 4000.",
      "maxTokens",
      256,
      32000,
      4000
    );
    limitRow(
      "Daily request cap",
      "Stop AI requests after this many in one local day. 0 means no daily cap. Counts are per device and reset at local midnight.",
      "dailyRequests",
      0,
      10000,
      0
    );
    limitRow(
      "Per-run request cap",
      "Stop one burst of work after this many requests. 0 means no cap. A run resets after 10 idle minutes, so the next import, chat or grading batch starts fresh.",
      "runRequests",
      0,
      1000,
      0
    );
    containerEl.createEl("p", { cls: "setting-item-description", text: "What each feature sends:" });
    for (const feature of AI_FEATURES) {
      containerEl.createEl("p", { cls: "setting-item-description", text: `${feature.label}: ${feature.sends}` });
    }
    containerEl.createEl("p", {
      cls: "setting-item-description",
      text: "Everything here is off until Enable AI features is on. Notes, pages and learner answers are treated as untrusted data, and keys are never logged.",
    });
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
      .setName("Export practice results")
      .setDesc("Write a summary CSV and an attempt-history CSV to the vault root for analysis outside Obsidian.")
      .addButton((b) => b.setButtonText("Export CSV").onClick(() => this.plugin.exportResultsCsv()));
    new Setting(containerEl)
      .setName("About the project")
      .setDesc(version ? `Version ${version}.` : "Source code and issue tracker.")
      .addButton((b) => b.setButtonText("GitHub repository").onClick(() => openExternal("https://github.com/ifriedenson/mcq-tracker")))
      .addButton((b) => b.setButtonText("Report bug").onClick(() => openExternal("https://github.com/ifriedenson/mcq-tracker/issues")));
  }
}

module.exports = {
  ASSIGNMENTS_TABS,
  CARDS_TABS,
  REFERENCE_TABS,
  GLOBAL_TABS,
  MCQ_TABS,
  QuestionTrackerSettingTab,
  SETTINGS_MODULES,
};
