"use strict";
/*
 * Downloads and verifies the local transcription program and models.
 *
 * Everything lands in the plugin's own data folder, never the vault, and only
 * after the owner confirms: nothing is fetched on load, on update or in the
 * background. A download is hashed first and refused on a mismatch, and the
 * receipt records the tag and hash that were actually installed. The program is
 * only ever started from a path this module resolved, and only Windows has an
 * official pinned build; every other system points at a whisper-cli its owner
 * installed.
 *
 * Node built-ins are loaded by literal name, so a static review can see every
 * module the plugin can reach. They are reached only from command handlers, so
 * nothing here is evaluated at plugin startup.
 */
const { str } = require("./util");
const registry = require("./whisper-registry");

const NODE = {
  child_process: () => require("child_process"),
  crypto: () => require("crypto"),
  fs: () => require("fs"),
  http: () => require("http"),
  https: () => require("https"),
  os: () => require("os"),
  path: () => require("path"),
};

function nodeReq(name) {
  const load = NODE[name];
  if (!load) throw new Error(registry.DESKTOP_ONLY_MESSAGE);
  try {
    return load();
  } catch (e) {
    throw new Error(registry.DESKTOP_ONLY_MESSAGE);
  }
}

/** The vault's own plugin folder, which is outside the notes. */
function installRoot(plugin) {
  const path = nodeReq("path");
  const base = str(plugin && typeof plugin.vaultPath === "function" ? plugin.vaultPath() : "").trim();
  if (!base) throw new Error(registry.DESKTOP_ONLY_MESSAGE);
  const config = str(plugin.app && plugin.app.vault && plugin.app.vault.configDir).replace(/^\/+|\/+$/g, "") || ".obsidian";
  const id = str(plugin.manifest && plugin.manifest.id).replace(/[\\/]/g, "") || "mcq-tracker";
  return path.join(base, config, "plugins", id, "whisper");
}

function binaryPath(plugin) {
  const path = nodeReq("path");
  return path.join(installRoot(plugin), "bin", process.platform === "win32" ? "whisper-cli.exe" : "whisper-cli");
}

function modelPath(plugin, name) {
  const entry = registry.model(name);
  if (!entry) throw new Error(`Unknown transcription model ${str(name) || "(none)"}.`);
  return nodeReq("path").join(installRoot(plugin), "models", entry.file);
}

function receiptPath(plugin) {
  return nodeReq("path").join(installRoot(plugin), "install.json");
}

/** A fresh folder for one run's temporary WAV and whisper output. */
function workDir(plugin, stem) {
  return nodeReq("path").join(installRoot(plugin), "tmp", str(stem) || "run");
}

function sha256(bytes) {
  const crypto = nodeReq("crypto");
  return crypto.createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}

/** The streaming hash of a file, so a 465 MiB model never sits in memory. */
function sha256File(file) {
  const fs = nodeReq("fs");
  const crypto = nodeReq("crypto");
  const hash = crypto.createHash("sha256");
  const buffer = Buffer.allocUnsafe(1 << 20);
  const fd = fs.openSync(file, "r");
  try {
    let read = 0;
    while ((read = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) hash.update(buffer.subarray(0, read));
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest("hex");
}

function verifySha256(bytes, expected) {
  const want = str(expected).trim().toLowerCase();
  return registry.isSha256(want) && sha256(bytes) === want;
}

function download(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const requests = 0;
    const go = (target, hops) => {
      if (hops > 6) {
        reject(new Error("Too many redirects while downloading."));
        return;
      }
      let parsed;
      try {
        parsed = new URL(target);
      } catch (e) {
        reject(new Error("The download address is not valid."));
        return;
      }
      const lib = nodeReq(parsed.protocol === "http:" ? "http" : "https");
      const fs = nodeReq("fs");
      const request = lib.get(
        target,
        { headers: { "User-Agent": "obsidian-question-tracker", Accept: "application/octet-stream" } },
        (response) => {
          if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
            response.resume();
            go(new URL(response.headers.location, target).toString(), hops + 1);
            return;
          }
          if (response.statusCode !== 200) {
            response.resume();
            reject(new Error(`Download failed: HTTP ${response.statusCode}`));
            return;
          }
          const total = Number(response.headers["content-length"]) || 0;
          let got = 0;
          const out = fs.createWriteStream(dest);
          response.on("data", (chunk) => {
            got += chunk.length;
            if (typeof onProgress === "function") onProgress(got, total);
          });
          response.on("error", reject);
          out.on("error", reject);
          out.on("finish", () => resolve({ bytes: got, total }));
          response.pipe(out);
        }
      );
      request.on("error", reject);
      request.setTimeout(60000, () => request.destroy(new Error("Download timed out.")));
    };
    go(url, requests);
  });
}

