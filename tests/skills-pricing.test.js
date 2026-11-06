"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();

function skillNote(path, text) {
  return { path, text, noFm: true };
}

function makePanel(plugin, app, history, loadSkills) {
  const dom = makeDom();
  const view = { plugin, app, md() {} };
  const panel = new T.ChatPanel(view, dom.root, {
    title: "Study agent",
    sourcePath: "",
    getSessionId: () => "",
    setSessionId: () => {},
    getRole: () => "private",
    setRole: () => {},
    getModel: () => plugin.settings.ai.api.model,
    setModel: () => {},
    buildContext: (mode, context, skills) => [mode, context, skills].filter(Boolean).join("\n\n---\n\n"),
    getApiHistory: () => history,
    saveApiHistory: (next) => {
      history.length = 0;
      history.push(...next);
    },
    loadSkills,
    quick: [],
  });
  return { panel, dom };
}

async function readyPlugin(app) {
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "api";
  return plugin;
}

test("skills: parses enabled vault notes, ignores disabled ones and builds a bounded prompt block", async () => {
  const app = makeApp([
    skillNote(
      "Study agent skills/Exam coach.md",
      "---\nname: Exam coach\ndescription: Check units\nenabled: true\n---\n# Exam coach\n\nAlways check units before answering.\n"
    ),
    skillNote("Study agent skills/Disabled.md", "---\nname: Disabled\nenabled: false\n---\n\nDo not send this.\n"),
    skillNote("Notes/unrelated.md", "# Unrelated\n\nNot a skill.\n"),
  ]);
  const result = await T.chatSkills.loadSkills(app, "Study agent skills");
  assert.equal(result.skills.length, 1);
  assert.equal(result.skills[0].name, "Exam coach");
  assert.match(result.block, /USER-AUTHORED SKILLS/);
  assert.match(result.block, /Always check units/);
  assert.doesNotMatch(result.block, /Do not send this/);
  assert.equal(result.warnings.length, 0);

  const missing = await T.chatSkills.loadSkills(makeApp([]), "Study agent skills");
  assert.deepEqual(missing.skills, []);
  assert.equal(missing.block, "");
});

test("skills: the command creates a local skill note without a network call", async () => {
  const app = makeApp([]);
  const plugin = await readyPlugin(app);
  plugin.settings.ai.skillsFolder = "Study agent skills";
  let fetchCalls = 0;
  const originalFetch = global.fetch;
  global.fetch = () => {
    fetchCalls += 1;
    throw new Error("skills must stay local");
  };
  try {
    const path = await plugin.createSkillNote("Unit checker");
    assert.equal(path, "Study agent skills/Unit checker.md");
    const created = app.created.find((entry) => entry.path === path);
    assert.ok(created);
    assert.match(created.text, /enabled: true/);
    assert.match(created.text, /Write the Study agent instruction here/);
    assert.ok(app.opened.includes(path));
    assert.equal(fetchCalls, 0);
  } finally {
    global.fetch = originalFetch;
  }
});

test("skills: the Include skills switch changes both prompt assembly and budget accounting", async () => {
  const app = makeApp([
    skillNote("Study agent skills/Exam coach.md", "# Exam coach\n\nAlways check units before answering.\n"),
  ]);
  const plugin = await readyPlugin(app);
  plugin.settings.ai.api.model = "claude-test";
  const calls = [];
  plugin.aiChat = async (system, messages) => {
    calls.push({ system, messages });
    return "Answer";
  };
  const history = [];
  const { panel } = makePanel(plugin, app, history, () => T.chatSkills.loadSkills(app, "Study agent skills"));
  assert.equal(panel.includeSkills, false);
  await panel.send("Check this answer");
  assert.doesNotMatch(calls[0].system, /USER-AUTHORED SKILLS/);
  assert.equal(panel.lastBudget.parts.find((part) => part.label === "skills").chars, 0);

  panel.includeSkills = true;
  await panel.send("Check this answer");
  assert.match(calls[1].system, /USER-AUTHORED SKILLS/);
  assert.match(calls[1].system, /Always check units/);
  assert.ok(panel.lastBudget.parts.find((part) => part.label === "skills").chars > 0);
  assert.ok(panel.skills.length === 1);
});

test("skills: an absent folder degrades to no prompt block and no failure", async () => {
  const app = makeApp([]);
  const plugin = await readyPlugin(app);
  const calls = [];
  plugin.aiChat = async (system) => {
    calls.push(system);
    return "Answer";
  };
  const { panel } = makePanel(plugin, app, [], () => T.chatSkills.loadSkills(app, "Study agent skills"));
  panel.includeSkills = true;
  const sent = await panel.send("Hello");
  assert.equal(sent, true);
  assert.equal(panel.skills.length, 0);
  assert.equal(panel.skillBlock, "");
  assert.doesNotMatch(calls[0], /USER-AUTHORED SKILLS/);
});

test("pricing: parses a local table and estimates input plus capped output cost", () => {
  const parsed = T.chatPricing.parsePricingText(
    "gpt-4o-mini | 0.15 | 0.60\nbad line\nfree | 0 | 0\nclaude | 3 | $15\n"
  );
  assert.deepEqual(parsed["gpt-4o-mini"], { model: "gpt-4o-mini", input: 0.15, output: 0.6 });
  assert.equal(parsed.bad, undefined);
  assert.equal(parsed.free, undefined);
  assert.equal(parsed.claude.output, 15);

  const cost = T.chatPricing.estimateCost(parsed, "GPT-4o-Mini", 1000000, 4000);
  assert.equal(cost.ok, true);
  assert.equal(cost.inputCost, 0.15);
  assert.equal(cost.outputCost, 0.0024);
  assert.equal(T.chatPricing.formatUsd(cost.total), "$0.152");
  assert.equal(T.chatPricing.estimateCost({}, "unknown", 1000, 1000).ok, false);
  assert.equal(T.chatPricing.estimateCost(parsed, "free", 1000, 1000).ok, false);
});

test("pricing: the footer shows a cost only when the effective model has local prices", async () => {
  const app = makeApp([]);
  const plugin = await readyPlugin(app);
  plugin.settings.ai.api.model = "gpt-4o-mini";
  const { panel, dom } = makePanel(plugin, app, []);
  const model = panel.modelPlan("hello").model;
  assert.ok(model);
  const visibleCost = () =>
    panel.budgetEl.__own.children.some((child) => child.meta && typeof child.meta.text === "string" && child.meta.text.includes("Estimated cost:"));
  panel.ai.pricing = { [model.toLowerCase()]: { model, input: 1, output: 2 } };
  panel.refreshTokenFooter();
  assert.equal(visibleCost(), true);
  panel.ai.pricing = {};
  panel.refreshTokenFooter();
  assert.equal(visibleCost(), false);
});
