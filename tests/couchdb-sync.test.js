"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const sync = T.couchdbSync;

const ROW = (when, result, id) => `${when}|${result}|5|${result === "correct" ? "Good" : "Again"}|${result === "correct" ? 3 : 0}||${id}`;

test("CouchDB: defaults are off and addresses reject insecure remote HTTP", () => {
  const base = sync.normalizeCouchDb({});
  assert.equal(base.enabled, false);
  assert.equal(base.database, "mcq-tracker");
  assert.equal(base.url, "");
  assert.equal(sync.normalizeCouchDb({ url: "https://couch.example.com/", enabled: true }).url, "https://couch.example.com");
  assert.throws(() => sync.couchDbAddress({ url: "http://couch.example.com", database: "cards" }), /https/);
  assert.equal(sync.couchDbAddress({ url: "http://localhost:5984", database: "my cards" }), "http://localhost:5984/my%20cards");
  assert.equal(sync.couchDbDocId("deck/card 1"), "mcq-card-deck%2Fcard%201");
});

test("CouchDB: newest review wins the schedule while histories are unioned", () => {
  const local = {
    card_id: "c1",
    attempts: 1,
    correct_count: 1,
    streak: 1,
    history: [ROW("2026-01-01 10:00:00", "correct", "a1")],
    next_review: "2026-01-02",
    review_updated: "2026-01-01T10:00:00Z",
  };
  const remote = {
    card_id: "c1",
    attempts: 1,
    correct_count: 0,
    streak: 0,
    history: [ROW("2026-02-01 10:00:00", "incorrect", "a2")],
    next_review: "2026-02-02",
    scheduler: "fsrs",
    review_updated: "2026-02-01T10:00:00Z",
  };
  const merged = sync.mergeCardSyncStates(local, remote);
  assert.equal(merged.history.length, 2);
  assert.equal(merged.attempts, 2);
  assert.equal(merged.correct_count, 1);
  assert.equal(merged.streak, 0);
  assert.equal(merged.next_review, "2026-02-02");
  assert.equal(merged.scheduler, "fsrs");
  assert.equal(merged.review_updated, "2026-02-01T10:00:00Z");

  const backwards = sync.mergeCardSyncStates(remote, local);
  assert.equal(backwards.history.length, 2, "history union is order-independent");
  assert.equal(sync.stateTimestamp(backwards), "2026-02-01T10:00:00Z");
});

test("CouchDB: applying a state only writes review properties", () => {
  const fm = { card_id: "c1", deck: "Biology", history: [ROW("2026-01-01 10:00:00", "correct", "a1")] };
  const changed = sync.applyCardSyncState(fm, {
    card_id: "c1",
    attempts: 3,
    history: [ROW("2026-02-01 10:00:00", "correct", "a2")],
    next_review: "2026-02-03",
    review_updated: "2026-02-01T10:00:00Z",
  });
  assert.equal(changed, true);
  assert.equal(fm.deck, "Biology");
  assert.equal(fm.attempts, 3);
  assert.equal(fm.next_review, "2026-02-03");
  assert.equal(fm.history.length, 1);
});

test("CouchDB: client creates a missing database, reads docs and sends auth", async () => {
  const calls = [];
  const address = "https://couch.example.com/mcq-tracker";
  const request = async (req) => {
    calls.push(req);
    if (req.url === address && req.method === "GET") return { status: 404, json: { error: "not_found" } };
    if (req.url === address && req.method === "PUT") return { status: 201, json: { ok: true } };
    if (req.url.includes("/_all_docs")) {
      return {
        status: 200,
        json: {
          rows: [
            { id: "mcq-card-c1", doc: { _id: "mcq-card-c1", _rev: "1-a", state: { card_id: "c1", attempts: 2, review_updated: "2026-02-01T10:00:00Z" } } },
            { id: "mcq-card-c2", doc: { _id: "mcq-card-c2", _rev: "1-b" } },
          ],
        },
      };
    }
    if (req.url.includes("/mcq-card-missing")) return { status: 404, json: { error: "not_found" } };
    if (req.url.includes("/mcq-card-c1")) return { status: 201, json: { ok: true, rev: "2-a" } };
    return { status: 200, json: { db_name: "mcq-tracker" } };
  };
  const client = new sync.CouchDbClient(
    { url: "https://couch.example.com", database: "mcq-tracker", username: "me" },
    { password: "secret", request }
  );
  await client.ensureDatabase();
  assert.equal(calls[0].method, "GET");
  assert.equal(calls[1].method, "PUT");
  assert.match(calls[0].headers.Authorization, /^Basic /);
  const cards = await client.allCards();
  assert.match(calls.find((c) => c.url.includes("/_all_docs")).url, /startkey=%22mcq-card-%22/);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].state.attempts, 2);
  assert.equal(await client.getCard("missing"), null);
  const put = await client.putCard("c1", { card_id: "c1", attempts: 3 }, "1-a");
  assert.equal(put.rev, "2-a");
  const body = JSON.parse(calls[calls.length - 1].body);
  assert.equal(body._rev, "1-a");
  assert.equal(body.card_id, "c1");
  assert.equal(body.state.attempts, 3);
});

