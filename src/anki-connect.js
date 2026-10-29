"use strict";
/*
 * Optional AnkiConnect bridge. AnkiConnect is a local Anki add-on that exposes
 * a small JSON API on 127.0.0.1. This module only builds notes and calls that
 * API; it does not bundle AnkiConnect or any Anki code, and it never runs
 * unless the user turns the feature on.
 */
const { Modal, Notice, requestUrl } = require("obsidian");
const { hashString, str } = require("./util");

const DEFAULT_ANKI_CONNECT = {
  enabled: false, // no request is made until this is explicit
  url: "http://127.0.0.1:8765",
  deck: "", // blank keeps each card's own deck
  conflict: "report", // report | local | anki
};

const ANKI_VERSION = 6;

function normalizeAnkiConnect(value) {
  const src = value && typeof value === "object" ? value : {};
  const url = str(src.url).trim().replace(/\/+$/, "");
  return {
    enabled: src.enabled === true,
    url: /^https?:\/\//i.test(url) ? url : DEFAULT_ANKI_CONNECT.url,
    deck: str(src.deck).trim(),
    conflict: ["report", "local", "anki"].includes(str(src.conflict).toLowerCase()) ? str(src.conflict).toLowerCase() : "report",
  };
}

/** One stable record for comparing the local card with Anki. */
function syncRecord(value) {
  const src = value || {};
  const tags = (Array.isArray(src.tags) ? src.tags : str(src.tags).split(/[,;]+|\s+/)).map((tag) => str(tag).trim()).filter(Boolean);
  tags.sort((a, b) => a.localeCompare(b));
  return {
    front: str(src.front).trim(),
    back: str(src.back).trim(),
    deck: str(src.deck).trim(),
    tags,
    type: /cloze/i.test(str(src.type || src.modelName)) ? "Cloze" : "Basic",
  };
}

function syncHash(value) {
  return hashString(JSON.stringify(syncRecord(value)));
}

/** The card as Anki sees it, after the same front/back parsing used by push. */
function localSyncRecord(card) {
  const fm = (card && card.fm) || {};
  const body = (card && card.body) || {};
  const cloze = /cloze/i.test(str(fm.card_type)) || /cloze/i.test(str(body.cardType));
  return syncRecord({
    front: cloze ? body.rawFront || body.front : body.front,
    back: body.back,
    deck: (card && card.deck) || fm.deck,
    tags: tagsFor(fm),
    type: cloze ? "Cloze" : "Basic",
  });
}

function fieldValues(fields) {
  if (!fields) return [];
  if (Array.isArray(fields)) return fields.map((value) => str(value && value.value !== undefined ? value.value : value));
  if (typeof fields !== "object") return [];
  return Object.entries(fields)
    .map(([name, value], index) => ({
      name,
      order: value && value.order !== undefined ? Number(value.order) : index,
      value: str(value && value.value !== undefined ? value.value : value),
    }))
    .sort((a, b) => a.order - b.order)
    .map((entry) => entry.value);
}

function clozeAnswers(value) {
  const answers = [];
  const re = /\{\{c?\d*::([\s\S]*?)\}\}/g;
  let match;
  while ((match = re.exec(str(value)))) answers.push(match[1].trim());
  return answers;
}

/** Turn AnkiConnect notesInfo + cardsInfo replies into the same shape as a local card. */
function remoteSyncRecord(note, card) {
  const info = note || {};
  const cardInfo = card || {};
  const values = fieldValues(info.fields && Object.keys(info.fields).length ? info.fields : cardInfo.fields);
  const modelName = str(info.modelName || cardInfo.modelName);
  const cloze = /cloze/i.test(modelName);
  const front = values[0] || "";
  const back = cloze ? clozeAnswers(front).join(" · ") : values.slice(1).join("\n\n");
  const record = syncRecord({
    front,
    back,
    deck: cardInfo.deckName || info.deckName || "",
    tags: info.tags || cardInfo.tags || [],
    type: cloze ? "Cloze" : "Basic",
  });
  return Object.assign(record, {
    noteId: str(info.noteId),
    cardId: str(cardInfo.cardId || (Array.isArray(info.cards) ? info.cards[0] : "")),
    modelName,
    ord: Math.max(0, Math.round(Number(cardInfo.ord) || 0)),
    due: Number(cardInfo.due) || 0,
    interval: Math.max(0, Math.round(Number(cardInfo.interval !== undefined ? cardInfo.interval : cardInfo.ivl) || 0)),
    reps: Math.max(0, Math.round(Number(cardInfo.reps) || 0)),
    lapses: Math.max(0, Math.round(Number(cardInfo.lapses) || 0)),
  });
}

