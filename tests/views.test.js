"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");
const { T, Plugin: QT } = load();

const day = "2026-10-20T10:00";
const NOTES = [
  { path: "Questions/sat/Q1.md", fm: { skill: "grammar", domain: "Conventions", difficulty: "hard", attempts: 6, correct_count: 2, time_spent_total: 300, result: "incorrect", last_error_type: "careless", "date attempted": day, history: ["d|incorrect|50|A|1|careless"], answer: "B" } },
  { path: "Questions/sat/sub/Q2.md", fm: { skill: "vocab", domain: "Words", difficulty: "medium", attempts: 4, correct_count: 4, time_spent_total: 120, result: "correct", answer: "C" } },
  { path: "Questions/other/Q3.md", fm: { skill: "grammar", domain: "Conventions", difficulty: "easy", answer: "D" } },
  { path: "Questions/other/Q4.md", fm: { skill: "logic", domain: "Words", difficulty: "easy", answer: "A", result: "incorrect", "date attempted": day } },
];

async function setup() {
  const app = makeApp(NOTES);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.calls = [];
  plugin.practiceWith = async (f, m) => plugin.calls.push([f, m]);
  plugin.activateView = async () => ({});
  plugin.activateInsights = async () => {};
  plugin.activateTest = async () => {};
  const dom = makeDom();
  return { app, plugin, dom };
}
function makeView(Cls, plugin, app, dom) {
  const v = new Cls({ app }, plugin);
  v.app = app;
  v.contentEl = dom.root;
  return v;
}

test("practice result: shows the source and lets a miss reread the exact page", async () => {
  const { app, plugin, dom } = await setup();
  const file = app.files.find((f) => f.path === "Questions/sat/Q1.md");
  file.fm.source_pdf = "Papers/Exam.pdf";
  file.fm.source_page = 4;
  let opened = null;
  plugin.openSource = async (fm, path) => {
    opened = { fm, path };
    return true;
  };
  const v = makeView(T.PracticeView, plugin, app, dom);
  v.state = "result";
  v.result = {
    file,
    correct: false,
    chosen: "A",
    key: "B",
    mode: "mcq",
    seconds: 12,
    summary: { streak: 0, correctCount: 2, attempts: 6, nextReview: "tomorrow" },
    errorType: "",
    flagged: false,
    sections: T.parseSections(file.text),
    fm: file.fm,
    conf: 1,
  };
  v.render();
  assert.ok(dom.texts().includes("Source"));
  assert.ok(dom.texts().some((text) => /Exam\.pdf · page 4/.test(text)));
  await dom.click("Reread this");
  assert.equal(opened.path, "Questions/sat/Q1.md");
  assert.equal(opened.fm.source_page, 4);
});

test("practice view: shows and clears the practice-this-note-only banner", async () => {
  const { app, plugin, dom } = await setup();
  plugin.settings.practicePath = "Questions/sat/Q1.md";
  const v = makeView(T.PracticeView, plugin, app, dom);
  v.render();
  assert.ok(dom.texts().includes("Practising only Q1"));
  await dom.click("Practice all notes");
  assert.equal(plugin.settings.practicePath, "");
});

test("weak spots: shows the weakest skill and starts practising it", async () => {
  const { app, plugin, dom } = await setup();
  const v = makeView(T.InsightsView, plugin, app, dom);
  v.render();
  assert.ok(dom.texts().includes("Practice my weakest skill: grammar"));
  await dom.click("Practice my weakest skill: grammar");
  assert.deepEqual(plugin.calls.at(-1), [{ skill: ["grammar"] }, "smart"]);
  for (const field of ["Domain", "Difficulty", "Folder", "Skill"]) {
    await dom.click(field);
    v.render();
  }
  await dom.click("Practice");
  assert.equal(plugin.calls.at(-1)[1], "smart");
});

test("error log: groups misses and starts practising a group", async () => {
  const { app, plugin, dom } = await setup();
  const v = makeView(T.InsightsView, plugin, app, dom);
  v.tab = "errors";
  v.render();
  assert.ok(dom.texts().includes("careless"));
  assert.ok(dom.texts().includes("No reason picked"));
  await dom.click("Practice these (1)");
  assert.deepEqual(plugin.calls.at(-1), [{ last_error_type: ["careless"] }, "missed"]);
  await dom.click("Practice all missed");
  assert.deepEqual(plugin.calls.at(-1), [{}, "missed"]);
});

