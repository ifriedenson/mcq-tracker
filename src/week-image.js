"use strict";
/*
 * Week image export for the Class Timetable set: render the current week at
 * full size in the active theme's light ink and save or copy it, for sharing a
 * timetable without a screenshot. The SVG is pure and deterministic; the plugin
 * rasterizes it to PNG with a canvas and writes the file, which needs the app
 * window and is guarded there.
 */
const { str } = require("./util");

const DAY_WIDTH = 150;
const GUTTER = 64;
const TITLE_HEIGHT = 52;
const HEADER_HEIGHT = 40;
const ALLDAY_HEIGHT = 24;
const PAD = 16;
const FONT_SIZE = 12;

const LAYER_FILL = {
  classes: "#dbe7ff",
  planned: "#d9efdc",
  events: "#e8defc",
  review: "#fbeecd",
  tasks: "#e5e7eb",
};

const LAYER_EDGE = {
  classes: "#2f5fd0",
  planned: "#2e7d32",
  events: "#7a4fc9",
  review: "#b26a00",
  tasks: "#6b7280",
};

function weekImageFileName(startKey) {
  const key = /^\d{4}-\d{2}-\d{2}$/.test(str(startKey).trim()) ? str(startKey).trim() : "";
  return key ? `week-timetable-${key}.png` : "week-timetable.png";
}

