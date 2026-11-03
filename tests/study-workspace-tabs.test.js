"use strict";
/* Every Study Workspace tab is mounted through the view's own dispatch, then
   driven the way a person drives it: fill the form, press the button, follow
   the saved row, delete it and land back on the documented empty state. */
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT, obsidian } = load();

/** Mount `tab` and expose the nodes the latest render produced. */
async function mount(tab, notes = []) {
  const app = makeApp(notes);
  const plugin = new QT(app);
  await plugin.onload();
  const dom = makeDom();
  const view = new T.StudyWorkspaceView({ app }, plugin);
  view.contentEl = dom.root;

  let renderStart = 0;
  const render = view.render.bind(view);
  view.render = () => {
    renderStart = dom.all.length;
    return render();
  };

  view.tab = tab;
  view.render();
  assert.equal(view.tab, tab, `the ${tab} tab is the mounted one`);

  const current = () => dom.all.slice(renderStart);
  const texts = () => current().map((node) => node.meta && node.meta.text).filter((text) => typeof text === "string");
  const insideForm = (node) => {
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (parent.classes && parent.classes.has("qt-study-form")) return true;
    }
    return false;
  };
  const field = (tag, index) => {
    const found = current().filter((node) => node.meta && node.meta.tag === tag && insideForm(node));
    assert.ok(found[index], `${tag}[${index}] is rendered in a form`);
    return found[index];
  };
  const anyField = (tag, index) => {
    const found = current().filter((node) => node.meta && node.meta.tag === tag);
    assert.ok(found[index], `${tag}[${index}] is rendered`);
    return found[index];
  };
  const click = async (label) => {
    const hits = current().filter(
      (node) => node.meta && node.meta.text === label && node.handlers.some((handler) => handler.ev === "click")
    );
    assert.ok(hits.length, `"${label}" is clickable`);
    for (const handler of hits[hits.length - 1].handlers.filter((entry) => entry.ev === "click")) await handler.fn({});
  };

  return { app, plugin, dom, view, current, texts, field, anyField, click };
}

const futureDate = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

test("Feynman: the form creates a cycle, a step saves the answer, rows select and delete", async () => {
  const { plugin, view, texts, field, anyField, click } = await mount("feynman");
  assert.ok(texts().includes("Start a Feynman cycle"));
  assert.ok(texts().includes("No Feynman cycles yet. Start with one concept you can explain in your own words."));

  field("input", 0).value = "Photosynthesis";
  field("input", 1).value = "Biology";
  await click("Start cycle");

  assert.equal(plugin.settings.feynmanLearning.sessions.length, 1, "the cycle is persisted");
  const first = plugin.settings.feynmanLearning.sessions[0];
  assert.equal(first.topic, "Photosynthesis");
  assert.equal(first.course, "Biology");
  assert.equal(first.step, 0);
  assert.ok(texts().includes("Step 1: Explain it simply"), "the active card opens on step one");

  anyField("textarea", 0).value = "Plants turn light into sugar.";
  await click("Next step");
  assert.equal(plugin.settings.feynmanLearning.sessions[0].step, 1, "the step is saved");
  assert.deepEqual(
    Object.values(plugin.settings.feynmanLearning.sessions[0].answers).filter(Boolean),
    ["Plants turn light into sugar."]
  );
  assert.ok(texts().some((text) => text.startsWith("Biology · Step 2 of 4")), "the row summarises the cycle");

  await plugin.addFeynmanSession({ topic: "Respiration", course: "Biology" });
  view.render();
  assert.ok(texts().includes("Respiration"), "the second cycle is listed");
  const second = plugin.settings.feynmanLearning.sessions.find((session) => session.topic === "Respiration");
  await click("Review");
  assert.equal(view.feynmanId, second.id, "Review opens the cycle that is not active");

  await click("Delete");
  assert.equal(plugin.settings.feynmanLearning.sessions.length, 1, "the clicked row is gone");
  await click("Delete");
  assert.equal(plugin.settings.feynmanLearning.sessions.length, 0);
  assert.ok(
    texts().includes("No Feynman cycles yet. Start with one concept you can explain in your own words."),
    "deleting the last cycle returns the empty state"
  );
});

