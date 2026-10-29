"use strict";
/*
 * Calendar domain model: class details, colors, visibility filters, date grids,
 * note templates and subject-to-folder mapping.
 *
 * Class-detail parsing, category detection and subject cleaning are ported and
 * modified from University Schedule and Calendar
 * (https://github.com/Cesemess/obsidian-uni-calendar, MIT, Copyright (c) 2026 Cesemess),
 * baseline commit 35778e473a1d7ad7827c83c065b0f61dcbefdbc5. Labels are English-first;
 * see NOTICES.md.
 */
const { dateKey, parseDateKey } = require("./calendar-ics");

const pad2 = (n) => String(n).padStart(2, "0");

const DEFAULT_NOTE_TEMPLATE = `---
subject: "{subject}"
course: "{subject}"
date: {date}
time: "{time}"
room: "{room}"
lecturer: "{lecturer}"
type: "{type}"
calendar_uid: {event_id}
calendar_date: {iso_date}
tags:
  - university
  - lecture-notes
---

# {subject}

> 📍 **Room:** {room} | 👤 **Lecturer:** {lecturer} | ⏰ **Time:** {time}

## Lecture Notes


## Questions to practice
- [ ]
`;

const CLASS_CATEGORIES = [
  { id: "wyklad", label: "Lecture", color: "#3b82f6" },
  { id: "cwiczenia", label: "Exercises", color: "#10b981" },
  { id: "laboratorium", label: "Lab", color: "#8b5cf6" },
  { id: "lektorat", label: "Language", color: "#06b6d4" },
  { id: "projekt", label: "Project", color: "#f59e0b" },
  { id: "seminarium", label: "Seminar", color: "#ec4899" },
  { id: "egzamin", label: "Exam", color: "#ef4444" },
  { id: "inne", label: "Other", color: "#6b7280" },
];

const CATEGORY_BY_ID = Object.fromEntries(CLASS_CATEGORIES.map((c) => [c.id, c]));

const BREAK_ICON_OPTIONS = [
  ["coffee", "☕ Coffee cup"],
  ["food", "🍔 Food / lunch"],
  ["pause", "⏸️ Pause"],
  ["hourglass", "⏳ Hourglass"],
  ["walk", "🚶 Walking"],
  ["book", "📖 Reading / book"],
  ["music", "🎵 Music"],
  ["sun", "☀️ Sun"],
  ["moon", "🌙 Moon"],
  ["spark", "✨ Sparkles"],
  ["battery", "🔋 Recharging"],
  ["clock", "⏰ Clock"],
  ["leaf", "🍃 Leaf"],
  ["smile", "😊 Relax"],
];
const BREAK_ICON_IDS = BREAK_ICON_OPTIONS.map(([id]) => id);
const BREAK_STYLES = ["pill", "line", "card", "text"];

const DEFAULT_CALENDAR_SETTINGS = {
  enabled: false, // calendar module is off by default
  sources: [], // { id, name, type: "file"|"url", path, url, content, hidden, lastSync }
  noteFolder: "",
  noteNameFormat: "{date} - {subject}",
  noteTemplate: DEFAULT_NOTE_TEMPLATE,
  cleanSubjectNames: true,
  firstDayOfWeek: "monday",
  timeFormat: "24h",
  dateFormat: "YYYY-MM-DD",
  excludedSubjects: [],
  excludedKeywords: [],
  subjectFolders: {},
  courses: [], // { id, name, code, folder, color, semester, instructor, credits }
  classColors: {},
  subjectColors: {},
  classNames: {},
  autoSync: false, // URL feeds are refreshed on startup only when this is on
  calendarMaxWidth: 0, // 0 fills the pane; a positive value centers a narrower calendar
  studySlotBufferMinutes: 5, // kept free before the next class in a study slot
  timelineGaps: {
    enabled: false, // breaks are opt-in, like the original calendar
    style: "pill", // pill | line | card | text
    icon: "coffee",
    minMinutes: 15,
    maxMinutes: 0, // 0 = no upper limit
  },
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = { monday: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], sunday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] };

const str = (v) => (v === undefined || v === null ? "" : String(v));
const subjectKey = (s) => str(s).trim().toLowerCase().replace(/\s+/g, " ");
const normalizeFolder = (p) => str(p).trim().replace(/^\/+|\/+$/g, "");
const COURSE_COLOR_RE = /^#[0-9a-f]{6}$/i;

