// Phase F: drive the Flagged answers surface: open, re-check one, accept one,
// re-check all. Two notes are flagged on purpose (stored A, checker B).
import { execFile } from "node:child_process";

const ROOT = "/workspace/chats/d88551267b6076e698552363";

function driver(...args) {
  return new Promise((resolve, reject) => {
    execFile("node", [ROOT + "/tools/overnight-e2e/driver.mjs", ...args], { timeout: 120000 }, (error, stdout, stderr) => {
      if (error) reject(new Error("driver " + args[0] + " failed: " + (stderr || error.message).slice(0, 300)));
      else resolve(stdout.trim());
    });
  });
}

// Fresh matched notes first, so the flags below mirror a real mismatch:
// the note says A everywhere, the checker will say B.
await driver("eval", "window.localStorage.removeItem(Object.keys(window.localStorage).find((k) => /mcq-tracker-overnight-runs/.test(k)) || 'none')");
import fs from "node:fs";
const VAULT = process.env.HOME + "/e2e/vault";
for (const gone of ["Questions", "Overnight import log.md"]) fs.rmSync(VAULT + "/" + gone, { recursive: true, force: true });
const setupRun = await driver("start", "good.pdf", "Bulk/q01.pdf");
const setupEnd = Date.now() + 8 * 60 * 1000;
for (;;) {
  await new Promise((r) => setTimeout(r, 5000));
  if (fs.existsSync(VAULT + "/Overnight import log.md")) break;
  if (Date.now() > setupEnd) throw new Error("setup run never finished");
}
console.log("setup run finished:", setupRun);

const notes = JSON.parse(
  await driver(
    "eval",
    `(() => { const files = window.app.vault.getMarkdownFiles().map((f) => f.path).filter((p) => /\\.md$/i.test(p) && !/log\\.md$/i.test(p) && !/Start here/i.test(p));
      return JSON.stringify(files.slice(0, 4)); })()`
  )
);
if (notes.length < 2) throw new Error("need at least 2 question notes, saw " + notes.length);
console.log("using notes:", notes.slice(0, 2).join(", "));

// Flag two notes: the note says A, the checker will say B.
for (const path of notes.slice(0, 2)) {
  await driver(
    "eval",
    `(async () => { const p = window.app.plugins.plugins['mcq-tracker']; const T = p.constructor.__test;
      const file = window.app.vault.getAbstractFileByPath(${JSON.stringify(path)});
      await window.app.fileManager.processFrontMatter(file, (fm) => { fm.answer = "A"; fm.verified = false; fm.verification = "mismatch"; fm.verified_answer = "B"; fm.verified_by = "stand-in"; });
      const body = await window.app.vault.read(file);
      await window.app.vault.modify(file, body.split("**Correct Answer: B**").join("**Correct Answer: A**"));
      return "flagged"; })()`
  );
}
let flagged = JSON.parse(
  await driver("eval", `(async () => window.app.plugins.plugins['mcq-tracker'].flaggedAnswers().then((r) => JSON.stringify(r.map((x) => x.path))))()`)
);
if (flagged.length < 2) throw new Error("setup failed, flagged: " + JSON.stringify(flagged));
console.log("flagged:", flagged.length);

for (let i = 0; i < 5; i++) {
  await driver(
    "eval",
    `[...document.querySelectorAll('.qt-flagged-modal')].forEach((m) => { const c = [...m.querySelectorAll('button')].find((b) => b.textContent === 'Close'); if (c) c.click(); })`
  );
  await new Promise((r) => setTimeout(r, 800));
  const left = JSON.parse(await driver("eval", `document.querySelectorAll('.qt-flagged-modal').length`));
  if (!left) break;
}
await driver("eval", `window.app.plugins.plugins['mcq-tracker'].openFlaggedAnswers()`);
await new Promise((r) => setTimeout(r, 2000));
const SCOPE = `[...document.querySelectorAll('.qt-flagged-modal')].slice(-1)[0]`;
const scopeRows = async () => JSON.parse(await driver("eval", SCOPE + `.querySelectorAll('.qt-flagged-row').length`));
const scopeClick = async (label, row) => {
  const which = row === undefined ? "" : `[${row}]`;
  await driver(
    "eval",
    `[...${SCOPE}.querySelectorAll('.qt-flagged-row')]${which}.querySelectorAll('button') && [...[...${SCOPE}.querySelectorAll('.qt-flagged-row')]${which}.querySelectorAll('button')].find((b) => b.textContent === ${JSON.stringify(label)}).click()`
  );
};
let rows = await scopeRows();
console.log("surface rows:", rows);
if (rows !== 2) throw new Error("surface shows " + rows + " rows, expected 2");

// Open note: the first row's note opens in the workspace.
await scopeClick('Open note', 0);
await new Promise((r) => setTimeout(r, 1500));
const active = await driver(
  "eval",
  `(() => { const open = []; window.app.workspace.iterateAllLeaves((l) => { if (l && l.view && l.view.file) open.push(l.view.file.path); }); return JSON.stringify(open); })()`
);
console.log("open note landed on:", active);
if (!JSON.parse(active).includes(flagged[0])) throw new Error("Open note did not open the first flagged note: " + active);

// Re-check one: the checker still says B, so it stays flagged. Notices
// vanish after 4 s, so watch for both the row count and the notice.
await scopeClick('Re-check', 0);
let afterRecheck = "";
const reEnd = Date.now() + 20000;
for (;;) {
  rows = await scopeRows();
  afterRecheck = await driver("notices");
  if (rows === 2 && /Still flagged/i.test(afterRecheck)) break;
  if (Date.now() > reEnd) break;
  await new Promise((r) => setTimeout(r, 1000));
}
console.log("rows after re-check:", rows, "| notices:", afterRecheck.slice(0, 160));
if (rows !== 2) throw new Error("re-check changed the row count: " + rows);
if (!/Still flagged/i.test(afterRecheck)) throw new Error("no still-flagged notice");

// Accept one: the second row's stored answer stands and the row clears.
await scopeClick('Accept stored', 1);
await new Promise((r) => setTimeout(r, 3000));
rows = await scopeRows();
console.log("rows after accept:", rows);
if (rows !== 1) throw new Error("accept did not clear the row: " + rows);

// Re-check all with one row left: it stays flagged, the outcome is honest.
await driver("eval", `[...` + SCOPE + `.querySelectorAll('button')].find((b) => b.textContent === 'Re-check all').click()`);
let afterAll = "";
const allEnd = Date.now() + 25000;
for (;;) {
  rows = await scopeRows();
  afterAll = await driver("notices");
  if (rows === 1 && /still flagged/i.test(afterAll)) break;
  if (Date.now() > allEnd) break;
  await new Promise((r) => setTimeout(r, 1000));
}
console.log("rows after re-check all:", rows, "| notices:", afterAll.slice(0, 160));
if (rows !== 1) throw new Error("re-check all changed the row count: " + rows);
if (!/still flagged/i.test(afterAll)) throw new Error("no still-flagged notice after re-check all");
await driver("eval", `[...` + SCOPE + `.querySelectorAll('button')].find((b) => b.textContent === 'Close').click()`);
console.log("PHASE F: pass");
process.exit(0);