/** Decide one direction without writing anything. */
function syncDecision(local, remote, baseline) {
  const localHash = syncHash(local);
  const remoteHash = syncHash(remote);
  const old = baseline || {};
  if (!localHash || !remoteHash) return { action: "none", localHash, remoteHash, localDirty: false, remoteDirty: false };
  if (localHash === remoteHash) return { action: "none", localHash, remoteHash, localDirty: false, remoteDirty: false };
  const localDirty = !old.local || old.local !== localHash;
  const remoteDirty = !old.remote || old.remote !== remoteHash;
  if (localDirty && remoteDirty) return { action: "conflict", localHash, remoteHash, localDirty, remoteDirty };
  if (localDirty) return { action: "push", localHash, remoteHash, localDirty, remoteDirty };
  if (remoteDirty) return { action: "pull", localHash, remoteHash, localDirty, remoteDirty };
  return { action: "none", localHash, remoteHash, localDirty, remoteDirty };
}

function oneLine(value) {
  return str(value).replace(/\r?\n/g, " ").replace(/\t/g, " ").trim();
}

function tagsFor(fm) {
  const raw = Array.isArray(fm && fm.tags) ? fm.tags : str(fm && fm.tags).split(/[,;]+|\s+/);
  return raw
    .map((tag) => oneLine(tag).replace(/\s+/g, "_"))
    .filter(Boolean);
}

function cardAnswer(card) {
  const fm = (card && card.fm) || {};
  const body = (card && card.body) || {};
  const choices = [];
  for (let n = 1; n <= 8; n++) {
    const value = str(fm[`choice_${n}`]).trim();
    if (value) choices.push(oneLine(value));
  }
  if (!choices.length && Array.isArray(fm.choices)) {
    for (const value of fm.choices) if (str(value).trim()) choices.push(oneLine(value));
  }
  if (!choices.length) {
    const answer = str(body.back || fm.back || fm.answer).trim();
    if (answer) choices.push(oneLine(answer));
  }
  const requested = str(fm.correct_choices)
    .split(/[,\s]+/)
    .map((value) => Math.round(Number(value)))
    .filter((value) => value >= 1);
  const at = requested.length ? requested[0] - 1 : 0;
  return choices[at] || choices[0] || "";
}

/**
 * Build AnkiConnect notes from card records that already include their parsed
 * body. Returns warnings for cards Anki cannot receive, so a partial push is
 * visible instead of silently losing notes.
 */
function buildAnkiNotes(cards, options) {
  const opts = options || {};
  const fallbackDeck = str(opts.defaultDeck).trim() || "Imported";
  const targetDeck = str(opts.deck).trim();
  const notes = [];
  const paths = [];
  const warnings = [];
  for (const card of Array.isArray(cards) ? cards : []) {
    const fm = (card && card.fm) || {};
    const body = (card && card.body) || {};
    const path = (card && card.file && card.file.path) || "card";
    const front = oneLine(body.front || fm.front || fm.question);
    const answer = cardAnswer(card);
    if (!front || !answer) {
      warnings.push(`${path} has no front or answer and was skipped.`);
      continue;
    }
    const deckName = targetDeck || oneLine(fm.deck) || fallbackDeck;
    const tags = tagsFor(fm);
    const cloze = /cloze/i.test(str(fm.card_type)) || /cloze/i.test(str(body.cardType));
    const fields = {};
    let modelName = "Basic";
    if (cloze && str(body.front).includes("[…]")) {
      let next = 0;
      const answers = str(body.back)
        .split(" · ")
        .map((value) => oneLine(value))
        .filter(Boolean);
      fields.Text = oneLine(body.front).replace(/\[\…\]/g, () => `{{c1::${answers[next++] || "…"}}}`);
      fields["Back Extra"] = "";
      modelName = "Cloze";
    } else {
      fields.Front = front;
      fields.Back = answer;
    }
    if (fm.image) warnings.push(`${path}: the image stays in the vault and is not sent to Anki.`);
    notes.push({
      deckName,
      modelName,
      fields,
      tags,
      options: { allowDuplicate: false, duplicateScope: "deck" },
    });
    paths.push(path);
  }
  return { notes, paths, warnings };
}