function runCmd(cmd, args, timeout) {
  return new Promise((resolve, reject) => {
    const { execFile } = nodeReq("child_process");
    execFile(cmd, args, { windowsHide: true, timeout }, (error) => {
      if (error) reject(new Error(str(error.message).slice(0, 400)));
      else resolve();
    });
  });
}

/** Unpack the pinned zip. Windows PowerShell is the one path the asset needs. */
async function extractArchive(archive, dest) {
  const fs = nodeReq("fs");
  fs.mkdirSync(dest, { recursive: true });
  if (process.platform === "win32") {
    const quote = (value) => String(value).replace(/'/g, "''");
    await runCmd("powershell", ["-NoProfile", "-Command", `Expand-Archive -LiteralPath '${quote(archive)}' -DestinationPath '${quote(dest)}' -Force`], 10 * 60 * 1000);
    return;
  }
  await runCmd("tar", ["-xf", archive, "-C", dest], 8 * 60 * 1000);
}

function findFileName(dir, name) {
  const fs = nodeReq("fs");
  const path = nodeReq("path");
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (e) {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name.toLowerCase() === String(name).toLowerCase()) return full;
    }
  }
  return "";
}

function readReceipt(plugin) {
  try {
    return JSON.parse(nodeReq("fs").readFileSync(receiptPath(plugin), "utf8")) || {};
  } catch (e) {
    return {};
  }
}

function writeReceipt(plugin, patch) {
  const fs = nodeReq("fs");
  const path = nodeReq("path");
  const root = installRoot(plugin);
  fs.mkdirSync(root, { recursive: true });
  const next = { ...readReceipt(plugin), ...(patch || {}) };
  fs.writeFileSync(path.join(root, "install.json"), JSON.stringify(next, null, 2) + "\n");
  return next;
}

function installedModelPath(plugin, name) {
  const entry = registry.model(name);
  if (!entry) return "";
  const file = modelPath(plugin, entry.name);
  try {
    return nodeReq("fs").statSync(file).isFile() ? file : "";
  } catch (e) {
    return "";
  }
}

/** The saved program when it exists, otherwise the managed one; "" if neither. */
function resolveBinary(plugin, settings) {
  const fs = nodeReq("fs");
  const explicit = str(settings && settings.binaryPath).trim();
  if (explicit) {
    try {
      return fs.statSync(explicit).isFile() ? explicit : "";
    } catch (e) {
      return "";
    }
  }
  const managed = binaryPath(plugin);
  try {
    return fs.statSync(managed).isFile() ? managed : "";
  } catch (e) {
    return "";
  }
}

/** Download one model, verify it and keep it beside the program. */
async function installModel(plugin, name, onProgress) {
  const entry = registry.model(name);
  if (!entry) throw new Error(`Unknown transcription model ${str(name) || "(none)"}.`);
  const fs = nodeReq("fs");
  const path = nodeReq("path");
  const say = typeof onProgress === "function" ? onProgress : () => {};
  const dest = modelPath(plugin, entry.name);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest)) {
    if (sha256File(dest) === entry.sha256) return { path: dest, bytes: entry.bytes, verified: true, cached: true };
    fs.rmSync(dest, { force: true });
  }
  const partial = `${dest}.download-${Date.now().toString(36)}`;
  say(`Downloading the ${entry.name} model (${registry.formatBytes(entry.bytes)})...`);
  let lastPercent = -2;
  await download(registry.modelUrl(entry), partial, (got, total) => {
    const percent = total ? Math.floor((got / total) * 100) : -1;
    if (percent !== lastPercent) {
      lastPercent = percent;
      say(total ? `Downloading the ${entry.name} model... ${percent}%` : `Downloading the ${entry.name} model... ${registry.formatBytes(got)}`);
    }
  });
  if (sha256File(partial) !== entry.sha256) {
    fs.rmSync(partial, { force: true });
    throw new Error("The model download failed its SHA-256 check, so it was deleted. Try again, or set your own model file.");
  }
  fs.renameSync(partial, dest);
  writeReceipt(plugin, {
    model: entry.name,
    modelFile: entry.file,
    modelSha256: entry.sha256,
    modelBytes: entry.bytes,
    modelDownloadedAt: new Date().toISOString(),
  });
  return { path: dest, bytes: entry.bytes, verified: true, cached: false };
}

