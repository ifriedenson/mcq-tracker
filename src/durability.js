"use strict";
/*
 * Two-different-days durability. This is deliberately a small property layer,
 * not another scheduler: a correct recall is durable only after it happens on
 * two distinct calendar days, and a miss clears the current run.
 */
const { str } = require("./util");

const RECALL_DAYS_LIMIT = 30;
const MIN_DURABLE_DAYS = 2;

function dateKey(value) {
  const text = str(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function normalizeRecallDays(value) {
  const list = Array.isArray(value) ? value : str(value).split(/[,;|]+/);
  const days = [...new Set(list.map(dateKey).filter(Boolean))].sort();
  return days.slice(-RECALL_DAYS_LIMIT);
}

function normalizeDurabilitySettings(value, fallback) {
  const src = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const base = fallback && typeof fallback === "object" ? fallback : {};
  const days = Math.max(MIN_DURABLE_DAYS, Math.min(10, Math.round(Number(src.requiredDays ?? base.requiredDays) || 2)));
  return { requiredDays: days };
}

function requiredDaysOf(value, fallback) {
  return normalizeDurabilitySettings(value, fallback).requiredDays;
}

function recordRecallDay(fm, input) {
  const opts = input || {};
  const day = dateKey(opts.date);
  if (!fm || !day) return { days: [], durable: false, newlyDurable: false };
  const previous = normalizeRecallDays(fm.recall_days);
  const wasDurable = fm.durable_recall === true;
  const days = opts.correct ? [...new Set([...previous, day])].sort().slice(-RECALL_DAYS_LIMIT) : [];
  const required = Math.max(MIN_DURABLE_DAYS, Math.round(Number(opts.requiredDays) || MIN_DURABLE_DAYS));
  const durable = days.length >= required;
  fm.recall_days = days;
  fm.recall_day_count = days.length;
  fm.durable_recall = durable;
  if (durable) fm.durable_on = days[Math.max(0, required - 1)];
  else delete fm.durable_on;
  fm.recall_checked = day;
  return { days, durable, newlyDurable: durable && !wasDurable };
}

function durabilityOf(fm, requiredDays) {
  const days = normalizeRecallDays(fm && fm.recall_days);
  const required = Math.max(MIN_DURABLE_DAYS, Math.round(Number(requiredDays) || MIN_DURABLE_DAYS));
  return {
    days,
    count: days.length,
    durable: (fm && fm.durable_recall === true) || days.length >= required,
    requiredDays: required,
    durableOn: str(fm && fm.durable_on).slice(0, 10),
  };
}

function durabilitySummary(records, requiredDays) {
  const rows = [];
  for (const record of Array.isArray(records) ? records : []) {
    const fm = record && record.fm ? record.fm : {};
    if (!fm.recall_days && fm.durable_recall !== true) continue;
    const info = durabilityOf(fm, requiredDays);
    rows.push({
      path: str(record.file && record.file.path),
      title: str(fm.title).trim() || str(record.file && record.file.basename) || "",
      ...info,
    });
  }
  const durable = rows.filter((row) => row.durable).length;
  return {
    rows,
    total: rows.length,
    durable,
    learning: rows.length - durable,
    retention: rows.length ? durable / rows.length : null,
  };
}

module.exports = {
  MIN_DURABLE_DAYS,
  RECALL_DAYS_LIMIT,
  dateKey,
  durabilityOf,
  durabilitySummary,
  normalizeDurabilitySettings,
  normalizeRecallDays,
  recordRecallDay,
  requiredDaysOf,
};
