"use strict";
/*
 * How long one blind answer check takes on the OpenCode backend, with a model
 * that answers instantly. Whatever is left over is the OpenCode round trip the
 * plugin does per check (ensure/ping, new session, send, wait for messages).
 *
 *   node tools/gemini-e2e/opencode-speed.js http://127.0.0.1:4719 local/gpt-4o-mini
 */
const { load, obsidian } = require("../../tests/helpers/load");
const { makeTrackedApp } = require("../../tests/helpers/real-pdf");

const { Plugin: QT } = load();

function requestUrl(opts) {
  return new Promise(async (resolve) => {
    try {
      const started = Date.now();
      const response = await fetch(opts.url, {
        method: opts.method || "GET",
        headers: { ...(opts.headers || {}), ...(opts.contentType ? { "content-type": opts.contentType } : {}) },
        body: opts.body,
      });
      const text = await response.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch (e) {
        json = null;
      }
      resolve({ status: response.status, text, json, ms: Date.now() - started });
    } catch (error) {
      resolve({ status: 0, text: String(error && error.message), json: null });
    }
  });
}

const item = (i) => ({
  question: `Question ${i}: A cell takes up water when placed in which solution?`,
  choices: [
    { letter: "A", text: "hypertonic" },
    { letter: "B", text: "hypotonic" },
    { letter: "C", text: "isotonic" },
    { letter: "D", text: "saturated" },
  ],
  answer: "B",
});

async function main() {
  const url = process.argv[2] || "http://127.0.0.1:4719";
  const model = process.argv[3] || "local/gpt-4o-mini";
  obsidian.requestImpl = requestUrl;
  const state = makeTrackedApp([]);
  const plugin = new QT(state.app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "opencode";
  plugin.settings.ai.managed = false;
  plugin.settings.ai.url = url;
  plugin.settings.ai.username = "";
  plugin.settings.ai.password = "";
  plugin.settings.ai.model = model;
  plugin.settings.ai.verifyPanel = false;
  plugin.settings.ai.features = {};

  console.log("opencode:", url, "| model:", model);

  const times = [];
  for (let i = 1; i <= 5; i++) {
    const started = Date.now();
    const result = await plugin.verifyQuestionDraft(item(i), {});
    const ms = Date.now() - started;
    times.push(ms);
    console.log(`check ${i}: ${ms} ms -> answer ${result.answer} match ${result.match}`);
  }
  const total = times.reduce((a, b) => a + b, 0);
  const sorted = [...times].sort((a, b) => a - b);
  console.log(`\nmedian ${sorted[Math.floor(sorted.length / 2)]} ms | mean ${Math.round(total / times.length)} ms | checks/hour ${Math.round(3600 / (total / times.length))}`);
}

main().catch((error) => {
  console.error("failed:", error && error.stack ? error.stack : error);
  process.exit(1);
});
