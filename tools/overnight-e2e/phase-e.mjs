// Phase E: auto-resume notice after reload, then budget pause keeps the queue.
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
const runState = (id) =>
  driver(
    "eval",
    `(async () => { const p = window.app.plugins.plugins['mcq-tracker']; const T = p.constructor.__test; const r = T.overnightRun.loadOvernightRuns(window.app).find((x) => x.id === '${id}'); return r ? {status: r.status, files: r.files.map((f) => f.sourcePath.split('/').pop() + ':' + f.status + ':n' + f.notes.length)} : null; })()`
  );

// --- Part 1: the auto-resume notice ---
wipe(["Questions", "Overnight import log.md"]);
await driver("eval", "window.localStorage.removeItem(Object.keys(window.localStorage).find((k) => /mcq-tracker-overnight-runs/.test(k)) || 'none')");
const run1files = ["good.pdf", ...Array.from({ length: 9 }, (_, i) => "Bulk/q" + String(i + 1).padStart(2, "0") + ".pdf")];
const run1 = await driver("start", ...run1files);
console.log("run1 started:", run1);
// Reload only once the run is provably mid-flight.
const flightEnd = Date.now() + 5 * 60 * 1000;
for (;;) {
  const cur = await driver(
    "eval",
    `(async () => { const p = window.app.plugins.plugins['mcq-tracker']; const T = p.constructor.__test; const r = T.overnightRun.loadOvernightRuns(window.app).find((x) => x.id === '${run1}'); return r ? r.status + ':' + r.files.filter((f) => f.status !== 'pending').length + '/' + r.files.length : 'none'; })()`
  );
  console.log("pre-reload:", cur);
  if (/^writing:/.test(cur)) break;
  if (Date.now() > flightEnd) throw new Error("run never reached mid-flight");
  await new Promise((r) => setTimeout(r, 1000));
}
await driver("reload");
console.log("reloaded mid-run");
for (;;) {
  await new Promise((r) => setTimeout(r, 3000));
  try {
    const probe = await driver("probe");
    try {
      if (JSON.parse(probe).hasApp) break;
    } catch (e) {
      /* still reloading */
    }
  } catch (e) {
    /* still reloading */
  }
}
console.log("plugin back; watching for the resume notice...");
let notice = "";
const noticeEnd = Date.now() + 60 * 1000;
for (;;) {
  notice = await driver("notices");
  if (/resuming now/i.test(notice)) break;
  if (Date.now() > noticeEnd) break;
  await new Promise((r) => setTimeout(r, 1500));
}
console.log("notices seen:", notice.slice(0, 220));
if (!/resuming now/i.test(notice)) throw new Error("no auto-resume notice after reload");
// Let run1 finish so part 2 starts clean.
const logEnd = Date.now() + 8 * 60 * 1000;
for (;;) {
  await new Promise((r) => setTimeout(r, 5000));
  if (fs.existsSync(VAULT + "/Overnight import log.md")) break;
  if (Date.now() > logEnd) throw new Error("run1 never finished");
}
console.log("run1 finished");

// --- Part 2: a spent budget pauses the run and keeps the queue ---
wipe(["Questions", "Overnight import log.md"]);
await driver("eval", "window.localStorage.removeItem(Object.keys(window.localStorage).find((k) => /mcq-tracker-overnight-runs/.test(k)) || 'none')");
await driver("eval", "(async () => { const p = window.app.plugins.plugins['mcq-tracker']; p.settings.ai.limits = Object.assign({}, p.settings.ai.limits, { dailyRequests: 1 }); await p.save(); return p.aiBudget().allowed; })()");
console.log("budget capped at 1 request/day");
const run2 = await driver("start", "good.pdf", "Bulk/q01.pdf");
console.log("run2 started:", run2);
let st2 = "";
const pauseEnd = Date.now() + 5 * 60 * 1000;
for (;;) {
  st2 = await runState(run2);
  const s = JSON.parse(st2);
  if (s && (s.status === "paused" || s.status === "finished" || s.status === "stopped")) break;
  if (Date.now() > pauseEnd) throw new Error("run2 never settled (last: " + st2 + ")");
  await new Promise((r) => setTimeout(r, 3000));
}
console.log("run2 settled:", st2);
const parsed = JSON.parse(st2);
if (parsed.status !== "paused") throw new Error("expected a spent budget to pause the run, got " + parsed.status);
if (parsed.files.some((f) => /error/.test(f))) throw new Error("a paused run must keep its queue, not fail it: " + st2);
// Restore the budget and resume through the real command.
await driver(
  "eval",
  "(async () => { const p = window.app.plugins.plugins['mcq-tracker']; p.settings.ai.limits = Object.assign({}, p.settings.ai.limits, { dailyRequests: 0 }); await p.save(); return p.resumeOvernightImport().then((r) => (r && r.id) || null); })()"
);
console.log("budget restored, resume commanded");
const finEnd = Date.now() + 8 * 60 * 1000;
for (;;) {
  await new Promise((r) => setTimeout(r, 5000));
  if (fs.existsSync(VAULT + "/Overnight import log.md")) break;
  if (Date.now() > finEnd) throw new Error("resumed run never finished");
}
const log = fs.readFileSync(VAULT + "/Overnight import log.md", "utf8");
if (!/status: finished/.test(log)) throw new Error("resumed run did not finish");
console.log("PHASE E: pass");
process.exit(0);
