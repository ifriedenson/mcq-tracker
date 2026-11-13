"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();

async function apiPanel(extra) {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "api";
  plugin.aiChat = async () => "Answer";
  const dom = makeDom();
  const view = { plugin, app, md() {} };
  const panel = new T.ChatPanel(
    view,
    dom.root,
    Object.assign(
      {
        title: "Study agent",
        sourcePath: "",
        getSessionId: () => "",
        setSessionId: () => {},
        getRole: () => "private",
        setRole: () => {},
        buildContext: () => "BASE",
        getApiHistory: () => [],
        saveApiHistory: () => {},
        quick: [],
      },
      extra || {}
    )
  );
  return { panel, dom, plugin, app, view };
}

test("study agent empty state: stacked suggestion cards rotate through all actions", async () => {
  const { panel } = await apiPanel();
  assert.ok(panel.emptyDeck, "the card deck is the empty state");
  assert.equal(panel.suggestionItems().length, 3);

  const activeCard = () =>
    panel.emptyDeck.children.find(
      (card) => card.meta && card.meta.attr && card.meta.attr["aria-hidden"] === "false"
    );
  assert.ok(activeCard(), "one front card is visible");
  const first = panel.suggestionItems()[0].title;
  assert.ok(activeCard().children.some((child) => child.meta.text === first));

  panel.showSuggestion(1);
  const second = panel.suggestionItems()[1].title;
  assert.equal(panel.suggestionIndex, 1);
  assert.ok(activeCard().children.some((child) => child.meta.text === second));
  assert.equal(panel.emptyDeck.children.filter((card) => card.meta.attr["aria-hidden"] === "false").length, 1);
});

test("study agent empty state: the caller's quick actions seed the card deck", async () => {
  const { panel } = await apiPanel({
    quick: [{ label: "Ask about this note", run() {} }],
  });
  assert.equal(panel.suggestionItems()[0].title, "Ask about this note");
  assert.equal(typeof panel.suggestionItems()[0].run, "function");
  assert.equal(panel.suggestionItems()[1].title, "Quiz me on it");
});

test("study agent transcript: tool lines render as status cards with tool, detail and state", async () => {
  const { panel, dom } = await apiPanel();
  panel.turns = [{ role: "assistant", texts: ["Done."], tools: ["read · completed · Biology/Cells.md"] }];
  panel.sig = "";
  panel.draw();

  const card = dom.all.find((element) => element.classes && element.classes.has("qt-agent-tool-card"));
  assert.ok(card, "the tool row is a card");
  assert.equal(card.classes.has("is-done"), true);
  assert.ok(dom.texts().includes("Read file"));
  assert.ok(dom.texts().includes("Biology/Cells.md"));
  assert.ok(dom.texts().includes("Done"));
});

test("study agent transcript: code fences are delegated to the view Markdown renderer", async () => {
  const { panel, view, dom } = await apiPanel();
  const seen = [];
  view.md = (text, el) => {
    seen.push(text);
    el.setText(text);
  };
  panel.turns = [
    { role: "user", texts: ["Show me:\n```js\nconst x = 1;\n```"], tools: [] },
    { role: "assistant", texts: ["Here:\n```js\nconst y = 2;\n```"], tools: [] },
  ];
  panel.sig = "";
  panel.draw();

  assert.equal(seen.length, 2, "both roles go through the Obsidian Markdown renderer");
  assert.match(seen[0], /```js\nconst x = 1;\n```/);
  assert.match(seen[1], /```js\nconst y = 2;\n```/);
  assert.equal(
    dom.all.filter((element) => element.classes && element.classes.has("markdown-rendered")).length,
    2,
    "both rendered bodies carry Obsidian's Markdown container class"
  );
});

test("study agent transcript: streaming text carries an animated caret", async () => {
  const { panel, dom } = await apiPanel();
  panel.busy = true;
  panel.streamText = "Partial reply";
  panel.sig = "";
  panel.draw();

  assert.ok(dom.all.some((element) => element.classes && element.classes.has("qt-agent-caret")));
  assert.ok(
    dom.all.some(
      (element) => element.classes && element.classes.has("qt-msg") && element.classes.has("is-streaming")
    )
  );
});

