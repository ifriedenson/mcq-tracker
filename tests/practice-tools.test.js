"use strict";
/*
 * The Bluebook-style testing tools in the Practice view. The pure model is
 * covered first (catalogue, shortcuts, eliminator, zoom, timer, highlights,
 * question menu), then the same tools are driven through the real view.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom, NOTE_TEXT } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const pt = T.practiceTools;

const PASSAGE_NOTE = Object.assign({}, NOTE_TEXT("three", "B"));
const PASSAGE_TEXT = NOTE_TEXT("three", "B").replace("## Question", "## Passage\nA short passage for the line reader.\n\n## Question");

async function setup(options) {
  const opts = options || {};
  const notes = [
    { path: "Questions/one.md", fm: { answer: "B", choices: 4, skill: "grammar" } },
    { path: "Questions/two.md", fm: { answer: "A", choices: 4, skill: "vocab" } },
  ];
  if (opts.passage) notes.push({ path: "Questions/three.md", fm: { answer: "B", choices: 4 }, text: PASSAGE_TEXT });
  const app = makeApp(notes);
  const plugin = new QT(app);
  await plugin.onload();
  const dom = makeDom();
  const view = new T.PracticeView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  const first = opts.passage ? app.files[2] : app.files[0];
  await view.loadQuestion({ file: first, fm: first.fm }, true);
  view.render();
  return { app, plugin, dom, view };
}

const byClass = (dom, cls) => dom.all.filter((el) => el.classes.has(cls));

async function clickEl(el) {
  assert.ok(el, "the element exists");
  for (const handler of el.handlers.filter((item) => item.ev === "click")) await handler.fn({});
}

async function clickText(dom, text) {
  const el = dom.all.find((item) => item.meta && item.meta.text === text && item.handlers.some((h) => h.ev === "click"));
  assert.ok(el, `clickable element with text ${text}`);
  await clickEl(el);
}

function toolButton(dom, label) {
  return dom.all.find(
    (el) => el.classes.has("qt-tool-btn") && el.children.some((child) => child.meta && child.meta.text === label)
  );
}

/* --------------------------------------------------------------- the model */

test("practice tools: the drawer covers every tool College Board lists for Bluebook", () => {
  const ids = pt.BLUEBOOK_TOOLS.map((tool) => tool.id);
  assert.deepEqual(ids, [
    "timer",
    "eliminator",
    "highlights",
    "lineReader",
    "calculator",
    "reference",
    "review",
    "navigator",
    "zoom",
    "contrast",
    "expand",
    "help",
  ]);
  assert.equal(new Set(ids).size, ids.length, "ids are unique");
  for (const tool of pt.BLUEBOOK_TOOLS) {
    assert.ok(tool.label, `${tool.id} has a label`);
    assert.ok(tool.description.length > 20, `${tool.id} explains itself`);
    assert.ok(tool.icon, `${tool.id} has an icon`);
  }
  for (const row of pt.TOOL_SHORTCUTS) {
    assert.ok(
      pt.TOOL_IDS.includes(row.action) || /^zoom-/.test(row.action) || row.action === "line-reader",
      `${row.keys} targets a real action`
    );
    assert.ok(row.label, `${row.keys} is described`);
  }
  assert.ok(pt.SAT_REFERENCE_SHEET.length >= 5, "the reference sheet has formula groups");
  assert.ok(pt.PRACTICE_TOOL_DIRECTIONS.length >= 4, "the directions explain the tools");
});

test("practice tools: keyboard shortcuts match Bluebook without stealing plain keys", () => {
  const press = (extra) => pt.practiceToolShortcut(Object.assign({ key: "c" }, extra || {}));
  assert.equal(press({ ctrlKey: true, altKey: true }), "calculator");
  assert.equal(press({ metaKey: true, altKey: true }), "calculator");
  assert.equal(press({ ctrlKey: true, altKey: true, key: "r" }), "reference");
  assert.equal(press({ ctrlKey: true, altKey: true, key: "g" }), "navigator");
  assert.equal(press({ ctrlKey: true, altKey: true, key: "t" }), "timer");
  assert.equal(press({ ctrlKey: true, altKey: true, key: "v" }), "review");
  assert.equal(press({ ctrlKey: true, altKey: true, key: "o" }), "eliminator");
  assert.equal(press({ ctrlKey: true, altKey: true, shiftKey: true, key: "d" }), "help");
  assert.equal(press({ ctrlKey: true, key: "h" }), "highlights");
  assert.equal(press({ ctrlKey: true, key: "l" }), "line-reader");
  assert.equal(press({ ctrlKey: true, key: "+" }), "zoom-in");
  assert.equal(press({ ctrlKey: true, key: "-" }), "zoom-out");
  assert.equal(press({ ctrlKey: true, key: "0" }), "zoom-reset");
  assert.equal(pt.practiceToolShortcut({ key: "F1" }), "help");
  assert.equal(pt.practiceToolShortcut({ key: " " }), "");
  assert.equal(pt.practiceToolShortcut({ key: "Enter" }), "");
  assert.equal(pt.practiceToolShortcut({ key: "Escape" }), "");
});

