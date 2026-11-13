"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT, obsidian } = load();

const FEED = "https://example.com/calendar.ics";
const ICS = "BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:1\nDTSTART:20260101T090000\nSUMMARY:Study\nEND:VEVENT\nEND:VCALENDAR\n";

function withRequests(handler, fn) {
  obsidian.requestImpl = handler;
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      obsidian.requestImpl = null;
    });
}

async function pluginWithNoSources() {
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  plugin.settings.calendar = { sources: [] };
  return plugin;
}

test("calendar feed: an HTTP failure says which URL to check instead of throwing raw", async () => {
  // Regression: requestUrl threw, so the user saw the runtime's status text.
  const plugin = await pluginWithNoSources();
  await withRequests(
    async () => ({ status: 404, text: "" }),
    async () => {
      await assert.rejects(() => plugin.addCalendarUrlSource(FEED), (e) => {
        assert.match(e.message, /answered HTTP 404/);
        assert.match(e.message, /Check the calendar URL is still shared publicly/);
        return true;
      });
    }
  );
  assert.equal(plugin.settings.calendar.sources.length, 0, "nothing was saved from a failed feed");
});

test("calendar feed: being offline keeps a message with a next step", async () => {
  const plugin = await pluginWithNoSources();
  await withRequests(
    async () => {
      throw new Error("net::ERR_INTERNET_DISCONNECTED");
    },
    async () => {
      await assert.rejects(() => plugin.addCalendarUrlSource(FEED), (e) => {
        assert.match(e.message, /Couldn't reach that calendar address/);
        assert.match(e.message, /Check the address and your internet connection, then try again/);
        return true;
      });
    }
  );
});

test("calendar feed: a good feed is still stored, and a page that is not a feed says so", async () => {
  const plugin = await pluginWithNoSources();
  await withRequests(
    async () => ({ status: 200, text: ICS }),
    async () => {
      await plugin.addCalendarUrlSource(FEED);
    }
  );
  assert.equal(plugin.settings.calendar.sources.length, 1);
  assert.match(plugin.settings.calendar.sources[0].content, /BEGIN:VEVENT/);

  await withRequests(
    async () => ({ status: 200, text: "<html>login</html>" }),
    async () => {
      await assert.rejects(() => plugin.addCalendarUrlSource("https://example.com/other.ics"), /Use the public \.ics link from the calendar's share menu/);
    }
  );
});

test("calendar sync: one dead feed does not stop the healthy ones", async () => {
  // Regression: the loop aborted on the first throw, so later feeds never refreshed.
  const synced = [];
  const fakeView = {
    plugin: {
      calendarSources: () => [
        { id: "bad", name: "Old school feed", hidden: false },
        { id: "good", name: "Timetable", hidden: false },
        { id: "hidden", name: "Muted", hidden: true },
      ],
      syncCalendarSource: async (id) => {
        if (id === "bad") throw new Error("Old school feed answered HTTP 410. Check the calendar URL is still shared publicly, then try again.");
        synced.push(id);
      },
      invalidateCalendar: () => {},
    },
    render: () => {},
    contentEl: null,
  };

  obsidian.notices.length = 0;
  await T.CalendarView.prototype.sync.call(fakeView, null);

  assert.deepEqual(synced, ["good"], "the healthy feed still refreshed after the dead one failed");
  assert.equal(obsidian.notices.length, 1);
  assert.match(obsidian.notices[0], /Schedule updated, but 1 of 2 feeds could not refresh/);
  assert.match(obsidian.notices[0], /Old school feed: .*HTTP 410/, "the notice names the feed and the reason");
});

test("calendar sync: every feed failing is reported honestly", async () => {
  const fakeView = {
    plugin: {
      calendarSources: () => [{ id: "bad", name: "Feed", hidden: false }],
      syncCalendarSource: async () => {
        throw new Error("Feed answered HTTP 500. Try again later.");
      },
      invalidateCalendar: () => {},
    },
    render: () => {},
    contentEl: null,
  };
  obsidian.notices.length = 0;
  await T.CalendarView.prototype.sync.call(fakeView, null);
  assert.match(obsidian.notices[0], /Could not refresh any calendar feed\./);
});

test("calendar sync: a clean run still says the schedule updated", async () => {
  const fakeView = {
    plugin: {
      calendarSources: () => [{ id: "a", name: "A", hidden: false }],
      syncCalendarSource: async () => {},
      invalidateCalendar: () => {},
    },
    render: () => {},
    contentEl: null,
  };
  obsidian.notices.length = 0;
  await T.CalendarView.prototype.sync.call(fakeView, null);
  assert.deepEqual(obsidian.notices, ["Schedule updated."]);
});

test("calendar feed: a server that never answers resolves within its deadline", async () => {
  // Regression: the feed request had no deadline, so a stalled server spun forever.
  const plugin = await pluginWithNoSources();
  plugin.calendarFetchTimeoutMs = 40;
  obsidian.requestImpl = () => new Promise(() => {});
  const started = Date.now();
  try {
    await assert.rejects(() => plugin.addCalendarUrlSource(FEED), (e) => {
      assert.match(e.message, /Couldn't reach that calendar address within 40ms/);
      assert.match(e.message, /Check the address and your internet connection, then try again/);
      return true;
    });
    assert.ok(Date.now() - started < 2000, "the stalled feed returned within its bound");
  } finally {
    obsidian.requestImpl = null;
  }
});

test("calendar sync: a hung feed becomes the per-feed notice and the healthy feed still refreshes", async () => {
  const plugin = await pluginWithNoSources();
  plugin.calendarFetchTimeoutMs = 40;
  plugin.settings.calendar.sources = [
    { id: "hung", name: "Hung feed", type: "url", url: "https://example.com/hung.ics", content: "", hidden: false, lastSync: 0 },
    { id: "good", name: "Good feed", type: "url", url: "https://example.com/good.ics", content: "", hidden: false, lastSync: 0 },
  ];
  obsidian.requestImpl = async (req) => {
    if (String(req.url).includes("/hung.ics")) return new Promise(() => {});
    return { status: 200, text: ICS };
  };
  obsidian.notices.length = 0;
  const started = Date.now();
  try {
    await T.CalendarView.prototype.sync.call({ plugin, render: () => {}, contentEl: null }, null);
  } finally {
    obsidian.requestImpl = null;
  }
  assert.ok(Date.now() - started < 2000, "the sync finished instead of waiting on the stalled feed");
  const good = plugin.settings.calendar.sources.find((s) => s.id === "good");
  assert.ok(good.lastSync > 0, "the healthy feed refreshed after the hung one timed out");
  assert.equal(obsidian.notices.length, 1);
  assert.match(obsidian.notices[0], /Schedule updated, but 1 of 2 feeds could not refresh/);
  assert.match(obsidian.notices[0], /Hung feed: Couldn't reach that calendar feed within 40ms/);
});
