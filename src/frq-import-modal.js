"use strict";
const { FuzzySuggestModal, Modal, Notice } = require("obsidian");
const { FRQ_COURSES, buildFrqNote, parseRubric, presetsForCourse } = require("./frq");
const { str } = require("./util");

function criteriaText(criteria) {
  return (criteria || [])
    .map((criterion) => `- [${criterion.points}] ${criterion.label}${criterion.description ? `: ${criterion.description}` : ""}`)
    .join("\n");
}

function itemTitle(item) {
  return str(item.title).trim() || "Question";
}

/*
 * The preview is the write boundary. Opening or redrawing this modal only
 * reads candidate state; createFrqNote() is called from confirm() alone.
 */
class FrqImportPreviewModal extends Modal {
  constructor(app, plugin, options) {
    super(app);
    this.plugin = plugin;
    this.options = options || {};
    this.source = str(this.options.source).trim();
    this.warnings = Array.isArray(this.options.warnings) ? this.options.warnings.slice() : [];
    this.items = (Array.isArray(this.options.items) ? this.options.items : []).map((item) => ({
      ...item,
      title: str(item.title).trim(),
      prompt: str(item.prompt),
      rubricText: str(item.rubricText) || criteriaText(item.criteria),
      include: item.valid !== false,
    }));
    this.courseId = FRQ_COURSES[0].id;
    this.kind = presetsForCourse(this.courseId)[0].id;
    this.saving = false;
    this.error = "";
  }

  onOpen() {
    this.draw();
  }

  onClose() {
    this.contentEl.empty();
  }

  selectedItems() {
    return this.items.filter((item) => item.include);
  }

  draw() {
    const root = this.contentEl;
    root.empty();
    root.createEl("h2", { text: "Import free-response questions from a PDF" });
    root.createDiv({
      cls: "qt-hint",
      text: "Review the prompts and rubrics the PDF text layer produced. Edit anything the splitter got wrong, untick an item to discard it, then create the notes. Nothing is written before you press the create button.",
    });
    if (this.source) root.createDiv({ cls: "qt-hint", text: `Source: ${this.source}` });
    for (const warning of this.warnings) root.createDiv({ cls: "qt-hint qt-frq-warning", text: warning });

    const courseRow = root.createDiv({ cls: "qt-row" });
    courseRow.createEl("label", { text: "Course for this batch" });
    const course = courseRow.createEl("select", { cls: "dropdown" });
    course.setAttribute("aria-label", "Course for this batch");
    for (const item of FRQ_COURSES) course.createEl("option", { text: item.name, value: item.id });
    course.value = this.courseId;
    course.addEventListener("change", () => {
      this.courseId = course.value;
      this.kind = presetsForCourse(this.courseId)[0].id;
      this.draw();
    });

    const kindRow = root.createDiv({ cls: "qt-row" });
    kindRow.createEl("label", { text: "Question type" });
    const kind = kindRow.createEl("select", { cls: "dropdown" });
    kind.setAttribute("aria-label", "Question type");
    for (const preset of presetsForCourse(this.courseId)) kind.createEl("option", { text: preset.label, value: preset.id });
    kind.value = this.kind;
    kind.addEventListener("change", () => {
      this.kind = kind.value;
    });

    root.createDiv({
      cls: "qt-hint",
      text: "Imported rubrics are saved as your own user-supplied scoring guide. The plugin does not verify them against an official rubric.",
    });
    root.createDiv({ cls: "qt-hint", text: `${this.selectedItems().length} of ${this.items.length} item${this.items.length === 1 ? "" : "s"} selected.` });

    this.items.forEach((item, index) => {
      const card = root.createDiv({ cls: "qt-settings-card qt-frq-import-item" });
      const head = card.createDiv({ cls: "qt-row qt-frq-import-head" });
      const include = head.createEl("input", { type: "checkbox", attr: { "aria-label": `Include ${itemTitle(item)}` } });
      include.checked = item.include;
      include.addEventListener("change", () => {
        item.include = include.checked;
        this.draw();
      });
      head.createEl("strong", { text: itemTitle(item) });
      head.createDiv({ cls: "qt-hint", text: item.page ? `page ${item.page}` : "" });

      card.createEl("label", { text: "Title" });
      const title = card.createEl("input", { type: "text", cls: "qt-modal-input" });
      title.setAttribute("aria-label", "Title");
      title.value = item.title;
      title.addEventListener("input", () => {
        item.title = title.value;
      });

      card.createEl("label", { text: "Prompt" });
      const prompt = card.createEl("textarea", { cls: "qt-frq-answer", attr: { rows: "5" } });
      prompt.setAttribute("aria-label", "Prompt");
      prompt.value = item.prompt;
      prompt.addEventListener("input", () => {
        item.prompt = prompt.value;
      });

      card.createEl("label", { text: "Rubric" });
      const rubric = card.createEl("textarea", { cls: "qt-frq-answer", attr: { rows: "6" } });
      rubric.setAttribute("aria-label", "Rubric");
      rubric.value = item.rubricText;
      rubric.addEventListener("input", () => {
        item.rubricText = rubric.value;
      });
      card.createDiv({ cls: "qt-hint", text: "One criterion per line: - [points] Name: what earns the point. A Markdown table with a points column also works." });
      for (const warning of item.warnings || []) card.createDiv({ cls: "qt-hint qt-frq-warning", text: warning });

      const controls = card.createDiv({ cls: "qt-row" });
      controls.createEl("button", { text: "Discard", cls: "qt-link" }).addEventListener("click", () => {
        item.include = false;
        this.draw();
      });
      controls.createEl("span", { cls: "qt-hint", text: `Item ${index + 1}` });
    });

    if (this.error) root.createDiv({ cls: "qt-hint qt-frq-warning", text: this.error });

    const actions = root.createDiv({ cls: "qt-row" });
    actions.createEl("button", { text: "Cancel", cls: "qt-grow" }).addEventListener("click", () => this.close());
    const count = this.selectedItems().length;
    const create = actions.createEl("button", {
      text: this.saving ? "Creating…" : `Create ${count} note${count === 1 ? "" : "s"}`,
      cls: "mod-cta qt-grow",
    });
    create.disabled = this.saving || count === 0;
    create.addEventListener("click", () => this.confirm());
    root.createDiv({ cls: "qt-hint", text: "The notes use the ordinary FRQ note format, so the existing grader, second pass and attempt history work unchanged." });
  }

