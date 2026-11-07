"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT, obsidian } = load();
const AgentView = T.agentView.AgentView;
const plan = T.chatPlan;
const AiReview = T.aiToolReviewModal.AiToolReviewModal;

const PLAN_REPLY = [
  "Here is the plan:",
  "1. Summarize the current note.",
  "2. Propose one flashcard for the key idea.",
  "3. Suggest a short review question.",
].join("\n");

const CARD_BLOCK = [
  "```mcqtool",
  JSON.stringify({ tool: "create_card", front: "What is 2+2?", back: "4", deck: "Arithmetic" }),
  "```",
].join("\n");

function tick(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(fn, label) {
  for (let i = 0; i < 500; i += 1) {
    const value = fn();
    if (value) return value;
    await tick(5);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function readyPlugin(app) {
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "api";
  plugin.settings.ai.api.model = "gpt-4o-mini";
  plugin.settings.ai.mode = "agent";
  return plugin;
}

async function openView(app) {
  const shell = makeDom();
  const plugin = await readyPlugin(app || makeApp([]));
  const view = new AgentView({ app: plugin.app }, plugin);
  view.contentEl = shell.root;
  await view.onOpen();
  return { app: plugin.app, plugin, view, shell };
}

function lastUser(messages) {
  const rows = Array.isArray(messages) ? messages : [];
  return rows.length ? String(rows[rows.length - 1].content || "") : "";
}

function resetObsidian() {
  obsidian.modals.length = 0;
  obsidian.notices.length = 0;
}

function openReviewModal() {
  const modal = obsidian.modals
    .filter((item) => item instanceof AiReview && !item.closed && item.proposals && item.proposals.length)
    .pop();
  assert.ok(modal, "a write review window opened");
  const dom = makeDom();
  modal.contentEl = dom.root;
  modal.onOpen();
  return { modal, dom };
}

test("plan: the parser keeps numbered steps and refuses prose, empty steps and NO_PLAN", () => {
  const parsed = plan.parsePlan(
    "Here is the plan:\n\n1. Read chapter 2\n    in the notebook\n2) List three terms\nStep 3: Make a card"
  );
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.steps, ["Read chapter 2 in the notebook", "List three terms", "Make a card"]);

  assert.equal(plan.parsePlan("NO_PLAN").reason, "none");
  assert.equal(plan.parsePlan("I can help with that.").reason, "empty");
  assert.equal(plan.parsePlan("1.\n2.\n").ok, false);
  assert.equal(plan.parsePlan("").ok, false);
  assert.equal(plan.parsePlan("- only one bullet").ok, false);
  assert.deepEqual(plan.parsePlan("- first\n- second").steps, ["first", "second"]);
  assert.deepEqual(plan.parsePlan("```\n1. First\n2. Second\n```").steps, ["First", "Second"]);
  assert.equal(plan.parsePlan("1. Save api_key = sk-abcdefghijklmnop1234").steps[0].includes("sk-abcdefghijklmnop1234"), false);
  assert.match(plan.reasonText("empty"), /numbered plan/i);
});

test("plan: state helpers approve, skip, restore an interrupted run and describe stops", () => {
  const created = plan.createPlan("Goal", ["One", "Two"], 1000);
  assert.equal(created.status, "draft");
  assert.equal(created.steps[0].status, "pending");

  const approved = plan.approveStep(created, 1);
  assert.deepEqual(plan.approvedIndexes(approved), [1]);
  assert.equal(plan.skipStep(created, 0).steps[0].status, "skipped");

  const running = plan.startPlan(plan.markStep(plan.approveStep(created, 0), 0, "running"));
  assert.equal(running.status, "running");
  assert.equal(plan.approveStep(running, 0), null, "no edits mid-run");
  const restored = plan.restoredPlan(running);
  assert.equal(restored.status, "paused");
  assert.equal(restored.stopReason, "reload");
  assert.equal(restored.stopStep, 1);
  assert.equal(restored.steps[0].status, "approved");

  assert.equal(plan.normalizePlan({ steps: [] }), null);
  assert.equal(plan.approvedIndexes(null).length, 0);

  const done = plan.finishPlan(plan.markStep(plan.markStep(created, 0, "done"), 1, "skipped"));
  assert.equal(done.status, "done");
  assert.match(plan.stopMessage(done), /complete/i);
  assert.match(plan.stopMessage(plan.pausePlan(created, "declined", 0)), /not applied/i);
  assert.match(plan.stopMessage(plan.finishPlan(created, "not-approved")), /not approved/i);
  assert.match(plan.stepPrompt(created, 0), /Run only step 1 of 2/);
});

test("plan: a request becomes numbered steps, approved steps run in order, and the plan persists", async () => {
  resetObsidian();
  const { app, plugin, view } = await openView();
  const panel = view.chatPanel;
  const calls = [];
  const applied = [];
  plugin.aiChat = async (_system, messages) => {
    const text = lastUser(messages);
    calls.push(text);
    if (/Write the numbered plan now/.test(text)) return PLAN_REPLY;
    if (/Run only step 1/.test(text)) return "The note explains variables.";
    if (/Run only step 2/.test(text)) return `I can add that.\n\n${CARD_BLOCK}`;
    if (/Run only step 3/.test(text)) return "Review question: what is a variable?";
    throw new Error(`unexpected request: ${text}`);
  };
  plugin.applyByokToolProposals = async (list) => {
    applied.push(...list);
    return { created: list.length, updated: 0, errors: [] };
  };

  assert.equal(await view.startPlan("Learn algebra"), true);
  assert.equal(panel.plan.steps.length, 3);
  assert.equal(panel.plan.status, "draft");
  assert.equal(calls.length, 1, "the plan request is one chat request");

  assert.equal(panel.approvePlanStep(0), true);
  assert.equal(panel.approvePlanStep(1), true);
  const running = panel.runApprovedPlan();
  const modal = await waitFor(
    () => obsidian.modals.find((item) => item instanceof AiReview && !item.closed && item.proposals.length),
    "the write review"
  );
  const reviewDom = makeDom();
  modal.contentEl = reviewDom.root;
  modal.onOpen();
  await reviewDom.click("Apply selected");
  assert.equal(await running, true);

  assert.deepEqual(applied.map((item) => item.front), ["What is 2+2?"]);
  assert.deepEqual(panel.plan.steps.map((step) => step.status), ["done", "done", "pending"]);
  assert.equal(panel.plan.status, "paused");
  assert.equal(panel.plan.stopReason, "not-approved");
  assert.equal(calls.length, 3, "only approved steps were requested");
  assert.ok(plugin.settings.ai.studyChatPlan, "the plan is saved with the active chat");

  const reloaded = new QT(app);
  reloaded.saved = JSON.parse(JSON.stringify(plugin.saved));
  await reloaded.onload();
  assert.equal(reloaded.settings.ai.studyChatPlan.steps.length, 3);
  assert.equal(reloaded.settings.ai.studyChatPlan.steps[0].status, "done");
  const reopened = new AgentView({ app }, reloaded);
  reopened.contentEl = makeDom().root;
  await reopened.onOpen();
  assert.equal(reopened.activeTab().plan.steps.length, 3);
  assert.equal(reopened.activeTab().plan.steps[1].status, "done");
  assert.equal(reopened.chatPanel.plan.steps.length, 3);
});

test("plan: a declined write stops the run and leaves notes, later steps and the prior plan intact", async () => {
  resetObsidian();
  const app = makeApp([{ path: "Notes/One.md" }]);
  const before = app.files[0].text;
  const { plugin, view } = await openView(app);
  const panel = view.chatPanel;
  const calls = [];
  let applied = 0;
  plugin.aiChat = async (_system, messages) => {
    const text = lastUser(messages);
    calls.push(text);
    if (/Write the numbered plan now/.test(text)) return PLAN_REPLY;
    if (/Run only step 1/.test(text)) return `I can add that.\n\n${CARD_BLOCK}`;
    if (/Run only step 2/.test(text)) return "This must not run.";
    throw new Error(`unexpected request: ${text}`);
  };
  plugin.applyByokToolProposals = async () => {
    applied += 1;
    return { created: 1, updated: 0, errors: [] };
  };

  assert.equal(await view.startPlan("Learn algebra"), true);
  panel.approvePlanStep(0);
  panel.approvePlanStep(1);
  const running = panel.runApprovedPlan();
  const modal = await waitFor(
    () => obsidian.modals.find((item) => item instanceof AiReview && !item.closed && item.proposals.length),
    "the write review"
  );
  const reviewDom = makeDom();
  modal.contentEl = reviewDom.root;
  modal.onOpen();
  await reviewDom.click("Discard all");
  assert.equal(await running, false);

  assert.equal(applied, 0, "declined writes never reach the write path");
  assert.equal(app.files[0].text, before, "the note is byte-identical");
  assert.equal(app.modified, undefined);
  assert.equal(app.created, undefined);
  assert.deepEqual(panel.plan.steps.map((step) => step.status), ["declined", "approved", "pending"]);
  assert.equal(panel.plan.status, "paused");
  assert.equal(panel.plan.stopReason, "declined");
  assert.equal(panel.plan.stopStep, 1);
  assert.match(plan.stopMessage(panel.plan), /not applied/i);
  assert.equal(calls.length, 2, "the later approved step did not run");

  const snapshot = JSON.stringify(panel.plan);
  plugin.aiChat = async () => "I cannot make a plan for that.";
  assert.equal(await panel.startPlan("Another goal"), false);
  assert.equal(JSON.stringify(panel.plan), snapshot, "a failed plan request leaves the prior plan untouched");
  assert.equal(app.files[0].text, before);
  assert.equal(applied, 0);
});

test("plan: Stop aborts the in-flight step without writing and leaves it approved for a retry", async () => {
  resetObsidian();
  const { app, plugin, view } = await openView();
  const panel = view.chatPanel;
  plugin.aiChat = async (_system, messages, opts) => {
    const text = lastUser(messages);
    if (/Write the numbered plan now/.test(text)) return PLAN_REPLY;
    return new Promise((resolve, reject) => {
      const signal = opts && opts.signal;
      if (!signal) {
        resolve("no signal");
        return;
      }
      signal.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      });
    });
  };

  assert.equal(await view.startPlan("Learn algebra"), true);
  panel.approvePlanStep(0);
  const running = panel.runApprovedPlan();
  await waitFor(() => panel.busy, "the step request to start");
  assert.equal(panel.stopPlan(), true);
  assert.equal(await running, false);

  assert.deepEqual(panel.plan.steps.map((step) => step.status), ["approved", "pending", "pending"]);
  assert.equal(panel.plan.status, "paused");
  assert.equal(panel.plan.stopReason, "aborted");
  assert.match(plan.stopMessage(panel.plan), /No later step was run/i);
  assert.equal(app.modified, undefined);
  assert.equal(app.created, undefined);
});

