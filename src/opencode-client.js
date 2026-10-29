"use strict";
const { requestUrl } = require("obsidian");
const { str } = require("./util");
const { extractRationale } = require("./notes");
const { roleInstruction, commandReference } = require("./tutor-presets");

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

function buildTutorContext(r, notesText, confLabels, mode, tutorRole) {
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
    roleInstruction(tutorRole),
    "",
    "You are helping a student review a practice question they just answered. " +
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
        "tracking properties (result, attempts, correct_count, streak, history, next_review, last_attempt_id, srs, scheduler, time_spent_total, and similar) unless explicitly told to."
    );
  }
  lines.push("", commandReference());
  return lines.join("\n");
}

function buildGeneralContext(app, mode, tutorRole, studyContext) {
  let base = "";
  try {
    base = (app.vault.adapter && app.vault.adapter.basePath) || "";
  } catch (e) {
    /* mobile */
  }
  return [
    roleInstruction(tutorRole),
    "",
    "You are helping maintain an Obsidian vault of practice-question notes (SAT, PSAT and AP).",
    "Each question note has YAML properties: static ones (question_id, test, subject, course, section, domain, skill, difficulty, unit, " +
      "question_type, choices, answer, source, target_seconds, tags) and tracking ones written by a plugin " +
      "(result, date attempted, first_attempted, attempts, correct_count, streak, time_spent_total, last_time_spent, last_answer, " +
      "last_confidence, last_error_type, flagged, next_review, last_attempt_id, srs, scheduler, history).",
    "The body uses the headings: ## Question, ## Answer Choices (lines like '- A. text'), ## Answer (a '> [!answer]-' callout with " +
      "'**Correct Answer: X**' and a rationale), and ## My Notes.",
    "Never change the tracking properties unless explicitly told to. Keep the format above when creating or editing notes.",
    base ? `The vault folder on disk is: ${base}` : "",
    mode === "tutor" ? "File editing is disabled in this chat; answer from the conversation only." : "You may read and edit files in the vault when asked.",
    ...(str(studyContext).trim() ? ["", str(studyContext).trim()] : []),
    "",
    commandReference(),
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
    if (r.status >= 400) {
      const hint = r.status === 404 || r.status === 405 ? " This usually means the OpenCode version doesn't match the plugin (it works with OpenCode 1.x). In the plugin settings press Download and install, or switch AI backend to Direct API." : "";
      throw new Error(`OpenCode returned ${r.status} for ${method} ${path}${str(r.text).trim() ? `: ${str(r.text).slice(0, 300)}` : "."}${hint}`);
    }
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

module.exports = {
  modelFromString,
  friendlyError,
  partsToTurns,
  buildTutorContext,
  buildGeneralContext,
  OpenCodeClient,
};
