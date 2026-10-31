"use strict";
/*
 * iCalendar (.ics) parsing, recurrence expansion and export for the calendar module.
 *
 * Ported and modified from University Schedule and Calendar
 * (https://github.com/Cesemess/obsidian-uni-calendar, MIT, Copyright (c) 2026 Cesemess),
 * baseline commit 35778e473a1d7ad7827c83c065b0f61dcbefdbc5 (v1.2.0). Changes from the
 * original: every recurrence loop is bounded, COUNT/UNTIL/INTERVAL/EXDATE/RECURRENCE-ID
 * share one occurrence iterator, DURATION/RDATE are supported, and expansion stays in
 * local wall-clock time so a daylight-saving change does not move class times. See
 * NOTICES.md for the license notice.
 */

const MS_DAY = 24 * 60 * 60 * 1000;
const MAX_INSTANCES = 5000; // hard bound: a broken rule can never hang Obsidian

const pad2 = (n) => String(n).padStart(2, "0");

/** Local calendar day key, YYYY-MM-DD. */
function dateKey(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Parses YYYY-MM-DD into a local midnight Date (null when malformed). */
function parseDateKey(key) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || "").trim());
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** A date with no time of day, used to match all-day EXDATE/RECURRENCE-ID values. */
const isMidnight = (d) => d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0;

/** iCalendar dates are either YYYYMMDD (all day) or YYYYMMDDTHHMMSS[Z]. */
function parseIcsDate(value, params) {
  const clean = String(value || "").trim();
  const paramsMap = params || {};
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?(Z)?$/.exec(clean);
  if (!m) return null;
  const allDay = String(paramsMap.VALUE || "").toUpperCase() === "DATE" || m[4] === undefined;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  const hours = Number(m[4] || 0);
  const minutes = Number(m[5] || 0);
  const seconds = Number(m[6] || 0);
  // A trailing Z is a UTC instant; everything else is wall-clock time. TZID values are
  // treated as wall-clock too: Obsidian has no IANA database, and a class at 10:00 in
  // Europe/Warsaw is shown at 10:00 local, which is what a timetable reader expects.
  const date = m[7] ? new Date(Date.UTC(year, month, day, hours, minutes, seconds)) : new Date(year, month, day, hours, minutes, seconds);
  if (Number.isNaN(date.getTime())) return null;
  return { date, allDay, tzid: String(paramsMap.TZID || "") };
}

/** DURATION values: P1D, PT90M, P1W, ... Returns milliseconds or null. */
function parseDuration(text) {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i.exec(String(text || "").trim());
  if (!m) return null;
  const ms = ((Number(m[2]) || 0) * 7 + (Number(m[3]) || 0)) * MS_DAY + ((Number(m[4]) || 0) * 3600 + (Number(m[5]) || 0) * 60 + (Number(m[6]) || 0)) * 1000;
  return m[1] === "-" ? -ms : ms;
}

/** RFC 5545 text unescaping, in one pass so a literal backslash survives. */
function unescapeIcs(value) {
  return String(value || "").replace(/\\([\\;,nN])/g, (_, ch) => (ch === "n" || ch === "N" ? "\n" : ch)).trim();
}

