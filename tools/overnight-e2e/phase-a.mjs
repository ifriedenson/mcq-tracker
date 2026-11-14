// Phase A: unattended 3-file batch (good, broken, encrypted) over Direct API.
import { execFile } from "node:child_process";
import { startStandIn } from "./standin.mjs";

const PORT = 4711;
const ROOT = "/workspace/chats/d88551267b6076e698552363";

function driver(...args) {
  return new Promise((resolve, reject) => {
    execFile("node", [ROOT + "/tools/overnight-e2e/driver.mjs", ...args], { timeout: 90000 }, (error, stdout, stderr) => {
      if (error) reject(new Error("driver " + args[0] + " failed: " + (stderr || error.message)));
      else resolve(stdout.trim());
    });
  });
}

const { server, log } = await startStandIn(PORT);
console.log("stand-in on", PORT);

await driver(
  "eval",
  `(async () => { const p = window.app.plugins.plugins['mcq-tracker'];
    p.settings.ai.enabled = true;
    p.settings.ai.backend = 'api';
    p.settings.ai.api.provider = 'google';
    p.settings.ai.api.baseUrl = 'http://127.0.0.1:${PORT}/v1beta/openai';
    p.settings.ai.api.keys = Object.assign({}, p.settings.ai.api.keys, { google: 'e2e-key' });
    p.settings.ai.api.model = 'gemini-3.8-flash';
    p.settings.importOptions = { capture: false, pagePics: false };
    await p.save();
    return p.settings.ai.api.baseUrl; })()`
);
console.log("plugin configured");

const runId = await driver("start", "good.pdf", "broken.pdf", "locked.pdf");
console.log("run started:", runId);

const end = Date.now() + 8 * 60 * 1000;
let state = null;
for (;;) {
  await new Promise((r) => setTimeout(r, 5000));
  state = JSON.parse(await driver("state"));
  if (state.logNote) break;
  if (Date.now() > end) break;
}
console.log("final state:", JSON.stringify(state).slice(0, 2000));
const verifyCount = log.filter((e) => e.kind === "verify").length;
const noteCount = log.filter((e) => e.kind === "note").length;
console.log(`provider calls: note=${noteCount} verify=${verifyCount} 429s=${log.filter((e) => e.injected).length}`);
server.close();
process.exit(0);
