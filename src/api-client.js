"use strict";
const { requestUrl } = require("obsidian");
const { str } = require("./util");
const { resolveApiKey } = require("./secret-keys");
const { safeApiBase } = require("./url-safety");
const { parseModelList } = require("./model-discovery");

/* ---------------------------------------------- Direct API chat (works on phones) */

const API_PRESETS = {
  anthropic: { label: "Anthropic (Claude)", kind: "anthropic", base: "https://api.anthropic.com", defaultModel: "claude-sonnet-5-5" },
  openai: { label: "OpenAI", kind: "openai", base: "https://api.openai.com/v1", defaultModel: "" },
  openrouter: { label: "OpenRouter", kind: "openai", base: "https://openrouter.ai/api/v1", defaultModel: "" },
  google: { label: "Google Gemini", kind: "openai", base: "https://generativelanguage.googleapis.com/v1beta/openai", defaultModel: "" },
  ollama: { label: "Ollama (same computer only)", kind: "openai", base: "http://localhost:11434/v1", defaultModel: "", noKey: true },
  custom: { label: "Other OpenAI-compatible", kind: "openai", base: "", defaultModel: "" },
};

function friendlyApiError(e) {
  const m = str(e && e.message ? e.message : e);
  if (/HTTP 401|HTTP 403/.test(m)) return `The provider rejected the API key, or the key can't use this model. ${m}`;
  if (/HTTP 429/.test(m)) return `The provider says you're rate limited or out of credit. ${m}`;
  if (/ENOTFOUND|ECONNREFUSED|Failed to fetch|net::|ETIMEDOUT/i.test(m)) {
    return "Couldn't reach the provider. Check your internet connection and the base URL in settings.";
  }
  return m;
}

function apiTurns(history) {
  return (history || []).map((m) => ({ role: m.role === "user" ? "user" : "assistant", texts: [m.content], tools: [] }));
}

