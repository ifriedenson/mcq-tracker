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