function responseData(response) {
  if (!response) return null;
  try {
    if (response.json !== undefined) return response.json;
  } catch (e) {
    /* fall through to text */
  }
  try {
    return JSON.parse(str(response.text));
  } catch (e) {
    return null;
  }
}

class AnkiConnectClient {
  constructor(options) {
    const opts = options || {};
    this.url = normalizeAnkiConnect({ url: opts.url }).url;
    this.request = opts.request || requestUrl;
  }

  async call(action, params) {
    let response;
    try {
      response = await this.request({
        url: this.url,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        contentType: "application/json",
        body: JSON.stringify({ action, version: ANKI_VERSION, params: params || {} }),
        throw: false,
      });
    } catch (e) {
      throw new Error(`Could not reach AnkiConnect at ${this.url}. Open Anki with AnkiConnect installed and check the address.`);
    }
    if (response && Number(response.status) >= 400) {
      throw new Error(`AnkiConnect returned HTTP ${response.status} from ${this.url}. Check that Anki and AnkiConnect are running.`);
    }
    const data = responseData(response);
    if (!data) throw new Error(`AnkiConnect at ${this.url} returned an unreadable reply.`);
    if (data.error) throw new Error(`AnkiConnect: ${str(data.error)}`);
    if (!Object.prototype.hasOwnProperty.call(data, "result")) {
      throw new Error(`AnkiConnect at ${this.url} did not return a result.`);
    }
    return data.result;
  }

  version() {
    return this.call("version");
  }

  /** Push notes, creating decks first and reporting duplicates separately. */
  async push(notes) {
    const list = Array.isArray(notes) ? notes : [];
    const decks = [...new Set(list.map((note) => str(note && note.deckName).trim()).filter(Boolean))];
    for (const deck of decks) await this.call("createDeck", { deck });
    if (!list.length) return { added: 0, duplicates: 0, failed: 0, decks, total: 0, ids: [], acceptedIndexes: [] };
    const allowed = await this.call("canAddNotes", { notes: list });
    if (!Array.isArray(allowed)) throw new Error("AnkiConnect did not return a duplicate check.");
    const acceptedIndexes = list.map((_note, index) => (allowed[index] === true ? index : -1)).filter((index) => index >= 0);
    const accepted = acceptedIndexes.map((index) => list[index]);
    const duplicates = list.length - accepted.length;
    if (!accepted.length) return { added: 0, duplicates, failed: 0, decks, total: list.length, ids: [], acceptedIndexes: [] };
    const ids = await this.call("addNotes", { notes: accepted });
    if (!Array.isArray(ids)) throw new Error("AnkiConnect did not return note IDs.");
    const added = ids.filter((id) => id !== null && id !== undefined).length;
    return { added, duplicates, failed: accepted.length - added, decks, total: list.length, ids, acceptedIndexes };
  }

  notesInfo(ids) {
    const list = (Array.isArray(ids) ? ids : []).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0);
    if (!list.length) return Promise.resolve([]);
    return this.call("notesInfo", { notes: list }).then((result) => (Array.isArray(result) ? result : []));
  }

  cardsInfo(ids) {
    const list = (Array.isArray(ids) ? ids : []).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0);
    if (!list.length) return Promise.resolve([]);
    return this.call("cardsInfo", { cards: list }).then((result) => (Array.isArray(result) ? result : []));
  }

  /** Update the content, deck and tags of a note that already exists in Anki. */
  async updateNote(noteId, cardId, note) {
    const id = Number(noteId);
    if (!Number.isFinite(id) || id <= 0) throw new Error("That card has no Anki note ID yet.");
    await this.call("updateNoteFields", { note: { id, fields: note.fields || {} } });
    if (note.deckName && cardId) await this.call("changeDeck", { cards: [Number(cardId)], deck: note.deckName });
    if (Array.isArray(note.tags)) await this.call("updateNoteTags", { note: id, tags: note.tags.join(" ") });
    return { updated: 1 };
  }
}

