"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();
const stream = T.chatStream;

function bytes(parts) {
  return (async function* () {
    for (const part of parts) yield typeof part === "string" ? new TextEncoder().encode(part) : part;
  })();
}

function sseResponse(frames) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => "text/event-stream; charset=utf-8" },
    body: {
      getReader() {
        let index = 0;
        return {
          read: async () => (index < frames.length ? { done: false, value: new TextEncoder().encode(frames[index++]) } : { done: true }),
          releaseLock() {},
        };
      },
    },
  };
}

function jsonResponse(data) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => "application/json" },
    json: async () => data,
  };
}

async function withFetch(impl, fn) {
  const original = global.fetch;
  global.fetch = impl;
  try {
    return await fn();
  } finally {
    global.fetch = original;
  }
}

test("stream parser: OpenAI deltas survive frames split across chunks", async () => {
  const first = 'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n';
  const chunks = [
    first.slice(0, 12),
    first.slice(12),
    'data: {"choices":[{"delta":{"content":"lo "}}]}\n\ndata: {"choices":[{"delta":{"content":"there"}}]}\n\n',
    "data: [DONE]\n\n",
  ];
  const seen = [];
  const text = await stream.readStream(bytes(chunks), { kind: "openai", onDelta: (d) => seen.push(d) });
  assert.equal(text, "Hello there");
  assert.deepEqual(seen, ["Hel", "lo ", "there"]);
});

test("stream parser: Anthropic content blocks, malformed events and full JSON text", async () => {
  const frames = [
    'data: {"type":"message_start"}\n\n',
    "data: not-json\n\n",
    'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}\n\n',
    'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"!"}}\n\n',
  ];
  assert.equal(await stream.readStream(bytes(frames), { kind: "anthropic" }), "Hi!");
  assert.equal(stream.extractDelta({ type: "message_stop" }, "anthropic"), "");
  assert.equal(stream.fullText({ content: [{ type: "text", text: "Whole" }, { type: "tool_use" }] }, "anthropic"), "Whole");
});

test("stream parser: abort keeps what already arrived", async () => {
  const controller = new AbortController();
  const seen = [];
  const text = await stream.readStream(
    bytes([
      'data: {"choices":[{"delta":{"content":"one"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"two"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"three"}}]}\n\n',
    ]),
    {
      kind: "openai",
      signal: controller.signal,
      onDelta: (delta) => {
        seen.push(delta);
        if (delta === "one") controller.abort();
      },
    }
  );
  assert.equal(text, "one");
  assert.deepEqual(seen, ["one"]);
});

function directClient() {
  return new T.ApiClient(
    {
      api: {
        provider: "custom",
        baseUrl: "https://api.example.com/v1",
        model: "test-model",
        keys: { custom: "sk-test" },
      },
    },
    {},
    {}
  );
}

test("Direct API: SSE deltas stream through fetch and the full text is returned", async () => {
  let request = null;
  await withFetch(
    async (url, init) => {
      request = { url, init };
      return sseResponse([
        'data: {"choices":[{"delta":{"content":"Streamed"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" answer"}}]}\n\n',
        "data: [DONE]\n\n",
      ]);
    },
    async () => {
      const seen = [];
      const text = await directClient().streamChat("SYS", [{ role: "user", content: "Q" }], { onDelta: (d) => seen.push(d) });
      assert.equal(text, "Streamed answer");
      assert.deepEqual(seen, ["Streamed", " answer"]);
    }
  );
  assert.match(request.url, /\/chat\/completions$/);
  assert.equal(request.init.method, "POST");
  assert.equal(JSON.parse(request.init.body).stream, true);
  assert.match(request.init.headers.accept, /text\/event-stream/);
  assert.equal(request.init.headers.Authorization, "Bearer sk-test");
});

test("Direct API: a provider that ignores streaming still returns its complete JSON reply", async () => {
  const seen = [];
  await withFetch(
    async () => jsonResponse({ choices: [{ message: { content: "Whole reply" } }] }),
    async () => {
      const text = await directClient().streamChat("SYS", [{ role: "user", content: "Q" }], { onDelta: (d) => seen.push(d) });
      assert.equal(text, "Whole reply");
      assert.deepEqual(seen, ["Whole reply"]);
    }
  );
});

test("Direct API: with no fetch the old non-streaming request path is used", async () => {
  const original = global.fetch;
  global.fetch = undefined;
  try {
    const client = directClient();
    client.chat = async () => "Old path reply";
    const text = await client.streamChat("SYS", [{ role: "user", content: "Q" }], { onDelta() {} });
    assert.equal(text, "Old path reply");
  } finally {
    global.fetch = original;
  }
});

test("Direct API: HTTP errors surface without a fallback request", async () => {
  let calls = 0;
  const seen = [];
  await withFetch(
    async () => {
      calls += 1;
      return { ok: false, status: 401, headers: { get: () => "application/json" }, json: async () => ({ error: { message: "bad key" } }) };
    },
    async () => {
      await assert.rejects(
        directClient().streamChat("SYS", [{ role: "user", content: "Q" }], { onDelta: (d) => seen.push(d) }),
        /HTTP 401/
      );
    }
  );
  assert.equal(calls, 1);
  assert.deepEqual(seen, []);
});

test("OpenCode: text deltas come from the session event stream", async () => {
  const oc = Object.create(T.OpenCodeClient.prototype);
  oc.base = () => "http://127.0.0.1:4096";
  oc.headers = () => ({});
  let sent = null;
  oc.send = async (id, body) => {
    sent = { id, body };
    return { info: { role: "assistant" } };
  };
  const seen = [];
  const response = {
    ok: true,
    status: 200,
    headers: { get: () => "text/event-stream" },
    body: {
      getReader() {
        const frames = [
          'data: {"properties":{"sessionID":"sid-1","delta":"Hel","part":{"type":"text"}}}\n\n',
          'data: {"properties":{"sessionID":"other","delta":"Nope"}}\n\n',
          'data: {"properties":{"sessionID":"sid-1","delta":"lo","part":{"type":"text"}}}\n\n',
          'data: {"properties":{"sessionID":"sid-1","delta":"ignored","part":{"type":"text","ignored":true}}}\n\n',
        ];
        let index = 0;
        return {
          read: async () => (index < frames.length ? { done: false, value: new TextEncoder().encode(frames[index++]) } : { done: true }),
          releaseLock() {},
        };
      },
    },
  };
  await withFetch(
    async (url) => {
      assert.match(url, /\/event$/);
      return response;
    },
    async () => {
      const text = await oc.stream("sid-1", { parts: [{ type: "text", text: "Q" }] }, { onDelta: (d) => seen.push(d) });
      assert.equal(text, "Hello");
    }
  );
  assert.deepEqual(seen, ["Hel", "lo"]);
  assert.equal(sent.id, "sid-1");
});

test("OpenCode: a server without an event stream still sends and returns no deltas", async () => {
  const oc = Object.create(T.OpenCodeClient.prototype);
  oc.base = () => "http://127.0.0.1:4096";
  oc.headers = () => ({});
  let sent = 0;
  oc.send = async () => {
    sent += 1;
  };
  const seen = [];
  await withFetch(
    async () => ({ ok: false, status: 404 }),
    async () => {
      const text = await oc.stream("sid-1", {}, { onDelta: (d) => seen.push(d) });
      assert.equal(text, "");
    }
  );
  assert.equal(sent, 1);
  assert.deepEqual(seen, []);
});
