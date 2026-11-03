"use strict";

const SAT_SELECTOR = '.callout[data-callout="sat"]';
const MARKED_CLASS = "qt-sat-marked";
const TOGGLE_SELECTOR = ".callout-content > ul:first-child > li";

function isMarked(item) {
  if (!item) return false;
  if (item.getAttribute && item.getAttribute("data-task") === "x") return true;
  if (typeof item.querySelector !== "function") return false;
  const input = item.querySelector('input[type="checkbox"]');
  return !!(input && input.checked);
}

function syncSatCallout(callout) {
  if (!callout || typeof callout.querySelector !== "function") return false;
  const marked = isMarked(callout.querySelector(TOGGLE_SELECTOR));
  if (callout.classList && typeof callout.classList.toggle === "function") {
    callout.classList.toggle(MARKED_CLASS, marked);
  }
  return marked;
}

function syncSatCallouts(root) {
  if (!root || typeof root.querySelectorAll !== "function") return 0;
  let count = 0;
  if (typeof root.matches === "function" && root.matches(SAT_SELECTOR)) {
    syncSatCallout(root);
    count += 1;
  }
  for (const callout of root.querySelectorAll(SAT_SELECTOR)) {
    syncSatCallout(callout);
    count += 1;
  }
  return count;
}

module.exports = { SAT_SELECTOR, MARKED_CLASS, syncSatCallout, syncSatCallouts };
