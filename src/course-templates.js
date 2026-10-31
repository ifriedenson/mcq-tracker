"use strict";
/*
 * Course note templates. Course Command Center's remaining local idea is
 * note-type/template mapping: choose a note type (lecture, unit, review,
 * assignment, syllabus) and get a consistent course note. Everything is local
 * and the templates are editable text in settings. No Canvas client, OAuth
 * flow or network request is involved.
 */
const { localDate, str } = require("./util");

const MAX_TEMPLATES = 20;
const MAX_BODY = 20000;
const DEFAULT_FOLDER = "Courses";
const NOTE_TYPES = ["lecture", "unit", "review", "assignment", "syllabus"];

const DEFAULT_TEMPLATES = [
  {
    id: "lecture",
    name: "Lecture notes",
    type: "lecture",
    body: "## Overview\n\n## Key concepts\n\n## Worked examples\n\n## Questions to follow up\n",
  },
  {
    id: "unit",
    name: "Unit plan",
    type: "unit",
    body: "## Learning objectives\n\n## Topics\n\n## Readings\n\n## Practice\n",
  },
  {
    id: "review",
    name: "Exam review",
    type: "review",
    body: "## What the exam covers\n\n## Weak spots\n\n## Practice plan\n\n## Formula and definition sheet\n",
  },
  {
    id: "assignment",
    name: "Assignment brief",
    type: "assignment",
    body: "## Task\n\n## Requirements\n\n## Sources\n\n## Checklist\n",
  },
  {
    id: "syllabus",
    name: "Course syllabus",
    type: "syllabus",
    body: "## Course description\n\n## Grading breakdown\n\n## Schedule\n\n## Policies\n",
  },
];

function slug(value, fallback) {
  const clean = str(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return clean || fallback;
}

function normalizeTemplate(value, index) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const type = NOTE_TYPES.includes(str(source.type).toLowerCase()) ? str(source.type).toLowerCase() : "lecture";
  const name = str(source.name).replace(/\s+/g, " ").trim().slice(0, 120) || `${type[0].toUpperCase()}${type.slice(1)} notes`;
  const body = str(source.body).slice(0, MAX_BODY) || DEFAULT_TEMPLATES.find((entry) => entry.type === type).body;
  return { id: slug(source.id || name, `template-${index + 1}`), name, type, body };
}

function normalizeCourseTemplates(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const folder = str(source.folder).trim().replace(/^\/+|\/+$/g, "");
  const raw = Array.isArray(source.templates) ? source.templates : DEFAULT_TEMPLATES;
  const templates = [];
  const seen = new Set();
  for (const entry of raw) {
    const template = normalizeTemplate(entry, templates.length);
    if (seen.has(template.id)) continue;
    seen.add(template.id);
    templates.push(template);
    if (templates.length >= MAX_TEMPLATES) break;
  }
  return {
    enabled: !(value === false || source.enabled === false),
    folder: folder && !/\.\./.test(folder) ? folder.slice(0, 160) : DEFAULT_FOLDER,
    templates: templates.length ? templates : DEFAULT_TEMPLATES.map((entry, index) => normalizeTemplate(entry, index)),
  };
}

function templateVariables(input) {
  const source = input && typeof input === "object" ? input : {};
  return {
    course: str(source.course).trim().slice(0, 120),
    title: str(source.title).trim().slice(0, 160),
    date: /^\d{4}-\d{2}-\d{2}$/.test(str(source.date)) ? str(source.date) : localDate(),
    type: str(source.type).trim().toLowerCase() || "lecture",
  };
}

function fillTemplate(body, variables) {
  const vars = templateVariables(variables);
  return str(body).replace(/\{\{\s*(course|title|date|type)\s*\}\}/gi, (_match, key) => vars[key.toLowerCase()] || "");
}

function findTemplate(settings, typeOrId) {
  const wanted = str(typeOrId).trim().toLowerCase();
  return (
    settings.templates.find((template) => template.id === wanted) ||
    settings.templates.find((template) => template.type === wanted) ||
    settings.templates[0]
  );
}

