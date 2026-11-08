"use strict";
/*
 * Local audio trace for the Reference 3D tab.
 *
 * The pure part turns visible 3D curves and points into a bounded schedule of
 * oscillator events. The player accepts any Web Audio-like context; there is no
 * network request, media file, third-party audio code or autoplay.
 */

const { clamp } = require("./util");

const MAX_EVENTS = 48;
const DEFAULT_OPTIONS = {
  minHz: 180,
  maxHz: 900,
  noteSeconds: 0.16,
  gapSeconds: 0.04,
  volume: 0.11,
  wave: "sine",
  maxEvents: MAX_EVENTS,
};

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeOptions(options) {
  const source = options || {};
  const minHz = clamp(finite(source.minHz, DEFAULT_OPTIONS.minHz), 40, 2000);
  const maxHz = clamp(finite(source.maxHz, DEFAULT_OPTIONS.maxHz), minHz + 1, 4000);
  return {
    minHz,
    maxHz,
    noteSeconds: clamp(finite(source.noteSeconds, DEFAULT_OPTIONS.noteSeconds), 0.04, 0.8),
    gapSeconds: clamp(finite(source.gapSeconds, DEFAULT_OPTIONS.gapSeconds), 0, 0.4),
    volume: clamp(finite(source.volume, DEFAULT_OPTIONS.volume), 0.01, 0.5),
    wave: ["sine", "triangle", "square", "sawtooth"].includes(source.wave) ? source.wave : DEFAULT_OPTIONS.wave,
    maxEvents: clamp(Math.round(finite(source.maxEvents, MAX_EVENTS)), 4, MAX_EVENTS),
  };
}

function sampleCandidates(scene) {
  const candidates = [];
  const curves = Array.isArray(scene && scene.curves) ? scene.curves : [];
  for (const entry of curves) {
    const points = entry && Array.isArray(entry.points) ? entry.points : [];
    for (const point of points) {
      if (point && [point.x, point.y, point.z].every(Number.isFinite)) candidates.push(point);
    }
  }
  const points = Array.isArray(scene && scene.points) ? scene.points : [];
  for (const point of points) {
    if (point && [point.x, point.y, point.z].every(Number.isFinite)) candidates.push(point);
  }
  return candidates;
}

/**
 * Build a bounded mono/stereo trace. Height (z) chooses pitch, horizontal
 * position (x) chooses pan, and y adds a small brightness cue through gain.
 */
function buildAudioTrace(scene, options) {
  const opts = normalizeOptions(options);
  const candidates = sampleCandidates(scene);
  if (!candidates.length) return { ok: false, reason: "empty", message: "Add a 3D curve or point before playing an audio trace.", events: [] };
  const stride = Math.max(1, Math.ceil(candidates.length / opts.maxEvents));
  const chosen = candidates.filter((_point, index) => index % stride === 0).slice(0, opts.maxEvents);
  const zs = chosen.map((point) => point.z);
  const xs = chosen.map((point) => point.x);
  const ys = chosen.map((point) => point.y);
  const zMin = Math.min(...zs);
  const zMax = Math.max(...zs);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const span = (min, max) => (max > min ? max - min : 1);
  const step = opts.noteSeconds + opts.gapSeconds;
  const events = chosen.map((point, index) => {
    const height = (point.z - zMin) / span(zMin, zMax);
    const across = ((point.x - xMin) / span(xMin, xMax)) * 2 - 1;
    const depth = (point.y - yMin) / span(yMin, yMax);
    return {
      when: Number((index * step).toFixed(4)),
      frequency: Number((opts.minHz + height * (opts.maxHz - opts.minHz)).toFixed(3)),
      pan: Number(clamp(across, -1, 1).toFixed(3)),
      gain: Number((opts.volume * (0.75 + 0.25 * depth)).toFixed(4)),
      duration: opts.noteSeconds,
      point: { x: point.x, y: point.y, z: point.z },
    };
  });
  return {
    ok: true,
    events,
    duration: Number((events.length * step).toFixed(4)),
    options: opts,
    summary: `Audio trace with ${events.length} note${events.length === 1 ? "" : "s"} over ${(events.length * step).toFixed(1)} seconds.`,
  };
}

/** Schedule a trace with a Web Audio-like context. Returns a stop function. */
function playAudioTrace(context, trace, options) {
  if (!trace || !Array.isArray(trace.events) || !trace.events.length) {
    return { ok: false, reason: "empty", message: "There is no audio trace to play." };
  }
  if (!context || typeof context.createOscillator !== "function" || typeof context.createGain !== "function") {
    return { ok: false, reason: "audio", message: "This device did not provide Web Audio." };
  }
  const opts = normalizeOptions(Object.assign({}, trace.options || {}, options || {}));
  const now = Number.isFinite(context.currentTime) ? context.currentTime : 0;
  const nodes = [];
  const master = typeof context.createGain === "function" ? context.createGain() : null;
  if (master && master.gain && typeof master.gain.setValueAtTime === "function") master.gain.setValueAtTime(1, now);
  if (master && typeof context.destination !== "undefined" && typeof master.connect === "function") master.connect(context.destination);
  for (const event of trace.events) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    if (!oscillator || !gain) continue;
    const start = now + event.when;
    const end = start + event.duration;
    if (oscillator.type !== undefined) oscillator.type = opts.wave;
    if (oscillator.frequency && typeof oscillator.frequency.setValueAtTime === "function") oscillator.frequency.setValueAtTime(event.frequency, start);
    else if (oscillator.frequency && typeof oscillator.frequency.value !== "undefined") oscillator.frequency.value = event.frequency;
    if (gain.gain && typeof gain.gain.setValueAtTime === "function") {
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(event.gain, start + Math.min(0.02, event.duration / 3));
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
    }
    const panner = typeof context.createStereoPanner === "function" ? context.createStereoPanner() : null;
    if (panner && panner.pan && typeof panner.pan.setValueAtTime === "function") panner.pan.setValueAtTime(event.pan, start);
    if (typeof oscillator.connect === "function") {
      if (panner) {
        oscillator.connect(panner);
        if (typeof panner.connect === "function") panner.connect(gain);
      } else oscillator.connect(gain);
    }
    if (typeof gain.connect === "function") gain.connect(master || context.destination);
    if (typeof oscillator.start === "function") oscillator.start(start);
    if (typeof oscillator.stop === "function") oscillator.stop(end + 0.02);
    nodes.push({ oscillator, gain, panner });
  }
  if (!nodes.length) return { ok: false, reason: "audio", message: "The audio trace could not be scheduled." };
  let stopped = false;
  return {
    ok: true,
    events: nodes.length,
    summary: trace.summary,
    stop() {
      if (stopped) return;
      stopped = true;
      const at = Number.isFinite(context.currentTime) ? context.currentTime : 0;
      for (const node of nodes) {
        try { if (node.oscillator && typeof node.oscillator.stop === "function") node.oscillator.stop(at); } catch (e) { /* already stopped */ }
        try { if (node.gain && typeof node.gain.disconnect === "function") node.gain.disconnect(); } catch (e) { /* disconnected */ }
      }
    },
  };
}

module.exports = {
  DEFAULT_OPTIONS,
  MAX_EVENTS,
  buildAudioTrace,
  normalizeOptions,
  playAudioTrace,
};
