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
  folderDecks: false, // optional: use the first card subfolder as the Anki deck
  deleteMissing: false, // optional: delete linked Anki notes after their local note is gone
  vaultTags: "", // optional extra tags applied to every Anki note
  backlinks: false, // optional link from each Anki note back to its source note
  excludeTags: "", // optional comma-separated tags that keep a card out of Anki
  excludeDecks: "", // optional comma-separated decks (and subdecks) kept out of Anki
  omitRegex: "", // optional global regex removed from both sides before pushing
  clearMissing: false, // optional cleanup of local Anki IDs after an Anki-side deletion
  excalidraw: { enabled: false, folder: "" }, // optional exported .excalidraw.svg support
  index: {}, // path -> { noteId, cardId } from the last successful sync
};

const ANKI_VERSION = 6;

function normalizeAnkiConnect(value) {
  const src = value && typeof value === "object" ? value : {};
  const url = str(src.url).trim().replace(/\/+$/, "");
  const excalidraw = src.excalidraw && typeof src.excalidraw === "object" ? src.excalidraw : {};
  return {
    enabled: src.enabled === true,
    url: /^https?:\/\//i.test(url) ? url : DEFAULT_ANKI_CONNECT.url,
    deck: str(src.deck).trim(),
    conflict: ["report", "local", "anki"].includes(str(src.conflict).toLowerCase()) ? str(src.conflict).toLowerCase() : "report",
    folderDecks: src.folderDecks === true,
    deleteMissing: src.deleteMissing === true,
    vaultTags: str(src.vaultTags).trim(),
    backlinks: src.backlinks === true,
    excludeTags: str(src.excludeTags).trim(),
    excludeDecks: str(src.excludeDecks).trim(),
    omitRegex: str(src.omitRegex).trim(),
    clearMissing: src.clearMissing === true,
    excalidraw: {
      enabled: excalidraw.enabled === true,
      folder: str(excalidraw.folder).trim().replace(/^\/+|\/+$/g, ""),
    },
    index: src.index && typeof src.index === "object" && !Array.isArray(src.index) ? { ...src.index } : {},
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

/** Compare Markdown and Anki HTML as the same content, so a pull does not look like a new edit. */
function syncText(value) {
  let text = str(value);
  // Anki drops Obsidian's image alias/size suffix; compare the same target.
  text = text.replace(/!\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g, "![[$1]]");
  text = text.replace(/(?:<br\s*\/?>){1,2}\s*<a[^>]*href=["']obsidian:\/\/open[^"']*["'][^>]*>[^<]*<\/a>/gi, "");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<video[^>]*src=["']([^"']+)["'][^>]*>/gi, "![[$1]]");
  text = text.replace(/<audio[^>]*src=["']([^"']+)["'][^>]*>/gi, "[sound:$1]");
  text = text.replace(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi, "![[$1]]");
  // Tables use different delimiters locally and in Anki HTML; reduce both to
  // the same words so a pulled table does not look like a fresh local edit.
  text = text.replace(/^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*$/gm, " ");
  text = text.replace(/<\/?(?:table|thead|tbody|tr|td|th)[^>]*>/gi, " ");
  text = text.replace(/\|/g, " ");
  text = text.replace(/<[^>]+>/g, "");
  text = text.replace(/\[sound:([^\]]+)\]/gi, "![[$1]]");
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/[*_`]/g, "");
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, "$1").replace(/\$([^$]+)\$/g, "$1");
  return text.replace(/\s+/g, " ").trim();
}

function syncHash(value) {
  const record = syncRecord(value);
  return hashString(JSON.stringify({ ...record, front: syncText(record.front), back: syncText(record.back) }));
}

/** The card as Anki sees it, after the same front/back parsing used by push. */
function localSyncRecord(card, options) {
  const fm = (card && card.fm) || {};
  const body = (card && card.body) || {};
  const cloze = /cloze/i.test(str(fm.card_type)) || /cloze/i.test(str(body.cardType));
  const image = mediaName(fm.image || "");
  const rawFront = cloze ? body.rawFront || body.front : body.front;
  const preparedFront = prepareAnkiText(rawFront, options);
  const front = image && !str(preparedFront).includes(image) ? `![[${image}]] ${preparedFront}` : preparedFront;
  return syncRecord({
    front,
    back: prepareAnkiText(body.back, options),
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


const MEDIA_EXTENSIONS = /\.(png|jpe?g|gif|webp|svg|bmp|avif|mp3|wav|m4a|ogg|flac|aac|opus|mp4|webm|mov|m4v|ogv)$/i;
const AUDIO_EXTENSIONS = /\.(mp3|wav|m4a|ogg|flac|aac|opus)$/i;
const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v|ogv)$/i;

function mediaName(target) {
  return str(target).split("#")[0].split("|")[0].replace(/^.*[\\/]/, "").trim();
}

function mediaKind(name) {
  if (AUDIO_EXTENSIONS.test(name)) return "audio";
  if (VIDEO_EXTENSIONS.test(name)) return "video";
  return MEDIA_EXTENSIONS.test(name) ? "image" : "";
}

function mediaHtml(name) {
  const kind = mediaKind(name);
  if (kind === "audio") return `[sound:${escapeHtml(name)}]`;
  if (kind === "video") return `<video controls src="${escapeHtml(name)}"></video>`;
  return `<img src="${escapeHtml(name)}">`;
}

/** Find image/audio embeds in Markdown without fetching anything. */
function mediaRefs(text, options) {
  const opts = options || {};
  const folder = str(opts.excalidraw && opts.excalidraw.folder).trim().replace(/^\/+|\/+$/g, "");
  const out = [];
  const seen = new Set();
  const add = (target) => {
    const clean = str(target).trim().replace(/^<|>$/g, "");
    if (!clean || /^https?:/i.test(clean)) return;
    const name = mediaName(clean);
    const kind = mediaKind(name);
    if (!name || !kind || seen.has(name)) return;
    seen.add(name);
    // Excalidraw's auto-export can live in its own folder even though the
    // embed itself stays a plain ![[Drawing.excalidraw.svg]].
    const resolved = /\.excalidraw\.svg$/i.test(name) && folder && !clean.includes("/") ? `${folder}/${name}` : clean;
    out.push({ target: resolved, name, kind });
  };
  const source = str(text);
  for (const match of source.matchAll(/!\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g)) add(match[1]);
  for (const match of source.matchAll(/!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) add(match[1]);
  return out;
}

function escapeHtml(value) {
  return str(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Convert pipe tables only when the second row is a Markdown alignment row.
 * Returning the original block when it is not a table keeps ordinary prose
 * containing pipes intact.
 */
function splitTableRow(line) {
  return str(line).trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function isTableSeparator(line) {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function tableToHtml(lines) {
  const rows = (Array.isArray(lines) ? lines : []).map(splitTableRow);
  if (rows.length < 2) return "";
  const head = rows[0].map((cell) => `<th>${cell}</th>`).join("");
  const body = rows
    .slice(2)
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
    .join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function markdownTablesToHtml(text, hold) {
  const lines = str(text).split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const block = [];
    let next = i;
    while (next < lines.length && str(lines[next]).includes("|")) {
      block.push(lines[next]);
      next++;
    }
    if (block.length >= 2 && isTableSeparator(block[1])) {
      out.push(hold(tableToHtml(block)));
      i = next - 1;
      continue;
    }
    out.push(lines[i]);
  }
  return out.join("\n");
}

/**
 * A deliberately small Markdown-to-HTML adapter for Anki fields. It keeps
 * code, math, tables, images, audio and video readable without shipping a
 * Markdown parser.
 */
function markdownToAnkiHtml(value) {
  const source = str(value);
  if (/<(?:strong|em|code|pre|img|br|a|table|video)\b[^>]*>/i.test(source)) return source;
  const tokens = [];
  const hold = (html) => `\u0000${tokens.push(html) - 1}\u0000`;
  let text = source.replace(/\r\n/g, "\n");
  text = text.replace(/```[^\n]*\n?([\s\S]*?)```/g, (_full, code) => hold(`<pre><code>${escapeHtml(code.trim())}</code></pre>`));
  text = text.replace(/!\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g, (_full, target) => {
    return hold(mediaHtml(mediaName(target)));
  });
  text = text.replace(/!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_full, target) => {
    return hold(mediaHtml(mediaName(target)));
  });
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_full, math) => hold(`\\[${escapeHtml(math.trim())}\\]`));
  text = text.replace(/\$([^$\n]+)\$/g, (_full, math) => hold(`\\(${escapeHtml(math.trim())}\\)`));
  text = text.replace(/`([^`]+)`/g, (_full, code) => hold(`<code>${escapeHtml(code)}</code>`));
  text = escapeHtml(text);
  text = markdownTablesToHtml(text, hold);
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_full, label, url) => `<a href="${url}">${label}</a>`);
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\*([^*]+)\*/g, "<em>$1</em>");
  text = text.replace(/\n/g, "<br>");
  return text.replace(/\u0000(\d+)\u0000/g, (_full, index) => tokens[Number(index)] || "");
}

