"use strict";
/*
 * The remaining unreadable-file surfaces for the file-first importer. Every
 * case opens the real PdfImportModal and drives its normal preflight/start
 * path; only the vault and the PDF reader are stand-ins.
 */
const fs = require("fs");
const path = require("path");
const zlib = require("node:zlib");
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");
const { makeDom } = require("./helpers/fake");
const { makePdfRuntime, makeTrackedApp, textPdf } = require("./helpers/real-pdf");

const ENCRYPTED_PDF = fs.readFileSync(path.join(__dirname, "fixtures", "encrypted-password.pdf"));
const ENCRYPTED_PASSWORD = "secret";
// A second encrypted fixture with a different password. The extra PDF comment
// keeps the bytes distinct without changing the real encrypted payload.
const ENCRYPTED_PDF_B = Buffer.concat([ENCRYPTED_PDF, Buffer.from("\n% second password fixture\n")]);
const ENCRYPTED_PASSWORD_B = "second-secret";
const ENCRYPTED_PASSWORDS = new Map([
  [Buffer.from(ENCRYPTED_PDF).toString("base64"), ENCRYPTED_PASSWORD],
  [Buffer.from(ENCRYPTED_PDF_B).toString("base64"), ENCRYPTED_PASSWORD_B],
]);
const PASSWORD_TRIES = [];
const SINGLE_NOTE_REPLY = `---\nnumber: 1\nanswer: B\nanswer_source: pdf\n---\n\n## Question\nWhat is 2 + 2?\n\n## Answer Choices\n- A. 3\n- B. 4\n\n## Answer\n**Correct Answer: B**\n`;

function passwordException(code) {
  const error = new Error(code === 2 ? "Incorrect Password" : "No password given");
  error.name = "PasswordException";
  error.code = code;
  return error;
}

const baseRuntime = makePdfRuntime();
const decryptedBytes = new Map();
const runtime = {
  get opened() {
    return baseRuntime.opened;
  },
  failOn(n) {
    return baseRuntime.failOn(n);
  },
  getDocument(payload) {
    const data = payload && payload.data;
    const key = data instanceof Uint8Array ? Buffer.from(data).toString("base64") : "";
    const expected = ENCRYPTED_PASSWORDS.get(key);
    if (!expected) return baseRuntime.getDocument(payload);
    const password = String((payload && payload.password) || "");
    PASSWORD_TRIES.push(password);
    if (!password) return { promise: Promise.reject(passwordException(1)) };
    if (password !== expected) return { promise: Promise.reject(passwordException(2)) };
    if (!decryptedBytes.has(expected)) decryptedBytes.set(expected, textPdf());
    return { promise: decryptedBytes.get(expected).then((bytes) => baseRuntime.getDocument({ data: bytes }).promise) };
  },
};
obsidian.loadPdfJs = async () => runtime;

const { T, Plugin: QT } = load();
global.createEl = (tag, opts) => makeDom().root.createEl(tag, opts);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const WRITE_OPS = new Set(["create", "createBinary", "mkdir", "write", "remove", "rmdir", "create-failed", "createBinary-failed"]);

function enableAi(plugin) {
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "api";
  plugin.settings.ai.api.provider = "anthropic";
  plugin.settings.ai.api.keys.anthropic = "sk-test";
  plugin.settings.ai.api.model = "claude-sonnet-4-5";
}

async function setup(notes) {
  const state = makeTrackedApp(notes || []);
  const plugin = new QT(state.app);
  await plugin.onload();
  enableAi(plugin);
  plugin.settings.importOptions = { capture: false, pagePics: false };
  plugin.settings.importDefaults = {};
  plugin.settings.importFolder = "";
  plugin.settings.questionFolder = "Questions";
  plugin.verifyDraftQuestions = async () => {};
  state.plugin = plugin;
  obsidian.modals.length = 0;
  obsidian.notices.length = 0;
  obsidian.noticeObjects.length = 0;
  return state;
}

function file(name, bytes) {
  return {
    name,
    async arrayBuffer() {
      return bytes;
    },
  };
}

function attach(modal) {
  const dom = makeDom();
  modal.contentEl = dom.root;
  modal.modalEl = dom.root;
  return dom;
}

function writes(state) {
  return state.ops.filter((entry) => WRITE_OPS.has(entry[0]));
}

function completionModal(modal) {
  return obsidian.modals.find((entry) => entry !== modal && entry.onOpen && entry.render);
}

/** A valid ZIP layout with one deflated Word part, then one corrupted byte in that part. */
function corruptCompressedDocx() {
  const name = Buffer.from("word/document.xml");
  const raw = Buffer.from("<w:document><w:body><w:p><w:r><w:t>Question 1</w:t></w:r></w:p></w:body></w:document>");
  const compressed = Buffer.from(zlib.deflateRawSync(raw));
  compressed[0] ^= 0xff;
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(raw.length, 22);
  local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(raw.length, 24);
  central.writeUInt16LE(name.length, 28);
  const centralOffset = local.length + name.length + compressed.length;
  central.writeUInt32LE(0, 42);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(central.length + name.length, 12);
  eocd.writeUInt32LE(centralOffset, 16);
  return Buffer.concat([local, name, compressed, central, name, eocd]);
}