function escapeIcs(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** RFC 5545 line folding: a newline followed by a space or tab continues the previous line. */
function unfoldIcs(text) {
  return String(text || "").replace(/\r\n[ \t]|\r[ \t]|\n[ \t]/g, "").split(/\r\n|\r|\n/);
}

function splitProperty(line) {
  const idx = line.indexOf(":");
  if (idx === -1) return null;
  const head = line.slice(0, idx);
  const value = line.slice(idx + 1);
  const tokens = head.split(";");
  const params = {};
  for (const token of tokens.slice(1)) {
    const eq = token.indexOf("=");
    if (eq === -1) continue;
    params[token.slice(0, eq).toUpperCase()] = token.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: tokens[0].toUpperCase(), params, value };
}

/** ICS extension `X-MCQ-WEEK-PARITY: odd|even`; unknown values are ignored. */
function normalizeWeekParity(value) {
  const parity = String(value || "").trim().toLowerCase();
  return parity === "odd" || parity === "even" ? parity : "";
}

/**
 * Parses VEVENT blocks into raw events. Recurrence is expanded separately by expandIcs,
 * so a cancelled instance can suppress its parent occurrence.
 */
function parseIcs(text) {
  if (!text || !String(text).includes("BEGIN:VEVENT")) return [];
  const lines = unfoldIcs(text);
  const out = [];
  let cur = null;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.toUpperCase() === "BEGIN:VEVENT") {
      cur = { exdates: [], rdates: [] };
      continue;
    }
    if (line.toUpperCase() === "END:VEVENT") {
      if (cur && cur.dtstart) out.push(cur);
      cur = null;
      continue;
    }
    if (!cur) continue;
    const prop = splitProperty(line);
    if (!prop) continue;
    const { name, params, value } = prop;
    if (name === "SUMMARY") cur.summary = unescapeIcs(value);
    else if (name === "DESCRIPTION") cur.description = unescapeIcs(value);
    else if (name === "LOCATION") cur.location = unescapeIcs(value);
    else if (name === "STATUS") cur.status = String(value).trim().toUpperCase();
    else if (name === "X-MCQ-WEEK-PARITY") cur.weekParity = normalizeWeekParity(value);
    else if (name === "UID") cur.uid = String(value).trim();
    else if (name === "RRULE") cur.rrule = String(value).trim();
    else if (name === "DURATION") cur.durationMs = parseDuration(value);
    else if (name === "DTSTART") {
      const parsed = parseIcsDate(value, params);
      if (parsed) {
        cur.dtstart = parsed.date;
        cur.allDay = Boolean(cur.allDay || parsed.allDay);
        if (parsed.tzid) cur.tzid = parsed.tzid;
      }
    } else if (name === "DTEND") {
      const parsed = parseIcsDate(value, params);
      if (parsed) {
        cur.dtend = parsed.date;
        cur.allDay = Boolean(cur.allDay || parsed.allDay);
      }
    } else if (name === "RECURRENCE-ID") {
      const parsed = parseIcsDate(value, params);
      if (parsed) {
        cur.recurrenceId = parsed.date;
        cur.recurrenceAllDay = parsed.allDay;
      }
    } else if (name === "EXDATE") {
      for (const part of String(value).split(",")) {
        const parsed = parseIcsDate(part, params);
        if (parsed) cur.exdates.push(parsed.date);
      }
    } else if (name === "RDATE") {
      for (const part of String(value).split(",")) {
        const parsed = parseIcsDate(part, params);
        if (parsed) cur.rdates.push(parsed.date);
      }
    }
  }
  for (const ev of out) {
    if (ev.dtend === undefined && ev.dtstart) {
      const ms = Number.isFinite(ev.durationMs) ? ev.durationMs : (ev.allDay ? MS_DAY : 90 * 60 * 1000);
      ev.dtend = new Date(ev.dtstart.getTime() + ms);
    }
  }
  return out;
}

const DAY_CODES = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

/** RRULE string into a plain object. Unknown parts are ignored, never fatal. */
function parseRrule(text) {
  const parts = {};
  for (const chunk of String(text || "").split(";")) {
    const eq = chunk.indexOf("=");
    if (eq === -1) continue;
    parts[chunk.slice(0, eq).toUpperCase()] = chunk.slice(eq + 1);
  }
  const byDay = [];
  for (const token of String(parts.BYDAY || "").split(",")) {
    const m = /^([+-]?\d+)?([A-Z]{2})$/.exec(token.trim().toUpperCase());
    if (!m) continue;
    const weekday = DAY_CODES[m[2]];
    if (weekday === undefined) continue;
    byDay.push({ weekday, ordinal: m[1] ? Number(m[1]) : 0 });
  }
  const byMonthDay = String(parts.BYMONTHDAY || "")
    .split(",")
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n) && n !== 0);
  const untilParsed = parts.UNTIL ? parseIcsDate(parts.UNTIL, {}) : null;
  return {
    freq: String(parts.FREQ || "WEEKLY").toUpperCase(),
    interval: Math.max(1, Number(parts.INTERVAL) || 1),
    count: Number(parts.COUNT) > 0 ? Number(parts.COUNT) : 0,
    until: untilParsed ? untilParsed.date : null,
    byDay,
    byMonthDay,
  };
}

function withTimeOf(date, like) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), like.getHours(), like.getMinutes(), like.getSeconds());
}

function clampDay(year, month, day, like) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const actual = Math.min(Math.max(1, day), daysInMonth);
  return new Date(year, month, actual, like.getHours(), like.getMinutes(), like.getSeconds());
}

