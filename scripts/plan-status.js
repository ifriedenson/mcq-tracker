#!/usr/bin/env node
"use strict";
/*
 * Keeps the status block at the top of plan.md honest against the repository.
 *
 *   node scripts/plan-status.js                      check (used by `npm run check`)
 *   node scripts/plan-status.js --write              rewrite it from manifest/src/main.js
 *   node scripts/plan-status.js --write --run-tests  run `node --test` first and record the count
 *
 * The block is the **Status** line, the row-count line, the **Verified at this
 * commit** paragraph and the §11 sweep-result line. The date is written but
 * never checked, so the check does not fail the day after a release. The test
 * count can only come from a real run (--run-tests) or --tests; the suite
 * cannot count itself, so the count is checked only when --tests is passed.
 *
 * Plain Node, no dependencies, matching the rest of scripts/.
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.join(__dirname, "..");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const STATUS_RE = /^\*\*Status: v([0-9]+\.[0-9]+\.[0-9]+) \(([A-Z][a-z]{2} [0-9]{1,2}, [0-9]{4})\)\.\*\*/m;
const COUNTS_RE = /^\*\*\d+ unchecked rows, \d+ partial\/gated rows(?:, no locally implementable row left open)?\.\*\*$/m;
const VERIFIED_RE = /\*\*Verified at this commit:\*\*[\s\S]*?Re-run both before quoting these numbers\./;
const SWEEP_PREFIX_RE = /^\*\*Sweep result \([A-Z][a-z]{2} [0-9]{1,2}, [0-9]{4}\)\.\*\*/;
const SWEEP_NUMBERS_RE = /\*\*(\d+) checked `\[x\]` roadmap rows, (\d+) `\[~\]` partial\/blocked rows and (\d+) unchecked `\[ \]` rows\*\*/;

const USAGE = `Usage: node scripts/plan-status.js [--write] [--run-tests] [--tests N] [--date YYYY-MM-DD]

  (no flag)    check plan.md against manifest.json, src/, vendor/ and main.js
  --write      rewrite the status block from the repository
  --run-tests  run node --test and record its pass/fail counts (with --write)
  --tests N    record N instead of running the suite
  --date DATE  date to write in the block (default: today)`;

function formatNumber(value) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function parseNumber(value) {
  return Number(String(value).replace(/,/g, ""));
}

