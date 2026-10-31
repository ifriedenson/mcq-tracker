"use strict";
/*
 * Read-aloud helpers: turn a note into speakable sentences and keep the
 * speaking plan stable so the view can highlight the current sentence.
 *
 * Adapted from the read-aloud workflows of Aloud TTS, LearnKit and Voice
 * Briefing (all MIT). The implementation is original and dependency-free; it
 * uses the device speech-synthesis voice, so no provider, key or request is
 * involved. See NOTICES.md.
 */
const { str } = require("./util");

const MAX_READ_TEXT = 20000;
const MAX_SENTENCES = 400;
const READ_ALOUD_STYLES = [
  { id: "full", label: "Full note", sentences: 0, rate: 1 },
  { id: "briefing", label: "90-second briefing", sentences: 14, rate: 1.1 },
  { id: "keypoints", label: "Key points", sentences: 6, rate: 1.15 },
];

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function enabledValue(value) {
  if (value === false) return false;
  if (value && typeof value === "object" && value.enabled === false) return false;
  return true;
}

function clampNumber(value, low, high, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(low, Math.min(high, Math.round(n * 100) / 100));
}

function styleById(id) {
  const key = str(id).trim().toLowerCase();
  return READ_ALOUD_STYLES.find((style) => style.id === key) || READ_ALOUD_STYLES[0];
}

function normalizeReadAloudSettings(value) {
  const source = asObject(value);
  return {
    enabled: enabledValue(value),
    style: styleById(source.style).id,
    rate: clampNumber(source.rate, 0.5, 2, 1),
    pitch: clampNumber(source.pitch, 0.5, 1.5, 1),
    voice: str(source.voice).trim().slice(0, 200),
  };
}

/** Remove frontmatter, code, images and markup so the plain text reads well. */
function stripForSpeech(text) {
  let body = str(text).replace(/\r\n?/g, "\n").slice(0, MAX_READ_TEXT);
  body = body.replace(/^---\n[\s\S]*?\n---\n?/, "");
  body = body.replace(/```[\s\S]*?```/g, " ");
  body = body.replace(/`([^`]*)`/g, "$1");
  body = body.replace(/!\[\[[^\]]*\]\]/g, " ");
  body = body.replace(/!\[[^\]]*\]\([^)]*\)/g, " ");
  body = body.replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, "$2");
  body = body.replace(/\[\[([^\]]*)\]\]/g, "$1");
  body = body.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
  body = body.replace(/<[^>]+>/g, " ");
  body = body.replace(/^\s{0,3}#{1,6}\s+/gm, "");
  body = body.replace(/^\s{0,3}>\s?/gm, "");
  body = body.replace(/^\s*[-*+]\s+/gm, "");
  body = body.replace(/^\s*\d+[.)]\s+/gm, "");
  body = body.replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, "$1");
  body = body.replace(/\[[ xX]\]\s*/g, "");
  return body.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

/** Split cleaned text into sentence-sized chunks, keeping abbreviations usable. */
function splitSentences(text) {
  const cleaned = stripForSpeech(text);
  if (!cleaned) return [];
  const sentences = [];
  for (const line of cleaned.split(/\n+/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.match(/[^.!?…]+[.!?…]+["')\]]*|[^.!?…]+$/g) || [trimmed];
    for (const part of parts) {
      const sentence = part.replace(/\s+/g, " ").trim();
      if (sentence.length < 2) continue;
      sentences.push(sentence.slice(0, 500));
      if (sentences.length >= MAX_SENTENCES) return sentences;
    }
  }
  return sentences;
}

/** Words per minute is a rough average for a single narrator voice. */
function estimateSpeechSeconds(text, rate) {
  const words = stripForSpeech(text).split(/\s+/).filter(Boolean).length;
  if (!words) return 0;
  const speed = clampNumber(rate, 0.5, 2, 1);
  return Math.max(1, Math.round((words / (2.6 * speed)) * 1));
}

function durationLabel(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  if (!total) return "0 s";
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  if (!minutes) return `${rest} s`;
  if (!rest) return `${minutes} min`;
  return `${minutes} min ${rest} s`;
}

/**
 * Build the ordered speaking plan for a note. A briefing style keeps the first
 * N sentences (the note's own lead), which is what a spoken summary should be.
 */
function buildReadAloudPlan(text, options) {
  const opts = asObject(options);
  const style = styleById(opts.style);
  const rate = clampNumber(opts.rate, 0.5, 2, 1);
  const all = splitSentences(text);
  const limited = style.sentences > 0 ? all.slice(0, style.sentences) : all;
  const spoken = limited.join(" ");
  return {
    style: style.id,
    label: style.label,
    rate,
    sentences: limited,
    truncated: limited.length < all.length,
    total: all.length,
    text: spoken,
    estimatedSeconds: estimateSpeechSeconds(spoken, rate),
  };
}

module.exports = {
  MAX_READ_TEXT,
  MAX_SENTENCES,
  READ_ALOUD_STYLES,
  buildReadAloudPlan,
  durationLabel,
  estimateSpeechSeconds,
  normalizeReadAloudSettings,
  splitSentences,
  stripForSpeech,
  styleById,
};
