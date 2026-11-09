"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();
const support = T.support;

test("support: feedback defaults to the Tally form and donation stays hidden until configured", () => {
  assert.equal(support.DEFAULT_SUPPORT.showLinks, true);
  assert.equal(support.DEFAULT_SUPPORT.feedbackUrl, support.DEFAULT_FEEDBACK_URL);
  assert.equal(support.DEFAULT_SUPPORT.donationUrl, "");
  assert.deepEqual(support.supportLinks({}), {
    feedback: support.DEFAULT_FEEDBACK_URL,
    donation: "",
  });
});

test("support: the old GitHub issue default upgrades to the Tally form", () => {
  const upgraded = support.migrateSupport({ feedbackUrl: support.LEGACY_FEEDBACK_URL });
  assert.equal(upgraded.feedbackUrl, "https://tally.so/r/PRDe1d");
  assert.equal(
    support.migrateSupport({ feedbackUrl: "https://example.com/feedback" }).feedbackUrl,
    "https://example.com/feedback",
    "a URL the user chose is kept"
  );
  assert.equal(
    support.migrateSupport({ showLinks: false, feedbackUrl: support.LEGACY_FEEDBACK_URL }).showLinks,
    false,
    "hiding the links is preserved"
  );
});

test("support: only http and https links are accepted, and links can be hidden", () => {
  const normalized = support.normalizeSupport({
    showLinks: false,
    feedbackUrl: "javascript:alert(1)",
    donationUrl: "https://example.com/support",
  });
  assert.equal(normalized.showLinks, false);
  assert.equal(normalized.feedbackUrl, "");
  assert.equal(normalized.donationUrl, "https://example.com/support");
  assert.deepEqual(support.supportLinks(normalized), { feedback: "", donation: "" });
  assert.deepEqual(
    support.supportLinks({ showLinks: true, feedbackUrl: "", donationUrl: "https://example.com/support" }),
    { feedback: "", donation: "https://example.com/support" }
  );
});