test("practice tools: the option eliminator toggles, counts and clears", () => {
  const letters = new Set();
  assert.equal(pt.toggleEliminated(letters, "b"), true);
  assert.equal(pt.isEliminated(letters, "B"), true);
  assert.deepEqual(pt.eliminatedLetters(letters), ["B"]);
  assert.equal(pt.toggleEliminated(letters, "B"), false, "a second click brings it back");
  pt.toggleEliminated(letters, "A");
  pt.toggleEliminated(letters, "C");
  assert.deepEqual(pt.eliminatedLetters(letters), ["A", "C"]);
  assert.equal(pt.clearEliminated(letters), 2);
  assert.equal(letters.size, 0);
});

test("practice tools: zoom snaps to whole levels and the timer returns at five minutes", () => {
  assert.equal(pt.normalizeZoom(1000), 200);
  assert.equal(pt.normalizeZoom(10), 50);
  assert.equal(pt.normalizeZoom("nonsense"), 100);
  assert.equal(pt.zoomIn(100), 110);
  assert.equal(pt.zoomOut(100), 90);
  assert.equal(pt.zoomIn(200), 200);
  assert.equal(pt.zoomOut(50), 50);
  assert.equal(pt.zoomLabel(110), "110%");
  assert.equal(pt.shouldWarnFive(301, false), false);
  assert.equal(pt.shouldWarnFive(300, false), true);
  assert.equal(pt.shouldWarnFive(300, true), false, "the warning fires once");
  assert.equal(pt.shouldWarnFive(0, false), false);
  assert.equal(pt.shouldWarnFive(300, false, 300), false, "a five-minute session needs no five-minutes-left line");
  assert.equal(pt.shouldWarnFive(299, false, 360), true, "a longer session still warns once");
  assert.equal(pt.shouldWarnFive(300, true, 600), false, "the warning fires once");
  assert.equal(pt.timerVisible(true, 600), false, "a hidden timer stays hidden");
  assert.equal(pt.timerVisible(true, 200), true, "and returns for the last five minutes");
  assert.equal(pt.timerVisible(false, 600), true);
});

test("practice tools: highlights dedupe, take a note and paint without overlapping", () => {
  const list = [];
  const first = pt.addHighlight(list, { quote: "  the   cat ", color: "green", style: "underline", note: "first" });
  assert.equal(first.quote, "the cat");
  assert.equal(first.color, "green");
  assert.equal(first.style, "underline");
  const again = pt.addHighlight(list, { quote: "the cat", note: "second" });
  assert.equal(again.id, first.id, "the same text is one highlight");
  assert.equal(list.length, 1);
  assert.equal(again.note, "second");
  assert.equal(pt.updateHighlight(list, first.id, { color: "blue" }), true);
  assert.equal(list[0].color, "blue");
  assert.equal(pt.highlightsForSection(list, "stimulus").length, 0);
  assert.equal(pt.highlightsForSection(list, "question").length, 1);
  assert.equal(pt.removeHighlight(list, first.id), 1);
  assert.equal(list.length, 0);

  const ranges = pt.findQuoteRanges("the cat sat on the cat mat", ["the cat", "cat sat"]);
  assert.deepEqual(
    ranges.map((range) => [range.index, range.length]),
    [
      [0, 7],
      [15, 7],
    ],
    "overlapping quotes are trimmed to non-overlapping runs"
  );
  assert.ok(pt.quoteProbes("a".repeat(60)).length > 1, "long quotes get shorter probes");
});

test("practice tools: the question menu summarises answered, flagged and skipped", () => {
  const items = [
    { path: "a", number: 1, answered: true },
    { path: "b", number: 2, flagged: true },
    { path: "c", number: 3, current: true },
  ];
  assert.deepEqual(pt.navigatorSummary(items), { total: 3, answered: 1, flagged: 1, skipped: 1 });
  assert.deepEqual(
    pt.navigatorRows(items).map((row) => row.status),
    ["answered", "skipped", "current"]
  );
  assert.equal(pt.navigatorRows(items)[1].label, "Question 2");
});

/* ---------------------------------------------------------------- the view */

test("practice tools: the question view opens a drawer with every tool", async () => {
  const { dom } = await setup({ passage: true });
  // The desktop bar carries labelled buttons now; the first one opens the same
  // drawer the old tools toggle did.
  const open = byClass(dom, "qt-exam-tool")[0];
  assert.ok(open, "the bar carries a labelled tool button");
  await clickEl(open);
  await clickEl(open); // close the highlighter so the drawer shows its grid
  for (const tool of pt.BLUEBOOK_TOOLS) {
    assert.ok(dom.texts().includes(tool.label), `${tool.label} is offered`);
  }
});