function escapeSvg(text) {
  return str(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function ellipsize(text, maxChars) {
  const clean = str(text).replace(/\s+/g, " ").trim();
  const limit = Math.max(4, Math.round(Number(maxChars) || 20));
  return clean.length > limit ? `${clean.slice(0, limit - 1)}…` : clean;
}

function textWidth(chars) {
  return Math.max(0, Math.round(Number(chars) || 0)) * (FONT_SIZE * 0.55);
}

/**
 * An SVG of the week grid: title, day headers, hour lines, one rect per timed
 * block with a lane offset, small all-day chips, and the now-line. Returns
 * { svg, width, height, blocks } so tests can count what was drawn.
 */
function buildWeekSvg(layout, options) {
  const view = layout && typeof layout === "object" ? layout : {};
  const opts = options && typeof options === "object" ? options : {};
  const days = Array.isArray(view.days) ? view.days : [];
  const hours = Array.isArray(view.hours) ? view.hours : [];
  const hourHeight = Number(view.hourHeight) > 0 ? Number(view.hourHeight) : 44;
  const dayCount = Math.max(1, days.length);
  const width = Math.round(GUTTER + dayCount * DAY_WIDTH + PAD * 2);
  const hasAllDay = days.some((day) => day && Array.isArray(day.allDay) && day.allDay.length);
  const alldayHeight = hasAllDay ? ALLDAY_HEIGHT : 0;
  const gridTop = TITLE_HEIGHT + HEADER_HEIGHT + alldayHeight;
  const gridHeight = Math.max(1, hours.length * hourHeight);
  const height = Math.round(gridTop + gridHeight + PAD);
  const hourLabel = typeof opts.hourLabel === "function" ? opts.hourLabel : (hour) => `${String(hour).padStart(2, "0")}:00`;

  const parts = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="system-ui, sans-serif" font-size="${FONT_SIZE}">`
  );
  parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`);
  parts.push(`<text x="${PAD}" y="32" font-size="18" font-weight="700" fill="#111111">${escapeSvg(`Week of ${str(view.label) || ""}`)}</text>`);

  for (let index = 0; index < days.length; index++) {
    const day = days[index] || {};
    const x = PAD + GUTTER + index * DAY_WIDTH;
    const head = `${str(day.weekday)} ${day.dayOfMonth || ""}`.trim();
    parts.push(`<text x="${x + 4}" y="${TITLE_HEIGHT + 24}" font-weight="700" fill="#111111">${escapeSvg(ellipsize(head, 18))}</text>`);
    parts.push(`<line x1="${x}" y1="${TITLE_HEIGHT}" x2="${x}" y2="${height - PAD}" stroke="#d7dbe0" stroke-width="1"/>`);
    if (day.isToday) {
      parts.push(`<rect x="${x}" y="${TITLE_HEIGHT}" width="${DAY_WIDTH}" height="${height - TITLE_HEIGHT - PAD}" fill="#2f5fd0" fill-opacity="0.06"/>`);
    }
  }

  for (const hour of hours) {
    const y = gridTop + (hour - (Number(view.dayStart) || 0)) * hourHeight;
    parts.push(`<text x="${PAD}" y="${Math.round(y + 4)}" fill="#6b7280">${escapeSvg(hourLabel(hour))}</text>`);
    parts.push(`<line x1="${PAD + GUTTER}" y1="${Math.round(y)}" x2="${width - PAD}" y2="${Math.round(y)}" stroke="#e5e7eb" stroke-width="1"/>`);
  }

  let blocks = 0;
  for (let index = 0; index < days.length; index++) {
    const day = days[index] || {};
    const x = PAD + GUTTER + index * DAY_WIDTH;
    const allDay = Array.isArray(day.allDay) ? day.allDay.slice(0, 2) : [];
    allDay.forEach((row, rowIndex) => {
      const label = str(row && row.title);
      if (!label) return;
      parts.push(
        `<text x="${x + 4}" y="${TITLE_HEIGHT + HEADER_HEIGHT - 8 + rowIndex * 0}" fill="#374151">${escapeSvg(ellipsize(label, 22))}</text>`
      );
    });
    if (Array.isArray(day.allDay) && day.allDay.length > 2) {
      parts.push(`<text x="${x + 4}" y="${TITLE_HEIGHT + HEADER_HEIGHT - 8}" fill="#6b7280">${escapeSvg(`+${day.allDay.length - 2}`)}</text>`);
    }
    for (const block of Array.isArray(day.blocks) ? day.blocks : []) {
      const laneWidth = (Number(block.width) || 100) / 100;
      const laneLeft = (Number(block.left) || 0) / 100;
      const bx = x + 2 + laneLeft * (DAY_WIDTH - 4);
      const bw = Math.max(8, laneWidth * (DAY_WIDTH - 4) - 2);
      const by = gridTop + (Number(block.top) || 0);
      const bh = Math.max(10, Number(block.height) || 0);
      const layer = str(block.layer);
      const fill = LAYER_FILL[layer] || LAYER_FILL.tasks;
      const edge = LAYER_EDGE[layer] || LAYER_EDGE.tasks;
      const maxChars = Math.max(4, Math.floor(bw / (FONT_SIZE * 0.55)) - 1);
      parts.push(`<rect x="${Math.round(bx)}" y="${Math.round(by)}" width="${Math.round(bw)}" height="${Math.round(bh)}" rx="3" fill="${fill}" stroke="${edge}" stroke-width="1"/>`);
      parts.push(`<rect x="${Math.round(bx)}" y="${Math.round(by)}" width="3" height="${Math.round(bh)}" fill="${edge}"/>`);
      const title = ellipsize(block.title, maxChars);
      if (title && bh >= 16) {
        parts.push(`<text x="${Math.round(bx + 7)}" y="${Math.round(by + 13)}" fill="#111111">${escapeSvg(title)}</text>`);
      }
      blocks += 1;
    }
  }

  if (view.now && typeof view.now === "object") {
    const now = view.now;
    const dayIndex = Math.round(Number(now.dayIndex) || 0);
    const y = gridTop + (Number(now.top) || 0);
    if (dayIndex >= 0 && dayIndex < days.length) {
      const x = PAD + GUTTER + dayIndex * DAY_WIDTH;
      parts.push(`<line x1="${x}" y1="${Math.round(y)}" x2="${x + DAY_WIDTH}" y2="${Math.round(y)}" stroke="#d33" stroke-width="2"/>`);
      parts.push(`<circle cx="${x}" cy="${Math.round(y)}" r="3" fill="#d33"/>`);
    }
  }

  parts.push("</svg>");
  return { svg: parts.join(""), width, height, blocks };
}

module.exports = {
  ALLDAY_HEIGHT,
  DAY_WIDTH,
  GUTTER,
  HEADER_HEIGHT,
  buildWeekSvg,
  ellipsize,
  escapeSvg,
  textWidth,
  weekImageFileName,
};
