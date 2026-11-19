// Whole-plugin drive for a real (headless) Obsidian window over CDP.
// Usage: node tools/full-drive/drive.mjs <phase>
// Phases: snapshot | commands | views | settings | practice | cards | notices
// Prints one JSON object. Errors are collected from uncaught exceptions,
// unhandled rejections, console.error and thrown command callbacks.
const PORT = Number(process.env.CDP_PORT || 9222);
const PHASE = process.argv[2] || "snapshot";

const VIEW_TYPES = [
  "question-tracker-view",
  "question-tracker-today",
  "question-tracker-insights",
  "question-tracker-test",
  "question-tracker-calendar",
  "question-tracker-cards",
  "question-tracker-reference",
  "question-tracker-assignments",
  "question-tracker-study-tools",
  "question-tracker-study-workspace",
  "question-tracker-review-calendar",
  "question-tracker-review-sidebar",
  "question-tracker-study-stats",
  "question-tracker-local-events",
  "question-tracker-pomodoro",
  "question-tracker-task-list",
  "question-tracker-web-browser",
  "question-tracker-recent-files",
  "question-tracker-agent",
  "question-tracker-table-controls",
];

const SETTINGS_PAGES = [
  "mcq-practice", "mcq-review", "mcq-daily", "note-review", "review-sidebar",
  "review-calendar", "study-stats", "mcq-about", "cards", "recall-scheduler",
  "retention", "scheduler-fit", "card-archive", "quiz-index", "calendar",
  "assignments", "pomodoro", "study-plan", "time-blocks", "local-events",
  "ap-exam", "reference", "reference-tools", "calculator", "periodic-table",
  "unit-converter", "equation-solver", "chemistry", "physics", "biology",
  "transcript", "lectures", "courses", "welcome",
  "global", "mcq-ai", "mcq", "practice-settings", "appearance", "data",
  "diagnostics", "backup", "sync", "mobile", "accessibility", "shortcuts",
  "agent", "chat", "quick-ask", "knowledge", "analytics", "dashboard",
  "web-browser", "tables", "pdf", "ocr", "epub", "audio", "anki", "cards-decks",
];

async function connect() {
  const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  const targets = await res.json();
  const app = targets.find((t) => t.type === "page" && t.url === "app://obsidian.md/index.html");
  if (!app) throw new Error("no Obsidian app window; have: " + targets.map((t) => t.url).join(", "));
  const ws = new WebSocket(app.webSocketDebuggerUrl);
  const pending = new Map();
  const events = [];
  let id = 1;
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    } else if (m.method) events.push(m);
  });
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", reject);
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const i = id++;
      pending.set(i, resolve);
      ws.send(JSON.stringify({ id: i, method, params }));
      setTimeout(() => pending.has(i) && (pending.delete(i), reject(new Error("cdp timeout " + method))), 180000);
    });
  return { send, events, close: () => ws.close() };
}

const consoleErrors = (events) =>
  events
    .filter((e) => e.method === "Runtime.exceptionThrown" || (e.method === "Runtime.consoleAPICalled" && e.params.type === "error"))
    .map((e) => {
      if (e.method === "Runtime.exceptionThrown") {
        const d = e.params.exceptionDetails || {};
        return { kind: "exception", text: (d.exception && d.exception.description) || d.text || "unknown" };
      }
      return { kind: "console.error", text: (e.params.args || []).map((a) => a.value || a.description || "").join(" ") };
    });

const { send, events, close } = await connect();
await send("Runtime.enable");
await send("Runtime.discardConsoleEntries").catch(() => {});
await send("Log.enable").catch(() => {});

async function evalJs(expression) {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r && r.result && r.result.exceptionDetails) {
    const d = r.result.exceptionDetails;
    throw new Error("evaluate failed: " + ((d.exception && d.exception.description) || d.text || "unknown").slice(0, 1200));
  }
  const ro = r && r.result && r.result.result;
  return ro && "value" in ro ? ro.value : ro;
}