test("study agent transcript: proposed edits show a compact line diff and a review state", async () => {
  const { panel, dom } = await apiPanel();
  panel.turns = [{ role: "assistant", texts: ["I changed the note."], tools: [] }];
  panel.proposalCard = {
    kind: "edits",
    status: "pending",
    changes: [
      {
        path: "Biology/Cells.md",
        status: "modified",
        diff: {
          added: 1,
          removed: 1,
          lines: [
            { kind: "del", text: "old line" },
            { kind: "add", text: "new line" },
          ],
        },
      },
    ],
  };
  panel.sig = "";
  panel.draw();

  assert.ok(dom.all.some((element) => element.classes && element.classes.has("qt-agent-proposal")));
  assert.ok(dom.all.some((element) => element.classes && element.classes.has("is-pending")));
  assert.ok(dom.texts().some((text) => text.includes("+new line")));
  assert.ok(dom.texts().some((text) => text.includes("-old line")));
  assert.ok(dom.texts().includes("Biology/Cells.md"));
  assert.ok(dom.texts().includes("Nothing is written until you apply the review window."));

  panel.finishProposalCard("applied");
  assert.equal(panel.proposalCard.status, "applied");
  assert.ok(dom.all.some((element) => element.classes && element.classes.has("qt-agent-proposal") && element.classes.has("is-applied")));
});

test("study agent transcript: Direct API tool proposals use the same review card", async () => {
  const { panel, dom } = await apiPanel();
  panel.turns = [{ role: "assistant", texts: ["Here is a card."], tools: [] }];
  panel.proposalCard = {
    kind: "tools",
    status: "pending",
    proposals: [{ tool: "create_card", front: "ATP", back: "Energy currency" }],
  };
  panel.sig = "";
  panel.draw();

  assert.ok(dom.texts().includes("Proposed study actions"));
  assert.ok(dom.texts().includes("New flashcard"));
  assert.ok(dom.texts().includes("Front: ATP"));
});

test("study agent layout: user turns are cards and assistant turns are flat, with no avatar/name rows", async () => {
  const { panel, dom } = await apiPanel();
  panel.turns = [
    { role: "user", texts: ["What is ATP?"], tools: [] },
    { role: "assistant", texts: ["ATP stores energy."], tools: [] },
  ];
  panel.sig = "";
  panel.draw();

  assert.equal(dom.all.some((element) => element.classes && element.classes.has("qt-agent-avatar")), false);
  assert.equal(dom.all.some((element) => element.classes && element.classes.has("qt-agent-name")), false);
  const user = dom.all.find((element) => element.classes && element.classes.has("qt-agent-message") && element.classes.has("is-user"));
  const assistant = dom.all.find((element) => element.classes && element.classes.has("qt-agent-message") && element.classes.has("is-assistant"));
  assert.ok(user, "the user turn is a full-width message card");
  assert.ok(assistant, "the assistant turn is a flat message block");
  assert.equal(user.classes.has("is-assistant"), false);
  assert.equal(assistant.classes.has("is-user"), false);
  assert.ok(dom.texts().includes("Copy"));
});

test("study agent composer: the short hint and add-context affordance are exact", async () => {
  const { panel, dom } = await apiPanel();
  assert.equal(panel.input.__own.meta.attr.placeholder, "Type a question · @ mentions · / commands");
  const add = dom.all.find((element) => (element.meta.attr || {})["aria-label"] === "Add context");
  assert.ok(add, "the add-context control is rendered");
  assert.equal(add.meta.attr["data-glyph"], "+");
  assert.equal(add.meta.attr.title, "Attach a note or folder");
  assert.equal(add.meta.text, "Add context");
});

test("study agent layout: mode and history/settings controls sit below the transcript, not in a brand header", async () => {
  const { panel, dom } = await apiPanel({ onSaveChat() {} });
  assert.equal(dom.all.some((element) => element.classes && element.classes.has("qt-agent-head")), false);
  const controls = dom.all.find((element) => element.classes && element.classes.has("qt-agent-controls"));
  assert.ok(controls, "the ChatControls strip exists");
  assert.ok(dom.all.some((element) => element.classes && element.classes.has("qt-agent-mode")));
  assert.ok(dom.all.some((element) => element.classes && element.classes.has("qt-agent-role")));
  assert.ok(panel.libraryButton, "history/chats is a control");
  assert.ok(panel.fullscreenBtn, "expand is a control");
  const settings = dom.all.find((element) => (element.meta.attr || {})["aria-label"] === "Settings");
  assert.ok(settings, "settings is surfaced in the controls strip");
  assert.equal(dom.all.some((element) => element.classes && element.classes.has("qt-agent-avatar")), false);
});

