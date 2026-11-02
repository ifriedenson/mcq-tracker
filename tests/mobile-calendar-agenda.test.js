"use strict";
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { load, obsidian } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T } = load();

const hasClass = (dom, cls) => dom.all.some((el) => el.classes && el.classes.has(cls));
const texts = (dom) => dom.all.map((el) => el.meta && el.meta.text).filter((text) => typeof text === "string");

function phone() {
  obsidian.Platform.isMobile = true;
  obsidian.Platform.isPhone = true;
}

function desktop() {
  obsidian.Platform.isMobile = false;
  obsidian.Platform.isPhone = false;
}

after(desktop);

function reviewDay(date, notes, cards, minutes) {
  return { date, notes, cards, total: notes.length + cards.length, minutes };
}

function reviewSnapshot() {
  return {
    today: "2026-11-01",
    days: [
      reviewDay(
        "2026-11-01",
        [{ title: "Unit note", kind: "note", set: "Review", due: "2026-11-01", isNew: false, minutes: 2, path: "Notes/Unit.md" }],
        [],
        2
      ),
      reviewDay(
        "2026-11-02",
        [],
        [{ title: "Card one", kind: "card", deck: "Deck", due: "2026-11-02", isNew: false, minutes: 1, path: "Cards/One.md" }],
        1
      ),
    ],
    totals: { notes: 1, cards: 1, due: 2, minutes: 3 },
    next7: {
      days: [
        { date: "2026-11-01", total: 1, minutes: 2 },
        { date: "2026-11-02", total: 1, minutes: 1 },
      ],
      total: 2,
      minutes: 3,
    },
  };
}

function reviewPlugin(app) {
  const snapshot = reviewSnapshot();
  return {
    app,
    reviewCalendarEnabled: () => true,
    reviewCalendarSettings: () => ({ weekStartsOn: "monday" }),
    reviewCalendarSnapshot: () => snapshot,
    addActiveNoteToReview: async () => "",
    addActiveFolderToReview: async () => "",
    openSettings: () => {},
  };
}

function localPlugin(app) {
  return {
    app,
    localEventsEnabled: () => true,
    settings: {
      localEvents: {
        weekStartsOn: "monday",
        events: [
          {
            id: "study-group",
            title: "Study group",
            date: "2026-11-01",
            startTime: "10:00",
            endTime: "11:00",
            category: "study",
            color: "#4f9d69",
            repeat: "none",
          },
          {
            id: "weekly-review",
            title: "Weekly review",
            date: "2026-11-02",
            startTime: "09:00",
            category: "meeting",
            color: "#8b6fd6",
            repeat: "weekly",
          },
        ],
      },
    },
    deleteLocalEvent: async () => {},
    openSettings: () => {},
  };
}

test("review calendar renders a phone day agenda with day navigation", async () => {
  phone();
  const app = makeApp([]);
  const view = new T.ReviewCalendarView({ app }, reviewPlugin(app));
  const dom = makeDom();
  view.contentEl = dom.root;
  view.selected = "2026-11-01";
  view.render();

  assert.ok(hasClass(dom, "qt-day-agenda"), "phone view is missing the agenda");
  assert.ok(hasClass(dom, "qt-day-agenda-week"), "phone view is missing the week strip");
  assert.ok(!hasClass(dom, "qt-review-calendar-grid"), "phone view still renders the month grid");
  assert.ok(texts(dom).includes("Sunday, November 1"));
  assert.ok(texts(dom).includes("Due this day"));
  assert.ok(texts(dom).includes("Unit note"));
  assert.ok(texts(dom).includes("Prev"));
  assert.ok(texts(dom).includes("Next"));
  assert.ok(texts(dom).includes("Add note"));
  const addNote = dom.all.find((el) => el.meta.tag === "button" && el.meta.text === "Add note");
  assert.equal((addNote.meta.attrs || addNote.meta.attr)["aria-label"], "Add this note");
  assert.ok(hasClass(dom, "qt-day-agenda-actions"));

  await dom.click("Next");
  assert.equal(view.selected, "2026-11-02");
  assert.ok(texts(dom).includes("Card one"));
});

