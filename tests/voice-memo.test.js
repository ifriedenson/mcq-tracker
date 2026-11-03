"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const M = T.voiceMemo;

const STAMP = new Date(2026, 10, 3, 14, 32, 10);

function binaryApp() {
  const app = makeApp([]);
  app.vault.createBinary = async (path, data) => {
    app.files.push({ path, bytes: data });
    return { path };
  };
  return app;
}

test("voice memo: names, extensions and settings stay local and safe", () => {
  assert.equal(M.memoStamp(STAMP), "2026-11-03 14-32-10");
  assert.equal(M.memoTime(STAMP), "14:32");
  assert.equal(M.dayKey(STAMP), "2026-11-03");
  assert.equal(M.memoPath("Recordings", STAMP, "audio/webm"), "Recordings/Voice 2026-11-03 14-32-10.webm");
  assert.equal(M.memoPath("Media/Voice", STAMP, "audio/mp4"), "Media/Voice/Voice 2026-11-03 14-32-10.m4a");
  assert.equal(M.memoPath("Media/Voice", STAMP, "audio/ogg;codecs=opus"), "Media/Voice/Voice 2026-11-03 14-32-10.ogg");
  assert.equal(M.memoPath("Media/Voice", STAMP, "audio/wav"), "Media/Voice/Voice 2026-11-03 14-32-10.wav");
  assert.equal(M.memoPath("Media/Voice", STAMP, ""), "Media/Voice/Voice 2026-11-03 14-32-10.webm");
  assert.equal(M.memoPath("../Escape", STAMP, "audio/webm"), "");
  assert.equal(M.memoPath("", STAMP, "audio/webm"), "");
  assert.equal(M.memoStamp("not a date"), "");
  assert.deepEqual(M.normalizeVoiceMemoSettings({}), { folder: "Recordings", dailyNoteFolder: "" });
  assert.deepEqual(M.normalizeVoiceMemoSettings({ folder: "/Media/Voice/", dailyNoteFolder: "/Journal/" }), {
    folder: "Media/Voice",
    dailyNoteFolder: "Journal",
  });
  assert.equal(M.normalizeVoiceMemoSettings({ folder: "../bad" }).folder, "Recordings");
});

test("voice memo: the entry line carries the time, embed and duration", () => {
  const line = M.memoEntry({ time: "14:32", path: "Recordings/Voice.webm", seconds: 80, label: "  lecture recap  " });
  assert.equal(line, "- 14:32 ![[Recordings/Voice.webm]] · 1 min 20 s · lecture recap");
  assert.equal(M.memoEntry({ time: "09:05", path: "R/a.webm" }), "- 09:05 ![[R/a.webm]]");
  assert.equal(M.memoEntry({ time: "", path: "R/a.webm" }), "");
  const appended = M.appendMemoEntry("# Diary\n\nToday was long.", "- 14:32 ![[R/a.webm]]");
  assert.equal(appended, "# Diary\n\nToday was long.\n- 14:32 ![[R/a.webm]]\n");
  assert.equal(M.appendMemoEntry("", "- 14:32 ![[R/a.webm]]"), "- 14:32 ![[R/a.webm]]\n");
  assert.equal(M.appendMemoEntry("Body", ""), "Body");
});

test("voice memo: the plugin saves the audio and appends one daily-note line", async () => {
  const app = binaryApp();
  const plugin = new QT(app);
  await plugin.onload();
  await plugin.updateVoiceMemo({ folder: "Media/Voice", dailyNoteFolder: "Journal" });
  const result = await plugin.saveVoiceMemo({
    data: new Uint8Array([1, 2, 3, 4]),
    mimeType: "audio/webm",
    durationSeconds: 65,
    label: "Three causes of the crisis",
    date: STAMP,
  });
  assert.equal(result.ok, true);
  assert.equal(result.path, "Media/Voice/Voice 2026-11-03 14-32-10.webm");
  assert.equal(result.notePath, "Journal/2026-11-03.md");
  const audio = app.files.find((file) => file.path === result.path);
  assert.equal(audio.bytes.length, 4);
  const note = app.files.find((file) => file.path === result.notePath);
  assert.match(note.text, /# 2026-11-03/);
  assert.match(note.text, /- 14:32 !\[\[Media\/Voice\/Voice 2026-11-03 14-32-10\.webm\]\] · 1 min 5 s · Three causes/);

  const second = await plugin.saveVoiceMemo({ data: new Uint8Array([9]), mimeType: "audio/webm", date: STAMP });
  assert.equal(second.path, "Media/Voice/Voice 2026-11-03 14-32-10 2.webm");
  const edited = app.files.find((file) => file.path === result.notePath);
  assert.equal((edited.text.match(/!\[\[Media\/Voice\//g) || []).length, 2);
});

test("voice memo: empty audio and a missing folder are refused without a write", async () => {
  const app = binaryApp();
  const plugin = new QT(app);
  await plugin.onload();
  const before = app.files.length;
  const empty = await plugin.saveVoiceMemo({ data: new Uint8Array([]), mimeType: "audio/webm" });
  assert.equal(empty.ok, false);
  assert.equal(empty.reason, "empty");
  const unsafe = await plugin.saveVoiceMemo({ data: new Uint8Array([1]), folder: "../bad", mimeType: "audio/webm" });
  assert.equal(unsafe.ok, true, "a bad folder argument is ignored; the saved setting wins");
  assert.equal(app.files.length, before + 1);
});
