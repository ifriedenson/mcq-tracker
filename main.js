"use strict";
/*
 * MCQ Tracker - Obsidian plugin (plain JS, no build step, desktop + mobile).
 * Works on notes that have a `question_id` property. All data lives in each
 * note's properties; the plugin's own data.json only stores settings, presets
 * and the running timer.
 */
const obsidian = require("obsidian");
const { Plugin, ItemView, PluginSettingTab, Setting, Modal, Notice, MarkdownRenderer, Platform, TFile, setIcon, requestUrl } =
  obsidian;

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
    const ended = /[.!?:;"”’)\]*_]$/.test(last);
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

      progress("Checking that it runs...");
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
    for (let i = 0; i < 80; i++) {
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
        await sleep(500);
      }
    }
    this.stop();
    throw new Error(`OpenCode didn't become ready within 40 seconds. ${this.tail.trim().slice(-300)}`);
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
  async chat(system, messages) {
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
      body = { model, max_tokens: 1500, system, messages: msgs };
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
      if (timer) window.clearInterval(timer);
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
    this.registerDomEvent(window, "beforeunload", () => this.manager.stop());
    this.registerView(VIEW_TYPE, (leaf) => new PracticeView(leaf, this));
    this.addRibbonIcon("graduation-cap", "Open practice view", () => this.activateView());

    this.addCommand({ id: "open-practice-view", name: "Open practice view", callback: () => this.activateView() });
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
