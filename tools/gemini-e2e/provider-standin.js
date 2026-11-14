"use strict";
/*
 * An OpenAI-compatible model server that answers instantly, used as the model
 * behind a real `opencode serve` process so the OpenCode check path can be
 * timed without any model latency in the measurement.
 *
 *   node tools/gemini-e2e/provider-standin.js 4601
 */
const http = require("node:http");

const port = Number(process.argv[2]) || 4601;
const log = [];

const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    const at = Date.now();
    let payload = null;
    try {
      payload = JSON.parse(body);
    } catch (e) {
      payload = null;
    }
    log.push({ at, path: req.url, model: payload && payload.model });
    console.log(`${new Date(at).toISOString()} ${req.method} ${req.url} model=${(payload && payload.model) || "-"}`);
    if (req.method === "GET" && /\/models$/.test(req.url)) {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ object: "list", data: [{ id: "gpt-4o-mini", object: "model" }] }));
    }
    const text = "Answer: B\nConfidence: high";
    const base = { id: "chatcmpl-standin", created: Math.floor(Date.now() / 1000), model: (payload && payload.model) || "gpt-4o-mini" };
    if (payload && payload.stream) {
      // the AI SDK asks for SSE; a plain JSON body makes it retry forever
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
      const chunk = (delta, finish) =>
        `data: ${JSON.stringify({ ...base, object: "chat.completion.chunk", choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`;
      res.write(chunk({ role: "assistant", content: "" }, null));
      res.write(chunk({ content: text }, null));
      res.write(chunk({}, "stop"));
      res.write(`data: ${JSON.stringify({ ...base, object: "chat.completion.chunk", choices: [], usage: { prompt_tokens: 120, completion_tokens: 5, total_tokens: 125 } })}\n\n`);
      return res.end("data: [DONE]\n\n");
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ...base, object: "chat.completion", choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }], usage: { prompt_tokens: 120, completion_tokens: 5, total_tokens: 125 } }));
  });
});

server.listen(port, "127.0.0.1", () => console.log(`provider stand-in on http://127.0.0.1:${port}/v1`));