test("study agent transcript: reasoning and vault citations render as compact disclosure blocks", async () => {
  const { panel, dom, app } = await apiPanel();
  panel.turns = [
    {
      role: "assistant",
      texts: ["Cells store energy. See [[Biology/Cells.md]]."],
      tools: [],
      reasoning: ["Checked the note", "Compared the definition"],
    },
  ];
  panel.sig = "";
  panel.draw();

  assert.ok(dom.all.some((element) => element.classes && element.classes.has("qt-agent-reasoning")));
  assert.ok(dom.texts().includes("Thought for a while"));
  assert.ok(dom.texts().includes("Checked the note"));
  assert.ok(dom.texts().includes("Sources (1)"));
  assert.ok(dom.texts().includes("Biology/Cells.md"));
  await dom.click("Biology/Cells.md");
  assert.deepEqual(app.opened, ["Biology/Cells.md"]);
});

test("study agent reasoning: OpenCode reasoning parts become a separate transcript field", () => {
  const turns = T.partsToTurns([
    {
      info: { role: "assistant" },
      parts: [
        { type: "reasoning", text: "Plan the answer" },
        { type: "text", text: "The answer." },
      ],
    },
  ]);
  assert.deepEqual(turns[0].reasoning, ["Plan the answer"]);
  assert.deepEqual(turns[0].texts, ["The answer."]);
});

test("study agent phone layout: full-screen class and bottom-sheet grip are wired to existing markup", async () => {
  const { panel, dom } = await apiPanel();
  assert.ok(dom.all.some((element) => element.classes && element.classes.has("qt-agent-composer-grip")));
  assert.equal(dom.root.classes.has("qt-agent-fullscreen"), false);

  assert.equal(panel.toggleFullscreen(), true);
  assert.equal(dom.root.classes.has("qt-agent-fullscreen"), true);
  assert.equal(panel.fullscreenBtn.getAttr("aria-pressed"), "true");
  assert.equal(panel.fullscreenBtn.getAttr("aria-label"), "Exit full-screen chat");

  assert.equal(panel.toggleFullscreen(false), false);
  assert.equal(dom.root.classes.has("qt-agent-fullscreen"), false);
  assert.equal(panel.fullscreenBtn.getAttr("aria-pressed"), "false");
});

test("study agent phone layout: Escape exits full screen from the controls strip", async () => {
  const { panel, dom } = await apiPanel();
  panel.toggleFullscreen();
  assert.equal(dom.root.classes.has("qt-agent-fullscreen"), true);
  const keydown = dom.root.__own.handlers.find((handler) => handler.ev === "keydown");
  assert.ok(keydown, "the pane owns an Escape handler");

  let prevented = false;
  keydown.fn({ key: "Escape", defaultPrevented: false, preventDefault: () => (prevented = true) });
  assert.equal(prevented, true);
  assert.equal(dom.root.classes.has("qt-agent-fullscreen"), false);
  assert.equal(panel.fullscreenBtn.getAttr("aria-label"), "Open the chat full screen");
});

test("study agent error card: a missing-key failure offers the AI settings page and keeps Retry", async () => {
  const { panel, plugin, dom } = await apiPanel();
  const opened = [];
  plugin.openSettings = (page) => {
    opened.push(page || "");
  };
  panel.lastSent = "Why is the answer B?";
  panel.error = "Add your API key in the plugin settings.";
  panel.busy = false;
  panel.sig = "";
  panel.draw();

  assert.ok(dom.texts().some((text) => text === "Retry"));
  assert.ok(dom.texts().some((text) => text === "Open settings"));
  await dom.click("Open settings");
  assert.deepEqual(opened, ["mcq-ai"], "the error card opens the AI settings page directly");
});

