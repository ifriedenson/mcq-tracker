"use strict";
/*
 * How much of a blind check's wall time is the plugin, and how much is the
 * provider? Runs the shipping verifyDraftQuestions against a local
 * Gemini-shaped server that answers instantly, then again with an artificial
 * per-request delay, so the plugin's own overhead is measurable.
 *
 *   node tools/gemini-e2e/check-speed.js            # instant provider
 *   node tools/gemini-e2e/check-speed.js --delay 84000
 */
const http = require("node:http");
const { load, obsidian } = require("../../tests/helpers/load");
const { makeTrackedApp } = require("../../tests/helpers/real-pdf");
const { buildBlindVerificationPrompt } = require("../../src/answer-verification");

const { Plugin: QT } = load();

const delayArg = process.argv.indexOf("--delay");
const DELAY = delayArg >= 0 ? Number(process.argv[delayArg + 1]) || 0 : 0;

function startServer() {
  const log = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      let payload = null;
      try {
        payload = JSON.parse(body);
      } catch (e) {
        payload = null;
      }
      log.push({ path: req.url, at: Date.now(), maxTokens: payload && payload.max_tokens });
      setTimeout(() => {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ choices: [{ index: 0, message: { role: "assistant", content: "Answer: B" } }] }));
      }, DELAY);
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, log, port: server.address().port })));
}

function requestUrl(opts) {
  return new Promise((resolve) => {
    const url = new URL(opts.url);
    const headers = { ...(opts.headers || {}) };
    if (opts.contentType) headers["content-type"] = opts.contentType;
    const body = opts.body ? Buffer.from(String(opts.body)) : null;
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
        resolve({ status: res.statusCode, text, json });
      });
    });
    req.on("error", (error) => resolve({ status: 0, text: String(error && error.message), json: null }));
    if (body) req.write(body);
    req.end();
  });
}

const prompt = buildBlindVerificationPrompt({
  question: "A cell takes up water when placed in which solution?",
  choices: [
    { letter: "A", text: "hypertonic" },
    { letter: "B", text: "hypotonic" },
    { letter: "C", text: "isotonic" },
    { letter: "D", text: "saturated" },
  ],
  multiple: false,
});

async function main() {
  const { server, log, port } = await startServer();
  obsidian.requestImpl = requestUrl;
  const state = makeTrackedApp([]);
  const plugin = new QT(state.app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "api";
  plugin.settings.ai.api.provider = "google";
  plugin.settings.ai.api.baseUrl = `http://127.0.0.1:${port}/v1beta/openai`;
  plugin.settings.ai.api.keys = Object.assign({}, plugin.settings.ai.api.keys, { google: "gemini-e2e-placeholder" });
  plugin.settings.ai.api.model = "gemini-3.8-flash";
  plugin.settings.ai.verifyPanel = false;

  const items = Array.from({ length: 10 }, (_, i) => ({
    question: `Question ${i + 1}: ${"A cell takes up water when placed in which solution?".repeat(1)}`.slice(0, 400),
    choices: [
      { letter: "A", text: "hypertonic" },
      { letter: "B", text: "hypotonic" },
      { letter: "C", text: "isotonic" },
      { letter: "D", text: "saturated" },
    ],
    answer: "B",
  }));

  console.log("provider delay per request:", DELAY + "ms");
  console.log("one check prompt:", JSON.stringify(prompt).length, "chars (~" + Math.round(JSON.stringify(prompt).length / 4) + " tokens)");
  const started = Date.now();
  const result = await plugin.verifyDraftQuestions(items, {});
  const elapsed = Date.now() - started;
  const requests = log.length;
  console.log(`10 checks: ${requests} requests, ${elapsed}ms total, ${Math.round(elapsed / 10)}ms per check`);
  console.log("plugin overhead per check:", Math.round((elapsed - DELAY * requests) / 10) + "ms");
  console.log("result:", JSON.stringify(result));
  console.log("checks/hour at this pace:", Math.round((3600 / (elapsed / 10)) * 10) / 10);
  server.close();
}

main().catch((error) => {
  console.error("failed:", error && error.stack ? error.stack : error);
  process.exit(1);
});
