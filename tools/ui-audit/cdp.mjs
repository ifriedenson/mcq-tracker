import fs from "node:fs";
import path from "node:path";

const port = process.env.CDP_PORT || "9222";
const action = process.argv[2];
const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const titleFilter = process.env.CDP_TITLE ? new RegExp(process.env.CDP_TITLE, "i") : null;
const target = titleFilter
  ? targets.find((t) => t.type === "page" && titleFilter.test(t.title))
  : targets.find((t) => t.type === "page" && /app:\/\/obsidian\.md/.test(t.url));
if (!target) throw new Error(`no Obsidian page target${titleFilter ? ` matching ${titleFilter}` : ""}`);
const ws = new WebSocket(target.webSocketDebuggerUrl);
let next = 1;
const pending = new Map();
ws.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const p = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
  }
});
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve);
  ws.addEventListener("error", reject);
});
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = next++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
await send("Page.bringToFront");

async function evalExpression(expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
    userGesture: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text + "\n" + (result.exceptionDetails.exception?.description || ""));
  }
  return result.result?.value;
}

if (action === "eval") {
  const file = process.argv[3];
  const expression = file && fs.existsSync(file) ? fs.readFileSync(file, "utf8") : file;
  if (!expression) throw new Error("eval needs an expression or a file");
  console.log(JSON.stringify(await evalExpression(expression), null, 2));
} else if (action === "shot") {
  const out = process.argv[3];
  const width = Number(process.argv[4] || 1440);
  const height = Number(process.argv[5] || 1000);
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await new Promise((resolve) => setTimeout(resolve, 350));
  const shot = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(shot.data, "base64"));
  console.log(out);
} else {
  throw new Error("usage: cdp.mjs eval <expression|file> | shot <file> [width height]");
}
ws.close();