test("Deep Notes: the prompts save, the row summarises and delete clears the tab", async () => {
  const { plugin, view, texts, field, anyField, click } = await mount("deepNotes");
  assert.ok(texts().includes("Start a guided Socratic session"));
  assert.ok(texts().includes("No Deep Notes sessions yet. Start with one idea you want to interrogate."));

  field("input", 0).value = "Natural selection";
  field("input", 1).value = "Biology";
  await click("Start session");

  assert.equal(plugin.settings.deepNotes.sessions.length, 1);
  const session = plugin.settings.deepNotes.sessions[0];
  assert.equal(session.topic, "Natural selection");
  assert.ok(texts().includes("Step 1 of 5"), "the first prompt is active");

  anyField("textarea", 0).value = "Variation plus inheritance plus selection.";
  await click("Next prompt");
  assert.equal(plugin.settings.deepNotes.sessions[0].step, 1, "the answer advances the session");
  assert.ok(texts().some((text) => text.startsWith("Biology · Step 2 of 5")));

  await plugin.addDeepNotesSession({ topic: "Speciation", course: "Biology" });
  view.render();
  const later = plugin.settings.deepNotes.sessions.find((entry) => entry.topic === "Speciation");
  await click("Review");
  assert.equal(view.deepNotesId, later.id, "Review opens the session that is not active");

  await click("Delete");
  await click("Delete");
  assert.equal(plugin.settings.deepNotes.sessions.length, 0);
  assert.ok(
    texts().includes("No Deep Notes sessions yet. Start with one idea you want to interrogate."),
    "the empty state comes back"
  );
});

test("Annotations: a quote is captured, the source opens and delete clears the index", async () => {
  const { app, plugin, texts, field, click } = await mount("annotations", [
    { path: "Biology/Cells.md", text: "# Cells\n\nMitochondria make ATP.\n" },
  ]);
  assert.ok(texts().includes("Capture a selection"));

  await click("Add annotation");
  assert.ok(texts().includes("Add a quote first."), "an empty quote is refused in place");
  assert.equal(plugin.settings.annotations.annotations.length, 0);

  field("input", 0).value = "Biology/Cells.md";
  field("textarea", 0).value = "Mitochondria make ATP.";
  field("textarea", 1).value = "Why is that useful?";
  field("textarea", 2).value = "It powers the cell.";
  await click("Add annotation");

  assert.equal(plugin.settings.annotations.annotations.length, 1);
  const saved = plugin.settings.annotations.annotations[0];
  assert.equal(saved.quote, "Mitochondria make ATP.");
  assert.equal(saved.sourcePath, "Biology/Cells.md");
  assert.ok(texts().includes("Biology/Cells.md"), "the row names its source");
  assert.ok(texts().includes("Q: Why is that useful?"));
  assert.ok(texts().includes("A: It powers the cell."));

  await click("Open source");
  assert.deepEqual(app.opened, ["Biology/Cells.md"], "Open source navigates without touching the note");

  await click("Delete");
  assert.equal(plugin.settings.annotations.annotations.length, 0);
  assert.ok(
    texts().includes("No annotations yet. Capture a passage and the question it raised; the source note is never modified."),
    "the empty state explains the next step"
  );
});

test("Courses: a grade builds the dashboard, Overview opens the course and delete empties it", async () => {
  const { plugin, texts, field, click } = await mount("courses");
  assert.ok(texts().includes("Add a course grade"));

  field("input", 0).value = "Biology";
  field("input", 1).value = "Midterm";
  field("input", 2).value = "85";
  field("input", 3).value = "1";
  await click("Add grade");

  assert.equal(plugin.settings.courseHub.grades.length, 1);
  assert.equal(plugin.settings.courseHub.grades[0].score, 85);
  assert.ok(texts().includes("Biology"), "the course card appears");
  assert.ok(texts().includes("Midterm · 85%"), "the grade row summarises the entry");

  const opened = [];
  plugin.openCourseOverview = (courseId) => opened.push(courseId);
  await click("Overview");
  assert.deepEqual(opened, ["Biology"], "Overview reaches the course it belongs to");

  await click("Delete");
  assert.equal(plugin.settings.courseHub.grades.length, 0);
  assert.ok(texts().includes("Add a grade or a subject to build the course dashboard."), "the empty state returns");
});

