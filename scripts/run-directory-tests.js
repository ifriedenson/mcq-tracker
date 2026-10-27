#!/usr/bin/env node
"use strict";
// Runs the whole test suite against the directory build (dist/directory/main.js).
const { spawnSync } = require("child_process");
const path = require("path");
const root = path.join(__dirname, "..");
const r = spawnSync(process.execPath, ["--test"], {
  cwd: root,
  stdio: "inherit",
  env: Object.assign({}, process.env, { MCQ_MAIN: path.join("dist", "directory", "main.js"), MCQ_LITE: "1" }),
});
process.exit(r.status === null ? 1 : r.status);
