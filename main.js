"use strict";
/*
 * MCQ Tracker - Obsidian plugin (plain JS, no build step, desktop + mobile).
 * Works on notes that have a `question_id` property. All data lives in each
 * note's properties; the plugin's own data.json only stores settings, presets
 * and the running timer.
 */
const obsidian = require("obsidian");
const {
  Plugin,
  ItemView,
  PluginSettingTab,
  Setting,
  Modal,
  Notice,
  MarkdownRenderer,
  Platform,
  TFile,
  setIcon,
  requestUrl,
  loadPdfJs,
  stringifyYaml,
  parseYaml,
  normalizePath,
  AbstractInputSuggest,
} = obsidian;

const VIEW_TYPE = "question-tracker-view";

const FILTER_FIELDS = [
  ["course", "Course"],
  ["test", "Test"],
  ["section", "Section"],
  ["domain", "Domain"],
  ["skill", "Skill"],
  ["unit", "Unit"],
  ["difficulty", "Difficulty"],
];

const MODES = [
  ["smart", "Smart mix (weighted)"],
  ["due", "Due for review"],
  ["unseen", "Never attempted"],
  ["missed", "Missed last time"],
  ["flagged", "Flagged"],
  ["random", "Pure random"],
];

const DEFAULT_SETTINGS = {
  questionFolder: "",
  intervals: [1, 3, 7, 21, 60],
  errorTypes: ["careless", "content gap", "misread", "ran out of time", "guessed"],
  confidenceLabels: ["Guessing", "Unsure", "Confident"],
  autoPauseOnMobile: true,
  explanationDefault: "wrong", // "show" | "wrong" (only after a miss) | "hide"
  ai: {
    enabled: false, // nothing is ever sent anywhere until you turn this on
    managed: true, // plugin starts and stops OpenCode itself (it never downloads anything unless you press the button)
    preStart: false, // start OpenCode in the background when Obsidian opens, so the first chat doesn't wait
    binaryPath: "", // optional: use this opencode program instead
    managedBinary: "",
    installedVersion: "",
    url: "http://127.0.0.1:4096", // only used when managed is off
    username: "opencode",
    password: "",
    model: "",
    agent: "",
    mode: "tutor",
    sessionId: "",
    backend: "api", // desktop choice: "api" (default) or "opencode". Phones always use "api".
    api: { provider: "anthropic", baseUrl: "", model: "claude-sonnet-5-5", keys: {} },
  },
  presets: [],
  importFolder: "",
  importDefaults: {},
  importOptions: { capture: true, pagePics: false },
  filters: {},
  moreSets: [], // extra filter sets, OR'd with `filters`
  mode: "smart",
  activePreset: "",
};

// Tracking properties every question note should have.
const TRACKING_DEFAULTS = {
  result: "unknown",
  "date attempted": "",
  first_attempted: "",
  attempts: 0,
  correct_count: 0,
  streak: 0,
  time_spent_total: 0,
  last_time_spent: 0,
  last_answer: "",
  last_confidence: "",
  last_error_type: "",
  flagged: false,
  next_review: "",
  history: [],
};

/* ------------------------------------------------------------ pure helpers */

const pad = (n) => String(n).padStart(2, "0");
const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtDateTime = (d) => `${fmtDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const addDays = (d, n) => {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + n);
  return x;
};
const fmtClock = (s) => `${Math.floor(s / 60)}:${pad(s % 60)}`;
const str = (v) => (v === undefined || v === null ? "" : String(v));

function isDue(fm, today) {
  return Number(fm.attempts) > 0 && !!fm.next_review && str(fm.next_review).slice(0, 10) <= today;
}

const MODE_PRED = {
  smart: () => true,
  random: () => true,
  due: (fm, today) => isDue(fm, today),
  unseen: (fm) => !Number(fm.attempts),
  missed: (fm) => fm.result === "incorrect",
  flagged: (fm) => fm.flagged === true,
};

function weightOf(fm, today) {
  let w = 1;
  if (isDue(fm, today)) w = 5;
  else if (!Number(fm.attempts)) w = 4;
  else if (fm.result === "incorrect") w = 3;
  if (fm.flagged === true) w *= 2;
  return w;
}

/** A filter holds a list of accepted values per field (older versions stored a single string). */
function fvals(filters, k) {
  const v = filters ? filters[k] : undefined;
  if (v === undefined || v === null || v === "") return [];
  return (Array.isArray(v) ? v : [v]).map(str).filter(Boolean);
}

/** A note's own values for a field (a list property counts as several values). */
function noteVals(fm, k) {
  const v = fm ? fm[k] : undefined;
  if (v === undefined || v === null || v === "") return [];
  return (Array.isArray(v) ? v : [v]).map(str).filter(Boolean);
}

function hasFilters(f) {
  return FILTER_FIELDS.some(([k]) => fvals(f, k).length);
}

function cloneFilters(f) {
  const o = {};
  for (const [k] of FILTER_FIELDS) {
    const v = fvals(f, k);
    if (v.length) o[k] = v.slice();
  }
  return o;
}

/** Within one field the chosen values are OR; every field that has a choice must match (AND). */
function matchFilters(fm, filters, skip) {
  for (const [k] of FILTER_FIELDS) {
    if (k === skip) continue;
    const want = fvals(filters, k);
    if (!want.length) continue;
    const have = noteVals(fm, k);
    if (!want.some((w) => have.includes(w))) return false;
  }
  return true;
}

/** Several filter sets are OR'd together; empty sets are ignored; no sets at all means everything. */
function matchSets(fm, sets) {
  const act = (sets || []).filter(hasFilters);
  if (!act.length) return true;
  return act.some((f) => matchFilters(fm, f));
}

function filterOptions(questions, filters, field) {
  const set = new Set();
  for (const q of questions) {
    if (!matchFilters(q.fm, filters, field)) continue;
    for (const v of noteVals(q.fm, field)) set.add(v);
  }
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function pickQuestion(pool, mode, today, recent, rnd) {
  rnd = rnd || Math.random;
  let items = pool.filter((q) => (MODE_PRED[mode] || MODE_PRED.smart)(q.fm, today));
  if (!items.length) return null;
  const tiers = [recent || [], (recent || []).slice(-1), []];
  for (const ex of tiers) {
    const alt = items.filter((q) => !ex.includes(q.file.path));
    if (alt.length) {
      items = alt;
      break;
    }
  }
  const w = items.map((q) => (mode === "smart" ? weightOf(q.fm, today) : 1));
  let r = rnd() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < items.length; i++) {
    r -= w[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

const HEAD_ALIASES = {
  stimulus: ["stimulus", "passage", "source", "excerpt", "reading", "text", "figure"],
  question: ["question", "stem", "prompt"],
  choices: ["answer choices", "choices", "options", "answers choices"],
  answer: ["answer", "answer key", "correct answer", "answer and rationale", "solution"],
  notes: ["my notes", "notes"],
};

/** Hard-wrapped blockquotes (one line per paragraph) get re-joined into real paragraphs. */
function tidyStimulus(text) {
  const lines = String(text || "").split("\n");
  const nonEmpty = lines.filter((l) => l.trim());
  if (!nonEmpty.length || nonEmpty.some((l) => !/^\s*>/.test(l))) return text;
  const inner = lines.map((l) => l.replace(/^\s*>\s?/, "").trim());
  const texts = inner.filter(Boolean);
  if (texts.length < 3) return text;
  let seps = 0;
  for (let i = 1; i < inner.length - 1; i++) if (inner[i] === "" && inner[i - 1] && inner[i + 1]) seps++;
  if (seps < texts.length - 2) return text; // only when almost every line sits in its own paragraph
  const maxLen = Math.max(...texts.map((t) => t.length));
  const paras = [];
  let last = "";
  for (const t of texts) {
    const ended = /[.!?:;"”’)\]*_]$/.test(last) || /^!\[\[/.test(last) || /^!\[\[/.test(t);
    const lastShort = last.length < maxLen * 0.75; // a wrapped line runs close to full width; a paragraph's last line falls short
    if (paras.length && !(ended && lastShort)) paras[paras.length - 1] += " " + t;
    else paras.push(t);
    last = t;
  }
  return paras.map((x) => "> " + x).join("\n>\n");
}

function parseSections(text) {
  const norm = String(text).replace(/\r\n/g, "\n").replace(/^---\n[\s\S]*?\n---\n?/, "");
  const raw = {};
  let cur = null;
  for (const line of norm.split("\n")) {
    const m = line.match(/^#{1,3}\s+(.+?)\s*#*\s*$/);
    if (m) {
      cur = m[1].toLowerCase().replace(/[*_`]/g, "").trim();
      if (!raw[cur]) raw[cur] = [];
      continue;
    }
    if (cur) raw[cur].push(line);
  }
  const first = (names) => {
    for (const n of names) if (raw[n] && raw[n].join("\n").trim()) return raw[n].join("\n").trim();
    return "";
  };
  const choiceText = first(HEAD_ALIASES.choices);
  const choices = [];
  for (const line of choiceText.split("\n")) {
    const m = line.match(/^\s*(?:[-*+]\s*)?\**\(?([A-H])\)?[.):]\**\s+(.*)$/);
    if (m) choices.push({ letter: m[1], text: m[2].trim() });
    else if (choices.length && /^\s{2,}\S/.test(line)) choices[choices.length - 1].text += " " + line.trim(); // wrapped choice
  }
  return {
    stimulus: tidyStimulus(first(HEAD_ALIASES.stimulus)),
    question: first(HEAD_ALIASES.question),
    choices,
    answer: first(HEAD_ALIASES.answer),
    notes: first(HEAD_ALIASES.notes),
    body: norm,
  };
}

function extractRationale(answerText) {
  return answerText
    .split("\n")
    .map((l) => l.replace(/^>\s?/, ""))
    .filter((l) => !/^\[!answer\]/i.test(l))
    .join("\n")
    .trim();
}

const KEY_PATTERNS = [
  /correct\s+(?:answer|choice|option|response)\s*(?:is|:|=|-|–|—)?\s*[*_`(\[]*\s*(?:choice|option)?\s*\(?([A-Ha-h])\b/gi,
  /(?:^|\n)[>\s*_-]*answer(?:\s+key)?\s*[*_]*\s*(?:is|:|=|-|–|—)\s*[*_`(\[]*\s*(?:choice|option)?\s*\(?([A-Ha-h])\b/gi,
  /\bthe\s+(?:right|correct)\s+(?:answer|choice)\s+is\s*[*_`(\[]*\(?([A-H])\b/g,
];

/** Pull a letter answer out of free text ("Correct Answer: A", "**Answer:** B", "The correct answer is C"). */
function answerFromSection(text) {
  const t = str(text);
  for (const re of KEY_PATTERNS) {
    for (const m of t.matchAll(re)) {
      // lowercase single letters are usually the word "a" ("the correct answer is a ..."): only accept capitals
      if (m[1] === m[1].toUpperCase()) return m[1];
    }
  }
  return "";
}

/** Read the key from properties first (several common names), then the note's own answer section, then the whole body. */
function findAnswerKey(fm, sections) {
  for (const k of ["answer", "correct_answer", "correct", "answer_key", "key"]) {
    const raw = str(fm[k]).trim();
    if (!raw) continue;
    const m = raw.match(/^\(?(?:choice\s+|option\s+)?([A-Ha-h])\)?(?:[.):\s]|$)/i);
    if (m && sections.choices.length) return m[1].toUpperCase();
    if (m && raw.length <= 3) return m[1].toUpperCase();
    return raw;
  }
  return answerFromSection(sections.answer) || answerFromSection(sections.body);
}

/** Decide how to present/grade a note even when question_type is free text like "Multiple choice (4 choices)". */
function inferMode(declared, key, choices) {
  const d = str(declared).toLowerCase();
  if (!key) return "self";
  const letter = /^[A-H]$/i.test(key);
  if (/spr|student.?produced|grid.?in|free.?response|short.?answer|numeric|fill/.test(d)) return "spr";
  if (/mcq|multiple|choice|select/.test(d)) return letter ? "mcq" : "self";
  if (!d && letter) return "mcq";
  if (letter && choices.length) return "mcq";
  return "self";
}

function replaceMyNotes(data, text) {
  const body = text.trim();
  const re = /(^## My Notes[ \t]*\n)([\s\S]*?)(?=^## |(?![\s\S]))/m;
  if (re.test(data)) {
    return data.replace(re, (_m, head) => `${head}\n${body}${body ? "\n" : ""}\n`);
  }
  return data.replace(/\s*$/, "") + `\n\n## My Notes\n\n${body}\n`;
}

function gradeAnswer(fm, chosen) {
  const key = str(fm.answer).trim();
  const type = fm.question_type || "mcq";
  if (!key) return null;
  if (type === "spr") {
    const norm = (x) => str(x).trim().toLowerCase().replace(/\s+/g, "");
    return key.split("|").map(norm).includes(norm(chosen));
  }
  return str(chosen).toUpperCase() === key.toUpperCase();
}

/** Mutates `fm` (inside processFrontMatter). Returns a summary. */
function applyAttempt(fm, a, intervals) {
  const iv = intervals && intervals.length ? intervals : DEFAULT_SETTINGS.intervals;
  const prev = Number(fm.streak) || 0;
  const streak = a.correct ? (a.conf === 1 ? prev : prev + 1) : 0;
  let days;
  if (!a.correct) days = 1;
  else if (a.conf === 1) days = 2;
  else days = iv[Math.min(Math.max(streak, 1) - 1, iv.length - 1)];

  const now = fmtDateTime(a.now);
  const chosen = str(a.chosen).replace(/[|\n\r]/g, "/");
  const history = Array.isArray(fm.history) ? fm.history : [];
  // date|result|seconds|answer|confidence|error_type
  history.push(`${now}|${a.correct ? "correct" : "incorrect"}|${a.seconds}|${chosen}|${a.conf}|`);
  fm.history = history;

  fm.attempts = (Number(fm.attempts) || 0) + 1;
  fm.correct_count = (Number(fm.correct_count) || 0) + (a.correct ? 1 : 0);
  fm.streak = streak;
  fm.time_spent_total = (Number(fm.time_spent_total) || 0) + a.seconds;
  fm.last_time_spent = a.seconds;
  fm.last_answer = chosen;
  fm.last_confidence = a.conf;
  fm.last_error_type = "";
  fm.result = a.correct ? "correct" : "incorrect";
  fm["date attempted"] = now;
  if (!fm.first_attempted) fm.first_attempted = now;
  fm.next_review = fmtDate(addDays(a.now, days));

  return {
    streak,
    attempts: fm.attempts,
    correctCount: fm.correct_count,
    nextReview: fm.next_review,
    target: Number(fm.target_seconds) || 0,
  };
}

function setLastErrorType(fm, type) {
  const history = Array.isArray(fm.history) ? fm.history : [];
  if (history.length) {
    const parts = str(history[history.length - 1]).split("|");
    while (parts.length < 6) parts.push("");
    parts[5] = type;
    history[history.length - 1] = parts.slice(0, 6).join("|");
    fm.history = history;
  }
  fm.last_error_type = type;
}

function fillDefaults(fm) {
  let n = 0;
  for (const [k, v] of Object.entries(TRACKING_DEFAULTS)) {
    if (!(k in fm)) {
      fm[k] = Array.isArray(v) ? [] : v;
      n++;
    }
  }
  return n;
}

/* ------------------------------------------------------------------ modal */

class NameModal extends Modal {
  constructor(app, title, initial, onSubmit) {
    super(app);
    this.title = title;
    this.initial = initial || "";
    this.onSubmit = onSubmit;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: this.title });
    const input = contentEl.createEl("input", { type: "text", cls: "qt-modal-input" });
    input.value = this.initial;
    const go = () => {
      const v = input.value.trim();
      if (!v) return;
      this.close();
      this.onSubmit(v);
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") go();
    });
    const btn = contentEl.createEl("button", { text: "Save", cls: "mod-cta qt-modal-btn" });
    btn.addEventListener("click", go);
    setTimeout(() => input.focus(), 50);
  }
  onClose() {
    this.contentEl.empty();
  }
}

/* ------------------------------------------------------------ OpenCode (AI) */

function modelFromString(s) {
  const t = str(s).trim();
  const i = t.indexOf("/");
  if (i < 1 || i === t.length - 1) return null;
  return { providerID: t.slice(0, i), modelID: t.slice(i + 1) };
}

function friendlyError(e, url) {
  const m = str(e && e.message ? e.message : e);
  if (/ECONNREFUSED|ERR_CONNECTION|Failed to fetch|ENOTFOUND|net::|ETIMEDOUT/i.test(m)) {
    return `Can't reach OpenCode at ${url}. Start it in a terminal with: opencode serve`;
  }
  if (/401|unauthori[sz]ed/i.test(m)) return "OpenCode rejected the username or password. Check the plugin settings.";
  return m;
}

/** Turn GET /session/:id/message output into simple chat turns. */
function partsToTurns(messages) {
  const turns = [];
  for (const m of Array.isArray(messages) ? messages : []) {
    const role = m && m.info && m.info.role === "user" ? "user" : "assistant";
    const texts = [];
    const tools = [];
    for (const p of (m && m.parts) || []) {
      if (!p) continue;
      if (p.type === "text" && !p.synthetic && !p.ignored && str(p.text).trim()) texts.push(p.text);
      else if (p.type === "tool") {
        const st = p.state || {};
        const inp = st.input || {};
        const detail =
          (typeof st.title === "string" && st.title) ||
          (typeof inp.filePath === "string" && inp.filePath) ||
          (typeof inp.command === "string" && inp.command) ||
          "";
        tools.push([str(p.tool), str(st.status), detail].filter(Boolean).join(" · "));
      }
    }
    if (texts.length || tools.length) turns.push({ role, texts, tools });
  }
  return turns;
}

function buildTutorContext(r, notesText, confLabels, mode) {
  const fm = r.fm || {};
  const sec = r.sections || {};
  const meta = ["test", "course", "section", "domain", "skill", "unit", "difficulty"]
    .filter((k) => fm[k])
    .map((k) => `${k}: ${fm[k]}`)
    .join(" | ");
  const errs = {};
  for (const h of Array.isArray(fm.history) ? fm.history : []) {
    const parts = str(h).split("|");
    if (parts[1] === "incorrect" && parts[5]) errs[parts[5]] = (errs[parts[5]] || 0) + 1;
  }
  const errLine = Object.entries(errs).map(([k, v]) => `${k} x${v}`).join(", ");
  const lines = [
    "You are a patient tutor helping a student review a practice question they just answered. " +
      "Be concise and concrete. Rely on the information below and do not invent details about the passage. Use Markdown.",
    "",
    meta,
    "",
    ...(sec.stimulus ? ["PASSAGE / STIMULUS:", sec.stimulus, ""] : []),
    "QUESTION:",
    sec.question || "(not available)",
    "",
    "CHOICES:",
    ...((sec.choices || []).map((c) => `${c.letter}. ${c.text}`)),
    "",
    `STUDENT'S ANSWER: ${r.chosen || "(self-graded)"} (${r.correct ? "correct" : "incorrect"})`,
    `CORRECT ANSWER: ${r.key || "(not stored)"}`,
    `TIME: ${r.seconds}s. CONFIDENCE: ${(confLabels || [])[(r.conf || 1) - 1] || r.conf}`,
    "",
    "OFFICIAL RATIONALE:",
    extractRationale(sec.answer || "") || "(none)",
  ];
  if (str(notesText).trim()) lines.push("", "STUDENT'S OWN NOTES:", notesText.trim());
  if (errLine) lines.push("", `PAST MISTAKE TYPES ON THIS QUESTION: ${errLine}`);
  if (mode === "agent" && r.file) {
    lines.push(
      "",
      `This question is stored in the Obsidian note "${r.file.path}". You may edit it if asked, but never change the ` +
        "tracking properties (result, attempts, correct_count, streak, history, next_review, time_spent_total, and similar) unless explicitly told to."
    );
  }
  return lines.join("\n");
}

function buildGeneralContext(app, mode) {
  let base = "";
  try {
    base = (app.vault.adapter && app.vault.adapter.basePath) || "";
  } catch (e) {
    /* mobile */
  }
  return [
    "You are helping maintain an Obsidian vault of practice-question notes (SAT, PSAT and AP).",
    "Each question note has YAML properties: static ones (question_id, test, subject, course, section, domain, skill, difficulty, unit, " +
      "question_type, choices, answer, source, target_seconds, tags) and tracking ones written by a plugin " +
      "(result, date attempted, first_attempted, attempts, correct_count, streak, time_spent_total, last_time_spent, last_answer, " +
      "last_confidence, last_error_type, flagged, next_review, history).",
    "The body uses the headings: ## Question, ## Answer Choices (lines like '- A. text'), ## Answer (a '> [!answer]-' callout with " +
      "'**Correct Answer: X**' and a rationale), and ## My Notes.",
    "Never change the tracking properties unless explicitly told to. Keep the format above when creating or editing notes.",
    base ? `The vault folder on disk is: ${base}` : "",
    mode === "tutor" ? "File editing is disabled in this chat; answer from the conversation only." : "You may read and edit files in the vault when asked.",
  ].filter(Boolean).join("\n");
}

class OpenCodeClient {
  constructor(ai) {
    this.ai = ai;
  }
  base() {
    return str(this.ai.url).trim().replace(/\/+$/, "") || "http://127.0.0.1:4096";
  }
  headers() {
    const h = {};
    if (this.ai.password) {
      const raw = `${this.ai.username || "opencode"}:${this.ai.password}`;
      h.Authorization = "Basic " + btoa(unescape(encodeURIComponent(raw)));
    }
    return h;
  }
  async req(method, path, body) {
    const r = await requestUrl({
      url: this.base() + path,
      method,
      headers: this.headers(),
      contentType: body !== undefined ? "application/json" : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      throw: false,
    });
    if (r.status === 401) throw new Error("401 unauthorized");
    if (r.status >= 400) throw new Error(`OpenCode returned ${r.status}: ${str(r.text).slice(0, 300)}`);
    try {
      return r.json;
    } catch (e) {
      return null;
    }
  }
  health() {
    return this.req("GET", "/global/health");
  }
  agents() {
    return this.req("GET", "/agent");
  }
  providers() {
    return this.req("GET", "/config/providers");
  }
  createSession(title) {
    return this.req("POST", "/session", { title });
  }
  messages(id) {
    return this.req("GET", `/session/${encodeURIComponent(id)}/message`);
  }
  send(id, body) {
    // blocks until the assistant has finished (including any tool use)
    return this.req("POST", `/session/${encodeURIComponent(id)}/message`, body);
  }
  abort(id) {
    return this.req("POST", `/session/${encodeURIComponent(id)}/abort`, {});
  }
}

/* ------------------------------------------- OpenCode: install + local server */

const OPENCODE_REPO = "anomalyco/opencode";

const PROVIDERS = [
  ["anthropic", "Anthropic (Claude)"],
  ["openai", "OpenAI"],
  ["openrouter", "OpenRouter"],
  ["google", "Google (Gemini)"],
  ["deepseek", "DeepSeek"],
  ["groq", "Groq"],
];

function nodeReq(name) {
  try {
    return require(name);
  } catch (e) {
    throw new Error("OpenCode auto-setup needs the desktop app (it isn't available on mobile yet).");
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmtMB = (n) => `${Math.round(n / 1048576)} MB`;

function platformTriple(procPlatform, procArch, isMusl) {
  const os = { win32: "windows", darwin: "darwin", linux: "linux" }[procPlatform];
  const arch = { x64: "x64", arm64: "arm64" }[procArch];
  if (!os || !arch) return null;
  return { os, arch, musl: os === "linux" && !!isMusl };
}

function candidateAssetNames(tr) {
  const base = `opencode-${tr.os}-${tr.arch}`;
  const ext = tr.os === "linux" ? ".tar.gz" : ".zip";
  const musl = tr.musl ? "-musl" : "";
  const names = [`${base}${musl}${ext}`];
  if (tr.arch === "x64") names.push(`${base}-baseline${musl}${ext}`); // CPUs without AVX2
  return names;
}

/** First stable release that has a matching asset. Returns assets in preference order. */
function chooseRelease(releases, names) {
  for (const rel of Array.isArray(releases) ? releases : []) {
    if (!rel || rel.draft || rel.prerelease) continue;
    const found = names.map((n) => (rel.assets || []).find((a) => a.name === n)).filter(Boolean);
    if (found.length) return { tag: rel.tag_name, assets: found };
  }
  return null;
}

function mergeAuth(existingText, providerId, key) {
  let obj = {};
  if (str(existingText).trim()) {
    try {
      obj = JSON.parse(existingText);
    } catch (e) {
      throw new Error("OpenCode's auth.json isn't valid JSON, so I left it alone. Fix or delete it, then try again.");
    }
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) throw new Error("OpenCode's auth.json has an unexpected shape, so I left it alone.");
  }
  obj[providerId] = { type: "api", key };
  return JSON.stringify(obj, null, 2) + "\n";
}

function runCmd(cmd, args, opts) {
  const { execFile } = nodeReq("child_process");
  return new Promise((resolve, reject) => {
    execFile(cmd, args, Object.assign({ windowsHide: true, maxBuffer: 1 << 24 }, opts || {}), (err, stdout, stderr) => {
      if (err) reject(new Error(str(stderr || err.message).slice(0, 400)));
      else resolve(str(stdout));
    });
  });
}

function downloadFile(url, dest, onProgress, hops) {
  hops = hops || 0;
  return new Promise((resolve, reject) => {
    if (hops > 6) return reject(new Error("Too many redirects while downloading."));
    const u = new URL(url);
    const lib = nodeReq(u.protocol === "http:" ? "http" : "https");
    const fs = nodeReq("fs");
    const crypto = nodeReq("crypto");
    const req = lib.get(url, { headers: { "User-Agent": "obsidian-question-tracker", Accept: "application/octet-stream" } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        resolve(downloadFile(new URL(res.headers.location, url).toString(), dest, onProgress, hops + 1));
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`Download failed: HTTP ${res.statusCode}`));
        return;
      }
      const total = Number(res.headers["content-length"]) || 0;
      let got = 0;
      const hash = crypto.createHash("sha256");
      const out = fs.createWriteStream(dest);
      res.on("data", (c) => {
        got += c.length;
        hash.update(c);
        if (onProgress) onProgress(got, total);
      });
      res.on("error", reject);
      out.on("error", reject);
      out.on("finish", () => resolve({ sha256: hash.digest("hex"), bytes: got }));
      res.pipe(out);
    });
    req.on("error", reject);
    req.setTimeout(60000, () => req.destroy(new Error("Download timed out.")));
  });
}