test("study agent error card: every settings-fix provider failure offers Retry and the AI settings page", async () => {
  const cases = [
    ["Add your API key in the plugin settings.", "missing key"],
    ["Add a base URL in the plugin settings.", "missing base URL"],
    ["Add a model name in the plugin settings.", "missing model"],
    [
      "OpenCode has no AI provider connected yet. Open Settings > Study agent > AI and the assistant, choose a provider and paste an API key.",
      "OpenCode without a provider",
    ],
    ["OpenCode rejected the username or password. Check the plugin settings.", "OpenCode credential rejection"],
    [
      "The provider rejected the API key, or the key can't use this model. HTTP 401: Incorrect API key provided.",
      "provider key/model rejection",
    ],
    [
      "The provider did not find that model or endpoint. Check the model name and base URL in settings. HTTP 404: model not found",
      "provider unknown model",
    ],
    [
      "The provider rejected the request. Check the model name and request limits in settings. HTTP 400: model gpt-test does not support this request",
      "provider model or limit rejection",
    ],
    [
      "OpenCode returned 404 for GET /session. This usually means the OpenCode version doesn't match the plugin (it works with OpenCode 1.x). In the plugin settings press Download and install, or switch AI backend to Direct API.",
      "OpenCode version mismatch",
    ],
    ["Enter a valid http:// or https:// address.", "invalid base URL"],
    ["Do not put a username or password in the address; use the separate fields.", "credentials in base URL"],
    [
      "Remote API and OpenCode addresses must use https://. Plain http:// is allowed only for localhost, 127.0.0.1 or ::1.",
      "plain-http remote base URL",
    ],
  ];

  for (const [message, label] of cases) {
    const { panel, plugin, dom } = await apiPanel();
    const opened = [];
    plugin.openSettings = (page) => opened.push(page || "");
    let retries = 0;
    panel.retry = () => {
      retries += 1;
    };
    panel.lastSent = "Why is the answer B?";
    panel.busy = false;
    panel.sig = "";
    panel.setError(message, { code: "ai-config" });
    assert.equal(panel.errorConfig, true, `${label}: the structured error kind survives`);
    panel.draw();

    assert.ok(dom.texts().some((text) => text === "Retry"), `${label}: Retry is still drawn`);
    assert.ok(dom.texts().some((text) => text === "Open settings"), `${label}: Open settings is drawn`);
    await dom.click("Retry");
    assert.equal(retries, 1, `${label}: Retry stays wired`);
    await dom.click("Open settings");
    assert.deepEqual(opened, ["mcq-ai"], `${label}: Open settings goes straight to AI settings`);
  }
});

test("study agent error card: an OpenCode reply that says a provider is connected still offers settings", async () => {
  const { panel, plugin, dom } = await apiPanel();
  const opened = [];
  plugin.openSettings = (page) => opened.push(page || "");
  panel.lastSent = "Why is the answer B?";
  panel.busy = false;
  panel.sig = "";
  panel.setError(
    "OpenCode didn't finish the request at http://127.0.0.1:4096. Check that OpenCode is running and a provider is connected, then try again."
  );
  panel.draw();

  assert.ok(dom.texts().some((text) => text === "Retry"));
  assert.ok(dom.texts().some((text) => text === "Open settings"));
  await dom.click("Open settings");
  assert.deepEqual(opened, ["mcq-ai"]);
});

test("study agent error card: a settings-fix error kind wins even when the message does not say settings", async () => {
  const { panel, plugin, dom } = await apiPanel();
  const opened = [];
  plugin.openSettings = (page) => opened.push(page || "");
  panel.lastSent = "Why is the answer B?";
  panel.busy = false;
  panel.sig = "";
  panel.setError("Remote API and OpenCode addresses must use https://.", { code: "ai-config" });
  panel.draw();

  assert.ok(dom.texts().some((text) => text === "Retry"));
  assert.ok(dom.texts().some((text) => text === "Open settings"));
  await dom.click("Open settings");
  assert.deepEqual(opened, ["mcq-ai"]);
});

test("study agent off state: names the setting and draws a working settings button", async () => {
  const { panel, plugin, dom } = await apiPanel();
  const opened = [];
  plugin.openSettings = (page) => {
    opened.push(page || "");
  };
  panel.ai.enabled = false;
  panel.build();

  assert.ok(dom.texts().some((text) => text.includes("AI is turned off")));
  assert.ok(dom.texts().some((text) => text.includes("Settings → Study agent → AI and the assistant")));
  await dom.click("Open settings");
  assert.deepEqual(opened, ["mcq-ai"], "the off state opens the AI settings page directly");
});
