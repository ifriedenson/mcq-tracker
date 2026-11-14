// Phase D: force 429s mid-checks and prove the run still finishes.
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

const files = ["good.pdf", ...Array.from({ length: 9 }, (_, i) => "Bulk/q" + String(i + 1).padStart(2, "0") + ".pdf")];
const armed = await (await fetch("http://127.0.0.1:4711/arm?fail429verify=4")).json();
console.log("armed:", JSON.stringify(armed));
const runId = await driver("start", ...files);
console.log("run started:", runId);
// Poison the first verify calls with 429s; writes never see them.

const done = Date.now() + 8 * 60 * 1000;
for (;;) {
  await new Promise((r) => setTimeout(r, 5000));
  if (fs.existsSync(VAULT + "/Overnight import log.md")) break;
  if (Date.now() > done) throw new Error("timed out waiting for the log note");
}
const log = fs.readFileSync(VAULT + "/Overnight import log.md", "utf8");
console.log("--- log note ---");
console.log(log);
const served = JSON.parse(fs.readFileSync("/tmp/standin-log.json", "utf8")).filter((e) => e.injected === 429).length;
console.log("429s served by the stand-in:", served);
if (served < 1) throw new Error("expected injected 429s, saw " + served);
if (!/status: finished/.test(log)) throw new Error("run did not finish despite the 429s");
if (!/Matched: 10/.test(log)) throw new Error("expected all 10 checks matched");
console.log("PHASE D: pass");
process.exit(0);