async function extractArchive(archive, destDir) {
  const fs = nodeReq("fs");
  fs.mkdirSync(destDir, { recursive: true });
  try {
    // bsdtar (Windows 10+, macOS) reads .zip too; GNU tar reads the Linux .tar.gz
    await runCmd("tar", ["-xf", archive, "-C", destDir]);
    return;
  } catch (first) {
    if (process.platform === "win32") {
      const q = (s) => s.replace(/'/g, "''");
      await runCmd("powershell", ["-NoProfile", "-Command", `Expand-Archive -LiteralPath '${q(archive)}' -DestinationPath '${q(destDir)}' -Force`]);
    } else if (/\.zip$/i.test(archive)) {
      await runCmd("unzip", ["-o", archive, "-d", destDir]);
    } else {
      throw first;
    }
  }
}

function findBinaryIn(dir) {
  const fs = nodeReq("fs");
  const path = nodeReq("path");
  const want = process.platform === "win32" ? "opencode.exe" : "opencode";
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    let ents;
    try {
      ents = fs.readdirSync(d, { withFileTypes: true });
    } catch (e) {
      continue;
    }
    for (const e of ents) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.name === want) return p;
    }
  }
  return null;
}

function freePort() {
  const net = nodeReq("net");
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}

class ConfirmModal extends Modal {
  constructor(app, title, body, okText, resolve) {
    super(app);
    this.title = title;
    this.body = body;
    this.okText = okText;
    this.resolve = resolve;
    this.done = false;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: this.title });
    for (const par of this.body.split("\n\n")) contentEl.createEl("p", { text: par });
    const row = contentEl.createDiv({ cls: "qt-row" });
    const cancel = row.createEl("button", { text: "Cancel", cls: "qt-grow" });
    const ok = row.createEl("button", { text: this.okText, cls: "mod-cta qt-grow" });
    cancel.addEventListener("click", () => this.finish(false));
    ok.addEventListener("click", () => this.finish(true));
  }
  finish(v) {
    this.done = true;
    this.resolve(v);
    this.close();
  }
  onClose() {
    if (!this.done) this.resolve(false);
    this.contentEl.empty();
  }
}

/** Downloads OpenCode once, then runs `opencode serve` on localhost while Obsidian is open. */
class OpenCodeManager {
  constructor(plugin) {
    this.plugin = plugin;
    this.proc = null;
    this.conn = null;
    this.tail = "";
    this.starting = null;
    this.root = null;
  }

  get ai() {
    return this.plugin.settings.ai;
  }

  installRoot() {
    if (!this.root) {
      const os = nodeReq("os");
      const path = nodeReq("path");
      this.root = path.join(os.homedir(), ".question-tracker", "opencode");
    }
    return this.root;
  }

  isRunning() {
    return !!(this.proc && this.proc.exitCode === null && !this.proc.killed && this.conn);
  }

  async version(bin, viaPath) {
    try {
      const out = await runCmd(bin, ["--version"], { timeout: 20000, shell: !!viaPath && process.platform === "win32" });
      return out.trim().split(/\s+/).pop() || "unknown";
    } catch (e) {
      return "";
    }
  }

  /** Where an existing OpenCode lives, if anywhere. Uses a copy you already have before downloading one. */
  async findBinary() {
    const fs = nodeReq("fs");
    const path = nodeReq("path");
    const os = nodeReq("os");
    const exe = process.platform === "win32" ? "opencode.exe" : "opencode";
    const tries = [this.ai.binaryPath, this.ai.managedBinary, path.join(os.homedir(), ".opencode", "bin", exe)].filter(Boolean);
    for (const p of tries) {
      if (fs.existsSync(p) && (await this.version(p))) return p;
    }
    if (await this.version("opencode", true)) return "opencode";
    return null;
  }

  async describe() {
    if (!Platform.isDesktopApp) return "Auto-setup needs the desktop app.";
    if (this.isRunning()) return `Running on ${this.conn.url}${this.ai.installedVersion ? ` (v${this.ai.installedVersion})` : ""}.`;
    const bin = await this.findBinary();
    if (!bin) return "Not installed. Press Download and install, or choose a copy you already have.";
    const v = await this.version(bin, bin === "opencode");
    return `Installed (v${v}) at ${bin}. Not running; it starts when you use the AI chat.`;
  }

  async plan() {
    if (!Platform.isDesktopApp) throw new Error("OpenCode auto-setup needs the desktop app (it isn't available on mobile yet).");
    const fs = nodeReq("fs");
    const tr = platformTriple(process.platform, process.arch, process.platform === "linux" && fs.existsSync("/etc/alpine-release"));
    if (!tr) throw new Error(`Auto-install isn't available for ${process.platform}/${process.arch}. Install OpenCode yourself (npm i -g opencode-ai) and it will be found automatically.`);
    const r = await requestUrl({
      url: `https://api.github.com/repos/${OPENCODE_REPO}/releases?per_page=20`,
      headers: { Accept: "application/vnd.github+json" },
      throw: false,
    });
    if (r.status !== 200) throw new Error(`Couldn't look up OpenCode releases (GitHub returned ${r.status}). Try again later, or install OpenCode yourself (npm i -g opencode-ai).`);
    const pick = chooseRelease(r.json, candidateAssetNames(tr));
    if (!pick) throw new Error(`No OpenCode download matches ${tr.os}/${tr.arch}. Install OpenCode yourself (npm i -g opencode-ai) and it will be found automatically.`);
    return { tag: pick.tag, assets: pick.assets, size: pick.assets[0].size || 0 };
  }

  async install(progress, confirm) {
    progress = progress || (() => {});
    progress("Looking up the latest OpenCode release...");
    const plan = await this.plan();
    confirm =
      confirm ||
      ((pl) =>
        this.plugin.askConfirm(
          "Download OpenCode?",
          "OpenCode is a separate, free, open-source program (not part of this plugin) that powers the AI agent.\n\n" +
            `This will download ${pl.tag} from github.com/${OPENCODE_REPO}${pl.size ? ` (about ${fmtMB(pl.size)})` : ""}, ` +
            "check its SHA-256 checksum, and unpack it into a folder in your user profile, outside your vault:\n" +
            `${this.installRoot()}\n\n` +
            "It only runs while Obsidian is open, is reachable only from this computer, and contacts the AI provider you configure. " +
            "In Agent mode it can read and edit files in your vault. You can delete that folder at any time.",
          "Download and install"
        ));
    if (!(await confirm(plan))) throw new Error("OpenCode install cancelled.");
    let lastErr;
    for (const asset of plan.assets) {
      try {
        return await this.installAsset(plan.tag, asset, progress);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr;
  }

  async installAsset(tag, asset, progress) {
    const fs = nodeReq("fs");
    const path = nodeReq("path");
    const os = nodeReq("os");
    const safe = (s) => str(s).replace(/[^\w.\-]/g, "_");
    const dest = path.join(this.installRoot(), `${safe(tag)}-${safe(asset.name.replace(/\.(zip|tar\.gz)$/, ""))}`);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "qt-opencode-"));
    try {
      const archive = path.join(tmp, asset.name);
      let lastPct = -2;
      progress(`Downloading OpenCode ${tag}...`);
      const res = await downloadFile(asset.browser_download_url, archive, (got, total) => {
        const pct = total ? Math.floor((got / total) * 100) : -1;
        if (pct !== lastPct) {
          lastPct = pct;
          progress(total ? `Downloading OpenCode... ${pct}% (${fmtMB(got)} of ${fmtMB(total)})` : `Downloading OpenCode... ${fmtMB(got)}`);
        }
      });
      const digest = str(asset.digest).replace(/^sha256:/i, "").toLowerCase();
      const verified = /^[0-9a-f]{64}$/.test(digest);
      if (!verified) throw new Error("GitHub didn't publish a checksum for this download, so it was not installed. Install OpenCode yourself and choose it under \"OpenCode program\" in settings.");
      if (digest !== res.sha256) throw new Error("The download failed its SHA-256 check, so it was discarded.");

      progress("Unpacking...");
      fs.rmSync(dest, { recursive: true, force: true });
      await extractArchive(archive, dest);
      const bin = findBinaryIn(dest);
      if (!bin) throw new Error("The download didn't contain an opencode program.");
      if (process.platform !== "win32") fs.chmodSync(bin, 0o755);

      progress("Checking that it runs (the first run can take a minute while antivirus checks it)...");
      let v = await this.version(bin);
      if (!v && process.platform === "darwin") {
        try {
          await runCmd("codesign", ["--force", "--sign", "-", bin]);
        } catch (e) {
          /* best effort */
        }
        v = await this.version(bin);
      }
      if (!v) throw new Error("The downloaded OpenCode didn't start on this computer.");

      this.ai.managedBinary = bin;
      this.ai.installedVersion = v;
      await this.plugin.save();

      // keep only the current version
      for (const e of fs.readdirSync(this.installRoot(), { withFileTypes: true })) {
        const p = path.join(this.installRoot(), e.name);
        if (e.isDirectory() && p !== dest) fs.rmSync(p, { recursive: true, force: true });
      }
      return { version: v, verified, path: bin };
    } finally {
      try {
        fs.rmSync(tmp, { recursive: true, force: true });
      } catch (e) {
        /* ignore */
      }
    }
  }

  /** OpenCode's data folder for the managed server. Kept separate from any other OpenCode install so their databases can't collide. */
  dataHome() {
    const path = nodeReq("path");
    const os = nodeReq("os");
    return path.join(os.homedir(), ".question-tracker", "opencode-data");
  }

  /** Move a broken OpenCode database aside (kept as .broken-<time>) so it can create a fresh one. Returns true if anything was moved. */
  quarantineDb() {
    const fs = nodeReq("fs");
    const path = nodeReq("path");
    const os = nodeReq("os");
    const dirs = [path.join(this.dataHome(), "opencode")];
    const stamp = Date.now();
    let moved = false;
    for (const dir of dirs) {
      for (const name of ["opencode.db", "opencode.db-wal", "opencode.db-shm"]) {
        const f = path.join(dir, name);
        try {
          if (fs.existsSync(f)) {
            fs.renameSync(f, `${f}.broken-${stamp}`);
            moved = true;
          }
        } catch (e) {
          /* ignore */
        }
      }
    }
    return moved;
  }

