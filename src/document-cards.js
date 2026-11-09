"use strict";
/*
 * Extract flashcards from a PDF or Markdown document.
 *
 * Text is read locally first. Markdown-like structure (Q/A labels, tables,
 * separators, definitions and cloze marks) is handled by cards-extract. An AI
 * fallback is opt-in and only runs when the local pass finds nothing. Nothing is
 * written here; the modal previews every card before import.
 */
const { Modal, Notice, TFile } = require("obsidian");
const { str } = require("./util");
const { extractCardsFromMarkdown } = require("./cards-extract");
const { readPdfPages } = require("./pdf");
const { readDocumentPages, documentBaseName, documentKind } = require("./documents");
const { buildCardGeneratorPrompt } = require("./card-generator");

function pagesText(pages) {
  return (Array.isArray(pages) ? pages : [])
    .map((page) => str(page && page.text).trim())
    .filter(Boolean)
    .join("\n\n");
}

function documentExtension(path) {
  const match = str(path).match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : "";
}

/** Read a vault PDF or Markdown file into plain text plus page boundaries. */
async function readDocumentCardSource(app, path, progress) {
  const file = app.vault.getAbstractFileByPath(str(path).trim());
  if (!(file instanceof TFile)) throw new Error("Choose a PDF or Markdown file in this vault.");
  const ext = documentExtension(file.path);
  if (ext !== "pdf" && ext !== "md" && ext !== "markdown") {
    throw new Error("Choose a PDF or Markdown (.md) file.");
  }
  const buf = await app.vault.readBinary(file);
  const pages =
    ext === "pdf"
      ? await readPdfPages(buf, "", (message) => progress && progress(message))
      : await readDocumentPages(buf, file.name, "", (message) => progress && progress(message));
  const text = pagesText(pages && pages.pages);
  return {
    file,
    ext,
    text,
    pages: Array.isArray(pages && pages.pages) ? pages.pages : [],
    warnings: Array.isArray(pages && pages.warnings) ? pages.warnings : [],
    kind: documentKind(file.name) || ext,
  };
}

/** Deterministic local extraction. The document path is part of every key. */
function extractDocumentCards(text, options) {
  const opts = options || {};
  const sourcePath = str(opts.sourcePath).trim() || "Document";
  const deck = str(opts.deck).trim() || "Imported";
  const course = str(opts.course).trim();
  const parsed = extractCardsFromMarkdown(text, {
    sourcePath,
    deck,
    course,
    tags: opts.tags,
    seed: opts.seed,
    separators: opts.separators,
  });
  const cards = parsed.cards.map((card) => ({
    ...card,
    sourceNote: sourcePath,
    importSource: sourcePath,
    importFormat: "document",
    importKey: `document:${card.importKey.replace(/^outline:/, "")}`,
  }));
  return { ...parsed, cards };
}

function aiCardsFromReply(reply, options) {
  const opts = options || {};
  const sourcePath = str(opts.sourcePath).trim() || "Document";
  const deck = str(opts.deck).trim() || "Imported";
  const course = str(opts.course).trim();
  const parsed = require("./transcript").parseAiCards(reply, Math.max(1, Math.min(30, Number(opts.count) || 12)));
  return parsed.cards.slice(0, 30).map((card, index) => ({
    kind: "card",
    cardType: "basic",
    front: str(card.front).trim(),
    back: str(card.back).trim(),
    deck,
    course,
    tags: [],
    sourceNote: sourcePath,
    importSource: sourcePath,
    importFormat: "document-ai",
    importedOn: require("./util").localDate(),
    importKey: `document-ai:${require("./util").hashString(`${sourcePath}|${index}|${card.front}|${card.back}`)}`,
    aiGenerated: opts.model || "AI",
  })).filter((card) => card.front && card.back);
}

async function previewDocumentCards(plugin, path, options) {
  const opts = options || {};
  const source = await readDocumentCardSource(plugin.app, path, opts.progress);
  const deck = str(opts.deck).trim() || str(plugin.settings.cards.defaultDeck).trim() || "Imported";
  const course = str(opts.course).trim() || require("./cards").courseForFolder(plugin.settings, source.file.path) || "";
  let local = extractDocumentCards(source.text, { sourcePath: source.file.path, deck, course });
  if (!local.cards.length && opts.useAi === true) {
    if (!plugin.settings.ai.enabled) throw new Error("Turn on AI features first, or extract without AI.");
    if (!str(source.text).trim()) throw new Error("This document has no readable text. Try OCR for a scan first.");
    const prompt = buildCardGeneratorPrompt({
      title: documentBaseName(source.file.name),
      course,
      text: source.text,
      sourceKind: "note",
      count: Math.max(1, Math.min(30, Number(opts.count) || 12)),
      customPrompt: str(opts.customPrompt).trim(),
    });
    const reply = await plugin.aiComplete(prompt.system, prompt.user, { feature: "generation", maxTokens: 3500 });
    local = { ...local, cards: aiCardsFromReply(reply, { sourcePath: source.file.path, deck, course, count: opts.count, model: plugin.aiModelLabel("generation") }), ai: true };
  }
  return {
    ...local,
    sourceFile: source.file,
    sourceKind: source.kind,
    sourcePath: source.file.path,
    text: source.text,
    deck,
    course,
    pageCount: source.pages.length,
    warnings: [...source.warnings, ...local.warnings],
    ai: local.ai === true,
  };
}

