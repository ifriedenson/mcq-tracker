"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const cards = T.cards;

const CARD_NOTE = (fm, body) => `---\ncard_id: test-card\nitem_type: card\ndeck: Biology\n---\n\n${body}`;

const SETTINGS = {
  cards: {
    enabled: true,
    newCardFolder: "Cards",
    defaultDeck: "General",
    reviewLimit: 20,
    order: "due",
    decks: [{ name: "Biology", folder: "Courses/Bio", course: "BIOL 201" }],
  },
  calendar: { subjectFolders: { "CHEM 101": "Courses/Chem" } },
};

const NOTES = [
  {
    path: "Courses/Bio/cell.md",
    noFm: true,
    fm: { card_id: "cell", item_type: "card", deck: "Biology" },
    text: CARD_NOTE({}, "## Front\nWhat is a cell?\n\n## Back\nThe basic unit of life."),
  },
  {
    path: "Courses/Bio/mitosis.md",
    noFm: true,
    fm: { card_id: "mitosis", item_type: "card", deck: "Biology", attempts: 2, correct_count: 1, next_review: "2020-01-01" },
    text: CARD_NOTE({}, "## Front\nMitosis\n\n## Back\nCell division."),
  },
  {
    path: "Courses/Chem/mole.md",
    noFm: true,
    fm: { card_id: "mole", item_type: "card" },
    text: CARD_NOTE({}, "## Front\nA mole\n\n## Back\n6.022 × 10²³ particles."),
  },
  {
    path: "Questions/q.md",
    noFm: true,
    fm: { question_id: "q", answer: "B" },
    text: "## Question\nNot a card",
  },
];

async function setup(notes = NOTES, saved) {
  const app = makeApp(notes);
  // The stand-in adds a question_id to every note unless told not to. Card notes
  // need their own properties instead.
  notes.forEach((n, i) => {
    if (n.noFm && n.fm) app.files[i].fm = { ...n.fm };
  });
  const plugin = new QT(app);
  if (saved) plugin.saved = saved;
  await plugin.onload();
  plugin.settings.cards = cards.mergeCardSettings(saved && saved.cards ? saved.cards : SETTINGS.cards);
  plugin.settings.calendar.subjectFolders = { ...SETTINGS.calendar.subjectFolders };
  obsidian.notices.length = 0;
  return { app, plugin };
}

test("cards: notes are recognised without swallowing questions", () => {
  assert.equal(cards.isCardNote({ item_type: "card" }), true);
  assert.equal(cards.isCardNote({ item_type: "vocab" }), true);
  assert.equal(cards.isCardNote({ card_id: "c1" }), true);
  assert.equal(cards.isCardNote({ card_id: "c1", question_id: "q1" }), false);
  assert.equal(cards.isCardNote({ question_id: "q1" }), false);
});

test("cards: basic, reversed, cloze and vocabulary bodies parse", () => {
  const basic = cards.parseCardBody("## Front\nAlpha\n\n## Back\nBeta", { item_type: "card" });
  assert.equal(basic.front, "Alpha");
  assert.equal(basic.back, "Beta");
  assert.equal(basic.cardType, "basic");

  const reversed = cards.parseCardBody("## Front\nAlpha\n\n## Back\nBeta", { card_type: "reversed" });
  assert.equal(reversed.front, "Beta", "reversed cards ask with the old back");
  assert.equal(reversed.back, "Alpha");

  const cloze = cards.parseCardBody("## Front\nThe capital of France is ==Paris==.", { card_type: "cloze" });
  assert.match(cloze.front, /\[…\]/);
  assert.equal(cloze.back, "Paris");
  assert.deepEqual(cards.parseCloze("A {{c1::red}} and ==blue== thing").answers, ["red", "blue"]);

  const vocab = cards.parseCardBody(
    "## Term\nhablar\n\n## Definition\nto speak\n\n## Example\nQuiero hablar contigo.",
    { item_type: "vocab", language: "Spanish", part_of_speech: "verb" }
  );
  assert.equal(vocab.kind, "vocab");
  assert.equal(vocab.front, "hablar");
  assert.equal(vocab.back, "to speak");
  assert.equal(vocab.example, "Quiero hablar contigo.");
  assert.equal(vocab.language, "Spanish");
});

