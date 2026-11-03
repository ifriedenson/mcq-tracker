"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const FA = T.feynmanAi;
const PI = T.pdfAnnotationIndex;
const PA = T.pdfAnnotations;

async function setup(saved) {
  const plugin = new QT(makeApp([]));
  if (saved) plugin.saved = saved;
  await plugin.onload();
  return plugin;
}

test("feynman ai: builds a rubric request only for an explanation with answers", () => {
  const session = {
    id: "feynman-1",
    topic: "Osmosis",
    course: "Biology",
    answers: { explain: "Water moves to the saltier side.", gaps: "", simplify: "", teach: "" },
  };
  assert.equal(FA.hasFeynmanAnswers(session), true);
  assert.equal(FA.hasFeynmanAnswers({ answers: {} }), false);
  const request = FA.buildFeynmanScoreRequest(session);
  assert.match(request.system, /JSON only/);
  assert.match(request.user, /Concept: Osmosis/);
  assert.match(request.user, /Course: Biology/);
  assert.match(request.user, /Water moves to the saltier side/);
  assert.equal(request.user.includes("Step 2"), false);
  assert.equal(FA.buildFeynmanScoreRequest({ topic: "Osmosis", answers: {} }), null);
  assert.equal(FA.buildFeynmanScoreRequest({ answers: { explain: "x" } }), null);
});

test("feynman ai: parses strict JSON, clamps scores and rejects damaged replies", () => {
  const parsed = FA.parseFeynmanScoreReply('```json\n{"clarity":9,"accuracy":4,"simplicity":2.6,"feedback":"  Clear   start. Add a limit.  "}\n```');
  assert.deepEqual(parsed.scores, { clarity: 5, accuracy: 4, simplicity: 3 });
  assert.equal(parsed.feedback, "Clear start. Add a limit.");
  assert.equal(parsed.average, 4);
  assert.throws(() => FA.parseFeynmanScoreReply("no json here"), /did not return JSON/);
  assert.throws(() => FA.parseFeynmanScoreReply('{"clarity":5,"accuracy":4}'), /did not score simplicity/);
  assert.throws(() => FA.parseFeynmanScoreReply("{oops}"), /malformed JSON/);
  assert.equal(FA.feynmanAiAverage({ clarity: 5, accuracy: 4, simplicity: 3 }), 4);
  assert.equal(FA.feynmanAiAverage({}), 0);
});

test("feynman ai: merges beside the manual score and never replaces it", () => {
  const session = { id: "feynman-2", topic: "Osmosis", scores: { clarity: 3, accuracy: 3, simplicity: 3 }, answers: { explain: "x" } };
  const merged = FA.mergeFeynmanAiResult(session, { scores: { clarity: 5, accuracy: 2, simplicity: 4 }, feedback: "Good start." }, 42);
  assert.deepEqual(merged.scores, session.scores);
  assert.deepEqual(merged.aiScores, { clarity: 5, accuracy: 2, simplicity: 4 });
  assert.equal(merged.aiAverage, 3.7);
  assert.equal(merged.aiFeedback, "Good start.");
  assert.equal(merged.aiScoredAt, 42);
  assert.equal(FA.mergeFeynmanAiResult({}, { scores: {} }, 1), null);
});

test("pdf annotation index: collects sidecars, groups by PDF and reports damage", () => {
  const one = PA.serializeAnnotationFile(
    "Papers/biology.pdf",
    "hash123",
    [
      { page: 2, type: "highlight", color: "yellow", quote: "ATP is the energy currency." },
      { page: 1, type: "note", color: "blue", note: "Compare with mitochondria." },
    ]
  );
  const empty = PA.serializeAnnotationFile("Papers/empty.pdf", "h", []);
  const broken = "```mcq-pdf-annotations\n{not json}\n```";
  const result = PI.collectPdfAnnotations(
    [
      { path: "Papers/biology.annotations.md", text: one },
      { path: "Papers/empty.annotations.md", text: empty },
      { path: "Papers/broken.annotations.md", text: broken },
      { path: "Papers/notes.md", text: one },
    ],
    { limit: 100 }
  );
  assert.equal(result.stats.files, 1);
  assert.equal(result.stats.pdfs, 1);
  assert.equal(result.stats.annotations, 2);
  assert.equal(result.stats.pages, 2);
  assert.deepEqual(result.stats.byType, { highlight: 1, note: 1 });
  assert.equal(result.issues.length, 1);
  assert.match(result.issues[0], /broken\.annotations\.md/);
  assert.deepEqual(result.rows.map((row) => row.page), [1, 2]);
  assert.equal(result.rows[0].sidecarPath, "Papers/biology.annotations.md");
  assert.equal(result.rows[0].pdfPath, "Papers/biology.pdf");
  assert.match(result.rows[1].summary, /ATP is the energy currency/);
  const limited = PI.collectPdfAnnotations([{ path: "Papers/biology.annotations.md", text: one }], { limit: 1 });
  assert.equal(limited.rows.length, 1);
  assert.equal(limited.stats.shown, 1);
  assert.equal(limited.stats.annotations, 2);
  const filtered = PI.collectPdfAnnotations([{ path: "Papers/biology.annotations.md", text: one }], { folder: "Other" });
  assert.equal(filtered.rows.length, 0);
});

