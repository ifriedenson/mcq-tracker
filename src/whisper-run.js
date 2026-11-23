"use strict";
/*
 * Runs `whisper-cli` on a local WAV file and reads what it wrote.
 *
 * The argv is fixed and every path is a separate array entry, so nothing from
 * a note, a folder or a settings field can become a flag. The process is
 * started through an injectable boundary, which is how the suite proves the
 * argument shape, the deadline, the progress lines, cancellation and the
 * stderr tail without a model or a microphone.
 */
const { str } = require("./util");
const wav = require("./whisper-wav");

const MIN_DEADLINE_MS = 2 * 60 * 1000;
const MAX_THREADS = 4;
const DEFAULT_THREADS = 2;

function threadsFor(cpus) {
  const count = Math.floor(Number(cpus));
  if (!Number.isFinite(count) || count < 1) return DEFAULT_THREADS;
  return Math.max(1, Math.min(MAX_THREADS, count));
}

function defaultThreads() {
  try {
    return threadsFor(require("os").cpus().length);
  } catch (e) {
    return DEFAULT_THREADS;
  }
}

/** Twice the audio length, but never under two minutes. */
function deadlineMs(seconds) {
  const length = Math.max(0, Number(seconds) || 0);
  return Math.max(MIN_DEADLINE_MS, Math.ceil(length * 2000));
}

function buildArgs(input) {
  const source = input && typeof input === "object" ? input : {};
  const language = str(source.language).trim() || "en";
  return [
    "-m",
    str(source.modelPath),
    "-f",
    str(source.wavPath),
    "-l",
    language,
    "-t",
    String(source.threads || defaultThreads()),
    "-otxt",
    "-oj",
    "-of",
    str(source.outBase),
  ];
}

/** `00:00:12,340` or `00:00:12.340` in seconds. */
function parseStamp(value) {
  const match = /^(\d+):(\d{2}):(\d{2})[.,](\d{1,3})$/.exec(str(value).trim());
  if (!match) return 0;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4].padEnd(3, "0")) / 1000;
}

/** whisper.cpp's JSON output: one segment per spoken stretch. */
function parseJsonSegments(text) {
  let data;
  try {
    data = JSON.parse(str(text));
  } catch (e) {
    return [];
  }
  const rows = data && Array.isArray(data.transcription) ? data.transcription : [];
  const segments = [];
  for (const row of rows) {
    if (!row) continue;
    const content = str(row.text).replace(/\s+/g, " ").trim();
    if (!content) continue;
    const offsets = row.offsets && typeof row.offsets === "object" ? row.offsets : {};
    const stamps = row.timestamps && typeof row.timestamps === "object" ? row.timestamps : {};
    const start = Number.isFinite(Number(offsets.from)) ? Number(offsets.from) / 1000 : parseStamp(stamps.from);
    segments.push({ start: Math.max(0, Number(start) || 0), text: content });
  }
  return segments;
}

/** The plain .txt output has no timing: one segment for the whole recording. */
function parsePlainSegments(text) {
  const content = str(text).replace(/\s+/g, " ").trim();
  return content ? [{ start: 0, text: content }] : [];
}

function readTranscript(input) {
  const source = input && typeof input === "object" ? input : {};
  const fromJson = parseJsonSegments(source.jsonText);
  return fromJson.length ? fromJson : parsePlainSegments(source.txtText);
}

