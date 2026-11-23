"use strict";
/*
 * The local transcription slice, proved without a microphone, a model or a
 * spawned program: the pinned registry, the 16 kHz WAV encoder, the argv and
 * output parsing, the transcript note, the installer's hash boundary and the
 * settings normalization. The real binary, model and microphone are the
 * owner's checklist in docs/whisper-smoke-test.md.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { EventEmitter } = require("events");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const R = T.whisperRegistry;
const W = T.whisperWav;
const RUN = T.whisperRun;
const NOTE = T.whisperNote;
const INSTALL = T.whisperInstall;
const PICKER = T.whisperPicker;

function fakePlugin(vaultPath) {
  return {
    vaultPath: () => vaultPath,
    app: { vault: { configDir: ".obsidian" } },
    manifest: { id: "mcq-tracker" },
  };
}

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "qt-whisper-"));
}

function fakeChild(script) {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kills = 0;
  child.kill = () => {
    child.kills += 1;
    setImmediate(() => child.emit("close", null));
  };
  setImmediate(() => script(child));
  return child;
}

test("whisper registry: the pinned release, the platform row and every hash", () => {
  assert.equal(R.REPO, "ggml-org/whisper.cpp");
  assert.equal(R.TAG, "v1.8.6");
  assert.equal(R.binaryAsset("win32", "x64").asset, "whisper-bin-x64.zip");
  assert.equal(R.binaryAsset("linux", "x64"), null, "no official Linux build is claimed");
  assert.equal(R.binaryAsset("darwin", "arm64"), null);
  assert.equal(R.platformKey("win32", "x64"), "win32-x64");
  assert.equal(R.platformKey("", ""), "");
  assert.equal(
    R.binaryAssetUrl(R.binaryAsset("win32", "x64")),
    "https://github.com/ggml-org/whisper.cpp/releases/download/v1.8.6/whisper-bin-x64.zip"
  );
  assert.ok(R.isSha256(R.binaryAsset("win32", "x64").sha256));
  for (const entry of R.MODELS) {
    assert.ok(R.isSha256(entry.sha256), `${entry.name} has a SHA-256`);
    assert.ok(entry.bytes > 0, `${entry.name} records a size`);
    assert.match(entry.file, /^ggml-[a-z0-9._-]+\.bin$/);
    assert.equal(R.modelUrl(entry), `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${entry.file}`);
    assert.equal(R.model(entry.name).name, entry.name);
  }
  assert.equal(R.model("../../etc/passwd"), null, "a user string never becomes a registry row");
  assert.equal(R.modelUrl(null), "");
});

test("whisper registry: an English-only file is swapped for the multilingual one", () => {
  assert.equal(R.modelForLanguage("base.en-q5_1", "en").name, "base.en-q5_1");
  assert.equal(R.modelForLanguage("base.en-q5_1", "de").name, "base-q5_1");
  assert.equal(R.modelForLanguage("small.en", "auto").name, "small");
  assert.equal(R.modelForLanguage("tiny.en-q5_1", "es").name, "tiny-q5_1");
  assert.equal(R.modelForLanguage("base-q5_1", "en").name, "base-q5_1");
  assert.equal(R.modelForLanguage("not-a-model", "en").name, R.DEFAULT_MODEL);
  assert.equal(R.multilingualName("base.en-q8_0"), "base-q8_0");
  assert.deepEqual(R.normalizeLanguage(" DE "), "de");
  assert.equal(R.normalizeLanguage("auto"), "auto");
  assert.equal(R.normalizeLanguage("english!"), "en");
});

test("whisper settings: off by default, clamped and safe", () => {
  assert.deepEqual(R.normalizeAudioTranscriptionSettings({}), {
    enabled: false,
    binaryPath: "",
    model: "base.en-q5_1",
    language: "en",
    timestamps: true,
    folder: "Recordings/Transcripts",
  });
  const custom = R.normalizeAudioTranscriptionSettings({
    enabled: true,
    model: "nope",
    language: "DE",
    timestamps: false,
    folder: "/Media/Transcripts/",
    binaryPath: " /usr/local/bin/whisper-cli ",
  });
  assert.equal(custom.enabled, true);
  assert.equal(custom.model, "base.en-q5_1");
  assert.equal(custom.language, "de");
  assert.equal(custom.timestamps, false);
  assert.equal(custom.folder, "Media/Transcripts");
  assert.equal(custom.binaryPath, "/usr/local/bin/whisper-cli");
  assert.equal(R.normalizeAudioTranscriptionSettings({ folder: "../Escape" }).folder, "Recordings/Transcripts");
  assert.equal(R.formatBytes(59721011), "57 MiB");
});

test("wav encoder: a 16 kHz mono header that reads back, clipping and odd lengths", () => {
  const second = new Float32Array(16000).fill(0.25);
  const bytes = W.encodeWavPcm16(second, 16000);
  assert.equal(bytes.length, W.HEADER_BYTES + 32000);
  const header = W.readWavHeader(bytes);
  assert.equal(header.audioFormat, 1);
  assert.equal(header.channels, 1);
  assert.equal(header.sampleRate, 16000);
  assert.equal(header.bitsPerSample, 16);
  assert.equal(header.frames, 16000);
  assert.equal(Math.round(header.seconds), 1);
  const view = new DataView(bytes.buffer);
  assert.equal(view.getInt16(W.HEADER_BYTES, true), W.toPcm16(0.25));

  assert.equal(W.toPcm16(2), 32767);
  assert.equal(W.toPcm16(-2), -32768);
  assert.equal(W.toPcm16(1), 32767);
  assert.equal(W.toPcm16(-1), -32768);
  assert.equal(W.toPcm16(Number.NaN), 0);
  assert.equal(W.toPcm16("not a number"), 0);

  const silence = W.encodeWavPcm16(new Float32Array(3), 16000);
  assert.equal(W.readWavHeader(silence).frames, 3);
  assert.equal(silence[W.HEADER_BYTES], 0);
  assert.equal(W.readWavHeader(new Uint8Array([1, 2, 3])), null);
  assert.equal(W.readWavHeader(null), null);
});

test("wav helpers: downmix, resample and duration", () => {
  const left = Float32Array.from([1, 0, -1, 0.5]);
  const right = Float32Array.from([-1, 1, 1, -0.5]);
  assert.deepEqual(Array.from(W.downmix([left, right])), [0, 0.5, 0, 0]);
  assert.deepEqual(Array.from(W.downmix([left])), [1, 0, -1, 0.5]);
  assert.equal(W.downmix([]).length, 0);
  const doubled = W.resampleLinear(new Float32Array(8000).fill(0.5), 8000, 16000);
  assert.equal(doubled.length, 16000);
  assert.equal(W.resampleLinear(left, 16000, 16000).length, 4);
  assert.equal(W.durationOf(new Float32Array(32000), 16000), 2);
  assert.equal(W.durationOf([], 16000), 0);
});

test("whisper runner: fixed argv, deadline and threads", () => {
  const args = RUN.buildArgs({
    modelPath: "/data/models/ggml-base.en-q5_1.bin",
    wavPath: "/data/tmp/recording.wav",
    outBase: "/data/tmp/transcript",
    language: "de",
    threads: 3,
  });
  assert.deepEqual(args, [
    "-m",
    "/data/models/ggml-base.en-q5_1.bin",
    "-f",
    "/data/tmp/recording.wav",
    "-l",
    "de",
    "-t",
    "3",
    "-otxt",
    "-oj",
    "-of",
    "/data/tmp/transcript",
  ]);
  assert.equal(RUN.deadlineMs(30), RUN.MIN_DEADLINE_MS, "a short clip keeps the two-minute floor");
  assert.equal(RUN.deadlineMs(300), 600000);
  assert.equal(RUN.threadsFor(16), 4);
  assert.equal(RUN.threadsFor(0), RUN.DEFAULT_THREADS);
  assert.equal(RUN.threadsFor("nope"), RUN.DEFAULT_THREADS);
  assert.ok(RUN.defaultThreads() >= 1 && RUN.defaultThreads() <= 4);
});

test("whisper runner: JSON segments, plain fallback and rendered timestamps", () => {
  const json = JSON.stringify({
    transcription: [
      { offsets: { from: 0, to: 12000 }, timestamps: { from: "00:00:00,000", to: "00:00:12,000" }, text: " Today we cover  osmosis. " },
      { timestamps: { from: "00:01:05,500", to: "00:01:09,000" }, text: "Water moves down the gradient." },
      { offsets: { from: 2000, to: 3000 }, text: "   " },
    ],
  });
  const segments = RUN.readTranscript({ jsonText: json, txtText: "ignored" });
  assert.equal(segments.length, 2);
  assert.equal(segments[0].start, 0);
  assert.equal(segments[0].text, "Today we cover osmosis.");
  assert.equal(segments[1].start, 65.5);
  assert.equal(RUN.renderTranscript(segments), "**[00:00]** Today we cover osmosis.\n\n**[01:05]** Water moves down the gradient.");
  assert.equal(RUN.renderTranscript(segments, { timestamps: false }), "Today we cover osmosis.\n\nWater moves down the gradient.");
  assert.equal(RUN.renderTranscript([]), "");

  const plain = RUN.readTranscript({ jsonText: "{broken", txtText: "  A whole\n transcript.  " });
  assert.deepEqual(plain, [{ start: 0, text: "A whole transcript." }]);
  assert.deepEqual(RUN.readTranscript({}), []);
  assert.equal(RUN.clock(12), "00:12");
  assert.equal(RUN.clock(3725), "1:02:05");
});

test("whisper runner: progress lines and the stderr tail", () => {
  assert.equal(RUN.parseProgress("[00:00:12.340 --> 00:00:15.000]  text"), 15);
  assert.equal(RUN.parseProgress("no stamp here"), null);
  assert.equal(RUN.parseProgress("[01:02:03,500 --> 01:02:09,500]  text"), 3729.5);
  const tail = RUN.stderrTail("\u001b[31mfirst line\u001b[0m\n\nlast line\n  ", 1);
  assert.equal(tail, "last line");
});

test("whisper runner: start, failure and cancel through the spawn boundary", async () => {
  const seen = [];
  const progress = [];
  const child = fakeChild((proc) => {
    proc.stderr.emit("data", "[00:00:00.000 --> 00:00:05.000]  hello\n");
    proc.stderr.emit("data", "[00:00:05.000 --> 00:00:09.000]  world\n");
    proc.emit("close", 0);
  });
  const job = RUN.startWhisper({
    command: "/data/bin/whisper-cli",
    args: ["-m", "model", "-f", "file"],
    spawn: (command, args) => {
      seen.push({ command, args });
      return child;
    },
    timeoutMs: 60000,
    onProgress: (seconds) => progress.push(seconds),
  });
  const result = await job.promise;
  assert.equal(result.ok, true);
  assert.equal(result.code, 0);
  assert.deepEqual(progress, [5, 9]);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].command, "/data/bin/whisper-cli");

  const failing = RUN.startWhisper({
    command: "whisper-cli",
    args: [],
    spawn: () => fakeChild((proc) => {
      proc.stderr.emit("data", "error: failed to load model\n");
      proc.emit("close", 2);
    }),
  });
  const failed = await failing.promise;
  assert.equal(failed.ok, false);
  assert.equal(failed.code, 2);
  assert.match(failed.stderr, /failed to load model/);

  let killed = 0;
  const hanging = RUN.startWhisper({
    command: "whisper-cli",
    args: [],
    spawn: () => {
      const proc = fakeChild(() => {});
      const kill = proc.kill;
      proc.kill = () => {
        killed += 1;
        kill();
      };
      return proc;
    },
  });
  hanging.cancel();
  const cancelled = await hanging.promise;
  assert.equal(cancelled.cancelled, true);
  assert.equal(cancelled.ok, false);
  assert.equal(killed, 1);

  const broken = RUN.startWhisper({
    command: "whisper-cli",
    args: [],
    spawn: () => {
      throw new Error("spawn failed");
    },
  });
  const thrown = await broken.promise;
  assert.equal(thrown.ok, false);
  assert.match(thrown.error, /spawn failed/);
});

test("whisper decoder: a decoded buffer becomes 16 kHz mono samples", async () => {
  class FakeContext {
    decodeAudioData() {
      return Promise.resolve({
        numberOfChannels: 2,
        sampleRate: 44100,
        duration: 2,
        getChannelData: (index) => new Float32Array(88200).fill(index === 0 ? 0.5 : -0.5),
      });
    }
    close() {
      this.closed = true;
    }
  }
  const decoded = await RUN.decodeRecording(new Uint8Array([1, 2, 3]), { audioContext: FakeContext });
  assert.equal(decoded.ok, true);
  assert.equal(decoded.sampleRate, 16000);
  assert.ok(Math.abs(decoded.seconds - 2) < 0.01);
  assert.ok(decoded.samples.length >= 31900 && decoded.samples.length <= 32100);
  assert.ok(Math.abs(decoded.samples[0]) < 0.001, "the two channels cancel to near silence");

  const empty = await RUN.decodeRecording(new Uint8Array(0), { audioContext: FakeContext });
  assert.equal(empty.ok, false);
  const noDecoder = await RUN.decodeRecording(new Uint8Array([1]), { audioContext: null });
  assert.equal(noDecoder.ok, false);
  assert.match(noDecoder.message, /cannot decode/);
});

test("transcript note: frontmatter, timestamped body, plain body and safe paths", () => {
  assert.equal(NOTE.isAudioPath("Recordings/Voice.webm"), true);
  assert.equal(NOTE.isAudioPath("Notes/Question.md"), false);
  assert.equal(NOTE.isAudioPath("noextension"), false);
  assert.equal(NOTE.transcriptNotePath("Recordings/Transcripts", "Recordings/Voice 2026-11-03.webm"), "Recordings/Transcripts/Voice 2026-11-03.md");
  assert.equal(NOTE.transcriptNotePath("../bad", "Recordings/Voice.webm"), "");
  assert.equal(NOTE.transcriptTitle("Recordings/Voice.m4a"), "Voice");

  const built = NOTE.buildTranscriptNote({
    audioPath: "Recordings/Voice 2026-11-03.webm",
    folder: "Recordings/Transcripts",
    model: "base.en-q5_1",
    language: "en",
    seconds: 125,
    date: new Date(2026, 10, 23),
    course: "Biology 101",
    segments: [
      { start: 0, text: "Welcome to the lecture." },
      { start: 12, text: "Today: osmosis." },
    ],
  });
  assert.equal(built.path, "Recordings/Transcripts/Voice 2026-11-03.md");
  assert.match(built.text, /^---\ntype: transcript\n/);
  assert.match(built.text, /audio: Recordings\/Voice 2026-11-03\.webm/);
  assert.match(built.text, /duration: "02:05"/);
  assert.match(built.text, /transcribed_by: whisper\.cpp/);
  assert.match(built.text, /model: base\.en-q5_1/);
  assert.match(built.text, /transcribed_on: 2026-11-23/);
  assert.match(built.text, /course: Biology 101/);
  assert.match(built.text, /\n## Transcript\n\n\*\*\[00:00\]\*\* Welcome to the lecture\./);
  assert.match(built.text, /\*\*\[00:12\]\*\* Today: osmosis\./);
  assert.ok(built.text.endsWith("\n"));

  const plain = NOTE.buildTranscriptNote({
    audioPath: "Recordings/Voice.webm",
    folder: "Recordings/Transcripts",
    segments: [{ start: 4, text: "One." }, { start: 9, text: "Two." }],
    timestamps: false,
    seconds: 10,
  });
  assert.ok(!plain.text.includes("**[00:04]**"));
  assert.match(plain.text, /One\.\n\nTwo\./);
  assert.equal(NOTE.buildTranscriptNote({ audioPath: "Recordings/a.mp3", folder: "../bad", segments: [{ start: 0, text: "x" }] }), null);
  assert.equal(NOTE.buildTranscriptNote({ audioPath: "Recordings/a.mp3", folder: "T", segments: [] }), null);
  assert.equal(NOTE.courseFromPath("Courses/Biology 101/Lecture 4.webm", ["Biology 101"]), "Biology 101");
  assert.equal(NOTE.courseFromPath("Recordings/a.webm", ["Biology 101"]), "");
});

test("installer: hashes, plugin data paths and removal that leaves recordings", () => {
  const bytes = new Uint8Array([1, 2, 3, 4]);
  const expected = crypto.createHash("sha256").update(Buffer.from(bytes)).digest("hex");
  assert.equal(INSTALL.sha256(bytes), expected);
  assert.equal(INSTALL.verifySha256(bytes, expected), true);
  assert.equal(INSTALL.verifySha256(bytes, expected.toUpperCase()), true);
  assert.equal(INSTALL.verifySha256(bytes, "0".repeat(64)), false);
  assert.equal(INSTALL.verifySha256(bytes, "not a hash"), false);

  const root = tempDir();
  const plugin = fakePlugin(root);
  const installRoot = INSTALL.installRoot(plugin);
  assert.equal(installRoot, path.join(root, ".obsidian", "plugins", "mcq-tracker", "whisper"));
  assert.equal(INSTALL.modelPath(plugin, "base.en-q5_1"), path.join(installRoot, "models", "ggml-base.en-q5_1.bin"));
  assert.throws(() => INSTALL.modelPath(plugin, "../evil"), /Unknown transcription model/);
  assert.match(INSTALL.describe(plugin, R.normalizeAudioTranscriptionSettings({})), /Nothing is installed yet/);

  fs.mkdirSync(path.join(installRoot, "models"), { recursive: true });
  fs.writeFileSync(path.join(installRoot, "models", "ggml-base.en-q5_1.bin"), "model");
  fs.writeFileSync(path.join(root, "Recording.webm"), "audio");
  assert.equal(INSTALL.installedModelPath(plugin, "base.en-q5_1"), path.join(installRoot, "models", "ggml-base.en-q5_1.bin"));
  const removed = INSTALL.removeAll(plugin);
  assert.deepEqual(removed.removed, ["models"]);
  assert.equal(fs.existsSync(path.join(installRoot, "models")), false);
  assert.equal(fs.existsSync(path.join(root, "Recording.webm")), true, "the recording is untouched");
  fs.rmSync(root, { recursive: true, force: true });
});

test("recording picker: only audio files, in a stable order", () => {
  const files = [
    { path: "Recordings/b.webm", extension: "webm" },
    { path: "Notes/question.md", extension: "md" },
    { path: "Recordings/a.m4a", extension: "m4a" },
    null,
  ];
  assert.deepEqual(PICKER.audioFiles(files).map((file) => file.path), ["Recordings/a.m4a", "Recordings/b.webm"]);
  assert.deepEqual(PICKER.audioFiles(null), []);
});

test("the plugin registers the transcription settings and commands", async () => {
  const app = makeApp([]);
  app.vault.adapter = { basePath: tempDir() };
  const plugin = new QT(app);
  await plugin.onload();

  assert.equal(plugin.transcriptionEnabled(), false, "the module is off by default");
  assert.match(plugin.transcriptionRefusal(), /off/);

  const updated = await plugin.updateAudioTranscription({ enabled: true, model: "not-a-model", language: "DE" });
  assert.equal(updated.enabled, true);
  assert.equal(updated.model, "base.en-q5_1");
  assert.equal(updated.language, "de");
  assert.equal(plugin.transcriptionEnabled(), true);
  assert.equal(plugin.transcriptionRefusal(), "");

  const state = plugin.transcriptionState();
  assert.equal(state.ready, false);
  assert.match(state.message, /isn't installed yet/);

  const ids = plugin.commands.map((command) => command.id);
  for (const id of ["audio-setup-transcription", "audio-transcribe-recording", "audio-remove-transcription"]) {
    assert.ok(ids.includes(id), `${id} is registered`);
  }
  const setup = plugin.commands.find((command) => command.id === "audio-setup-transcription");
  assert.match(String(setup.callback), /this\.setupLocalTranscription\(/);
  const remove = plugin.commands.find((command) => command.id === "audio-remove-transcription");
  assert.match(String(remove.callback), /this\.removeLocalTranscriptionFiles\(/);
  const pick = plugin.commands.find((command) => command.id === "audio-transcribe-recording");
  assert.match(String(pick.callback), /this\.pickRecordingToTranscribe\(/);
  assert.equal(plugin.cancelTranscription(), false);

  fs.rmSync(app.vault.adapter.basePath, { recursive: true, force: true });
});