test("pdf annotation index: settings clamp and normalize", () => {
  const settings = PI.normalizePdfAnnotationIndexSettings({ folder: "/Papers/", limit: 9999 });
  assert.equal(settings.folder, "Papers");
  assert.equal(settings.limit, 500);
  assert.equal(PI.normalizePdfAnnotationIndexSettings({}).limit, 200);
  assert.equal(PI.normalizePdfAnnotationIndexSettings({ enabled: false }).enabled, false);
});

test("pdf annotation index: page deep links are safe and only cover PDFs", () => {
  assert.equal(PI.pdfPageSubpath("Papers/biology.pdf", 12), "Papers/biology.pdf#page=12");
  assert.equal(PI.pdfPageLink("Papers/biology.pdf", 12), "[[Papers/biology.pdf#page=12]]");
  assert.equal(PI.pdfPageLink("/Papers/biology.pdf", 2.6), "[[Papers/biology.pdf#page=3]]");
  assert.equal(PI.pdfPageLink("Papers/notes.md", 2), "");
  assert.equal(PI.pdfPageLink("Papers/biology.pdf", 0), "");
  assert.equal(PI.pdfPageLink("Papers/biology.pdf", -3), "");
  assert.equal(PI.pdfPageLink("Papers/biology.pdf", 100001), "");
  assert.equal(PI.pdfPageLink("", 4), "");
  assert.equal(PI.pdfPageLink("Papers/a|b.pdf", 1), "[[Papers/ab.pdf#page=1]]");
  assert.equal(PI.pdfPageLink("Papers/bi#o.pdf", 1), "[[Papers/bio.pdf#page=1]]");
});

test("pdf annotation index: a row copies and opens its page deep link", async () => {
  const app = makeApp([]);
  const sidecar = PA.serializeAnnotationFile("Papers/biology.pdf", "h", [{ page: 4, type: "highlight", color: "yellow", quote: "Energy." }]);
  app.vault.getMarkdownFiles = () => [{ path: "Papers/biology.annotations.md", text: sidecar }];
  app.vault.cachedRead = async (file) => file.text;
  const opened = [];
  app.workspace.openLinkText = (path) => opened.push(path);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.pdfAnnotationIndex = { enabled: true, folder: "", limit: 200 };
  const view = new T.StudyWorkspaceView({ app }, plugin);
  const dom = makeDom();
  view.contentEl = dom.root;
  view.tab = "pdfAnnotations";
  view.pdfAnnotationData = await plugin.getPdfAnnotationIndex();
  view.render();
  assert.ok(dom.texts().some((text) => text === "Copy page link"));
  await dom.click("Open at page 4");
  assert.deepEqual(opened, ["Papers/biology.pdf#page=4"]);

  const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const copied = [];
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { clipboard: { writeText: async (text) => copied.push(text) } } });
  try {
    await dom.click("Copy page link");
  } finally {
    if (original) Object.defineProperty(globalThis, "navigator", original);
    else delete globalThis.navigator;
  }
  assert.deepEqual(copied, ["[[Papers/biology.pdf#page=4]]"]);
});

