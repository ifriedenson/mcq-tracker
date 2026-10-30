"use strict";
const { Notice, Setting } = require("obsidian");
const { localDate, str } = require("./util");
const { deckSummary } = require("./cards");
const { CARD_GENERATOR_STYLES, normalizeCardGenerator } = require("./card-generator");
const { renderSettingsTabs } = require("./settings-ui");

const CARDS_TABS = [
  { id: "decks", label: "Decks", icon: "layers" },
  { id: "review", label: "Review", icon: "repeat" },
  { id: "about", label: "About", icon: "info" },
];

function renderCardsSettings(containerEl, plugin, redisplay, activeTab, setTab) {
  const current = CARDS_TABS.some((t) => t.id === activeTab) ? activeTab : "decks";
  renderSettingsTabs(
    containerEl,
    CARDS_TABS,
    current,
    (id) => (typeof setTab === "function" ? setTab(id) : redisplay()),
    { className: "qt-settings-tabs", tabClass: "qt-settings-tab" }
  );
  const section = containerEl.createDiv({ cls: "qt-settings-section" });
  if (!plugin.cardsEnabled()) {
    section.createEl("p", {
      cls: "setting-item-description",
      text: "The Cards module is off. Turn it on under Global, Modules; these settings are kept while it is off.",
    });
  }
  if (current === "review") return renderReview(section, plugin, redisplay);
  if (current === "about") return renderAbout(section, plugin);
  renderDecks(section, plugin, redisplay);
}

function deckNames(plugin) {
  return plugin.cardDecks().map((d) => d.name);
}

