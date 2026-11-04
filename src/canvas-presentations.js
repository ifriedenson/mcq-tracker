"use strict";
/*
 * Presentations for JSON Canvas 1.0 boards.
 *
 * This is the fifth clean-room slice of the Overpowered Canvas idea (MIT,
 * github.com/kfirgumay2005-hash/Overpowered-Canvas). No source was copied and no
 * dependency was added: a deck is plain geometry and adjacency over the model
 * canvas-markdown.js validates, and nothing is written back to the board.
 *
 * Steps are derived one of three documented ways:
 *   1. Group frames, when the board has any: one slide per frame, ordered by left
 *      edge, then top edge, then id. A card is on that slide when the frame
 *      contains its centre, in board order. A card outside every frame is not on
 *      a slide and is reported.
 *   2. Otherwise one slide per root card - a card no edge points at - in board
 *      order, holding the root first and then the cards it links to directly.
 *      A deeper card is not on any slide and is reported.
 *   3. A board with no root at all (one closed loop) gives one slide per card in
 *      board order, so it still presents instead of failing.
 *
 * A slide's title is the frame label or the card's own name, its body is the
 * leading card's text, and its links out are the edges that leave the slide for
 * a card somewhere else in the deck. Named limits cap slides, cards per slide,
 * links per slide and body length, and every truncation is counted rather than
 * hidden.
 */
const canvasMarkdown = require("./canvas-markdown");
const canvasMap = require("./canvas-map");
const canvasAutoLink = require("./canvas-auto-link");

const MAX_SLIDES = 60;
const MAX_SLIDE_CARDS = 24;
const MAX_SLIDE_LINKS = 12;
const MAX_TITLE = 80;
const MAX_LABEL = 80;
const MAX_BODY = 1200;
const FALLBACK_WIDTH = 280;
const FALLBACK_HEIGHT = 90;

function text(value) {
  return typeof value === "string" ? value : "";
}

function squeeze(value) {
  return text(value).replace(/\s+/g, " ").trim();
}

function clip(value, limit) {
  const clean = squeeze(value);
  return clean.length > limit ? clean.slice(0, limit - 1) + "…" : clean;
}

function widthOf(node) {
  return Math.max(1, Math.round(Number(node && node.width) || FALLBACK_WIDTH));
}

function heightOf(node) {
  return Math.max(1, Math.round(Number(node && node.height) || FALLBACK_HEIGHT));
}

function centreOf(node) {
  return { x: Number(node.x) + widthOf(node) / 2, y: Number(node.y) + heightOf(node) / 2 };
}

function contains(frame, point) {
  const width = widthOf(frame);
  const height = heightOf(frame);
  return point.x >= frame.x && point.x <= frame.x + width && point.y >= frame.y && point.y <= frame.y + height;
}

function byLeftEdge(a, b) {
  return a.x - b.x || a.y - b.y || a.id.localeCompare(b.id);
}

/** The name a card is known by: the same rule the auto-link slice documents. */
function nameOf(node) {
  return squeeze(canvasAutoLink.titleOf(node) || text(node && node.file) || text(node && node.url) || (node && node.id));
}

function labelOf(node) {
  return clip(nameOf(node), MAX_LABEL) || "card";
}

/** What a slide says: the leading card's whole text, or what the card points at. */
function bodyOf(node) {
  if (!node) return "";
  // A file or link card carries a target, not prose: its own text is only a label.
  if (node.type === "file") return text(node.file);
  if (node.type === "link") return text(node.url);
  const body = text(node.text).trim();
  if (body) return body.length > MAX_BODY ? body.slice(0, MAX_BODY - 1) + "…" : body;
  return squeeze(node.label);
}

function summarise(derived) {
  const bits = [];
  bits.push(derived.stats.slides + (derived.stats.slides === 1 ? " slide" : " slides")
    + " from " + derived.stats.cards + (derived.stats.cards === 1 ? " card" : " cards")
    + (derived.mode === "frames" ? " in " + derived.stats.groups + (derived.stats.groups === 1 ? " frame" : " frames") : ""));
  if (derived.unplaced.length) bits.push(derived.unplaced.length + (derived.unplaced.length === 1 ? " card is" : " cards are") + " not on a slide");
  if (derived.stats.slidesSkipped) bits.push(derived.stats.slidesSkipped + " beyond the " + MAX_SLIDES + "-slide limit");
  if (derived.stats.cardsDropped) bits.push(derived.stats.cardsDropped + " beyond the " + MAX_SLIDE_CARDS + "-card limit");
  if (derived.stats.linksDropped) bits.push(derived.stats.linksDropped + " beyond the " + MAX_SLIDE_LINKS + "-link limit");
  return bits.join("; ") + ".";
}

function slideFrom(spec) {
  const members = spec.members;
  const ids = new Set(members.map((node) => node.id));
  const shown = members.slice(0, MAX_SLIDE_CARDS);
  const lead = members[0];
  const seen = new Set();
  const links = [];
  for (const edge of spec.edges) {
    if (!ids.has(edge.fromNode) || ids.has(edge.toNode)) continue;
    const target = spec.byId.get(edge.toNode);
    if (!target || seen.has(target.id)) continue;
    seen.add(target.id);
    links.push({ id: target.id, label: labelOf(target) });
  }
  links.sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
  const kept = links.slice(0, MAX_SLIDE_LINKS);
  return {
    number: spec.number,
    id: spec.frame ? spec.frame.id : lead.id,
    kind: spec.kind,
    title: clip(spec.title, MAX_TITLE) || "Slide " + spec.number,
    members: shown.map((node) => ({ id: node.id, label: labelOf(node), type: node.type })),
    more: members.length - shown.length,
    body: bodyOf(lead),
    links: kept,
    linksMore: links.length - kept.length,
  };
}

