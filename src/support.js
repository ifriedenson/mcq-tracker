"use strict";
/*
 * Optional feedback and donation links. These are plain external links, not a
 * survey client: nothing is opened, submitted or counted until the user clicks
 * one. The URLs live here so they can be changed without touching the UI.
 */
const { str } = require("./util");

const DEFAULT_FEEDBACK_URL = "https://github.com/ifriedenson/mcq-tracker/issues/new";
const DEFAULT_DONATION_URL = ""; // intentionally blank until the owner chooses a funding page

const DEFAULT_SUPPORT = {
  showLinks: true,
  feedbackUrl: DEFAULT_FEEDBACK_URL,
  donationUrl: DEFAULT_DONATION_URL,
};

function cleanUrl(value) {
  const url = str(value).trim();
  return /^https?:\/\//i.test(url) ? url : "";
}

function normalizeSupport(value) {
  const src = value && typeof value === "object" ? value : {};
  return {
    showLinks: src.showLinks !== false,
    feedbackUrl: src.feedbackUrl === undefined ? DEFAULT_FEEDBACK_URL : cleanUrl(src.feedbackUrl),
    donationUrl: src.donationUrl === undefined ? DEFAULT_DONATION_URL : cleanUrl(src.donationUrl),
  };
}

/** The links to show, or empty strings when the user has hidden them or left them blank. */
function supportLinks(settings) {
  const support = normalizeSupport(settings);
  if (!support.showLinks) return { feedback: "", donation: "" };
  return {
    feedback: cleanUrl(support.feedbackUrl),
    donation: cleanUrl(support.donationUrl),
  };
}

module.exports = {
  DEFAULT_FEEDBACK_URL,
  DEFAULT_DONATION_URL,
  DEFAULT_SUPPORT,
  cleanUrl,
  normalizeSupport,
  supportLinks,
};
