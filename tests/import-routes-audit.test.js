"use strict";
/*
 * End-to-end audit of every supported card import route.
 *
 * Each case enters through the import dialog's preview function, asserts that
 * preview writes nothing, then calls the same handler the Import button calls
 * and checks the resulting card note. No parser-only shortcuts.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();

async function setup(notes) {
  const app = makeApp(notes);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.cards.enabled = true;
  return { app, plugin };
}

function firstCard(app) {
  assert.ok(app.created && app.created.length, "expected at least one written card");
  return app.created[0].text;
}

function storedZip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const data = Buffer.from(text, "utf8");
    const nameBuf = Buffer.from(name, "utf8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(local, nameBuf, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + data.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(Object.keys(files).length, 8);
  eocd.writeUInt16LE(Object.keys(files).length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuf, eocd]);
}

async function runRoute({ notes, type, path: target, options, import: write, expected, front, back, key }) {
  const { app, plugin } = await setup(notes);
  const preview = await plugin.previewCardsImport(type, target, options || {});
  assert.equal(preview.errors.length, 0, `${type} preview errors: ${preview.errors.join("; ")}`);
  assert.equal(preview.total, expected, `${type} preview count`);
  assert.equal(app.created?.length || 0, 0, `${type} preview must not write`);
  const result = await write(plugin, app);
  assert.equal(result.created, expected, `${type} write count`);
  assert.equal(app.created.length, expected, `${type} notes written`);
  const text = firstCard(app);
  assert.ok(text.includes(`## Front\n\n${front}`), `${type} front: ${front}`);
  assert.ok(text.includes(`## Back\n\n${back}`), `${type} back: ${back}`);
  assert.ok(text.includes(`import_key: "${key}`), `${type} key: ${key}`);
  return { app, plugin, preview, result, text };
}

test("route: Spaced Repetition folder", async () => {
  await runRoute({
    notes: [{ path: "SR/spanish.md", text: "#flashcards/Spanish\n\nhola::hello\nadiós::goodbye" }],
    type: "spaced",
    path: "SR",
    import: (p) => p.importCardsFromFolder("SR", {}),
    expected: 2,
    front: "hola",
    back: "hello",
    key: "sr:",
  });
});

test("route: Mochi Markdown folder", async () => {
  await runRoute({
    notes: [{ path: "Mochi/Spanish/hola.md", text: "hola\n---\nhello" }],
    type: "mochi",
    path: "Mochi",
    import: (p) => p.importCardsFromMochi("Mochi", {}),
    expected: 1,
    front: "hola",
    back: "hello",
    key: "mochi:",
  });
});

test("route: LearnKit pipe block", async () => {
  await runRoute({
    notes: [{ path: "LK/Science.md", text: "Q | What is 2 + 2? |\nA | 4 |\nG | Math |" }],
    type: "learnkit",
    path: "LK/Science.md",
    import: (p) => p.importCardsFromLearnKit("LK/Science.md", {}),
    expected: 1,
    front: "What is 2 + 2?",
    back: "4",
    key: "learnkit:",
  });
});

test("route: CrowdAnki JSON", async () => {
  const data = JSON.stringify({ name: "Languages", notes: [{ guid: "g1", modelName: "Basic", fields: ["hola", "hello"] }] });
  await runRoute({
    notes: [{ path: "Imports/Languages.json", text: data }],
    type: "crowdanki",
    path: "Imports/Languages.json",
    import: (p) => p.importCardsFromCrowdAnki("Imports/Languages.json", {}),
    expected: 1,
    front: "hola",
    back: "hello",
    key: "crowdanki:g1",
  });
});

test("route: Anki text export", async () => {
  await runRoute({
    notes: [{ path: "Imports/anki.txt", text: "#separator:tab\n#html:true\n#notetype column:1\n#deck column:2\nBasic\tSpanish\thola\thello" }],
    type: "anki",
    path: "Imports/anki.txt",
    import: (p) => p.importCardsFromAnki("Imports/anki.txt", {}),
    expected: 1,
    front: "hola",
    back: "hello",
    key: "anki:",
  });
});

test("route: Anki package", async () => {
  const bytes = fs.readFileSync(path.join(__dirname, "fixtures", "anki-basic.apkg"));
  const { app, plugin } = await setup([{ path: "Imports/deck.apkg", text: "binary" }]);
  app.vault.readBinary = async () => bytes;
  const preview = await plugin.previewCardsImport("apkg", "Imports/deck.apkg", {});
  assert.ok(preview.total >= 1);
  assert.equal(app.created?.length || 0, 0);
  const result = await plugin.importCardsFromApkg("Imports/deck.apkg", {});
  assert.equal(result.created, preview.total);
  assert.match(firstCard(app), /import_key: "apkg:guid-/);
});

test("route: Quizlet text export", async () => {
  await runRoute({
    notes: [{ path: "Imports/quizlet.txt", text: "hola\thello\nadiós\tgoodbye" }],
    type: "quizlet",
    path: "Imports/quizlet.txt",
    import: (p) => p.importCardsFromQuizlet("Imports/quizlet.txt", { deck: "Spanish" }),
    expected: 2,
    front: "hola",
    back: "hello",
    key: "quizlet:",
  });
});

test("route: Moodle GIFT", async () => {
  await runRoute({
    notes: [{ path: "Imports/moodle.gift", text: "::Capital::What is the capital of France?{=Paris ~Lyon}" }],
    type: "gift",
    path: "Imports/moodle.gift",
    import: (p) => p.importCardsFromGift("Imports/moodle.gift", { deck: "Moodle" }),
    expected: 1,
    front: "What is the capital of France?",
    back: "Paris",
    key: "gift:",
  });
});

test("route: Moodle XML", async () => {
  const xml = '<quiz><question type="multichoice"><questiontext><text>2 + 2?</text></questiontext><answer fraction="100"><text>4</text></answer><answer fraction="0"><text>5</text></answer></question></quiz>';
  await runRoute({
    notes: [{ path: "Imports/moodle.xml", text: xml }],
    type: "moodlexml",
    path: "Imports/moodle.xml",
    import: (p) => p.importCardsFromLmsXml("Imports/moodle.xml", "moodlexml", { deck: "Moodle" }),
    expected: 1,
    front: "2 + 2?",
    back: "4",
    key: "moodle:",
  });
});

test("route: QTI XML", async () => {
  const xml = '<qti-assessment-item identifier="q2"><qti-item-body><qti-prompt>2 + 2?</qti-prompt><qti-simple-choice identifier="A">4</qti-simple-choice><qti-simple-choice identifier="B">5</qti-simple-choice></qti-item-body><qti-response-declaration identifier="RESPONSE"><qti-correct-response><qti-value>A</qti-value></qti-correct-response></qti-response-declaration></qti-assessment-item>';
  await runRoute({
    notes: [{ path: "Imports/qti.xml", text: xml }],
    type: "qti",
    path: "Imports/qti.xml",
    import: (p) => p.importCardsFromLmsXml("Imports/qti.xml", "qti", { deck: "QTI" }),
    expected: 1,
    front: "2 + 2?",
    back: "4",
    key: "qti:",
  });
});

test("route: QTI zip archive", async () => {
  const xml = '<?xml version="1.0"?><questestinterop><item title="Q1"><presentation><material><mattext>2 + 2?</mattext></material><response_lid ident="r1"><render_choice><response_label ident="a"><material><mattext>4</mattext></material></response_label><response_label ident="b"><material><mattext>5</mattext></material></response_label></render_choice></response_lid></presentation><resprocessing><respcondition><conditionvar><varequal respident="r1">a</varequal></conditionvar></respcondition></resprocessing></item></questestinterop>';
  const { app, plugin } = await setup([{ path: "Imports/canvas.zip", text: "binary" }]);
  app.vault.readBinary = async () => storedZip({ "quiz/q1.xml": xml, "imsmanifest.xml": "<manifest/>" });
  const preview = await plugin.previewCardsImport("qti", "Imports/canvas.zip", { deck: "Canvas" });
  assert.equal(preview.total, 1);
  const result = await plugin.importCardsFromLmsXml("Imports/canvas.zip", "qti", { deck: "Canvas" });
  assert.equal(result.created, 1);
  assert.match(firstCard(app), /## Front\n\n2 \+ 2\?/);
  assert.match(firstCard(app), /import_key: "qti:/);
});

test("route: FlashQuiz text", async () => {
  await runRoute({
    notes: [{ path: "Imports/flashquiz.txt", text: "What is 2 + 2?\n@mc\n- [ ] 3\n- [x] 4\n- [ ] 5" }],
    type: "flashquiz",
    path: "Imports/flashquiz.txt",
    import: (p) => p.importCardsFromFlashQuiz("Imports/flashquiz.txt", { deck: "Math" }),
    expected: 1,
    front: "What is 2 + 2?",
    back: "4",
    key: "flashquiz:",
  });
});

test("route: QuizPort JSON", async () => {
  await runRoute({
    notes: [{ path: "Imports/quizport.json", text: JSON.stringify({ title: "Bio", questions: [{ question: "Powerhouse?", options: ["Nucleus", "Mitochondria"], correct: 1 }] }) }],
    type: "quizport",
    path: "Imports/quizport.json",
    import: (p) => p.importCardsFromQuizPort("Imports/quizport.json", {}),
    expected: 1,
    front: "Powerhouse?",
    back: "Mitochondria",
    key: "quizport:",
  });
});

test("route: Markdown checkbox quiz", async () => {
  await runRoute({
    notes: [{ path: "Imports/quiz.md", text: "## Capital of France?\n- [ ] Lyon\n- [x] Paris" }],
    type: "mdquiz",
    path: "Imports/quiz.md",
    import: (p) => p.importCardsFromMarkdownQuiz("Imports/quiz.md", {}),
    expected: 1,
    front: "Capital of France?",
    back: "Paris",
    key: "mdquiz:",
  });
});

test("route: Kahoot CSV", async () => {
  await runRoute({
    notes: [{ path: "Imports/kahoot.csv", text: "Question,Answer 1,Answer 2,Answer 3,Answer 4,Correct answer(s)\n2 + 2?,4,3,5,6,1" }],
    type: "kahoot",
    path: "Imports/kahoot.csv",
    import: (p) => p.importCardsFromQuestionSet("Imports/kahoot.csv", "kahoot", {}),
    expected: 1,
    front: "2 + 2?",
    back: "4",
    key: "kahoot:",
  });
});

test("route: Blooket CSV", async () => {
  await runRoute({
    notes: [{ path: "Imports/blooket.csv", text: "Question,Answer 1,Answer 2,Answer 3,Correct Answer\nCapital of France,Paris,Lyon,Rome,Paris" }],
    type: "blooket",
    path: "Imports/blooket.csv",
    import: (p) => p.importCardsFromQuestionSet("Imports/blooket.csv", "blooket", {}),
    expected: 1,
    front: "Capital of France",
    back: "Paris",
    key: "blooket:",
  });
});

test("route: Gimkit CSV", async () => {
  await runRoute({
    notes: [{ path: "Imports/gimkit.csv", text: "Question,Correct Answer,Incorrect Answer 1,Incorrect Answer 2\n2 + 2,4,3,5" }],
    type: "gimkit",
    path: "Imports/gimkit.csv",
    import: (p) => p.importCardsFromQuestionSet("Imports/gimkit.csv", "gimkit", {}),
    expected: 1,
    front: "2 + 2",
    back: "4",
    key: "gimkit:",
  });
});

test("route: generic CSV", async () => {
  await runRoute({
    notes: [{ path: "Imports/spanish.csv", text: "Term,Definition,Deck\nhola,hello,Spanish" }],
    type: "csv",
    path: "Imports/spanish.csv",
    options: { deck: "Fallback" },
    import: (p) => p.importCardsFromCsv("Imports/spanish.csv", { deck: "Fallback" }),
    expected: 1,
    front: "hola",
    back: "hello",
    key: "csv:",
  });
});

test("route: Markdown table", async () => {
  await runRoute({
    notes: [{ path: "Imports/table.md", text: "| Front | Back | Deck |\n| --- | --- | --- |\n| hola | hello | Spanish |" }],
    type: "mdtable",
    path: "Imports/table.md",
    import: (p) => p.importCardsFromMarkdownTable("Imports/table.md", {}),
    expected: 1,
    front: "hola",
    back: "hello",
    key: "mdtable:",
  });
});

test("route: AI document fallback previews before writing", async () => {
  const { app, plugin } = await setup([{ path: "AI/source.md", text: "ATP stores usable energy in cells." }]);
  const source = app.files[0];
  source.name = "source.md";
  app.vault.readBinary = async () => Buffer.from(source.text);
  plugin.settings.ai.enabled = true;
  plugin.aiComplete = async () => JSON.stringify({ cards: [{ front: "What is ATP?", back: "Cellular energy currency." }] });
  plugin.aiModelLabel = () => "mock-model";
  const preview = await T.documentCards.previewDocumentCards(plugin, "AI/source.md", { useAi: true, deck: "Biology" });
  assert.equal(preview.cards.length, 1);
  assert.equal(preview.cards[0].front, "What is ATP?");
  assert.equal(app.created?.length || 0, 0, "AI preview must not write");
  const result = await plugin.importParsedCards(preview.cards, { deck: "Biology" });
  assert.equal(result.created, 1);
  assert.match(firstCard(app), /import_key: "document-ai:/);
});
