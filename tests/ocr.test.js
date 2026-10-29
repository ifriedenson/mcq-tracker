"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T, obsidian } = load();
const ocr = T.ocr;

test("OCR: prompt identifies the page and asks for a transcription only", () => {
  assert.match(ocr.ocrPrompt(3), /page 3/i);
  assert.match(ocr.OCR_SYSTEM, /Return only the text/);
  assert.match(ocr.OCR_SYSTEM, /do not summarize/i);
});

test("OCR: fences and a short preface are removed from the model reply", () => {
  assert.equal(ocr.cleanOcrText("```text\nCell division\nMitosis\n```"), "Cell division\nMitosis");
  assert.equal(ocr.cleanOcrText("Here is the transcription:\n\nLine one\nLine two"), "Line one\nLine two");
});

test("OCR: the saved note records source, model, date and every page", () => {
  const note = ocr.buildOcrNote(
    [
      { n: 1, text: "Cell division" },
      { n: 2, text: "Mitosis and meiosis" },
    ],
    { title: "Biology scan", sourcePath: "Paper scans/page 1.pdf", model: "vision-model", date: "2026-10-29" }
  );
  assert.match(note.text, /^---\nocr: true\n/);
  assert.match(note.text, /ocr_source_kind: ai-vision/);
  assert.match(note.text, /ocr_source: "\[\[Paper scans\/page 1\.pdf\]\]"/);
  assert.match(note.text, /source_pdf: "\[\[Paper scans\/page 1\.pdf\]\]"/);
  assert.match(note.text, /ocr_model: "vision-model"/);
  assert.match(note.text, /## Page 1\n\nCell division/);
  assert.match(note.text, /## Page 2\n\nMitosis and meiosis/);
  assert.match(note.text, /Check it against the page/);
  assert.throws(() => ocr.buildOcrNote([], {}), /no OCR text/i);
});

test("OCR: OpenAI vision sends a data URL image and returns the text", async () => {
  let request;
  obsidian.requestImpl = async (req) => {
    request = req;
    return { status: 200, json: { choices: [{ message: { content: "page text" } }] } };
  };
  try {
    const client = new T.ApiClient({
      api: { provider: "openai", baseUrl: "https://example.test/v1", model: "vision-model", keys: { openai: "secret" } },
    });
    const text = await client.vision("system", "Transcribe page 1", [{ data: "YWJj", mime: "image/png" }], { maxTokens: 99 });
    assert.equal(text, "page text");
    assert.equal(request.url, "https://example.test/v1/chat/completions");
    assert.equal(request.headers.Authorization, "Bearer secret");
    const body = JSON.parse(request.body);
    assert.equal(body.model, "vision-model");
    assert.equal(body.messages[1].content[1].type, "image_url");
    assert.equal(body.messages[1].content[1].image_url.url, "data:image/png;base64,YWJj");
  } finally {
    obsidian.requestImpl = null;
  }
});

test("OCR: Anthropic vision uses a base64 image source", async () => {
  let request;
  obsidian.requestImpl = async (req) => {
    request = req;
    return { status: 200, json: { content: [{ type: "text", text: "anthropic page" }] } };
  };
  try {
    const client = new T.ApiClient({
      api: { provider: "anthropic", baseUrl: "https://anthropic.test", model: "claude-vision", keys: { anthropic: "secret" } },
    });
    const text = await client.vision("system", "Transcribe page 2", [{ data: "YWJj", mime: "image/jpeg" }], { maxTokens: 88 });
    assert.equal(text, "anthropic page");
    assert.equal(request.url, "https://anthropic.test/v1/messages");
    assert.equal(request.headers["x-api-key"], "secret");
    const body = JSON.parse(request.body);
    assert.equal(body.max_tokens, 88);
    assert.equal(body.messages[0].content[1].type, "image");
    assert.deepEqual(body.messages[0].content[1].source, { type: "base64", media_type: "image/jpeg", data: "YWJj" });
  } finally {
    obsidian.requestImpl = null;
  }
});