/**
 * The course registry: one row per course the learner wants to keep. Names,
 * codes and folders stay readable, and credits are reused by Assignments when
 * that course has no explicit assignment credit setting.
 */
function normalizeCourseRegistry(value) {
  const out = [];
  const ids = new Set();
  for (const raw of Array.isArray(value) ? value : []) {
    const name = str(raw && raw.name).trim();
    const code = str(raw && raw.code).trim();
    if (!name && !code) continue;
    const base = (code || name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "course";
    let id = str(raw.id).trim() || base;
    let suffix = 2;
    while (ids.has(id)) id = `${base}-${suffix++}`;
    ids.add(id);
    const credits = Math.round(Number(raw.credits));
    out.push({
      id,
      name: name || code,
      code,
      folder: normalizeFolder(raw.folder),
      color: COURSE_COLOR_RE.test(str(raw.color).trim()) ? str(raw.color).trim().toLowerCase() : "",
      semester: str(raw.semester).trim(),
      instructor: str(raw.instructor).trim(),
      credits: Number.isFinite(credits) ? Math.max(0, Math.min(30, credits)) : 3,
    });
  }
  return out;
}

function registeredCourseKeys(course) {
  return [course && course.name, course && course.code, cleanSubjectTitle(course && course.name), cleanSubjectTitle(course && course.code)]
    .map(subjectKey)
    .filter(Boolean);
}

/** A course row by exact name/code, then by a code prefix such as `CHEM 101 - Lecture`. */
function findRegisteredCourse(settings, subject) {
  const key = subjectKey(subject);
  if (!key) return null;
  const clean = subjectKey(cleanSubjectTitle(subject));
  const courses = settings && Array.isArray(settings.courses) ? settings.courses : [];
  for (const course of courses) {
    if (registeredCourseKeys(course).some((candidate) => candidate === key || candidate === clean)) return course;
  }
  for (const course of courses) {
    const code = subjectKey(course.code);
    if (code && (key.startsWith(`${code} `) || key.startsWith(`${code}-`) || key.startsWith(`${code}:`))) return course;
  }
  return null;
}

function registeredCourseFolder(settings, subject) {
  const course = findRegisteredCourse(settings, subject);
  return course ? normalizeFolder(course.folder) : "";
}

function registeredCourseColor(settings, subject) {
  const course = findRegisteredCourse(settings, subject);
  return course && course.color ? course.color : "";
}

/** Merges saved settings into defaults without dropping new fields. */
function mergeCalendarSettings(saved) {
  const out = Object.assign({}, DEFAULT_CALENDAR_SETTINGS, saved && typeof saved === "object" ? saved : {});
  out.sources = (Array.isArray(out.sources) ? out.sources : [])
    .filter((s) => s && (s.type === "url" ? s.url : s.content))
    .map((s, i) => ({
      id: str(s.id) || `src${i}`,
      name: str(s.name) || (s.type === "url" ? "Calendar feed" : "Schedule file"),
      type: s.type === "url" ? "url" : "file",
      path: normalizeFolder(s.path),
      url: str(s.url),
      content: str(s.content),
      hidden: s.hidden === true,
      lastSync: Number(s.lastSync) || 0,
    }));
  out.excludedSubjects = (Array.isArray(out.excludedSubjects) ? out.excludedSubjects : []).map(str).filter(Boolean);
  out.excludedKeywords = (Array.isArray(out.excludedKeywords) ? out.excludedKeywords : []).map(str).filter(Boolean);
  out.subjectFolders = plainObject(out.subjectFolders);
  out.courses = normalizeCourseRegistry(out.courses);
  out.classColors = plainObject(out.classColors);
  out.subjectColors = plainObject(out.subjectColors);
  out.classNames = plainObject(out.classNames);
  const buffer = Math.round(Number(out.studySlotBufferMinutes));
  out.studySlotBufferMinutes = Number.isFinite(buffer) && buffer >= 0 && buffer <= 60 ? buffer : 5;
  const maxWidth = Math.round(Number(out.calendarMaxWidth));
  out.calendarMaxWidth = Number.isFinite(maxWidth) ? Math.max(0, Math.min(1600, maxWidth)) : 0;
  const gaps = out.timelineGaps && typeof out.timelineGaps === "object" ? out.timelineGaps : {};
  const gapMin = Math.round(Number(gaps.minMinutes));
  const gapMax = Math.round(Number(gaps.maxMinutes));
  out.timelineGaps = {
    enabled: gaps.enabled === true,
    style: BREAK_STYLES.includes(gaps.style) ? gaps.style : "pill",
    icon: BREAK_ICON_IDS.includes(gaps.icon) ? gaps.icon : "coffee",
    minMinutes: Number.isFinite(gapMin) && gapMin >= 1 ? gapMin : 15,
    maxMinutes: Number.isFinite(gapMax) && gapMax >= 0 ? gapMax : 0,
  };
  if (!WEEKDAYS[out.firstDayOfWeek]) out.firstDayOfWeek = "monday";
  if (!["24h", "12h"].includes(out.timeFormat)) out.timeFormat = "24h";
  if (!["YYYY-MM-DD", "DD.MM.YYYY", "DD/MM/YYYY", "MM/DD/YYYY"].includes(out.dateFormat)) out.dateFormat = "YYYY-MM-DD";
  if (!out.noteNameFormat.trim()) out.noteNameFormat = DEFAULT_CALENDAR_SETTINGS.noteNameFormat;
  if (!out.noteTemplate.trim()) out.noteTemplate = DEFAULT_NOTE_TEMPLATE;
  return out;
}

function plainObject(v) {
  const out = {};
  if (v && typeof v === "object" && !Array.isArray(v)) {
    for (const [k, val] of Object.entries(v)) if (str(val).trim()) out[k] = str(val).trim();
  }
  return out;
}

/** Values placed into a note template; `{course}` is the same as `{subject}`. */
function noteVariables(settings, event, key) {
  const details = event.details || parseClassDetails(event.summary, event.description, event.location);
  const rawSubject = str(event.summary) || "Class";
  const subject = settings.cleanSubjectNames ? cleanSubjectTitle(rawSubject) : rawSubject;
  const registered = findRegisteredCourse(settings, rawSubject);
  const allDay = event.allDay === true;
  const start = event.dtstart ? formatTime(settings, event.dtstart) : "";
  const end = event.dtend ? formatTime(settings, event.dtend) : "";
  return {
    subject,
    course: subject,
    course_name: registered ? registered.name : subject,
    course_code: registered ? registered.code : "",
    semester: registered ? registered.semester : "",
    credits: registered ? registered.credits : "",
    date: formatDateValue(settings.dateFormat, key),
    iso_date: key,
    time: allDay ? "All day" : end ? `${start}–${end}` : start,
    time_start: allDay ? "" : start,
    time_end: allDay ? "" : end,
    room: str(details.room),
    lecturer: str(details.lecturer) || (registered ? registered.instructor : ""),
    instructor: str(details.lecturer) || (registered ? registered.instructor : ""),
    type: classTypeLabel(settings, details.category),
    description: str(event.description),
    event_id: str(event.uid),
  };
}

/** Replaces `{token}` placeholders. Values lose newlines and double quotes so YAML stays valid. */
function renderNoteTemplate(template, vars) {
  return str(template).replace(/\{(\w+)\}/g, (match, token) => {
    const key = token.toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(vars, key)) return match;
    return str(vars[key]).replace(/\r?\n/g, " ").replace(/"/g, "'");
  });
}

function noteFileName(settings, event, key) {
  const vars = noteVariables(settings, event, key);
  const safe = { ...vars };
  for (const k of Object.keys(safe)) safe[k] = sanitizeFileName(safe[k], "");
  const name = sanitizeFileName(renderNoteTemplate(settings.noteNameFormat || "{date} - {subject}", safe), `${key} - ${vars.subject}`);
  return `${name || key}.md`;
}

function noteContent(settings, event, key) {
  const text = renderNoteTemplate(settings.noteTemplate || DEFAULT_NOTE_TEMPLATE, noteVariables(settings, event, key));
  return text.endsWith("\n") ? text : `${text}\n`;
}

/** Strips characters Obsidian (and Windows) reject in a file name. */
function sanitizeFileName(name, fallback) {
  const clean = str(name)
    .replace(/[\\/:*?"<>|#^[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 120)
    .trim();
  return clean || str(fallback);
}

function formatDateValue(format, key) {
  const d = parseDateKey(key) || new Date();
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  if (format === "DD.MM.YYYY") return `${day}.${m}.${y}`;
  if (format === "DD/MM/YYYY") return `${day}/${m}/${y}`;
  if (format === "MM/DD/YYYY") return `${m}/${day}/${y}`;
  return `${y}-${m}-${day}`;
}

function formatTime(settings, date) {
  if (!date) return "";
  const minutes = pad2(date.getMinutes());
  if (settings.timeFormat === "12h") {
    const hours = date.getHours();
    return `${hours % 12 || 12}:${minutes} ${hours < 12 ? "AM" : "PM"}`;
  }
  return `${pad2(date.getHours())}:${minutes}`;
}

function classTypeLabel(settings, category) {
  const id = str(category) || "inne";
  const custom = (settings.classNames || {})[id];
  if (str(custom).trim()) return str(custom).trim();
  if (id.endsWith("_egzamin")) {
    const base = CATEGORY_BY_ID[id.replace(/_egzamin$/, "")];
    return `${base ? base.label : "Other"} (exam)`;
  }
  return (CATEGORY_BY_ID[id] || CATEGORY_BY_ID.inne).label;
}

/* --------------------------------------------------------- class details */

const LECTURER_LABELS = ["Lecturer", "Instructor", "Professor", "Teacher", "Dozent", "Lehrende", "Enseignant", "Docente", "Преподаватель", "Лектор", "教师", "老师", "讲师", "担当教員", "講師", "교수", "강사", "Prowadzący", "Wykładowca"];
const ROOM_LABELS = ["Room", "Location", "Hall", "Building", "Venue", "Raum", "Gebäude", "Hörsaal", "Salle", "Bâtiment", "Amphi", "Aula", "Edificio", "Lugar", "Аудитория", "Корпус", "Кабинет", "教室", "地点", "教学楼", "講義室", "場所", "강의실", "장소", "Sala", "Miejsce", "Budynek"];
const REMARK_LABELS = ["Remarks", "Notes", "Info", "Hinweise", "Anmerkungen", "Remarques", "Informations", "Notas", "Observaciones", "Note", "Примечания", "备注", "说明", "備考", "비고", "Uwagi", "Notatki"];
const GROUP_LABELS = ["Group", "Groups", "Section", "Gruppe", "Groupe", "Grupo", "Gruppo", "Группа", "组", "班级", "グループ", "분반", "그룹", "Grupa", "Grupy"];

/** Reads `Lecturer: A. Smith` / `Room - 204` style lines from an event description. */
function extractLabelValue(text, labels) {
  const lines = str(text).split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    for (const label of labels) {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`^${escaped}(?:[:\\s–—-]+|$)`, "i");
      if (re.test(line)) {
        const value = line.replace(re, "").trim();
        if (value) return value;
      }
    }
  }
  return "";
}

const hasAny = (text, needles) => needles.some((n) => text.includes(n));

function detectCategory(group, text) {
  if (hasAny(group, ["lekt", "lang", "sprach"]) || hasAny(text, ["lektorat", "language course", "foreign language", "sprachkurs", "cours de langue", "curso de idiomas", "lingua straniera", "иностранный язык", "外语", "語学", "어학"])) return "lektorat";
  if (hasAny(group, ["wyk", "lec", "vorl"]) || hasAny(text, ["wykład", "lecture", "vorlesung", "cours magistral", "clase magistral", "lezione", "лекция", "讲座", "理论课", "講義", "강의"])) return "wyklad";
  if (hasAny(group, ["lab", "prac", "prak"]) || /\blab\b/.test(text) || hasAny(text, ["laboratorium", "laboratory", "praktikum", "laboratorio", "лабораторная", "实验", "実習", "실습"])) return "laboratorium";
  if (hasAny(group, ["ćw", "cw", "ex", "tut", "üb"]) || hasAny(text, ["ćwiczenia", "exercises", "tutorial", "übung", "travaux dirigés", "prácticas", "esercitazione", "практика", "习题", "演習", "연습"])) return "cwiczenia";
  if (hasAny(group, ["sem"]) || hasAny(text, ["seminarium", "seminar", "séminaire", "seminario", "研讨", "ゼミ", "세미나"])) return "seminarium";
  if (hasAny(group, ["proj"]) || hasAny(text, ["projekt", "project", "projet", "proyecto", "progetto", "проект", "项目", "プロジェクト", "프로젝트"])) return "projekt";
  return "inne";
}

const EXAM_WORDS = ["egzamin", "kolokwium", "zaliczenie", "exam", "midterm", "final", "klausur", "prüfung", "examen", "partiel", "esame", "prova", "экзамен", "зачет", "сессия", "考试", "期末", "期中", "試験", "テスト", "시험", "중간고사", "기말고사"];

function detectExam(text) {
  if (hasAny(text, EXAM_WORDS)) return true;
  return /\btest\b/.test(text);
}

/**
 * Class details from an event: who teaches it, where, which kind of class it is and
 * whether it is an exam. The category ids match the upstream plugin so colors and
 * custom labels keep the same meaning.
 */
function parseClassDetails(summary, description, location) {
  const desc = str(description);
  const text = `${str(summary)} ${desc}`.toLowerCase();
  const group = extractLabelValue(desc, GROUP_LABELS).toLowerCase();
  const lecturer = extractLabelValue(desc, LECTURER_LABELS);
  let room = str(location).trim();
  if (!room) room = extractLabelValue(desc, ROOM_LABELS);
  const remarks = extractLabelValue(desc, REMARK_LABELS);
  if (!room && remarks) room = remarks;
  let category = detectCategory(group, text);
  const isExam = detectExam(`${text} ${remarks.toLowerCase()}`);
  if (isExam) {
    if (category === "lektorat") category = "lektorat_egzamin";
    else if (category === "inne") category = "egzamin";
    else if (category !== "egzamin") category = `${category}_egzamin`;
  }
  return { lecturer, room, group, remarks, category, isExam };
}

const CLEAN_SUBJECT_PATTERNS = [
  /^(egzamin(\s+poprawkowy)?|kolokwium|zaliczenie|exam|retake\s+exam|klausur|prüfung|examen|partiel|test)\s*[:\-–—]\s*/gi,
  /\s*-\s*(I|II|III|1|2|3)\s*(termin|term|prüfungstermin)$/gi,
  /\s*\((wyk(ład)?|lec(ture)?|vorlesung|vl|cm)\)/gi,
  /\s*\((lab(oratorium|oratory)?|praktikum|pr|tp)\)/gi,
  /\s*\((ćw(iczenia)?|cw(iczenia)?|ex(ercises)?|tut(orial)?|übung|ue|üb|td)\)/gi,
  /\s*\((lekt(orat)?|lang(uage)?|sprachkurs)\)/gi,
  /\s*\((proj(ekt|ect)?|projet)\)/gi,
  /\s*\((sem(inarium|inar)?|séminaire)\)/gi,
  /\s*\[[WwLlCcPpSsEe]\]/g,
  /\s*-\s*(wykład|ćwiczenia|laboratorium|projekt|seminarium|lektorat|egzamin|kolokwium|zaliczenie|lecture|laboratory|exercises|tutorial|seminar|project|exam|vorlesung|übung|praktikum|klausur|cours|travaux\s+dirigés|travaux\s+pratiques|examen)/gi,
];

/** "Matematyka (WYK)" -> "Matematyka"; falls back to the raw title when nothing is left. */
function cleanSubjectTitle(rawTitle) {
  const raw = str(rawTitle).trim();
  if (!raw) return "";
  let cleaned = raw;
  for (const re of CLEAN_SUBJECT_PATTERNS) cleaned = cleaned.replace(re, "");
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
  return cleaned || raw;
}

function classColor(settings, details, subject) {
  const registered = registeredCourseColor(settings, subject);
  if (registered) return registered;
  const category = str(details && details.category) || "inne";
  const byCategory = (settings.classColors || {})[category];
  if (byCategory) return byCategory;
  const base = category.replace(/_egzamin$/, "");
  if ((settings.classColors || {})[base]) return settings.classColors[base];
  const bySubject = (settings.subjectColors || {})[subjectKey(subject)];
  if (bySubject) return bySubject;
  return (CATEGORY_BY_ID[base] || CATEGORY_BY_ID.inne).color;
}

function isExamEvent(event) {
  if (event.isExam === true) return true;
  const details = event.details || parseClassDetails(event.summary, event.description, event.location);
  return details.isExam;
}

/* -------------------------------------------------------------- filtering */

/** Removes excluded subjects and keyword-matching events. Hidden sources are removed earlier. */
function visibleEvents(settings, events) {
  const excluded = new Set((settings.excludedSubjects || []).map(subjectKey).filter(Boolean));
  const words = (settings.excludedKeywords || []).map((k) => str(k).toLowerCase().trim()).filter(Boolean);
  return (events || []).filter((ev) => {
    const subject = str(ev.summary);
    if (excluded.has(subjectKey(subject)) || excluded.has(subjectKey(cleanSubjectTitle(subject)))) return false;
    if (!words.length) return true;
    const haystack = `${subject} ${str(ev.description)} ${str(ev.location)}`.toLowerCase();
    return !words.some((w) => haystack.includes(w));
  });
}

function eventsOnDay(events, key) {
  return (events || []).filter((ev) => ev.dateKey === key).sort((a, b) => a.dtstart - b.dtstart);
}

/* ----------------------------------------------------------- month layout */

/** Six weeks of cells; `firstDay` is "monday" or "sunday". */
function monthGrid(year, month, firstDay, today) {
  const start = new Date(year, month, 1);
  const offset = firstDay === "sunday" ? start.getDay() : (start.getDay() + 6) % 7;
  const todayKey = dateKey(today || new Date());
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(year, month, 1 - offset + i);
    const key = dateKey(d);
    cells.push({ date: d, key, day: d.getDate(), inMonth: d.getMonth() === month, isToday: key === todayKey });
  }
  return cells;
}

