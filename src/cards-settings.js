"use strict";
const { Notice, Setting } = require("obsidian");
const { localDate, str } = require("./util");
const { deckSummary } = require("./cards");
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
  if (current === "review") return renderReview(section, plugin);
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
}

function ensureDeck(st, name) {
  st.decks = Array.isArray(st.decks) ? st.decks : [];
  let cfg = st.decks.find((d) => d.name.toLowerCase() === str(name).trim().toLowerCase());
  if (!cfg) {
    cfg = { name: str(name).trim(), folder: "", course: "" };
    st.decks.push(cfg);
  }
  return cfg;
}

function renderReview(containerEl, plugin) {
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
    .setName("Scheduler")
    .setDesc("Cards use the scheduler chosen under MCQ Tracker, Review. A card reviewed with FSRS stores its memory state in the note, and switching back to the simple ladder is lossless.")
    .addButton((b) => b.setButtonText("Open Cards view").onClick(() => plugin.activateCards()));

  containerEl.createEl("p", {
    cls: "setting-item-description",
    text: "Ratings map to the scheduler as Again, Hard, Good and Easy. A card's history stays in the note next to its question history.",
  });
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
