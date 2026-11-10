"use strict";
/*
 * One shared implementation for the Direct AI connection: which provider to
 * recommend, where its key page lives, how a sensible model is chosen, and the
 * one fetch/test pair used by the practice wizard, the import help modal and
 * Settings. Nothing here renders UI, so every surface behaves the same.
 */
const { API_PRESETS, ApiClient, friendlyApiError } = require("./api-client");
const { normalizeModelList } = require("./model-discovery");
const { PROVIDERS } = require("./opencode-manager");
const { HEALTH_TIMEOUT_MS, friendlyError } = require("./opencode-client");
const { storeApiKey } = require("./secret-keys");
const { str } = require("./util");

const RECOMMENDED_PROVIDER = "anthropic";

/* The page a beginner needs: sign in, create a key, copy it. No other lookup. */
const KEY_PAGES = {
  anthropic: "https://console.anthropic.com/settings/keys",
  openai: "https://platform.openai.com/api-keys",
  openrouter: "https://openrouter.ai/keys",
  together: "https://api.together.xyz/settings/api-keys",
  google: "https://aistudio.google.com/app/apikey",
  qwen: "https://modelstudio.console.alibabacloud.com/model/settings/api-key",
};

function providerPreset(provider) {
  return API_PRESETS[str(provider).trim()] || API_PRESETS.custom;
}

function providerLabel(provider) {
  return providerPreset(provider).label;
}

function recommendedProvider() {
  return RECOMMENDED_PROVIDER;
}

function isRecommendedProvider(provider) {
  return str(provider).trim() === RECOMMENDED_PROVIDER;
}

/** True when the managed install or a manually configured OpenCode is present. */
function openCodeInstalled(plugin) {
  const ai = (plugin && plugin.settings && plugin.settings.ai) || {};
  if (ai.managed === false) return true; // a server you run yourself is checked by Test OpenCode
  return !!(ai.managedBinary || ai.binaryPath || (plugin && plugin.manager && plugin.manager.foundPath));
}

/**
 * Start the selected OpenCode transport and return the client to probe.
 * Managed mode must start the plugin's server before openCode() is called:
 * openCode() falls back to the manual/default ai.url when the managed
 * connection is not up, which is not an endpoint a managed user configured.
 */
async function ensureOpenCodeClient(plugin, options) {
  const opts = options || {};
  const ai = (plugin && plugin.settings && plugin.settings.ai) || {};
  if (!plugin || typeof plugin.openCode !== "function") throw new Error("OpenCode setup is not available on this device.");
  if (ai.managed !== false) {
    if (!plugin.manager || typeof plugin.manager.ensure !== "function") throw new Error("The OpenCode installer is not available.");
    await plugin.manager.ensure(opts.progress);
  }
  return plugin.openCode();
}

/** Start OpenCode and check that it answers and has at least one provider. */
async function testOpenCode(plugin, options) {
  const opts = options || {};
  const ai = (plugin && plugin.settings && plugin.settings.ai) || {};
  const oc = await ensureOpenCodeClient(plugin, opts);
  let providers = null;
  try {
    // Use the providers endpoint as readiness: /global/health stalls through
    // Obsidian's request layer on OpenCode 1.19.5 even when the server is healthy.
    const found = await oc.providers(HEALTH_TIMEOUT_MS);
    if (found && Array.isArray(found.providers)) providers = found.providers;
  } catch (e) {
    // The providers endpoint is optional on older builds; health alone is still useful there.
  }
  if (!providers) {
    await oc.health(HEALTH_TIMEOUT_MS);
    providers = [];
  }
  if (providers.length === 0) {
    throw new Error("OpenCode has no AI provider connected yet. Choose a provider and paste a key above, or add one in OpenCode.");
  }
  return { version: str(ai.installedVersion), providers };
}

