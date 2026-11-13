"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// The failures below are local vault or settings writes: a raw runtime string
// ("EACCES: permission denied...") leaves the user with no idea what to do next.
// Modal forms cannot be driven by the fake DOM, so this guard pins the message
// each path renders. The behavioural tests cover the paths that can be driven.
const EXPECTED = [
  ["src/agent-view.js", "Could not insert the reply: ${errorDetail(error)}. The note was not changed; open it and try again."],
  ["src/assignments-modal.js", "Could not save the assignment: ${errorDetail(e)}. Your edits are still on the form"],
  ["src/calendar-view.js", "Could not add that .ics file: ${errorDetail(e)}. Check the file is a calendar export"],
  ["src/card-modal.js", "Could not create the card: ${errorDetail(e)}. Your fields are still filled in"],
  ["src/chat-panel.js", "Could not save the chat: ${errorDetail(e)}. The transcript is still here"],
  ["src/exam-modal.js", "Could not create the exam note: ${errorDetail(e)}. Your details are still on the form"],
  ["src/image-occlusion-modal.js", "Could not create the image occlusion cards: ${errorDetail(e)}. The image and masks are unchanged"],
  ["src/local-events-view.js", "Could not save the event: ${errorDetail(e)}. Your details are still on the form"],
  ["src/mixed-review.js", "Could not save this review: ${errorDetail(e)}. The review was not recorded"],
  ["src/plugin.js", "Could not undo that change: ${errorDetail(e)}. Nothing was changed; try again."],
  ["src/plugin.js", "Could not save the simple-quiz result: ${errorDetail(e)}. Your score is still on screen"],
  ["src/practice-view.js", "Could not save this review: ${errorDetail(e)}. The review was not recorded; press the grade again."],
  ["src/practice-view.js", "Could not update this item: ${errorDetail(e)}. Nothing was changed; try again."],
  ["src/practice-view.js", "Could not log this skip: ${errorDetail(e)}. Nothing was changed; try Skip again."],
  ["src/quick-ask-modal.js", "Could not insert the answer: ${errorDetail(e)}. The note was not changed"],
  ["src/settings-tab.js", "Could not check OpenCode: ${errorDetail(e)}. Check the program path below"],
  ["src/settings-tab.js", "OpenCode setup did not finish: ${errorDetail(e)}. Check the status below, then try again."],
  ["src/settings-tab.js", "Could not save that provider key: ${errorDetail(e)}. Check that OpenCode's config folder is writable"],
  ["src/study-status-modal.js", "Could not restore that item: ${errorDetail(e)}. Nothing was changed; try again."],
  ["src/table-controls-view.js", "The table action failed: ${errorDetail(error)}. Nothing was changed; try again."],
  ["src/calendar-view.js", "Could not open the class note: ${errorDetail(err)}. Check the note still exists in this vault"],
  ["src/calendar-view.js", "Could not add the resource to the class note: ${errorDetail(err)}. Check the resource is still attached"],
  ["src/calendar-settings.js", "Could not sync that schedule: ${errorDetail(e)}. Check the source still exists, then try again."],
  ["src/cards-view.js", "Could not save this review: ${errorDetail(e)}. The review was not recorded; press the grade again."],
  ["src/cards-view.js", "Could not update this card: ${errorDetail(e)}. Nothing was changed; try again."],
  ["src/plugin.js", "Could not check that answer by calculation: ${errorDetail(e)}. The note was not changed"],
  ["src/plugin.js", "Could not start the note quiz: ${errorDetail(e)}. Check the note has a quiz block"],
  ["src/plugin.js", "Could not export the archive: ${errorDetail(e)}. Check the destination folder is writable"],
  ["src/table-controls-view.js", "The table action failed: ${errorDetail(error)}. Nothing was changed; try again."],
];

// These notices sit on request paths (AI sends, calendar download, Text2Anki).
// Their upstream errors are already human-readable, and this pass does not
// change network behaviour, so they keep the shared message text.
const NETWORK = [
  "Quick Chat could not send.",
  "Could not download that calendar.",
  "Could not verify that answer.",
  "Text2Anki could not send the selection.",
  "new Notice(str(e && e.message ? e.message : e), 9000);",
];

test("notices: every local failure path keeps its operation and its next step", () => {
  for (const [file, fragment] of EXPECTED) {
    const text = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    assert.ok(text.includes(fragment), `${file} keeps: ${fragment}`);
  }
});

test("notices: no plugin notice interpolates a raw exception again", () => {
  const dir = path.join(__dirname, "..", "src");
  const offenders = [];
  for (const name of fs.readdirSync(dir).filter((entry) => entry.endsWith(".js"))) {
    const text = fs.readFileSync(path.join(dir, name), "utf8");
    text.split("\n").forEach((line, index) => {
      if (/new Notice\(\s*str\(\s*(?:e|err|error)[^)]*\)\s*(?:\|\||,)/.test(line)) offenders.push(`${name}:${index + 1}: ${line.trim()}`);
      if (/new Notice\(\s*(?:e|err|error)\.message/.test(line)) offenders.push(`${name}:${index + 1}: ${line.trim()}`);
    });
  }
  const stragglers = offenders.filter((line) => !NETWORK.some((allowed) => line.includes(allowed)));
  assert.deepEqual(stragglers, [], `raw exception notices remain:\n${stragglers.join("\n")}`);
  // Six matching lines for five patterns: the Quick Chat message appears once in
  // src/agent-view.js and once in src/quick-chat-modal.js.
  assert.equal(offenders.length, 6, `unexpected raw-notice count: ${offenders.length}`);
});