/** `[mm:ss]`, or `[h:mm:ss]` past an hour. */
function clock(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  if (hours) return `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function renderTranscript(segments, options) {
  const list = (Array.isArray(segments) ? segments : []).filter((segment) => segment && str(segment.text).trim());
  if (!list.length) return "";
  if (options && options.timestamps === false) return list.map((segment) => str(segment.text).trim()).join("\n\n");
  return list.map((segment) => `**[${clock(segment.start)}]** ${str(segment.text).trim()}`).join("\n\n");
}

/** The last `--> ...` stamp whisper.cpp printed, in seconds. */
function parseProgress(line) {
  const text = str(line);
  const matches = [...text.matchAll(/-->\s*(\d{2}):(\d{2}):(\d{2})[.,](\d{1,3})/g)];
  if (!matches.length) return null;
  const match = matches[matches.length - 1];
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4].padEnd(3, "0")) / 1000;
}

/** The few lines a failure should show, without ANSI colour or a stack. */
function stderrTail(text, count) {
  const limit = Math.max(1, Math.min(20, Math.round(Number(count) || 4)));
  const lines = str(text)
    .replace(/\x1b\[[0-9;]*m/g, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-limit);
  return lines.join(" | ").slice(0, 600);
}

/**
 * Start whisper-cli once. The promise always settles and reports what
 * happened; a cancel or a deadline kills the child instead of leaving it.
 */
function startWhisper(options) {
  const opts = options && typeof options === "object" ? options : {};
  const stderr = [];
  let stdout = "";
  let settled = false;
  let cancelled = false;
  let timedOut = false;
  let child = null;
  let timer = null;
  let watchdog = null;
  let resolvePromise = null;
  const promise = new Promise((resolve) => {
    resolvePromise = resolve;
  });
  const clear = () => {
    if (timer) clearTimeout(timer);
    if (watchdog) clearTimeout(watchdog);
    timer = null;
    watchdog = null;
  };
  const finish = (code, error) => {
    if (settled) return;
    settled = true;
    clear();
    resolvePromise({
      ok: !error && code === 0 && !cancelled && !timedOut,
      code,
      stdout,
      stderr: stderr.join("\n"),
      cancelled,
      timedOut,
      error: error ? str(error && error.message ? error.message : error) : "",
    });
  };
  const kill = () => {
    try {
      if (child && typeof child.kill === "function") child.kill("SIGKILL");
    } catch (e) {
      /* the child is already gone */
    }
    if (!watchdog) {
      watchdog = setTimeout(() => finish(null), 5000);
      if (watchdog.unref) watchdog.unref();
    }
  };
  const spawnFn = typeof opts.spawn === "function" ? opts.spawn : require("child_process").spawn;
  try {
    child = spawnFn(opts.command, opts.args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    finish(null, e);
    return { promise, cancel() {} };
  }
  const onStderr = (chunk) => {
    const text = str(chunk);
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      stderr.push(line.trim());
      if (stderr.length > 40) stderr.splice(0, stderr.length - 40);
      const seconds = parseProgress(line);
      if (seconds !== null && typeof opts.onProgress === "function") opts.onProgress(seconds);
    }
  };
  try {
    if (child.stderr && typeof child.stderr.on === "function") child.stderr.on("data", onStderr);
    if (child.stdout && typeof child.stdout.on === "function") {
      child.stdout.on("data", (chunk) => {
        stdout += str(chunk);
        if (stdout.length > 200000) stdout = stdout.slice(-200000);
      });
    }
    if (typeof child.on === "function") {
      child.on("error", (error) => finish(null, error));
      child.on("close", (code) => finish(Number.isFinite(code) ? code : null));
    }
  } catch (e) {
    finish(null, e);
  }
  const limit = Math.max(1000, Number(opts.timeoutMs) || 0);
  if (Number(opts.timeoutMs) > 0) {
    timer = setTimeout(() => {
      timedOut = true;
      kill();
    }, limit);
    if (timer.unref) timer.unref();
  }
  return {
    promise,
    cancel() {
      if (settled) return;
      cancelled = true;
      kill();
    },
  };
}

/**
 * Decode any recording the renderer can read into 16 kHz mono samples. The
 * audio context comes from the caller or the window, so the suite can hand in
 * a stand-in buffer and never touch a sound card.
 */
async function decodeRecording(bytes, options) {
  const opts = options && typeof options === "object" ? options : {};
  const Ctx =
    opts.audioContext ||
    (typeof window !== "undefined" ? window.AudioContext || window.webkitAudioContext : typeof AudioContext === "undefined" ? null : AudioContext);
  if (!Ctx) return { ok: false, message: "This device cannot decode audio, so the recording cannot be transcribed here." };
  if (!bytes || typeof bytes.byteLength !== "number" || !bytes.byteLength) return { ok: false, message: "The recording is empty." };
  let context;
  try {
    context = new Ctx();
  } catch (e) {
    return { ok: false, message: "This device could not open its audio decoder." };
  }
  let buffer;
  try {
    const copy = bytes.buffer instanceof ArrayBuffer ? bytes.buffer.slice(bytes.byteOffset || 0, (bytes.byteOffset || 0) + bytes.byteLength) : bytes;
    buffer = await context.decodeAudioData(copy);
  } catch (e) {
    return { ok: false, message: "That recording could not be decoded. Convert it to WAV and try again." };
  } finally {
    try {
      if (context.close) context.close();
    } catch (e) {
      /* a decoder that was never opened */
    }
  }
  if (!buffer) return { ok: false, message: "That recording could not be decoded. Convert it to WAV and try again." };
  const channels = [];
  const count = Math.max(1, Math.round(Number(buffer.numberOfChannels) || 1));
  for (let i = 0; i < count; i += 1) {
    if (typeof buffer.getChannelData === "function") channels.push(buffer.getChannelData(i));
  }
  const rate = Number(buffer.sampleRate) || wav.SAMPLE_RATE;
  const seconds = Number(buffer.duration) || wav.durationOf(channels[0] || [], rate);
  if (!(seconds > 0)) return { ok: false, message: "The recording is empty." };
  if (seconds > wav.MAX_SECONDS) {
    return {
      ok: false,
      message: `That recording is ${Math.round(seconds / 60)} minutes long. Transcriptions over ${wav.MAX_SECONDS / 3600} hours are refused so a run cannot fill the disk.`,
    };
  }
  const samples = wav.resampleLinear(wav.downmix(channels), rate, wav.SAMPLE_RATE);
  return { ok: true, samples, sampleRate: wav.SAMPLE_RATE, seconds: samples.length / wav.SAMPLE_RATE };
}

module.exports = {
  DEFAULT_THREADS,
  MIN_DEADLINE_MS,
  buildArgs,
  clock,
  deadlineMs,
  decodeRecording,
  defaultThreads,
  parseJsonSegments,
  parsePlainSegments,
  parseProgress,
  parseStamp,
  readTranscript,
  renderTranscript,
  startWhisper,
  stderrTail,
  threadsFor,
};
