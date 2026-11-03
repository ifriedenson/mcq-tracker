"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { MARKED_CLASS, syncSatCallout, syncSatCallouts } = require("../src/sat-callout");

function fakeCallout(task, checked) {
  const classes = new Set();
  const item = task === undefined ? null : {
    getAttribute: (name) => (name === "data-task" ? task : null),
    querySelector: () => (checked === undefined ? null : { checked }),
  };
  const callout = {
    classes,
    querySelector: (selector) => (selector === ".callout-content > ul:first-child > li" ? item : null),
    classList: {
      toggle: (name, on) => {
        if (on) classes.add(name);
        else classes.delete(name);
      },
    },
  };
  return callout;
}

test("SAT callout helper marks a checked first-line task", () => {
  const callout = fakeCallout("x");
  assert.equal(syncSatCallout(callout), true);
  assert.equal(callout.classes.has(MARKED_CLASS), true);
});

test("SAT callout helper also reads the checkbox state", () => {
  const callout = fakeCallout("", true);
  assert.equal(syncSatCallout(callout), true);
  assert.equal(callout.classes.has(MARKED_CLASS), true);
});

test("SAT callout helper clears the mark and tolerates a missing toggle", () => {
  const callout = fakeCallout("");
  assert.equal(syncSatCallout(callout), false);
  assert.equal(callout.classes.has(MARKED_CLASS), false);
  assert.equal(syncSatCallout(fakeCallout(undefined)), false);
  assert.equal(syncSatCallout(null), false);
});

test("SAT callout helper syncs a subtree and the root itself", () => {
  const first = fakeCallout("x");
  const second = fakeCallout("");
  const root = {
    matches: () => true,
    querySelector: first.querySelector,
    classList: first.classList,
    querySelectorAll: () => [second],
  };
  assert.equal(syncSatCallouts(root), 2);
  assert.equal(first.classes.has(MARKED_CLASS), true);
  assert.equal(second.classes.has(MARKED_CLASS), false);
});
