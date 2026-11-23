"use strict";
/*
 * The pinned whisper.cpp release and the model files this plugin may fetch.
 *
 * Nothing here downloads on its own. The installer shows this registry's tag,
 * asset name, sizes and SHA-256 values, asks the owner, and refuses any byte
 * that does not match. Because every URL and every model name comes from this
 * table, no value typed by a user can become a download address or a
 * command-line flag.
 *
 * The hashes were read from the published files: the Windows asset is the
 * `whisper-bin-x64.zip` release attachment of v1.8.6, and each model is the
 * Large File Storage object id Hugging Face publishes for it.
 */
const { str } = require("./util");

const REPO = "ggml-org/whisper.cpp";
const TAG = "v1.8.6";
const DEFAULT_MODEL = "base.en-q5_1";
const TRANSCRIPT_FOLDER = "Recordings/Transcripts";
const DESKTOP_ONLY_MESSAGE = "Local transcription needs the desktop app (it isn't available on mobile yet).";

/*
 * Official binaries are published for Windows x64 only. macOS and Linux are
 * served by the bring-your-own program path instead of an unverified build.
 */
const BINARY_ASSETS = {
  "win32-x64": {
    asset: "whisper-bin-x64.zip",
    bytes: 4093849,
    sha256: "b07ea0b1b4115a38e1a7b07debf581f0b77d999925f8acb8f39d322b0ba0a822",
  },
};

/* `language` is "en" for the English-only files and "any" for multilingual ones. */
const MODELS = [
  {
    name: "base.en-q5_1",
    file: "ggml-base.en-q5_1.bin",
    language: "en",
    bytes: 59721011,
    sha256: "4baf70dd0d7c4247ba2b81fafd9c01005ac77c2f9ef064e00dcf195d0e2fdd2f",
    label: "base.en-q5_1 · English · 57 MiB (recommended)",
  },
  {
    name: "tiny.en-q5_1",
    file: "ggml-tiny.en-q5_1.bin",
    language: "en",
    bytes: 32166155,
    sha256: "c77c5766f1cef09b6b7d47f21b546cbddd4157886b3b5d6d4f709e91e66c7c2b",
    label: "tiny.en-q5_1 · English · 31 MiB (low disk)",
  },
  {
    name: "base.en-q8_0",
    file: "ggml-base.en-q8_0.bin",
    language: "en",
    bytes: 81781811,
    sha256: "a4d4a0768075e13cfd7e19df3ae2dbc4a68d37d36a7dad45e8410c9a34f8c87e",
    label: "base.en-q8_0 · English · 78 MiB",
  },
  {
    name: "base.en",
    file: "ggml-base.en.bin",
    language: "en",
    bytes: 147964211,
    sha256: "a03779c86df3323075f5e796cb2ce5029f00ec8869eee3fdfb897afe36c6d002",
    label: "base.en · English · 141 MiB",
  },
  {
    name: "small.en-q5_1",
    file: "ggml-small.en-q5_1.bin",
    language: "en",
    bytes: 190098681,
    sha256: "bfdff4894dcb76bbf647d56263ea2a96645423f1669176f4844a1bf8e478ad30",
    label: "small.en-q5_1 · English · 181 MiB (accents)",
  },
  {
    name: "small.en",
    file: "ggml-small.en.bin",
    language: "en",
    bytes: 487614201,
    sha256: "c6138d6d58ecc8322097e0f987c32f1be8bb0a18532a3f88f734d1bbf9c41e5d",
    label: "small.en · English · 465 MiB",
  },
  {
    name: "tiny-q5_1",
    file: "ggml-tiny-q5_1.bin",
    language: "any",
    bytes: 32152673,
    sha256: "818710568da3ca15689e31a743197b520007872ff9576237bda97bd1b469c3d7",
    label: "tiny-q5_1 · multilingual · 31 MiB",
  },
  {
    name: "base-q5_1",
    file: "ggml-base-q5_1.bin",
    language: "any",
    bytes: 59707625,
    sha256: "422f1ae452ade6f30a004d7e5c6a43195e4433bc370bf23fac9cc591f01a8898",
    label: "base-q5_1 · multilingual · 57 MiB",
  },
  {
    name: "small-q5_1",
    file: "ggml-small-q5_1.bin",
    language: "any",
    bytes: 190085487,
    sha256: "ae85e4a935d7a567bd102fe55afc16bb595bdb618e11b2fc7591bc08120411bb",
    label: "small-q5_1 · multilingual · 181 MiB",
  },
  {
    name: "small",
    file: "ggml-small.bin",
    language: "any",
    bytes: 487601967,
    sha256: "1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b",
    label: "small · multilingual · 465 MiB",
  },
];

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function safeFolder(value) {
  const clean = str(value).trim().replace(/^\/+|\/+$/g, "");
  if (!clean) return "";
  if (clean.split("/").some((part) => part === ".." || !part)) return "";
  return clean;
}

