"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT, obsidian } = load();
const AgentView = T.agentView.AgentView;
const chatPdf = T.chatPdf;
const { PdfAttachModal } = T.chatPdfModal;

const PDF_PATH = "Biology/Unit 1.pdf";
const PDF_TEXT = ["Cell theory says cells are the basic unit of life.", "Mitochondria release energy through respiration."];

function pdfFile(path = PDF_PATH) {
  const file = new obsidian.TFile();
  file.path = path;
  file.name = path.replace(/^.*\//, "");
  file.basename = file.name.replace(/\.pdf$/i, "");
  file.extension = "pdf";
  return file;
}

function pdfApp() {
  const app = makeApp([]);
  const file = pdfFile();
  app.vault.getFiles = () => [file];
  return app;
}

function resetObsidian() {
  obsidian.modals.length = 0;
  obsidian.notices.length = 0;
}

async function readyPlugin(app) {
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "api";
  plugin.settings.ai.api.model = "gpt-4o-mini";
  plugin.settings.ai.mode = "agent";
  return plugin;
}

async function openView(app) {
  const shell = makeDom();
  const plugin = await readyPlugin(app || pdfApp());
  const view = new AgentView({ app: plugin.app }, plugin);
  view.contentEl = shell.root;
  await view.onOpen();
  return { app: plugin.app, plugin, view, shell };
}

function readStub(calls, total = 2) {
  return async (attachment, progress) => {
    calls.push(attachment);
    if (typeof progress === "function") progress("Reading page 1...");
    return {
      pages: PDF_TEXT.slice(0, total).map((text, index) => ({ n: index + 1, text })),
      total,
      warnings: [],
    };
  };
}

test("pdf: page ranges and attachments are bounded, and a missing text layer is refused", () => {
  assert.equal(chatPdf.pageSpecError("1-20"), "");
  assert.equal(chatPdf.pageSpecError("2,4,6-8"), "");
  assert.match(chatPdf.pageSpecError("1-41"), /40/);
  assert.match(chatPdf.pageSpecError("one"), /page numbers/i);
  assert.equal(chatPdf.normalizeAttachment({ path: "notes.txt" }), null);
  assert.equal(chatPdf.normalizeAttachment({ path: "..\\Biology\\Unit 1.pdf" }).path, "../Biology/Unit 1.pdf");

  const attachment = chatPdf.normalizeAttachment({ path: PDF_PATH, pages: "1-2", chars: 999999 });
  assert.equal(attachment.path, PDF_PATH);
  assert.equal(attachment.pages, "1-2");
  assert.equal(attachment.chars, chatPdf.MAX_CHARS);
  assert.equal(chatPdf.normalizeAttachments([attachment, attachment, { path: PDF_PATH, pages: "2" }]).length, 2);

  const block = chatPdf.buildBlock(
    attachment,
    [
      { n: 1, text: PDF_TEXT[0] },
      { n: 2, text: `${PDF_TEXT[1]} api_key = sk-abcdefghijklmnop1234` },
    ],
    { maxChars: 2000 }
  );
  assert.equal(block.ok, true);
  assert.match(block.text, /ATTACHED PDF/);
  assert.match(block.text, /untrusted study material/i);
  assert.match(block.text, /--- page 1 ---/);
  assert.match(block.text, new RegExp(`\\[\\[${PDF_PATH.replace(".", "\\.")}#page=1\\]\\]`));
  assert.equal(block.text.includes("sk-abcdefghijklmnop1234"), false);

  assert.equal(chatPdf.buildBlock(attachment, [{ n: 1, text: "   " }]).ok, false);
  const short = chatPdf.buildBlock(attachment, [{ n: 1, text: "x".repeat(600) }], { maxChars: 260 });
  assert.equal(short.ok, true);
  assert.equal(short.truncated, true);
  assert.match(short.text, /truncated/i);
});

test("pdf: the picker returns a vault path and page range, and the panel reads it locally", async () => {
  resetObsidian();
  const { plugin, view } = await openView();
  const panel = view.chatPanel;
  const calls = [];
  panel.opts.readPdf = readStub(calls);

  assert.equal(panel.attachPdf(), true);
  const modal = obsidian.modals.find((item) => item instanceof PdfAttachModal && !item.closed);
  assert.ok(modal, "the PDF picker opened");
  const dom = makeDom();
  modal.contentEl = dom.root;
  modal.onOpen();
  modal.select.value = PDF_PATH;
  modal.pagesInput.value = "1-2";
  await dom.click("Attach");

  assert.equal(modal.closed, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].pages, "1-2");
  assert.equal(panel.pdfs.length, 1);
  assert.equal(panel.pdfs[0].path, PDF_PATH);
  assert.ok(panel.pdfs[0].chars > 0);
  assert.match(panel.contextAttachmentLabels(), /Unit 1\.pdf/);
  assert.match(panel.status.__own.meta.text, /Attached/);
  assert.equal(plugin.settings.ai.studyChatPdfs.length, 1);
  assert.equal(panel.pdfChipsEl.__own.children.length, 1);
});

