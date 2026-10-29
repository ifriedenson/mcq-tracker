"use strict";
/*
 * Local OCR adapter for a user-installed program. No OCR binary is bundled and
 * no third-party code is copied. The command is executed directly (not through
 * a shell), with `{image}` replaced by a temporary PNG path.
 */
const { Platform } = require("obsidian");
const { str } = require("./util");

const DEFAULT_LOCAL_OCR = { command: "", timeoutSeconds: 120 };

function normalizeLocalOcr(value) {
  const v = value && typeof value === "object" ? value : {};
  const timeout = Math.round(Number(v.timeoutSeconds));
  return {
    command: str(v.command).trim().slice(0, 500),
    timeoutSeconds: Number.isFinite(timeout) ? Math.min(600, Math.max(10, timeout)) : DEFAULT_LOCAL_OCR.timeoutSeconds,
  };
}

/** Quote-aware split. This is only for a user-provided command line, never a shell. */
function tokenize(template) {
  const text = str(template).trim();
  if (!text) return [];
  const out = [];
  let cur = "";
  let quote = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === quote) {
        quote = "";
        continue;
      }
      // A Windows path like "C:\\Program Files\\ocr.exe" must keep its slashes.
      if (ch === "\\" && quote === '"' && (text[i + 1] === '"' || text[i + 1] === "\\")) {
        cur += text[++i];
        continue;
      }
      cur += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (cur) {
        out.push(cur);
        cur = "";
      }
      continue;
    }
    cur += ch;
  }
  if (quote) throw new Error("The local OCR command has an unclosed quote.");
  if (cur) out.push(cur);
  return out;
}

/** Turn `tesseract {image} stdout` into an executable and an argument array. */
function commandParts(template, imagePath) {
  const parts = tokenize(template);
  if (!parts.length) throw new Error("Add a local OCR command first.");
  if (!parts.some((part) => part.includes("{image}"))) {
    throw new Error("The local OCR command must contain {image}, where the page file path goes.");
  }
  const command = parts[0];
  const args = parts.slice(1).map((part) => part.split("{image}").join(String(imagePath || "")));
  return { command, args };
}

function localOcrLabel(template) {
  const parts = tokenize(template);
  if (!parts.length) return "local OCR";
  return parts[0].replace(/^.*[\\/]/, "") || "local OCR";
}

function runProcess(command, args, options) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      const cp = require("child_process");
      child = cp.execFile(
        command,
        args,
        { timeout: (options && options.timeoutSeconds ? options.timeoutSeconds : 120) * 1000, maxBuffer: 20 * 1024 * 1024, windowsHide: true },
        (error, stdout, stderr) => {
          if (error) {
            const detail = str(stderr).trim() || str(error.message).trim();
            reject(new Error(`The local OCR command failed${detail ? `: ${detail.slice(0, 400)}` : "."}`));
            return;
          }
          resolve({ stdout: str(stdout), stderr: str(stderr) });
        }
      );
    } catch (e) {
      reject(new Error(`The local OCR command could not start: ${str(e && e.message) || e}`));
      return;
    }
    if (child && child.stdin) child.stdin.end();
  });
}

/**
 * Run the configured command once per rendered page. Temporary page files and
 * their directory are removed even when OCR fails.
 */
async function ocrPagesWithLocalCommand(template, pages, options) {
  if (!Platform.isDesktopApp) throw new Error("Local OCR commands are desktop-only. Use AI vision on mobile.");
  const list = (Array.isArray(pages) ? pages : []).filter((page) => page && page.png);
  if (!list.length) throw new Error("There are no rendered pages to read.");
  const opts = normalizeLocalOcr({ command: template, timeoutSeconds: options && options.timeoutSeconds });
  if (!opts.command) throw new Error("Add a local OCR command in Settings, Global, General first.");
  // Check the template before creating temporary files so a typo fails early.
  commandParts(opts.command, "/tmp/page.png");

  const fs = require("fs/promises");
  const os = require("os");
  const path = require("path");
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "mcq-ocr-"));
  try {
    const results = [];
    for (let i = 0; i < list.length; i++) {
      const page = list[i];
      const file = path.join(dir, `page-${page.n || i + 1}.png`);
      await fs.writeFile(file, Buffer.from(page.png));
      const call = commandParts(opts.command, file);
      const result = await runProcess(call.command, call.args, opts);
      const text = str(result.stdout || result.stderr).trim();
      results.push({ n: page.n || i + 1, text });
    }
    return results;
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

module.exports = {
  DEFAULT_LOCAL_OCR,
  normalizeLocalOcr,
  tokenize,
  commandParts,
  localOcrLabel,
  ocrPagesWithLocalCommand,
};