async function waitFor(check, label) {
  const end = Date.now() + 8000;
  while (Date.now() < end) {
    if (check()) return;
    await sleep(10);
  }
  throw new Error(`timed out waiting for ${label}`);
}

async function withTimeout(promise, ms, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timed out waiting for ${label}`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function rejectImport(name, bytes) {
  const state = await setup([]);
  const modal = new T.PdfImportModal(state.app, state.plugin, { file: file(name, bytes) });
  const dom = attach(modal);
  modal.folder = "Questions/Rejected";
  modal.onOpen();
  await withTimeout(modal.runPreflight(), 3000, "preflight");
  const message = dom.texts().join("\n");
  await withTimeout(modal.start(), 3000, "start of an unreadable file");
  return { state, modal, dom, message, messageAfterStart: dom.texts().join("\n") };
}

test("import edge: a password-protected PDF asks for its password, retries a wrong one, and imports", async () => {
  const state = await setup([]);
  state.plugin.aiChat = async () =>
    `---\nnumber: 1\nanswer: B\nanswer_source: pdf\n---\n\n## Question\nWhat is 2 + 2?\n\n## Answer Choices\n- A. 3\n- B. 4\n\n## Answer\n**Correct Answer: B**\n`;
  const modal = new T.PdfImportModal(state.app, state.plugin, { file: file("Protected.pdf", ENCRYPTED_PDF) });
  const dom = attach(modal);
  modal.folder = "Questions/Protected";
  modal.showPreflight();

  const checked = dom.click("Check this file");
  await waitFor(() => dom.field("PDF password"), "the password prompt");
  assert.match(dom.texts().join("\n"), /password-protected/i);
  let field = dom.field("PDF password");
  field.value = "wrong";
  await dom.clickLast("Unlock PDF");
  await waitFor(() => dom.texts().some((text) => /didn't work/i.test(text)), "the wrong-password retry");
  field = dom.field("PDF password");
  field.value = ENCRYPTED_PASSWORD;
  await dom.clickLast("Unlock PDF");
  await checked;

  assert.ok(dom.texts().includes("This file is readable"), "the correct password reaches preflight");
  assert.deepEqual(writes(state), [], "preflight still writes nothing");
  assert.equal(state.files.size, 0);

  const triesBeforeHandoff = PASSWORD_TRIES.length;
  modal.beginAiSetup();
  const help = obsidian.modals.find((entry) => entry instanceof T.AiImportHelpModal);
  assert.ok(help, "the real AI setup step opens after the password check");
  help.options.onReady();
  const reopened = obsidian.modals[obsidian.modals.length - 1];
  assert.ok(reopened instanceof T.PdfImportModal, "the importer reopens after AI setup");
  const reopenedDom = attach(reopened);
  reopened.onOpen();
  await withTimeout(reopened.start(), 3000, "the reopened import");

  assert.equal(PASSWORD_TRIES.length, triesBeforeHandoff + 1, "the reopened import reads the PDF once");
  assert.equal(PASSWORD_TRIES[PASSWORD_TRIES.length - 1], ENCRYPTED_PASSWORD, "the handoff reuses the in-memory password");
  assert.ok(!reopenedDom.texts().includes("This PDF needs a password"), "the reopened import does not ask again");
  assert.ok(reopenedDom.texts().includes("Found 1 question"), "start reads the PDF with the saved password and reaches review");
  assert.ok(state.files.has("Questions/Protected/Protected.pdf"), "the source copy is made only after the password works");
  assert.ok(PASSWORD_TRIES.includes(ENCRYPTED_PASSWORD), "the password is passed to the PDF reader");
  assert.ok(PASSWORD_TRIES.includes("wrong"), "a wrong password is retried once");

  await reopenedDom.clickLast("Create 1 note");
  const note = [...state.files.keys()].find((path) => /Protected-Q01\.md$/i.test(path));
  assert.ok(note, "the reviewed note is written: " + [...state.files.keys()].join(", "));
  assert.ok(state.files.has("Questions/Protected/Protected.pdf"), "the source copy is kept with the imported note");
});

test("import edge: cancelling the password prompt leaves the vault untouched", async () => {
  const state = await setup([]);
  const modal = new T.PdfImportModal(state.app, state.plugin, { file: file("Cancelled.pdf", ENCRYPTED_PDF) });
  const dom = attach(modal);
  modal.showPreflight();
  const checked = dom.click("Check this file");
  await waitFor(() => dom.field("PDF password"), "the password prompt");
  await dom.clickLast("Cancel");
  await checked;

  assert.match(dom.texts().join("\n"), /No password was entered/i);
  assert.deepEqual(writes(state), [], "cancelling creates no folder, source copy or note");
  assert.equal(state.files.size, 0);
});

test("import edge: starting an encrypted import directly asks for the password before copying it", async () => {
  const state = await setup([]);
  state.plugin.aiChat = async () =>
    `---\nnumber: 1\nanswer: B\nanswer_source: pdf\n---\n\n## Question\nWhat is 2 + 2?\n\n## Answer Choices\n- A. 3\n- B. 4\n\n## Answer\n**Correct Answer: B**\n`;
  const modal = new T.PdfImportModal(state.app, state.plugin, { file: file("Direct.pdf", ENCRYPTED_PDF) });
  const dom = attach(modal);
  modal.folder = "Questions/Direct";
  const run = modal.start();
  await waitFor(() => dom.field("PDF password"), "the direct-start password prompt");

  let field = dom.field("PDF password");
  field.value = "wrong";
  await dom.clickLast("Unlock PDF");
  await waitFor(() => dom.texts().some((text) => /didn't work/i.test(text)), "the direct-start wrong-password retry");
  field = dom.field("PDF password");
  field.value = ENCRYPTED_PASSWORD;
  await dom.clickLast("Unlock PDF");
  await withTimeout(run, 3000, "the direct encrypted import");

  assert.ok(dom.texts().includes("Found 1 question"), "the direct import reaches review after the password");
  assert.ok(state.files.has("Questions/Direct/Direct.pdf"), "the source copy is made only after the password works");
  assert.equal(PASSWORD_TRIES[PASSWORD_TRIES.length - 1], ENCRYPTED_PASSWORD);
});

test("import edge: a zero-byte PDF is refused as empty rather than reported as a damaged/password PDF", async () => {
  const { state, message, messageAfterStart } = await rejectImport("Empty.pdf", Buffer.alloc(0));
  assert.match(message, /empty/i);
  assert.match(message, /choose a pdf|paste|try another|selectable text/i);
  assert.match(messageAfterStart, /empty/i);
  assert.deepEqual(writes(state), [], "no source copy or folder is created");
  assert.equal(state.files.size, 0);
});

test("import edge: a zero-byte text file is refused before any write with a usable next step", async () => {
  const { state, message, messageAfterStart } = await rejectImport("Empty.txt", Buffer.alloc(0));
  assert.match(message, /no readable text/i);
  assert.match(message, /selectable text|paste questions|try a file/i);
  assert.match(messageAfterStart, /no readable text/i);
  assert.deepEqual(writes(state), [], "no source copy or folder is created");
  assert.equal(state.files.size, 0);
});

test("import edge: a zero-byte Word file is refused as damaged with a usable next step", async () => {
  const { state, message, messageAfterStart } = await rejectImport("Empty.docx", Buffer.alloc(0));
  assert.match(message, /valid office|damaged|zip directory/i);
  assert.match(message, /open it in its original app|save a new copy|export.*pdf|repair/i);
  assert.match(messageAfterStart, /valid office|damaged|zip directory/i);
  assert.deepEqual(writes(state), [], "no source copy or folder is created");
  assert.equal(state.files.size, 0);
});

test("import edge: a truncated Word file is refused as damaged with a usable next step", async () => {
  const truncated = Buffer.from("PK\\x03\\x04word/document.xml-this-is-not-a-complete-zip", "binary");
  const { state, message, messageAfterStart } = await rejectImport("Broken.docx", truncated);
  assert.match(message, /damaged|couldn't|invalid|not a valid office file/i);
  assert.match(message, /open it in its original app|save a new copy|export.*pdf|repair/i);
  assert.match(messageAfterStart, /damaged|couldn't|invalid|not a valid office file/i);
  assert.deepEqual(writes(state), [], "no source copy or folder is created");
  assert.equal(state.files.size, 0);
});

test("import edge: a corrupt compressed Word part is refused as damaged with a usable next step", async () => {
  const { state, message, messageAfterStart } = await rejectImport("Broken compressed.docx", corruptCompressedDocx());
  assert.match(message, /damaged|couldn't|invalid|not a valid office file/i);
  assert.match(message, /open it in its original app|save a new copy|export.*pdf|repair/i);
  assert.match(messageAfterStart, /damaged|couldn't|invalid|not a valid office file/i);
  assert.deepEqual(writes(state), [], "no source copy or folder is created");
  assert.equal(state.files.size, 0);
});

test("import edge: same-name files get separate folders, a copied source gets a free name, and an existing note is never overwritten", async () => {
  const existingSource = "Questions/Unit 1/Unit 1.pdf";
  const existingNote = "Questions/Unit 1/Unit 1-Q01.md";
  const state = await setup([
    { path: existingSource, text: "original source bytes" },
    {
      path: existingNote,
      fm: { question_id: "Unit 1-Q01" },
      text: "---\nquestion_id: Unit 1-Q01\n---\n\n## Question\nOriginal question\n\n## Answer Choices\n- A. yes\n- B. no\n\n## Answer\n**Correct Answer: A**\n",
    },
  ]);
  state.dirs.add("Questions");
  state.dirs.add("Questions/Unit 1");
  state.plugin.settings.ai.backend = "opencode";
  state.plugin.settings.ai.managed = false;
  state.plugin.ensureOpenCode = async () => {};
  state.plugin.askConfirm = async () => true;
  let confirmations = 0;
  const originalAsk = state.plugin.askConfirm;
  state.plugin.askConfirm = async (...args) => {
    confirmations++;
    return originalAsk(...args);
  };
  let sessions = 0;
  const promptFolders = [];
  state.plugin.openCode = () => ({
    providers: async () => ({ providers: [{}] }),
    createSession: async () => ({ id: "edge-" + ++sessions }),
    promptAsync: async (id, body) => {
      const n = Number(String(id).replace("edge-", ""));
      const folder = n === 1 ? "Questions/Unit 1" : "Questions/Unit 1 (2)";
      promptFolders.push(folder);
      await state.app.vault.create(`${folder}/Unit 1-Q02.md`, "---\nnumber: 2\nanswer: B\nanswer_source: pdf\n---\n\n## Question\nSecond question\n\n## Answer Choices\n- A. yes\n- B. no\n\n## Answer\n**Correct Answer: B**\n");
      return {};
    },
    messages: async () => [{ info: { id: "done", role: "assistant", time: { completed: Date.now() }, finish: "stop" }, parts: [] }],
    abort: async () => ({}),
  });

  const bytes = await textPdf();
  const modal = new T.PdfImportModal(state.app, state.plugin, { files: [file("Unit 1.pdf", bytes), file("Unit 1.pdf", bytes)] });
  const dom = attach(modal);
  modal.onOpen();
  modal.method = "agent";
  modal.agentPollMs = 5;
  modal.agentSettleMs = 20;
  await modal.startBatch();
  await waitFor(() => completionModal(modal), "the same-name batch summary");

  assert.equal(confirmations, 1, "the occupied first target is confirmed once");
  assert.deepEqual(promptFolders, ["Questions/Unit 1", "Questions/Unit 1 (2)"]);
  assert.equal(state.files.get(existingSource).text, "original source bytes", "the pre-existing source is not overwritten");
  assert.equal(state.files.get(existingNote).text.includes("Original question"), true, "the pre-existing note is not overwritten");
  assert.ok(state.files.has("Questions/Unit 1/Unit 1 2.pdf"), "the incoming source gets a free name");
  assert.ok(state.files.has("Questions/Unit 1/Unit 1-Q02.md"), "the first import writes its own note");
  assert.ok(state.files.has("Questions/Unit 1 (2)/Unit 1.pdf"), "the second same-name file gets its own folder");
  assert.ok(state.files.has("Questions/Unit 1 (2)/Unit 1-Q02.md"), "the second import writes its own note");
  assert.ok(state.files.has(existingNote), "the existing note is still present");
  assert.ok(state.files.has(existingSource), "the existing source is still present");
  assert.deepEqual(writes(state).filter((entry) => entry[0] === "createBinary").map((entry) => entry[1]).sort(), [
    "Questions/Unit 1 (2)/Unit 1.pdf",
    "Questions/Unit 1/Unit 1 2.pdf",
  ]);
  const summary = attach(completionModal(modal));
  completionModal(modal).onOpen();
  assert.match(summary.texts().join("\n"), /2 question notes imported from 2 files/);
});

test("import edge: a mid-batch Discard after the first file is committed keeps that file and removes only the current attempt", async () => {
  const state = await setup([]);
  state.plugin.settings.ai.backend = "opencode";
  state.plugin.settings.ai.managed = false;
  state.plugin.ensureOpenCode = async () => {};
  const firstNote = "Questions/Unit A/Unit A-Q01.md";
  let sessions = 0;
  let releaseSecond;
  const secondGate = new Promise((resolve) => {
    releaseSecond = resolve;
  });
  state.plugin.openCode = () => ({
    providers: async () => ({ providers: [{}] }),
    createSession: async () => ({ id: "stop-" + ++sessions }),
    promptAsync: async (id) => {
      if (id === "stop-1") await state.app.vault.create(firstNote, "---\nnumber: 1\nanswer: B\nanswer_source: pdf\n---\n\n## Question\nFirst question\n\n## Answer Choices\n- A. yes\n- B. no\n\n## Answer\n**Correct Answer: B**\n");
      else {
        await state.app.vault.create("Questions/Unit B/Unit B-Q01.md", "---\nnumber: 1\nanswer: B\nanswer_source: pdf\n---\n\n## Question\nSecond question\n\n## Answer Choices\n- A. yes\n- B. no\n\n## Answer\n**Correct Answer: B**\n");
        await secondGate;
      }
      return {};
    },
    messages: async (id) => (id === "stop-1" ? [{ info: { id: "done", role: "assistant", time: { completed: Date.now() }, finish: "stop" }, parts: [] }] : []),
    abort: async () => ({}),
  });

  const bytes = await textPdf();
  const modal = new T.PdfImportModal(state.app, state.plugin, { files: [file("Unit A.pdf", bytes), file("Unit B.pdf", bytes)] });
  const dom = attach(modal);
  modal.onOpen();
  modal.method = "agent";
  modal.agentPollMs = 5;
  modal.agentSettleMs = 20;
  const started = modal.startBatch();
  await waitFor(() => dom.texts().join("\n").includes("Importing 2 of 2"), "the second file to start");
  assert.equal(state.files.has(firstNote), true, "the first file is committed before Discard");
  await dom.click("Discard this file");
  releaseSecond();
  await started;
  await waitFor(() => completionModal(modal), "the mid-batch stop summary");

  assert.equal(state.files.has(firstNote), true, "Discard keeps the earlier committed file");
  assert.ok([...state.files.keys()].some((entry) => entry.startsWith("Questions/Unit A/")), "the first folder stays");
  assert.ok(![...state.files.keys()].some((entry) => entry.startsWith("Questions/Unit B/")), "the current attempt is removed");
  assert.equal(state.dirs.has("Questions/Unit B"), false, "the current attempt's empty folder is removed");
  const summary = attach(completionModal(modal));
  completionModal(modal).onOpen();
  assert.match(summary.texts().join("\n"), /Import stopped|Stopped/);
});

test("import edge: a mixed batch asks for each encrypted PDF once and imports all three", async () => {
  const state = await setup([]);
  state.plugin.aiChat = async () => SINGLE_NOTE_REPLY;
  const plain = await textPdf();
  const files = [
    file("Alpha.pdf", plain),
    file("Locked A.pdf", ENCRYPTED_PDF),
    file("Locked B.pdf", ENCRYPTED_PDF_B),
  ];
  const modal = new T.PdfImportModal(state.app, state.plugin, { files });
  const dom = attach(modal);
  modal.showPreflight();
  const checked = dom.click("Check 3 files");

  await waitFor(() => dom.field("PDF password"), "the first batch password prompt");
  assert.match(dom.texts().join("\n"), /Locked A\.pdf/);
  let input = dom.field("PDF password");
  input.value = "wrong";
  await dom.clickLast("Unlock PDF");
  await waitFor(() => dom.texts().some((text) => /didn't work/i.test(text)), "the batch wrong-password retry");
  input = dom.field("PDF password");
  input.value = ENCRYPTED_PASSWORD;
  await dom.clickLast("Unlock PDF");

  await waitFor(() => {
    const text = dom.texts().join("\n");
    return /Locked B\.pdf/.test(text) && !!dom.field("PDF password");
  }, "the second batch password prompt");
  input = dom.field("PDF password");
  input.value = ENCRYPTED_PASSWORD_B;
  await dom.clickLast("Unlock PDF");
  await checked;

  const preflightText = dom.texts().join("\n");
  assert.match(preflightText, /3 of 3 files are readable/);
  assert.deepEqual(writes(state), [], "checking every password writes nothing");
  const triesBeforeStart = PASSWORD_TRIES.length;
  const textBeforeStart = dom.texts().length;

  await withTimeout(modal.startBatch(), 5000, "the mixed batch first review");
  assert.match(dom.texts().join("\n"), /Found 1 question/);
  assert.match(dom.texts().join("\n"), /Alpha\.pdf/);
  assert.equal(PASSWORD_TRIES.length, triesBeforeStart, "the plain PDF does not ask for a password");
  await dom.clickLast("Create 1 note");

  await waitFor(() => dom.texts().join("\n").includes("File 2 of 3"), "the second mixed-batch file");
  assert.match(dom.texts().join("\n"), /Locked A\.pdf/);
  assert.ok(!dom.texts().slice(textBeforeStart).includes("This PDF needs a password"), "the first saved password is reused");
  await dom.clickLast("Create 1 note");

  await waitFor(() => dom.texts().join("\n").includes("File 3 of 3"), "the third mixed-batch file");
  assert.match(dom.texts().join("\n"), /Locked B\.pdf/);
  assert.ok(!dom.texts().slice(textBeforeStart).includes("This PDF needs a password"), "the second saved password is reused");
  await dom.clickLast("Create 1 note");

  await waitFor(() => completionModal(modal), "the mixed batch summary");
  assert.ok(state.files.has("Questions/Alpha/Alpha.pdf"));
  assert.ok(state.files.has("Questions/Locked A/Locked A.pdf"));
  assert.ok(state.files.has("Questions/Locked B/Locked B.pdf"));
  assert.ok([...state.files.keys()].some((path) => path === "Questions/Alpha/ALPHA-Q01.md"));
  assert.ok([...state.files.keys()].some((path) => path === "Questions/Locked A/LOCKED-A-Q01.md"));
  assert.ok([...state.files.keys()].some((path) => path === "Questions/Locked B/LOCKED-B-Q01.md"));
  assert.ok(![...state.files.values()].some((entry) => String(entry.text || "").includes(ENCRYPTED_PASSWORD)), "passwords never reach notes");
  const settingsJson = JSON.stringify(state.plugin.settings);
  const savedValue = (password) => settingsJson.includes(JSON.stringify(password));
  assert.ok(!savedValue(ENCRYPTED_PASSWORD) && !savedValue(ENCRYPTED_PASSWORD_B), "passwords never reach saved settings");
  assert.ok(!state.ops.some((entry) => JSON.stringify(entry).includes(ENCRYPTED_PASSWORD)), "passwords never reach the write log");
  const summary = attach(completionModal(modal));
  completionModal(modal).onOpen();
  assert.match(summary.texts().join("\n"), /3 question notes imported from 3 files/);
});

test("import edge: skipping one password in a batch records that file and imports the rest", async () => {
  const state = await setup([]);
  state.plugin.aiChat = async () => SINGLE_NOTE_REPLY;
  const modal = new T.PdfImportModal(state.app, state.plugin, {
    files: [file("Locked.pdf", ENCRYPTED_PDF), file("Plain.pdf", await textPdf())],
  });
  const dom = attach(modal);
  const started = modal.startBatch();
  await waitFor(() => dom.field("PDF password"), "the skipped batch password prompt");
  await dom.clickLast("Skip this file");
  await withTimeout(started, 3000, "the skipped batch file to finish");

  await waitFor(() => dom.texts().join("\n").includes("Couldn't import Locked.pdf"), "the skipped-file message");
  assert.match(dom.texts().join("\n"), /other files will continue/i);
  await waitFor(() => dom.texts().join("\n").includes("File 2 of 2"), "the file after the skipped password");
  assert.match(dom.texts().join("\n"), /Plain\.pdf/);
  await dom.clickLast("Create 1 note");
  await waitFor(() => completionModal(modal), "the skipped-file summary");

  assert.ok(!state.files.has("Questions/Locked/Locked.pdf"));
  assert.equal(state.dirs.has("Questions/Locked"), false, "the skipped file leaves no folder");
  assert.ok(state.files.has("Questions/Plain/Plain.pdf"));
  assert.equal(modal.batchResults[0].error, "No password was entered. Nothing was imported.");
  const summary = attach(completionModal(modal));
  completionModal(modal).onOpen();
  assert.match(summary.texts().join("\n"), /1 question note imported from 1 file/);
  assert.match(summary.texts().join("\n"), /1 file failed/);
});

test("import edge: a source-copy failure in the middle of a batch leaves no half-written folder and continues", async () => {
  const state = await setup([]);
  state.plugin.aiChat = async () => SINGLE_NOTE_REPLY;
  const bytes = await textPdf();
  state.failCreateBinary = (path) => path.startsWith("Questions/Broken/");
  const modal = new T.PdfImportModal(state.app, state.plugin, {
    files: [file("Good.pdf", bytes), file("Broken.pdf", bytes), file("Last.pdf", bytes)],
  });
  const dom = attach(modal);
  await modal.startBatch();
  await dom.clickLast("Create 1 note");

  await waitFor(() => dom.texts().join("\n").includes("Couldn't import Broken.pdf"), "the source-copy failure");
  assert.equal(state.dirs.has("Questions/Broken"), false, "the failed source's folder is removed");
  assert.ok(![...state.files.keys()].some((path) => path.startsWith("Questions/Broken/")));
  await waitFor(() => dom.texts().join("\n").includes("File 3 of 3"), "the file after the failed source copy");
  await dom.clickLast("Create 1 note");
  await waitFor(() => completionModal(modal), "the partial source-copy summary");

  assert.ok(state.files.has("Questions/Good/Good.pdf"));
  assert.ok(state.files.has("Questions/Last/Last.pdf"));
  assert.ok([...state.files.keys()].some((path) => /Good-Q01\.md$/i.test(path)));
  assert.ok([...state.files.keys()].some((path) => /Last-Q01\.md$/i.test(path)));
  const summary = attach(completionModal(modal));
  completionModal(modal).onOpen();
  assert.match(summary.texts().join("\n"), /2 question notes imported from 2 files/);
  assert.match(summary.texts().join("\n"), /1 file failed/);
});

test("import edge: case-only and path-unsafe batch names get distinct, vault-safe folders", async () => {
  const state = await setup([]);
  state.plugin.aiChat = async () => SINGLE_NOTE_REPLY;
  const bytes = await textPdf();
  const modal = new T.PdfImportModal(state.app, state.plugin, {
    files: [file("Unit A.pdf", bytes), file("unit a.pdf", bytes), file("Unit: A *B?.pdf", bytes)],
  });
  const dom = attach(modal);
  await modal.startBatch();
  for (let i = 0; i < 3; i++) {
    if (i) await waitFor(() => dom.texts().join("\n").includes(`File ${i + 1} of 3`), `named file ${i + 1}`);
    await dom.clickLast("Create 1 note");
  }
  await waitFor(() => completionModal(modal), "the unusual-name summary");

  assert.ok(state.files.has("Questions/Unit A/Unit A.pdf"));
  assert.ok(state.files.has("Questions/unit a (2)/unit a.pdf"));
  assert.ok(state.files.has("Questions/Unit- A -B-/Unit- A -B-.pdf"));
  const allPaths = [...state.files.keys(), ...state.dirs];
  assert.ok(allPaths.every((entry) => !/[:*?"<>|]/.test(entry)), "no vault path keeps an illegal filename character");
  const summary = attach(completionModal(modal));
  completionModal(modal).onOpen();
  assert.match(summary.texts().join("\n"), /3 question notes imported from 3 files/);
});

test("import edge: a zero-byte, unsupported or corrupt file is skipped in a batch while readable files import", async () => {
  const state = await setup([]);
  state.plugin.aiChat = async () => SINGLE_NOTE_REPLY;
  const bytes = await textPdf();
  const modal = new T.PdfImportModal(state.app, state.plugin, {
    files: [
      file("Empty.pdf", Buffer.alloc(0)),
      file("Corrupt.pdf", Buffer.from("%PDF-1.7\nthis is not a usable PDF")),
      file("Notes.exe", Buffer.from("not a document")),
      file("Readable A.pdf", bytes),
      file("Readable B.pdf", bytes),
    ],
  });
  const dom = attach(modal);
  modal.showPreflight();
  await dom.click("Check 5 files");
  await waitFor(() => dom.texts().join("\n").includes("2 of 5 files are readable"), "the malformed-file preflight");
  const preflightText = dom.texts().join("\n");
  assert.match(preflightText, /Empty\.pdf/);
  assert.match(preflightText, /Corrupt\.pdf/);
  assert.match(preflightText, /Notes\.exe/);
  assert.deepEqual(writes(state), [], "skipping malformed files writes nothing");

  await modal.startBatch();
  await dom.clickLast("Create 1 note");
  await waitFor(() => dom.texts().join("\n").includes("File 2 of 2"), "the second readable file");
  await dom.clickLast("Create 1 note");
  await waitFor(() => completionModal(modal), "the malformed-file batch summary");

  assert.ok(![...state.files.keys()].some((path) => /Empty\.pdf$|Notes\.exe$/.test(path)));
  assert.ok(state.files.has("Questions/Readable A/Readable A.pdf"));
  assert.ok(state.files.has("Questions/Readable B/Readable B.pdf"));
  const summary = attach(completionModal(modal));
  completionModal(modal).onOpen();
  assert.match(summary.texts().join("\n"), /2 question notes imported from 2 files/);
});

test("import edge: an oversized file is refused from its metadata before any read or write", async () => {
  const state = await setup([]);
  let reads = 0;
  const oversized = {
    name: "Huge.pdf",
    size: 80 * 1024 * 1024 + 1,
    async arrayBuffer() {
      reads++;
      return Buffer.alloc(0);
    },
  };
  const modal = new T.PdfImportModal(state.app, state.plugin, { file: oversized });
  const dom = attach(modal);
  modal.folder = "Questions/Huge";
  await withTimeout(modal.start(), 3000, "the oversized-file refusal");

  assert.equal(reads, 0, "the oversized file is not read into memory");
  assert.match(dom.texts().join("\n"), /larger than 80 MB/i);
  assert.deepEqual(writes(state), []);
  assert.equal(state.files.size, 0);
  assert.equal(state.dirs.size, 0);
});

test("import edge: every document-source modal enforces the same 80 MB ceiling", async () => {
  const state = await setup([]);
  const MAX = 80 * 1024 * 1024;
  const expected = "That file is larger than 80 MB. Choose a smaller file or split it before importing.";
  let reads = 0;
  const oversized = {
    name: "Huge.pdf",
    size: MAX + 1,
    async arrayBuffer() {
      reads++;
      return Buffer.alloc(0);
    },
  };
  const asTooLarge = (modal) => assert.rejects(() => modal.readSource(), (error) => error.message === expected);

  const questionImporter = new T.PdfImportModal(state.app, state.plugin, { file: oversized });
  const courseNotes = new T.courseNotes.CourseNotesModal(state.app, state.plugin, () => {}, { file: oversized });
  const ocr = new T.OcrModal(state.app, state.plugin, () => {});
  ocr.file = oversized;
  const review = new T.DocumentReviewModal(state.app, state.plugin, { file: oversized });

  await asTooLarge(questionImporter);
  await asTooLarge(courseNotes);
  await asTooLarge(ocr);
  await asTooLarge(review);
  assert.equal(reads, 0, "metadata refuses the oversized file before it is read by any modal");

  const vaultFile = new obsidian.TFile();
  vaultFile.path = "Huge vault.pdf";
  vaultFile.basename = "Huge vault";
  vaultFile.extension = "pdf";
  vaultFile.stat = { size: MAX + 1 };
  state.files.set(vaultFile.path, vaultFile);
  let vaultReads = 0;
  state.app.vault.readBinary = async () => {
    vaultReads++;
    return Buffer.alloc(0);
  };
  await asTooLarge(new T.DocumentReviewModal(state.app, state.plugin, { vaultDoc: vaultFile.path }));
  assert.equal(vaultReads, 0, "vault metadata refuses before readBinary");

  let actualReads = 0;
  const actual = {
    name: "Actual.pdf",
    size: 0,
    async arrayBuffer() {
      actualReads++;
      return Buffer.alloc(MAX + 1);
    },
  };
  await asTooLarge(new T.courseNotes.CourseNotesModal(state.app, state.plugin, () => {}, { file: actual }));
  assert.equal(actualReads, 1, "the actual buffer is checked when metadata is absent or dishonest");
  assert.deepEqual(writes(state), []);
});

test("import edge: cancelling after the first batch note cleans up the in-flight file and settles the summary", async () => {
  const state = await setup([]);
  let calls = 0;
  let releaseSecond = null;
  state.plugin.aiChat = () => {
    calls++;
    if (calls === 1) return Promise.resolve(SINGLE_NOTE_REPLY);
    return new Promise((resolve) => {
      releaseSecond = () => resolve(SINGLE_NOTE_REPLY);
    });
  };
  const unhandled = [];
  const onUnhandled = (reason) => unhandled.push(reason);
  process.on("unhandledRejection", onUnhandled);
  let modal;
  try {
    const locked = file("Locked.pdf", ENCRYPTED_PDF);
    modal = new T.PdfImportModal(state.app, state.plugin, { files: [file("Plain.pdf", await textPdf()), locked] });
    const dom = attach(modal);
    const started = modal.startBatch();
    await withTimeout(started, 3000, "the first batch review");
    await dom.clickLast("Create 1 note");
    await waitFor(() => dom.field("PDF password"), "the second file's password prompt");

    const firstNote = "Questions/Plain/PLAIN-Q01.md";
    assert.ok(state.files.has("Questions/Plain/Plain.pdf"), "the first file is committed before the cancel");
    assert.ok(state.files.has(firstNote), "the first note is written before the cancel");

    const input = dom.field("PDF password");
    input.value = ENCRYPTED_PASSWORD;
    await dom.clickLast("Unlock PDF");
    await waitFor(() => calls === 2 && state.files.has("Questions/Locked/Locked.pdf"), "the second file to reach its AI request");

    modal.close();
    await waitFor(() => completionModal(modal), "the cancelled batch summary");
    await waitFor(() => !modal.running, "the cancelled import to settle");
  } finally {
    process.off("unhandledRejection", onUnhandled);
    if (typeof releaseSecond === "function") releaseSecond();
  }
  await sleep(10);

  assert.deepEqual(unhandled, [], "cancelling does not leave an unhandled rejection");
  assert.equal(modal.closed, true);
  assert.equal(modal.running, false);
  assert.equal(modal.pdfPromptResolve, null, "the password prompt is not left pending");
  assert.equal(modal.progress, null, "the progress notice is dismissed");
  assert.ok(state.files.has("Questions/Plain/Plain.pdf"), "the completed file's source copy stays");
  assert.ok(state.files.has("Questions/Plain/PLAIN-Q01.md"), "the completed file's note stays");
  assert.ok(!state.files.has("Questions/Locked/Locked.pdf"), "the in-flight source copy is removed");
  assert.equal(state.dirs.has("Questions/Locked"), false, "the in-flight folder is removed");

  const settingsJson = JSON.stringify(state.plugin.settings);
  assert.ok(!settingsJson.includes(JSON.stringify(ENCRYPTED_PASSWORD)), "the password never reaches settings");
  assert.ok(!state.ops.some((entry) => JSON.stringify(entry).includes(JSON.stringify(ENCRYPTED_PASSWORD))), "the password never reaches the write log");

  const complete = completionModal(modal);
  assert.ok(complete, "the user gets a stopped summary instead of a stuck modal");
  const completeDom = attach(complete);
  complete.onOpen();
  const summary = completeDom.texts().join("\n");
  assert.match(summary, /Import stopped/);
  assert.match(summary, /1 question note imported/);
  assert.match(summary, /Stopped/);
  assert.ok(completeDom.texts().includes("Close"), "the summary is dismissible");
});