test("plan: empty output, prose, empty steps and a provider error all leave the prior plan untouched", async () => {
  resetObsidian();
  const { plugin, view } = await openView();
  const panel = view.chatPanel;
  plugin.aiChat = async () => PLAN_REPLY;
  assert.equal(await panel.startPlan("Prior goal"), true);
  const prior = JSON.stringify(panel.plan);

  for (const reply of ["I cannot help with that.", "Here is a plan:\n\n- one\n\nThanks.", "1.\n2.\n", "NO_PLAN"]) {
    plugin.aiChat = async () => reply;
    assert.equal(await panel.startPlan("Degraded goal"), false);
    assert.equal(JSON.stringify(panel.plan), prior, "a degraded reply changes nothing");
  }
  assert.match(panel.status.__own.meta.text, /nothing was run|numbered plan|declined to plan/i);

  plugin.aiChat = async () => {
    throw new Error("provider down");
  };
  assert.equal(await panel.startPlan("Degraded goal"), false);
  assert.equal(JSON.stringify(panel.plan), prior);
  assert.match(panel.status.__own.meta.text, /provider|plan|failed/i);
});

test("plan: the panel renders per-step Approve and Skip controls and a skipped step never runs", async () => {
  resetObsidian();
  const { plugin, view, shell } = await openView();
  const panel = view.chatPanel;
  const calls = [];
  plugin.aiChat = async (_system, messages) => {
    const text = lastUser(messages);
    calls.push(text);
    if (/Write the numbered plan now/.test(text)) return PLAN_REPLY;
    if (/Run only step 1/.test(text)) return "Summary only.";
    throw new Error(`unexpected request: ${text}`);
  };

  assert.equal(await view.startPlan("Learn algebra"), true);
  assert.equal(shell.find("Approve").length, 3);
  assert.equal(shell.find("Skip").length, 3);
  assert.ok(shell.find("Run approved").length >= 1);

  assert.equal(panel.approvePlanStep(0), true);
  assert.equal(panel.skipPlanStep(1), true);
  assert.equal(await panel.runApprovedPlan(), true);
  assert.deepEqual(panel.plan.steps.map((step) => step.status), ["done", "skipped", "pending"]);
  assert.equal(calls.length, 2, "the plan request and the one approved step");
  assert.match(plan.stopMessage(panel.plan), /not approved/i);

  const runs = shell.find("Run approved");
  assert.ok(runs[runs.length - 1].handlers.some((handler) => handler.ev === "click"));
});

test("plan: the command is registered, asks for a goal and forwards it to the Study agent", async () => {
  resetObsidian();
  const { app, plugin } = await openView();
  const command = plugin.commands.find((item) => item.id === "study-agent-plan");
  assert.ok(command, "Study agent: plan a multi-step task is registered");
  assert.match(command.name, /plan a multi-step task/i);

  const goals = [];
  plugin.activateAgent = async () => ({
    startPlan: async (goal) => {
      goals.push(goal);
      return Boolean(goal);
    },
  });
  assert.equal(await plugin.startAgentPlan("Read chapter 2"), true);
  assert.equal(await plugin.startAgentPlan(""), false);
  assert.deepEqual(goals, ["Read chapter 2", ""]);

  plugin.settings.ai.enabled = false;
  assert.equal(await plugin.promptStudyPlan(), false);
  assert.ok(obsidian.notices.some((text) => /Turn on AI/i.test(text)));
  plugin.settings.ai.enabled = true;
  assert.equal(await plugin.promptStudyPlan(), true);
  assert.ok(obsidian.modals.some((modal) => modal.title === "Plan a multi-step task"));
  assert.ok(app);
});
