"use strict";
const { str } = require("./util");

/*
 * Tutor roles and commands are shared by the review chat, the general assistant,
 * the Direct API backend and the OpenCode backend. Keeping the wording here means
 * a role behaves the same everywhere instead of drifting between two chat panels.
 */
const TUTOR_ROLES = [
  {
    id: "private",
    label: "Private tutor",
    description: "Patient explanations, worked examples and check-ins.",
    prompt:
      "You are a patient private tutor working one-to-one with the student. Explain the reasoning, use a worked example when it helps, " +
      "and check that the student can repeat the idea before moving on. Be encouraging but honest about what is missing.",
  },
  {
    id: "socratic",
    label: "Socratic tutor",
    description: "Guides with questions instead of handing over the answer.",
    prompt:
      "You are a Socratic tutor. Do not give the answer immediately. Ask one focused question at a time, respond to the student's reasoning, " +
      "and give a hint only when they are stuck. Lead them to explain the answer in their own words.",
  },
  {
    id: "language",
    label: "Language partner",
    description: "Conversation practice with gentle corrections.",
    prompt:
      "You are a friendly language partner. Use the language the student is practising, keep sentences at their level, and correct mistakes gently " +
      "with a short explanation. If they have not named a language, ask which one they want to practise.",
  },
];

const TUTOR_COMMANDS = [
  {
    id: "guide",
    label: "Guide",
    description: "Walk me through it one step at a time.",
    prompt: "Guide me with one question at a time. Do not reveal the final answer until I have worked through the reasoning.",
  },
  {
    id: "quiz",
    label: "Quiz me",
    description: "One short question at a time.",
    prompt: "Quiz me one short question at a time. Wait for my answer, then explain briefly and adjust the difficulty.",
  },
  {
    id: "confuse",
    label: "Confuse me",
    description: "Show a plausible misconception and ask me to fix it.",
    prompt: "Give me a plausible wrong answer or common misconception for this topic, then ask me to explain why it is wrong.",
  },
  {
    id: "gap",
    label: "Find my gap",
    description: "Name the smallest missing idea behind my mistake.",
    prompt: "Find the smallest knowledge gap that would cause my mistake, explain it in two sentences, then ask one check question.",
  },
  {
    id: "predict",
    label: "Predict my mistake",
    description: "Predict the next error I am likely to make.",
    prompt: "Predict the next mistake I am likely to make on this topic and give me one concrete way to avoid it.",
  },
  {
    id: "feynman",
    label: "Feynman",
    description: "Make me teach it back in plain language.",
    prompt: "Ask me to explain this topic in plain language as if teaching a beginner, then point out what I left vague or wrong.",
  },
  {
    id: "mock",
    label: "Mock exam",
    description: "Run a short exam-style sequence.",
    prompt: "Run a short mock exam. Ask one exam-style question at a time, wait for my answer, then mark it and move on.",
  },
];

function normalizeTutorRole(value) {
  const id = str(value).trim().toLowerCase();
  return TUTOR_ROLES.some((role) => role.id === id) ? id : "private";
}

function tutorRole(value) {
  const id = normalizeTutorRole(value);
  return TUTOR_ROLES.find((role) => role.id === id) || TUTOR_ROLES[0];
}

function roleInstruction(value) {
  return tutorRole(value).prompt;
}

function commandReference() {
  return [
    "TUTOR COMMANDS: When a student message starts with one of these, follow it until they change direction.",
    ...TUTOR_COMMANDS.map((command) => `- /${command.id}: ${command.prompt}`),
  ].join("\n");
}

/** Parse `/guide`, `/quiz fractions`, and similar commands without executing anything. */
function parseTutorCommand(text) {
  const raw = str(text).trim();
  const match = /^\/([a-z][a-z-]*)\b(?:\s+([\s\S]*))?$/i.exec(raw);
  if (!match) return null;
  const id = match[1].toLowerCase();
  const command = TUTOR_COMMANDS.find((item) => item.id === id);
  if (!command) return null;
  return {
    id,
    command: `/${id}`,
    label: command.label,
    prompt: command.prompt,
    rest: str(match[2]).trim(),
  };
}

module.exports = {
  TUTOR_ROLES,
  TUTOR_COMMANDS,
  normalizeTutorRole,
  tutorRole,
  roleInstruction,
  commandReference,
  parseTutorCommand,
};
