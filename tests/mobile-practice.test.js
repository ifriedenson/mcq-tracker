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
  obsidian.Platform.isPhone = false;
});

async function setup(mobile, phone = mobile, mobileView = true) {
  const app = makeApp([{ path: "Questions/mobile-1.md", fm: { answer: "B", choices: 4 }, text: NOTE }]);
  const plugin = new QT(app);
  await plugin.onload();
  const dom = makeDom();
  const view = new T.PracticeView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  const file = app.files[0];
  await view.loadQuestion({ file, fm: file.fm }, true);
  plugin.settings.mobilePracticeView = mobileView;
  obsidian.Platform.isMobile = mobile;
  obsidian.Platform.isPhone = phone;
  view.render();
  return { app, plugin, dom, view };
}

/* Load a question, answer it through the real submit path, and render the result. */
async function setupResult(options = {}) {
  const mobile = options.mobile !== false;
  const phone = options.phone === undefined ? mobile : options.phone;
  const answer = options.answer || "A";
  const result = await setup(mobile, phone, options.mobileView !== false);
  // Count only the result tree, not the question tree the fake DOM keeps from setup().
  result.dom = makeDom();
  result.view.contentEl = result.dom.root;
  result.view.sel = answer;
  result.view.conf = 2;
  await result.view.submit();
  return result;
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
  assert.ok(byClass(dom, "qt-m-sheet-section").length >= 3, "the sheet groups skip, set-aside and session actions");
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
  assert.ok(dom.texts().includes("More actions"));
  assert.ok(dom.texts().includes("Skip without logging"));
  assert.equal(byClass(dom, "qt-m-answerbar").length, 0);
  assert.equal(dom.texts().includes("How sure are you?"), true);
});

test("turning mobile view off gives an iPad and a phone the computer practice layout", async () => {
  const ipadDefault = await setup(true, false);
  assert.ok(byClass(ipadDefault.dom, "qt-mobile").length, "the iPad keeps the phone question screen by default");

  const ipad = await setup(true, false, false);
  assert.equal(byClass(ipad.dom, "qt-mobile").length, 0, "the iPad gets the computer question screen");
  assert.equal(byClass(ipad.dom, "qt-qhead").length, 1, "the desktop question header is used");
  assert.ok(ipad.dom.texts().includes("More actions"), "desktop labels return");
  assert.equal(byClass(ipad.dom, "qt-m-answerbar").length, 0, "no phone answer bar");

  const ipadResult = await setupResult({ mobile: true, phone: false, mobileView: false });
  assert.equal(byClass(ipadResult.dom, "qt-mobile").length, 0, "the iPad review is the shared desktop review");
  assert.equal(byClass(ipadResult.dom, "qt-banner").length, 1);
  assert.equal(byClass(ipadResult.dom, "qt-done").length, 1);

  const phone = await setup(true, true, false);
  assert.equal(byClass(phone.dom, "qt-mobile").length, 0, "a phone can choose the computer layout too");
  assert.equal(byClass(phone.dom, "qt-qhead").length, 1);

  const desktop = await setup(false, false, true);
  assert.equal(byClass(desktop.dom, "qt-mobile").length, 0, "desktop stays computer with mobile view on");
});

/* ---- review screen: the dedicated phone shell is a real branch, not CSS ---- */
test("mobile result: review has its own bar, Review | Passage tabs and one scroller", async () => {
  const { dom } = await setupResult();
  assert.equal(byClass(dom, "qt-mobile").length, 1, "the result root is the phone shell");
  assert.equal(byClass(dom, "qt-m-bar").length, 1, "one review header");
  assert.equal(byClass(dom, "qt-m-review-status")[0].meta.text, "Incorrect");
  assert.ok(dom.texts().includes("Review") && dom.texts().includes("Passage"), "both review tabs exist");

  const body = byClass(dom, "qt-m-review-scroll")[0];
  assert.ok(body, "the review body is a scroller");
  assert.equal(byClass(dom, "qt-m-review-scroll").length, 1, "exactly one review scroller");
  assert.equal(byClass(dom, "qt-review").length, 1, "the shared review content is reused");
  assert.ok(inside(byClass(dom, "qt-review")[0], "qt-m-review-scroll"), "review content is inside that scroller");
  assert.equal(byClass(dom, "qt-banner").length, 0, "the desktop result banner is not rendered");
  assert.equal(byClass(dom, "qt-res-actions").length, 0, "desktop result actions are not rendered");
  assert.equal(byClass(dom, "qt-done").length, 0, "the desktop Done button is not rendered");

  const left = byClass(dom, "qt-pane-left")[0];
  const right = byClass(dom, "qt-pane-right")[0];
  assert.equal(left.classes.has("is-hidden"), true, "the passage starts behind its tab");
  assert.equal(right.classes.has("is-hidden"), false, "the review starts visible");
  await dom.click("Passage");
  assert.equal(left.classes.has("is-hidden"), false);
  assert.equal(right.classes.has("is-hidden"), true, "the review pane hides while reading the passage");
  await dom.click("Review");
  assert.equal(right.classes.has("is-hidden"), false);
  assert.equal(left.classes.has("is-hidden"), true);
});

