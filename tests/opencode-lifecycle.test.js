"use strict";
/*
 * End-to-end managed-OpenCode lifecycle on disk. The test host is POSIX, so
 * the stand-in executable is a Node script in a Windows-style install folder;
 * the manager still resolves, checks, spawns and stops the real file.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const crypto = require("node:crypto");
const { load, obsidian } = require("./helpers/load");

const { T } = load();
const { zipStore } = T.zipWrite;
const EXE_NAME = process.platform === "win32" ? "opencode.exe" : "opencode";

function standIn(version) {
  return `#!/usr/bin/env node
"use strict";
const http = require("http");
const args = process.argv.slice(2);
if (args.includes("--version")) {
  process.stdout.write(${JSON.stringify(`${version}\n`)});
  process.exit(0);
}
const at = args.indexOf("--port");
const port = Number(args[at + 1]);
const server = http.createServer((req, res) => {
  if (req.url === "/config/providers") {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ providers: [{ id: "anthropic" }] }));
    return;
  }
  if (req.url === "/global/health") {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ healthy: true }));
    return;
  }
  res.statusCode = 404;
  res.end("{}");
});
server.listen(port, "127.0.0.1");
const stop = () => server.close(() => process.exit(0));
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
`;
}

function writeExecutable(file, version) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, standIn(version));
  if (process.platform !== "win32") fs.chmodSync(file, 0o755);
}

function makeZip(version) {
  return zipStore([{ name: EXE_NAME, data: standIn(version) }]);
}

function requestUrlImpl(req) {
  return new Promise((resolve, reject) => {
    const url = new URL(req.url);
    const body = req.body ? Buffer.from(req.body) : null;
    const request = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: req.method || "GET",
        headers: Object.assign({}, req.headers, body ? { "content-length": body.length } : {}),
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let json = null;
          try {
            json = JSON.parse(text);
          } catch (e) {
            /* text-only response */
          }
          resolve({ status: response.statusCode, text, json });
        });
      }
    );
    request.on("error", reject);
    if (body) request.write(body);
    request.end();
  });
}

async function serveZip(t, zip) {
  const server = http.createServer((req, res) => {
    if (req.url !== "/opencode.zip") {
      res.statusCode = 404;
      res.end("{}");
      return;
    }
    res.writeHead(200, { "content-type": "application/zip", "content-length": zip.length });
    res.end(Buffer.from(zip));
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  t.after(() => new Promise((resolve) => server.close(() => resolve())));
  return server.address().port;
}

function planFor(port, tag, zip) {
  const digest = crypto.createHash("sha256").update(zip).digest("hex");
  return {
    tag,
    assets: [
      {
        name: "opencode-windows-x64.zip",
        browser_download_url: `http://127.0.0.1:${port}/opencode.zip`,
        digest: `sha256:${digest}`,
        size: zip.length,
      },
    ],
  };
}

function lifecycle(t, ai) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "qt-opencode-lifecycle-"));
  const installRoot = path.join(root, ".question-tracker", "opencode");
  const plugin = {
    settings: { ai: Object.assign({ managed: true, managedBinary: "", binaryPath: "" }, ai || {}) },
    vaultPath: () => root,
    save: async () => {
      plugin.saves = (plugin.saves || 0) + 1;
    },
    askConfirm: async () => true,
  };
  const mgr = new T.OpenCodeManager(plugin);
  mgr.installRoot = () => installRoot;
  mgr.dataHome = () => path.join(root, "opencode-data");
  t.after(() => {
    mgr.stop();
    try {
      fs.rmSync(root, { recursive: true, force: true });
    } catch (e) {
      /* the test already cleaned up */
    }
  });
  return { root, installRoot, plugin, mgr };
}

function withHttp(t) {
  const previous = obsidian.requestImpl;
  obsidian.requestImpl = requestUrlImpl;
  t.after(() => {
    obsidian.requestImpl = previous;
  });
}

