"use strict";
const { Platform, requestUrl } = require("obsidian");
const { fmtMB, sleep, str } = require("./util");
const { OpenCodeClient } = require("./opencode-client");

function nodeReq(name) {
  try {
    return require(name);
  } catch (e) {
    throw new Error("OpenCode auto-setup needs the desktop app (it isn't available on mobile yet).");
  }
}

/* ------------------------------------------- OpenCode: install + local server */

const OPENCODE_REPO = "anomalyco/opencode";

const PROVIDERS = [
  ["anthropic", "Anthropic (Claude)"],
  ["openai", "OpenAI"],
  ["openrouter", "OpenRouter"],
  ["google", "Google (Gemini)"],
  ["deepseek", "DeepSeek"],
  ["groq", "Groq"],
];

function platformTriple(procPlatform, procArch, isMusl) {
  const os = { win32: "windows", darwin: "darwin", linux: "linux" }[procPlatform];
  const arch = { x64: "x64", arm64: "arm64" }[procArch];
  if (!os || !arch) return null;
  return { os, arch, musl: os === "linux" && !!isMusl };
}

function candidateAssetNames(tr) {
  const base = `opencode-${tr.os}-${tr.arch}`;
  const ext = tr.os === "linux" ? ".tar.gz" : ".zip";
  const musl = tr.musl ? "-musl" : "";
  const names = [`${base}${musl}${ext}`];
  if (tr.arch === "x64") names.push(`${base}-baseline${musl}${ext}`); // CPUs without AVX2
  return names;
}

/** First stable release that has a matching asset. Returns assets in preference order. */
function chooseRelease(releases, names) {
  for (const rel of Array.isArray(releases) ? releases : []) {
    if (!rel || rel.draft || rel.prerelease) continue;
    const found = names.map((n) => (rel.assets || []).find((a) => a.name === n)).filter(Boolean);
    if (found.length) return { tag: rel.tag_name, assets: found };
  }
  return null;
}

function mergeAuth(existingText, providerId, key) {
  let obj = {};
  if (str(existingText).trim()) {
    try {
      obj = JSON.parse(existingText);
    } catch (e) {
      throw new Error("OpenCode's auth.json isn't valid JSON, so I left it alone. Fix or delete it, then try again.");
    }
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) throw new Error("OpenCode's auth.json has an unexpected shape, so I left it alone.");
  }
  obj[providerId] = { type: "api", key };
  return JSON.stringify(obj, null, 2) + "\n";
}

function killTree(child) {
  try {
    if (process.platform === "win32" && child.pid) {
      nodeReq("child_process").execFile("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true }, () => {});
    } else {
      child.kill("SIGKILL");
    }
  } catch (e) {
    /* already gone */
  }
  try {
    if (child.stdout) child.stdout.destroy();
    if (child.stderr) child.stderr.destroy();
  } catch (e) {
    /* ignore */
  }
}

/** Runs a program and always finishes: if it hasn't answered within opts.timeout ms it is killed and this rejects. */
function runCmd(cmd, args, opts) {
  const { execFile } = nodeReq("child_process");
  const o = Object.assign({ windowsHide: true, maxBuffer: 1 << 24 }, opts || {});
  const limit = o.timeout || 0;
  delete o.timeout;
  return new Promise((resolve, reject) => {
    let done = false;
    let timer = null;
    const finish = (fn, v) => {
      if (done) return;
      done = true;
      if (timer) activeWindow.clearTimeout(timer);
      fn(v);
    };
    const child = execFile(cmd, args, o, (err, stdout, stderr) => {
      if (err) finish(reject, new Error(str(stderr || err.message).slice(0, 400)));
      else finish(resolve, str(stdout));
    });
    if (limit) {
      timer = activeWindow.setTimeout(() => {
        killTree(child);
        finish(reject, new Error(`Timed out after ${Math.round(limit / 1000)} seconds.`));
      }, limit);
    }
  });
}

function downloadFile(url, dest, onProgress, hops) {
  hops = hops || 0;
  return new Promise((resolve, reject) => {
    if (hops > 6) return reject(new Error("Too many redirects while downloading."));
    const u = new URL(url);
    const lib = nodeReq(u.protocol === "http:" ? "http" : "https");
    const fs = nodeReq("fs");
    const crypto = nodeReq("crypto");
    const req = lib.get(url, { headers: { "User-Agent": "obsidian-question-tracker", Accept: "application/octet-stream" } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        resolve(downloadFile(new URL(res.headers.location, url).toString(), dest, onProgress, hops + 1));
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`Download failed: HTTP ${res.statusCode}`));
        return;
      }
      const total = Number(res.headers["content-length"]) || 0;
      let got = 0;
      const hash = crypto.createHash("sha256");
      const out = fs.createWriteStream(dest);
      res.on("data", (c) => {
        got += c.length;
        hash.update(c);
        if (onProgress) onProgress(got, total);
      });
      res.on("error", reject);
      out.on("error", reject);
      out.on("finish", () => resolve({ sha256: hash.digest("hex"), bytes: got }));
      res.pipe(out);
    });
    req.on("error", reject);
    req.setTimeout(60000, () => req.destroy(new Error("Download timed out.")));
  });
}

