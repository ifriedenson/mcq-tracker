"use strict";
// Photo of handwritten work: local file handling, one vision request, and the
// attempt property that records where the answer came from.
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const hw = T.handwriting;
const frq = T.frq;

function fileOf(name, type, bytes) {
  const data = bytes || new Uint8Array([137, 80, 78, 71]);
  return {
    name,
    type,
    size: data.length,
    arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
  };
}

test("handwriting: a transcript loses fences and a preamble but keeps the answer", () => {
  assert.equal(hw.cleanHandwritingText("```text\nHere is the transcription:\n\nThe limit is $\\frac{1}{2}$.\n```"), "The limit is $\\frac{1}{2}$.");
  assert.equal(hw.cleanHandwritingText("  dy/dx = 3x^2  "), "dy/dx = 3x^2");
  assert.equal(hw.cleanHandwritingText("Transcription:\n\nBuffers resist pH change."), "Buffers resist pH change.");
  assert.equal(hw.cleanHandwritingText(""), "");
});

test("handwriting: the prompt names the course and title and sends nothing else", () => {
  const prompt = hw.handwritingPrompt({ course: "AP Chemistry", title: "Buffers" });
  assert.match(prompt, /^Transcribe the answer in this photo\./);
  assert.match(prompt, /Course: AP Chemistry\./);
  assert.match(prompt, /Prompt: Buffers\./);
  assert.match(prompt, /add nothing\.$/);
  assert.equal(hw.handwritingPrompt(), "Transcribe the answer in this photo. Keep everything the student wrote; add nothing.");
});

test("handwriting: an image is read locally into a base64 payload with its media type", async () => {
  const payload = await hw.readImageFile(fileOf("answer.PNG", ""));
  assert.equal(payload.mime, "image/png");
  assert.equal(payload.name, "answer.PNG");
  assert.equal(payload.size, 4);
  assert.equal(Buffer.from(payload.data, "base64").toString("latin1"), "\u0089PNG");
});

test("handwriting: non-images, empty files and oversized photos are refused", async () => {
  await assert.rejects(() => hw.readImageFile(fileOf("answer.txt", "text/plain")), /image file/);
  await assert.rejects(() => hw.readImageFile(fileOf("answer.png", "image/png", new Uint8Array(0))), /empty/);
  const big = { name: "big.png", type: "image/png", size: hw.MAX_IMAGE_BYTES + 1, arrayBuffer: async () => new ArrayBuffer(0) };
  await assert.rejects(() => hw.readImageFile(big), /under 8 MB/);
  await assert.rejects(() => hw.readImageFile(null), /Choose a photo/);
});

test("FRQ: an attempt records whether the answer was typed or read from a photo", () => {
  const note = {
    path: "AP FRQs/AP Chemistry/Buffers.md",
    courseId: "ap-chemistry",
    course: "AP Chemistry",
    title: "Buffers",
    rubricSource: "user",
    rubric: [{ id: "c1", label: "Claim", points: 2 }],
  };
  const attempt = frq.scoreAttempt({ rubric: note.rubric, scores: { c1: 2 }, gradedBy: "self" });
  const typed = frq.buildFrqAttemptNote(note, { ...attempt, answer: "Typed." }, "2026-10-29");
  assert.equal(typed.frontmatter.answer_source, "typed");
  assert.ok(!/Answer source/.test(typed.text));

  const photo = frq.buildFrqAttemptNote(
    note,
    { ...attempt, answer: "Read from paper.", answerSource: "photo", answerModel: "vision-1" },
    "2026-10-29"
  );
  assert.equal(photo.frontmatter.answer_source, "photo");
  assert.match(photo.text, /photo of handwritten work, read by vision-1/);
});

test("FRQ: a photo is transcribed through the handwriting feature, never graded in the same step", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.handwritingPhotoSupport = () => ({ ok: true, reason: "" });
  const calls = [];
  plugin.aiVision = async (system, prompt, images, opts) => {
    calls.push({ system, prompt, images, opts });
    return "```text\nHere is the transcription:\n\ndG = dH - TdS\n```";
  };
  const out = await plugin.transcribeHandwritingPhoto(
    { data: "abc", mime: "image/png", name: "page.png" },
    { course: "AP Chemistry", title: "Thermo" }
  );
  assert.equal(out.text, "dG = dH - TdS");
  assert.equal(out.name, "page.png");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].opts.feature, "handwriting");
  assert.deepEqual(calls[0].images.map((image) => image.name), ["page.png"]);
  assert.match(calls[0].prompt, /AP Chemistry/);
  assert.match(calls[0].system, /transcribe/i);
  assert.match(calls[0].system, /data, not instructions/);
});