/** Save a key into OpenCode's own auth.json without touching the vault. */
function saveOpenCodeProviderKey(plugin, providerId, key) {
  const id = str(providerId).trim();
  const value = str(key).trim();
  if (!value) throw new Error("Paste a provider key first.");
  if (!PROVIDERS.some(([provider]) => provider === id)) throw new Error("Choose an OpenCode provider first.");
  if (!plugin || !plugin.manager || typeof plugin.manager.saveProviderKey !== "function") {
    throw new Error("OpenCode setup is not available on this device.");
  }
  return plugin.manager.saveProviderKey(id, value);
}

/** Turn an OpenCode failure into the next click a beginner can take. */
function openCodeProblem(error, plugin, url) {
  const raw = str(error && error.message ? error.message : error);
  const ai = (plugin && plugin.settings && plugin.settings.ai) || {};
  const managed = ai.managed !== false;
  const endpoint =
    str(url).trim() ||
    (plugin && plugin.manager && plugin.manager.conn && str(plugin.manager.conn.url).trim()) ||
    (managed ? "" : str(ai.url).trim());
  const friendly = endpoint ? friendlyError(error, endpoint) : raw;
  if (/no AI provider connected/i.test(raw)) return friendly;
  if (/isn't set up|isn't installed|Download and install/i.test(raw)) {
    return `${friendly} Press Install OpenCode above, or choose Direct API key.`;
  }
  const unreachable = /ECONNREFUSED|ERR_CONNECTION|Failed to fetch|ENOTFOUND|net::|ETIMEDOUT/i.test(raw);
  if (unreachable && !endpoint && managed) {
    return "The plugin-managed OpenCode server isn't reachable. Press Test again; if it still fails, switch AI backend to Direct API or paste questions instead.";
  }
  if (/Can't reach OpenCode/i.test(friendly)) {
    if (managed) {
      return `${friendly} Press Test again; the plugin manages this local server. If it still fails, switch AI backend to Direct API or paste questions instead.`;
    }
    return `${friendly} Press Test OpenCode again; if it still fails, choose Direct API key or paste questions instead.`;
  }
  return friendly;
}

/** The provider's key page, or "" for local servers and an unknown provider. */
function keyPageUrl(provider) {
  return KEY_PAGES[str(provider).trim()] || "";
}

function keyPageHost(provider) {
  const url = keyPageUrl(provider);
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch (e) {
    return "";
  }
}

/**
 * Preferred chat families per provider, most useful first. These are only
 * hints for picking from a fetched list; the provider's own list stays the
 * source of truth.
 */
const PREFERRED_MODELS = {
  anthropic: [/^claude-sonnet/i, /^claude-3[.-]7-sonnet/i, /^claude-3[.-]5-sonnet/i, /^claude/i],
  openai: [/^gpt-5/i, /^gpt-4\.1/i, /^gpt-4o/i, /^gpt-4/i, /^o\d/i, /^gpt/i],
  google: [/^gemini-2\.5-pro/i, /^gemini-2\.5-flash/i, /^gemini/i],
  qwen: [/^qwen-plus/i, /^qwen-max/i, /^qwen/i],
  openrouter: [/claude.*sonnet/i, /gpt-5/i, /gemini-2\.5-pro/i, /claude/i, /gpt/i],
  together: [/llama.*(70b|405b|instruct)/i, /qwen/i, /llama/i],
};

function preferredPatterns(provider) {
  return PREFERRED_MODELS[str(provider).trim()] || [];
}

/**
 * Pick a model a beginner can keep: a valid saved choice first, then the
 * provider's own default, then a stable family, then the provider's first
 * chat model. Never returns a name that is not offered when a list exists.
 */
function chooseModel(options) {
  const opts = options || {};
  const list = normalizeModelList(opts.models);
  const current = str(opts.saved).trim();
  if (current && (!list.length || list.includes(current))) return current;
  const fallback = str(providerPreset(opts.provider).defaultModel).trim();
  if (fallback && (!list.length || list.includes(fallback))) return fallback;
  for (const pattern of preferredPatterns(opts.provider)) {
    const hit = list.find((id) => pattern.test(id));
    if (hit) return hit;
  }
  return list[0] || current || fallback;
}