function weekdayLabels(firstDay) {
  return (WEEKDAYS[firstDay] || WEEKDAYS.monday).slice();
}

function monthLabel(year, month) {
  return `${MONTHS[month]} ${year}`;
}

/** `Wednesday, October 23, 2026`, the date heading the original calendar uses. */
function dayHeading(key) {
  const d = parseDateKey(key);
  if (!d) return key;
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return `${names[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** `1h 30m`, `1h` or `45m`, the label the original break marker uses. */
function gapLabel(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours > 0) return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
  return `${rest}m`;
}

/**
 * Free periods between timed classes, from the end of one class to the start of the
 * next. Overlapping classes are merged so their shared time is not counted twice;
 * all-day events and days with fewer than two timed classes have no free periods.
 * `minMinutes` and `maxMinutes` only filter the returned slots (0 means no limit).
 */
function freeSlots(events, options) {
  const opts = options || {};
  const minMinutes = Math.max(0, Math.round(Number(opts.minMinutes) || 0));
  const maxMinutes = Math.max(0, Math.round(Number(opts.maxMinutes) || 0));
  const timed = (Array.isArray(events) ? events : [])
    .filter((ev) => !ev.allDay && ev.dtstart && ev.dtend && typeof ev.dtstart.getTime === "function" && typeof ev.dtend.getTime === "function")
    .map((ev) => [ev.dtstart.getTime(), ev.dtend.getTime()])
    .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end > start)
    .sort((a, b) => a[0] - b[0]);
  if (timed.length < 2) return [];

  const slots = [];
  let currentEnd = timed[0][1];
  for (let i = 1; i < timed.length; i++) {
    const [start, end] = timed[i];
    if (start <= currentEnd) {
      currentEnd = Math.max(currentEnd, end);
      continue;
    }
    const minutes = Math.round((start - currentEnd) / 60000);
    if (minutes > 0 && minutes >= minMinutes && (maxMinutes === 0 || minutes <= maxMinutes)) {
      slots.push({ start: new Date(currentEnd), end: new Date(start), minutes });
    }
    currentEnd = end;
  }
  return slots;
}

/** Total unbooked minutes between the first and last timed class of the day. */
function dayFreeMinutes(events) {
  return freeSlots(events).reduce((total, slot) => total + slot.minutes, 0);
}

/**
 * Interleaves break entries with events for one day. The free periods come from the
 * same `freeSlots` engine as the header total; the settings only decide which of
 * those periods are drawn as markers.
 */
function timelineEntries(events, settings) {
  const list = (Array.isArray(events) ? events.slice() : []).sort((a, b) => {
    if (a.allDay && !b.allDay) return -1;
    if (!a.allDay && b.allDay) return 1;
    const at = a.dtstart && typeof a.dtstart.getTime === "function" ? a.dtstart.getTime() : 0;
    const bt = b.dtstart && typeof b.dtstart.getTime === "function" ? b.dtstart.getTime() : 0;
    return at - bt;
  });
  const gaps = (settings && settings.timelineGaps) || {};
  const enabled = gaps.enabled === true;
  const minMinutes = Math.max(1, Math.round(Number(gaps.minMinutes) || 15));
  const maxMinutes = Math.max(0, Math.round(Number(gaps.maxMinutes) || 0));
  const slots = enabled ? freeSlots(list, { minMinutes, maxMinutes }) : [];
  const slotByEnd = new Map(slots.map((slot) => [slot.end.getTime(), slot]));
  const entries = [];

  for (const event of list) {
    const start = event.dtstart && typeof event.dtstart.getTime === "function" ? event.dtstart : null;
    if (!event.allDay && start) {
      const slot = slotByEnd.get(start.getTime());
      if (slot) {
        slotByEnd.delete(start.getTime());
        entries.push({ kind: "gap", start: slot.start, end: slot.end, minutes: slot.minutes, nextEvent: event });
      }
    }
    entries.push({ kind: "event", event });
  }
  return entries;
}

/* ------------------------------------------------------------- countdowns */

function byStart(a, b) {
  return a.dtstart - b.dtstart;
}

/**
 * What the calendar should show at the top of the view: the class happening now,
 * otherwise the next one.
 */
function nextClassStatus(events, now) {
  const at = now || new Date();
  const timed = (events || []).filter((ev) => !ev.allDay && ev.dtstart && ev.dtend).sort(byStart);
  const ongoing = timed.find((ev) => ev.dtstart <= at && at < ev.dtend);
  if (ongoing) return { state: "ongoing", event: ongoing, startsInMs: 0, endsInMs: ongoing.dtend - at };
  const next = timed.find((ev) => ev.dtstart > at);
  if (!next) return { state: "none", event: null, startsInMs: 0, endsInMs: 0 };
  return { state: "next", event: next, startsInMs: next.dtstart - at, endsInMs: 0 };
}

/** "1 h 05 m", "12 min", "now". */
function humanizeDuration(ms) {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 1) return "less than a minute";
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${pad2(minutes % 60)} m`;
}

