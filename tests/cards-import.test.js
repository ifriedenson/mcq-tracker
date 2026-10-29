"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const importer = T.cardsImport;

async function setup(notes) {
  const app = makeApp(notes);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.cards.enabled = true;
  obsidian.notices.length = 0;
  return { app, plugin };
}

test("spaced repetition: inline, reversed, multiline, reversed multiline and cloze cards", () => {
  const text = `#flashcards/Spanish

¿Cómo estás?::How are you? <!--SR:2026-10-29,3,250,1-->
hablar:::to speak

The capital of France
?
Paris

reverse me
??
reverse answer

The capital is ==Paris==.
`;
  const result = importer.parseSpacedRepetition(text, { sourcePath: "SR/spanish.md", deck: "Fallback" });
  assert.equal(result.cards.length, 5);
  assert.equal(result.cards[0].deck, "Spanish");
  assert.equal(result.cards[0].front, "¿Cómo estás?");
  assert.equal(result.cards[0].back, "How are you?", "inline scheduling comments are removed");
  assert.equal(result.cards[1].cardType, "reversed");
  assert.equal(result.cards[1].front, "hablar");
  assert.equal(result.cards[1].back, "to speak");
  assert.equal(result.cards[2].front, "The capital of France");
  assert.equal(result.cards[2].back, "Paris");
  assert.equal(result.cards[3].cardType, "reversed");
  assert.equal(result.cards[4].cardType, "cloze");
  assert.match(result.cards[4].front, /==Paris==/);
  assert.equal(result.cards[4].back, "Paris");
  assert.ok(result.cards.every((c) => c.importKey));
});

test("spaced repetition: ordinary notes and code examples are not turned into cards", () => {
  const plain = importer.parseSpacedRepetition("This ==highlight== is just prose.\n\n```\nquestion::answer\n```", {
    sourcePath: "ordinary.md",
  });
  assert.equal(plain.cards.length, 0);

  const untagged = importer.parseSpacedRepetition("ordinary line::a basic card", { sourcePath: "ordinary.md" });
  assert.equal(untagged.cards.length, 1, "explicit inline syntax works without a deck tag");
});

test("anki: header columns, HTML conversion, deck/tags/notetype and cloze", () => {
  const text = `#separator:tab
#html:true
#notetype column:1
#deck column:2
#tags column:5
Basic\tSpanish::Verbs\t<b>hablar</b>\tto speak\tverb
Cloze\tSpanish\tThe capital is {{c1::Paris}}.\t\t
`;
  const result = importer.parseAnkiText(text, { sourcePath: "anki.txt" });
  assert.equal(result.cards.length, 2);
  assert.equal(result.cards[0].deck, "Spanish::Verbs");
  assert.equal(result.cards[0].front, "**hablar**");
  assert.equal(result.cards[0].back, "to speak");
  assert.deepEqual(result.cards[0].tags, ["verb"]);
  assert.equal(result.cards[1].cardType, "cloze");
  assert.equal(result.cards[1].front, "The capital is {{c1::Paris}}.");
  assert.equal(result.cards[1].back, "Paris");
});

test("anki: comma-separated quoted fields without headers", () => {
  const rows = importer.splitDelimited('"hello, world","hi, there"\n"a ""quote""","answer"', ",");
  assert.deepEqual(rows, [
    ["hello, world", "hi, there"],
    ['a "quote"', "answer"],
  ]);
  const result = importer.parseAnkiText('"hello, world","hi, there"\n', { separator: "," });
  assert.equal(result.cards.length, 1);
  assert.equal(result.cards[0].front, "hello, world");
  assert.equal(result.cards[0].back, "hi, there");
  assert.equal(importer.htmlToMarkdown("<b>one</b><br><i>two</i>", true), "**one**\n*two*");
});

