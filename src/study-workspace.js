"use strict";
/*
 * Local study-workflow data for the MIT-plugin parity rows that do not belong
 * in Practice, Cards, Calendar or Assignments. The implementations here are
 * original and dependency-free; no third-party source is copied.
 */
const { hashString, localDate, str } = require("./util");
const { addDays, dayValue } = require("./study-tools");
const { fencedQuizBlocks, parseQuizBlock } = require("./quiz-block");

const MAX_TEXT = 12000;
const MAX_TITLE = 200;
const MAX_FEYNMAN = 100;
const MAX_EXCERPTS = 500;
const MAX_SUBJECTS = 80;
const MAX_ABSENCES = 500;
const MAX_PLANS = 80;
const MAX_TOPICS = 80;
const MAX_QUIZ_ROWS = 500;
const MAX_GRADES = 500;
const MAX_TASKS = 500;
const MAX_ANNOTATIONS = 500;
const MAX_SOCRATIC = 100;
const MAX_VOCAB = 1000;
const VOCAB_LADDER = [1, 3, 7, 21, 60, 120];

const FEYNMAN_STEPS = ["Explain it simply", "Find the gaps", "Simplify and connect", "Teach it back"];
const FEYNMAN_KEYS = ["explain", "gaps", "simplify", "teach"];
const FEYNMAN_DIMENSIONS = ["clarity", "accuracy", "simplicity"];
const FLOW_STATUSES = ["inbox", "review", "understood"];
const RECALL_MODES = ["headings", "fragments"];
const SOCRATIC_STEPS = [
  { key: "clarify", title: "Clarify the claim", prompt: "State the idea in one sentence. What exactly are you trying to understand?" },
  { key: "assumptions", title: "Surface assumptions", prompt: "What must already be true for this idea to work? Which assumptions are weakest?" },
  { key: "evidence", title: "Find the evidence", prompt: "What observation, example or source would support this? What would contradict it?" },
  { key: "counterexample", title: "Test a counterexample", prompt: "Invent a case where the idea breaks. What does that case reveal?" },
  { key: "synthesis", title: "Synthesize", prompt: "Explain the idea again, including the boundary you found and how you would teach it." },
];

function enabledValue(value) {
  if (value === false) return false;
  if (value === true) return true;
  if (value && typeof value === "object" && value.enabled === false) return false;
  return true;
}

function textValue(value, max) {
  return str(value).replace(/\r\n?/g, "\n").trim().slice(0, max || MAX_TEXT);
}

function numberValue(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, Math.round(value)));
}