function safeFileName(value) {
  return (
    str(value)
      .replace(/[\\/:*?"<>|#^[\]]+/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 90) || "Course note"
  );
}

/**
 * Render one course note. `template` may be an id or a note type; an unknown
 * value falls back to the first template so a note is still produced.
 */
function renderCourseNote(input, settingsValue) {
  const settings = normalizeCourseTemplates(settingsValue);
  const vars = templateVariables(input);
  const template = findTemplate(settings, input && (input.template || input.type));
  const title = vars.title || `${vars.course || "Course"} ${template.name}`;
  const fileName = safeFileName(title);
  const lines = [
    "---",
    "type: course-note",
  ];
  if (vars.course) lines.push(`course: ${JSON.stringify(vars.course)}`);
  lines.push(`course_note_type: ${template.type}`, `created: ${vars.date}`, "---", "", `# ${title}`, "");
  if (vars.course) lines.push(`**Course:** ${vars.course}`, "");
  lines.push(fillTemplate(template.body, { ...vars, title }).trim(), "");
  return {
    title,
    fileName,
    type: template.type,
    templateId: template.id,
    folder: settings.folder,
    path: `${settings.folder}/${fileName}.md`,
    markdown: `${lines.join("\n").trim()}\n`,
  };
}

function templateChoices(settingsValue) {
  return normalizeCourseTemplates(settingsValue).templates.map((template) => ({ value: template.id, label: `${template.name} (${template.type})` }));
}

class CourseTemplateModal {
  constructor(app, plugin) {
    this.app = app;
    this.plugin = plugin;
    this.error = "";
    this.busy = false;
    const settings = normalizeCourseTemplates(plugin && plugin.settings && plugin.settings.courseTemplates);
    this.values = { course: "", title: "", date: localDate(), template: settings.templates[0].id };
    const { Modal } = require("obsidian");
    this.modal = new Modal(app);
    this.modal.onOpen = () => this.draw();
    this.modal.onClose = () => this.modal.contentEl.empty();
  }

  open() {
    this.modal.open();
  }

  field(parent, label, type, placeholder, key) {
    const wrap = parent.createDiv({ cls: "qt-field" });
    wrap.createEl("label", { text: label });
    const input = wrap.createEl("input", { cls: "qt-input" });
    input.type = type || "text";
    if (placeholder) input.placeholder = placeholder;
    input.value = this.values[key] || "";
    input.addEventListener("input", () => (this.values[key] = input.value));
    return input;
  }

  draw() {
    const el = this.modal.contentEl;
    el.empty();
    el.createEl("h3", { text: "Create a course note" });
    el.createDiv({ cls: "qt-hint", text: "Choose a note type and fill the fields. The template body is editable in Settings, Global, Modules." });
    this.field(el, "Course", "text", "Biology", "course");
    this.field(el, "Title", "text", "Unit 3 — Cell respiration", "title");
    this.field(el, "Date", "date", "", "date");
    const wrap = el.createDiv({ cls: "qt-field" });
    wrap.createEl("label", { text: "Note type" });
    const select = wrap.createEl("select", { cls: "dropdown" });
    for (const choice of templateChoices(this.plugin.settings.courseTemplates)) {
      const option = select.createEl("option", { text: choice.label, value: choice.value });
      if (choice.value === this.values.template) option.selected = true;
    }
    select.addEventListener("change", () => (this.values.template = select.value));
    if (this.error) el.createDiv({ cls: "qt-error", text: this.error });
    const row = el.createDiv({ cls: "qt-row" });
    const create = row.createEl("button", { text: this.busy ? "Creating…" : "Create note", cls: "mod-cta" });
    create.disabled = this.busy;
    create.addEventListener("click", () => this.create());
    row.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.modal.close());
  }

  async create() {
    if (this.busy) return;
    this.busy = true;
    this.error = "";
    this.draw();
    try {
      const result = await this.plugin.createCourseNote(this.values);
      const { Notice } = require("obsidian");
      new Notice(`Course note created: ${result.path}`, 5000);
      this.modal.close();
    } catch (e) {
      this.busy = false;
      this.error = str(e && e.message ? e.message : e) || "Could not create the course note.";
      this.draw();
    }
  }
}

module.exports = {
  DEFAULT_FOLDER,
  DEFAULT_TEMPLATES,
  MAX_TEMPLATES,
  NOTE_TYPES,
  CourseTemplateModal,
  fillTemplate,
  findTemplate,
  normalizeCourseTemplates,
  renderCourseNote,
  safeFileName,
  templateChoices,
  templateVariables,
};
