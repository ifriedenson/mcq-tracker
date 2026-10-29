"use strict";
const { Modal, Notice, Setting, TFile, normalizePath } = require("obsidian");
const {
  ANNOTATION_COLORS,
  ANNOTATION_TYPES,
  hashBytes,
  parseAnnotationFile,
  sidecarPathFor,
  upsertAnnotation,
} = require("./pdf-annotations");

/* A first-slice annotator: it records annotations and notes beside a PDF, not a canvas overlay. */
class PdfAnnotationModal extends Modal {
  constructor(app, plugin, options) {
    super(app);
    this.plugin = plugin;
    this.pdfPath = (options && options.pdfPath) || "";
    this.page = "1";
    this.type = "highlight";
    this.color = "yellow";
    this.quote = "";
    this.note = "";
    this.text = "";
    this.busy = false;
  }

  onOpen() {
    this.modalEl.addClass("qt-pdf-annotation-modal");
    this.render();
  }

  onClose() {
    this.contentEl.empty();
  }

  pdfFiles() {
    return this.app.vault
      .getFiles()
      .filter((f) => f instanceof TFile && /\.pdf$/i.test(f.path))
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  render() {
    const el = this.contentEl;
    el.empty();
    el.createEl("h3", { text: "Add a PDF annotation" });
    el.createEl("p", {
      cls: "setting-item-description",
      text: "Annotations are saved in a Markdown sidecar next to the PDF, keyed by the PDF's content hash. The visual pen and highlighter overlay is not part of this first slice.",
    });

    const files = this.pdfFiles();
    if (!files.length) {
      el.createEl("p", { cls: "qt-hint", text: "No PDFs are in this vault yet. Add one, then reopen this window." });
      return;
    }
    if (!this.pdfPath || !files.some((f) => f.path === this.pdfPath)) {
      const active = this.app.workspace.getActiveFile();
      this.pdfPath = active && /\.pdf$/i.test(active.path) ? active.path : files[0].path;
    }

    new Setting(el).setName("PDF").addDropdown((d) => {
      for (const file of files) d.addOption(file.path, file.path);
      d.setValue(this.pdfPath).onChange((v) => {
        this.pdfPath = v;
      });
    });

    new Setting(el).setName("Page").addText((t) => {
      t.inputEl.type = "number";
      t.setValue(this.page).onChange((v) => {
        this.page = v;
      });
    });

    new Setting(el).setName("Type").addDropdown((d) => {
      for (const type of ANNOTATION_TYPES) d.addOption(type, type[0].toUpperCase() + type.slice(1));
      d.setValue(this.type).onChange((v) => {
        this.type = v;
      });
    });

    new Setting(el).setName("Colour").addDropdown((d) => {
      for (const color of ANNOTATION_COLORS) d.addOption(color, color[0].toUpperCase() + color.slice(1));
      d.setValue(this.color).onChange((v) => {
        this.color = v;
      });
    });

    new Setting(el)
      .setName("Quoted text")
      .setDesc("Optional: the sentence or phrase you highlighted.")
      .addTextArea((t) => {
        t.setPlaceholder("Quoted text").setValue(this.quote).onChange((v) => {
          this.quote = v;
        });
      });

    new Setting(el)
      .setName("Text box")
      .setDesc("Optional: text to place on the page.")
      .addTextArea((t) => {
        t.setPlaceholder("Text box").setValue(this.text).onChange((v) => {
          this.text = v;
        });
      });

    new Setting(el)
      .setName("Note")
      .setDesc("Your own explanation, question or reminder.")
      .addTextArea((t) => {
        t.setPlaceholder("Note").setValue(this.note).onChange((v) => {
          this.note = v;
        });
      });

    const row = el.createDiv({ cls: "qt-row qt-pdf-annotation-actions" });
    const save = row.createEl("button", { text: "Save annotation", cls: "mod-cta qt-grow" });
    save.addEventListener("click", () => this.save());
    const open = row.createEl("button", { text: "Open annotations", cls: "qt-grow" });
    open.addEventListener("click", () => this.openAnnotations());
    const cancel = row.createEl("button", { text: "Cancel", cls: "qt-grow" });
    cancel.addEventListener("click", () => this.close());
    this.statusEl = el.createDiv({ cls: "qt-hint" });
  }

  async save() {
    if (this.busy) return;
    this.busy = true;
    try {
      const file = this.app.vault.getAbstractFileByPath(this.pdfPath);
      if (!file || !(file instanceof TFile)) throw new Error("That PDF is no longer in the vault.");
      const bytes = await this.app.vault.readBinary(file);
      const hash = hashBytes(bytes);
      const path = normalizePath(sidecarPathFor(this.pdfPath));
      const existing = this.app.vault.getAbstractFileByPath(path);
      const oldText = existing ? await this.app.vault.cachedRead(existing) : "";
      if (oldText) {
        const parsed = parseAnnotationFile(oldText);
        if (parsed.pdfHash && parsed.pdfHash !== hash) {
          new Notice("The PDF has changed since its annotations were written. The sidecar still records the old hash; review it before relying on page numbers.", 8000);
        }
      }
      const result = upsertAnnotation(
        oldText,
        {
          page: this.page,
          type: this.type,
          color: this.color,
          quote: this.quote,
          text: this.text,
          note: this.note,
        },
        { pdfPath: this.pdfPath, pdfHash: hash }
      );
      if (existing) await this.app.vault.modify(existing, result.text);
      else await this.app.vault.create(path, result.text);
      new Notice(`Saved the annotation in ${path}.`);
      if (this.statusEl) this.statusEl.setText(`Saved page ${result.annotations[result.annotations.length - 1].page}.`);
      this.close();
    } catch (e) {
      if (this.statusEl) this.statusEl.setText(e && e.message ? e.message : String(e));
    } finally {
      this.busy = false;
    }
  }

  async openAnnotations() {
    const path = normalizePath(sidecarPathFor(this.pdfPath));
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file) {
      await this.app.workspace.getLeaf("tab").openFile(file);
      this.close();
      return;
    }
    if (this.statusEl) this.statusEl.setText("No sidecar yet. Save an annotation first.");
  }
}

module.exports = {
  PdfAnnotationModal,
};