  async start(progress, retried) {
    progress = progress || (() => {});
    if (this.isRunning()) return;
    const bin = await this.findBinary();
    if (!bin) throw new Error("OpenCode isn't installed.");
    const { spawn } = nodeReq("child_process");
    const crypto = nodeReq("crypto");
    const os = nodeReq("os");
    const port = await freePort();
    const password = crypto.randomBytes(16).toString("hex");
    progress("Starting OpenCode...");
    try {
      nodeReq("fs").mkdirSync(this.dataHome(), { recursive: true });
    } catch (e) {
      /* ignore */
    }
    this.tail = "";
    const proc = spawn(bin, ["serve", "--hostname", "127.0.0.1", "--port", String(port)], {
      cwd: this.plugin.vaultPath() || os.homedir(),
      env: Object.assign({}, process.env, {
        OPENCODE_SERVER_PASSWORD: password,
        OPENCODE_SERVER_USERNAME: "opencode",
        XDG_DATA_HOME: this.dataHome(),
      }),
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      shell: bin === "opencode" && process.platform === "win32",
    });
    const keep = (d) => (this.tail = (this.tail + d).slice(-1500));
    proc.stdout.on("data", keep);
    proc.stderr.on("data", keep);
    proc.on("error", (e) => keep(e.message));
    proc.on("exit", () => {
      if (this.proc === proc) {
        this.proc = null;
        this.conn = null;
      }
    });
    this.proc = proc;
    this.conn = { url: `http://127.0.0.1:${port}`, username: "opencode", password };

    const client = new OpenCodeClient(this.conn);
    const t0 = Date.now();
    for (let i = 0; i < 180; i++) {
      if (!this.isRunning()) {
        const out = this.tail.replace(/\x1b\[[0-9;]*m/g, "").replace(/\[[0-9;]*m/g, "").trim();
        if (!retried && /Database is not empty|no session table/i.test(out) && this.quarantineDb()) {
          progress("Repairing OpenCode's database...");
          return this.start(progress, true);
        }
        throw new Error(`OpenCode stopped right after starting. ${out.slice(-300)}`);
      }
      try {
        await client.health();
        return;
      } catch (e) {
        if (i % 2 === 1) {
          const secs = Math.round((Date.now() - t0) / 1000);
          progress(secs > 10 ? `Starting OpenCode... ${secs}s (the first start is slow while antivirus checks the program)` : `Starting OpenCode... ${secs}s`);
        }
        await sleep(500);
      }
    }
    this.stop();
    throw new Error(`OpenCode didn't become ready within 90 seconds. ${this.tail.trim().slice(-300)}`);
  }

  stop() {
    const p = this.proc;
    this.proc = null;
    this.conn = null;
    if (p && p.exitCode === null) {
      try {
        p.kill();
      } catch (e) {
        /* ignore */
      }
      const t = setTimeout(() => {
        try {
          if (p.exitCode === null) p.kill("SIGKILL");
        } catch (e) {
          /* ignore */
        }
      }, 3000);
      if (t && t.unref) t.unref();
    }
  }

  /** Make sure an existing OpenCode is running. It never downloads anything. Safe to call repeatedly. */
  ensure(progress) {
    if (this.starting) return this.starting;
    this.starting = (async () => {
      if (this.isRunning()) return;
      if (!Platform.isDesktopApp) throw new Error("OpenCode auto-setup needs the desktop app (it isn't available on mobile yet).");
      if (!(await this.findBinary())) {
        throw new Error("OpenCode isn't set up yet. Open Settings > MCQ Tracker > AI assistant and press Download and install, or choose a copy you already have.");
      }
      await this.start(progress);
    })().finally(() => {
      this.starting = null;
    });
    return this.starting;
  }

  /** Save an API key into OpenCode's own auth.json (merged, not overwritten). */
  saveProviderKey(providerId, key) {
    const fs = nodeReq("fs");
    const path = nodeReq("path");
    const os = nodeReq("os");
    const dir = path.join(this.dataHome(), "opencode");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, "auth.json");
    let cur = "";
    try {
      cur = fs.readFileSync(file, "utf8");
    } catch (e) {
      /* new file */
    }
    fs.writeFileSync(file, mergeAuth(cur, providerId, key.trim()), { mode: 0o600 });
    if (process.platform !== "win32") fs.chmodSync(file, 0o600); // the file holds secrets: owner-only even if it already existed
    this.stop(); // restart on next use so it picks the key up
    return file;
  }
}

/* ---------------------------------------------- Direct API chat (works on phones) */

const API_PRESETS = {
  anthropic: { label: "Anthropic (Claude)", kind: "anthropic", base: "https://api.anthropic.com", defaultModel: "claude-sonnet-5-5" },
  openai: { label: "OpenAI", kind: "openai", base: "https://api.openai.com/v1", defaultModel: "" },
  openrouter: { label: "OpenRouter", kind: "openai", base: "https://openrouter.ai/api/v1", defaultModel: "" },
  google: { label: "Google Gemini", kind: "openai", base: "https://generativelanguage.googleapis.com/v1beta/openai", defaultModel: "" },
  ollama: { label: "Ollama (same computer only)", kind: "openai", base: "http://localhost:11434/v1", defaultModel: "", noKey: true },
  custom: { label: "Other OpenAI-compatible", kind: "openai", base: "", defaultModel: "" },
};

function friendlyApiError(e) {
  const m = str(e && e.message ? e.message : e);
  if (/HTTP 401|HTTP 403/.test(m)) return `The provider rejected the API key, or the key can't use this model. ${m}`;
  if (/HTTP 429/.test(m)) return `The provider says you're rate limited or out of credit. ${m}`;
  if (/ENOTFOUND|ECONNREFUSED|Failed to fetch|net::|ETIMEDOUT/i.test(m)) {
    return "Couldn't reach the provider. Check your internet connection and the base URL in settings.";
  }
  return m;
}

function apiTurns(history) {
  return (history || []).map((m) => ({ role: m.role === "user" ? "user" : "assistant", texts: [m.content], tools: [] }));
}

/** Plain chat against Anthropic or any OpenAI-compatible endpoint. One request, no streaming. */
class ApiClient {
  constructor(ai) {
    this.ai = ai;
  }
  cfg() {
    const a = this.ai.api || {};
    const preset = API_PRESETS[a.provider] || API_PRESETS.custom;
    return {
      preset,
      base: (str(a.baseUrl).trim() || preset.base).replace(/\/+$/, ""),
      key: str((a.keys || {})[a.provider]).trim(),
      model: str(a.model).trim(),
    };
  }
  async chat(system, messages, opts) {
    const { preset, base, key, model } = this.cfg();
    if (!base) throw new Error("Add a base URL in the plugin settings.");
    if (!model) throw new Error("Add a model name in the plugin settings.");
    if (!key && !preset.noKey) throw new Error("Add your API key in the plugin settings.");
    const msgs = messages.slice(-20);
    while (msgs.length && msgs[0].role !== "user") msgs.shift(); // providers require a user turn first

    let url, headers, body;
    if (preset.kind === "anthropic") {
      url = `${base}/v1/messages`;
      headers = { "x-api-key": key, "anthropic-version": "2023-06-01" };
      body = { model, max_tokens: (opts && opts.maxTokens) || 1500, system, messages: msgs };
    } else {
      url = `${base}/chat/completions`;
      headers = key ? { Authorization: `Bearer ${key}` } : {};
      body = { model, messages: [{ role: "system", content: system }, ...msgs] };
    }
    const r = await requestUrl({ url, method: "POST", headers, contentType: "application/json", body: JSON.stringify(body), throw: false });
    let data = null;
    try {
      data = r.json;
    } catch (e) {
      /* not JSON */
    }
    if (r.status >= 400) {
      const em = data && data.error ? data.error.message || data.error : r.text;
      throw new Error(`HTTP ${r.status}: ${str(typeof em === "string" ? em : JSON.stringify(em)).slice(0, 300)}`);
    }
    let text = "";
    if (preset.kind === "anthropic") {
      text = ((data && data.content) || []).filter((c) => c.type === "text").map((c) => c.text).join("\n");
    } else {
      const c = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      text = Array.isArray(c) ? c.map((x) => x.text || "").join("") : str(c);
    }
    if (!text.trim()) throw new Error("The provider returned an empty reply.");
    return text;
  }
}

class ChatPanel {
  /**
   * opts: { title, sourcePath, getSessionId, setSessionId, buildContext(mode), quick: [{label,prompt}], onSaveNote(text) }
   */
  constructor(view, root, opts) {
    this.view = view;
    this.root = root;
    this.opts = opts;
    this.busy = false;
    this.turns = [];
    this.pending = "";
    this.error = "";
    this.sig = "";
    this.build();
    if (this.view.plugin.backend() === "api") {
      this.turns = apiTurns(this.apiHistory());
      this.draw();
    } else if (this.ai.enabled && opts.getSessionId() && this.serverReady()) this.refresh();
  }

  get ai() {
    return this.view.plugin.settings.ai;
  }

  serverReady() {
    return this.view.plugin.backend() === "api" || !this.ai.managed || this.view.plugin.manager.isRunning();
  }

  apiHistory() {
    if (this.opts.getApiHistory) return this.opts.getApiHistory();
    return (this._h = this._h || []);
  }

  build() {
    const root = this.root;
    root.empty();
    if (!this.ai.enabled) {
      root.createDiv({
        cls: "qt-hint",
        text: "OpenCode is turned off. Enable it in Settings > MCQ Tracker > OpenCode (AI).",
      });
      return;
    }

    const top = root.createDiv({ cls: "qt-row qt-small-row" });
    if (this.view.plugin.backend() !== "api") {
      const modeSel = top.createEl("select", { cls: "qt-select" });
      modeSel.createEl("option", { value: "tutor", text: "Tutor (no file edits)" });
      modeSel.createEl("option", { value: "agent", text: "Agent (can edit files)" });
      modeSel.value = this.ai.mode;
      modeSel.addEventListener("change", () => {
        this.ai.mode = modeSel.value;
        this.view.plugin.save();
        this.updateHint();
      });
    }
    const nc = top.createEl("button", { text: "New chat" });
    nc.addEventListener("click", () => {
      if (this.busy) return;
      this.opts.setSessionId("");
      this.apiHistory().length = 0;
      this.turns = [];
      this.pending = "";
      this.error = "";
      this.sig = "";
      this.draw();
    });
    this.hint = root.createDiv({ cls: "qt-hint" });
    this.updateHint();

    if (this.opts.quick && this.opts.quick.length) {
      const chips = root.createDiv({ cls: "qt-chips" });
      for (const q of this.opts.quick) {
        const c = chips.createEl("button", { text: q.label, cls: "qt-chip" });
        c.addEventListener("click", () => this.send(q.prompt));
      }
    }

    this.transcript = root.createDiv({ cls: "qt-chat" });
    this.status = root.createDiv({ cls: "qt-hint" });

    const row = root.createDiv({ cls: "qt-row" });
    this.input = row.createEl("textarea", {
      cls: "qt-chat-input",
      attr: { rows: "2", placeholder: "Ask a question... (Ctrl/Cmd+Enter to send)" },
    });
    this.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.send(this.input.value);
      }
    });
    this.sendBtn = row.createEl("button", { text: "Send", cls: "mod-cta" });
    this.sendBtn.addEventListener("click", () => this.send(this.input.value));
    this.stopBtn = row.createEl("button", { text: "Stop" });
    this.stopBtn.style.display = "none";
    this.stopBtn.addEventListener("click", async () => {
      const sid = this.opts.getSessionId();
      if (!sid) return;
      try {
        await this.view.plugin.openCode().abort(sid);
      } catch (e) {
        /* ignore */
      }
    });
    this.draw();
  }

  updateHint() {
    if (!this.hint) return;
    if (this.view.plugin.backend() === "api") {
      this.hint.setText("Direct API chat: it can see this question, but has no access to your files.");
      return;
    }
    this.hint.setText(
      this.ai.mode === "agent"
        ? "Agent mode: OpenCode may read and edit files in its working folder. Edits that need approval in your OpenCode permissions will wait until you press Stop."
        : "Tutor mode: file-editing tools are switched off for this chat."
    );
  }

  setBusy(b) {
    this.busy = b;
    if (!this.sendBtn) return;
    this.sendBtn.disabled = b;
    this.stopBtn.style.display = b && this.view.plugin.backend() !== "api" ? "" : "none";
    this.status.setText(b ? "Working..." : "");
  }

  async send(text) {
    text = str(text).trim();
    if (!text || this.busy || !this.ai.enabled) return;
    if (this.view.plugin.backend() === "api") return this.sendApi(text);
    const plugin = this.view.plugin;
    const ai = this.ai;
    this.error = "";
    this.input.value = "";
    this.pending = text;
    this.setBusy(true);
    this.draw();
    let sid = this.opts.getSessionId();
    let timer = null;
    try {
      // First use: offers to download OpenCode, then starts it in the background.
      if (ai.managed) await plugin.ensureOpenCode((m) => this.status.setText(m));
      const oc = plugin.openCode();
      if (sid) {
        try {
          await oc.messages(sid);
        } catch (e) {
          sid = ""; // the old session is gone (fresh install or server data cleared)
          this.opts.setSessionId("");
          this.turns = [];
        }
      }
      if (ai.managed) await this.checkProvider(oc);
      if (!sid) {
        const s = await oc.createSession(this.opts.title || "MCQ Tracker");
        sid = s && s.id;
        if (!sid) throw new Error("OpenCode did not return a session id.");
        this.opts.setSessionId(sid);
      }
      this.status.setText("OpenCode is working...");
      const body = {
        parts: [{ type: "text", text }],
        system: this.opts.buildContext(ai.mode),
      };
      const model = modelFromString(ai.model);
      if (model) body.model = model;
      if (str(ai.agent).trim()) body.agent = ai.agent.trim();
      if (ai.mode === "tutor") body.tools = { edit: false, write: false, patch: false, bash: false };
      // The POST blocks until the reply is done, so poll the transcript meanwhile for live progress.
      const mySid = sid;
      timer = activeWindow.setInterval(() => this.refresh(mySid), 1500);
      await oc.send(sid, body);
    } catch (e) {
      this.error = friendlyError(e, plugin.openCode().base());
    } finally {
      if (timer) activeWindow.clearInterval(timer);
      this.setBusy(false);
      if (sid) await this.refresh(sid);
      else this.draw();
    }
  }

  async sendApi(text) {
    this.error = "";
    this.input.value = "";
    this.pending = text;
    this.setBusy(true);
    this.draw();
    const hist = this.apiHistory();
    try {
      const reply = await new ApiClient(this.ai).chat(this.opts.buildContext("tutor"), hist.concat([{ role: "user", content: text }]));
      hist.push({ role: "user", content: text }, { role: "assistant", content: reply });
      this.pending = "";
    } catch (e) {
      this.error = friendlyApiError(e);
      this.pending = "";
      this.input.value = text; // keep it so you can retry
    } finally {
      this.setBusy(false);
      this.turns = apiTurns(hist);
      this.draw();
    }
  }

  async checkProvider(oc) {
    let n = null;
    try {
      const cp = await oc.providers();
      if (cp && Array.isArray(cp.providers)) n = cp.providers.length;
    } catch (e) {
      return; // endpoint differs on this OpenCode version: let the request itself report problems
    }
    if (n === 0) {
      throw new Error(
        "OpenCode has no AI provider connected yet. Open Settings > MCQ Tracker > OpenCode (AI), choose a provider and paste an API key."
      );
    }
  }

  async refresh(sid) {
    sid = sid || this.opts.getSessionId();
    if (!sid || !this.serverReady()) return;
    try {
      const msgs = await this.view.plugin.openCode().messages(sid);
      this.turns = partsToTurns(msgs);
      const last = [...this.turns].reverse().find((t) => t.role === "user");
      if (this.pending && last && last.texts.join("\n").trim() === this.pending) this.pending = "";
      this.draw();
    } catch (e) {
      if (!this.busy) {
        this.error = friendlyError(e, this.view.plugin.openCode().base());
        this.draw();
      }
    }
  }

  draw() {
    if (!this.transcript) return;
    const sig = JSON.stringify([this.turns, this.pending, this.error, this.busy]);
    if (sig === this.sig) return;
    this.sig = sig;
    const box = this.transcript;
    box.empty();
    for (const t of this.turns) {
      const b = box.createDiv({ cls: `qt-msg is-${t.role}` });
      for (const text of t.texts) this.view.md(text, b.createDiv({ cls: "qt-msg-text" }), this.opts.sourcePath || "");
      for (const line of t.tools) b.createDiv({ cls: "qt-tool", text: line });
      if (t.role === "assistant" && t.texts.length && this.opts.onSaveNote && !this.busy) {
        const sv = b.createEl("button", { text: "Add to My Notes", cls: "qt-save-note" });
        sv.addEventListener("click", () => this.opts.onSaveNote(t.texts.join("\n\n")));
      }
    }
    if (this.pending) {
      box.createDiv({ cls: "qt-msg is-user" }).createDiv({ cls: "qt-msg-text", text: this.pending });
    }
    if (this.error) box.createDiv({ cls: "qt-error", text: this.error });
    box.scrollTop = box.scrollHeight;
  }
}

/* ------------------------------------------------------------------- view */

/* ------------------------------------------------------------ PDF import (AI) */

function parsePageRange(spec, total) {
  const s = str(spec).trim();
  if (!s) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set();
  for (const part of s.split(",")) {
    const m = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!m) throw new Error(`I couldn't read the page range "${s}". Use something like 1-10 or 2,4,6-8.`);
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let p = Math.min(a, b); p <= Math.max(a, b); p++) if (p >= 1 && p <= total) set.add(p);
  }
  const out = [...set].sort((x, y) => x - y);
  if (!out.length) throw new Error(`That page range has no pages (the PDF has ${total}).`);
  return out;
}

/** 2D matrix product, the same one pdf.js uses for [a b c d e f] transforms. */
function matMul(a, b) {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

/** Text lines with their vertical position (in the page picture's pixels), in reading order. */
function itemsToLines(items, viewport) {
  const lines = [];
  let cur = null;
  for (const it of items) {
    if (!it || typeof it.str !== "string") continue;
    const y = it.transform && viewport ? matMul(viewport.transform, it.transform)[5] : null;
    if (!cur || (y !== null && cur.y !== null && Math.abs(y - cur.y) > 3)) {
      cur = { text: "", y };
      lines.push(cur);
    }
    cur.text += it.str;
    if (it.hasEOL) cur = null;
  }
  return lines.map((l) => ({ text: l.text.replace(/[ \t]+$/, ""), y: l.y })).filter((l) => l.text.trim());
}

/** Where each piece of text sits on the page picture, so figures can be told apart from text. */
function textBoxes(items, viewport) {
  const out = [];
  for (const it of items) {
    if (!it || typeof it.str !== "string" || !it.str.trim() || !it.transform) continue;
    const t = matMul(viewport.transform, it.transform);
    const w = (it.width || 0) * viewport.scale;
    const h = (it.height || 0) * viewport.scale;
    out.push({ x0: t[4], x1: t[4] + w, y0: t[5] - h, y1: t[5] + h * 0.25, s: it.str.trim() });
  }
  return out;
}

function figMarker(f) {
  return `[FIGURE page ${f.page}: ![[${f.path}]]${f.pagePath ? ` (the whole page: ![[${f.pagePath}]])` : ""}]`;
}

/** The page's text with a marker line where each figure sits. */
function pageText(lines, figs) {
  const out = [];
  const pending = [...figs].sort((a, b) => a.y0 - b.y0);
  for (const l of lines) {
    while (pending.length && l.y !== null && l.y >= pending[0].y0) out.push(figMarker(pending.shift()));
    out.push(l.text);
  }
  for (const f of pending) out.push(figMarker(f));
  return out.join("\n").replace(/\n{3,}/g, "\n\n");
}

/**
 * Finds pictures, charts and diagrams on a rendered page: anything that is ink but not text.
 * data is RGBA pixels (W x H). boxes are the text boxes in the same pixel units. Returns pixel boxes.
 */
function detectFigures(data, W, H, boxes, scale) {
  const cell = Math.max(4, Math.round(3 * scale));
  const gw = Math.ceil(W / cell);
  const gh = Math.ceil(H / cell);
  const mask = new Uint8Array(W * H);
  for (const b of boxes) {
    const x0 = Math.max(0, Math.floor(b.x0 - 1));
    const x1 = Math.min(W, Math.ceil(b.x1 + 1));
    const y0 = Math.max(0, Math.floor(b.y0 - 1));
    const y1 = Math.min(H, Math.ceil(b.y1 + 1));
    for (let y = y0; y < y1; y++) mask.fill(1, y * W + x0, y * W + x1);
  }
  const ink = new Uint8Array(gw * gh);
  for (let y = 0; y < H; y++) {
    const gy = (y / cell) | 0;
    for (let x = 0; x < W; x++) {
      if (mask[y * W + x]) continue;
      const i = (y * W + x) * 4;
      if (data[i + 3] < 20) continue;
      if ((data[i] + data[i + 1] + data[i + 2]) / 3 < 235) ink[gy * gw + ((x / cell) | 0)] = 1;
    }
  }

  // group nearby ink into blobs
  const r = Math.max(2, Math.ceil((8 * scale) / cell));
  const seen = new Uint8Array(gw * gh);
  const comps = [];
  for (let s = 0; s < ink.length; s++) {
    if (!ink[s] || seen[s]) continue;
    const stack = [s];
    seen[s] = 1;
    let minx = 1e9, maxx = -1, miny = 1e9, maxy = -1, n = 0;
    while (stack.length) {
      const c = stack.pop();
      const cx = c % gw;
      const cy = (c / gw) | 0;
      n++;
      if (cx < minx) minx = cx;
      if (cx > maxx) maxx = cx;
      if (cy < miny) miny = cy;
      if (cy > maxy) maxy = cy;
      for (let dy = -r; dy <= r; dy++) {
        const ny = cy + dy;
        if (ny < 0 || ny >= gh) continue;
        for (let dx = -r; dx <= r; dx++) {
          const nx = cx + dx;
          if (nx < 0 || nx >= gw) continue;
          const k = ny * gw + nx;
          if (ink[k] && !seen[k]) {
            seen[k] = 1;
            stack.push(k);
          }
        }
      }
    }
    comps.push({ x0: minx * cell, y0: miny * cell, x1: (maxx + 1) * cell, y1: (maxy + 1) * cell, n });
  }

  const minSide = 28 * scale;
  let figs = [];
  for (const c of comps) {
    const w = c.x1 - c.x0;
    const h = c.y1 - c.y0;
    if (w < minSide || h < minSide) continue; // specks, bullets, icons
    if ((w > 0.5 * W && h < 12 * scale) || (h > 0.5 * H && w < 12 * scale)) continue; // rules and borders
    if (c.y1 < 0.07 * H || c.y0 > 0.93 * H) continue; // logos in the header and footer
    if (w * h > 0.85 * W * H) continue; // a page frame
    if ((c.n * cell * cell) / (w * h) < 0.01) continue; // almost nothing in it
    let tArea = 0;
    for (const b of boxes) {
      const ox = Math.min(c.x1, b.x1) - Math.max(c.x0, b.x0);
      const oy = Math.min(c.y1, b.y1) - Math.max(c.y0, b.y0);
      if (ox > 0 && oy > 0) tArea += ox * oy;
    }
    if (tArea / (w * h) > 0.35) continue; // a shaded box that is mostly text
    figs.push({ x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1 });
  }

  // take in axis labels and captions that sit on or right next to the figure
  const pad = 6 * scale;
  const reach = 20 * scale;
  for (const f of figs) {
    const g = { x0: f.x0 - pad, y0: f.y0 - pad, x1: f.x1 + pad, y1: f.y1 + pad };
    const near = { x0: f.x0 - reach, y0: f.y0 - reach, x1: f.x1 + reach, y1: f.y1 + reach };
    for (const b of boxes) {
      const area = (b.x1 - b.x0) * (b.y1 - b.y0);
      if (area <= 0) continue;
      const label = typeof b.s === "string" && b.s.length <= 24 && b.x1 - b.x0 < 0.3 * W; // a tick, a label, a legend entry
      const g2 = label ? near : g;
      const ox = Math.min(g2.x1, b.x1) - Math.max(g2.x0, b.x0);
      const oy = Math.min(g2.y1, b.y1) - Math.max(g2.y0, b.y0);
      if (ox > 0 && oy > 0 && (ox * oy) / area >= (label ? 0.5 : 0.6)) {
        f.x0 = Math.min(f.x0, b.x0);
        f.y0 = Math.min(f.y0, b.y0);
        f.x1 = Math.max(f.x1, b.x1);
        f.y1 = Math.max(f.y1, b.y1);
      }
    }
    const m = 4 * scale;
    f.x0 = Math.max(0, f.x0 - m);
    f.y0 = Math.max(0, f.y0 - m);
    f.x1 = Math.min(W, f.x1 + m);
    f.y1 = Math.min(H, f.y1 + m);
  }

  // merge boxes that overlap
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < figs.length; i++) {
      for (let j = i + 1; j < figs.length; j++) {
        const a = figs[i];
        const b = figs[j];
        if (a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1) {
          figs[i] = { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
          figs.splice(j, 1);
          merged = true;
          break outer;
        }
      }
    }
  }
  return figs.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0).slice(0, 8);
}

