// OpenAI-compatible stand-in for the overnight e2e: answers note-writing with
// fixed notes and blind checks with "Answer: B". Fault knobs are armed through
// query params on /arm: ?fail429=N (next N completions get 429+Retry-After).
import http from "node:http";

const VERIFY_REPLY = "Answer: B\nConfidence: high";
let noteCounter = 0;
// One numbered note per write request, so bulk batches do not dedupe.
function noteReply() {
  noteCounter++;
  const n = noteCounter;
  return `---
number: ${n}
answer: B
---

## Question
What is ${n} + ${n}?

## Answer Choices
- A. ${n}
- B. ${2 * n}
- C. ${3 * n}
- D. ${4 * n}

## Answer
**Correct Answer: B**
`;
}

export function startStandIn(port) {
  const log = [];
  let fail429 = 0;
let fail429verify = 0;
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const url = new URL(req.url, "http://x");
      if (url.pathname === "/arm") {
        fail429 = Number(url.searchParams.get("fail429") || 0);
        fail429verify = Number(url.searchParams.get("fail429verify") || 0);
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(JSON.stringify({ armed: fail429 }));
      }
      let payload = null;
      try {
        payload = body ? JSON.parse(body) : null;
      } catch (e) {
        payload = null;
      }
      const entry = { method: req.method, path: req.url, model: payload && payload.model };
      log.push(entry);
      if (req.method === "GET" && /\/models$/.test(req.url)) {
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(JSON.stringify({ object: "list", data: [{ id: "gemini-3.8-flash", object: "model" }] }));
      }
      if (req.method === "POST" && /\/chat\/completions$/.test(req.url)) {
        const messages = (payload && payload.messages) || [];
        const system = String((messages[0] && messages[0].content) || "");
        const verifyKind = /independent exam answer checker/i.test(system);
        if (fail429 > 0 || (verifyKind && fail429verify > 0)) {
          if (verifyKind && fail429verify > 0 && fail429 <= 0) fail429verify--;
          else fail429--;
          entry.injected = 429;
          res.writeHead(429, { "content-type": "application/json", "retry-after": "1" });
          return res.end(JSON.stringify({ error: { code: 429, message: "rate limit, please retry", status: "RESOURCE_EXHAUSTED" } }));
        }
        entry.kind = verifyKind ? "verify" : "note";
        const text = entry.kind === "verify" ? VERIFY_REPLY : noteReply();
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(
          JSON.stringify({
            id: "chatcmpl-e2e",
            object: "chat.completion",
            model: (payload && payload.model) || "gemini-3.8-flash",
            choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
            usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
          })
        );
      }
      res.writeHead(404, { "content-type": "application/json" });
      return res.end(JSON.stringify({ error: { message: "not found" } }));
    });
  });
  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => resolve({ server, log }));
  });
}