test("insights overview: shows the study heatmap, course time and weak skills", async () => {
  const { app, plugin, dom } = await setup();
  plugin.settings.studyLog = {
    sessions: [
      { date: "2026-10-27", minutes: 40, course: "sat" },
      { date: "2026-10-28", minutes: 25, course: "sat" },
    ],
    dailyGoalMinutes: 60,
  };
  const v = makeView(T.InsightsView, plugin, app, dom);
  v.tab = "overview";
  v.render();
  const texts = dom.texts();
  assert.ok(texts.includes("Overview"));
  assert.ok(texts.includes("Study heatmap"));
  assert.ok(texts.includes("Study time by course"));
  assert.ok(texts.includes("Confidence calibration"));
  assert.ok(texts.includes("Retention trend"));
  assert.ok(texts.includes("Weak spots"));
  assert.ok(texts.includes("Study today"));
  assert.ok(texts.some((t) => /65 logged minutes/.test(t)));
  assert.ok(texts.some((t) => /sat/.test(t)));
  await dom.click("Domain");
  assert.ok(dom.texts().includes("Domain breakdown"));
  await dom.click("Weak spots");
  assert.equal(v.tab, "weak");
});

test("weak spots and error log have friendly empty states", async () => {
  const app = makeApp([{ path: "Q/a.md", fm: {} }]);
  const plugin = new QT(app);
  await plugin.onload();
  const dom = makeDom();
  const v = makeView(T.InsightsView, plugin, app, dom);
  v.render();
  assert.ok(dom.texts().some((t) => /none attempted yet/.test(t)));
  v.tab = "errors";
  v.render();
  assert.ok(dom.texts().some((t) => /No missed questions yet/.test(t)));
});

test("timed test: builds a test, scores it, logs only the answered questions, and reviews", async () => {
  const { app, plugin, dom } = await setup();
  plugin.recorded = [];
  plugin.recordAttempt = async (file, a) => plugin.recorded.push([file.basename, a.correct, a.chosen, a.conf]);
  plugin.setErrorType = async (file, type) => plugin.recorded.push(["error", file.basename, type]);
  const v = makeView(T.TestView, plugin, app, dom);
  v.render(); // setup screen
  await v.begin(3, 5, "random");
  assert.equal(v.phase, "test");
  assert.equal(v.items.length, 3);
  assert.equal(v.allowedSeconds, 300);
  v.render();
  v.go(1);
  v.go(2);
  // answer two of the three: first correct, second wrong
  const keyOf = (it) => it.key;
  v.items[0].sel = keyOf(v.items[0]);
  v.items[1].sel = keyOf(v.items[1]) === "A" ? "B" : "A";
  v.items[0].flagged = true;
  let asked = 0;
  plugin.askConfirm = async () => (asked++, true);
  await v.tryFinish();
  assert.equal(asked, 1); // one blank question
  assert.equal(v.phase, "review");
  assert.equal(v.result.total, 3);
  assert.equal(v.result.answered, 2);
  assert.equal(v.result.correct, 1);
  assert.equal(v.result.sections.length, 1);
  assert.deepEqual([v.result.sections[0].correct, v.result.sections[0].total], [1, 3]);
  assert.equal(plugin.recorded.length, 2);
  assert.ok(plugin.recorded.every((r) => r[3] === 0)); // no confidence rating in a test
  assert.equal(v.items[2].correct, null);
  // review in every filter, with the details open
  for (const label of ["All", "Missed", "Marked", "Blank"]) {
    await dom.click(label);
    v.items.forEach((_x, i) => v.expanded.add(i));
    v.render();
  }
  v.filter = "all";
  v.render();
  const missed = v.items.findIndex((it) => it.answered && !it.correct);
  assert.ok(missed >= 0);
  await dom.click("careless");
  assert.deepEqual(plugin.recorded.at(-1), ["error", v.items[missed].file.basename, "careless"]);
});

