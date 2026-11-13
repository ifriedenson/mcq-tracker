"use strict";
const { requestUrl } = require("obsidian");
const { str } = require("./util");
const { resolveApiKey } = require("./secret-keys");
const { safeApiBase } = require("./url-safety");
const { parseModelList } = require("./model-discovery");
const { chunksFromStream, fullText, readStream } = require("./chat-stream");

/* ---------------------------------------------- Direct API chat (works on phones) */

const API_PRESETS = {
  anthropic: { label: "Anthropic (Claude)", kind: "anthropic", base: "https://api.anthropic.com", defaultModel: "claude-sonnet-5-5" },
  openai: { label: "OpenAI", kind: "openai", base: "https://api.openai.com/v1", defaultModel: "" },
  openrouter: { label: "OpenRouter", kind: "openai", base: "https://openrouter.ai/api/v1", defaultModel: "" },
  together: { label: "Together AI", kind: "openai", base: "https://api.together.xyz/v1", defaultModel: "" },
  google: { label: "Google Gemini", kind: "openai", base: "https://generativelanguage.googleapis.com/v1beta/openai", defaultModel: "" },
  qwen: { label: "Qwen (DashScope)", kind: "openai", base: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1", defaultModel: "qwen-plus" },
  ollama: { label: "Ollama (local, offline)", kind: "openai", base: "http://localhost:11434/v1", defaultModel: "", noKey: true, local: true },
  lmstudio: { label: "LM Studio (local, offline)", kind: "openai", base: "http://localhost:1234/v1", defaultModel: "", noKey: true, local: true },
  llamacpp: { label: "llama.cpp server (local, offline)", kind: "openai", base: "http://localhost:9931/v1", defaultModel: "", noKey: true, local: true },
  jan: { label: "Jan (local, offline)", kind: "openai", base: "http://127.0.0.1:1337/v1", defaultModel: "", noKey: true, local: true },
  custom: { label: "Other OpenAI-compatible", kind: "openai", base: "", defaultModel: "" },
};

function friendlyApiError(e) {
  const m = str(e && e.message ? e.message : e);
  // Callers can pass a message that was already made friendly; do not prefix it twice.
  if (/^(?:The provider rejected the API key|The provider says you're rate limited|Couldn't reach the provider)/.test(m)) return m;
  if (/HTTP 401|HTTP 403/.test(m)) return `The provider rejected the API key, or the key can't use this model. ${m}`;
  if (/HTTP 429/.test(m)) return `The provider says you're rate limited or out of credit. ${m}`;
  if (/ENOTFOUND|ECONNREFUSED|Failed to fetch|net::|ETIMEDOUT/i.test(m)) {
    return "Couldn't reach the provider. Check your internet connection and the base URL in settings.";
  }
  return m;
}

/** A provider failure whose fix is a value on the AI settings page. */
function configError(message, code) {
  const error = new Error(message);
  error.aiConfig = true;
  error.code = code || "ai-config";
  return error;
}

/** A request that never reached the provider: only the base URL/connection message is actionable in settings. */
function requestFailure(error) {
  const message = friendlyApiError(error);
  return /Couldn't reach the provider/.test(message) ? configError(message) : new Error(message);
}

/** An HTTP response from the provider: key/model/endpoint failures belong on the AI settings page. */
function providerHttpError(status, reason) {
  const detail = `HTTP ${status}: ${str(reason).trim()}`;
  if (status === 401 || status === 403) return configError(friendlyApiError(new Error(detail)), "provider-auth");
  if (status === 404) {
    return configError(
      `The provider did not find that model or endpoint. Check the model name and base URL in settings. ${detail}`,
      "provider-model"
    );
  }
  if ((status === 400 || status === 422) && /model|context|max_tokens|token limit/i.test(detail)) {
    return configError(`The provider rejected the request. Check the model name and request limits in settings. ${detail}`, "provider-model");
  }
  return new Error(friendlyApiError(new Error(detail)));
}

/** No provider reply should spin forever; a request that hangs is a dead end for the user. */
const REQUEST_TIMEOUT_MS = 120 * 1000;

function timeoutLabel(ms) {
  return ms >= 1000 ? Math.round(ms / 1000) + "s" : ms + "ms";
}

/** Reject with an actionable message when `promise` is still pending after `ms`. */
function withinTimeout(promise, ms, label) {
  let timer = null;
  const limit = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(label + " took longer than " + timeoutLabel(ms) + ". Check your connection, then try again.")), ms);
  });
  return Promise.race([promise, limit]).finally(() => {
    if (timer) clearTimeout(timer);
  });
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
    const rawBase = (str(a.baseUrl).trim() || preset.base).replace(/\/+$/, "");
    let base = "";
    if (rawBase) {
      try {
        base = safeApiBase(rawBase);
      } catch (e) {
        throw configError(str(e && e.message ? e.message : e));
      }
    }
    return {
      timeoutMs: Number(this.opts.timeoutMs) > 0 ? Number(this.opts.timeoutMs) : REQUEST_TIMEOUT_MS,
      preset,
      base,
      key: resolveApiKey(this.app, a),
      model: str(this.opts.model).trim() || str(a.model).trim() || preset.defaultModel,
    };
  }
  async vision(system, prompt, images, opts) {
    const { preset, base, key, model, timeoutMs } = this.cfg();
    if (!base) throw configError("Add a base URL in the plugin settings.", "missing-base");
    if (!model) throw configError("Add a model name in the plugin settings.", "missing-model");
    if (!key && !preset.noKey) throw configError("Add your API key in the plugin settings.", "missing-key");
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
    let r;
    try {
      r = await withinTimeout(
        requestUrl({ url, method: "POST", headers, contentType: "application/json", body: JSON.stringify(body), throw: false }),
        timeoutMs,
        "The image request"
      );
    } catch (e) {
      throw requestFailure(e);
    }
    if (!r) throw new Error("The provider returned no response.");
    let data = null;
    try {
      data = r.json;
    } catch (e) {
      /* not JSON */
    }
    if (r.status >= 400) {
      const em = data && data.error ? data.error.message || data.error : r.text;
      const reason = str(typeof em === "string" ? em : JSON.stringify(em)).slice(0, 300);
      throw providerHttpError(r.status, reason);
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
    const { preset, base, key, timeoutMs } = this.cfg();
    if (!base) throw configError("Add a base URL in the plugin settings.", "missing-base");
    if (!key && !preset.noKey) throw configError("Add your API key in the plugin settings.", "missing-key");
    const anthropic = preset.kind === "anthropic";
    const url = `${base}${anthropic ? "/v1/models?limit=1000" : "/models"}`;
    const headers = anthropic
      ? { "x-api-key": key, "anthropic-version": "2023-06-01" }
      : key
        ? { Authorization: `Bearer ${key}` }
        : {};
    let response;
    try {
      response = await withinTimeout(requestUrl({ url, method: "GET", headers, throw: false }), timeoutMs, "The model list request");
    } catch (e) {
      throw requestFailure(e);
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
        throw configError(`The provider did not expose a model list at that address. Check the base URL. HTTP 404: ${reason}`, "provider-model");
      }
      throw providerHttpError(response.status, reason);
    }
    const parsed = parseModelList(data);
    if (!parsed.models.length) throw new Error(parsed.issue || "The provider returned an empty model list.");
    return parsed;
  }

  /**
   * Stream a reply through fetch/SSE when the runtime and provider support it.
   * Returns this.chat() unchanged when fetch is missing, when the provider
   * ignores `stream` and answers with ordinary JSON, or when the SSE body is
   * empty. A provider error is raised, never silently retried here.
   */
  async streamChat(system, messages, opts) {
    const o = opts || {};
    if (typeof fetch !== "function" || typeof AbortController === "undefined" || typeof o.onDelta !== "function") {
      return this.chat(system, messages, o);
    }
    const { preset, base, key, model, timeoutMs } = this.cfg();
    if (!base) throw configError("Add a base URL in the plugin settings.", "missing-base");
    if (!model) throw configError("Add a model name in the plugin settings.", "missing-model");
    if (!key && !preset.noKey) throw configError("Add your API key in the plugin settings.", "missing-key");
    const msgs = messages.slice(-20);
    while (msgs.length && msgs[0].role !== "user") msgs.shift();
    const kind = preset.kind === "anthropic" ? "anthropic" : "openai";
    const url = preset.kind === "anthropic" ? `${base}/v1/messages` : `${base}/chat/completions`;
    const headers =
      preset.kind === "anthropic" ? { "x-api-key": key, "anthropic-version": "2023-06-01" } : key ? { Authorization: `Bearer ${key}` } : {};
    const body =
      preset.kind === "anthropic"
        ? { model, max_tokens: o.maxTokens || 1500, system, messages: msgs, stream: true }
        : { model, max_tokens: o.maxTokens || 1500, messages: [{ role: "system", content: system }, ...msgs], stream: true };
    let response;
    try {
      response = await withinTimeout(
        fetch(url, {
          method: "POST",
          headers: { ...headers, "content-type": "application/json", accept: "text/event-stream" },
          body: JSON.stringify(body),
          signal: o.signal,
        }),
        timeoutMs,
        "The provider"
      );
    } catch (e) {
      // A cancel is the user's own action; callers detect it by error name, so keep it unwrapped.
      if (e && (e.name === "AbortError" || (o.signal && o.signal.aborted))) throw e;
      throw requestFailure(e);
    }
    if (!response || !response.ok) {
      let reason = "";
      try {
        const data = response && typeof response.json === "function" ? await response.json() : null;
        const message = data && data.error ? data.error.message || data.error : "";
        if (message) reason = str(typeof message === "string" ? message : JSON.stringify(message)).slice(0, 300);
      } catch (error) {
        /* the error body may not be JSON */
      }
      if (!response) throw new Error("The provider returned no response.");
      throw providerHttpError(response.status, reason || "no response");
    }
    const type = response.headers && typeof response.headers.get === "function" ? str(response.headers.get("content-type")) : "";
    if (type.includes("text/event-stream") && response.body && typeof response.body.getReader === "function") {
      const text = await readStream(chunksFromStream(response.body), { kind, onDelta: o.onDelta, signal: o.signal });
      if (text.trim()) return text;
      return this.chat(system, messages, o);
    }
    if (typeof response.json === "function") {
      const data = await response.json();
      const text = fullText(data, kind);
      if (!text.trim()) throw new Error("The provider returned an empty reply.");
      o.onDelta(text);
      return text;
    }
    return this.chat(system, messages, o);
  }

  async chat(system, messages, opts) {
    const { preset, base, key, model, timeoutMs } = this.cfg();
    if (!base) throw configError("Add a base URL in the plugin settings.", "missing-base");
    if (!model) throw configError("Add a model name in the plugin settings.", "missing-model");
    if (!key && !preset.noKey) throw configError("Add your API key in the plugin settings.", "missing-key");
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
    let r;
    try {
      r = await withinTimeout(
        requestUrl({ url, method: "POST", headers, contentType: "application/json", body: JSON.stringify(body), throw: false }),
        timeoutMs,
        "The provider"
      );
    } catch (e) {
      throw requestFailure(e);
    }
    let data = null;
    try {
      data = r && r.json;
    } catch (e) {
      /* not JSON */
    }
    if (!r) throw new Error("The provider returned no response.");
    if (r.status >= 400) {
      const em = data && data.error ? data.error.message || data.error : r.text;
      const reason = str(typeof em === "string" ? em : JSON.stringify(em)).slice(0, 300);
      throw providerHttpError(r.status, reason);
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
  REQUEST_TIMEOUT_MS,
  withinTimeout,
};
