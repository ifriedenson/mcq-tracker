"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { T, obsidian } = load();

/* OpenCode 2.x removed the 1.x server routes (POST /session answers 405), so the plugin only works with 1.x for now. */

test("opencodeMajor reads the major version from what `opencode --version` prints", () => {
  assert.equal(T.opencodeMajor("2.2.0"), 2);
  assert.equal(T.opencodeMajor("v2.2.0"), 2);
  assert.equal(T.opencodeMajor("1.18.25"), 1);
  assert.equal(T.opencodeMajor(""), 0);
  assert.equal(T.opencodeMajor("unknown"), 0);
});

const rel = (tag, extra) => Object.assign({ tag_name: tag, assets: [{ name: "opencode-windows-x64.zip" }] }, extra);
const NAMES = ["opencode-windows-x64.zip"];

test("chooseRelease skips releases newer than the supported major version", () => {
  const list = [rel("v2.2.0"), rel("v2.1.5"), rel("v1.19.3"), rel("v1.18.25")];
  assert.equal(T.chooseRelease(list, NAMES, 1).tag, "v1.19.3");
  assert.equal(T.chooseRelease(list, NAMES).tag, "v2.2.0"); // no limit given: the old behaviour
  assert.equal(T.chooseRelease([rel("v2.2.0"), rel("v2.1.5")], NAMES, 1), null);
  // drafts and pre-releases are still skipped
  assert.equal(T.chooseRelease([rel("v1.20.0", { prerelease: true }), rel("v1.19.3")], NAMES, 1).tag, "v1.19.3");
});

test("a 405 from OpenCode names the request that failed and points at the version", async () => {
  const oc = new T.OpenCodeClient({ url: "http://127.0.0.1:1", username: "opencode", password: "" });
  obsidian.requestImpl = async () => ({ status: 405, text: "" });
  try {
    await assert.rejects(oc.createSession("x"), (e) => {
      assert.match(e.message, /returned 405 for POST \/session\./);
      assert.match(e.message, /OpenCode 1\.x/);
      assert.match(e.message, /Direct API/);
      return true;
    });
  } finally {
    obsidian.requestImpl = null;
  }
});

test("other errors keep OpenCode's own message and get no version hint", async () => {
  const oc = new T.OpenCodeClient({ url: "http://127.0.0.1:1" });
  obsidian.requestImpl = async () => ({ status: 500, text: "boom" });
  try {
    await assert.rejects(oc.health(), (e) => {
      assert.equal(e.message, "OpenCode returned 500 for GET /global/health: boom");
      return true;
    });
  } finally {
    obsidian.requestImpl = null;
  }
});

function manager(ai, versions) {
  const mgr = new T.OpenCodeManager({ settings: { ai } });
  mgr.version = async (bin) => versions[bin] || "";
  return mgr;
}

test("findBinary skips an OpenCode 2.x and uses a 1.x one if there is one", async () => {
  const v2 = process.execPath; // any file that exists
  const v1 = __filename;
  const mgr = manager({ binaryPath: v2, managedBinary: v1 }, { [v2]: "2.2.0", [v1]: "1.19.3" });
  assert.equal(await mgr.findBinary(), v1);
  assert.equal(mgr.lastVersion, "1.19.3");
  assert.equal(mgr.tooNew.version, "2.2.0");
});

test("with only an OpenCode 2.x, it says why instead of starting it", async () => {
  const v2 = process.execPath;
  const mgr = manager({ managedBinary: v2 }, { [v2]: "2.2.0" });
  assert.equal(await mgr.findBinary(), null);
  assert.match(await mgr.describe(), /Found OpenCode 2\.2\.0, but this plugin works with OpenCode 1\.x/);
  await assert.rejects(mgr.ensure(), /OpenCode 1\.x/);
  assert.equal(mgr.isRunning(), false);
});

test("findBinary does not apply the limit to an OpenCode that is not installed", async () => {
  const mgr = manager({ managedBinary: "/no/such/file" }, {});
  assert.equal(await mgr.findBinary(), null);
  assert.equal(mgr.tooNew, null);
  assert.match(await mgr.describe(), /Not installed/);
});
