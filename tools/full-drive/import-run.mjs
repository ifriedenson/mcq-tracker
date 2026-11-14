// Drive a real import batch in the Obsidian import popout and report its end state.
// Usage: node tools/full-drive/import-run.mjs [timeoutMinutes]
const PORT = Number(process.env.CDP_PORT || 9222);
const LIMIT_MIN = Number(process.argv[2] || 8);

async function targets() {
  return (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
}

async function connectTo(titleRe) {
  const list = await targets();
  const t = list.find((x) => x.type === "page" && titleRe.test(x.title || ""));
  if (!t) return null;
  const ws = new WebSocket(t.webSocketDebuggerUrl);
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
      pending.set(i, (m) => resolve(m));
      ws.send(JSON.stringify({ id: i, method: "Runtime.evaluate", params: { expression, returnByValue: true, awaitPromise: true } }));
    });
  return { evaluate, close: () => ws.close() };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const end = Date.now() + LIMIT_MIN * 60 * 1000;
let clicked = false;
let last = "";
for (;;) {
  const pop = await connectTo(/Import questions/);
  if (pop) {
    const snap = await pop.evaluate(`(() => {
      const m = document.querySelector('.qt-import-modal');
      if (!m) return 'NO-MODAL';
      const b = Array.from(m.querySelectorAll('button')).find((x) => /^(Import \\d+ files|Start import)$/.test(x.textContent.trim()));
      if (b && ${clicked}) { /* already started */ }
      return JSON.stringify({
        head: (m.querySelector('h1,h2,h3') || {}).textContent || '',
        buttons: Array.from(m.querySelectorAll('button')).map((x) => x.textContent.trim().slice(0, 40)),
        text: m.textContent.replace(/\\s+/g, ' ').slice(0, 220),
      });
    })()`);
    const value = snap && snap.result && snap.result.result && snap.result.result.value;
    if (!clicked) {
      const cl = await pop.evaluate(`(() => {
        const m = document.querySelector('.qt-import-modal');
        const b = m && Array.from(m.querySelectorAll('button')).find((x) => /^(Import \\d+ files|Start import)$/.test(x.textContent.trim()));
        if (!b) return 'NO-BTN';
        b.click();
        return 'CLICKED:' + b.textContent.trim();
      })()`);
      console.log("start:", cl && cl.result && cl.result.result && cl.result.result.value);
      clicked = true;
    } else if (value && value !== last) {
      last = value;
      console.log("popout:", value.slice(0, 220));
    }
    pop.close();
  } else {
    const main = await connectTo(/Obsidian 1\.15/);
    if (main) {
      const done = await main.evaluate(`(() => {
        const modal = Array.from(document.querySelectorAll('.modal-container')).map((e) => e.textContent.replace(/\\s+/g, ' ').slice(0, 400));
        return JSON.stringify({ modals: modal });
      })()`);
      const v = done && done.result && done.result.result && done.result.result.value;
      if (v && /Import complete/i.test(v)) {
        console.log("complete:", v.slice(0, 600));
        main.close();
        break;
      }
      main.close();
    }
  }
  if (Date.now() > end) {
    console.log("timed out; last popout:", last.slice(0, 300));
    break;
  }
  await sleep(5000);
}
process.exit(0);