test("review calendar keeps the month grid on desktop and tablets", () => {
  const app = makeApp([]);
  for (const [mobile, phoneValue] of [
    [false, false],
    [true, false],
  ]) {
    obsidian.Platform.isMobile = mobile;
    obsidian.Platform.isPhone = phoneValue;
    const view = new T.ReviewCalendarView({ app }, reviewPlugin(app));
    const dom = makeDom();
    view.contentEl = dom.root;
    view.selected = "2026-11-01";
    view.render();
    assert.ok(hasClass(dom, "qt-review-calendar-grid"), "desktop should keep the month grid");
    assert.ok(!hasClass(dom, "qt-day-agenda"), "desktop should not get the mobile agenda");
  }
});

test("local events renders a phone day agenda and follows day navigation", async () => {
  phone();
  const app = makeApp([]);
  const view = new T.LocalEventsView({ app }, localPlugin(app));
  const dom = makeDom();
  view.contentEl = dom.root;
  view.selected = "2026-11-01";
  view.render();

  assert.ok(hasClass(dom, "qt-day-agenda"), "phone view is missing the agenda");
  assert.ok(hasClass(dom, "qt-day-agenda-week"), "phone view is missing the week strip");
  assert.ok(!hasClass(dom, "qt-local-events-grid"), "phone view still renders the month grid");
  assert.ok(texts(dom).includes("Sunday, November 1"));
  assert.ok(texts(dom).includes("Study group"));
  assert.ok(texts(dom).includes("10:00–11:00"));
  assert.ok(texts(dom).includes("Events this day"));
  assert.ok(texts(dom).includes("New event"));
  assert.ok(texts(dom).includes("Prev"));
  assert.ok(texts(dom).includes("Next"));

  await dom.click("Next");
  assert.equal(view.selected, "2026-11-02");
  assert.ok(texts(dom).includes("Weekly review"));
});

test("local events keeps the month grid on desktop and tablets", () => {
  const app = makeApp([]);
  for (const [mobile, phoneValue] of [
    [false, false],
    [true, false],
  ]) {
    obsidian.Platform.isMobile = mobile;
    obsidian.Platform.isPhone = phoneValue;
    const view = new T.LocalEventsView({ app }, localPlugin(app));
    const dom = makeDom();
    view.contentEl = dom.root;
    view.selected = "2026-11-01";
    view.render();
    assert.ok(hasClass(dom, "qt-local-events-grid"), "desktop should keep the month grid");
    assert.ok(!hasClass(dom, "qt-day-agenda"), "desktop should not get the mobile agenda");
  }
});

test("phone agendas collapse an empty day instead of leaving a tall blank card", () => {
  phone();
  const app = makeApp([]);
  const review = new T.ReviewCalendarView({ app }, reviewPlugin(app));
  const reviewDom = makeDom();
  review.contentEl = reviewDom.root;
  review.selected = "2026-11-03";
  review.render();
  const reviewCard = reviewDom.all.find((el) => el.classes.has("qt-day-agenda-list"));
  assert.ok(reviewCard, "the phone review agenda still renders its day card");
  assert.ok(reviewCard.classes.has("is-empty"));

  const local = new T.LocalEventsView({ app }, localPlugin(app));
  const localDom = makeDom();
  local.contentEl = localDom.root;
  local.selected = "2026-11-03";
  local.render();
  const localCard = localDom.all.find((el) => el.classes.has("qt-day-agenda-list"));
  assert.ok(localCard, "the phone local-events agenda still renders its day card");
  assert.ok(localCard.classes.has("is-empty"));
});

test("the agenda styles stay scoped to the agenda container", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");
  assert.match(css, /\.qt-day-agenda-week \{[^}]*grid-template-columns: repeat\(7/s);
  assert.match(css, /\.qt-day-agenda \.qt-study-row \{[^}]*align-items: flex-start/s);
  assert.match(css, /\.qt-day-agenda-phone \.qt-review-calendar-head \.qt-hint/);
});
