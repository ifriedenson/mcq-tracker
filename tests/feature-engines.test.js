"use strict";
/**
 * The four engines added in 1.258.0: rectangle PDF deep links, FSRS weight
 * training, the handwriting → LaTeX pipeline, and the Markmind-format mind map.
 */
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("./helpers/load");

const { T } = load();

test("a PDF deep link carries its selection rectangle", () => {
  const rect = { x: 0.1, y: 0.2, width: 0.3, height: 0.15 };
  const link = T.pdfDeepLink.formatPdfDeepLink("Books/ch 3.pdf", 7, { annotation: "ann-1", rect });
  assert.equal(link, "[[Books/ch 3.pdf#page=7&annotation=ann-1&rect=0.1,0.2,0.3,0.15]]");
  const parsed = T.pdfDeepLink.parsePdfDeepLink(link);
  assert.equal(parsed.valid, true);
  assert.equal(parsed.path, "Books/ch 3.pdf");
  assert.equal(parsed.page, 7);
  assert.equal(parsed.annotation, "ann-1");
  assert.deepEqual(parsed.rect, rect);
  assert.match(T.pdfDeepLink.describePdfDeepLink(parsed), /ch 3\.pdf page 7/);
  assert.match(T.pdfDeepLink.describePdfDeepLink(parsed), /selection 30% × 15%/);
});

test("a deep link without a rectangle still opens its page", () => {
  const parsed = T.pdfDeepLink.parsePdfDeepLink("[[a.pdf#page=2]]");
  assert.equal(parsed.valid, true);
  assert.equal(parsed.page, 2);
  assert.equal(parsed.rect, null);
  assert.equal(T.pdfDeepLink.formatPdfDeepLink("a.pdf", 2, {}), "[[a.pdf#page=2]]");
  assert.equal(T.pdfDeepLink.parsePdfDeepLink("[[a.pdf#page=2|page two]]").page, 2);
});

test("an unusable rectangle, path or link is refused instead of written", () => {
  assert.equal(T.pdfDeepLink.normalizeRect({ x: 0.9, y: 0, width: 0.3, height: 0.1 }), null);
  assert.equal(T.pdfDeepLink.normalizeRect({ x: 0, y: 0, width: 0, height: 0.2 }), null);
  assert.equal(T.pdfDeepLink.formatPdfDeepLink("notes.txt", 1, {}), "");
  assert.equal(T.pdfDeepLink.formatPdfDeepLink("a.pdf", 0, {}), "");
  assert.equal(T.pdfDeepLink.formatPdfDeepLink("a.pdf", 1, { annotation: "bad id!" }), "");
  assert.equal(T.pdfDeepLink.parsePdfDeepLink("[[a.pdf#rect=1,2,3,4]]").valid, false);
  assert.equal(T.pdfDeepLink.parsePdfDeepLink("not a link").valid, false);
});

test("a multi-line selection becomes one rectangle", () => {
  const union = T.pdfDeepLink.unionRect([
    { x: 0.1, y: 0.4, width: 0.2, height: 0.1 },
    { x: 0.5, y: 0.2, width: 0.2, height: 0.3 },
  ]);
  assert.deepEqual(union, { x: 0.1, y: 0.2, width: 0.6, height: 0.3 });
  assert.equal(T.pdfDeepLink.unionRect([]), null);
  assert.equal(T.pdfDeepLink.unionRect([{ x: 2, y: 0, width: 1, height: 1 }]), null);
});

function history() {
  const rows = [];
  for (let card = 0; card < 10; card++) {
    let day = 0;
    for (let i = 0; i < 6; i++) {
      rows.push({ path: `Card ${card}`, grade: i === 4 ? 1 : 3, day });
      day += 2 + i * 3;
    }
  }
  return rows;
}

test("training lowers the loss on the vault's own reviews", () => {
  const trained = T.fsrsTrain.trainWeights(history(), { iterations: 20 });
  assert.equal(trained.ok, true);
  assert.equal(trained.reviews, 60);
  assert.equal(trained.cards, 10);
  assert.ok(trained.loss < trained.initialLoss, `loss ${trained.loss} is below the starting ${trained.initialLoss}`);
  assert.equal(trained.weights.length, 19);
  assert.ok(trained.weights.every((weight) => Number.isFinite(weight) && weight > 0));
});

test("training is deterministic and refuses a short history", () => {
  const first = T.fsrsTrain.trainWeights(history(), { iterations: 10 });
  const second = T.fsrsTrain.trainWeights(history(), { iterations: 10 });
  assert.deepEqual(first.weights, second.weights);
  const short = T.fsrsTrain.trainWeights([{ path: "a", grade: 3, day: 0 }]);
  assert.equal(short.ok, false);
  assert.equal(short.reason, "reviews");
  assert.equal(short.minReviews, T.fsrsTrain.MIN_REVIEWS);
});