/** Plain chat against Anthropic or any OpenAI-compatible endpoint. One request, no streaming. */
class ApiClient {
  /** opts.model overrides the backend-wide model for one feature. */
  constructor(ai, app, opts) {
    this.ai = ai;
    this.app = app;
    this.opts = opts || {};
  }
  cfg() {
    const a = this.ai.api || {};
    const preset = API_PRESETS[a.provider] || API_PRESETS.custom;
    return {
      preset,
      base: (str(a.baseUrl).trim() || preset.base).replace(/\/+$/, "") ? safeApiBase((str(a.baseUrl).trim() || preset.base).replace(/\/+$/, "")) : "",
      key: resolveApiKey(this.app, a),
      model: str(this.opts.model).trim() || str(a.model).trim(),
    };
  }
  async vision(system, prompt, images, opts) {
    const { preset, base, key, model } = this.cfg();
    if (!base) throw new Error("Add a base URL in the plugin settings.");
    if (!model) throw new Error("Add a model name in the plugin settings.");
    if (!key && !preset.noKey) throw new Error("Add your API key in the plugin settings.");
    const list = (Array.isArray(images) ? images : []).filter((image) => image && image.data);
    if (!list.length) throw new Error("There are no page images to send.");

    let url, headers, body;
    if (preset.kind === "anthropic") {
      url = `${base}/v1/messages`;
      headers = { "x-api-key": key, "anthropic-version": "2023-06-01" };
      body = {
        model,
        max_tokens: (opts && opts.maxTokens) || 1800,
        system,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              ...list.map((image) => ({ type: "image", source: { type: "base64", media_type: image.mime || "image/png", data: image.data } })),
            ],
          },
        ],
      };
    } else {
      url = `${base}/chat/completions`;
      headers = key ? { Authorization: `Bearer ${key}` } : {};
      body = {
        model,
        max_tokens: (opts && opts.maxTokens) || 1800,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              ...list.map((image) => ({ type: "image_url", image_url: { url: `data:${image.mime || "image/png"};base64,${image.data}` } })),
            ],
          },
        ],
      };
    }
    const r = await requestUrl({ url, method: "POST", headers, contentType: "application/json", body: JSON.stringify(body), throw: false });
    let data = null;
    try {
      data = r.json;
    } catch (e) {
      /* not JSON */
    }
    if (r.status >= 400) {
      const em = data && data.error ? data.error.message || data.error : r.text;
      throw new Error(`HTTP ${r.status}: ${str(typeof em === "string" ? em : JSON.stringify(em)).slice(0, 300)}`);
    }
    let text = "";
    if (preset.kind === "anthropic") {
      text = ((data && data.content) || []).filter((c) => c.type === "text").map((c) => c.text).join("\n");
    } else {
      const c = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      text = Array.isArray(c) ? c.map((x) => x.text || "").join("") : str(c);
    }
    if (!text.trim()) throw new Error("The provider returned an empty reply.");
    return text;
  }

  /** Read the provider's current model list. This never sends a prompt or spends a generation request. */
  async listModels() {
    const { preset, base, key } = this.cfg();
    if (!base) throw new Error("Add a base URL in the plugin settings.");
    if (!key && !preset.noKey) throw new Error("Add your API key in the plugin settings.");
    const anthropic = preset.kind === "anthropic";
    const url = `${base}${anthropic ? "/v1/models?limit=1000" : "/models"}`;
    const headers = anthropic
      ? { "x-api-key": key, "anthropic-version": "2023-06-01" }
      : key
        ? { Authorization: `Bearer ${key}` }
        : {};
    let response;
    try {
      response = await requestUrl({ url, method: "GET", headers, throw: false });
    } catch (e) {
      throw new Error(friendlyApiError(e));
    }
    if (!response || typeof response !== "object") throw new Error("The provider returned no response.");
    let data = null;
    try {
      data = response.json;
    } catch (e) {
      /* not JSON */
    }
    if (response.status >= 400) {
      const detail = data && data.error ? data.error.message || data.error : response.text;
      const reason = str(typeof detail === "string" ? detail : JSON.stringify(detail)).slice(0, 300);
      if (response.status === 404) {
        throw new Error(`The provider did not expose a model list at that address. Check the base URL. HTTP 404: ${reason}`);
      }
      throw new Error(friendlyApiError(new Error(`HTTP ${response.status}: ${reason}`)));
    }
    const parsed = parseModelList(data);
    if (!parsed.models.length) throw new Error(parsed.issue || "The provider returned an empty model list.");
    return parsed;
  }

  async chat(system, messages, opts) {
    const { preset, base, key, model } = this.cfg();
    if (!base) throw new Error("Add a base URL in the plugin settings.");
    if (!model) throw new Error("Add a model name in the plugin settings.");
    if (!key && !preset.noKey) throw new Error("Add your API key in the plugin settings.");
    const msgs = messages.slice(-20);
    while (msgs.length && msgs[0].role !== "user") msgs.shift(); // providers require a user turn first

    let url, headers, body;
    if (preset.kind === "anthropic") {
      url = `${base}/v1/messages`;
      headers = { "x-api-key": key, "anthropic-version": "2023-06-01" };
      body = { model, max_tokens: (opts && opts.maxTokens) || 1500, system, messages: msgs };
    } else {
      url = `${base}/chat/completions`;
      headers = key ? { Authorization: `Bearer ${key}` } : {};
      body = { model, max_tokens: (opts && opts.maxTokens) || 1500, messages: [{ role: "system", content: system }, ...msgs] };
    }
    const r = await requestUrl({ url, method: "POST", headers, contentType: "application/json", body: JSON.stringify(body), throw: false });
    let data = null;
    try {
      data = r.json;
    } catch (e) {
      /* not JSON */
    }
    if (r.status >= 400) {
      const em = data && data.error ? data.error.message || data.error : r.text;
      throw new Error(`HTTP ${r.status}: ${str(typeof em === "string" ? em : JSON.stringify(em)).slice(0, 300)}`);
    }
    let text = "";
    if (preset.kind === "anthropic") {
      text = ((data && data.content) || []).filter((c) => c.type === "text").map((c) => c.text).join("\n");
    } else {
      const c = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      text = Array.isArray(c) ? c.map((x) => x.text || "").join("") : str(c);
    }
    if (!text.trim()) throw new Error("The provider returned an empty reply.");
    return text;
  }
}

module.exports = {
  API_PRESETS,
  friendlyApiError,
  apiTurns,
  ApiClient,
};
