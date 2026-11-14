// Live check: open a one-file import with the (already rate-limited) OpenCode
// provider, start it, and time how long until the window shows a reason.
const PORT = Number(process.env.CDP_PORT || 9222);

async function list() {
  return (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
}
async function conn(target) {
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  let id = 1;
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    }
  });
  await new Promise((r) => ws.addEventListener("open", r));
  const evaluate = (expression) =>
    new Promise((resolve) => {
      const i = id++;
      pending.set(i, (m) => resolve(m && m.result && m.result.result ? m.result.result.value : null));
      ws.send(JSON.stringify({ id: i, method: "Runtime.evaluate", params: { expression, returnByValue: true, awaitPromise: true } }));
    });
  return { evaluate, close: () => ws.close() };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const main = (await list()).find((t) => t.url === "app://obsidian.md/index.html");
const app = await conn(main);
// Close any stale import popout, then open a fresh one-file import.
const opened = await app.evaluate(`(async () => {
  await app.plugins.disablePlugin("mcq-tracker");
  await app.plugins.enablePlugin("mcq-tracker");
  const p = app.plugins.getPlugin("mcq-tracker");
  p.settings.ai.enabled = true;
  p.settings.ai.backend = "opencode";
  p.settings.ai.managed = true;
  p.settings.ai.binaryPath = "/usr/local/bin/opencode";
  p.settings.ai.model = "opencode/mimo-v2.6-flash-free";
  await p.save();
  await p.ensureOpenCode();
  const f = app.vault.getAbstractFileByPath("multi-1.pdf");
  const bin = await app.vault.readBinary(f);
  p.openPdfImport({ files: [new File([bin], "multi-1.pdf", { type: "application/pdf" })] });
  return "opened";
})()`);
app.close();
console.log("open:", opened);
await sleep(6000);

const pop = (await list()).find((t) => /Import questions/.test(t.title || ""));
if (!pop) {
  console.log("no popout");
  process.exit(1);
}
const p = await conn(pop);
const click = await p.evaluate(`(() => {
  const m = document.querySelector('.qt-import-modal');
  if (!m) return 'NO-MODAL';
  const b = Array.from(m.querySelectorAll('button')).find((x) => /^(Start import|Import \\d+ files)$/.test(x.textContent.trim()));
  if (!b) return 'NO-BTN:' + Array.from(m.querySelectorAll('button')).map((x) => x.textContent.trim()).join(",");
  b.click();
  return "clicked:" + b.textContent.trim();
})()`);
console.log("click:", click);
const started = Date.now();
let last = "";
for (let i = 0; i < 40; i++) {
  await sleep(5000);
  const snap = await p.evaluate(`(() => {
    const m = document.querySelector('.qt-import-modal');
    return m ? m.textContent.replace(/\\s+/g, ' ').slice(0, 700) : 'NO-MODAL';
  })()`);
  if (snap !== last) {
    last = snap;
    console.log(`\n[${Math.round((Date.now() - started) / 1000)}s]`, String(snap).slice(0, 500));
  }
  if (/sent no reply|stopped answering|could not write|Import complete|could not import/i.test(String(snap))) {
    console.log("\nRESULT after", Math.round((Date.now() - started) / 1000), "s");
    break;
  }
}
p.close();
process.exit(0);
