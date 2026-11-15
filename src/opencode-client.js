"use strict";
const { requestUrl } = require("obsidian");
const { sleep, str } = require("./util");
const { safeApiBase } = require("./url-safety");
const { extractRationale } = require("./notes");
const { roleInstruction, commandReference } = require("./tutor-presets");
const { chunksFromStream, sseData } = require("./chat-stream");

/* ------------------------------------------------------------ OpenCode (AI) */

/** A health check must finish even when the server accepts the socket but never answers. */
const HEALTH_TIMEOUT_MS = 4000;
/** A small request (session, messages, abort) must answer too; 60s is a stuck server, not a slow one. */
const REQUEST_TIMEOUT_MS = 60 * 1000;
/** A blocking agent send may run long, but it may not go silent: this is the silence allowance. */
const IDLE_TIMEOUT_MS = 6 * 60 * 1000;
/** A blind check may think for many minutes with no visible output, so a slow model is not a stuck one. */
const VERIFY_IDLE_TIMEOUT_MS = 20 * 60 * 1000;
/** How often a blocking send asks the session whether anything new was written. */
const IDLE_POLL_MS = 3000;
/**
 * An assistant message that exists but carries no part at all cannot become an
 * answer. Providers report a usage limit or a rejected key this way, with no
 * error field and no completion time, so this grace is the only thing that
 * separates a dead request from a slow first token.
 */
const EMPTY_REPLY_MS = 90 * 1000;

function durationLabel(ms) {
  return ms >= 1000 ? Math.round(ms / 1000) + "s" : ms + "ms";
}

function bounded(promise, ms, label) {
  let timer = null;
  const limit = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${durationLabel(ms)}.`)), ms);
  });
  return Promise.race([promise, limit]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * A provider failure or an empty final reply is final, even while the blocking
 * POST is still open. Without this, a stream error inside a blind check looked
 * like a slow model and held the batch for the whole 20-minute silence
 * allowance.
 */
/**
 * The latest assistant message ended with nothing in it. Only a *finished*
 * empty message counts: while a slow model is still reading a long prompt the
 * message exists with no parts and no completion time, and calling that empty
 * would kill a request that is working. A provider that refuses the request
 * completes the message empty within seconds, so a real refusal is still
 * reported quickly.
 */
function emptyAssistant(msgs) {
  const last = [...(msgs || [])].reverse().find((m) => m && m.info && m.info.role === "assistant");
  if (!last || (last.info && last.info.error)) return false;
  const info = last.info || {};
  const completed = !!(info.time && info.time.completed !== undefined && info.time.completed !== null);
  if (!completed) return false;
  const parts = Array.isArray(last.parts) ? last.parts : [];
  if (parts.length) return false;
  return !parts.some(
    (p) => p && p.type === "tool" && p.state && (p.state.status === "pending" || p.state.status === "running" || p.state.status === "streaming")
  );
}

function sessionFailure(msgs) {
  const last = [...(msgs || [])].reverse().find((m) => m && m.info && m.info.role === "assistant");
  if (!last) return "";
  const info = last.info || {};
  if (info.error) {
    const raw = info.error.data && info.error.data.message;
    const text = str(raw) || str(info.error.message) || str(info.error.name) || "the provider rejected the request";
    return "OpenCode's provider failed: " + text;
  }
  const parts = Array.isArray(last.parts) ? last.parts : [];
  const running = parts.some(
    (p) => p && p.type === "tool" && p.state && (p.state.status === "pending" || p.state.status === "running" || p.state.status === "streaming")
  );
  const completed = !!(info.time && info.time.completed !== undefined && info.time.completed !== null);
  if (!parts.length && completed && !running && info.finish !== "tool-calls") {
    return (
      "OpenCode's provider sent no reply at all: the request was accepted and the answer was empty. " +
      "That is usually a usage limit, a rejected key or an unavailable model."
    );
  }
  return "";
}

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
  // An empty Error (or a bare "Error") carries no information; say what failed instead.
  if (!m || /^error:?$/i.test(m.trim())) {
    return `OpenCode didn't finish the request at ${url}. Check that OpenCode is running and a provider is connected, then try again.`;
  }
  return m;
}

