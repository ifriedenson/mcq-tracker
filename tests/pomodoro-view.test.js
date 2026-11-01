"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");
const { T, Plugin: QT } = load();

async function setup() {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  const dom = makeDom();
  const view = new T.PomodoroView({ app }, plugin);
  view.contentEl = dom.root;
  await view.onOpen();
  return { dom, plugin, view };
}

function progress(dom) {
  // The fake DOM keeps earlier renders, so read the newest progress bar.
  const bars = dom.all.filter((o) => o.classes.has("qt-pomodoro-progress"));
  const fills = dom.all.filter((o) => o.classes.has("qt-pomodoro-progress-fill"));
  const bar = bars[bars.length - 1];
  const fill = fills[fills.length - 1];
  assert.ok(bar, "progress bar is rendered");
  assert.ok(fill, "progress fill is rendered");
  return { bar, fill };
}

test("the view has no duplicate title and starts with an empty progress bar", async () => {
  const { dom } = await setup();
  assert.equal(dom.all.filter((o) => o.meta.tag === "h2" && o.meta.text === "Pomodoro").length, 0);
  assert.ok(dom.texts().includes("Focus"));
  const { bar, fill } = progress(dom);
  assert.equal(bar.meta.attrs.role, "progressbar");
  assert.equal(bar.meta.attrs["aria-label"], "Focus progress");
  assert.equal(bar.meta.attrs["aria-valuemin"], "0");
  assert.equal(bar.meta.attrs["aria-valuemax"], "1500");
  assert.equal(bar.meta.attrs["aria-valuenow"], "0");
  assert.equal(bar.meta.attrs["aria-valuetext"], "25:00 remaining");
  assert.equal(fill.style.width, "0%");
});

test("the progress bar tracks elapsed time within the current phase", async () => {
  const { dom, plugin, view } = await setup();
  plugin.settings.pomodoro.state = { ...plugin.settings.pomodoro.state, remainingSec: 750, running: false, startedAt: 0 };
  view.render();
  const { bar, fill } = progress(dom);
  assert.equal(bar.meta.attrs["aria-valuenow"], "750");
  assert.equal(bar.meta.attrs["aria-valuetext"], "12:30 remaining");
  assert.equal(fill.style.width, "50%");
  assert.equal(fill.style.animation, undefined);
  assert.equal(fill.classes.has("is-running"), false);
});

test("the bar animates continuously while the timer is running", async () => {
  const { dom, plugin, view } = await setup();
  plugin.settings.pomodoro.state = {
    ...plugin.settings.pomodoro.state,
    remainingSec: 1500,
    running: true,
    startedAt: Date.now() - 60_000,
  };
  view.render();
  const { bar, fill } = progress(dom);
  assert.equal(bar.meta.attrs["aria-valuenow"], "60");
  assert.equal(fill.style["--qt-pomodoro-duration"], "1500s");
  assert.equal(fill.classes.has("is-running"), true);
  const delayed = Math.abs(Number(String(fill.style.animationDelay).replace("s", "")));
  assert.ok(delayed >= 59 && delayed <= 61, `animation starts near the elapsed second (got ${fill.style.animationDelay})`);
});

test("the progress bar is full when the phase has no time left", async () => {
  const { dom, plugin, view } = await setup();
  plugin.settings.pomodoro.state = { ...plugin.settings.pomodoro.state, remainingSec: 0, running: false, startedAt: 0 };
  view.render();
  const { bar, fill } = progress(dom);
  assert.equal(bar.meta.attrs["aria-valuenow"], "1500");
  assert.equal(fill.style.width, "100%");
});
