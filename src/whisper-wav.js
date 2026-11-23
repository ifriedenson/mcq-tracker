"use strict";
/*
 * The one audio format whisper.cpp reads: 16 kHz, one channel, 16-bit PCM WAV.
 *
 * The recorder can produce webm, m4a, ogg, mp3 or wav, so a transcription
 * decodes the recording with the renderer's own decoder and then comes here:
 * downmix to one channel, resample to 16 kHz, and write a canonical RIFF file.
 * Every function is pure, so the header, clipping, silence and odd-length
 * cases are tested without a microphone or a sound card.
 */
const SAMPLE_RATE = 16000;
const HEADER_BYTES = 44;
const MAX_SECONDS = 3 * 60 * 60;

function clampSample(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return number > 1 ? 1 : number < -1 ? -1 : number;
}

/** -1 .. 1 becomes -32768 .. 32767; NaN and infinities are silence. */
function toPcm16(value) {
  const sample = clampSample(value);
  return Math.round(sample < 0 ? sample * 32768 : sample * 32767);
}

function writeAscii(view, offset, text) {
  for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
}

/** One channel of Float32 samples at `sampleRate` as a 16-bit PCM WAV file. */
function encodeWavPcm16(samples, sampleRate) {
  const input = samples && typeof samples.length === "number" ? samples : [];
  const rate = Math.max(8000, Math.min(192000, Math.round(Number(sampleRate) || SAMPLE_RATE)));
  const bytes = new Uint8Array(HEADER_BYTES + input.length * 2);
  const view = new DataView(bytes.buffer);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + input.length * 2, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, input.length * 2, true);
  const out = view;
  for (let i = 0; i < input.length; i += 1) out.setInt16(HEADER_BYTES + i * 2, toPcm16(input[i]), true);
  return bytes;
}

/** Reads a canonical PCM WAV header; null when the bytes are not one. */
function readWavHeader(bytes) {
  if (!bytes || typeof bytes.byteLength !== "number" || bytes.byteLength < HEADER_BYTES) return null;
  const view = new DataView(bytes.buffer ? bytes.buffer : bytes, bytes.byteOffset || 0, bytes.byteLength);
  const ascii = (offset, length) => {
    let text = "";
    for (let i = 0; i < length; i += 1) text += String.fromCharCode(view.getUint8(offset + i));
    return text;
  };
  if (ascii(0, 4) !== "RIFF" || ascii(8, 4) !== "WAVE") return null;
  let offset = 12;
  let format = null;
  let dataBytes = 0;
  let dataOffset = 0;
  while (offset + 8 <= view.byteLength) {
    const id = ascii(offset, 4);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === "fmt " && body + 16 <= view.byteLength) {
      format = {
        audioFormat: view.getUint16(body, true),
        channels: view.getUint16(body + 2, true),
        sampleRate: view.getUint32(body + 4, true),
        bitsPerSample: view.getUint16(body + 14, true),
      };
    }
    if (id === "data") {
      dataOffset = body;
      dataBytes = Math.min(size, Math.max(0, view.byteLength - body));
      break;
    }
    offset = body + size + (size % 2);
  }
  if (!format || !format.channels || !format.sampleRate || format.bitsPerSample !== 16) return null;
  const blockAlign = format.channels * 2;
  return {
    ...format,
    dataOffset,
    dataBytes,
    frames: blockAlign ? Math.floor(dataBytes / blockAlign) : 0,
    seconds: format.sampleRate ? dataBytes / blockAlign / format.sampleRate : 0,
  };
}

/** Every channel mixed down to one, without boosting past either source. */
function downmix(channels) {
  const list = (Array.isArray(channels) ? channels : []).filter((entry) => entry && typeof entry.length === "number");
  if (!list.length) return new Float32Array(0);
  if (list.length === 1) return Float32Array.from(list[0]);
  const length = Math.min(...list.map((entry) => entry.length));
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    let sum = 0;
    for (const channel of list) sum += Number(channel[i]) || 0;
    out[i] = sum / list.length;
  }
  return out;
}

/** Linear interpolation to the target rate; the same rate returns a copy. */
function resampleLinear(samples, fromRate, toRate) {
  const input = samples && typeof samples.length === "number" ? samples : [];
  const from = Number(fromRate) > 0 ? Number(fromRate) : SAMPLE_RATE;
  const to = Number(toRate) > 0 ? Number(toRate) : SAMPLE_RATE;
  if (!input.length) return new Float32Array(0);
  if (from === to) return Float32Array.from(input);
  const length = Math.max(1, Math.round((input.length * to) / from));
  const out = new Float32Array(length);
  const step = from / to;
  for (let i = 0; i < length; i += 1) {
    const position = i * step;
    const left = Math.floor(position);
    const right = Math.min(input.length - 1, left + 1);
    const fraction = position - left;
    out[i] = (Number(input[left]) || 0) * (1 - fraction) + (Number(input[right]) || 0) * fraction;
  }
  return out;
}

function durationOf(samples, sampleRate) {
  const rate = Number(sampleRate) > 0 ? Number(sampleRate) : SAMPLE_RATE;
  return (samples && samples.length ? samples.length : 0) / rate;
}

module.exports = {
  HEADER_BYTES,
  MAX_SECONDS,
  SAMPLE_RATE,
  clampSample,
  downmix,
  durationOf,
  encodeWavPcm16,
  readWavHeader,
  resampleLinear,
  toPcm16,
};
