"use strict";
/* First-run guide data and per-device onboarding state. Nothing here touches a vault note. */

const WELCOME_STORAGE_KEY = "mcqTrackerWelcome";
const WELCOME_NOTE_PATH = "MCQ Tracker Start here.md";

const WELCOME_MODULE_INFO = [
  { id: "mcq", label: "MCQ Tracker", description: "Practice questions from your notes, weak spots, timed tests and file import." },
  { id: "cards", label: "Cards", description: "Flashcards, vocabulary, cloze and image-occlusion cards with spaced review." },
  { id: "calendar", label: "Calendar", description: "Classes and exams from an .ics schedule, countdowns and class notes." },
  { id: "assignments", label: "Assignments", description: "A local gradebook and task list: weighted course grades, final-score planning and a credit-weighted GPA." },
  { id: "ai", label: "AI features", description: "Optional tutor chat, AI grading and document import. Importing a PDF or document into questions needs AI; practice, cards and review do not. Nothing is sent until you turn it on and add a key." },
  { id: "reference", label: "Reference", description: "A local formula sheet, constants, unit converter, graph plotter, periodic table, AP resources and an unofficial AP score estimator." },
];

const WELCOME_PRESETS = [
  {
    id: "ap",
    label: "AP courses",
    description: "Questions, cards, the exam calendar, assignments and AP resources/score tools. AI stays off.",
    adaptive: true,
    adaptiveFrequency: true,
    modules: { mcq: true, cards: true, calendar: true, assignments: true, ai: false, reference: true },
  },
  {
    id: "sat",
    label: "SAT prep",
    description: "Practice questions and adaptive review. Cards, calendar and AI stay off until you want them.",
    adaptive: true,
    modules: { mcq: true, cards: false, calendar: false, assignments: true, ai: false, reference: false },
  },
  {
    id: "university",
    label: "University courses",
    description: "Questions, cards and the calendar, with adaptive session sizing on. AI and Reference stay off.",
    adaptive: true,
    adaptiveFrequency: true,
    modules: { mcq: true, cards: true, calendar: true, assignments: true, ai: false, reference: false },
  },
  {
    id: "language",
    label: "Language learning",
    description: "Questions and vocabulary cards. Calendar, AI and Reference stay off.",
    adaptiveFrequency: true,
    modules: { mcq: true, cards: true, calendar: false, assignments: false, ai: false, reference: false },
  },
  {
    id: "stem",
    label: "STEM problem sets",
    description: "Questions and the local Reference panel, with adaptive session sizing on. Cards, calendar and AI stay off.",
    adaptive: true,
    modules: { mcq: true, cards: false, calendar: false, assignments: true, ai: false, reference: true },
  },
  {
    id: "flashcards",
    label: "Just flashcards",
    description: "Cards only. Questions, calendar, AI and Reference stay off.",
    adaptiveFrequency: true,
    modules: { mcq: false, cards: true, calendar: false, assignments: false, ai: false, reference: false },
  },
  {
    id: "off",
    label: "Everything off",
    description: "Start quiet; turn modules on later under Settings, Global, Modules.",
    modules: { mcq: false, cards: false, calendar: false, assignments: false, ai: false, reference: false },
  },
];

const WELCOME_SETUP_STEPS = [
  { id: "example", title: "Try a ready-made question", body: "Use the example below. It adds one ordinary note to Questions and opens it in Practice." },
  { id: "answer", title: "Answer and check", body: "Choose an answer, submit, and read the explanation. The result is saved to that note." },
  { id: "review", title: "Let the review come back", body: "MCQ Tracker schedules the next review. Today shows what is due." },
];

const WELCOME_EXAMPLE = {
  question: "A plant cell is sealed in a clear container with a carbon dioxide sensor and left in bright light. What happens to the carbon dioxide level?",
  choices: [
    "It rises because the cell respires.",
    "It falls because photosynthesis uses carbon dioxide.",
    "It stays the same because the cell only respires.",
    "It rises, then stops changing because photosynthesis stops.",
  ],
  answer: "B",
  explanation: "Photosynthesis uses carbon dioxide faster than respiration releases it, so the level falls. In darkness, respiration would make it rise.",
  course: "Getting started",
  skill: "Photosynthesis",
  difficulty: "easy",
};

const WELCOME_STEPS = [
  { id: "import", title: "Get questions in", body: "Import a PDF, PowerPoint, Word file or other document, or make a question note.", button: "Import questions", action: "import" },
  { id: "practice", title: "Practice", body: "Open the practice view, choose filters, or start a short Quick Practice session.", button: "Open practice", action: "practice" },
  { id: "today", title: "Review what is due", body: "Today shows due questions, cards and the next class in one place.", button: "Open Today", action: "today" },
  { id: "card", title: "Add cards (optional)", body: "Create a flashcard, vocabulary item or cloze card in a deck you choose.", button: "Create a card", action: "card" },
  { id: "calendar", title: "Add your schedule (optional)", body: "Import an .ics file or calendar link, then open the month or day view.", button: "Open calendar", action: "calendar" },
  { id: "settings", title: "Find settings later", body: "Settings has Global, MCQ Tracker, Cards, Calendar, Assignments and Reference groups, each with its own tabs.", button: "Open settings", action: "settings" },
];

