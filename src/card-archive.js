"use strict";
/*
 * A portable card archive: every card note's Markdown in one JSON file that
 * can leave the plugin data folder and be restored on another machine. This
 * is the non-migration part of Retain's "schedules out of notes" idea: the
 * archive carries the note text, so a restore cannot lose a schedule, and a
 * merge is explicit (skip existing notes or overwrite them).
 */
const { localDate, str } = require("./util");

const ARCHIVE_SCHEMA = 1;
const MAX_CARDS = 5000;
const MAX_TEXT = 400000;

function normalizeCardArchiveSettings(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const folder = str(source.folder).trim().replace(/^\/+|\/+$/g, "");
  return {
    enabled: !(value === false || source.enabled === false),
    folder: folder && !/\.\./.test(folder) ? folder.slice(0, 160) : "Archive",
  };
}

function safeCardPath(value) {
  const clean = str(value).replace(/\\/g, "/").replace(/^\/+/, "").trim();
  if (!clean || clean.includes("..") || !/\.md$/i.test(clean)) return "";
  return clean.slice(0, 500);
}

/** `[{ path, text, deck, course }]` becomes a versioned, JSON-safe archive. */
function buildCardArchive(entries, options) {
  const opts = options && typeof options === "object" ? options : {};
  const cards = [];
  const issues = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (cards.length >= MAX_CARDS) {
      issues.push(`Only the first ${MAX_CARDS} cards are archived.`);
      break;
    }
    const path = safeCardPath(entry && entry.path);
    const text = str(entry && entry.text).slice(0, MAX_TEXT);
    if (!path) {
      issues.push(`Skipped a card without a safe .md path: ${str(entry && entry.path).slice(0, 80)}`);
      continue;
    }
    cards.push({ path, deck: str(entry.deck).trim(), course: str(entry.course).trim(), text });
  }
  cards.sort((a, b) => a.path.localeCompare(b.path));
  return {
    schema: ARCHIVE_SCHEMA,
    exportedAt: str(opts.exportedAt) || new Date().toISOString(),
    count: cards.length,
    cards,
    issues,
  };
}

function parseCardArchive(value) {
  let data = value;
  if (typeof value === "string") {
    try {
      data = JSON.parse(value);
    } catch (e) {
      return { ok: false, error: `That is not JSON: ${str(e && e.message ? e.message : e)}`, archive: null };
    }
  }
  if (!data || typeof data !== "object" || !Array.isArray(data.cards)) {
    return { ok: false, error: "The archive needs a cards array.", archive: null };
  }
  if (Number(data.schema) !== ARCHIVE_SCHEMA) {
    return { ok: false, error: `Unsupported archive schema ${str(data.schema) || "(missing)"}; expected ${ARCHIVE_SCHEMA}.`, archive: null };
  }
  const cards = [];
  const issues = [];
  for (const raw of data.cards.slice(0, MAX_CARDS)) {
    const path = safeCardPath(raw && raw.path);
    if (!path) {
      issues.push(`Skipped an archive entry without a safe .md path: ${str(raw && raw.path).slice(0, 80)}`);
      continue;
    }
    const text = str(raw && raw.text).slice(0, MAX_TEXT);
    if (!text.trim()) {
      issues.push(`Skipped ${path}: no note text.`);
      continue;
    }
    cards.push({ path, deck: str(raw.deck).trim(), course: str(raw.course).trim(), text });
  }
  return { ok: true, error: "", archive: { schema: ARCHIVE_SCHEMA, exportedAt: str(data.exportedAt), count: cards.length, cards, issues: [] }, issues };
}

/** Decide what a restore does without touching the vault. */
function mergeCardArchive(existingPaths, archive, mode) {
  const existing = new Set((Array.isArray(existingPaths) ? existingPaths : []).map((path) => str(path).toLowerCase()));
  const overwrite = mode === "overwrite";
  const report = { create: [], update: [], skip: [] };
  for (const card of (archive && archive.cards) || []) {
    if (!card || !card.path) continue;
    if (!existing.has(card.path.toLowerCase())) report.create.push(card.path);
    else if (overwrite) report.update.push(card.path);
    else report.skip.push(card.path);
  }
  return report;
}

function archiveFileName(date) {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(str(date)) ? str(date) : localDate();
  return `mcq-cards-${day}.json`;
}

class CardArchiveImportModal {
  constructor(app, plugin) {
    this.app = app;
    this.plugin = plugin;
    this.text = "";
    this.mode = "skip";
    this.error = "";
    this.busy = false;
    const { Modal } = require("obsidian");
    this.modal = new Modal(app);
    this.modal.onOpen = () => this.draw();
    this.modal.onClose = () => this.modal.contentEl.empty();
  }

  open() {
    this.modal.open();
  }

  draw() {
    const el = this.modal.contentEl;
    el.empty();
    el.createEl("h3", { text: "Import a card archive" });
    el.createDiv({
      cls: "qt-hint",
      text: "Paste the JSON written by Cards: export a portable archive. Existing notes are skipped unless you choose overwrite. Nothing is deleted.",
    });
    const box = el.createEl("textarea", { cls: "qt-input", attr: { "aria-label": "Card archive JSON" } });
    box.rows = 12;
    box.placeholder = '{ "schema": 1, "cards": [ { "path": "Cards/…md", "text": "…" } ] }';
    box.value = this.text;
    box.addEventListener("input", () => (this.text = box.value));
    const row = el.createDiv({ cls: "qt-row" });
    const select = row.createEl("select", { cls: "dropdown", attr: { "aria-label": "Existing note handling" } });
    for (const [value, label] of [["skip", "Skip existing notes"], ["overwrite", "Overwrite existing notes"]]) {
      const option = select.createEl("option", { text: label, value });
      if (value === this.mode) option.selected = true;
    }
    select.addEventListener("change", () => (this.mode = select.value));
    if (this.error) el.createDiv({ cls: "qt-error", text: this.error });
    const actions = el.createDiv({ cls: "qt-row" });
    const importButton = actions.createEl("button", { text: this.busy ? "Importing…" : "Import", cls: "mod-cta" });
    importButton.disabled = this.busy;
    importButton.addEventListener("click", () => this.run());
    actions.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.modal.close());
  }

  async run() {
    if (this.busy) return;
    this.busy = true;
    this.error = "";
    this.draw();
    try {
      const report = await this.plugin.importCardArchiveText(this.text, this.mode);
      const { Notice } = require("obsidian");
      new Notice(`Card archive: ${report.create.length} created, ${report.update.length} updated, ${report.skip.length} skipped.`, 6000);
      this.modal.close();
    } catch (e) {
      this.busy = false;
      this.error = str(e && e.message ? e.message : e) || "Could not import the archive.";
      this.draw();
    }
  }
}

module.exports = {
  ARCHIVE_SCHEMA,
  CardArchiveImportModal,
  archiveFileName,
  buildCardArchive,
  mergeCardArchive,
  normalizeCardArchiveSettings,
  parseCardArchive,
  safeCardPath,
};
