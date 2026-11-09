"use strict";
const { QtModal } = require("./a11y");
const { Modal } = require("obsidian");
const chatPdf = require("./chat-pdf");
const { str } = require("./util");

/**
 * Choices for attaching a vault PDF. The modal only returns a path and page
 * selection; the panel reads and bounds the text, so no extraction happens
 * inside a picker and a failed read leaves the conversation unchanged.
 */
class PdfAttachModal extends QtModal {
  qtDialogLabel() {
    return "Attach a PDF";
  }

  constructor(app, pdfs, onSubmit) {
    super(app);
    this.pdfs = Array.isArray(pdfs) ? pdfs : [];
    this.onSubmit = onSubmit;
    this.busy = false;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    if (this.titleEl && typeof this.titleEl.setText === "function") {
      this.titleEl.setText("Attach a PDF");
    }
    contentEl.createDiv({
      cls: "qt-hint",
      text: "The PDF's text layer is read on this device. Nothing is sent until you press Send in the Study agent, and the text counts against the same chat budget.",
    });
    const searchRow = contentEl.createDiv({ cls: "qt-row qt-small-row" });
    this.search = searchRow.createEl("input", {
      type: "text",
      attr: { placeholder: "Search PDFs in the vault", "aria-label": "Search PDFs" },
    });
    this.search.addEventListener("input", () => this.refresh());

    const pdfRow = contentEl.createDiv({ cls: "qt-row qt-small-row" });
    pdfRow.createSpan({ text: "PDF" });
    this.select = pdfRow.createEl("select", { cls: "dropdown", attr: { "aria-label": "PDF to attach" } });

    const pageRow = contentEl.createDiv({ cls: "qt-row qt-small-row" });
    pageRow.createSpan({ text: "Pages" });
    this.pagesInput = pageRow.createEl("input", {
      type: "text",
      attr: { placeholder: chatPdf.DEFAULT_PAGES, "aria-label": "Pages to attach" },
    });
    this.pagesInput.value = chatPdf.DEFAULT_PAGES;
    contentEl.createDiv({
      cls: "qt-hint",
      text: `Use 1-20 or 2,4,6-8. At most ${chatPdf.MAX_PAGES} pages and ${chatPdf.MAX_PDFS} PDFs per chat. Leave Pages blank for the first ${chatPdf.MAX_PAGES} pages.`,
    });
    this.statusEl = contentEl.createDiv({ cls: "qt-hint" });

    const actions = contentEl.createDiv({ cls: "qt-row qt-small-row" });
    this.attachBtn = actions.createEl("button", { text: "Attach", cls: "mod-cta" });
    this.attachBtn.addEventListener("click", () => this.submit());
    const cancel = actions.createEl("button", { text: "Cancel" });
    cancel.addEventListener("click", () => this.close());
    this.refresh();
  }

  refresh() {
    if (!this.select) return;
    const query = str(this.search && this.search.value).trim().toLowerCase();
    const rows = this.pdfs.filter((pdf) => !query || str(pdf.path).toLowerCase().includes(query));
    this.select.empty?.();
    for (const pdf of rows) {
      this.select.createEl("option", { value: str(pdf.path), text: str(pdf.path) });
    }
    if (!rows.length) {
      this.select.createEl("option", {
        value: "",
        text: this.pdfs.length ? "No matching PDFs" : "No PDFs found in this vault",
      });
      if (this.attachBtn) this.attachBtn.disabled = true;
      if (this.statusEl) {
        this.statusEl.setText(
          this.pdfs.length ? "No PDF matches that search." : "Add a PDF to the vault first."
        );
      }
      return;
    }
    if (this.attachBtn) this.attachBtn.disabled = false;
  }

  async submit() {
    if (this.busy) return false;
    const path = str(this.select && this.select.value).trim();
    const pages = str(this.pagesInput && this.pagesInput.value).trim();
    if (!path) {
      if (this.statusEl) this.statusEl.setText("Choose a PDF first.");
      return false;
    }
    const specError = chatPdf.pageSpecError(pages);
    if (specError) {
      if (this.statusEl) this.statusEl.setText(specError);
      return false;
    }
    if (typeof this.onSubmit !== "function") {
      this.close();
      return true;
    }
    this.busy = true;
    if (this.attachBtn) this.attachBtn.disabled = true;
    if (this.statusEl) this.statusEl.setText("Reading the PDF text on this device...");
    let result;
    try {
      result = await this.onSubmit({ path, pages });
    } catch (e) {
      result = { ok: false, error: str(e && e.message ? e.message : e) || "Could not read that PDF." };
    }
    this.busy = false;
    if (!result || result.ok !== true) {
      if (this.attachBtn) this.attachBtn.disabled = false;
      if (this.statusEl) this.statusEl.setText((result && result.error) || "Could not attach that PDF.");
      return false;
    }
    this.close();
    return true;
  }
}

module.exports = { PdfAttachModal };
