// CDP driver for the overnight-import verification in a real Obsidian window.
// Usage: node tools/overnight-e2e/driver.mjs <command> [args]
// Commands: probe | unrestrict | reload | start <files...> | state | eval <js> | shot <path>
const port = process.env.CDP_PORT || "9222";

async function connect() {
  const res = await fetch(`http://127.0.0.1:${port}/json/list`);
  const targets = await res.json();
  const app = targets.find((t) => t.type === "page" && t.url === "app://obsidian.md/index.html");
  if (!app) throw new Error("no Obsidian app window (have: " + targets.map((t) => t.url).join(", ") + ")");
  const ws = new WebSocket(app.webSocketDebuggerUrl);
  let id = 1;
  const pending = new Map();
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    }
  });
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", reject);
  });
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const i = id++;
      pending.set(i, resolve);
      ws.send(JSON.stringify({ id: i, method, params }));
      setTimeout(() => pending.has(i) && (pending.delete(i), reject(new Error("cdp timeout " + method))), 60000);
    });
  }
  return { send };
}

export async function evaluate(expression, awaitPromise = true) {
  const { send } = await connect();
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise });
  const ro = r && r.result && r.result.result;
  if (r && r.result && r.result.exceptionDetails) throw new Error("evaluate failed: " + JSON.stringify(r.result.exceptionDetails).slice(0, 800));
  if (ro && ro.subtype === "error") throw new Error("page error: " + (ro.description || "").slice(0, 500));
  return ro && "value" in ro ? ro.value : ro;
}

function out(value) {
  console.log(typeof value === "string" ? value : JSON.stringify(value));
  process.exit(0);
}

const command = process.argv[2];
if (command === "probe") {
  out(await evaluate("({hasApp: !!window.app, enabled: !!(window.app && window.app.plugins && window.app.plugins.enabled), plugin: !!(window.app && window.app.plugins && window.app.plugins.plugins && window.app.plugins.plugins['mcq-tracker'])})"));
} else if (command === "unrestrict") {
  out(await evaluate("(async () => { await window.app.plugins.setEnable(false); return window.app.plugins.enabled; })()"));
} else if (command === "reload") {
  const { send } = await connect();
  await send("Page.reload", {});
  out("reloaded");
} else if (command === "start") {
  const files = process.argv.slice(3);
  out(await evaluate(`(async () => { const p = window.app.plugins.plugins['mcq-tracker']; const run = await p.startOvernightImport(${JSON.stringify(files)}); return run && run.id; })()`));
} else if (command === "state") {
  out(
    await evaluate(`(() => { const out = {}; try {
      const p = window.app.plugins.plugins['mcq-tracker'];
      out.hasPlugin = !!p;
      out.logNote = !!window.app.vault.getAbstractFileByPath('Overnight import log.md');
      out.mdNotes = window.app.vault.getMarkdownFiles().map((f) => f.path);
    } catch (e) { out.error = String((e && e.message) || e).slice(0, 300); } return out; })()`)
  );
} else if (command === "notices") {
  const res = await fetch(`http://127.0.0.1:${port}/json/list`);
  const targets = (await res.json()).filter((t) => t.type === "page");
  const seen = [];
  for (const t of targets) {
    const ws = new WebSocket(t.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve);
      ws.addEventListener("error", reject);
    });
    const id = Math.floor(Math.random() * 1000000);
    const text = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(""), 20000);
      ws.addEventListener("message", (e) => {
        try {
          const m = JSON.parse(e.data);
          if (m.id === id) {
            clearTimeout(timer);
            resolve(m?.result?.result?.value || "");
          }
        } catch (err) {
          /* ignore */
        }
      });
      ws.send(JSON.stringify({ id, method: "Runtime.evaluate", params: { expression: "[...document.querySelectorAll('.notice')].map((n) => n.textContent).join(' || ')", returnByValue: true } }));
    });
    try {
      ws.close();
    } catch (e) {
      /* ignore */
    }
    if (text) seen.push(text);
  }
  out(seen.join(" || ") || "(no notices in " + targets.length + " targets)");
} else if (command === "eval") {
  out(await evaluate(process.argv.slice(3).join(" ")));
} else if (command === "shot") {
  const { send } = await connect();
  const r = await send("Page.captureScreenshot", { format: "png" });
  const fs = await import("node:fs");
  fs.writeFileSync(process.argv[3], Buffer.from(r.data, "base64"));
  out("wrote " + process.argv[3]);
} else {
  throw new Error("unknown command " + command);
}