function normalize(value) {
  return String(value).replace(/\\/g, "/");
}

test("a persisted install-folder path starts the real executable and restarts", async (t) => {
  const { installRoot, mgr } = lifecycle(t);
  const folder = path.join(installRoot, "v1.19.5-opencode-windows-x64");
  const exe = path.join(folder, EXE_NAME);
  writeExecutable(exe, "1.19.5");
  fs.mkdirSync(path.join(installRoot, "v1.19.4-opencode-windows-x64"), { recursive: true });
  mgr.ai.managedBinary = folder;
  withHttp(t);

  assert.equal(await mgr.version(exe), "1.19.5", "version detection runs the real file");
  assert.equal(await mgr.findBinary(), exe, "the folder-valued path resolves to the executable");
  await mgr.start();
  assert.equal(mgr.isRunning(), true);
  assert.equal(mgr.proc.exitCode, null);
  assert.equal(path.basename(mgr.proc.spawnfile), EXE_NAME, "spawn receives the file, not the folder");
  assert.equal(fs.statSync(mgr.proc.spawnfile).isFile(), true);
  assert.equal(mgr.proc.spawnargs[1], "serve");
  assert.equal(mgr.proc.spawnargs[2], "--hostname");
  assert.deepEqual((await new T.OpenCodeClient(mgr.conn).providers(1000)).providers, [{ id: "anthropic" }]);

  const first = mgr.conn.url;
  mgr.stop();
  await mgr.start();
  assert.equal(mgr.isRunning(), true, "the repaired manager restarts");
  assert.ok(mgr.conn.url);
  assert.deepEqual((await new T.OpenCodeClient(mgr.conn).providers(1000)).providers, [{ id: "anthropic" }]);
  assert.equal(typeof first, "string");
  mgr.stop();
});

test("ensure() restarts a server whose process survived but which stopped answering", async (t) => {
  const { installRoot, mgr } = lifecycle(t);
  const folder = path.join(installRoot, "v1.19.5-opencode-windows-x64");
  writeExecutable(folder, "1.19.5");
  mgr.ai.managedBinary = folder;
  withHttp(t);

  await mgr.ensure();
  assert.equal(mgr.isRunning(), true, "the first start works");
  const first = mgr.proc;
  // The screen-off shape: the process handle still looks alive, but the
  // server behind the connection is gone (a closed port refuses at once).
  mgr.conn = { url: "http://127.0.0.1:1", username: mgr.conn.username, password: mgr.conn.password };
  assert.equal(mgr.isRunning(), true, "a dead server still looks running by its process handle");

  const said = [];
  await mgr.ensure((m) => said.push(m));
  assert.notEqual(mgr.proc, first, "the dead server is replaced, not handed to the next file");
  assert.equal(mgr.isRunning(), true, "the fresh server is running");
  assert.deepEqual((await new T.OpenCodeClient(mgr.conn).providers(1000)).providers, [{ id: "anthropic" }]);
  assert.ok(said.some((m) => /restarting it fresh/i.test(m)), "the restart says what it is doing");
  mgr.stop();
});

test("a managed folder missing the executable repairs through a real download and starts", async (t) => {
  const { installRoot, mgr, plugin } = lifecycle(t);
  const empty = path.join(installRoot, "v1.19.5-opencode-windows-x64");
  fs.mkdirSync(empty, { recursive: true });
  fs.mkdirSync(path.join(installRoot, "v1.19.4-opencode-windows-x64"), { recursive: true });
  mgr.ai.managedBinary = empty;

  const zip = makeZip("1.19.5");
  const port = await serveZip(t, zip);
  mgr.plan = async () => planFor(port, "v1.19.5", zip);
  // The host may have an OpenCode on PATH; this test is about the managed
  // folder repair path, so keep the fallback from hiding it.
  const realVersion = mgr.version.bind(mgr);
  mgr.version = async (bin, viaPath, ms) => (viaPath ? "" : realVersion(bin, ms));
  withHttp(t);

  await mgr.ensure();
  assert.equal(mgr.isRunning(), true, "repair ends with a running server");
  assert.equal(mgr.proc.exitCode, null);
  assert.equal(path.basename(mgr.proc.spawnfile), EXE_NAME);
  assert.ok(
    normalize(mgr.ai.managedBinary).startsWith(normalize(empty) + "/"),
    `managedBinary=${mgr.ai.managedBinary} empty=${empty}`
  );
  assert.equal(fs.statSync(mgr.ai.managedBinary).isFile(), true);
  assert.deepEqual((await new T.OpenCodeClient(mgr.conn).providers(1000)).providers, [{ id: "anthropic" }]);
  assert.ok(plugin.saves > 0);
  mgr.stop();
});

