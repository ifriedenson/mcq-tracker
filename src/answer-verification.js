"use strict";
/*
 * Blind answer verification.
 *
 * The checker sees the question and choices but never the stored answer or
 * explanation, so it cannot simply agree with the key. The returned letter is
 * compared with the key already in the note. Nothing is written here.
 */
const { str } = require("./util");
const { parseChoiceSet } = require("./answer-types");

const VERIFICATION_MODES = ["mark", "drop"];

function normalizeVerificationMode(value) {
  return str(value).trim().toLowerCase() === "drop" ? "drop" : "mark";
}

function buildBlindVerificationPrompt(data) {
  const d = data || {};
  const choices = Array.isArray(d.choices) ? d.choices : [];
  if (!choices.length) {
    return {
      system:
        "You are an independent exam answer checker. Solve the question yourself. " +
        "Do not assume any answer is correct and do not ask for the answer key. Return only JSON.",
      user: [
        "QUESTION:",
        str(d.question).trim(),
        "",
        'Return {"answer":"42","confidence":"high|medium|low","reason":"one short sentence"}.',
        "Answer with the value only, without units or explanation.",
      ].join("\n"),
    };
  }
  const multiple = d.multiple === true;
  return {
    system:
      "You are an independent exam answer checker. Solve the question yourself from the question and choices. " +
      "Do not assume any answer is correct and do not ask for the answer key. Return only JSON.",
    user: [
      "QUESTION:",
      str(d.question).trim(),
      "",
      "CHOICES:",
      ...choices.map((choice, index) => {
        const letter = str(choice && choice.letter ? choice.letter : "ABCDEFGH"[index]).trim().toUpperCase();
        const text = choice && choice.text !== undefined ? choice.text : choice;
        return `${letter}. ${str(text).trim()}`;
      }),
      "",
      multiple
        ? 'Return {"answer":"A, C","confidence":"high|medium|low","reason":"one short sentence"}.'
        : 'Return {"answer":"B","confidence":"high|medium|low","reason":"one short sentence"}.',
      multiple ? "Use every letter that applies, separated by commas." : "Use exactly one letter from A to the last choice.",
    ].join("\n"),
  };
}

/** Read the first usable letter answer from a model reply, tolerating fences and a short preface. */
function parseBlindVerification(reply) {
  const text = str(reply)
    .replace(/```(?:json|javascript|js)?/gi, "")
    .replace(/```/g, "")
    .trim();
  let answer = "";
  const json = /\{[\s\S]*\}/.exec(text);
  if (json) {
    try {
      const parsed = JSON.parse(json[0]);
      answer = str(parsed && parsed.answer).trim().toUpperCase().slice(0, 1);
    } catch (e) {
      /* fall through to a plain letter */
    }
  }
  if (!/^[A-H]$/.test(answer)) {
    const match = /\b(?:answer|correct answer)\s*(?:is|:)?\s*([A-H])\b/i.exec(text);
    answer = match ? match[1].toUpperCase() : "";
  }
  const confidence = (/\b(high|medium|low)\b/i.exec(text) || [])[1];
  return { answer, confidence: confidence ? confidence.toLowerCase() : "", raw: text };
}

/** Read a select-all answer as a set of letters. */
function parseBlindVerificationSet(reply) {
  const text = str(reply)
    .replace(/```(?:json|javascript|js)?/gi, "")
    .replace(/```/g, "")
    .trim();
  let answer = [];
  const json = /\{[\s\S]*\}/.exec(text);
  if (json) {
    try {
      const parsed = JSON.parse(json[0]);
      const raw = parsed && parsed.answer;
      if (Array.isArray(raw)) answer = parseChoiceSet(raw);
      else answer = parseChoiceSet(raw);
    } catch (e) {
      /* fall through */
    }
  }
  if (!answer.length) {
    const match = /\b(?:answer|correct answer)\s*(?:is|:)?\s*([A-H](?:\s*[,;/&]\s*[A-H])*)/i.exec(text);
    if (match) answer = parseChoiceSet(match[1]);
  }
  return [...new Set(answer)].sort();
}

/** Read a numeric answer from JSON or a short plain reply. */
function parseBlindVerificationNumber(reply) {
  const text = str(reply)
    .replace(/```(?:json|javascript|js)?/gi, "")
    .replace(/```/g, "")
    .trim();
  let raw = "";
  const json = /\{[\s\S]*\}/.exec(text);
  if (json) {
    try {
      const parsed = JSON.parse(json[0]);
      raw = str(parsed && parsed.answer).trim();
    } catch (e) {
      /* fall through */
    }
  }
  if (!raw) {
    const match = /-?\d+(?:\.\d+)?/.exec(text);
    raw = match ? match[0] : "";
  }
  const value = Number(raw.replace(/[^0-9+-.eE]/g, ""));
  return Number.isFinite(value) ? value : null;
}

/**
 * The models the extra checks use, from a saved array or a typed list (one per
 * line, or comma separated). At most three, deduplicated, so a vote cannot be
 * three copies of the same model by accident.
 */
function normalizePanelModels(value) {
  const raw = Array.isArray(value) ? value : str(value).split(/[\r\n,]+/);
  const out = [];
  for (const item of raw) {
    const model = str(item).trim().slice(0, 200);
    if (!model || out.includes(model)) continue;
    out.push(model);
    if (out.length >= 3) break;
  }
  return out;
}

/**
 * Every model this device already knows about, for the extra-check pickers:
 * the provider's fetched list, the models saved for other AI features, the
 * models already chosen here, then an optional saved value of its own. A
 * picker built from this cannot introduce a typo.
 */
