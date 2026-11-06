"use strict";
/*
 * Local chat projects.
 *
 * A project is a named, local grouping of saved conversations. It bundles no
 * files, prompts, provider context or hosting, and nothing here touches the
 * network. An unknown or removed project id simply reads as unassigned.
 */
const { str } = require("./util");

const MAX_PROJECTS = 30;
const MAX_PROJECT_NAME = 60;
const UNASSIGNED = "none";

function normalizeProjectName(value) {
  return str(value)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_PROJECT_NAME);
}

function newProjectId(now) {
  const stamp = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  return `project-${stamp}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Bounded, de-duplicated projects: first id and first name win. */
function normalizeProjects(value) {
  const seenIds = new Set();
  const seenNames = new Set();
  const rows = [];
  for (const raw of Array.isArray(value) ? value : []) {
    const name = normalizeProjectName(raw && raw.name);
    const id = str(raw && raw.id).trim().slice(0, 80);
    if (!name || !id || seenIds.has(id)) continue;
    const key = name.toLowerCase();
    if (seenNames.has(key)) continue;
    seenIds.add(id);
    seenNames.add(key);
    rows.push({ id, name });
    if (rows.length >= MAX_PROJECTS) break;
  }
  return rows;
}

/** Match by id first, then by name, case-insensitively. */
function findProject(projects, ref) {
  const key = str(ref).trim();
  if (!key) return null;
  const rows = normalizeProjects(projects);
  return (
    rows.find((project) => project.id === key) ||
    rows.find((project) => project.name.toLowerCase() === key.toLowerCase()) ||
    null
  );
}

/** Return the existing project with that name, or create one. */
function ensureProject(projects, name, now) {
  const rows = normalizeProjects(projects);
  const clean = normalizeProjectName(name);
  if (!clean) return { projects: rows, project: null };
  const existing = rows.find((project) => project.name.toLowerCase() === clean.toLowerCase());
  if (existing) return { projects: rows, project: existing };
  if (rows.length >= MAX_PROJECTS) return { projects: rows, project: null, full: true };
  const project = { id: newProjectId(now), name: clean };
  return { projects: rows.concat(project), project };
}

function renameProject(projects, id, name) {
  const rows = normalizeProjects(projects);
  const key = str(id).trim();
  const clean = normalizeProjectName(name);
  if (!key || !clean) return rows;
  if (rows.some((project) => project.id !== key && project.name.toLowerCase() === clean.toLowerCase())) return rows;
  return rows.map((project) => (project.id === key ? { ...project, name: clean } : project));
}

function removeProject(projects, id) {
  const key = str(id).trim();
  return normalizeProjects(projects).filter((project) => project.id !== key);
}

function projectName(projects, id) {
  const found = findProject(projects, id);
  return found ? found.name : "";
}

/** "" or "all" means every conversation; "none" means unassigned. */
function normalizeFilter(value) {
  const key = str(value).trim();
  if (!key || key === "all") return "";
  if (key === UNASSIGNED) return UNASSIGNED;
  return key;
}

function filterByProject(rows, filter) {
  const key = normalizeFilter(filter);
  const list = Array.isArray(rows) ? rows : [];
  if (!key) return list;
  if (key === UNASSIGNED) return list.filter((row) => !str(row && row.project).trim());
  return list.filter((row) => str(row && row.project).trim() === key);
}

/** Row list for a project picker: count of conversations in each project. */
function summarizeProjects(projects, rows) {
  const list = Array.isArray(rows) ? rows : [];
  return normalizeProjects(projects).map((project) => ({
    ...project,
    count: list.filter((row) => str(row && row.project).trim() === project.id).length,
  }));
}

module.exports = {
  MAX_PROJECTS,
  MAX_PROJECT_NAME,
  UNASSIGNED,
  ensureProject,
  filterByProject,
  findProject,
  newProjectId,
  normalizeFilter,
  normalizeProjectName,
  normalizeProjects,
  projectName,
  removeProject,
  renameProject,
  summarizeProjects,
};