function formatDate(date) {
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function parseDateArg(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** Counts checkbox rows at the start of a line; prose that mentions `- [ ]` is ignored. */
function countRows(text) {
  const counts = { checked: 0, partial: 0, unchecked: 0 };
  for (const line of text.split("\n")) {
    if (line.startsWith("- [x]")) counts.checked += 1;
    else if (line.startsWith("- [~]")) counts.partial += 1;
    else if (line.startsWith("- [ ]")) counts.unchecked += 1;
  }
  return counts;
}

/** The §11 sweep line is the one carrying the current roadmap counts. */
function findSweepLine(text) {
  for (const line of text.split("\n")) {
    if (line.startsWith("**Sweep result (") && line.includes("roadmap rows")) return line;
  }
  return null;
}

/** Reads the recorded status block; null when any anchor is missing. */
function readPlan(text) {
  const status = STATUS_RE.exec(text);
  const counts = COUNTS_RE.exec(text);
  const verified = VERIFIED_RE.exec(text);
  const sweepLine = findSweepLine(text);
  if (!status || !counts || !verified || !sweepLine) return null;

  const tests = /→ ([\d,]+) tests pass, (\d+) fail/.exec(verified[0]);
  const files = /across ([\d,]+) source files/.exec(verified[0]);
  const bundle = /from ([\d,]+) modules at ([\d,]+) bytes/.exec(verified[0]);
  const sweepCounts = SWEEP_NUMBERS_RE.exec(sweepLine);
  const lineCounts = /^\*\*(\d+) unchecked rows, (\d+) partial\/gated rows/.exec(counts[0]);
  if (!tests || !files || !bundle || !sweepCounts || !lineCounts) return null;

  return {
    version: status[1],
    date: status[2],
    statusCounts: { unchecked: Number(lineCounts[1]), partial: Number(lineCounts[2]) },
    verified: {
      tests: parseNumber(tests[1]),
      fail: Number(tests[2]),
      srcFiles: parseNumber(files[1]),
      modules: parseNumber(bundle[1]),
      bytes: parseNumber(bundle[2]),
    },
    sweep: {
      checked: Number(sweepCounts[1]),
      partial: Number(sweepCounts[2]),
      unchecked: Number(sweepCounts[3]),
    },
    rows: countRows(text),
  };
}

function renderStatus(values) {
  const counts = `**${values.unchecked} unchecked rows, ${values.partial} partial/gated rows${values.unchecked === 0 ? ", no locally implementable row left open" : ""}.**`;
  const verified = [
    `**Verified at this commit:** \`node --test\` → ${formatNumber(values.tests)} tests pass, ${values.fail} fail;`,
    `\`npm run check\` clean (no dynamic code across ${formatNumber(values.srcFiles)} source files, vendor guard,`,
    `bundle up to date); \`main.js\` generated from ${formatNumber(values.modules)} modules at ${formatNumber(values.bytes)} bytes.`,
    "Re-run both before quoting these numbers.",
  ].join("\n");
  return {
    status: `**Status: v${values.version} (${values.date}).**`,
    counts,
    verified,
    sweepPrefix: `**Sweep result (${values.date}).**`,
    sweepNumbers: `**${values.checked} checked \`[x]\` roadmap rows, ${values.partial} \`[~]\` partial/blocked rows and ${values.unchecked} unchecked \`[ ]\` rows**`,
  };
}

/** Replaces the four anchors; reports any that are missing instead of guessing. */
function applyStatus(text, lines) {
  const missing = [];
  let out = text;
  const swap = (pattern, next, label) => {
    if (!pattern.test(out)) {
      missing.push(label);
      return;
    }
    out = out.replace(pattern, () => next);
  };
  swap(STATUS_RE, lines.status, "Status line");
  swap(COUNTS_RE, lines.counts, "row-count line");
  swap(VERIFIED_RE, lines.verified, "Verified paragraph");

  // The sweep line carries the date, the counts and free-form notes, so only
  // the first two are rewritten; the notes stay as written.
  const sweepLine = findSweepLine(out);
  const prefix = sweepLine ? SWEEP_PREFIX_RE.exec(sweepLine) : null;
  const numbers = sweepLine ? SWEEP_NUMBERS_RE.exec(sweepLine) : null;
  if (!sweepLine || !prefix || !numbers) {
    missing.push("Sweep result line");
  } else {
    const rest = sweepLine.slice(prefix[0].length).replace(numbers[0], lines.sweepNumbers);
    out = out.replace(sweepLine, `${lines.sweepPrefix}${rest}`);
  }
  return { text: out, missing };
}

/** Compares the recorded block to the repository. `expected.tests` is optional. */
function checkPlan(planText, expected) {
  const current = readPlan(planText);
  if (!current) {
    return {
      ok: false,
      problems: [
        "the status block could not be parsed; restore the Status line, the row-count line, the Verified paragraph and the Sweep result line",
      ],
    };
  }
  const problems = [];
  if (current.version !== expected.version) {
    problems.push(`version is v${current.version}, manifest.json is v${expected.version}`);
  }
  if (current.statusCounts.unchecked !== expected.unchecked) {
    problems.push(`row-count line says ${current.statusCounts.unchecked} unchecked, the plan has ${expected.unchecked}`);
  }
  if (current.statusCounts.partial !== expected.partial) {
    problems.push(`row-count line says ${current.statusCounts.partial} partial, the plan has ${expected.partial}`);
  }
  if (current.sweep.checked !== expected.checked) {
    problems.push(`sweep line says ${current.sweep.checked} checked, the plan has ${expected.checked}`);
  }
  if (current.sweep.partial !== expected.partial) {
    problems.push(`sweep line says ${current.sweep.partial} partial, the plan has ${expected.partial}`);
  }
  if (current.sweep.unchecked !== expected.unchecked) {
    problems.push(`sweep line says ${current.sweep.unchecked} unchecked, the plan has ${expected.unchecked}`);
  }
  if (current.verified.srcFiles !== expected.srcFiles) {
    problems.push(`source file count is ${current.verified.srcFiles}, src/ has ${expected.srcFiles}`);
  }
  if (current.verified.modules !== expected.modules) {
    problems.push(`module count is ${current.verified.modules}, the build has ${expected.modules}`);
  }
  if (current.verified.bytes !== expected.bytes) {
    problems.push(`bundle size is ${current.verified.bytes}, main.js is ${expected.bytes}`);
  }
  if (expected.tests !== undefined && current.verified.tests !== expected.tests) {
    problems.push(`test count is ${current.verified.tests}, the run reported ${expected.tests}`);
  }
  return { ok: problems.length === 0, problems };
}

function collectRepoStatus(planText) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  const srcDir = path.join(root, "src");
  const vendorDir = path.join(root, "vendor");
  const countJs = (dir) =>
    fs.existsSync(dir) ? fs.readdirSync(dir).filter((file) => file.endsWith(".js")).length : 0;
  const srcFiles = countJs(srcDir);
  return {
    version: manifest.version,
    srcFiles,
    modules: srcFiles + countJs(vendorDir),
    bytes: fs.statSync(path.join(root, "main.js")).size,
    ...countRows(planText),
  };
}

function runSuite() {
  const result = spawnSync(process.execPath, ["--test", "--test-reporter=tap"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${result.stdout || ""}\n${result.stderr || ""}`;
  const pass = /^# pass (\d+)$/m.exec(output);
  const fail = /^# fail (\d+)$/m.exec(output);
  if (!pass || !fail) {
    return { error: "could not read the pass/fail counts from `node --test --test-reporter=tap`", output };
  }
  return { tests: Number(pass[1]), fail: Number(fail[1]) };
}

function optionValue(argv, name) {
  const index = argv.indexOf(name);
  return index === -1 ? null : argv[index + 1] ?? "";
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help")) {
    console.log(USAGE);
    return 0;
  }

  const planPath = path.join(root, "plan.md");
  const planText = fs.readFileSync(planPath, "utf8");
  const existing = readPlan(planText);
  const repo = collectRepoStatus(planText);
  const date = parseDateArg(optionValue(argv, "--date")) || new Date();
  const testsArg = optionValue(argv, "--tests");

  let tests = existing ? existing.verified.tests : null;
  let fail = existing ? existing.verified.fail : 0;
  if (testsArg !== null) {
    if (!/^[\d,]+$/.test(testsArg)) {
      console.error(`--tests expects a whole number, got '${testsArg}'.`);
      return 1;
    }
    tests = parseNumber(testsArg);
  }
  if (argv.includes("--run-tests")) {
    const run = runSuite();
    if (run.error) {
      console.error(run.error);
      return 1;
    }
    if (run.fail !== 0) {
      console.error(`the suite has ${run.fail} failing test(s); fix them before recording the status.`);
      return 1;
    }
    tests = run.tests;
    fail = run.fail;
  }

  const values = {
    version: repo.version,
    date: formatDate(date),
    checked: repo.checked,
    partial: repo.partial,
    unchecked: repo.unchecked,
    srcFiles: repo.srcFiles,
    modules: repo.modules,
    bytes: repo.bytes,
  };

  if (argv.includes("--write")) {
    if (tests === null) {
      console.error("no test count to write: pass --tests N or --run-tests.");
      return 1;
    }
    const lines = renderStatus({ ...values, tests, fail });
    const { text, missing } = applyStatus(planText, lines);
    if (missing.length) {
      console.error(`plan.md is missing: ${missing.join(", ")}. Restore the status block first.`);
      return 1;
    }
    fs.writeFileSync(planPath, text);
    console.log(
      `plan.md status updated: v${values.version} (${values.date}), ${values.checked} checked / ${values.partial} partial / ${values.unchecked} unchecked, ${formatNumber(tests)} tests, ${formatNumber(values.srcFiles)} source files, ${formatNumber(values.bytes)} bytes.`
    );
    return 0;
  }

  const result = checkPlan(planText, {
    ...values,
    tests: testsArg === null ? undefined : tests,
  });
  if (!result.ok) {
    console.error("plan.md status is out of date:");
    for (const problem of result.problems) console.error(`  - ${problem}`);
    console.error("Run `npm run plan:status` after the version bump and commit plan.md with it.");
    return 1;
  }
  console.log(
    `plan status is current: v${repo.version}, ${repo.checked} checked / ${repo.partial} partial / ${repo.unchecked} unchecked.`
  );
  return 0;
}

module.exports = {
  applyStatus,
  checkPlan,
  collectRepoStatus,
  countRows,
  formatDate,
  formatNumber,
  readPlan,
  renderStatus,
};

if (require.main === module) process.exit(main());