test("timed test: sections split the questions and run their own timers", async () => {
  const { app, plugin, dom } = await setup();
  plugin.recordAttempt = async () => {};
  const v = makeView(T.TestView, plugin, app, dom);
  await v.begin(4, 10, "random", { from: 1, to: 4, sections: [
    { name: "Reading", count: 2, minutes: 4 },
    { name: "Writing", count: 2, minutes: 6 },
  ] });
  assert.equal(v.phase, "test");
  assert.deepEqual(v.sections.map((s) => [s.name, s.count, s.start, s.end]), [
    ["Reading", 2, 0, 2],
    ["Writing", 2, 2, 4],
  ]);
  assert.deepEqual(v.items.map((it) => it.section), [0, 0, 1, 1]);
  assert.equal(v.allowedSeconds, 600);
  v.render();
  assert.equal(v.navBtns.length, 2, "only the current section is in the number bar");
  assert.ok(v.timerEl, "the section timer is on screen");
  v.sections[0].endAt = Date.now() - 1000;
  v.tick();
  assert.equal(v.sectionIdx, 1);
  assert.equal(v.idx, 2);
  assert.equal(v.phase, "test");
  v.items[0].sel = v.items[0].key;
  v.items[2].sel = v.items[2].key;
  await v.finish(false);
  assert.deepEqual(v.result.sections.map((s) => [s.name, s.correct, s.total]), [
    ["Reading", 1, 2],
    ["Writing", 1, 2],
  ]);
  assert.ok(dom.texts().includes("By section"));
});

test("timed test: confidence ratings are stored and reported", async () => {
  const { app, plugin, dom } = await setup();
  plugin.recorded = [];
  plugin.recordAttempt = async (file, a) => plugin.recorded.push([file.basename, a.correct, a.chosen, a.conf]);
  const v = makeView(T.TestView, plugin, app, dom);
  await v.begin(3, 5, "random");
  v.items[0].sel = v.items[0].key;
  v.items[0].conf = 3;
  v.items[1].sel = v.items[1].key === "A" ? "B" : "A";
  v.items[1].conf = 1;
  plugin.askConfirm = async () => true;
  await v.tryFinish();
  assert.deepEqual(plugin.recorded.map((entry) => entry[3]), [3, 1]);
  assert.equal(v.result.confidence.rated, 2);
  assert.equal(v.result.confidence.levels[2].total, 1);
  assert.equal(v.result.confidence.levels[2].correct, 1);
  assert.equal(v.result.confidence.levels[0].total, 1);
  assert.equal(v.result.confidence.levels[0].correct, 0);
  assert.ok(v.result.avgSeconds >= 0);
  assert.ok(dom.texts().includes("Confidence calibration"));
});

test("timed test: the setup screen can add sections and saves blueprints", async () => {
  const { app, plugin, dom } = await setup();
  const v = makeView(T.TestView, plugin, app, dom);
  v.render();
  assert.ok(dom.texts().includes("Sections"));
  assert.ok(dom.texts().includes("Add section"));
  assert.ok(dom.texts().includes("Save blueprint"));
  await dom.click("Add section");
  assert.equal(v.sectionsDraft.length, 2);
  assert.equal(v.sectionsDraft.reduce((sum, section) => sum + section.count, 0), 20);
});

test("timed test: cancelling the 'finish with blanks' question keeps the test going", async () => {
  const { app, plugin, dom } = await setup();
  const v = makeView(T.TestView, plugin, app, dom);
  await v.begin(2, 3, "random");
  plugin.askConfirm = async () => false;
  await v.tryFinish();
  assert.equal(v.phase, "test");
});

test("timed test: the clock running out ends the test", async () => {
  const { app, plugin, dom } = await setup();
  plugin.recordAttempt = async () => {};
  const v = makeView(T.TestView, plugin, app, dom);
  await v.begin(2, 3, "random");
  v.deadline = Date.now() - 1000;
  v.tick();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(v.phase, "review");
  assert.equal(v.result.timeUp, true);
});

test("timed test: with nothing matching, it stays on the setup screen", async () => {
  const { app, plugin, dom } = await setup();
  plugin.settings.filters = { skill: ["does-not-exist"] };
  const v = makeView(T.TestView, plugin, app, dom);
  obsidian.notices.length = 0;
  await v.begin(2, 3, "random");
  assert.equal(v.phase, "setup");
  assert.match(obsidian.notices.at(-1), /No questions with an answer key/);
});

