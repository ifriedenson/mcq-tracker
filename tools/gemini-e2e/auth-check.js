"use strict";
/*
 * What the plugin shows when the Direct API key is wrong, asked of the real
 * Google endpoint through the shipping ApiClient (one request, no retry).
 *
 *   node tools/gemini-e2e/auth-check.js
 */
const http = require("node:http");
const https = require("node:https");
const { load, obsidian } = require("../../tests/helpers/load");
const { makeTrackedApp } = require("../../tests/helpers/real-pdf");

const { Plugin: QT } = load();
// required after load() so "obsidian" resolves to the stand-in
const { ApiClient } = require("../../src/api-client");

function requestUrl(opts) {
  return new Promise((resolve) => {
    const url = new URL(opts.url);
    const lib = url.protocol === "https:" ? https : http;
    const headers = { ...(opts.headers || {}) };
    if (opts.contentType) headers["content-type"] = opts.contentType;
    const body = opts.body ? Buffer.from(String(opts.body)) : null;
    if (body) headers["content-length"] = String(body.length);
    const req = lib.request({ hostname: url.hostname, port: url.port, path: url.pathname + url.search, method: opts.method || "GET", headers }, (res) => {
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

async function main() {
  obsidian.requestImpl = requestUrl;
  const state = makeTrackedApp([]);
  const plugin = new QT(state.app);
  await plugin.onload();
  plugin.settings.ai.api.provider = "google";
  plugin.settings.ai.api.baseUrl = "";
  plugin.settings.ai.api.keys = Object.assign({}, plugin.settings.ai.api.keys, { google: "DUMMY-NOT-A-KEY" });
  plugin.settings.ai.api.model = "gemini-3.8-flash";
  const client = new ApiClient(plugin.settings.ai, state.app, {});
  const cases = [
    ["chat/completions with a bad key", () => client.chat("You are a test.", [{ role: "user", content: "hi" }])],
    ["models with a bad key", () => client.listModels()],
  ];
  for (const [label, run] of cases) {
    try {
      const out = await run();
      console.log(`${label}: unexpectedly succeeded: ${JSON.stringify(out).slice(0, 160)}`);
    } catch (error) {
      console.log(`${label} -> aiConfig=${error.aiConfig === true} code=${error.code || "-"} message: ${error.message.slice(0, 220)}`);
    }
  }
}

main().catch((error) => {
  console.error("failed:", error && error.stack ? error.stack : error);
  process.exit(1);
});