function nthWeekdayOfMonth(year, month, weekday, ordinal, like) {
  if (ordinal > 0) {
    const first = new Date(year, month, 1, like.getHours(), like.getMinutes(), like.getSeconds());
    const offset = (weekday - first.getDay() + 7) % 7;
    const d = new Date(year, month, 1 + offset + (ordinal - 1) * 7, like.getHours(), like.getMinutes(), like.getSeconds());
    return d.getMonth() === month ? d : null;
  }
  const last = new Date(year, month + 1, 0, like.getHours(), like.getMinutes(), like.getSeconds());
  const offset = (last.getDay() - weekday + 7) % 7;
  const d = new Date(year, month, last.getDate() - offset + (ordinal + 1) * 7, like.getHours(), like.getMinutes(), like.getSeconds());
  return d.getMonth() === month ? d : null;
}

/**
 * Every start date the rule generates between DTSTART and `limit`, honouring COUNT.
 * Weekly rules are anchored to the Monday of DTSTART's week so INTERVAL=2 works.
 */
function rruleOccurrences(ev, rule, limit) {
  const starts = [];
  const start = ev.dtstart;
  if (!start) return starts;
  const cap = rule.until && rule.until < limit ? rule.until : limit;
  const add = (d) => {
    if (starts.length >= MAX_INSTANCES) return false;
    starts.push(d);
    return true;
  };
  const reachedCount = () => rule.count > 0 && starts.length >= rule.count;

  if (rule.freq === "DAILY") {
    for (let i = 0; i < MAX_INSTANCES && !reachedCount(); i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i * rule.interval, start.getHours(), start.getMinutes(), start.getSeconds());
      if (d > cap) break;
      if (!add(d)) break;
    }
  } else if (rule.freq === "WEEKLY") {
    const weekdays = rule.byDay.length ? rule.byDay.map((b) => b.weekday) : [start.getDay()];
    const weekdaysSorted = [...new Set(weekdays)].sort((a, b) => a - b);
    const weekAnchor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    weekAnchor.setDate(weekAnchor.getDate() - ((start.getDay() + 6) % 7)); // Monday of that week
    for (let week = 0; week < 520 && !reachedCount(); week++) {
      const weekStart = new Date(weekAnchor.getFullYear(), weekAnchor.getMonth(), weekAnchor.getDate() + week * 7 * rule.interval);
      if (weekStart > cap) break;
      for (const weekday of weekdaysSorted) {
        const d = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + ((weekday + 6) % 7), start.getHours(), start.getMinutes(), start.getSeconds());
        if (d < start || d > cap) continue;
        if (!add(d)) break;
        if (reachedCount()) break;
      }
    }
  } else if (rule.freq === "MONTHLY") {
    for (let i = 0; i < 240 && !reachedCount(); i++) {
      const monthDate = new Date(start.getFullYear(), start.getMonth() + i * rule.interval, 1);
      if (monthDate > cap) break;
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth();
      const candidates = [];
      if (rule.byMonthDay.length) {
        for (const day of rule.byMonthDay) candidates.push(clampDay(year, month, day, start));
      } else if (rule.byDay.some((b) => b.ordinal)) {
        for (const spec of rule.byDay) {
          const d = nthWeekdayOfMonth(year, month, spec.weekday, spec.ordinal || 1, start);
          if (d) candidates.push(d);
        }
      } else {
        candidates.push(clampDay(year, month, start.getDate(), start));
      }
      candidates.sort((a, b) => a - b);
      for (const d of candidates) {
        if (d < start || d > cap) continue;
        if (!add(d)) break;
        if (reachedCount()) break;
      }
    }
  } else if (rule.freq === "YEARLY") {
    for (let i = 0; i < 200 && !reachedCount(); i++) {
      const year = start.getFullYear() + i * rule.interval;
      const d = clampDay(year, start.getMonth(), start.getDate(), start);
      if (d > cap) break;
      if (!add(d)) break;
    }
  } else {
    add(start); // sub-daily rules are not used by timetables; show the first occurrence
  }
  for (const extra of ev.rdates || []) add(extra);
  return starts;
}

function endOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
}

/** True when a date is excluded by EXDATE (same instant, or same day for all-day values). */
function isExcludedDate(ev, date) {
  return (ev.exdates || []).some((ex) => Math.abs(ex.getTime() - date.getTime()) < 60000 || (sameDay(ex, date) && (isMidnight(ex) || ev.allDay)));
}

/** The override (moved or cancelled) instance for a given original occurrence, if any. */
function findOverride(overrides, uid, date) {
  if (!uid) return null;
  return (overrides.get(uid) || []).find((ov) => {
    if (!ov.recurrenceId) return false;
    if (Math.abs(ov.recurrenceId.getTime() - date.getTime()) < 60000) return true;
    return sameDay(ov.recurrenceId, date) && (isMidnight(ov.recurrenceId) || ov.recurrenceAllDay === true);
  }) || null;
}