test("cards: decks and courses resolve from properties, deck folders and calendar mappings", () => {
  assert.equal(cards.deckOf({}, SETTINGS, "Courses/Bio/Week 1/cell.md"), "Biology");
  assert.equal(cards.deckOf({ deck: "Spanish verbs" }, SETTINGS, "Courses/Bio/cell.md"), "Spanish verbs");
  assert.equal(cards.courseOf({}, SETTINGS, "Courses/Bio/cell.md", "Biology"), "BIOL 201");
  assert.equal(cards.courseOf({}, SETTINGS, "Courses/Chem/lab.md", "General"), "CHEM 101");
  assert.equal(cards.courseOf({ course: "HON 101" }, SETTINGS, "Courses/Bio/cell.md", "Biology"), "HON 101");
  assert.equal(cards.courseForFolder(SETTINGS, "Courses/Bio/deep/cell.md"), "BIOL 201");
});

test("cards: the due queue includes due and new work, and filtering is deck/course aware", () => {
  const list = [
    { file: { path: "a" }, fm: { card_id: "a", next_review: "2020-01-01", attempts: 1 }, deck: "A", course: "C1" },
    { file: { path: "b" }, fm: { card_id: "b", attempts: 0 }, deck: "A", course: "C1" },
    { file: { path: "c" }, fm: { card_id: "c", next_review: "2999-01-01", attempts: 2 }, deck: "B", course: "C2" },
  ];
  const due = cards.cardQueue(list, { today: "2026-10-29", limit: 10 });
  assert.deepEqual(due.map((c) => c.fm.card_id), ["a", "b"]);
  const all = cards.cardQueue(list, { today: "2026-10-29", order: "all", limit: 10 });
  assert.deepEqual(all.map((c) => c.fm.card_id), ["a", "b", "c"]);
  assert.deepEqual(cards.cardQueue(list, { today: "2026-10-29", deck: "B", order: "all" }).map((c) => c.fm.card_id), ["c"]);
  assert.deepEqual(cards.cardQueue(list, { today: "2026-10-29", course: "C1" }).map((c) => c.fm.card_id), ["a", "b"]);
  assert.equal(cards.cardQueue(list, { today: "2026-10-29", limit: 1 }).length, 1);
  assert.deepEqual(cards.cardStats(list, "2026-10-29"), { total: 3, due: 1, fresh: 1 });
});