function platformKey(platform, arch) {
  const os = str(platform).trim().toLowerCase();
  const cpu = str(arch).trim().toLowerCase();
  if (!os || !cpu) return "";
  return `${os}-${cpu}`;
}

/** The pinned binary for a platform, or null when no official build exists. */
function binaryAsset(platform, arch) {
  const key = platformKey(platform, arch);
  return key && BINARY_ASSETS[key] ? BINARY_ASSETS[key] : null;
}

function binaryAssetUrl(entry) {
  if (!entry || !entry.asset) return "";
  return `https://github.com/${REPO}/releases/download/${TAG}/${entry.asset}`;
}

/** The exact registry row for a name, or null. Never builds a name from input. */
function model(name) {
  const key = str(name).trim();
  return MODELS.find((entry) => entry.name === key) || null;
}

function modelNames() {
  return MODELS.map((entry) => entry.name);
}

function modelOptions() {
  return MODELS.map((entry) => ({ id: entry.name, label: entry.label }));
}

function modelUrl(entry) {
  if (!entry || !entry.file) return "";
  return `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${entry.file}`;
}

/** `base.en-q5_1` → `base-q5_1`; a multilingual model is already its own name. */
function multilingualName(name) {
  const key = str(name).trim();
  return key.includes(".en") ? key.replace(".en", "") : key;
}

/** A two-letter language code, or `auto` for whisper's own detection. */
function normalizeLanguage(value) {
  const text = str(value).trim().toLowerCase();
  if (text === "auto") return "auto";
  return /^[a-z]{2,3}$/.test(text) ? text : "en";
}

/**
 * The model a run should use: an English-only file cannot serve another
 * language, so it is swapped for the multilingual file of the same size.
 */
function modelForLanguage(name, language) {
  const picked = model(name) || model(DEFAULT_MODEL);
  if (normalizeLanguage(language) === "en") return picked;
  return model(multilingualName(picked.name)) || picked;
}

function normalizeAudioTranscriptionSettings(value) {
  const source = asObject(value);
  const picked = model(source.model);
  return {
    enabled: source.enabled === true,
    binaryPath: str(source.binaryPath).trim(),
    model: picked ? picked.name : DEFAULT_MODEL,
    language: normalizeLanguage(source.language),
    timestamps: source.timestamps !== false,
    folder: safeFolder(source.folder) || TRANSCRIPT_FOLDER,
  };
}

function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return "";
  const mib = value / (1024 * 1024);
  return `${mib >= 100 || Number.isInteger(mib) ? Math.round(mib) : Math.round(mib * 10) / 10} MiB`;
}

function isSha256(value) {
  return /^[0-9a-f]{64}$/.test(str(value).trim().toLowerCase());
}

function unsupportedBinaryMessage(platform, arch) {
  return `No official whisper.cpp build is published for ${str(platform) || "this system"}/${str(arch) || "unknown"}. Install whisper.cpp yourself (for example "brew install whisper-cpp" on macOS, or build it from source), then set the program path under Settings > Read aloud > Local transcription program.`;
}

module.exports = {
  BINARY_ASSETS,
  DEFAULT_MODEL,
  DESKTOP_ONLY_MESSAGE,
  MODELS,
  REPO,
  TAG,
  TRANSCRIPT_FOLDER,
  binaryAsset,
  binaryAssetUrl,
  formatBytes,
  isSha256,
  model,
  modelForLanguage,
  modelNames,
  modelOptions,
  modelUrl,
  multilingualName,
  normalizeAudioTranscriptionSettings,
  normalizeLanguage,
  platformKey,
  unsupportedBinaryMessage,
};
