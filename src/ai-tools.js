"use strict";
/*
 * Allow-listed tools for the Direct AI agent.
 *
 * The model never receives file access. It can only propose a small set of
 * actions in a fenced `mcqtool` block. The plugin validates each proposal,
 * shows it in a review window, and only then writes through the same guards as
 * the rest of AI generation.
 */
const { str } = require("./util");

const TOOL_NAMES = ["create_question", "create_card", "update_section"];
const SAFE_HEADINGS = ["stimulus", "question", "answer choices", "answer", "explanation", "my notes", "front", "back", "notes"];

function toolProtocol() {
  return [
    "Direct API agent mode uses an allow-listed tool protocol. You cannot read or write files directly.",
    "When the learner asks you to create or change study material, reply normally and include one fenced block per action:",
    "```mcqtool",
    '{"tool":"create_question","question":"...","choices":["...","..."],"answer":"B","explanation":"...","course":"...","skill":"...","difficulty":"medium"}',
    "```",
    'For a flashcard use {"tool":"create_card","front":"...","back":"...","deck":"...","course":"..."}.',
    'To replace one existing section use {"tool":"update_section","path":"Folder/Note.md","heading":"My Notes","content":"..."}.',
    "Allowed headings are Stimulus, Question, Answer Choices, Answer, Explanation, My Notes, Front, Back and Notes.",
    "Only propose an action the learner asked for. Never propose tracking properties, frontmatter, deletions or shell commands. The learner reviews every action before anything is written.",
  ].join("\n");
}

function fencedBlocks(text) {
  const out = [];
  const re = /```(?:mcqtool|json:mcqtool)[ \t]*\r?\n([\s\S]*?)```/gi;
  let match;
  while ((match = re.exec(String(text || ""))) !== null) out.push(match[1].trim());
  return out;
}

function asChoices(value) {
  if (Array.isArray(value)) return value.map((item) => str(item).trim()).filter(Boolean).slice(0, 8);
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .map((key) => str(value[key]).trim())
      .filter(Boolean)
      .slice(0, 8);
  }
  return [];
}

function normalizeAnswer(value, choices) {
  const answer = str(value).trim();
  if (!answer) return "";
  if (/^[A-H]$/i.test(answer)) return answer.toUpperCase();
  const index = choices.findIndex((choice) => choice.toLowerCase() === answer.toLowerCase());
  return index >= 0 ? "ABCDEFGH"[index] : answer;
}

function normalizeProposal(raw) {
  const item = raw && typeof raw === "object" ? raw : {};
  const tool = str(item.tool || item.action || item.type).trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!TOOL_NAMES.includes(tool)) return { ok: false, error: `Unknown tool: ${tool || "(missing)"}.` };

  if (tool === "create_question") {
    const question = str(item.question || item.stem).trim();
    const choices = asChoices(item.choices);
    const answer = normalizeAnswer(item.answer, choices);
    if (question.length < 5) return { ok: false, error: "A question needs at least five characters." };
    if (choices.length < 2) return { ok: false, error: "A question needs at least two choices." };
    if (!answer) return { ok: false, error: "A question needs an answer." };
    return {
      ok: true,
      proposal: {
        tool,
        question,
        choices,
        answer,
        explanation: str(item.explanation).trim(),
        course: str(item.course).trim(),
        skill: str(item.skill).trim(),
        difficulty: ["easy", "medium", "hard"].includes(str(item.difficulty).trim().toLowerCase()) ? str(item.difficulty).trim().toLowerCase() : "",
      },
    };
  }

  if (tool === "create_card") {
    const front = str(item.front || item.prompt).trim();
    const back = str(item.back || item.answer).trim();
    if (!front || !back) return { ok: false, error: "A card needs both a front and a back." };
    return {
      ok: true,
      proposal: {
        tool,
        front,
        back,
        deck: str(item.deck).trim(),
        course: str(item.course).trim(),
      },
    };
  }

  const path = str(item.path).trim().replace(/\\/g, "/").replace(/^\/+/, "");
  const heading = str(item.heading).trim();
  const content = str(item.content).trim();
  if (!path || !/\.md$/i.test(path)) return { ok: false, error: "update_section needs a Markdown note path." };
  if (!SAFE_HEADINGS.includes(heading.toLowerCase())) return { ok: false, error: `Heading "${heading}" is not on the allowed list.` };
  if (!content) return { ok: false, error: "update_section needs content." };
  return { ok: true, proposal: { tool, path, heading, content } };
}

function parseToolProposals(reply) {
  const proposals = [];
  const errors = [];
  for (const block of fencedBlocks(reply)) {
    let parsed;
    try {
      parsed = JSON.parse(block);
    } catch (e) {
      errors.push("A tool block was not valid JSON.");
      continue;
    }
    const list = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.actions) ? parsed.actions : [parsed];
    for (const raw of list) {
      const result = normalizeProposal(raw);
      if (result.ok) proposals.push(result.proposal);
      else errors.push(result.error);
    }
  }
  return { proposals, errors };
}

function proposalPreview(proposal) {
  const p = proposal || {};
  if (p.tool === "create_question") {
    return [
      `Question: ${p.question}`,
      ...p.choices.map((choice, index) => `  ${"ABCDEFGH"[index]}. ${choice}`),
      `Answer: ${p.answer}`,
      p.explanation ? `Explanation: ${p.explanation}` : "",
      [p.course, p.skill, p.difficulty].filter(Boolean).join(" · "),
    ]
      .filter(Boolean)
      .join("\n");
  }
  if (p.tool === "create_card") return `Front: ${p.front}\nBack: ${p.back}\n${[p.deck, p.course].filter(Boolean).join(" · ")}`.trim();
  return `Note: ${p.path}\nSection: ${p.heading}\n\n${p.content}`;
}

/** Replace exactly one safe body section. Frontmatter and other sections are untouched. */
function replaceSection(text, heading, content) {
  const source = String(text || "");
  const name = str(heading).trim();
  if (!SAFE_HEADINGS.includes(name.toLowerCase())) throw new Error(`Heading "${name}" is not allowed.`);
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(^##[ \\t]+${escaped}[ \\t]*\\r?\\n)([\\s\\S]*?)(?=^##[ \\t]+|(?![\\s\\S]))`, "mi");
  if (!re.test(source)) throw new Error(`This note has no "## ${name}" section.`);
  return source.replace(re, (_match, head) => `${head}\n${str(content).trim()}\n\n`);
}

module.exports = {
  SAFE_HEADINGS,
  TOOL_NAMES,
  normalizeProposal,
  parseToolProposals,
  proposalPreview,
  replaceSection,
  toolProtocol,
};
