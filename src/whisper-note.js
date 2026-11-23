"use strict";
/*
 * The transcript note: where it goes and exactly what it says.
 *
 * A transcript is an ordinary, editable Markdown note under the transcript
 * folder, never the recording's own file, and it is never overwritten: a
 * second run for the same recording is refused with the path it would have
 * replaced. The body opens with `## Transcript` so the note reads on its own,
 * and the frontmatter records which audio, model and language produced it.
 */
const { str } = require("./util");
const { TRANSCRIPT_FOLDER } = require("./whisper-registry");
const { clock } = require("./whisper-run");

const AUDIO_EXTENSIONS = ["webm", "m4a", "mp3", "wav", "ogg", "opus", "aac", "flac"];

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function isAudioPath(path) {
  const name = str(path).trim().toLowerCase();
  if (!name) return false;
  const extension = name.split(".").pop();
  return name.includes(".") && AUDIO_EXTENSIONS.includes(extension);
}

function safeFolder(value) {
  const clean = str(value).trim().replace(/^\/+|\/+$/g, "");
  if (!clean) return "";
  if (clean.split("/").some((part) => part === ".." || !part)) return "";
  return clean;
}

/** `Recordings/Voice 2026-11-03.webm` → `Voice 2026-11-03`. */
function transcriptTitle(audioPath) {
  const name = str(audioPath).trim().split("/").pop();
  return name.replace(/\.[a-z0-9]+$/i, "");
}

function transcriptNotePath(folder, audioPath) {
  const dir = safeFolder(folder || TRANSCRIPT_FOLDER);
  const title = transcriptTitle(audioPath);
  if (!dir || !title) return "";
  return `${dir}/${title}.md`;
}

/** A frontmatter scalar: bare when it is plainly safe, otherwise JSON-quoted. */
function yamlScalar(value) {
  const text = str(value).trim();
  if (!text) return '""';
  if (/^[A-Za-z0-9][A-Za-z0-9 _./-]*$/.test(text) && !/^(true|false|null|yes|no|-?\d+(\.\d+)?)$/i.test(text)) return text;
  return JSON.stringify(text);
}

/** The course whose name matches a folder the recording sits in, or "". */
function courseFromPath(audioPath, courseNames) {
  const names = (Array.isArray(courseNames) ? courseNames : []).map((name) => str(name).trim()).filter(Boolean);
  if (!names.length) return "";
  const parts = str(audioPath).split("/").slice(0, -1);
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const part = str(parts[i]).trim();
    if (!part) continue;
    const hit = names.find((name) => name.toLowerCase() === part.toLowerCase());
    if (hit) return hit;
  }
  return "";
}

function dayKey(value) {
  const date = value instanceof Date ? value : new Date(value === undefined ? Date.now() : value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Build `{ path, text }` for one transcript, or null when the folder, the
 * audio path or the segments cannot produce a usable note.
 */
function buildTranscriptNote(input) {
  const source = asObject(input);
  const audioPath = str(source.audioPath).trim();
  const path = transcriptNotePath(source.folder, audioPath);
  if (!path) return null;
  const segments = (Array.isArray(source.segments) ? source.segments : [])
    .map((segment) => ({ start: Math.max(0, Number(segment && segment.start) || 0), text: str(segment && segment.text).replace(/\s+/g, " ").trim() }))
    .filter((segment) => segment.text);
  if (!segments.length) return null;
  const timestamps = source.timestamps !== false;
  const language = str(source.language).trim() || "en";
  const model = str(source.model).trim();
  const course = str(source.course).trim();
  const lines = [
    "---",
    "type: transcript",
    `audio: ${yamlScalar(audioPath)}`,
    `duration: ${yamlScalar(clock(source.seconds))}`,
    `language: ${yamlScalar(language)}`,
    "transcribed_by: whisper.cpp",
  ];
  if (model) lines.push(`model: ${yamlScalar(model)}`);
  const day = dayKey(source.date);
  if (day) lines.push(`transcribed_on: ${day}`);
  if (course) lines.push(`course: ${yamlScalar(course)}`);
  lines.push("---", "", "## Transcript", "");
  const body = timestamps
    ? segments.map((segment) => `**[${clock(segment.start)}]** ${segment.text}`)
    : segments.map((segment) => segment.text);
  lines.push(body.join("\n\n"), "");
  return { path, text: lines.join("\n") };
}

module.exports = {
  AUDIO_EXTENSIONS,
  buildTranscriptNote,
  courseFromPath,
  dayKey,
  isAudioPath,
  safeFolder,
  transcriptNotePath,
  transcriptTitle,
  yamlScalar,
};
