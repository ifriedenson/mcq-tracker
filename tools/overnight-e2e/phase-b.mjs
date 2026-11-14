// Phase B: clean 3-file overnight run with per-file evidence from disk.
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

function wipe(paths) {
  for (const p of paths) fs.rmSync(VAULT + "/" + p, { recursive: true, force: true });
}
wipe(["Questions", "Overnight import log.md"]);
await driver("eval", "window.localStorage.removeItem(Object.keys(window.localStorage).find((k) => /mcq-tracker-overnight-runs/.test(k)) || 'none')");
console.log("vault wiped");

const runId = await driver("start", "good.pdf", "broken.pdf", "locked.pdf");
console.log("run started:", runId);
const end = Date.now() + 8 * 60 * 1000;
for (;;) {
  await new Promise((r) => setTimeout(r, 5000));
  if (fs.existsSync(VAULT + "/Overnight import log.md")) break;
  if (Date.now() > end) throw new Error("timed out waiting for the log note");
}
const log = fs.readFileSync(VAULT + "/Overnight import log.md", "utf8");
console.log("--- log note ---");
console.log(log);
const notes = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = dir + "/" + e.name;
    if (e.isDirectory()) walk(full);
    else if (/\.md$/.test(e.name) && !/Start here/.test(e.name)) notes.push(full.slice(VAULT.length + 1));
  }
};
walk(VAULT + "/Questions");
console.log("--- question notes ---");
console.log(notes.join("\n"));
let verified = 0;
for (const n of notes) {
  const text = fs.readFileSync(VAULT + "/" + n, "utf8");
  const fm = /^---\n([\s\S]*?)\n---/.exec(text);
  const good = fm && /verified: true/.test(fm[1]) && /verification: match/.test(fm[1]);
  if (good) verified++;
  else console.log("NOT VERIFIED:\n" + text.slice(0, 400));
}
console.log(`verified notes on disk: ${verified}/${notes.length}`);
if (!notes.length || verified !== notes.length) throw new Error("every written note must carry its match");
if (!/locked\.pdf/.test(log) || !/broken\.pdf/.test(log)) throw new Error("the log must name the failed files");
console.log("PHASE B: pass");
process.exit(0);
