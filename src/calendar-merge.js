"use strict";
/*
 * The merged Plan calendar. One day can hold classes and exams from the .ics
 * feeds, planned study blocks, the plugin's own local events, the review queue
 * and dated study tasks. This module only reads those stores and returns plain
 * rows grouped by day; the calendar view decides how to draw them.
 */
const { str } = require("./util");
const { dateKey } = require("./calendar-ics");
const localEvents = require("./local-events");
const studyWorkspace = require("./study-workspace");
const timeBlocks = require("./time-blocks");

const LAYERS = [
  { id: "classes", label: "Classes", aria: "classes and exams" },
  { id: "planned", label: "Planned", aria: "planned study blocks" },
  { id: "events", label: "Events", aria: "local events" },
  { id: "review", label: "Review", aria: "review due" },
  { id: "tasks", label: "Tasks", aria: "study tasks" },
];

const LAYER_IDS = LAYERS.map((layer) => layer.id);

function normalizeLayers(value) {
  const src = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const out = {};
  for (const id of LAYER_IDS) out[id] = src[id] !== false;
  return out;
}

function enabledLayers(plugin, value) {
  const layers = normalizeLayers(value);
  const off = (name) => !!(plugin && typeof plugin[name] === "function" && !plugin[name]());
  if (off("calendarEnabled")) layers.classes = false;
  if (off("timeBlocksEnabled")) layers.planned = false;
  if (off("localEventsEnabled")) layers.events = false;
  if (off("reviewCalendarEnabled")) layers.review = false;
  if (off("studyTasksEnabled")) layers.tasks = false;
  return layers;
}

function dayKeyOf(value) {
  const text = str(value).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

/** Days from one key to another, inclusive, capped so a wild range cannot loop. */
function keyRange(startKey, endKey) {
  const start = dayKeyOf(startKey);
  const end = dayKeyOf(endKey);
  if (!start || !end || end < start) return [];
  const out = [];
  let cursor = new Date(`${start}T12:00:00`);
  for (let guard = 0; guard < 400; guard++) {
    if (Number.isNaN(cursor.getTime())) break;
    const key = dateKey(cursor);
    out.push(key);
    if (key >= end) break;
    cursor = new Date(cursor.getTime() + 86400000);
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), 12);
  }
  return out;
}

function push(map, key, item) {
  if (!key) return;
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(item);
}

function categoryColor(category) {
  const found = localEvents.LOCAL_EVENT_CATEGORIES.find((entry) => entry.id === category);
  return found ? found.color : "";
}

/**
 * Rows for every enabled layer in a date range. Classes are supplied by the
 * caller because it already filtered them for the visible window.
 */
function collect(plugin, options) {
  const opts = options || {};
  const layers = normalizeLayers(opts.layers);
  const map = new Map();
  const startKey = dayKeyOf(opts.startKey);
  const endKey = dayKeyOf(opts.endKey);
  const days = keyRange(startKey, endKey);

  if (layers.planned && plugin && typeof plugin.timeBlocksSettings === "function") {
    const blocks = plugin.timeBlocksSettings().blocks;
    for (const key of days) {
      for (const block of timeBlocks.blocksForDate(blocks, key)) {
        push(map, key, {
          layer: "planned",
          title: str(block.title),
          time: block.untimed ? "" : `${block.start}–${block.end}`,
          meta: [str(block.course), Number(block.minutes) ? `${Math.round(Number(block.minutes))} min` : ""].filter(Boolean).join(" · "),
          block,
        });
      }
    }
  }

  if (layers.events && plugin && plugin.settings && plugin.settings.localEvents) {
    const store = localEvents.normalizeLocalEventsSettings(plugin.settings.localEvents);
    for (const row of localEvents.eventsInRange(store.events, startKey, endKey)) {
      const event = row.event;
      push(map, row.key, {
        layer: "events",
        title: str(event.title),
        time: str(event.startTime) + (event.endTime ? `–${event.endTime}` : ""),
        meta: str(event.category) && event.category !== "other" ? str(event.category) : "",
        color: categoryColor(event.category),
        event,
      });
    }
  }

  if (layers.review && plugin && typeof plugin.reviewCalendarSnapshot === "function") {
    try {
      const snapshot = plugin.reviewCalendarSnapshot({ days: Math.max(45, days.length + 1) });
      for (const bucket of snapshot.days || []) {
        if (!bucket || !bucket.total) continue;
        if (startKey && (bucket.date < startKey || bucket.date > endKey)) continue;
        push(map, bucket.date, {
          layer: "review",
          title: `${bucket.total} due`,
          time: "",
          meta: [
            bucket.notes.length ? `${bucket.notes.length} note${bucket.notes.length === 1 ? "" : "s"}` : "",
            bucket.cards.length ? `${bucket.cards.length} card${bucket.cards.length === 1 ? "" : "s"}` : "",
            bucket.minutes ? `${Math.round(bucket.minutes)} min` : "",
          ].filter(Boolean).join(" · "),
          count: bucket.total,
        });
      }
    } catch (error) {
      // A review store that cannot be read must not take the calendar down.
    }
  }

  if (layers.tasks && plugin && plugin.settings) {
    const store = studyWorkspace.normalizeStudyTasks(plugin.settings.studyTasks);
    for (const task of store.tasks) {
      const key = dayKeyOf(task.due);
      if (!key || task.done) continue;
      if (startKey && (key < startKey || key > endKey)) continue;
      push(map, key, {
        layer: "tasks",
        title: str(task.title),
        time: str(task.time),
        meta: [str(task.course), task.priority === "high" ? "high" : ""].filter(Boolean).join(" · "),
        task,
      });
    }
  }

  const byDay = new Map();
  const counts = {};
  for (const id of LAYER_IDS) counts[id] = 0;
  for (const [key, rows] of map.entries()) {
    const order = { classes: 0, planned: 1, events: 2, review: 3, tasks: 4 };
    rows.sort((a, b) => (order[a.layer] || 0) - (order[b.layer] || 0) || str(a.time).localeCompare(str(b.time)) || a.title.localeCompare(b.title));
    byDay.set(key, rows);
    for (const row of rows) counts[row.layer] = (counts[row.layer] || 0) + 1;
  }
  const extras = (key) => (byDay.get(key) || []).filter((row) => row.layer !== "classes" && row.layer !== "planned");
  return { byDay, counts, extras, layers };
}

function countsForDay(merged, key) {
  const rows = (merged && merged.byDay && merged.byDay.get(key)) || [];
  const out = { classes: 0, planned: 0, events: 0, review: 0, tasks: 0 };
  for (const row of rows) out[row.layer] = (out[row.layer] || 0) + 1;
  return out;
}

module.exports = {
  LAYERS,
  LAYER_IDS,
  collect,
  countsForDay,
  enabledLayers,
  keyRange,
  normalizeLayers,
};