async function extractArchive(archive, destDir) {
  const fs = nodeReq("fs");
  fs.mkdirSync(destDir, { recursive: true });
  try {
    // bsdtar (Windows 10+, macOS) reads .zip too; GNU tar reads the Linux .tar.gz
    await runCmd("tar", ["-xf", archive, "-C", destDir], { timeout: 8 * 60 * 1000 });
    return;
  } catch (first) {
    if (/Timed out/.test(first.message)) {
      throw new Error("Unpacking took too long. Antivirus software is probably scanning the large file. Download it yourself from the GitHub releases page, unzip it, and choose opencode.exe under \"OpenCode program\" in settings.");
    }
    if (process.platform === "win32") {
      const q = (s) => s.replace(/'/g, "''");
      await runCmd("powershell", ["-NoProfile", "-Command", `Expand-Archive -LiteralPath '${q(archive)}' -DestinationPath '${q(destDir)}' -Force`], { timeout: 10 * 60 * 1000 });
    } else if (/\.zip$/i.test(archive)) {
      await runCmd("unzip", ["-o", archive, "-d", destDir], { timeout: 8 * 60 * 1000 });
    } else {
      throw first;
    }
  }
}

function findBinaryIn(dir) {
  const fs = nodeReq("fs");
  const path = nodeReq("path");
  const want = process.platform === "win32" ? "opencode.exe" : "opencode";
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    let ents;
    try {
      ents = fs.readdirSync(d, { withFileTypes: true });
    } catch (e) {
      continue;
    }
    for (const e of ents) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.name === want) return p;
    }
  }
  return null;
}

function freePort() {
  const net = nodeReq("net");
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}

/** Downloads OpenCode once, then runs `opencode serve` on localhost while Obsidian is open. */
class OpenCodeManager {
  constructor(plugin) {
    this.plugin = plugin;
    this.proc = null;
    this.conn = null;
    this.tail = "";
    this.starting = null;
    this.root = null;
  }

  get ai() {
    return this.plugin.settings.ai;
  }

  installRoot() {
    if (!this.root) {
      const os = nodeReq("os");
      const path = nodeReq("path");
      this.root = path.join(os.homedir(), ".question-tracker", "opencode");
    }
    return this.root;
  }

  isRunning() {
    return !!(this.proc && this.proc.exitCode === null && !this.proc.killed && this.conn);
  }

  async version(bin, viaPath, ms) {
    try {
      const out = await runCmd(bin, ["--version"], { timeout: ms || 10000, shell: !!viaPath && process.platform === "win32" });
      return out.trim().split(/\s+/).pop() || "unknown";
    } catch (e) {
      return "";
    }
  }

  /** Where an existing OpenCode lives, if anywhere. Uses a copy you already have before downloading one. */
  async findBinary() {
    const fs = nodeReq("fs");
    const path = nodeReq("path");
    const os = nodeReq("os");
    const exe = process.platform === "win32" ? "opencode.exe" : "opencode";
    const tries = [this.ai.binaryPath, this.ai.managedBinary, path.join(os.homedir(), ".opencode", "bin", exe)].filter(Boolean);
    this.stalled = "";
    for (const p of tries) {
      if (!fs.existsSync(p)) continue;
      const v = await this.version(p);
      if (v) {
        this.lastVersion = v;
        return p;
      }
      if (!this.stalled) this.stalled = p;
    }
    const v = await this.version("opencode", true);
    if (v) {
      this.lastVersion = v;
      return "opencode";
    }
    return null;
  }

