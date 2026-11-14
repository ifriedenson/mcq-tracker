"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
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

test("a health request that never answers is bounded", async () => {
  const oc = new T.OpenCodeClient({ url: "http://127.0.0.1:1" });
  obsidian.requestImpl = () => new Promise(() => {});
  const started = Date.now();
  try {
    await assert.rejects(oc.health(25), (e) => {
      assert.match(e.message, /OpenCode health check timed out/);
      return true;
    });
    assert.ok(Date.now() - started < 1000, "the health check returned within its bound");
  } finally {
    obsidian.requestImpl = null;
  }
});

test("the Settings connection test uses the bounded providers probe", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "settings-tab.js"), "utf8");
  assert.match(source, /ensureOpenCodeClient\(this\.plugin\)/);
  assert.match(source, /await oc\.providers\(HEALTH_TIMEOUT_MS\);/);
  assert.doesNotMatch(source, /await oc\.health\(/);
  assert.doesNotMatch(source, /OpenCode isn't running yet/);
});

test("managed readiness starts OpenCode before opening a client", async () => {
  let ensured = 0;
  const plugin = {
    settings: { ai: { managed: true, url: "http://127.0.0.1:4096" } },
    manager: {
      conn: null,
      ensure: async () => {
        ensured++;
        plugin.manager.conn = { url: "http://127.0.0.1:51234" };
      },
    },
    openCode() {
      assert.equal(this.manager.conn && this.manager.conn.url, "http://127.0.0.1:51234", "the managed URL exists before the client is opened");
      return new T.OpenCodeClient(this.manager.conn);
    },
  };

  const oc = await T.aiConnection.ensureOpenCodeClient(plugin);
  assert.equal(ensured, 1);
  assert.equal(oc.base(), "http://127.0.0.1:51234");
});

test("managed readiness never probes the unconfigured default endpoint when startup fails", async () => {
  let opened = 0;
  const plugin = {
    settings: { ai: { managed: true, url: "http://127.0.0.1:4096" } },
    manager: {
      conn: null,
      ensure: async () => {
        throw new Error("OpenCode isn't set up yet. Open Settings and press Download and install.");
      },
    },
    openCode() {
      opened++;
      return new T.OpenCodeClient(this.settings.ai);
    },
  };

  await assert.rejects(() => T.aiConnection.ensureOpenCodeClient(plugin), /isn't set up yet/);
  assert.equal(opened, 0, "the default URL is never used when the managed server cannot start");
});

test("manual OpenCode readiness skips the managed launcher and keeps its configured URL", async () => {
  let ensured = 0;
  const plugin = {
    settings: { ai: { managed: false, url: "http://127.0.0.1:5999" } },
    manager: {
      ensure: async () => {
        ensured++;
      },
    },
    openCode() {
      return new T.OpenCodeClient(this.settings.ai);
    },
  };

  const oc = await T.aiConnection.ensureOpenCodeClient(plugin);
  assert.equal(ensured, 0, "a manual server is not replaced by a managed one");
  assert.equal(oc.base(), "http://127.0.0.1:5999");
});

test("a managed connection failure names the plugin-managed server, not 4096", () => {
  const problem = T.aiConnection.openCodeProblem(new Error("net::ERR_CONNECTION_REFUSED"), {
    settings: { ai: { managed: true } },
  });
  assert.match(problem, /plugin-managed OpenCode server/i);
  assert.doesNotMatch(problem, /127\.0\.0\.1:4096|4096/);
});

test("a providers request used for readiness is bounded", async () => {
  const oc = new T.OpenCodeClient({ url: "http://127.0.0.1:1" });
  obsidian.requestImpl = () => new Promise(() => {});
  const started = Date.now();
  try {
    await assert.rejects(oc.providers(25), (e) => {
      assert.match(e.message, /OpenCode providers check timed out/);
      return true;
    });
    assert.ok(Date.now() - started < 1000, "the readiness check returned within its bound");
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

test("a saved install folder resolves to the opencode program inside it", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qt-opencode-folder-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const exe = path.join(dir, process.platform === "win32" ? "opencode.exe" : "opencode");
  fs.writeFileSync(exe, "");
  const mgr = manager({ managedBinary: dir }, { [exe]: "1.19.5" });

  assert.equal(await mgr.findBinary(), exe, "the executable is returned, not its folder");
  assert.equal(mgr.invalidPath, "", "a folder that contains the program is valid");
  assert.equal(await mgr.hasExisting(), exe, "startup detection also returns the executable");
});

test("a manually chosen folder without a program is named, never spawned, and never EPERM", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qt-opencode-empty-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const mgr = manager({ binaryPath: dir }, {});

  assert.equal(await mgr.findBinary(), null);
  assert.equal(mgr.invalidPath, dir, "the folder is remembered for an actionable message");
  assert.notEqual(await mgr.hasExisting(), dir, "startup detection never reports a folder as the program");
  await assert.rejects(() => mgr.ensure(), /folder.*opencode\.exe/i);
});

test("start resolves a saved install folder before spawning", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qt-opencode-start-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const exe = path.join(dir, process.platform === "win32" ? "opencode.exe" : "opencode");
  fs.writeFileSync(exe, "");
  const mgr = manager({ managedBinary: dir }, { [exe]: "1.19.5" });
  mgr.plugin.vaultPath = () => dir;
  mgr.dataHome = () => path.join(dir, "data");
  const spawns = [];
  const hooks = {
    spawn(bin, args, opts) {
      spawns.push({ bin, args, opts });
      return {
        exitCode: null,
        killed: false,
        stdout: { on() {}, destroy() {} },
        stderr: { on() {}, destroy() {} },
        on() {},
        kill() {},
      };
    },
    freePort: async () => 53123,
    client: () => ({ providers: async () => ({ providers: [{ id: "anthropic" }] }) }),
    now: () => 0,
    sleep: async () => {},
  };

  await mgr.start(null, false, hooks);
  assert.equal(spawns.length, 1);
  assert.equal(spawns[0].bin, exe, "spawn receives the executable, not the folder");
  assert.equal(spawns[0].args[0], "serve");
  mgr.stop();
});

test("start refuses a folder even if a stale finder returns it", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qt-opencode-guard-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const mgr = manager({}, {});
  mgr.findBinary = async () => dir;
  let spawned = 0;
  const hooks = {
    spawn() {
      spawned++;
      throw new Error("spawn should not be called for a folder");
    },
    freePort: async () => 53124,
    now: () => 0,
    sleep: async () => {},
  };

  await assert.rejects(() => mgr.start(null, false, hooks), /folder.*opencode\.exe/i);
  assert.equal(spawned, 0, "a directory never reaches spawn()");
});

