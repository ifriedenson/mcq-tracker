"use strict";
/*
 * The beginner connection form shared by the practice setup screen and the
 * import help modal. Desktop setups start with OpenCode, the full study agent,
 * and can install it here without a detour through Settings. Direct API stays
 * one click away and is the only backend on phones. Both paths finish with a
 * tested connection before the importer opens, and paste-question stays visible.
 */
const { Platform } = require("obsidian");
const { API_PRESETS } = require("./api-client");
const { normalizeModelList } = require("./model-discovery");
const { hasSecretStorage, resolveApiKey } = require("./secret-keys");
const { openExternal } = require("./settings-ui");
const { PROVIDERS } = require("./opencode-manager");
const {
  applyProvider,
  connectionProblem,
  fetchModels,
  isRecommendedProvider,
  keyPageHost,
  keyPageUrl,
  openCodeInstalled,
  openCodeProblem,
  recommendedProvider,
  saveOpenCodeProviderKey,
  testConnection,
  testOpenCode,
} = require("./ai-connection");
const { str } = require("./util");

function renderAiConnectionForm(container, options) {
  const opts = options || {};
  const plugin = opts.plugin;
  const onReady = opts.onReady || (() => {});
  const ai = plugin.settings.ai || (plugin.settings.ai = {});
  if (!ai.api) ai.api = {};
  if (!ai.api.provider) ai.api.provider = recommendedProvider();
  const api = ai.api;
  const canUseOpenCode = Platform.isDesktopApp === true;

  let mode = canUseOpenCode && ai.backend === "opencode" ? "opencode" : "api";
  let pendingKey = "";
  let tested = false;
  let busy = false;
  let error = "";
  let notice = "";
  let otherVisible = false;
  let allowConfigured = false;
  let statusEl = null;
  let continueBtn = null;
  let ocProvider = PROVIDERS[0][0];
  let ocKey = "";

  const preset = () => API_PRESETS[api.provider] || API_PRESETS.custom;
  const local = () => preset().noKey === true;
  const savedKey = () => {
    try {
      return resolveApiKey(plugin.app, api);
    } catch (e) {
      return "";
    }
  };
  const currentKey = () => (local() ? "local" : pendingKey.trim() || savedKey());
  const currentModel = () => str(api.model).trim();
  const apiConfigured = () => !!currentModel() && (local() || !!savedKey());
  const canContinue = () => !busy && (mode === "opencode" ? tested : !!currentKey() && !!currentModel() && (tested || allowConfigured));

  if (mode === "api") allowConfigured = apiConfigured();

  function statusText() {
    if (error) return error;
    if (notice) return notice;
    if (busy) return "Working…";
    if (mode === "opencode") {
      if (tested) return "OpenCode is connected. Continue to import.";
      return openCodeInstalled(plugin) ? "Test OpenCode before continuing." : "Install OpenCode, then test it before continuing.";
    }
    if (tested) return `Connected. ${currentModel()} is ready. Continue to import.`;
    if (allowConfigured) return "Ready. Test the connection, then continue.";
    if (!currentKey()) return "Paste your key, then press Fetch models.";
    if (!currentModel()) return "Press Fetch models and one is chosen for you.";
    return "Press Test connection to check the key and model.";
  }

  function draw() {
    container.empty();
    const body = container;
    drawPaths(body);
    if (mode === "opencode") drawOpenCode(body);
    else drawApi(body);
    drawOffline(body);
  }

  function drawPaths(body) {
    if (!canUseOpenCode) return;
    const paths = body.createDiv({ cls: "qt-ai-connect-paths" });
    const add = (id, label) => {
      const button = paths.createEl("button", {
        text: label,
        cls: `qt-ai-connect-path${mode === id ? " is-selected" : ""}`,
      });
      button.setAttr("aria-pressed", mode === id ? "true" : "false");
      button.disabled = busy;
      button.addEventListener("click", () => switchMode(id));
    };
    add("opencode", "OpenCode (recommended)");
    add("api", "Direct API key");
  }

  async function switchMode(next) {
    if (busy || next === mode) return;
    mode = next;
    tested = false;
    error = "";
    notice = "";
    otherVisible = false;
    allowConfigured = mode === "api" && apiConfigured();
    if (mode === "api") {
      ai.backend = "api";
      await plugin.save();
    }
    draw();
  }

  function drawApi(body) {
    const provider = api.provider;
    const kind = preset();

    body.createDiv({ cls: "qt-label", text: "AI provider" });
    const providerSelect = body.createEl("select", { cls: "qt-select", attr: { "aria-label": "AI provider" } });
    for (const [id, item] of Object.entries(API_PRESETS)) {
      const recommended = isRecommendedProvider(id) ? " — recommended" : "";
      providerSelect.createEl("option", { value: id, text: `${item.label}${recommended}` });
    }
    providerSelect.value = provider;
    providerSelect.disabled = busy;
    providerSelect.addEventListener("change", async () => {
      applyProvider(ai, providerSelect.value);
      pendingKey = "";
      tested = false;
      error = "";
      notice = "";
      otherVisible = false;
      allowConfigured = false;
      await plugin.save();
      draw();
    });

    body.createDiv({
      cls: "qt-hint",
      text: isRecommendedProvider(provider)
        ? `${providerLabelFor(provider)} is recommended for a first key setup: it works on desktop and phone, and Fetch models chooses one for you.`
        : `${providerLabelFor(provider)} uses the key from its own dashboard.`,
    });

    const keyUrl = keyPageUrl(provider);
    if (keyUrl) {
      const host = keyPageHost(provider);
      const create = body.createEl("button", { text: "Create a key ↗", cls: "qt-ai-connect-create" });
      create.setAttr("aria-label", "Create an API key in your browser");
      create.addEventListener("click", () => openExternal(keyUrl));
      body.createDiv({
        cls: "qt-hint",
        text: `Opens ${host} in your browser. Sign in, create a key, copy it, then paste it below. This page stays in Obsidian.`,
      });
    }

    if (kind.kind === "openai" && !kind.base) {
      body.createDiv({ cls: "qt-label", text: "Server address" });
      const url = body.createEl("input", {
        type: "text",
        cls: "qt-fsearch",
        attr: { placeholder: "https://.../v1", "aria-label": "Server address" },
      });
      url.value = api.baseUrl || "";
      url.disabled = busy;
      url.addEventListener("input", () => {
        api.baseUrl = url.value.trim();
        tested = false;
        allowConfigured = false;
        if (continueBtn) continueBtn.disabled = !canContinue();
        if (statusEl) statusEl.setText(statusText());
      });
    }

    if (!local()) {
      body.createDiv({ cls: "qt-label", text: "API key" });
      const keyInput = body.createEl("input", {
        type: "password",
        cls: "qt-fsearch",
        attr: {
          placeholder: savedKey() ? "Using a saved key — paste a new one to replace it" : "Paste your key",
          "aria-label": "API key",
        },
      });
      keyInput.value = pendingKey;
      keyInput.disabled = busy;
      keyInput.addEventListener("input", () => {
        pendingKey = keyInput.value;
        tested = false;
        allowConfigured = false;
        error = "";
        if (continueBtn) continueBtn.disabled = !canContinue();
        if (statusEl) statusEl.setText(statusText());
      });
      body.createDiv({
        cls: "qt-hint",
        text: hasSecretStorage(plugin.app)
          ? "Saved in Obsidian's Secret Storage, outside data.json."
          : "Saved as plain text in this plugin's data.json, which syncs with your vault.",
      });
    } else {
      body.createDiv({ cls: "qt-hint", text: "No key needed. Start the local server first, then fetch its models." });
    }

    const actions = body.createDiv({ cls: "qt-ai-connect-actions" });
    const fetchBtn = actions.createEl("button", { text: "Fetch models" });
    fetchBtn.disabled = busy;
    fetchBtn.addEventListener("click", async () => {
      await runFetch();
    });
    const testBtn = actions.createEl("button", { text: "Test connection", cls: "mod-cta" });
    testBtn.disabled = busy;
    testBtn.addEventListener("click", async () => {
      await runTest();
    });

    statusEl = body.createDiv({
      cls: `qt-ai-connect-status${error ? " is-error" : tested ? " is-ok" : ""}`,
      text: statusText(),
    });

    body.createDiv({ cls: "qt-label", text: "Model" });
    const modelSelect = body.createEl("select", { cls: "qt-select", attr: { "aria-label": "Model" } });
    const ids = [];
    const add = (id) => {
      const value = str(id).trim();
      if (value && !ids.includes(value)) ids.push(value);
    };
    add(currentModel());
    add(kind.defaultModel);
    for (const id of normalizeModelList(api.models)) add(id);
    modelSelect.createEl("option", {
      value: "",
      text: currentModel() || ids.length ? "Choose a model" : "No model yet — press Fetch models",
    });
    for (const id of ids) modelSelect.createEl("option", { value: id, text: id });
    modelSelect.createEl("option", { value: "__other__", text: "Other model…" });
    modelSelect.value = otherVisible ? "__other__" : currentModel() && ids.includes(currentModel()) ? currentModel() : currentModel() ? "__other__" : "";
    modelSelect.disabled = busy;
    modelSelect.addEventListener("change", () => {
      if (modelSelect.value === "__other__") {
        otherVisible = true;
        draw();
        return;
      }
      api.model = modelSelect.value;
      tested = false;
      allowConfigured = false;
      error = "";
      notice = "";
      if (continueBtn) continueBtn.disabled = !canContinue();
      if (statusEl) {
        statusEl.setText(statusText());
        statusEl.toggleClass("is-ok", false);
        statusEl.toggleClass("is-error", false);
      }
    });
    body.createDiv({
      cls: "qt-hint",
      text: ids.length > 1 ? "Chosen from the provider's list. You can change it, but the picked model is a safe default." : "Fetch models fills this in from the provider.",
    });

    if (otherVisible) {
      body.createDiv({ cls: "qt-label", text: "Model name" });
      const other = body.createEl("input", {
        type: "text",
        cls: "qt-fsearch",
        attr: { placeholder: "exact model id", "aria-label": "Model name" },
      });
      other.value = currentModel();
      other.disabled = busy;
      other.addEventListener("input", () => {
        api.model = other.value.trim();
        tested = false;
        allowConfigured = false;
        error = "";
        if (continueBtn) continueBtn.disabled = !canContinue();
        if (statusEl) statusEl.setText(statusText());
      });
    }

    continueBtn = body.createEl("button", { text: "Continue to import", cls: "mod-cta qt-primary" });
    continueBtn.disabled = !canContinue();
    continueBtn.addEventListener("click", async () => {
      await finish();
    });
  }

  function drawOpenCode(body) {
    const manual = ai.managed === false;
    const installed = openCodeInstalled(plugin);

    body.createDiv({ cls: "qt-label", text: "OpenCode agent" });
    body.createDiv({
      cls: "qt-hint",
      text:
        "OpenCode is the recommended desktop setup. It runs on this computer, can read notes and use tools, and keeps its provider login in OpenCode's own config.",
    });

    if (!installed) {
      body.createDiv({
        cls: "qt-hint",
        text:
          "The installer downloads the supported OpenCode 1.x build from GitHub, checks its SHA-256, and keeps it outside your vault. It only runs while Obsidian is open.",
      });
      const install = body.createEl("button", { text: "Install OpenCode", cls: "mod-cta qt-primary" });
      install.disabled = busy;
      install.addEventListener("click", async () => {
        await installOpenCode();
      });
    } else {
      body.createDiv({
        cls: "qt-hint",
        text: manual
          ? `Using the OpenCode server you configured at ${ai.url || "http://127.0.0.1:4096"}.`
          : `OpenCode is installed${ai.installedVersion ? ` (v${ai.installedVersion})` : ""}.`,
      });

      body.createDiv({ cls: "qt-label", text: "OpenCode provider" });
      const providerSelect = body.createEl("select", { cls: "qt-select", attr: { "aria-label": "OpenCode provider" } });
      for (const [id, label] of PROVIDERS) providerSelect.createEl("option", { value: id, text: label });
      providerSelect.value = ocProvider;
      providerSelect.disabled = busy;
      providerSelect.addEventListener("change", () => {
        ocProvider = providerSelect.value;
      });

      body.createDiv({ cls: "qt-hint", text: "Paste a provider key, or skip this if OpenCode is already signed in." });
      const keyInput = body.createEl("input", {
        type: "password",
        cls: "qt-fsearch",
        attr: { placeholder: "Paste provider key (optional)", "aria-label": "OpenCode provider key" },
      });
      keyInput.value = ocKey;
      keyInput.disabled = busy;
      keyInput.addEventListener("input", () => {
        ocKey = keyInput.value;
      });
      const save = body.createEl("button", { text: "Save provider key" });
      save.disabled = busy || !ocKey.trim();
      keyInput.addEventListener("input", () => {
        save.disabled = busy || !ocKey.trim();
      });
      save.addEventListener("click", async () => {
        try {
          error = "";
          saveOpenCodeProviderKey(plugin, ocProvider, ocKey);
          ocKey = "";
          tested = false;
          notice = "Provider key saved. Press Test OpenCode to start it and check the connection.";
          draw();
        } catch (e) {
          error = openCodeProblem(e, plugin);
          notice = "";
          draw();
        }
      });

      const actions = body.createDiv({ cls: "qt-ai-connect-actions" });
      const test = actions.createEl("button", { text: "Test OpenCode", cls: "mod-cta" });
      test.disabled = busy;
      test.addEventListener("click", async () => {
        await runOpenCodeTest();
      });
      const settings = actions.createEl("button", { text: "More AI settings" });
      settings.disabled = busy;
      settings.addEventListener("click", () => plugin.openSettings());
    }

    statusEl = body.createDiv({
      cls: `qt-ai-connect-status${error ? " is-error" : tested ? " is-ok" : ""}`,
      text: statusText(),
    });

    continueBtn = body.createEl("button", { text: "Continue to import", cls: "mod-cta qt-primary" });
    continueBtn.disabled = !canContinue();
    continueBtn.addEventListener("click", async () => {
      await finish();
    });
  }

  function drawOffline(body) {
    body
      .createEl("button", { text: "Paste questions instead (works offline)", cls: "qt-ai-connect-offline" })
      .addEventListener("click", () => {
        if (typeof opts.onOffline === "function") opts.onOffline();
        plugin.openQuickAdd();
      });
  }

  async function installOpenCode() {
    if (busy) return;
    busy = true;
    tested = false;
    allowConfigured = false;
    error = "";
    notice = "Preparing the OpenCode download…";
    draw();
    try {
      const result = await plugin.installOpenCodeFromWelcome(
        (message) => {
          notice = message;
          if (statusEl) statusEl.setText(message);
        },
        { enable: false }
      );
      const version = result && result.version ? ` v${result.version}` : "";
      notice = result && result.already ? "OpenCode is installed. Test it before continuing." : `OpenCode${version} installed. Test it before continuing.`;
    } catch (e) {
      error = openCodeProblem(e, plugin);
      notice = "";
    } finally {
      busy = false;
      draw();
    }
  }

  async function runOpenCodeTest() {
    if (!openCodeInstalled(plugin)) {
      error = "Install OpenCode first.";
      notice = "";
      draw();
      return;
    }
    busy = true;
    tested = false;
    error = "";
    notice = "Starting OpenCode and checking the connection…";
    draw();
    try {
      const result = await testOpenCode(plugin, {
        progress: (message) => {
          notice = message;
          if (statusEl) statusEl.setText(message);
        },
      });
      const version = result && result.health && result.health.version ? ` ${result.health.version}` : "";
      tested = true;
      notice = `Connected to OpenCode${version}. Continue to import.`;
    } catch (e) {
      tested = false;
      error = openCodeProblem(e, plugin);
      notice = "";
    } finally {
      busy = false;
      draw();
    }
  }

  async function runFetch() {
    error = "";
    notice = "Finding models…";
    busy = true;
    draw();
    try {
      const found = await fetchModels(plugin, { key: pendingKey, autoPick: true });
      pendingKey = "";
      allowConfigured = false;
      tested = false;
      const skipped = found.skipped ? ` Skipped ${found.skipped} non-chat model${found.skipped === 1 ? "" : "s"}.` : "";
      notice = `Found ${found.models.length} chat model${found.models.length === 1 ? "" : "s"}. Chose ${found.model}.${skipped} Now test the connection.`;
    } catch (e) {
      error = connectionProblem(e, api.provider);
      notice = "";
    } finally {
      busy = false;
      draw();
    }
  }

  async function runTest() {
    if (!currentKey()) {
      error = "Paste your API key first, or use Create a key.";
      notice = "";
      draw();
      return;
    }
    error = "";
    notice = "Checking the connection…";
    busy = true;
    draw();
    try {
      if (!currentModel()) {
        const found = await fetchModels(plugin, { key: pendingKey, autoPick: true });
        pendingKey = "";
        allowConfigured = false;
        if (!found.model) throw new Error("The provider returned an empty model list.");
      }
      const reply = await testConnection(plugin, { key: pendingKey });
      pendingKey = "";
      allowConfigured = false;
      tested = true;
      notice = `Connected. ${currentModel()} replied “${reply.slice(0, 40) || "OK"}”. Continue to import.`;
    } catch (e) {
      tested = false;
      error = connectionProblem(e, api.provider);
      notice = "";
    } finally {
      busy = false;
      draw();
    }
  }

  async function finish() {
    if (!canContinue()) {
      error = mode === "opencode" ? "Test OpenCode before continuing." : !currentKey() ? "Paste your API key first, or use Create a key." : "Test the connection before continuing.";
      notice = "";
      draw();
      return;
    }
    ai.enabled = true;
    ai.backend = mode;
    try {
      await plugin.save();
    } catch (e) {
      error = mode === "opencode" ? openCodeProblem(e, plugin) : connectionProblem(e, api.provider);
      draw();
      return;
    }
    await Promise.resolve(onReady(mode === "opencode" ? { backend: "opencode" } : { provider: api.provider, model: currentModel() }));
  }

  draw();
  return { redraw: draw };
}

/* Kept local so the provider label lookup stays with the form's imports. */
function providerLabelFor(id) {
  const preset = API_PRESETS[id];
  return preset ? preset.label : "This provider";
}

module.exports = { renderAiConnectionForm };