  async describe() {
    if (!Platform.isDesktopApp) return "Auto-setup needs the desktop app.";
    if (this.isRunning()) return `Running on ${this.conn.url}${this.ai.installedVersion ? ` (v${this.ai.installedVersion})` : ""}.`;
    const work = (async () => {
      const bin = await this.findBinary();
      if (!bin && this.stalled) {
        return `Found a program at ${this.stalled}, but it didn't answer in time. Antivirus may be scanning it, so wait a minute and press Check again. If it keeps failing, choose a different copy under "OpenCode program".`;
      }
      if (!bin) return "Not installed. Press Download and install, or choose a copy you already have.";
      return `Installed (v${this.lastVersion || "?"}) at ${bin}. Not running; it starts when you use the AI chat.`;
    })();
    const slow = sleep(30000).then(
      () => "Couldn't check in time. The program may be slow to start (antivirus often scans it the first time). Press Check again in a minute, or choose a different program below."
    );
    return Promise.race([work, slow]);
  }

  /** Cheap, non-blocking look for an OpenCode that's already usable. Only reads the disk; never starts a program. */
  async hasExisting() {
    const fsp = nodeReq("fs").promises;
    const path = nodeReq("path");
    const os = nodeReq("os");
    const win = process.platform === "win32";
    const exe = win ? "opencode.exe" : "opencode";
    const cands = [this.ai.binaryPath, this.ai.managedBinary, path.join(os.homedir(), ".opencode", "bin", exe)].filter(Boolean);
    for (const dir of str(process.env.PATH).split(path.delimiter).filter(Boolean)) {
      for (const ext of win ? [".exe", ".cmd", ".bat"] : [""]) cands.push(path.join(dir, "opencode" + ext));
    }
    for (const p of cands) {
      try {
        await fsp.access(p);
        return p;
      } catch (e) {
        /* not here */
      }
    }
    return "";
  }

  /** Sets OpenCode up by itself (once per Obsidian session): uses one that's already there, otherwise downloads it. Never rejects. */
  autoSetup(progress) {
    if (this.setupRun) return this.setupRun;
    this.setupBusy = true;
    this.setupError = "";
    this.setupRun = (async () => {
      try {
        if (!Platform.isDesktopApp) return;
        const found = await this.hasExisting();
        if (found) {
          this.foundPath = found;
          return;
        }
        const r = await this.install(progress);
        this.foundPath = r.path;
      } catch (e) {
        if (e && e.cancelled) {
          // they said no: remember it, so we don't ask again every session
          this.ai.autoDeclined = true;
          try {
            await this.plugin.save();
          } catch (err) {
            /* ignore */
          }
        } else {
          this.setupError = str(e && e.message ? e.message : e);
        }
      } finally {
        this.setupBusy = false;
      }
    })();
    return this.setupRun;
  }

  async plan() {
    if (!Platform.isDesktopApp) throw new Error("OpenCode auto-setup needs the desktop app (it isn't available on mobile yet).");
    const fs = nodeReq("fs");
    const tr = platformTriple(process.platform, process.arch, process.platform === "linux" && fs.existsSync("/etc/alpine-release"));
    if (!tr) throw new Error(`Auto-install isn't available for ${process.platform}/${process.arch}. Install OpenCode yourself (npm i -g opencode-ai) and it will be found automatically.`);
    const r = await requestUrl({
      url: `https://api.github.com/repos/${OPENCODE_REPO}/releases?per_page=20`,
      headers: { Accept: "application/vnd.github+json" },
      throw: false,
    });
    if (r.status !== 200) throw new Error(`Couldn't look up OpenCode releases (GitHub returned ${r.status}). Try again later, or install OpenCode yourself (npm i -g opencode-ai).`);
    const pick = chooseRelease(r.json, candidateAssetNames(tr));
    if (!pick) throw new Error(`No OpenCode download matches ${tr.os}/${tr.arch}. Install OpenCode yourself (npm i -g opencode-ai) and it will be found automatically.`);
    return { tag: pick.tag, assets: pick.assets, size: pick.assets[0].size || 0 };
  }