/** A compact review UI. Local extraction is the default; AI is an opt-in fallback. */
class DocumentCardsModal extends Modal {
  constructor(app, plugin, options, onDone) {
    super(app);
    this.plugin = plugin;
    this.options = options || {};
    this.onDone = onDone || (() => {});
    this.path = str(this.options.path).trim();
    this.preview = null;
  }

  onOpen() {
    this.contentEl.empty();
    this.contentEl.createEl("h3", { text: "Extract cards from a PDF or Markdown file" });
    this.contentEl.createEl("p", {
      cls: "setting-item-description",
      text: "Local extraction is free and private. AI fallback is optional and sends the document text only when you enable it.",
    });
    const pathRow = this.contentEl.createDiv({ cls: "qt-field" });
    pathRow.createEl("label", { text: "Vault file (PDF or .md)" });
    this.pathInput = pathRow.createEl("input", { type: "text", attr: { placeholder: "e.g. Lecture 4.pdf", "aria-label": "Vault file" } });
    this.pathInput.value = this.path;
    const deckRow = this.contentEl.createDiv({ cls: "qt-field" });
    deckRow.createEl("label", { text: "Deck" });
    this.deckInput = deckRow.createEl("input", { type: "text", attr: { placeholder: "Imported", "aria-label": "Deck" } });
    this.deckInput.value = str(this.options.deck).trim() || str(this.plugin.settings.cards.defaultDeck).trim() || "Imported";
    const aiLabel = this.contentEl.createEl("label", { cls: "qt-row" });
    this.aiInput = aiLabel.createEl("input", { type: "checkbox" });
    aiLabel.appendText(" Use AI only if local extraction finds no cards");
    const scan = this.contentEl.createEl("button", { text: "Preview cards", cls: "mod-cta" });
    scan.addEventListener("click", () => this.scan());
    this.status = this.contentEl.createDiv({ cls: "qt-hint" });
    this.list = this.contentEl.createDiv({ cls: "qt-doc-card-list" });
    this.actions = this.contentEl.createDiv({ cls: "qt-row" });
  }

  async scan() {
    const path = str(this.pathInput.value).trim();
    if (!path) {
      this.status.setText("Choose a PDF or Markdown file in your vault.");
      return;
    }
    this.status.setText("Reading the document...");
    this.list.empty();
    this.actions.empty();
    try {
      this.preview = await previewDocumentCards(this.plugin, path, {
        deck: this.deckInput.value,
        useAi: this.aiInput.checked,
        progress: (message) => this.status.setText(message),
      });
    } catch (error) {
      this.status.setText(str(error && error.message) || "Could not read that document.");
      return;
    }
    const p = this.preview;
    this.status.setText(
      p.cards.length
        ? `${p.cards.length} card${p.cards.length === 1 ? "" : "s"} found${p.ai ? " with AI" : " locally"}. Nothing is written yet.`
        : "No cards found. Markdown headings, Q:/A: pairs, tables, :: lines and cloze marks work best."
    );
    if (p.warnings.length) this.status.setText(`${this.status.getText()} ${p.warnings[0]}`);
    for (const card of p.cards.slice(0, 40)) {
      const row = this.list.createDiv({ cls: "qt-doc-card-row" });
      row.createDiv({ cls: "qt-doc-card-front", text: card.front });
      row.createDiv({ cls: "qt-doc-card-back", text: card.back });
    }
    if (!p.cards.length) return;
    const importBtn = this.actions.createEl("button", { text: `Import ${p.cards.length} cards`, cls: "mod-cta" });
    importBtn.addEventListener("click", () => this.importCards());
    this.actions.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
  }

  async importCards() {
    if (!this.preview || !this.preview.cards.length) return;
    if (this.plugin.moduleOff("cards")) {
      this.status.setText("Turn on Cards first.");
      return;
    }
    try {
      const result = await this.plugin.importParsedCards(this.preview.cards, {
        deck: this.preview.deck,
        course: this.preview.course,
        errors: this.preview.warnings,
      });
      this.plugin.refreshViews();
      new Notice(`Imported ${result.created} card${result.created === 1 ? "" : "s"}${result.skipped ? `, skipped ${result.skipped}` : ""}.`);
      this.onDone(result);
      this.close();
    } catch (error) {
      this.status.setText(str(error && error.message) || "Could not import these cards.");
    }
  }
}

module.exports = {
  DocumentCardsModal,
  aiCardsFromReply,
  documentExtension,
  extractDocumentCards,
  pagesText,
  previewDocumentCards,
  readDocumentCardSource,
};