/**
 * Expands parsed events into concrete instances that overlap [windowStart, windowEnd].
 * Recurring events keep the event's wall-clock time. Multi-day all-day events produce
 * one instance per day, which is what a month grid and a daily timeline need.
 */
function expandIcs(baseEvents, windowStart, windowEnd) {
  const out = [];
  const overrides = new Map();
  const parents = new Map();
  for (const ev of baseEvents) {
    if (ev.uid && ev.recurrenceId) {
      const list = overrides.get(ev.uid) || [];
      list.push(ev);
      overrides.set(ev.uid, list);
    } else if (ev.uid && ev.rrule && !parents.has(ev.uid)) {
      parents.set(ev.uid, ev);
    }
  }
  // An override often carries only the changed fields; borrow the rest from the series.
  for (const list of overrides.values()) {
    for (const ov of list) {
      const parent = parents.get(ov.uid);
      if (!parent) continue;
      if (!ov.summary && parent.summary) ov.summary = parent.summary;
      if (!ov.location && parent.location) ov.location = parent.location;
      if (!ov.description && parent.description) ov.description = parent.description;
      if (!ov.weekParity && parent.weekParity) ov.weekParity = parent.weekParity;
    }
  }

  const push = (ev, start, end, extra) => {
    if (end < windowStart || start > windowEnd) return;
    out.push(Object.assign({}, ev, { dateKey: dateKey(start), dtstart: start, dtend: end }, extra));
  };

  for (const ev of baseEvents) {
    if (ev.status === "CANCELLED") continue; // cancelled instances only suppress their parent
    if (!ev.dtstart) continue;
    const durationMs = ev.dtend ? Math.max(0, ev.dtend.getTime() - ev.dtstart.getTime()) : (ev.allDay ? MS_DAY : 90 * 60 * 1000);

    if (ev.recurrenceId) {
      push(ev, ev.dtstart, ev.dtend || new Date(ev.dtstart.getTime() + durationMs), { isRecurringInstance: true });
      continue;
    }

    if (!ev.rrule) {
      if (ev.allDay) {
        const end = ev.dtend ? new Date(ev.dtend.getFullYear(), ev.dtend.getMonth(), ev.dtend.getDate()) : new Date(ev.dtstart.getFullYear(), ev.dtstart.getMonth(), ev.dtstart.getDate() + 1);
        const cursor = new Date(ev.dtstart.getFullYear(), ev.dtstart.getMonth(), ev.dtstart.getDate());
        let guard = 0;
        while (cursor < end && guard++ < 400) {
          push(ev, new Date(cursor), endOfDay(cursor), { allDay: true });
          cursor.setDate(cursor.getDate() + 1);
        }
      } else {
        push(ev, ev.dtstart, ev.dtend || new Date(ev.dtstart.getTime() + durationMs), {});
      }
      continue;
    }

    const rule = parseRrule(ev.rrule);
    for (const start of rruleOccurrences(ev, rule, windowEnd)) {
      if (isExcludedDate(ev, start)) continue;
      if (findOverride(overrides, ev.uid, start)) continue; // the moved/replaced instance is added on its own
      const end = ev.allDay ? endOfDay(start) : new Date(start.getTime() + durationMs);
      push(ev, start, end, { isRecurringInstance: true });
    }
  }

  out.sort((a, b) => a.dtstart.getTime() - b.dtstart.getTime() || String(a.summary || "").localeCompare(String(b.summary || "")));
  return out;
}

