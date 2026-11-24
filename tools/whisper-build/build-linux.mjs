#!/usr/bin/env node
/*
 * Builds the whisper.cpp release this plugin pins, on Linux, outside the repository.
 *
 * Linux (and macOS) have no official whisper.cpp asset in this plugin's registry,
 * so the local transcription slice asks for the owner's own `whisper-cli`. This
 * script is the repeatable way to get one: it clones the exact tag recorded in
 * src/whisper-registry.js, builds only `whisper-cli`, and prints the absolute
 * path to paste into Settings → Read aloud → Local transcription program.
 *
 * Nothing it produces is added to the repository or to `main.js`: the source
 * tree, the build directory and the binary all live in a scratch folder, and the
 * script refuses a target directory inside the repository.
 *
 *   node tools/whisper-build/build-linux.mjs
 *   node tools/whisper-build/build-linux.mjs --dir ~/src --jobs 8
 *   node tools/whisper-build/build-linux.mjs --dry-run
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const registry = require("../../src/whisper-registry.js");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SOURCE_REPO = `https://github.com/${registry.REPO}.git`;
const USAGE = `Usage: node tools/whisper-build/build-linux.mjs [options]

  --tag TAG      release tag to build (default: the tag pinned in the registry)
  --dir DIR      scratch folder for the source and build (default: $TMPDIR/mcq-whisper-build/<tag>)
  --jobs N       parallel compile jobs (default: your CPU count)
  --rebuild      build again even when the binary is already there
  --dry-run      print the commands and write nothing
  --help         this text

The binary is left at <dir>/whisper.cpp/build/bin/whisper-cli and is never
copied into the repository or bundled into main.js.`;

function parseArgs(argv) {
  const options = {
    tag: registry.TAG,
    dir: "",
    jobs: Math.max(1, os.cpus().length),
    rebuild: false,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) throw new Error(`${arg} needs a value`);
      i += 1;
      return value;
    };
    if (arg === "--help" || arg === "-h") return { help: true };
    else if (arg === "--tag") options.tag = next().trim();
    else if (arg === "--dir") options.dir = next();
    else if (arg === "--jobs") {
      const jobs = Number(next());
      if (!Number.isInteger(jobs) || jobs < 1) throw new Error("--jobs needs a whole number of 1 or more");
      options.jobs = jobs;
    } else if (arg === "--rebuild") options.rebuild = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else throw new Error(`Unknown option ${arg}`);
  }
  return options;
}

/** True for the repository itself and anything under it. */
function insideRepository(target) {
  const relative = path.relative(ROOT, path.resolve(target));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function command(commandName, args, { capture = false, cwd } = {}) {
  const shown = [commandName, ...args].join(" ");
  console.log(`\n$ ${shown}`);
  if (options.dryRun) return { status: 0, stdout: "", stderr: "" };
  const result = spawnSync(commandName, args, {
    cwd,
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
    encoding: "utf8",
  });
  if (result.error) throw new Error(`${commandName} could not start (${result.error.message})`);
  if (result.status !== 0) throw new Error(`${shown} exited ${result.status}`);
  return { status: result.status, stdout: result.stdout || "", stderr: result.stderr || "" };
}

function haveTool(name) {
  const result = spawnSync(name, ["--version"], { stdio: "ignore" });
  return !result.error && result.status === 0;
}

function main() {
  if (!fs.existsSync(path.join(ROOT, "src", "whisper-registry.js"))) {
    throw new Error(`Run this from the repository that holds src/whisper-registry.js (looked in ${ROOT}).`);
  }

  const pinned = registry.TAG;
  if (!/^v\d+\.\d+\.\d+$/.test(options.tag)) {
    throw new Error(`--tag must look like v1.8.6; the registry pins ${pinned}.`);
  }
  if (options.tag !== pinned) {
    console.warn(
      `\nWarning: building ${options.tag}, but this checkout pins ${pinned}. ` +
        `A binary from another tag is not the release the installer describes.`
    );
  }

  const dir = path.resolve(options.dir || path.join(os.tmpdir(), "mcq-whisper-build", options.tag));
  if (insideRepository(dir)) {
    throw new Error(
      `Refusing to build in ${dir}: it is inside the repository. ` +
        `The binary must never be committed or bundled; pick a folder outside ${ROOT}.`
    );
  }

  const missing = ["git", "cmake"].filter((name) => !haveTool(name));
  if (missing.length) {
    throw new Error(
      `Missing ${missing.join(" and ")}. On Debian/Ubuntu: ` +
        `"sudo apt-get install -y build-essential cmake git"; without root, ` +
        `"python3 -m venv /tmp/cmk && /tmp/cmk/bin/pip install cmake" and put /tmp/cmk/bin on PATH.`
    );
  }

  const source = path.join(dir, "whisper.cpp");
  const build = path.join(source, "build");
  const binary = path.join(build, "bin", "whisper-cli");

  console.log(`whisper.cpp ${options.tag} → ${dir}`);
  console.log("Nothing here is added to git, the plugin folder or main.js.");

  if (process.platform !== "linux") {
    console.log(`Note: this recipe is written for Linux; you are on ${process.platform} (macOS can "brew install whisper-cpp").`);
  }

  fs.mkdirSync(dir, { recursive: true });

  if (fs.existsSync(path.join(source, ".git"))) {
    const head = spawnSync("git", ["-C", source, "describe", "--tags", "--exact-match", "HEAD"], {
      encoding: "utf8",
    });
    const at = (head.stdout || "").trim();
    if (head.status !== 0 || at !== options.tag) {
      throw new Error(
        `${source} exists but is not a checkout of ${options.tag} (found ${at || "no exact tag"}). ` +
          `Remove that folder, or pass --dir with a fresh one.`
      );
    }
    console.log(`Reusing the checkout at ${source}.`);
  } else {
    command("git", ["clone", "--depth", "1", "--branch", options.tag, SOURCE_REPO, source]);
  }

  if (!options.dryRun && fs.existsSync(binary) && !options.rebuild) {
    console.log(`\nAlready built: ${binary}`);
    return report(binary, source, options.tag);
  }

  command("cmake", [
    "-S",
    source,
    "-B",
    build,
    "-DCMAKE_BUILD_TYPE=Release",
    "-DWHISPER_BUILD_EXAMPLES=ON",
    "-DWHISPER_BUILD_TESTS=OFF",
  ]);
  command("cmake", ["--build", build, "--config", "Release", "--target", "whisper-cli", "-j", String(options.jobs)]);

  if (!options.dryRun && !fs.existsSync(binary)) {
    throw new Error(`The build finished without ${binary}. Check the output above for the target it built.`);
  }
  report(binary, source, options.tag);
}

function report(binary, source, tag) {
  const sample = path.join(source, "samples", "jfk.wav");
  console.log("\n" + "-".repeat(72));
  console.log(`whisper-cli ${tag}${options.dryRun ? " (dry run: not built)" : ""}`);
  console.log(`  binary:  ${binary}`);
  console.log(`  source:  ${source}`);
  if (fs.existsSync(sample)) console.log(`  sample:  ${sample}`);
  console.log("\nPoint the plugin at it:");
  console.log("  Settings → Read aloud → Local transcription → program path");
  console.log(`  (that value is the audioTranscription.binaryPath setting)`);
  console.log("\nThen run Audio: set up local transcription… to download a model.");
  console.log("The binary and this source tree stay outside the repository: nothing is");
  console.log("committed, and main.js is built from src/ alone. Audio: remove local transcription");
  console.log("files deletes only the plugin's managed model files, never this build.");
  console.log("-".repeat(72));
}

const options = (() => {
  try {
    return parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message + "\n\n" + USAGE);
    process.exit(1);
  }
})();

if (options.help) {
  console.log(USAGE);
  process.exit(0);
}

try {
  main();
} catch (error) {
  console.error(`\nbuild-linux: ${error.message}`);
  process.exit(1);
}