function examCountdown(event, now) {
  const at = now || new Date();
  const startOfToday = new Date(at.getFullYear(), at.getMonth(), at.getDate());
  const examDay = new Date(event.dtstart.getFullYear(), event.dtstart.getMonth(), event.dtstart.getDate());
  const days = Math.round((examDay - startOfToday) / (24 * 60 * 60 * 1000));
  if (days < 0) return "past";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

/** Future exams, soonest first, without duplicates from recurring feeds. */
function upcomingExams(events, now, limit) {
  const at = now || new Date();
  const start = new Date(at.getFullYear(), at.getMonth(), at.getDate());
  const seen = new Set();
  const out = [];
  for (const ev of (events || []).slice().sort(byStart)) {
    if (!ev.dtstart || ev.dtstart < start || !isExamEvent(ev)) continue;
    const key = `${subjectKey(ev.summary)}|${ev.dateKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ev);
    if (limit && out.length >= limit) break;
  }
  return out;
}

/** Whole-word/phrase test so "Calculus" does not also match "Precalculus". */
function containsPhrase(text, phrase) {
  const needle = str(phrase).trim();
  if (!needle) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(str(text));
}

/**
 * Whether an exam belongs to a course. Exam feeds usually name the course in
 * the summary ("Calculus - Final Exam"), but some use a short code or the
 * reverse order, so accept either side of the phrase.
 */
function examMatchesCourse(event, course) {
  const clean = cleanSubjectTitle(course);
  const key = subjectKey(clean);
  if (!key) return false;
  // "MATH 221 - Linear Algebra" should match an exam called "MATH 221 Final"
  // as well as one that uses the full course name.
  const parts = clean
    .split(/\s*[-–—:/]\s*/)
    .map((part) => subjectKey(part))
    .filter((part) => part.length >= 3);
  const keys = [...new Set([key, ...parts])];
  const names = [event.summary, event.course, event.subject].map((value) => subjectKey(value)).filter(Boolean);
  return names.some((name) => keys.some((candidate) => containsPhrase(name, candidate) || containsPhrase(candidate, name)));
}

/** The soonest future exam for a course, or null when the course is unknown/no exam is scheduled. */
function nextExamForCourse(events, course, now) {
  if (!subjectKey(course)) return null;
  return upcomingExams(events, now).find((event) => examMatchesCourse(event, course)) || null;
}

/**
 * The date an item should be brought forward to so it is reviewed before the
 * exam. This is the day before the exam, never earlier than the attempt day:
 * an exam today can only be reviewed today.
 */
function examReviewCap(event, now) {
  if (!event || !event.dtstart) return null;
  const at = now || new Date();
  const today = new Date(at.getFullYear(), at.getMonth(), at.getDate());
  const examDay = new Date(event.dtstart.getFullYear(), event.dtstart.getMonth(), event.dtstart.getDate());
  if (examDay < today) return null;
  const dayBefore = new Date(examDay.getFullYear(), examDay.getMonth(), examDay.getDate() - 1);
  const capDay = dayBefore < today ? today : dayBefore;
  return {
    date: dateKey(capDay),
    examDate: dateKey(examDay),
    name: str(event.summary).trim() || "Exam",
  };
}

/* ---------------------------------------------------- folder + note paths */

/**
 * Explicit subject mapping first, then a folder whose name matches the cleaned
 * subject (exact beats partial). Falls back to the configured note folder.
 */
function resolveSubjectFolder(settings, subject, folders, event) {
  const list = (folders || []).map(normalizeFolder).filter(Boolean);
  const key = subjectKey(subject);
  const clean = subjectKey(cleanSubjectTitle(subject));
  const registered = registeredCourseFolder(settings, subject);
  if (registered) return registered;
  for (const [mapped, folder] of Object.entries(settings.subjectFolders || {})) {
    if (subjectKey(mapped) === key || subjectKey(mapped) === clean) {
      const target = normalizeFolder(folder);
      if (target) return target; // the folder is created when the first note is written
    }
  }
  const base = normalizeFolder(settings.noteFolder);
  const scoped = base ? list.filter((f) => f === base || f.startsWith(`${base}/`)) : list;
  const pool = scoped.length ? scoped : list;
  let best = "";
  let bestScore = 0;
  for (const folder of pool) {
    const name = subjectKey(folder.split("/").pop());
    if (!name) continue;
    if (name === key || name === clean) return folder;
    if (clean.length >= 3 && name.length >= 3 && (name.includes(clean) || clean.includes(name))) {
      const score = Math.min(name.length, clean.length);
      if (score > bestScore) {
        bestScore = score;
        best = folder;
      }
    }
  }
  if (best) return best;
  return base;
}

module.exports = {
  DEFAULT_NOTE_TEMPLATE,
  DEFAULT_CALENDAR_SETTINGS,
  CLASS_CATEGORIES,
  BREAK_ICON_OPTIONS,
  MONTHS,
  subjectKey,
  normalizeFolder,
  normalizeCourseRegistry,
  findRegisteredCourse,
  registeredCourseFolder,
  registeredCourseColor,
  mergeCalendarSettings,
  noteVariables,
  renderNoteTemplate,
  noteFileName,
  noteContent,
  sanitizeFileName,
  formatDateValue,
  formatTime,
  classTypeLabel,
  extractLabelValue,
  parseClassDetails,
  cleanSubjectTitle,
  classColor,
  isExamEvent,
  visibleEvents,
  eventsOnDay,
  monthGrid,
  weekdayLabels,
  monthLabel,
  dayHeading,
  gapLabel,
  freeSlots,
  dayFreeMinutes,
  timelineEntries,
  nextClassStatus,
  humanizeDuration,
  examCountdown,
  upcomingExams,
  examMatchesCourse,
  nextExamForCourse,
  examReviewCap,
  resolveSubjectFolder,
};
