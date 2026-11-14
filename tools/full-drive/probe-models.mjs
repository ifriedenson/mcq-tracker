// Probe every OpenCode free model through the plugin's own authenticated client,
// one at a time, recording replies/errors on window.__probe for polling.
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

const models = ["nemotron-3.5-lightning-free", "glm-5.3-flash-free", "flint-40b-free", "deepseek-v4.1-flash-free", "longcat-2.5-free", "big-pickle", "nemotron-3.5-super-vl-free", "minimax-m3.1-flash-free", "iceman-free", "beam-free", "inkling-2-small-free", "mimo-v2.6-flash-free"];
console.log("start:", await evaluate(`(() => {
  const p = app.plugins.getPlugin("mcq-tracker");
  const oc = p.openCode();
  window.__probe = [];
  (async () => {
    for (const m of ${JSON.stringify(models)}) {
      const t0 = Date.now();
      let row = { m, ms: 0, reply: "", err: "" };
      try {
        const s = await oc.createSession("probe " + m);
        const r = await Promise.race([
          oc.send(s.id, { model: { providerID: "opencode", modelID: m }, parts: [{ type: "text", text: "Reply with the single word READY" }], system: "Answer in one word." }, { idleMs: 20000 }),
          new Promise((_, rej) => setTimeout(() => rej(new Error("probe timeout 35s")), 35000)),
        ]);
        const text = ((r && r.parts) || []).filter((x) => x.type === "text").map((x) => x.text).join(" ");
        row.reply = text.slice(0, 80);
        const info = (r && r.info) || {};
        if (info.error) row.err = JSON.stringify(info.error).slice(0, 160);
        oc.deleteSession(s.id).catch(() => {});
      } catch (e) { row.err = String((e && e.message) || e).slice(0, 160); }
      row.ms = Date.now() - t0;
      window.__probe.push(row);
      console.log("PROBE " + JSON.stringify(row));
    }
  })();
  return "started";
})()`));

for (let i = 0; i < 40; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  const rows = await evaluate("JSON.stringify(window.__probe || [])");
  const parsed = rows ? JSON.parse(rows) : [];
  console.log(parsed.map((r) => `${r.m}: ${r.reply ? "REPLY " + JSON.stringify(r.reply) : "ERR " + r.err} (${Math.round(r.ms / 1000)}s)`).join("\n"));
  if (parsed.length >= models.length) break;
  if (i % 3 === 0) console.log("---");
}
ws.close();
process.exit(0);