class AnkiConnectModal extends Modal {
  constructor(app, plugin, options, onDone) {
    super(app);
    this.plugin = plugin;
    this.options = options || {};
    this.onDone = onDone || (() => {});
  }

  onOpen() {
    const { contentEl } = this;
    const p = this.plugin;
    const settings = normalizeAnkiConnect(p.settings.cards.ankiConnect);
    contentEl.empty();
    contentEl.createEl("h3", { text: "Sync cards with Anki" });
    const count = p.filteredCards({ deck: this.options.deck, course: this.options.course }).length;
    contentEl.createEl("p", {
      cls: "setting-item-description",
      text: `${count} card${count === 1 ? "" : "s"} in the current deck and course filter. Sync pushes new cards and pulls edits from linked cards. AnkiConnect must be installed in a running Anki desktop.`,
    });
    if (!settings.enabled) {
      contentEl.createEl("p", {
        cls: "setting-item-description",
        text: "AnkiConnect push is off. Turn it on under Settings, Cards, Decks first.",
      });
    }

    const wrap = contentEl.createDiv({ cls: "qt-field" });
    wrap.createEl("label", { text: "Target deck" });
    const target = wrap.createEl("input", { type: "text" });
    target.placeholder = "Each card's own deck";
    target.value = this.options.targetDeck || settings.deck || "";

    const note = contentEl.createDiv({ cls: "qt-hint" });
    note.setText(`AnkiConnect: ${settings.url}`);
    const row = contentEl.createDiv({ cls: "qt-row" });
    const cancel = row.createEl("button", { text: "Cancel", cls: "qt-grow" });
    const go = row.createEl("button", { text: "Push only", cls: "qt-grow" });
    const sync = row.createEl("button", { text: "Sync cards", cls: "mod-cta qt-grow" });
    go.disabled = !settings.enabled;
    sync.disabled = !settings.enabled;
    cancel.addEventListener("click", () => this.close());
    go.addEventListener("click", async () => {
      go.disabled = true;
      note.setText("Sending to Anki…");
      try {
        const result = await p.pushCardsToAnki({
          deck: this.options.deck,
          course: this.options.course,
          targetDeck: target.value,
        });
        const bits = [`Added ${result.added} card${result.added === 1 ? "" : "s"}`];
        if (result.duplicates) bits.push(`${result.duplicates} already in Anki`);
        if (result.failed) bits.push(`${result.failed} failed`);
        note.setText(bits.join(" · "));
        new Notice(bits.join(" · "), 7000);
        if (result.warnings && result.warnings.length) note.setText(`${bits.join(" · ")} · ${result.warnings[0]}`);
        if (this.onDone) this.onDone(result);
      } catch (e) {
        note.setText(str(e && e.message) || "Could not push to Anki.");
        go.disabled = false;
      }
    });
    sync.addEventListener("click", async () => {
      sync.disabled = true;
      go.disabled = true;
      note.setText("Syncing with Anki…");
      try {
        const result = await p.syncCardsWithAnki({
          deck: this.options.deck,
          course: this.options.course,
          targetDeck: target.value,
        });
        const bits = [`Pushed ${result.pushed}`, `Pulled ${result.pulled}`];
        if (result.updated) bits.push(`Updated ${result.updated} in Anki`);
        if (result.conflicts) bits.push(`${result.conflicts} conflict${result.conflicts === 1 ? "" : "s"}`);
        if (result.skipped) bits.push(`Skipped ${result.skipped}`);
        if (result.errors.length) bits.push(`${result.errors.length} failed`);
        note.setText(bits.join(" · "));
        new Notice(bits.join(" · "), 8000);
        if (result.warnings.length) note.setText(`${bits.join(" · ")} · ${result.warnings[0]}`);
        if (this.onDone) this.onDone(result);
      } catch (e) {
        note.setText(str(e && e.message) || "Could not sync with Anki.");
      } finally {
        sync.disabled = !settings.enabled;
        go.disabled = !settings.enabled;
      }
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

module.exports = {
  DEFAULT_ANKI_CONNECT,
  ANKI_VERSION,
  normalizeAnkiConnect,
  buildAnkiNotes,
  syncRecord,
  syncHash,
  localSyncRecord,
  remoteSyncRecord,
  syncDecision,
  AnkiConnectClient,
  AnkiConnectModal,
};
