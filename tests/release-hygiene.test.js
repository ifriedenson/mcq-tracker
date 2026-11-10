"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");

test("the shipped bundle carries the optional desktop OpenCode installer", () => {
  const bundle = fs.readFileSync(path.join(root, "main.js"), "utf8");
  // This is an accepted tradeoff: the installer needs direct desktop access,
  // which Obsidian reports as a warning.
  for (const name of ["fs", "child_process"]) {
    assert.ok(bundle.includes(`require("${name}")`), `bundle must carry the optional ${name} access`);
  }
  assert.ok(bundle.includes("OpenCodeManager"), "the OpenCode installer must be bundled");
  assert.ok(bundle.includes("Download and install"), "the setup action must be reachable");
  assert.equal(bundle.includes("JSXGraph"), false, "the withdrawn JSXGraph runtime must not be bundled");
  assert.equal(bundle.includes("jsxgraph-core"), false, "the vendored JSXGraph file must not be bundled");
});

test("styles avoid browser features the release scanner flags", () => {
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  assert.equal(css.includes(":has("), false, "SAT layout must use sibling selectors, not :has");
  assert.equal(css.includes("column-gap"), false, "use the supported gap shorthand");
  assert.equal(css.includes("clip-path"), false, "clip-path is only partially supported by Obsidian 1.7.4");
  assert.equal(
    /text-decoration-(?:line|style|color|thickness)\s*:/.test(css),
    false,
    "use the text-decoration shorthand; the scanner flags its longhands",
  );
});

test("the manifest description passes the community listing rule", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  assert.equal(/obsidian/i.test(manifest.description), false, "the listing rejects the word Obsidian in the description");
  assert.ok(manifest.description.length > 40, "the description still explains the plugin");
});

test("the README describes the current build", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
  assert.ok(readme.includes(manifest.version), `README must name the current ${manifest.version} build`);
  assert.equal(readme.includes("1.294.0 build"), false, "README must not describe an older build");
});

test("styles avoid duplicate height declarations and !important", () => {
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  assert.equal(css.includes("!important"), false);
  const blocks = css.match(/\{[^}]*\}/g) || [];
  for (const block of blocks) {
    const heights = block.match(/[;{]\s*height\s*:/g) || [];
    assert.ok(heights.length <= 1, `duplicate height in ${block.slice(0, 80)}`);
  }
});

test("the version files agree on the release being shipped", () => {
  const read = (name) => JSON.parse(fs.readFileSync(path.join(root, name), "utf8"));
  const pkg = read("package.json");
  const manifest = read("manifest.json");
  const lock = read("package-lock.json");
  const versions = read("versions.json");
  assert.equal(manifest.version, pkg.version, "manifest.json and package.json must name the same version");
  assert.equal(lock.version, pkg.version, "package-lock.json must name the package version");
  assert.equal(lock.packages[""] && lock.packages[""].version, pkg.version, "the lockfile root must name the package version");
  assert.equal(versions[manifest.version], manifest.minAppVersion, "versions.json must carry the manifest's minimum app version");
  for (const [version, minApp] of Object.entries(versions)) {
    assert.match(version, /^\d+\.\d+\.\d+$/, `versions.json has a non-version key: ${version}`);
    assert.match(minApp, /^\d+\.\d+\.\d+$/, `versions.json has a non-version minimum for ${version}`);
  }
});
