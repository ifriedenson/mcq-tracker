"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { T, obsidian } = load();

/* OpenCode 2.x removed the 1.x server routes (POST /session answers 405), so the plugin only works with 1.x for now. */

test("a 405 from OpenCode names the request that failed and points at the version", async () => {
  const oc = new T.OpenCodeClient({ url: "http://127.0.0.1:1", username: "opencode", password: "" });
  obsidian.requestImpl = async () => ({ status: 405, text: "" });
  try {
    await assert.rejects(oc.createSession("x"), (e) => {
      assert.match(e.message, /returned 405 for POST \/session\./);
      assert.match(e.message, /OpenCode 1\.x/);
      assert.match(e.message, /Direct API/);
      return true;
    });
  } finally {
    obsidian.requestImpl = null;
  }
});

test("other errors keep OpenCode's own message and get no version hint", async () => {
  const oc = new T.OpenCodeClient({ url: "http://127.0.0.1:1" });
  obsidian.requestImpl = async () => ({ status: 500, text: "boom" });
  try {
    await assert.rejects(oc.health(), (e) => {
      assert.equal(e.message, "OpenCode returned 500 for GET /global/health: boom");
      return true;
    });
  } finally {
    obsidian.requestImpl = null;
  }
});
