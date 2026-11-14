"use strict";
// Helper: apply exact-string Phase 1 edits, asserting each anchor occurs once.
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

function apply(file, edits) {
  const full = path.join(root, file);
  let text = fs.readFileSync(full, "utf8");
  for (const [oldStr, newStr] of edits) {
    const count = text.split(oldStr).length - 1;
    if (count !== 1) throw new Error(`${file}: anchor found ${count}x: ${JSON.stringify(oldStr.slice(0, 80))}`);
    text = text.replace(oldStr, newStr);
  }
  fs.writeFileSync(full, text);
  console.log(`${file}: ${edits.length} edits applied`);
}

apply("src/opencode-client.js", [
  [
    "const IDLE_TIMEOUT_MS = 6 * 60 * 1000;",
    "const IDLE_TIMEOUT_MS = 6 * 60 * 1000;\n/** A blind check may think for many minutes with no visible output, so a slow model is not a stuck one. */\nconst VERIFY_IDLE_TIMEOUT_MS = 20 * 60 * 1000;",
  ],
  [
    "  createSession(title) {\n    return this.req(\"POST\", \"/session\", { title }, this.timeoutMs);\n  }",
    "  createSession(title) {\n    return this.req(\"POST\", \"/session\", { title }, this.timeoutMs);\n  }\n  /** Drop a finished check session so hundreds of imports do not bloat the server. */\n  deleteSession(id) {\n    return this.req(\"DELETE\", `/session/${encodeURIComponent(id)}`, undefined, this.timeoutMs);\n  }",
  ],
  [
    "  IDLE_TIMEOUT_MS,",
    "  IDLE_TIMEOUT_MS,\n  VERIFY_IDLE_TIMEOUT_MS,",
  ],
]);

apply("src/plugin.js", [
  [
    "const { OpenCodeClient, modelFromString, partsToTurns } = require(\"./opencode-client\");",
    "const { OpenCodeClient, VERIFY_IDLE_TIMEOUT_MS, modelFromString, partsToTurns } = require(\"./opencode-client\");",
  ],
  [
    "        const parsed = modelFromString(model);\n        if (parsed) body.model = parsed;\n        await oc.send(session.id, body);",
    "        const parsed = modelFromString(model);\n        if (parsed) body.model = parsed;\n        // A blind check may think for many minutes with no visible output, so\n        // a slow model is given more silence allowance than an agent send.\n        const idleMs = feature === \"verification\" ? VERIFY_IDLE_TIMEOUT_MS : 0;\n        await oc.send(session.id, body, idleMs > 0 ? { idleMs } : undefined);",
  ],
  [
    "        const recovered = await this.recoverAiConnection(e, { onNotice: o.onNotice });",
    "        const recovered = await this.recoverForSlowCheck(e, { onNotice: o.onNotice });",
  ],
  [
    "  /** Ask one independent question, without showing the stored key. */\n  async verifyQuestionDraft(item, options) {",
    "  /**\n   * A check that went quiet is usually a slow provider, not a dead server.\n   * Only a server that stops answering small requests earns a restart: the\n   * probe goes first, and a server that still answers keeps the note alive\n   * without one. A genuinely unreachable server falls through to the usual\n   * recovery, which restarts the managed copy.\n   */\n  async recoverForSlowCheck(error, options) {\n    const o = options || {};\n    const said = typeof o.onNotice === \"function\" ? o.onNotice : () => {};\n    const message = str(error && error.message ? error.message : error);\n    const unreachable = /Can't reach OpenCode|not running|ECONNREFUSED|ECONNRESET|ERR_CONNECTION|Failed to fetch|fetch failed|net::|socket|network|502|503|504/i.test(\n      message\n    );\n    if (this.backend() === \"opencode\" && !unreachable) {\n      try {\n        await this.openCode().providers(4000);\n        said(\"The check is taking a while, so it gets more time; OpenCode is still answering.\");\n        return true;\n      } catch (probeError) {\n        /* the probe failed too: the server really is down */\n      }\n    }\n    return this.recoverAiConnection(error, o);\n  }\n\n  /** Ask one independent question, without showing the stored key. */\n  async verifyQuestionDraft(item, options) {",
  ],
]);
