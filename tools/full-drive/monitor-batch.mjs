// Drive a 3-PDF batch through the real plugin in the main Obsidian window and
// poll its modal state (survives the popout closing). Prints one line each time
// the state changes, with the notes already on disk.
import fs from "node:fs";
import path from "node:path";

const VAULT = process.env.HOME + "/e2e/vault";
const FOLDERS = ["multi-1", "multi-2", "multi-3"].map((n) => path.join(VAULT, "Questions", n));

const targets = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const main = targets.find((t) => t.url === "app://obsidian.md/index.html");
const ws = new WebSocket(main.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0;
const pending = new Map();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
const evaluate = (expression) => new Promise((resolve) => {
  const i = ++id;
  pending.set(i, (m) => resolve(m?.result?.result?.value ?? null));
  ws.send(JSON.stringify({ id: i, method: "Runtime.evaluate", params: { expression, returnByValue: true, awaitPromise: true } }));
});

for (const folder of FOLDERS) fs.rmSync(folder, { recursive: true, force: true });

console.log("open:", await evaluate(`(async () => {
  const p = app.plugins.getPlugin("mcq-tracker");
  p.importSession = null;
  for (const leaf of app.workspace.getLeavesOfType("question-tracker-import-window")) leaf.detach();
  await new Promise((r) => setTimeout(r, 500));
  const files = [];
  for (const name of ["multi-1.pdf", "multi-2.pdf", "multi-3.pdf"]) {
    const bin = await app.vault.readBinary(app.vault.getAbstractFileByPath(name));
    files.push(new File([bin], name, { type: "application/pdf" }));
  }
  p.openPdfImport({ files });
  await new Promise((r) => setTimeout(r, 1200));
  const m = p.importSession && p.importSession.modal;
  if (!m) return "NO-MODAL";
  m.startBatch();
  return "started files=" + m.files.length + " model=" + p.settings.ai.model;
})()`));

const counts = () => FOLDERS.map((dir) => {
  try { return fs.readdirSync(dir).filter((f) => f.endsWith(".md")).length; } catch { return -1; }
});
let last = "";
for (let i = 0; i < 100; i++) {
  await new Promise((r) => setTimeout(r, 15000));
  const state = await evaluate(`(() => {
    const p = app.plugins.getPlugin("mcq-tracker");
    const m = p.importSession && p.importSession.modal;
    if (!m) return JSON.stringify({ gone: true });
    return JSON.stringify({
      idx: m.batchIndex, running: !!m.running, status: String(m.lastStatus || "").slice(0, 120),
      notes: m.batchNotes, done: !!m.finishedBatch,
      results: (m.batchResults || []).map((r) => ({ n: r.name, made: r.made, err: String(r.error || "").slice(0, 100) })),
    });
  })()`);
  const line = `${state} disk=[${counts().join(",")}]`;
  if (line !== last) { last = line; console.log(new Date().toISOString().slice(11, 19), line); }
  if (state && JSON.parse(state).done) break;
}
ws.close();
process.exit(0);