/** Download the pinned Windows binary, verify it and keep whisper-cli with its DLLs. */
async function installBinary(plugin, onProgress) {
  const asset = registry.binaryAsset(process.platform, process.arch);
  if (!asset) throw new Error(registry.unsupportedBinaryMessage(process.platform, process.arch));
  const fs = nodeReq("fs");
  const path = nodeReq("path");
  const say = typeof onProgress === "function" ? onProgress : () => {};
  const root = installRoot(plugin);
  fs.mkdirSync(root, { recursive: true });
  const archive = path.join(root, `whisper-${registry.TAG}.zip`);
  say(`Downloading whisper.cpp ${registry.TAG} (${registry.formatBytes(asset.bytes)})...`);
  await download(registry.binaryAssetUrl(asset), archive, (got, total) => {
    if (total) say(`Downloading whisper.cpp... ${Math.floor((got / total) * 100)}%`);
  });
  if (sha256File(archive) !== asset.sha256) {
    fs.rmSync(archive, { force: true });
    throw new Error("The whisper.cpp download failed its SHA-256 check, so it was deleted.");
  }
  const unpack = path.join(root, `unpack-${Date.now().toString(36)}`);
  try {
    say("Unpacking whisper.cpp...");
    await extractArchive(archive, unpack);
    const found = findFileName(unpack, "whisper-cli.exe") || findFileName(unpack, "whisper-cli") || findFileName(unpack, "main.exe");
    if (!found) throw new Error("The whisper.cpp download did not contain whisper-cli.");
    const bin = path.join(root, "bin");
    fs.rmSync(bin, { recursive: true, force: true });
    fs.renameSync(path.dirname(found), bin);
    const target = path.join(bin, path.basename(found));
    if (process.platform !== "win32") fs.chmodSync(target, 0o755);
    writeReceipt(plugin, {
      tag: registry.TAG,
      asset: asset.asset,
      binarySha256: asset.sha256,
      binaryBytes: asset.bytes,
      binaryInstalledAt: new Date().toISOString(),
    });
    return { path: target, tag: registry.TAG, sha256: asset.sha256, verified: true };
  } finally {
    try {
      fs.rmSync(unpack, { recursive: true, force: true });
    } catch (e) {
      /* antivirus can hold a freshly unpacked file */
    }
    try {
      fs.rmSync(archive, { force: true });
    } catch (e) {
      /* already gone */
    }
  }
}

/** Remove every downloaded byte here. The owner's recordings and notes stay. */
function removeAll(plugin) {
  const fs = nodeReq("fs");
  const path = nodeReq("path");
  const root = installRoot(plugin);
  const removed = [];
  let entries = [];
  try {
    entries = fs.readdirSync(root);
  } catch (e) {
    return { removed, root };
  }
  for (const name of entries) {
    const full = path.join(root, name);
    removed.push(name);
    try {
      fs.rmSync(full, { recursive: true, force: true });
    } catch (e) {
      /* a running program or antivirus can hold it */
    }
  }
  return { removed, root };
}

/** One sentence for the settings page and the commands. */
function describe(plugin, settings) {
  try {
    const binary = resolveBinary(plugin, settings);
    const entry = registry.modelForLanguage(settings && settings.model, settings && settings.language);
    const model = installedModelPath(plugin, entry.name);
    if (binary && model) return `Ready: ${entry.name} and ${binary}.`;
    if (binary) return `The program is installed; the ${entry.name} model is not downloaded yet.`;
    if (model) return `The ${entry.name} model is downloaded; the whisper.cpp program is not installed.`;
    return "Nothing is installed yet. Run Audio: set up local transcription… to download it.";
  } catch (e) {
    return str(e && e.message ? e.message : e);
  }
}

module.exports = {
  NODE,
  binaryPath,
  describe,
  download,
  extractArchive,
  findFileName,
  installBinary,
  installModel,
  installRoot,
  installedModelPath,
  modelPath,
  node: nodeReq,
  readReceipt,
  receiptPath,
  removeAll,
  resolveBinary,
  sha256,
  sha256File,
  verifySha256,
  workDir,
  writeReceipt,
};