test("plugin: AI feedback is stored beside the manual score and clears without losing it", async () => {
  const plugin = await setup();
  const session = await plugin.addFeynmanSession({ topic: "Osmosis", course: "Biology" });
  assert.ok(session);
  await plugin.updateFeynmanSession(session.id, {
    step: 4,
    completed: true,
    answers: { explain: "Water crosses to the saltier side.", gaps: "No limit.", simplify: "Like a sponge.", teach: "Water follows salt." },
    scores: { clarity: 4, accuracy: 3, simplicity: 2 },
  });
  plugin.aiComplete = async (system, user) => {
    assert.match(system, /Feynman/);
    assert.match(user, /Osmosis/);
    return '{"clarity":5,"accuracy":4,"simplicity":3,"feedback":"Clear. Name the membrane."}';
  };
  const scored = await plugin.scoreFeynmanSessionAi(session.id);
  assert.deepEqual(scored.scores, { clarity: 4, accuracy: 3, simplicity: 2 });
  assert.deepEqual(scored.aiScores, { clarity: 5, accuracy: 4, simplicity: 3 });
  assert.equal(scored.aiAverage, 4);
  assert.equal(scored.aiFeedback, "Clear. Name the membrane.");
  const restarted = new QT(makeApp([]));
  restarted.saved = plugin.saved;
  await restarted.onload();
  const reloaded = restarted.studyWorkspaceSettings().feynmanLearning.sessions[0];
  assert.deepEqual(reloaded.aiScores, { clarity: 5, accuracy: 4, simplicity: 3 });
  assert.deepEqual(reloaded.scores, { clarity: 4, accuracy: 3, simplicity: 2 });
  await restarted.clearFeynmanAiFeedback(session.id);
  const cleared = restarted.studyWorkspaceSettings().feynmanLearning.sessions[0];
  assert.equal(cleared.aiScores, null);
  assert.equal(cleared.aiFeedback, "");
  assert.deepEqual(cleared.scores, { clarity: 4, accuracy: 3, simplicity: 2 });
});

test("plugin: a failed AI reply leaves the stored session untouched", async () => {
  const plugin = await setup();
  const session = await plugin.addFeynmanSession({ topic: "Mitosis", answers: { explain: "Cells divide." } });
  plugin.aiComplete = async () => "not json";
  await assert.rejects(() => plugin.scoreFeynmanSessionAi(session.id), /did not return JSON/);
  const stored = plugin.studyWorkspaceSettings().feynmanLearning.sessions[0];
  assert.equal(stored.aiScores, null);
});

test("plugin: the PDF annotation index reads sidecars without writing anything", async () => {
  const app = makeApp([]);
  const sidecar = PA.serializeAnnotationFile("Papers/biology.pdf", "h", [{ page: 1, type: "highlight", color: "yellow", quote: "Energy." }]);
  const files = [
    { path: "Papers/biology.annotations.md", text: sidecar },
    { path: "Papers/reading.md", text: sidecar },
  ];
  app.vault.getMarkdownFiles = () => files;
  app.vault.cachedRead = async (file) => file.text;
  let writes = 0;
  app.vault.create = async () => {
    writes += 1;
    return { path: "unexpected.md" };
  };
  const plugin = new QT(app);
  await plugin.onload();
  const result = await plugin.getPdfAnnotationIndex();
  assert.equal(result.stats.annotations, 1);
  assert.equal(result.rows[0].pdfPath, "Papers/biology.pdf");
  assert.equal(writes, 0);
});

test("study modules: the two new switches persist and gate the workspace", async () => {
  const plugin = await setup({ feynmanAi: { enabled: false }, pdfAnnotationIndex: { enabled: false } });
  assert.equal(plugin.feynmanAiEnabled(), false);
  assert.equal(plugin.pdfAnnotationIndexEnabled(), false);
  for (const key of ["feynmanLearning", "recallScheduler", "lerntracker", "studyFlow", "subjectManager", "quizIndex", "courseHub", "studyTasks", "annotations", "deepNotes", "retention", "vocabulary", "readAloud", "lectureCompiler", "courseHealth", "audioBookmarks", "feynmanAi", "pdfAnnotationIndex", "readingLibrary"]) {
    plugin.settings[key].enabled = false;
  }
  assert.equal(plugin.studyWorkspaceEnabled(), false);
});

test("study workspace view: AI feedback and PDF annotation tabs render", async () => {
  const dom = makeDom();
  const plugin = await setup();
  const view = new T.StudyWorkspaceView({ app: plugin.app }, plugin);
  view.contentEl = dom.root;
  view.render();
  const texts = () => dom.texts().join(" ");
  assert.match(texts(), /AI feedback/);
  assert.match(texts(), /PDF annotations/);
  view.setTab("feynmanAi");
  assert.match(texts(), /Feynman AI feedback/);
  view.setTab("pdfAnnotations");
  assert.match(texts(), /Scan annotations/);
});