async function renderPage(page, scale) {
  const viewport = page.getViewport({ scale });
  const canvas = activeDocument.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return { canvas, ctx, viewport };
}

function canvasToPng(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) return reject(new Error("The picture couldn't be created."));
      resolve(await blob.arrayBuffer());
    }, "image/png");
  });
}

function cropToPng(canvas, box) {
  const w = Math.max(1, Math.ceil(box.x1 - box.x0));
  const h = Math.max(1, Math.ceil(box.y1 - box.y0));
  const c = activeDocument.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d").drawImage(canvas, box.x0, box.y0, w, h, 0, 0, w, h);
  return canvasToPng(c).finally(() => {
    c.width = 0;
  });
}

/**
 * Reads the chosen pages. When `cap` is given, every page is also drawn so pictures can be cut out
 * and saved: cap = { prefix, scale, pages, save(name, arrayBuffer) -> vault path }.
 */
async function readPdfPages(buf, spec, progress, cap) {
  if (typeof loadPdfJs !== "function") throw new Error("This version of Obsidian can't read PDFs from plugins.");
  const pdfjs = await loadPdfJs();
  let doc;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise;
  } catch (e) {
    throw new Error("I couldn't open that PDF. It may be damaged or password protected.");
  }
  try {
    const wanted = parsePageRange(spec, doc.numPages);
    const pages = [];
    const warnings = [];
    let figCount = 0;
    for (let i = 0; i < wanted.length; i++) {
      const n = wanted[i];
      progress(`Reading page ${n} (${i + 1} of ${wanted.length})...`);
      const page = await doc.getPage(n);
      const tc = await page.getTextContent();
      const pad2 = String(n).padStart(2, "0");
      let figs = [];
      let vp = page.getViewport({ scale: 1 });
      if (cap) {
        try {
          const { canvas, ctx, viewport } = await renderPage(page, cap.scale || 2);
          vp = viewport;
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const found = detectFigures(img.data, canvas.width, canvas.height, textBoxes(tc.items, viewport), viewport.scale);
          let pagePath = "";
          if (cap.pages) pagePath = await cap.save(`${cap.prefix}-p${pad2}.png`, await canvasToPng(canvas));
          let k = 0;
          for (const f of found) {
            k++;
            const path = await cap.save(`${cap.prefix}-p${pad2}-fig${k}.png`, await cropToPng(canvas, f));
            figs.push({ page: n, y0: f.y0, path, pagePath });
            figCount++;
          }
          canvas.width = 0;
        } catch (e) {
          warnings.push(`Page ${n}: couldn't capture pictures (${e && e.message ? e.message : e}).`);
        }
      }
      pages.push({ n, text: pageText(itemsToLines(tc.items, vp), figs), figs: figs.length });
    }
    return { pages, total: doc.numPages, warnings, figCount };
  } finally {
    try {
      await doc.destroy();
    } catch (e) {
      /* ignore */
    }
  }
}

/** Groups pages into batches; the last page of a batch is repeated at the start of the next so a split question is seen whole. */
function chunkPages(pages, maxChars, maxPages) {
  const real = pages.filter((p) => p.text.trim().length > 20);
  const chunks = [];
  let i = 0;
  while (i < real.length) {
    let chars = 0;
    let j = i;
    while (j < real.length && j - i < maxPages && (j === i || chars + real[j].text.length <= maxChars)) {
      chars += real[j].text.length;
      j++;
    }
    chunks.push(real.slice(i, j));
    if (j >= real.length) break;
    i = j > i + 1 ? j - 1 : j;
  }
  return chunks;
}

function chunkText(chunk) {
  return chunk.map((p) => `--- Page ${p.n} ---\n${p.text.trim()}`).join("\n\n");
}

function slugId(s) {
  return str(s).toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "Q";
}

async function ensureFolder(app, folder) {
  const clean = normalizePath(str(folder).trim() || "/");
  if (clean === "/" || clean === "") return "";
  let cur = "";
  for (const part of clean.split("/").filter(Boolean)) {
    cur = cur ? `${cur}/${part}` : part;
    if (!app.vault.getAbstractFileByPath(cur)) await app.vault.createFolder(cur);
  }
  return cur;
}

class FolderSuggest extends AbstractInputSuggest {
  constructor(app, inputEl) {
    super(app, inputEl);
    this.inputEl = inputEl;
  }
  getSuggestions(query) {
    const q = str(query).toLowerCase();
    return this.app.vault
      .getAllFolders(false)
      .filter((f) => f.path.toLowerCase().includes(q))
      .slice(0, 20);
  }
  renderSuggestion(f, el) {
    el.setText(f.path);
  }
  selectSuggestion(f) {
    this.inputEl.value = f.path;
    this.inputEl.dispatchEvent(new Event("input"));
    this.close();
  }
}

/* ---- note format, rules and prompts shared by both import methods */

const IMPORT_FORMAT = `---
question_id: PREFIX-Q01
number: 1
question_type: mcq
choices: 4
answer: B
answer_source: pdf
explanation_source: pdf
stimulus_id: PREFIX-S01
---

## Stimulus
> The passage, table or data the question depends on. Every line starts with "> ".

## Question
The question text.

## Answer Choices
- A. First choice
- B. Second choice
- C. Third choice
- D. Fourth choice

## Answer
> [!answer]- Reveal answer
> **Correct Answer: B**
>
> The explanation.

## My Notes
`;

const IMPORT_RULES = `Rules:
- Make one note per question. Copy the question, passage and choices exactly as written. Only remove page numbers, running headers and footers, and line-break hyphenation. Never paraphrase, shorten or "fix" them.
- Passage: one passage (stimulus) can have several questions, and those questions can be on later pages than the passage, even on the next page or after other pages. Work out which passage each question belongs to from its wording ("Text 1", "the passage", "the graph", "the table above" and so on) and from the order of the pages. Put the full passage under "## Stimulus" in EVERY question that uses it, repeated word for word, and give those questions the same stimulus_id. If a question has no passage, leave out the "## Stimulus" section and the stimulus_id line. Use markdown tables for tables and $...$ for math.
- Pictures: lines like [FIGURE page 3: ![[path/to/picture.png]]] in the text mark a picture, chart, diagram, photo or table image in the PDF at that spot. If a question or its passage depends on it, copy the exact ![[path]] part to where it belongs: on its own "> " line inside the Stimulus when it is part of the passage or data, inside the question text when it is shown with the question, or inside an answer choice (- A. ![[path]]) when the choice is a picture. Use the paths exactly as given and never invent one. If a "whole page" picture is also listed, use it only when the cropped figure is clearly cut off. If the text says a figure is needed and no marker is there, write "> [Figure not captured]" in the Stimulus and carry on.
- question_type is "mcq" when the question has answer choices (list them under "## Answer Choices" as "- A. text") and "choices" is how many there are. For a question with no answer choices, use "spr", leave out "## Answer Choices", and put the answer value in "answer".
- Answer: if the PDF shows the correct answer anywhere (for example an answer key at the end), use it and set answer_source: pdf. If the PDF does NOT show it, work the question out carefully yourself, give your best answer, and set answer_source: ai. For a multiple-choice answer use just the letter.
- Explanation: if the PDF gives one, copy it and set explanation_source: pdf. Otherwise write a short, correct explanation of why the answer is right (and why the others are wrong) and set explanation_source: ai.
- Do not write any "AI-generated" notice yourself. The plugin adds it.
- Never put a line starting with # inside the question, passage, choices or explanation.
- Do not add any properties other than those in the example, plus "skill" only if the PDF labels it.
- Leave out anything that is not a question (directions, ads, blank pages).`;

function agentPrompt(o) {
  const meta = [["test", o.meta.test], ["course", o.meta.course], ["section", o.meta.section], ["domain", o.meta.domain], ["unit", o.meta.unit], ["difficulty", o.meta.difficulty], ["skill", o.meta.skill]]
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  return [
    `Import every question from the PDF "${o.name}" into notes.`,
    "",
    "Files (paths are relative to the folder you are working in):",
    `- The PDF's text, with page markers: ${o.textPath}`,
    `- The PDF itself: ${o.pdfPath}`,
    `- Pictures cut from the PDF are in ${o.imagesDir}. Their paths appear in the text as [FIGURE ...] markers, so you don't need to open them.`,
    "",
    `Create the notes in this folder, which already exists: ${o.folder}`,
    `Use one file per question, named ${o.prefix}-Q01.md, ${o.prefix}-Q02.md and so on. If the PDF's own question numbers are all unique, use them (padded to two digits) instead. Use the prefix "${o.prefix}" for question_id and stimulus_id values too, and make question_id match the file name.`,
    meta ? `\nAdd these properties to every note exactly as written:\n${meta}` : "",
    "",
    "Use exactly this format for every note:",
    "```",
    IMPORT_FORMAT.replace(/PREFIX/g, o.prefix),
    "```",
    "",
    IMPORT_RULES,
    "",
    "Work through the whole PDF. Remember that a passage can be on an earlier page than its questions, so read the whole text before deciding which passage a question belongs to. Do not create, change or delete any file outside that folder, and do not delete anything. When you are done, reply with one short line: how many notes you created, and how many contain an answer or explanation you wrote yourself.",
  ]
    .filter((l) => l !== undefined)
    .join("\n");
}

const AGENT_SYSTEM = "You are importing practice-test questions from a PDF into an Obsidian vault. Work only inside the folder you are told to use. Be accurate and complete: every question in the PDF must become exactly one note.";

const API_SYSTEM = `You turn pages of a practice-test PDF into Obsidian notes.
Reply with the notes only. Start each note with a line containing exactly =====NOTE===== and then the complete note, starting with the --- line. No other text and no code fences.

Use exactly this format for every note (leave question_id as PREFIX-Q01; it is replaced later):

${IMPORT_FORMAT}
${IMPORT_RULES}
- If a question is cut off at the start or end of the pages you are given so that it is incomplete, leave it out. It is included in the next batch.
- If a block called ANSWER KEY FROM ELSEWHERE IN THE PDF is given, use it for answers and explanations (answer_source: pdf, explanation_source: pdf).
- If a block called PASSAGES CARRIED OVER FROM EARLIER PAGES is given, those passages are on pages before the ones you were sent. Questions at the start of your pages that need a passage which isn't in your pages belong to one of them. Copy that passage exactly into those notes.`;

function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseNote(text) {
  const t = str(text).replace(/\r\n/g, "\n");
  const m = t.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  let fm = {};
  let body = t;
  if (m) {
    try {
      fm = parseYaml(m[1]) || {};
    } catch (e) {
      fm = {};
    }
    body = m[2];
  }
  if (!fm || typeof fm !== "object" || Array.isArray(fm)) fm = {};
  return { fm, body, sec: parseSections(body) };
}

/** Splits an AI reply into notes. */
function splitNotes(reply) {
  const t = str(reply).replace(/```(?:markdown|md|yaml)?\s*\n/gi, "").replace(/\n```\s*(?=\n|$)/g, "\n");
  return t
    .split(/^=====NOTE=====\s*$/m)
    .map((b) => b.trim())
    .filter((b) => /^---\s*\n/.test(b));
}

/** Pages that look like an answer key or rationale section, so every batch can see them. */
function answerKeyText(pages) {
  const hits = pages.filter((p) => {
    const t = p.text;
    if (/answer\s*key|answers?\s*(and|&)\s*(explanations|rationales)|answer\s*explanations/i.test(t)) return true;
    return (t.match(/(?:^|\s)\d{1,3}\s*[.)\-:]\s*[A-Da-d](?=\s|$)/g) || []).length >= 8;
  });
  return hits.map((p) => `--- Page ${p.n} ---\n${p.text.trim()}`).join("\n\n").slice(0, 7000);
}

async function extractNotesChunk(client, chunk, keyText, carry) {
  const inChunk = new Set(chunk.map((p) => p.n));
  const key = keyText && !chunk.some((p) => keyText.includes(`--- Page ${p.n} ---`) && inChunk.has(p.n)) ? keyText : "";
  const user =
    `Pages ${chunk[0].n}-${chunk[chunk.length - 1].n} of the PDF:\n\n${chunkText(chunk)}` +
    (key ? `\n\nANSWER KEY FROM ELSEWHERE IN THE PDF:\n${key}` : "") +
    (carry && carry.length ? `\n\nPASSAGES CARRIED OVER FROM EARLIER PAGES:\n${carry.map((c, i) => `[Passage ${i + 1}]\n${c}`).join("\n\n")}` : "");
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const reply = await client.chat(API_SYSTEM, [{ role: "user", content: user }], { maxTokens: 8000 });
      return splitNotes(reply);
    } catch (e) {
      lastErr = e;
      if (attempt === 0) await sleep(1500);
    }
  }
  throw lastErr;
}

function noteSig(parsed) {
  const norm = (t, n) => str(t).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, n);
  const s = parsed.sec;
  const num = str(parsed.fm.number).trim();
  // a question seen twice (overlapping batches) may have a passage in one copy and not the other, so the passage only counts when there is no question number
  return [num, norm(s.question, 80), num ? "" : norm(s.stimulus, 40), norm(s.choices[0] ? s.choices[0].text : "", 30)].join("|");
}

/** The passages of the last few notes, so the next batch can attach questions to a passage from the page before. */
function carryPassages(blocks) {
  const seen = new Set();
  const out = [];
  for (const text of [...blocks].reverse()) {
    const st = str(parseNote(text).sec.stimulus).trim();
    const key = st.toLowerCase().replace(/\s+/g, " ");
    if (!st || seen.has(key)) continue;
    seen.add(key);
    out.push(st.slice(0, 4000));
    if (out.length >= 2) break;
  }
  return out.reverse();
}

/** Keeps the longest copy of each question (a question seen in two overlapping batches). */
function mergeNotes(blocks) {
  const all = [];
  for (const text of blocks) {
    const parsed = parseNote(text);
    if (!str(parsed.sec.question).trim()) continue;
    const item = { text, ...parsed, include: true, sig: noteSig(parsed), size: text.length };
    const i = all.findIndex((x) => x.sig === item.sig);
    if (i < 0) all.push(item);
    else if (item.size > all[i].size) all[i] = item;
  }
  return all;
}

function aiFlags(fm, sec) {
  const ans = str(fm.answer).trim();
  const rat = extractRationale(str(sec.answer))
    .replace(/\*\*\s*Correct Answer[^*\n]*\*\*/i, "")
    .trim();
  return {
    hasAnswer: !!ans,
    hasExp: !!rat,
    aiAnswer: !!ans && str(fm.answer_source).toLowerCase() !== "pdf",
    aiExp: !!rat && str(fm.explanation_source).toLowerCase() !== "pdf",
  };
}

/**
 * Turns the AI's note into the final note: tidy properties, tracking fields, and, when the AI wrote
 * the answer or explanation, a notice at the top naming the model and the date.
 */