test("practice view: filters show counts, and the folder filter can switch to a search box", async () => {
  const { app, plugin, dom } = await setup();
  const v = makeView(T.PracticeView, plugin, app, dom);
  v.state = "idle";
  v.render();
  const texts = dom.texts();
  assert.ok(texts.includes("Folder"));
  assert.ok(texts.includes("Questions/sat") || texts.includes("sat")); // relative or full path
  assert.ok(texts.includes("Search")); // switch to the search box
  assert.ok(texts.includes("Timed test"));
  assert.ok(texts.includes("Weak spots & errors"));
  await dom.click("Search");
  assert.equal(plugin.settings.folderFilterStyle, "search");
  v.render();
  assert.ok(dom.texts().includes("Show buttons"));
  await dom.click("Show buttons");
  assert.equal(plugin.settings.folderFilterStyle, "buttons");
});

test("quick practice: offers a setup screen and starts a time-limited session", async () => {
  const { app, plugin, dom } = await setup();
  const v = makeView(T.PracticeView, plugin, app, dom);
  v.startQuickSetup();
  assert.ok(dom.texts().includes("Quick Practice"));
  await dom.click("Start Quick Practice");
  assert.equal(v.state, "question");
  assert.equal(v.quickSession.kind, "time");
  assert.equal(v.quickSession.paths.length, 4);
  assert.equal(plugin.settings.quickSession.index, 0);
});

test("quick practice: serializes, resumes, and pauses a session without spending paused time", () => {
  const { buildQuickQueue, createQuickSession, packQuickSession, pauseQuickSession, quickRemainingSeconds, unpackQuickSession, resumeQuickSession } = T;
  const items = [{ file: { path: "Q/a.md" } }, { file: { path: "Q/b.md" } }];
  const session = createQuickSession(items, { kind: "time", value: 2, mode: "smart" }, 100000);
  assert.deepEqual(session.paths, ["Q/a.md", "Q/b.md"]);
  assert.equal(quickRemainingSeconds(session, 100000), 120);
  pauseQuickSession(session, 110000);
  assert.equal(quickRemainingSeconds(session, 200000), 110);
  const saved = packQuickSession(session);
  const restored = unpackQuickSession(saved, 200000);
  assert.equal(restored.runningSince, 0);
  resumeQuickSession(restored, 200000);
  assert.equal(quickRemainingSeconds(restored, 200000), 110);
  assert.equal(buildQuickQueue(items, "random", "2026-10-27", 5).length, 2);
});

test("practice view: a folder filter that no longer holds notes is marked", async () => {
  const { app, plugin, dom } = await setup();
  plugin.settings.filters = { folder: ["Old/renamed"] };
  const v = makeView(T.PracticeView, plugin, app, dom);
  v.render();
  assert.ok(dom.all.some((o) => o.meta && o.meta.cls === "qt-fchip" && o.meta.tag === "button"));
});

test("folder search suggestions match any part of the path and exclude chosen ones", async () => {
  const { app } = await setup();
  const picked = [];
  const input = { value: "typed" };
  const opts = [{ value: "Questions/sat", count: 2 }, { value: "Questions/other", count: 2 }, { value: "/", count: 1 }];
  const s = new T.FolderFilterSuggest(app, input, () => opts, (v) => picked.push(v), "Questions");
  assert.deepEqual(s.getSuggestions("SAT").map((o) => o.value), ["Questions/sat"]);
  assert.equal(s.getSuggestions("").length, 3);
  s.close = () => {};
  s.selectSuggestion(opts[1]);
  assert.deepEqual(picked, ["Questions/other"]);
  assert.equal(input.value, "");
});

test("find by ID lists official ids and opens the chosen note", async () => {
  const { app, plugin } = await setup();
  app.files[0].fm.official_question_id = "37e5c794";
  const m = new T.FindQuestionModal(app, plugin);
  m.app = app;
  const items = m.getItems();
  assert.equal(items.length, 4);
  assert.match(m.getItemText(items[0]), /37e5c794/);
  m.onChooseItem(items[0]);
  await new Promise((r) => setTimeout(r, 5));
  assert.deepEqual(app.opened, ["Questions/sat/Q1.md"]);
});

