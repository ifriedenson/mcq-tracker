"use strict";
/*
 * Shared course identity. The calendar course registry is the source of truth;
 * every other note-backed store keeps its original text and is resolved here at
 * read time. A missing registry entry falls back to the old lowercase-name
 * behaviour, so existing vaults do not need a migration.
 */
const { str } = require("./util");

function normalizeText(value) {
  return str(value).trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeKey(value) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, " ").trim();
}

function registryOf(settings) {
  if (Array.isArray(settings)) return settings;
  if (!settings || typeof settings !== "object") return [];
  if (Array.isArray(settings.registry)) return settings.registry;
  if (settings.calendar && Array.isArray(settings.calendar.courses)) return settings.calendar.courses;
  if (Array.isArray(settings.courses)) {
    const looksRegistered = settings.courses.some((row) => row && (row.code !== undefined || row.aliases !== undefined || row.id));
    if (looksRegistered) return settings.courses;
  }
  return [];
}

function aliasesOf(course) {
  const raw = course && Array.isArray(course.aliases) ? course.aliases : [];
  return raw.map(normalizeText).filter(Boolean);
}

function courseCandidates(course) {
  if (!course || typeof course !== "object") return [];
  const values = [course.name, course.code, course.folder, course.id, ...aliasesOf(course)];
  const folder = str(course.folder).trim();
  if (folder) values.push(folder.split("/").filter(Boolean).pop());
  const out = [];
  for (const value of values) {
    const key = normalizeKey(value);
    if (key && !out.includes(key)) out.push(key);
  }
  return out;
}

function registryKeys(course) {
  return courseCandidates(course);
}

/**
 * Resolve a name, code, folder, alias or id to one registry row. Returns null
 * when no registry is present or nothing matches.
 */
function resolveCourse(settings, input) {
  const registry = registryOf(settings);
  if (!registry.length) return null;
  const value = input && typeof input === "object" ? input.name || input.code || input.folder || input.id : input;
  const key = normalizeKey(value);
  if (!key) return null;
  for (const course of registry) {
    if (!course || typeof course !== "object") continue;
    if (normalizeText(input && input.id) && normalizeText(input.id) === normalizeText(course.id)) return course;
    const candidates = courseCandidates(course);
    if (candidates.includes(key)) return course;
  }
  for (const course of registry) {
    if (!course || typeof course !== "object") continue;
    const code = normalizeKey(course.code);
    if (code && (key === code || key.startsWith(`${code} `) || key.startsWith(`${code}-`) || key.startsWith(`${code}:`))) return course;
  }
  for (const course of registry) {
    if (!course || typeof course !== "object") continue;
    const candidates = courseCandidates(course).filter((candidate) => candidate.length >= 4);
    if (candidates.some((candidate) => key.includes(candidate) || candidate.includes(key))) return course;
  }
  return null;
}

function courseKey(settings, input) {
  const resolved = resolveCourse(settings, input);
  if (resolved) return normalizeText(resolved.id || resolved.name || resolved.code);
  const raw = input && typeof input === "object" ? input.name || input.code || input.folder || "" : input;
  return normalizeKey(raw);
}

function courseDetails(settings, input) {
  const resolved = resolveCourse(settings, input);
  if (resolved) {
    return {
      id: str(resolved.id),
      name: str(resolved.name || resolved.code),
      code: str(resolved.code),
      folder: str(resolved.folder),
      color: str(resolved.color),
      credits: Number.isFinite(Number(resolved.credits)) ? Number(resolved.credits) : 3,
      totalTopics: Math.max(0, Number(resolved.totalTopics) || 0),
      aliases: aliasesOf(resolved),
      resolved: true,
    };
  }
  const raw = input && typeof input === "object" ? input.name || input.code || input.folder || "" : input;
  return {
    id: "",
    name: str(raw).trim(),
    code: "",
    folder: "",
    color: "",
    credits: 3,
    totalTopics: 0,
    aliases: [],
    resolved: false,
  };
}

function sameCourse(settings, a, b) {
  const ka = courseKey(settings, a);
  const kb = courseKey(settings, b);
  return !!ka && ka === kb;
}

/** Add the old name/code to aliases instead of rewriting stored course strings. */
function renameCourse(courses, id, name) {
  const nextName = str(name).trim();
  if (!nextName) return Array.isArray(courses) ? courses.slice() : [];
  return (Array.isArray(courses) ? courses : []).map((course) => {
    if (!course || str(course.id) !== str(id)) return course;
    const aliases = [...new Set([...(Array.isArray(course.aliases) ? course.aliases : []), course.name, course.code].map(str).map((v) => v.trim()).filter(Boolean))];
    return { ...course, name: nextName, aliases };
  });
}

module.exports = {
  aliasesOf,
  courseCandidates,
  courseDetails,
  courseKey,
  normalizeKey,
  normalizeText,
  registryOf,
  registryKeys,
  renameCourse,
  resolveCourse,
  sameCourse,
};