test("mobile result: bottom action bar and More sheet reach the same actions", async () => {
  const { app, dom, view } = await setupResult();
  const bar = byClass(dom, "qt-m-reviewbar")[0];
  assert.ok(bar, "a review action bar exists");
  const done = dom.all.find((el) => el.meta && el.meta.text === "Done" && inside(el, "qt-m-reviewbar"));
  const next = dom.all.find((el) => el.meta && el.meta.text === "Next question" && inside(el, "qt-m-reviewbar"));
  assert.ok(done, "Done is in the bottom bar");
  assert.ok(next, "Next question is in the bottom bar");

  await clickElement(byClass(dom, "qt-m-more")[0]);
  const sheet = byClass(dom, "qt-m-sheet")[0];
  assert.ok(sheet.classes.has("is-open"), "More opens the review sheet");
  for (const label of ["Open question note", "Exclude"]) {
    const el = dom.all.find((e) => e.meta && e.meta.text === label);
    assert.ok(el, `${label} exists`);
    assert.ok(inside(el, "qt-m-sheet"), `${label} is in the More sheet`);
  }
  assert.ok(dom.all.some((el) => el.meta && /^Known \d+d$/.test(el.meta.text || "") && inside(el, "qt-m-sheet")));

  await dom.click("Open question note");
  assert.equal(sheet.classes.has("is-open"), false, "the sheet closes after an action");
  assert.ok(app.opened.includes("Questions/mobile-1.md"), "Open note still opens the note");

  let advanced = 0;
  view.next = async () => {
    advanced += 1;
  };
  await clickElement(next);
  assert.equal(advanced, 1, "Next still advances");
  await clickElement(done);
  assert.equal(view.state, "idle", "Done returns to filters");
});

test("mobile result: safe-area action bar and narrow-width overflow contract", async () => {
  assert.equal(cssDecl(".qt-mobile .qt-m-review-scroll", "overflow-x"), "hidden");
  assert.equal(cssDecl(".qt-mobile .qt-m-review-scroll", "max-width"), "100%");
  assert.equal(cssDecl(".qt-mobile .qt-m-review-scroll", "min-width"), "0");
  assert.equal(cssDecl(".qt-mobile .qt-m-review-scroll .qt-notes", "width"), "100%");
  assert.equal(cssDecl(".qt-mobile .qt-m-review-scroll .qt-notes", "box-sizing"), "border-box");
  assert.equal(cssDecl(".qt-mobile .qt-m-review-scroll .qt-tag", "max-width"), "45%");
  assert.equal(cssDecl(".qt-mobile .qt-m-reviewbar .qt-m-review-next", "flex"), "1");
  assert.match(cssDecl(".qt-mobile .qt-m-reviewbar", "padding") || "", /env\(safe-area-inset-bottom\)/, "the action bar clears the home indicator");
  assert.ok(cssPx(".qt-mobile .qt-m-reviewbar button", "min-height") >= 44);

  for (const rule of phoneRules) {
    if (!rule.selectors.some((selector) => selector.includes("qt-m-review"))) continue;
    const width = rule.decls.width;
    if (width) assert.ok(/^(100%|auto)$/.test(width), `review rule has a fixed width: ${rule.selectors.join(", ")} ${width}`);
  }
});

test("desktop and tablet review keep the shared split with no mobile classes", async () => {
  for (const options of [{ mobile: false, phone: false }, { mobile: true, phone: false }]) {
    const { dom } = await setupResult(options);
    assert.equal(byClass(dom, "qt-mobile").length, 0);
    for (const cls of ["qt-m-bar", "qt-m-tabs", "qt-m-scroll", "qt-m-reviewbar", "qt-m-review-scroll", "qt-m-sheet"]) {
      assert.equal(byClass(dom, cls).length, 0, `shared review never gets ${cls}`);
    }
    assert.equal(byClass(dom, "qt-banner").length, 1, "the shared result banner remains");
    assert.equal(byClass(dom, "qt-res-actions").length, 1, "the shared result actions remain");
    assert.equal(byClass(dom, "qt-done").length, 1, "the shared Done button remains");
    assert.equal(byClass(dom, "qt-review").length, 1, "the review content remains");
  }
});
