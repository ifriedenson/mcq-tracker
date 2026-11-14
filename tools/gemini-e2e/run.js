"use strict";
/*
 * End-to-end check of the Direct API import path against a server that answers
 * exactly like Google's OpenAI-compatible Gemini endpoint
 * (generativelanguage.googleapis.com/v1beta/openai): a Bearer key, a /models
 * list, and /chat/completions.
 *
 * It drives the shipping PdfImportModal, the shipping plugin (no stubbed
 * aiChat, no stubbed verifyDraftQuestions), real PDF bytes through the real
 * pdf.js adapter, real HTTP over loopback, and reads the notes the import
 * actually wrote.
 *
 *   node tools/gemini-e2e/run.js
 *   node tools/gemini-e2e/run.js --base https://generativelanguage.googleapis.com/v1beta/openai --key <key>
 *
 * Without --base it starts the local stand-in. --key defaults to a placeholder
 * the stand-in accepts; a real Google key is only ever read from the argument
 * or from GEMINI_API_KEY, never written to disk.
 */
const http = require("node:http");
const { load, obsidian } = require("../../tests/helpers/load");
const { makeDom } = require("../../tests/helpers/fake");
const { makePdfRuntime, makeTrackedApp, textPdf } = require("../../tests/helpers/real-pdf");

const runtime = makePdfRuntime();
obsidian.loadPdfJs = async () => runtime;
const { T, Plugin: QT } = load();
global.createEl = (tag, opts) => makeDom().root.createEl(tag, opts);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const VERIFY_REPLY = "Answer: B\nConfidence: high";
const NOTE_REPLY = `---
number: {n}
answer: B
---

## Question
What is {n} + {n}?

## Answer Choices
- A. {n}
- B. {n2}
- C. {n3}
- D. {n4}

## Answer
**Correct Answer: B**
`;

/* ---------------------------------------------------------------- stand-in */

function startStandIn() {
  const log = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const auth = String(req.headers.authorization || "");
      let payload = null;
      try {
        payload = body ? JSON.parse(body) : null;
      } catch (e) {
        payload = null;
      }
      const entry = { method: req.method, path: req.url, auth, model: payload && payload.model, maxTokens: payload && payload.max_tokens };
      log.push(entry);
      const send = (status, data) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(data));
      };
      if (!/^Bearer\s+\S+/.test(auth)) {
        return send(400, [{ error: { code: 400, message: "Please pass a valid API key", status: "INVALID_ARGUMENT" } }]);
      }
      if (req.method === "GET" && /\/models$/.test(req.url)) {
        return send(200, { object: "list", data: [{ id: "gemini-3.8-flash", object: "model", owned_by: "google" }] });
      }
      if (req.method === "POST" && /\/chat\/completions$/.test(req.url)) {
        const messages = (payload && payload.messages) || [];
        const system = String((messages[0] && messages[0].content) || "");
        const user = String((messages[messages.length - 1] && messages[messages.length - 1].content) || "");
        entry.kind = /independent exam answer checker/i.test(system) ? "verify" : "note";
        entry.system = system.replace(/\s+/g, " ").slice(0, 100);
        const text = entry.kind === "verify" ? VERIFY_REPLY : NOTE_REPLY.replace(/\{n2\}/g, "n+1").replace(/\{n3\}/g, "n+2").replace(/\{n4\}/g, "n+3").replace(/\{n\}/g, String(1 + log.filter((r) => r.kind === "note").length - 1));
        return send(200, { id: "chatcmpl-e2e", object: "chat.completion", model: payload && payload.model, choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }], usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 } });
      }
      return send(404, { error: { code: 404, message: "not found" } });
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, log, port: server.address().port }));
  });
}

/* ------------------------------------------------------- real requestUrl */

function realRequestUrl(opts) {
  return new Promise((resolve) => {
    let url;
    try {
      url = new URL(opts.url);
    } catch (e) {
      return resolve({ status: 0, text: "bad url", json: null });
    }
    const headers = { ...(opts.headers || {}) };
    if (opts.contentType) headers["content-type"] = opts.contentType;
    const body = opts.body === undefined || opts.body === null ? null : Buffer.from(String(opts.body));
    if (body) headers["content-length"] = String(body.length);
    const req = http.request({ hostname: url.hostname, port: url.port, path: url.pathname + url.search, method: opts.method || "GET", headers }, (res) => {
      let text = "";
      res.on("data", (chunk) => (text += chunk));
      res.on("end", () => {
        let json = null;
        try {
          json = JSON.parse(text);
        } catch (e) {
          json = null;
        }
        resolve({ status: res.statusCode, text, json, headers: res.headers });
      });
    });
    req.on("error", (error) => resolve({ status: 0, text: String(error && error.message), json: null }));
    if (body) req.write(body);
    req.end();
  });
}

