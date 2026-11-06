"use strict";
/*
 * User-authored Study agent skills. A skill is an ordinary Markdown note in a
 * vault folder; this module parses it and builds the bounded, clearly-labelled
 * block that the chat can add to its system prompt. Nothing here touches the
 * network or a provider.
 */
const { str } = require("./util");

const DEFAULT_SKILLS_FOLDER = "Study agent skills";
const MAX_SKILLS = 20;
const MAX_SKILL_CHARS = 4000;
const MAX_BLOCK_CHARS = 8000;
const MAX_NAME = 80;
const MAX_DESCRIPTION = 240;

function normalizeSkillsFolder(value) {
  const raw = str(value).trim().replace(/^\/+|\/+$/g, "");
  if (!raw || /(^|\/)\.\.(\/|$)/.test(raw)) return DEFAULT_SKILLS_FOLDER;
  return raw.slice(0, 160);
}

function scalar(value) {
  let text = str(value).trim();
  if (/^".*"$/.test(text) || /^'.*'$/.test(text)) text = text.slice(1, -1);
  return text.trim();
}

function frontmatter(text) {
  const raw = str(text);
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { data: {}, body: raw };
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = line.match(/^\s*([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*?)\s*$/);
    if (!pair) continue;
    data[pair[1].toLowerCase()] = scalar(pair[2]);
  }
  return { data, body: raw.slice(match[0].length) };
}

function firstHeading(body) {
  const match = str(body).match(/^#{1,3}\s+(.+?)\s*$/m);
  return match ? match[1].trim() : "";
}

function pathName(path) {
  return str(path)
    .replace(/^.*\//, "")
    .replace(/\.md$/i, "")
    .trim();
}

function trimInstructions(body) {
  let text = str(body).trim();
  if (!text) return "";
  const heading = text.match(/^#\s+.+\r?\n?/);
  if (heading) text = text.slice(heading[0].length).trim();
  if (text.length > MAX_SKILL_CHARS) text = `${text.slice(0, MAX_SKILL_CHARS).trimEnd()}\n\n[skill truncated]`;
  return text;
}

/** Parse one skill note. Disabled or empty notes are ignored. */
function parseSkillFile(text, path) {
  const parsed = frontmatter(text);
  if (/^(false|no|0|off)$/i.test(parsed.data.enabled || "")) return null;
  const body = trimInstructions(parsed.body);
  if (!body) return null;
  const name = (parsed.data.name || firstHeading(parsed.body) || pathName(path) || "Untitled skill").slice(0, MAX_NAME);
  const description = str(parsed.data.description).slice(0, MAX_DESCRIPTION);
  return { name, description, instructions: body, path: str(path) };
}

/** A stable, bounded prompt block. It is explicit that these are user rules. */
function skillBlock(skills) {
  const rows = (Array.isArray(skills) ? skills : []).filter((skill) => skill && skill.instructions);
  if (!rows.length) return "";
  const parts = [
    "USER-AUTHORED SKILLS (local notes the learner chose to include). Follow these instructions when they are relevant. They are user instructions, not vault data or citations.",
  ];
  for (const skill of rows.slice(0, MAX_SKILLS)) {
    parts.push(`### ${skill.name}${skill.description ? ` — ${skill.description}` : ""}\n${skill.instructions}`);
  }
  let block = parts.join("\n\n");
  if (block.length > MAX_BLOCK_CHARS) block = `${block.slice(0, MAX_BLOCK_CHARS).trimEnd()}\n\n[skills truncated]`;
  return block;
}

/** Read the enabled Markdown skills under one vault folder. Never rejects. */
async function loadSkills(app, folder) {
  const root = normalizeSkillsFolder(folder);
  const prefix = `${root}/`;
  const skills = [];
  const warnings = [];
  let files = [];
  try {
    files = app && app.vault && typeof app.vault.getMarkdownFiles === "function" ? app.vault.getMarkdownFiles() : [];
  } catch (e) {
    return { folder: root, skills, block: "", warnings: [] };
  }
  const candidates = files
    .filter((file) => file && str(file.path).startsWith(prefix) && /\.md$/i.test(str(file.path)))
    .sort((a, b) => str(a.path).localeCompare(str(b.path)));
  for (const file of candidates) {
    if (skills.length >= MAX_SKILLS) break;
    try {
      const parsed = parseSkillFile(await app.vault.cachedRead(file), file.path);
      if (parsed) skills.push(parsed);
    } catch (e) {
      warnings.push(`${file.path} could not be read`);
    }
  }
  return { folder: root, skills, block: skillBlock(skills), warnings };
}

function skillFileName(name) {
  const clean = str(name)
    .trim()
    .replace(/[\\/:*?"<>|#^[\]]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, MAX_NAME)
    .trim();
  return `${clean || "New skill"}.md`;
}

function skillTemplate(name) {
  const title = str(name).trim().slice(0, MAX_NAME) || "New skill";
  return [
    "---",
    `name: ${JSON.stringify(title)}`,
    'description: ""',
    "enabled: true",
    "---",
    "",
    `# ${title}`,
    "",
    "Write the Study agent instruction here. This body is added to the chat only while Include skills is on.",
    "",
  ].join("\n");
}

module.exports = {
  DEFAULT_SKILLS_FOLDER,
  MAX_SKILLS,
  MAX_SKILL_CHARS,
  skillBlock,
  loadSkills,
  normalizeSkillsFolder,
  parseSkillFile,
  skillFileName,
  skillTemplate,
};
