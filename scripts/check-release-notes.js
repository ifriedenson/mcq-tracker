#!/usr/bin/env node
"use strict";
/*
 * Ties the release records together: the version in manifest.json, the version
 * in package.json, the versions.json entry Obsidian reads, the notes file in
 * docs/release-notes/ and the git tag the release workflow creates.
 *
 * 1.307.20 is why this exists. Its notes were written, its manifest said
 * 1.307.20 and its bundle was built on the PDF-import branch, but the branch was
 * merged as 1.307.21, so no tag and no release were ever created for it and the
 * release list has a hole. Nothing failed, because nothing looked at the notes
 * folder. `npm run check` runs this, and the release workflow runs `npm run
 * check` before it publishes.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const NOTES = path.join(ROOT, "docs", "release-notes");

// Versions that predate this check are grandfathered: their notes were written
// for numbers folded into a later release (1.307.20 shipped inside 1.307.21),
// and no tag or release can honestly be reconstructed for them now. Everything
// after this number has to match.
const GRANDFATHERED_THROUGH = "1.307.21";

const failures = [];

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, name), "utf8"));
}

function compare(a, b) {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let i = 0; i < 3; i += 1) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return 0;
}

let tags = [];
try {
  tags = execFileSync("git", ["tag", "-l"], { cwd: ROOT, encoding: "utf8" })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
} catch (err) {
  console.warn(`release records: git tags are unavailable (${err.message.split("\n")[0]}), orphan check skipped`);
}
const tagged = new Set(tags);

const manifest = readJson("manifest.json");
const pkg = readJson("package.json");
const versions = readJson("versions.json");
const version = manifest.version;

if (pkg.version !== version) {
  failures.push(`package.json is ${pkg.version} and manifest.json is ${version}; bump both with the same release`);
}
if (!Object.prototype.hasOwnProperty.call(versions, version)) {
  failures.push(`versions.json has no entry for ${version}; add "${version}": "${manifest.minAppVersion}"`);
} else if (versions[version] !== manifest.minAppVersion) {
  failures.push(`versions.json says ${version} needs Obsidian ${versions[version]}, manifest.json says ${manifest.minAppVersion}`);
}
if (!fs.existsSync(path.join(NOTES, `${version}.md`))) {
  failures.push(`docs/release-notes/${version}.md is missing; a release publishes that file as its notes`);
}

if (tags.length) {
  for (const file of fs.readdirSync(NOTES)) {
    if (!file.endsWith(".md")) continue;
    const notesVersion = file.slice(0, -3);
    if (!/^\d+\.\d+\.\d+$/.test(notesVersion)) continue;
    // The version being released right now is tagged by the release workflow
    // after this check runs, so it is not an orphan yet.
    if (notesVersion === version || tagged.has(notesVersion)) continue;
    const text = fs.readFileSync(path.join(NOTES, file), "utf8");
    const folded = /^Folded into: (\d+\.\d+\.\d+)\b/m.exec(text);
    if (folded && tagged.has(folded[1])) continue;
    if (compare(notesVersion, GRANDFATHERED_THROUGH) <= 0) continue;
    failures.push(
      `docs/release-notes/${file} is ${notesVersion}, which has no git tag and no release; ` +
        `tag it, or say where its work shipped with a line "Folded into: <version>"`
    );
  }
}

if (failures.length) {
  for (const failure of failures) console.error(`release records: ${failure}`);
  process.exit(1);
}

console.log(
  `release records agree: ${version} is in manifest.json, package.json, versions.json and docs/release-notes` +
    (tagged.has(version) ? `, and tagged.` : `; the release workflow tags it.`)
);