test("practice tools: the eliminator crosses a choice out and blocks choosing it", async () => {
  const { dom, view } = await setup();
  view.runTool("eliminator");
  const path = view.current.file.path;
  await clickEl(byClass(dom, "qt-choice")[1]); // B
  assert.equal(pt.isEliminated(view.toolLetters(path), "B"), true);
  assert.equal(view.sel, "", "crossing out does not pick the option");
  assert.equal(byClass(dom, "qt-choice").filter((el) => el.classes.has("is-eliminated")).length, 1);

  view.runTool("eliminator"); // mode off
  await clickEl(byClass(dom, "qt-choice")[1]); // B is still crossed out
  assert.equal(view.sel, "", "a crossed-out choice cannot be selected");
  await clickEl(byClass(dom, "qt-choice")[2]); // C
  assert.equal(view.sel, "C");
});

test("practice tools: the calculator panel evaluates a local expression", async () => {
  const { dom, view } = await setup();
  view.runTool("calculator");
  view.calc.expression = "2+2";
  view.render();
  await clickText(dom, "=");
  assert.equal(view.calc.result, "4");
  assert.ok(dom.texts().includes("4"), "the result is shown");
  assert.equal(view.calc.error, "");
});

test("practice tools: a selection becomes a highlight that can be removed", async () => {
  const { dom, view } = await setup();
  view.toolSelection = { quote: "What is one?", section: "question" };
  view.runTool("highlights");
  await clickEl(byClass(dom, "qt-hl-bar-swatch")[0]);
  const list = view.toolHighlights(view.current.file.path);
  assert.equal(list.length, 1);
  assert.equal(list[0].quote, "What is one?");
  await clickEl(byClass(dom, "qt-hl-bar-trash").pop());
  assert.equal(view.toolHighlights(view.current.file.path).length, 0);
});

test("practice tools: timer, zoom, contrast, line reader and expanded passage reach the screen", async () => {
  const { dom, view } = await setup({ passage: true });
  const fresh = () => {
    dom.all.length = 0;
    view.render();
  };
  view.runTool("timer");
  fresh();
  assert.equal(view.timerHidden, true);
  assert.ok(byClass(dom, "qt-timer")[0].classes.has("is-hidden"), "the timer hides");

  view.runTool("zoom");
  fresh();
  assert.equal(view.zoom, 100);
  await clickText(dom, "+");
  fresh();
  assert.equal(view.zoom, 110);
  assert.equal(byClass(dom, "qt-split")[0].style.zoom, "110%");
  await clickText(dom, "Reset to 100%");
  assert.equal(view.zoom, 100);

  view.runTool("contrast");
  fresh();
  assert.ok(byClass(dom, "qt-split")[0].classes.has("qt-tools-contrast"));

  view.toolsOpen = true;
  fresh();
  await clickEl(toolButton(dom, "Line reader"));
  fresh();
  assert.equal(view.lineReader, true, "the tool button turns the line reader on");
  assert.equal(byClass(dom, "qt-line-reader").length, 1);

  view.runTool("expand");
  fresh();
  assert.ok(byClass(dom, "qt-split")[0].classes.has("qt-passage-expanded"));
});

test("practice tools: the question menu lists visited questions and jumps back", async () => {
  const { app, dom, view } = await setup();
  view.runTool("navigator");
  dom.all.length = 0;
  view.render();
  assert.equal(byClass(dom, "qt-nav-btn").length, 1, "the opened question is listed");

  await view.loadQuestion({ file: app.files[1], fm: app.files[1].fm }, false);
  view.toolsOpen = true;
  view.activeTool = "navigator";
  dom.all.length = 0;
  view.render();
  assert.equal(byClass(dom, "qt-nav-btn").length, 2);

  await clickEl(byClass(dom, "qt-nav-btn")[0]);
  assert.equal(view.current.file.path, "Questions/one.md", "the menu returns to the first question");
});

test("practice tools: directions list the shortcuts and F1 opens them", async () => {
  const { dom, view } = await setup();
  view.handlePracticeKey({ key: "F1", target: {}, preventDefault() {} });
  assert.ok(dom.texts().includes("Keyboard shortcuts"));
  for (const row of pt.TOOL_SHORTCUTS) assert.ok(dom.texts().includes(row.keys), `${row.keys} is listed`);
});

test("practice tools: the reference sheet shows the SAT formulas", async () => {
  const { dom, view } = await setup();
  view.runTool("reference");
  assert.ok(dom.texts().includes("A = πr²"));
  assert.ok(dom.texts().includes("a² + b² = c²"));
  assert.ok(dom.texts().includes("x = (−b ± √(b² − 4ac)) / 2a"));
});

void PASSAGE_NOTE;