test("Topic planner: a plan is created, passes and topics change, delete restores the empty state", async () => {
  const { plugin, view, texts, field, click } = await mount("planner");
  assert.ok(texts().includes("New topic plan"));

  await click("Create plan");
  assert.ok(texts().includes("Add a course and an exam date first."), "an empty plan is refused");
  assert.equal(plugin.settings.lerntracker.plans.length, 0);

  obsidian.notices.length = 0;
  await click("Use exam topics");
  assert.ok(
    obsidian.notices.some((note) => note.includes("No matching exam topics found")),
    "a click with no matching exam says so without wiping the form"
  );

  field("input", 0).value = "Biology";
  field("input", 1).value = futureDate(30);
  field("textarea", 0).value = "Cell structure\nRespiration";
  await click("Create plan");

  assert.equal(plugin.settings.lerntracker.plans.length, 1);
  const plan = plugin.settings.lerntracker.plans[0];
  assert.equal(plan.course, "Biology");
  assert.equal(plan.topics.length, 2);
  assert.ok(texts().includes("0 / 3 passes"), "the topic row shows its progress");

  await click("+1 pass");
  assert.equal(
    plugin.settings.lerntracker.plans[0].topics.reduce((sum, topic) => sum + topic.passes, 0),
    1,
    "the clicked row records exactly one pass"
  );

  await click("Remove");
  assert.equal(plugin.settings.lerntracker.plans[0].topics.length, 1, "the topic row is removed");

  await click("Delete plan");
  assert.equal(plugin.settings.lerntracker.plans.length, 0);
  assert.ok(
    texts().includes("No topic plans yet. Add an exam date and a few topics to get a day-by-day allocation."),
    "the empty state returns"
  );
  assert.equal(view.planId, "");
});

test("Recall: the queue builds from the vault, ratings persist and the queue completes", async () => {
  const { plugin, view, texts, click } = await mount("recall", [
    {
      path: "Biology/Cells.md",
      text: "# Cells\n\n## Mitochondria\n\nMitochondria make ATP.\n\n## Ribosome\n\nRibosomes make protein.\n",
    },
  ]);
  assert.ok(texts().includes("Build a recall queue"));
  assert.ok(texts().includes("Choose a mode and build a queue. Only units that are due now are included."));

  await click("Build queue");
  assert.ok(view.recallBuilt, "the queue is built");
  assert.ok(view.recallQueue.length >= 2, "the headings became units");
  assert.ok(texts().some((text) => text.startsWith("Heading 1 of")), "the first unit is shown");

  const total = view.recallQueue.length;
  for (let index = 0; index < total; index++) {
    await click("Reveal");
    await click("Good");
  }
  assert.equal(Object.keys(plugin.settings.recallScheduler.reviews).length, total, "every rating is stored");
  assert.ok(texts().includes("Queue complete"), "the queue ends in its own state");

  await click("Build queue");
  assert.ok(texts().includes("No due recall units in that scope."), "nothing is due straight after rating");
});

test("Quiz index: the scan lists quizzes, a row opens its note and an empty scope says so", async () => {
  const block = [
    "```mcq-quiz",
    "Id: biology-1",
    "Q: Which gas do plants take in?",
    "A. Oxygen",
    "B. Carbon dioxide",
    "Answer: B",
    "```",
  ].join("\n");
  const { plugin, view, texts, field, click } = await mount("quizIndex", [
    { path: "Biology/Quiz.md", noFm: true, text: "# Quiz\n\n" + block + "\n" },
  ]);
  assert.ok(texts().includes("Quiz index"));
  assert.ok(texts().includes("Scan the vault to build the quiz index."));

  await click("Scan vault");
  assert.ok(view.quizIndexData, "the scan stored its result");
  assert.equal(view.quizIndexData.stats.quizzes, 1);
  assert.equal(view.quizIndexData.stats.questions, 1);
  assert.ok(texts().includes("biology-1 · 1 question"), "the index row summarises the quiz");
  assert.ok(texts().includes("Biology/Quiz.md"), "the row names its note");

  const opened = [];
  plugin.openStudyFlowSource = (path) => opened.push(path);
  await click("Open note");
  assert.deepEqual(opened, ["Biology/Quiz.md"], "Open note reaches the row's note");

  field("input", 0).value = "Nope";
  await click("Scan vault");
  assert.equal(view.quizIndexData.stats.quizzes, 0);
  assert.ok(texts().includes("No inline quizzes were found in that scope."), "an empty scope says so");
});