test("a locked old version folder does not fail a new install or its start", async (t) => {
  const { installRoot, mgr } = lifecycle(t);
  const zip = makeZip("1.19.5");
  const port = await serveZip(t, zip);
  mgr.plan = async () => planFor(port, "v1.19.5", zip);
  withHttp(t);

  const first = await mgr.install(null, () => true);
  const oldFolder = path.join(installRoot, "v1.19.5-opencode-windows-x64");
  assert.equal(path.dirname(first.path), oldFolder);

  const realRm = fs.rmSync;
  let blocked = 0;
  fs.rmSync = (target, ...args) => {
    if (path.resolve(String(target)) === path.resolve(oldFolder)) {
      blocked += 1;
      const error = new Error(`EPERM, Permission denied: '${target}'`);
      error.code = "EPERM";
      throw error;
    }
    return realRm.call(fs, target, ...args);
  };
  let second;
  try {
    mgr.plan = async () => planFor(port, "v1.19.6", zip);
    second = await mgr.install(null, () => true);
  } finally {
    fs.rmSync = realRm;
  }

  assert.ok(blocked > 0, "the old folder was actually locked during cleanup");
  assert.equal(fs.existsSync(oldFolder), true, "the locked folder is left for a later cleanup");
  assert.equal(path.dirname(second.path), path.join(installRoot, "v1.19.6-opencode-windows-x64"));
  assert.equal(normalize(mgr.ai.managedBinary), normalize(second.path));

  await mgr.start();
  assert.equal(mgr.isRunning(), true, "the new copy starts despite the locked old folder");
  assert.equal(path.basename(mgr.proc.spawnfile), EXE_NAME);
  assert.deepEqual((await new T.OpenCodeClient(mgr.conn).providers(1000)).providers, [{ id: "anthropic" }]);
  mgr.stop();
});

test("Windows backslash paths resolve to the executable before spawn", async (t) => {
  const { installRoot, mgr } = lifecycle(t);
  const folder = path.join(installRoot, "v1.19.5-opencode-windows-x64");
  const exe = path.join(folder, EXE_NAME);
  writeExecutable(exe, "1.19.5");
  const winFolder = folder.replace(/\//g, "\\");
  mgr.ai.managedBinary = winFolder;
  mgr.version = async (bin) => (/[\\/]opencode(?:\.exe)?$/.test(String(bin)) ? "1.19.5" : "");

  const realStat = fs.statSync;
  const realReaddir = fs.readdirSync;
  const native = (value) => String(value).replace(/\\/g, "/");
  fs.statSync = (target, ...args) => realStat(native(target), ...args);
  fs.readdirSync = (target, ...args) => realReaddir(native(target), ...args);
  try {
    assert.equal(normalize(await mgr.resolveBinary(winFolder)), normalize(exe));
    assert.equal(normalize(await mgr.findBinary()), normalize(exe));
    assert.equal(normalize(await mgr.hasExisting()), normalize(exe));
  } finally {
    fs.statSync = realStat;
    fs.readdirSync = realReaddir;
  }
  assert.ok(path.isAbsolute(folder));
});
