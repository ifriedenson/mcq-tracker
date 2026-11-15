// Poll the live Obsidian import window and the run journal; one line per change.
import fs from "node:fs";

const targets = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const main = targets.find((t) => t.url === "app://obsidian.md/index.html");
const ws = new WebSocket(main.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0;
const pending = new Map();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
});
const evaluate = (expression) =>
  new Promise((resolve) => {
    const i = ++id;
    pending.set(i, (m) => resolve(m?.result?.result?.value ?? null));
    ws.send(JSON.stringify({ id: i, method: "Runtime.evaluate", params: { expression, returnByValue: true, awaitPromise: true } }));
  });

const folders = ["multi-1", "multi-2", "multi-3", "night-a", "night-b"];
const disk = () =>
  folders
    .map((n) => {
      try {
        return fs.readdirSync(`${process.env.HOME}/e2e/vault/Questions/${n}`).filter((f) => f.endsWith(".md")).length;
      } catch (e) {
        return -1;
      }
    })
    .join(",");

let last = "";
for (let i = 0; i < 240; i++) {
  const state = await evaluate(`(() => {
    const p = app.plugins.getPlugin("mcq-tracker");
    const m = p.importSession && p.importSession.modal;
    const r = (app.loadLocalStorage("mcq-tracker-overnight-runs") || [])[0];
    return JSON.stringify({
      modal: m ? { idx: m.batchIndex, done: !!m.finishedBatch, closed: m.closed, status: String(m.lastStatus || "").slice(0, 90), notes: m.batchNotes } : null,
      mgr: p.manager.isRunning(),
      run: r ? { id: r.id, st: r.status, f: r.files.map((f) => f.sourcePath + ":" + f.status + ":" + (f.notes || []).length) } : null,
    });
  })()`);
  const line = `${new Date().toISOString().slice(11, 19)} ${state} disk=[${disk()}]`;
  if (line.slice(9) !== last) {
    last = line.slice(9);
    console.log(line);
  }
  let done = false;
  try {
    done = JSON.parse(state).modal === null || JSON.parse(state).modal.done;
  } catch (e) {
    /* keep polling */
  }
  if (done) break;
  await new Promise((r) => setTimeout(r, 30000));
}
ws.close();
process.exit(0);
