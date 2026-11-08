"use strict";
/*
 * The desktop Practice screen is laid out like the official testing app: a
 * section header with Directions, a centred timer, labelled tool buttons, a
 * number badge row, outlined answers whose cross-out control
 * sits outside the box, and a footer carrying the question pill and Back.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const pt = T.practiceTools;

const byClass = (dom, cls) => dom.all.filter((el) => el.classes.has(cls));
const labelOf = (el) => (el.children || []).map((child) => child.meta && child.meta.text).filter(Boolean).join(" ");

async function clickEl(el) {
  assert.ok(el, "the element exists");
  for (const handler of el.handlers.filter((item) => item.ev === "click")) await handler.fn({});
}

async function setup() {
  const app = makeApp([{ path: "Questions/one.md", fm: { answer: "B", choices: 4, skill: "grammar" } }]);
  const plugin = new QT(app);
  await plugin.onload();
  const dom = makeDom();
  const view = new T.PracticeView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  const file = app.files[0];
  await view.loadQuestion({ file, fm: file.fm }, true);
  view.render();
  return { app, plugin, dom, view };
}

test("practice chrome: the bar carries the section, Directions and the timer's Hide pill", async () => {
  const { dom } = await setup();
  assert.equal(byClass(dom, "qt-exam-id").length, 1, "the section block renders");
  assert.equal(byClass(dom, "qt-exam-title")[0].meta.text, "Section 1: Practice", "the header names the section");
  assert.equal(byClass(dom, "qt-exam-directions").length, 1, "Directions sits under the section");
  assert.equal(byClass(dom, "qt-exam-clock").length, 1, "the timer is centred in its own block");
  assert.equal(byClass(dom, "qt-timer-hide")[0].meta.text, "Hide");
  assert.equal(byClass(dom, "qt-test-banner").length, 0, "no practice-test ribbon sits under the bar");
  assert.deepEqual(
    byClass(dom, "qt-exam-tool").map(labelOf),
    ["Highlights & Notes", "Calculator", "Reference", "More"],
    "the labelled tool buttons read in order"
  );
});

test("practice chrome: a stored selection becomes a highlight that keeps a note", async () => {
  const { dom, view } = await setup();
  const path = view.current.file.path;
  view.toolsOpen = true;
  view.activeTool = "highlights";
  view.toolSelection = { quote: "Which organelle", section: "question" };
  view.render();
  assert.equal(view.readSelection(), null, "there is no document selection in this harness");
  const swatches = dom.all.filter((el) => el.classes.has("qt-hl-bar-swatch"));
  assert.equal(swatches.length, 4, "the toolbar offers its colours");
  await clickEl(swatches[0]);
  assert.equal(view.toolHighlights(path).length, 1, "the selection is stored as a highlight");
  assert.equal(view.toolHighlights(path)[0].quote, "Which organelle", "the quote is kept verbatim");
  const noteBtn = dom.all.filter((el) => el.classes.has("qt-hl-bar-note")).pop();
  await clickEl(noteBtn);
  const note = dom.all.filter((el) => el.classes.has("qt-hl-note")).pop();
  assert.ok(note, "the toolbar opens a note field");
  note.value = "powerhouses";
  for (const handler of note.handlers.filter((item) => item.ev === "input")) await handler.fn({});
  assert.equal(view.toolHighlights(path)[0].note, "powerhouses", "typing a note updates the stored highlight");
});

test("practice chrome: stored highlights paint inside every answer choice", async () => {
  const { view } = await setup();
  const path = view.current.file.path;
  view.current.sections.choices = [
    { letter: "A", text: "Nucleus" },
    { letter: "B", text: "Ribosome" },
    { letter: "C", text: "Golgi apparatus" },
    { letter: "D", text: "Mitochondrion" },
  ];
  const painted = [];
  const original = view.paintHighlights.bind(view);
  view.paintHighlights = (el, p, section) => {
    painted.push(el);
    return original(el, p, section);
  };
  view.render();
  const choiceTargets = painted.filter((el) => el.classes && el.classes.has("qt-choice-text"));
  assert.equal(choiceTargets.length, 4, "every choice's text is painted");
  assert.ok(painted.length >= 5, "the stem is still painted as well");
  assert.ok(view.toolHighlights(path).length === 0, "painting did not invent a highlight");
});

test("practice chrome: an existing highlight can be recoloured, restyled and removed", async () => {
  const { dom, view } = await setup();
  const path = view.current.file.path;
  view.toolsOpen = true;
  view.activeTool = "highlights";
  view.toolSelection = { quote: "Which organelle", section: "question" };
  view.render();
  await clickEl(dom.all.filter((el) => el.classes.has("qt-hl-bar-swatch"))[0]);
  assert.equal(view.toolHighlights(path)[0].color, "yellow", "the first highlight starts yellow");
  const dots = dom.all.filter((el) => el.classes.has("qt-hl-bar-swatch")).slice(-4);
  assert.equal(dots.length, 4, "the toolbar offers four colours");
  await clickEl(dots[2]); // yellow, green, blue, pink
  assert.equal(view.toolHighlights(path)[0].color, "blue", "clicking a chip recolours the stored highlight");
  const styles = dom.all.filter((el) => el.classes.has("qt-hl-bar-style"));
  await clickEl(styles[styles.length - 1]);
  assert.equal(view.toolHighlights(path)[0].style, "underline", "the underline control restyles the highlight");
  assert.equal(
    dom.all.filter((el) => el.classes.has("qt-hl-bar-style")).pop().classes.has("is-active"),
    true,
    "the control shows the underline state"
  );
  const trash = dom.all.filter((el) => el.classes.has("qt-hl-bar-trash")).pop();
  await clickEl(trash);
  assert.equal(view.toolHighlights(path).length, 0, "trash removes the highlight");
});

test("practice chrome: the badge row carries the number, Mark for Review, a rule and highlights", async () => {
  const { dom } = await setup();
  const head = byClass(dom, "qt-qhead")[0];
  assert.ok(head, "the question header row renders");
  const badge = byClass(dom, "qt-qnum")[0];
  assert.equal(badge.meta.text, "1", "the badge shows the question number");
  assert.ok(head.children.some((child) => child.classes.has("qt-qhead-rule")), "a rule separates the row");
  assert.ok(dom.texts().includes("Mark for Review"), "the flag reads as Mark for Review");
  assert.equal(byClass(dom, "qt-qhead-hl").length, 1, "the highlights button ends the row");
});

test("practice chrome: the outside control crosses a choice out and Undo brings it back", async () => {
  const { dom, view } = await setup();
  const path = view.current.file.path;
  assert.equal(byClass(dom, "qt-choice-mark").length, 4, "every choice has its own control");
  await clickEl(byClass(dom, "qt-choice-mark")[1]); // B
  assert.equal(pt.isEliminated(view.toolLetters(path), "B"), true, "the control crosses the choice out");
  assert.equal(view.sel, "", "crossing out does not pick the option");
  assert.ok(byClass(dom, "qt-choice-undo").length >= 1, "the Undo pill replaces the control");
  await clickEl(byClass(dom, "qt-choice-undo")[0]);
  assert.equal(pt.isEliminated(view.toolLetters(path), "B"), false, "Undo brings the choice back");
});

test("practice chrome: the footer carries the question pill and Back", async () => {
  const { dom, view } = await setup();
  const pill = byClass(dom, "qt-question-pill")[0];
  assert.ok(pill, "the question pill renders");
  assert.equal(labelOf(pill), "Question 1 of 1", "the pill names the position");
  const back = byClass(dom, "qt-foot-back")[0];
  assert.ok(back, "Back renders");
  assert.equal(back.disabled, true, "Back is disabled at the first question");
  assert.equal(view.backPath(), "", "there is nothing behind the first question");
});

test("practice chrome: the position helpers follow the session", async () => {
  const { view } = await setup();
  view.visited = [{ path: "a.md" }, { path: "b.md" }];
  view.current = { file: { path: "b.md" } };
  assert.equal(view.questionNumber(), 2, "the badge counts visited questions");
  assert.equal(view.questionTotal(), 2);
  assert.equal(view.backPath(), "a.md", "Back names the previous question");
  view.current = { file: { path: "a.md" } };
  assert.equal(view.backPath(), "", "no step back past the first question");
});

test("practice chrome: the More menu lists the tools the bar does not carry", async () => {
  const { dom, view } = await setup();
  view.moreOpen = true;
  view.render();
  const menu = byClass(dom, "qt-more-menu")[0];
  assert.ok(menu, "the menu renders when More is open");
  const labels = byClass(dom, "qt-more-item").map(labelOf);
  for (const label of ["Question menu", "Help", "Shortcuts", "Assistive technology", "Line reader", "Unscheduled break", "Exit the exam"]) {
    assert.ok(labels.includes(label), `${label} is in the menu`);
  }
});

test("practice chrome: the calculator carries a graphing tab that plots", async () => {
  const { dom, view } = await setup();
  view.runTool("calculator");
  view.calc.mode = "graphing";
  view.calc.expression = "x^2";
  view.render();
  assert.ok(dom.texts().includes("Graphing"), "the third calculator tab renders");
  assert.equal(byClass(dom, "qt-calc-graph").length, 1, "the plot area renders");
  assert.ok(dom.texts().some((text) => /^x from -10 to 10$/.test(text)), "the plot names its domain");
});

test("practice chrome: assistive technology lists the display switches", async () => {
  const { dom, view } = await setup();
  view.runTool("assistive");
  assert.deepEqual(byClass(dom, "qt-assist-label").map((el) => el.meta.text), [
    "Line reader",
    "Color contrast",
    "Expanded passage",
  ]);
  assert.equal(byClass(dom, "qt-assist-toggle").length, 3, "each switch carries a state");
});

test("practice chrome: an unscheduled break pauses the practice timer", async () => {
  const { dom, view, plugin } = await setup();
  view.runTool("break");
  assert.ok(dom.texts().some((text) => /unscheduled break/i.test(text)), "the break panel explains itself");
  await clickEl(dom.all.find((el) => el.classes.has("mod-cta") && el.meta && /break/i.test(el.meta.text || "")));
  assert.ok(view.breakStartedAt > 0, "the break records its start");
  assert.equal(plugin.isRunning(), false, "the practice timer stops");
});

test("practice chrome: the header names the section, not the skill", async () => {
  const { view } = await setup();
  assert.equal(view.sectionTitle(), "Section 1: Practice", "a note without a section still reads as a section");
  view.current.fm.section = "Math";
  assert.equal(view.sectionTitle(), "Section 1: Math");
  view.current.fm.section = "Reading and Writing";
  assert.equal(view.sectionTitle(), "Section 1: Reading and Writing");
  view.current.fm = { course: "AP Biology" };
  assert.equal(view.sectionName(), "AP Biology", "an unknown section keeps its own name");
});

test("practice chrome: the footer pill opens the question menu", async () => {
  const { dom, view } = await setup();
  await clickEl(byClass(dom, "qt-question-pill")[0]);
  assert.equal(view.navOpen, true, "the pill opens the menu");
  assert.ok(byClass(dom, "qt-question-nav")[0], "the menu renders above the footer");
  assert.equal(byClass(dom, "qt-question-nav-num").length, 1, "one number per question in the session");
  assert.equal(byClass(dom, "qt-question-nav-pin").length, 1, "the current question carries the pin");
  assert.deepEqual(byClass(dom, "qt-question-nav-key").map(labelOf), ["Current", "Unanswered", "For Review"]);
  await clickEl(byClass(dom, "qt-question-nav-go")[0]);
  assert.equal(view.state, "review", "Go to Review Page opens the review screen");
});

test("practice chrome: Check Your Work lists the session and finishes the module", async () => {
  const { dom, view } = await setup();
  view.goToReview();
  assert.equal(byClass(dom, "qt-review-title")[0].meta.text, "Check Your Work");
  assert.equal(byClass(dom, "qt-review-num").length, 1, "every session question is numbered");
  assert.deepEqual(byClass(dom, "qt-review-key").map(labelOf), ["Unanswered", "For Review"]);
  assert.equal(byClass(dom, "qt-review-num")[0].classes.has("is-answered"), false, "an unanswered question keeps the dashed box");
  view.finishReview();
  assert.equal(view.state, "moduleOver");
  assert.equal(byClass(dom, "qt-module-over-title")[0].meta.text, "This Module Is Over");
  assert.equal(byClass(dom, "qt-module-over-dots").length, 1, "the hand-off keeps a progress mark");
  view.leaveModuleOver();
  assert.equal(view.state, "idle", "the hand-off returns to the start screen");
});

test("practice chrome: an answered question fills its review number", async () => {
  const { dom, view } = await setup();
  view.answeredPaths.add(view.current.file.path);
  view.goToReview();
  assert.equal(byClass(dom, "qt-review-num")[0].classes.has("is-answered"), true, "an answered question fills in");
});
