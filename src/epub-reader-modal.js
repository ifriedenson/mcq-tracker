"use strict";
const { QtModal } = require("./a11y");
/*
 * The EPUB reader window.
 *
 * It shows one chapter at a time, marks the paragraphs that already carry an
 * annotation, and lets the reader highlight or annotate a paragraph. Every change
 * goes through the plugin's sidecar methods, so reopening the book re-reads the
 * same annotations from the vault; the book itself is never written.
 */
const { Modal, Notice, Setting } = require("obsidian");
const epub = require("./epub");
const epubAnnotations = require("./epub-annotations");
const { str } = require("./util");

class EpubReaderModal extends QtModal {
  qtDialogLabel() {
    return "EPUB reader";
  }

  constructor(app, plugin, options) {
    super(app);
    this.plugin = plugin;
    this.options = options && typeof options === "object" ? options : {};
    this.path = str(this.options.path);
    this.book = null;
    this.annotations = [];
    this.damaged = [];
    this.chapter = Math.max(1, Math.round(Number(this.options.chapter) || 1));
    this.color = "yellow";
  }

  async onOpen() {
    this.contentEl.addClass("qt-epub-reader");
    await this.load();
  }

  /** Reads the book and its sidecar again, then redraws. */
  async load() {
    this.book = await this.plugin.epubBook(this.path);
    const parsed = await this.plugin.epubAnnotations(this.path);
    this.annotations = parsed.annotations || [];
    this.damaged = parsed.damaged || [];
    if (this.chapter > this.book.total) this.chapter = this.book.total;
    this.render();
    return this.book;
  }

  chapterEntry() {
    if (!this.book) return null;
    return this.book.chapters.find((entry) => entry.n === this.chapter) || this.book.chapters[0] || null;
  }

  annotationsFor(n) {
    return epubAnnotations.annotationsForChapter(this.annotations, n || this.chapter);
  }

  /** The chapter's paragraphs with the annotations that land on each one. */
  rows() {
    const chapter = this.chapterEntry();
    if (!chapter) return [];
    return epub.annotateParagraphs(chapter.text, this.annotationsFor(chapter.n));
  }

  render() {
    const el = this.contentEl;
    if (!el || typeof el.empty !== "function") return;
    el.empty();
    el.createDiv({ cls: "qt-epub-title", text: this.book ? `${this.book.title} — ${this.path}` : this.path });
    if (!this.book) return;
    const nav = el.createDiv({ cls: "qt-epub-nav" });
    nav.createDiv({ cls: "qt-epub-count", text: `Chapter ${this.chapter} of ${this.book.total}` });
    const previous = nav.createEl("button", { text: "Previous" });
    previous.disabled = this.chapter <= 1;
    previous.onclick = () => this.goTo(this.chapter - 1);
    const next = nav.createEl("button", { text: "Next" });
    next.disabled = this.chapter >= this.book.total;
    next.onclick = () => this.goTo(this.chapter + 1);
    if (this.damaged.length) {
      el.createDiv({ cls: "qt-epub-damaged", text: `${this.damaged.length} annotation(s) could not be read: ${this.damaged[0]}` });
    }
    const chapter = this.chapterEntry();
    el.createDiv({ cls: "qt-epub-chapter-title", text: chapter ? chapter.title : "" });
    const body = el.createDiv({ cls: "qt-epub-body" });
    for (const row of this.rows()) {
      const paragraph = body.createDiv({ cls: row.ids.length ? "qt-epub-paragraph is-marked" : "qt-epub-paragraph" });
      paragraph.createDiv({ cls: "qt-epub-text", text: row.text });
      for (const note of row.notes) paragraph.createDiv({ cls: "qt-epub-note", text: note });
      const actions = paragraph.createDiv({ cls: "qt-epub-actions" });
      const mark = actions.createEl("button", { text: row.ids.length ? "Update highlight" : "Highlight" });
      mark.onclick = () => this.mark(row);
      for (const annotation of row.annotations) {
        const remove = actions.createEl("button", { text: "Remove" });
        remove.onclick = () => this.remove(annotation.id);
      }
    }
    new Setting(el)
      .setName("Colour")
      .addDropdown((dropdown) => {
        for (const color of epubAnnotations.COLORS) dropdown.addOption(color, color);
        dropdown.setValue(this.color);
        dropdown.onChange((value) => {
          this.color = value;
        });
      });
  }

  goTo(n) {
    const target = Math.round(Number(n));
    if (!this.book || target < 1 || target > this.book.total) return false;
    this.chapter = target;
    this.render();
    return true;
  }

  /** Highlights one paragraph; a second click on the same range updates its note. */
  async mark(row) {
    const paragraph = row && typeof row === "object" ? row : { text: str(row) };
    try {
      await this.plugin.addEpubHighlight(this.path, {
        chapter: this.chapter,
        quote: paragraph.text,
        start: paragraph.start,
        end: paragraph.end,
        color: this.color,
      });
      await this.load();
      new Notice("Highlight saved beside the book.");
      return true;
    } catch (e) {
      new Notice(str(e && e.message ? e.message : e));
      return false;
    }
  }

  async annotate(row, note) {
    const paragraph = row && typeof row === "object" ? row : { text: str(row) };
    try {
      await this.plugin.addEpubHighlight(this.path, {
        chapter: this.chapter,
        quote: paragraph.text,
        start: paragraph.start,
        end: paragraph.end,
        note: str(note),
        color: this.color,
      });
      await this.load();
      return true;
    } catch (e) {
      new Notice(str(e && e.message ? e.message : e));
      return false;
    }
  }

  async remove(id) {
    try {
      const removed = await this.plugin.deleteEpubAnnotation(this.path, id);
      await this.load();
      if (!removed) new Notice(`There is no annotation ${str(id)} in this book.`);
      return removed;
    } catch (e) {
      new Notice(str(e && e.message ? e.message : e));
      return false;
    }
  }
}

module.exports = { EpubReaderModal };