function panelModelChoices(source) {
  const s = source || {};
  const out = [];
  const seen = new Set();
  const add = (raw) => {
    const model = str(raw).trim().slice(0, 200);
    if (!model || seen.has(model)) return;
    seen.add(model);
    out.push(model);
  };
  for (const id of Array.isArray(s.fetched) ? s.fetched : []) add(id);
  for (const id of Array.isArray(s.features) ? s.features : []) add(id);
  for (const id of normalizePanelModels(s.saved)) add(id);
  add(s.own);
  return out;
}

/** The model for one extra check: the list repeats until the panel is full. */
function panelModelFor(models, index) {
  const list = Array.isArray(models) ? models : [];
  if (!list.length) return "";
  const at = Math.max(0, Number(index) || 0) % list.length;
  return str(list[at]).trim();
}

/**
 * Final verdict when one disagreement was put to more blind checks. The stored
 * key needs a real majority of the checks that answered; a panel that settles
 * on one other answer is reported as that answer so the warning can name it;
 * anything else stays a mismatch for review. `votes` is how many checks
 * answered, so the note can say how much checking it took.
 */
function consensusVerdict(votes, fallback) {
  const base = fallback || {};
  const key = str(base.key).trim();
  const answered = (Array.isArray(votes) ? votes : []).map((vote) => str(vote && vote.answer).trim()).filter(Boolean);
  const total = answered.length;
  const forKey = answered.filter((answer) => answer === key).length;
  const tally = new Map();
  for (const answer of answered) {
    if (answer === key) continue;
    tally.set(answer, (tally.get(answer) || 0) + 1);
  }
  const [topAnswer, topVotes] = [...tally.entries()].sort((a, b) => b[1] - a[1])[0] || ["", 0];
  const out = { ...base, method: "consensus", votes: total };
  if (total >= 2 && forKey >= 2 && forKey > total / 2) {
    return { ...out, status: "match", match: true, answer: key, confidence: "consensus" };
  }
  if (topVotes >= 2 && topVotes > total / 2) {
    return { ...out, status: "mismatch", match: false, answer: topAnswer, confidence: "consensus" };
  }
  return { ...out, status: "mismatch", match: false, answer: str(base.answer).trim() };
}

/** The properties recorded after a check. `verified` is false for a mismatch or an unfinished check. */
function verificationFields(verification) {
  const v = verification || {};
  const out = {
    verified: v.status === "match",
    verified_by: str(v.model).trim() || "AI",
    verified_on: str(v.date).trim(),
    verification: str(v.status).trim() || "unchecked",
  };
  const answer = str(v.answer).trim();
  if (answer) out.verified_answer = v.method === "computed" ? answer : answer.toUpperCase();
  if (str(v.method).trim()) out.verification_method = str(v.method).trim();
  return out;
}

/** A visible warning block for a disagreement or an unfinished check. */
function verificationBanner(verification) {
  const v = verification || {};
  if (v.status === "review") {
    return (
      "> [!warning] Answer checks disagree\n" +
      `> The AI check chose ${str(v.ai_answer).trim() || "a different answer"}, while the calculation gives ${str(v.answer).trim() || "a value"}. This note is marked for review.\n\n`
    );
  }
  if (v.status === "mismatch") {
    if (v.method === "computed") {
      return (
        "> [!warning] Calculation check failed\n" +
        `> A calculation gives ${str(v.answer).trim() || "a different value"}, but this note's answer is ${str(v.key).trim() || "not set"}. This note is marked for review.\n\n`
      );
    }
    if (v.method === "consensus" && Number(v.votes) >= 2) {
      return (
        "> [!warning] Answer check failed\n" +
        `> The answer check ran ${Number(v.votes)} times and most passes chose ${str(v.answer).trim() || "a different answer"}, while this note's answer is ${str(v.key).trim() || "not set"}. This note is marked for review.\n\n`
      );
    }
    return (
      "> [!warning] Answer check failed\n" +
      `> An independent AI pass chose ${str(v.answer).trim() || "a different answer"}, but this note's answer is ${str(v.key).trim() || "not set"}. This note is marked for review.\n\n`
    );
  }
  if (v.status === "error") {
    if (v.method === "computed") {
      return (
        "> [!warning] Calculation check did not finish\n" +
        `> ${str(v.error).trim() || "The calculation could not be evaluated."} This note has not been checked by calculation.\n\n`
      );
    }
    return (
      "> [!warning] Answer check did not finish\n" +
      `> ${str(v.error).trim() || "The independent check could not complete."} This note has not been checked against a second answer.\n\n`
    );
  }
  return "";
}

/** Removes an earlier verification banner without touching an AI-generated notice. */
function stripVerificationBanner(text) {
  return str(text).replace(/^> \[!warning\] (?:Answer checks disagree|(?:Answer|Calculation) check (?:failed|did not finish))[^\n]*(?:\n>[^\n]*)*\n*/m, "");
}

/** Places a verification banner directly after the YAML, replacing an older one. */
function addVerificationBanner(text, verification) {
  const clean = stripVerificationBanner(text);
  const banner = verificationBanner(verification);
  if (!banner) return clean;
  const front = /^---\n[\s\S]*?\n---\n*/.exec(clean);
  if (front) return clean.slice(0, front[0].length) + banner + clean.slice(front[0].length).replace(/^\n+/, "");
  return banner + clean;
}

module.exports = {
  VERIFICATION_MODES,
  consensusVerdict,
  normalizePanelModels,
  panelModelChoices,
  panelModelFor,
  addVerificationBanner,
  buildBlindVerificationPrompt,
  normalizeVerificationMode,
  parseBlindVerification,
  parseBlindVerificationNumber,
  parseBlindVerificationSet,
  stripVerificationBanner,
  verificationBanner,
  verificationFields,
};
