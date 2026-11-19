"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");
const { T, Plugin: QT } = load();
const W = T.weekImage;

function layout() {
  return {
    label: "Nov 16",
    dayStart: 8,
    hours: [8, 9, 10],
    hourHeight: 44,
    days: [
      { key: "2026-11-16", weekday: "Mon", dayOfMonth: 16, isToday: true, allDay: [{ title: "Exam", time: "", layer: "events" }], blocks: [] },
      {
        key: "2026-11-17",
        weekday: "Tue",
        dayOfMonth: 17,
        isToday: false,
        allDay: [],
        blocks: [{ title: "Biology 101", time: "09:00 – 10:00", top: 44, height: 44, left: 0, width: 100, layer: "classes" }],
      },
    ],
    now: { dayIndex: 0, top: 60, key: "2026-11-16" },
  };
}

test("week image: an svg grid with one rect per block", () => {
  const drawn = W.buildWeekSvg(layout(), { hourLabel: (hour) => `${String(hour).padStart(2, "0")}:00` });
  assert.ok(drawn.svg.startsWith("<svg"));
  assert.ok(drawn.svg.endsWith("</svg>"));
  assert.ok(drawn.svg.includes("Week of Nov 16"));
  assert.ok(drawn.svg.includes("Biology 101"));
  assert.ok(drawn.svg.includes('stroke="#d33"'), "the now-line is drawn");
  assert.equal(drawn.blocks, 1);
  assert.ok(drawn.width > 300 && drawn.height > 100);
  assert.ok(W.escapeSvg("<a>&\"b\"</a>").includes("&lt;a&gt;"), "svg text is escaped");
  assert.equal(W.ellipsize("Biology 101", 6), "Biolo…");
  assert.equal(W.weekImageFileName("2026-11-16"), "week-timetable-2026-11-16.png");
  assert.equal(W.weekImageFileName("garbage"), "week-timetable.png");
});

test("week image: empty weeks still draw a grid", () => {
  const drawn = W.buildWeekSvg({ label: "", days: [], hours: [8], hourHeight: 44, dayStart: 8 }, {});
  assert.ok(drawn.svg.includes("<svg"));
  assert.equal(drawn.blocks, 0);
});

test("plugin: the export needs the app window and registers its command", async () => {
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  plugin.settings.calendar.enabled = true;
  assert.ok(plugin.commands.some((command) => command.id === "calendar-export-week"), "command registered");
  const result = await plugin.exportWeekImage();
  assert.deepEqual(result, { exported: false, reason: "no-window" }, "headless export reports the missing window");
  const built = plugin.buildWeekLayout(T.calendarWeek.weekStartKey(T.util.localDate(), plugin.calendarSettings().firstDayOfWeek));
  assert.equal(built.days.length, 7, "the shared layout covers the whole week");
});