test("practice a folder: the picker lists folders with note counts", async () => {
  const { app, plugin } = await setup();
  const picked = [];
  const m = new T.QuestionFolderModal(app, plugin, (f) => picked.push(f));
  const items = m.getItems();
  assert.ok(items.some((o) => o.value === "Questions/sat" && o.count === 2));
  assert.match(m.getItemText(items.find((o) => o.value === "Questions/sat")), /\(2\)/);
  m.onChooseItem(items[0]);
  assert.equal(picked.length, 1);
});

test("import done screen: duplicates can be trashed, and problem notes are listed", async () => {
  const { app, plugin, dom } = await setup();
  const modal = Object.create(T.PdfImportModal.prototype);
  modal.app = app;
  modal.plugin = plugin;
  modal.contentEl = dom.root;
  modal.close = () => {};
  const r = {
    made: 2,
    ai: 0,
    noAnswer: 0,
    skipped: [],
    images: 0,
    ids: [],
    dupes: [{ path: "Questions/other/Q3.md", id: "zzz", other: "Questions/sat/Q1.md" }, { path: "", id: "skip1", other: "Questions/sat/Q1.md", skipped: true }],
    issues: [{ path: "Questions/other/Q4.md", problems: ["No answer", "Missing figure"] }],
  };
  modal.showAgentDone(r, "Questions/other");
  const t = dom.texts();
  assert.ok(t.includes("Created 2 notes"));
  assert.ok(t.some((x) => /Skipped 1 already in your vault/.test(x)));
  assert.ok(t.some((x) => /repeats a question you already have/.test(x)));
  assert.ok(t.some((x) => /Needs a look \(1 note\)/.test(x)));
  assert.ok(t.includes("No answer (1)"));
  assert.ok(t.includes("Practice all 2 notes in this folder"));
  await dom.click(/Move the 1 repeat to the trash/);
  assert.deepEqual(app.trashed, ["Questions/other/Q3.md"]);
  assert.equal(r.made, 1);
  assert.equal(r.dupes.length, 1);
});

test("timed test: closing Obsidian mid-test saves it, and reopening picks it up", async () => {
  const { app, plugin, dom } = await setup();
  const v = makeView(T.TestView, plugin, app, dom);
  await v.begin(3, 10, "random");
  v.items[0].sel = "A";
  v.items[0].conf = 3;
  v.items[1].flagged = true;
  v.go(1);
  assert.ok(plugin.saved.testSession, "the test in progress is saved");
  assert.equal(plugin.saved.testSession.items.length, 3);
  assert.equal(plugin.saved.testSession.items[0].sel, "A");
  assert.equal(plugin.saved.testSession.idx, 1);
  const saved = JSON.parse(JSON.stringify(plugin.saved.testSession));
  await v.onClose();

  // a fresh window, as after restarting Obsidian
  const dom2 = makeDom();
  const v2 = makeView(T.TestView, plugin, app, dom2);
  plugin.settings.testSession = saved;
  obsidian.notices.length = 0;
  await v2.onOpen();
  assert.equal(v2.phase, "test");
  assert.equal(v2.items.length, 3);
  assert.equal(v2.items[0].sel, "A");
  assert.equal(v2.items[0].conf, 3);
  assert.equal(v2.items[1].flagged, true);
  assert.equal(v2.idx, 1);
  assert.equal(v2.deadline, saved.deadline);
  assert.match(obsidian.notices.at(-1), /Picked your timed test back up/);
});

test("timed test: a test whose time ran out while Obsidian was closed is marked on reopening", async () => {
  const { app, plugin, dom } = await setup();
  plugin.recorded = [];
  plugin.recordAttempt = async (file, a) => plugin.recorded.push([file.basename, a.chosen]);
  const v = makeView(T.TestView, plugin, app, dom);
  await v.begin(2, 5, "random");
  v.items[0].sel = "A";
  await v.persist();
  plugin.settings.testSession.deadline = Date.now() - 60000; // ran out a minute ago
  const v2 = makeView(T.TestView, plugin, app, makeDom());
  await v2.onOpen();
  assert.equal(v2.phase, "review");
  assert.equal(v2.result.timeUp, true);
  assert.equal(plugin.recorded.length, 1);
  assert.equal(plugin.settings.testSession, null);
});