function renderDecks(containerEl, plugin, redisplay) {
  const st = plugin.settings.cards;
  const decks = deckSummary(plugin.getCards(), plugin.settings, localDate());

  new Setting(containerEl).setName("Decks").setHeading();
  containerEl.createEl("p", {
    cls: "setting-item-description",
    text: "A deck is a named group of cards. Give it a folder and a course, and every card in that folder inherits the course tag. Cards can also set deck and course themselves.",
  });

  new Setting(containerEl)
    .setName("Import existing decks")
    .setDesc("Bring in Spaced Repetition notes, an Anki package or text export, Quizlet, or a Kahoot, Blooket or Gimkit CSV. Duplicates are skipped by import key.")
    .addButton((b) => b.setButtonText("Import cards").onClick(() => plugin.openCardImport()));

  new Setting(containerEl)
    .setName("Export cards")
    .setDesc("Write the current deck as Quizlet text, Anki text, an Anki .apkg package, a Mochi .mochi file, a LearnKit note, or a Kahoot, Blooket or Gimkit CSV. Question-set choices and the correct answer stay with the card.")
    .addButton((b) => b.setButtonText("Export cards").onClick(() => plugin.openCardExport()));

  new Setting(containerEl)
    .setName("Default deck")
    .setDesc("Used when a new card does not choose a deck, and for cards without their own deck property or folder match.")
    .addDropdown((d) => {
      const names = [...new Set([...deckNames(plugin), str(st.defaultDeck).trim()].filter(Boolean))];
      d.addOption("", "No default");
      for (const name of names) d.addOption(name, name);
      d.setValue(st.defaultDeck || "").onChange(async (v) => {
        st.defaultDeck = v;
        await plugin.save();
        redisplay();
      });
    });

  new Setting(containerEl)
    .setName("New card folder")
    .setDesc("Where new cards go unless their deck has a folder. A deck without its own folder uses a subfolder here.")
    .addText((t) =>
      t.setPlaceholder("Cards").setValue(st.newCardFolder).onChange(async (v) => {
        st.newCardFolder = str(v).trim().replace(/^\/+|\/+$/g, "");
        await plugin.save();
      })
    );

  if (!decks.length) {
    containerEl.createEl("p", {
      cls: "setting-item-description",
      text: "No decks yet. Create one below, or use New card in the Cards view.",
    });
  }

  for (const deck of decks) {
    const configured = (st.decks || []).find((d) => d.name.toLowerCase() === deck.name.toLowerCase());
    const bits = [`${deck.total} card${deck.total === 1 ? "" : "s"}`, `${deck.due} due`, `${deck.fresh} new`];
    if (deck.course) bits.push(deck.course);
    const s = new Setting(containerEl).setName(deck.name).setDesc(bits.join(" · "));
    s.addText((t) =>
      t
        .setPlaceholder("Folder")
        .setValue(deck.folder || "")
        .onChange(async (v) => {
          const cfg = ensureDeck(st, deck.name);
          cfg.folder = str(v).trim().replace(/^\/+|\/+$/g, "");
          await plugin.save();
        })
    );
    s.addText((t) =>
      t
        .setPlaceholder("Course")
        .setValue(deck.course || "")
        .onChange(async (v) => {
          const cfg = ensureDeck(st, deck.name);
          cfg.course = str(v).trim();
          await plugin.save();
        })
    );
    s.addDropdown((d) =>
      d
        .addOption("", "Use global mode")
        .addOption("flip", "Flip")
        .addOption("type", "Type")
        .addOption("speak", "Speak")
        .setValue((configured && configured.answerMode) || "")
        .onChange(async (v) => {
          const cfg = ensureDeck(st, deck.name);
          cfg.answerMode = v;
          await plugin.save();
        })
    );
    s.addDropdown((d) =>
      d
        .addOption("", "Use global strictness")
        .addOption("strict", "Strict")
        .addOption("standard", "Standard")
        .addOption("lenient", "Lenient")
        .setValue((configured && configured.gradingStrictness) || "")
        .onChange(async (v) => {
          const cfg = ensureDeck(st, deck.name);
          cfg.gradingStrictness = v;
          await plugin.save();
        })
    );
    if (configured) {
      s.addButton((b) =>
        b
          .setButtonText("Delete")
          .setWarning()
          .onClick(async () => {
            st.decks = (st.decks || []).filter((d) => d.name.toLowerCase() !== deck.name.toLowerCase());
            if (st.defaultDeck.toLowerCase() === deck.name.toLowerCase()) st.defaultDeck = "";
            await plugin.save();
            redisplay();
          })
      );
    } else {
      s.addButton((b) =>
        b.setButtonText("Save deck").onClick(async () => {
          ensureDeck(st, deck.name);
          await plugin.save();
          redisplay();
        })
      );
    }
  }

  new Setting(containerEl).setName("Add a deck").setHeading();
  let name = "";
  let folder = "";
  let course = "";
  new Setting(containerEl)
    .setName("New deck")
    .setDesc("The folder is optional. Without one, cards for this deck go under the new card folder.")
    .addText((t) => t.setPlaceholder("Deck name").onChange((v) => (name = v)))
    .addText((t) => t.setPlaceholder("Folder").onChange((v) => (folder = v)))
    .addText((t) => t.setPlaceholder("Course").onChange((v) => (course = v)))
    .addButton((b) =>
      b.setButtonText("Add").onClick(async () => {
        const n = str(name).trim();
        if (!n) return new Notice("Give the deck a name first.");
        const cfg = ensureDeck(st, n);
        if (str(folder).trim()) cfg.folder = str(folder).trim().replace(/^\/+|\/+$/g, "");
        if (str(course).trim()) cfg.course = str(course).trim();
        if (!st.defaultDeck) st.defaultDeck = n;
        await plugin.save();
        redisplay();
      })
    );

  const anki = st.ankiConnect;
  new Setting(containerEl).setName("AnkiConnect").setHeading();
  containerEl.createEl("p", {
    cls: "setting-item-description",
    text: "Optional two-way sync with a running Anki desktop and the AnkiConnect add-on. New cards are pushed, linked cards pull Anki edits, and cards changed on both sides are reported instead of overwritten. Nothing is sent until this is on. AnkiConnect listens on your computer only; this does not use AnkiWeb.",
  });
  new Setting(containerEl)
    .setName("Enable AnkiConnect sync")
    .setDesc("Adds Sync and Push to Anki commands and buttons. Your notes stay in the vault either way.")
    .addToggle((t) =>
      t.setValue(anki.enabled === true).onChange(async (v) => {
        anki.enabled = v;
        await plugin.save();
        redisplay();
      })
    );
  new Setting(containerEl)
    .setName("AnkiConnect address")
    .setDesc("The local address AnkiConnect listens on. The default is 127.0.0.1:8765.")
    .addText((t) =>
      t.setValue(anki.url || "http://127.0.0.1:8765").onChange(async (v) => {
        anki.url = str(v).trim();
        await plugin.save();
      })
    );
  new Setting(containerEl)
    .setName("Target deck")
    .setDesc("Leave blank to keep each card's own deck. A name here sends every card in this filter to that one deck.")
    .addText((t) =>
      t
        .setPlaceholder("Each card's deck")
        .setValue(anki.deck || "")
        .onChange(async (v) => {
          anki.deck = str(v).trim();
          await plugin.save();
        })
    );
  new Setting(containerEl)
    .setName("Extra Anki tags")
    .setDesc("Optional comma-separated tags added to every Anki note, alongside each note's own tags. Leave blank to use only per-note tags.")
    .addText((t) =>
      t
        .setPlaceholder("e.g. mcq-tracker")
        .setValue(anki.vaultTags || "")
        .onChange(async (v) => {
          anki.vaultTags = str(v).trim();
          await plugin.save();
        })
    );
  new Setting(containerEl)
    .setName("Source backlink in Anki")
    .setDesc("Optional. Appends a link to the source note (or the card note when there is no source) to each pushed Anki card. Off by default.")
    .addToggle((t) =>
      t.setValue(anki.backlinks === true).onChange(async (v) => {
        anki.backlinks = v;
        await plugin.save();
      })
    );
  new Setting(containerEl)
    .setName("Delete Anki notes for deleted local cards")
    .setDesc("Opt-in. The next preview shows linked Anki notes whose local note no longer exists, and applies the deletion only when you confirm. Off by default; moving a note out of the card folder can count as a deletion.")
    .addToggle((t) =>
      t.setValue(anki.deleteMissing === true).onChange(async (v) => {
        anki.deleteMissing = v;
        await plugin.save();
      })
    );
  new Setting(containerEl)
    .setName("Folder-based decks")
    .setDesc("When a card has no deck property, use its first subfolder under the card folder as the Anki deck. Off by default; a configured deck folder or frontmatter still wins.")
    .addToggle((t) =>
      t.setValue(anki.folderDecks === true).onChange(async (v) => {
        anki.folderDecks = v;
        await plugin.save();
      })
    );

  new Setting(containerEl)
    .setName("Conflicting edits")
    .setDesc("When a linked card changed in both places, keep the local card and report it, push the local card, or pull Anki's version.")
    .addDropdown((d) =>
      d
        .addOption("report", "Report and keep local")
        .addOption("local", "Use the local card")
        .addOption("anki", "Use Anki's version")
        .setValue(anki.conflict || "report")
        .onChange(async (v) => {
          anki.conflict = v;
          await plugin.save();
        })
    );
  new Setting(containerEl)
    .setName("Sync the current filter with Anki")
    .setDesc("Pushes new cards and merges Anki edits into linked cards. Uses the deck and course filter from the Cards view.")
    .addButton((b) => b.setButtonText("Sync with Anki").onClick(() => plugin.openAnkiConnectPush({ sync: true })))
    .addButton((b) => b.setButtonText("Push only").onClick(() => plugin.openAnkiConnectPush()))
    .addButton((b) => b.setButtonText("Push whole vault").onClick(() => plugin.openAnkiConnectPush({ vaultWide: true })));
}