function welcomeNoteMarkdown() {
  return "---\nmcq_tracker_welcome: true\n---\n\n# Start here with MCQ Tracker\n\nThis note is created once, on your first run. It is a normal Obsidian note: read it, edit it, or delete it when it has done its job. MCQ Tracker does not need this note to work.\n\n> [!tip] The one-minute version\n> Press **Ctrl/Cmd+P**, type **Open welcome guide**, and press Enter. Choose **Try the example question**. It writes one ordinary note to **Questions/** and opens Practice. Answer it, submit, and open **Today** tomorrow to see it come back.\n\n## Pick your path\n\n| If this sounds like you | Read |\n| --- | --- |\n| I have never used Obsidian. | [[#New to Obsidian in five minutes]] |\n| I am taking an AP course. | [[#AP student path]] |\n| I use Obsidian, but not this plugin. | [[#Obsidian user path]] |\n| I want the shortcuts and file formats. | [[#Power-user shortcuts]] |\n\nYou can read all four; they are short. Nothing here locks you in.\n\n## What needs AI, and what does not\n\nMost of this plugin works with AI turned off. One everyday step does need it: turning a PDF or another document into question notes.\n\n> [!important] Turning a PDF into questions needs AI\n> There is no offline PDF-to-question converter. **Import questions from a file (PDF, PowerPoint, Word)** needs **AI features** turned on, plus either a provider key (**Direct AI**) or the **OpenCode agent** on desktop. The file's text is sent to that provider, which may charge for long files. Without AI set up, the import stops and asks you to turn it on.\n\n| Works with AI off | Needs AI turned on and a provider or the OpenCode agent |\n| --- | --- |\n| Writing question notes by hand, the example question, practice, timed tests, review and **Today** | Turning a PDF, PowerPoint, Word or other document into question notes |\n| Making cards by hand, card review, cram, `.apkg` import/export and AnkiConnect | Tutor chat and the Study agent; AI grading of free response and the optional AI second opinion on typed answers |\n| Calendar, classes, exams, assignments, grades and GPA | Generating questions, quizzes or cards from a document, photo or handwritten page |\n| Reference tools, AP resources and the unofficial AP score calculator | Summarising a course note, and turning PDF pages into a LaTeX note |\n\n**If you do not have AI:** run **Quick add questions from pasted text** and paste questions you already have; it works offline. You can also import ready-made flashcards (Quizlet, Kahoot, Moodle, QTI, GIFT, CSV or Markdown). Practice, review, cards, the calendar and the reference tools all keep working.\n\n## New to Obsidian in five minutes\n\nObsidian is a note-taking app. It is not a website and it does not need an account.\n\n- **A vault is a folder.** Everything you see is a file in that folder. Back it up the same way you back up school files.\n- **The left sidebar is your file list.** If you close this note, it is still there. Click **MCQ Tracker Start here** to return.\n- **The command palette is the action search.** Press **Ctrl/Cmd+P**, type the name of something you want to do, and press Enter. This is how you reach most of MCQ Tracker. On a phone, the same command names are available from the app menu.\n- **Settings is the gear at the bottom-left.** The plugin switches live under **Settings → Global → Modules**.\n- **The top block between the two --- lines is note properties.** Question notes use it to store the answer and your review history. Leave it alone until you are comfortable; editing it can change how a question is graded.\n- **Reading and editing are separate.** Use the book/pencil control at the top-right, or run **Toggle reading view** from the command palette. You do not need to edit this note.\n- **Links are two opening square brackets.** Type two square brackets in any note, start typing a note name, and press Enter. You do not need links to start.\n\n> [!note] If you get lost\n> Press **Ctrl/Cmd+P** and type **Open Start here note**. That brings this note back. If that does not work, open **Settings → Global → About** and choose **Open Start here note**.\n\n## AP student path\n\nThe short version: use the AP setup, add your exam date, bring in one small unit of practice, then let **Today** tell you what to do.\n\n1. **Choose the AP starting setup.** Press **Ctrl/Cmd+P**, type **Open welcome guide**, and choose **Choose modules**. Pick **AP courses**. This turns on questions, cards, the calendar, assignments, and Reference (where AP resources and the AP score calculator live). AI stays off.\n2. **Put the exam on your calendar.** Run **Open AP resources**, choose your course, and open **AP exam calendar** for the official date. Then run **Exams: add an exam** and add that date. Class times are optional; add them later if you want them.\n3. **Bring in one small batch of practice.** Start with one unit, not the whole course.\n   **This step needs AI.** Turning a file into questions has no offline version: turn on AI features and add a provider key (**Direct AI**), or use the **OpenCode agent** on desktop. Without that, run **Quick add questions from pasted text** (it works offline) or import ready-made flashcards, then continue at step 4.\n   - For multiple-choice, run **Import questions from a file (PDF, PowerPoint, Word)**. A unit review, teacher handout, or your own notes are enough. The plugin previews what it found before writing anything.\n   - For free response, run **AP: import free-response questions from a PDF**, or **AP: create a free-response note**. Put the PDF in your vault first. If you have a released FRQ and scoring guidelines from AP Central, download them yourself and import the PDF. The plugin reads the text layer, and you approve the questions before they are saved.\n   - AP Classroom is account-gated. The plugin never signs in, scrapes, or stores College Board content; use your own AP Classroom access in a browser.\n4. **Practice for a short session.** Run **Open practice view**. Filter to your course or one skill, or run **Quick Practice** for 2, 5, or 10 minutes. For written answers, run **AP: open free-response practice and grader**. The rubric grade is a study aid, not an official AP score.\n5. **Review the next day.** Run **Open Today**. It brings back due questions, FRQs, cards, deadlines, and the next exam. If you want an estimate after a full practice exam, run **Open AP score calculator**. It is an unofficial estimate, not a prediction.\n6. **Use the official pages when you need them.** Run **Open AP resources** for the course page, exam format, released FRQs and scoring guidelines, AP Students dates, AP Classroom, and the exam calendar.\n\nSupported AP resource packs: AP Biology, Calculus AB, Calculus BC, Chemistry, English Language and Composition, Statistics, U.S. History, and World History: Modern.\n\n> [!warning] Keep it honest\n> AP is a trademark of the College Board. This plugin is not affiliated with or endorsed by the College Board. The score estimator and FRQ grader are practice aids.\n\n## Obsidian user path\n\nYou already know the app, so here is the shortest route:\n\n1. Run **Open welcome guide** and choose **Try the example question** for a working question and a review date.\n2. Run **Import questions from a file (PDF, PowerPoint, Word)** for a real unit, or write a question note in **Questions/**.\n3. Run **Open practice view** for filters and sessions, **Open Today** for the due queue, and **Open welcome guide → Choose modules** to match the plugin to your course load.\n4. Question notes are ordinary Markdown. **question_id**, **course**, **skill**, **answer**, and **question_type** live in properties; attempts and review dates are written back to the same note.\n5. The README has the full command, format, import, cards, calendar, and AI reference.\n\n## Power-user shortcuts\n\n- **Quick Practice from anywhere:** obsidian://mcq-tracker-quick?minutes=10&course=AP%20Biology. Use **minutes** 2, 5 or 10, or **count** 5, 10 or 20, not both. The course name must match the note's **course** property.\n- **Useful commands:** **Open practice view**, **Open Today**, **Quick Practice**, **Import questions from a file (PDF, PowerPoint, Word)**, **Open AP resources**, **Open AP score calculator**, **AP: import free-response questions from a PDF**, **AP: open free-response practice and grader**.\n- **Notes are the database:** default question notes are under **Questions/**; review state stays in their properties. Importers write ordinary notes, not a locked database.\n- **Optional integrations:** AnkiConnect, .apkg import/export, CouchDB sync, .ics calendars, Full Calendar notes, and AI through your own provider key. All are opt-in. Document-to-question import needs AI; the Quizlet, Kahoot, Moodle, QTI, GIFT, CSV, Markdown and .apkg importers are local.\n- **Markdown blocks:** mcq-quiz, quiz-maker, quizport, study-map, and mcq-dashboard are available if you prefer writing study material directly in notes. The README has the formats.\n- **Settings map:** **Global** has modules and about; **MCQ Tracker**, **Cards**, **Calendar**, **Assignments**, and **Reference** own their pages.\n\n## If something does not work\n\n- **The note did not open automatically:** open **MCQ Tracker Start here** in the left sidebar, or run **Open Start here note**.\n- **A command is missing:** the module may be off. Open **Settings → Global → Modules** and turn it on. Turning a module off hides its views; it does not delete notes.\n- **An import looks wrong:** the plugin previews imports. Cancel the preview and nothing is written.\n- **An import says to turn on AI:** that step is AI-only. PDF and document imports have no offline converter. Everything else here still works without AI.\n- **You need more detail:** open the [README](https://github.com/ifriedenson/mcq-tracker#readme) or the [website](https://ifriedenson.github.io/mcq-tracker/).\n\n## Make this guide better\n\nThis note is intentionally plain Markdown. If a step was unclear, edit it with what you needed to know, or send feedback. Clearer first-run instructions help the next student.\n\n- [Read the full README](https://github.com/ifriedenson/mcq-tracker#readme)\n- [Open the website](https://ifriedenson.github.io/mcq-tracker/)\n- [Send feedback](https://tally.so/r/PRDe1d)\n\nIt is safe to delete this note when you are done; **Open Start here note** will create it again if you want it back.\n";
}

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
  WELCOME_NOTE_PATH,
  WELCOME_PRESETS,
  WELCOME_SETUP_STEPS,
  WELCOME_EXAMPLE,
  WELCOME_STEPS,
  WELCOME_STORAGE_KEY,
  emptyWelcomeState,
  loadWelcomeState,
  markWelcomeSeen,
  markWelcomeStep,
  moduleSummary,
  normalizeWelcomeState,
  saveWelcomeState,
  welcomeNoteMarkdown,
  welcomeShouldShow,
};
