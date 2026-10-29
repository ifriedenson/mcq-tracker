"use strict";
/*
 * Local course-note ingestion. The existing question importer asks an AI to
 * write question notes; this path is deliberately simpler and works offline:
 * read the document text, keep page/slide boundaries, and write one readable
 * Markdown study note with source links. Figures, OCR and summaries remain
 * separate opt-in features.
 */
const { Modal, Notice, Setting, TFile, normalizePath } = require("obsidian");
const { FolderSuggest } = require("./modals");
const { ensureFolder, localDate, str } = require("./util");
const { readPdfPages } = require("./pdf");
const { documentBaseName, documentKind, documentLabel, extensionOf, readDocumentPages } = require("./documents");

const DEFAULT_COURSE_NOTES_FOLDER = "Course notes";

function safeName(value, fallback) {
  return (
    str(value)
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 90) || fallback || "Course notes"
  );
}

function cleanPageLines(text) {
  return str(text)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) =>
      str(line)
        .replace(/^[•·]\s+/, "- ")
        .replace(/^\s*[–—]\s+/, "- ")
        .replace(/\s+$/, "")
    )
    .filter((line, index, all) => line.trim() || (index > 0 && all[index - 1].trim()));
}

function pageHeading(page, label) {
  const lines = cleanPageLines(page && page.text);
  const first = str(lines[0]).trim();
  const usable = first && first.length <= 90 && !/[.!?]$/.test(first) && !/^[-*]/.test(first) && !/^\d+$/.test(first);
  return {
    title: usable ? first : `${label} ${Number(page && page.n) || ""}`.trim(),
    usable: Boolean(usable),
    body: usable ? lines.slice(1) : lines,
  };
}

/**
 * Build the Markdown note. Pure so the structure is testable without a vault.
 * meta: { title, course, sourceName, sourceLink, sourceFormat,
 *         sourcePageCount, importedOn, pageLabel }
 */