/* ------------------------------------------------------------------- run */

async function waitFor(check, label, ms) {
  const end = Date.now() + (Number(ms) > 0 ? Number(ms) : 20000);
  while (Date.now() < end) {
    if (check()) return;
    await sleep(20);
  }
  throw new Error(`timed out waiting for ${label}`);
}

async function main() {
  const args = process.argv.slice(2);
  const baseArg = args.indexOf("--base");
  const keyArg = args.indexOf("--key");
  const standIn = baseArg >= 0 ? null : await startStandIn();
  const base = baseArg >= 0 ? args[baseArg + 1] : `http://127.0.0.1:${standIn.port}/v1beta/openai`;
  const key = keyArg >= 0 ? args[keyArg + 1] : standIn ? "gemini-e2e-placeholder" : process.env.GEMINI_API_KEY || "";

  obsidian.requestImpl = realRequestUrl;

  const state = makeTrackedApp([]);
  const plugin = new QT(state.app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "api";
  plugin.settings.ai.api.provider = "google";
  plugin.settings.ai.api.baseUrl = base;
  plugin.settings.ai.api.keys = Object.assign({}, plugin.settings.ai.api.keys, { google: key });
  plugin.settings.ai.api.model = "gemini-3.8-flash";
  plugin.settings.importOptions = { capture: false, pagePics: false };
  plugin.settings.importDefaults = {};
  plugin.settings.importFolder = "";
  plugin.settings.questionFolder = "Questions";
  state.plugin = plugin;
  obsidian.modals.length = 0;
  obsidian.notices.length = 0;

  const bytes = await textPdf();
  const file = (name) => ({ name, async arrayBuffer() { return bytes; } });
  const modal = new T.PdfImportModal(state.app, plugin, { files: [file("Unit A.pdf"), file("Unit B.pdf")] });
  const dom = makeDom();
  modal.contentEl = dom.root;
  modal.modalEl = dom.root;
  modal.onOpen();

  console.log("provider:", plugin.settings.ai.api.provider, "| base:", base, "| model:", plugin.settings.ai.api.model);
  await modal.startBatch();
  await waitFor(() => dom.texts().includes("Found 1 question"), "the first file review");
  console.log("file 1 of 2 reviewed, creating its note...");
  await dom.click("Create 1 note");
  await waitFor(() => dom.texts().join("\n").includes("File 2 of 2"), "the second file review");
  console.log("file 2 of 2 reviewed, creating its note...");
  await dom.clickLast("Create 1 note");
  await waitFor(() => obsidian.modals.some((entry) => entry !== modal && typeof entry.render === "function"), "the completion summary");

  const complete = obsidian.modals.find((entry) => entry !== modal && typeof entry.render === "function");
  const completeDom = makeDom();
  complete.contentEl = completeDom.root;
  complete.modalEl = completeDom.root;
  complete.onOpen();
  const summary = completeDom.texts().join("\n");

  const notes = (state.app.created || []).filter((entry) => /\.md$/.test(entry.path));
  console.log("\n--- import summary ---");
  console.log(summary.split("\n").filter(Boolean).slice(0, 8).join("\n"));
  console.log("\n--- notes written ---");
  for (const note of notes) {
    const body = String(note.text || "");
    const fm = (body.match(/^---\r?\n([\s\S]*?)\r?\n---/) || [, ""])[1];
    console.log(note.path);
    console.log(fm.split("\n").filter((line) => /verified|verification|answer|number/.test(line)).map((line) => "    " + line).join("\n"));
  }
  if (standIn) {
    console.log("\n--- requests the plugin made ---");
    for (const entry of standIn.log) {
      console.log(`${entry.method} ${entry.path} | auth ${entry.auth.replace(/Bearer (\w{4}).*/, "Bearer $1…")} | model ${entry.model} | max_tokens ${entry.maxTokens} | ${entry.kind || "list"}\n    system: ${entry.system || ""}`);
    }
  }
  const verifyCount = standIn ? standIn.log.filter((entry) => entry.kind === "verify").length : "n/a";
  const authOk = standIn ? standIn.log.every((entry) => entry.auth === `Bearer ${key}`) : "n/a";
  console.log("\nverification requests:", verifyCount, "| every request carried the key:", authOk);

  const ok = notes.length === 2 && /2 question notes imported from 2 files/.test(summary);
  console.log(ok ? "\nRESULT: pass" : "\nRESULT: fail");
  if (standIn) standIn.server.close();
  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error("RESULT: fail —", error && error.stack ? error.stack : error);
  process.exit(1);
});