test("CouchDB: plugin pulls a newer remote review and pushes the merged state", async () => {
  const notes = [
    {
      path: "Cards/c1.md",
      noFm: true,
      fm: {
        card_id: "c1",
        item_type: "card",
        deck: "General",
        attempts: 1,
        correct_count: 1,
        streak: 1,
        history: [ROW("2026-01-01 10:00:00", "correct", "a1")],
        next_review: "2026-01-02",
        review_updated: "2026-01-01T10:00:00Z",
      },
      text: "---\ncard_id: c1\nitem_type: card\ndeck: General\n---\n\n## Front\nCapital of France?\n\n## Back\nParis\n",
    },
  ];
  const app = makeApp(notes);
  app.files[0].fm = { ...notes[0].fm };
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.cards.enabled = true;
  plugin.settings.cards.couchdb = { enabled: true, url: "http://localhost:5984", database: "mcq-tracker" };
  const address = "http://localhost:5984/mcq-tracker";
  const remoteState = {
    card_id: "c1",
    attempts: 1,
    correct_count: 0,
    streak: 0,
    history: [ROW("2026-02-01 10:00:00", "incorrect", "a2")],
    next_review: "2026-02-02",
    review_updated: "2026-02-01T10:00:00Z",
  };
  const calls = [];
  plugin.couchDbRequest = async (req) => {
    calls.push(req);
    if (req.url === address) return { status: 200, json: { db_name: "mcq-tracker" } };
    if (req.url.includes("/_all_docs")) return { status: 200, json: { rows: [{ id: "mcq-card-c1", doc: { _id: "mcq-card-c1", _rev: "1-a", state: remoteState } }] } };
    if (String(req.url).includes("/mcq-card-c1")) return { status: 201, json: { ok: true, rev: "2-a" } };
    return { status: 404, json: { error: "not_found" } };
  };
  obsidian.notices.length = 0;
  const result = await plugin.syncCardsCouchDb();
  assert.equal(result.error, undefined);
  assert.equal(result.pulled, 1);
  assert.equal(result.pushed, 1);
  assert.equal(app.files[0].fm.attempts, 2);
  assert.equal(app.files[0].fm.correct_count, 1);
  assert.equal(app.files[0].fm.next_review, "2026-02-02");
  assert.equal(app.files[0].fm.history.length, 2);
  assert.equal(plugin.settings.cards.couchdb.lastError, "");
  assert.ok(plugin.settings.cards.couchdb.lastSync);
  const body = JSON.parse(calls.find((c) => c.method === "PUT" && String(c.url).includes("/mcq-card-c1")).body);
  assert.equal(body.state.attempts, 2);
});

test("cards: guided creation saves a new deck folder and course", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.cards.enabled = true;
  plugin.settings.cards.newCardFolder = "Cards";
  const result = await plugin.createCard({
    kind: "card",
    deck: "Spanish",
    deckFolder: "Courses/Spanish",
    deckCourse: "SPAN 101",
    front: "hablar",
    back: "to speak",
  });
  assert.equal(result.path, "Courses/Spanish/hablar.md");
  assert.equal(result.course, "SPAN 101");
  const deck = plugin.settings.cards.decks.find((d) => d.name === "Spanish");
  assert.equal(deck.folder, "Courses/Spanish");
  assert.equal(deck.course, "SPAN 101");
  const created = app.created.find((f) => f.path === result.path);
  assert.match(created.text, /deck: \"Spanish\"/);
  assert.match(created.text, /course: \"SPAN 101\"/);
});

test("cards: the dialog preview shows both sides and flags reverse review", () => {
  assert.match(T.cardPreview({ front: "A", back: "B", cardType: "basic", kind: "card" }), /Front/);
  assert.match(T.cardPreview({ front: "A", back: "B", cardType: "basic", kind: "card" }), /Back/);
  assert.match(T.cardPreview({ front: "A", back: "B", cardType: "reversed", kind: "card" }), /reverse/);
  assert.match(T.cardPreview({ front: "hablar", back: "to speak", kind: "vocab" }), /Term/);
});