/** Derive the ordered deck for one validated board. Nothing is written here. */
function deriveSlides(canvas) {
  if (!canvas || !Array.isArray(canvas.nodes) || !canvas.nodes.length) {
    return { ok: false, reason: "empty", message: "That canvas has no cards." };
  }
  const nodes = canvas.nodes.slice();
  const cards = nodes.filter((node) => node.type !== "group");
  const frames = nodes.filter((node) => node.type === "group").sort(byLeftEdge);
  const byId = new Map(cards.map((node) => [node.id, node]));
  const edges = (canvas.edges || []).filter((edge) => edge && edge.fromNode !== edge.toNode && byId.has(edge.fromNode) && byId.has(edge.toNode));
  const slides = [];
  const unplaced = [];
  let mode;
  if (frames.length) {
    mode = "frames";
    for (const frame of frames) {
      const members = cards.filter((card) => contains(frame, centreOf(card))).sort(canvasMap.boardOrder);
      slides.push(slideFrom({
        number: slides.length + 1,
        kind: "frame",
        frame,
        title: squeeze(frame.label),
        members,
        edges,
        byId,
      }));
    }
    for (const card of cards) {
      if (!frames.some((frame) => contains(frame, centreOf(card)))) unplaced.push(card);
    }
  } else {
    const parentOf = new Map();
    for (const edge of edges) if (!parentOf.has(edge.toNode)) parentOf.set(edge.toNode, edge.fromNode);
    const roots = cards.filter((card) => !parentOf.has(card.id)).sort(canvasMap.boardOrder);
    mode = roots.length ? "roots" : "cards";
    const starts = roots.length ? roots : cards.slice().sort(canvasMap.boardOrder);
    const onSlide = new Set();
    for (const start of starts) {
      const children = cards.filter((card) => parentOf.get(card.id) === start.id).sort(canvasMap.boardOrder);
      const members = [start].concat(children);
      for (const node of members) onSlide.add(node.id);
      slides.push(slideFrom({
        number: slides.length + 1,
        kind: roots.length ? "root" : "card",
        title: nameOf(start),
        members,
        edges,
        byId,
      }));
    }
    for (const card of cards) if (!onSlide.has(card.id)) unplaced.push(card);
  }
  const kept = slides.slice(0, MAX_SLIDES);
  const unplacedSorted = unplaced.sort((a, b) => canvasMap.boardOrder(a, b));
  const derived = {
    mode,
    slides: kept,
    unplaced: unplacedSorted,
    stats: {
      cards: cards.length,
      groups: frames.length,
      slides: kept.length,
      slidesSkipped: slides.length - kept.length,
      cardsOnSlides: slides.reduce((sum, slide) => sum + slide.members.length, 0),
      cardsDropped: kept.reduce((sum, slide) => sum + slide.more, 0),
      links: kept.reduce((sum, slide) => sum + slide.links.length, 0),
      linksDropped: kept.reduce((sum, slide) => sum + slide.linksMore, 0),
      unplaced: unplacedSorted.length,
      limits: slides.length > kept.length || kept.some((slide) => slide.more > 0 || slide.linksMore > 0),
    },
  };
  derived.summary = summarise(derived);
  return Object.assign({ ok: true }, derived);
}

/** Derive the deck of a whole board file. The board itself is never modified. */
function presentationPlan(raw) {
  const parsed = canvasMarkdown.parseCanvas(raw);
  if (!parsed.ok) return parsed;
  return deriveSlides(parsed.canvas);
}

/** Readable rows for the plan window: step number, title, members and links. */
function presentationReport(raw) {
  const plan = presentationPlan(raw);
  if (!plan.ok) return plan;
  return {
    ok: true,
    mode: plan.mode,
    slides: plan.slides.map((slide) => ({
      number: slide.number,
      id: slide.id,
      kind: slide.kind,
      title: slide.title,
      members: slide.members.map((member) => member.label),
      more: slide.more,
      body: slide.body,
      links: slide.links.map((link) => link.label),
      linksMore: slide.linksMore,
    })),
    unplaced: plan.unplaced.map((node) => ({ id: node.id, label: labelOf(node) })),
    stats: plan.stats,
    summary: plan.summary,
  };
}

/**
 * One navigation step. The index is clamped to the deck, so the first
 * Previous and the last Next keep the current slide instead of wrapping or
 * failing, and `atStart` / `atEnd` let a caller disable the control.
 */
function moveSlide(plan, index, delta) {
  if (!plan || !Array.isArray(plan.slides) || !plan.slides.length) {
    return { ok: false, reason: "slides", message: "That presentation has no slides." };
  }
  if (!Number.isInteger(delta)) {
    return { ok: false, reason: "direction", message: "A slide step has to be a whole number." };
  }
  const total = plan.slides.length;
  const from = Number.isInteger(index) ? Math.min(Math.max(index, 0), total - 1) : 0;
  const to = Math.min(Math.max(from + delta, 0), total - 1);
  return {
    ok: true,
    index: to,
    previous: from,
    moved: to !== from,
    total,
    atStart: to === 0,
    atEnd: to === total - 1,
    slide: plan.slides[to],
  };
}

module.exports = {
  deriveSlides,
  presentationPlan,
  presentationReport,
  moveSlide,
  MAX_SLIDES,
  MAX_SLIDE_CARDS,
  MAX_SLIDE_LINKS,
  MAX_TITLE,
  MAX_BODY,
};
