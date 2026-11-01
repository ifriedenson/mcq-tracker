"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const R = T.readAloud;
const L = T.lectureCompiler;
const H = T.courseHealth;
const B = T.audioBookmarks;

async function setup(saved) {
  const plugin = new QT(makeApp([]));
  if (saved) plugin.saved = saved;
  await plugin.onload();
  return plugin;
}

test("read aloud: normalizes style, rate and pitch and strips markup before speaking", () => {
  const settings = R.normalizeReadAloudSettings({ style: "briefing", rate: 9, pitch: -1 });
  assert.equal(settings.style, "briefing");
  assert.equal(settings.rate, 2);
  assert.equal(settings.pitch, 0.5);
  assert.equal(R.normalizeReadAloudSettings({ style: "nope" }).style, "full");
  const cleaned = R.stripForSpeech("---\ntags: bio\n---\n# Cells\n\nCells use `ATP` and [[Energy|energy]].\n\n```js\nconst x = 1;\n```\n");
  assert.doesNotMatch(cleaned, /tags: bio|const x|# Cells/);
  assert.match(cleaned, /Cells use ATP and energy/);
  assert.match(cleaned, /energy/);
  assert.equal(R.splitSentences("One thing. Two things! Three?").length, 3);
  assert.equal(R.durationLabel(90), "1 min 30 s");
  assert.equal(R.durationLabel(20), "20 s");
  assert.equal(R.estimateSpeechSeconds("", 1), 0);
});

test("read aloud: a briefing keeps only the leading sentences and reports the cut", () => {
  const text = "First point. Second point. Third point. Fourth point.";
  const full = R.buildReadAloudPlan(text, { style: "full" });
  assert.equal(full.sentences.length, 4);
  assert.equal(full.truncated, false);
  const briefing = R.buildReadAloudPlan(text, { style: "briefing" });
  assert.equal(briefing.sentences.length, 4);
  const many = R.buildReadAloudPlan(Array.from({ length: 30 }, (_, i) => `Sentence number ${i + 1} is here.`).join(" "), { style: "briefing" });
  assert.equal(many.sentences.length, 14);
  assert.equal(many.truncated, true);
  assert.equal(many.total, 30);
  assert.ok(many.estimatedSeconds > 0);
});

test("lecture compiler: compiles one note with overview, concepts, vocabulary and sections", () => {
  const lectures = [
    { course: "Biology", date: "2026-10-02", title: "Respiration", topics: "Glycolysis; ATP: energy currency" },
    { course: "Biology", date: "2026-10-01", title: "Cells", topics: "Organelles, ATP: energy currency" },
  ];
  const compiled = L.compileLectureNote(lectures, { folder: "Lecture notes" });
  assert.ok(compiled);
  assert.equal(compiled.stats.lectures, 2);
  assert.equal(compiled.stats.courses, 1);
  assert.equal(compiled.stats.vocabulary, 1);
  assert.equal(compiled.stats.from, "2026-10-01");
  assert.equal(compiled.stats.to, "2026-10-02");
  assert.match(compiled.markdown, /# Biology lecture notes/);
  assert.match(compiled.markdown, /## Overview/);
  assert.match(compiled.markdown, /covered in 2 lectures/);
  assert.match(compiled.markdown, /\| ATP \| energy currency \|/);
  const firstSection = compiled.markdown.indexOf("### 2026-10-01 — Cells");
  const secondSection = compiled.markdown.indexOf("### 2026-10-02 — Respiration");
  assert.ok(firstSection > 0 && secondSection > firstSection);
  assert.match(compiled.fileTitle, /^Biology lecture notes 2026-10-02$/);
  assert.equal(L.compileLectureNote([], {}), null);
  assert.equal(L.compileLectureNote([{ course: "Biology" }], {}), null);
  assert.deepEqual(L.parseTopicList("A; B, C"), ["A", "B", "C"]);
  assert.deepEqual(L.splitConcept("ATP: energy currency"), { term: "ATP", detail: "energy currency" });
});

test("lecture compiler: section toggles remove the chosen parts and never overwrite titles", () => {
  const lectures = [{ course: "Chemistry", date: "2026-11-01", title: "Bonding", topics: "Ionic: transfer" }];
  const bare = L.compileLectureNote(lectures, { includeOverview: false, includeConcepts: false, includeVocabulary: false, includeSections: false });
  assert.doesNotMatch(bare.markdown, /## Overview|## Key concepts|## Vocabulary|## Lectures/);
  assert.match(bare.markdown, /# Chemistry lecture notes/);
  assert.equal(L.safeFileTitle('A/B: "C"'), "A-B- -C-");
  assert.equal(L.normalizeLectureCompilerSettings({ folder: " /Study/Notes/ " }).folder, "Study/Notes");
});

test("course health: flags missing grades, low attendance, overdue tasks and a close exam", () => {
  const courses = [
    { name: "Biology", lectures: 1, absences: 3, attendance: 25, graded: 0, folder: "" },
    { name: "Chemistry", lectures: 4, absences: 0, attendance: 100, graded: 2, folder: "Courses/Chem" },
  ];
  const report = H.courseHealthReport({
    courses,
    plans: [{ course: "Biology", examDate: "2026-11-05", targetPasses: 2, topics: [{ name: "Cells", targetPasses: 2, passes: 0 }] }],
    tasks: [{ course: "Biology", title: "Lab report", due: "2026-10-30", done: false }],
    today: "2026-11-01",
    attendanceThreshold: 75,
    examWindowDays: 14,
  });
  assert.equal(report.total, 2);
  const biology = report.rows.find((row) => row.name === "Biology");
  assert.equal(biology.status, "at-risk");
  const ids = biology.checks.map((check) => check.id);
  for (const id of ["grades", "attendance", "tasks", "exam", "folder"]) assert.ok(ids.includes(id), id);
  const chemistry = report.rows.find((row) => row.name === "Chemistry");
  assert.equal(chemistry.status, "good");
  assert.equal(report.atRisk, 1);
  assert.equal(report.good, 1);
  assert.equal(report.warnings, 4);
});

test("course health: clean data reports no issue and settings clamp", () => {
  const report = H.courseHealthReport({
    courses: [{ name: "Math", lectures: 5, absences: 0, attendance: 100, graded: 3, folder: "Courses/Math" }],
    plans: [],
    tasks: [{ course: "Math", title: "Done", due: "2026-10-01", done: true }],
    today: "2026-11-01",
  });
  assert.equal(report.rows[0].status, "good");
  assert.deepEqual(report.rows[0].checks.map((check) => check.id), ["clear"]);
  const settings = H.normalizeCourseHealthSettings({ attendanceThreshold: 400, examWindowDays: 0, minSessions: 99 });
  assert.equal(settings.attendanceThreshold, 100);
  assert.equal(settings.examWindowDays, 1);
  assert.equal(settings.minSessions, 50);
  assert.equal(H.daysBetween("2026-11-01", "2026-11-05"), 4);
});

test("audio bookmarks: parses and formats timestamps, links and chapters", () => {
  assert.equal(B.parseTimestamp("1:23"), 83);
  assert.equal(B.parseTimestamp("01:02:03"), 3723);
  assert.equal(B.formatTimestamp(83), "1:23");
  assert.equal(B.formatTimestamp(3723), "1:02:03");
  assert.equal(B.parseTimestamp("1:99"), -1);
  assert.equal(B.parseTimestamp("soon"), -1);
  assert.equal(B.formatTimestamp(0), "0:00");
  const first = B.addAudioBookmark({ path: "Recordings/lecture.mp3", at: 90, label: "Intro" }, 1);
  const second = B.addAudioBookmark({ path: "Recordings/lecture.mp3", at: 30, label: "" }, 2);
  assert.ok(first && second);
  assert.equal(second.label, "0:30");
  assert.equal(B.addAudioBookmark({ path: "Notes/biology.md", at: 10 }, 1), null);
  assert.equal(B.isAudioPath("clip.M4A"), true);
  assert.equal(B.bookmarkLink(first), "[[Recordings/lecture.mp3#t=90|Intro]]");
  const chapters = B.chaptersFor([first, second], "Recordings/lecture.mp3");
  assert.deepEqual(chapters.map((entry) => entry.at), [30, 90]);
  assert.deepEqual(chapters.map((entry) => entry.chapter), [1, 2]);
  assert.deepEqual(B.bookmarkPaths([first, second]), ["Recordings/lecture.mp3"]);
  const settings = B.normalizeAudioBookmarkSettings({ entries: [first, second, first] });
  assert.equal(settings.entries.length, 2);
  assert.equal(settings.enabled, true);
});

test("study modules: the four new switches persist and gate the workspace", async () => {
  const plugin = await setup({
    readAloud: { enabled: false, style: "keypoints", rate: 1.3 },
    lectureCompiler: { enabled: false, folder: "Study/Lectures" },
    courseHealth: { enabled: false, attendanceThreshold: 80 },
    audioBookmarks: { enabled: false, entries: [{ path: "a.mp3", at: 12, label: "Start" }] },
  });
  assert.equal(plugin.readAloudEnabled(), false);
  assert.equal(plugin.lectureCompilerEnabled(), false);
  assert.equal(plugin.courseHealthEnabled(), false);
  assert.equal(plugin.audioBookmarksEnabled(), false);
  for (const key of ["feynmanLearning", "recallScheduler", "lerntracker", "studyFlow", "subjectManager", "quizIndex", "courseHub", "studyTasks", "annotations", "deepNotes", "retention", "vocabulary", "readAloud", "lectureCompiler", "courseHealth", "audioBookmarks", "feynmanAi", "pdfAnnotationIndex", "readingLibrary"]) {
    plugin.settings[key].enabled = false;
  }
  assert.equal(plugin.studyWorkspaceEnabled(), false);
  assert.equal(plugin.settings.readAloud.style, "keypoints");
  assert.equal(plugin.settings.lectureCompiler.folder, "Study/Lectures");
  assert.equal(plugin.settings.courseHealth.attendanceThreshold, 80);
  assert.equal(plugin.settings.audioBookmarks.entries.length, 1);
  await plugin.updateReadAloud({ rate: 1.5 });
  assert.equal(plugin.settings.readAloud.rate, 1.5);
});

test("study workspace view: the four new tabs render when enabled", async () => {
  const dom = makeDom();
  const plugin = await setup();
  const view = new T.StudyWorkspaceView({ app: plugin.app }, plugin);
  view.contentEl = dom.root;
  view.render();
  const texts = () => dom.texts().join(" ");
  assert.match(texts(), /Course health/);
  assert.match(texts(), /Lecture notes/);
  assert.match(texts(), /Read aloud/);
  assert.match(texts(), /Bookmarks/);
  view.setTab("health");
  assert.match(texts(), /Course health/);
  view.setTab("lectures");
  assert.match(texts(), /Compile one study note/);
  view.setTab("readAloud");
  assert.match(texts(), /Read aloud/);
  view.setTab("bookmarks");
  assert.match(texts(), /Add a timestamp bookmark/);
});

test("compiled lecture notes are written once and never overwrite", async () => {
  const files = [];
  const app = makeApp([]);
  app.vault.getAbstractFileByPath = (path) => files.find((file) => file.path === path) || null;
  app.vault.create = async (path, text) => {
    if (files.some((file) => file.path === path)) throw new Error("exists");
    files.push({ path, text });
    return { path };
  };
  const plugin = new QT(app);
  await plugin.onload();
  const compiled = L.compileLectureNote([{ course: "Biology", date: "2026-10-01", title: "Cells", topics: "ATP: energy" }], { folder: "Lecture notes" });
  const first = await plugin.saveCompiledLectureNote(compiled);
  const second = await plugin.saveCompiledLectureNote(compiled);
  assert.equal(first, "Lecture notes/Biology lecture notes 2026-10-01.md");
  assert.equal(second, "Lecture notes/Biology lecture notes 2026-10-01 2.md");
  assert.equal(files.length, 2);
  assert.equal(await plugin.saveCompiledLectureNote(null), null);
});