test("plugin: imports Spaced Repetition notes into card notes with deck and import key", async () => {
  const notes = [
    {
      path: "SR/spanish.md",
      text: "#flashcards/Spanish\n\nhablar::to speak\n\ngato::cat",
    },
    {
      path: "SR/Cards/existing.md",
      fm: { card_id: "existing", item_type: "card", question_id: "" },
      text: "---\ncard_id: existing\nitem_type: card\n---\n\n## Front\nThe capital is {{c1::Paris}}.\n\n## Back\nParis",
    },
  ];
  const { app, plugin } = await setup(notes);
  const result = await plugin.importCardsFromFolder("SR", { deck: "Fallback" });
  assert.equal(result.created, 2);
  assert.equal(app.created.length, 2);
  assert.ok(app.created.every((c) => /import_key: "sr:/.test(c.text)));
  assert.ok(app.created.every((c) => /deck: "Spanish"/.test(c.text)), "the source deck wins over the fallback deck");
  assert.ok(app.created.every((c) => /## Front/.test(c.text)));
  assert.ok(app.created.every((c) => !/existing|capital/.test(c.text)), "card notes are not re-imported");
});

test("quizlet: tab, comma/semicolon, dash, quoted CSV and two-line layouts", () => {
  const tab = importer.parseQuizletText("hola\thello\nadiós\tgoodbye", { sourcePath: "quizlet.txt", deck: "Spanish" });
  assert.equal(tab.cards.length, 2);
  assert.equal(tab.cards[0].front, "hola");
  assert.equal(tab.cards[0].back, "hello");
  assert.equal(tab.cards[1].deck, "Spanish");
  assert.match(tab.cards[0].importKey, /^quizlet:/);

  const semicolon = importer.parseQuizletText("hola, hello; adiós, goodbye", { deck: "Spanish" });
  assert.deepEqual(semicolon.cards.map((c) => [c.front, c.back]), [["hola", "hello"], ["adiós", "goodbye"]]);

  const dash = importer.parseQuizletText("hola - hello\nadiós — goodbye", { deck: "Spanish" });
  assert.deepEqual(dash.cards.map((c) => [c.front, c.back]), [["hola", "hello"], ["adiós", "goodbye"]]);

  const quoted = importer.parseQuizletText('"hello, world","a greeting"\n"goodbye, world","a farewell"', { deck: "Spanish" });
  assert.deepEqual(quoted.cards.map((c) => [c.front, c.back]), [["hello, world", "a greeting"], ["goodbye, world", "a farewell"]]);

  const pairs = importer.parseQuizletText("hola\nhello\n\nadiós\ngoodbye", { deck: "Spanish" });
  assert.deepEqual(pairs.cards.map((c) => [c.front, c.back]), [["hola", "hello"], ["adiós", "goodbye"]]);

  assert.equal(importer.parseQuizletText("just a note", { deck: "Spanish" }).cards.length, 0);
});

test("plugin: imports a Quizlet text export and rejects a PDF", async () => {
  const notes = [
    { path: "quizlet.txt", text: "hola\thello\nadiós\tgoodbye" },
    { path: "quizlet.pdf", text: "not a text export" },
  ];
  const { app, plugin } = await setup(notes);
  const result = await plugin.importCardsFromQuizlet("quizlet.txt", { deck: "Spanish", course: "SPAN 101" });
  assert.equal(result.created, 2);
  assert.ok(app.created.every((c) => /import_key: "quizlet:/.test(c.text)));
  assert.ok(app.created.every((c) => /deck: "Spanish"/.test(c.text)));
  assert.ok(app.created.every((c) => /course: "SPAN 101"/.test(c.text)));
  await assert.rejects(() => plugin.importCardsFromQuizlet("quizlet.pdf", {}), /PDFs are not read/);
});

test("plugin: imports an Anki text export and rejects a binary package", async () => {
  const notes = [
    {
      path: "anki.txt",
      text: "#separator:tab\n#html:true\n#notetype column:1\n#deck column:2\nBasic\tSpanish::Verbs\t<b>hablar</b>\tto speak\n",
    },
    { path: "deck.apkg", text: "not a real archive" },
  ];
  const { app, plugin } = await setup(notes);
  const result = await plugin.importCardsFromAnki("anki.txt", {});
  assert.equal(result.created, 1);
  assert.match(app.created[0].text, /deck: "Spanish::Verbs"/);
  assert.match(app.created[0].text, /\*\*hablar\*\*/);
  await assert.rejects(() => plugin.importCardsFromAnki("deck.apkg", {}), /Notes in Plain Text/);
});

test("plugin: duplicate import keys are skipped", async () => {
  const notes = [
    {
      path: "Cards/one.md",
      noFm: true,
      fm: { card_id: "one", item_type: "card", import_key: "sr:known" },
      text: "## Front\none\n\n## Back\n1",
    },
  ];
  const { app, plugin } = await setup(notes);
  app.files[0].fm = { card_id: "one", item_type: "card", import_key: "sr:known" };
  const result = await plugin.importParsedCards([
    { kind: "card", cardType: "basic", deck: "D", front: "one", back: "1", importKey: "sr:known", importSource: "x" },
  ]);
  assert.equal(result.created, 0);
  assert.equal(result.skipped, 1);
});

test("question sets: Kahoot numeric and multi-select answers", () => {
  const text = `Question,Answer 1,Answer 2,Answer 3,Answer 4,Time limit (seconds),Correct answer(s)
"What is 2, 2?",4,3,5,6,20,1
Pick even,1,2,3,4,30,"2,4"
`;
  const result = importer.parseQuestionSetText(text, { format: "kahoot", deck: "Math", sourcePath: "kahoot.csv" });
  assert.equal(result.cards.length, 2);
  assert.equal(result.cards[0].front, "What is 2, 2?");
  assert.equal(result.cards[0].back, "4");
  assert.deepEqual(result.cards[0].choices, ["4", "3", "5", "6"]);
  assert.equal(result.cards[0].correctChoices, "1");
  assert.equal(result.cards[0].timeLimit, 20);
  assert.equal(result.cards[1].back, "2 · 4");
  assert.equal(result.cards[1].correctChoices, "2,4");
  assert.equal(result.cards[1].questionSet, "kahoot");
  assert.match(result.cards[0].importKey, /^kahoot:/);
});

test("question sets: Blooket answer text and Gimkit correct/incorrect columns", () => {
  const blooket = importer.parseQuestionSetText(
    "Question,Answer 1,Answer 2,Answer 3,Answer 4,Correct Answer,Time Limit (sec)\nCapital of France,Paris,London,Rome,Madrid,Paris,10",
    { format: "blooket", deck: "Geography" }
  );
  assert.equal(blooket.cards.length, 1);
  assert.equal(blooket.cards[0].back, "Paris");
  assert.equal(blooket.cards[0].correctChoices, "1");
  assert.equal(blooket.cards[0].timeLimit, 10);

  const gimkit = importer.parseQuestionSetText(
    "Question,Correct Answer,Incorrect Answer 1,Incorrect Answer 2,Incorrect Answer 3\n2 + 2,4,3,5,6",
    { format: "gimkit", deck: "Math" }
  );
  assert.equal(gimkit.cards.length, 1);
  assert.deepEqual(gimkit.cards[0].choices, ["4", "3", "5", "6"]);
  assert.equal(gimkit.cards[0].back, "4");
  assert.equal(gimkit.cards[0].correctChoices, "1");

  const terms = importer.parseQuestionSetText("Term,Definition\nhola,hello", { format: "gimkit", deck: "Spanish" });
  assert.equal(terms.cards.length, 1);
  assert.equal(terms.cards[0].front, "hola");
  assert.equal(terms.cards[0].back, "hello");
});

test("question sets: a row without a usable answer is skipped and reported", () => {
  const text = "Question,Answer 1,Answer 2,Answer 3,Answer 4,Correct Answer\nNo key,A,B,C,D,\n";
  const result = importer.parseQuestionSetText(text, { format: "kahoot", sourcePath: "bad.csv" });
  assert.equal(result.cards.length, 0);
  assert.equal(result.skipped, 1);
  assert.equal(result.errors.length, 1);
});

test("plugin: imports a Kahoot CSV and preserves its choices in the card", async () => {
  const notes = [
    {
      path: "kahoot.csv",
      text: "Question,Answer 1,Answer 2,Answer 3,Answer 4,Time limit (seconds),Correct answer(s)\nWhat is 2 + 2?,4,3,5,6,20,1\n",
    },
    { path: "kahoot.xlsx", text: "not a CSV" },
  ];
  const { app, plugin } = await setup(notes);
  const result = await plugin.importCardsFromQuestionSet("kahoot.csv", "kahoot", { deck: "Biology", course: "BIO 101" });
  assert.equal(result.created, 1);
  assert.match(app.created[0].text, /question_set: "kahoot"/);
  assert.match(app.created[0].text, /choice_1: "4"/);
  assert.match(app.created[0].text, /choice_4: "6"/);
  assert.match(app.created[0].text, /correct_choices: "1"/);
  assert.match(app.created[0].text, /time_limit: 20/);
  assert.match(app.created[0].text, /course: "BIO 101"/);
  await assert.rejects(() => plugin.importCardsFromQuestionSet("kahoot.xlsx", "kahoot", {}), /Save the spreadsheet as CSV/);
});

test("question-set export: round-trips choices to each platform layout", () => {
  const card = {
    fm: {
      card_id: "q1",
      item_type: "card",
      deck: "Biology",
      choice_1: "A",
      choice_2: "B",
      choice_3: "C",
      choice_4: "D",
      correct_choices: "2",
      time_limit: 30,
    },
    body: { front: "Which one?", back: "B" },
  };

  const kahoot = importer.cardsToQuestionSet("kahoot", [card]);
  assert.match(kahoot, /^Question,Answer 1,Answer 2,Answer 3,Answer 4,Time limit \(seconds\),Correct answer\(s\)/);
  const kahootBack = importer.parseQuestionSetText(kahoot, { format: "kahoot" });
  assert.equal(kahootBack.cards[0].front, "Which one?");
  assert.equal(kahootBack.cards[0].back, "B");
  assert.equal(kahootBack.cards[0].correctChoices, "2");

  const blooket = importer.cardsToQuestionSet("blooket", [card]);
  assert.match(blooket, /^Question,Answer 1,Answer 2,Answer 3,Answer 4,Time Limit \(sec\),Correct Answer\(s\)/);
  assert.equal(importer.parseQuestionSetText(blooket, { format: "blooket" }).cards[0].back, "B");

  const gimkit = importer.cardsToQuestionSet("gimkit", [card]);
  assert.match(gimkit, /^Question,Correct Answer,Incorrect Answer 1,Incorrect Answer 2,Incorrect Answer 3/);
  const gimkitBack = importer.parseQuestionSetText(gimkit, { format: "gimkit" }).cards[0];
  assert.equal(gimkitBack.back, "B");
  assert.deepEqual(gimkitBack.choices.slice(1), ["A", "C", "D"]);

  assert.equal(importer.cardsToQuizlet([card]), "Which one?\tB\n");
});

test("Anki export: round-trips decks, tags, basic cards and cloze markers", () => {
  const basic = {
    fm: { card_id: "q1", deck: "Biology", tags: ["exam prep"] },
    body: { front: "Which one?", back: "B" },
  };
  const cloze = {
    fm: { card_id: "c1", deck: "Biology", card_type: "cloze" },
    body: { cardType: "cloze", front: "The capital is […].", back: "Paris" },
  };

  const text = importer.cardsToAnki([basic, cloze]);
  assert.match(text, /^#separator:tab/);
  assert.match(text, /^#notetype column:1/m);
  assert.match(text, /^#deck column:2/m);
  assert.match(text, /^#tags column:5/m);

  const parsed = importer.parseAnkiText(text, { deck: "Fallback" });
  assert.equal(parsed.cards.length, 2);
  assert.equal(parsed.cards[0].front, "Which one?");
  assert.equal(parsed.cards[0].back, "B");
  assert.equal(parsed.cards[0].deck, "Biology");
  assert.deepEqual(parsed.cards[0].tags, ["exam_prep"]);
  assert.equal(parsed.cards[1].cardType, "cloze");
  assert.equal(parsed.cards[1].back, "Paris");
  assert.match(parsed.cards[1].front, /\{\{c1::Paris\}\}/);
});

test("card notes keep question-set properties in frontmatter", () => {
  const note = T.cards.cardNote({
    front: "Which one?",
    back: "B",
    deck: "Biology",
    questionSet: "kahoot",
    choices: ["A", "B", "C", "D"],
    correctChoices: "2",
    timeLimit: 30,
  });
  assert.match(note.text, /question_set: "kahoot"/);
  assert.match(note.text, /choice_1: "A"/);
  assert.match(note.text, /correct_choices: "2"/);
  assert.match(note.text, /time_limit: 30/);
});

test("plugin: exports the filtered cards to a CSV file", async () => {
  const notes = [
    {
      path: "Cards/Biology/Q.md",
      fm: {
        card_id: "q1",
        item_type: "card",
        deck: "Biology",
        choice_1: "A",
        choice_2: "B",
        choice_3: "C",
        choice_4: "D",
        correct_choices: "2",
      },
      text: "## Front\nWhich one?\n\n## Back\nB",
    },
  ];
  const { app, plugin } = await setup(notes);
  const result = await plugin.exportCards("kahoot", { deck: "Biology" });
  assert.match(result.path, /^Cards\/exports\/Biology kahoot /);
  assert.equal(result.count, 1);
  const exported = app.created.find((file) => file.path === result.path);
  assert.ok(exported);
  assert.match(exported.text, /^Question,Answer 1,Answer 2,Answer 3,Answer 4,Time limit \(seconds\),Correct answer\(s\)/);
  assert.match(exported.text, /Which one\?,A,B,C,D,20,2/);
});

test("plugin: exports the filtered cards as an Anki text file", async () => {
  const notes = [
    {
      path: "Cards/Biology/Q.md",
      fm: { card_id: "q1", item_type: "card", deck: "Biology" },
      text: "## Front\nWhich one?\n\n## Back\nB",
    },
  ];
  const { app, plugin } = await setup(notes);
  const result = await plugin.exportCards("anki", { deck: "Biology" });
  assert.match(result.path, /^Cards\/exports\/Biology anki .*\.txt$/);
  assert.equal(result.count, 1);
  const exported = app.created.find((file) => file.path === result.path);
  assert.ok(exported);
  assert.match(exported.text, /^#separator:tab/);
  assert.match(exported.text, /\tBiology\tWhich one\?\tB\t/);
});

test("generic CSV: detects delimiter, header columns, tags and skipped rows", () => {
  const text = [
    "Term;Definition;Deck;Course;Tags;Notes",
    "hola;hello;Spanish;SPAN 101;greeting,basic;A greeting",
    ";missing;Spanish;;;",
    "adiós;goodbye;Spanish;;;",
  ].join("\n");
  const result = importer.parseGenericCsv(text, { sourcePath: "Languages/spanish.csv", deck: "Fallback" });
  assert.equal(result.delimiter, ";");
  assert.deepEqual(result.headers.slice(0, 3), ["Term", "Definition", "Deck"]);
  assert.equal(result.hasHeader, true);
  assert.equal(result.mapping.front, 0);
  assert.equal(result.mapping.back, 1);
  assert.equal(result.cards.length, 2);
  assert.equal(result.skipped, 1);
  assert.equal(result.errors.length, 1);
  assert.equal(result.cards[0].deck, "Spanish");
  assert.equal(result.cards[0].course, "SPAN 101");
  assert.deepEqual(result.cards[0].tags, ["greeting", "basic"]);
  assert.equal(result.cards[0].notes, "A greeting");
  assert.equal(result.cards[0].importFormat, "csv");
  assert.equal(result.preview.length, 3);
  assert.equal(result.preview[1].front, "");
});

test("generic CSV: explicit mapping, headerless files and custom column names", () => {
  const noHeader = importer.parseGenericCsv("hello\thola\nbye\tadiós", { hasHeader: false });
  assert.equal(noHeader.hasHeader, false);
  assert.equal(noHeader.cards.length, 2);
  assert.equal(noHeader.cards[0].front, "hello");
  assert.equal(noHeader.cards[0].back, "hola");

  const custom = importer.parseGenericCsv("Definition|Term\nhello|hola", { hasHeader: true, mapping: { front: 1, back: 0 } });
  assert.equal(custom.cards[0].front, "hola");
  assert.equal(custom.cards[0].back, "hello");

  const incomplete = importer.parseGenericCsv("First|Second\none|two", { hasHeader: true });
  assert.equal(incomplete.cards.length, 0);
  assert.match(incomplete.errors[0], /Choose a Front column/);
  assert.equal(incomplete.preview.length, 1);
});

test("plugin: generic CSV previews columns, saves the mapping and writes source properties", async () => {
  const notes = [
    {
      path: "imports/spanish.csv",
      text: "Term,Definition,Deck,Course,Tags\nhola,hello,Spanish,SPAN 101,greeting\n,missing,Spanish,,\nadiós,goodbye,Spanish,,farewell\n",
    },
    { path: "imports/not-a-table.xlsx", text: "not a csv" },
  ];
  const { app, plugin } = await setup(notes);

  const preview = await plugin.previewCardsCsv("imports/spanish.csv", { deck: "Fallback" });
  assert.equal(preview.cards.length, 2);
  assert.equal(preview.skipped, 1);
  assert.equal(preview.mapping.deck, 2);
  assert.deepEqual(preview.preview[0], { row: 2, front: "hola", back: "hello", deck: "Spanish", course: "SPAN 101" });

  const result = await plugin.importCardsFromCsv("imports/spanish.csv", { deck: "Fallback" });
  assert.equal(result.created, 2);
  assert.equal(result.skippedRows, 1);
  assert.equal(app.created.length, 2);
  // Obsidian's metadata cache reads frontmatter from a newly created note; the
  // fake vault needs the same step before a second import can see the keys.
  for (const created of app.created) {
    const file = app.files.find((f) => f.path === created.path);
    const frontmatter = created.text.match(/^---\n([\s\S]*?)\n---/);
    if (file && frontmatter) file.fm = obsidian.parseYaml(frontmatter[1]);
  }
  assert.match(app.created[0].text, /import_source: "imports\/spanish.csv"/);
  assert.match(app.created[0].text, /import_format: "csv"/);
  assert.match(app.created[0].text, /imported_on: "\d{4}-\d{2}-\d{2}"/);
  assert.match(app.created[0].text, /import_batch: "import-/);
  assert.match(app.created[0].text, /course: "SPAN 101"/);
  assert.match(app.created[0].text, /tags:/);
  assert.deepEqual(plugin.settings.cards.csvMappings[result.headerKey], result.mapping);

  const again = await plugin.importCardsFromCsv("imports/spanish.csv", { deck: "Fallback" });
  assert.equal(again.created, 0);
  assert.equal(again.skipped, 2);
  assert.equal(app.created.length, 2, "re-importing the same deck does not duplicate cards");
  await assert.rejects(() => plugin.previewCardsCsv("imports/not-a-table.xlsx"), /Choose a \.csv/);
});

test("plugin: an explicit CSV mapping is not replaced by a saved preset", async () => {
  const notes = [{ path: "imports/swapped.csv", text: "Definition,Term\nhello,hola\n" }];
  const { app, plugin } = await setup(notes);
  const result = await plugin.importCardsFromCsv("imports/swapped.csv", {
    hasHeader: true,
    mapping: { front: 1, back: 0 },
    saveMapping: true,
  });
  assert.equal(result.created, 1);
  assert.match(app.created[0].text, /## Front\n\nhola/);
  const preview = await plugin.previewCardsCsv("imports/swapped.csv", { hasHeader: true });
  assert.equal(preview.cards[0].front, "hola", "the saved mapping keeps the reversed column choice");
});

test("gift: multiple choice, true/false, short answer, escaped text and feedback", () => {
  const text = `::Capital::What is the capital of France?{=Paris ~Lyon ~Marseille}

::Sky::The sky is blue.{TRUE}

Short answer: what is 2 + 2?{=4}

Escaped answer?{=a \\= b ~wrong}

Feedback question?{=Right ~Wrong #### because Right is correct}

Matching question?{=A -> B =C -> D}
`;
  const result = importer.parseGiftText(text, { sourcePath: "moodle.gift", deck: "Moodle" });
  assert.equal(result.cards.length, 5);
  assert.equal(result.cards[0].front, "What is the capital of France?");
  assert.equal(result.cards[0].back, "Paris");
  assert.equal(result.cards[0].deck, "Moodle");
  assert.match(result.cards[0].importKey, /^gift:/);
  assert.equal(result.cards[1].back, "TRUE");
  assert.equal(result.cards[2].back, "4");
  assert.equal(result.cards[3].back, "a = b");
  assert.equal(result.cards[4].back, "Right");
  assert.equal(result.skipped, 1, "matching questions are skipped explicitly");
});

test("plugin: imports a Moodle GIFT file as ordinary card notes", async () => {
  const notes = [
    {
      path: "Imports/moodle.gift",
      text: "::Capital::What is the capital of France?{=Paris ~Lyon}\n\n2 + 2?{=4}\n",
    },
  ];
  const { app, plugin } = await setup(notes);
  const result = await plugin.importCardsFromGift("Imports/moodle.gift", { deck: "Moodle" });
  assert.equal(result.created, 2);
  assert.equal(app.created.length, 2);
  assert.ok(app.created.every((card) => /import_key: "gift:/.test(card.text)));
  assert.ok(app.created.every((card) => /deck: "Moodle"/.test(card.text)));
});

test("moodle xml: multichoice, true/false, short answer and numerical; unsupported types are skipped", () => {
  const text = `<?xml version="1.0"?>
<quiz>
<question type="category"><category><text>Default</text></category></question>
<question type="multichoice">
  <name><text>Capital</text></name>
  <questiontext format="html"><text><![CDATA[What is the capital of <b>France</b>?]]></text></questiontext>
  <answer fraction="100"><text>Paris</text></answer>
  <answer fraction="0"><text>Lyon</text></answer>
</question>
<question type="truefalse">
  <name><text>Sky</text></name>
  <questiontext><text>The sky is blue.</text></questiontext>
  <answer fraction="100"><text>true</text></answer>
  <answer fraction="0"><text>false</text></answer>
</question>
<question type="shortanswer">
  <name><text>Math</text></name>
  <questiontext><text>2 + 2?</text></questiontext>
  <answer fraction="100"><text>4</text></answer>
</question>
<question type="numerical">
  <name><text>Half</text></name>
  <questiontext><text>Half of 10?</text></questiontext>
  <answer fraction="100"><text>5</text></answer>
</question>
<question type="matching"><questiontext><text>Match these</text></questiontext></question>
</quiz>`;
  const result = importer.parseMoodleXml(text, { sourcePath: "moodle.xml", deck: "Moodle" });
  assert.equal(result.cards.length, 4);
  assert.equal(result.cards[0].front, "What is the capital of **France**?");
  assert.equal(result.cards[0].back, "Paris");
  assert.equal(result.cards[1].back, "true");
  assert.equal(result.cards[2].back, "4");
  assert.equal(result.cards[3].back, "5");
  assert.equal(result.skipped, 2);
  assert.match(result.cards[0].importKey, /^moodle:/);
});

test("qti: QTI 1.2 response labels and QTI 2.1 simple choices map to the correct back", () => {
  const qti12 = `<questestinterop><assessment><section>
<item title="Capital">
  <presentation>
    <material><mattext>What is the capital of France?</mattext></material>
    <response_lid ident="response1" rcardinality="Single"><render_choice>
      <response_label ident="A"><material><mattext>Paris</mattext></material></response_label>
      <response_label ident="B"><material><mattext>Lyon</mattext></material></response_label>
    </render_choice></response_lid>
  </presentation>
  <resprocessing><respcondition><conditionvar><varequal respident="response1">A</varequal></conditionvar></respcondition></resprocessing>
</item>
</section></assessment></questestinterop>`;
  const first = importer.parseQtiXml(qti12, { sourcePath: "quiz.xml", deck: "QTI" });
  assert.equal(first.cards.length, 1);
  assert.equal(first.cards[0].front, "What is the capital of France?");
  assert.equal(first.cards[0].back, "Paris");
  assert.match(first.cards[0].importKey, /^qti:/);

  const qti21 = `<qti-assessment-item identifier="q2" title="Math">
  <qti-item-body>
    <qti-prompt>2 + 2?</qti-prompt>
    <qti-simple-choice identifier="A">4</qti-simple-choice>
    <qti-simple-choice identifier="B">5</qti-simple-choice>
  </qti-item-body>
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response><qti-value>A</qti-value></qti-correct-response>
  </qti-response-declaration>
</qti-assessment-item>`;
  const second = importer.parseQtiXml(qti21, { sourcePath: "quiz21.xml", deck: "QTI" });
  assert.equal(second.cards.length, 1);
  assert.equal(second.cards[0].front, "2 + 2?");
  assert.equal(second.cards[0].back, "4");
  assert.equal(importer.parseLmsXml(qti21).cards.length, 1);
  assert.equal(importer.parseLmsXml("<quiz><question type=\"truefalse\"><questiontext><text>True?</text></questiontext><answer fraction=\"100\"><text>true</text></answer></question></quiz>").cards.length, 1);
});

test("plugin: imports a Moodle XML quiz bank as ordinary card notes", async () => {
  const notes = [
    {
      path: "Imports/moodle.xml",
      text: '<quiz><question type="multichoice"><name><text>Capital</text></name><questiontext><text>Capital of France?</text></questiontext><answer fraction="100"><text>Paris</text></answer><answer fraction="0"><text>Lyon</text></answer></question></quiz>',
    },
  ];
  const { app, plugin } = await setup(notes);
  const result = await plugin.importCardsFromLmsXml("Imports/moodle.xml", "moodlexml", { deck: "Moodle" });
  assert.equal(result.created, 1);
  assert.match(app.created[0].text, /import_key: "moodle:/);
  assert.match(app.created[0].text, /deck: "Moodle"/);
});

test("mochi: Markdown sides, *** separators and #card tags", () => {
  const first = importer.parseMochiMarkdown("#card\nhola\n---\nhello", { sourcePath: "Mochi/Spanish/hola.md", deck: "Spanish" });
  assert.equal(first.cards.length, 1);
  assert.equal(first.cards[0].front, "hola");
  assert.equal(first.cards[0].back, "hello");
  assert.equal(first.cards[0].deck, "Spanish");
  assert.match(first.cards[0].importKey, /^mochi:/);

  const second = importer.parseMochiMarkdown("Question\n***\nFirst side\n\nSecond side", { sourcePath: "Mochi/q.md" });
  assert.equal(second.cards.length, 1);
  assert.equal(second.cards[0].back, "First side\n\nSecond side");
  assert.equal(importer.parseMochiMarkdown("just one side", { sourcePath: "Mochi/one.md" }).skipped, 1);
});

test("plugin: imports a folder of Mochi Markdown files using the folder as the deck", async () => {
  const notes = [
    { path: "Mochi/Spanish/hola.md", text: "hola\n---\nhello\n" },
    { path: "Mochi/Spanish/one-sided.md", text: "no separator here" },
  ];
  const { app, plugin } = await setup(notes);
  const result = await plugin.importCardsFromMochi("Mochi", {});
  assert.equal(result.created, 1);
  assert.match(app.created[0].text, /deck: "Spanish"/);
  assert.match(app.created[0].text, /import_key: "mochi:/);
});

test("crowdanki: nested decks, HTML fields, tags, cloze and a plugin import", async () => {
  const data = {
    name: "Languages",
    notes: [{ guid: "root-note", modelName: "Basic", fields: ["Root front", "Root back"] }],
    children: [
      {
        name: "Spanish",
        notes: [
          {
            guid: "spanish-note",
            modelName: "Basic",
            fields: ["<b>hola</b>", "hello"],
            tags: ["greeting"],
          },
          { guid: "cloze-note", modelName: "Cloze", fields: ["The capital is {{c1::Paris}}."] },
        ],
      },
    ],
  };
  const parsed = importer.parseCrowdAnkiJson(JSON.stringify(data), { sourcePath: "Languages.json" });
  assert.equal(parsed.cards.length, 3);
  assert.equal(parsed.cards[0].deck, "Languages");
  assert.equal(parsed.cards[1].deck, "Languages::Spanish");
  assert.equal(parsed.cards[1].front, "**hola**");
  assert.deepEqual(parsed.cards[1].tags, ["greeting"]);
  assert.equal(parsed.cards[2].cardType, "cloze");
  assert.equal(parsed.cards[2].back, "Paris");
  assert.match(parsed.cards[1].importKey, /^crowdanki:spanish-note$/);

  const { app, plugin } = await setup([{ path: "Imports/Languages.json", text: JSON.stringify(data) }]);
  const result = await plugin.importCardsFromCrowdAnki("Imports/Languages.json", {});
  assert.equal(result.created, 3);
  assert.match(app.created[0].text, /import_key: "crowdanki:root-note"/);
  assert.match(app.created[1].text, /deck: "Languages::Spanish"/);
});

test("plugin: import preview counts duplicates, update preserves history notes, copy creates a new key", async () => {
  const source = "Imports/review.gift";
  const parsed = importer.parseGiftText("Q?{=A}", { sourcePath: source, deck: "Moodle" });
  const key = parsed.cards[0].importKey;
  const existing = {
    path: "Cards/Moodle/Q.md",
    fm: {
      card_id: "c1",
      item_type: "card",
      deck: "Moodle",
      import_key: key,
      attempts: 7,
      correct_count: 5,
      streak: 3,
      next_review: "2026-12-01",
      history: ["2026-11-01 | correct"],
    },
    text: `---\ncard_id: c1\nitem_type: card\ndeck: Moodle\nimport_key: "${key}"\nattempts: 7\ncorrect_count: 5\nstreak: 3\nnext_review: "2026-12-01"\nhistory:\n  - "2026-11-01 | correct"\n---\n\n## Front\nOld question\n\n## Back\nOld answer\n\n## Notes\nKeep this note\n`,
  };
  const { app, plugin } = await setup([{ path: source, text: "Q?{=A}" }, existing]);

  const preview = await plugin.previewCardsImport("gift", source, { deck: "Moodle" });
  assert.equal(preview.total, 1);
  assert.equal(preview.duplicates, 1);
  assert.deepEqual(preview.duplicatePaths, ["Cards/Moodle/Q.md"]);
  assert.equal(preview.duplicateDetails.length, 1);
  assert.equal(preview.duplicateDetails[0].path, "Cards/Moodle/Q.md");
  assert.ok(preview.duplicateDetails[0].fields.some((field) => field.key === "front" && field.after === "Q?"));

  const updated = await plugin.importCardsFromGift(source, { deck: "Moodle", duplicateMode: "update" });
  assert.equal(updated.updated, 1);
  const file = app.files.find((f) => f.path === "Cards/Moodle/Q.md");
  assert.match(file.text, /## Front\n\nQ\?/);
  assert.match(file.text, /## Notes\n\nKeep this note/);
  assert.equal(file.fm.attempts, 7, "attempts are preserved");
  assert.equal(file.fm.correct_count, 5);
  assert.equal(file.fm.streak, 3);
  assert.deepEqual(file.fm.history, ["2026-11-01 | correct"]);

  const copied = await plugin.importCardsFromGift(source, { deck: "Moodle", duplicateMode: "copy" });
  assert.equal(copied.copied, 1);
  assert.equal(app.created.length, 1);
  assert.match(app.created[0].text, /import_key: "gift:.*~copy-/);
  assert.match(app.created[0].text, /## Front\n\nQ\?/);
});
