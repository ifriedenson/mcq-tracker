"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT, obsidian } = load();
const frq = T.frq;
const frqImport = T.frqImport;

function samplePages() {
  return [
    {
      n: 1,
      text: [
        "AP Chemistry",
        "Free Response Question 1",
        "A 2.0 mol sample of gas is heated at constant volume.",
        "Scoring Guidelines",
        "- [1] Setup: correct ideal-gas equation.",
        "- [2] Answer: correct moles.",
      ].join("\n"),
    },
    {
      n: 2,
      text: [
        "Question 2",
        "Explain why the pressure rises when the temperature increases.",
        "Scoring Guidelines",
        "| Criterion | Points | Description |",
        "| --- | ---: | --- |",
        "| Explanation | 2 | Uses kinetic theory. |",
      ].join("\n"),
    },
  ];
}

test("FRQ import: splits two PDF questions and keeps each rubric separate", () => {
  const out = frqImport.splitFrqItems(samplePages());
  assert.equal(out.items.length, 2);
  assert.equal(out.items[0].title, "Question 1");
  assert.match(out.items[0].prompt, /constant volume/);
  assert.doesNotMatch(out.items[0].prompt, /Scoring Guidelines|ideal-gas equation/);
  assert.equal(out.items[0].criteria.length, 2);
  assert.equal(out.items[0].criteria[0].points, 1);
  assert.equal(out.items[0].criteria[1].points, 2);
  assert.equal(out.items[0].page, 1);

  assert.equal(out.items[1].title, "Question 2");
  assert.match(out.items[1].prompt, /pressure rises/);
  assert.doesNotMatch(out.items[1].prompt, /Criterion|kinetic/);
  assert.equal(out.items[1].criteria.length, 1);
  assert.equal(out.items[1].criteria[0].points, 2);
  assert.equal(out.items[1].page, 2);
  assert.equal(out.items[0].valid, true);
  assert.equal(out.items[1].valid, true);
});

test("FRQ import: an item without a rubric stays visible but is not valid", () => {
  const out = frqImport.splitFrqItems([{ n: 3, text: "Question 1\nExplain the trend." }]);
  assert.equal(out.items.length, 1);
  assert.equal(out.items[0].prompt, "Explain the trend.");
  assert.equal(out.items[0].criteria.length, 0);
  assert.equal(out.items[0].valid, false);
  assert.ok(out.items[0].warnings.some((warning) => /rubric/i.test(warning)));
});

test("FRQ import: a scanned/empty text layer produces no candidates", () => {
  const out = frqImport.splitFrqItems([{ n: 1, text: "" }]);
  assert.equal(out.items.length, 0);
  assert.match(out.warnings[0], /text layer/i);
});

test("FRQ import: a PDF with no question labels is still one editable item", () => {
  const out = frqImport.splitFrqItems([
    {
      n: 4,
      text: "Evaluate the extent of change.\nScoring Guidelines\n- [1] Thesis: defensible claim.\n- [2] Evidence: uses the documents.",
    },
  ]);
  assert.equal(out.items.length, 1);
  assert.equal(out.items[0].title, "Evaluate the extent of change.");
  assert.equal(out.items[0].criteria.length, 2);
  assert.equal(out.items[0].valid, true);
});