/* -------- managed-start recovery: real quarantineDb() and files, fake process/clock -------- */

const DB_FILES = ["opencode.db", "opencode.db-wal", "opencode.db-shm"];

/** Drives OpenCodeManager.start() with a fake clock, child process, port and client; the database files it quarantines are real. A spawn behavior can make a child print a line and exit. */
function managedStartHarness(t, clientResults, spawnBehaviors) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qt-opencode-start-"));
  const binDir = path.join(dir, "bin");
  fs.mkdirSync(binDir);
  const fakeBin = path.join(binDir, process.platform === "win32" ? "opencode.exe" : "opencode");
  fs.writeFileSync(fakeBin, "");
  const dbDir = path.join(dir, "opencode");
  fs.mkdirSync(dbDir, { recursive: true });
  const original = {};
  for (const name of DB_FILES) {
    original[name] = `old contents of ${name}`;
    fs.writeFileSync(path.join(dbDir, name), original[name]);
  }
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  let clock = 0;
  let nextPort = 52100;
  let clientCount = 0;
  const spawns = [];
  const children = [];
  const behaviors = spawnBehaviors || [];
  const hooks = {
    spawn(bin, args, opts) {
      const behavior = behaviors[children.length] || {};
      const child = {
        exitCode: behavior.exitCode === undefined ? null : behavior.exitCode,
        killed: false,
        killCalls: 0,
        stdout: {
          on(event, fn) {
            if (event === "data" && behavior.tail) fn(behavior.tail);
          },
          destroy() {},
        },
        stderr: { on() {}, destroy() {} },
        on() {},
        kill() {
          child.killCalls++;
          child.killed = true;
          child.exitCode = 0;
        },
      };
      children.push(child);
      spawns.push({ bin, args, opts });
      return child;
    },
    freePort: async () => nextPort++,
    sleep: async (ms) => {
      clock += ms;
    },
    now: () => clock,
    client() {
      const ok = clientResults[clientCount++];
      return {
        providers: async () => {
          if (!ok) throw new Error("OpenCode providers check timed out after 4s.");
          return { providers: [{ id: "anthropic" }] };
        },
      };
    },
  };

  const mgr = new T.OpenCodeManager({ settings: { ai: {} }, vaultPath: () => dir, save: async () => {} });
  mgr.findBinary = async () => fakeBin;
  mgr.dataHome = () => dir;
  t.after(() => mgr.stop());
  return { dir, dbDir, original, hooks, spawns, children, mgr };
}

const brokenNames = (dbDir) => fs.readdirSync(dbDir).filter((n) => n.includes(".broken-")).sort();

