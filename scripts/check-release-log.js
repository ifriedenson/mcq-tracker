#!/usr/bin/env node
"use strict";
/*
 * Checks that the three places a release is recorded by hand still agree
 * with each other: the newest entry in AGENTS.md, the newest entry in
 * CHANGELOG.md, and the newest file in docs/release-notes/ — all three
 * must name the packaged version, on the same date.
 *
 * A release here is four edits — the version bump, the note, the AGENTS
 * line, the CHANGELOG entry — and three of them are prose typed by a
 * person. check-release-notes.js already ties the note files to the tags;
 * this one ties the two logs nobody else reads for you. Older releases are
 * deliberately summarised rather than listed one by one (the AGENTS log
 * starts narrating at 1.168 and the CHANGELOG at 1.242), so only the
 * newest entry in each file is pinned: the one the next release has to
 * move.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

const version = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version;

function newestNote() {
  const dir = path.join(ROOT, "docs", "release-notes");
  const versions = fs.readdirSync(dir)
    .filter((name) => /^\d+\.\d+\.\d+\.md$/.test(name))
    .map((name) => name.slice(0, -3));
  return versions.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).pop();
}

const MONTHS = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

function newestAgents() {
  for (const line of fs.readFileSync(path.join(ROOT, "AGENTS.md"), "utf8").split(/\r?\n/)) {
    const match = /^\*\*(\d+\.\d+\.\d+) release \(([A-Z][a-z]{2}) (\d{1,2}), (\d{4})\)/.exec(line);
    if (match) {
      return {
        version: match[1],
        date: match[4] + "-" + MONTHS[match[2]] + "-" + String(match[3]).padStart(2, "0"),
      };
    }
  }
  return null;
}

function newestChangelog() {
  for (const line of fs.readFileSync(path.join(ROOT, "CHANGELOG.md"), "utf8").split(/\r?\n/)) {
    const match = /^## (\d+\.\d+\.\d+) - (\d{4}-\d{2}-\d{2})/.exec(line);
    if (match) return { version: match[1], date: match[2] };
  }
  return null;
}

const failures = [];
const note = newestNote();
const agents = newestAgents();
const changelog = newestChangelog();

if (!agents) failures.push("AGENTS.md has no `**X release (Mon D, YYYY)` entry");
if (!changelog) failures.push("CHANGELOG.md has no `## X - YYYY-MM-DD` entry");
if (note !== version) failures.push("newest release note is " + note + " but package.json is " + version);
if (agents && agents.version !== version) {
  failures.push("newest AGENTS.md entry is " + agents.version + " but package.json is " + version);
}
if (changelog && changelog.version !== version) {
  failures.push("newest CHANGELOG.md entry is " + changelog.version + " but package.json is " + version);
}
if (agents && changelog && agents.version === changelog.version && agents.date !== changelog.date) {
  failures.push("AGENTS.md says " + agents.version + " shipped " + agents.date +
    " but CHANGELOG.md says " + changelog.date);
}

if (failures.length) {
  console.error("check-release-log: the release records disagree\n");
  for (const failure of failures) console.error("  " + failure);
  console.error("\nWrite the missing log line before the release goes out, not after.");
  process.exit(1);
}

console.log("check-release-log: AGENTS.md, CHANGELOG.md and the notes agree on " + version + ".");
