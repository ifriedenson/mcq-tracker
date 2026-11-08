"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const source = (file) => fs.readFileSync(path.join(root, "src", file), "utf8");

test("workflow views opt into the shared screen shell", () => {
  for (const file of [
    "cards-view.js",
    "assignments-view.js",
    "insights-view.js",
    "reference-view.js",
    "study-tools-view.js",
    "study-workspace-view.js",
    "study-stats-view.js",
    "review-calendar-view.js",
    "local-events-view.js",
    "pomodoro-view.js",
  ]) {
    assert.match(source(file), /qt-wrap[^"]*qt-screen/, `${file} does not use qt-screen`);
  }
});

test("Practice, Calendar and the timed test keep their dedicated layouts", () => {
  for (const file of ["practice-view.js", "calendar-view.js", "exam-view.js"]) {
    assert.doesNotMatch(source(file), /qt-screen/, `${file} should not inherit the workflow shell`);
  }
});

test("the shared shell responds to pane width and mobile mode", () => {
  assert.match(css, /\.qt-wrap\.qt-screen \{[^}]*container-name: qt-screen/s);
  assert.match(css, /@container qt-screen \(max-width: 760px\)/);
  assert.match(css, /@container qt-screen \(max-width: 460px\)/);
  assert.match(css, /body\.is-mobile \.qt-screen/);
});

test("workflow views share toolbars, tabs and compact summaries", () => {
  assert.match(css, /\.qt-screen \.qt-toolbar/);
  assert.match(css, /\.qt-screen \.qt-tabbar/);
  assert.match(css, /\.qt-screen \.qt-segmented/);
  assert.match(css, /\.qt-screen \.qt-summary-strip/);
  assert.match(css, /\.qt-screen \.qt-screen-head h2/);
  assert.match(css, /\.qt-screen \.qt-cards-stats > span/);
  assert.match(css, /\.qt-screen \.qt-study-card/);
  assert.match(css, /\.qt-screen \.qt-ref-tabs/);
});

test("study views use a view-specific root instead of the inline study-tools row", () => {
  for (const file of ["study-tools-view.js", "study-workspace-view.js"]) {
    assert.match(source(file), /qt-study-tools-view/, `${file} is missing its view root class`);
    assert.match(source(file), /removeClass\("qt-study-tools"\)/, `${file} does not clear the old root class`);
    assert.doesNotMatch(source(file), /addClass\("qt-study-tools"\)/, `${file} reuses the inline row class`);
  }
});

test("settings navigation stays usable in a narrow pane", () => {
  assert.match(css, /\.qt-settings-modules,\s*\.qt-settings-tabs \{[^}]*flex-wrap: nowrap/s);
  assert.match(css, /\.qt-settings-modules,\s*\.qt-settings-tabs \{[^}]*overflow-x: auto/s);
});

test("module polish keeps the primary action ahead of filters", () => {
  assert.match(source("today-view.js"), /qt-focus-options/);
  assert.match(source("today-view.js"), /qt-focus-log/);
  assert.match(source("cards-view.js"), /qt-cards-hero/);
  assert.match(source("cards-view.js"), /qt-cards-filters/);
  assert.match(css, /\.qt-today \.qt-focus-options \{[^}]*grid-template-columns: repeat\(3/s);
  assert.match(css, /\.qt-screen\.qt-study-tools-view-wrap \.qt-study-card > \.qt-study-card-action \{[^}]*min-height: 44px/s);
  assert.match(css, /\.qt-cards-hero \{[^}]*align-items: center/s);
  assert.match(css, /\.qt-cards-filters \{[^}]*grid-template-columns: repeat\(2/s);
  const cardsSource = source("cards-view.js");
  assert.ok(cardsSource.indexOf("qt-cards-hero") < cardsSource.indexOf("qt-cards-tools"), "the review hero precedes the toolbar in DOM order");
  assert.match(css, /\.qt-today \.qt-focus-options > button:not\(\.mod-cta\) \{[^}]*border: 1px solid/s);
});

test("SAT callouts render the Bluebook question chrome", () => {
  const satCss = css.slice(css.indexOf('.callout[data-callout="sat"] {'), css.indexOf("/* ---- first-run screen"));
  assert.ok(satCss.length > 1000, "the SAT callout styles are present");
  assert.doesNotMatch(satCss, /#[0-9a-f]{3,8}\b/i, "SAT callout chrome must use theme tokens");
  assert.match(css, /\.callout\[data-callout="sat"\]\s*\{[^}]*--sat-select: var\(--interactive-accent\)/s);
  assert.match(css, /\.callout\[data-callout="sat"\]\s*\{[^}]*--sat-marked: var\(--color-red\)/s);
  assert.match(css, /color: var\(--text-on-accent\)/);
  assert.match(css, /\.callout\[data-callout="sat"\] > \.callout-title::before \{[^}]*content: "Mark for Review"/s);
  assert.match(css, /\.callout\[data-callout="sat"\] > \.callout-title::after \{[^}]*content: "ABC"/s);
  assert.match(css, /data-callout-metadata~="marked"/);
  assert.match(css, /\.callout\[data-callout="sat"\] > \.callout-content > blockquote \{[^}]*float: left/s);
  assert.match(css, /counter\(sat-choice, upper-alpha\)/);
  assert.match(css, /\.callout\[data-callout="sat"\] > \.callout-content > ul:not\(:first-child\) > li\[data-task="x"\] \{[^}]*--sat-select/s);
  assert.match(css, /var\(--font-text, serif\)/);
  assert.match(css, /\.callout\[data-callout="sat"\] > \.callout-title > \.callout-fold \{[^}]*order: 3/s);
  assert.match(css, /@media \(max-width: 640px\) \{[\s\S]*?\.callout\[data-callout="sat"\] > \.callout-content > blockquote \{[^}]*float: none/s);
});

test("study agent keeps the empty state bounded and the persona visible at sidebar width", () => {
  const empty = (css.match(/\.qt-agent-empty \{[^}]*\}/s) || [])[0] || "";
  assert.match(empty, /margin:\s*auto/);
  assert.match(empty, /max-width:\s*32rem/);

  // The deck grows with its card and reserves the stack offset, so a long
  // suggestion cannot be clipped and the back cards never touch the pager.
  const deck = (css.match(/\.qt-agent-suggestion-deck \{[^}]*\}/s) || [])[0] || "";
  assert.match(deck, /display:\s*grid/, "the suggestion deck must size to its cards");
  assert.doesNotMatch(deck, /height:\s*\d+px/, "a fixed deck height clips longer suggestions");
  assert.match(deck, /padding-bottom:\s*12px/, "the stacked cards need room above the pager");
  assert.match(deck, /grid-template-rows:\s*minmax\(104px, max-content\)/, "the deck row grows with a long suggestion");
  const card = (css.match(/\.qt-agent-suggestion-card \{[^}]*\}/s) || [])[0] || "";
  assert.match(card, /grid-area:\s*1 \/ 1/);
  assert.match(card, /height:\s*auto/, "a long title grows the card instead of overflowing it");
  assert.match(card, /min-height:\s*104px/);
  const detailBlocks = css.match(/(?:^|\n)\.qt-agent-suggestion-detail \{[^}]*\}/g) || [];
  const detail = detailBlocks.find((block) => block.includes("display:")) || "";
  assert.match(detail, /display:\s*block/, "the full suggestion detail must stay readable");
  assert.doesNotMatch(detail, /-webkit-line-clamp|overflow:\s*hidden/, "the suggestion detail must not be truncated");
  assert.match(css, /\.qt-agent-suggestion-card:not\(\.is-active\) > \* \{[^}]*visibility:\s*hidden/s, "back-card labels must not paint through the active card");
  assert.match(empty, /width:\s*calc\(100% - 32px\)/);

  const narrow = css.slice(
    css.indexOf("@container (max-width: 420px)"),
    css.indexOf("@container (max-width: 340px)")
  );
  assert.ok(narrow.includes(".qt-agent-role"), "the 420 px controls block still names the persona");
  assert.doesNotMatch(narrow, /\.qt-agent-role\s*\{\s*display:\s*none/s);
  assert.match(narrow, /\.qt-agent-role\s*\{[^}]*max-width/s);

  const close = (css.match(/\.qt-chat-tab-close \{[^}]*\}/s) || [])[0] || "";
  assert.match(close, /opacity:\s*0/);
  assert.match(close, /pointer-events:\s*none/, "a hidden close control must not take the click");
  assert.match(css, /\.qt-chat-tab:hover \.qt-chat-tab-close,[\s\S]*?\.qt-chat-tab-close:focus-visible \{[^}]*opacity: 1;\s*pointer-events: auto;/s);
});

test("plugin UI keeps keyboard and touch affordances", () => {
  assert.match(css, /\.qt-pdf-sidebar-type\[role="button"\]\s*\{[^}]*cursor:\s*pointer/s);
  assert.match(
    css,
    /\.qt-pdf-sidebar-type\[role="button"\]:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--interactive-accent\)/s
  );
  assert.match(
    css,
    /@media \(hover: none\) \{[\s\S]*?\.qt-chat-tab-close \{[^}]*opacity: 1;[^}]*pointer-events: auto;/s
  );
  assert.match(css, /\.qt-agent-suggestion-dot::after \{[^}]*inset: -6px/s);
  assert.match(css, /\.qt-agent-composer:focus-within \{[^}]*border-color: var\(--interactive-accent\)/s);
  assert.match(css, /\.qt-hidden\.qt-hidden \{[^}]*display: none/s);
  assert.match(
    css,
    /\.qt-agent-suggestion-dot:focus-visible \{[^}]*outline: 2px solid var\(--interactive-accent\)/s
  );
});

test("long navigation is a compact picker instead of a clipped rail", () => {
  assert.match(source("settings-tab.js"), /qt-settings-module-picker/);
  assert.match(source("reference-view.js"), /qt-ref-picker/);
  assert.match(css, /\.qt-settings-modules \{\s*display: none/s);
  assert.match(css, /\.qt-settings-module-picker \{\s*display: block/s);
  assert.match(css, /\.qt-ref-tabs\.qt-small-row \{\s*display: none/s);
  assert.match(css, /\.qt-ref-picker \{\s*display: block/s);
});

test("audited surfaces wrap or scroll at a narrow width", () => {
  assert.match(css, /\.qt-pdf-editor-toolbar \{[^}]*flex-wrap:\s*wrap/s);
  assert.match(css, /\.qt-pdf-editor-row \{[^}]*flex-wrap:\s*wrap/s);
  assert.match(css, /\.qt-pdf-editor-file \{[^}]*word-break:\s*break-all/s);
  assert.match(css, /\.qt-pdf-sidebar-note \{[^}]*white-space:\s*pre-wrap/s);
  assert.match(css, /\.qt-settings-tabs \{\s*flex-wrap:\s*nowrap;\s*overflow-x:\s*auto/s);
  assert.match(css, /\.uni-study-slot \.dropdown \{\s*width:\s*100%/s);
});

test("the swept views keep wide content scrollable or stacked at 360px", () => {
  assert.match(css, /\.qt-screen \.qt-tabbar \{[^}]*flex-wrap:\s*nowrap;[^}]*overflow-x:\s*auto/s);
  assert.match(css, /\.qt-cards-row-title \{[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap/s);
  assert.match(css, /\.qt-ref-periodic-wrap \{[^}]*overflow-x:\s*auto/s);
  assert.match(css, /\.qt-time-blocks-grid \{\s*overflow-x:\s*auto/s);
  assert.match(css, /@media \(max-width: 700px\) \{[\s\S]*?\.qt-cards-hero \{[^}]*flex-direction:\s*column/s);
  assert.match(css, /@(media|container)[^{]*700px[\s\S]*?\.qt-assignment-overview \{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s);
});

test("the PDF reader stacks its fixed sidebar before the pane can overflow", () => {
  assert.match(css, /@media \(max-width: 700px\) \{\s*\.qt-pdf-ink-layout \{\s*flex-direction: column;/s);
  assert.match(
    css,
    /\.qt-pdf-ink-sidebar-host \{[^}]*flex: 0 1 auto;[^}]*width: 100%;[^}]*padding-left: 0;/s
  );
  assert.match(css, /\.qt-pdf-sidebar-note \{[^}]*overflow-wrap: anywhere/s);
  assert.match(css, /\.qt-pdf-tag \{[^}]*min-width: 0;[^}]*max-width: 100%;[^}]*overflow-wrap: anywhere/s);
});

test("the 360px study-stats floor is reset before the pane is that narrow", () => {
  assert.match(css, /\.qt-screen \.qt-study-stats-row \{[^}]*min-width: 360px/s, "wide table floor");
  assert.match(
    css,
    /@container qt-screen \(max-width: 460px\) \{[\s\S]*?\.qt-screen \.qt-study-stats-row \{[^}]*min-width: 0;/s,
    "the 460px container query must reset the floor before 360px"
  );
});
