"use strict";
/*
 * The server this plugin starts must be able to write note files without an
 * approval prompt: an import whose agent waits on a permission that nobody can
 * answer just stalls until the watchdog gives up. These tests pin the inline
 * OpenCode config that does that, and that a config the user set themselves is
 * never overwritten.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { load } = require("./helpers/load");

const { T } = load();

test("the managed server config always allows file edits", () => {
  const config = JSON.parse(T.permissionConfigContent("/home/me/My Vault"));
  assert.equal(config.permission.edit, "allow", "edits run without approval");
  assert.equal(config.permission.read, undefined, "reads are left as the user set them");
  assert.equal(config.permission.bash, undefined, "bash is left as the user set them");
  assert.deepEqual(config.permission.external_directory, { "/home/me/My Vault/**": "allow" });
  assert.equal(config.$schema, "https://opencode.ai/config.json");
});

test("the vault pattern is normalized for Windows paths and trailing slashes", () => {
  const config = JSON.parse(T.permissionConfigContent("C:\\Users\\me\\Vault\\"));
  assert.deepEqual(config.permission.external_directory, { "C:/Users/me/Vault/**": "allow" });
  const bare = JSON.parse(T.permissionConfigContent(""));
  assert.equal(bare.permission.edit, "allow", "no vault path still allows edits");
  assert.equal(bare.permission.external_directory, undefined, "an empty path adds no directory rule");
});

/** Drives a real OpenCodeManager.start() with a fake child, port and client so the spawn env can be read. */
function startHarness(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qt-opencode-perm-"));
  const fakeBin = path.join(dir, "opencode");
  fs.writeFileSync(fakeBin, "");
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const spawns = [];
  let clock = 0;
  let port = 52300;
  const hooks = {
    spawn(bin, args, opts) {
      spawns.push({ bin, args, opts });
      return {
        exitCode: null,
        killed: false,
        stdout: { on() {}, destroy() {} },
        stderr: { on() {}, destroy() {} },
        on() {},
        kill() {
          this.killed = true;
          this.exitCode = 0;
        },
      };
    },
    freePort: async () => port++,
    sleep: async (ms) => {
      clock += ms;
    },
    now: () => clock,
    client: () => ({ providers: async () => ({ providers: [{ id: "anthropic" }] }) }),
  };
  const mgr = new T.OpenCodeManager({ settings: { ai: {} }, vaultPath: () => dir, save: async () => {} });
  mgr.findBinary = async () => fakeBin;
  mgr.dataHome = () => path.join(dir, "data");
  t.after(() => mgr.stop());
  return { mgr, hooks, spawns, dir };
}

test("starting the managed server passes the edit permission as inline config", async (t) => {
  const h = startHarness(t);
  const saved = process.env.OPENCODE_CONFIG_CONTENT;
  delete process.env.OPENCODE_CONFIG_CONTENT;
  try {
    await h.mgr.start(null, false, h.hooks);
  } finally {
    if (saved !== undefined) process.env.OPENCODE_CONFIG_CONTENT = saved;
  }
  assert.equal(h.spawns.length, 1);
  const env = h.spawns[0].opts.env;
  const config = JSON.parse(env.OPENCODE_CONFIG_CONTENT);
  assert.equal(config.permission.edit, "allow", "the spawned server can write note files");
  assert.ok(String(env.OPENCODE_SERVER_PASSWORD || "").length > 0, "the existing server password still applies");
});

test("an inline config the user set themselves is never overwritten", async (t) => {
  const h = startHarness(t);
  const saved = process.env.OPENCODE_CONFIG_CONTENT;
  process.env.OPENCODE_CONFIG_CONTENT = '{"permission":{"edit":"ask"}}';
  try {
    await h.mgr.start(null, false, h.hooks);
  } finally {
    if (saved === undefined) delete process.env.OPENCODE_CONFIG_CONTENT;
    else process.env.OPENCODE_CONFIG_CONTENT = saved;
  }
  assert.equal(h.spawns[0].opts.env.OPENCODE_CONFIG_CONTENT, '{"permission":{"edit":"ask"}}');
});