  /**
   * Validate every selected item before writing any of them. Returns false and
   * keeps the modal open when one item still needs a prompt, title or criterion.
   */
  async confirm() {
    if (this.saving) return false;
    const selected = this.selectedItems();
    if (!selected.length) {
      this.error = "Select at least one item, or cancel.";
      this.draw();
      return false;
    }
    const inputs = [];
    for (const item of selected) {
      const parsed = parseRubric(item.rubricText);
      const label = itemTitle(item);
      if (!str(item.title).trim() || !str(item.prompt).trim()) {
        this.error = `${label} needs a title and a prompt.`;
        this.draw();
        return false;
      }
      if (!parsed.criteria.length) {
        this.error = `${label} needs at least one recognizable rubric criterion.`;
        this.draw();
        return false;
      }
      const input = {
        courseId: this.courseId,
        kind: this.kind,
        title: item.title,
        prompt: item.prompt,
        rubric: parsed.criteria,
        rubricSource: "user",
      };
      if (!buildFrqNote(input)) {
        this.error = `${label} could not be turned into an FRQ note.`;
        this.draw();
        return false;
      }
      inputs.push(input);
    }

    this.saving = true;
    this.error = "";
    this.draw();
    try {
      const created = [];
      for (const input of inputs) created.push(await this.plugin.createFrqNote(input));
      new Notice(`Created ${created.length} FRQ note${created.length === 1 ? "" : "s"} from ${this.source || "the PDF"}.`);
      this.close();
      if (typeof this.options.onDone === "function") this.options.onDone(created);
      return true;
    } catch (error) {
      this.saving = false;
      this.error = str(error && error.message ? error.message : error);
      this.draw();
      return false;
    }
  }
}

class FrqPdfPickerModal extends FuzzySuggestModal {
  constructor(app, files, onChoose) {
    super(app);
    this.files = Array.isArray(files) ? files : [];
    this.onChoose = typeof onChoose === "function" ? onChoose : null;
    this.setPlaceholder("Choose a PDF with free-response questions and a rubric");
  }

  getItems() {
    return this.files;
  }

  getItemText(file) {
    return str(file && (file.path || file.name));
  }

  onChooseItem(file) {
    if (this.onChoose) this.onChoose(file);
  }
}

module.exports = {
  FrqImportPreviewModal,
  FrqPdfPickerModal,
};