  async install(progress, confirm) {
    progress = progress || (() => {});
    progress("Looking up the latest OpenCode release...");
    const plan = await this.plan();
    confirm =
      confirm ||
      ((pl) =>
        this.plugin.askConfirm(
          "Download OpenCode?",
          "OpenCode is a separate, free, open-source program (not part of this plugin) that powers the AI agent.\n\n" +
            `This will download ${pl.tag} from github.com/${OPENCODE_REPO}${pl.size ? ` (about ${fmtMB(pl.size)})` : ""}, ` +
            "check its SHA-256 checksum, and unpack it into a folder in your user profile, outside your vault:\n" +
            `${this.installRoot()}\n\n` +
            "It only runs while Obsidian is open, is reachable only from this computer, and contacts the AI provider you configure. " +
            "In Agent mode it can read and edit files in your vault. You can delete that folder at any time.",
          "Download and install"
        ));
    if (!(await confirm(plan))) {
      const err = new Error("OpenCode install cancelled.");
      err.cancelled = true;
      throw err;
    }
    let lastErr;
    for (const asset of plan.assets) {
      try {
        return await this.installAsset(plan.tag, asset, progress);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr;
  }

  async installAsset(tag, asset, progress) {
    const fs = nodeReq("fs");
    const path = nodeReq("path");
    const os = nodeReq("os");
    const safe = (s) => str(s).replace(/[^\w.\-]/g, "_");
    const dest = path.join(this.installRoot(), `${safe(tag)}-${safe(asset.name.replace(/\.(zip|tar\.gz)$/, ""))}`);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "qt-opencode-"));
    try {
      const archive = path.join(tmp, asset.name);
      let lastPct = -2;
      progress(`Downloading OpenCode ${tag}...`);
      const res = await downloadFile(asset.browser_download_url, archive, (got, total) => {
        const pct = total ? Math.floor((got / total) * 100) : -1;
        if (pct !== lastPct) {
          lastPct = pct;
          progress(total ? `Downloading OpenCode... ${pct}% (${fmtMB(got)} of ${fmtMB(total)})` : `Downloading OpenCode... ${fmtMB(got)}`);
        }
      });
      const digest = str(asset.digest).replace(/^sha256:/i, "").toLowerCase();
      const verified = /^[0-9a-f]{64}$/.test(digest);
      if (!verified) throw new Error("GitHub didn't publish a checksum for this download, so it was not installed. Install OpenCode yourself and choose it under \"OpenCode program\" in settings.");
      if (digest !== res.sha256) throw new Error("The download failed its SHA-256 check, so it was discarded.");

      progress("Unpacking...");
      fs.rmSync(dest, { recursive: true, force: true });
      await extractArchive(archive, dest);
      const bin = findBinaryIn(dest);
      if (!bin) throw new Error("The download didn't contain an opencode program.");
      if (process.platform !== "win32") fs.chmodSync(bin, 0o755);

      progress("Checking that it runs (the first run can take a minute while antivirus checks it)...");
      let v = await this.version(bin, false, 120000);
      if (!v && process.platform === "darwin") {
        try {
          await runCmd("codesign", ["--force", "--sign", "-", bin]);
        } catch (e) {
          /* best effort */
        }
        v = await this.version(bin, false, 120000);
      }
      if (!v) throw new Error("The downloaded OpenCode didn't answer within two minutes. Antivirus may still be scanning it, so wait a minute and press Check again. If it keeps failing, download it yourself from the GitHub releases page and choose it under \"OpenCode program\".");

      this.ai.managedBinary = bin;
      this.ai.installedVersion = v;
      await this.plugin.save();

      // keep only the current version
      for (const e of fs.readdirSync(this.installRoot(), { withFileTypes: true })) {
        const p = path.join(this.installRoot(), e.name);
        if (e.isDirectory() && p !== dest) fs.rmSync(p, { recursive: true, force: true });
      }
      return { version: v, verified, path: bin };
    } finally {
      try {
        fs.rmSync(tmp, { recursive: true, force: true });
      } catch (e) {
        /* ignore */
      }
    }
  }

  /** OpenCode's data folder for the managed server. Kept separate from any other OpenCode install so their databases can't collide. */
  dataHome() {
    const path = nodeReq("path");
    const os = nodeReq("os");
    return path.join(os.homedir(), ".question-tracker", "opencode-data");
  }

  /** Move a broken OpenCode database aside (kept as .broken-<time>) so it can create a fresh one. Returns true if anything was moved. */
  quarantineDb() {
    const fs = nodeReq("fs");
    const path = nodeReq("path");
    const os = nodeReq("os");
    const dirs = [path.join(this.dataHome(), "opencode")];
    const stamp = Date.now();
    let moved = false;
    for (const dir of dirs) {
      for (const name of ["opencode.db", "opencode.db-wal", "opencode.db-shm"]) {
        const f = path.join(dir, name);
        try {
          if (fs.existsSync(f)) {
            fs.renameSync(f, `${f}.broken-${stamp}`);
            moved = true;
          }
        } catch (e) {
          /* ignore */
        }
      }
    }
    return moved;
  }

