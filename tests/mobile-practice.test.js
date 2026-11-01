"use strict";
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { load, obsidian } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");
const { T, Plugin: QT } = load();

const NOTE = `---
question_id: mobile-1
answer: B
choices: 4
---

## Passage
> The passage text that should get its own tab.

## Question
What is the answer?

## Answer Choices
- A. one
- B. two
- C. three
- D. four

## Answer
> [!answer]- Reveal answer
> **Correct Answer: B**
`;

after(() => {
  obsidian.Platform.isMobile = false;
});

async function setup(mobile) {
  const app = makeApp([{ path: "Questions/mobile-1.md", fm: { answer: "B", choices: 4 }, text: NOTE }]);
  const plugin = new QT(app);
  await plugin.onload();
  const dom = makeDom();
  const view = new T.PracticeView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  const file = app.files[0];
  await view.loadQuestion({ file, fm: file.fm }, true);
  obsidian.Platform.isMobile = mobile;
  view.render();
  return { app, plugin, dom, view };
}

const byClass = (dom, cls) => dom.all.filter((el) => el.meta && el.classes.has(cls));
const clickElement = async (el) => {
  for (const h of el.handlers.filter((x) => x.ev === "click")) await h.fn({});
};

/* ---- stylesheet contract: read the phone block and assert its declarations ---- */
const stylesheet = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");
const phoneStart = stylesheet.indexOf("/* ================= phone question layout");
const phoneRaw = stylesheet.slice(phoneStart, stylesheet.indexOf("/* ---- result review ---- */", phoneStart));
const phoneCss = phoneRaw.replace(/\/\*[\s\S]*?\*\//g, "");
const phoneRules = (() => {
  const rules = [];
  for (const chunk of phoneCss.split("}")) {
    const open = chunk.indexOf("{");
    if (open < 0) continue;
    const selectors = chunk.slice(0, open).split(",").map((s) => s.trim()).filter(Boolean);
    const decls = {};
    for (const raw of chunk.slice(open + 1).split(";")) {
      const colon = raw.indexOf(":");
      if (colon < 0) continue;
      decls[raw.slice(0, colon).trim()] = raw.slice(colon + 1).trim();
    }
    rules.push({ selectors, decls });
  }
  return rules;
})();
function cssDecl(selector, prop) {
  let value;
  for (const rule of phoneRules) if (rule.selectors.includes(selector)) value = rule.decls[prop] ?? value;
  return value;
}
const cssPx = (selector, prop) => parseFloat(cssDecl(selector, prop));
function ancestorChain(el) {
  const chain = [];
  for (let cur = el; cur; cur = cur.parent) chain.push(cur);
  return chain;
}
const inside = (el, cls) => ancestorChain(el).some((a) => a.classes && a.classes.has(cls));

/* ---- behavior 1: the passage gets its own tab, never the question scroller ---- */
test("mobile 1: the passage is tabbed, not stacked into a second scroller", async () => {
  const { dom } = await setup(true);
  const stimulus = byClass(dom, "qt-stimulus")[0];
  assert.ok(stimulus, "the passage renders");
  assert.ok(inside(stimulus, "qt-pane-left"), "the passage sits in the passage pane");
  assert.equal(inside(stimulus, "qt-m-scroll"), false, "the passage is never inside the question scroller");

  const scroll = byClass(dom, "qt-m-scroll")[0];
  assert.ok(scroll, "the question body is a scroller");
  assert.equal(byClass(dom, "qt-m-scroll").length, 1, "exactly one question scroller");
  const wronglyNested = dom.all.filter((el) => el !== scroll && ancestorChain(el).includes(scroll) && el.classes.has("qt-stimulus"));
  assert.equal(wronglyNested.length, 0, "no passage markup inside the question scroller");

  assert.equal(cssDecl(".qt-wrap.qt-mobile", "overflow"), "hidden", "the page itself does not scroll");
  assert.equal(cssDecl(".qt-mobile .qt-pane", "overflow"), "hidden", "panes do not scroll");
  assert.equal(cssDecl(".qt-mobile .qt-m-scroll", "overflow-y"), "auto", "only the question body scrolls");
  assert.equal(cssDecl(".qt-mobile .qt-pane-left .qt-stimulus", "overflow"), "visible", "the passage block has no inner scrollbar");
  assert.equal(cssDecl(".qt-mobile .qt-pane-left .qt-stimulus", "max-height"), "none", "the passage is not height-capped inside its tab");
});

/* ---- behavior 2: the confidence/Submit bar is bound to an answer ---- */
test("mobile 2: the answer bar is hidden until an answer and Submit is disabled until confidence", async () => {
  const { dom } = await setup(true);
  const bar = byClass(dom, "qt-m-answerbar")[0];
  const submit = dom.all.find((el) => el.meta && el.meta.text === "Submit");
  assert.equal(cssDecl(".qt-mobile .qt-m-answerbar", "display"), "none", "the bar is not shown before an answer");
  assert.equal(cssDecl(".qt-mobile .qt-m-answerbar.is-armed", "display"), "flex", "selecting an answer reveals the bar");
  assert.ok(parseFloat(cssDecl(".qt-mobile .qt-m-answerbar .qt-submit:disabled", "opacity")) < 1, "disabled Submit is visibly dimmed");
  assert.ok(byClass(dom, "qt-conf").length >= 3, "confidence choices exist");
  assert.ok(byClass(dom, "qt-conf").every((el) => inside(el, "qt-m-answerbar")), "confidence lives in the bottom bar, not above the choices");

  assert.equal(bar.classes.has("is-armed"), false);
  assert.equal(submit.disabled, true);
  await clickElement(byClass(dom, "qt-choice")[1]);
  assert.ok(bar.classes.has("is-armed"), "picking a choice arms the bar");
  assert.equal(submit.disabled, true, "Submit stays disabled until confidence is chosen");
  await clickElement(byClass(dom, "qt-conf")[1]);
  assert.equal(submit.disabled, false, "answer plus confidence enables Submit");
});

/* ---- behavior 3: secondary actions only in the More sheet ---- */
test("mobile 3: secondary actions live only in the More sheet, with short labels", async () => {
  const { dom } = await setup(true);
  for (const cls of ["qt-ctl", "qt-foot-left", "qt-foot-center", "qt-foot-right"]) {
    assert.equal(byClass(dom, cls).length, 0, `no mobile footer: ${cls}`);
  }
  const sheet = byClass(dom, "qt-m-sheet")[0];
  assert.ok(sheet, "a More sheet exists");
  for (const label of ["Skip", "Don't know", "Bury", "Suspend", "Exclude", "End session"]) {
    const el = dom.all.find((e) => e.meta && e.meta.text === label);
    assert.ok(el, `${label} exists`);
    assert.ok(inside(el, "qt-m-sheet"), `${label} is inside the sheet, not the page`);
  }
  const known = dom.all.find((e) => e.meta && /^Known \d+d$/.test(e.meta.text || ""));
  assert.ok(known, "the known-again action shows a day count");
  assert.ok(inside(known, "qt-m-sheet"), "Known Nd is in the sheet");
  assert.equal(dom.texts().some((t) => /^Skip \(/.test(t)), false, "the long Skip label is gone");

  assert.equal(cssDecl(".qt-mobile .qt-m-sheet", "display"), "none");
  assert.equal(cssDecl(".qt-mobile .qt-m-sheet.is-open", "display"), "flex");
  assert.equal(cssDecl(".qt-mobile .qt-m-sheet button", "width"), "100%", "sheet actions span the sheet");
  assert.equal(cssDecl(".qt-mobile .qt-m-sheet button", "white-space"), "nowrap", "labels cannot wrap into the browser bar");
  assert.ok(cssPx(".qt-mobile .qt-m-sheet button", "min-height") >= 44);
  assert.match(cssDecl(".qt-mobile .qt-m-sheet", "max-height") || "", /dvh$/, "the sheet is capped to the screen");
  assert.equal(cssDecl(".qt-mobile .qt-m-sheet", "overflow-y"), "auto", "a tall sheet scrolls instead of clipping");

  await clickElement(byClass(dom, "qt-m-more")[0]);
  assert.ok(sheet.classes.has("is-open"), "More opens the sheet");
  assert.ok(byClass(dom, "qt-m-sheet-backdrop")[0].classes.has("is-open"), "the backdrop opens with it");
});

/* ---- behavior 4: safe area + dvh ---- */
test("mobile 4: dvh sizing and safe-area padding, scoped to the phone layout", async () => {
  assert.equal(cssDecl(".qt-wrap.qt-mobile", "height"), "100dvh");
  assert.match(phoneRaw, /height:\s*100vh;/, "an older-WebView fallback is kept");
  assert.equal(cssDecl(".qt-wrap.qt-mobile", "max-height"), "100%", "dvh is capped to the leaf so nothing is pushed off-screen");
  assert.match(cssDecl(".qt-mobile .qt-m-answerbar", "padding") || "", /env\(safe-area-inset-bottom\)/, "the answer bar clears the home indicator");
  assert.match(cssDecl(".qt-mobile .qt-m-sheet", "padding") || "", /env\(safe-area-inset-bottom\)/, "the sheet clears the home indicator");
});

/* ---- behavior 5: one slim header ---- */
test("mobile 5: one header row with number, unit, timer, flag and menu", async () => {
  const { dom } = await setup(true);
  assert.equal(byClass(dom, "qt-m-bar").length, 1, "exactly one header bar");
  assert.equal(byClass(dom, "qt-qhead").length, 0, "no second question-number bar");
  assert.equal(dom.texts().includes("Practice"), false, "no in-view Practice title block");
  for (const cls of ["qt-m-qnum", "qt-meta", "qt-timer-wrap", "qt-m-flag", "qt-m-more"]) {
    const el = byClass(dom, cls)[0];
    assert.ok(el, `${cls} renders`);
    assert.ok(inside(el, "qt-m-bar"), `${cls} sits in the one header row`);
  }
  const timerWrap = byClass(dom, "qt-timer-wrap")[0];
  const pause = dom.all.find((e) => e.classes.has("qt-icon-btn") && ancestorChain(e).includes(timerWrap));
  assert.ok(pause, "the timer carries a pause/resume control");
  assert.ok(inside(pause, "qt-m-bar"), "the timer's pause control is in the bar");
});

/* ---- behavior 6: one visible pane, so no nested scrolling ---- */
test("mobile 6: only one pane is visible at a time", async () => {
  const { dom } = await setup(true);
  const left = byClass(dom, "qt-pane-left")[0];
  const right = byClass(dom, "qt-pane-right")[0];
  assert.equal(right.classes.has("is-hidden"), false, "the question starts visible");
  assert.equal(left.classes.has("is-hidden"), true, "the passage starts hidden behind its tab");
  assert.equal([left, right].filter((p) => !p.classes.has("is-hidden")).length, 1);

  await dom.click("Passage");
  assert.equal(left.classes.has("is-hidden"), false);
  assert.equal(right.classes.has("is-hidden"), true, "the question pane is removed while reading the passage");
  assert.equal([left, right].filter((p) => !p.classes.has("is-hidden")).length, 1);

  await dom.click("Question");
  assert.equal(right.classes.has("is-hidden"), false);
  assert.equal(left.classes.has("is-hidden"), true);
});

/* ---- behavior 7: short labels and 44px+ targets ---- */
test("mobile 7: short labels and touch targets of at least 44px", async () => {
  const { dom } = await setup(true);
  assert.ok(dom.texts().includes("Skip"));
  assert.ok(dom.texts().includes("How sure?"), "the confidence prompt is shortened");
  assert.equal(dom.texts().includes("How sure are you?"), false);
  assert.equal(dom.texts().some((t) => t.startsWith("Skip (")), false);

  const targets = [
    [".qt-mobile .qt-m-bar .qt-icon-btn", 44],
    [".qt-mobile .qt-m-tab", 44],
    [".qt-mobile .qt-choice", 56],
    [".qt-mobile .qt-m-answerbar .qt-conf", 44],
    [".qt-mobile .qt-m-answerbar .qt-submit", 48],
    [".qt-mobile .qt-m-sheet button", 44],
  ];
  for (const [selector, min] of targets) {
    const value = cssPx(selector, "min-height");
    assert.ok(value >= min, `${selector} is ${value}px, expected >= ${min}px`);
  }
  assert.equal(cssDecl(".qt-mobile .qt-m-answerbar .qt-submit", "width"), "100%", "Submit spans the answer bar");
  assert.ok(cssPx(".qt-mobile .qt-m-bar .qt-icon-btn", "min-width") >= 44);
});

/* ---- desktop protection: every phone rule is prefixed ---- */
test("every rule in the phone block is scoped, so desktop CSS cannot change", async () => {
  assert.ok(phoneRules.length > 15, "the phone block was found");
  for (const rule of phoneRules) {
    for (const selector of rule.selectors) {
      assert.ok(
        selector === ".qt-wrap.qt-mobile" || selector.startsWith(".qt-mobile "),
        `unscoped phone rule would leak into desktop: ${selector}`
      );
    }
  }
  assert.equal(
    stylesheet.split(".qt-mobile").length,
    phoneRaw.split(".qt-mobile").length,
    "all .qt-mobile styles live in the phone block"
  );
});

test("mobile practice: passage becomes a tab and the question gets the screen", async () => {
  const { dom } = await setup(true);
  assert.ok(byClass(dom, "qt-mobile").length, "the phone layout is opt-in via Platform.isMobile");
  assert.equal(byClass(dom, "qt-qhead").length, 0, "the separate question-number row is gone");
  assert.equal(dom.texts().includes("Skip (don't log)"), false, "the long skip label is gone");
  assert.ok(dom.texts().includes("Passage") && dom.texts().includes("Question"), "both tabs are offered");

  const right = byClass(dom, "qt-pane-right")[0];
  await dom.click("Passage");
  assert.ok(right.classes.has("is-hidden"), "the question pane hides on the passage tab");
  assert.equal(byClass(dom, "qt-pane-left")[0].classes.has("is-hidden"), false);
});

test("mobile practice: confidence and Submit wait for an answer, then gate Submit", async () => {
  const { dom } = await setup(true);
  const bar = byClass(dom, "qt-m-answerbar")[0];
  const submit = dom.all.find((el) => el.meta && el.meta.text === "Submit");
  assert.ok(bar, "an answer bar exists");
  assert.equal(bar.classes.has("is-armed"), false, "the bar stays hidden before a choice");
  assert.equal(submit.disabled, true, "Submit starts disabled");

  await clickElement(byClass(dom, "qt-choice")[1]); // choice B
  assert.ok(bar.classes.has("is-armed"), "picking a choice reveals the bar");
  assert.equal(submit.disabled, true, "confidence is still required");

  await clickElement(byClass(dom, "qt-conf")[1]); // Unsure
  assert.equal(submit.disabled, false, "Submit enables once an answer and confidence exist");
});

test("mobile practice: secondary actions live in the More sheet, not the footer", async () => {
  const { dom, view } = await setup(true);
  assert.equal(byClass(dom, "qt-ctl").length, 0, "the desktop control column is not rendered");
  const sheet = byClass(dom, "qt-m-sheet")[0];
  assert.ok(sheet, "a More sheet exists");
  for (const label of ["Skip", "Don't know", "Bury", "Suspend", "Exclude", "End session"]) {
    assert.ok(dom.texts().includes(label), `${label} is in the sheet`);
  }

  await clickElement(byClass(dom, "qt-m-more")[0]);
  assert.ok(sheet.classes.has("is-open"), "the More button opens the sheet");

  let advanced = 0;
  view.next = async () => {
    advanced += 1;
  };
  const skip = dom.all.find((el) => el.meta && el.meta.text === "Skip");
  await clickElement(skip);
  assert.equal(advanced, 1, "Skip still advances");
  assert.equal(sheet.classes.has("is-open"), false, "the sheet closes after an action");
});

test("the same question renders a different screen for mobile and desktop", async () => {
  const phone = await setup(true);
  const laptop = await setup(false);
  const classes = (dom) => {
    const set = new Set();
    for (const el of dom.all) if (el.classes) for (const c of el.classes) set.add(c);
    return set;
  };
  const phoneClasses = classes(phone.dom);
  const laptopClasses = classes(laptop.dom);
  for (const cls of ["qt-mobile", "qt-m-bar", "qt-m-tabs", "qt-m-scroll", "qt-m-answerbar", "qt-m-sheet"]) {
    assert.ok(phoneClasses.has(cls), `mobile is built from ${cls}`);
    assert.equal(laptopClasses.has(cls), false, `desktop never gets ${cls}`);
  }
  for (const cls of ["qt-qhead", "qt-ctl", "qt-foot-left"]) {
    assert.ok(laptopClasses.has(cls), `desktop is built from ${cls}`);
    assert.equal(phoneClasses.has(cls), false, `mobile never gets ${cls}`);
  }
});

test("desktop practice keeps its split, footer controls and long labels", async () => {
  const { dom } = await setup(false);
  assert.equal(byClass(dom, "qt-mobile").length, 0);
  assert.equal(byClass(dom, "qt-qhead").length, 1, "the question-number row is unchanged");
  assert.ok(dom.texts().includes("Skip (don't log)"));
  assert.equal(byClass(dom, "qt-m-answerbar").length, 0);
  assert.equal(dom.texts().includes("How sure are you?"), true);
});