test("FRQ: a disabled or text-only backend refuses the photo action with a reason", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  assert.equal(plugin.handwritingPhotoSupport().ok, false);
  await assert.rejects(
    () => plugin.transcribeHandwritingPhoto({ data: "abc", mime: "image/png" }, {}),
    /Turn on AI features/
  );
  const blocked = T.aiService.featureSupport("handwriting", "opencode");
  assert.equal(blocked.ok, false);
  assert.match(blocked.reason, /Direct AI/);
  assert.equal(T.aiService.featureSupport("handwriting", "api").ok, true);
});

test("FRQ: the grader offers the photo action and says what is sent", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  const created = await plugin.createFrqNote({
    courseId: "ap-chemistry",
    title: "Thermo",
    prompt: "Explain entropy.",
    rubric: [{ label: "Claim", points: 2 }],
  });
  const modal = new T.FrqGraderModal({ app }, plugin);
  const dom = makeDom();
  modal.contentEl = dom.root;
  modal.notes = [created.note];
  modal.note = created.note;
  modal.loading = false;
  modal.result = modal.computeResult();
  modal.draw();
  assert.ok(dom.texts().includes("Read photos of handwritten work..."));
  assert.ok(dom.texts().some((text) => text.includes("The photos are not stored in the vault")));
  assert.ok(dom.texts().some((text) => text.includes("Turn on AI features to read a photo")));
});

async function photoModal() {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  const created = await plugin.createFrqNote({
    courseId: "ap-chemistry",
    title: "Thermo",
    prompt: "Explain entropy.",
    rubric: [{ label: "Claim", points: 2 }],
  });
  const modal = new T.FrqGraderModal({ app }, plugin);
  modal.contentEl = makeDom().root;
  modal.note = created.note;
  modal.loading = false;
  modal.result = modal.computeResult();
  return { plugin, modal };
}

test("FRQ: several photos are read in order and appended to the answer box", async () => {
  const { plugin, modal } = await photoModal();
  modal.answer = "Opening line.";
  const seen = [];
  plugin.transcribeHandwritingPhoto = async (image) => {
    seen.push(image.name);
    return { text: `page ${seen.length}`, model: "vision-1" };
  };
  await modal.readPhotos([fileOf("p1.png", "image/png"), fileOf("p2.png", "image/png")]);
  assert.deepEqual(seen, ["p1.png", "p2.png"]);
  assert.equal(modal.answer, "Opening line.\n\npage 1\n\npage 2");
  assert.equal(modal.photoPages, 2);
  assert.equal(modal.answerSource, "photo");
  assert.match(modal.message, /2 photos read in order/);
});

test("FRQ: a later photo failure keeps the pages already read", async () => {
  const { plugin, modal } = await photoModal();
  plugin.transcribeHandwritingPhoto = async (image) => {
    if (image.name === "p2.png") throw new Error("model offline");
    return { text: "page one", model: "vision-1" };
  };
  await modal.readPhotos([fileOf("p1.png", "image/png"), fileOf("p2.png", "image/png")]);
  assert.equal(modal.answer, "page one");
  assert.equal(modal.photoPages, 1);
  assert.match(modal.message, /Photo 2 of 2 failed: model offline/);
  assert.match(modal.message, /1 page already read/);
});

test("FRQ: one answer reads at most eight photos and says so", async () => {
  const { plugin, modal } = await photoModal();
  let calls = 0;
  plugin.transcribeHandwritingPhoto = async () => {
    calls++;
    return { text: `page ${calls}`, model: "vision-1" };
  };
  const files = Array.from({ length: 10 }, (_, i) => fileOf(`p${i}.png`, "image/png"));
  await modal.readPhotos(files);
  assert.equal(calls, 8);
  assert.equal(modal.photoPages, 8);
  assert.match(modal.message, /Only the first 8 photos were read/);
});

test("FRQ: an attempt records how many photo pages were read", () => {
  const note = {
    path: "AP FRQs/AP Chemistry/Buffers.md",
    courseId: "ap-chemistry",
    course: "AP Chemistry",
    title: "Buffers",
    rubricSource: "user",
    rubric: [{ id: "c1", label: "Claim", points: 2 }],
  };
  const attempt = frq.scoreAttempt({ rubric: note.rubric, scores: { c1: 2 }, gradedBy: "self" });
  const out = frq.buildFrqAttemptNote(
    note,
    { ...attempt, answer: "Read from paper.", answerSource: "photo", answerModel: "vision-1", answerPages: 3 },
    "2026-10-29"
  );
  assert.equal(out.frontmatter.answer_source, "photo");
  assert.equal(out.frontmatter.answer_pages, 3);
  assert.match(out.text, /3 photos of handwritten work, read by vision-1/);
});