async function liveClient(conn, url) {
  obsidian.requestImpl = async (req) => {
    assert.equal(req.url, `${url}/config/providers`, "the returned connection answers its providers route");
    return { status: 200, json: { providers: [{ id: "anthropic" }] } };
  };
  try {
    return await new T.OpenCodeClient(conn).providers(50);
  } finally {
    obsidian.requestImpl = null;
  }
}

test("a stalled managed start stops the child, preserves the old database, retries once and returns a live connection", async (t) => {
  const h = managedStartHarness(t, [false, true]);
  const progress = [];

  await h.mgr.start((msg) => progress.push(msg), false, h.hooks);

  assert.equal(h.spawns.length, 2, "exactly one fresh retry was started");
  assert.equal(h.children[0].killCalls, 1, "the stalled child was stopped once");
  assert.equal(h.children[1].killCalls, 0, "the retried child was left running");
  assert.equal(h.mgr.isRunning(), true, "start() returned a running manager");
  assert.equal(h.mgr.conn.url, "http://127.0.0.1:52101", "the live connection is the retried server");
  assert.ok(progress.includes("Repairing OpenCode's database..."));
  assert.equal(h.spawns[0].opts.env.XDG_DATA_HOME, h.dir);
  assert.equal(h.spawns[1].opts.env.XDG_DATA_HOME, h.dir);

  // The old files are preserved under .broken-* and the retry starts without them.
  assert.deepEqual(fs.readdirSync(h.dbDir).filter((n) => !n.includes(".broken-")), [], "no old database file is left for the retry");
  assert.equal(brokenNames(h.dbDir).length, DB_FILES.length, "every old database file was kept as .broken-*");
  for (const name of DB_FILES) {
    const kept = brokenNames(h.dbDir).find((n) => n.startsWith(`${name}.broken-`));
    assert.ok(kept, `${name} was moved aside under its .broken-* name`);
    assert.equal(fs.readFileSync(path.join(h.dbDir, kept), "utf8"), h.original[name], `${name} was preserved, not deleted or rewritten`);
  }

  const providers = await liveClient(h.mgr.conn, "http://127.0.0.1:52101");
  assert.deepEqual(providers.providers, [{ id: "anthropic" }]);
});

test("a managed start that is still stalled after one retry fails with actionable wording and leaves no running child", async (t) => {
  const h = managedStartHarness(t, [false, false]);

  await assert.rejects(
    () => h.mgr.start(null, false, h.hooks),
    (e) => {
      assert.match(e.message, /OpenCode started, but its readiness check timed out/);
      assert.match(e.message, /reinstall OpenCode/);
      assert.match(e.message, /Direct API/);
      assert.doesNotMatch(e.message, /4096|ERR_CONNECTION_REFUSED|127\.0\.0\.1/);
      const problem = T.aiConnection.openCodeProblem(e, { settings: { ai: { managed: true } } });
      assert.doesNotMatch(problem, /4096|ERR_CONNECTION_REFUSED/);
      return true;
    }
  );

  assert.equal(h.spawns.length, 2, "it gave up after exactly one retry");
  assert.equal(h.children[0].killCalls, 1, "the stalled first child was stopped");
  assert.equal(h.children[1].killCalls, 1, "the retried child was stopped before giving up");
  assert.equal(h.mgr.proc, null);
  assert.equal(h.mgr.isRunning(), false);

  assert.equal(brokenNames(h.dbDir).length, DB_FILES.length, "the quarantined copy is still intact");
  assert.deepEqual(fs.readdirSync(h.dbDir).filter((n) => !n.includes(".broken-")), [], "no database was left behind for another start");
});

test("a healthy managed start never quarantines or touches the database", async (t) => {
  const h = managedStartHarness(t, [true]);
  const progress = [];

  await h.mgr.start((msg) => progress.push(msg), false, h.hooks);

  assert.equal(h.spawns.length, 1, "a healthy start starts once");
  assert.equal(h.children[0].killCalls, 0, "a healthy start leaves its child running");
  assert.equal(h.mgr.isRunning(), true);
  assert.equal(h.mgr.conn.url, "http://127.0.0.1:52100");
  assert.equal(progress.includes("Repairing OpenCode's database..."), false);
  assert.deepEqual(fs.readdirSync(h.dbDir).sort(), DB_FILES.slice().sort(), "the database files keep their names");
  for (const name of DB_FILES) assert.equal(fs.readFileSync(path.join(h.dbDir, name), "utf8"), h.original[name]);
});

