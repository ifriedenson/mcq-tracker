"use strict";
/*
 * Defense in depth for the two places that assign an internally generated SVG
 * string to innerHTML. The SMILES renderer only emits a known element set, but
 * keeping the sink itself free of scripts, event handlers and external links
 * means a future renderer change cannot silently create an injection point.
 */

const DANGEROUS = /<\s*(?:script|foreignObject|iframe|object|embed)\b|\bon[a-z]+\s*=|javascript\s*:|data\s*:\s*text\/html/i;

function safeSvg(svg) {
  const text = String(svg || "");
  return DANGEROUS.test(text) ? "" : text;
}

module.exports = { safeSvg };