function utcStamp(d) {
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`;
}

function isoDate(d) {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
}

/** Exports instances as a plain calendar. Timed events are UTC, all-day events are dates. */
function exportIcs(events, options) {
  const opts = options || {};
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MCQ Tracker//Calendar//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  if (opts.calendarName) lines.push(`X-WR-CALNAME:${escapeIcs(opts.calendarName)}`);
  const stamp = utcStamp(opts.now || new Date());
  events.forEach((ev, index) => {
    const start = ev.dtstart;
    if (!start) return;
    lines.push("BEGIN:VEVENT");
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`UID:${escapeIcs(ev.uid || `mcq-${ev.dateKey}-${index}`)}@mcq-tracker`);
    lines.push(`SUMMARY:${escapeIcs(ev.summary || "Class")}`);
    if (ev.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${isoDate(start)}`);
      if (ev.dtend) {
        const end = new Date(ev.dtend.getFullYear(), ev.dtend.getMonth(), ev.dtend.getDate());
        if (ev.dtend.getHours() >= 20) end.setDate(end.getDate() + 1);
        lines.push(`DTEND;VALUE=DATE:${isoDate(end)}`);
      }
    } else {
      lines.push(`DTSTART:${utcStamp(start)}`);
      if (ev.dtend) lines.push(`DTEND:${utcStamp(ev.dtend)}`);
    }
    if (ev.location) lines.push(`LOCATION:${escapeIcs(ev.location)}`);
    if (ev.description) lines.push(`DESCRIPTION:${escapeIcs(ev.description)}`);
    const weekParity = normalizeWeekParity(ev.weekParity);
    if (weekParity) lines.push(`X-MCQ-WEEK-PARITY:${weekParity}`);
    lines.push("END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

/* ------------------------------------------------------------ feed helpers */

function extractQueryParam(url, name) {
  const m = new RegExp(`[?&]${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^&#]*)`, "i").exec(String(url || ""));
  return m ? m[1] : "";
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Minimal base64 decoder so this works on mobile without Buffer or atob shims. */
function decodeBase64Ascii(input) {
  let str = String(input || "").replace(/[^A-Za-z0-9+/=]/g, "");
  let out = "";
  for (let i = 0; i < str.length; i += 4) {
    const chunk = str.slice(i, i + 4);
    if (chunk.length < 2) break;
    const n = [0, 1, 2, 3].map((k) => (chunk[k] ? B64.indexOf(chunk[k]) : 0));
    out += String.fromCharCode((n[0] << 2) | (n[1] >> 4));
    if (chunk[2] !== undefined && chunk[2] !== "=") out += String.fromCharCode(((n[1] & 15) << 4) | (n[2] >> 2));
    if (chunk[3] !== undefined && chunk[3] !== "=") out += String.fromCharCode(((n[2] & 3) << 6) | n[3]);
  }
  return out;
}

/** Google Calendar share links (`?cid=...`, `?src=...`) become their public .ics feed. */
function normalizeCalendarUrl(raw) {
  if (!raw) return "";
  const url = String(raw).trim().replace(/^webcal:\/\//i, "https://");
  if (!/calendar\.google\.com/i.test(url)) return url;
  const isIcal = /\/calendar\/ical\//i.test(url);
  if (!isIcal) {
    const cid = extractQueryParam(url, "cid");
    if (cid) {
      const decoded = decodeBase64Ascii(decodeURIComponent(cid)).trim();
      if (decoded) return `https://calendar.google.com/calendar/ical/${encodeURIComponent(decoded)}/public/basic.ics`;
    }
    const src = extractQueryParam(url, "src");
    if (src) return `https://calendar.google.com/calendar/ical/${encodeURIComponent(decodeURIComponent(src).trim())}/public/basic.ics`;
  }
  if (isIcal && /\/full(\.ics)?(\?.*)?$/i.test(url)) return url.replace(/\/full(\.ics)?(\?.*)?$/i, "/basic.ics");
  return url;
}

function extractCalendarName(icsText) {
  const m = /^X-WR-CALNAME(?:;[^:]*)?:(.+)$/im.exec(String(icsText || ""));
  return m ? unescapeIcs(m[1]) : "";
}

function deriveSourceLabel(url, icsText) {
  const name = extractCalendarName(icsText);
  const clean = String(url || "").trim().replace(/^webcal:\/\//i, "https://");
  const m = /^https?:\/\/([^/?#]+)(\/[^?#]*)?/i.exec(clean);
  if (!m) return name || clean.slice(0, 45) || "Calendar";
  const host = m[1];
  if (name) return `${name} (${host})`;
  const last = (m[2] || "").split("/").filter(Boolean).pop();
  if (last) {
    try {
      return `${host} (${decodeURIComponent(last)})`;
    } catch (e) {
      return `${host} (${last})`;
    }
  }
  return host;
}

function icsLooksValid(text) {
  return typeof text === "string" && text.includes("BEGIN:VCALENDAR") && text.includes("BEGIN:VEVENT");
}

module.exports = {
  MAX_INSTANCES,
  dateKey,
  parseDateKey,
  parseIcsDate,
  parseDuration,
  unescapeIcs,
  escapeIcs,
  unfoldIcs,
  normalizeWeekParity,
  parseIcs,
  parseRrule,
  rruleOccurrences,
  expandIcs,
  exportIcs,
  normalizeCalendarUrl,
  extractCalendarName,
  deriveSourceLabel,
  decodeBase64Ascii,
  icsLooksValid,
};