  async start(progress, retried) {
    progress = progress || (() => {});
    if (this.isRunning()) return;
    const bin = await this.findBinary();
    if (!bin) throw new Error("OpenCode isn't installed.");
    const { spawn } = nodeReq("child_process");
    const crypto = nodeReq("crypto");
    const os = nodeReq("os");
    const port = await freePort();
    const password = crypto.randomBytes(16).toString("hex");
    progress("Starting OpenCode...");
    try {
      nodeReq("fs").mkdirSync(this.dataHome(), { recursive: true });
    } catch (e) {
      /* ignore */
    }
    this.tail = "";
    const proc = spawn(bin, ["serve", "--hostname", "127.0.0.1", "--port", String(port)], {
      cwd: this.plugin.vaultPath() || os.homedir(),
      env: Object.assign({}, process.env, {
        OPENCODE_SERVER_PASSWORD: password,
        OPENCODE_SERVER_USERNAME: "opencode",
        XDG_DATA_HOME: this.dataHome(),
      }),
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      shell: bin === "opencode" && process.platform === "win32",
    });
    const keep = (d) => (this.tail = (this.tail + d).slice(-1500));
    proc.stdout.on("data", keep);
    proc.stderr.on("data", keep);
    proc.on("error", (e) => keep(e.message));
    proc.on("exit", () => {
      if (this.proc === proc) {
        this.proc = null;
        this.conn = null;
      }
    });
    this.proc = proc;
    this.conn = { url: `http://127.0.0.1:${port}`, username: "opencode", password };

    const client = new OpenCodeClient(this.conn);
    const t0 = Date.now();
    for (let i = 0; i < 180; i++) {
      if (!this.isRunning()) {
        const out = this.tail.replace(/\x1b\[[0-9;]*m/g, "").replace(/\[[0-9;]*m/g, "").trim();
        if (!retried && /Database is not empty|no session table/i.test(out) && this.quarantineDb()) {
          progress("Repairing OpenCode's database...");
          return this.start(progress, true);
        }
        throw new Error(`OpenCode stopped right after starting. ${out.slice(-300)}`);
      }
      try {
        await client.health();
        return;
      } catch (e) {
        if (i % 2 === 1) {
          const secs = Math.round((Date.now() - t0) / 1000);
          progress(secs > 10 ? `Starting OpenCode... ${secs}s (the first start is slow while antivirus checks the program)` : `Starting OpenCode... ${secs}s`);
        }
        await sleep(500);
      }
    }
    this.stop();
    throw new Error(`OpenCode didn't become ready within 90 seconds. ${this.tail.trim().slice(-300)}`);
  }

  stop() {
    const p = this.proc;
    this.proc = null;
    this.conn = null;
    if (p && p.exitCode === null) {
      try {
        p.kill();
      } catch (e) {
        /* ignore */
      }
      const t = setTimeout(() => {
        try {
          if (p.exitCode === null) p.kill("SIGKILL");
        } catch (e) {
          /* ignore */
        }
      }, 3000);
      if (t && t.unref) t.unref();
    }
  }

  /** Make sure an existing OpenCode is running. It never downloads anything. Safe to call repeatedly. */
  ensure(progress) {
    if (this.starting) return this.starting;
    this.starting = (async () => {
      if (this.isRunning()) return;
      if (!Platform.isDesktopApp) throw new Error("OpenCode auto-setup needs the desktop app (it isn't available on mobile yet).");
      if (!(await this.findBinary())) {
        throw new Error("OpenCode isn't set up yet. Open Settings > MCQ Tracker > AI assistant and press Download and install, or choose a copy you already have.");
      }
      await this.start(progress);
    })().finally(() => {
      this.starting = null;
    });
    return this.starting;
  }

  /** Save an API key into OpenCode's own auth.json (merged, not overwritten). */
  saveProviderKey(providerId, key) {
    const fs = nodeReq("fs");
    const path = nodeReq("path");
    const os = nodeReq("os");
    const dir = path.join(this.dataHome(), "opencode");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, "auth.json");
    let cur = "";
    try {
      cur = fs.readFileSync(file, "utf8");
    } catch (e) {
      /* new file */
    }
    fs.writeFileSync(file, mergeAuth(cur, providerId, key.trim()), { mode: 0o600 });
    if (process.platform !== "win32") fs.chmodSync(file, 0o600); // the file holds secrets: owner-only even if it already existed
    this.stop(); // restart on next use so it picks the key up
    return file;
  }
}

module.exports = {
  nodeReq,
  OPENCODE_REPO,
  PROVIDERS,
  platformTriple,
  candidateAssetNames,
  chooseRelease,
  mergeAuth,
  killTree,
  runCmd,
  downloadFile,
  extractArchive,
  findBinaryIn,
  freePort,
  OpenCodeManager,
};