function ensureDeck(st, name) {
  st.decks = Array.isArray(st.decks) ? st.decks : [];
  let cfg = st.decks.find((d) => d.name.toLowerCase() === str(name).trim().toLowerCase());
  if (!cfg) {
    cfg = { name: str(name).trim(), folder: "", course: "", answerMode: "", gradingStrictness: "" };
    st.decks.push(cfg);
  }
  return cfg;
}

function renderReview(containerEl, plugin, redisplay) {
  const st = plugin.settings.cards;
  new Setting(containerEl).setName("Review").setHeading();
  new Setting(containerEl)
    .setName("Cards per session")
    .setDesc("The most cards a review session will show.")
    .addText((t) => {
      t.inputEl.type = "number";
      t.inputEl.min = "1";
      t.inputEl.max = "100";
      t.setValue(String(st.reviewLimit)).onChange(async (v) => {
        const n = Math.round(Number(v));
        if (Number.isFinite(n) && n > 0) {
          st.reviewLimit = Math.min(100, n);
          await plugin.save();
        }
      });
    });

  new Setting(containerEl)
    .setName("What to review")
    .setDesc("Due and new is the default. Review all also includes cards scheduled for later.")
    .addDropdown((d) =>
      d
        .addOption("due", "Due and new cards")
        .addOption("all", "All cards in the deck")
        .setValue(st.order)
        .onChange(async (v) => {
          st.order = v === "all" ? "all" : "due";
          await plugin.save();
          plugin.refreshViews();
        })
    );

  new Setting(containerEl)
    .setName("Answer mode")
    .setDesc("Flip is the classic reveal-and-rate review. Type asks for an answer and grades obvious matches locally; Speak uses the same box with your device's dictation. A card's answer_mode or its deck's setting overrides this default.")
    .addDropdown((d) =>
      d
        .addOption("flip", "Flip and self-rate")
        .addOption("type", "Type the answer")
        .addOption("speak", "Speak or type (OS dictation)")
        .setValue(st.answerMode || "flip")
        .onChange(async (v) => {
          st.answerMode = v === "type" || v === "speak" ? v : "flip";
          await plugin.save();
          plugin.refreshViews();
        })
    );

  new Setting(containerEl)
    .setName("Grading strictness")
    .setDesc("Strict requires the stored wording and accents. Standard ignores case, accents, articles, punctuation and small typos. Lenient also accepts partial keyword coverage.")
    .addDropdown((d) =>
      d
        .addOption("strict", "Strict")
        .addOption("standard", "Standard")
        .addOption("lenient", "Lenient")
        .setValue(st.gradingStrictness || "standard")
        .onChange(async (v) => {
          st.gradingStrictness = v === "strict" || v === "lenient" ? v : "standard";
          await plugin.save();
          plugin.refreshViews();
        })
    );

  new Setting(containerEl)
    .setName("AI fallback for typed answers")
    .setDesc("When the local check cannot decide, send only the card front, the stored answer and your answer to your AI provider for a second opinion. Needs AI features and a configured provider. Off by default; offline answers wait in a queue and are graded later.")
    .addToggle((t) =>
      t.setValue(st.aiGrading === true).onChange(async (v) => {
        st.aiGrading = v;
        await plugin.save();
        plugin.refreshViews();
        if (v && !plugin.settings.ai.enabled) new Notice("Turn on AI features under Settings, Global, Modules, then choose a provider under MCQ Tracker, AI.");
      })
    );

  new Setting(containerEl)
    .setName("Scheduler")
    .setDesc("Cards use the scheduler chosen under MCQ Tracker, Review. A card reviewed with FSRS stores its memory state in the note, and switching back to the simple ladder is lossless.")
    .addButton((b) => b.setButtonText("Open Cards view").onClick(() => plugin.activateCards()));

  containerEl.createEl("p", {
    cls: "setting-item-description",
    text: "Ratings map to the scheduler as Again, Hard, Good and Easy. Typed answers are graded locally first; accepted_variants and grading_strictness on a card override the defaults. A card's history stays in the note next to its question history.",
  });

  new Setting(containerEl).setName("Flashcard generator").setHeading();
  containerEl.createEl("p", {
    cls: "setting-item-description",
    text: "Generate cards from the open note or its selection with an optional custom instruction. The command always opens these choices so you can change them for one run; the last choices are remembered here. Tracked card notes are the default; inserting a formatted block into the note is optional and is not scheduled.",
  });
  const cg = normalizeCardGenerator(plugin.settings.cardGenerator);
  const patchGenerator = async (values) => {
    plugin.settings.cardGenerator = normalizeCardGenerator({ ...normalizeCardGenerator(plugin.settings.cardGenerator), ...values });
    await plugin.save();
  };
  new Setting(containerEl)
    .setName("Default card count")
    .setDesc("Between 1 and 20. The generator can change this for a single run.")
    .addText((t) => {
      t.inputEl.type = "number";
      t.inputEl.min = "1";
      t.inputEl.max = "20";
      t.setValue(String(cg.count)).onChange(async (v) => {
        const n = Math.round(Number(v));
        if (Number.isFinite(n) && n > 0) {
          await patchGenerator({ count: Math.min(20, n) });
        }
      });
    });
  new Setting(containerEl)
    .setName("Default card layout")
    .setDesc("Inline uses one line per card; multiline puts the separator on its own line. The separator is editable for each run.")
    .addDropdown((d) => {
      for (const style of CARD_GENERATOR_STYLES) d.addOption(style.id, style.label);
      d.setValue(cg.style).onChange(async (v) => {
        const style = CARD_GENERATOR_STYLES.find((item) => item.id === v) || CARD_GENERATOR_STYLES[0];
        await patchGenerator({ style: style.id, separator: style.separator });
        if (typeof redisplay === "function") redisplay();
      });
    });
  new Setting(containerEl)
    .setName("Hide inserted cards in reading view")
    .setDesc("Wraps only the optional inserted block in Obsidian comment markers. Tracked card notes are never hidden or changed.")
    .addToggle((t) =>
      t.setValue(cg.hideInPreview === true).onChange(async (v) => {
        await patchGenerator({ hideInPreview: v });
      })
    );
  new Setting(containerEl)
    .setName("Generate from this note or selection")
    .addButton((b) => b.setButtonText("Open generator").onClick(() => plugin.openCardGenerator()));
}

function renderAbout(containerEl, plugin) {
  const version = (plugin.manifest && plugin.manifest.version) || "";
  const card = containerEl.createDiv({ cls: "qt-settings-card" });
  card.createEl("h3", { text: "Cards and vocabulary" });
  card.createEl("p", {
    cls: "setting-item-description",
    text: "One Markdown note per card. Deck and course are ordinary properties, so cards stay readable, searchable and portable.",
  });
  card.createEl("pre", {
    cls: "qt-settings-code",
    text: `---
card_id: c-abc123
item_type: card        # card | vocab
deck: Spanish verbs
course: SPAN 101
card_type: basic       # basic | reversed | cloze
---

## Front
hablar

## Back
to speak`,
  });
  new Setting(containerEl)
    .setName("Version")
    .setDesc(version ? `Cards in MCQ Tracker ${version}.` : "MCQ Tracker")
    .addButton((b) => b.setButtonText("Open Cards").onClick(() => plugin.activateCards()))
    .addButton((b) => b.setButtonText("Create a card").onClick(() => plugin.openNewCard()));
}

module.exports = {
  CARDS_TABS,
  renderCardsSettings,
};
