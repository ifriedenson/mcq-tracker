"use strict";
/*
 * Server-sent event reader for chat streaming.
 *
 * Both the Direct API providers and the local OpenCode server speak SSE. This
 * module only turns bytes into text deltas, so the panel, the tests and both
 * clients share one parser. It never throws on a malformed event: a provider
 * that returns ordinary JSON instead of a stream is handled by the caller as a
 * complete reply, so streaming can always degrade to the old path.
 */
const { str } = require("./util");

/** The text delta in one parsed SSE payload, or "" for other events. */
function extractDelta(payload, kind) {
  if (!payload || typeof payload !== "object") return "";
  if (kind === "anthropic") {
    const delta = payload.type === "content_block_delta" ? payload.delta : null;
    return delta && typeof delta.text === "string" ? delta.text : "";
  }
  const choice = Array.isArray(payload.choices) ? payload.choices[0] : null;
  const content = choice && choice.delta ? choice.delta.content : "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((part) => (part && typeof part.text === "string" ? part.text : "")).join("");
  return "";
}

/** The whole reply from a non-streaming JSON body, for providers that ignore `stream`. */
function fullText(payload, kind) {
  if (!payload || typeof payload !== "object") return "";
  if (kind === "anthropic") {
    return ((payload.content || []).filter((part) => part && part.type === "text").map((part) => str(part.text))).join("\n");
  }
  const content = payload.choices && payload.choices[0] && payload.choices[0].message ? payload.choices[0].message.content : "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((part) => (part && typeof part.text === "string" ? part.text : "")).join("");
  return "";
}

/** Yield the `data:` payloads of an SSE byte/string iterable. */
async function* sseData(chunks) {
  let buffer = "";
  const decoder = typeof TextDecoder === "function" ? new TextDecoder() : null;
  for await (const chunk of chunks) {
    buffer += typeof chunk === "string" ? chunk : decoder ? decoder.decode(chunk, { stream: true }) : String(chunk);
    let at = buffer.indexOf("\n\n");
    while (at >= 0) {
      const block = buffer.slice(0, at);
      buffer = buffer.slice(at + 2);
      const data = block
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("\n");
      if (data && data !== "[DONE]") yield data;
      at = buffer.indexOf("\n\n");
    }
  }
  const rest = buffer.trim();
  if (rest.startsWith("data:")) {
    const data = rest.slice(5).trim();
    if (data && data !== "[DONE]") yield data;
  }
}

/** Read deltas from an async iterable of chunks and return the complete text. */
async function readStream(chunks, options) {
  const opts = options || {};
  let text = "";
  for await (const data of sseData(chunks)) {
    if (opts.signal && opts.signal.aborted) break;
    let payload = null;
    try {
      payload = JSON.parse(data);
    } catch (error) {
      continue;
    }
    if (payload && payload.error) throw new Error(str(payload.error.message || payload.error));
    const delta = extractDelta(payload, opts.kind);
    if (!delta) continue;
    text += delta;
    if (typeof opts.onDelta === "function") opts.onDelta(delta);
  }
  return text;
}

/** Turn a fetch Response body into an async iterable of chunks. */
function chunksFromStream(body) {
  return (async function* () {
    const reader = body.getReader();
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        if (next.value) yield next.value;
      }
    } finally {
      try {
        reader.releaseLock();
      } catch (error) {
        /* the stream may already be closed */
      }
    }
  })();
}

module.exports = { chunksFromStream, extractDelta, fullText, readStream, sseData };
