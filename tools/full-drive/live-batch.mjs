// Live: import three vault PDFs through the real popout and record every
// visible state change for up to 15 minutes (background; writes /tmp/live-import.log).
const PORT = 9222;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function list() {
  return (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
}
async function conn(target) {
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  let id = 1;
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  await new Promise((r) => ws.addEventListener("open", r));
  const evaluate = (expression) => new Promise((resolve) => {
    const i = id++;
    pending.set(i, (m) => resolve(m && m.result && m.result.result ? m.result.result.value : null));
    ws.send(JSON.stringify({ id: i, method: "Runtime.evaluate", params: { expression, returnByValue: true, awaitPromise: true } }));
  });
  return { evaluate, close: () => ws.close() };
}

const main = (await list()).find((t) => t.url === "app://obsidian.md/index.html");
const app = await conn(main);
log(await app.evaluate(`(async () => {
  const p = app.plugins.getPlugin("mcq-tracker");
  p.importSession = null;
  for (const leaf of app.workspace.getLeavesOfType("question-tracker-import-window")) leaf.detach();
  await new Promise((r) => setTimeout(r, 400));
  const files = [];
  for (const name of ["multi-1.pdf", "multi-2.pdf", "multi-3.pdf"]) {
    const f = app.vault.getAbstractFileByPath(name);
    const bin = await app.vault.readBinary(f);
    files.push(new File([bin], name, { type: "application/pdf" }));
  }
  p.openPdfImport({ files });
  return "opened " + p.manifest.version + " ai=" + p.settings.ai.backend + "/" + p.settings.ai.model;
})()`));
app.close();
await sleep(5000);

const pop = (await list()).find((t) => /Import questions/.test(t.title || ""));
if (!pop) { log("no popout"); process.exit(1); }
const p = await conn(pop);
log("click:", await p.evaluate(`(() => {
  const m = document.querySelector('.qt-import-modal');
  if (!m) return 'NO-MODAL';
  const buttons = Array.from(m.querySelectorAll('button')).map((b) => b.textContent.trim());
  const b = Array.from(m.querySelectorAll('button')).find((x) => /^(Import \\d+ files|Start import)$/.test(x.textContent.trim()));
  if (!b) return 'NO-BTN:' + buttons.join(',');
  b.click();
  return 'clicked:' + b.textContent.trim();
})()`));
let last = "";
for (let i = 0; i < 90; i++) {
  await sleep(10000);
  const snap = await p.evaluate(`(() => {
    const m = document.querySelector('.qt-import-modal');
    return m ? m.textContent.replace(/\\s+/g, ' ').slice(0, 900) : 'NO-MODAL';
  })()`);
  if (snap !== last) { last = snap; log(String(snap).slice(0, 700)); }
  if (/Import complete|Import stopped|sent no reply|stopped answering/i.test(String(snap))) log("END:", Math.round((i + 1) * 10), "s");
}
p.close();
process.exit(0);