function finalizeNote(text, meta, qid, stamp) {
  const { fm: src, body, sec } = parseNote(text);
  const fm = { question_id: qid };
  const num = src.number === null || src.number === undefined || src.number === "" ? NaN : Number(src.number);
  if (Number.isFinite(num)) fm.number = num;
  for (const k of ["test", "course", "section", "domain"]) {
    const v = meta[k] || src[k];
    if (v) fm[k] = v;
  }
  const skill = meta.skill || src.skill;
  if (skill) fm.skill = skill;
  const unit = meta.unit || src.unit;
  if (unit !== undefined && unit !== null && unit !== "") fm.unit = /^\d+$/.test(str(unit)) ? Number(unit) : unit;
  const diff = meta.difficulty || src.difficulty;
  if (diff) fm.difficulty = diff;
  if (meta.source) fm.source = meta.source;
  const stimId = stamp.stimId !== undefined ? stamp.stimId : src.stimulus_id;
  if (stimId && str(sec.stimulus).trim()) fm.stimulus_id = str(stimId);

  const type = sec.choices.length ? "mcq" : "spr";
  fm.question_type = type;
  if (type === "mcq") fm.choices = sec.choices.length;
  let ans = str(src.answer).trim();
  if (type === "mcq") {
    const m = ans.match(/^\(?([A-Ha-h])(?![A-Za-z])/);
    ans = m ? m[1].toUpperCase() : "";
  }
  if (ans) fm.answer = ans;
  const f = aiFlags({ ...src, answer: ans }, sec);
  if (f.hasAnswer) fm.answer_source = f.aiAnswer ? "ai" : "pdf";
  if (f.hasExp) fm.explanation_source = f.aiExp ? "ai" : "pdf";
  const ai = f.aiAnswer || f.aiExp;
  if (ai) {
    fm.ai_model = stamp.model;
    fm.ai_generated = stamp.date;
  }
  fillDefaults(fm);

  let cleaned = body.replace(/^\s*> \[!warning\] AI-generated[^\n]*(?:\n>[^\n]*)*\n+/i, "").trim();
  let notice = "";
  if (ai) {
    const what = f.aiAnswer && f.aiExp ? "answer and explanation" : f.aiAnswer ? "answer" : "explanation";
    notice =
      `> [!warning] AI-generated ${what}\n` +
      `> Written by ${stamp.model} on ${stamp.date}${f.aiAnswer ? ", because the PDF did not show the answer" : ""}. Check it before you rely on it.\n\n`;
  }
  return `---\n${stringifyYaml(fm).trimEnd()}\n---\n\n${notice}${cleaned}\n`;
}

async function ensureProviders(oc) {
  let n = null;
  try {
    const cp = await oc.providers();
    if (cp && Array.isArray(cp.providers)) n = cp.providers.length;
  } catch (e) {
    return;
  }
  if (n === 0) {
    throw new Error("OpenCode has no AI provider connected yet. Open Settings > MCQ Tracker > AI assistant, choose a provider and paste an API key.");
  }
}

function modelFromMessages(msgs) {
  for (const m of [...(Array.isArray(msgs) ? msgs : [])].reverse()) {
    const i = m && m.info;
    if (i && i.role !== "user") {
      const id = i.modelID || (i.model && i.model.modelID);
      const prov = i.providerID || (i.model && i.model.providerID);
      if (id) return prov ? `${prov}/${id}` : id;
    }
  }
  return "";
}

class PdfImportModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.file = null; // a File chosen from the device
    this.vaultPdf = ""; // or a PDF path inside the vault
    this.stop = false;
    this.closed = false;
    this.items = [];
    this.warnings = [];
    this.folderTouched = false;
    const st = plugin.settings;
    this.meta = Object.assign(
      { test: "", course: "", section: "", domain: "", skill: "", unit: "", difficulty: "", prefix: "", start: "1", pages: "" },
      st.importDefaults || {}
    );
    this.opts = Object.assign({ capture: true, pagePics: false }, st.importOptions || {});
    this.parent = st.importFolder || st.questionFolder || "Questions";
    this.folder = "";
    this.method = this.agentAvailable() ? "agent" : "api";
  }

  agentAvailable() {
    return Platform.isDesktopApp && this.plugin.backend() === "opencode";
  }

  onOpen() {
    this.modalEl.addClass("qt-import-modal");
    this.showSetup();
  }

  onClose() {
    this.closed = true;
    this.contentEl.empty();
  }

  status(msg) {
    if (this.statusEl) this.statusEl.setText(msg);
  }

  modelLabel() {
    const api = this.plugin.settings.ai.api || {};
    return `${api.model || "your AI model"}${api.provider ? ` (${api.provider})` : ""}`;
  }

  autoFolder(name) {
    return normalizePath(`${this.parent}/${name}`);
  }

  showSetup() {
    const el = this.contentEl;
    el.empty();
    el.createEl("h3", { text: "Import questions from a PDF" });

    const pdfs = this.app.vault.getFiles().filter((f) => f.extension.toLowerCase() === "pdf");
    const picked = new Setting(el).setName("PDF file").setDesc("No file chosen");
    const setName = (name) => {
      if (!this.folderTouched) {
        this.folder = this.autoFolder(name);
        if (this.folderText) this.folderText.setValue(this.folder);
      }
    };
    const input = createEl("input", { type: "file", attr: { accept: "application/pdf,.pdf" } });
    input.hidden = true;
    input.addEventListener("change", () => {
      this.file = input.files && input.files[0] ? input.files[0] : null;
      if (this.file) {
        this.vaultPdf = "";
        picked.setDesc(this.file.name);
        setName(this.file.name.replace(/\.pdf$/i, ""));
      }
    });
    picked.addButton((b) => b.setButtonText("Choose file...").onClick(() => input.click()));
    if (pdfs.length) {
      new Setting(el).setName("...or a PDF in your vault").addDropdown((d) => {
        d.addOption("", "Choose...");
        for (const f of pdfs) d.addOption(f.path, f.path);
        d.setValue(this.vaultPdf).onChange((v) => {
          this.vaultPdf = v;
          if (v) {
            this.file = null;
            picked.setDesc("No file chosen");
            setName(v.replace(/^.*\//, "").replace(/\.pdf$/i, ""));
          }
        });
      });
    }

    new Setting(el)
      .setName("Create the notes in a new folder")
      .setDesc("It must not exist yet, or be empty. It's created for you.")
      .addText((t) => {
        this.folderText = t;
        new FolderSuggest(this.app, t.inputEl);
        t.setPlaceholder("Example: Questions/SAT Practice Test 1").setValue(this.folder).onChange((v) => {
          this.folder = v;
          this.folderTouched = true;
        });
      });

    const agentOk = this.agentAvailable();
    new Setting(el)
      .setName("Who writes the notes")
      .setDesc(
        agentOk
          ? "The OpenCode agent reads the PDF and writes the note files itself. Direct AI sends the text to your provider and the plugin writes the files after you review them."
          : "Direct AI sends the PDF's text to your provider, and the plugin writes the files after you review them. To let the OpenCode agent write the files itself, switch the AI backend to OpenCode in settings (desktop only)."
      )
      .addDropdown((d) => {
        if (agentOk) d.addOption("agent", "OpenCode agent (writes the files itself)");
        d.addOption("api", "Direct AI (you review first)");
        d.setValue(this.method).onChange((v) => (this.method = v));
      });

    new Setting(el)
      .setName("Capture figures and pictures")
      .setDesc("Draws each page, cuts out charts, diagrams and images, saves them in an images folder next to the notes, and shows them in the questions that use them.")
      .addToggle((t) => t.setValue(this.opts.capture).onChange((v) => (this.opts.capture = v)));
    new Setting(el)
      .setName("Also save a picture of every page")
      .setDesc("A backup for when a figure isn't cut out cleanly. Uses more space.")
      .addToggle((t) => t.setValue(this.opts.pagePics).onChange((v) => (this.opts.pagePics = v)));

    const fields = [
      ["test", "Test", "Example: SAT, AP World History"],
      ["course", "Course", ""],
      ["section", "Section", ""],
      ["domain", "Domain", ""],
      ["unit", "Unit", "Example: 3"],
      ["difficulty", "Difficulty", "easy, medium or hard"],
      ["skill", "Skill (optional)", "Blank lets the PDF's own labels through"],
    ];
    el.createEl("h4", { text: "Properties added to every note (all optional)" });
    for (const [key, label, ph] of fields) {
      new Setting(el).setName(label).addText((t) => t.setPlaceholder(ph).setValue(this.meta[key]).onChange((v) => (this.meta[key] = v.trim())));
    }
    new Setting(el)
      .setName("Question id prefix")
      .setDesc("Ids look like PREFIX-Q01. Blank uses the PDF's name.")
      .addText((t) => t.setValue(this.meta.prefix).onChange((v) => (this.meta.prefix = v.trim())));
    new Setting(el)
      .setName("Pages (optional)")
      .setDesc("Blank means all pages. Example: 1-12 or 2,4,6-8. Try a few pages first to check the result and the cost.")
      .addText((t) => t.setValue(this.meta.pages).onChange((v) => (this.meta.pages = v.trim())));

    el.createEl("p", {
      cls: "qt-hint",
      text:
        "Where the PDF doesn't show an answer or explanation, the AI writes one and says so at the top of that note, with the model name and today's date. AI answers can be wrong, so check them. " +
        "The PDF's text is sent to your AI provider, which may charge for long PDFs. A copy of the PDF is saved in the new folder with the notes.",
    });

    const row = el.createDiv({ cls: "qt-row" });
    row.createEl("button", { text: "Cancel", cls: "qt-grow" }).addEventListener("click", () => this.close());
    row.createEl("button", { text: "Start import", cls: "mod-cta qt-grow" }).addEventListener("click", () => this.start());
  }

  async readSource() {
    if (this.file) return { buf: await this.file.arrayBuffer(), name: this.file.name.replace(/\.pdf$/i, ""), device: true };
    if (this.vaultPdf) {
      const f = this.app.vault.getAbstractFileByPath(this.vaultPdf);
      if (!(f instanceof TFile)) throw new Error("I couldn't find that PDF in your vault.");
      return { buf: await this.app.vault.readBinary(f), name: f.basename, device: false, path: f.path };
    }
    throw new Error("Choose a PDF first.");
  }

  async start() {
    const p = this.plugin;
    if (!p.settings.ai.enabled) {
      new Notice("Turn on AI features in the plugin settings first.");
      return;
    }
    if (!this.file && !this.vaultPdf) {
      new Notice("Choose a PDF first.");
      return;
    }
    const folderPath = normalizePath(str(this.folder).trim());
    if (!folderPath || folderPath === "/") {
      new Notice("Type a name for the new folder.");
      return;
    }
    const existing = this.app.vault.getFolderByPath(folderPath);
    if (existing && existing.children.length) {
      new Notice("That folder already has files in it. Choose a new folder name.");
      return;
    }
    this.target = folderPath;
    p.settings.importFolder = folderPath.includes("/") ? folderPath.slice(0, folderPath.lastIndexOf("/")) : "";
    p.settings.importDefaults = Object.assign({}, this.meta, { prefix: "", pages: "" });
    p.settings.importOptions = Object.assign({}, this.opts);
    await p.save();

    const el = this.contentEl;
    el.empty();
    el.createEl("h3", { text: "Importing" });
    this.statusEl = el.createDiv({ cls: "qt-hint", text: "Starting..." });
    this.activityEl = el.createDiv({ cls: "qt-tool" });
    this.stopBtn = el.createEl("button", { text: "Stop", cls: "qt-modal-btn" });
    this.stopBtn.addEventListener("click", () => {
      this.stop = true;
      this.stopBtn.disabled = true;
      this.status("Stopping...");
      if (this.sid) p.openCode().abort(this.sid).catch(() => {});
    });
    this.stop = false;
    this.sid = "";
    this.warnings = [];
    try {
      const src = await this.readSource();
      this.source = src.name;
      const vault = this.app.vault;
      const folder = await ensureFolder(this.app, this.target);
      const prefix = slugId(this.meta.prefix || src.name);
      // keep a copy of the PDF with the notes (before pdf.js reads it)
      this.status("Copying the PDF into the folder...");
      const pdfPath = normalizePath(`${folder}/${src.name.replace(/[\\/:*?"<>|]/g, "-")}.pdf`);
      await vault.createBinary(pdfPath, src.buf);
      const imagesDir = `${folder}/images`;
      const cap = this.opts.capture
        ? {
            prefix,
            scale: 2,
            pages: this.opts.pagePics,
            save: async (name, data) => {
              await ensureFolder(this.app, imagesDir);
              const path = normalizePath(`${imagesDir}/${name}`);
              await vault.createBinary(path, data);
              return path;
            },
          }
        : null;
      const read = await readPdfPages(src.buf, this.meta.pages, (m) => !this.closed && this.status(m), cap);
      const pages = read.pages;
      this.warnings.push(...read.warnings.slice(0, 5));
      const chars = pages.reduce((n, pg) => n + pg.text.trim().length, 0);
      if (chars < 40 * pages.length) {
        throw new Error("This PDF has almost no readable text, so it is probably scanned images. Scanned PDFs aren't supported yet. Run it through text recognition (OCR) first, for example by opening it in Google Drive or Adobe, then try again.");
      }
      this.ctx = { folder, prefix, pdfPath, imagesDir, pdfName: src.name, figCount: read.figCount };
      if (this.method === "agent") await this.runAgent(pages);
      else await this.runApi(pages);
    } catch (e) {
      if (this.closed) return;
      this.showError(e && e.message ? e.message : String(e));
    }
  }

  /* ---- method 1: the OpenCode agent writes the files itself */

  async runAgent(pages) {
    const p = this.plugin;
    const vault = this.app.vault;
    const { folder, prefix, pdfPath, imagesDir, pdfName } = this.ctx;
    const textPath = `${folder}/_pdf-text.txt`;
    await vault.create(textPath, pages.map((pg) => `--- Page ${pg.n} ---\n${pg.text.trim()}`).join("\n\n"));

    this.status("Starting OpenCode...");
    await p.ensureOpenCode((m) => !this.closed && this.status(m));
    const oc = p.openCode();
    await ensureProviders(oc);
    const s = await oc.createSession(`Import ${pdfName}`);
    this.sid = s && s.id;
    if (!this.sid) throw new Error("OpenCode did not return a session id.");
    const ai = p.settings.ai;
    const body = {
      parts: [{ type: "text", text: agentPrompt({ name: pdfName, textPath, pdfPath, imagesDir, folder, prefix, meta: this.meta }) }],
      system: AGENT_SYSTEM,
    };
    const model = modelFromString(ai.model);
    if (model) body.model = model;
    if (str(ai.agent).trim()) body.agent = ai.agent.trim();

    const mySid = this.sid;
    const timer = activeWindow.setInterval(() => this.pollAgent(mySid, folder), 1500);
    let msgs = null;
    try {
      await oc.send(mySid, body);
    } catch (e) {
      if (!this.stop) throw new Error(friendlyError(e, oc.base()));
    } finally {
      activeWindow.clearInterval(timer);
    }
    try {
      msgs = await oc.messages(mySid);
    } catch (e) {
      /* the model name is only for the label */
    }
    this.status("Checking the notes...");
    await sleep(1500);
    const model2 = str(ai.model).trim() || modelFromMessages(msgs) || "the AI model set up in OpenCode";
    const result = await this.finishAgentNotes(folder, pdfName, { model: model2, date: localDate() });
    try {
      await this.app.vault.adapter.remove(textPath);
    } catch (e) {
      /* leave it */
    }
    await this.pruneImages(folder, result);
    if (!this.closed) this.showAgentDone(result, folder);
  }

  /** Removes cut-out pictures that no note uses, so the images folder only holds what's needed. */
  async pruneImages(folder, result) {
    const adapter = this.app.vault.adapter;
    let listing;
    try {
      listing = await adapter.list(`${folder}/images`);
    } catch (e) {
      return;
    }
    const files = (listing && listing.files) || [];
    if (!files.length) return;
    let all = "";
    for (const n of await this.listNotes(folder)) all += await adapter.read(n);
    let kept = 0;
    for (const f of files) {
      const base = f.replace(/^.*\//, "");
      const isPage = /-p\d+\.png$/i.test(base);
      if ((isPage && this.opts.pagePics) || all.includes(base)) {
        kept++;
        continue;
      }
      try {
        await adapter.remove(f);
      } catch (e) {
        /* leave it */
      }
    }
    result.images = kept;
  }

  async listNotes(folder) {
    const listing = await this.app.vault.adapter.list(folder);
    return (listing.files || []).filter((f) => /\.md$/i.test(f) && !/\/_[^/]*$/.test(f)).sort();
  }

  async pollAgent(sid, folder) {
    if (this.closed) return;
    try {
      const msgs = await this.plugin.openCode().messages(sid);
      const lines = partsToTurns(msgs).flatMap((t) => t.tools).slice(-6);
      const n = (await this.listNotes(folder)).length;
      this.status(`The agent is working... ${n} note${n === 1 ? "" : "s"} written so far.`);
      if (this.activityEl) this.activityEl.setText(lines.join("\n"));
    } catch (e) {
      /* keep waiting */
    }
  }

  async finishAgentNotes(folder, source, stamp) {
    const files = await this.listNotes(folder);
    const meta = Object.assign({}, this.meta, { source });
    const result = { made: 0, ai: 0, noAnswer: 0, skipped: [], images: 0 };
    for (const path of files) {
      const text = await this.app.vault.adapter.read(path);
      const parsed = parseNote(text);
      const base = path.replace(/^.*\//, "").replace(/\.md$/i, "");
      if (!str(parsed.sec.question).trim()) {
        result.skipped.push(`${base}: no "## Question" section`);
        continue;
      }
      const out = finalizeNote(text, meta, base, stamp);
      const f = this.app.vault.getAbstractFileByPath(path);
      if (f instanceof TFile) await this.app.vault.modify(f, out);
      else await this.app.vault.adapter.write(path, out);
      const fl = aiFlags(parseNote(out).fm, parseNote(out).sec);
      if (fl.aiAnswer || fl.aiExp) result.ai++;
      if (!fl.hasAnswer) result.noAnswer++;
      result.made++;
    }
    return result;
  }

  showAgentDone(r, folder) {
    const el = this.contentEl;
    el.empty();
    el.createEl("h3", { text: r.made ? `Created ${r.made} note${r.made === 1 ? "" : "s"}` : "No notes were created" });
    el.createEl("p", { text: `Saved in ${folder}, together with a copy of the PDF${r.images ? ` and ${r.images} picture${r.images === 1 ? "" : "s"} cut from it (in the images folder)` : ""}.` });
    if (r.ai) {
      el.createEl("p", {
        cls: "qt-hint",
        text: `${r.ai} ${r.ai === 1 ? "has" : "have"} an answer or explanation written by the AI. ${r.ai === 1 ? "It's" : "They're"} marked at the top of the note with the model and date. Please check ${r.ai === 1 ? "it" : "them"}.`,
      });
    }
    if (r.noAnswer) el.createEl("p", { cls: "qt-hint", text: `${r.noAnswer} ${r.noAnswer === 1 ? "has" : "have"} no answer, so you'll grade ${r.noAnswer === 1 ? "it" : "those"} yourself.` });
    for (const s of r.skipped) el.createDiv({ cls: "qt-error", text: `Skipped ${s}` });
    if (!r.made) {
      el.createEl("p", {
        cls: "qt-hint",
        text: "If the agent was waiting to be allowed to create files, allow file edits for this vault in your OpenCode permissions and try again.",
      });
    }
    this.doneButtons(el);
  }

  /* ---- method 2: the AI returns the notes and you review them first */

  async runApi(pages) {
    const p = this.plugin;
    const chunks = chunkPages(pages, 9000, 5);
    const keyText = answerKeyText(pages);
    const client = new ApiClient(p.settings.ai);
    const blocks = [];
    let carry = [];
    let failures = 0;
    for (let i = 0; i < chunks.length && !this.stop && !this.closed; i++) {
      const ch = chunks[i];
      this.status(`Asking the AI to read pages ${ch[0].n}-${ch[ch.length - 1].n} (batch ${i + 1} of ${chunks.length}). ${mergeNotes(blocks).length} questions found so far.`);
      try {
        blocks.push(...(await extractNotesChunk(client, ch, keyText, carry)));
        carry = carryPassages(blocks);
        failures = 0;
      } catch (e) {
        this.warnings.push(`Pages ${ch[0].n}-${ch[ch.length - 1].n}: ${friendlyApiError(e)}`);
        if (++failures >= 2) break;
      }
    }
    if (this.closed) return;
    this.items = mergeNotes(blocks);
    this.showReview();
  }

  showError(msg) {
    const el = this.contentEl;
    el.empty();
    el.createEl("h3", { text: "Couldn't import" });
    el.createDiv({ cls: "qt-error", text: msg });
    const row = el.createDiv({ cls: "qt-row" });
    row.createEl("button", { text: "Back", cls: "qt-grow" }).addEventListener("click", () => this.showSetup());
    row.createEl("button", { text: "Close", cls: "qt-grow" }).addEventListener("click", () => this.close());
  }

  showReview() {
    const el = this.contentEl;
    el.empty();
    const items = this.items;
    el.createEl("h3", { text: items.length ? `Found ${items.length} question${items.length === 1 ? "" : "s"}` : "No questions found" });
    for (const w of this.warnings) el.createDiv({ cls: "qt-error", text: w });
    if (!items.length) {
      el.createEl("p", { cls: "qt-hint", text: "Try a smaller page range, or check that the PDF contains questions with readable text." });
      el.createEl("button", { text: "Back", cls: "qt-modal-btn" }).addEventListener("click", () => this.showSetup());
      return;
    }
    el.createEl("p", {
      cls: "qt-hint",
      text: "Check these against your PDF. Answers the AI wrote itself are marked, and will be labelled at the top of the note. Untick anything you don't want.",
    });
    const tools = el.createDiv({ cls: "qt-row qt-small-row" });
    const list = el.createDiv({ cls: "qt-imp-list" });
    const create = el.createEl("button", { cls: "mod-cta qt-modal-btn" });
    const checks = [];
    const count = () => {
      const n = items.filter((q) => q.include).length;
      create.setText(`Create ${n} note${n === 1 ? "" : "s"}`);
      create.disabled = n === 0;
    };
    items.forEach((q) => {
      const row = list.createDiv({ cls: "qt-imp-row" });
      const cb = row.createEl("input", { type: "checkbox" });
      cb.checked = q.include;
      cb.addEventListener("change", () => {
        q.include = cb.checked;
        count();
      });
      checks.push(cb);
      const body = row.createDiv({ cls: "qt-imp-body" });
      const text = str(q.sec.question).replace(/\s+/g, " ");
      const num = q.fm.number !== undefined && q.fm.number !== null && q.fm.number !== "" ? `${q.fm.number}. ` : "";
      body.createDiv({ cls: "qt-imp-title", text: `${num}${text.length > 130 ? text.slice(0, 130) + "..." : text}` });
      const f = aiFlags(q.fm, q.sec);
      const tags = [q.sec.choices.length ? `${q.sec.choices.length} choices` : "no answer choices"];
      tags.push(!f.hasAnswer ? "no answer" : f.aiAnswer ? `answer ${str(q.fm.answer)} (written by AI)` : `answer ${str(q.fm.answer)} (from PDF)`);
      if (f.aiExp) tags.push("explanation written by AI");
      if (str(q.sec.stimulus).trim()) tags.push("has passage");
      if (/!\[\[/.test(q.text)) tags.push("has picture");
      if (/\[Figure not captured\]/i.test(q.sec.stimulus)) tags.push("figure missing");
      body.createDiv({ cls: "qt-imp-tags", text: tags.join(" · ") });
    });
    const setAll = (v) => {
      items.forEach((q) => (q.include = v));
      checks.forEach((c) => (c.checked = v));
      count();
    };
    tools.createEl("button", { text: "Select all" }).addEventListener("click", () => setAll(true));
    tools.createEl("button", { text: "Select none" }).addEventListener("click", () => setAll(false));
    tools.createEl("button", { text: "Back" }).addEventListener("click", () => this.showSetup());
    count();
    create.addEventListener("click", () => this.createNotes());
  }

  async createNotes() {
    const el = this.contentEl;
    const chosen = this.items.filter((q) => q.include);
    el.empty();
    el.createEl("h3", { text: "Creating notes" });
    this.statusEl = el.createDiv({ cls: "qt-hint", text: "Working..." });
    try {
      const { folder, prefix } = this.ctx;
      const nums = chosen.map((q) => q.fm.number);
      const useNums = nums.every((n) => Number.isFinite(Number(n)) && n !== null && n !== "" && n !== undefined) && new Set(nums.map(Number)).size === nums.length;
      const stimIds = new Map();
      const meta = Object.assign({}, this.meta, { source: this.source });
      const stamp = { model: this.modelLabel(), date: localDate() };
      const result = { made: 0, ai: 0, noAnswer: 0, skipped: [], images: 0 };
      for (let i = 0; i < chosen.length; i++) {
        const q = chosen[i];
        const n = useNums ? Number(q.fm.number) : (parseInt(this.meta.start, 10) || 1) + i;
        const qid = `${prefix}-Q${String(n).padStart(2, "0")}`;
        let stimId = "";
        const stim = str(q.sec.stimulus).trim();
        if (stim) {
          const key = stim.toLowerCase().replace(/\s+/g, " ");
          if (!stimIds.has(key)) stimIds.set(key, `${prefix}-S${String(stimIds.size + 1).padStart(2, "0")}`);
          stimId = stimIds.get(key);
        }
        let path = normalizePath(`${folder}/${qid}.md`);
        for (let k = 2; this.app.vault.getAbstractFileByPath(path); k++) path = normalizePath(`${folder}/${qid}-${k}.md`);
        const out = finalizeNote(q.text, meta, qid, { ...stamp, stimId });
        await this.app.vault.create(path, out);
        const fl = aiFlags(parseNote(out).fm, parseNote(out).sec);
        if (fl.aiAnswer || fl.aiExp) result.ai++;
        if (!fl.hasAnswer) result.noAnswer++;
        result.made++;
        this.status(`Created ${result.made} of ${chosen.length}...`);
      }
      await this.pruneImages(folder, result);
      this.showAgentDone(result, folder);
    } catch (e) {
      this.showError(`Some notes may have been created before this stopped. ${e && e.message ? e.message : e}`);
    }
  }

  doneButtons(el) {
    const row = el.createDiv({ cls: "qt-row" });
    row.createEl("button", { text: "Close", cls: "qt-grow" }).addEventListener("click", () => this.close());
    row.createEl("button", { text: "Practice now", cls: "mod-cta qt-grow" }).addEventListener("click", () => {
      this.close();
      this.plugin.activateView();
    });
  }
}

class PracticeView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.state = "idle"; // idle | question | result
    this.current = null; // { file, fm, sections }
    this.result = null;
    this.sel = "";
    this.conf = 0;
    this.tally = { n: 0, correct: 0 };
    this.recent = [];
    this.notesText = "";
    this.notesDirty = false;
    this.filtersOpen = !plugin.settings.activePreset;
    this.generalHistory = [];
    this.timerEl = null;
  }

  getViewType() {
    return VIEW_TYPE;
  }
  getDisplayText() {
    return "Practice";
  }
  getIcon() {
    return "graduation-cap";
  }

  async onOpen() {
    this.contentEl.addClass("qt-root");
    this.registerInterval(activeWindow.setInterval(() => this.tick(), 500));
    await this.restoreSession();
    this.render();
  }

  async onClose() {
    await this.flushNotes();
  }

  /* ---- helpers */

  md(markdown, el, sourcePath) {
    const p = MarkdownRenderer.render
      ? MarkdownRenderer.render(this.app, markdown, el, sourcePath, this)
      : MarkdownRenderer.renderMarkdown(markdown, el, sourcePath, this);
    Promise.resolve(p).catch(() => el.setText(markdown));
  }

  tick() {
    if (!this.timerEl || this.state !== "question") return;
    const s = Math.floor(this.plugin.elapsedMs() / 1000);
    this.timerEl.setText(fmtClock(s));
    const target = Number(this.current && this.current.fm.target_seconds) || 0;
    this.timerEl.toggleClass("is-over", !!target && s > target);
  }

  async restoreSession() {
    const s = this.plugin.session;
    if (!s) return;
    const file = this.app.vault.getAbstractFileByPath(s.path);
    const fm = file instanceof TFile ? this.app.metadataCache.getFileCache(file)?.frontmatter : null;
    if (!fm || !fm.question_id) {
      this.plugin.clearSession();
      return;
    }
    await this.loadQuestion({ file, fm }, false);
  }

  async loadQuestion(q, fresh) {
    const text = await this.app.vault.cachedRead(q.file);
    const sections = parseSections(text);
    // Shared passage: if this note has none but names a stimulus_id, borrow it from a sibling note.
    if (!sections.stimulus && str(q.fm.stimulus_id).trim()) {
      const id = str(q.fm.stimulus_id).trim();
      for (const o of this.plugin.getQuestions()) {
        if (o.file.path === q.file.path || str(o.fm.stimulus_id).trim() !== id) continue;
        try {
          const st = parseSections(await this.app.vault.cachedRead(o.file)).stimulus;
          if (st) {
            sections.stimulus = st;
            break;
          }
        } catch (e) {
          /* ignore */
        }
      }
    }
    const key = findAnswerKey(q.fm, sections);
    const mode = inferMode(q.fm.question_type, key, sections.choices);
    this.current = { file: q.file, fm: { ...q.fm }, sections, key, mode };
    this.sel = "";
    this.conf = 0;
    this.state = "question";
    if (fresh) {
      this.plugin.startSession(q.file.path);
      this.recent.push(q.file.path);
      if (this.recent.length > 5) this.recent.shift();
    }
  }

  async flushNotes() {
    if (this.notesDirty && this.result) {
      this.notesDirty = false;
      await this.plugin.saveMyNotes(this.result.file, this.notesText);
    }
  }

  async next() {
    await this.flushNotes();
    const st = this.plugin.settings;
    const pool = this.plugin.filtered(this.plugin.getQuestions());
    const pick = pickQuestion(pool, st.mode, fmtDate(new Date()), this.recent);
    if (!pick) {
      new Notice("No questions match these filters.");
      this.plugin.clearSession();
      this.state = "idle";
      this.render();
      return;
    }
    await this.loadQuestion(pick, true);
    this.render();
  }

  async submit() {
    const q = this.current;
    const fm = q.fm;
    let correct;
    let chosen = this.sel;
    if (q.mode === "self") {
      correct = this.sel === "correct";
      chosen = "";
    } else {
      correct = gradeAnswer({ answer: q.key, question_type: q.mode }, this.sel);
    }
    const seconds = Math.round(this.plugin.elapsedMs() / 1000);
    const summary = await this.plugin.recordAttempt(q.file, {
      correct,
      chosen,
      conf: this.conf,
      seconds,
      now: new Date(),
    });
    this.plugin.clearSession();
    this.tally.n++;
    if (correct) this.tally.correct++;
    this.notesText = q.sections.notes;
    this.notesDirty = false;
    this.result = {
      file: q.file,
      correct,
      chosen,
      key: q.key,
      mode: q.mode,
      seconds,
      summary,
      errorType: "",
      flagged: fm.flagged === true,
      sections: q.sections,
      fm: q.fm,
      conf: this.conf,
      aiSession: "",
      aiHistory: [],
    };
    this.state = "result";
    this.render();
  }

  /* ---- rendering */

  render() {
    const el = this.contentEl;
    el.empty();
    this.timerEl = null;
    const root = el.createDiv({ cls: "qt-wrap" });
    if (this.state === "question") this.renderQuestion(root);
    else if (this.state === "result") this.renderResult(root);
    else if (this.state === "chat") this.renderChat(root);
    else this.renderIdle(root);
    // two-pane screens scroll inside their panes, not the whole view
    el.toggleClass("qt-no-scroll", root.hasClass("qt-wide"));
    this.tick();
  }

  renderIdle(root) {
    const p = this.plugin;
    const st = p.settings;
    const questions = p.getQuestions();

    if (!questions.length) {
      root.createDiv({
        cls: "qt-empty",
        text:
          "No question notes found. A note counts as a question when it has a question_id property" +
          (st.questionFolder ? ` and lives in "${st.questionFolder}".` : "."),
      });
      return;
    }

    // presets
    const prow = root.createDiv({ cls: "qt-row" });
    const psel = prow.createEl("select", { cls: "qt-select qt-grow" });
    psel.createEl("option", { value: "", text: "- Custom -" });
    for (const pr of st.presets) psel.createEl("option", { value: pr.id, text: pr.name });
    psel.value = st.activePreset || "";
    psel.addEventListener("change", () => {
      p.applyPreset(psel.value);
      this.render();
    });

    const brow = root.createDiv({ cls: "qt-row qt-small-row" });
    const saveAs = brow.createEl("button", { text: "Save as preset" });
    saveAs.addEventListener("click", () =>
      new NameModal(this.app, "Preset name", "", (name) => {
        p.savePreset(name);
        this.render();
      }).open()
    );
    const upd = brow.createEl("button", { text: "Update" });
    upd.disabled = !st.activePreset;
    upd.addEventListener("click", () => {
      p.updatePreset();
      this.render();
    });
    const del = brow.createEl("button", { text: "Delete" });
    del.disabled = !st.activePreset;
    del.addEventListener("click", () => {
      p.deletePreset();
      this.render();
    });
    if (st.activePreset && p.isModified()) root.createDiv({ cls: "qt-hint", text: "Preset has unsaved changes." });

    // filters: tap several values in a field (OR); add another set to OR whole sets together
    st.moreSets = st.moreSets || [];
    const sets = [st.filters, ...st.moreSets];
    const nActive = sets.filter(hasFilters).length;
    const det = root.createEl("details", { cls: "qt-filters" });
    det.open = this.filtersOpen;
    det.addEventListener("toggle", () => (this.filtersOpen = det.open));
    det.createEl("summary", {
      text: `Filters${nActive ? ` (${nActive} ${nActive === 1 ? "set" : "sets, any of them"} active)` : ""}`,
    });
    det.createDiv({
      cls: "qt-hint",
      text: "Tap several values to allow any of them. Different fields must all match. Add another set to combine separate groups.",
    });
    sets.forEach((set, idx) => {
      if (idx > 0) det.createDiv({ cls: "qt-or", text: "OR" });
      const box = det.createDiv({ cls: "qt-fset" });
      if (sets.length > 1) {
        const head = box.createDiv({ cls: "qt-fset-head" });
        head.createSpan({ text: `Set ${idx + 1}` });
        const rm = head.createEl("button", { text: "Remove set", cls: "qt-link" });
        rm.addEventListener("click", () => {
          if (idx === 0) {
            st.filters = st.moreSets.length ? st.moreSets.shift() : {};
          } else {
            st.moreSets.splice(idx - 1, 1);
          }
          p.save();
          this.render();
        });
      }
      for (const [key, label] of FILTER_FIELDS) {
        const chosen = fvals(set, key);
        const opts = filterOptions(questions, set, key);
        for (const c of chosen) if (!opts.includes(c)) opts.push(c);
        if (!opts.length) continue;
        const row = box.createDiv({ cls: "qt-field" });
        const lh = row.createDiv({ cls: "qt-field-head" });
        lh.createEl("label", { text: chosen.length ? `${label} (${chosen.length})` : label });
        if (chosen.length) {
          const clr = lh.createEl("button", { text: "Clear", cls: "qt-link" });
          clr.addEventListener("click", () => {
            delete set[key];
            p.save();
            this.render();
          });
        }
        const chips = row.createDiv({ cls: "qt-fchips" });
        for (const o of opts) {
          const c = chips.createEl("button", { text: o, cls: "qt-fchip" });
          if (chosen.includes(o)) c.addClass("is-selected");
          c.addEventListener("click", () => {
            const cur = fvals(set, key);
            const i = cur.indexOf(o);
            if (i >= 0) cur.splice(i, 1);
            else cur.push(o);
            if (cur.length) set[key] = cur;
            else delete set[key];
            p.save();
            this.render();
          });
        }
      }
    });
    const addSet = det.createEl("button", { text: "+ Add another set (OR)", cls: "qt-add-set" });
    addSet.addEventListener("click", () => {
      st.moreSets.push({});
      p.save();
      this.render();
    });

    // mode
    const mrow = root.createDiv({ cls: "qt-field" });
    mrow.createEl("label", { text: "Pick questions" });
    const msel = mrow.createEl("select", { cls: "qt-select" });
    for (const [v, t] of MODES) msel.createEl("option", { value: v, text: t });
    msel.value = st.mode;
    msel.addEventListener("change", () => {
      st.mode = msel.value;
      p.save();
      this.render();
    });

    // counts
    const pool = p.filtered(questions);
    const today = fmtDate(new Date());
    const inMode = pool.filter((q) => (MODE_PRED[st.mode] || MODE_PRED.smart)(q.fm, today)).length;
    const dueN = pool.filter((q) => isDue(q.fm, today)).length;
    const newN = pool.filter((q) => !Number(q.fm.attempts)).length;
    root.createDiv({
      cls: "qt-count",
      text: `${pool.length} match · ${dueN} due · ${newN} new · ${inMode} in this mode`,
    });

    const start = root.createEl("button", { text: "Start", cls: "mod-cta qt-primary" });
    start.disabled = inMode === 0;
    start.addEventListener("click", () => this.next());

    if (st.ai.enabled) {
      const ib = root.createEl("button", { text: "Import questions from PDF" });
      ib.addEventListener("click", () => p.openPdfImport());
      const ab = root.createEl("button", { text: "AI assistant" });
      ab.addEventListener("click", () => {
        this.state = "chat";
        this.render();
      });
    }

    if (this.tally.n) {
      root.createDiv({ cls: "qt-hint", text: `This session: ${this.tally.correct}/${this.tally.n} correct` });
    }
  }

  renderQuestion(root) {
    const p = this.plugin;
    const q = this.current;
    const fm = q.fm;
    const paused = !p.isRunning();
    const path = q.file.path;
    root.addClass("qt-exam");
    root.addClass("qt-wide");

    // ---- header: where you are, timer, pause
    const bar = root.createDiv({ cls: "qt-bar qt-exam-bar" });
    const meta = [fm.course, fm.unit ? `Unit ${fm.unit}` : "", fm.skill || fm.section, fm.difficulty]
      .filter(Boolean)
      .join(" · ");
    bar.createDiv({ cls: "qt-meta", text: meta });
    const tw = bar.createDiv({ cls: "qt-timer-wrap" });
    this.timerEl = tw.createSpan({ cls: "qt-timer" });
    const pb = tw.createEl("button", { cls: "qt-icon-btn", attr: { "aria-label": paused ? "Resume" : "Pause" } });
    setIcon(pb, paused ? "play" : "pause");
    pb.addEventListener("click", () => {
      if (paused) p.resumeSession();
      else p.pauseSession();
      this.render();
    });
    const tools = bar.createDiv({ cls: "qt-exam-tools" });
    const open = tools.createEl("button", { cls: "qt-icon-btn", attr: { "aria-label": "Open note" } });
    setIcon(open, "file-text");
    open.addEventListener("click", () => this.app.workspace.getLeaf("tab").openFile(q.file));

    // ---- two panes: passage on the left, question + choices on the right
    const hasStim = !!q.sections.stimulus;
    const split = root.createDiv({ cls: `qt-split${hasStim ? "" : " is-single"}` });
    const left = hasStim ? split.createDiv({ cls: "qt-pane qt-pane-left" }) : null;
    const right = split.createDiv({ cls: "qt-pane qt-pane-right" });

    // ---- controls live at the bottom of the right pane: confidence, submit, skip/end
    const ctl = right.createDiv({ cls: "qt-ctl" });
    const fc = ctl.createDiv({ cls: "qt-foot-center" });
    const fr = ctl.createDiv({ cls: "qt-foot-right" });
    const fl = ctl.createDiv({ cls: "qt-foot-left" });
    const skip = fl.createEl("button", { text: "Skip (don't log)" });
    skip.addEventListener("click", () => this.next());
    const end = fl.createEl("button", { text: "End" });
    end.addEventListener("click", () => {
      this.plugin.clearSession();
      this.state = "idle";
      this.render();
    });

    if (paused) {
      right.createDiv({ cls: "qt-paused", text: "Timer paused. Tap play to continue." });
      right.appendChild(ctl);
      fc.remove();
      fr.remove();
      return;
    }

    if (left) this.md(q.sections.stimulus, left.createDiv({ cls: "qt-stimulus" }), path);

    // question header: number badge + flag (like "Mark for Review")
    const qh = right.createDiv({ cls: "qt-qhead" });
    qh.createSpan({ cls: "qt-qnum", text: String(this.tally.n + 1) });
    const flagged0 = fm.flagged === true;
    const fb = qh.createEl("button", { cls: "qt-flag" });
    const paintFlag = (on) => {
      fb.empty();
      const ic = fb.createSpan({ cls: "qt-flag-ic" });
      setIcon(ic, on ? "bookmark-check" : "bookmark");
      fb.createSpan({ text: on ? "Flagged" : "Flag for review" });
      fb.toggleClass("is-on", !!on);
    };
    paintFlag(flagged0);
    fb.addEventListener("click", async () => {
      const now = await this.plugin.toggleFlag(q.file);
      q.fm.flagged = now;
      paintFlag(now);
    });

    this.md(q.sections.question || "*No `## Question` section found in this note.*", right.createDiv({ cls: "qt-stem" }), path);

    const mode = q.mode;
    const submit = fr.createEl("button", { text: "Submit", cls: "mod-cta qt-submit" });
    const refresh = () => {
      submit.disabled = !(this.sel && this.conf);
    };

    // answer input
    const ans = right.createDiv({ cls: "qt-answers" });
    if (mode === "mcq") {
      const n = Number(fm.choices) || q.sections.choices.length || 4;
      const letters = "ABCDEFGH".slice(0, n).split("");
      const byLetter = Object.fromEntries(q.sections.choices.map((c) => [c.letter, c.text]));
      const btns = [];
      for (const L of letters) {
        const b = ans.createEl("button", { cls: "qt-choice" });
        b.createSpan({ cls: "qt-letter", text: L });
        if (byLetter[L]) this.md(byLetter[L], b.createDiv({ cls: "qt-choice-text" }), path);
        b.addEventListener("click", () => {
          this.sel = L;
          btns.forEach((x) => x.toggleClass("is-selected", x === b));
          refresh();
        });
        if (this.sel === L) b.addClass("is-selected");
        btns.push(b);
      }
    } else if (mode === "spr") {
      const input = ans.createEl("input", { type: "text", cls: "qt-spr", attr: { placeholder: "Your answer" } });
      input.value = this.sel;
      input.addEventListener("input", () => {
        this.sel = input.value.trim();
        refresh();
      });
    } else {
      // No usable key: still show the choices (read-only) and let you self-grade.
      if (q.sections.choices.length) {
        const list = ans.createDiv({ cls: "qt-readonly-choices" });
        for (const c of q.sections.choices) {
          const line = list.createDiv({ cls: "qt-choice qt-choice-static" });
          line.createSpan({ cls: "qt-letter", text: c.letter });
          this.md(c.text, line.createDiv({ cls: "qt-choice-text" }), path);
        }
      }
      ans.createDiv({ cls: "qt-hint", text: "No answer key found in this note. Grade yourself after you've worked it out." });
      const row = ans.createDiv({ cls: "qt-row" });
      const btns = [];
      for (const [v, t] of [["correct", "I got it right"], ["incorrect", "I got it wrong"]]) {
        const b = row.createEl("button", { text: t, cls: "qt-choice qt-grow" });
        b.addEventListener("click", () => {
          this.sel = v;
          btns.forEach((x) => x.toggleClass("is-selected", x === b));
          refresh();
        });
        btns.push(b);
      }
    }

    right.appendChild(ctl); // keep the controls below the choices
    // confidence
    fc.createSpan({ cls: "qt-foot-label", text: "How sure are you?" });
    const crow = fc.createDiv({ cls: "qt-conf-row" });
    const cbtns = [];
    p.settings.confidenceLabels.slice(0, 3).forEach((label, i) => {
      const b = crow.createEl("button", { text: label, cls: "qt-conf" });
      if (this.conf === i + 1) b.addClass("is-selected");
      b.addEventListener("click", () => {
        this.conf = i + 1;
        cbtns.forEach((x) => x.toggleClass("is-selected", x === b));
        refresh();
      });
      cbtns.push(b);
    });

    refresh();
    submit.addEventListener("click", () => {
      submit.disabled = true;
      this.submit();
    });
  }

  renderChat(root) {
    const p = this.plugin;
    const top = root.createDiv({ cls: "qt-row qt-small-row" });
    const back = top.createEl("button", { text: "Back" });
    back.addEventListener("click", () => {
      this.state = "idle";
      this.render();
    });
    root.createEl("h4", { text: "AI assistant" });
    if (p.backend() === "api") {
      root.createDiv({
        cls: "qt-hint",
        text: "Direct API chat can't see or edit your files. For creating notes or searching your vault, use OpenCode on your computer.",
      });
    }
    new ChatPanel(this, root.createDiv(), {
      title: "MCQ Tracker assistant",
      sourcePath: "",
      getSessionId: () => p.settings.ai.sessionId,
      setSessionId: (id) => {
        p.settings.ai.sessionId = id;
        p.save();
      },
      getApiHistory: () => this.generalHistory,
      buildContext: (mode) => buildGeneralContext(this.app, mode),
      quick: p.backend() === "api" ? [] : [
        { label: "Notes missing answers", prompt: "List the question notes whose answer property is empty or missing." },
        { label: "Weakest skills", prompt: "Look at my question notes' attempts and correct_count and tell me which skills I am weakest at." },
        { label: "Create a question note", prompt: "I will paste a question with its choices, answer and rationale. Create a correctly formatted question note for it in the vault." },
      ],
    });
  }

  renderResult(root) {
    const p = this.plugin;
    const r = this.result;
    const s = r.summary;
    const path = r.file.path;

    if (r.sections.stimulus) {
      root.addClass("qt-wide");
      root.addClass("qt-exam");
      const split = root.createDiv({ cls: "qt-split" });
      const lp = split.createDiv({ cls: "qt-pane qt-pane-left" });
      this.md(r.sections.stimulus, lp.createDiv({ cls: "qt-stimulus" }), path);
      root = split.createDiv({ cls: "qt-pane qt-pane-right" });
    }

    const banner = root.createDiv({ cls: `qt-banner qt-resbar ${r.correct ? "is-correct" : "is-wrong"}` });
    const bl = banner.createDiv({ cls: "qt-res-left" });
    bl.createDiv({ cls: "qt-banner-title", text: r.correct ? "Correct" : "Incorrect" });
    const bits = [];
    if (!r.correct && r.chosen) bits.push(`You chose ${r.chosen}${r.key ? `, answer ${r.key}` : ""}`);
    bits.push(fmtClock(r.seconds) + (s.target ? ` (target ${fmtClock(s.target)})` : ""));
    bl.createDiv({ cls: "qt-banner-sub", text: bits.join(" · ") });

    const acts = banner.createDiv({ cls: "qt-res-actions" });
    const openBtn = acts.createEl("button", { text: "Open note" });
    openBtn.addEventListener("click", () => this.app.workspace.getLeaf("tab").openFile(r.file));
    const flagBtn = acts.createEl("button", { cls: "qt-icon-btn qt-res-flag" });
    const paintFlag = () => {
      flagBtn.empty();
      setIcon(flagBtn, r.flagged ? "bookmark-check" : "bookmark");
      flagBtn.setAttr("aria-label", r.flagged ? "Unflag this question" : "Flag this question");
      flagBtn.setAttr("title", r.flagged ? "Unflag this question" : "Flag this question");
      flagBtn.toggleClass("is-on", !!r.flagged);
    };
    paintFlag();
    flagBtn.addEventListener("click", async () => {
      r.flagged = await p.toggleFlag(r.file);
      paintFlag();
    });
    const topNext = acts.createEl("button", { text: "Next question", cls: "mod-cta" });
    topNext.addEventListener("click", () => this.next());

    root.createDiv({
      cls: "qt-count",
      text: `Streak ${s.streak} · ${s.correctCount}/${s.attempts} correct overall · next review ${s.nextReview}`,
    });

    // ---- review: the question and choices again, with your pick and the key marked
    const rv = root.createDiv({ cls: "qt-review" });
    this.md(r.sections.question || "", rv.createDiv({ cls: "qt-stem" }), path);
    const rc = rv.createDiv({ cls: "qt-answers" });
    const chosenL = str(r.chosen).toUpperCase();
    const keyL = str(r.key).toUpperCase();
    if (r.sections.choices.length) {
      for (const c of r.sections.choices) {
        const isKey = r.mode === "mcq" && c.letter === keyL;
        const isMine = r.mode === "mcq" && c.letter === chosenL;
        const row = rc.createDiv({ cls: "qt-choice qt-choice-static" });
        if (isKey) row.addClass("is-key");
        if (isMine && !isKey) row.addClass("is-miss");
        if (isMine) row.addClass("is-mine");
        row.createSpan({ cls: "qt-letter", text: c.letter });
        this.md(c.text, row.createDiv({ cls: "qt-choice-text" }), path);
        const tag = isKey && isMine ? "Your answer · correct" : isKey ? "Correct answer" : isMine ? "Your answer" : "";
        if (tag) row.createSpan({ cls: "qt-tag", text: tag });
      }
    }
    if (r.mode === "spr") {
      rv.createDiv({ cls: "qt-hint", text: `Your answer: ${r.chosen || "(blank)"} · Correct answer: ${r.key || "(not stored)"}` });
    } else if (r.mode === "self" && r.key) {
      rv.createDiv({ cls: "qt-hint", text: `Correct answer: ${r.key}` });
    }

    // ---- why did you miss it (misses only)
    if (!r.correct) {
      root.createDiv({ cls: "qt-label", text: "Why did you miss it?" });
      const chips = root.createDiv({ cls: "qt-chips" });
      const cb = [];
      for (const t of p.settings.errorTypes) {
        const c = chips.createEl("button", { text: t, cls: "qt-chip" });
        if (r.errorType === t) c.addClass("is-selected");
        c.addEventListener("click", async () => {
          const next = r.errorType === t ? "" : t;
          r.errorType = next;
          cb.forEach((x) => x.toggleClass("is-selected", x === c && !!next));
          await p.setErrorType(r.file, next);
        });
        cb.push(c);
      }
    }

    // ---- notes: a big box right under the choices
    root.createDiv({ cls: "qt-label", text: "Notes" });
    const ta = root.createEl("textarea", {
      cls: "qt-notes qt-notes-big",
      attr: { rows: "9", placeholder: "Why you missed it, the rule to remember, anything to review later..." },
    });
    ta.value = this.notesText;
    ta.addEventListener("input", () => {
      this.notesText = ta.value;
      this.notesDirty = true;
    });
    ta.addEventListener("blur", () => this.flushNotes());

    // ---- two buttons on one line: explanation / ask AI
    const pair = root.createDiv({ cls: "qt-row qt-pair" });
    const rat = extractRationale(r.sections.answer);
    const dflt = p.settings.explanationDefault;
    let expOpen = !!rat && (dflt === "show" || (dflt === "wrong" && !r.correct));
    let aiOpen = false;
    const eb = pair.createEl("button", { cls: "qt-grow qt-exp-btn" });
    const ab = pair.createEl("button", { cls: "qt-grow qt-exp-btn" });

    const ex = root.createDiv({ cls: "qt-explanation" });
    if (rat) this.md(rat, ex.createDiv({ cls: "qt-stem" }), path);
    else ex.createDiv({ cls: "qt-hint", text: "This note has no explanation." });

    const aiWrap = root.createDiv({ cls: "qt-ai" });
    new ChatPanel(this, aiWrap.createDiv(), {
      title: `Review: ${r.file.basename}`,
      sourcePath: path,
      getSessionId: () => r.aiSession,
      setSessionId: (id) => (r.aiSession = id),
      getApiHistory: () => r.aiHistory,
      buildContext: (mode) => buildTutorContext(r, this.notesText, p.settings.confidenceLabels, mode),
      quick: [
        r.correct
          ? { label: "Why is the answer right?", prompt: "Explain why the correct answer is right and why the other choices are wrong." }
          : { label: "Why did I miss this?", prompt: "I got this wrong. Explain what I likely misunderstood and how to get it right next time." },
        { label: "Explain simply", prompt: "Explain this question and its solution in simple terms." },
        { label: "Similar question", prompt: "Write one new, original practice question testing the same skill, with four choices. Do not give the answer yet." },
        { label: "Quiz me", prompt: "Ask me one short question to check I understand the concept behind this question." },
        { label: "One-line rule", prompt: "Give me a single sentence rule of thumb I can remember for this kind of question." },
      ],
      onSaveNote: (text) => {
        this.notesText = (this.notesText ? this.notesText + "\n\n" : "") + text;
        ta.value = this.notesText;
        this.notesDirty = true;
        this.flushNotes();
        new Notice("Added to Notes");
      },
    });

    const paint = () => {
      ex.toggleClass("qt-hidden", !expOpen);
      aiWrap.toggleClass("qt-hidden", !aiOpen);
      eb.setText(expOpen ? "Hide explanation" : "Show explanation");
      ab.setText(aiOpen ? "Hide AI" : "Ask AI");
      eb.toggleClass("is-selected", expOpen);
      ab.toggleClass("is-selected", aiOpen);
    };
    eb.addEventListener("click", () => {
      expOpen = !expOpen;
      paint();
    });
    ab.addEventListener("click", () => {
      aiOpen = !aiOpen;
      paint();
    });
    paint();

    // ---- done (Next lives in the top bar)
    const done = root.createEl("button", { text: "Done (back to filters)", cls: "qt-done" });
    done.addEventListener("click", async () => {
      await this.flushNotes();
      this.state = "idle";
      this.render();
    });
  }
}

/* ----------------------------------------------------------------- plugin */

class QuestionTrackerPlugin extends Plugin {
  async onload() {
    await this.loadSettings();

    // The timer is kept per device (not in the synced settings). One that was running when the
    // app closed becomes paused, counting only up to the last heartbeat (time away isn't counted).
    this.session = this.readSession();
    const s = this.session;
    if (s && s.runningSince) {
      s.elapsedMs += Math.max(0, (s.lastBeat || s.runningSince) - s.runningSince);
      s.runningSince = null;
      this.writeSession();
    }

    this.manager = new OpenCodeManager(this);
    this.app.workspace.onLayoutReady(() => {
      const ai = this.settings.ai;
      if (Platform.isDesktopApp && ai.enabled && ai.managed && ai.preStart && this.backend() === "opencode") {
        this.manager.ensure(() => {}).catch(() => {}); // quiet: errors show when you actually use the chat
      }
    });
    this.registerDomEvent(window, "beforeunload", () => this.manager.stop());
    this.registerView(VIEW_TYPE, (leaf) => new PracticeView(leaf, this));
    this.addRibbonIcon("graduation-cap", "Open practice view", () => this.activateView());

    this.addCommand({ id: "open-practice-view", name: "Open practice view", callback: () => this.activateView() });
    this.addCommand({ id: "import-pdf", name: "Import questions from a PDF", callback: () => this.openPdfImport() });
    this.addCommand({
      id: "open-ai-assistant",
      name: "Open AI assistant (OpenCode)",
      callback: async () => {
        const view = await this.activateView();
        if (view && view.render) {
          view.state = "chat";
          view.render();
        }
      },
    });
    this.addCommand({
      id: "next-question",
      name: "Next question (from current filters)",
      callback: async () => {
        const view = await this.activateView();
        if (view && view.next) await view.next();
      },
    });
    this.addCommand({
      id: "toggle-flag",
      name: "Toggle flag on this question",
      checkCallback: (checking) => {
        const f = this.app.workspace.getActiveFile();
        const fm = f && this.app.metadataCache.getFileCache(f)?.frontmatter;
        if (!fm || !fm.question_id) return false;
        if (!checking) this.toggleFlag(f).then((v) => new Notice(v ? "Flagged" : "Unflagged"));
        return true;
      },
    });
    this.addCommand({
      id: "add-fields-this-note",
      name: "Add missing tracking properties to this note",
      checkCallback: (checking) => {
        const f = this.app.workspace.getActiveFile();
        if (!f) return false;
        if (!checking) this.addMissingFields([f]);
        return true;
      },
    });
    this.addCommand({
      id: "add-fields-all",
      name: "Add missing tracking properties to all question notes",
      callback: () => this.addMissingFields(this.getQuestions().map((q) => q.file)),
    });

    this.addSettingTab(new QuestionTrackerSettingTab(this.app, this));

    this.registerInterval(
      activeWindow.setInterval(() => {
        const ses = this.session;
        if (ses && ses.runningSince) {
          ses.lastBeat = Date.now();
          this.writeSession();
        }
      }, 10000)
    );

    this.registerDomEvent(activeDocument, "visibilitychange", () => {
      if (activeDocument.hidden && Platform.isMobile && this.settings.autoPauseOnMobile && this.isRunning()) {
        this.pauseSession();
        this.refreshViews();
      }
    });
  }

  /* ---- settings */

  async loadSettings() {
    const saved = (await this.loadData()) || {};
    this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);
    delete this.settings.session; // older versions stored the timer here; it is per-device now
    this.settings.filters = cloneFilters(saved.filters);
    this.settings.moreSets = Array.isArray(saved.moreSets) ? saved.moreSets.map(cloneFilters) : [];
    this.settings.presets = (Array.isArray(saved.presets) ? saved.presets : []).map((pr) =>
      Object.assign({}, pr, { filters: cloneFilters(pr.filters), moreSets: Array.isArray(pr.moreSets) ? pr.moreSets.map(cloneFilters) : [] })
    );
    this.settings.ai = Object.assign({}, DEFAULT_SETTINGS.ai, saved.ai || {});
    const sa = (saved.ai && saved.ai.api) || {};
    this.settings.ai.api = Object.assign({}, DEFAULT_SETTINGS.ai.api, sa, { keys: Object.assign({}, sa.keys) });
    // 0.2.0 saved settings had no `managed` flag: move those users to the automatic setup.
    if (saved.explanationDefault === undefined && saved.showRationale === false) this.settings.explanationDefault = "hide";
    delete this.settings.showRationale;
    if (!["show", "wrong", "hide"].includes(this.settings.explanationDefault)) this.settings.explanationDefault = "wrong";
    for (const k of ["intervals", "errorTypes", "confidenceLabels"]) {
      if (!Array.isArray(this.settings[k]) || !this.settings[k].length) this.settings[k] = DEFAULT_SETTINGS[k].slice();
    }
  }

  save() {
    return this.saveData(this.settings);
  }

  /** Phones always use the direct API (OpenCode can't run there); desktop follows the setting. */
  backend() {
    return Platform.isMobile || this.settings.ai.backend === "api" ? "api" : "opencode";
  }

  /** Connection details: the managed local server if running, otherwise the manual settings. */
  conn() {
    const ai = this.settings.ai;
    if (ai.managed && this.manager.conn) return this.manager.conn;
    return { url: ai.url, username: ai.username, password: ai.password };
  }

  openCode() {
    return new OpenCodeClient(this.conn());
  }

  vaultPath() {
    try {
      return (this.app.vault.adapter && this.app.vault.adapter.basePath) || "";
    } catch (e) {
      return "";
    }
  }

  askConfirm(title, body, okText) {
    return new Promise((resolve) => new ConfirmModal(this.app, title, body, okText, resolve).open());
  }

  async ensureOpenCode(progress) {
    const note = new Notice("Setting up OpenCode...", 0);
    const say = (m) => {
      note.setMessage(m);
      if (progress) progress(m);
    };
    try {
      await this.manager.ensure(say);
    } finally {
      note.hide();
    }
  }

  openPdfImport() {
    if (!this.settings.ai.enabled) {
      new Notice("Turn on AI features in the plugin settings to import from a PDF.");
      return;
    }
    new PdfImportModal(this.app, this).open();
  }

  onunload() {
    if (this.manager) this.manager.stop();
  }

  /* ---- views */

  async activateView() {
    const ws = this.app.workspace;
    let leaf = ws.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = ws.getLeaf(Platform.isMobile ? true : "tab");
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    if (leaf.loadIfDeferred) await leaf.loadIfDeferred();
    await ws.revealLeaf(leaf);
    return leaf.view;
  }

  refreshViews() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      if (leaf.view && leaf.view.render) leaf.view.render();
    }
  }

  /* ---- questions */

  getQuestions() {
    const folder = this.settings.questionFolder.trim().replace(/^\/+|\/+$/g, "");
    const out = [];
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (folder && file.path !== folder && !file.path.startsWith(folder + "/")) continue;
      const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
      if (fm && fm.question_id !== undefined && fm.question_id !== null && fm.question_id !== "") {
        out.push({ file, fm });
      }
    }
    return out;
  }

  filtered(questions) {
    return questions.filter((q) => matchSets(q.fm, [this.settings.filters, ...(this.settings.moreSets || [])]));
  }

  /* ---- presets */

  applyPreset(id) {
    const st = this.settings;
    if (!id) {
      st.activePreset = "";
    } else {
      const pr = st.presets.find((x) => x.id === id);
      if (pr) {
        st.filters = cloneFilters(pr.filters);
        st.moreSets = (pr.moreSets || []).map(cloneFilters);
        st.mode = pr.mode || "smart";
        st.activePreset = id;
      }
    }
    this.save();
  }

  savePreset(name) {
    const st = this.settings;
    const id = "p" + Date.now().toString(36);
    st.presets.push({ id, name, filters: cloneFilters(st.filters), moreSets: (st.moreSets || []).map(cloneFilters), mode: st.mode });
    st.activePreset = id;
    this.save();
  }

  updatePreset() {
    const st = this.settings;
    const pr = st.presets.find((x) => x.id === st.activePreset);
    if (!pr) return;
    pr.filters = cloneFilters(st.filters);
    pr.moreSets = (st.moreSets || []).map(cloneFilters);
    pr.mode = st.mode;
    this.save();
  }

  deletePreset() {
    const st = this.settings;
    st.presets = st.presets.filter((x) => x.id !== st.activePreset);
    st.activePreset = "";
    this.save();
  }

  isModified() {
    const st = this.settings;
    const pr = st.presets.find((x) => x.id === st.activePreset);
    if (!pr) return false;
    const norm1 = (o) => JSON.stringify(FILTER_FIELDS.map(([k]) => [k, fvals(o, k).sort()]).filter((x) => x[1].length));
    const norm = (main, more) => JSON.stringify([main, ...(more || [])].filter(hasFilters).map(norm1).sort());
    return norm(pr.filters, pr.moreSets) !== norm(st.filters, st.moreSets) || (pr.mode || "smart") !== st.mode;
  }

  /* ---- timer (survives reloads) */

  sessionKey() {
    return "question-tracker-session";
  }
  readSession() {
    try {
      const s = this.app.loadLocalStorage(this.sessionKey());
      return s && typeof s.path === "string" && typeof s.elapsedMs === "number" ? s : null;
    } catch (e) {
      return null;
    }
  }
  writeSession() {
    try {
      this.app.saveLocalStorage(this.sessionKey(), this.session || null);
    } catch (e) {
      /* storage unavailable: the timer still works, it just won't survive a reload */
    }
  }
  startSession(path) {
    this.session = { path, elapsedMs: 0, runningSince: Date.now(), lastBeat: Date.now() };
    this.writeSession();
  }
  isRunning() {
    const s = this.session;
    return !!(s && s.runningSince);
  }
  elapsedMs() {
    const s = this.session;
    if (!s) return 0;
    return s.elapsedMs + (s.runningSince ? Date.now() - s.runningSince : 0);
  }
  pauseSession() {
    const s = this.session;
    if (!s || !s.runningSince) return;
    s.elapsedMs += Date.now() - s.runningSince;
    s.runningSince = null;
    this.writeSession();
  }
  resumeSession() {
    const s = this.session;
    if (!s || s.runningSince) return;
    s.runningSince = Date.now();
    s.lastBeat = Date.now();
    this.writeSession();
  }
  clearSession() {
    this.session = null;
    this.writeSession();
  }

  /* ---- writing to notes */

  async recordAttempt(file, a) {
    let summary;
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      summary = applyAttempt(fm, a, this.settings.intervals);
    });
    return summary;
  }

  async setErrorType(file, type) {
    await this.app.fileManager.processFrontMatter(file, (fm) => setLastErrorType(fm, type));
  }

  async toggleFlag(file) {
    let now = false;
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      fm.flagged = fm.flagged !== true;
      now = fm.flagged;
    });
    return now;
  }

  async saveMyNotes(file, text) {
    await this.app.vault.process(file, (data) => replaceMyNotes(data, text));
  }

  async addMissingFields(files) {
    let touched = 0;
    for (const f of files) {
      let n = 0;
      await this.app.fileManager.processFrontMatter(f, (fm) => {
        n = fillDefaults(fm);
      });
      if (n) touched++;
    }
    new Notice(`Added missing properties to ${touched} note${touched === 1 ? "" : "s"}.`);
  }
}