test("recall probability falls with time and the model stays in range", () => {
  const now = T.fsrsTrain.retrievability(10, 0);
  const week = T.fsrsTrain.retrievability(10, 7);
  const month = T.fsrsTrain.retrievability(10, 30);
  assert.equal(now, 1);
  assert.ok(week < now && month < week && month > 0);
  const weights = T.fsrsTrain.DEFAULT_WEIGHTS;
  const stability = T.fsrsTrain.initialStability(1, weights);
  const difficulty = T.fsrsTrain.initialDifficulty(1, weights);
  assert.ok(stability > 0);
  assert.ok(difficulty >= 1 && difficulty <= 10);
  assert.ok(T.fsrsTrain.nextStability(stability, difficulty, 0.9, 1, weights) > 0);
  assert.ok(T.fsrsTrain.nextDifficulty(difficulty, 4, weights) <= 10);
  assert.equal(T.fsrsTrain.normalizeWeights([1, 2, 3]), null);
  const normalized = T.fsrsTrain.normalizeReviews([
    { path: "x", grade: 3, day: 5 },
    { path: "x", grade: 1, day: 2 },
    { path: "x", grade: 9, day: 9 },
  ]);
  assert.deepEqual(normalized.map((row) => row.grade), [1, 3]);
});

test("a fenced reply becomes Markdown and a note", () => {
  const reply = "Here is the page:\n```markdown\n# Work\n\n$$x^2$$\n```";
  assert.equal(T.pdfLatex.extractLatexMarkdown(reply), "# Work\n\n$$x^2$$");
  assert.equal(T.pdfLatex.extractLatexMarkdown("   "), "");
  assert.equal(T.pdfLatex.latexNotePath("Papers/unit 2.pdf"), "unit 2 (LaTeX).md");
  const note = T.pdfLatex.buildLatexNote([{ n: 2, text: "# Work\n\n$$x^2$$" }], {
    title: "Unit 2",
    sourcePath: "Papers/unit 2.pdf",
    model: "vision",
    date: "2026-11-05",
  });
  assert.match(note.text, /^---\nlatex: true/);
  assert.match(note.text, /source_pdf: "\[\[Papers\/unit 2\.pdf\]\]"/);
  assert.match(note.text, /## Page 2\n\n# Work/);
  assert.equal(note.pages, 1);
  assert.throws(() => T.pdfLatex.buildLatexNote([{ n: 1, text: "  " }]), /no LaTeX text/);
  assert.match(T.pdfLatex.latexPrompt(3), /page 3/);
});

test("a Markmind note round-trips through its tree", () => {
  const source = [
    "---",
    "mindmap-plugin: basic",
    "---",
    "",
    "# Biology",
    "",
    "- Cell",
    "  - Nucleus",
    "  - Membrane",
    "- Energy",
  ].join("\n");
  assert.equal(T.mindmap.isMarkmind(source), true);
  assert.equal(T.mindmap.isMarkmind("# plain note"), false);
  const { root } = T.mindmap.parseMarkmind(source);
  assert.equal(root.text, "Biology");
  assert.deepEqual(root.children.map((node) => node.text), ["Cell", "Energy"]);
  assert.deepEqual(root.children[0].children.map((node) => node.text), ["Nucleus", "Membrane"]);
  const written = T.mindmap.markmindMarkdown(root);
  assert.match(written, /mindmap-plugin: basic/);
  assert.deepEqual(T.mindmap.parseMarkmind(written).root, root);
  assert.deepEqual(
    T.mindmap.flattenMindmap(root).map((row) => `${row.depth}:${row.text}`),
    ["0:Biology", "1:Cell", "2:Nucleus", "2:Membrane", "1:Energy"]
  );
});

test("a node can be added, renamed, moved and removed, and impossible edits are refused", () => {
  const { root } = T.mindmap.parseMarkmind("# Map\n\n- A\n  - A1\n- B\n");
  const added = T.mindmap.addChild(root, "A", "A2");
  assert.equal(added.ok, true);
  assert.deepEqual(added.tree.children[0].children.map((node) => node.text), ["A1", "A2"]);
  assert.equal(T.mindmap.addChild(root, "A", "   ").ok, false);
  assert.equal(T.mindmap.addChild(root, "Missing", "X").ok, false);
  assert.equal(root.children[0].children.length, 1, "the source tree is not mutated");
  const renamed = T.mindmap.renameNode(root, "A1", "Nucleus");
  assert.equal(renamed.ok, true);
  assert.equal(renamed.tree.children[0].children[0].text, "Nucleus");
  assert.equal(T.mindmap.renameNode(root, "A1", "").ok, false);
  assert.equal(T.mindmap.removeNode(root, "B").tree.children.length, 1);
  assert.equal(T.mindmap.removeNode(root, "Map").reason, "root");
  assert.equal(T.mindmap.moveNode(root, "A1", "B").tree.children[1].children[0].text, "A1");
  assert.equal(T.mindmap.moveNode(root, "A", "A1").ok, false);
  assert.equal(T.mindmap.moveNode(root, "Map", "A").ok, false);
  assert.equal(T.mindmap.moveNode(root, "A1", "Missing").ok, false);
});