test("a database-not-empty managed start repairs once, preserves the old database and returns a live connection", async (t) => {
  const h = managedStartHarness(t, [true, true], [{ tail: "Database is not empty\n", exitCode: 1 }, {}]);
  const progress = [];

  await h.mgr.start((msg) => progress.push(msg), false, h.hooks);

  assert.equal(h.spawns.length, 2, "the database was repaired with exactly one retry");
  assert.notEqual(h.children[0].exitCode, null, "the first child had already stopped with the database error");
  assert.equal(h.children[1].killCalls, 0, "the repaired start is still running");
  assert.equal(h.mgr.isRunning(), true, "start() returned a running manager");
  assert.equal(h.mgr.conn.url, "http://127.0.0.1:52101", "the live connection is the retried server");
  assert.equal(progress.filter((m) => m === "Repairing OpenCode's database...").length, 1, "the database was repaired once");
  assert.equal(h.spawns[1].opts.env.XDG_DATA_HOME, h.dir, "the retry runs against the managed data folder");

  // The old files are preserved under .broken-* and the retry starts without them.
  assert.deepEqual(fs.readdirSync(h.dbDir).filter((n) => !n.includes(".broken-")), [], "no database file is left to re-trigger the condition");
  assert.equal(brokenNames(h.dbDir).length, DB_FILES.length, "every old database file was kept as .broken-*");
  for (const name of DB_FILES) {
    const kept = brokenNames(h.dbDir).find((n) => n.startsWith(`${name}.broken-`));
    assert.ok(kept, `${name} was moved aside under its .broken-* name`);
    assert.equal(fs.readFileSync(path.join(h.dbDir, kept), "utf8"), h.original[name], `${name} was preserved, not deleted or rewritten`);
  }

  const providers = await liveClient(h.mgr.conn, "http://127.0.0.1:52101");
  assert.deepEqual(providers.providers, [{ id: "anthropic" }]);
});

test("a database repair whose retry is still unhealthy fails after one retry with actionable wording and no running child", async (t) => {
  const h = managedStartHarness(t, [true, false], [{ tail: "Database is not empty\n", exitCode: 1 }, {}]);

  await assert.rejects(
    () => h.mgr.start(null, false, h.hooks),
    (e) => {
      assert.match(e.message, /OpenCode started, but its readiness check timed out/);
      assert.match(e.message, /reinstall OpenCode/);
      assert.match(e.message, /Direct API/);
      assert.doesNotMatch(e.message, /4096|ERR_CONNECTION_REFUSED|127\.0\.0\.1/);
      const problem = T.aiConnection.openCodeProblem(e, { settings: { ai: { managed: true } } });
      assert.doesNotMatch(problem, /4096|ERR_CONNECTION_REFUSED/);
      return true;
    }
  );

  assert.equal(h.spawns.length, 2, "it repaired once and then gave up");
  assert.notEqual(h.children[0].exitCode, null, "the first child had already stopped with the database error");
  assert.equal(h.children[1].killCalls, 1, "the unhealthy retry child was stopped");
  assert.equal(h.mgr.proc, null);
  assert.equal(h.mgr.isRunning(), false);

  assert.equal(brokenNames(h.dbDir).length, DB_FILES.length, "the preserved database copy is complete");
  for (const name of DB_FILES) {
    const kept = brokenNames(h.dbDir).find((n) => n.startsWith(`${name}.broken-`));
    assert.ok(kept, `${name} is still preserved`);
    assert.equal(fs.readFileSync(path.join(h.dbDir, kept), "utf8"), h.original[name], `${name} is intact`);
  }
  assert.deepEqual(fs.readdirSync(h.dbDir).filter((n) => !n.includes(".broken-")), [], "no database was left behind for another start");
});

test("a database-not-empty retry is not repaired a second time", async (t) => {
  const h = managedStartHarness(t, [true, true], [
    { tail: "Database is not empty\n", exitCode: 1 },
    { tail: "Database is not empty\n", exitCode: 1 },
  ]);
  const progress = [];

  await assert.rejects(() => h.mgr.start((msg) => progress.push(msg), false, h.hooks), /OpenCode stopped right after starting\. .*Database is not empty/s);

  assert.equal(h.spawns.length, 2, "exactly one repair was attempted");
  assert.equal(progress.filter((m) => m === "Repairing OpenCode's database...").length, 1);
  assert.equal(brokenNames(h.dbDir).length, DB_FILES.length, "only one quarantine happened");
  assert.equal(new Set(brokenNames(h.dbDir).map((n) => n.split(".broken-")[1])).size, 1, "the files were not quarantined twice");
  assert.equal(h.mgr.isRunning(), false);
  assert.notEqual(h.children[0].exitCode, null);
  assert.notEqual(h.children[1].exitCode, null);
});

