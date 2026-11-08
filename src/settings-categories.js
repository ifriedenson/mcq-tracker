"use strict";
/*
 * Settings navigation, level one: categories. Level two: pages.
 *
 * A page names the settings renderer that already exists (`module`), and
 * optionally the tab inside it (`tab`). The MCQ Tracker module keeps its five
 * tabs, but each one is its own destination here instead of a second tab row,
 * so nothing is rendered twice and no settings store changes shape.
 */
const { STUDY_TOOL_SETTINGS_MODULES } = require("./study-tool-settings");

const STUDY_TOOL_BY_ID = Object.fromEntries(STUDY_TOOL_SETTINGS_MODULES.map((module) => [module.id, module]));

/** Builds a page for an existing study-tool settings module. */
function toolPage(id) {
  const module = STUDY_TOOL_BY_ID[id];
  if (!module) throw new Error(`settings: no study tool settings module named "${id}"`);
  return { id, label: module.label, module: id, icon: module.icon };
}

const CATEGORIES = [
  {
    id: "practice",
    label: "Practice",
    icon: "list-checks",
    description: "Run questions, review what is due, and read how practice is going.",
    pages: [
      { id: "mcq-practice", label: "Practice session", module: "mcq", tab: "practice", icon: "play" },
      { id: "mcq-review", label: "Review and scheduling", module: "mcq", tab: "review", icon: "repeat" },
      { id: "mcq-daily", label: "Daily quiz", module: "mcq", tab: "daily", icon: "sun" },
      { id: "note-review", label: "Note review", module: "note-review", icon: "notebook" },
      { id: "review-calendar", label: "Review calendar", module: "review-calendar", icon: "calendar-clock" },
      { id: "study-stats", label: "Study statistics", module: "study-stats", icon: "bar-chart-3" },
      { id: "mcq-about", label: "Practice tools and export", module: "mcq", tab: "about", icon: "download" },
    ],
  },
  {
    id: "memory",
    label: "Cards & memory",
    icon: "layers",
    description: "Flashcards, recall schedules and the pace of spaced review.",
    pages: [
      { id: "cards", label: "Cards and vocabulary", module: "cards", icon: "layers" },
      toolPage("recall-scheduler"),
      toolPage("retention"),
      toolPage("scheduler-fit"),
      toolPage("card-archive"),
      toolPage("quiz-index"),
    ],
  },
  {
    id: "planning",
    label: "Courses & planning",
    icon: "graduation-cap",
    description: "Courses, calendar, assignments, time and the study plan for the week.",
    pages: [
      { id: "calendar", label: "Calendar", module: "calendar", icon: "graduation-cap" },
      { id: "assignments", label: "Assignments", module: "assignments", icon: "clipboard-list" },
      { id: "pomodoro", label: "Pomodoro", module: "pomodoro", icon: "timer" },
      { id: "local-events", label: "Local events", module: "local-events", icon: "calendar-plus" },
      toolPage("study-goals"),
      toolPage("topic-planner"),
      toolPage("study-flow"),
      toolPage("study-tasks"),
      toolPage("time-blocks"),
      toolPage("courses"),
      toolPage("subjects"),
      toolPage("course-health"),
      toolPage("course-templates"),
      toolPage("study-nudge"),
    ],
  },
  {
    id: "notes",
    label: "Notes & tools",
    icon: "notebook-pen",
    description: "Writing, reading, documents and the study tools that read your notes.",
    pages: [
      toolPage("cornell"),
      toolPage("lecture-log"),
      toolPage("lecture-notes"),
      toolPage("deep-notes"),
      toolPage("feynman"),
      toolPage("feynman-ai"),
      toolPage("vocabulary"),
      toolPage("reading-library"),
      toolPage("citations"),
      toolPage("annotations"),
      toolPage("pdf-annotations"),
      toolPage("advanced-tables"),
      toolPage("read-aloud"),
      toolPage("audio-bookmarks"),
      toolPage("vault-search"),
      toolPage("study-map"),
      toolPage("web-browser"),
      toolPage("quiz-maker"),
      toolPage("sat-math"),
      toolPage("cbt-exam"),
      toolPage("sfc-cards"),
      { id: "reference", label: "Reference", module: "reference", icon: "book-open" },
    ],
  },
  {
    id: "agent",
    label: "Study agent",
    icon: "sparkles",
    description: "The assistant: backend, models, commands, memory and what it may see.",
    pages: [{ id: "mcq-ai", label: "AI and the assistant", module: "mcq", tab: "ai", icon: "sparkles" }],
  },
  {
    id: "app",
    label: "App & documents",
    icon: "settings",
    description: "Plugin-wide switches, modules and the embedded PDF tools.",
    pages: [
      { id: "global", label: "Modules and global options", module: "global", icon: "toggle-left" },
      { id: "pdf-plus", label: "PDF++", module: "pdf-plus", icon: "file-text" },
    ],
  },
];

const SETTINGS_PAGES = CATEGORIES.flatMap((category) => category.pages.map((page) => Object.assign({}, page, { category: category.id })));

const SETTINGS_PAGE_BY_ID = Object.fromEntries(SETTINGS_PAGES.map((page) => [page.id, page]));

/** The first page that renders a module, used when a caller only knows the module id. */
const FIRST_PAGE_BY_MODULE = {};
for (const page of SETTINGS_PAGES) {
  if (!FIRST_PAGE_BY_MODULE[page.module]) FIRST_PAGE_BY_MODULE[page.module] = page.id;
}

function categoryForPage(pageId) {
  const page = SETTINGS_PAGE_BY_ID[pageId];
  return CATEGORIES.find((category) => page && category.id === page.category) || CATEGORIES[0];
}

function pageForModule(moduleId) {
  return FIRST_PAGE_BY_MODULE[moduleId] || SETTINGS_PAGES[0].id;
}

module.exports = {
  SETTINGS_CATEGORIES: CATEGORIES,
  SETTINGS_PAGES,
  SETTINGS_PAGE_BY_ID,
  categoryForPage,
  pageForModule,
};