/** Optional folder convention: Cards/Biology/Q.md becomes the Biology deck. */
function folderDeckName(path, root) {
  const clean = str(path).replace(/^\/+|\/+$/g, "").replace(/\.md$/i, "");
  const base = str(root).replace(/^\/+|\/+$/g, "");
  const relative = base && (clean === base || clean.startsWith(base + "/")) ? clean.slice(base.length).replace(/^\/+/, "") : clean;
  const slash = relative.indexOf("/");
  return slash > 0 ? relative.slice(0, slash) : "";
}

function oneLine(value) {
  return str(value).replace(/\r?\n/g, " ").replace(/\t/g, " ").trim();
}

function parseTags(value) {
  const raw = Array.isArray(value) ? value : str(value).split(/[,;]+|\s+/);
  return raw
    .map((tag) => oneLine(tag).replace(/\s+/g, "_"))
    .filter(Boolean);
}

function tagsFor(fm) {
  return parseTags(fm && fm.tags);
}

/** Shared comma/newline list parsing for the optional exclusion filters. */
function filterList(value) {
  const raw = Array.isArray(value) ? value : str(value).split(/[\n,;]+/);
  return [...new Set(raw.map((entry) => oneLine(entry)).filter(Boolean))];
}

function filterTag(value) {
  return oneLine(value).replace(/^#+/, "").replace(/\s+/g, "_").toLowerCase();
}

function omissionPattern(value) {
  const source = str(value).trim();
  if (!source) return { regex: null, error: "" };
  try {
    return { regex: new RegExp(source, "g"), error: "" };
  } catch (e) {
    return { regex: null, error: `Omission regex is invalid and was ignored: ${str(e && e.message ? e.message : e)}` };
  }
}

/**
 * Excalidraw stores drawings as .excalidraw.md but its auto-export writes an
 * .excalidraw.svg. Point cards at the exported SVG; the optional folder is
 * used only when the file is uploaded, so sync hashes stay path-independent.
 */
function rewriteExcalidrawEmbeds(value, options) {
  const opts = options || {};
  if (!opts.excalidraw || opts.excalidraw.enabled !== true) return str(value);
  return str(value).replace(/!\[\[([^\]|#]+?)\.excalidraw(?:\.md)?((?:[|#][^\]]*)?)\]\]/gi, (_full, base, suffix) => `![[${base}.excalidraw.svg${suffix || ""}]]`);
}

/** The exact text Anki receives: optional regex omission, then Excalidraw. */
function prepareAnkiText(value, options) {
  const opts = options || {};
  let text = str(value);
  const omission = omissionPattern(opts.omitRegex);
  if (omission.regex) text = text.replace(omission.regex, "");
  return rewriteExcalidrawEmbeds(text, opts);
}

/** Resolve a card's deck with the same precedence used by buildAnkiNotes. */
function ankiDeckName(card, options) {
  const opts = options || {};
  const fm = (card && card.fm) || {};
  const path = (card && card.file && card.file.path) || "card";
  const fallbackDeck = str(opts.defaultDeck).trim() || "Imported";
  const targetDeck = str(opts.deck).trim();
  return (
    targetDeck ||
    oneLine(fm.deck) ||
    (opts.folderDecks ? folderDeckName(path, opts.cardRoot) : "") ||
    oneLine(card && card.deck) ||
    fallbackDeck
  );
}

/** Why a card is excluded from Anki, or an empty string when it is included. */
function ankiExclusionReason(card, options) {
  const opts = options || {};
  const fm = (card && card.fm) || {};
  const tags = [...tagsFor(fm), ...parseTags(opts.vaultTags)].map(filterTag);
  const excludedTag = filterList(opts.excludeTags).map(filterTag).find((tag) => tag && tags.includes(tag));
  if (excludedTag) return `tag #${excludedTag} is excluded`;
  const deck = ankiDeckName(card, opts).toLowerCase();
  const excludedDeck = filterList(opts.excludeDecks)
    .map((name) => name.toLowerCase())
    .find((name) => name && (deck === name || deck.startsWith(name + "::")));
  if (excludedDeck) return `deck ${ankiDeckName(card, opts)} is excluded`;
  return "";
}

/** A local Obsidian URI, used only when the optional backlink is enabled. */
function sourceBacklink(path, vaultName) {
  const clean = str(path).trim();
  if (!clean) return "";
  const vault = str(vaultName).trim();
  const query = `${vault ? `vault=${encodeURIComponent(vault)}&` : ""}file=${encodeURIComponent(clean)}`;
  return `<br><br><a href="${escapeHtml(`obsidian://open?${query}`)}">Source note</a>`;
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
  const vaultTags = parseTags(opts.vaultTags);
  const omission = omissionPattern(opts.omitRegex);
  const notes = [];
  const paths = [];
  const warnings = [];
  const media = [];
  if (omission.error) warnings.push(omission.error);
  for (const card of Array.isArray(cards) ? cards : []) {
    const fm = (card && card.fm) || {};
    const body = (card && card.body) || {};
    const path = (card && card.file && card.file.path) || "card";
    const rawFront = prepareAnkiText(body.front || fm.front || fm.question, opts);
    const answer = prepareAnkiText(cardAnswer(card), opts);
    const exclusion = ankiExclusionReason(card, opts);
    if (exclusion) {
      warnings.push(`${path}: skipped because ${exclusion}.`);
      continue;
    }
    if (!rawFront.trim() || !answer.trim()) {
      warnings.push(`${path} has no front or answer and was skipped.`);
      continue;
    }
    const deckName = ankiDeckName(card, opts);
    const tags = [...new Set([...tagsFor(fm), ...vaultTags])];
    const cloze = /cloze/i.test(str(fm.card_type)) || /cloze/i.test(str(body.cardType));
    const imageName = mediaName(fm.image || "");
    const rawBack = prepareAnkiText(body.back || fm.back || fm.answer, opts);
    const sourcePath = str(fm.source_note || fm.source_file || path).trim();
    const backlink = opts.backlinks === true ? sourceBacklink(sourcePath, opts.vaultName) : "";
    const frontMedia = mediaRefs(rawFront, opts);
    const backMedia = mediaRefs(rawBack, opts);
    for (const ref of [...frontMedia, ...backMedia]) media.push({ ...ref, sourcePath: path });
    if (imageName) media.push({ target: str(fm.image), name: imageName, kind: mediaKind(imageName) || "image", sourcePath: path });
    const fields = {};
    let modelName = "Basic";
    if (cloze && str(body.front).includes("[…]")) {
      let next = 0;
      const answers = rawBack
        .split(" · ")
        .map((value) => oneLine(value))
        .filter(Boolean);
      const text = rawFront.replace(/\[…\]/g, () => `{{c1::${answers[next++] || "…"}}}`);
      fields.Text = markdownToAnkiHtml(text);
      fields["Back Extra"] = backlink;
      modelName = "Cloze";
    } else {
      fields.Front = imageName ? `<img src="${escapeHtml(imageName)}"><br>${markdownToAnkiHtml(rawFront)}` : markdownToAnkiHtml(rawFront);
      fields.Back = `${markdownToAnkiHtml(answer)}${backlink}`;
    }
    if (imageName) warnings.push(`${path}: the image stays in the vault and is uploaded only when you confirm Anki sync.`);
    if (frontMedia.length || backMedia.length) warnings.push(`${path}: media stays in the vault and is uploaded only when you confirm Anki sync.`);
    notes.push({
      deckName,
      modelName,
      fields,
      tags,
      options: { allowDuplicate: false, duplicateScope: "deck" },
    });
    paths.push(path);
  }
  return { notes, paths, warnings, media };
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

  /** Upload local images/audio by filename before fields reference them. */
  async storeMedia(files) {
    const list = Array.isArray(files) ? files : [];
    const stored = [];
    for (const file of list) {
      if (!file || !file.filename || !file.data) continue;
      await this.call("storeMediaFile", { filename: file.filename, data: file.data });
      stored.push(file.filename);
    }
    return { stored };
  }

  /** Delete linked Anki notes only after the user has previewed the plan. */
  async deleteNotes(ids) {
    const list = (Array.isArray(ids) ? ids : []).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0);
    if (!list.length) return { deleted: 0 };
    await this.call("deleteNotes", { notes: list });
    return { deleted: list.length };
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
      text: `${count} card${count === 1 ? "" : "s"} in the current deck and course filter. Preview first: creates, updates, pulls, conflicts and Anki-side deletions are listed before anything is sent. AnkiConnect must be installed in a running Anki desktop.`,
    });
    if (!settings.enabled) {
      contentEl.createEl("p", {
        cls: "setting-item-description",
        text: "AnkiConnect sync is off. Turn it on under Settings, Cards, Decks first.",
      });
    }

    const wrap = contentEl.createDiv({ cls: "qt-field" });
    wrap.createEl("label", { text: "Target deck" });
    const target = wrap.createEl("input", { type: "text" });
    target.placeholder = "Each card's own deck";
    target.value = this.options.targetDeck || settings.deck || "";

    this.note = contentEl.createDiv({ cls: "qt-hint" });
    this.note.setText(`AnkiConnect: ${settings.url}`);
    const row = contentEl.createDiv({ cls: "qt-row" });
    const cancel = row.createEl("button", { text: "Cancel", cls: "qt-grow" });
    const go = row.createEl("button", { text: this.options.vaultWide ? "Preview vault push" : "Preview push", cls: "qt-grow" });
    const sync = row.createEl("button", { text: "Preview sync", cls: "mod-cta qt-grow" });
    go.disabled = !settings.enabled;
    sync.disabled = !settings.enabled || this.options.vaultWide === true;
    if (this.options.vaultWide === true) sync.style.display = "none";
    this.previewEl = contentEl.createDiv({ cls: "qt-anki-preview" });
    cancel.addEventListener("click", () => this.close());
    go.addEventListener("click", () => this.preview(true, target.value));
    sync.addEventListener("click", () => this.preview(false, target.value));
  }

  async preview(pushOnly, targetDeck) {
    this.previewEl.empty();
    this.note.setText("Reading Anki without changing anything…");
    try {
      const result = await this.plugin.previewAnkiSync({
        deck: this.options.deck,
        course: this.options.course,
        vaultWide: this.options.vaultWide === true,
        targetDeck,
        pushOnly,
      });
      this.renderPlan(result, pushOnly, targetDeck);
      this.note.setText(`Preview ready: ${result.entries.length} change${result.entries.length === 1 ? "" : "s"}. Nothing has been written.`);
    } catch (e) {
      this.note.setText(str(e && e.message) || "Could not preview Anki sync.");
    }
  }

  renderPlan(result, pushOnly, targetDeck) {
    const el = this.previewEl;
    el.empty();
    const c = result.counts || {};
    const bits = [];
    if (c.create) bits.push(`${c.create} create`);
    if (c.update) bits.push(`${c.update} update`);
    if (c.pull) bits.push(`${c.pull} pull`);
    if (c.conflict) bits.push(`${c.conflict} conflict${c.conflict === 1 ? "" : "s"}`);
    if (c.missing) bits.push(`${c.missing} Anki deletion${c.missing === 1 ? "" : "s"}`);
    if (c.delete) bits.push(`${c.delete} Anki deletion${c.delete === 1 ? "" : "s"}`);
    if (c.unchanged) bits.push(`${c.unchanged} unchanged`);
    if (c.media) bits.push(`${c.media} media file${c.media === 1 ? "" : "s"}`);
    el.createEl("p", { cls: "qt-hint", text: bits.join(" · ") || (pushOnly ? "No new cards to push." : "Everything is already in sync.") });
    if (result.entries.length) {
      const list = el.createEl("ul", { cls: "qt-extract-preview" });
      for (const entry of result.entries.slice(0, 40)) {
        const label = entry.action === "create" ? "Create" : entry.action === "update" ? "Update" : entry.action === "pull" ? "Pull" : entry.action === "conflict" ? "Conflict" : "Anki deletion";
        const detail = entry.detail || (entry.deck ? `deck: ${entry.deck}` : "");
        list.createEl("li", { text: `${label}: ${entry.path}${detail ? " — " + detail : ""}` });
      }
      if (result.entries.length > 40) el.createEl("p", { cls: "qt-hint", text: `…and ${result.entries.length - 40} more.` });
    }
    if (result.warnings && result.warnings.length) el.createEl("p", { cls: "qt-hint", text: result.warnings[0] });
    if (result.errors && result.errors.length) el.createEl("p", { cls: "qt-error", text: result.errors[0] });
    if (result.entries.length) {
      const apply = el.createEl("button", { text: pushOnly ? (this.options.vaultWide ? "Apply vault push" : "Apply push") : "Apply sync", cls: "mod-cta" });
      apply.addEventListener("click", () => this.apply(pushOnly, targetDeck, apply));
    }
  }

  async apply(pushOnly, targetDeck, button) {
    button.disabled = true;
    this.note.setText(pushOnly ? "Pushing to Anki…" : "Syncing with Anki…");
    try {
      const scope = { deck: this.options.deck, course: this.options.course, vaultWide: this.options.vaultWide === true, targetDeck };
      const result = pushOnly ? await this.plugin.pushCardsToAnki(scope) : await this.plugin.syncCardsWithAnki(scope);
      const bits = pushOnly
        ? [`Added ${result.added} card${result.added === 1 ? "" : "s"}`]
        : [`Pushed ${result.pushed}`, `Pulled ${result.pulled}`];
      if (result.deleted) bits.push(`Deleted ${result.deleted} from Anki`);
      if (result.cleared) bits.push(`Cleared ${result.cleared} stale Anki link${result.cleared === 1 ? "" : "s"}`);
      if (result.updated) bits.push(`Updated ${result.updated} in Anki`);
      if (result.duplicates) bits.push(`${result.duplicates} already in Anki`);
      if (result.conflicts) bits.push(`${result.conflicts} conflict${result.conflicts === 1 ? "" : "s"}`);
      if (result.skipped) bits.push(`Skipped ${result.skipped}`);
      if (result.errors && result.errors.length) bits.push(`${result.errors.length} failed`);
      this.note.setText(bits.join(" · "));
      new Notice(bits.join(" · "), 8000);
      if (result.warnings && result.warnings.length) this.note.setText(`${bits.join(" · ")} · ${result.warnings[0]}`);
      if (this.onDone) this.onDone(result);
    } catch (e) {
      this.note.setText(str(e && e.message) || "Could not finish the Anki sync.");
      button.disabled = false;
    }
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
  folderDeckName,
  ankiDeckName,
  ankiExclusionReason,
  omissionPattern,
  prepareAnkiText,
  rewriteExcalidrawEmbeds,
  markdownToAnkiHtml,
  mediaRefs,
  mediaName,
  syncRecord,
  syncHash,
  localSyncRecord,
  remoteSyncRecord,
  syncDecision,
  AnkiConnectClient,
  AnkiConnectModal,
};
