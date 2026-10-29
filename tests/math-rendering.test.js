"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T } = load();
const math = T.mathRendering;

test("math: simple chemistry notation becomes ordinary MathJax", () => {
  assert.equal(math.prepareMathMarkdown("$\\ce{H2O}$"), "$\\mathrm{H_{2}O}$");
  assert.equal(math.prepareMathMarkdown("$\\ce{Ca(OH)2}$"), "$\\mathrm{Ca(OH)_{2}}$");
  assert.equal(math.prepareMathMarkdown("$\\ce{CO2}$"), "$\\mathrm{CO_{2}}$");
  assert.equal(math.prepareMathMarkdown("$\\ce{Na+}$"), "$\\mathrm{Na}^{+}$");
  assert.equal(math.prepareMathMarkdown("$\\ce{SO4^2-}$"), "$\\mathrm{SO_{4}}^{2-}$");
  assert.equal(math.prepareMathMarkdown("$\\ce{H2O(l)}$"), "$\\mathrm{H_{2}O}\\,(\\mathrm{l})$");
  assert.equal(
    math.prepareMathMarkdown("$\\ce{2H2 + O2 -> 2H2O}$"),
    "$2\\mathrm{H_{2}} + \\mathrm{O_{2}} \\rightarrow 2\\mathrm{H_{2}O}$"
  );
  assert.equal(
    math.prepareMathMarkdown("$\\ce{Na+ + Cl- -> NaCl}$"),
    "$\\mathrm{Na}^{+} + \\mathrm{Cl}^{-} \\rightarrow \\mathrm{NaCl}$"
  );
  assert.equal(
    math.prepareMathMarkdown("$\\ce{CH3COOH <=> H+ + CH3COO-}$"),
    "$\\mathrm{CH_{3}COOH} \\rightleftharpoons \\mathrm{H}^{+} + \\mathrm{CH_{3}COO}^{-}$"
  );
});

test("math: complex or ambiguous chemistry is left for mhchem instead of guessed", () => {
  const complex = "$\\ce{[Cu(NH3)4]^2+}$";
  assert.equal(math.prepareMathMarkdown(complex), complex);
  const labelled = "$\\ce{A ->[heat] B}$";
  assert.equal(math.prepareMathMarkdown(labelled), labelled);
  const text = "$\\ce{\\text{unknown}}$";
  assert.equal(math.prepareMathMarkdown(text), text);
});

test("math: ordinary fractions, matrices and integrals are untouched", () => {
  for (const sample of math.MATH_SAMPLES.filter((item) => !item.markdown.includes("\\ce{"))) {
    assert.equal(math.prepareMathMarkdown(sample.markdown), sample.markdown);
  }
  assert.equal(math.prepareMathMarkdown("$x^2 + \\frac{1}{2}$"), "$x^2 + \\frac{1}{2}$");
  assert.equal(math.prepareMathMarkdown("$$\\begin{bmatrix}1 & 2\\\\3 & 4\\end{bmatrix}$$"), "$$\\begin{bmatrix}1 & 2\\\\3 & 4\\end{bmatrix}$$");
});

test("math: code and escaped dollars are never rewritten", () => {
  const fenced = "```md\n$\\ce{H2O}$\n```";
  assert.equal(math.prepareMathMarkdown(fenced), fenced);
  const inline = "Use `$\\ce{H2O}$` in a note";
  assert.equal(math.prepareMathMarkdown(inline), inline);
  const escaped = "Costs \\$5, and $\\ce{H2O}$ is water";
  assert.equal(math.prepareMathMarkdown(escaped), "Costs \\$5, and $\\mathrm{H_{2}O}$ is water");
  assert.equal(math.prepareMathMarkdown("\\ce{H2O} outside math"), "\\ce{H2O} outside math");
});

test("math: the shared renderer prepares chemistry and falls back safely", async () => {
  const previous = obsidian.MarkdownRenderer.render;
  let seen = "";
  obsidian.MarkdownRenderer.render = async (_app, markdown) => {
    seen = markdown;
  };
  try {
    T.renderMarkdownInto({}, "$\\ce{H2O}$", { setText() {} }, "Questions/q.md", {});
    await Promise.resolve();
    assert.equal(seen, "$\\mathrm{H_{2}O}$");
  } finally {
    obsidian.MarkdownRenderer.render = previous;
  }

  const el = { fallback: "", setText(value) { this.fallback = value; } };
  obsidian.MarkdownRenderer.render = () => {
    throw new Error("renderer unavailable");
  };
  try {
    T.renderMarkdownInto({}, "$\\frac{1}{2}$", el, "", {});
    assert.equal(el.fallback, "$\\frac{1}{2}$");
  } finally {
    obsidian.MarkdownRenderer.render = previous;
  }
});