/* --------------------------------------------------------------- settings */

class QuestionTrackerSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    const st = this.plugin.settings;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Question folder")
      .setDesc("Only notes in this folder count as questions. Leave empty to scan the whole vault.")
      .addText((t) =>
        t.setPlaceholder("e.g. Questions").setValue(st.questionFolder).onChange(async (v) => {
          st.questionFolder = v;
          await this.plugin.save();
        })
      );

    new Setting(containerEl)
      .setName("Review intervals (days)")
      .setDesc("Days until review after 1st, 2nd, 3rd... correct answer in a row. A miss always returns in 1 day.")
      .addText((t) =>
        t.setValue(st.intervals.join(", ")).onChange(async (v) => {
          const nums = v.split(",").map((x) => parseInt(x.trim(), 10)).filter((n) => n > 0);
          if (nums.length) {
            st.intervals = nums;
            await this.plugin.save();
          }
        })
      );

    new Setting(containerEl)
      .setName("Error types")
      .setDesc("Comma-separated. Shown after a wrong answer.")
      .addText((t) =>
        t.setValue(st.errorTypes.join(", ")).onChange(async (v) => {
          const list = v.split(",").map((x) => x.trim()).filter(Boolean);
          if (list.length) {
            st.errorTypes = list;
            await this.plugin.save();
          }
        })
      );

    new Setting(containerEl)
      .setName("Confidence labels")
      .setDesc("Three comma-separated labels, lowest to highest.")
      .addText((t) =>
        t.setValue(st.confidenceLabels.join(", ")).onChange(async (v) => {
          const list = v.split(",").map((x) => x.trim()).filter(Boolean);
          if (list.length === 3) {
            st.confidenceLabels = list;
            await this.plugin.save();
          }
        })
      );

    new Setting(containerEl)
      .setName("Explanation after answering")
      .setDesc("Whether the explanation starts open or closed on the result screen. You can always show or hide it with the button.")
      .addDropdown((d) =>
        d
          .addOption("wrong", "Show only when I miss it")
          .addOption("show", "Always show")
          .addOption("hide", "Always hide")
          .setValue(st.explanationDefault)
          .onChange(async (v) => {
            st.explanationDefault = v;
            await this.plugin.save();
          })
      );

    new Setting(containerEl)
      .setName("Pause timer when the app is backgrounded (mobile)")
      .setDesc("Stops the clock if you switch apps or lock your phone.")
      .addToggle((t) =>
        t.setValue(st.autoPauseOnMobile).onChange(async (v) => {
          st.autoPauseOnMobile = v;
          await this.plugin.save();
        })
      );

    new Setting(containerEl).setName("OpenCode (AI)").setHeading();
    const ai = st.ai;
    new Setting(containerEl)
      .setName("Enable AI features")
      .setDesc("Adds 'Ask AI' to the result screen and an AI assistant chat.")
      .addToggle((t) =>
        t.setValue(ai.enabled).onChange(async (v) => {
          ai.enabled = v;
          await this.plugin.save();
          this.plugin.refreshViews();
        })
      );
    if (Platform.isDesktopApp) {
      new Setting(containerEl)
        .setName("AI backend")
        .setDesc("OpenCode can edit your notes and runs on this computer. Direct API is a plain chat that also works on your phone (your phone always uses it).")
        .addDropdown((d) =>
          d
            .addOption("opencode", "OpenCode (this computer)")
            .addOption("api", "Direct API")
            .setValue(ai.backend)
            .onChange(async (v) => {
              ai.backend = v;
              await this.plugin.save();
              this.plugin.refreshViews();
              this.display();
            })
        );
    }

    const renderApi = () => {
      const api = ai.api;
      new Setting(containerEl)
        .setName("Provider")
        .addDropdown((d) => {
          for (const [id, pr] of Object.entries(API_PRESETS)) d.addOption(id, pr.label);
          d.setValue(api.provider).onChange(async (v) => {
            api.provider = v;
            api.baseUrl = "";
            api.model = API_PRESETS[v].defaultModel;
            await this.plugin.save();
            this.display();
          });
        });
      const preset = API_PRESETS[api.provider] || API_PRESETS.custom;
      if (preset.kind === "openai") {
        new Setting(containerEl)
          .setName("Base URL")
          .setDesc("Leave empty to use the provider's standard address.")
          .addText((t) =>
            t.setPlaceholder(preset.base || "https://.../v1").setValue(api.baseUrl).onChange(async (v) => {
              api.baseUrl = v.trim();
              await this.plugin.save();
            })
          );
      }
      if (!preset.noKey) {
        new Setting(containerEl)
          .setName("API key")
          .setDesc("Stored as plain text in this plugin's data.json, which syncs with your vault, so the same key works on your phone. Anyone with access to the vault can read it.")
          .addText((t) => {
            t.inputEl.type = "password";
            t.setValue((api.keys || {})[api.provider] || "").onChange(async (v) => {
              api.keys = api.keys || {};
              api.keys[api.provider] = v.trim();
              await this.plugin.save();
            });
          });
      }
      new Setting(containerEl)
        .setName("Model")
        .setDesc("The model name exactly as your provider lists it.")
        .addText((t) =>
          t.setPlaceholder("model name").setValue(api.model).onChange(async (v) => {
            api.model = v.trim();
            await this.plugin.save();
          })
        );
      new Setting(containerEl).setName("Test").addButton((b) =>
        b.setButtonText("Test").onClick(async () => {
          try {
            const r = await new ApiClient(ai).chat("You are a connection test.", [{ role: "user", content: "Reply with the single word OK." }]);
            new Notice(`Connected. Reply: ${r.trim().slice(0, 60)}`, 6000);
          } catch (e) {
            new Notice(friendlyApiError(e), 10000);
          }
        })
      );
    };

    const renderOpenCode = () => {
    new Setting(containerEl)
      .setName("Set up and run OpenCode for me")
      .setDesc(
        "Desktop only. The plugin runs OpenCode in the background (reachable only from this computer) when you use the AI chat, and stops it when Obsidian closes. " +
          "It never downloads anything unless you press Download and install. Turn off to connect to a server you run yourself."
      )
      .addToggle((t) =>
        t.setValue(ai.managed).onChange(async (v) => {
          ai.managed = v;
          await this.plugin.save();
          this.display();
        })
      );

    if (ai.managed) {
      new Setting(containerEl)
        .setName("Start OpenCode when Obsidian opens")
        .setDesc("Starts it quietly in the background so your first AI message doesn't wait. It stops when Obsidian closes. Off by default.")
        .addToggle((t) =>
          t.setValue(!!ai.preStart).onChange(async (v) => {
            ai.preStart = v;
            await this.plugin.save();
          })
        );
      const mgr = this.plugin.manager;
      const status = new Setting(containerEl).setName("Status").setDesc("Checking...");
      const refreshStatus = () =>
        mgr
          .describe()
          .then((d) => status.setDesc(d))
          .catch((e) => status.setDesc(str(e.message)));
      refreshStatus();
      const guarded = (fn) => async () => {
        const note = new Notice("Working...", 0);
        try {
          await fn((m) => note.setMessage(m));
        } catch (e) {
          new Notice(str(e.message), 10000);
        } finally {
          note.hide();
          this.display();
        }
      };
      status
        .addButton((b) =>
          b.setButtonText("Download and install").onClick(
            guarded(async (say) => {
              mgr.stop();
              const r = await mgr.install(say);
              new Notice(`Installed OpenCode v${r.version} (checksum verified).`, 8000);
            })
          )
        )
        .addButton((b) =>
          b.setButtonText(mgr.isRunning() ? "Stop" : "Start").onClick(
            guarded(async (say) => {
              if (mgr.isRunning()) mgr.stop();
              else await this.plugin.manager.ensure(say);
            })
          )
        );

      let providerId = PROVIDERS[0][0];
      let apiKey = "";
      new Setting(containerEl)
        .setName("Connect an AI provider")
        .setDesc(
          "Paste an API key and it is saved into OpenCode's own auth.json (merged with anything already there), not into your vault. " +
            "Already connected through OpenCode itself? You can skip this."
        )
        .addDropdown((d) => {
          for (const [id, label] of PROVIDERS) d.addOption(id, label);
          d.setValue(providerId).onChange((v) => (providerId = v));
        })
        .addText((t) => {
          t.inputEl.type = "password";
          t.setPlaceholder("API key").onChange((v) => (apiKey = v));
        })
        .addButton((b) =>
          b.setButtonText("Save key").onClick(() => {
            if (!apiKey.trim()) return new Notice("Paste a key first.");
            try {
              const file = mgr.saveProviderKey(providerId, apiKey);
              new Notice(`Saved to ${file}. OpenCode restarts the next time you use the AI chat.`, 8000);
              apiKey = "";
              this.display();
            } catch (e) {
              new Notice(str(e.message), 10000);
            }
          })
        );

      new Setting(containerEl)
        .setName("OpenCode program (optional)")
        .setDesc("Full path to an opencode program you installed yourself. Leave empty to use the downloaded one or the one on your PATH.")
        .addText((t) =>
          t.setValue(ai.binaryPath).onChange(async (v) => {
            ai.binaryPath = v.trim();
            await this.plugin.save();
          })
        );
    } else {
      new Setting(containerEl)
        .setName("Server URL")
        .setDesc("For a server you start yourself with `opencode serve`. Default is http://127.0.0.1:4096")
        .addText((t) =>
          t.setValue(ai.url).onChange(async (v) => {
            ai.url = v.trim();
            await this.plugin.save();
          })
        );
      new Setting(containerEl)
        .setName("Username")
        .setDesc("Only used if you set OPENCODE_SERVER_PASSWORD. Defaults to opencode.")
        .addText((t) =>
          t.setValue(ai.username).onChange(async (v) => {
            ai.username = v.trim() || "opencode";
            await this.plugin.save();
          })
        );
      new Setting(containerEl)
        .setName("Password")
        .setDesc("Stored as plain text in this plugin's data.json, which syncs with your vault.")
        .addText((t) => {
          t.inputEl.type = "password";
          t.setValue(ai.password).onChange(async (v) => {
            ai.password = v;
            await this.plugin.save();
          });
        });
    }

    new Setting(containerEl)
      .setName("Model (optional)")
      .setDesc("Format provider/model, for example anthropic/claude-sonnet-4-5. Leave empty to use OpenCode's default.")
      .addText((t) =>
        t.setValue(ai.model).onChange(async (v) => {
          ai.model = v.trim();
          await this.plugin.save();
        })
      );
    new Setting(containerEl)
      .setName("Agent (optional)")
      .setDesc("An OpenCode agent name. Leave empty for the default. Use Test connection to see the names available.")
      .addText((t) =>
        t.setValue(ai.agent).onChange(async (v) => {
          ai.agent = v.trim();
          await this.plugin.save();
        })
      );
    new Setting(containerEl).setName("Test connection").addButton((b) =>
      b.setButtonText("Test").onClick(async () => {
        if (ai.managed && !this.plugin.manager.isRunning()) {
          return new Notice("OpenCode isn't running yet. It starts when you use the AI chat, or press Start above.", 8000);
        }
        const oc = this.plugin.openCode();
        try {
          const h = await oc.health();
          let names = "";
          try {
            const agents = await oc.agents();
            names = Array.isArray(agents) ? agents.map((a) => a.name || a.id).filter(Boolean).join(", ") : "";
          } catch (e) {
            /* agents list is optional */
          }
          new Notice(`Connected to OpenCode${h && h.version ? " " + h.version : ""}.${names ? " Agents: " + names : ""}`, 8000);
        } catch (e) {
          new Notice(friendlyError(e, oc.base()), 8000);
        }
      })
    );

    };

    if (this.plugin.backend() === "api") renderApi();
    else renderOpenCode();

    new Setting(containerEl).setName("Presets").setHeading();
    if (!st.presets.length) {
      containerEl.createEl("p", {
        text: "No presets yet. Set filters in the practice view and tap 'Save as preset'.",
        cls: "setting-item-description",
      });
    }
    for (const pr of st.presets) {
      const desc =
        [pr.filters, ...(pr.moreSets || [])]
          .filter(hasFilters)
          .map((f) =>
            FILTER_FIELDS.map(([k]) => (fvals(f, k).length ? `${k}: ${fvals(f, k).join(" or ")}` : ""))
              .filter(Boolean)
              .join(", ")
          )
          .join("  |OR|  ") || "no filters";
      new Setting(containerEl)
        .setName(pr.name)
        .setDesc(`${desc} · ${pr.mode}`)
        .addButton((b) =>
          b.setButtonText("Rename").onClick(() =>
            new NameModal(this.app, "Rename preset", pr.name, async (name) => {
              pr.name = name;
              await this.plugin.save();
              this.display();
              this.plugin.refreshViews();
            }).open()
          )
        )
        .addButton((b) =>
          b.setButtonText("Delete").setWarning().onClick(async () => {
            st.presets = st.presets.filter((x) => x.id !== pr.id);
            if (st.activePreset === pr.id) st.activePreset = "";
            await this.plugin.save();
            this.display();
            this.plugin.refreshViews();
          })
        );
    }
  }
}

module.exports = QuestionTrackerPlugin;
QuestionTrackerPlugin.__test = {
  fmtDate,
  fmtDateTime,
  isDue,
  weightOf,
  matchFilters,
  filterOptions,
  pickQuestion,
  parseSections,
  extractRationale,
  answerFromSection,
  modelFromString,
  friendlyError,
  partsToTurns,
  buildTutorContext,
  buildGeneralContext,
  PracticeView,
  OpenCodeClient,
  ApiClient,
  friendlyApiError,
  apiTurns,
  ChatPanel,
  OpenCodeManager,
  platformTriple,
  candidateAssetNames,
  chooseRelease,
  mergeAuth,
  downloadFile,
  extractArchive,
  findBinaryIn,
  replaceMyNotes,
  gradeAnswer,
  applyAttempt,
  setLastErrorType,
  fillDefaults,
};