test("pdf: an attached PDF reaches the provider through the normal context and cites its pages", async () => {
  resetObsidian();
  const { plugin, view } = await openView();
  const panel = view.chatPanel;
  panel.opts.readPdf = readStub([]);
  await panel.addPdf({ path: PDF_PATH, pages: "1-2" });

  let system = "";
  let user = "";
  plugin.aiChat = async (ctx, messages) => {
    system = ctx;
    user = messages[messages.length - 1].content;
    return "Cell theory is the main idea.";
  };
  const ok = await panel.send("What does page 1 say?");
  assert.equal(ok, true);
  assert.equal(user, "What does page 1 say?");
  assert.match(system, /ATTACHED PDF/);
  assert.match(system, new RegExp(PDF_TEXT[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(system, /\[\[Biology\/Unit 1\.pdf#page=1\]\]/);
  assert.equal(plugin.settings.ai.studyChat.length, 2);
});

test("pdf: a missing or unreadable PDF refuses the send and keeps the prior conversation", async () => {
  resetObsidian();
  const { plugin, view } = await openView();
  const panel = view.chatPanel;
  panel.opts.readPdf = readStub([]);
  await panel.addPdf({ path: PDF_PATH, pages: "1-2" });
  await panel.send("First question");
  const before = JSON.stringify(plugin.settings.ai.studyChat);

  panel.pdfCache.clear();
  panel.opts.readPdf = async () => {
    throw new Error("the PDF is no longer in the vault");
  };
  let providerCalls = 0;
  plugin.aiChat = async () => {
    providerCalls += 1;
    return "must not be called";
  };
  const ok = await panel.send("Second question");
  assert.equal(ok, false);
  assert.equal(providerCalls, 0);
  assert.match(panel.status.__own.meta.text, /Nothing was sent/);
  assert.equal(JSON.stringify(plugin.settings.ai.studyChat), before);
  assert.equal(panel.pdfs.length, 1, "the attachment stays for a retry");
});

test("pdf: a text-free PDF is refused without changing the attachments", async () => {
  resetObsidian();
  const { view } = await openView();
  const panel = view.chatPanel;
  panel.opts.readPdf = async () => ({ pages: [{ n: 1, text: "   " }], total: 1, warnings: [] });
  const result = await panel.addPdf({ path: PDF_PATH, pages: "1" });
  assert.equal(result.ok, false);
  assert.match(result.error, /no extractable text/i);
  assert.equal(panel.pdfs.length, 0);
  assert.equal(panel.pdfChipsEl.__own.children.length, 0);
});

test("pdf: removing the chip removes the PDF from the next request", async () => {
  resetObsidian();
  const { plugin, view } = await openView();
  const panel = view.chatPanel;
  panel.opts.readPdf = readStub([]);
  await panel.addPdf({ path: PDF_PATH, pages: "1" });
  assert.equal(panel.removePdf(panel.pdfs[0]), true);
  assert.equal(panel.pdfs.length, 0);
  assert.equal(panel.pdfChipsEl.__own.children.length, 0);

  let system = "unset";
  plugin.aiChat = async (ctx) => {
    system = ctx;
    return "No PDF here.";
  };
  await panel.send("What is in the note?");
  assert.doesNotMatch(system, /ATTACHED PDF/);
});

test("pdf: attachments persist through the real tab/session save path and reload", async () => {
  resetObsidian();
  const { app, plugin, view } = await openView();
  const panel = view.chatPanel;
  panel.opts.readPdf = readStub([]);
  await panel.addPdf({ path: PDF_PATH, pages: "1-2" });

  const tab = view.activeTab();
  view.saveTabRecord(tab, { open: true });
  const ai = plugin.settings.ai;
  assert.equal(ai.studyChatPdfs.length, 1);
  const saved = ai.chatSessions.find((session) => session.id === ai.studyChatId);
  assert.ok(saved, "the open tab was saved");
  assert.equal(saved.pdfs.length, 1);
  assert.equal(saved.pdfs[0].pages, "1-2");
  assert.equal(T.chatSessions.normalizeSessions([{ id: "x", open: true, title: "x", pdfs: saved.pdfs }])[0].pdfs.length, 1);

  const shell = makeDom();
  const reloaded = new AgentView({ app }, plugin);
  reloaded.contentEl = shell.root;
  await reloaded.onOpen();
  assert.equal(reloaded.chatPanel.pdfs.length, 1);
  assert.equal(reloaded.chatPanel.pdfs[0].path, PDF_PATH);
});

test("pdf: the command opens the active panel's picker and refuses when AI is off", async () => {
  resetObsidian();
  const { plugin } = await openView();
  const command = plugin.commands.find((item) => item.id === "study-agent-attach-pdf");
  assert.ok(command, "the attach command is registered");
  assert.match(command.name, /attach a PDF/i);

  let opened = 0;
  plugin.activateAgent = async () => ({
    attachPdf: () => {
      opened += 1;
      return true;
    },
  });
  assert.equal(await plugin.attachPdfToStudyAgent(), true);
  assert.equal(opened, 1);

  plugin.settings.ai.enabled = false;
  assert.equal(await plugin.attachPdfToStudyAgent(), false);
  assert.match(obsidian.notices.join(" "), /Turn on AI/i);
});