/** Switch provider and reset everything that addressed the old one. */
function applyProvider(ai, provider) {
  const id = API_PRESETS[provider] ? provider : RECOMMENDED_PROVIDER;
  const api = ai.api || (ai.api = {});
  api.provider = id;
  api.baseUrl = "";
  api.model = API_PRESETS[id].defaultModel || "";
  api.models = [];
  return id;
}

/**
 * Read the provider's model list through the existing ApiClient, persist it,
 * and optionally choose a model. The practice wizard asks for autoPick; the
 * Settings page keeps its explicit dropdown.
 */
async function fetchModels(plugin, options) {
  const opts = options || {};
  if (plugin.backend() !== "api") {
    throw new Error("Runtime model discovery is available for Direct AI. Choose Direct API in the AI settings.");
  }
  const ai = plugin.settings.ai;
  const api = ai.api || (ai.api = {});
  const key = str(opts.key).trim();
  if (key) {
    storeApiKey(plugin.app, api, api.provider, key);
    await plugin.save();
  }
  const found = await new ApiClient(ai, plugin.app).listModels();
  api.models = found.models.slice();
  let model = "";
  if (opts.autoPick === true) {
    model = chooseModel({ provider: api.provider, saved: api.model, models: found.models });
    if (model) api.model = model;
  }
  await plugin.save();
  return { ...found, model };
}

/** One short chat request. It does not spend a quiz or record any usage. */
async function testConnection(plugin, options) {
  const opts = options || {};
  if (plugin.backend() !== "api") {
    throw new Error("Test connection here checks Direct API. OpenCode has its own Test in AI settings.");
  }
  const ai = plugin.settings.ai;
  const api = ai.api || {};
  const key = str(opts.key).trim();
  if (key) {
    storeApiKey(plugin.app, api, api.provider, key);
    await plugin.save();
  }
  if (!str(api.model).trim()) throw new Error("Choose a model first. Fetch models fills this in for you.");
  const reply = await new ApiClient(ai, plugin.app).chat(
    "You are a connection test.",
    [{ role: "user", content: "Reply with the single word OK." }],
    { maxTokens: 24 }
  );
  return str(reply).trim();
}

/**
 * Turn a provider failure into one sentence a beginner can act on: what went
 * wrong and the next click. The setup screen shows this verbatim.
 */
function connectionProblem(error, provider) {
  const raw = str(error && error.message ? error.message : error);
  const friendly = friendlyApiError(error);
  const canCreate = !!keyPageUrl(provider);
  if (/HTTP 401|HTTP 403|rejected the API key/i.test(raw)) {
    return `${friendly} Check that the whole key was pasted${canCreate ? ", or create a new one with Create a key" : ""}.`;
  }
  if (/ENOTFOUND|ECONNREFUSED|Failed to fetch|net::|ETIMEDOUT|Couldn't reach the provider/i.test(raw)) {
    return `${friendly} Paste questions instead (it works offline), or try again when you're back online.`;
  }
  if (/empty model list|only non-chat|did not expose a model list|not in a recognised format/i.test(raw)) {
    return `${friendly} Try another provider, or paste questions instead (it works offline).`;
  }
  if (/Add your API key/i.test(raw)) {
    return `${friendly} Create a key, then paste it above.`;
  }
  if (/Add a base URL/i.test(raw)) {
    return `${friendly} Add the server's address above.`;
  }
  return friendly;
}

module.exports = {
  KEY_PAGES,
  RECOMMENDED_PROVIDER,
  applyProvider,
  chooseModel,
  connectionProblem,
  fetchModels,
  isRecommendedProvider,
  keyPageHost,
  keyPageUrl,
  ensureOpenCodeClient,
  openCodeInstalled,
  openCodeProblem,
  preferredPatterns,
  providerLabel,
  providerPreset,
  recommendedProvider,
  saveOpenCodeProviderKey,
  testConnection,
  testOpenCode,
};