test("timed test: finishing clears the saved test, and a stale or broken one is ignored", async () => {
  const { app, plugin, dom } = await setup();
  plugin.recordAttempt = async () => {};
  const v = makeView(T.TestView, plugin, app, dom);
  await v.begin(2, 5, "random");
  assert.ok(plugin.settings.testSession);
  v.items[0].sel = "A";
  v.items[1].sel = "B";
  await v.finish(false);
  assert.equal(plugin.settings.testSession, null);
  assert.equal(plugin.saved.testSession, null);

  plugin.settings.testSession = { v: 1, items: [{ path: "Gone/note.md", sel: "A" }], deadline: Date.now() + 60000, startedAt: Date.now(), allowedSeconds: 60 };
  const v2 = makeView(T.TestView, plugin, app, makeDom());
  await v2.onOpen();
  assert.equal(v2.phase, "setup", "a test whose notes are all gone isn't resumed");
  assert.equal(plugin.settings.testSession, null);
});

test("weak spots: shows the weekly chart and trend text once there is history", async () => {
  const daysAgo = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T09:00`;
  };
  const history = [...[20, 21, 22, 23].map((n) => `${daysAgo(n)}|incorrect|5|A|3|`), ...[1, 2, 3].map((n) => `${daysAgo(n)}|correct|5|A|3|`)];
  const app = makeApp([{ path: "Q/a.md", fm: { skill: "grammar", attempts: 7, correct_count: 3, time_spent_total: 70, history } }]);
  const plugin = new QT(app);
  await plugin.onload();
  const dom = makeDom();
  const v = makeView(T.InsightsView, plugin, app, dom);
  v.render();
  const t = dom.texts();
  assert.ok(t.includes("Accuracy by week"));
  assert.ok(t.some((x) => /up 100 points in the last 2 weeks/.test(x)), t.join(" | "));
});

test("timed test: opens the way Obsidian opens a tab (view.open) and shows the setup screen, not a blank tab", async () => {
  const { app, plugin, dom } = await setup();
  const v = makeView(T.TestView, plugin, app, dom);
  assert.equal(typeof v.open, "function", "TestView must not shadow View.open()");
  await v.open(dom.root);
  assert.ok(dom.texts().includes("Timed test"), "the setup screen should be drawn");
  assert.ok(dom.texts().includes("Start the test"));
  await v.close();
});

test("views never shadow Obsidian's built-in View methods (a shadowed open() leaves a blank tab)", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const reserved = ["open", "close", "load", "unload", "onload", "onunload", "onOpen", "onClose", "getViewType", "getDisplayText", "getIcon", "getState", "setState", "addChild", "removeChild", "addAction", "scope", "navigation", "containerEl", "contentEl", "titleEl", "headerEl", "actionsEl", "leaf", "app"];
  const dir = path.join(__dirname, "..", "src");
  for (const f of ["exam-view.js", "practice-view.js", "insights-view.js"]) {
    const src = fs.readFileSync(path.join(dir, f), "utf8");
    for (const name of reserved) {
      const re = new RegExp(`this\\.${name}\\s*=(?!=)`);
      if (f !== "x" && re.test(src) && !["leaf", "app", "contentEl"].includes(name)) assert.fail(`${f} assigns this.${name}, which shadows Obsidian's View.${name}`);
    }
  }
});

test("timed test: an optional question range restricts the pool before picking", async () => {
  const { app, plugin, dom } = await setup();
  const v = makeView(T.TestView, plugin, app, dom);
  await v.begin(2, 5, "random", { from: 2, to: 3 });
  assert.equal(v.phase, "test");
  assert.equal(v.items.length, 2);
  assert.deepEqual(
    v.items.map((it) => it.file.path).sort(),
    ["Questions/other/Q3.md", "Questions/sat/sub/Q2.md"],
    "only questions 2 and 3 were eligible"
  );
  assert.equal(T.sliceQuestionRange(["a", "b", "c", "d"], 2, 3).join(""), "bc");
  assert.equal(T.sliceQuestionRange(["a", "b", "c"], 2, 0).join(""), "bc", "an empty end means the last question");
  assert.deepEqual(T.sliceQuestionRange(["a", "b"], 3, 4), []);
});