function buildCourseNote(pages, meta) {
  const m = meta || {};
  const list = (Array.isArray(pages) ? pages : []).filter((page) => page && str(page.text).trim());
  const label = str(m.pageLabel).trim() || "Page";
  const first = list.length ? pageHeading(list[0], label) : { title: "", usable: false };
  const title = str(m.title).trim() || (first.usable ? first.title : "") || str(m.sourceName).trim() || first.title || "Course notes";
  const lines = ["---", "course_notes: true", `title: ${JSON.stringify(title)}`];
  if (str(m.course).trim()) lines.push(`course: ${JSON.stringify(str(m.course).trim())}`);
  if (str(m.sourceLink).trim()) lines.push(`source_document: ${JSON.stringify(str(m.sourceLink).trim())}`);
  if (str(m.sourceFormat).trim()) lines.push(`source_format: ${JSON.stringify(str(m.sourceFormat).trim())}`);
  lines.push(
    `source_page_count: ${Number(m.sourcePageCount) || list.length}`,
    `imported_on: ${JSON.stringify(str(m.importedOn) || localDate())}`,
    "tags:",
    "  - course-notes",
    "---",
    "",
    `# ${title}`,
    ""
  );
  if (str(m.sourceLink).trim()) {
    lines.push("> [!info] Source", `> ${str(m.sourceLink).trim()}${str(m.sourceName).trim() ? ` · ${str(m.sourceName).trim()}` : ""}`, "");
  }
  lines.push("_Text-only study notes. Figures and handwritten marks are not copied._", "");
  if (!list.length) lines.push("_No readable text was found in the selected pages._", "");
  for (const page of list) {
    const heading = pageHeading(page, label);
    lines.push(`## ${heading.title}`, "");
    if (str(m.sourceLink).trim()) lines.push(`*Source: ${str(m.sourceLink).trim()} · ${label.toLowerCase()} ${Number(page.n) || ""}*`, "");
    const body = cleanPageLines(heading.body.join("\n"));
    if (body.length) {
      lines.push(...body);
    } else {
      lines.push("_No readable text on this page._");
    }
    lines.push("");
  }
  return { text: lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n", title };
}

function uniquePath(vault, folder, name, extension) {
  const ext = extension || "md";
  let path = normalizePath(`${folder}/${safeName(name)}.${ext}`);
  let n = 2;
  while (vault.getAbstractFileByPath(path)) {
    path = normalizePath(`${folder}/${safeName(name)} ${n}.${ext}`);
    n++;
  }
  return path;
}

class CourseNotesModal extends Modal {
  constructor(app, plugin, onDone) {
    super(app);
    this.plugin = plugin;
    this.onDone = onDone || (() => {});
    this.file = null;
    this.vaultDoc = "";
    this.folder = DEFAULT_COURSE_NOTES_FOLDER;
    this.title = "";
    this.course = "";
    this.pages = "";
  }

  onOpen() {
    this.modalEl.addClass("qt-import-modal");
    const el = this.contentEl;
    el.empty();
    el.createEl("h3", { text: "Import course notes" });
    el.createEl("p", {
      cls: "setting-item-description",
      text: "Turn a lecture deck, textbook chapter or document into one readable study note. This path is local and text-only: it does not need an AI key and does not send the file anywhere.",
    });

    const docs = this.app.vault.getFiles().filter((f) => documentKind(f.path || f.name));
    const picked = new Setting(el).setName("File").setDesc("No file chosen");
    const setName = (name) => {
      if (!this.title && name) this.title = documentBaseName(name);
    };
    const input = createEl("input", { type: "file", attr: { accept: ".pdf,.pptx,.pptm,.docx,.docm,.odt,.odp,.txt,.md,.markdown,.csv,.tsv,.html,.htm,.rtf" } });
    input.hidden = true;
    input.addEventListener("change", () => {
      this.file = input.files && input.files[0] ? input.files[0] : null;
      if (this.file) {
        this.vaultDoc = "";
        picked.setDesc(this.file.name);
        setName(this.file.name);
      }
    });
    picked.addButton((b) => b.setButtonText("Choose file...").onClick(() => input.click()));
    if (docs.length) {
      new Setting(el).setName("...or a file in your vault").addDropdown((d) => {
        d.addOption("", "Choose...");
        for (const f of docs) d.addOption(f.path, f.path);
        d.setValue(this.vaultDoc).onChange((v) => {
          this.vaultDoc = v;
          if (v) {
            this.file = null;
            picked.setDesc("No file chosen");
            setName(v);
          }
        });
      });
    }

    new Setting(el)
      .setName("Save notes in")
      .setDesc("The folder is created if it does not exist.")
      .addText((t) => {
        const suggest = new FolderSuggest(this.app, t.inputEl);
        suggest;
        t.setPlaceholder(DEFAULT_COURSE_NOTES_FOLDER).setValue(this.folder).onChange((v) => (this.folder = v));
      });
    new Setting(el)
      .setName("Title")
      .setDesc("Blank uses the file name or the first slide/page heading.")
      .addText((t) => t.setPlaceholder("Example: Lecture 3 — Cell division").setValue(this.title).onChange((v) => (this.title = v)));
    new Setting(el)
      .setName("Course")
      .setDesc("Optional course property and tag on the note.")
      .addText((t) => t.setPlaceholder("Example: BIOL 201").setValue(this.course).onChange((v) => (this.course = v)));
    new Setting(el)
      .setName("Pages or slides")
      .setDesc("Blank means all. Example: 1-12 or 2,4,6-8.")
      .addText((t) => t.setPlaceholder("All").setValue(this.pages).onChange((v) => (this.pages = v)));

    el.createEl("p", {
      cls: "qt-hint",
      text: "Scanned PDFs need text recognition (OCR) first. This importer keeps the text and page boundaries; it does not copy figures or write an AI summary.",
    });
    const row = el.createDiv({ cls: "qt-row" });
    row.createEl("button", { text: "Cancel", cls: "qt-grow" }).addEventListener("click", () => this.close());
    row.createEl("button", { text: "Import notes", cls: "mod-cta qt-grow" }).addEventListener("click", () => this.start());
  }

  async readSource() {
    if (this.file) {
      const name = this.file.name;
      return {
        buf: await this.file.arrayBuffer(),
        name: documentBaseName(name),
        ext: extensionOf(name),
        kind: documentKind(name),
        device: true,
        path: "",
      };
    }
    if (this.vaultDoc) {
      const f = this.app.vault.getAbstractFileByPath(this.vaultDoc);
      if (!(f instanceof TFile)) throw new Error("I couldn't find that file in your vault.");
      return {
        buf: await this.app.vault.readBinary(f),
        name: f.basename,
        ext: extensionOf(f.path),
        kind: documentKind(f.path),
        device: false,
        path: f.path,
      };
    }
    throw new Error("Choose a file first.");
  }

  async start() {
    const el = this.contentEl;
    if (!this.file && !this.vaultDoc) {
      new Notice("Choose a file first.");
      return;
    }
    const folder = normalizePath(str(this.folder).trim() || DEFAULT_COURSE_NOTES_FOLDER);
    el.empty();
    el.createEl("h3", { text: "Reading the document..." });
    const status = el.createDiv({ cls: "qt-hint", text: "Starting..." });
    try {
      const src = await this.readSource();
      if (!src.kind) throw new Error(`This plugin can't read .${src.ext || "that"} files.`);
      status.setText(`Reading ${documentLabel(`${src.name}.${src.ext}`)}...`);
      const read = src.kind === "pdf"
        ? await readPdfPages(src.buf, this.pages, (m) => status.setText(m))
        : await readDocumentPages(src.buf, `${src.name}.${src.ext}`, this.pages, (m) => status.setText(m));
      const pages = (read.pages || []).filter((page) => str(page.text).trim());
      if (!pages.length) throw new Error("No readable text was found in that file. Scanned pages need OCR first.");
      await ensureFolder(this.app, folder);
      let sourcePath = src.path;
      if (src.device) {
        const sourceFolder = `${folder}/sources`;
        await ensureFolder(this.app, sourceFolder);
        sourcePath = uniquePath(this.app.vault, sourceFolder, src.name, src.ext);
        await this.app.vault.createBinary(sourcePath, src.buf);
      }
      const sourceLink = sourcePath ? `[[${sourcePath}]]` : "";
      const note = buildCourseNote(pages, {
        title: this.title,
        course: this.course,
        sourceName: src.name,
        sourceLink,
        sourceFormat: src.ext,
        sourcePageCount: pages.length,
        importedOn: localDate(),
        pageLabel: src.kind === "pptx" || src.kind === "pptm" || src.kind === "odp" ? "Slide" : "Page",
      });
      const path = uniquePath(this.app.vault, folder, note.title, "md");
      await this.app.vault.create(path, note.text);
      this.plugin.refreshViews();
      this.showDone(el, path, pages.length, sourceLink);
      if (this.onDone) this.onDone({ path, pages: pages.length, title: note.title });
    } catch (e) {
      el.empty();
      el.createEl("h3", { text: "Course notes were not created" });
      el.createEl("p", { cls: "qt-error", text: str(e && e.message) || "The document could not be read." });
      const row = el.createDiv({ cls: "qt-row" });
      row.createEl("button", { text: "Close", cls: "qt-grow" }).addEventListener("click", () => this.close());
    }
  }

  showDone(el, path, pages, sourceLink) {
    el.empty();
    el.createEl("h3", { text: "Course note created" });
    el.createEl("p", { text: `Saved ${pages} page${pages === 1 ? "" : "s"} in ${path}.` });
    if (sourceLink) el.createEl("p", { cls: "qt-hint", text: `Source: ${sourceLink}` });
    const row = el.createDiv({ cls: "qt-row" });
    row.createEl("button", { text: "Close", cls: "qt-grow" }).addEventListener("click", () => this.close());
    row.createEl("button", { text: "Open note", cls: "mod-cta qt-grow" }).addEventListener("click", () => {
      const f = this.app.vault.getAbstractFileByPath(path);
      if (f instanceof TFile) this.app.workspace.getLeaf("tab").openFile(f);
      this.close();
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

module.exports = {
  DEFAULT_COURSE_NOTES_FOLDER,
  safeName,
  cleanPageLines,
  pageHeading,
  buildCourseNote,
  uniquePath,
  CourseNotesModal,
};
