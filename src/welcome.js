"use strict";
/* First-run guide data and per-device onboarding state. Nothing here touches a vault note. */

const WELCOME_STORAGE_KEY = "mcqTrackerWelcome";

const WELCOME_MODULE_INFO = [
  { id: "mcq", label: "MCQ Tracker", description: "Practice questions from your notes, weak spots, timed tests and file import." },
  { id: "cards", label: "Cards", description: "Flashcards, vocabulary, cloze and image-occlusion cards with spaced review." },
  { id: "calendar", label: "Calendar", description: "Classes and exams from an .ics schedule, countdowns and class notes." },
  { id: "ai", label: "AI features", description: "Optional tutor chat, AI grading and document import. Nothing is sent until you turn it on and add a key." },
  { id: "reference", label: "Reference", description: "A local formula sheet, constants, unit converter, graph plotter and periodic table." },
];

const WELCOME_PRESETS = [
  {
    id: "sat",
    label: "SAT / AP-style prep",
    description: "Practice questions and review. Cards, calendar and AI stay off until you want them.",
    modules: { mcq: true, cards: false, calendar: false, ai: false, reference: false },
  },
  {
    id: "university",
    label: "University courses",
    description: "Questions, cards and the calendar. AI and Reference stay off.",
    modules: { mcq: true, cards: true, calendar: true, ai: false, reference: false },
  },
  {
    id: "language",
    label: "Language learning",
    description: "Questions and vocabulary cards. Calendar, AI and Reference stay off.",
    modules: { mcq: true, cards: true, calendar: false, ai: false, reference: false },
  },
  {
    id: "stem",
    label: "STEM problem sets",
    description: "Questions and the local Reference panel. Cards, calendar and AI stay off.",
    modules: { mcq: true, cards: false, calendar: false, ai: false, reference: true },
  },
  {
    id: "flashcards",
    label: "Just flashcards",
    description: "Cards only. Questions, calendar, AI and Reference stay off.",
    modules: { mcq: false, cards: true, calendar: false, ai: false, reference: false },
  },
  {
    id: "off",
    label: "Everything off",
    description: "Start quiet; turn modules on later under Settings, Global, Modules.",
    modules: { mcq: false, cards: false, calendar: false, ai: false, reference: false },
  },
];

const WELCOME_STEPS = [
  { id: "import", title: "Get questions in", body: "Import a PDF, PowerPoint, Word file or other document, or make a question note.", button: "Import questions", action: "import" },
  { id: "practice", title: "Practice", body: "Open the practice view, choose filters, or start a short Quick Practice session.", button: "Open practice", action: "practice" },
  { id: "today", title: "Review what is due", body: "Today shows due questions, cards and the next class in one place.", button: "Open Today", action: "today" },
  { id: "card", title: "Add cards (optional)", body: "Create a flashcard, vocabulary item or cloze card in a deck you choose.", button: "Create a card", action: "card" },
  { id: "calendar", title: "Add your schedule (optional)", body: "Import an .ics file or calendar link, then open the month or day view.", button: "Open calendar", action: "calendar" },
  { id: "settings", title: "Find settings later", body: "Settings has Global, MCQ Tracker, Cards, Calendar and Reference groups, each with its own tabs.", button: "Open settings", action: "settings" },
];

function emptyWelcomeState() {
  return { seenVersion: "", dismissed: false, completed: [] };
}

function normalizeWelcomeState(value) {
  const src = value && typeof value === "object" ? value : {};
  const completed = Array.isArray(src.completed) ? src.completed.filter((id) => WELCOME_STEPS.some((step) => step.id === id)) : [];
  return {
    seenVersion: String(src.seenVersion || ""),
    dismissed: src.dismissed === true,
    completed: [...new Set(completed)],
  };
}

function loadWelcomeState(app) {
  try {
    const raw = app && app.loadLocalStorage ? app.loadLocalStorage(WELCOME_STORAGE_KEY) : null;
    return normalizeWelcomeState(raw);
  } catch (e) {
    return emptyWelcomeState();
  }
}

function saveWelcomeState(app, state) {
  if (!app || !app.saveLocalStorage) return;
  app.saveLocalStorage(WELCOME_STORAGE_KEY, normalizeWelcomeState(state));
}

function welcomeShouldShow(app) {
  return !loadWelcomeState(app).seenVersion;
}

function markWelcomeSeen(app, version) {
  const state = loadWelcomeState(app);
  state.seenVersion = String(version || "seen");
  state.dismissed = true;
  saveWelcomeState(app, state);
  return state;
}

function markWelcomeStep(app, stepId) {
  const state = loadWelcomeState(app);
  if (WELCOME_STEPS.some((step) => step.id === stepId) && !state.completed.includes(stepId)) {
    state.completed.push(stepId);
    saveWelcomeState(app, state);
  }
  return state;
}

function moduleSummary(modules) {
  const on = WELCOME_MODULE_INFO.filter((m) => modules && modules[m.id]).map((m) => m.label);
  return on.length ? on.join(", ") : "All modules off";
}

module.exports = {
  WELCOME_MODULE_INFO,
  WELCOME_PRESETS,
  WELCOME_STEPS,
  WELCOME_STORAGE_KEY,
  emptyWelcomeState,
  loadWelcomeState,
  markWelcomeSeen,
  markWelcomeStep,
  moduleSummary,
  normalizeWelcomeState,
  saveWelcomeState,
  welcomeShouldShow,
};
