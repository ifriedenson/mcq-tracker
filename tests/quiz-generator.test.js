"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");
const pdfFixtures = require("./helpers/pdfjs-recording");
const providerReplies = require("./fixtures/anthropic-quiz-replies.json");

// src/pdf.js captures loadPdfJs when the bundle loads. The recording is the
// real PDF.js text layer for the adjacent PDF fixture, so the test follows the
// same production readPdfPages path as Obsidian instead of parsing PDFs again.
const pdfRuntime = pdfFixtures.createRecordedPdfJs();
obsidian.loadPdfJs = async () => pdfRuntime;

const { T, Plugin: QT } = load();
const G = T.quizGenerator;

function note(path, text, fm) {
  return { file: { path, basename: path.replace(/^.*\//, "").replace(/\.md$/, "") }, fm: fm || {}, text };
}

function addPdf(app, path, bytes) {
  const file = new obsidian.TFile();
  file.path = path;
  file.name = path.replace(/^.*\//, "");
  file.basename = file.name.replace(/\.pdf$/i, "");
  file.extension = "pdf";
  file.buffer = Buffer.from(bytes);
  app.files.push(file);
  return file;
}

function enableAi(plugin) {
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "api";
  plugin.settings.ai.api.provider = "anthropic";
  plugin.settings.ai.api.keys.anthropic = "sk-test";
  plugin.settings.ai.api.model = "claude-sonnet-4-5";
}

function questionReply(question) {
  return JSON.stringify({
    questions: [{ question: question || "What is ATP?", choices: ["Energy currency", "DNA", "Lipid", "Sugar"], answer: "A", explanation: "ATP carries energy." }],
  });
}

function changeField(dom, label, value) {
  const field = dom.field(label);
  assert.ok(field, `the dialog has a ${label} field`);
  field.value = value;
  const own = field.__own || field;
  const handlers = (own.handlers || []).filter((entry) => entry.ev === "change");
  assert.ok(handlers.length, `the ${label} field has a change handler`);
  for (const handler of handlers) handler.fn({});
}

function openQuizModal(plugin) {
  const modal = plugin.openQuizGenerator();
  assert.ok(modal, "the real generator modal opens");
  const dom = makeDom();
  modal.modalEl = dom.root;
  modal.contentEl = dom.root;
  modal.onOpen();
  return { modal, dom };
}

test("quiz generator: offers 22 languages and normalises settings", () => {
  assert.equal(G.QUIZ_LANGUAGES.length, 22);
  const config = G.normalizeQuizGenerator({ folders: [" Notes/ ", ""], count: 99, language: "Klingon", types: ["multi", "nope"] });
  assert.deepEqual(config.folders, ["Notes"]);
  assert.equal(config.count, 20);
  assert.equal(config.language, "English");
  assert.deepEqual(config.types, ["multi"]);
});

test("quiz generator: collects chosen folders and excludes question/card notes", () => {
  const sources = G.collectGeneratorSources(
    [
      note("Notes/Bio/ATP.md", "ATP is energy currency."),
      note("Notes/Bio/Q.md", "question note", { question_id: "Q1" }),
      note("Other/Bio.md", "not selected"),
      note("Notes/Empty.md", "   "),
    ],
    { folders: ["Notes"], maxNotes: 5 }
  );
  assert.deepEqual(sources.titles, ["ATP"]);
  assert.match(sources.text, /ATP is energy currency/);
  assert.equal(sources.count, 1);
});

test("quiz generator: prompt names the language, count, allowed types and source", () => {
  const prompt = G.buildQuizGeneratorPrompt({ text: "Cells use ATP.", titles: ["ATP"], count: 3, language: "Spanish", types: ["mcq", "true_false"] });
  assert.match(prompt.user, /Output language: Spanish/);
  assert.match(prompt.user, /Write 3 quiz questions/);
  assert.match(prompt.user, /true_false/);
  assert.match(prompt.user, /Cells use ATP/);
  assert.match(prompt.system, /Spanish/);
});

test("quiz generator: local retrieval ranks focused passages and reports its budget", () => {
  const sources = G.collectGeneratorSources(
    [
      note("Notes/Photo.md", "Photosynthesis converts light into sugar in the chloroplast."),
      note("Notes/ATP.md", "ATP is the energy currency of the cell and is regenerated during respiration."),
    ],
    { folders: ["Notes"], focus: "ATP energy currency", maxChars: 500, maxNotes: 1 }
  );
  assert.equal(sources.retrieval.mode, "local-passages");
  assert.equal(sources.retrieval.query, "ATP energy currency Photo ATP");
  assert.match(sources.text, /ATP is the energy currency/);
  assert.doesNotMatch(sources.text, /chloroplast/);
  assert.equal(sources.retrieval.passages, 1);
  assert.ok(sources.chars <= 500);
});

test("quiz generator: the prompt carries an optional focus topic", () => {
  const prompt = G.buildQuizGeneratorPrompt({ text: "ATP is energy.", titles: ["ATP"], focus: "oxidative phosphorylation", count: 1, types: ["mcq"] });
  assert.match(prompt.user, /Focus topic: oxidative phosphorylation/);
});

test("quiz generator: parses multiple-choice, select-all and true/false replies", () => {
  const reply = JSON.stringify({
    questions: [
      { question: "What is ATP?", choices: ["Energy currency", "DNA", "Lipid"], answer: "A", type: "mcq", explanation: "ATP carries energy." },
      { question: "Pick the gases.", choices: ["Oxygen", "Nitrogen", "Sugar"], answer: "A, B", type: "multi" },
      { question: "ATP is energy currency.", choices: ["True", "False"], answer: "True", type: "true_false" },
      { question: "Broken", choices: ["One"], answer: "A" },
    ],
  });
  const parsed = G.parseGeneratorQuestions(reply, { count: 5, types: ["mcq", "multi", "true_false"] });
  assert.equal(parsed.items.length, 3);
  assert.deepEqual(parsed.items.map((item) => item.questionType), ["mcq", "multi", "true_false"]);
  assert.equal(parsed.items[1].answer, "A, B");
  assert.equal(parsed.items[2].answer, "True");
  assert.equal(parsed.issues.length, 1);
});

test("quiz generator: generation sends the selected focus and exposes retrieval metadata", async () => {
  const app = makeApp([
    { path: "Notes/ATP.md", noFm: true, text: "ATP is the energy currency of the cell." },
    { path: "Notes/Photo.md", noFm: true, text: "Photosynthesis converts light into sugar." },
  ]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  let sent = null;
  let calls = 0;
  plugin.aiComplete = async (system, user) => {
    calls += 1;
    if (calls === 1) {
      sent = { system, user };
      return JSON.stringify({ questions: [{ question: "What is ATP?", choices: ["Energy currency", "DNA", "Lipid"], answer: "A" }] });
    }
    return '{"answer":"A"}';
  };
  const generated = await plugin.generateQuizFromNotes({ folders: ["Notes"], focus: "ATP energy", count: 1, types: ["mcq"] });
  assert.match(sent.user, /Focus topic: ATP energy/);
  assert.match(sent.user, /ATP is the energy currency/);
  assert.equal(generated.retrieval.mode, "local-passages");
  assert.equal(generated.retrieval.query, "ATP energy ATP Photo");
  assert.ok(generated.retrieval.passages >= 1);
});

test("quiz generator: the command is registered and generation reuses the AI request path", async () => {
  const app = makeApp([{ path: "Notes/Bio.md", fm: { question_id: undefined }, text: "ATP is the energy currency of the cell." }]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  let sent = null;
  let calls = 0;
  plugin.aiComplete = async (system, user) => {
    calls++;
    if (calls === 1) {
      sent = { system, user };
      return JSON.stringify({ questions: [{ question: "What is ATP?", choices: ["Energy currency", "DNA", "Lipid"], answer: "A", explanation: "It carries energy." }] });
    }
    return '{"answer":"A"}';
  };
  assert.ok(plugin.commands.some((command) => command.id === "generate-quiz"));
  const generated = await plugin.generateQuizFromNotes({ folders: ["Notes"], count: 2, language: "English", types: ["mcq"] });
  assert.equal(generated.items.length, 1);
  assert.match(sent.user, /ATP is the energy currency/);
  assert.equal(generated.items[0].answer, "A");
  assert.equal(generated.verification.checked, 1);
  assert.equal(generated.items[0].verification.status, "match");
  assert.equal(calls, 2, "generation is followed by the blind answer check");
});

test("quiz generator: confirmed drafts write select-all questions with their full key", async () => {
  const app = makeApp([{ path: "Notes/Chem.md", noFm: true, text: "Gases include oxygen and nitrogen." }]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.aiComplete = async () =>
    JSON.stringify({ questions: [{ question: "Pick the gases.", choices: ["Oxygen", "Nitrogen", "Sugar"], answer: "A, B", type: "multi" }] });
  const generated = await plugin.generateQuizFromNotes({ folders: ["Notes"], count: 1, types: ["multi"] });
  const result = await plugin.createQuickAddQuestions(generated.items, { folder: "Questions" });
  assert.equal(result.created, 1);
  assert.deepEqual(result.errors, []);
  assert.equal(plugin.aiWriteHistory().length, 1, "AI-generated quick-add notes are undoable");
  const text = await app.vault.read(app.vault.getAbstractFileByPath(result.paths[0]));
  assert.match(text, /question_type: multi/);
  assert.match(text, /answer: "?A, B"?/);
  assert.match(text, /Pick the gases/);
});

test("quiz generator: normalises prompt, PDF and pasted source choices", () => {
  const config = G.normalizeQuizGenerator({
    sourceMode: "PDFS",
    brief: "x".repeat(1200),
    pdfPaths: ["a.pdf", "a.pdf", "b.pdf", "c.pdf", "d.pdf"],
  });
  assert.equal(config.sourceMode, "pdfs");
  assert.equal(config.brief.length, 1000);
  assert.deepEqual(config.pdfPaths, ["a.pdf", "b.pdf", "c.pdf"]);
  assert.equal(G.normalizeQuizGenerator({ sourceMode: "nope" }).sourceMode, "notes");
  assert.equal(G.normalizeSourceMode("Paste"), "paste");
});

test("quiz generator: a prompt-only request uses general knowledge and makes no web claim", () => {
  const prompt = G.buildQuizGeneratorPrompt({
    sourceMode: "prompt",
    brief: "10 SAT-style reading questions on social science, medium difficulty",
    count: 10,
    types: ["mcq"],
  });
  assert.match(prompt.user, /Question brief: 10 SAT-style reading questions/);
  assert.match(prompt.system, /general knowledge/);
  assert.match(prompt.system, /does not|Do not claim/i);
  assert.match(prompt.system, /not limit the questions to AP courses/);
  assert.doesNotMatch(prompt.user, /SOURCE MATERIAL:/);
});

test("quiz generator: a prompt-only request needs no notes and writes nothing", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  enableAi(plugin);
  let sent = null;
  let calls = 0;
  plugin.aiComplete = async (system, user) => {
    calls++;
    if (calls === 1) {
      sent = { system, user };
      return questionReply("Which source is a primary source?");
    }
    return '{"answer":"A"}';
  };
  const before = app.files.length;
  const generated = await plugin.generateQuizFromNotes({
    sourceMode: "prompt",
    brief: "10 SAT-style reading questions on social science, medium difficulty",
    count: 1,
    types: ["mcq"],
  });
  assert.equal(generated.items.length, 1);
  assert.equal(generated.source.retrieval.mode, "model-knowledge");
  assert.match(sent.user, /SAT-style reading questions/);
  assert.doesNotMatch(sent.user, /SOURCE MATERIAL:/);
  assert.equal(app.files.length, before, "drafting writes no notes");
  assert.equal(calls, 2, "blind verification still runs");
});

test("quiz generator: a real PDF reaches the provider through the production PDF reader", async () => {
  pdfRuntime.calls.length = 0;
  const app = makeApp([]);
  const pdf = pdfFixtures.bytes("text");
  addPdf(app, "Sources/membranes.pdf", pdf);
  const plugin = new QT(app);
  await plugin.onload();
  enableAi(plugin);
  let sent = null;
  let calls = 0;
  plugin.aiComplete = async (system, user) => {
    calls++;
    if (calls === 1) {
      sent = { system, user };
      return questionReply("What faces the water in a membrane?");
    }
    return '{"answer":"A"}';
  };
  const before = app.files.length;
  const prepared = await plugin.prepareQuizGeneration({
    sourceMode: "pdfs",
    pdfPaths: ["Sources/membranes.pdf"],
    brief: "College biology questions on membrane structure",
    count: 1,
    types: ["mcq"],
  });
  assert.equal(pdfRuntime.calls.length, 1, "the production reader opened exactly the selected PDF");
  assert.deepEqual(pdfRuntime.calls[0], {
    name: "text",
    file: "pdfjs-membranes.pdf",
    sha256: pdfFixtures.recording("text").sha256,
  });
  assert.equal(prepared.source.retrieval.mode, "pdf-pages");
  assert.equal(prepared.source.count, 1);
  assert.equal(prepared.source.retrieval.pages, 1);
  assert.match(prepared.source.text, /phospholipid bilayer/);
  assert.match(prepared.prompt.user, /SOURCE MATERIAL:/);
  assert.match(prepared.prompt.user, /phospholipid bilayer/);
  assert.equal(app.files.length, before, "preparing a PDF source writes nothing");
  const generated = await plugin.generateQuizFromNotes(prepared.config, prepared);
  assert.equal(generated.items.length, 1);
  assert.equal(generated.source.retrieval.mode, "pdf-pages");
  assert.match(sent.user, /Membrane proteins move laterally/);
});

test("quiz generator: an image-only PDF is refused instead of guessed at", async () => {
  pdfRuntime.calls.length = 0;
  const app = makeApp([]);
  const pdf = pdfFixtures.bytes("scan");
  addPdf(app, "Sources/scan.pdf", pdf);
  const plugin = new QT(app);
  await plugin.onload();
  enableAi(plugin);
  let providerCalls = 0;
  plugin.aiComplete = async () => {
    providerCalls++;
    return '{"answer":"A"}';
  };
  await assert.rejects(
    plugin.prepareQuizGeneration({
      sourceMode: "pdfs",
      pdfPaths: ["Sources/scan.pdf"],
      brief: "Questions from this scan",
      count: 1,
    }),
    (error) => {
      assert.match(error.message, /Sources\/scan\.pdf/);
      assert.match(error.message, /scanned|OCR|readable text/i);
      return true;
    }
  );
  assert.equal(pdfRuntime.calls.length, 1, "the production reader examined the scanned PDF");
  assert.equal(pdfRuntime.calls[0].sha256, pdfFixtures.recording("scan").sha256);
  assert.equal(providerCalls, 0, "a scanned PDF never reaches the provider");
  assert.equal(app.files.length, 1, "the PDF stays untouched and no notes are made");
});

test("quiz generator: an unreadable PDF is reported and skipped when another PDF is usable", async () => {
  pdfRuntime.calls.length = 0;
  const app = makeApp([]);
  addPdf(app, "Sources/membranes.pdf", pdfFixtures.bytes("text"));
  addPdf(app, "Sources/scan.pdf", pdfFixtures.bytes("scan"));
  const plugin = new QT(app);
  await plugin.onload();
  enableAi(plugin);
  const prepared = await plugin.prepareQuizGeneration({
    sourceMode: "pdfs",
    pdfPaths: ["Sources/scan.pdf", "Sources/membranes.pdf"],
    brief: "College biology questions on membrane structure",
    count: 1,
    types: ["mcq"],
  });
  assert.equal(pdfRuntime.calls.length, 2, "both selected PDFs reached the production reader");
  assert.equal(prepared.source.count, 1, "only the readable PDF is used");
  assert.equal(prepared.source.skipped.length, 1);
  assert.equal(prepared.source.skipped[0].path, "Sources/scan.pdf");
  assert.match(prepared.source.skipped[0].reason, /scanned|readable text/i);
  assert.deepEqual(prepared.source.retrieval.files, ["Sources/membranes.pdf"]);
  assert.match(prepared.source.text, /phospholipid bilayer/);
  assert.doesNotMatch(prepared.source.text, /scan\.pdf/);
  assert.match(prepared.prompt.user, /phospholipid bilayer/);
});

test("quiz generator modal: a mixed PDF source names the skipped file and sends the readable PDF", async () => {
  pdfRuntime.calls.length = 0;
  const app = makeApp([]);
  addPdf(app, "Sources/scan.pdf", pdfFixtures.bytes("scan"));
  addPdf(app, "Sources/membranes.pdf", pdfFixtures.bytes("text"));
  const plugin = new QT(app);
  await plugin.onload();
  enableAi(plugin);
  const requests = [];
  const previous = obsidian.requestImpl;
  obsidian.requestImpl = async (request) => {
    requests.push(request);
    const body = JSON.parse(request.body || "{}");
    return { status: 200, json: /independent exam answer checker/i.test(body.system || "") ? providerReplies.verification : providerReplies.generation };
  };
  try {
    const { modal, dom } = openQuizModal(plugin);
    changeField(dom, "Question source", "pdfs");
    changeField(dom, "Add a source PDF", "Sources/scan.pdf");
    changeField(dom, "Add a source PDF", "Sources/membranes.pdf");
    dom.type(dom.field("Question brief"), "College biology questions on membrane structure");
    await dom.clickLast("Generate draft");

    assert.equal(requests.length, 0, "preparing the draft sends nothing");
    assert.equal(modal.prepared.source.count, 1, "only the readable PDF is used");
    assert.equal(modal.prepared.source.skipped.length, 1);
    const pending = dom.texts().join("\n");
    assert.match(pending, /1 skipped PDF/);
    assert.match(pending, /Skipped PDF: Sources\/scan\.pdf: This PDF has almost no readable text/);
    assert.match(pending, /scanned|OCR|readable text/i);
    assert.match(pending, /Ready to send/);

    const before = app.files.filter((file) => /\.md$/i.test(file.path)).length;
    await dom.clickLast("Send request");
    assert.equal(requests.length, 2, "generation and blind verification both reach the provider");
    const generation = JSON.parse(requests[0].body).messages[0].content;
    assert.match(generation, /phospholipid bilayer/);
    assert.doesNotMatch(generation, /scan\.pdf/);
    assert.equal(modal.generated.items.length, 1);
    assert.equal(modal.generated.source.skipped.length, 1);
    const preview = dom.texts().join("\n");
    assert.match(preview, /1 skipped PDF/);
    assert.match(preview, /Skipped PDF: Sources\/scan\.pdf: This PDF has almost no readable text/);
    assert.equal(app.files.filter((file) => /\.md$/i.test(file.path)).length, before, "nothing is written before Create questions");

    await dom.clickLast("Create questions");
    assert.equal(app.files.filter((file) => /\.md$/i.test(file.path)).length, before + 1, "Create questions writes one ordinary note");
  } finally {
    obsidian.requestImpl = previous;
  }
});

test("quiz generator modal: an all-scanned PDF selection shows the refusal and writes nothing", async () => {
  pdfRuntime.calls.length = 0;
  const app = makeApp([]);
  addPdf(app, "Sources/scan.pdf", pdfFixtures.bytes("scan"));
  const plugin = new QT(app);
  await plugin.onload();
  enableAi(plugin);
  let providerCalls = 0;
  const previous = obsidian.requestImpl;
  obsidian.requestImpl = async () => {
    providerCalls += 1;
    return { status: 200, json: providerReplies.generation };
  };
  try {
    const { modal, dom } = openQuizModal(plugin);
    changeField(dom, "Question source", "pdfs");
    changeField(dom, "Add a source PDF", "Sources/scan.pdf");
    await dom.clickLast("Generate draft");

    assert.equal(providerCalls, 0, "a scanned PDF never reaches the provider");
    assert.equal(modal.prepared, null);
    assert.equal(modal.generated, null);
    assert.match(modal.error, /No selected PDF has enough readable text/);
    const text = dom.texts().join("\n");
    assert.match(text, /No selected PDF has enough readable text/);
    assert.match(text, /Sources\/scan\.pdf/);
    assert.match(text, /scanned|OCR|readable text/i);
    assert.equal(app.files.length, 1, "the PDF stays untouched");
    assert.equal(app.created, undefined, "nothing is written");
    assert.equal(app.files.filter((file) => /\.md$/i.test(file.path)).length, 0);
  } finally {
    obsidian.requestImpl = previous;
  }
});

test("quiz generator: every source mode uses the real provider request and writes notes only after Create questions", async () => {
  pdfRuntime.calls.length = 0;
  const app = makeApp([{ path: "Notes/Bio.md", noFm: true, text: "Cell membranes are made of a phospholipid bilayer. Membrane proteins move laterally." }]);
  addPdf(app, "Sources/membranes.pdf", pdfFixtures.bytes("text"));
  const plugin = new QT(app);
  await plugin.onload();
  enableAi(plugin);
  const requests = [];
  const previous = obsidian.requestImpl;
  obsidian.requestImpl = async (request) => {
    requests.push(request);
    const body = JSON.parse(request.body || "{}");
    const verification = /independent exam answer checker/i.test(body.system || "");
    return { status: 200, json: verification ? providerReplies.verification : providerReplies.generation };
  };
  try {
    const modes = [
      {
        name: "notes",
        options: { sourceMode: "notes", folders: ["Notes"], brief: "membrane structure", count: 1, types: ["mcq"] },
      },
      {
        name: "prompt",
        options: { sourceMode: "prompt", brief: "10 SAT-style reading questions on social science, medium difficulty", count: 1, types: ["mcq"] },
      },
      {
        name: "paste",
        options: { sourceMode: "paste", paste: "Cell membranes are made of a phospholipid bilayer.", brief: "membrane structure", count: 1, types: ["mcq"] },
      },
      {
        name: "pdfs",
        options: { sourceMode: "pdfs", pdfPaths: ["Sources/membranes.pdf"], brief: "membrane structure", count: 1, types: ["mcq"] },
      },
    ];
    let pdfGenerated = null;
    for (const mode of modes) {
      const generated = await plugin.generateQuizFromNotes(mode.options);
      assert.equal(generated.items.length, 1, `${mode.name} produced one usable item`);
      assert.equal(generated.items[0].verification.status, "match", `${mode.name} went through the blind check`);
      if (mode.name === "pdfs") pdfGenerated = generated;
    }

    assert.equal(requests.length, 8, "four generations and four blind checks");
    const parsed = requests.map((request) => ({
      url: request.url,
      method: request.method,
      headers: request.headers,
      body: JSON.parse(request.body),
    }));
    for (const request of parsed) {
      assert.equal(request.url, "https://api.anthropic.com/v1/messages");
      assert.equal(request.method, "POST");
      assert.equal(request.headers["x-api-key"], "sk-test");
      assert.equal(request.headers["anthropic-version"], "2023-06-01");
      assert.equal(request.body.model, "claude-sonnet-4-5");
      assert.equal(request.body.messages.length, 1);
      assert.equal(request.body.messages[0].role, "user");
      assert.equal(typeof request.body.messages[0].content, "string");
      assert.equal(typeof request.body.system, "string");
    }
    const generation = parsed.filter((_, index) => index % 2 === 0);
    const verification = parsed.filter((_, index) => index % 2 === 1);
    assert.deepEqual(generation.map((request) => request.body.max_tokens), [4000, 4000, 4000, 4000]);
    assert.deepEqual(verification.map((request) => request.body.max_tokens), [800, 800, 800, 800]);
    assert.match(generation[0].body.system, /grounded in the supplied source material/);
    assert.match(generation[1].body.system, /not limit the questions to AP courses/);
    assert.match(generation[1].body.messages[0].content, /Question brief: 10 SAT-style reading questions/);
    assert.match(generation[2].body.system, /grounded in the supplied source material/);
    assert.match(generation[2].body.messages[0].content, /Cell membranes are made of a phospholipid bilayer/);
    assert.match(generation[3].body.system, /grounded in the supplied source material/);
    assert.match(generation[3].body.messages[0].content, /SOURCE MATERIAL:/);
    assert.match(generation[3].body.messages[0].content, /phospholipid bilayer/);
    for (const request of verification) {
      assert.match(request.body.system, /independent exam answer checker/i);
      assert.doesNotMatch(request.body.messages[0].content, /Correct Answer|stored answer|answer key/i);
    }

    const before = app.files.filter((file) => /\.md$/i.test(file.path)).length;
    assert.equal(before, 1, "the test starts with one ordinary note");
    assert.equal(pdfGenerated.source.retrieval.mode, "pdf-pages");
    assert.equal(app.files.filter((file) => /\.md$/i.test(file.path)).length, before, "generation wrote no notes");
    const result = await plugin.createQuickAddQuestions(pdfGenerated.items, { folder: "Questions" });
    assert.equal(result.created, 1);
    assert.deepEqual(result.errors, []);
    assert.equal(app.files.filter((file) => /\.md$/i.test(file.path)).length, before + 1, "Create questions writes the note");
    const note = await app.vault.read(app.vault.getAbstractFileByPath(result.paths[0]));
    assert.match(note, /## Question/);
    assert.match(note, /What forms the main structure of a cell membrane\?/);
    assert.match(note, /question_type: mcq/);
    assert.match(note, /answer: A/);
  } finally {
    obsidian.requestImpl = previous;
  }
});