const HELPERS = `
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const driveErrors = [];
window.addEventListener("error", (e) => driveErrors.push({ kind: "window.error", text: String(e.message || e.error || "error") }));
window.addEventListener("unhandledrejection", (e) => driveErrors.push({ kind: "unhandledrejection", text: String((e.reason && (e.reason.stack || e.reason.message)) || e.reason || "rejection") }));
const closeModals = async () => {
  for (let n = 0; n < 4; n++) {
    const open = Array.from(document.querySelectorAll(".modal-container"));
    if (!open.length) return;
    for (const c of open) {
      const x = c.querySelector(".modal-close-button, .modal-close, .qt-modal-close");
      if (x) x.click();
      else c.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    }
    await sleep(200);
  }
  for (const c of Array.from(document.querySelectorAll(".modal-container"))) {
    if (c && c.remove) c.remove();
  }
  await sleep(100);
};
`;

let result = null;

if (PHASE === "snapshot") {
  result = await evalJs(`(async () => {
    ${HELPERS}
    const p = app.plugins.getPlugin("mcq-tracker");
    const commands = Object.keys(app.commands.commands).filter((id) => id.startsWith("mcq-tracker:"));
    return { hasPlugin: !!p, enabled: !!app.plugins.enabled, version: p && p.manifest.version, commands: commands.length, views: ${JSON.stringify(VIEW_TYPES)}.length };
  })()`);
} else if (PHASE === "commands") {
  result = await evalJs(`(async () => {
    ${HELPERS}
    const realClick = HTMLInputElement.prototype.click;
    HTMLInputElement.prototype.click = function () {
      if (this && this.type === "file") { window.__driveFileClicks = (window.__driveFileClicks || 0) + 1; return; }
      return realClick.call(this);
    };
    const realOpen = window.open;
    window.open = () => null;
    const ids = Object.keys(app.commands.commands).filter((id) => id.startsWith("mcq-tracker:")).sort();
    const rows = [];
    for (const id of ids) {
      const before = driveErrors.length;
      let ok = true;
      let error = "";
      try { await Promise.resolve(app.commands.executeCommandById(id)); }
      catch (e) { ok = false; error = String((e && (e.stack || e.message)) || e).slice(0, 500); }
      await sleep(260);
      try { await closeModals(); } catch (e) { /* modal cleanup is best effort */ }
      const fresh = driveErrors.slice(before);
      rows.push({ id, ok, error, errors: fresh.slice(0, 3) });
    }
    HTMLInputElement.prototype.click = realClick;
    window.open = realOpen;
    return {
      total: rows.length,
      failed: rows.filter((r) => !r.ok || r.errors.length),
      filePickerClicks: window.__driveFileClicks || 0,
    };
  })()`);
} else if (PHASE === "views") {
  result = await evalJs(`(async () => {
    ${HELPERS}
    const rows = [];
    for (const type of ${JSON.stringify(VIEW_TYPES)}) {
      const before = driveErrors.length;
      let ok = true;
      let error = "";
      let textLength = 0;
      let leaf = null;
      try {
        leaf = app.workspace.getLeaf(true);
        await leaf.setViewState({ type, active: true });
        await sleep(700);
        const view = leaf.view;
        textLength = ((view && view.containerEl && view.containerEl.textContent) || "").replace(/\\s+/g, " ").trim().length;
      } catch (e) {
        ok = false;
        error = String((e && (e.stack || e.message)) || e).slice(0, 400);
      }
      const fresh = driveErrors.slice(before);
      rows.push({ type, ok, error, textLength, errors: fresh.slice(0, 2) });
      try { if (leaf) leaf.detach(); } catch (e) { /* leaf already gone */ }
      await sleep(120);
    }
    return { total: rows.length, failed: rows.filter((r) => !r.ok || r.errors.length || r.textLength < 20) };
  })()`);
} else if (PHASE === "settings") {
  result = await evalJs(`(async () => {
    ${HELPERS}
    const p = app.plugins.getPlugin("mcq-tracker");
    app.setting.open();
    app.setting.openTabById("mcq-tracker");
    await sleep(700);
    const tab = p.settingsTab;
    const root = tab && tab.containerEl;
    const rows = [];
    for (const page of ${JSON.stringify(SETTINGS_PAGES)}) {
      const before = driveErrors.length;
      let ok = true;
      let error = "";
      try {
        tab.openPage(page, { reveal: true });
        await sleep(220);
      } catch (e) {
        ok = false;
        error = String((e && (e.stack || e.message)) || e).slice(0, 400);
      }
      const textLength = ((root && root.textContent) || "").replace(/\\s+/g, " ").trim().length;
      const fresh = driveErrors.slice(before);
      rows.push({ page, ok, error, textLength, errors: fresh.slice(0, 2) });
    }
    const nav = Array.from(document.querySelectorAll(".vertical-tab-nav-item, .qt-settings-nav-item, .qt-settings-page"));
    return { total: rows.length, navControls: nav.length, empty: rows.filter((r) => r.textLength < 30), failed: rows.filter((r) => !r.ok || r.errors.length) };
  })()`);
} else if (PHASE === "practice") {
  result = await evalJs(`(async () => {
    ${HELPERS}
    const p = app.plugins.getPlugin("mcq-tracker");
    const path = "Drive practice/question.md";
    await app.vault.adapter.mkdir("Drive practice").catch(() => {});
    const text = [
      "---",
      "question_id: DRIVE-Q1",
      "number: 1",
      "source: drive",
      "question_type: mcq",
      "choices: 4",
      "answer: B",
      "---",
      "",
      "## Question",
      "What is 2 + 2?",
      "",
      "## Answer Choices",
      "- A. 3",
      "- B. 4",
      "- C. 5",
      "- D. 6",
      "",
      "## Answer",
      "> [!answer]- Reveal answer",
      "> **Correct Answer: B**",
      "> Two plus two is four.",
      "",
      "## My Notes",
      "",
    ].join("\\n");
    const existing = app.vault.getAbstractFileByPath(path);
    if (existing) await app.vault.modify(existing, text);
    else await app.vault.create(path, text);
    await sleep(600);
    const before = driveErrors.length;
    await p.practiceWith({}, "smart");
    await sleep(900);
    const leaf = app.workspace.getLeavesOfType("question-tracker-view")[0];
    const root = leaf && leaf.view && leaf.view.containerEl;
    const choice = root && root.querySelector(".qt-choice");
    const initial = {
      leaf: !!leaf,
      choices: root ? root.querySelectorAll(".qt-choice").length : 0,
      questionText: (root ? root.textContent : "").replace(/\\s+/g, " ").slice(0, 300),
    };
    let clicked = false;
    if (choice) { choice.click(); clicked = true; await sleep(1200); }
    const after = {
      text: (root ? root.textContent : "").replace(/\\s+/g, " ").slice(0, 500),
    };
    const note = app.vault.getAbstractFileByPath(path);
    const noteText = note ? await app.vault.read(note) : "";
    const frontmatter = noteText.split("---")[1] || "";
    return {
      initial,
      clicked,
      after,
      attempts: (frontmatter.match(/attempts: (\\d+)/) || [])[1],
      result: (frontmatter.match(/result: (\\S+)/) || [])[1],
      history: (frontmatter.match(/history: \\[[^\\]]*\\]/) || [""])[0].slice(0, 200),
      errors: driveErrors.slice(before).slice(0, 4),
    };
  })()`);
} else if (PHASE === "cards") {
  result = await evalJs(`(async () => {
    ${HELPERS}
    const p = app.plugins.getPlugin("mcq-tracker");
    const before = driveErrors.length;
    let opened = "";
    try { opened = app.commands.executeCommandById("mcq-tracker:study-skin"); await sleep(900); } catch (e) { opened = "ERR:" + String((e && e.message) || e); }
    const leaf = app.workspace.getLeavesOfType("question-tracker-cards")[0];
    const root = leaf && leaf.view && leaf.view.containerEl;
    return {
      opened,
      leaf: !!leaf,
      text: (root ? root.textContent : "").replace(/\\s+/g, " ").slice(0, 400),
      errors: driveErrors.slice(before).slice(0, 4),
    };
  })()`);
} else if (PHASE === "flows") {
  result = await evalJs(`(async () => {
    ${HELPERS}
    const p = app.plugins.getPlugin("mcq-tracker");
    const out = {};

    // ---- 1. practice one specific note, answer it, submit, read the note back
    await app.vault.adapter.mkdir("Drive practice").catch(() => {});
    const qPath = "Drive practice/question.md";
    const qText = [
      "---", "question_id: DRIVE-Q1", "number: 1", "source: drive",
      "question_type: mcq", "choices: 4", "answer: B", "---", "",
      "## Question", "What is 2 + 2?", "",
      "## Answer Choices", "- A. 3", "- B. 4", "- C. 5", "- D. 6", "",
      "## Answer", "> [!answer]- Reveal answer", "> **Correct Answer: B**", "> Two plus two is four.", "",
      "## My Notes", "",
    ].join("\\n");
    const existingQ = app.vault.getAbstractFileByPath(qPath);
    if (existingQ) await app.vault.modify(existingQ, qText);
    else await app.vault.create(qPath, qText);
    await sleep(700);
    const beforePractice = driveErrors.length;
    await p.practiceNote(qPath);
    await sleep(900);
    const leaf = app.workspace.getLeavesOfType("question-tracker-view")[0];
    const root = leaf && leaf.view && leaf.view.containerEl;
    const choices = root ? Array.from(root.querySelectorAll(".qt-choice")) : [];
    out.practice = { opened: !!leaf, choices: choices.length };
    // Pick the correct choice by its letter label, then Submit.
    const target = choices.find((c) => /(^|\\s)B(\\s|$)/.test(c.textContent) && /4|12/.test(c.textContent)) || choices[1] || choices[0];
    if (target) { target.click(); await sleep(600); }
    out.practice.afterPick = (root ? root.textContent : "").replace(/\\s+/g, " ").slice(0, 220);
    out.practice.selected = (root ? Array.from(root.querySelectorAll(".qt-choice.is-selected")).map((b) => b.textContent.trim().slice(0, 10)) : []);
    const conf = root ? Array.from(root.querySelectorAll(".qt-conf")).find((b) => /Confident/i.test(b.textContent)) : null;
    out.practice.confFound = !!conf;
    if (conf) { conf.click(); await sleep(400); }
    const submit = root ? Array.from(root.querySelectorAll("button")).find((b) => b.textContent.trim() === "Submit") : null;
    out.practice.submitDisabled = submit ? submit.disabled : null;
    out.practice.submitFound = !!submit;
    if (submit) { submit.click(); await sleep(1400); }
    const afterText = (root ? root.textContent : "").replace(/\\s+/g, " ");
    out.practice.correctShown = /Correct|Nice|Well done|\u2713/i.test(afterText);
    const note = app.vault.getAbstractFileByPath(qPath);
    const noteText = note ? await app.vault.read(note) : "";
    const fm = noteText.split("---")[1] || "";
    out.practice.attempts = Number((fm.match(/attempts: (\\d+)/) || [])[1] || 0);
    out.practice.result = (fm.match(/result: (\\S+)/) || [])[1] || "";
    out.practice.history = (fm.match(/history: \\[[^\\]]*\\]/) || [""])[0].slice(0, 300);
    out.practice.errors = driveErrors.slice(beforePractice).slice(0, 4);

    // ---- 2. whole-note review dialog renders its markdown with a Component
    const beforeReview = driveErrors.length;
    p.settings.noteReview = Object.assign({}, p.settings.noteReview, { enabled: true });
    await p.save();
    const reviewModal = p.openNoteReview();
    await sleep(1400);
    out.noteReview = reviewModal
      ? {
          opened: true,
          mdComponent: !!reviewModal.mdComponent,
          bodyText: (reviewModal.contentEl ? reviewModal.contentEl.textContent : "").replace(/\\s+/g, " ").slice(0, 250),
          errors: driveErrors.slice(beforeReview).filter((e) => /Component|renderMarkdown/i.test(e.text)),
        }
      : { opened: false };
    if (reviewModal) reviewModal.close();

    // ---- 3. a card can be added, shown, graded, and the grade is written back
    await app.vault.adapter.mkdir("Cards drive").catch(() => {});
    const cPath = "Cards drive/DRIVE-C1.md";
    const cText = ["---", "card_id: DRIVE-C1", "card_type: basic", "deck: Drive", "---", "", "## Front", "What is the capital of France?", "", "## Back", "Paris", ""].join("\\n");
    const existingC = app.vault.getAbstractFileByPath(cPath);
    if (existingC) await app.vault.modify(existingC, cText);
    else await app.vault.create(cPath, cText);
    await sleep(800);
    p.settings.cards = Object.assign({}, p.settings.cards, { enabled: true });
    await p.save();
    const beforeCards = driveErrors.length;
    try {
      await Promise.resolve(p.activateCards());
    } catch (e) { out.cardsOpenError = String((e && e.message) || e); }
    await sleep(1200);
    const cardLeaf = app.workspace.getLeavesOfType("question-tracker-cards")[0];
    const cardRoot = cardLeaf && cardLeaf.view && cardLeaf.view.containerEl;
    out.cards = { opened: !!cardLeaf, text: (cardRoot ? cardRoot.textContent : "").replace(/\\s+/g, " ").slice(0, 300) };
    const start = cardRoot ? Array.from(cardRoot.querySelectorAll("button")).find((b) => /Start review/i.test(b.textContent)) : null;
    if (start) { start.click(); await sleep(1200); }
    out.cards.startFound = !!start;
    const show = cardRoot ? Array.from(cardRoot.querySelectorAll("button")).find((b) => /Show answer/i.test(b.textContent)) : null;
    if (show) { show.click(); await sleep(900); }
    const good = cardRoot ? Array.from(cardRoot.querySelectorAll("button")).find((b) => /^Good/.test(b.textContent.trim())) : null;
    out.cards.showFound = !!show;
    out.cards.goodFound = !!good;
    if (good) { good.click(); await sleep(1200); }
    const cNote = app.vault.getAbstractFileByPath(cPath);
    const cNoteText = cNote ? await app.vault.read(cNote) : "";
    const cFm = cNoteText.split("---")[1] || "";
    out.cards.reps = (cFm.match(/reps: (\\S+)/) || [])[1] || "";
    out.cards.history = (cFm.match(/history: \\[[^\\]]*\\]/) || [""])[0].slice(0, 300);
    out.cards.errors = driveErrors.slice(beforeCards).slice(0, 4);

    return out;
  })()`);
} else if (PHASE === "notices") {
  result = await evalJs(`(async () => {
    const notices = Array.from(document.querySelectorAll(".notice")).map((n) => n.textContent);
    return { notices };
  })()`);
} else {
  throw new Error("unknown phase " + PHASE);
}

await new Promise((r) => setTimeout(r, 200));
const errors = consoleErrors(events).filter((e) => !/DevTools|Autofill|Electron Security/i.test(e.text));
close();
console.log(JSON.stringify({ phase: PHASE, result, consoleErrors: errors.slice(0, 25) }, null, 2));
process.exit(0);