function idFor(prefix, parts) {
  return `${prefix}-${hashString(parts.join("|"))}`;
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

/* ---- Feynman Learning ---------------------------------------------------- */

function normalizeFeynmanScores(value) {
  const source = asObject(value);
  const out = {};
  for (const key of FEYNMAN_DIMENSIONS) out[key] = clamp(numberValue(source[key], 0), 0, 5);
  return out;
}

function normalizeFeynmanSession(value) {
  const source = asObject(value);
  const topic = textValue(source.topic, MAX_TITLE);
  if (!topic) return null;
  const answers = {};
  const rawAnswers = asObject(source.answers);
  for (let i = 0; i < FEYNMAN_KEYS.length; i++) {
    const key = FEYNMAN_KEYS[i];
    answers[key] = textValue(rawAnswers[key] || source[key], MAX_TEXT);
  }
  const step = clamp(numberValue(source.step, 0), 0, FEYNMAN_STEPS.length);
  const completed = source.completed === true || step >= FEYNMAN_STEPS.length;
  return {
    id: str(source.id).trim().slice(0, 160) || idFor("feynman", [topic, source.course || "", source.createdAt || 0]),
    topic,
    course: textValue(source.course, MAX_TITLE),
    step: completed ? FEYNMAN_STEPS.length : step,
    answers,
    scores: normalizeFeynmanScores(source.scores),
    completed,
    createdAt: Math.max(0, Math.round(numberValue(source.createdAt, 0))),
    updatedAt: Math.max(0, Math.round(numberValue(source.updatedAt, 0))),
  };
}

function normalizeFeynmanSettings(value) {
  const source = asObject(value);
  const sessions = [];
  const seen = new Set();
  for (const raw of Array.isArray(source.sessions) ? source.sessions : []) {
    const session = normalizeFeynmanSession(raw);
    if (!session || seen.has(session.id)) continue;
    seen.add(session.id);
    sessions.push(session);
    if (sessions.length >= MAX_FEYNMAN) break;
  }
  return { enabled: enabledValue(value), sessions };
}

function createFeynmanSession(input, now) {
  const source = asObject(input);
  const topic = textValue(source.topic, MAX_TITLE);
  if (!topic) return null;
  const stamp = Math.max(0, Math.round(numberValue(now, Date.now())));
  return normalizeFeynmanSession({
    ...source,
    id: idFor("feynman", [topic, source.course || "", stamp]),
    createdAt: stamp,
    updatedAt: stamp,
  });
}

function feynmanAverage(scores) {
  const values = FEYNMAN_DIMENSIONS.map((key) => Number(scores && scores[key]) || 0).filter((value) => value > 0);
  if (!values.length) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function feynmanWeakPoints(scores) {
  return FEYNMAN_DIMENSIONS.filter((key) => Number(scores && scores[key]) > 0 && Number(scores[key]) <= 3);
}

function feynmanStepKey(step) {
  return FEYNMAN_KEYS[clamp(numberValue(step, 0), 0, FEYNMAN_KEYS.length - 1)];
}

/* ---- Study Flow ---------------------------------------------------------- */

function normalizeFlowStatus(value) {
  const status = str(value).trim().toLowerCase();
  return FLOW_STATUSES.includes(status) ? status : "inbox";
}

function normalizeFlowExcerpt(value) {
  const source = asObject(value);
  const quote = textValue(source.quote, MAX_TEXT);
  if (!quote) return null;
  return {
    id: str(source.id).trim().slice(0, 160) || idFor("excerpt", [source.sourcePath || "", quote, source.createdAt || 0]),
    sourcePath: textValue(source.sourcePath, 500),
    quote,
    understanding: textValue(source.understanding, MAX_TEXT),
    card: textValue(source.card, MAX_TEXT),
    status: normalizeFlowStatus(source.status),
    createdAt: Math.max(0, Math.round(numberValue(source.createdAt, 0))),
    reviewedAt: Math.max(0, Math.round(numberValue(source.reviewedAt, 0))),
  };
}

function normalizeStudyFlow(value) {
  const source = asObject(value);
  const excerpts = [];
  const seen = new Set();
  for (const raw of Array.isArray(source.excerpts) ? source.excerpts : []) {
    const excerpt = normalizeFlowExcerpt(raw);
    if (!excerpt || seen.has(excerpt.id)) continue;
    seen.add(excerpt.id);
    excerpts.push(excerpt);
    if (excerpts.length >= MAX_EXCERPTS) break;
  }
  return { enabled: enabledValue(value), excerpts };
}

function createFlowExcerpt(input, now) {
  const source = asObject(input);
  const quote = textValue(source.quote, MAX_TEXT);
  if (!quote) return null;
  const stamp = Math.max(0, Math.round(numberValue(now, Date.now())));
  return normalizeFlowExcerpt({
    ...source,
    id: idFor("excerpt", [source.sourcePath || "", quote, stamp]),
    createdAt: stamp,
  });
}

function flowStats(excerpts) {
  const list = Array.isArray(excerpts) ? excerpts : [];
  return {
    total: list.length,
    inbox: list.filter((entry) => entry.status === "inbox").length,
    review: list.filter((entry) => entry.status === "review").length,
    understood: list.filter((entry) => entry.status === "understood").length,
    withCards: list.filter((entry) => str(entry.card).trim()).length,
  };
}

/* ---- Subject Manager ----------------------------------------------------- */

function normalizeSubject(value) {
  const source = asObject(value);
  const name = textValue(source.name, MAX_TITLE);
  if (!name) return null;
  const color = /^#[0-9a-f]{6}$/i.test(str(source.color).trim()) ? str(source.color).trim().toLowerCase() : "#7c9cf5";
  return {
    id: str(source.id).trim().slice(0, 160) || idFor("subject", [name]),
    name,
    folder: textValue(source.folder, 500).replace(/^\/+|\/+$/g, ""),
    color,
    notes: textValue(source.notes, MAX_TEXT),
    createdAt: Math.max(0, Math.round(numberValue(source.createdAt, 0))),
  };
}

function normalizeAbsence(value) {
  const source = asObject(value);
  const subject = textValue(source.subject, MAX_TITLE);
  const date = dayValue(source.date);
  if (!subject || !date) return null;
  return {
    id: str(source.id).trim().slice(0, 160) || idFor("absence", [subject, date, source.reason || ""]),
    subject,
    date,
    reason: textValue(source.reason, MAX_TITLE),
    createdAt: Math.max(0, Math.round(numberValue(source.createdAt, 0))),
  };
}

function normalizeSubjectManager(value) {
  const source = asObject(value);
  const subjects = [];
  const absences = [];
  const seen = new Set();
  for (const raw of Array.isArray(source.subjects) ? source.subjects : []) {
    const subject = normalizeSubject(raw);
    if (!subject || seen.has(subject.id)) continue;
    seen.add(subject.id);
    subjects.push(subject);
    if (subjects.length >= MAX_SUBJECTS) break;
  }
  const absenceKeys = new Set();
  for (const raw of Array.isArray(source.absences) ? source.absences : []) {
    const absence = normalizeAbsence(raw);
    if (!absence || absenceKeys.has(absence.id)) continue;
    absenceKeys.add(absence.id);
    absences.push(absence);
    if (absences.length >= MAX_ABSENCES) break;
  }
  return { enabled: enabledValue(value), subjects, absences };
}

function createSubject(input, now) {
  const subject = normalizeSubject(input);
  if (!subject) return null;
  return { ...subject, createdAt: Math.max(0, Math.round(numberValue(now, Date.now()))) };
}

function createAbsence(input, now) {
  const absence = normalizeAbsence(input);
  if (!absence) return null;
  return { ...absence, createdAt: Math.max(0, Math.round(numberValue(now, Date.now()))) };
}

function subjectSummary(subjects, absences, lectures) {
  const lectureList = Array.isArray(lectures) ? lectures : [];
  const absenceList = Array.isArray(absences) ? absences : [];
  return (Array.isArray(subjects) ? subjects : []).map((subject) => {
    const key = str(subject.name).trim().toLowerCase();
    const subjectLectures = lectureList.filter((lecture) => str(lecture.course).trim().toLowerCase() === key);
    const subjectAbsences = absenceList
      .filter((absence) => str(absence.subject).trim().toLowerCase() === key)
      .sort((a, b) => b.date.localeCompare(a.date));
    return {
      ...subject,
      lectures: subjectLectures.length,
      lastLecture: subjectLectures.slice().sort((a, b) => b.date.localeCompare(a.date))[0] || null,
      absences: subjectAbsences.length,
      lastAbsence: subjectAbsences[0] || null,
    };
  });
}

/* ---- Topic planner (Lerntracker-style) ---------------------------------- */

function normalizeTopic(value, index) {
  const source = asObject(value);
  const name = textValue(source.name, MAX_TITLE);
  if (!name) return null;
  const targetPasses = clamp(numberValue(source.targetPasses, 3), 1, 20);
  return {
    id: str(source.id).trim().slice(0, 160) || idFor("topic", [name, index || 0]),
    name,
    passes: clamp(numberValue(source.passes, 0), 0, targetPasses),
    targetPasses,
  };
}

function normalizePlan(value) {
  const source = asObject(value);
  const course = textValue(source.course, MAX_TITLE);
  if (!course) return null;
  const topics = [];
  const seen = new Set();
  for (const raw of Array.isArray(source.topics) ? source.topics : []) {
    const topic = normalizeTopic(raw, topics.length);
    if (!topic || seen.has(topic.id)) continue;
    seen.add(topic.id);
    topics.push(topic);
    if (topics.length >= MAX_TOPICS) break;
  }
  return {
    id: str(source.id).trim().slice(0, 160) || idFor("plan", [course, source.examDate || "", source.createdAt || 0]),
    course,
    examDate: dayValue(source.examDate),
    bufferDays: clamp(numberValue(source.bufferDays, 2), 0, 60),
    targetPasses: clamp(numberValue(source.targetPasses, 3), 1, 20),
    topics,
    createdAt: Math.max(0, Math.round(numberValue(source.createdAt, 0))),
  };
}

function normalizePlanner(value) {
  const source = asObject(value);
  const plans = [];
  const seen = new Set();
  for (const raw of Array.isArray(source.plans) ? source.plans : []) {
    const plan = normalizePlan(raw);
    if (!plan || seen.has(plan.id)) continue;
    seen.add(plan.id);
    plans.push(plan);
    if (plans.length >= MAX_PLANS) break;
  }
  return { enabled: enabledValue(value), plans };
}

function createPlannerPlan(input, now) {
  const source = asObject(input);
  if (!textValue(source.course, MAX_TITLE)) return null;
  const stamp = Math.max(0, Math.round(numberValue(now, Date.now())));
  const topics = (Array.isArray(source.topics) ? source.topics : [])
    .map((topic, index) => normalizeTopic(typeof topic === "string" ? { name: topic } : topic, index))
    .filter(Boolean);
  return normalizePlan({
    ...source,
    id: idFor("plan", [source.course, source.examDate || "", stamp]),
    targetPasses: source.targetPasses,
    topics: topics.map((topic) => ({ ...topic, targetPasses: source.targetPasses || topic.targetPasses })),
    createdAt: stamp,
  });
}

function planProgress(plan) {
  const topics = Array.isArray(plan && plan.topics) ? plan.topics : [];
  if (!topics.length) return { passes: 0, target: 0, percent: 0, complete: false };
  const passes = topics.reduce((sum, topic) => sum + (Number(topic.passes) || 0), 0);
  const target = topics.reduce((sum, topic) => sum + (Number(topic.targetPasses) || plan.targetPasses || 1), 0);
  return { passes, target, percent: target ? Math.max(0, Math.min(100, Math.round((passes / target) * 100))) : 0, complete: passes >= target };
}

function daysBetween(start, end) {
  const a = dayValue(start);
  const b = dayValue(end);
  if (!a || !b) return 0;
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((new Date(by, bm - 1, bd) - new Date(ay, am - 1, ad)) / 86400000);
}

/**
 * Allocate the remaining topic passes to the days before the exam, leaving the
 * configured buffer untouched. One topic pass is scheduled per study day; if
 * there are more passes than days, the earliest topics repeat on later days.
 */
function allocatePlan(plan, today) {
  const source = plan && typeof plan === "object" ? plan : {};
  const start = dayValue(today) || localDate();
  const exam = dayValue(source.examDate);
  const buffer = clamp(numberValue(source.bufferDays, 0), 0, 60);
  const topics = (Array.isArray(source.topics) ? source.topics : []).map((topic) => ({
    name: str(topic.name).trim(),
    remaining: Math.max(0, (Number(topic.targetPasses) || 1) - (Number(topic.passes) || 0)),
  })).filter((topic) => topic.name && topic.remaining > 0);
  const studyEnd = exam ? addDays(exam, -buffer) : "";
  const days = [];
  if (exam && studyEnd && studyEnd >= start) {
    let cursor = 0;
    for (let day = start; day <= studyEnd; day = addDays(day, 1)) {
      let picked = "";
      for (let tries = 0; tries < topics.length; tries++) {
        const candidate = topics[cursor % topics.length];
        cursor++;
        if (candidate.remaining > 0) {
          picked = candidate.name;
          candidate.remaining--;
          break;
        }
      }
      if (!picked && !topics.some((topic) => topic.remaining > 0)) break;
      days.push({ date: day, topics: picked ? [picked] : [] });
    }
  }
  return {
    start,
    studyEnd,
    examDate: exam,
    bufferDays: buffer,
    daysLeft: exam ? Math.max(0, daysBetween(start, exam)) : 0,
    studyDays: days.filter((day) => day.topics.length).length,
    days,
    remaining: topics.reduce((sum, topic) => sum + topic.remaining, 0),
    complete: topics.length === 0 && !!exam,
  };
}

function planSummary(plan, today) {
  const allocation = allocatePlan(plan, today);
  const progress = planProgress(plan);
  return {
    ...allocation,
    ...progress,
    course: str(plan && plan.course),
    examDate: str(plan && plan.examDate),
    nextDay: allocation.days.find((day) => day.topics.length) || null,
  };
}

/* ---- Recall Scheduler ---------------------------------------------------- */

function normalizeRecallReviews(value) {
  const source = asObject(value);
  const out = {};
  for (const [key, raw] of Object.entries(source)) {
    const state = asObject(raw);
    const due = dayValue(state.due);
    if (!key || !due) continue;
    out[key] = {
      due,
      interval: clamp(numberValue(state.interval, 1), 1, 3650),
      reviews: Math.max(0, Math.round(numberValue(state.reviews, 0))),
      last: dayValue(state.last) || "",
    };
  }
  return out;
}

function normalizeRecallScheduler(value) {
  const source = asObject(value);
  const mode = RECALL_MODES.includes(str(source.mode).trim().toLowerCase()) ? str(source.mode).trim().toLowerCase() : "headings";
  return {
    enabled: enabledValue(value),
    mode,
    folder: textValue(source.folder, 500).replace(/^\/+|\/+$/g, ""),
    limit: clamp(numberValue(source.limit, 20), 1, 100),
    reviews: normalizeRecallReviews(source.reviews),
  };
}

function stripFrontmatter(text) {
  return str(text).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

function parseRecallUnits(text, filePath, mode) {
  const kind = RECALL_MODES.includes(mode) ? mode : "headings";
  const body = stripFrontmatter(text).replace(/\r\n?/g, "\n");
  const cleanPath = str(filePath).trim();
  const units = [];
  if (kind === "headings") {
    const lines = body.split("\n");
    const sections = [];
    let current = null;
    for (const line of lines) {
      const match = line.match(/^(#{1,3})\s+(.+?)\s*#*\s*$/);
      if (match) {
        if (current) sections.push(current);
        current = { title: match[2].replace(/[*_`]/g, "").trim(), lines: [] };
      } else if (current) {
        current.lines.push(line);
      }
    }
    if (current) sections.push(current);
    for (let index = 0; index < sections.length; index++) {
      const section = sections[index];
      const sectionBody = section.lines.join("\n").trim();
      if (section.title.length < 3 || sectionBody.length < 20) continue;
      units.push({
        key: `recall-${hashString([cleanPath, kind, section.title, index].join("|"))}`,
        path: cleanPath,
        kind,
        title: section.title.slice(0, MAX_TITLE),
        body: sectionBody.slice(0, MAX_TEXT),
      });
    }
    return units;
  }
  const blocks = body.split(/\n{2,}/);
  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index].trim();
    if (block.length < 40 || /^#{1,6}\s/.test(block) || /^```/.test(block)) continue;
    const firstLine = block.split("\n")[0].replace(/^[-*+]\s+/, "").replace(/[*_`]/g, "").trim();
    units.push({
      key: `recall-${hashString([cleanPath, kind, firstLine, index].join("|"))}`,
      path: cleanPath,
      kind,
      title: (firstLine || "Fragment").slice(0, MAX_TITLE),
      body: block.slice(0, MAX_TEXT),
    });
  }
  return units;
}

function recallDueUnits(units, reviews, today) {
  const day = dayValue(today) || localDate();
  return (Array.isArray(units) ? units : [])
    .filter((unit) => {
      const state = reviews && reviews[unit.key];
      return !state || !state.due || state.due <= day;
    })
    .sort((a, b) => {
      const ad = (reviews && reviews[a.key] && reviews[a.key].due) || "";
      const bd = (reviews && reviews[b.key] && reviews[b.key].due) || "";
      if (ad !== bd) return ad.localeCompare(bd);
      return a.title.localeCompare(b.title);
    });
}

function reviewRecallUnit(unit, grade, today) {
  const key = str(unit && unit.key).trim();
  if (!key) return null;
  const day = dayValue(today) || localDate();
  const value = ["again", "hard", "good", "easy"].includes(str(grade).toLowerCase()) ? str(grade).toLowerCase() : "good";
  const previous = arguments[3] && typeof arguments[3] === "object" ? arguments[3] : {};
  const current = Number(previous.interval) || 1;
  const ladder = [1, 3, 7, 21, 60, 120];
  let interval = 1;
  if (value === "hard") interval = Math.max(1, current);
  else if (value === "good") interval = ladder[Math.min(ladder.length - 1, Math.max(0, ladder.indexOf(current)) + 1)] || 3;
  else if (value === "easy") interval = ladder[Math.min(ladder.length - 1, Math.max(0, ladder.indexOf(current)) + 2)] || 7;
  return {
    key,
    due: addDays(day, interval),
    interval,
    reviews: Math.max(0, Number(previous.reviews) || 0) + 1,
    last: day,
  };
}

function recallStats(reviews, today) {
  const day = dayValue(today) || localDate();
  const values = Object.values(reviews && typeof reviews === "object" ? reviews : {});
  return {
    tracked: values.length,
    due: values.filter((state) => !state.due || state.due <= day).length,
    learned: values.filter((state) => Number(state.reviews) > 0).length,
  };
}

function normalizeQuizIndex(value) {
  const source = asObject(value);
  return {
    enabled: enabledValue(value),
    folder: textValue(source.folder, 500).replace(/^\/+|\/+$/g, ""),
    limit: clamp(numberValue(source.limit, 50), 1, 200),
  };
}

function quizResult(value) {
  if (!value || typeof value !== "object") return null;
  const percentage = clamp(numberValue(value.percentage, 0), 0, 100);
  return {
    percentage,
    passed: value.passed === true,
    score: Math.max(0, Math.round(numberValue(value.score, 0))),
    totalPoints: Math.max(0, Math.round(numberValue(value.totalPoints, 0))),
  };
}

/** Scan parsed notes for quiz blocks and the existing opt-in quizResults data. */
function collectQuizIndex(entries, options) {
  const opts = options && typeof options === "object" ? options : {};
  const limit = clamp(numberValue(opts.limit, 50), 1, 200);
  const rows = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    const path = str(entry && entry.path).trim();
    const text = str(entry && entry.text);
    if (!path || !text) continue;
    const fm = asObject(entry.fm);
    const blocks = [...fencedQuizBlocks(text), ...fencedQuizBlocks(text, "quiz-definition")];
    for (let index = 0; index < blocks.length; index++) {
      let parsed;
      try {
        parsed = parseQuizBlock(blocks[index]);
      } catch (e) {
        continue;
      }
      if (!parsed.questions.length) continue;
      const id = str(parsed.id).trim() || `untitled-${rows.length + 1}`;
      const levels = {};
      const types = {};
      for (const question of parsed.questions) {
        const level = str(question.level).trim() || "Unlevelled";
        const type = str(question.type).trim() || "choice";
        levels[level] = (levels[level] || 0) + 1;
        types[type] = (types[type] || 0) + 1;
      }
      rows.push({
        path,
        id,
        title: str(parsed.questions[0].question).slice(0, 160),
        count: parsed.questions.length,
        levels,
        types,
        result: quizResult(fm.quizResults && fm.quizResults[id]),
      });
      if (rows.length >= MAX_QUIZ_ROWS) break;
    }
    if (rows.length >= MAX_QUIZ_ROWS) break;
  }
  const results = rows.map((row) => row.result).filter(Boolean);
  const levels = {};
  const types = {};
  for (const row of rows) {
    for (const [key, count] of Object.entries(row.levels)) levels[key] = (levels[key] || 0) + count;
    for (const [key, count] of Object.entries(row.types)) types[key] = (types[key] || 0) + count;
  }
  return {
    rows: rows.slice(0, limit),
    stats: {
      quizzes: rows.length,
      questions: rows.reduce((sum, row) => sum + row.count, 0),
      withResults: results.length,
      passed: results.filter((result) => result.passed).length,
      average: results.length ? Math.round(results.reduce((sum, result) => sum + result.percentage, 0) / results.length) : 0,
      levels,
      types,
    },
  };
}


/* ---- Course hub (Hold Course-style dashboard) --------------------------- */

function normalizeGrade(value) {
  const source = asObject(value);
  const course = textValue(source.course, MAX_TITLE);
  const title = textValue(source.title, MAX_TITLE);
  if (!course || !title) return null;
  const weight = numberValue(source.weight, 1);
  return {
    id: str(source.id).trim().slice(0, 160) || idFor("grade", [course, title, source.date || "", source.score || 0]),
    course,
    title,
    score: clamp(numberValue(source.score, 0), 0, 100),
    weight: Math.round(Math.max(0.1, Math.min(100, weight)) * 100) / 100,
    date: dayValue(source.date),
    createdAt: Math.max(0, Math.round(numberValue(source.createdAt, 0))),
  };
}

function normalizeCourseHub(value) {
  const source = asObject(value);
  const grades = [];
  const seen = new Set();
  for (const raw of Array.isArray(source.grades) ? source.grades : []) {
    const grade = normalizeGrade(raw);
    if (!grade || seen.has(grade.id)) continue;
    seen.add(grade.id);
    grades.push(grade);
    if (grades.length >= MAX_GRADES) break;
  }
  return { enabled: enabledValue(value), grades };
}

function createGrade(input, now) {
  const source = asObject(input);
  const stamp = Math.max(0, Math.round(numberValue(now, Date.now())));
  return normalizeGrade({ ...source, createdAt: stamp });
}

function letterGrade(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return "—";
  if (value >= 90) return "A";
  if (value >= 80) return "B";
  if (value >= 70) return "C";
  if (value >= 60) return "D";
  return "F";
}

/** Combine the independent subject, lecture and grade data without writing any of it back. */
function courseDashboard(subjects, lectures, absences, grades) {
  const courses = new Map();
  const ensure = (name) => {
    const key = str(name).trim().toLowerCase();
    if (!key) return null;
    if (!courses.has(key)) courses.set(key, { name: str(name).trim(), color: "#7c9cf5", folder: "", grades: [] });
    return courses.get(key);
  };
  for (const subject of Array.isArray(subjects) ? subjects : []) {
    const course = ensure(subject && subject.name);
    if (!course) continue;
    course.color = /^#[0-9a-f]{6}$/i.test(str(subject.color)) ? str(subject.color).toLowerCase() : course.color;
    course.folder = str(subject.folder);
  }
  const lectureList = Array.isArray(lectures) ? lectures : [];
  const absenceList = Array.isArray(absences) ? absences : [];
  for (const lecture of lectureList) ensure(lecture && lecture.course);
  for (const grade of Array.isArray(grades) ? grades : []) {
    const course = ensure(grade && grade.course);
    if (course) course.grades.push(grade);
  }
  return [...courses.values()].map((course) => {
    const key = course.name.toLowerCase();
    const ownLectures = lectureList.filter((lecture) => str(lecture.course).trim().toLowerCase() === key);
    const ownAbsences = absenceList.filter((absence) => str(absence.subject).trim().toLowerCase() === key);
    const ownGrades = course.grades.slice().sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.createdAt - a.createdAt);
    const weight = ownGrades.reduce((sum, grade) => sum + grade.weight, 0);
    const weighted = weight ? Math.round((ownGrades.reduce((sum, grade) => sum + grade.score * grade.weight, 0) / weight) * 10) / 10 : 0;
    return {
      ...course,
      lectures: ownLectures.length,
      absences: ownAbsences.length,
      lastLecture: ownLectures.slice().sort((a, b) => b.date.localeCompare(a.date))[0] || null,
      lastAbsence: ownAbsences.slice().sort((a, b) => b.date.localeCompare(a.date))[0] || null,
      grades: ownGrades,
      graded: ownGrades.length,
      weighted,
      letter: ownGrades.length ? letterGrade(weighted) : "—",
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

/* ---- Study tasks (Better Task-style planning and local reminders) -------- */

function normalizeStudyTask(value) {
  const source = asObject(value);
  const title = textValue(source.title, MAX_TITLE);
  if (!title) return null;
  return {
    id: str(source.id).trim().slice(0, 160) || idFor("task", [title, source.course || "", source.due || "", source.createdAt || 0]),
    title,
    course: textValue(source.course, MAX_TITLE),
    due: dayValue(source.due),
    done: source.done === true,
    source: textValue(source.source, 40) || "manual",
    createdAt: Math.max(0, Math.round(numberValue(source.createdAt, 0))),
  };
}

function normalizeStudyTasks(value) {
  const source = asObject(value);
  const tasks = [];
  const seen = new Set();
  for (const raw of Array.isArray(source.tasks) ? source.tasks : []) {
    const task = normalizeStudyTask(raw);
    if (!task || seen.has(task.id)) continue;
    seen.add(task.id);
    tasks.push(task);
    if (tasks.length >= MAX_TASKS) break;
  }
  return { enabled: enabledValue(value), tasks };
}

function createStudyTask(input, now) {
  const source = asObject(input);
  const stamp = Math.max(0, Math.round(numberValue(now, Date.now())));
  return normalizeStudyTask({ ...source, createdAt: stamp });
}

/** Generate one task per topic pass and spread them evenly before the exam. */
function planExamTasks(input, today, now) {
  const source = asObject(input);
  const course = textValue(source.course, MAX_TITLE);
  const exam = dayValue(source.examDate);
  const start = dayValue(source.startDate) || dayValue(today) || localDate();
  if (!course || !exam || exam <= start) return [];
  const rawTopics = Array.isArray(source.topics) ? source.topics : str(source.topics).split(/\n|,/);
  const topics = rawTopics.map((topic) => textValue(typeof topic === "string" ? topic : topic && topic.name, MAX_TITLE)).filter(Boolean);
  if (!topics.length) return [];
  const passes = clamp(numberValue(source.passes, 2), 1, 3);
  const last = addDays(exam, -1);
  const days = [];
  for (let day = start; day && day <= last; day = addDays(day, 1)) days.push(day);
  if (!days.length) return [];
  const total = Math.min(MAX_TASKS, topics.length * passes);
  const tasks = [];
  const stamp = Math.max(0, Math.round(numberValue(now, Date.now())));
  for (let index = 0; index < total; index++) {
    const pass = Math.floor(index / topics.length) + 1;
    const topic = topics[index % topics.length];
    const due = days[Math.min(days.length - 1, Math.floor((index * days.length) / total))];
    tasks.push(normalizeStudyTask({
      title: passes === 1 ? `Study ${topic}` : `Study ${topic} (pass ${pass})`,
      course,
      due,
      source: "exam",
      createdAt: stamp + index,
    }));
  }
  return tasks.filter(Boolean);
}

function taskSummary(tasks, today) {
  const day = dayValue(today) || localDate();
  const list = Array.isArray(tasks) ? tasks : [];
  const open = list.filter((task) => !task.done).sort((a, b) => (a.due || "9999-12-31").localeCompare(b.due || "9999-12-31") || a.createdAt - b.createdAt);
  return {
    total: list.length,
    open: open.length,
    done: list.length - open.length,
    overdue: open.filter((task) => task.due && task.due < day).length,
    dueToday: open.filter((task) => task.due === day).length,
    upcoming: open.filter((task) => !task.due || task.due > day).length,
    next: open[0] || null,
  };
}

function dueStudyTasks(tasks, today) {
  const day = dayValue(today) || localDate();
  return (Array.isArray(tasks) ? tasks : [])
    .filter((task) => !task.done && task.due && task.due <= day)
    .sort((a, b) => a.due.localeCompare(b.due) || a.createdAt - b.createdAt);
}

/* ---- Selection annotations (Pick Me-style note index) ------------------- */

function normalizeAnnotation(value) {
  const source = asObject(value);
  const quote = textValue(source.quote, MAX_TEXT);
  if (!quote) return null;
  return {
    id: str(source.id).trim().slice(0, 160) || idFor("annotation", [source.sourcePath || "", quote, source.createdAt || 0]),
    sourcePath: textValue(source.sourcePath, 500),
    quote,
    question: textValue(source.question, MAX_TEXT),
    answer: textValue(source.answer, MAX_TEXT),
    createdAt: Math.max(0, Math.round(numberValue(source.createdAt, 0))),
  };
}

function normalizeAnnotations(value) {
  const source = asObject(value);
  const annotations = [];
  const seen = new Set();
  for (const raw of Array.isArray(source.annotations) ? source.annotations : []) {
    const annotation = normalizeAnnotation(raw);
    if (!annotation || seen.has(annotation.id)) continue;
    seen.add(annotation.id);
    annotations.push(annotation);
    if (annotations.length >= MAX_ANNOTATIONS) break;
  }
  return { enabled: enabledValue(value), annotations };
}

function createAnnotation(input, now) {
  const source = asObject(input);
  const stamp = Math.max(0, Math.round(numberValue(now, Date.now())));
  return normalizeAnnotation({ ...source, createdAt: stamp });
}

/* ---- Deep Notes (guided Socratic sessions) ----------------------------- */

function normalizeDeepNotesSession(value) {
  const source = asObject(value);
  const topic = textValue(source.topic, MAX_TITLE);
  if (!topic) return null;
  const answers = {};
  const rawAnswers = asObject(source.answers);
  for (const step of SOCRATIC_STEPS) answers[step.key] = textValue(rawAnswers[step.key] || source[step.key], MAX_TEXT);
  const step = clamp(numberValue(source.step, 0), 0, SOCRATIC_STEPS.length);
  const completed = source.completed === true || step >= SOCRATIC_STEPS.length;
  return {
    id: str(source.id).trim().slice(0, 160) || idFor("socratic", [topic, source.createdAt || 0]),
    topic,
    course: textValue(source.course, MAX_TITLE),
    step: completed ? SOCRATIC_STEPS.length : step,
    answers,
    completed,
    createdAt: Math.max(0, Math.round(numberValue(source.createdAt, 0))),
    updatedAt: Math.max(0, Math.round(numberValue(source.updatedAt, 0))),
  };
}

function normalizeDeepNotes(value) {
  const source = asObject(value);
  const sessions = [];
  const seen = new Set();
  for (const raw of Array.isArray(source.sessions) ? source.sessions : []) {
    const session = normalizeDeepNotesSession(raw);
    if (!session || seen.has(session.id)) continue;
    seen.add(session.id);
    sessions.push(session);
    if (sessions.length >= MAX_SOCRATIC) break;
  }
  return { enabled: enabledValue(value), sessions };
}

function createDeepNotesSession(input, now) {
  const source = asObject(input);
  const topic = textValue(source.topic, MAX_TITLE);
  if (!topic) return null;
  const stamp = Math.max(0, Math.round(numberValue(now, Date.now())));
  return normalizeDeepNotesSession({ ...source, id: idFor("socratic", [topic, source.course || "", stamp]), createdAt: stamp, updatedAt: stamp });
}

function deepNotesStepKey(step) {
  return SOCRATIC_STEPS[clamp(numberValue(step, 0), 0, SOCRATIC_STEPS.length - 1)].key;
}


/* ---- Retention forecast (read-only Retain-style view) ------------------ */

function retentionForecast(cards, options) {
  const opts = options && typeof options === "object" ? options : {};
  const today = dayValue(opts.today) || localDate();
  const days = clamp(numberValue(opts.days, 30), 1, 90);
  const list = (Array.isArray(cards) ? cards : []).filter((card) => card && card.fm);
  const forecast = [];
  const counts = new Map();
  for (let offset = 0; offset < days; offset++) {
    const date = addDays(today, offset);
    forecast.push({ date, count: 0 });
    counts.set(date, 0);
  }
  const rows = [];
  let due = 0;
  let fresh = 0;
  let scheduled = 0;
  let overdue = 0;
  for (const card of list) {
    const fm = asObject(card.fm);
    const attempts = Math.max(0, Math.round(numberValue(fm.attempts, 0)));
    const rawDue = str(fm.next_review || fm.due).slice(0, 10);
    const cardDue = dayValue(rawDue);
    const isNew = attempts === 0;
    const isDue = isNew || !cardDue || cardDue <= today;
    if (isNew) fresh++;
    if (isDue) due++;
    if (!isNew && !isDue) scheduled++;
    if (cardDue && cardDue < today && !isNew) overdue++;
    if (isDue) {
      const key = today;
      counts.set(key, (counts.get(key) || 0) + 1);
    } else if (cardDue && counts.has(cardDue)) {
      counts.set(cardDue, (counts.get(cardDue) || 0) + 1);
    }
    rows.push({
      path: str(card.file && card.file.path),
      deck: str(card.deck) || "Unsorted",
      course: str(card.course),
      due: isDue ? today : cardDue,
      attempts,
      fresh: isNew,
    });
  }
  for (const entry of forecast) entry.count = counts.get(entry.date) || 0;
  return {
    total: list.length,
    due,
    fresh,
    scheduled,
    overdue,
    forecast,
    rows: rows.sort((a, b) => (a.due || "9999-12-31").localeCompare(b.due || "9999-12-31") || a.path.localeCompare(b.path)),
  };
}

/* ---- Vocabulary dictionary (FSRS Vocabulary-style local module) -------- */

function normalizeVocabWord(value) {
  const source = asObject(value);
  const term = textValue(source.term, MAX_TITLE);
  if (!term) return null;
  return {
    id: str(source.id).trim().slice(0, 160) || idFor("vocab", [term, source.definition || "", source.createdAt || 0]),
    term,
    definition: textValue(source.definition, MAX_TEXT),
    example: textValue(source.example, MAX_TEXT),
    language: textValue(source.language, MAX_TITLE),
    due: dayValue(source.due),
    interval: clamp(numberValue(source.interval, 0), 0, 3650),
    reviews: Math.max(0, Math.round(numberValue(source.reviews, 0))),
    last: dayValue(source.last),
    createdAt: Math.max(0, Math.round(numberValue(source.createdAt, 0))),
  };
}

function normalizeVocabulary(value) {
  const source = asObject(value);
  const words = [];
  const seen = new Set();
  for (const raw of Array.isArray(source.words) ? source.words : []) {
    const word = normalizeVocabWord(raw);
    if (!word || seen.has(word.id)) continue;
    seen.add(word.id);
    words.push(word);
    if (words.length >= MAX_VOCAB) break;
  }
  return { enabled: enabledValue(value), words };
}

function createVocabWord(input, now) {
  const source = asObject(input);
  const stamp = Math.max(0, Math.round(numberValue(now, Date.now())));
  return normalizeVocabWord({ ...source, createdAt: stamp });
}

/** Parse `term | definition | example` or `term :: definition` lines. */
function parseVocabLines(text) {
  const words = [];
  const issues = [];
  const lines = str(text).replace(/\r\n?/g, "\n").split("\n");
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    if (!line || line.startsWith("#")) continue;
    const parts = line.split(/\s*\|\s*|\s*::\s*/).map((part) => part.trim());
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      issues.push(`Line ${index + 1}: use term | definition.`);
      continue;
    }
    words.push({ term: parts[0], definition: parts[1], example: parts.slice(2).join(" | ") });
  }
  return { words, issues };
}

function reviewVocabWord(word, grade, today) {
  const previous = word && typeof word === "object" ? word : {};
  const key = str(previous.id).trim();
  if (!key) return null;
  const day = dayValue(today) || localDate();
  const value = ["again", "hard", "good", "easy"].includes(str(grade).toLowerCase()) ? str(grade).toLowerCase() : "good";
  const current = Number(previous.interval) || 0;
  let interval = 1;
  if (value === "hard") interval = Math.max(1, current);
  else if (value === "good") interval = VOCAB_LADDER[Math.min(VOCAB_LADDER.length - 1, Math.max(0, VOCAB_LADDER.indexOf(current) + 1))] || 1;
  else if (value === "easy") interval = VOCAB_LADDER[Math.min(VOCAB_LADDER.length - 1, Math.max(0, VOCAB_LADDER.indexOf(current) + 2))] || 3;
  return {
    ...previous,
    due: addDays(day, interval),
    interval,
    reviews: Math.max(0, Number(previous.reviews) || 0) + 1,
    last: day,
  };
}

function vocabSummary(words, today) {
  const day = dayValue(today) || localDate();
  const list = Array.isArray(words) ? words : [];
  return {
    total: list.length,
    due: list.filter((word) => !word.due || word.due <= day).length,
    fresh: list.filter((word) => !Number(word.reviews)).length,
    learned: list.filter((word) => Number(word.reviews) > 0).length,
  };
}

function normalizeRetention(value) {
  return { enabled: enabledValue(value) };
}

function normalizeStudyWorkspaceSettings(value) {
  const source = asObject(value);
  return {
    feynmanLearning: normalizeFeynmanSettings(source.feynmanLearning),
    recallScheduler: normalizeRecallScheduler(source.recallScheduler),
    lerntracker: normalizePlanner(source.lerntracker),
    studyFlow: normalizeStudyFlow(source.studyFlow),
    subjectManager: normalizeSubjectManager(source.subjectManager),
    quizIndex: normalizeQuizIndex(source.quizIndex),
    courseHub: normalizeCourseHub(source.courseHub),
    studyTasks: normalizeStudyTasks(source.studyTasks),
    annotations: normalizeAnnotations(source.annotations),
    deepNotes: normalizeDeepNotes(source.deepNotes),
    retention: normalizeRetention(source.retention),
    vocabulary: normalizeVocabulary(source.vocabulary),
  };
}

module.exports = {
  FEYNMAN_DIMENSIONS,
  FEYNMAN_KEYS,
  FEYNMAN_STEPS,
  FLOW_STATUSES,
  MAX_ABSENCES,
  MAX_EXCERPTS,
  MAX_ANNOTATIONS,
  MAX_FEYNMAN,
  MAX_GRADES,
  MAX_PLANS,
  MAX_SOCRATIC,
  MAX_TASKS,
  MAX_VOCAB,
  VOCAB_LADDER,
  MAX_QUIZ_ROWS,
  MAX_SUBJECTS,
  MAX_TOPICS,
  RECALL_MODES,
  SOCRATIC_STEPS,
  allocatePlan,
  collectQuizIndex,
  courseDashboard,
  createAbsence,
  createAnnotation,
  createDeepNotesSession,
  createFeynmanSession,
  createFlowExcerpt,
  createGrade,
  createPlannerPlan,
  createStudyTask,
  createSubject,
  createVocabWord,
  daysBetween,
  deepNotesStepKey,
  dueStudyTasks,
  letterGrade,
  normalizeVocabWord,
  normalizeVocabulary,
  feynmanAverage,
  feynmanStepKey,
  feynmanWeakPoints,
  flowStats,
  normalizeAnnotations,
  normalizeCourseHub,
  normalizeDeepNotes,
  normalizeDeepNotesSession,
  normalizeFeynmanSession,
  normalizeFeynmanSettings,
  normalizeFlowExcerpt,
  normalizeGrade,
  normalizePlanner,
  normalizeQuizIndex,
  normalizeRecallScheduler,
  normalizeRetention,
  normalizeStudyFlow,
  parseVocabLines,
  retentionForecast,
  reviewVocabWord,
  normalizeStudyTask,
  normalizeStudyTasks,
  normalizeStudyWorkspaceSettings,
  normalizeSubjectManager,
  parseRecallUnits,
  planExamTasks,
  planProgress,
  planSummary,
  recallDueUnits,
  recallStats,
  reviewRecallUnit,
  subjectSummary,
  taskSummary,
  vocabSummary,
};