test("cards: creating a note writes durable deck, course and tracking properties", () => {
  const made = cards.cardNote({
    kind: "vocab",
    deck: "Spanish verbs",
    course: "SPAN 101",
    front: "hablar",
    back: "to speak",
    example: "Quiero hablar.",
    language: "Spanish",
    partOfSpeech: "verb",
  });
  assert.match(made.text, /item_type: vocab/);
  assert.match(made.text, /deck: "Spanish verbs"/);
  assert.match(made.text, /course: "SPAN 101"/);
  assert.match(made.text, /language: "Spanish"/);
  assert.match(made.text, /attempts: 0/);
  assert.match(made.text, /## Term\n\nhablar/);
  assert.match(made.text, /## Definition\n\nto speak/);
});

test("cards: explicit ratings map to the ladder and FSRS", () => {
  const now = new Date("2026-10-29T10:00:00");
  const next = (grade, prev) => {
    const fm = { streak: prev || 0, history: [] };
    T.applyAttempt(fm, { ...cards.cardAttempt(grade, 12), now }, [1, 3, 7, 21, 60], {});
    return fm;
  };
  assert.equal(next("again", 4).streak, 0);
  assert.equal(next("again", 4).result, "incorrect");
  assert.equal(next("hard", 4).streak, 4);
  assert.equal(next("good", 0).streak, 1);
  assert.equal(next("easy", 0).next_review, T.fmtDate(new Date("2026-11-01T10:00:00")));
  assert.equal(next("good", 0).last_card_rating, "good");

  const a = cards.cardAttempt("easy", 4);
  assert.equal(a.rating, 4);
  assert.equal(T.fsrs.gradeForAttempt(a.correct, a.conf, a.seconds, 0), 3);
});

test("cards: FSRS uses the learner's explicit rating, not just correctness", () => {
  const now = new Date("2026-10-29T10:00:00");
  const again = T.fsrs.reviewNote({ history: [] }, { ...cards.cardAttempt("again", 3), now }, 0.9);
  const easy = T.fsrs.reviewNote({ history: [] }, { ...cards.cardAttempt("easy", 3), now }, 0.9);
  assert.equal(again.rating, 1);
  assert.equal(easy.rating, 4);
  assert.ok(easy.days >= again.days, "Easy does not schedule sooner than Again");
});

test("plugin: cards are loaded with effective course tags and can be filtered", async () => {
  const { plugin } = await setup();
  const list = plugin.getCards();
  assert.equal(list.length, 3);
  assert.equal(list.find((c) => c.file.path === "Courses/Chem/mole.md").course, "CHEM 101");
  assert.deepEqual(plugin.filteredCards({ deck: "Biology" }).map((c) => c.fm.card_id).sort(), ["cell", "mitosis"]);
  assert.deepEqual(plugin.filteredCards({ course: "CHEM 101" }).map((c) => c.fm.card_id), ["mole"]);
  assert.equal(plugin.cardDecks().find((d) => d.name === "Biology").course, "BIOL 201");
});

test("plugin: creating a card writes it under the deck folder and stamps the course", async () => {
  const { app, plugin } = await setup();
  plugin.settings.cards.decks.push({ name: "Spanish verbs", folder: "", course: "SPAN 101" });
  const made = await plugin.createCard({
    kind: "vocab",
    deck: "Spanish verbs",
    front: "hablar",
    back: "to speak",
    language: "Spanish",
  });
  assert.equal(made.path, "Cards/Spanish verbs/hablar.md");
  assert.equal(app.created.at(-1).path, made.path);
  assert.match(app.created.at(-1).text, /course: "SPAN 101"/);
  assert.match(app.created.at(-1).text, /## Term\n\nhablar/);
  assert.deepEqual(app.folders, ["Cards", "Cards/Spanish verbs"]);
});

test("plugin: a card review writes the shared tracking properties and respects the offline path", async () => {
  const { plugin } = await setup();
  const card = plugin.getCards().find((c) => c.fm.card_id === "cell");
  const summary = await plugin.recordCardReview(card, "good", 9);
  assert.equal(summary.queued, false);
  assert.equal(card.file.fm.attempts, 1);
  assert.equal(card.file.fm.streak, 1);
  assert.equal(card.file.fm.last_card_rating, "good");
  assert.ok(card.file.fm.next_review);
  assert.match(card.file.fm.history[0], /\|correct\|9\|Good\|2\|/);
});

test("cards: answer mode and strictness resolve from the card, deck and global default", () => {
  const settings = {
    ...SETTINGS,
    cards: {
      ...SETTINGS.cards,
      answerMode: "type",
      gradingStrictness: "lenient",
      decks: [{ name: "Biology", folder: "Courses/Bio", course: "BIOL 201", answerMode: "speak", gradingStrictness: "strict" }],
    },
  };
  const inherited = cards.resolveCard({ path: "Courses/Bio/cell.md" }, { card_id: "cell", item_type: "card", deck: "Biology" }, settings);
  assert.equal(inherited.answerMode, "speak");
  assert.equal(inherited.gradingStrictness, "strict");

  const own = cards.resolveCard(
    { path: "Courses/Bio/cell.md" },
    { card_id: "cell", item_type: "card", deck: "Biology", answer_mode: "flip", grading_strictness: "standard" },
    settings
  );
  assert.equal(own.answerMode, "flip");
  assert.equal(own.gradingStrictness, "standard");
});

test("cards: answer-mode properties and accepted variants are written and parsed", () => {
  const made = cards.cardNote({
    deck: "Biology",
    front: "What is a cell?",
    back: "The basic unit of life.",
    answerMode: "type",
    gradingStrictness: "lenient",
    acceptedVariants: ["basic unit of life", "building block of life"],
  });
  const fm = { item_type: "card", answer_mode: "type", grading_strictness: "lenient", accepted_variants: ["basic unit of life"] };
  assert.match(made.text, /answer_mode: "type"/);
  assert.match(made.text, /grading_strictness: "lenient"/);
  assert.match(made.text, /accepted_variants:\n  - "basic unit of life"/);
  assert.deepEqual(cards.parseCardBody(made.text, fm).acceptedVariants, ["basic unit of life"]);
});

test("plugin: course tags can be backfilled from deck and calendar folder mappings", async () => {
  const { app, plugin } = await setup();
  const card = app.files.find((f) => f.path === "Courses/Chem/mole.md");
  assert.equal("course" in card.fm, false);
  const n = await plugin.tagCardsByCourse();
  assert.equal(n, 3, "each card inherits a course from its deck or folder");
  assert.equal(card.fm.course, "CHEM 101");
});

test("plugin: the Cards module is opt-in and its entry points point at settings", async () => {
  const app = makeApp(NOTES);
  const plugin = new QT(app);
  await plugin.onload();
  assert.equal(plugin.cardsEnabled(), false);
  assert.equal(await plugin.activateCards(), null);
  assert.ok(obsidian.notices.some((n) => /Cards module is off/.test(n)));
});

test("cards view: starts a review, flips, rates, and finishes", async () => {
  const { app, plugin } = await setup();
  plugin.settings.cards.reviewLimit = 1;
  const dom = makeDom();
  const view = new T.CardView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.render();
  assert.ok(dom.texts().includes("Cards"));
  assert.ok(dom.texts().some((t) => /Start review/.test(t)));

  await dom.click(/Start review/);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(view.state, "review");
  assert.ok(dom.texts().includes("Show answer"));
  await dom.click("Show answer");
  assert.ok(dom.texts().includes("Answer"));
  await dom.click("Good");
  assert.equal(view.state, "summary");
  assert.ok(dom.texts().includes("Review complete"));
});

test("cards view: a typed answer is graded locally and an override is saved", async () => {
  const { app, plugin } = await setup();
  plugin.settings.cards.answerMode = "type";
  plugin.settings.cards.reviewLimit = 1;
  const dom = makeDom();
  const view = new T.CardView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.render();
  await dom.click(/Start review/);
  await new Promise((r) => setTimeout(r, 0));
  const card = view.current;
  const answer = card.body.back;
  view.checkTyped(answer);
  assert.equal(view.verdict.verdict, "correct");
  assert.equal(view.suggestedGrade, "good");
  assert.ok(dom.texts().includes("Correct"));

  await dom.click("Hard");
  assert.equal(view.state, "summary");
  assert.equal(card.file.fm.last_verdict, "correct");
  assert.equal(card.file.fm.last_typed_answer, answer);
  assert.equal(card.file.fm.verdict_override, true);
  assert.equal(card.file.fm.graded_by, "deterministic");
});

test("cards view: an unsure typed answer gets an AI second opinion and records it", async () => {
  const { app, plugin } = await setup();
  plugin.settings.cards.answerMode = "type";
  plugin.settings.cards.reviewLimit = 1;
  plugin.settings.cards.aiGrading = true;
  plugin.settings.ai.enabled = true;
  let asked = null;
  plugin.gradeCardWithAi = async (card, typed, strictness) => {
    asked = { card, typed, strictness };
    return { verdict: "correct", suggestedGrade: "good", reason: "The AI accepted it.", matchedBy: "ai", gradedBy: "ai", confidence: 0.8 };
  };
  const dom = makeDom();
  const view = new T.CardView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.render();
  await dom.click(/Start review/);
  await new Promise((r) => setTimeout(r, 0));
  const card = view.current;
  await view.checkTyped("powerhouse");
  assert.equal(asked.typed, "powerhouse");
  assert.equal(view.verdict.verdict, "correct");
  assert.equal(view.verdict.gradedBy, "ai");
  await dom.click("Good");
  assert.equal(card.file.fm.graded_by, "ai");
  assert.equal(card.file.fm.grade_status, "graded");
  assert.equal(card.file.fm.grade_confidence, 0.8);
});

test("cards view: when AI is unavailable the answer waits, and rating it is recorded as a self-grade", async () => {
  const { app, plugin } = await setup();
  plugin.settings.cards.answerMode = "type";
  plugin.settings.cards.reviewLimit = 1;
  plugin.settings.cards.aiGrading = true;
  plugin.settings.ai.enabled = true;
  plugin.gradeCardWithAi = async () => {
    throw new Error("offline");
  };
  const dom = makeDom();
  const view = new T.CardView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.render();
  await dom.click(/Start review/);
  await new Promise((r) => setTimeout(r, 0));
  const card = view.current;
  await view.checkTyped("powerhouse");
  assert.equal(view.pendingGrade, true);
  assert.equal(plugin.pendingCardGrades().length, 1);
  assert.equal(view.verdict.verdict, "incorrect");
  await dom.click("Good");
  assert.equal(plugin.pendingCardGrades().length, 0, "self-grading removes the pending AI request");
  assert.equal(card.file.fm.graded_by, "self");
  assert.equal(card.file.fm.grade_status, "self");
});

test("cards view: pending typed grades are visible in the card list and can be retried", async () => {
  const { app, plugin } = await setup();
  const card = plugin.getCards().find((c) => c.file.path === "Courses/Bio/cell.md");
  card.body = { front: "Powerhouse of the cell", back: "mitochondria" };
  plugin.queueCardGrade(card, "powerhouse", "standard");
  let flushed = 0;
  let reviewed = "";
  plugin.flushPendingCardGrades = async () => {
    flushed++;
    return { graded: 1, remaining: 0, disabled: false };
  };

  const dom = makeDom();
  const view = new T.CardView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.reviewCard = async (c) => (reviewed = c.file.path);
  view.render();

  assert.ok(dom.texts().includes("1 pending AI grade"));
  assert.ok(dom.texts().includes("Powerhouse of the cell"));
  assert.ok(dom.texts().includes("Pending grade"));
  await dom.click("Review");
  assert.equal(reviewed, "Courses/Bio/cell.md");
  await dom.click("Grade now");
  assert.equal(flushed, 1);
});

test("plugin: pending typed answers are graded once and cleared from the queue", async () => {
  const { app, plugin } = await setup();
  plugin.settings.cards.aiGrading = true;
  plugin.settings.ai.enabled = true;
  plugin.gradeCardWithAi = async () => ({
    verdict: "correct",
    suggestedGrade: "good",
    reason: "The AI accepted it.",
    matchedBy: "ai",
    gradedBy: "ai",
    confidence: 0.9,
  });
  const dom = makeDom();
  const view = new T.CardView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.render();
  await dom.click(/Start review/);
  await new Promise((r) => setTimeout(r, 0));
  const card = view.current;
  plugin.queueCardGrade(card, "powerhouse", "standard");
  assert.equal(plugin.pendingCardGrades().length, 1);
  plugin.aiComplete = async () => '{"verdict":"correct","confidence":0.9,"feedback":"Accepted."}';
  const r = await plugin.flushPendingCardGrades();
  assert.equal(r.graded, 1);
  assert.equal(plugin.pendingCardGrades().length, 0);
  assert.equal(card.file.fm.last_verdict, "correct");
  assert.equal(card.file.fm.graded_by, "ai");
  assert.equal(card.file.fm.grade_status, "graded");
});