test("FRQ import: preview writes nothing until confirm, then creates gradable notes", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.reference.enabled = true;
  const pdf = {
    path: "Papers/AP Chemistry FRQs.pdf",
    name: "AP Chemistry FRQs.pdf",
    extension: "pdf",
    buffer: new Uint8Array([37, 80, 68, 70]),
  };
  app.files.push(pdf);
  plugin.frqPdfReader = async () => ({ pages: samplePages(), total: 2, warnings: [], figCount: 0 });

  const created = [];
  const modal = await plugin.importFrqPdf(pdf, { onDone: (notes) => created.push(...notes) });
  assert.ok(modal);
  assert.ok(modal instanceof T.FrqImportPreviewModal);
  assert.equal(app.created, undefined, "reading the PDF must not create a note");
  assert.equal(modal.items.length, 2);

  const dom = makeDom();
  modal.contentEl = dom.root;
  modal.onOpen();
  assert.ok(dom.texts().includes("Import free-response questions from a PDF"));
  assert.ok(dom.texts().includes("Question 1"));
  assert.ok(dom.texts().includes("Question 2"));
  assert.ok(dom.texts().includes("Create 2 notes"));
  assert.equal(app.created, undefined, "drawing the preview must not create a note");
  const fields = dom.all.filter((entry) => entry.meta && ["input", "select", "textarea"].includes(entry.meta.tag));
  assert.ok(fields.length > 0, "the preview renders form controls");
  for (const field of fields) {
    if (field.meta.type === "checkbox") continue;
    assert.ok(field.meta.attrs && field.meta.attrs["aria-label"], `${field.meta.tag} carries an accessible name`);
  }

  modal.courseId = "ap-chemistry";
  modal.kind = T.frq.presetsForCourse("ap-chemistry")[0].id;
  modal.items[1].include = false;
  modal.draw();
  assert.ok(dom.texts().includes("Create 1 note"));
  await dom.click("Create 1 note");
  assert.equal(app.created.length, 1);
  assert.equal(app.created[0].path, "AP FRQs/AP Chemistry/Question 1.md");
  assert.equal(created.length, 1);
  assert.equal(created[0].note.courseId, "ap-chemistry");
  assert.equal(created[0].note.maxPoints, 3);
  assert.match(created[0].note.prompt, /constant volume/);
  assert.match(created[0].file.text, /## Rubric/);

  const note = created[0].note;
  const seen = [];
  plugin.aiComplete = async (system, user, opts) => {
    seen.push(opts);
    return JSON.stringify({
      criteria: note.rubric.map((criterion) => ({
        id: criterion.id,
        awarded: criterion.points,
        evidence: "typed answer",
        explanation: "matches the criterion",
        confidence: 0.9,
      })),
      overall: "The answer addresses both criteria.",
    });
  };
  const graded = await plugin.gradeFrqWithAi(note, "PV = nRT; n = 0.25 mol.");
  assert.equal(seen[0].feature, "frqGrading");
  assert.equal(graded.scores[note.rubric[0].id], 1);
  assert.equal(graded.scores[note.rubric[1].id], 2);
  assert.equal(graded.overall, "The answer addresses both criteria.");
});

test("FRQ import: the PDF picker lists vault PDFs and hands one back", () => {
  const app = makeApp([]);
  const files = [{ path: "Z papers/second.pdf" }, { path: "A papers/first.pdf" }];
  const chosen = [];
  const picker = new T.FrqPdfPickerModal(app, files, (file) => chosen.push(file));
  assert.deepEqual(picker.getItems(), files);
  assert.equal(picker.getItemText(files[1]), "A papers/first.pdf");
  picker.onChooseItem(files[1]);
  assert.deepEqual(chosen, [files[1]]);
});

test("FRQ import: an invalid edited item blocks the whole batch before any write", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.reference.enabled = true;
  const pdf = { path: "Papers/frq.pdf", name: "frq.pdf", buffer: new Uint8Array([1]) };
  plugin.frqPdfReader = async () => ({ pages: samplePages(), total: 2, warnings: [] });
  const modal = await plugin.importFrqPdf(pdf);
  modal.contentEl = makeDom().root;
  modal.onOpen();
  modal.items[0].rubricText = "";
  modal.draw();
  const ok = await modal.confirm();
  assert.equal(ok, false);
  assert.equal(app.created, undefined);
  assert.match(modal.error, /rubric criterion/i);
});

test("FRQ import: the vault command and no-PDF guard are registered", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  assert.ok(plugin.commands.some((command) => command.id === "import-frq-pdf"));
  plugin.settings.reference.enabled = true;
  const result = plugin.openFrqPdfImport();
  assert.equal(result, null);
  assert.ok(obsidian.notices.some((notice) => /No PDFs were found/.test(notice)));
  assert.ok(app.files.every((file) => !/\\.pdf$/i.test(file.path)));
});