/** Turn GET /session/:id/message output into simple chat turns. */
function partsToTurns(messages) {
  const turns = [];
  for (const m of Array.isArray(messages) ? messages : []) {
    const role = m && m.info && m.info.role === "user" ? "user" : "assistant";
    const texts = [];
    const tools = [];
    const reasoning = [];
    for (const p of (m && m.parts) || []) {
      if (!p) continue;
      if (p.type === "text" && !p.synthetic && !p.ignored && str(p.text).trim()) texts.push(p.text);
      else if (p.type === "reasoning" || p.type === "thinking") {
        const text = str(p.text || p.content).trim();
        if (text) reasoning.push(text);
      } else if (p.type === "tool") {
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
    if (texts.length || tools.length) {
      const turn = { role, texts, tools };
      if (reasoning.length) turn.reasoning = reasoning;
      turns.push(turn);
    }
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
  constructor(ai, opts) {
    this.ai = ai;
    this.timeoutMs = Number(opts && opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : REQUEST_TIMEOUT_MS;
  }
  base() {
    return safeApiBase(str(this.ai.url).trim().replace(/\/+$/, "") || "http://127.0.0.1:4096");
  }
  headers() {
    const h = {};
    if (this.ai.password) {
      const raw = `${this.ai.username || "opencode"}:${this.ai.password}`;
      h.Authorization = "Basic " + btoa(unescape(encodeURIComponent(raw)));
    }
    return h;
  }
  async req(method, path, body, timeoutMs) {
    const work = requestUrl({
      url: this.base() + path,
      method,
      headers: this.headers(),
      contentType: body !== undefined ? "application/json" : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      throw: false,
    });
    // 0 means "the caller watches this request itself" (a blocking agent send).
    const ms = Number(timeoutMs) > 0 ? Number(timeoutMs) : 0;
    const r = ms ? await bounded(work, ms, `OpenCode ${method} ${path}`) : await work;
    if (r.status === 401) {
      const error = new Error("401 unauthorized");
      error.aiConfig = true;
      error.code = "ai-config";
      throw error;
    }
    if (r.status >= 400) {
      const hint = r.status === 404 || r.status === 405 ? " This usually means the OpenCode version doesn't match the plugin (it works with OpenCode 1.x). In the plugin settings press Download and install, or switch AI backend to Direct API." : "";
      const error = new Error(`OpenCode returned ${r.status} for ${method} ${path}${str(r.text).trim() ? `: ${str(r.text).slice(0, 300)}` : "."}${hint}`);
      if (hint) {
        error.aiConfig = true;
        error.code = "ai-config";
      }
      throw error;
    }
    try {
      return r.json;
    } catch (e) {
      return null;
    }
  }
  health(timeoutMs) {
    const ms = Number(timeoutMs) > 0 ? Number(timeoutMs) : HEALTH_TIMEOUT_MS;
    return bounded(this.req("GET", "/global/health", undefined, 0), ms, "OpenCode health check");
  }
  agents() {
    return this.req("GET", "/agent", undefined, this.timeoutMs);
  }
  providers(timeoutMs) {
    const req = this.req("GET", "/config/providers", undefined, this.timeoutMs);
    const ms = Number(timeoutMs) > 0 ? Number(timeoutMs) : 0;
    return ms ? bounded(req, ms, "OpenCode providers check") : req;
  }
  createSession(title) {
    return this.req("POST", "/session", { title }, this.timeoutMs);
  }
  /** Drop a finished check session so hundreds of imports do not bloat the server. */
  deleteSession(id) {
    return this.req("DELETE", "/session/" + encodeURIComponent(id), undefined, this.timeoutMs);
  }
  messages(id) {
    return this.req("GET", `/session/${encodeURIComponent(id)}/message`, undefined, this.timeoutMs);
  }
  /**
   * Send a message and wait for the agent to finish (including any tool use).
   * A run that keeps writing to the session may take as long as it needs; one
   * that writes nothing new for `idleMs` is treated as stuck, so the chat or
   * import spinner cannot run forever. `idleMs` is for tests.
   */
  async send(id, body, opts) {
    const o = opts || {};
    const idleMs = Number(o.idleMs) > 0 ? Number(o.idleMs) : IDLE_TIMEOUT_MS;
    const emptyMs = Number(o.emptyMs) > 0 ? Number(o.emptyMs) : EMPTY_REPLY_MS;
    let emptySince = 0;
    const work = this.req("POST", `/session/${encodeURIComponent(id)}/message`, body, 0);
    let settled = null;
    work.then(
      (value) => {
        settled = { value };
      },
      (error) => {
        settled = { error };
      }
    );
    let signature = null;
    let lastActivity = Date.now();
    const pollMs = Math.max(20, Math.min(IDLE_POLL_MS, Math.floor(idleMs / 4)));
    while (!settled) {
      await sleep(pollMs);
      if (settled) break;
      let msgs = null;
      try {
        msgs = await this.messages(id);
      } catch (e) {
        /* a failed progress read is not progress; the silence allowance decides */
      }
      if (msgs) {
        const next = JSON.stringify(msgs);
        if (signature !== null && next !== signature) lastActivity = Date.now();
        signature = next;
        const failure = sessionFailure(msgs);
        if (failure) {
          try {
            await this.abort(id);
          } catch (abortError) {
            /* the abort is cleanup; the provider's words are the error */
          }
          throw new Error(failure);
        }
        if (emptyAssistant(msgs)) {
          if (!emptySince) emptySince = Date.now();
          if (Date.now() - emptySince >= emptyMs) {
            try {
              await this.abort(id);
            } catch (abortError) {
              /* the abort is cleanup; the empty answer is the error */
            }
            throw new Error(
              "OpenCode's provider sent no reply at all: the request was accepted and the answer was empty. " +
                "That is usually a usage limit, a rejected key or an unavailable model."
            );
          }
        } else {
          emptySince = 0;
        }
      }
      if (Date.now() - lastActivity >= idleMs) {
        // A run that went quiet may still be alive on the server (a model that
        // wandered into tool calls, for example), so stop it before reporting
        // the silence: otherwise a retry stacks onto a zombie session.
        try {
          await this.abort(id);
        } catch (abortError) {
          /* the abort is cleanup; the silence is the error */
        }
        throw new Error(
          `OpenCode accepted the request but wrote nothing new for ${durationLabel(idleMs)}. Check that OpenCode is still running and a provider is connected, then try again.`
        );
      }
    }
    if (settled.error) throw settled.error;
    return settled.value;
  }
  /** Queue a prompt without waiting for the agent; poll messages/status for completion. */
  promptAsync(id, body) {
    return this.req("POST", `/session/${encodeURIComponent(id)}/prompt_async`, body, this.timeoutMs);
  }
  /**
   * Send a message and report text deltas from the server's SSE event stream
   * while the blocking send runs. Streaming is best effort: no fetch, no event
   * stream, or an event shape this version does not know simply means no
   * deltas, and the caller still refreshes the finished messages from the
   * server. The returned text is what the event stream contributed.
   */
  async stream(id, body, opts) {
    const o = opts || {};
    if (typeof fetch !== "function" || typeof AbortController === "undefined" || typeof o.onDelta !== "function" || typeof sseData !== "function") {
      return this.send(id, body);
    }
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    if (o.signal) o.signal.addEventListener("abort", onAbort);
    let text = "";
    const events = (async () => {
      try {
        const response = await fetch(`${this.base()}/event`, {
          headers: { ...this.headers(), accept: "text/event-stream" },
          signal: controller.signal,
        });
        if (!response || !response.ok || !response.body || typeof response.body.getReader !== "function") return;
        for await (const data of sseData(chunksFromStream(response.body))) {
          let payload = null;
          try {
            payload = JSON.parse(data);
          } catch (error) {
            continue;
          }
          const properties = payload && payload.properties ? payload.properties : {};
          if (properties.sessionID && properties.sessionID !== id) continue;
          const part = properties.part && typeof properties.part === "object" ? properties.part : {};
          const delta = typeof properties.delta === "string" ? properties.delta : "";
          if (!delta || (part.type && part.type !== "text") || part.ignored || part.synthetic) continue;
          text += delta;
          o.onDelta(delta);
        }
      } catch (error) {
        /* streaming is an optimisation; the blocking send below is the truth */
      }
    })();
    try {
      await this.send(id, body);
    } finally {
      controller.abort();
      if (o.signal) o.signal.removeEventListener("abort", onAbort);
      await Promise.race([events, new Promise((resolve) => setTimeout(resolve, 50))]);
    }
    return text;
  }
  abort(id) {
    return this.req("POST", `/session/${encodeURIComponent(id)}/abort`, {}, this.timeoutMs);
  }

  /**
   * Follow the server's event stream for as long as the caller keeps it.
   * `onEvent(payload)` gets every event; the caller filters by session. The
   * session's own message list does not carry a provider failure — OpenCode
   * leaves an empty, unfinished assistant message and reports the reason as a
   * `session.status` retry event — so this is how a spent quota or a rate
   * limit becomes visible while a prompt is still running. Best effort: no
   * fetch, no stream, or an event shape this version does not know ends or
   * skips quietly, and the caller still reads the messages.
   */
  watchEvents(onEvent, signal) {
    const stop = () => {
      try {
        if (req) req.destroy();
      } catch (e) {
        /* already closed */
      }
    };
    if (typeof onEvent !== "function") return () => {};
    let req = null;
    // A renderer fetch to the local server is refused by the page's own
    // security rules (the same request succeeds over HTTP), so the stream is
    // read with Node's http on desktop. Mobile has no OpenCode anyway.
    let http = null;
    try {
      http = require("http");
    } catch (e) {
      http = null;
    }
    if (!http || typeof http.request !== "function") return () => {};
    let base = "";
    try {
      base = this.base();
    } catch (e) {
      return () => {};
    }
    let target = null;
    try {
      target = new URL(`${base}/event`);
    } catch (e) {
      return () => {};
    }
    if (signal) {
      if (signal.aborted) return () => {};
      signal.addEventListener("abort", stop);
    }
    try {
      req = http.request(
        {
          hostname: target.hostname,
          port: target.port || 80,
          path: `${target.pathname}${target.search}`,
          headers: { ...this.headers(), accept: "text/event-stream" },
        },
        (response) => {
          if (!response || response.statusCode < 200 || response.statusCode >= 300) {
            response && response.resume();
            return;
          }
          let buffer = "";
          response.setEncoding("utf8");
          response.on("data", (chunk) => {
            buffer += chunk;
            let at = buffer.indexOf("\n\n");
            while (at >= 0) {
              const block = buffer.slice(0, at);
              buffer = buffer.slice(at + 2);
              for (const line of block.split("\n")) {
                if (!line.startsWith("data:")) continue;
                let payload = null;
                try {
                  payload = JSON.parse(line.slice(5).trim());
                } catch (error) {
                  continue;
                }
                try {
                  onEvent(payload);
                } catch (error) {
                  /* a listener never breaks the stream */
                }
              }
              at = buffer.indexOf("\n\n");
            }
          });
          response.on("error", () => {});
        }
      );
      req.on("error", () => {});
      req.end();
    } catch (e) {
      return () => {};
    }
    return stop;
  }

}

module.exports = {
  HEALTH_TIMEOUT_MS,
  REQUEST_TIMEOUT_MS,
  IDLE_TIMEOUT_MS,
  VERIFY_IDLE_TIMEOUT_MS,
  modelFromString,
  friendlyError,
  partsToTurns,
  buildTutorContext,
  buildGeneralContext,
  OpenCodeClient,
};
