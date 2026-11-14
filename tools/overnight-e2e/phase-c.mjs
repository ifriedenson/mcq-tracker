// Phase C: 40-file batch, reload mid-run, auto-resume, no duplicate notes.
import { execFile } from "node:child_process";
import fs from "node:fs";

const ROOT = "/workspace/chats/d88551267b6076e698552363";
const VAULT = process.env.HOME + "/e2e/vault";

function driver(...args) {
  return new Promise((resolve, reject) => {
    execFile("node", [ROOT + "/tools/overnight-e2e/driver.mjs", ...args], { timeout: 120000 }, (error, stdout, stderr) => {
      if (error) reject(new Error("driver " + args[0] + " failed: " + (stderr || error.message).slice(0, 300)));
      else resolve(stdout.trim());
    });
  });
}

const bulk = [];
for (let i = 1; i <= 40; i++) bulk.push(`Bulk/q${String(i).padStart(2, "0")}.pdf`);
const runId = await driver("start", ...bulk);
console.log("bulk run started:", runId);
console.log("waiting 25s, then reloading Obsidian mid-run...");
await new Promise((r) => setTimeout(r, 25000));
await driver("reload");
console.log("reloaded; waiting for the plugin to come back...");
for (let i = 0; i < 24; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  try {
    const probe = JSON.parse(await driver("probe"));
    if (probe.plugin) break;
  } catch (e) {
    /* still loading */
  }
}
console.log("plugin back; waiting for the morning log...");
const end = Date.now() + 12 * 60 * 1000;
for (;;) {
  await new Promise((r) => setTimeout(r, 10000));
  if (fs.existsSync(VAULT + "/Overnight import log.md")) break;
  if (Date.now() > end) throw new Error("timed out waiting for the bulk log");
}
const notes = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = dir + "/" + e.name;
    if (e.isDirectory()) walk(full);
    else if (/\.md$/.test(e.name)) notes.push(full);
  }
};
if (fs.existsSync(VAULT + "/Questions")) walk(VAULT + "/Questions");
const ids = [];
let unverified = 0;
for (const n of notes) {
  if (/good\.pdf$/.test(n) || /\/good\.pdf$/.test(n)) continue;
  const text = fs.readFileSync(n, "utf8");
  const qid = /^question_id: (.+)$/m.exec(text);
  if (qid) ids.push(qid[1].trim());
  const fm = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!fm || !/verified: true/.test(fm[1])) {
    unverified++;
    console.log("UNVERIFIED:", n);
  }
}
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
console.log(`bulk notes: ${notes.length} files, ${ids.length} ids, dupes: ${dupes.length}, unverified: ${unverified}`);
console.log("--- log tail ---");
console.log(fs.readFileSync(VAULT + "/Overnight import log.md", "utf8").split("\n").slice(0, 12).join("\n"));
if (dupes.length) throw new Error("duplicate notes: " + dupes.slice(0, 5).join(", "));
if (unverified) throw new Error(unverified + " notes never verified");
console.log("PHASE C: pass");
process.exit(0);
