"use strict";
/*
 * Local rename of a tag on study tasks only. This is the safe half of the Tag
 * Wrangler row in plan.md §5.24: it never rewrites a note, frontmatter or
 * another plugin's tags, and it does not merge tags vault-wide. Tags are the
 * optional `studyTasks` values the task list already keeps.
 */
const { str } = require("./util");
const studyWorkspace = require("./study-workspace");

const MAX_USAGE = 40;

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function tagsOf(task) {
  const source = asObject(task).tags;
  return Array.isArray(source) ? source.map((tag) => str(tag)).filter(Boolean) : [];
}

/** Every tag the local tasks use, most used first, with open/done counts. */
function tagUsage(tasks) {
  const counts = new Map();
  for (const task of Array.isArray(tasks) ? tasks : []) {
    const source = asObject(task);
    for (const tag of tagsOf(source)) {
      const key = tag.toLowerCase();
      const row = counts.get(key) || { tag, count: 0, open: 0 };
      row.count += 1;
      if (source.done !== true) row.open += 1;
      counts.set(key, row);
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, MAX_USAGE);
}

/**
 * Rename one tag across the local tasks. Returns the renamed list instead of
 * mutating it, and refuses an empty, identical or unused tag with a message.
 * A task that already carries the new tag keeps one copy, and the existing
 * four-tag cap still applies.
 */
function planTagRename(tasks, from, to) {
  const list = Array.isArray(tasks) ? tasks : [];
  const source = studyWorkspace.tagValue(from);
  const target = studyWorkspace.tagValue(to);
  if (!source) return { ok: false, reason: "from", message: "Type the tag to rename." };
  if (!target) return { ok: false, reason: "to", message: "Type the new tag name." };
  if (source.toLowerCase() === target.toLowerCase()) {
    return { ok: false, reason: "same", message: "The new tag is the same as the old one." };
  }
  const key = source.toLowerCase();
  let changed = 0;
  let merged = 0;
  const next = list.map((task) => {
    const tags = tagsOf(task);
    const index = tags.findIndex((tag) => tag.toLowerCase() === key);
    if (index < 0) return task;
    changed += 1;
    const hadTarget = tags.some((tag, position) => position !== index && tag.toLowerCase() === target.toLowerCase());
    if (hadTarget) merged += 1;
    const replaced = tags.map((tag, position) => (position === index ? target : tag));
    return Object.assign({}, task, { tags: studyWorkspace.tagList(replaced) });
  });
  if (!changed) return { ok: false, reason: "none", message: `No task uses #${source}.` };
  return { ok: true, tasks: next, changed, merged, from: source, to: target };
}

/** One sentence for the view message, or the refusal that was returned. */
function renameSummary(result) {
  const source = asObject(result);
  if (source.ok === false || !source.ok) return str(source.message);
  const base = `Renamed #${source.from} to #${source.to} on ${source.changed} task${source.changed === 1 ? "" : "s"}.`;
  if (!source.merged) return base;
  return `${base} ${source.merged} task${source.merged === 1 ? " already had" : "s already had"} #${source.to} and ${source.merged === 1 ? "was" : "were"} merged.`;
}

module.exports = {
  MAX_USAGE,
  planTagRename,
  renameSummary,
  tagUsage,
  tagsOf,
};
