"use strict";
/*
 * The beginner connection form shared by the practice setup screen and the
 * import help modal. It uses the same fetch/test helpers as Settings:
 * recommended provider -> Create a key -> paste -> Fetch models (one is chosen)
 * -> Test connection -> Continue. Paste questions stays available throughout.
 */
const { API_PRESETS } = require("./api-client");
const { normalizeModelList } = require("./model-discovery");
const { hasSecretStorage, resolveApiKey } = require("./secret-keys");
const { openExternal } = require("./settings-ui");
const {
  applyProvider,
  connectionProblem,
  fetchModels,
  isRecommendedProvider,
  keyPageHost,
  keyPageUrl,
  providerLabel,
  recommendedProvider,
  testConnection,
} = require("./ai-connection");
const { str } = require("./util");

function renderAiConnectionForm(container, options) {
  const opts = options || {};
  const plugin = opts.plugin;
  const onReady = opts.onReady || (() => {});
  const onUseOpenCode = opts.onUseOpenCode || null;
  const ai = plugin.settings.ai || (plugin.settings.ai = {});
  if (!ai.api) ai.api = {};
  if (!ai.api.provider) ai.api.provider = recommendedProvider();
  const api = ai.api;

  let pendingKey = "";
  let tested = false;
  let busy = false;
  let error = "";
  let notice = "";
  let otherVisible = false;
  let allowConfigured = false;

  const presetAtStart = API_PRESETS[api.provider] || API_PRESETS.custom;
  const startKey = presetAtStart.noKey ? "local" : resolveApiKey(plugin.app, api);
  allowConfigured = !!startKey && !!str(api.model).trim();

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
  const canContinue = () => !busy && !!currentKey() && !!currentModel() && (tested || allowConfigured);

  function statusText() {
    if (error) return error;
    if (notice) return notice;
    if (busy) return "Working…";
    if (tested) return `Connected. ${currentModel()} is ready. Continue to import.`;
    if (allowConfigured) return "Ready. Test the connection, then continue.";
    if (!currentKey()) return "Paste your key, then press Fetch models.";
    if (!currentModel()) return "Press Fetch models and one is chosen for you.";
    return "Press Test connection to check the key and model.";
  }

  function draw() {
    container.empty();
    const body = container;
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
        ? `${providerLabel(provider)} is recommended for a first setup: it works on desktop and phone, and Fetch models chooses one for you.`
        : `${providerLabel(provider)} uses the key from its own dashboard.`,
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

    let continueBtn = null;
    let statusEl = null;
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

    body
      .createEl("button", { text: "Paste questions instead (works offline)", cls: "qt-ai-connect-offline" })
      .addEventListener("click", () => {
        if (typeof opts.onOffline === "function") opts.onOffline();
        plugin.openQuickAdd();
      });

    const advanced = body.createEl("details", { cls: "qt-ai-connect-advanced" });
    advanced.createEl("summary", { text: "Use the OpenCode agent instead" });
    advanced.createDiv({
      cls: "qt-hint",
      text: "OpenCode runs on this computer and needs its own provider. It can read notes and use tools, which the direct key path does not. Configure it once in settings.",
    });
    advanced.createEl("button", { text: "Open OpenCode settings" }).addEventListener("click", async () => {
      ai.backend = "opencode";
      ai.enabled = true;
      await plugin.save();
      if (typeof onUseOpenCode === "function") onUseOpenCode();
      plugin.openSettings();
    });
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
      error = !currentKey() ? "Paste your API key first, or use Create a key." : "Test the connection before continuing.";
      notice = "";
      draw();
      return;
    }
    ai.backend = "api";
    ai.enabled = true;
    try {
      await plugin.save();
    } catch (e) {
      error = connectionProblem(e, api.provider);
      draw();
      return;
    }
    await Promise.resolve(onReady({ provider: api.provider, model: currentModel() }));
  }

  draw();
  return { redraw: draw };
}

module.exports = { renderAiConnectionForm };
