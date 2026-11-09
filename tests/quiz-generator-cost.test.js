"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { Plugin: QT } = load();

test("quiz generator: the modal shows a pre-send cost estimate from the exact prompt", async () => {
  const app = makeApp([{ path: "Notes/ATP.md", noFm: true, text: "ATP is the energy currency of the cell." }]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "api";
  plugin.settings.ai.api.model = "test-model";
  plugin.settings.ai.pricing = { "test-model": { model: "test-model", input: 3, output: 6 } };
  let calls = 0;
  plugin.aiComplete = async () => {
    calls += 1;
    if (calls === 1) {
      return JSON.stringify({ questions: [{ question: "What is ATP?", choices: ["Energy currency", "DNA", "Lipid"], answer: "A" }] });
    }
    return '{"answer":"A"}';
  };

  const modal = plugin.openQuizGenerator();
  assert.ok(modal, "the command opens the real generator modal");
  const dom = makeDom();
  modal.contentEl = dom.root;
  modal.render();
  await dom.click("Generate draft");

  assert.equal(calls, 0, "reviewing the estimate must not send the request");
  const texts = dom.texts().join("\n");
  assert.match(texts, /Estimated cost: \$/);
  assert.match(texts, /estimate, not an invoice/);
  const prepared = modal.prepared;
  assert.ok(prepared && prepared.prompt && prepared.prompt.user);
  assert.equal(
    prepared.estimate.inputTokens,
    Math.ceil(prepared.prompt.system.length / 4) + Math.ceil(prepared.prompt.user.length / 4),
    "the estimate is computed from the exact system and user payload"
  );

  await dom.click("Send request");
  assert.equal(calls, 2, "Send request performs generation and the blind verification pass");
});