test("OpenCode: a blocking send that writes nothing new is bounded with a next step", async () => {
  // Regression: send() waited forever, so the chat or import spinner never stopped.
  const oc = new T.OpenCodeClient({ url: "http://127.0.0.1:1" }, { timeoutMs: 200 });
  obsidian.requestImpl = async (req) => {
    if (req.method === "GET" && String(req.url).includes("/message")) return { status: 200, json: [{ info: { role: "user" } }] };
    if (req.method === "POST") return new Promise(() => {});
    return { status: 200, json: {} };
  };
  const started = Date.now();
  try {
    await assert.rejects(() => oc.send("s1", { parts: [] }, { idleMs: 40 }), (e) => {
      assert.match(e.message, /OpenCode accepted the request but wrote nothing new for 40ms/);
      assert.match(e.message, /Check that OpenCode is still running and a provider is connected, then try again/);
      return true;
    });
    assert.ok(Date.now() - started < 2000, "the send returned within its silence allowance");
  } finally {
    obsidian.requestImpl = null;
  }
});

test("OpenCode: a send that runs out of silence allowance aborts the runaway session", async () => {
  // Regression: a check whose model wandered off left its server-side run
  // going after the idle error, so a retry stacked onto a zombie session.
  const oc = new T.OpenCodeClient({ url: "http://127.0.0.1:1" }, { timeoutMs: 200 });
  const calls = [];
  obsidian.requestImpl = async (req) => {
    calls.push(`${req.method} ${String(req.url).split("/").slice(-2).join("/")}`);
    if (req.method === "GET") return { status: 200, json: [{ info: { role: "user" } }] };
    if (String(req.url).includes("/abort")) return { status: 200, json: {} };
    if (req.method === "POST") return new Promise(() => {});
    return { status: 200, json: {} };
  };
  try {
    await assert.rejects(() => oc.send("s1", { parts: [] }, { idleMs: 40 }), (e) => {
      assert.match(e.message, /OpenCode accepted the request but wrote nothing new for 40ms/);
      return true;
    });
    assert.ok(calls.some((c) => c === "POST s1/abort"), "the stuck session was aborted, got: " + calls.join(", "));
  } finally {
    obsidian.requestImpl = null;
  }
});

test("OpenCode: a long send that keeps writing to the session is not cut off", async () => {
  const oc = new T.OpenCodeClient({ url: "http://127.0.0.1:1" }, { timeoutMs: 200 });
  let reads = 0;
  obsidian.requestImpl = async (req) => {
    if (req.method === "GET" && String(req.url).includes("/message")) {
      reads++;
      return { status: 200, json: [{ info: { role: "assistant", step: reads } }] };
    }
    if (req.method === "POST") {
      // still working for longer than the silence allowance below
      await new Promise((resolve) => setTimeout(resolve, 160));
      return { status: 200, json: { ok: true } };
    }
    return { status: 200, json: {} };
  };
  try {
    const out = await oc.send("s1", { parts: [] }, { idleMs: 60 });
    assert.deepEqual(out, { ok: true }, "the finished send returned its reply");
    assert.ok(reads > 1, "the session was read while the send was still running");
  } finally {
    obsidian.requestImpl = null;
  }
});

test("OpenCode: a session request that never answers is bounded", async () => {
  const oc = new T.OpenCodeClient({ url: "http://127.0.0.1:1" }, { timeoutMs: 40 });
  obsidian.requestImpl = () => new Promise(() => {});
  try {
    await assert.rejects(() => oc.createSession("x"), /OpenCode POST \/session timed out after 40ms/);
    await assert.rejects(() => oc.messages("s1"), /OpenCode GET \/session\/s1\/message timed out after 40ms/);
  } finally {
    obsidian.requestImpl = null;
  }
});

test("OpenCode installer: a GitHub release lookup that never answers is bounded", async () => {
  // Regression: plan() awaited requestUrl with no deadline, so the install spinner could run forever.
  const mgr = new T.OpenCodeManager({ settings: { ai: {} } });
  mgr.releaseTimeoutMs = 40;
  obsidian.requestImpl = () => new Promise(() => {});
  const started = Date.now();
  try {
    await assert.rejects(() => mgr.plan(), (e) => {
      assert.match(e.message, /GitHub did not answer within 40ms/);
      assert.match(e.message, /Check your internet connection and press Download and install again/);
      assert.match(e.message, /install OpenCode yourself/);
      return true;
    });
    assert.ok(Date.now() - started < 2000, "the lookup returned within its bound");
  } finally {
    obsidian.requestImpl = null;
  }
});