test("math: golden question notes keep math and chemistry through parsing and choices", () => {
  const text = [
    "---",
    "question_id: math-golden",
    "question_type: mcq",
    "answer: C",
    "---",
    "",
    "## Stimulus",
    "Let $f(x) = \\int_0^x t^2\\,dt$ and $g(x) = \\frac{1}{2}x^2$.",
    "",
    "## Question",
    "Which matrix is the identity? $I = \\begin{bmatrix}1 & 0\\\\0 & 1\\end{bmatrix}$",
    "",
    "## Answer Choices",
    "- A. $\\frac{1}{2}$",
    "- B. $\\ce{H2O}$",
    "- C. $\\begin{bmatrix}1 & 0\\\\0 & 1\\end{bmatrix}$",
    "- D. $\\int_0^1 x^2\\,dx$",
    "",
    "## Answer",
    "> [!answer]- Reveal answer",
    "> **Correct Answer: C**",
    ">",
    "> The identity matrix has ones on the diagonal: $\\ce{2H2 + O2 -> 2H2O}$ is unrelated.",
    "",
    "## My Notes",
  ].join("\n");
  const sections = T.parseSections(text);
  assert.equal(sections.choices.length, 4);
  assert.equal(sections.choices[0].text, "$\\frac{1}{2}$");
  assert.equal(sections.choices[1].text, "$\\ce{H2O}$");
  assert.match(sections.choices[2].text, /\\begin\{bmatrix\}/);
  assert.match(sections.question, /\\begin\{bmatrix\}/);
  assert.match(sections.stimulus, /\\int_0\^x/);
  assert.match(T.extractRationale(sections.answer), /\\ce\{2H2 \+ O2 -> 2H2O\}/);
  assert.equal(T.answerFromSection(sections.answer), "C");
  assert.equal(T.inferMode("mcq", "C", sections.choices), "mcq");
  assert.equal(math.prepareMathMarkdown(sections.choices[1].text), "$\\mathrm{H_{2}O}$");
});

test("math: the practice review renders its stem, choices and explanation as Markdown", async () => {
  const note = [
    "---",
    "question_id: math-review",
    "question_type: mcq",
    "answer: B",
    "---",
    "",
    "## Question",
    "What is $\\frac{1}{2} + \\frac{1}{4}$?",
    "",
    "## Answer Choices",
    "- A. $\\frac{1}{8}$",
    "- B. $\\frac{3}{4}$",
    "- C. $\\ce{H2O}$",
    "- D. $\\int x\\,dx$",
    "",
    "## Answer",
    "> [!answer]- Reveal answer",
    "> **Correct Answer: B**",
    ">",
    "> Add the fractions: $\\frac{1}{2}+\\frac{1}{4}=\\frac{3}{4}$.",
    "",
    "## My Notes",
  ].join("\n");
  const app = makeApp([{ path: "Questions/math-review.md", text: note, fm: { answer: "B", question_type: "mcq" } }]);
  const { Plugin: QT } = load();
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.explanationDefault = "show";
  const file = app.files[0];
  const dom = makeDom();
  const view = new T.PracticeView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  const rendered = [];
  const previous = obsidian.MarkdownRenderer.render;
  obsidian.MarkdownRenderer.render = async (_app, markdown) => {
    rendered.push(markdown);
  };
  try {
    view.state = "result";
    view.result = {
      file,
      correct: true,
      chosen: "B",
      key: "B",
      mode: "mcq",
      seconds: 5,
      summary: { streak: 1, correctCount: 1, attempts: 1, nextReview: "tomorrow" },
      errorType: "",
      flagged: false,
      sections: T.parseSections(note),
      fm: file.fm,
      conf: 2,
    };
    view.render();
    await Promise.resolve();
  } finally {
    obsidian.MarkdownRenderer.render = previous;
  }
  assert.ok(rendered.some((text) => text.includes("\\frac{1}{2} + \\frac{1}{4}")), "the stem");
  assert.ok(rendered.some((text) => text.includes("\\frac{3}{4}")), "the correct choice and explanation");
  assert.ok(rendered.some((text) => text.includes("\\mathrm{H_{2}O}")), "chemistry in a choice uses the fallback");
});
